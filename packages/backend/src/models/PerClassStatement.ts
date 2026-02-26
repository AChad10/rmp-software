import mongoose, { Document } from 'mongoose';
import crypto from 'crypto';
import { IPerClassStatement } from '@rmp/shared-types';

export interface IPerClassStatementDocument extends Omit<IPerClassStatement, '_id'>, Document {}

function generateConfirmationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const PerClassStatementSchema = new mongoose.Schema({
  trainerId: { type: String, required: true },
  trainerName: { type: String, required: true },
  month: { type: String, required: true },
  confirmationToken: { type: String, required: true, unique: true, default: generateConfirmationToken },
  status: {
    type: String,
    enum: ['logs_sent', 'confirmed', 'payout_sent', 'paid'],
    default: 'logs_sent',
  },
  logsDraftId: String,
  logsDraftUrl: String,
  confirmedAt: Date,
  payoutDraftId: String,
  payoutDraftUrl: String,
  createdBy: String,
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
