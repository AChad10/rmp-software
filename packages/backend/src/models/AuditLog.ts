import mongoose, { Schema, Document } from 'mongoose';
import { IAuditLog } from '@rmp/shared-types';

export interface IAuditLogDocument extends Omit<IAuditLog, '_id'>, Document {}

const AuditLogSchema = new Schema<IAuditLogDocument>({
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  action: {
    type: String,
    required: true,
    index: true
  },
  entity: {
    type: String,
    required: true,
    index: true
  },
  entityId: { type: String, required: true, index: true },
  changes: { type: Schema.Types.Mixed },
  metadata: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
}, {
  timestamps: false, // We use our own timestamp field
  collection: 'audit_logs'
});

// Compound indexes for common queries
AuditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });

// TTL index to automatically delete old logs after 2 years (optional)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

AuditLogSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc: any, ret: any) {
    ret._id = ret._id.toString();
    return ret;
  }
});

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
