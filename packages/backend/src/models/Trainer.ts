import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';
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

const SalaryComponentSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  annualAmount: { type: Number, required: true, min: 0 },
  monthlyAmount: { type: Number, required: true, min: 0 },
  frequency: { type: String, enum: ['Monthly', 'Quarterly', 'Annual', ''], default: '' },
  remarks: { type: String, default: '' },
}, { _id: false });

const ClassSubTypeSchema = new Schema({
  name: { type: String, required: true },
  billingRate: { type: Number, required: true, min: 0 },
}, { _id: false });

const ClassTypeSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['group', 'pvt', 'semi_pvt', 'discovery'], required: true },
  billingRate: { type: Number, required: true, min: 0 },
  subTypes: { type: [ClassSubTypeSchema], default: [] },
}, { _id: false });

// Generate a secure random token for BSC access
function generateBscToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const TrainerSchema = new Schema<ITrainerDocument>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  name: { type: String, required: true, trim: true },
  employeeCode: { type: String, required: true, unique: true, trim: true },
  designation: { type: String, required: true, trim: true, default: 'Instructor' },
  panNumber: { type: String, required: true, trim: true, uppercase: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: { type: String, trim: true },
  joinDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active'
  },
  team: {
    type: String,
    enum: ['trainer', 'ops_team', 'sales_team', 'other'],
    required: true,
    default: 'trainer'
  },
  customTeam: {
    type: String,
    trim: true
  },
  experienceLevel: {
    type: String,
    enum: ['junior', 'senior', 'master', 'manager'],
  },

  // Salary Configuration
  annualCTC: { type: Number, required: true, min: 0 },
  baseSalary: { type: Number, required: true, min: 0 },
  quarterlyBonusAmount: { type: Number, default: 0, min: 0 },

  // Compensation Type
  compensationType: {
    type: String,
    enum: ['standard', 'senior', 'per_class'],
    default: 'standard',
    required: true,
  },

  // Senior salary components
  salaryComponents: {
    type: {
      fixed: { type: [SalaryComponentSchema], default: [] },
      variable: { type: [SalaryComponentSchema], default: [] },
    },
    default: undefined,
  },

  // Per-class configuration
  classConfig: {
    type: {
      tdsRate: { type: Number, default: 0.10, min: 0, max: 1 },
      sheetId: { type: String },
      sheetTab: { type: String },
      classTypes: { type: [ClassTypeSchema], default: [] },
    },
    default: undefined,
  },

  // Scorecard Configuration
  useDefaultScorecard: { type: Boolean, default: true },
  scorecardTemplate: { type: [ScorecardMetricSchema], default: [] },

  // BSC Access Token (secure URL for trainer to access their BSC form)
  bscAccessToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    default: generateBscToken
  },

  // Personalized URLs (legacy – optional)
  balScoreCardUrl: { type: String },
  trainerLogsUrl: { type: String },
  paymentAdviceUrl: { type: String },
  leaveRecordsUrl: { type: String },

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
TrainerSchema.index({ compensationType: 1, status: 1 });

// Virtual for ID as string
TrainerSchema.virtual('id').get(function(this: ITrainerDocument) {
  return this._id.toString();
});

// Ensure virtuals are included in JSON – strip secrets by default
TrainerSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc: any, ret: any) {
    ret._id = ret._id.toString();
    // Never leak access tokens in API responses
    delete ret.bscAccessToken;
    delete ret.__v;
    return ret;
  }
});

export const Trainer = mongoose.model<ITrainerDocument>('Trainer', TrainerSchema);
