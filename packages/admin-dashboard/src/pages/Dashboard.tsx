import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trainersService } from '../api/trainersService';
import { bscService } from '../api/bscService';
import { salaryService } from '../api/salaryService';
import { formatCurrency, formatMonth } from '../utils/formatters';
import type { ITrainer, IBSCEntry, ISalaryStatement } from '@rmp/shared-types';

export default function Dashboard() {
  const [trainers, setTrainers] = useState<ITrainer[]>([]);
  const [pendingBSC, setPendingBSC] = useState<IBSCEntry[]>([]);
  const [statements, setStatements] = useState<ISalaryStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive current month string "YYYY-MM"
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    (async () => {
      try {
        const [t, b, s] = await Promise.all([
          trainersService.getAll({ status: 'active' }),
          bscService.getPending(),
          salaryService.getAll({ month: currentMonth }),
        ]);
        setTrainers(t);
        setPendingBSC(b);
        setStatements(s);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPayroll = statements.reduce((sum, s) => sum + s.totalSalary, 0);
  const draftCount = statements.filter((s) => s.status === 'draft').length;
  const sentCount = statements.filter((s) => s.status === 'sent').length;

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner" /><p className="text-gray-500">Loading dashboard…</p></div>;
  }

  /* --- stat card helper --- */
  const StatCard = ({ title, value, sub, color, linkTo }: {
    title: string; value: string | number; sub?: string; color: string; linkTo?: string;
  }) => (
    <Link to={linkTo || '#'} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card" style={{ borderLeft: `4px solid ${color}`, cursor: linkTo ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
      >
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{title}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: '4px 0 0' }}>{value}</p>
            {sub && <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>{sub}</p>}
          </div>
        </div>
      </div>
    </Link>
  );

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>{formatMonth(currentMonth)} Overview</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard title="Active Trainers" value={trainers.length} color="#6366f1" linkTo="/trainers" />
        <StatCard title="Pending BSC Reviews" value={pendingBSC.length} color="#f59e0b" linkTo="/bsc-review" />
        <StatCard title="Salary Statements" value={statements.length} sub={`${draftCount} draft · ${sentCount} sent`} color="#10b981" linkTo="/salary" />
        <StatCard title="Total Payroll" value={formatCurrency(totalPayroll)} sub={formatMonth(currentMonth)} color="#8b5cf6" />
      </div>

      {/* Recent Activity – trainer list preview */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Trainers</h2>
          <Link to="/trainers" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none' }}>View all →</Link>
        </div>
        <div className="table-container" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid #e5e7eb' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Base Salary</th>
                <th style={{ textAlign: 'right' }}>Bonus</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trainers.slice(0, 6).map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: '500' }}>{t.name}</td>
                  <td style={{ color: '#6b7280' }}>{t.email}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(t.baseSalary)}</td>
                  <td style={{ textAlign: 'right', color: '#6b7280' }}>
                    {t.quarterlyBonusAmount ? formatCurrency(t.quarterlyBonusAmount) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
