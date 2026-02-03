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

  // Get quarter for this month
  const { quarter } = getQuarter(month);

  // Find BSC entry for this quarter
  const bscEntry = await BSCEntry.findOne({
    trainerId: trainer._id.toString(),
    quarter,
    status: 'validated'
  });

  let calculatedBonus = 0;
  let bscScore = 0;
  let bscEntryId: string | undefined;

  if (bscEntry && !bscEntry.bonusPaid) {
    // BSC exists and bonus hasn't been paid yet
    bscScore = bscEntry.finalScore || 0;
    calculatedBonus = trainer.quarterlyBonusAmount * bscScore;
    bscEntryId = bscEntry._id.toString();

    // Mark bonus as paid in this month
    bscEntry.bonusPaidInMonth = month;
    bscEntry.bonusPaid = true;
    await bscEntry.save();

    console.log(`💰 Bonus applied for ${trainer.name}: ₹${calculatedBonus.toFixed(2)} (BSC: ${(bscScore * 10).toFixed(1)}/10)`);
  } else if (bscEntry && bscEntry.bonusPaid) {
    console.log(`⏭️  BSC bonus already paid for ${trainer.name} in ${bscEntry.bonusPaidInMonth}`);
  } else {
    console.log(`⚠️  No validated BSC found for ${trainer.name} for ${quarter}`);
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
    // Generate for specific trainers
    trainers = await Trainer.find({
      _id: { $in: trainerIds },
      status: 'active'
    });
  } else {
    // Generate for all active trainers
    trainers = await Trainer.find({ status: 'active' });
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
