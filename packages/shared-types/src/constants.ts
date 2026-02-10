import type { IScorecardMetric } from './index';

/**
 * Default scorecard metrics for trainers.
 * Auto-populated when a staff member is created with team='trainer'.
 */
export const DEFAULT_TRAINER_SCORECARD: IScorecardMetric[] = [
  {
    metricName: 'Session Fill Rates',
    description: 'Fill rates for Group sessions, benchmark >75% good',
    weight: 15,
    minScore: 0,
    maxScore: 10,
  },
  {
    metricName: 'Buddy Trainer Activity',
    description: 'M1 retention >75%, M2 >50%, form fill >80%',
    weight: 20,
    minScore: 0,
    maxScore: 10,
  },
  {
    metricName: 'DS Conversions',
    description: 'Discovery session conversion, target 75%+',
    weight: 15,
    minScore: 0,
    maxScore: 10,
  },
  {
    metricName: 'Team Focus',
    description: 'Substitutions, upselling, cross-selling',
    weight: 10,
    minScore: 0,
    maxScore: 10,
  },
  {
    metricName: 'Special Projects',
    description: 'Customer onboarding, retention efforts',
    weight: 40,
    minScore: 0,
    maxScore: 10,
  },
];
