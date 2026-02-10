import { useEffect, useState, FormEvent } from 'react';
import { bscService } from '../api/bscService';
import { trainersService } from '../api/trainersService';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { formatQuarter, getRelativeTime } from '../utils/formatters';
import type { IBSCEntry, ITrainer, IBSCScore } from '@rmp/shared-types';

interface ReviewEntry extends IBSCEntry {
  trainerName?: string;
}

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

function getQuarterOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const options: string[] = [];
  // Current quarter + 3 previous quarters
  for (let i = 0; i < 4; i++) {
    let q = currentQ - i;
    let y = year;
    while (q <= 0) { q += 4; y--; }
    options.push(`${y}-Q${q}`);
  }
  return options;
}

export default function BSCReview() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'all' | 'summary'>('pending');

  const [reviewEntry, setReviewEntry] = useState<ReviewEntry | null>(null);
  const [validatedScores, setValidatedScores] = useState<IBSCScore[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Summary state
  const [summaryQuarter, setSummaryQuarter] = useState(getCurrentQuarter());
  const [summaryEntries, setSummaryEntries] = useState<ReviewEntry[]>([]);
  const [trainers, setTrainers] = useState<ITrainer[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Trainer detail modal state
  const [selectedTrainer, setSelectedTrainer] = useState<ITrainer | null>(null);
  const [trainerDetailLoading, setTrainerDetailLoading] = useState(false);
  const [trainerBSCData, setTrainerBSCData] = useState<{ trainer: any; entries: IBSCEntry[] } | null>(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const raw: IBSCEntry[] = tab === 'pending'
        ? await bscService.getPending()
        : await bscService.getAll();

      const enriched: ReviewEntry[] = await Promise.all(
        raw.map(async (e) => {
          try {
            const t: ITrainer = await trainersService.getById(e.trainerId);
            return { ...e, trainerName: t.name };
          } catch {
            return { ...e, trainerName: 'Unknown' };
          }
        })
      );
      setEntries(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load BSC entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const [bscEntries, trainerList] = await Promise.all([
        bscService.getAll({ quarter: summaryQuarter }),
        trainersService.getAll({ status: 'active' }),
      ]);

      const enriched: ReviewEntry[] = bscEntries.map((e) => {
        const t = trainerList.find((tr) => tr._id === e.trainerId);
        return { ...e, trainerName: t?.name || 'Unknown' };
      });

      setSummaryEntries(enriched);
      setTrainers(trainerList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'summary') {
      fetchSummary();
    } else {
      fetchEntries();
    }
  }, [tab, summaryQuarter]);

  const openReview = (entry: ReviewEntry) => {
    setReviewEntry(entry);
    setValidatedScores(entry.selfScores.map((s) => ({ metricName: s.metricName, score: s.score })));
    setNotes('');
  };

  const calcWeighted = (scores: IBSCScore[]): number => {
    let total = 0;
    let weightSum = 0;
    scores.forEach((s) => {
      total += s.score;
      weightSum += 1;
    });
    return weightSum > 0 ? (total / weightSum) : 0;
  };

  const handleValidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewEntry?._id) return;
    setSaving(true);
    setError(null);
    try {
      await bscService.validate(reviewEntry._id, {
        validatedScores,
        validationNotes: notes || undefined,
      });
      setReviewEntry(null);
      await fetchEntries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setSaving(false);
    }
  };

  const updateValidatedScore = (idx: number, value: number) => {
    setValidatedScores((prev) => prev.map((s, i) => (i === idx ? { ...s, score: value } : s)));
  };

  const openTrainerDetail = async (trainer: ITrainer) => {
    setSelectedTrainer(trainer);
    setTrainerDetailLoading(true);
    try {
      const data = await bscService.getTrainerBSC(trainer._id!);
      setTrainerBSCData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trainer data');
    } finally {
      setTrainerDetailLoading(false);
    }
  };

  const closeTrainerDetail = () => {
    setSelectedTrainer(null);
    setTrainerBSCData(null);
  };

  const getTeamLabel = (trainer: ITrainer): string => {
    if (trainer.team === 'other' && trainer.customTeam) {
      return trainer.customTeam;
    }
    const labels: Record<string, string> = {
      'trainer': 'Trainer',
      'ops_team': 'Operations',
      'sales_team': 'Sales',
      'other': 'Other'
    };
    return labels[trainer.team] || trainer.team;
  };


  if (loading && tab !== 'summary') {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">BSC Review</h1>
          <p className="page-subtitle">
            {tab === 'summary'
              ? `Self-assessment summary for ${formatQuarter(summaryQuarter)}`
              : 'Validate trainer self-assessments'}
          </p>
        </div>
        {tab === 'summary' && (
          <select
            className="select"
            value={summaryQuarter}
            onChange={(e) => setSummaryQuarter(e.target.value)}
            style={{ width: '140px' }}
          >
            {getQuarterOptions().map((q) => (
              <option key={q} value={q}>{formatQuarter(q)}</option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['pending', 'all', 'summary'] as const).map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t === 'pending' ? `Pending${tab === 'pending' ? ` (${entries.length})` : ''}` : t === 'all' ? 'All' : 'Summary'}
          </button>
        ))}
      </div>

      {tab === 'summary' ? (
        summaryLoading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p className="text-muted">Loading summary...</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Submitted', value: summaryEntries.length, color: 'var(--accent-green)' },
                {
                  label: 'Awaiting',
                  value: trainers.filter((t) => t.quarterlyBonusAmount > 0 && !summaryEntries.some(e => e.trainerId === t._id)).length,
                  color: 'var(--accent-amber)'
                },
                { label: 'Validated', value: summaryEntries.filter((e) => e.status === 'validated').length, color: 'var(--accent-indigo)' },
              ].map((c) => (
                <div className="card stat-card" key={c.label} style={{ borderLeftColor: c.color }}>
                  <div className="card-body">
                    <p className="stat-card-title">{c.label}</p>
                    <p className="stat-card-value" style={{ fontSize: '1.375rem' }}>{c.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trainer Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {trainers
                .filter((t) => t.quarterlyBonusAmount > 0)
                .map((trainer) => {
                  const entry = summaryEntries.find((e) => e.trainerId === trainer._id);
                  const hasSubmitted = !!entry;
                  const weighted = entry?.selfCalculatedScore != null
                    ? (entry.selfCalculatedScore * 10).toFixed(1)
                    : null;

                  return (
                    <div
                      key={trainer._id}
                      className="card"
                      onClick={() => openTrainerDetail(trainer)}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderLeft: `3px solid ${hasSubmitted ? 'var(--accent-green)' : 'var(--accent-amber)'}`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="card-body" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, marginBottom: '4px' }}>
                              {trainer.name}
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                              {getTeamLabel(trainer)}
                            </p>
                          </div>
                          {hasSubmitted && entry.status && (
                            <Badge status={entry.status} />
                          )}
                        </div>

                        {hasSubmitted && weighted ? (
                          <div style={{
                            padding: '12px',
                            background: 'var(--bg-surface-secondary)',
                            borderRadius: '6px',
                            textAlign: 'center'
                          }}>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginBottom: '4px' }}>
                              {formatQuarter(summaryQuarter)} Score
                            </p>
                            <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                              {weighted} <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>/ 10</span>
                            </p>
                          </div>
                        ) : (
                          <div style={{
                            padding: '12px',
                            background: 'var(--bg-surface-secondary)',
                            borderRadius: '6px',
                            textAlign: 'center'
                          }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                              Not yet submitted
                            </p>
                          </div>
                        )}

                        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          Click to view history
                        </div>
                      </div>
                    </div>
                  );
                })}

              {trainers.filter((t) => t.quarterlyBonusAmount > 0).length === 0 && (
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                  <div className="card-body">
                    <p className="empty-state">No trainers found.</p>
                  </div>
                </div>
              )}
            </div>

          </>
        )
      ) : (
        <div className="card">
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Trainer</th>
                  <th>Quarter</th>
                  <th style={{ textAlign: 'right' }}>Self Score</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry._id}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{entry.trainerName || entry.trainerId}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatQuarter(entry.quarter)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>{entry.selfCalculatedScore != null ? (entry.selfCalculatedScore * 10).toFixed(1) : '--'} / 10</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{getRelativeTime(entry.submittedAt)}</td>
                    <td><Badge status={entry.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {entry.status === 'pending_validation' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => openReview(entry)}>Review</button>
                      ) : (
                        <span className="text-muted text-sm">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={6} className="empty-state">No entries.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedTrainer}
        onClose={closeTrainerDetail}
        title={selectedTrainer ? `${selectedTrainer.name} - BSC History` : ''}
      >
        {trainerDetailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Loading history...</p>
          </div>
        ) : trainerBSCData && selectedTrainer ? (
          <div>
            {/* Trainer Info */}
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-surface-secondary)',
              borderRadius: '6px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', margin: 0, marginBottom: '2px' }}>Team</p>
                  <p style={{ color: 'var(--text-primary)', fontWeight: '500', margin: 0 }}>{getTeamLabel(selectedTrainer)}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', margin: 0, marginBottom: '2px' }}>Scorecard</p>
                  <p style={{ color: 'var(--text-primary)', fontWeight: '500', margin: 0 }}>
                    {trainerBSCData.trainer.useDefaultScorecard ? 'Default' : 'Custom'}
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Scorecard Metrics (if applicable) */}
            {!trainerBSCData.trainer.useDefaultScorecard && trainerBSCData.trainer.scorecardTemplate && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Custom Metrics
                </h4>
                <div className="table-container">
                  <table className="table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th style={{ textAlign: 'center' }}>Weight</th>
                        <th style={{ textAlign: 'center' }}>Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainerBSCData.trainer.scorecardTemplate.map((metric: any) => (
                        <tr key={metric.metricName}>
                          <td>
                            <div>
                              <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{metric.metricName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{metric.description}</div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-primary)' }}>{metric.weight}%</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {metric.minScore} - {metric.maxScore}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Quarter History */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
                Quarter History
              </h4>
              {trainerBSCData.entries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {trainerBSCData.entries.map((entry) => (
                    <div
                      key={entry._id}
                      className="card"
                      style={{
                        borderLeft: `3px solid ${
                          entry.status === 'validated'
                            ? 'var(--accent-green)'
                            : entry.status === 'pending_validation'
                            ? 'var(--accent-amber)'
                            : 'var(--accent-red)'
                        }`,
                      }}
                    >
                      <div className="card-body" style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <h5 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, marginBottom: '4px' }}>
                              {formatQuarter(entry.quarter)}
                            </h5>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                              Submitted: {getRelativeTime(entry.submittedAt)}
                            </p>
                          </div>
                          <Badge status={entry.status} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <div style={{
                            padding: '8px',
                            background: 'var(--bg-surface-secondary)',
                            borderRadius: '4px',
                            textAlign: 'center'
                          }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, marginBottom: '2px' }}>Self Score</p>
                            <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                              {entry.selfCalculatedScore != null ? (entry.selfCalculatedScore * 10).toFixed(1) : '--'} / 10
                            </p>
                          </div>
                          {entry.status === 'validated' && entry.finalScore != null && (
                            <div style={{
                              padding: '8px',
                              background: 'var(--bg-surface-secondary)',
                              borderRadius: '4px',
                              textAlign: 'center'
                            }}>
                              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, marginBottom: '2px' }}>Final Score</p>
                              <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--accent-green)', margin: 0 }}>
                                {(entry.finalScore * 10).toFixed(1)} / 10
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Metric Scores */}
                        <details style={{ fontSize: '12px' }}>
                          <summary style={{
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: '6px 0',
                            fontWeight: '500',
                            userSelect: 'none'
                          }}>
                            View detailed scores
                          </summary>
                          <div style={{ marginTop: '8px' }}>
                            <div className="table-container">
                              <table className="table" style={{ fontSize: '11px' }}>
                                <thead>
                                  <tr>
                                    <th>Metric</th>
                                    <th style={{ textAlign: 'right' }}>Self</th>
                                    {entry.status === 'validated' && <th style={{ textAlign: 'right' }}>Final</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.selfScores.map((score) => {
                                    const validatedScore = entry.validatedScores?.find((s) => s.metricName === score.metricName);
                                    return (
                                      <tr key={score.metricName}>
                                        <td style={{ color: 'var(--text-primary)' }}>
                                          {score.metricName}
                                          {score.notes && (
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                              {score.notes}
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{score.score.toFixed(1)}</td>
                                        {entry.status === 'validated' && (
                                          <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: '500' }}>
                                            {validatedScore ? validatedScore.score.toFixed(1) : score.score.toFixed(1)}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </details>

                        {entry.validationNotes && (
                          <div style={{
                            marginTop: '10px',
                            padding: '8px',
                            background: 'var(--bg-surface-secondary)',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            <p style={{ fontWeight: '600', color: 'var(--text-secondary)', margin: 0, marginBottom: '4px' }}>
                              Validation Notes
                            </p>
                            <p style={{ color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>
                              {entry.validationNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <div className="card-body">
                    <p className="empty-state">No BSC submissions yet.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={!!reviewEntry} onClose={() => setReviewEntry(null)} title={`Review BSC -- ${reviewEntry?.trainerName || ''}`}>
        {reviewEntry && (
          <form onSubmit={handleValidate}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Quarter: <strong>{formatQuarter(reviewEntry.quarter)}</strong>
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Self-calculated score: <strong>{reviewEntry.selfCalculatedScore != null ? (reviewEntry.selfCalculatedScore * 10).toFixed(1) : '--'} / 10</strong>
            </p>

            {/* Show self-assessment notes */}
            {reviewEntry.selfScores.some((s) => s.notes) && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Supporting Data
                </p>
                {reviewEntry.selfScores.filter((s) => s.notes).map((s) => (
                  <div key={s.metricName} style={{ marginBottom: '8px', padding: '8px 12px', background: 'var(--bg-surface-secondary)', borderRadius: '4px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>{s.metricName}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>{s.notes}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="table-container" style={{ marginBottom: '16px' }}>
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ textAlign: 'right' }}>Self</th>
                    <th style={{ textAlign: 'right' }}>Your Score</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewEntry.selfScores.map((s, i) => (
                    <tr key={s.metricName}>
                      <td style={{ color: 'var(--text-primary)' }}>{s.metricName}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{s.score}</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step="any"
                          value={validatedScores[i]?.score ?? s.score}
                          onChange={(e) => updateValidatedScore(i, Number(e.target.value))}
                          className="input"
                          style={{ width: '52px', padding: '4px 6px', textAlign: 'center', fontSize: '13px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Validated score: <strong>{calcWeighted(validatedScores).toFixed(1)} / 10</strong>
            </p>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Notes (optional)</label>
              <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for any adjustments..." style={{ minHeight: '60px' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReviewEntry(null)}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Validating...' : 'Approve & Validate'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
