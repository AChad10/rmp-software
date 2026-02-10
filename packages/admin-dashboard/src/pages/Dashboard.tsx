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
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="text-muted">Loading dashboard...</p>
      </div>
    );
  }

  const StatCard = ({ title, value, sub, color, linkTo }: {
    title: string; value: string | number; sub?: string; color: string; linkTo?: string;
  }) => (
    <Link to={linkTo || '#'} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card stat-card" style={{ borderLeftColor: color, cursor: linkTo ? 'pointer' : 'default' }}>
        <div className="card-body">
          <p className="stat-card-title">{title}</p>
          <p className="stat-card-value">{value}</p>
          {sub && <p className="stat-card-sub">{sub}</p>}
        </div>
      </div>
    </Link>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{formatMonth(currentMonth)} Overview</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <StatCard title="Active Trainers" value={trainers.length} color="var(--accent-indigo)" linkTo="/trainers" />
        <StatCard title="Pending BSC Reviews" value={pendingBSC.length} color="var(--accent-amber)" linkTo="/bsc-review" />
        <StatCard title="Salary Statements" value={statements.length} sub={`${draftCount} draft / ${sentCount} sent`} color="var(--accent-green)" linkTo="/salary" />
        <StatCard title="Total Payroll" value={formatCurrency(totalPayroll)} sub={formatMonth(currentMonth)} color="var(--accent-purple)" />
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Trainers</h2>
          <Link to="/trainers" style={{ fontSize: '13px', color: 'var(--accent-indigo)', textDecoration: 'none' }}>View all</Link>
        </div>
        <div className="table-container" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--border-primary)' }}>
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
                  <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{t.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{t.email}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(t.baseSalary)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    {t.quarterlyBonusAmount ? formatCurrency(t.quarterlyBonusAmount) : '--'}
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
