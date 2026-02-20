import mongoose, { Schema, Document } from 'mongoose';
import { ISalaryStatement } from '@rmp/shared-types';

export interface ISalaryStatementDocument extends Omit<ISalaryStatement, '_id'>, Document {}

const SalaryStatementSchema = new Schema<ISalaryStatementDocument>({
  trainerId: {
    type: String,
    required: true,
    index: true
  },
  trainerName: { type: String, required: true },
  month: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}$/, 'Month must be in format YYYY-MM']
  },
  year: { type: Number, required: true },
  monthNumber: { type: Number, required: true, min: 1, max: 12 },

  // Salary Breakdown
  baseSalary: { type: Number, required: true, min: 0 },
  quarterlyBonusAmount: { type: Number, required: true, min: 0 },
  bscScore: { type: Number, required: true, min: 0, max: 1 },
  calculatedBonus: { type: Number, required: true, min: 0 },
  totalSalary: { type: Number, required: true, min: 0 },

  // Compensation type
  compensationType: {
    type: String,
    enum: ['standard', 'senior', 'per_class'],
    default: 'standard',
  },

  // Senior custom breakdown
  customBreakdown: {
    type: Schema.Types.Mixed,  // { fixed: [], variable: [], effectiveCompensation, tds, travelReimbursement }
    default: undefined,
  },

  // Per-class session breakdown
  sessionBreakdown: {
    type: Schema.Types.Mixed,  // { classEntries: [], totalSessions, grossBilling, tds, netPayout }
    default: undefined,
  },

  // References
  bscEntryId: { type: String },

  // PDF & Email
  pdfPath: { type: String, required: true },
  pdfUrl: { type: String, required: true },
  gmailDraftId: { type: String },
  gmailDraftUrl: { type: String },

  // Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid'],
    default: 'draft',
    index: true
  },
  sentAt: { type: Date },
  paidAt: { type: Date },

  // Audit
  createdBy: { type: String },
}, {
  timestamps: true,
  collection: 'salary_statements'
});

// Compound index to ensure one salary statement per trainer per month
SalaryStatementSchema.index({ trainerId: 1, month: 1 }, { unique: true });
SalaryStatementSchema.index({ month: 1, status: 1 });
SalaryStatementSchema.index({ year: 1, monthNumber: 1 });

SalaryStatementSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc: any, ret: any) {
    ret._id = ret._id.toString();
    return ret;
  }
});

export const SalaryStatement = mongoose.model<ISalaryStatementDocument>('SalaryStatement', SalaryStatementSchema);
