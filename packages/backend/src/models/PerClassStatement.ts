import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';
import { IPerClassStatement } from '@rmp/shared-types';

export interface IPerClassStatementDocument extends Omit<IPerClassStatement, '_id'>, Document {}

function generateConfirmationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const SessionEntrySchema = new Schema({
  classType: { type: String, required: true },
  sessions: { type: Number, required: true, min: 0 },
  noShowSessions: { type: Number, default: 0, min: 0 },
  billingRate: { type: Number, required: true, min: 0 },
  totalBilling: { type: Number, required: true, min: 0 },
  subTypeBreakdown: { type: Schema.Types.Mixed, default: undefined },
}, { _id: false });

const PerClassStatementSchema = new Schema<IPerClassStatementDocument>({
  trainerId: { type: String, required: true, index: true },
  trainerName: { type: String, required: true },
  month: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}$/, 'Month must be in format YYYY-MM'],
  },

  // Session data
  sessionBreakdown: { type: [SessionEntrySchema], required: true },
  totalSessions: { type: Number, required: true, min: 0 },
  grossBilling: { type: Number, required: true, min: 0 },
  tds: { type: Number, required: true, min: 0 },
  netPayout: { type: Number, required: true, min: 0 },

  // Confirmation workflow
  confirmationToken: {
    type: String,
    unique: true,
    sparse: true,
    default: generateConfirmationToken,
  },
  status: {
    type: String,
    enum: ['pending_logs', 'logs_sent', 'confirmed', 'payout_sent', 'paid'],
    default: 'pending_logs',
    index: true,
  },
  logsDraftId: { type: String },
  logsDraftUrl: { type: String },
  confirmedAt: { type: Date },
  payoutDraftId: { type: String },
  payoutDraftUrl: { type: String },

  createdBy: { type: String },
}, {
  timestamps: true,
  collection: 'per_class_statements',
});

PerClassStatementSchema.index({ trainerId: 1, month: 1 }, { unique: true });
PerClassStatementSchema.index({ month: 1, status: 1 });
PerClassStatementSchema.index({ confirmationToken: 1 });

PerClassStatementSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc: any, ret: any) {
    ret._id = ret._id.toString();
    // Never leak confirmation tokens in list responses
    delete ret.confirmationToken;
    delete ret.__v;
    return ret;
  },
});

export const PerClassStatement = mongoose.model<IPerClassStatementDocument>(
  'PerClassStatement',
  PerClassStatementSchema
);
