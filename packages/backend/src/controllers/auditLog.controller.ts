import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get all audit logs with optional filters
 */
export async function getAllAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate, userEmail, action, entityId } = req.query;

    const filter: Record<string, any> = {};

    // Date range filter – validate that the strings are valid dates
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate && typeof startDate === 'string') {
        const d = new Date(startDate);
        if (isNaN(d.getTime())) { res.status(400).json({ success: false, error: 'Invalid startDate' }); return; }
        filter.timestamp.$gte = d;
      }
      if (endDate && typeof endDate === 'string') {
        const d = new Date(endDate);
        if (isNaN(d.getTime())) { res.status(400).json({ success: false, error: 'Invalid endDate' }); return; }
        filter.timestamp.$lte = d;
      }
    }

    // User filter (by userName which contains email) – escape regex
    if (userEmail && typeof userEmail === 'string') {
      filter.userName = { $regex: escapeRegex(userEmail.slice(0, 100)), $options: 'i' };
    }

    // Action filter
    if (action) {
      filter.action = action;
    }

    // Entity ID filter
    if (entityId) {
      filter.entityId = entityId;
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
    });
  }
}

/**
 * Get audit logs for a specific trainer
 */
export async function getAuditLogsByTrainer(req: Request, res: Response): Promise<void> {
  try {
    const { trainerId } = req.params;

    const logs = await AuditLog.find({
      $or: [
        { entityId: trainerId },
        { 'metadata.trainerId': trainerId },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching trainer audit logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch trainer audit logs',
    });
  }
}
