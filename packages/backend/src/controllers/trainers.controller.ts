import { Request, Response } from 'express';
import { Trainer } from '../models';
import { AuditLog } from '../models';
import { CreateTrainerRequest, UpdateTrainerRequest, ApiResponse } from '@rmp/shared-types';

// Get all trainers
export async function getAllTrainers(req: Request, res: Response): Promise<void> {
  try {
    const { status, search } = req.query;

    const filter: any = {};

    if (status && typeof status === 'string') {
      filter.status = status;
    }

    if (search && typeof search === 'string') {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } }
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
      message: error.message
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
      message: error.message
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
      message: error.message
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
        { memberId: trainerData.memberId }
      ]
    });

    if (existingTrainer) {
      res.status(409).json({
        success: false,
        error: 'Trainer already exists with this userId, email, or memberId'
      } as ApiResponse);
      return;
    }

    const trainer = new Trainer({
      ...trainerData,
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
      message: error.message
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

    await trainer.save();

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
      message: error.message
    } as ApiResponse);
  }
}

// Delete trainer (soft delete by setting status to inactive)
export async function deleteTrainer(req: Request, res: Response): Promise<void> {
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

    trainer.status = 'inactive';
    trainer.updatedBy = req.user?.userId;
    await trainer.save();

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
      message: error.message
    } as ApiResponse);
  }
}
