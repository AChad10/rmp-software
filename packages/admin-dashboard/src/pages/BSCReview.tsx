import { useEffect, useState, FormEvent } from 'react';
import { bscService } from '../api/bscService';
import { trainersService } from '../api/trainersService';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { formatQuarter, getRelativeTime } from '../utils/formatters';
import type { IBSCEntry, ITrainer, IBSCScore } from '@rmp/shared-types';

// Augmented entry that carries the fetched trainer name
interface ReviewEntry extends IBSCEntry {
  trainerName?: string;
}

export default function BSCReview() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  /* review modal */
  const [reviewEntry, setReviewEntry] = useState<ReviewEntry | null>(null);
  const [validatedScores, setValidatedScores] = useState<IBSCScore[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  /* ---- fetch ---- */
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const raw: IBSCEntry[] = tab === 'pending'
        ? await bscService.getPending()
        : await bscService.getAll();

      // Enrich with trainer names (best-effort; ignore failures)
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

  useEffect(() => { fetchEntries(); }, [tab]);

  /* ---- open review modal ---- */
  const openReview = (entry: ReviewEntry) => {
    setReviewEntry(entry);
    // Pre-populate validated scores with self scores
    setValidatedScores(entry.selfScores.map((s) => ({ metricName: s.metricName, score: s.score })));
    setNotes('');
  };

  /* ---- calculate weighted score helper ---- */
  const calcWeighted = (scores: IBSCScore[]): number => {
    // We need weights — pull from the trainer's scorecard template stored in selfScores
    // Fallback: equal weight
    let total = 0;
    let weightSum = 0;
    scores.forEach((s) => {
      total += s.score;
      weightSum += 1;
    });
    return weightSum > 0 ? (total / weightSum) : 0;
  };

  /* ---- submit validation ---- */
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

  /* ---- render ---- */
  if (loading) return <div className="loading-container"><div className="loading-spinner" /><p className="text-gray-500">Loading…</p></div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>BSC Review</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>Validate trainer self-assessments</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['pending', 'all'] as const).map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t === 'pending' ? `Pending (${entries.length})` : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
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
                  <td style={{ fontWeight: '500' }}>{entry.trainerName || entry.trainerId}</td>
                  <td style={{ color: '#6b7280' }}>{formatQuarter(entry.quarter)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{entry.selfCalculatedScore?.toFixed(1) || '—'} / 10</td>
                  <td style={{ color: '#6b7280', fontSize: '13px' }}>{getRelativeTime(entry.submittedAt)}</td>
                  <td><Badge status={entry.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {entry.status === 'pending_validation' ? (
                      <button className="btn btn-primary btn-sm" onClick={() => openReview(entry)}>Review</button>
                    ) : (
                      <span className="text-gray-500 text-sm">Done</span>
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Review Modal ---- */}
      <Modal isOpen={!!reviewEntry} onClose={() => setReviewEntry(null)} title={`Review BSC – ${reviewEntry?.trainerName || ''}`}>
        {reviewEntry && (
          <form onSubmit={handleValidate}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
              Quarter: <strong>{formatQuarter(reviewEntry.quarter)}</strong>
            </p>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              Self-calculated score: <strong>{reviewEntry.selfCalculatedScore?.toFixed(1)} / 10</strong>
            </p>

            {/* Score comparison table */}
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
                      <td>{s.metricName}</td>
                      <td style={{ textAlign: 'right', color: '#6b7280' }}>{s.score}</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={validatedScores[i]?.score ?? s.score}
                          onChange={(e) => updateValidatedScore(i, Number(e.target.value))}
                          style={{ width: '52px', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center', fontSize: '13px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
              Validated score: <strong>{calcWeighted(validatedScores).toFixed(1)} / 10</strong>
            </p>

            {/* Notes */}
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Notes (optional)</label>
              <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for any adjustments…" style={{ minHeight: '60px' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReviewEntry(null)}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Validating…' : 'Approve & Validate'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
