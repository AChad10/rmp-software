// Team Type
export type TeamType = 'trainer' | 'ops_team' | 'sales_team' | 'other';

// Experience Level Types
export type TrainerExperienceLevel = 'junior' | 'senior' | 'master';
export type StaffExperienceLevel = 'junior' | 'senior' | 'manager';
export type ExperienceLevel = TrainerExperienceLevel | StaffExperienceLevel;

// Trainer Interface
export interface ITrainer {
  _id?: string;
  userId: string; // Slack user ID
  name: string;
  employeeCode: string; // Employee code (formerly memberId)
  designation: string; // e.g., "Instructor"
  panNumber: string; // PAN card number
  email: string;
  phone: string;
  joinDate: Date;
  status: 'active' | 'inactive' | 'on_leave';
  team: TeamType;
  customTeam?: string; // Only used when team is 'other'
  experienceLevel?: ExperienceLevel; // Junior/Senior/Master for trainers, Junior/Senior/Manager for ops/sales

  // Salary Configuration
  annualCTC: number; // Annual CTC (e.g., 516000)
  baseSalary: number; // Monthly base salary (e.g., 40000)
  quarterlyBonusAmount: number; // Annual bonus pool (e.g., 36000)

  // Compensation Type
  compensationType: CompensationType; // 'standard' | 'senior' | 'per_class'

  // Senior/Custom salary components (only used when compensationType is 'senior')
  salaryComponents?: ISalaryComponentsConfig;

  // Per-class configuration (only used when compensationType is 'per_class')
  classConfig?: IClassConfig;

  // Scorecard Configuration
  useDefaultScorecard: boolean; // If true, use DEFAULT_TRAINER_SCORECARD instead of custom template
  scorecardTemplate: IScorecardMetric[]; // Custom template (only used when useDefaultScorecard is false)

  // BSC Access Token (secure URL for trainer to access their BSC form)
  bscAccessToken?: string;

  // Personalized URLs (legacy – optional)
  balScoreCardUrl?: string;
  trainerLogsUrl?: string;
  paymentAdviceUrl?: string;
  leaveRecordsUrl?: string;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Scorecard Metric
export interface IScorecardMetric {
  metricName: string;
  description: string;
  weight: number; // Percentage (0-100)
  minScore: number;
  maxScore: number;
}

// Compensation Types
export type CompensationType = 'standard' | 'senior' | 'per_class';

// Custom salary component (used by senior/ops staff)
export interface ISalaryComponent {
  id: string;              // UUID for stable reference
  name: string;            // e.g., "Basic Salary", "HRA", "Special Allowances"
  annualAmount: number;
  monthlyAmount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Annual' | '';
  remarks: string;         // Default remarks template
}

// Salary component with per-period overrides (used in statements)
export interface ISalaryComponentEntry extends ISalaryComponent {
  currentAmount: number;       // Amount for this specific period
  currentRemarks: string;      // Remarks for this specific period
}

// Class type configuration (used by per-class trainers)
export interface IClassType {
  name: string;                // e.g., "XPRESS", "MAT", "REFORMER"
  category: 'group' | 'pvt' | 'semi_pvt' | 'discovery';
  billingRate: number;         // Fixed rate per session
  subTypes?: IClassSubType[];  // For PRIVATE which has MVP/QVP/PBC
}

export interface IClassSubType {
  name: string;        // e.g., "MVP", "QVP", "PBC"
  billingRate: number;
}

// Per-class trainer configuration
export interface IClassConfig {
  tdsRate: number;            // Default 0.10 (10%)
  sheetId: string;            // Google Sheet ID for master log
  sheetTab: string;           // Tab name for this trainer
  classTypes: IClassType[];
}

// Senior salary components configuration
export interface ISalaryComponentsConfig {
  fixed: ISalaryComponent[];
  variable: ISalaryComponent[];
}

// Session entry in a per-class statement
export interface ISessionEntry {
  classType: string;
  sessions: number;
  noShowSessions: number;
  billingRate: number;
  totalBilling: number;
  subTypeBreakdown?: { name: string; sessions: number; billingRate: number; totalBilling: number }[];
}

// BSC Entry
export interface IBSCEntry {
  _id?: string;
  trainerId: string;
  quarter: string; // Format: "2026-Q1"
  year: number;
  quarterNumber: 1 | 2 | 3 | 4;

  // Self-Assessment
  selfScores: IBSCScore[];
  selfCalculatedScore: number;
  submittedAt: Date;

  // Validation
  status: 'pending_validation' | 'validated' | 'rejected';
  validatedScores?: IBSCScore[];
  finalScore?: number;
  validatedBy?: string;
  validatedAt?: Date;
  validationNotes?: string;

  // Payment Tracking
  bonusPaidInMonth?: string; // Format: "2026-02" - which month the bonus was paid
  bonusPaid: boolean;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

// BSC Score
export interface IBSCScore {
  metricName: string;
  score: number;
  notes?: string;
}

// Salary Statement
export interface ISalaryStatement {
  _id?: string;
  trainerId: string;
  trainerName: string;
  month: string; // Format: "2026-03"
  year: number;
  monthNumber: number;

  // Salary Breakdown
  baseSalary: number;
  quarterlyBonusAmount: number; // The configured bonus pool amount
  bscScore: number; // 0-1 (e.g., 0.85 for 8.5/10)
  calculatedBonus: number; // quarterlyBonusAmount * bscScore (only if bonus paid this month)
  totalSalary: number; // baseSalary + calculatedBonus

  // Compensation type (matches trainer at time of generation)
  compensationType: CompensationType;

  // Senior type breakdown
  customBreakdown?: {
    fixed: ISalaryComponentEntry[];
    variable: ISalaryComponentEntry[];
    effectiveCompensation: number;
    tds: number;
    travelReimbursement: number;
  };

  // Per-class type breakdown
  sessionBreakdown?: {
    classEntries: ISessionEntry[];
    totalSessions: number;
    grossBilling: number;
    tds: number;
    netPayout: number;
  };

  // References
  bscEntryId?: string;

  // PDF & Email
  pdfPath: string;
  pdfUrl: string;
  gmailDraftId?: string;
  gmailDraftUrl?: string;

  // Status
  status: 'draft' | 'sent' | 'paid';
  sentAt?: Date;
  paidAt?: Date;

  // Audit
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
}

// Per-Class Statement (separate from salary statements -- tracks the 3-step email flow)
export interface IPerClassStatement {
  _id?: string;
  trainerId: string;
  trainerName: string;
  month: string;                    // "2026-01"

  // Session data
  sessionBreakdown: ISessionEntry[];
  totalSessions: number;
  grossBilling: number;
  tds: number;
  netPayout: number;

  // Confirmation workflow
  confirmationToken: string;
  status: 'pending_logs' | 'logs_sent' | 'confirmed' | 'payout_sent' | 'paid';
  logsDraftId?: string;
  logsDraftUrl?: string;
  confirmedAt?: Date;
  payoutDraftId?: string;
  payoutDraftUrl?: string;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// Audit Log
export interface IAuditLog {
  _id?: string;
  userId: string; // Who performed the action
  userName: string;
  action: string; // "create", "update", "delete", "validate", etc.
  entity: string; // "trainer", "bsc", "salary", etc.
  entityId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Request Types
export interface CreateTrainerRequest {
  userId: string;
  name: string;
  employeeCode: string;
  designation: string;
  panNumber?: string;
  email: string;
  phone: string;
  joinDate: Date;
  annualCTC: number;
  baseSalary: number;
  quarterlyBonusAmount: number;
  useDefaultScorecard: boolean;
  scorecardTemplate: IScorecardMetric[];
  team: TeamType;
  customTeam?: string;
  experienceLevel?: ExperienceLevel;
  compensationType: CompensationType;
  salaryComponents?: ISalaryComponentsConfig;
  classConfig?: IClassConfig;
  balScoreCardUrl?: string;
  trainerLogsUrl?: string;
  paymentAdviceUrl?: string;
  leaveRecordsUrl?: string;
}

export interface UpdateTrainerRequest extends Partial<CreateTrainerRequest> {
  status?: 'active' | 'inactive' | 'on_leave';
}

export interface SubmitBSCRequest {
  trainerId: string;
  quarter: string;
  selfScores: IBSCScore[];
}

export interface ValidateBSCRequest {
  validatedScores: IBSCScore[];
  validationNotes?: string;
}

export interface GenerateSalaryRequest {
  month: string; // "2026-03"
  trainerIds?: string[]; // Optional - if not provided, generate for all active trainers
  overwrite?: boolean;  // If true, regenerate even if statement exists
  pdfOverrides?: Record<string, any>; // Allow preview edits to flow through
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'trainer';
  iat?: number;
  exp?: number;
}

// Cron Job Result
export interface CronJobResult {
  success: boolean;
  jobName: string;
  executedAt: Date;
  duration: number; // milliseconds
  results?: any;
  errors?: string[];
}

// Trainer Logs Draft Result
export interface TrainerLogsDraftResult {
  trainerId: string;
  trainerName: string;
  status: 'success' | 'failed' | 'skipped';
  draftId?: string;
  draftUrl?: string;
  error?: string;
}

// Re-export constants
export { DEFAULT_TRAINER_SCORECARD } from './constants';
