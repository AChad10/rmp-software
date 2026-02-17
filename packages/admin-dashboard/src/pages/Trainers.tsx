import { useEffect, useState, FormEvent } from 'react';
import { trainersService } from '../api/trainersService';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import type { ITrainer, IScorecardMetric, TeamType, ExperienceLevel } from '@rmp/shared-types';
import { DEFAULT_TRAINER_SCORECARD } from '@rmp/shared-types';

const TEAM_LABELS: Record<TeamType, string> = {
  trainer: 'Trainer',
  ops_team: 'Operations',
  sales_team: 'Sales',
  other: 'Other',
};

const EXPERIENCE_OPTIONS: Record<string, { value: ExperienceLevel; label: string }[]> = {
  trainer: [
    { value: 'junior', label: 'Junior' },
    { value: 'senior', label: 'Senior' },
    { value: 'master', label: 'Master' },
  ],
  ops_sales: [
    { value: 'junior', label: 'Junior' },
    { value: 'senior', label: 'Senior' },
    { value: 'manager', label: 'Manager' },
  ],
};

const EXPERIENCE_LABELS: Record<string, string> = {
  junior: 'Junior',
  senior: 'Senior',
  master: 'Master',
  manager: 'Manager',
};

const blankTrainer = (): Omit<ITrainer, '_id' | 'createdAt' | 'updatedAt'> => ({
  userId: '',
  name: '',
  employeeCode: '',
  email: '',
  phone: '',
  joinDate: new Date(),
  status: 'active',
  team: 'trainer',
  customTeam: '',
  experienceLevel: 'junior' as ExperienceLevel,
  designation: '',
  baseSalary: 0,
  annualCTC: 0,
  quarterlyBonusAmount: 0,
  useDefaultScorecard: true,
  scorecardTemplate: [],
  panNumber: '',
  trainerLogsUrl: '',
});

export default function Trainers() {
  const [trainers, setTrainers] = useState<ITrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankTrainer());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showScorecardDetails, setShowScorecardDetails] = useState(false);

  const fetchTrainers = async () => {
    try {
      setLoading(true);
      const data = await trainersService.getAll();
      setTrainers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trainers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrainers(); }, []);

  const filtered = trainers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...blankTrainer(), useDefaultScorecard: true, scorecardTemplate: [] });
    setReason('');
    setShowScorecardDetails(false);
    setModalOpen(true);
  };

  const openEdit = (trainer: ITrainer) => {
    setEditingId(trainer._id || null);
    setForm({
      userId: trainer.userId,
      name: trainer.name,
      employeeCode: trainer.employeeCode,
      email: trainer.email,
      phone: trainer.phone,
      joinDate: trainer.joinDate,
      status: trainer.status,
      team: trainer.team || 'trainer',
      customTeam: trainer.customTeam || '',
      experienceLevel: trainer.experienceLevel || 'junior',
      designation: trainer.designation || '',
      baseSalary: trainer.baseSalary,
      annualCTC: trainer.annualCTC || 0,
      quarterlyBonusAmount: trainer.quarterlyBonusAmount,
      panNumber: trainer.panNumber || '',
      useDefaultScorecard: trainer.useDefaultScorecard ?? true,
      scorecardTemplate: trainer.scorecardTemplate || [],
      trainerLogsUrl: trainer.trainerLogsUrl || '',
    });
    setReason('');
    setShowScorecardDetails(false);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    // --- Edge-case validation ---
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (form.panNumber && !panRegex.test(form.panNumber)) {
      setError('PAN number must be exactly 10 characters in the format ABCDE1234F');
      return;
    }

    if (form.phone) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length !== 10) {
        setError('Phone number must be exactly 10 digits');
        return;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!form.employeeCode.trim()) {
      setError('Employee code is required');
      return;
    }

    if (!form.userId.trim()) {
      setError('Slack User ID is required');
      return;
    }

    if (form.baseSalary < 0) {
      setError('Base salary cannot be negative');
      return;
    }

    if (form.quarterlyBonusAmount < 0) {
      setError('Quarterly bonus cannot be negative');
      return;
    }

    if (['trainer', 'ops_team', 'sales_team'].includes(form.team) && !form.useDefaultScorecard) {
      const totalWeight = form.scorecardTemplate.reduce((sum, m) => sum + (m.weight || 0), 0);
      if (totalWeight !== 100) {
        setError(`Scorecard weights must total 100% (currently ${totalWeight}%)`);
        return;
      }
      if (form.scorecardTemplate.length === 0) {
        setError('Please add at least one scorecard metric or use the default template');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await trainersService.update(editingId, { ...form, reason } as any);
      } else {
        await trainersService.create(form as any);
      }
      setModalOpen(false);
      await fetchTrainers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      const trainer = trainers.find(t => t._id === deleteId);
      if (!trainer) return;

      // Toggle status: active <-> inactive
      const newStatus = trainer.status === 'active' ? 'inactive' : 'active';
      await trainersService.update(deleteId, { status: newStatus });
      setDeleteId(null);
      await fetchTrainers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setSaving(false);
    }
  };

  const addMetric = () => {
    setForm((prev) => ({
      ...prev,
      scorecardTemplate: [...prev.scorecardTemplate, { metricName: '', description: '', weight: 10, minScore: 0, maxScore: 10 }],
    }));
  };

  const updateMetric = (idx: number, field: keyof IScorecardMetric, value: string | number) => {
    setForm((prev) => {
      const updated = [...prev.scorecardTemplate];
      (updated[idx] as any)[field] = value;
      return { ...prev, scorecardTemplate: updated };
    });
  };

  const removeMetric = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      scorecardTemplate: prev.scorecardTemplate.filter((_, i) => i !== idx),
    }));
  };

  if (loading) {
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
          <h1 className="page-title">Staff</h1>
          <p className="page-subtitle">{trainers.length} staff member{trainers.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Staff</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '360px' }}
        />
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Team</th>
                <th>Email</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const teamLabel = t.team === 'other' && t.customTeam ? t.customTeam : TEAM_LABELS[t.team] || 'Trainer';
                const expLabel = t.experienceLevel ? EXPERIENCE_LABELS[t.experienceLevel] : '';
                const teamDisplay = expLabel ? `${expLabel} ${teamLabel}` : teamLabel;
                return (
                  <tr key={t._id}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{t.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{teamDisplay}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{t.email}</td>
                    <td><Badge status={t.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>Edit</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="empty-state">No staff members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Staff Member' : 'Add Staff Member'} size="large">
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="input" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Employee Code</label>
              <input className="input" value={form.employeeCode} onChange={(e) => setForm((p) => ({ ...p, employeeCode: e.target.value }))} placeholder="e.g. RMP-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="input" type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">PAN Number *</label>
              <input
                className="input"
                required
                value={form.panNumber || ''}
                onChange={(e) => setForm((p) => ({ ...p, panNumber: e.target.value.toUpperCase() }))}
                placeholder="ABCDE1234F"
                maxLength={10}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Slack User ID *</label>
              <input className="input" required value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Team *</label>
              <select
                className="select"
                value={form.team}
                onChange={(e) => {
                  const newTeam = e.target.value as TeamType;
                  setForm((p) => ({
                    ...p,
                    team: newTeam,
                    customTeam: newTeam !== 'other' ? '' : p.customTeam,
                    experienceLevel: newTeam === 'other' ? undefined : 'junior',
                    useDefaultScorecard: newTeam === 'trainer' ? true : false,
                    scorecardTemplate: newTeam === 'trainer' ? [] : (p.scorecardTemplate.length > 0 ? p.scorecardTemplate : []),
                  }));
                }}
              >
                <option value="trainer">Trainer</option>
                <option value="ops_team">Operations Team</option>
                <option value="sales_team">Sales Team</option>
                <option value="other">Other</option>
              </select>
            </div>
            {form.team === 'other' && (
              <div className="form-group">
                <label className="form-label">Custom Team Name *</label>
                <input
                  className="input"
                  required
                  value={form.customTeam}
                  onChange={(e) => setForm((p) => ({ ...p, customTeam: e.target.value }))}
                  placeholder="e.g. Marketing"
                />
              </div>
            )}
            {form.team !== 'other' && (
              <div className="form-group">
                <label className="form-label">Experience Level</label>
                <select
                  className="select"
                  value={form.experienceLevel || 'junior'}
                  onChange={(e) => setForm((p) => ({ ...p, experienceLevel: e.target.value as ExperienceLevel }))}
                >
                  {(form.team === 'trainer'
                    ? EXPERIENCE_OPTIONS.trainer
                    : EXPERIENCE_OPTIONS.ops_sales
                  ).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Base Salary (INR) *</label>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                required
                value={form.baseSalary || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setForm((p) => ({ ...p, baseSalary: digits ? Number(digits) : 0 }));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Quarterly Bonus (INR)</label>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                value={form.quarterlyBonusAmount || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setForm((p) => ({ ...p, quarterlyBonusAmount: digits ? Number(digits) : 0 }));
                }}
              />
            </div>
          </div>

          {form.team === 'trainer' && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Trainer Logs Sheet URL</label>
              <input
                className="input"
                value={form.trainerLogsUrl || ''}
                onChange={(e) => setForm((p) => ({ ...p, trainerLogsUrl: e.target.value }))}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </div>
          )}

          {/* Scorecard Template */}
          {['trainer', 'ops_team', 'sales_team'].includes(form.team) && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="useDefaultScorecard"
                  checked={form.useDefaultScorecard}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    useDefaultScorecard: e.target.checked,
                    scorecardTemplate: e.target.checked ? [] : [...DEFAULT_TRAINER_SCORECARD],
                  }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                />
                <label htmlFor="useDefaultScorecard" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                  Use default scorecard template
                </label>
              </div>

              {form.useDefaultScorecard ? (
                <div className="scorecard-default-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showScorecardDetails ? '12px' : '0' }}>
                    <span className="scorecard-default-label">
                      Using default {form.team === 'trainer' ? 'trainer' : form.team === 'ops_team' ? 'operations' : 'sales'} scorecard template
                    </span>
                    <button
                      type="button"
                      className="scorecard-toggle-btn"
                      onClick={() => setShowScorecardDetails(!showScorecardDetails)}
                    >
                      {showScorecardDetails ? 'Hide metrics' : 'View metrics'}
                    </button>
                  </div>
                  {showScorecardDetails && (
                    <table className="scorecard-detail-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Metric</th>
                          <th style={{ textAlign: 'right' }}>Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEFAULT_TRAINER_SCORECARD.map((m) => (
                          <tr key={m.metricName}>
                            <td>
                              <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{m.metricName}</div>
                              <div className="scorecard-metric-description">{m.description}</div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '500', color: 'var(--text-primary)' }}>{m.weight}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Custom Scorecard Metrics</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {(() => {
                        const totalWeight = form.scorecardTemplate.reduce((sum, m) => sum + (m.weight || 0), 0);
                        const isValid = totalWeight === 100;
                        return (
                          <span style={{ fontSize: '13px', color: isValid ? 'var(--accent-green)' : 'var(--brand-primary)', fontWeight: '500' }}>
                            Total: {totalWeight}%{!isValid && ' (must be 100%)'}
                          </span>
                        );
                      })()}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={addMetric}>+ Add</button>
                    </div>
                  </div>
                  {form.scorecardTemplate.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 2 }}>
                        <input className="input" placeholder="Metric name" value={m.metricName} onChange={(e) => updateMetric(i, 'metricName', e.target.value)} />
                      </div>
                      <div style={{ flex: 2 }}>
                        <input className="input" placeholder="Description" value={m.description} onChange={(e) => updateMetric(i, 'description', e.target.value)} />
                      </div>
                      <div style={{ width: '80px' }}>
                        <input
                          className="input"
                          type="text"
                          inputMode="numeric"
                          placeholder="Wt %"
                          value={m.weight || ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            updateMetric(i, 'weight', digits ? Number(digits) : 0);
                          }}
                        />
                      </div>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeMetric(i)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {form.scorecardTemplate.length === 0 && (
                    <p className="empty-state" style={{ padding: '16px' }}>
                      No metrics added. Click "+ Add" to create custom metrics.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {editingId && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Reason for change</label>
              <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual raise approved by director" />
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            {editingId && (
              <button
                type="button"
                className={`btn ${form.status === 'active' ? 'btn-danger' : 'btn-success'} btn-sm`}
                style={{ marginRight: 'auto' }}
                onClick={() => { setModalOpen(false); setDeleteId(editingId); }}
              >
                {form.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" style={!editingId ? { marginLeft: 'auto' } : undefined} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Staff'}</button>
          </div>
        </form>
      </Modal>

      {/* Activate/Deactivate Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={(() => {
          const trainer = trainers.find(t => t._id === deleteId);
          return trainer?.status === 'active' ? 'Deactivate Staff Member' : 'Activate Staff Member';
        })()}
      >
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          {(() => {
            const trainer = trainers.find(t => t._id === deleteId);
            return trainer?.status === 'active'
              ? 'The staff member will be soft-deleted and won\'t appear in active lists.'
              : 'The staff member will be reactivated and will appear in active lists.';
          })()}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
          <button
            className={(() => {
              const trainer = trainers.find(t => t._id === deleteId);
              return trainer?.status === 'active' ? 'btn btn-danger' : 'btn btn-success';
            })()}
            onClick={handleToggleStatus}
            disabled={saving}
          >
            {(() => {
              const trainer = trainers.find(t => t._id === deleteId);
              if (saving) return trainer?.status === 'active' ? 'Deactivating...' : 'Activating...';
              return trainer?.status === 'active' ? 'Deactivate' : 'Activate';
            })()}
          </button>
        </div>
      </Modal>
    </div>
  );
}
