import { useEffect, useState } from 'react';
import { auditService } from '../api/auditService';
import { formatDateTime } from '../utils/formatters';
import type { IAuditLog } from '@rmp/shared-types';

export default function AuditLogs() {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setLogs(await auditService.getAll());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const filtered = logs.filter((l) => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        l.userName?.toLowerCase().includes(q) ||
        l.userId?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.entity?.toLowerCase().includes(q) ||
        JSON.stringify(l.changes || {}).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Changes'];
    const rows = filtered.map((l) => [
      l.timestamp,
      l.userName || l.userId,
      l.action,
      l.entity,
      l.entityId,
      JSON.stringify(l.changes || {}),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  const actionBadge = (action: string) => {
    if (action.includes('create')) return 'badge-success';
    if (action.includes('delete') || action.includes('reject')) return 'badge-danger';
    if (action.includes('update') || action.includes('adjust')) return 'badge-warning';
    if (action.includes('validate') || action.includes('generat')) return 'badge-info';
    return 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">{logs.length} total entries</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search users, actions, changes..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ flex: 1, minWidth: '200px', maxWidth: '360px' }}
        />
        <select className="select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ width: '200px' }}>
          <option value="all">All Actions</option>
          {uniqueActions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={log._id || i}>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(log.timestamp)}</td>
                  <td style={{ fontWeight: '500' }}>{log.userName || log.userId}</td>
                  <td>
                    <span className={`badge ${actionBadge(log.action)}`}>{log.action}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{log.entity}</td>
                  <td style={{ fontSize: '12px', maxWidth: '260px' }}>
                    {log.changes ? (
                      <code className="audit-code">
                        {JSON.stringify(log.changes)}
                      </code>
                    ) : '--'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="empty-state">No matching logs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
