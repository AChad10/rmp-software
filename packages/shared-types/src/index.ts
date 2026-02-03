// Trainer Interface
export interface ITrainer {
  _id?: string;
  userId: string; // Slack user ID
  name: string;
  memberId: string;
  email: string;
  phone: string;
  joinDate: Date;
  status: 'active' | 'inactive' | 'on_leave';

  // Salary Configuration
  baseSalary: number;
  quarterlyBonusAmount: number;

  // Scorecard Configuration
  scorecardTemplate: IScorecardMetric[];

  // Personalized URLs (from existing system)
  balScoreCardUrl: string;
  trainerLogsUrl: string;
  paymentAdviceUrl: string;
  leaveRecordsUrl: string;

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
  memberId: string;
  email: string;
  phone: string;
  joinDate: Date;
  baseSalary: number;
  quarterlyBonusAmount: number;
  scorecardTemplate: IScorecardMetric[];
  balScoreCardUrl: string;
  trainerLogsUrl: string;
  paymentAdviceUrl: string;
  leaveRecordsUrl: string;
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
