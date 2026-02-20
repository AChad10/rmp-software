import { useEffect, useState } from 'react';
import { salaryService } from '../api/salaryService';
import { trainersService } from '../api/trainersService';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { MonthPicker } from '../components/common/MonthPicker';
import { formatCurrency, formatMonth } from '../utils/formatters';
import type { ISalaryStatement, ITrainer, IPerClassStatement, CompensationType } from '@rmp/shared-types';

interface SalaryBreakdown {
  compensationType: CompensationType;
  employeeName: string;
  designation: string;
  employeeCode: string;
  panNumber: string;
  period: string;
  daysInPeriod: number;
  financialYear: string;
  annualBase: number;
  monthlyBase: number;
  currentBase: number;
  baseRemarks: string;
  annualBonus: number;
  monthlyBonus: number;
  currentBonus: string;
  bonusRemarks: string;
  annualCTC: number;
  monthlyCTC: number;
  travelRemarks: string;
  bankTransfer: number;
}

interface SeniorComponentRow {
  id: string;
  name: string;
  annualAmount: number;
  monthlyAmount: number;
  frequency: string;
  remarks: string;
  currentAmount: number;
}

interface SeniorBreakdown {
  compensationType: 'senior';
  employeeName: string;
  designation: string;
  employeeCode: string;
  panNumber: string;
  period: string;
  daysInPeriod: number;
  financialYear: string;
  fixedComponents: SeniorComponentRow[];
  variableComponents: SeniorComponentRow[];
  tds: number;
  travelReimbursement: number;
  bankTransfer: number;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFinancialYear(year: number, month: number): string {
  if (month <= 3) return `${year - 1}-${String(year).slice(-2)}`;
  return `${year}-${String(year + 1).slice(-2)}`;
}

function getPeriodString(year: number, month: number): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]}-${String(year).slice(-2)}`;
}

const PC_STATUS_LABELS: Record<string, string> = {
  pending_logs: 'Pending',
  logs_sent: 'Logs Sent',
  confirmed: 'Confirmed',
  payout_sent: 'Payout Sent',
  paid: 'Paid',
};

export default function Salary() {
  const [statements, setStatements] = useState<ISalaryStatement[]>([]);
  const [trainers, setTrainers] = useState<ITrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'preview'>('list');
  const [activeTab, setActiveTab] = useState<'salaried' | 'per_class'>('salaried');

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [genModal, setGenModal] = useState(false);
  const [genMonth, setGenMonth] = useState(defaultMonth);

  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  const [_selectedTrainer, setSelectedTrainer] = useState<ITrainer | null>(null);
  const [breakdown, setBreakdown] = useState<SalaryBreakdown | null>(null);
  const [seniorBreakdown, setSeniorBreakdown] = useState<SeniorBreakdown | null>(null);

  const [creatingDrafts, setCreatingDrafts] = useState(false);

  // Per-class state
  const [pcStatements, setPcStatements] = useState<IPerClassStatement[]>([]);
  const [pcLoading, setPcLoading] = useState(false);
  const [sendingLogs, setSendingLogs] = useState(false);
  const [generatingPayouts, setGeneratingPayouts] = useState(false);

  const fetchTrainers = async () => {
    try {
      const data = await trainersService.getAll({ status: 'active' });
      setTrainers(data);
    } catch (err: unknown) {
      console.error('Failed to load trainers:', err);
    }
  };

  const fetchStatements = async () => {
    try {
      setLoading(true);
      setSuccess(null); // Clear success message when refreshing
      const params: Record<string, string> = { month: selectedMonth };
      if (statusFilter !== 'all') params.status = statusFilter;
      setStatements(await salaryService.getAll(params));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  };

  const fetchPcStatements = async () => {
    try {
      setPcLoading(true);
      const data = await salaryService.getPerClassStatements({ month: selectedMonth });
      setPcStatements(data);
    } catch (err: unknown) {
      console.error('Failed to load per-class statements:', err);
    } finally {
      setPcLoading(false);
    }
  };

  useEffect(() => { fetchTrainers(); }, []);
  useEffect(() => {
    if (activeTab === 'salaried' && viewMode === 'list') fetchStatements();
    if (activeTab === 'per_class') fetchPcStatements();
  }, [selectedMonth, statusFilter, viewMode, activeTab]);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const generateBreakdown = (trainer: ITrainer): SalaryBreakdown => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const monthNumber = parseInt(monthStr);
    const annualBase = trainer.baseSalary * 12;
    const hasBSC = trainer.quarterlyBonusAmount > 0;
    const monthlyBonus = hasBSC ? Math.round(trainer.quarterlyBonusAmount / 12) : 0;

    return {
      compensationType: trainer.compensationType || 'standard',
      employeeName: trainer.name,
      designation: trainer.designation || 'Instructor',
      employeeCode: trainer.employeeCode,
      panNumber: trainer.panNumber || '',
      period: getPeriodString(year, monthNumber),
      daysInPeriod: getDaysInMonth(year, monthNumber),
      financialYear: getFinancialYear(year, monthNumber),
      annualBase,
      monthlyBase: trainer.baseSalary,
      currentBase: trainer.baseSalary,
      baseRemarks: '',
      annualBonus: trainer.quarterlyBonusAmount,
      monthlyBonus,
      currentBonus: '',
      bonusRemarks: hasBSC ? '*Eff 1st Oct 25, PLR follows quarterly payout cycle.' : 'No variable component',
      annualCTC: trainer.annualCTC || (annualBase + trainer.quarterlyBonusAmount),
      monthlyCTC: trainer.baseSalary + monthlyBonus,
      travelRemarks: `On actuals as per policy, Claims awaited for ${getPeriodString(year, monthNumber)}`,
      bankTransfer: trainer.baseSalary,
    };
  };

  const generateSeniorBreakdown = (trainer: ITrainer): SeniorBreakdown => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const monthNumber = parseInt(monthStr);
    const components = trainer.salaryComponents || { fixed: [], variable: [] };

    const fixedComponents: SeniorComponentRow[] = components.fixed.map(c => ({
      id: c.id,
      name: c.name,
      annualAmount: c.annualAmount,
      monthlyAmount: c.monthlyAmount,
      frequency: c.frequency,
      remarks: c.remarks,
      currentAmount: c.monthlyAmount,
    }));

    const variableComponents: SeniorComponentRow[] = components.variable.map(c => ({
      id: c.id,
      name: c.name,
      annualAmount: c.annualAmount,
      monthlyAmount: c.monthlyAmount,
      frequency: c.frequency,
      remarks: c.remarks,
      currentAmount: c.frequency === 'Monthly' ? c.monthlyAmount : 0,
    }));

    const totalCurrent = [...fixedComponents, ...variableComponents].reduce((s, c) => s + c.currentAmount, 0);

    return {
      compensationType: 'senior',
      employeeName: trainer.name,
      designation: trainer.designation || 'Staff',
      employeeCode: trainer.employeeCode,
      panNumber: trainer.panNumber || '',
      period: getPeriodString(year, monthNumber),
      daysInPeriod: getDaysInMonth(year, monthNumber),
      financialYear: getFinancialYear(year, monthNumber),
      fixedComponents,
      variableComponents,
      tds: 0,
      travelReimbursement: 0,
      bankTransfer: totalCurrent,
    };
  };

  const handleTrainerSelect = (trainerId: string) => {
    setSelectedTrainerId(trainerId);
    if (trainerId) {
      const trainer = trainers.find(t => t._id === trainerId);
      if (trainer) {
        setSelectedTrainer(trainer);
        const ct = trainer.compensationType || 'standard';
        if (ct === 'senior' && trainer.salaryComponents) {
          setSeniorBreakdown(generateSeniorBreakdown(trainer));
          setBreakdown(null);
        } else {
          setBreakdown(generateBreakdown(trainer));
          setSeniorBreakdown(null);
        }
      }
    } else {
      setSelectedTrainer(null);
      setBreakdown(null);
      setSeniorBreakdown(null);
    }
  };

  const handleBreakdownChange = (field: keyof SalaryBreakdown, value: string | number) => {
    if (!breakdown) return;
    setBreakdown({ ...breakdown, [field]: value });
  };

  const handleSeniorComponentChange = (
    category: 'fixedComponents' | 'variableComponents',
    idx: number,
    field: keyof SeniorComponentRow,
    value: string | number
  ) => {
    if (!seniorBreakdown) return;
    const updated = [...seniorBreakdown[category]];
    (updated[idx] as any)[field] = value;
    const newBreakdown = { ...seniorBreakdown, [category]: updated };
    // Recalculate bank transfer
    const totalCurrent = [...newBreakdown.fixedComponents, ...newBreakdown.variableComponents].reduce((s, c) => s + c.currentAmount, 0);
    newBreakdown.bankTransfer = totalCurrent - newBreakdown.tds;
    setSeniorBreakdown(newBreakdown);
  };

  const handleSeniorFieldChange = (field: 'tds' | 'travelReimbursement' | 'bankTransfer' | 'designation' | 'panNumber', value: string | number) => {
    if (!seniorBreakdown) return;
    const newBreakdown = { ...seniorBreakdown, [field]: value };
    if (field === 'tds') {
      const totalCurrent = [...newBreakdown.fixedComponents, ...newBreakdown.variableComponents].reduce((s, c) => s + c.currentAmount, 0);
      newBreakdown.bankTransfer = totalCurrent - (value as number);
    }
    setSeniorBreakdown(newBreakdown);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await salaryService.generate({ month: genMonth, overwrite: true });
      setGenModal(false);
      if (genMonth === selectedMonth) await fetchStatements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSingle = async () => {
    if (!selectedTrainerId || (!breakdown && !seniorBreakdown)) return;
    setGenerating(true);
    setError(null);
    try {
      if (seniorBreakdown) {
        await salaryService.generateSingle({
          trainerId: selectedTrainerId,
          month: selectedMonth,
          pdfData: {
            compensationType: 'senior',
            employeeName: seniorBreakdown.employeeName,
            designation: seniorBreakdown.designation,
            employeeCode: seniorBreakdown.employeeCode,
            panNumber: seniorBreakdown.panNumber,
            period: seniorBreakdown.period,
            daysInPeriod: seniorBreakdown.daysInPeriod,
            financialYear: seniorBreakdown.financialYear,
            fixedComponents: seniorBreakdown.fixedComponents,
            variableComponents: seniorBreakdown.variableComponents,
            tds: seniorBreakdown.tds,
            travelReimbursement: seniorBreakdown.travelReimbursement,
            bankTransfer: seniorBreakdown.bankTransfer,
          },
          overwrite: true,
        });
        setSuccess(`Generated salary statement for ${seniorBreakdown.employeeName}`);
      } else if (breakdown) {
        await salaryService.generateSingle({
          trainerId: selectedTrainerId,
          month: selectedMonth,
          pdfData: breakdown,
          overwrite: true,
        });
        setSuccess(`Generated salary statement for ${breakdown.employeeName}`);
      }
      setViewMode('list');
      await fetchStatements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateDrafts = async () => {
    setCreatingDrafts(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await salaryService.createDrafts(selectedMonth);
      await fetchStatements();

      // Show success message with count
      const count = result.draftsCreated || statements.filter(s => !s.gmailDraftId).length;
      setSuccess(`Successfully created ${count} Gmail draft${count !== 1 ? 's' : ''} for salary statements.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create drafts');
    } finally {
      setCreatingDrafts(false);
    }
  };

  // Per-class handlers
  const handleSendLogs = async () => {
    setSendingLogs(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await salaryService.sendPerClassLogs(selectedMonth);
      setSuccess(`Sent log summaries for ${result.sent} per-class trainer${result.sent !== 1 ? 's' : ''}.`);
      await fetchPcStatements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send log summaries');
    } finally {
      setSendingLogs(false);
    }
  };

  const handleGeneratePayouts = async () => {
    setGeneratingPayouts(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await salaryService.generatePerClassPayouts(selectedMonth);
      setSuccess(`Generated payouts for ${result.generated} trainer${result.generated !== 1 ? 's' : ''}.`);
      await fetchPcStatements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate payouts');
    } finally {
      setGeneratingPayouts(false);
    }
  };

  const handlePcStatusUpdate = async (id: string, status: string) => {
    try {
      await salaryService.updatePerClassStatus(id, status);
      await fetchPcStatements();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const totalPayroll = statements.reduce((s, st) => s + st.totalSalary, 0);
  const draftCount = statements.filter((s) => s.status === 'draft').length;
  const statementsWithoutDrafts = statements.filter((s) => !s.gmailDraftId).length;
  const canCreateDrafts = statements.length > 0 && statementsWithoutDrafts > 0;

  // Per-class summary stats
  const pcTotalTrainers = pcStatements.length;
  const pcTotalGross = pcStatements.reduce((s, st) => s + st.grossBilling, 0);
  const pcPendingConfirmation = pcStatements.filter(s => s.status === 'logs_sent').length;
  const pcConfirmed = pcStatements.filter(s => s.status === 'confirmed').length;

  const monthOptions: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  if (loading && viewMode === 'list' && activeTab === 'salaried') {
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
          <h1 className="page-title">Salary Statements</h1>
          <p className="page-subtitle">{formatMonth(selectedMonth)}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'salaried' && viewMode === 'list' && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewMode('preview')}>
                Preview / Edit
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={handleCreateDrafts}
                disabled={!canCreateDrafts || creatingDrafts}
                title={!canCreateDrafts ? 'No statements need drafts' : 'Create Gmail drafts for all statements'}
              >
                {creatingDrafts ? 'Creating...' : `Create Drafts${statementsWithoutDrafts > 0 ? ` (${statementsWithoutDrafts})` : ''}`}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setGenModal(true)}>
                Generate PDFs
              </button>
            </>
          )}
          {activeTab === 'salaried' && viewMode === 'preview' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setViewMode('list'); setBreakdown(null); setSeniorBreakdown(null); setSelectedTrainer(null); setSelectedTrainerId(''); }}
            >
              Back to List
            </button>
          )}
          {activeTab === 'per_class' && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSendLogs}
                disabled={sendingLogs}
              >
                {sendingLogs ? 'Sending...' : 'Send Log Summaries'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGeneratePayouts}
                disabled={generatingPayouts || pcConfirmed === 0}
                title={pcConfirmed === 0 ? 'No confirmed statements to generate payouts for' : ''}
              >
                {generatingPayouts ? 'Generating...' : `Generate Payouts${pcConfirmed > 0 ? ` (${pcConfirmed})` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Tab Bar */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === 'salaried' ? 'active' : ''}`}
          onClick={() => { setActiveTab('salaried'); setViewMode('list'); }}
        >
          Salaried Staff
        </button>
        <button
          className={`tab ${activeTab === 'per_class' ? 'active' : ''}`}
          onClick={() => setActiveTab('per_class')}
        >
          Per-Class Trainers
        </button>
      </div>

      <div className="filter-bar">
        <MonthPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
        />
        {activeTab === 'salaried' && viewMode === 'list' && (
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '140px' }}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
        )}
        {activeTab === 'salaried' && viewMode === 'preview' && (
          <select
            className="select"
            value={selectedTrainerId}
            onChange={(e) => handleTrainerSelect(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="">Select Trainer</option>
            {trainers.filter(t => t.compensationType !== 'per_class').map((t) => (
              <option key={t._id} value={t._id}>
                {t.name} ({t.employeeCode}){t.quarterlyBonusAmount ? '' : ' - No BSC'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ===== SALARIED TAB ===== */}
      {activeTab === 'salaried' && (viewMode === 'list' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Statements', value: statements.length, color: 'var(--accent-indigo)' },
              { label: 'Total Payroll', value: formatCurrency(totalPayroll), color: 'var(--accent-green)' },
              { label: 'Drafts', value: draftCount, color: 'var(--accent-amber)' },
            ].map((c) => (
              <div className="card stat-card" key={c.label} style={{ borderLeftColor: c.color }}>
                <div className="card-body">
                  <p className="stat-card-title">{c.label}</p>
                  <p className="stat-card-value" style={{ fontSize: '1.375rem' }}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

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
                      <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{s.trainerName}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(s.baseSalary)}</td>
                      <td style={{ textAlign: 'right', color: s.calculatedBonus ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                        {s.calculatedBonus ? formatCurrency(s.calculatedBonus) : (s.bscScore ? formatCurrency(0) : 'N/A')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(s.totalSalary)}</td>
                      <td><Badge status={s.status} /></td>
                      <td style={{ textAlign: 'right' }}>
                        {s.pdfUrl && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              const token = localStorage.getItem('auth_token');
                              const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                              window.open(`${apiBase}/salary/statements/${s._id}/pdf?token=${token}`, '_blank');
                            }}
                          >
                            PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {statements.length === 0 && (
                    <tr><td colSpan={6} className="empty-state">No statements for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        seniorBreakdown ? (
          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div className="salary-preview-grid">
                    <span className="salary-preview-label">Employee Name</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{seniorBreakdown.employeeName}</span>
                    <span className="salary-preview-label">Designation</span>
                    <input
                      className="input"
                      value={seniorBreakdown.designation}
                      onChange={(e) => handleSeniorFieldChange('designation', e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '14px' }}
                    />
                    <span className="salary-preview-label">Employee Code</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{seniorBreakdown.employeeCode}</span>
                    <span className="salary-preview-label">PAN No.</span>
                    <input
                      className="input"
                      value={seniorBreakdown.panNumber}
                      onChange={(e) => handleSeniorFieldChange('panNumber', e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '14px', width: '140px' }}
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>Current Salary</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px auto', gap: '4px 12px', fontSize: '14px', textAlign: 'left' }}>
                    <span className="salary-preview-label">Period*</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{seniorBreakdown.period}</span>
                    <span className="salary-preview-label">Days in Period</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{seniorBreakdown.daysInPeriod}</span>
                    <span className="salary-preview-label">Year</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{seniorBreakdown.financialYear}</span>
                  </div>
                </div>
              </div>

              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Component</th>
                    <th style={{ textAlign: 'center', width: '100px' }}>Annual CTC</th>
                    <th style={{ textAlign: 'center', width: '100px' }}>Per Month</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Frequency</th>
                    <th style={{ width: '180px' }}>Remarks</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>Income For Period</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'var(--bg-surface-secondary)' }}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Fixed</td>
                    <td colSpan={5}></td>
                  </tr>
                  {seniorBreakdown.fixedComponents.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" className="input" value={c.annualAmount} onChange={(e) => handleSeniorComponentChange('fixedComponents', i, 'annualAmount', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" className="input" value={c.monthlyAmount} onChange={(e) => handleSeniorComponentChange('fixedComponents', i, 'monthlyAmount', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-primary)' }}>{c.frequency}</td>
                      <td>
                        <textarea className="textarea" value={c.remarks} onChange={(e) => handleSeniorComponentChange('fixedComponents', i, 'remarks', e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', minHeight: '36px', resize: 'vertical' }} placeholder="Remarks..." />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" className="input" value={c.currentAmount} onChange={(e) => handleSeniorComponentChange('fixedComponents', i, 'currentAmount', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                      </td>
                    </tr>
                  ))}

                  <tr style={{ background: 'var(--bg-surface-secondary)' }}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Variable</td>
                    <td colSpan={5}></td>
                  </tr>
                  {seniorBreakdown.variableComponents.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" className="input" value={c.annualAmount} onChange={(e) => handleSeniorComponentChange('variableComponents', i, 'annualAmount', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" className="input" value={c.monthlyAmount} onChange={(e) => handleSeniorComponentChange('variableComponents', i, 'monthlyAmount', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-primary)' }}>{c.frequency}</td>
                      <td>
                        <textarea className="textarea" value={c.remarks} onChange={(e) => handleSeniorComponentChange('variableComponents', i, 'remarks', e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', minHeight: '36px', resize: 'vertical' }} placeholder="Remarks..." />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" className="input" value={c.currentAmount} onChange={(e) => handleSeniorComponentChange('variableComponents', i, 'currentAmount', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                      </td>
                    </tr>
                  ))}

                  <tr className="salary-row-total">
                    <td style={{ fontWeight: '600', color: 'var(--salary-total-text)' }}>Effective Compensation</td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--salary-total-text)' }}>
                      {[...seniorBreakdown.fixedComponents, ...seniorBreakdown.variableComponents].reduce((s, c) => s + c.annualAmount, 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--salary-total-text)' }}>
                      {[...seniorBreakdown.fixedComponents, ...seniorBreakdown.variableComponents].reduce((s, c) => s + c.monthlyAmount, 0).toLocaleString('en-IN')}
                    </td>
                    <td colSpan={2}></td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--salary-total-text)' }}>
                      {[...seniorBreakdown.fixedComponents, ...seniorBreakdown.variableComponents].reduce((s, c) => s + c.currentAmount, 0).toLocaleString('en-IN')}
                    </td>
                  </tr>

                  <tr style={{ background: 'var(--bg-surface-secondary)' }}>
                    <td colSpan={5} style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>TDS</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={seniorBreakdown.tds} onChange={(e) => handleSeniorFieldChange('tds', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                    </td>
                  </tr>

                  <tr className="salary-row-travel">
                    <td style={{ fontWeight: '600', color: 'var(--salary-travel-text)' }}>Travel Reimbursement</td>
                    <td colSpan={4}></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={seniorBreakdown.travelReimbursement} onChange={(e) => handleSeniorFieldChange('travelReimbursement', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px', background: 'transparent', color: 'var(--salary-travel-text)' }} />
                    </td>
                  </tr>

                  <tr className="salary-row-bank">
                    <td style={{ fontWeight: '600', color: 'var(--salary-bank-text)' }}>Net Salary Payable</td>
                    <td colSpan={4}></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={seniorBreakdown.bankTransfer} onChange={(e) => handleSeniorFieldChange('bankTransfer', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px', fontWeight: '600', background: 'transparent', color: 'var(--salary-bank-text)' }} />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="salary-footer-notes">
                <p>* QPR is Paid out Quarterly</p>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-primary" onClick={handleGenerateSingle} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate PDF'}
                </button>
              </div>
            </div>
          </div>
        ) : breakdown ? (
          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <div className="salary-preview-grid">
                    <span className="salary-preview-label">Employee Name</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{breakdown.employeeName}</span>
                    <span className="salary-preview-label">Designation</span>
                    <input
                      className="input"
                      value={breakdown.designation}
                      onChange={(e) => handleBreakdownChange('designation', e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '14px' }}
                    />
                    <span className="salary-preview-label">Employee Code</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{breakdown.employeeCode}</span>
                    <span className="salary-preview-label">PAN No.</span>
                    <input
                      className="input"
                      value={breakdown.panNumber}
                      onChange={(e) => handleBreakdownChange('panNumber', e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '14px', width: '140px' }}
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>Current Salary</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px auto', gap: '4px 12px', fontSize: '14px', textAlign: 'left' }}>
                    <span className="salary-preview-label">Period*</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{breakdown.period}</span>
                    <span className="salary-preview-label">Days in Period</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{breakdown.daysInPeriod}</span>
                    <span className="salary-preview-label">Year</span>
                    <span className="salary-preview-value" style={{ color: 'var(--text-primary)' }}>{breakdown.financialYear}</span>
                  </div>
                </div>
              </div>

              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}></th>
                    <th style={{ textAlign: 'center', width: '100px' }}>Annual CTC</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Per Month</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>For Current Period</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Frequency</th>
                    <th style={{ width: '200px' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'var(--bg-surface-secondary)' }}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Fixed</td>
                    <td colSpan={5}></td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--text-primary)' }}>Basic Salary incl Travel</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={breakdown.annualBase} onChange={(e) => handleBreakdownChange('annualBase', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={breakdown.monthlyBase} onChange={(e) => handleBreakdownChange('monthlyBase', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={breakdown.currentBase} onChange={(e) => handleBreakdownChange('currentBase', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-primary)' }}>Monthly</td>
                    <td>
                      <textarea className="textarea" value={breakdown.baseRemarks} onChange={(e) => handleBreakdownChange('baseRemarks', e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', minHeight: '48px', resize: 'vertical' }} placeholder="Remarks..." />
                    </td>
                  </tr>

                  <tr style={{ background: 'var(--bg-surface-secondary)' }}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Variable</td>
                    <td colSpan={5}></td>
                  </tr>
                  <tr>
                    <td style={{ color: 'var(--text-primary)' }}>Quarterly Performance Reward<br /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Linked to BSC*</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={breakdown.annualBonus} onChange={(e) => handleBreakdownChange('annualBonus', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={breakdown.monthlyBonus} onChange={(e) => handleBreakdownChange('monthlyBonus', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input className="input" value={breakdown.currentBonus} onChange={(e) => handleBreakdownChange('currentBonus', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} placeholder="-" />
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-primary)' }}>Quarterly</td>
                    <td>
                      <textarea className="textarea" value={breakdown.bonusRemarks} onChange={(e) => handleBreakdownChange('bonusRemarks', e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', minHeight: '48px', resize: 'vertical' }} />
                    </td>
                  </tr>

                  <tr className="salary-row-total">
                    <td style={{ fontWeight: '600', color: 'var(--salary-total-text)' }}>Monthly</td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--salary-total-text)' }}>{breakdown.annualCTC.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--salary-total-text)' }}>{breakdown.monthlyCTC.toLocaleString('en-IN')}</td>
                    <td colSpan={3}></td>
                  </tr>

                  <tr className="salary-row-travel">
                    <td style={{ color: 'var(--salary-travel-text)' }}>% Change</td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--salary-travel-text)' }}>Travel Reimbursements</td>
                    <td colSpan={2}></td>
                    <td></td>
                    <td>
                      <textarea className="textarea" value={breakdown.travelRemarks} onChange={(e) => handleBreakdownChange('travelRemarks', e.target.value)} style={{ width: '100%', padding: '4px 8px', fontSize: '12px', minHeight: '48px', resize: 'vertical', background: 'transparent', border: 'none', color: 'var(--salary-travel-text)' }} />
                    </td>
                  </tr>

                  <tr className="salary-row-bank">
                    <td></td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--salary-bank-text)' }}>Bank Trf</td>
                    <td></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="input" value={breakdown.bankTransfer} onChange={(e) => handleBreakdownChange('bankTransfer', parseInt(e.target.value) || 0)} style={{ width: '90px', textAlign: 'center', padding: '4px', fontWeight: '600', background: 'transparent', color: 'var(--salary-bank-text)' }} />
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>

              <div className="salary-footer-notes">
                <p>* QPR is Paid out Quarterly</p>
                <p>** Full course work cost of intern under PAI, New York Program over 12-18 months.</p>
                <p style={{ fontStyle: 'italic' }}>*** Studio travel claim approved for staff for any day with inter studio travel/ 2nd studio visit for day/ visit to external location for workshops etc</p>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-primary" onClick={handleGenerateSingle} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate PDF'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body empty-state">
              Select a trainer to preview and edit their salary breakdown.
            </div>
          </div>
        )
      ))}

      {/* ===== PER-CLASS TAB ===== */}
      {activeTab === 'per_class' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total Trainers', value: pcTotalTrainers, color: 'var(--accent-indigo)' },
              { label: 'Total Gross', value: formatCurrency(pcTotalGross), color: 'var(--accent-green)' },
              { label: 'Pending Confirmation', value: pcPendingConfirmation, color: 'var(--accent-amber)' },
              { label: 'Confirmed', value: pcConfirmed, color: 'var(--accent-green)' },
            ].map((c) => (
              <div className="card stat-card" key={c.label} style={{ borderLeftColor: c.color }}>
                <div className="card-body">
                  <p className="stat-card-title">{c.label}</p>
                  <p className="stat-card-value" style={{ fontSize: '1.375rem' }}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {pcLoading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p className="text-muted">Loading...</p>
            </div>
          ) : (
            <div className="card">
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trainer</th>
                      <th style={{ textAlign: 'right' }}>Sessions</th>
                      <th style={{ textAlign: 'right' }}>Gross Billing</th>
                      <th style={{ textAlign: 'right' }}>TDS</th>
                      <th style={{ textAlign: 'right' }}>Net Payout</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcStatements.map((s) => (
                      <tr key={s._id}>
                        <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{s.trainerName}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{s.totalSessions}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(s.grossBilling)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(s.tds)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(s.netPayout)}</td>
                        <td>
                          <span className={`pc-status-badge ${s.status}`}>
                            {PC_STATUS_LABELS[s.status] || s.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {s.status === 'payout_sent' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => s._id && handlePcStatusUpdate(s._id, 'paid')}
                            >
                              Mark Paid
                            </button>
                          )}
                          {s.logsDraftUrl && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => window.open(s.logsDraftUrl, '_blank')}
                              style={{ marginLeft: '4px' }}
                            >
                              Draft
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {pcStatements.length === 0 && (
                      <tr><td colSpan={7} className="empty-state">No per-class statements for this month.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== PER-CLASS TAB ===== */}
      {activeTab === 'per_class' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Trainers', value: pcTotalTrainers, color: 'var(--accent-indigo)' },
              { label: 'Gross Billing', value: formatCurrency(pcTotalGross), color: 'var(--accent-green)' },
              { label: 'Pending Confirmation', value: pcPendingConfirmation, color: 'var(--accent-amber)' },
              { label: 'Confirmed', value: pcConfirmed, color: 'var(--accent-green)' },
            ].map((c) => (
              <div className="card stat-card" key={c.label} style={{ borderLeftColor: c.color }}>
                <div className="card-body">
                  <p className="stat-card-title">{c.label}</p>
                  <p className="stat-card-value" style={{ fontSize: '1.375rem' }}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {pcLoading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p className="text-muted">Loading per-class statements...</p>
            </div>
          ) : (
            <div className="card">
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Trainer</th>
                      <th style={{ textAlign: 'center' }}>Sessions</th>
                      <th style={{ textAlign: 'right' }}>Gross Billing</th>
                      <th style={{ textAlign: 'right' }}>TDS</th>
                      <th style={{ textAlign: 'right' }}>Net Payout</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcStatements.map((s) => (
                      <tr key={s._id}>
                        <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{s.trainerName}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-primary)' }}>{s.totalSessions}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-primary)' }}>{formatCurrency(s.grossBilling)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(s.tds)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(s.netPayout)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`pc-status-badge pc-status-${s.status}`}>
                            {PC_STATUS_LABELS[s.status] || s.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {s.status === 'confirmed' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handlePcStatusUpdate(s._id!, 'paid')}
                              style={{ fontSize: '12px', padding: '2px 8px' }}
                            >
                              Mark Paid
                            </button>
                          )}
                          {s.status === 'payout_sent' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handlePcStatusUpdate(s._id!, 'paid')}
                              style={{ fontSize: '12px', padding: '2px 8px' }}
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {pcStatements.length === 0 && (
                      <tr><td colSpan={7} className="empty-state">No per-class statements for this month. Click "Send Log Summaries" to generate.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={genModal} onClose={() => setGenModal(false)} title="Generate Salary PDFs">
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          This will calculate salaries for all active trainers for the selected month and generate PDF statements. Use "Create Drafts" afterwards to prepare Gmail drafts.
        </p>
        <div className="form-group">
          <label className="form-label">Month</label>
          <MonthPicker
            value={genMonth}
            onChange={setGenMonth}
          />
          {(() => {
            const [y, m] = genMonth.split('-').map(Number);
            const genDate = new Date(y, m - 1);
            const nowDate = new Date(now.getFullYear(), now.getMonth());
            if (genDate > nowDate) {
              return (
                <p style={{ color: 'var(--accent-amber)', fontSize: '13px', marginTop: '8px' }}>
                  This is a future month. Bonus data may not be finalized yet.
                </p>
              );
            }
            return null;
          })()}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={() => setGenModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate PDFs'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
