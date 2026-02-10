import { useEffect, useState } from 'react';
import { trainersService } from '../api/trainersService';
import { trainerLogsService } from '../api/trainerLogsService';
import type { ITrainer, TrainerLogsDraftResult } from '@rmp/shared-types';

export default function TrainerLogs() {
  const [trainers, setTrainers] = useState<ITrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<TrainerLogsDraftResult[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setSuccess(null); // Clear success message on page load
        const all = await trainersService.getAll();
        setTrainers(all.filter((t) => t.team === 'trainer' && t.status === 'active'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trainers');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleCreateDrafts = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);
    setResults(null);
    try {
      const data = await trainerLogsService.createAllDrafts();
      setResults(data);

      // Count successes and failures
      const successCount = data.filter(r => r.status === 'success').length;
      const failCount = data.filter(r => r.status === 'failed').length;
      const skipCount = data.filter(r => r.status === 'skipped').length;

      if (successCount > 0) {
        setSuccess(`Successfully created ${successCount} draft${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}${skipCount > 0 ? `, ${skipCount} skipped` : ''}`);
      } else if (failCount > 0) {
        setError(`Failed to create drafts. ${failCount} trainer${failCount !== 1 ? 's' : ''} failed.`);
      } else {
        setError('No drafts created. All trainers were skipped.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create drafts');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  const readyCount = trainers.filter((t) => t.trainerLogsUrl).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trainer Logs</h1>
          <p className="page-subtitle">{trainers.length} trainer{trainers.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCreateDrafts}
          disabled={creating || readyCount === 0}
        >
          {creating ? 'Creating Drafts...' : 'Create All Drafts'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sheet URL</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: '500' }}>{t.name}</td>
                  <td>
                    {t.trainerLogsUrl ? (
                      <a
                        href={t.trainerLogsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--brand-primary)', textDecoration: 'none', maxWidth: '300px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}
                        title={t.trainerLogsUrl}
                      >
                        {t.trainerLogsUrl}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>--</span>
                    )}
                  </td>
                  <td>
                    {t.trainerLogsUrl ? (
                      <span className="badge badge-success">Ready</span>
                    ) : (
                      <span className="badge badge-gray">Missing URL</span>
                    )}
                  </td>
                </tr>
              ))}
              {trainers.length === 0 && (
                <tr><td colSpan={3} className="empty-state">No active trainers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {results && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Draft Results</h3>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Trainer</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.trainerId}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{r.trainerName}</td>
                    <td>
                      {r.status === 'success' && <span className="badge badge-success">Success</span>}
                      {r.status === 'failed' && <span className="badge badge-danger">Failed</span>}
                      {r.status === 'skipped' && <span className="badge badge-gray">Skipped</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {r.status === 'success' && r.draftUrl && (
                        <a
                          href={r.draftUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}
                        >
                          Open draft
                        </a>
                      )}
                      {r.status === 'failed' && <span style={{ color: 'var(--text-primary)' }}>{r.error}</span>}
                      {r.status === 'skipped' && <span style={{ color: 'var(--text-primary)' }}>{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
