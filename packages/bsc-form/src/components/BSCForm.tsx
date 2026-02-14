import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bscService } from '../api/bscService';
import { getCurrentQuarter, formatQuarterDisplay, getQuarterMonths, getQuarterNumber } from '../utils/quarterUtils';
import type { ITrainer, IBSCScore, IScorecardMetric } from '@rmp/shared-types';
import { DEFAULT_TRAINER_SCORECARD } from '@rmp/shared-types';
import './BSCForm.css';

export default function BSCForm() {
  const { token, quarter } = useParams<{ token: string; quarter?: string }>();
  const navigate = useNavigate();

  const [trainer, setTrainer] = useState<ITrainer | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Form state - track percentage (0-100) and notes per metric
  const [formData, setFormData] = useState<Record<string, { percentage: number; notes: string }>>({});
  const currentQuarter = quarter || getCurrentQuarter();

  useEffect(() => {
    loadTrainerData();
  }, [token]);

  // Get the effective scorecard (default or custom based on flag)
  const getEffectiveScorecard = (trainerData: ITrainer): IScorecardMetric[] => {
    if (trainerData.useDefaultScorecard) {
      return DEFAULT_TRAINER_SCORECARD;
    }
    return trainerData.scorecardTemplate.length > 0
      ? trainerData.scorecardTemplate
      : DEFAULT_TRAINER_SCORECARD; // Fallback if no custom template
  };

  const loadTrainerData = async () => {
    if (!token) {
      setError('Access token is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch trainer details using secure token
      const trainerData = await bscService.getTrainerByToken(token);
      setTrainer(trainerData);
      setTrainerId(trainerData._id || null);

      // Get the effective scorecard based on useDefaultScorecard flag
      const effectiveScorecard = getEffectiveScorecard(trainerData);

      // Initialize form data with 50% (middle value) and empty notes
      const initialFormData: Record<string, { percentage: number; notes: string }> = {};
      effectiveScorecard.forEach((metric) => {
        initialFormData[metric.metricName] = { percentage: 50, notes: '' };
      });
      setFormData(initialFormData);

      // Check if already submitted (using trainer ID from token response)
      if (trainerData._id && token) {
        const existing = await bscService.checkExistingSubmission(trainerData._id, currentQuarter, token);
        if (existing && existing.status !== 'rejected') {
          setAlreadySubmitted(true);
        }
      }
    } catch (err: any) {
      console.error('Error loading trainer:', err);
      setError(err.message || 'Invalid or expired access link. Please contact your manager.');
    } finally {
      setLoading(false);
    }
  };

  const calculateWeightedScore = (): number => {
    if (!trainer) return 0;

    const effectiveScorecard = getEffectiveScorecard(trainer);
    let totalWeightedScore = 0;
    effectiveScorecard.forEach((metric) => {
      const percentage = formData[metric.metricName]?.percentage || 0;
      const normalizedScore = percentage / 100; // Convert percentage to 0-1
      totalWeightedScore += normalizedScore * metric.weight;
    });

    // Return score out of 10
    return (totalWeightedScore / 100) * 10;
  };

  const handlePercentageChange = (metricName: string, value: number) => {
    // Clamp value between 0 and 100
    const clampedValue = Math.max(0, Math.min(100, value));
    setFormData((prev) => ({
      ...prev,
      [metricName]: {
        ...prev[metricName],
        percentage: clampedValue,
      },
    }));
  };

  const handleNotesChange = (metricName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [metricName]: {
        ...prev[metricName],
        notes: value,
      },
    }));

    // Clear validation error when user starts typing
    if (value.trim() && validationErrors[metricName]) {
      setValidationErrors((prev) => {
        const { [metricName]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validateForm = (): boolean => {
    if (!trainer) return false;

    const effectiveScorecard = getEffectiveScorecard(trainer);
    const errors: Record<string, string> = {};

    effectiveScorecard.forEach((metric) => {
      const notes = formData[metric.metricName]?.notes || '';
      if (!notes.trim()) {
        errors[metric.metricName] = 'Supporting data is required for this metric';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);

    if (!trainer || !trainerId) return;

    // Validate form
    if (!validateForm()) {
      setError('Please fill in all required fields before submitting');
      // Scroll to first error
      setTimeout(() => {
        const firstError = document.querySelector('.metric-card.has-error');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Get the effective scorecard and prepare BSC scores
      const effectiveScorecard = getEffectiveScorecard(trainer);
      const selfScores: IBSCScore[] = effectiveScorecard.map((metric) => {
        const notes = formData[metric.metricName]?.notes?.trim();
        return {
          metricName: metric.metricName,
          score: (formData[metric.metricName]?.percentage || 50) / 10, // Convert percentage to 0-10 scale
          ...(notes && { notes }), // Only include notes if it has content
        };
      });

      // Submit BSC (include access token to prove identity)
      await bscService.submitBSC({
        trainerId,
        quarter: currentQuarter,
        selfScores,
      }, token!);

      // Navigate to success page
      navigate(`/success?quarter=${currentQuarter}`);
    } catch (err: any) {
      console.error('Error submitting BSC:', err);
      setError(err.message || 'Failed to submit assessment. Please check your input and try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your assessment form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-box">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="container">
        <div className="error-box">
          <h2>Trainer Not Found</h2>
          <p>Unable to find trainer data. Please check the URL.</p>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="container">
        <div className="info-box">
          <h2>Already Submitted</h2>
          <p>You have already submitted your self-assessment for {formatQuarterDisplay(currentQuarter)}.</p>
          <p>Your manager will review it shortly. You'll be notified once it's validated.</p>
        </div>
      </div>
    );
  }

  const weightedScore = calculateWeightedScore();
  const quarterNum = getQuarterNumber(currentQuarter);

  return (
    <div className="container">
      <div className="form-card">
        <header className="form-header">
          <img src="/logo.png" alt="RedMat Pilates" className="logo" onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }} />
          <h1>Quarterly Self-Assessment</h1>
          <div className="trainer-info">
            <p className="trainer-name">{trainer.name}</p>
            <p className="quarter-info">
              {formatQuarterDisplay(currentQuarter)} ({getQuarterMonths(quarterNum)})
            </p>
          </div>
        </header>

        {/* Power BI Dashboard Section */}
        <section className="powerbi-section">
          <h2>Your Performance Metrics</h2>
          <p className="section-description">
            Review your performance data below before completing your self-assessment.
          </p>
          <div className="powerbi-container">
            <iframe
              src="https://app.powerbi.com/reportEmbed?reportId=a2c33127-d64c-4040-a492-f7b0943ac02d&autoAuth=true&ctid=ce5b6e47-737b-4010-a385-7ac87f2fbeab"
              width="100%"
              height="400"
              frameBorder="0"
              allowFullScreen
              title="Performance Dashboard"
            ></iframe>
          </div>
        </section>

        {/* Assessment Form */}
        <form onSubmit={handleSubmit}>
          <section className="metrics-section">
            <h2>Rate Your Performance</h2>
            <p className="section-description">
              For each metric below, rate yourself on a scale from 0 to 100.
            </p>

            {getEffectiveScorecard(trainer).map((metric) => {
              const metricData = formData[metric.metricName] || { percentage: 50, notes: '' };
              const calculatedScore = metricData.percentage / 10;
              const hasError = !!validationErrors[metric.metricName];

              return (
                <div key={metric.metricName} className={`metric-card ${hasError ? 'has-error' : ''}`}>
                  <div className="metric-header">
                    <h3>{metric.metricName}</h3>
                    <span className="weight-badge">{metric.weight}%</span>
                  </div>
                  <p className="metric-description">{metric.description}</p>

                  <div className="scoring-container">
                    <div className="scoring-row">
                      <div className="percentage-input-wrapper">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={metricData.percentage}
                          onChange={(e) => handlePercentageChange(metric.metricName, parseFloat(e.target.value) || 0)}
                          className="percentage-input"
                        />
                        <span className="percentage-symbol">%</span>
                      </div>
                      <div className="score-display">
                        <span className="score-display-value">{calculatedScore.toFixed(1)}</span>
                        <span className="score-display-max">/ 10</span>
                      </div>
                    </div>

                    <label className="notes-label">
                      Supporting data for this score
                      <span className="required">*</span>
                    </label>
                    <textarea
                      className={`notes-textarea ${hasError ? 'error' : ''}`}
                      placeholder="Enter supporting data, context, or achievements relevant to this metric..."
                      value={metricData.notes}
                      onChange={(e) => handleNotesChange(metric.metricName, e.target.value)}
                      required
                    />
                    {hasError && (
                      <div className="field-error">
                        ⚠ {validationErrors[metric.metricName]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Weighted Score Display */}
          <section className="score-summary">
            <div className="score-box">
              <p className="score-label">Your Weighted Score</p>
              <p className="score-value">{weightedScore.toFixed(1)} / 10</p>
              <p className="score-note">
                This score will be reviewed by management and used to calculate your quarterly bonus.
              </p>
            </div>
          </section>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="form-actions">
            {attemptedSubmit && Object.keys(validationErrors).length > 0 && (
              <div className="validation-summary">
                <span>⚠</span>
                <div>
                  <strong>Please complete all required fields</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
                    All metrics require supporting data to be submitted.
                  </p>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="submit-button"
            >
              {submitting ? 'Submitting Assessment...' : 'Submit Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
