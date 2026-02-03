import { useEffect, useState } from 'react';
import { salaryService } from '../api/salaryService';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatMonth } from '../utils/formatters';
import type { ISalaryStatement } from '@rmp/shared-types';

export default function Salary() {
  const [statements, setStatements] = useState<ISalaryStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  /* filters */
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  /* generate modal */
  const [genModal, setGenModal] = useState(false);
  const [genMonth, setGenMonth] = useState(defaultMonth);

  /* ---- fetch ---- */
  const fetchStatements = async () => {
    try {
      setLoading(true);
      const params: any = { month: selectedMonth };
      if (statusFilter !== 'all') params.status = statusFilter;
      setStatements(await salaryService.getAll(params));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatements(); }, [selectedMonth, statusFilter]);

  /* ---- generate salary statements ---- */
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await salaryService.generate({ month: genMonth });
      setGenModal(false);
      if (genMonth === selectedMonth) await fetchStatements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  /* ---- mark all as sent ---- */
  const markAllSent = async () => {
    const drafts = statements.filter((s) => s.status === 'draft');
    setGenerating(true);
    try {
      await Promise.all(drafts.map((s) => salaryService.updateStatus(s._id!, 'sent')));
      await fetchStatements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setGenerating(false);
    }
  };

  /* totals */
  const totalPayroll = statements.reduce((s, st) => s + st.totalSalary, 0);
  const draftCount = statements.filter((s) => s.status === 'draft').length;

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><p className="text-gray-500">Loading…</p></div>;

  /* ---- month picker options (last 12 months) ---- */
  const monthOptions: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Salary Statements</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>{formatMonth(selectedMonth)}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {draftCount > 0 && (
            <button className="btn btn-success btn-sm" onClick={markAllSent} disabled={generating}>
              ✓ Mark All Sent ({draftCount})
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setGenModal(true)}>⚙ Generate</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select className="select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ width: '180px' }}>
          {monthOptions.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '140px' }}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Statements', value: statements.length, color: '#6366f1' },
          { label: 'Total Payroll', value: formatCurrency(totalPayroll), color: '#10b981' },
          { label: 'Drafts', value: draftCount, color: '#f59e0b' },
        ].map((c) => (
          <div className="card" key={c.label} style={{ borderLeft: `4px solid ${c.color}` }}>
            <div className="card-body">
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{c.label}</p>
              <p style={{ fontSize: '22px', fontWeight: '700', margin: '4px 0 0' }}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th style={{ textAlign: 'right' }}>Base</th>
                <th style={{ textAlign: 'right' }}>Bonus</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s._id}>
                  <td style={{ fontWeight: '500' }}>{s.trainerName}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(s.baseSalary)}</td>
                  <td style={{ textAlign: 'right', color: '#6b7280' }}>
                    {s.calculatedBonus ? formatCurrency(s.calculatedBonus) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(s.totalSalary)}</td>
                  <td><Badge status={s.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {s.pdfUrl && (
                      <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                        📄 PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {statements.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>No statements for this month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Generate Modal ---- */}
      <Modal isOpen={genModal} onClose={() => setGenModal(false)} title="Generate Salary Statements">
        <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '16px' }}>
          This will calculate salaries for all active trainers for the selected month and create PDF statements + Gmail drafts.
        </p>
        <div className="form-group">
          <label className="form-label">Month</label>
          <select className="select" value={genMonth} onChange={(e) => setGenMonth(e.target.value)}>
            {monthOptions.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={() => setGenModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Statements'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
