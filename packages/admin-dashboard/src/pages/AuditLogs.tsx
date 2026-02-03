import { useEffect, useState } from 'react';
import { auditService } from '../api/auditService';
import { formatDateTime } from '../utils/formatters';
import type { IAuditLog } from '@rmp/shared-types';

export default function AuditLogs() {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* filters */
  const [searchText, setSearchText] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  /* ---- fetch ---- */
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

  /* ---- derive unique actions for filter dropdown ---- */
  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  /* ---- filtered ---- */
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

  /* ---- export CSV ---- */
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

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><p className="text-gray-500">Loading…</p></div>;

  /* ---- action badge color ---- */
  const actionBadge = (action: string) => {
    if (action.includes('create')) return 'badge-success';
    if (action.includes('delete') || action.includes('reject')) return 'badge-danger';
    if (action.includes('update') || action.includes('adjust')) return 'badge-warning';
    if (action.includes('validate') || action.includes('generat')) return 'badge-info';
    return 'badge-gray';
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Audit Logs</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>{logs.length} total entries</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📥 Export CSV</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="input"
          placeholder="Search users, actions, changes…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ flex: 1, minWidth: '200px', maxWidth: '360px' }}
        />
        <select className="select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ width: '200px' }}>
          <option value="all">All Actions</option>
          {uniqueActions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Table */}
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
                  <td style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDateTime(log.timestamp)}</td>
                  <td style={{ fontWeight: '500' }}>{log.userName || log.userId}</td>
                  <td>
                    <span className={`badge ${actionBadge(log.action)}`}>{log.action}</span>
                  </td>
                  <td style={{ color: '#6b7280' }}>{log.entity}</td>
                  <td style={{ fontSize: '12px', color: '#6b7280', maxWidth: '260px' }}>
                    {log.changes ? (
                      <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '3px', wordBreak: 'break-all' }}>
                        {JSON.stringify(log.changes)}
                      </code>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>No matching logs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
