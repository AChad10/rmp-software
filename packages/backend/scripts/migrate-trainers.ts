/**
 * Migration Script: Trainers Config to MongoDB
 *
 * This script migrates trainer data from src/config/trainers.ts to MongoDB
 *
 * Usage:
 *   ts-node scripts/migrate-trainers.ts
 */

import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { Trainer } from '../src/models';
import { trainers } from '../src/config/trainers';

// Load environment variables
dotenv.config();

async function migrateTrainers() {
  try {
    console.log('🚀 Starting trainer migration...\n');

    // Connect to MongoDB
    await connectDatabase();

    const trainerEntries = Object.entries(trainers);

    if (trainerEntries.length === 0) {
      console.log('⚠️  No trainers found in config/trainers.ts');
      console.log('   Add trainers to src/config/trainers.ts first, then run this script again.');
      return;
    }

    console.log(`📊 Found ${trainerEntries.length} trainer(s) in config\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const [userId, trainerData] of trainerEntries) {
      try {
        // Check if trainer already exists
        const existing = await Trainer.findOne({ userId });

        if (existing) {
          console.log(`⏭️  Skipping ${trainerData.name} (${userId}) - already exists in DB`);
          skipped++;
          continue;
        }

        // Create new trainer
        const newTrainer = new Trainer({
          userId: trainerData.userId,
          name: trainerData.name,
          memberId: trainerData.memberId,
          email: `${trainerData.memberId.toLowerCase()}@redmatpilates.com`, // Placeholder email
          phone: '0000000000', // Placeholder phone
          joinDate: new Date(), // Placeholder join date
          status: 'active',
          baseSalary: 0, // Admin will set this via dashboard
          quarterlyBonusAmount: 0, // Admin will set this via dashboard
          scorecardTemplate: [], // Admin will configure this via dashboard
          balScoreCardUrl: trainerData.balScoreCardUrl,
          trainerLogsUrl: trainerData.trainerLogsUrl,
          paymentAdviceUrl: trainerData.paymentAdviceUrl,
          leaveRecordsUrl: trainerData.leaveRecordsUrl,
          createdBy: 'migration-script'
        });

        await newTrainer.save();
        console.log(`✅ Created ${trainerData.name} (${userId})`);
        created++;

      } catch (error: any) {
        console.error(`❌ Error processing ${trainerData.name} (${userId}):`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${trainerEntries.length - created - skipped}`);
    console.log('='.repeat(60));

    if (created > 0) {
      console.log('\n📝 Next Steps:');
      console.log('1. Update trainer details via the Admin Dashboard:');
      console.log('   - Set email addresses');
      console.log('   - Set phone numbers');
      console.log('   - Set join dates');
      console.log('   - Set base salary amounts');
      console.log('   - Set quarterly bonus amounts');
      console.log('   - Configure scorecard templates');
      console.log('\n2. Original trainers.ts is kept as fallback during transition');
      console.log('3. You can safely remove trainers.ts entries once verified in DB');
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

// Run migration
migrateTrainers();
