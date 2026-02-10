import { Request, Response } from 'express';
import { Trainer, BSCEntry, AuditLog } from '../models';
import { SubmitBSCRequest, ValidateBSCRequest, ApiResponse, DEFAULT_TRAINER_SCORECARD, IScorecardMetric } from '@rmp/shared-types';
import { ITrainerDocument } from '../models/Trainer';

// Resolves the scorecard a trainer actually uses: default or custom
function getEffectiveScorecard(trainer: ITrainerDocument): IScorecardMetric[] {
  if (trainer.useDefaultScorecard) return DEFAULT_TRAINER_SCORECARD;
  return trainer.scorecardTemplate.length > 0 ? trainer.scorecardTemplate : DEFAULT_TRAINER_SCORECARD;
}

/**
 * Submit BSC self-assessment
 * POST /api/bsc/submit
 *
 * Requires `bscAccessToken` in the request body to prove the caller is the
 * trainer they claim to be. This prevents Trainer A from submitting for Trainer B.
 */
export async function submitBSC(req: Request, res: Response): Promise<void> {
  try {
    const { trainerId, quarter, selfScores, bscAccessToken } = req.body as SubmitBSCRequest & { bscAccessToken?: string };

    // Validate inputs
    if (!trainerId || !quarter || !selfScores || !bscAccessToken) {
      res.status(400).json({
        success: false,
        error: 'trainerId, quarter, selfScores, and bscAccessToken are required'
      } as ApiResponse);
      return;
    }

    // Validate quarter format
    if (!/^\d{4}-Q[1-4]$/.test(quarter)) {
      res.status(400).json({
        success: false,
        error: 'Invalid quarter format. Use YYYY-Q# (e.g., 2026-Q1)'
      } as ApiResponse);
      return;
    }

    // Get trainer
    const trainer = await Trainer.findById(trainerId);
    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    // Verify the BSC access token matches this trainer (prevents cross-trainer submission)
    if (trainer.bscAccessToken !== bscAccessToken) {
      res.status(403).json({
        success: false,
        error: 'Invalid access token for this trainer'
      } as ApiResponse);
      return;
    }

    const scorecard = getEffectiveScorecard(trainer);

    const templateMetrics = scorecard.map(m => m.metricName);
    const scoreMetrics = selfScores.map(s => s.metricName);

    // Check all template metrics are present
    const missingMetrics = templateMetrics.filter(m => !scoreMetrics.includes(m));
    if (missingMetrics.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing scores for metrics: ${missingMetrics.join(', ')}`
      } as ApiResponse);
      return;
    }

    // Calculate weighted score
    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of selfScores) {
      const metric = scorecard.find(m => m.metricName === score.metricName);
      if (!metric) {
        res.status(400).json({
          success: false,
          error: `Invalid metric: ${score.metricName}`
        } as ApiResponse);
        return;
      }

      // Validate score range
      if (score.score < metric.minScore || score.score > metric.maxScore) {
        res.status(400).json({
          success: false,
          error: `Score for ${score.metricName} must be between ${metric.minScore} and ${metric.maxScore}`
        } as ApiResponse);
        return;
      }

      // Calculate weighted contribution
      const normalizedScore = score.score / metric.maxScore; // Convert to 0-1
      weightedSum += normalizedScore * metric.weight;
      totalWeight += metric.weight;
    }

    const selfCalculatedScore = weightedSum / totalWeight;

    // Parse quarter to extract year and quarterNumber
    const [yearStr, quarterStr] = quarter.split('-Q');
    const year = parseInt(yearStr);
    const quarterNumber = parseInt(quarterStr) as 1 | 2 | 3 | 4;

    // Check if BSC already exists
    const existing = await BSCEntry.findOne({ trainerId, quarter });
    if (existing) {
      res.status(409).json({
        success: false,
        error: `BSC already submitted for ${quarter}. Status: ${existing.status}`
      } as ApiResponse);
      return;
    }

    // Create BSC entry
    const bscEntry = new BSCEntry({
      trainerId,
      quarter,
      year,
      quarterNumber,
      selfScores,
      selfCalculatedScore,
      submittedAt: new Date(),
      status: 'pending_validation',
      bonusPaid: false
    });

    await bscEntry.save();

    // Create audit log
    await AuditLog.create({
      userId: trainerId,
      userName: trainer.name,
      action: 'submit',
      entity: 'bsc',
      entityId: bscEntry._id.toString(),
      metadata: { quarter, selfCalculatedScore },
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      data: bscEntry,
      message: 'BSC submitted successfully'
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error submitting BSC:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit BSC',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Check existing BSC submission for a trainer (token-authenticated)
 * GET /api/bsc/check/:trainerId/:quarter?token=<bscAccessToken>
 */
export async function checkBSCByToken(req: Request, res: Response): Promise<void> {
  try {
    const { trainerId, quarter } = req.params;
    const { token } = req.query;

    if (!token || typeof token !== 'string' || token.length !== 64) {
      res.status(400).json({ success: false, error: 'Valid access token required' } as ApiResponse);
      return;
    }

    // Verify token belongs to this trainer
    const trainer = await Trainer.findById(trainerId);
    if (!trainer || trainer.bscAccessToken !== token) {
      res.status(403).json({ success: false, error: 'Invalid access token for this trainer' } as ApiResponse);
      return;
    }

    const entries = await BSCEntry.find({ trainerId, quarter });
    res.json({ success: true, data: entries } as ApiResponse);
  } catch (error: any) {
    console.error('Error checking BSC:', error);
    res.status(500).json({ success: false, error: 'Failed to check BSC entries' } as ApiResponse);
  }
}

/**
 * Get pending BSC entries for admin review
 * GET /api/bsc/pending
 */
export async function getPendingBSC(req: Request, res: Response): Promise<void> {
  try {
    const entries = await BSCEntry.find({ status: 'pending_validation' })
      .sort({ submittedAt: 1 });

    // Enrich with trainer names
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        const trainer = await Trainer.findById(entry.trainerId);
        return {
          ...entry.toJSON(),
          trainerName: trainer?.name || 'Unknown'
        };
      })
    );

    res.json({
      success: true,
      data: enrichedEntries
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error fetching pending BSC:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending BSC entries',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Validate BSC entry
 * PUT /api/bsc/:id/validate
 */
export async function validateBSC(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { validatedScores, validationNotes }: ValidateBSCRequest = req.body;

    if (!validatedScores) {
      res.status(400).json({
        success: false,
        error: 'validatedScores is required'
      } as ApiResponse);
      return;
    }

    const bscEntry = await BSCEntry.findById(id);
    if (!bscEntry) {
      res.status(404).json({
        success: false,
        error: 'BSC entry not found'
      } as ApiResponse);
      return;
    }

    if (bscEntry.status !== 'pending_validation') {
      res.status(400).json({
        success: false,
        error: `BSC already ${bscEntry.status}`
      } as ApiResponse);
      return;
    }

    // Get trainer for scorecard template
    const trainer = await Trainer.findById(bscEntry.trainerId);
    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    const scorecard = getEffectiveScorecard(trainer);

    // Calculate final weighted score
    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of validatedScores) {
      const metric = scorecard.find(m => m.metricName === score.metricName);
      if (!metric) {
        res.status(400).json({
          success: false,
          error: `Invalid metric: ${score.metricName}`
        } as ApiResponse);
        return;
      }

      const normalizedScore = score.score / metric.maxScore;
      weightedSum += normalizedScore * metric.weight;
      totalWeight += metric.weight;
    }

    const finalScore = weightedSum / totalWeight;

    // Update BSC entry
    bscEntry.validatedScores = validatedScores;
    bscEntry.finalScore = finalScore;
    bscEntry.status = 'validated';
    bscEntry.validatedBy = req.user?.userId;
    bscEntry.validatedAt = new Date();
    bscEntry.validationNotes = validationNotes;

    await bscEntry.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'validate',
      entity: 'bsc',
      entityId: bscEntry._id.toString(),
      changes: {
        selfScore: bscEntry.selfCalculatedScore,
        finalScore,
        validationNotes
      },
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: bscEntry,
      message: 'BSC validated successfully'
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error validating BSC:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate BSC',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Get BSC entries for a specific trainer
 * GET /api/bsc/trainer/:trainerId
 */
export async function getTrainerBSC(req: Request, res: Response): Promise<void> {
  try {
    const { trainerId } = req.params;

    const trainer = await Trainer.findById(trainerId);
    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    const entries = await BSCEntry.find({ trainerId })
      .sort({ year: -1, quarterNumber: -1 });

    res.json({
      success: true,
      data: {
        trainer: {
          _id: trainer._id.toString(),
          name: trainer.name,
          useDefaultScorecard: trainer.useDefaultScorecard,
          scorecardTemplate: getEffectiveScorecard(trainer)
        },
        entries
      }
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error fetching trainer BSC:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trainer BSC entries',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

/**
 * Get all BSC entries (with filters)
 * GET /api/bsc
 */
export async function getAllBSC(req: Request, res: Response): Promise<void> {
  try {
    const { status, quarter } = req.query;

    const filter: any = {};

    if (status && typeof status === 'string') {
      filter.status = status;
    }

    if (quarter && typeof quarter === 'string') {
      filter.quarter = quarter;
    }

    const entries = await BSCEntry.find(filter)
      .sort({ year: -1, quarterNumber: -1, submittedAt: -1 });

    res.json({
      success: true,
      data: entries
    } as ApiResponse);

  } catch (error: any) {
    console.error('Error fetching BSC entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch BSC entries',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}
