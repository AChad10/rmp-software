import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bscService } from '../api/bscService';
import { getCurrentQuarter, formatQuarterDisplay, getQuarterMonths, getQuarterNumber } from '../utils/quarterUtils';
import type { ITrainer, IBSCScore } from '@rmp/shared-types';
import './BSCForm.css';

export default function BSCForm() {
  const { trainerId, quarter } = useParams<{ trainerId: string; quarter?: string }>();
  const navigate = useNavigate();

  const [trainer, setTrainer] = useState<ITrainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Form state
  const [scores, setScores] = useState<Record<string, number>>({});
  const currentQuarter = quarter || getCurrentQuarter();

  useEffect(() => {
    loadTrainerData();
  }, [trainerId]);

  const loadTrainerData = async () => {
    if (!trainerId) {
      setError('Trainer ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch trainer details
      const trainerData = await bscService.getTrainer(trainerId);
      setTrainer(trainerData);

      // Initialize scores to middle value (5)
      const initialScores: Record<string, number> = {};
      trainerData.scorecardTemplate.forEach((metric) => {
        initialScores[metric.metricName] = 5;
      });
      setScores(initialScores);

      // Check if already submitted
      const existing = await bscService.checkExistingSubmission(trainerId, currentQuarter);
      if (existing && existing.status !== 'rejected') {
        setAlreadySubmitted(true);
      }
    } catch (err: any) {
      console.error('Error loading trainer:', err);
      setError(err.message || 'Failed to load trainer data');
    } finally {
      setLoading(false);
    }
  };

  const calculateWeightedScore = (): number => {
    if (!trainer) return 0;

    let totalWeightedScore = 0;
    trainer.scorecardTemplate.forEach((metric) => {
      const score = scores[metric.metricName] || 0;
      const normalizedScore = score / metric.maxScore; // Convert to 0-1
      totalWeightedScore += normalizedScore * metric.weight;
    });

    // Return score out of 10
    return (totalWeightedScore / 100) * 10;
  };

  const handleScoreChange = (metricName: string, value: number) => {
    setScores((prev) => ({
      ...prev,
      [metricName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trainer || !trainerId) return;

    try {
      setSubmitting(true);
      setError(null);

      // Prepare BSC scores
      const selfScores: IBSCScore[] = trainer.scorecardTemplate.map((metric) => ({
        metricName: metric.metricName,
        score: scores[metric.metricName] || 0,
      }));

      // Submit BSC
      await bscService.submitBSC({
        trainerId,
        quarter: currentQuarter,
        selfScores,
      });

      // Navigate to success page
      navigate(`/success?quarter=${currentQuarter}`);
    } catch (err: any) {
      console.error('Error submitting BSC:', err);
      setError(err.message || 'Failed to submit assessment');
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
          <h2>⚠️ Error</h2>
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
          <h2>✅ Already Submitted</h2>
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
          <img src="/logo.png" alt="Red Mat Pilates" className="logo" onError={(e) => {
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
          <h2>📊 Your Performance Metrics</h2>
          <p className="section-description">
            Review your performance data below before completing your self-assessment.
          </p>
          <div className="powerbi-container">
            {/* Attempt to embed Power BI - will need actual URL */}
            <div className="powerbi-placeholder">
              <p>📈 Performance Dashboard</p>
              <p className="placeholder-note">
                Power BI dashboard will be embedded here.<br />
                Contact your administrator for the dashboard link.
              </p>
              {/* Uncomment when Power BI URL is available */}
              {/* <iframe
                src={`YOUR_POWER_BI_URL?filter=trainer eq '${trainerId}'`}
                width="100%"
                height="400"
                frameBorder="0"
                title="Performance Dashboard"
              ></iframe> */}
            </div>
          </div>
        </section>

        {/* Assessment Form */}
        <form onSubmit={handleSubmit}>
          <section className="metrics-section">
            <h2>📝 Rate Your Performance</h2>
            <p className="section-description">
              For each metric below, rate yourself on a scale from 0 to 10.
            </p>

            {trainer.scorecardTemplate.map((metric) => (
              <div key={metric.metricName} className="metric-card">
                <div className="metric-header">
                  <h3>{metric.metricName}</h3>
                  <span className="weight-badge">{metric.weight}%</span>
                </div>
                <p className="metric-description">{metric.description}</p>

                <div className="slider-container">
                  <div className="slider-labels">
                    <span>{metric.minScore}</span>
                    <span className="current-score">
                      Score: {scores[metric.metricName] || metric.minScore}
                    </span>
                    <span>{metric.maxScore}</span>
                  </div>
                  <input
                    type="range"
                    min={metric.minScore}
                    max={metric.maxScore}
                    step="1"
                    value={scores[metric.metricName] || metric.minScore}
                    onChange={(e) => handleScoreChange(metric.metricName, parseInt(e.target.value))}
                    className="slider"
                  />
                </div>
              </div>
            ))}
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
            <button
              type="submit"
              disabled={submitting}
              className="submit-button"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
