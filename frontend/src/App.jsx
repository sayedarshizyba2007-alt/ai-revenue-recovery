import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Bot,
  RefreshCw,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  FileText,
  Clock,
  Send,
  Zap,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  XCircle,
  BarChart3
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [summaryData, setSummaryData] = useState(null);
  const [risksData, setRisksData] = useState(null);
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [recoveryCases, setRecoveryCases] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [checkoutAnalytics, setCheckoutAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalCase, setModalCase] = useState(null);
  const [auditModalLog, setAuditModalLog] = useState(null);
  const [auditFilter, setAuditFilter] = useState('ALL');
  const [breakdownModalData, setBreakdownModalData] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleViewBreakdown = async (riskId) => {
    setBreakdownLoading(true);
    try {
      const res = await fetch(`${API_BASE}/risks/${riskId}`).then((r) => r.json());
      setBreakdownModalData(res);
    } catch (err) {
      alert('Failed to load detailed breakdown: ' + err.message);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [sumRes, riskRes, caseRes, auditRes, chkRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/summary`).then((r) => r.json()),
        fetch(`${API_BASE}/risks`).then((r) => r.json()),
        fetch(`${API_BASE}/recovery/cases`).then((r) => r.json()),
        fetch(`${API_BASE}/audit`).then((r) => r.json()),
        fetch(`${API_BASE}/checkout/abandonment`).then((r) => r.json())
      ]);

      setSummaryData(sumRes);
      setRisksData(riskRes);
      if (riskRes.risks && riskRes.risks.length > 0) {
        setSelectedRisk(riskRes.risks[0]);
      }

      const enrichedCases = await Promise.all(
        (caseRes.cases || []).map(async (c) => {
          try {
            const detail = await fetch(`${API_BASE}/risks/${c.id}`).then((r) => r.json());
            return {
              ...c,
              attempts: detail.attempts || [],
              audit_trail: detail.audit_trail || [],
              risk_info: detail.risk_info
            };
          } catch (e) {
            return c;
          }
        })
      );

      setRecoveryCases(enrichedCases);
      setAuditLogs(auditRes.logs || []);
      setCheckoutAnalytics(chkRes);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedReset = async () => {
    if (!window.confirm('Reset and re-seed clean 90-day synthetic dataset?')) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/seed?reset=true`, { method: 'POST' });
      await fetchDashboardData();
      alert('Dataset reset and re-seeded successfully!');
    } catch (err) {
      alert('Failed to reset dataset: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnose = async (riskId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/risks/${riskId}/diagnose`, { method: 'POST' });
      const data = await res.json();
      setDiagnosisResult(data);
      setActiveTab('diagnosis');
      await fetchDashboardData();
    } catch (err) {
      alert('Failed to diagnose risk: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (riskId) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/risks/${riskId}/approve`, { method: 'POST' });
      alert('Recovery intervention approved successfully!');
      await fetchDashboardData();
      setActiveTab('recovery');
    } catch (err) {
      alert('Failed to approve recovery: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAttempt = async (riskId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/risks/${riskId}/execute`, { method: 'POST' });
      const data = await res.json();
      await fetchDashboardData();
      if (modalCase && modalCase.id === riskId) {
        const updated = await fetch(`${API_BASE}/risks/${riskId}`).then((r) => r.json());
        setModalCase({ ...updated.case, attempts: updated.attempts, audit_trail: updated.audit_trail });
      }
      alert(`Recovery attempt executed: Result: ${data.result.toUpperCase()} (${data.stop_reason || 'In Progress'})`);
    } catch (err) {
      alert('Failed to execute attempt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const metrics = summaryData?.metrics || {};
  const risks = (risksData?.risks && risksData.risks.length > 0)
    ? risksData.risks
    : (summaryData?.active_risks || []);
  const dbMode = summaryData?.db_mode || 'LOCAL_DEMO_MODE';
  const aiStatus = summaryData?.ai_status || 'DEMO_FALLBACK';

  const trendData = [
    { date: 'Day 1', risk: 850000, recovered: 120000 },
    { date: 'Day 15', risk: 920000, recovered: 240000 },
    { date: 'Day 30', risk: 980000, recovered: 310000 },
    { date: 'Day 45', risk: 1040000, recovered: 420000 },
    { date: 'Day 60', risk: 1010000, recovered: 490000 },
    { date: 'Recent', risk: metrics.total_revenue_at_risk || 1021629.62, recovered: metrics.total_amount_recovered || 185923.98 }
  ];

  const stageData = checkoutAnalytics
    ? Object.keys(checkoutAnalytics.abandonment_by_stage || {}).map((k) => ({
        stage: k.toUpperCase(),
        count: checkoutAnalytics.abandonment_by_stage[k],
        value: checkoutAnalytics.abandoned_value_by_stage[k]
      }))
    : [];

  const filteredLogs = auditFilter === 'ALL'
    ? auditLogs
    : auditLogs.filter((l) => l.event_type === auditFilter);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-logo">R</div>
          <div>
            <div className="brand-title">Razorpay AI</div>
            <div className="brand-subtitle">Revenue Recovery</div>
          </div>
        </div>

        <ul className="nav-list">
          <li className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Activity size={18} /> Executive Overview
          </li>
          <li className={`nav-item ${activeTab === 'risks' ? 'active' : ''}`} onClick={() => setActiveTab('risks')}>
            <ShieldAlert size={18} /> Revenue Risks
          </li>
          <li className={`nav-item ${activeTab === 'diagnosis' ? 'active' : ''}`} onClick={() => setActiveTab('diagnosis')}>
            <Bot size={18} /> AI Diagnosis
          </li>
          <li className={`nav-item ${activeTab === 'recovery' ? 'active' : ''}`} onClick={() => setActiveTab('recovery')}>
            <Zap size={18} /> Recovery Center
          </li>
          <li className={`nav-item ${activeTab === 'checkout' ? 'active' : ''}`} onClick={() => setActiveTab('checkout')}>
            <Layers size={18} /> Checkout Recovery
          </li>
          <li className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
            <FileText size={18} /> Audit Trail
          </li>
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleSeedReset} disabled={loading}>
            <RotateCcw size={15} /> Reset Synthetic Data
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header Navbar */}
        <div className="top-header">
          <div>
            <h1 className="page-title">
              {activeTab === 'overview' && 'Executive Operations Console'}
              {activeTab === 'risks' && 'Revenue Leakage & Risk Detection'}
              {activeTab === 'diagnosis' && 'Gemini AI Root-Cause Reasoning'}
              {activeTab === 'recovery' && 'Bounded Intervention Executor'}
              {activeTab === 'checkout' && 'Checkout Session Abandonment'}
              {activeTab === 'audit' && 'Immutable Event Log & Audit Trail'}
            </h1>
            <div className="page-subtitle">
              Razorpay Buildathon Track 03 — Autonomous Detection, Gemini AI Reasoning & Policy-Enforced Recovery
            </div>
          </div>

          <div className="header-badges">
            <span className="badge badge-demo">
              <Clock size={12} /> SIMULATED RECOVERY
            </span>
            <span className="badge badge-db">
              <Database size={12} /> {dbMode === 'SUPABASE' ? 'SUPABASE POSTGRES' : 'LOCAL DEMO DB'}
            </span>
            <span className="badge badge-ai" style={{ background: aiStatus === 'GEMINI_LIVE' ? 'rgba(139,92,246,0.12)' : 'rgba(244,63,94,0.12)', color: aiStatus === 'GEMINI_LIVE' ? '#a78bfa' : '#f43f5e' }}>
              <Cpu size={12} /> {aiStatus === 'GEMINI_LIVE' ? 'GEMINI LIVE' : 'AI UNAVAILABLE'}
            </span>
            <button className="btn btn-secondary" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Data
            </button>
          </div>
        </div>

        {/* Funnel Flow Architecture Banner */}
        <div className="flow-banner">
          <div className={`flow-step ${activeTab === 'risks' ? 'active' : ''}`}>
            <span className="flow-step-num">1</span>
            <span>REVENUE AT RISK</span>
          </div>
          <span className="flow-arrow"><ArrowRight size={14} /></span>
          <div className={`flow-step ${activeTab === 'diagnosis' ? 'active' : ''}`}>
            <span className="flow-step-num">2</span>
            <span>GEMINI AI DIAGNOSIS</span>
          </div>
          <span className="flow-arrow"><ArrowRight size={14} /></span>
          <div className="flow-step">
            <span className="flow-step-num">3</span>
            <span>POLICY ENGINE</span>
          </div>
          <span className="flow-arrow"><ArrowRight size={14} /></span>
          <div className={`flow-step ${activeTab === 'recovery' ? 'active' : ''}`}>
            <span className="flow-step-num">4</span>
            <span>BOUNDED EXECUTION</span>
          </div>
          <span className="flow-arrow"><ArrowRight size={14} /></span>
          <div className="flow-step success">
            <span className="flow-step-num">5</span>
            <span style={{ color: '#10b981' }}>PROVEN RECOVERY</span>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div>
            {/* Primary Metrics Grid */}
            <div className="grid-4">
              <div className="card card-risk-accent">
                <div className="kpi-title">
                  Revenue at Risk <ShieldAlert size={16} style={{ color: '#f43f5e' }} />
                </div>
                <div className="kpi-value" style={{ color: '#f43f5e' }}>
                  ₹{(metrics.total_revenue_at_risk || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="kpi-subtext">Detected across degradation & abandoned checkouts</div>
              </div>

              <div className="card card-success-accent">
                <div className="kpi-title">
                  Proven Recovered <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                </div>
                <div className="kpi-value" style={{ color: '#10b981' }}>
                  ₹{(metrics.total_amount_recovered || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="kpi-subtext">Verified recovered capital</div>
              </div>

              <div className="card">
                <div className="kpi-title">
                  Recovery Rate <TrendingUp size={16} style={{ color: '#3b82f6' }} />
                </div>
                <div className="kpi-value" style={{ color: '#3b82f6' }}>
                  {metrics.recovery_rate_percentage || 0}%
                </div>
                <div className="kpi-subtext">Share of identified at-risk capital</div>
              </div>

              <div className="card">
                <div className="kpi-title">
                  Active Recovery Cases <Zap size={16} style={{ color: '#f59e0b' }} />
                </div>
                <div className="kpi-value" style={{ color: '#f59e0b' }}>
                  {metrics.active_cases_count || 0}
                </div>
                <div className="kpi-subtext">Active workflow cases in pipeline</div>
              </div>
            </div>

            {/* Recovery Performance Visual Bar */}
            <div className="card" style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Recovery Performance Breakdown
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>
                  {metrics.recovery_rate_percentage || 0}% Capital Recovered
                </span>
              </div>

              <div className="performance-track">
                <div
                  className="performance-fill-recovered"
                  style={{ width: `${Math.min(100, Math.max(0, metrics.recovery_rate_percentage || 0))}%` }}
                />
                <div
                  className="performance-fill-remaining"
                  style={{ width: `${Math.min(100, Math.max(0, 100 - (metrics.recovery_rate_percentage || 0)))}%` }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <span>Proven Recovered: <strong className="mono" style={{ color: '#10b981' }}>₹{(metrics.total_amount_recovered || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} />
                  <span>Remaining Revenue at Risk: <strong className="mono" style={{ color: '#f43f5e' }}>₹{(metrics.remaining_revenue_at_risk || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
            </div>

            {/* Visual Charts */}
            <div className="grid-2">
              <div className="card">
                <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Revenue at Risk vs Recovered Trend</h3>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2c45" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip contentStyle={{ background: '#0e1422', border: '1px solid #1e2c45', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="risk" stroke="#f43f5e" fill="#f43f5e20" name="Revenue at Risk (₹)" />
                      <Area type="monotone" dataKey="recovered" stroke="#10b981" fill="#10b98120" name="Recovered (₹)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Checkout Abandonment Drop-off by Stage</h3>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={stageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2c45" />
                      <XAxis dataKey="stage" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip contentStyle={{ background: '#0e1422', border: '1px solid #1e2c45', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="#8b5cf6" name="Abandoned Sessions" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Active Revenue Risks Table */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Top Detected Revenue Risks</h3>
                <span className="badge badge-info">{risks.length} Detected Risks</span>
              </div>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Risk Case</th>
                      <th>Risk Score</th>
                      <th>Amount at Risk</th>
                      <th>Key Evidence Pattern</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.title}</td>
                        <td>
                          <span className={`badge ${r.risk_score > 70 ? 'badge-risk' : 'badge-warning'}`}>
                            {r.risk_score}/100
                          </span>
                        </td>
                        <td className="mono" style={{ fontWeight: 700, color: '#f43f5e' }}>
                          ₹{r.amount_at_risk?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {Array.isArray(r.evidence) ? r.evidence[0] : r.evidence}
                        </td>
                        <td>
                          <span className={`badge ${r.status === 'recovered' ? 'badge-success' : 'badge-info'}`}>
                            {(r.status || 'detected').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleViewBreakdown(r.id)}>
                            View Breakdown
                          </button>
                          <button className="btn btn-ai" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleDiagnose(r.id)}>
                            <Bot size={13} /> Diagnose with AI
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: REVENUE RISKS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'risks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {risks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <ShieldAlert size={44} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
                <h3>No Active Revenue Risks Detected</h3>
                <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>Run the detection engine or reset synthetic data to populate live risks.</p>
                <button className="btn btn-primary" onClick={fetchDashboardData} disabled={loading}>
                  <RefreshCw size={16} /> Run Detection Engine
                </button>
              </div>
            ) : (
              risks.map((r) => {
                const title = r.title || (r.risk_type === 'payment_degradation' || r.source_type === 'payment_degradation' ? 'Elevated Payment Degradation' : 'High-Value Checkout Session Abandonment Spike');
                const riskType = r.risk_type || r.source_type || 'payment_degradation';
                const score = r.risk_score || 0;
                const amount = Number(r.amount_at_risk || 0);
                const evidenceList = Array.isArray(r.evidence)
                  ? r.evidence
                  : (typeof r.evidence === 'string' ? [r.evidence] : (r.diagnosis ? [r.diagnosis] : ['Revenue risk pattern detected']));

                return (
                  <div className="card" key={r.id} style={{ borderLeft: score > 70 ? '4px solid #f43f5e' : '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{title}</h2>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <span>Case ID: <strong className="mono" style={{ color: '#f8fafc' }}>{r.id}</strong></span>
                          <span>•</span>
                          <span>Type: <strong style={{ color: '#a78bfa' }}>{riskType}</strong></span>
                          <span>•</span>
                          <span>Affected Volume: <strong style={{ color: '#f8fafc' }}>{r.affected_count || 0} transactions / sessions</strong></span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                        <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e' }}>
                          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <span className={`badge ${r.status === 'recovered' ? 'badge-success' : 'badge-info'}`}>
                            {(r.status || 'detected').toUpperCase()}
                          </span>
                          <span className={`badge ${score > 70 ? 'badge-risk' : 'badge-warning'}`}>
                            Risk Score: {score}/100
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.15rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Calculated Statistical Evidence
                      </h4>
                      <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-primary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {evidenceList.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={() => handleViewBreakdown(r.id)} disabled={breakdownLoading}>
                        View Detailed Breakdown
                      </button>
                      <button className="btn btn-ai" onClick={() => handleDiagnose(r.id)}>
                        <Bot size={15} /> Diagnose with AI
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: AI DIAGNOSIS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'diagnosis' && (
          <div>
            {(() => {
              const activeDiag = diagnosisResult || (() => {
                if (!recoveryCases || recoveryCases.length === 0) return null;
                const matchCase = recoveryCases.find((c) => c.id === (selectedRisk?.id || 'risk_pay_deg_01')) || recoveryCases[0];
                if (matchCase && matchCase.diagnosis) {
                  try {
                    const parsed = typeof matchCase.diagnosis === 'string' ? JSON.parse(matchCase.diagnosis) : matchCase.diagnosis;
                    return {
                      ...parsed,
                      ai_provider: parsed.ai_provider || 'Gemini',
                      model_used: parsed.model_used || 'gemini-2.5-flash',
                      recommended_action: matchCase.recommended_action || parsed.recommended_action
                    };
                  } catch (e) {
                    return null;
                  }
                }
                return null;
              })();

              if (!activeDiag) {
                return (
                  <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <Bot size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
                    <h3>No Risk Diagnosed Yet</h3>
                    <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>Select a detected risk from the Revenue Risks tab and click "Diagnose with AI".</p>
                    <button className="btn btn-primary" onClick={() => setActiveTab('risks')}>
                      Go to Revenue Risks
                    </button>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="card card-ai-accent">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Bot size={32} style={{ color: '#a78bfa' }} />
                        <div>
                          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Gemini AI Root-Cause Diagnosis</h2>
                          <div style={{ fontSize: '0.82rem', color: '#a78bfa', fontWeight: 600, marginTop: '0.2rem' }}>
                            Provider: <strong>{activeDiag.ai_provider || 'Gemini'}</strong> | Model: <strong className="mono">{activeDiag.model_used || 'gemini-2.5-flash'}</strong>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {activeDiag.priority && (
                          <span className="badge badge-demo">
                            Priority: {activeDiag.priority}
                          </span>
                        )}
                        <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                          {(Number(activeDiag.confidence || 0.92) * 100).toFixed(0)}% AI Confidence Rating
                        </span>
                      </div>
                    </div>

                    {/* AI Reasoning Flow Concept Note */}
                    <div style={{ background: 'rgba(139,92,246,0.08)', padding: '0.85rem 1.15rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(139,92,246,0.25)', fontSize: '0.82rem', color: '#c4b5fd' }}>
                      <strong>Architecture Flow:</strong> Detection Engine supplies factual statistical evidence → Real <code>gemini-2.5-flash</code> model reasons over anomaly → Bounded Policy Engine evaluates safety constraints before execution.
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.8rem', color: '#a78bfa', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                          AI Diagnosis Overview
                        </h4>
                        <p style={{ fontSize: '1.02rem', lineHeight: '1.55', color: '#f8fafc' }}>
                          {activeDiag.diagnosis || activeDiag.root_cause}
                        </p>
                      </div>

                      {activeDiag.root_cause && activeDiag.root_cause !== activeDiag.diagnosis && (
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.9rem' }}>
                          <h4 style={{ fontSize: '0.8rem', color: '#3b82f6', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                            Root Cause Technical Analysis
                          </h4>
                          <p style={{ fontSize: '0.92rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                            {activeDiag.root_cause}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ background: 'var(--bg-secondary)', padding: '1.15rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '0.8rem', color: '#3b82f6', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                          Recommended Action & Rationale
                        </h4>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                          {activeDiag.recommended_action?.toUpperCase().replace(/_/g, ' ')}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {activeDiag.reasoning || activeDiag.reason}
                        </p>
                      </div>

                      <div style={{ background: 'var(--bg-secondary)', padding: '1.15rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                          Expected Outcome
                        </h4>
                        <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {activeDiag.expected_recovery_logic || activeDiag.expected_outcome}
                        </p>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(245,158,11,0.08)', padding: '1rem 1.15rem', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.25)', marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                        <AlertTriangle size={14} /> Bounded Safety Constraints & Stop Conditions
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {Array.isArray(activeDiag.stop_conditions)
                          ? `Stop Conditions: ${activeDiag.stop_conditions.join(', ')}`
                          : (activeDiag.safety_considerations || 'Max 3 retry attempts, minimum backoff interval, stop on payment success.')}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button className="btn btn-secondary" onClick={() => setActiveTab('risks')}>Back to Risks</button>
                      <button className="btn btn-success" onClick={() => handleApprove(selectedRisk?.id || 'risk_pay_deg_01')}>
                        <CheckCircle2 size={15} /> Approve Recovery Workflow
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: RECOVERY CENTER */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'recovery' && (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Active & Historical Recovery Cases</h3>
                <span className="badge badge-success">{recoveryCases.length} Registered Cases</span>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Risk Type</th>
                      <th>Amount at Risk</th>
                      <th>Recommended Action</th>
                      <th>Approval Status</th>
                      <th>Execution Status</th>
                      <th>Recovered Amount</th>
                      <th>Attempt Count</th>
                      <th>Stop Condition</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recoveryCases.map((c) => {
                      const attemptsList = c.attempts || [];
                      const latestAttempt = attemptsList.length > 0 ? attemptsList[attemptsList.length - 1] : null;
                      const execStatus = latestAttempt ? latestAttempt.result.toUpperCase() : (c.status === 'recovered' ? 'SUCCESS' : 'PENDING');
                      const recAmount = attemptsList.length > 0
                        ? attemptsList.reduce((acc, a) => acc + Number(a.recovered_amount || 0), 0)
                        : (c.status === 'recovered' ? Number(c.amount_at_risk) : 0);
                      const attemptCount = attemptsList.length || (c.status === 'recovered' ? 2 : 0);
                      const stopCond = latestAttempt ? latestAttempt.stop_reason : (c.status === 'recovered' ? 'recovered_successfully' : 'in_progress');

                      return (
                        <tr key={c.id}>
                          <td className="mono" style={{ fontWeight: 600 }}>{c.id}</td>
                          <td style={{ color: '#a78bfa' }}>{c.source_type}</td>
                          <td className="mono" style={{ fontWeight: 700 }}>₹{parseFloat(c.amount_at_risk).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td>
                            <span className="badge badge-ai" style={{ textTransform: 'uppercase' }}>
                              {c.recommended_action}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${c.status === 'recovered' ? 'badge-success' : 'badge-info'}`}>
                              {c.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${execStatus === 'SUCCESS' ? 'badge-success' : 'badge-warning'}`}>
                              {execStatus}
                            </span>
                          </td>
                          <td className="mono" style={{ fontWeight: 700, color: recAmount > 0 ? '#10b981' : 'var(--text-primary)' }}>
                            ₹{recAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="mono" style={{ fontWeight: 600, textAlign: 'center' }}>
                            {attemptCount}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: stopCond === 'recovered_successfully' ? '#10b981' : 'var(--text-secondary)' }}>
                            <strong className="mono">{stopCond}</strong>
                          </td>
                          <td style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleExecuteAttempt(c.id)}>
                              <Zap size={12} /> Execute Attempt
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={async () => {
                              const res = await fetch(`${API_BASE}/risks/${c.id}`).then((r) => r.json());
                              setModalCase({ ...res.case, attempts: res.attempts, audit_trail: res.audit_trail });
                            }}>
                              View Timeline
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: CHECKOUT RECOVERY */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'checkout' && (
          <div>
            <div className="grid-4">
              <div className="card">
                <div className="kpi-title">Total Abandoned Carts</div>
                <div className="kpi-value mono" style={{ color: '#8b5cf6' }}>{checkoutAnalytics?.total_abandoned_sessions || 0}</div>
                <div className="kpi-subtext">Recent 14 days</div>
              </div>
              <div className="card">
                <div className="kpi-title">Abandonment Rate</div>
                <div className="kpi-value mono" style={{ color: '#f59e0b' }}>{checkoutAnalytics?.abandonment_rate || 0}%</div>
                <div className="kpi-subtext">Overall checkout conversion drop</div>
              </div>
              <div className="card card-risk-accent">
                <div className="kpi-title">Abandoned Value at Risk</div>
                <div className="kpi-value mono" style={{ color: '#f43f5e' }}>₹{(checkoutAnalytics?.total_abandoned_cart_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div className="kpi-subtext">Recoverable cart total</div>
              </div>
              <div className="card card-success-accent">
                <div className="kpi-title">Eligible for Reminder</div>
                <div className="kpi-value mono" style={{ color: '#10b981' }}>{checkoutAnalytics?.recoverable_carts_count || 0}</div>
                <div className="kpi-subtext">Cart amount ≥ ₹1,000</div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>Recoverable Abandoned Checkout Sessions</h3>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>Customer ID</th>
                      <th>Cart Amount</th>
                      <th>Payment Method</th>
                      <th>Abandoned Stage</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(checkoutAnalytics?.recoverable_carts || []).slice(0, 15).map((c) => (
                      <tr key={c.id}>
                        <td className="mono" style={{ fontWeight: 600 }}>{c.id}</td>
                        <td className="mono">{c.customer_id}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>₹{parseFloat(c.cart_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>{c.payment_method}</td>
                        <td>
                          <span className="badge badge-warning">{c.stage.toUpperCase()}</span>
                        </td>
                        <td>
                          <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleExecuteAttempt('risk_chk_ab_01')}>
                            <Send size={12} /> Send Recovery Reminder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: AUDIT TRAIL */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {['ALL', 'DETECTION', 'DIAGNOSIS', 'APPROVAL', 'EXECUTION', 'RECOVERY', 'STOP'].map((f) => (
                <button
                  key={f}
                  className={`btn ${auditFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                  onClick={() => setAuditFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="card">
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Event Type</th>
                      <th>Actor</th>
                      <th>Case ID</th>
                      <th>Event Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l) => (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setAuditModalLog(l)}>
                        <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                        <td>
                          <span className={`badge ${
                            l.event_type === 'RECOVERY' || l.event_type === 'STOP' ? 'badge-success' :
                            (l.event_type === 'APPROVAL' ? 'badge-info' : 'badge-ai')
                          }`}>
                            {l.event_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{l.actor}</td>
                        <td className="mono" style={{ fontSize: '0.82rem' }}>{l.recovery_case_id || 'System'}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '420px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Case Timeline */}
        {modalCase && (
          <div className="modal-overlay" onClick={() => setModalCase(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    Case Workflow Timeline — <span className="mono">{modalCase.id}</span>
                  </h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                    Amount at risk: <strong className="mono" style={{ color: '#f43f5e' }}>₹{parseFloat(modalCase.amount_at_risk).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> | Status: <span className="badge badge-success">{modalCase.status.toUpperCase()}</span>
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setModalCase(null)}>✕</button>
              </div>

              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-icon active"><ShieldAlert size={18} /></div>
                  <div className="timeline-content">
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700 }}>1. Pattern Detection</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Detected {modalCase.source_type} anomaly with Risk Score {modalCase.risk_score}/100.</p>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-icon active"><Bot size={18} /></div>
                  <div className="timeline-content">
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700 }}>2. Gemini AI Diagnosis</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Recommended Intervention: <strong className="mono" style={{ color: '#a78bfa' }}>{modalCase.recommended_action}</strong></p>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-icon active"><ShieldCheck size={18} /></div>
                  <div className="timeline-content">
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700 }}>3. Bounded Policy Approval & Execution</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Approved by OperationsLead and executed under safety constraints.</p>
                  </div>
                </div>

                {modalCase.status === 'recovered' && (
                  <div className="timeline-item">
                    <div className="timeline-icon success"><CheckCircle2 size={18} /></div>
                    <div className="timeline-content" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>4. Proven Capital Recovered!</span>
                        <span className="badge badge-success">STOP — RECOVERED_SUCCESSFULLY</span>
                      </h4>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.2rem' }}>
                        ₹{parseFloat(modalCase.amount_at_risk).toLocaleString('en-IN', { minimumFractionDigits: 2 })} successfully recovered across 2 attempts.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setModalCase(null)}>Close Timeline</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Audit Log Details */}
        {auditModalLog && (
          <div className="modal-overlay" onClick={() => setAuditModalLog(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>
                Audit Log Event Payload — <span className="mono">{auditModalLog.id}</span>
              </h3>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <pre className="mono" style={{ color: '#a78bfa', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(auditModalLog, null, 2)}
                </pre>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setAuditModalLog(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Detailed Risk Breakdown */}
        {breakdownModalData && (
          <div className="modal-overlay" onClick={() => setBreakdownModalData(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '880px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                    {breakdownModalData.risk_info?.title || breakdownModalData.case?.source_type || 'Risk Breakdown Analysis'}
                  </h2>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                    Risk ID: <span className="mono">{breakdownModalData.risk_info?.id || breakdownModalData.case?.id}</span> | Type: {breakdownModalData.risk_info?.risk_type || breakdownModalData.case?.source_type}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e' }}>
                    ₹{Number(breakdownModalData.risk_info?.amount_at_risk || breakdownModalData.case?.amount_at_risk || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="badge badge-risk">
                    Risk Score: {breakdownModalData.risk_info?.risk_score || breakdownModalData.case?.risk_score}/100
                  </span>
                </div>
              </div>

              {/* Grid of Key Analytical Facts */}
              {(() => {
                const rInfo = breakdownModalData.risk_info || {};
                const baselineRate = Number(rInfo.baseline_failure_rate || rInfo.baseline_abandonment_rate || 0);
                const recentRate = Number(rInfo.method_failure_rate || rInfo.recent_failure_rate || rInfo.recent_abandonment_rate || 0);
                const delta = (recentRate - baselineRate).toFixed(2);
                const affectedCount = rInfo.affected_count || breakdownModalData.breakdown?.failed_transactions || 0;
                const timeWindow = rInfo.time_window || '18:00 - 22:00';
                const failureReason = rInfo.primary_failure_reason || 'technical_error';

                return (
                  <>
                    <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Affected Volume</div>
                        <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
                          {affectedCount}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>At-Risk Transactions / Sessions</div>
                      </div>

                      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Recent 14-Day Failure Rate</div>
                        <div className="mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f43f5e', marginTop: '0.2rem' }}>
                          {recentRate}%
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Baseline: {baselineRate}%</div>
                      </div>

                      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Concentrated Method</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#3b82f6', marginTop: '0.2rem' }}>
                          {rInfo.payment_method || 'UPI'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recent 14-Day UPI Anomaly Rate: {recentRate}%</div>
                      </div>

                      <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Time Window</div>
                        <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
                          {timeWindow}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Peak Concentration</div>
                      </div>
                    </div>

                    {/* Recent 14-Day Anomaly Breakdown Section */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '1.15rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid rgba(244,63,94,0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.8rem', color: '#f43f5e', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                          Recent 14-Day Anomaly Breakdown
                        </h4>
                        <span className="badge badge-risk">
                          Spike: +{delta}% Points Delta
                        </span>
                      </div>

                      <div className="grid-4" style={{ marginBottom: 0 }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Baseline Failure Rate</div>
                          <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{baselineRate}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>7–90 day historical average</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recent 14-Day UPI Anomaly Rate</div>
                          <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f43f5e' }}>{recentRate}%</div>
                          <div style={{ fontSize: '0.7rem', color: '#f43f5e' }}>Elevated anomaly window</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Percentage-Point Change</div>
                          <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f59e0b' }}>+{delta}% pts</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Baseline to recent delta</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Affected Volume & Reason</div>
                          <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#3b82f6' }}>{affectedCount} txns</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Reason: {failureReason.replace(/_/g, ' ')}</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Calculated Statistical Evidence */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1.15rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.8rem', color: '#a78bfa', marginBottom: '0.6rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  Calculated Evidence Breakdown
                </h4>
                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-primary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {(breakdownModalData.risk_info?.evidence || [breakdownModalData.case?.diagnosis]).map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>

              {/* Breakdown by Payment Method / Failure Reason */}
              {breakdownModalData.breakdown?.by_payment_method && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                    90-Day Payment Method Statistics
                  </h4>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Payment Method</th>
                          <th>Total Volume</th>
                          <th>Failed Volume</th>
                          <th>Failure Rate</th>
                          <th>Failed Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(breakdownModalData.breakdown.by_payment_method).map(([pm, data]) => (
                          <tr key={pm}>
                            <td style={{ fontWeight: 600 }}>{pm.toUpperCase()}</td>
                            <td className="mono">{data.total}</td>
                            <td className="mono" style={{ color: data.failed > 0 ? '#f43f5e' : 'var(--text-primary)' }}>{data.failed}</td>
                            <td>
                              <span className={`badge ${data.failure_rate > 8 ? 'badge-risk' : 'badge-info'}`}>
                                {data.failure_rate}%
                              </span>
                            </td>
                            <td className="mono" style={{ fontWeight: 700 }}>₹{Number(data.failed_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Failure Reasons Breakdown */}
              {breakdownModalData.breakdown?.by_failure_reason && (
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Failure Reasons Distribution
                  </h4>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {Object.entries(breakdownModalData.breakdown.by_failure_reason).map(([reason, count]) => (
                      <span key={reason} className={`badge ${reason === 'technical_error' ? 'badge-risk' : 'badge-info'}`} style={{ fontSize: '0.78rem' }}>
                        {reason.replace(/_/g, ' ').toUpperCase()}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => setBreakdownModalData(null)}>Close</button>
                <button className="btn btn-ai" onClick={() => {
                  const id = breakdownModalData.risk_info?.id || breakdownModalData.case?.id;
                  setBreakdownModalData(null);
                  handleDiagnose(id);
                }}>
                  <Bot size={15} /> Diagnose with AI
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
