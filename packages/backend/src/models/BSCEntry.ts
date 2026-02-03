import mongoose, { Schema, Document } from 'mongoose';
import { IBSCEntry, IBSCScore } from '@rmp/shared-types';

export interface IBSCEntryDocument extends Omit<IBSCEntry, '_id'>, Document {}

const BSCScoreSchema = new Schema<IBSCScore>({
  metricName: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 10 },
  notes: { type: String },
}, { _id: false });

const BSCEntrySchema = new Schema<IBSCEntryDocument>({
  trainerId: {
    type: String,
    required: true,
    index: true
  },
  quarter: {
    type: String,
    required: true,
    match: [/^\d{4}-Q[1-4]$/, 'Quarter must be in format YYYY-Q# (e.g., 2026-Q1)']
  },
  year: { type: Number, required: true },
  quarterNumber: { type: Number, required: true, enum: [1, 2, 3, 4] },

  // Self-Assessment
  selfScores: { type: [BSCScoreSchema], required: true },
  selfCalculatedScore: { type: Number, required: true, min: 0, max: 1 },
  submittedAt: { type: Date, required: true, default: Date.now },

  // Validation
  status: {
    type: String,
    enum: ['pending_validation', 'validated', 'rejected'],
    default: 'pending_validation',
    index: true
  },
  validatedScores: { type: [BSCScoreSchema] },
  finalScore: { type: Number, min: 0, max: 1 },
  validatedBy: { type: String },
  validatedAt: { type: Date },
  validationNotes: { type: String },

  // Payment Tracking
  bonusPaidInMonth: { type: String }, // Format: "2026-02"
  bonusPaid: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'bsc_entries'
});

// Compound index to ensure one BSC entry per trainer per quarter
BSCEntrySchema.index({ trainerId: 1, quarter: 1 }, { unique: true });
BSCEntrySchema.index({ status: 1, trainerId: 1 });

BSCEntrySchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc: any, ret: any) {
    ret._id = ret._id.toString();
    return ret;
  }
});

export const BSCEntry = mongoose.model<IBSCEntryDocument>('BSCEntry', BSCEntrySchema);
