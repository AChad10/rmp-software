import { Request, Response } from 'express';
import { Trainer } from '../models';
import { AuditLog } from '../models';
import { CreateTrainerRequest, UpdateTrainerRequest, ApiResponse } from '@rmp/shared-types';

// Escape special regex characters to prevent ReDoS
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get all trainers
export async function getAllTrainers(req: Request, res: Response): Promise<void> {
  try {
    const { status, search } = req.query;

    const filter: any = {};

    if (status && typeof status === 'string') {
      const validStatuses = ['active', 'inactive', 'on_leave'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status filter' });
        return;
      }
      filter.status = status;
    }

    if (search && typeof search === 'string') {
      const safeSearch = escapeRegex(search.slice(0, 100)); // limit length + escape
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { employeeCode: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const trainers = await Trainer.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      data: trainers
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error fetching trainers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trainers',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

// Get trainer by ID
export async function getTrainerById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const trainer = await Trainer.findById(id);

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: trainer
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error fetching trainer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trainer',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

// Get trainer by Slack user ID
export async function getTrainerByUserId(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    const trainer = await Trainer.findOne({ userId });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: trainer
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error fetching trainer by userId:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trainer',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

// Get trainer by BSC access token (for secure BSC form access)
export async function getTrainerByBscToken(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;

    if (!token || token.length !== 64) {
      res.status(400).json({
        success: false,
        error: 'Invalid access token'
      } as ApiResponse);
      return;
    }

    const trainer = await Trainer.findOne({ bscAccessToken: token, status: 'active' });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Invalid or expired access token'
      } as ApiResponse);
      return;
    }

    // Return trainer data without sensitive fields
    const safeTrainerData = {
      _id: trainer._id,
      name: trainer.name,
      email: trainer.email,
      team: trainer.team,
      useDefaultScorecard: trainer.useDefaultScorecard,
      scorecardTemplate: trainer.scorecardTemplate,
      quarterlyBonusAmount: trainer.quarterlyBonusAmount,
    };

    res.json({
      success: true,
      data: safeTrainerData
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error fetching trainer by BSC token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trainer',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

// Regenerate BSC access token for a trainer
export async function regenerateBscToken(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const crypto = require('crypto');

    const trainer = await Trainer.findById(id);

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    // Generate new token
    const newToken = crypto.randomBytes(32).toString('hex');
    trainer.bscAccessToken = newToken;
    await trainer.save();

    res.json({
      success: true,
      data: { bscAccessToken: newToken },
      message: 'BSC access token regenerated successfully'
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error regenerating BSC token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate token',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

// Create new trainer
export async function createTrainer(req: Request, res: Response): Promise<void> {
  try {
    const trainerData: CreateTrainerRequest = req.body;

    // Check if trainer with userId or email already exists
    const existingTrainer = await Trainer.findOne({
      $or: [
        { userId: trainerData.userId },
        { email: trainerData.email },
        { employeeCode: trainerData.employeeCode }
      ]
    });

    if (existingTrainer) {
      res.status(409).json({
        success: false,
        error: 'Trainer already exists with this userId, email, or employee code'
      } as ApiResponse);
      return;
    }

    // Remove empty string values so Mongoose defaults apply
    const cleanedData = Object.fromEntries(
      Object.entries(trainerData).filter(([, v]) => v !== '')
    );

    const trainer = new Trainer({
      ...cleanedData,
      status: 'active',
      createdBy: req.user?.userId
    });

    await trainer.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'create',
      entity: 'trainer',
      entityId: trainer._id.toString(),
      changes: trainerData,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      data: trainer,
      message: 'Trainer created successfully'
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error creating trainer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trainer',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

// Update trainer
export async function updateTrainer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates: UpdateTrainerRequest = req.body;

    const trainer = await Trainer.findById(id);

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    // Store old values for audit
    const oldValues: any = {};
    Object.keys(updates).forEach(key => {
      oldValues[key] = (trainer as any)[key];
    });

    Object.assign(trainer, {
      ...updates,
      updatedBy: req.user?.userId
    });

    await trainer.save({ validateModifiedOnly: true });

    // Create audit log
    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'update',
      entity: 'trainer',
      entityId: trainer._id.toString(),
      changes: {
        before: oldValues,
        after: updates
      },
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: trainer,
      message: 'Trainer updated successfully'
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error updating trainer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trainer',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}

// Delete trainer (soft delete by setting status to inactive)
export async function deleteTrainer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const trainer = await Trainer.findByIdAndUpdate(
      id,
      { status: 'inactive', updatedBy: req.user?.userId },
      { new: true, runValidators: false }
    );

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      } as ApiResponse);
      return;
    }

    // Create audit log
    await AuditLog.create({
      userId: req.user?.userId || 'system',
      userName: req.user?.email || 'system',
      action: 'delete',
      entity: 'trainer',
      entityId: trainer._id.toString(),
      metadata: { softDelete: true },
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Trainer deactivated successfully'
    } as ApiResponse);
  } catch (error: any) {
    console.error('Error deleting trainer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trainer',
      ...(process.env.NODE_ENV === 'development' && { message: error.message })
    } as ApiResponse);
  }
}
