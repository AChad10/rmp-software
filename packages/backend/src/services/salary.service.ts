import { Trainer, BSCEntry, SalaryStatement } from '../models';
import { GenerateSalaryRequest } from '@rmp/shared-types';

interface SalaryBreakdown {
  trainerId: string;
  trainerName: string;
  month: string;
  year: number;
  monthNumber: number;
  baseSalary: number;
  quarterlyBonusAmount: number;
  bscScore: number;
  calculatedBonus: number;
  totalSalary: number;
  bscEntryId?: string;
}

/**
 * Quarter abbreviation labels
 */
const QUARTER_LABELS: Record<number, string> = {
  1: 'JFM',
  2: 'AMJ',
  3: 'JAS',
  4: 'OND',
};

export function getQuarterLabel(quarterNumber: number): string {
  return QUARTER_LABELS[quarterNumber] || '';
}

/**
 * Get quarter for a given month
 * @param month Format: "2026-03"
 * @returns Quarter string like "2026-Q1"
 */
export function getQuarter(month: string): { quarter: string; year: number; quarterNumber: 1 | 2 | 3 | 4 } {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);

  let quarterNumber: 1 | 2 | 3 | 4;
  if (monthNum >= 1 && monthNum <= 3) quarterNumber = 1;
  else if (monthNum >= 4 && monthNum <= 6) quarterNumber = 2;
  else if (monthNum >= 7 && monthNum <= 9) quarterNumber = 3;
  else quarterNumber = 4;

  return {
    quarter: `${year}-Q${quarterNumber}`,
    year,
    quarterNumber
  };
}

/**
 * Get the bonus quarter for a given salary month.
 * Bonuses are paid one quarter after the quarter ends:
 *   OND (Q4) bonus → paid in March
 *   JFM (Q1) bonus → paid in June
 *   AMJ (Q2) bonus → paid in September
 *   JAS (Q3) bonus → paid in December
 *
 * Returns null if this month is not a bonus payout month.
 */
export function getBonusQuarter(month: string): { quarter: string; quarterNumber: 1 | 2 | 3 | 4; label: string } | null {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);

  // Only March, June, September, December are bonus payout months
  switch (monthNum) {
    case 3: // March → pay OND (Q4) bonus from previous year
      return { quarter: `${year - 1}-Q4`, quarterNumber: 4, label: 'OND' };
    case 6: // June → pay JFM (Q1) bonus from current year
      return { quarter: `${year}-Q1`, quarterNumber: 1, label: 'JFM' };
    case 9: // September → pay AMJ (Q2) bonus from current year
      return { quarter: `${year}-Q2`, quarterNumber: 2, label: 'AMJ' };
    case 12: // December → pay JAS (Q3) bonus from current year
      return { quarter: `${year}-Q3`, quarterNumber: 3, label: 'JAS' };
    default:
      return null;
  }
}

/**
 * Calculate salary for a single trainer for a given month
 */
export async function calculateSalary(trainerId: string, month: string): Promise<SalaryBreakdown> {
  // Get trainer
  const trainer = await Trainer.findById(trainerId);
  if (!trainer) {
    throw new Error(`Trainer not found: ${trainerId}`);
  }

  if (trainer.status !== 'active') {
    throw new Error(`Trainer is not active: ${trainer.name}`);
  }

  // Parse month
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const monthNumber = parseInt(monthStr);

  // Check if this month is a bonus payout month
  const bonusQuarter = getBonusQuarter(month);

  let calculatedBonus = 0;
  let bscScore = 0;
  let bscEntryId: string | undefined;

  if (bonusQuarter) {
    // This is a bonus payout month - look up the BSC for the relevant quarter
    const bscEntry = await BSCEntry.findOne({
      trainerId: trainer._id.toString(),
      quarter: bonusQuarter.quarter,
      status: 'validated'
    });

    if (bscEntry && !bscEntry.bonusPaid) {
      // BSC exists and bonus hasn't been paid yet
      bscScore = bscEntry.finalScore || 0;
      calculatedBonus = trainer.quarterlyBonusAmount * bscScore;
      bscEntryId = bscEntry._id.toString();

      // Mark bonus as paid in this month
      bscEntry.bonusPaidInMonth = month;
      bscEntry.bonusPaid = true;
      await bscEntry.save();

      console.log(`Bonus applied for ${trainer.name}: ${calculatedBonus.toFixed(2)} (BSC: ${(bscScore * 10).toFixed(1)}/10, quarter: ${bonusQuarter.label})`);
    } else if (bscEntry && bscEntry.bonusPaid) {
      console.log(`BSC bonus already paid for ${trainer.name} in ${bscEntry.bonusPaidInMonth}`);
    } else {
      console.log(`No validated BSC found for ${trainer.name} for ${bonusQuarter.label} (${bonusQuarter.quarter})`);
    }
  }

  const totalSalary = trainer.baseSalary + calculatedBonus;

  return {
    trainerId: trainer._id.toString(),
    trainerName: trainer.name,
    month,
    year,
    monthNumber,
    baseSalary: trainer.baseSalary,
    quarterlyBonusAmount: trainer.quarterlyBonusAmount,
    bscScore,
    calculatedBonus,
    totalSalary,
    bscEntryId
  };
}

/**
 * Generate salary for all active trainers or specific trainers
 */
export async function generateAllSalaries(request: GenerateSalaryRequest): Promise<{
  success: boolean;
  month: string;
  generated: SalaryBreakdown[];
  errors: Array<{ trainerId: string; error: string }>;
}> {
  const { month, trainerIds } = request;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧮 Calculating Salaries for ${month}`);
  console.log(`${'='.repeat(60)}\n`);

  let trainers;

  if (trainerIds && trainerIds.length > 0) {
    // Generate for specific trainers (but skip per-class trainers)
    trainers = await Trainer.find({
      _id: { $in: trainerIds },
      status: 'active',
      compensationType: { $ne: 'per_class' },
    });
    // Warn about excluded per-class trainers
    const allRequested = await Trainer.find({ _id: { $in: trainerIds }, status: 'active' });
    const excluded = allRequested.filter((t: any) => t.compensationType === 'per_class');
    if (excluded.length > 0) {
      console.log(`[INFO] Skipping ${excluded.length} per-class trainer(s): ${excluded.map((t: any) => t.name).join(', ')} (use per-class workflow instead)`);
    }
  } else {
    // Generate for all active trainers (excluding per-class)
    trainers = await Trainer.find({
      status: 'active',
      compensationType: { $ne: 'per_class' },
    });
  }

  const generated: SalaryBreakdown[] = [];
  const errors: Array<{ trainerId: string; error: string }> = [];

  for (const trainer of trainers) {
    try {
      const breakdown = await calculateSalary(trainer._id.toString(), month);
      generated.push(breakdown);
    } catch (error: any) {
      console.error(`❌ Error calculating salary for ${trainer.name}:`, error.message);
      errors.push({
        trainerId: trainer._id.toString(),
        error: error.message
      });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary:`);
  console.log(`  ✅ Generated: ${generated.length}`);
  console.log(`  ❌ Errors: ${errors.length}`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    success: errors.length === 0,
    month,
    generated,
    errors
  };
}

/**
 * Check if salary statement already exists for trainer/month
 */
export async function salaryStatementExists(trainerId: string, month: string): Promise<boolean> {
  const existing = await SalaryStatement.findOne({ trainerId, month });
  return existing !== null;
}
