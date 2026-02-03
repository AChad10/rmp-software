import mongoose, { Schema, Document } from 'mongoose';
import { ITrainer, IScorecardMetric } from '@rmp/shared-types';

// Extend ITrainer with Document for Mongoose
export interface ITrainerDocument extends Omit<ITrainer, '_id'>, Document {}

const ScorecardMetricSchema = new Schema<IScorecardMetric>({
  metricName: { type: String, required: true },
  description: { type: String, required: true },
  weight: { type: Number, required: true, min: 0, max: 100 },
  minScore: { type: Number, required: true, default: 0 },
  maxScore: { type: Number, required: true, default: 10 },
}, { _id: false });

const TrainerSchema = new Schema<ITrainerDocument>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  name: { type: String, required: true, trim: true },
  memberId: { type: String, required: true, unique: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: { type: String, required: true, trim: true },
  joinDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active'
  },

  // Salary Configuration
  baseSalary: { type: Number, required: true, min: 0 },
  quarterlyBonusAmount: { type: Number, required: true, min: 0 },

  // Scorecard Configuration
  scorecardTemplate: { type: [ScorecardMetricSchema], default: [] },

  // Personalized URLs
  balScoreCardUrl: { type: String, required: true },
  trainerLogsUrl: { type: String, required: true },
  paymentAdviceUrl: { type: String, required: true },
  leaveRecordsUrl: { type: String, required: true },

  // Audit fields
  createdBy: { type: String },
  updatedBy: { type: String },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'trainers'
});

// Indexes for performance
TrainerSchema.index({ status: 1 });
TrainerSchema.index({ name: 1 });

// Virtual for ID as string
TrainerSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Ensure virtuals are included in JSON
TrainerSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc: any, ret: any) {
    ret._id = ret._id.toString();
    return ret;
  }
});

export const Trainer = mongoose.model<ITrainerDocument>('Trainer', TrainerSchema);
