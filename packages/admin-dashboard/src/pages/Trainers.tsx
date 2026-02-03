import { useEffect, useState, FormEvent } from 'react';
import { trainersService } from '../api/trainersService';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { formatCurrency } from '../utils/formatters';
import type { ITrainer, IScorecardMetric } from '@rmp/shared-types';

/* ---- blank template used for both create & edit ---- */
const blankTrainer = (): Omit<ITrainer, '_id' | 'createdAt' | 'updatedAt'> => ({
  userId: '',
  name: '',
  memberId: '',
  email: '',
  phone: '',
  joinDate: new Date(),
  status: 'active',
  baseSalary: 0,
  quarterlyBonusAmount: 0,
  scorecardTemplate: [],
  balScoreCardUrl: '',
  trainerLogsUrl: '',
  paymentAdviceUrl: '',
  leaveRecordsUrl: '',
});

export default function Trainers() {
  const [trainers, setTrainers] = useState<ITrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  /* modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankTrainer());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  /* delete confirmation */
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ---- fetch ---- */
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

  /* ---- filtered list ---- */
  const filtered = trainers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  /* ---- open create modal ---- */
  const openCreate = () => {
    setEditingId(null);
    setForm(blankTrainer());
    setReason('');
    setModalOpen(true);
  };

  /* ---- open edit modal ---- */
  const openEdit = (trainer: ITrainer) => {
    setEditingId(trainer._id || null);
    setForm({
      userId: trainer.userId,
      name: trainer.name,
      memberId: trainer.memberId,
      email: trainer.email,
      phone: trainer.phone,
      joinDate: trainer.joinDate,
      status: trainer.status,
      baseSalary: trainer.baseSalary,
      quarterlyBonusAmount: trainer.quarterlyBonusAmount,
      scorecardTemplate: trainer.scorecardTemplate,
      balScoreCardUrl: trainer.balScoreCardUrl,
      trainerLogsUrl: trainer.trainerLogsUrl,
      paymentAdviceUrl: trainer.paymentAdviceUrl,
      leaveRecordsUrl: trainer.leaveRecordsUrl,
    });
    setReason('');
    setModalOpen(true);
  };

  /* ---- submit create / edit ---- */
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
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

  /* ---- delete ---- */
  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await trainersService.delete(deleteId);
      setDeleteId(null);
      await fetchTrainers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  /* ---- scorecard metric helpers ---- */
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

  /* ---- render ---- */
  if (loading) return <div className="loading-container"><div className="loading-spinner" /><p className="text-gray-500">Loading…</p></div>;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Trainers</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>{trainers.length} total</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Trainer</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="input"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '360px' }}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Base Salary</th>
                <th style={{ textAlign: 'right' }}>Quarterly Bonus</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: '500' }}>{t.name}</td>
                  <td style={{ color: '#6b7280' }}>{t.email}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(t.baseSalary)}</td>
                  <td style={{ textAlign: 'right', color: '#6b7280' }}>
                    {t.quarterlyBonusAmount ? formatCurrency(t.quarterlyBonusAmount) : '—'}
                  </td>
                  <td><Badge status={t.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)} style={{ marginRight: '6px' }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(t._id || null)}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>No trainers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Create / Edit Modal ---- */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Trainer' : 'Add Trainer'}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="input" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Member ID</label>
              <input className="input" value={form.memberId} onChange={(e) => setForm((p) => ({ ...p, memberId: e.target.value }))} />
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
              <label className="form-label">Slack User ID</label>
              <input className="input" value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))} />
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
              <label className="form-label">Base Salary (₹) *</label>
              <input className="input" type="number" required min={0} value={form.baseSalary} onChange={(e) => setForm((p) => ({ ...p, baseSalary: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Quarterly Bonus (₹)</label>
              <input className="input" type="number" min={0} value={form.quarterlyBonusAmount} onChange={(e) => setForm((p) => ({ ...p, quarterlyBonusAmount: Number(e.target.value) }))} />
            </div>
          </div>

          {/* Scorecard Template */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label className="form-label" style={{ margin: 0 }}>Scorecard Metrics</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addMetric}>+ Add</button>
            </div>
            {form.scorecardTemplate.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <input className="input" placeholder="Metric name" value={m.metricName} onChange={(e) => updateMetric(i, 'metricName', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <input className="input" placeholder="Description" value={m.description} onChange={(e) => updateMetric(i, 'description', e.target.value)} />
                </div>
                <div style={{ width: '70px' }}>
                  <input className="input" type="number" placeholder="Wt %" value={m.weight} onChange={(e) => updateMetric(i, 'weight', Number(e.target.value))} />
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeMetric(i)}>×</button>
              </div>
            ))}
          </div>

          {/* Reason (only shown when editing) */}
          {editingId && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Reason for change</label>
              <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual raise approved by director" />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Trainer'}</button>
          </div>
        </form>
      </Modal>

      {/* ---- Delete Confirmation Modal ---- */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Trainer">
        <p style={{ color: '#4b5563', marginBottom: '20px' }}>This action cannot be undone. The trainer will be soft-deleted and won't appear in active lists.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>{saving ? 'Deleting…' : 'Delete'}</button>
        </div>
      </Modal>
    </div>
  );
}
