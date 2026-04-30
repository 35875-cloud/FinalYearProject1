import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OfficerLayout, { T, S } from '../officer/OfficerLayout';
import OwnershipHistoryWorkspace from '../ownership/OwnershipHistoryWorkspace';

const cardStyle = {
  background: 'white',
  borderRadius: 22,
  boxShadow: S.md,
  padding: '1.25rem',
};

const SectionCard = ({ title, subtitle = '', actions = null, children }) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.08rem', color: T.text }}>{title}</div>
        {subtitle ? <div style={{ marginTop: 6, color: T.text2, fontSize: '.84rem', lineHeight: 1.55 }}>{subtitle}</div> : null}
      </div>
      {actions}
    </div>
    {children}
  </div>
);

const StatCard = ({ icon, label, value, helper = '', bg, color }) => (
  <div style={{ ...cardStyle, border: `1px solid ${bg}` }}>
    <div style={{ width: 50, height: 50, borderRadius: 14, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', marginBottom: '0.85rem' }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
    <div style={{ marginTop: 6, color: T.text2, fontWeight: 700, fontSize: '.84rem' }}>{label}</div>
    {helper ? <div style={{ marginTop: 6, color: T.muted, fontSize: '.76rem', lineHeight: 1.5 }}>{helper}</div> : null}
  </div>
);

const StatusChip = ({ tone = 'neutral', children }) => {
  const tones = {
    neutral: { bg: '#eef2ff', color: '#4338ca' },
    success: { bg: '#ecfdf5', color: '#047857' },
    warning: { bg: '#fff7ed', color: '#c2410c' },
    danger: { bg: '#fef2f2', color: '#b91c1c' },
  };
  const palette = tones[tone] || tones.neutral;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: palette.bg, color: palette.color, fontWeight: 800, fontSize: '.72rem' }}>
      {children}
    </span>
  );
};

const ActionButton = ({ icon, label, onClick, disabled = false, tone = 'primary' }) => {
  const tones = {
    primary: { bg: '#0f766e', color: 'white', border: '#0f766e' },
    secondary: { bg: 'white', color: T.text, border: T.border },
    warning: { bg: '#fff7ed', color: '#b45309', border: '#fdba74' },
  };
  const palette = tones[tone] || tones.primary;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        background: disabled ? '#e2e8f0' : palette.bg,
        color: disabled ? '#64748b' : palette.color,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <i className={icon} />
      {label}
    </button>
  );
};

const GuideCard = ({ icon, title, purpose, fix, tone = 'neutral' }) => {
  const palette = {
    neutral: { bg: '#f8fafc', border: T.border, iconBg: '#eef2ff', iconColor: '#4338ca' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#dcfce7', iconColor: '#15803d' },
    warning: { bg: '#fff7ed', border: '#fdba74', iconBg: '#ffedd5', iconColor: '#c2410c' },
    danger: { bg: '#fef2f2', border: '#fecaca', iconBg: '#fee2e2', iconColor: '#b91c1c' },
  }[tone] || {
    bg: '#f8fafc',
    border: T.border,
    iconBg: '#eef2ff',
    iconColor: '#4338ca',
  };

  return (
    <div style={{ border: `1px solid ${palette.border}`, borderRadius: 18, background: palette.bg, padding: '1rem', display: 'grid', gap: '.6rem' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, background: palette.iconBg, color: palette.iconColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={icon} />
        </span>
        <strong style={{ color: T.text }}>{title}</strong>
      </div>
      <div style={{ color: T.text2, fontSize: '.82rem', lineHeight: 1.6 }}>
        <strong style={{ color: T.text }}>Purpose:</strong> {purpose}
      </div>
      <div style={{ color: T.text2, fontSize: '.82rem', lineHeight: 1.6 }}>
        <strong style={{ color: T.text }}>Admin fix:</strong> {fix}
      </div>
    </div>
  );
};

const FocusCard = ({ icon, title, count, helper, purpose, fix, onOpen, tone = 'neutral' }) => (
  <button
    onClick={onOpen}
    style={{
      border: `1px solid ${T.border}`,
      borderRadius: 18,
      background: 'white',
      boxShadow: S.sm,
      padding: '1rem',
      display: 'grid',
      gap: '.7rem',
      textAlign: 'left',
      cursor: 'pointer',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, background: '#eef2ff', color: '#4338ca', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={icon} />
        </span>
        <strong style={{ color: T.text }}>{title}</strong>
      </div>
      <StatusChip tone={tone}>{count}</StatusChip>
    </div>
    <div style={{ color: T.text2, fontSize: '.82rem', lineHeight: 1.5 }}>{helper}</div>
    <div style={{ color: T.text2, fontSize: '.8rem', lineHeight: 1.55 }}>
      <strong style={{ color: T.text }}>Why it exists:</strong> {purpose}
    </div>
    <div style={{ color: T.text2, fontSize: '.8rem', lineHeight: 1.55 }}>
      <strong style={{ color: T.text }}>Open this to fix:</strong> {fix}
    </div>
  </button>
);

const HealthRow = ({ label, status, details, meta = '', purpose, fix }) => (
  <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc', display: 'grid', gap: '.65rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <strong style={{ color: T.text }}>{label}</strong>
      <StatusChip tone={toneForStatus(status)}>{status || 'UNKNOWN'}</StatusChip>
    </div>
    <div style={{ color: T.text2, fontSize: '.82rem', lineHeight: 1.55 }}>{details}</div>
    {meta ? <div style={{ color: T.muted, fontSize: '.76rem', lineHeight: 1.5 }}>{meta}</div> : null}
    <div style={{ color: T.text2, fontSize: '.8rem', lineHeight: 1.55 }}>
      <strong style={{ color: T.text }}>Purpose:</strong> {purpose}
    </div>
    <div style={{ color: T.text2, fontSize: '.8rem', lineHeight: 1.55 }}>
      <strong style={{ color: T.text }}>Admin fix:</strong> {fix}
    </div>
  </div>
);

const fmtDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString();
};

const fmtJsonSummary = (value) => {
  if (!value) return '--';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return Object.entries(value)
    .slice(0, 3)
    .map(([key, itemValue]) => `${key}: ${typeof itemValue === 'object' ? '[complex]' : itemValue}`)
    .join(' | ');
};

const toneForStatus = (status = '') => {
  const normalized = String(status).toUpperCase();
  if (['HEALTHY', 'ONLINE', 'SUCCESS', 'READY', 'CLEAN'].includes(normalized)) return 'success';
  if (['DEGRADED', 'STALE', 'SLOW', 'NO_BACKUP', 'MISSING', 'WARNING'].includes(normalized)) return 'warning';
  if (['DOWN', 'OFFLINE', 'FAILED', 'ERROR', 'TAMPERED', 'CRITICAL'].includes(normalized)) return 'danger';
  return 'neutral';
};

const fmtHours = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '--';
  if (numeric < 1) return `${Math.round(numeric * 60)} min`;
  return `${numeric.toFixed(numeric >= 10 ? 0 : 1)} h`;
};

const fmtUptime = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '--';

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const sectionMeta = {
  overview: {
    title: 'Admin Overview',
    subtitle: 'Start here to see what the admin is responsible for, what needs attention now, and which workspace should be opened next.',
  },
  approvals: {
    title: 'Role Applications',
    subtitle: 'This workspace is only for approving or rejecting officer access. Admin does not decide land ownership or legal case outcomes here.',
  },
  system: {
    title: 'System Health',
    subtitle: 'These details explain whether the platform is available, recoverable, and technically trustworthy.',
  },
  integrity: {
    title: 'Integrity Watchlist',
    subtitle: 'This is the technical watchlist for approved property mirrors and proof alignment, not a legal land-decision screen.',
  },
  ownership: {
    title: 'Ownership History',
    subtitle: 'Inspect original registration, transfer, and succession-linked property history here without opening raw tables.',
  },
  audit: {
    title: 'Audit Trail',
    subtitle: 'This is the evidence log for access decisions, repairs, and system operations so support and accountability stay clear.',
  },
};

const AdminDashboard = ({ section = 'overview' }) => {
  const navigate = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');
  const currentSection = sectionMeta[section] ? section : 'overview';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState('');
  const [registrations, setRegistrations] = useState({ pending: [], approved: [], rejected: [], approvedToday: 0, rejectedToday: 0 });
  const [overview, setOverview] = useState(null);
  const [issues, setIssues] = useState({ integrityIssues: [], registrationIssues: [], transferIssues: [] });
  const [auditTrail, setAuditTrail] = useState({ logs: [], total: 0 });

  const headers = {
    Authorization: `Bearer ${authToken}`,
  };

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [regRes, overviewRes, issuesRes, auditRes] = await Promise.all([
        fetch(`${base}/api/auth/all-registrations`, { headers }),
        fetch(`${base}/api/admin/recovery/overview`, { headers }),
        fetch(`${base}/api/admin/recovery/issues`, { headers }),
        fetch(`${base}/api/admin/recovery/audit-logs?limit=20`, { headers }),
      ]);

      const [regData, overviewData, issuesData, auditData] = await Promise.all([
        regRes.json(),
        overviewRes.json(),
        issuesRes.json(),
        auditRes.json(),
      ]);

      if (!regRes.ok || !regData.success) {
        throw new Error(regData.message || 'Unable to load officer registration data');
      }
      if (!overviewRes.ok || !overviewData.success) {
        throw new Error(overviewData.message || 'Unable to load admin recovery overview');
      }
      if (!issuesRes.ok || !issuesData.success) {
        throw new Error(issuesData.message || 'Unable to load recovery issue list');
      }
      if (!auditRes.ok || !auditData.success) {
        throw new Error(auditData.message || 'Unable to load audit trail');
      }

      setRegistrations({
        pending: regData.pending || [],
        approved: regData.approved || [],
        rejected: regData.rejected || [],
        approvedToday: regData.approvedToday || 0,
        rejectedToday: regData.rejectedToday || 0,
      });
      setOverview(overviewData);
      setIssues({
        integrityIssues: issuesData.integrityIssues || [],
        registrationIssues: issuesData.registrationIssues || [],
        transferIssues: issuesData.transferIssues || [],
      });
      setAuditTrail({
        logs: auditData.logs || [],
        total: auditData.total || 0,
      });
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (authToken) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const handleDecision = async (type, userId) => {
    const payload = type === 'approve'
      ? { userId, notes: 'Approved by admin' }
      : { userId, reason: window.prompt('Enter rejection reason for this officer registration:') || '' };

    if (type === 'reject' && !payload.reason.trim()) return;

    setBusyUserId(userId);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/auth/${type === 'approve' ? 'approve-user' : 'reject-user'}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to update officer registration');
      }

      setNotice(type === 'approve' ? 'Officer approved successfully.' : 'Officer rejected successfully.');
      await load();
    } catch (err) {
      setError(err.message);
    }

    setBusyUserId('');
  };

  const handleRecovery = async (scope) => {
    setRecoveryBusy(scope);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/admin/recovery/reconcile`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Recovery reconcile failed');
      }

      setNotice(`Recovery pass completed for ${scope}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }

    setRecoveryBusy('');
  };

  const handleIntegrityRebuild = async (propertyId) => {
    setRecoveryBusy(propertyId);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/admin/recovery/properties/${propertyId}/rebuild-integrity`, {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to rebuild integrity mirror');
      }

      setNotice(`Integrity mirror rebuilt for ${propertyId}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }

    setRecoveryBusy('');
  };

  const handleCaseRepair = async (type, caseId) => {
    setRecoveryBusy(caseId);
    setError('');
    setNotice('');

    try {
      const route =
        type === 'registration'
          ? `${base}/api/admin/recovery/registration/${caseId}/reconcile`
          : `${base}/api/admin/recovery/transfer/${caseId}/reconcile`;

      const response = await fetch(route, {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to repair workflow case');
      }

      setNotice(type === 'registration' ? `Registration case ${caseId} repaired successfully.` : `Transfer case ${caseId} repaired successfully.`);
      await load();
    } catch (err) {
      setError(err.message);
    }

    setRecoveryBusy('');
  };

  const handleAlertAction = async (alert) => {
    if (!alert?.category) return;

    if (alert.category === 'INTEGRITY_GAP') {
      await handleRecovery('integrity');
      return;
    }

    if (alert.category === 'REGISTRATION_SYNC') {
      await handleRecovery('registration');
      return;
    }

    if (alert.category === 'TRANSFER_SYNC') {
      await handleRecovery('transfer');
    }
  };

  const workflowIssueCount = issues.registrationIssues.length + issues.transferIssues.length;
  const activeAlertCount = overview?.alerts?.total || 0;
  const criticalAlertCount = overview?.alerts?.critical || 0;
  const tamperedCount = issues.integrityIssues.filter((item) => item?.tamperDetected).length;
  const rebuildableIntegrityCount = issues.integrityIssues.length - tamperedCount;
  
  // Removed Recovery Tools from navLinks
  const navLinks = [
    { to: '/admin/dashboard', icon: 'fas fa-compass', label: 'Overview' },
    { to: '/admin/approvals', icon: 'fas fa-user-check', label: 'Role Applications', badge: registrations.pending.length },
    { to: '/admin/health', icon: 'fas fa-heart-pulse', label: 'System Health', badge: activeAlertCount },
    { to: '/admin/integrity', icon: 'fas fa-shield-halved', label: 'Integrity Watchlist', badge: issues.integrityIssues.length },
    { to: '/admin/ownership-history', icon: 'fas fa-history', label: 'Ownership History' },
    { to: '/admin/audit', icon: 'fas fa-clipboard-list', label: 'Audit Trail' },
  ];

  const monitoringCards = overview ? [
    {
      icon: 'fas fa-server',
      label: 'API Uptime',
      value: fmtUptime(overview.system?.api?.uptimeSeconds),
      helper: overview.system?.api?.status || 'UNKNOWN',
      bg: '#eef2ff',
      color: '#4f46e5',
    },
    {
      icon: 'fas fa-database',
      label: 'Database Latency',
      value: overview.system?.database?.latencyMs ?? '--',
      helper: overview.system?.database?.status || 'UNKNOWN',
      bg: '#ecfdf5',
      color: '#059669',
    },
    {
      icon: 'fas fa-network-wired',
      label: 'Reachable Peers',
      value: `${overview.system?.fabricNetwork?.peers?.reachable || 0}/${overview.system?.fabricNetwork?.peers?.total || 0}`,
      helper: `${overview.system?.fabricNetwork?.orderers?.reachable || 0}/${overview.system?.fabricNetwork?.orderers?.total || 0} orderers`,
      bg: '#eff6ff',
      color: '#2563eb',
    },
    {
      icon: 'fas fa-hard-drive',
      label: 'Backup Freshness',
      value: overview.system?.backups?.latestBackupAt ? fmtHours(overview.system?.backups?.backupAgeHours) : 'Missing',
      helper: overview.system?.backups?.status || 'UNAVAILABLE',
      bg: '#fff7ed',
      color: '#c2410c',
    },
  ] : [];

  const renderOverview = () => (
    <div style={{ display: 'grid', gap: '1.2rem' }}>
      <div
        style={{
          ...cardStyle,
          padding: '1.6rem 1.7rem',
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef6ff 52%, #f7fffd 100%)',
          border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: '#e0f2fe', color: '#075985', fontWeight: 800, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          System administration only
        </div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.7rem', color: T.text, marginTop: 14, marginBottom: 8 }}>
          Admin keeps the platform readable, safe, and recoverable
        </div>
        <div style={{ color: T.text2, fontSize: '.95rem', maxWidth: 900, lineHeight: 1.7 }}>
          This area should help the admin answer four questions quickly: who is waiting for access, is the platform healthy, are any records drifting technically,
          and what evidence exists for support or investigation. Legal land decisions stay with citizen, LRO, and DC workflows.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
        <StatCard icon="fas fa-user-clock" label="Pending Officer Approvals" value={registrations.pending.length} helper="Access queue" bg="#fff7ed" color="#ea580c" />
        <StatCard icon="fas fa-triangle-exclamation" label="Critical Platform Alerts" value={criticalAlertCount} helper="Needs fast admin review" bg="#fef2f2" color="#dc2626" />
        <StatCard icon="fas fa-shield-halved" label="Integrity Watchlist" value={issues.integrityIssues.length} helper="Mirror or proof drift" bg="#eff6ff" color="#2563eb" />
        <StatCard icon="fas fa-arrows-rotate" label="Workflow Drift" value={workflowIssueCount} helper="Counters need repair" bg="#eef2ff" color="#4f46e5" />
      </div>

      <SectionCard title="Choose the right admin workspace" subtitle="Open one focused section at a time instead of reading one long mixed dashboard.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1rem' }}>
          <FocusCard
            icon="fas fa-user-check"
            title="Role Applications"
            count={registrations.pending.length}
            helper={registrations.pending.length ? 'Officer accounts are waiting for approval or rejection.' : 'No officer approvals are waiting right now.'}
            purpose="Control who can enter officer-side modules."
            fix="Open pending applications and approve or reject LRO/DC accounts."
            onOpen={() => navigate('/admin/approvals')}
            tone={registrations.pending.length ? 'warning' : 'success'}
          />
          <FocusCard
            icon="fas fa-heart-pulse"
            title="System Health"
            count={activeAlertCount}
            helper={criticalAlertCount ? 'Some technical services need immediate attention.' : 'Core platform checks are stable right now.'}
            purpose="Show whether the app, database, Fabric network, backups, and local ledger are healthy."
            fix="Use the health page to see the exact failing component and the suggested admin action."
            onOpen={() => navigate('/admin/health')}
            tone={criticalAlertCount ? 'danger' : 'neutral'}
          />
          <FocusCard
            icon="fas fa-shield-halved"
            title="Integrity Watchlist"
            count={issues.integrityIssues.length}
            helper={tamperedCount ? 'Some items need manual review before any rebuild.' : 'Rebuildable drift only, if any.'}
            purpose="Watch approved property mirrors and proof alignment for tamper or drift."
            fix="Rebuild clean drift items, and manually inspect anything marked tampered."
            onOpen={() => navigate('/admin/integrity')}
            tone={tamperedCount ? 'danger' : issues.integrityIssues.length ? 'warning' : 'success'}
          />
        </div>
      </SectionCard>

      <SectionCard title="What the admin should care about" subtitle="These are the useful details. Anything outside this list usually belongs to the land workflow roles, not admin.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
          <GuideCard icon="fas fa-user-shield" title="Access control" purpose="Decide which LRO and DC accounts may enter the system." fix="Approve or reject officer applications and review the audit trail if a decision is questioned." />
          <GuideCard icon="fas fa-server" title="Platform availability" purpose="Know whether the app, database, and Fabric integration are currently reachable." fix="Open System Health, find the failing component, then restart services or correct configuration." />
          <GuideCard icon="fas fa-shield-halved" title="Data trust" purpose="Spot local mirror drift or suspected tamper before support staff rely on a bad record." fix="Use Integrity Watchlist to rebuild safe drift items and escalate anything marked tampered." />
          <GuideCard icon="fas fa-clipboard-list" title="Evidence and support" purpose="Explain who approved, rejected, or repaired something and when it happened." fix="Open Audit Trail to trace the responsible actor and the exact action history." />
        </div>
      </SectionCard>
    </div>
  );

  const renderApprovals = () => (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <SectionCard title="Purpose of role applications" subtitle="Admin uses this section only to control officer access. The goal is clear onboarding and clean separation of duties.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem' }}>
          <GuideCard icon="fas fa-user-lock" title="Why this list exists" purpose="LRO and DC accounts cannot use officer modules until admin authorizes them." fix="Review identity details, then approve or reject the request." />
          <GuideCard icon="fas fa-ban" title="Where admin stops" purpose="Admin is not deciding property ownership, succession, transfer approval, or restrictions here." fix="Only manage officer account access and leave land decisions to the legal workflow roles." />
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <SectionCard title="Pending officer applications" subtitle="Only pending LRO and DC accounts are shown here so the list stays short and readable." actions={<ActionButton icon="fas fa-rotate-right" label="Refresh List" onClick={load} tone="secondary" />}>
          {!registrations.pending.length ? (
            <div style={{ color: T.muted }}>No pending LRO or DC registrations right now.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {registrations.pending.map((user) => (
                <div key={user.user_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, color: T.text }}>{user.name}</div>
                    <StatusChip tone="warning">{user.role}</StatusChip>
                  </div>
                  <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>{user.email}</div>
                  <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: 4 }}>User ID: {user.user_id}</div>
                  <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: '0.95rem' }}>
                    Purpose: decide whether this officer account can enter the platform.
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <ActionButton
                      icon="fas fa-check"
                      label={busyUserId === user.user_id ? 'Working...' : 'Approve'}
                      onClick={() => handleDecision('approve', user.user_id)}
                      disabled={busyUserId === user.user_id}
                    />
                    <ActionButton
                      icon="fas fa-xmark"
                      label={busyUserId === user.user_id ? 'Working...' : 'Reject'}
                      onClick={() => handleDecision('reject', user.user_id)}
                      disabled={busyUserId === user.user_id}
                      tone="warning"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent access decisions" subtitle="This keeps recent admin access activity visible without mixing it with recovery or land workflow data.">
          <div style={{ display: 'grid', gap: '.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
              <StatusChip tone="success">Approved Today {registrations.approvedToday}</StatusChip>
              <StatusChip tone="danger">Rejected Today {registrations.rejectedToday}</StatusChip>
            </div>
            {!registrations.approved.length && !registrations.rejected.length ? (
              <div style={{ color: T.muted }}>No recent account decisions to show.</div>
            ) : (
              <>
                {(registrations.approved || []).slice(0, 4).map((user) => (
                  <div key={`approved-${user.user_id}`} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: T.text }}>{user.name}</strong>
                      <StatusChip tone="success">Approved</StatusChip>
                    </div>
                    <div style={{ color: T.text2, fontSize: '.82rem', marginTop: 4 }}>{user.email}</div>
                  </div>
                ))}
                {(registrations.rejected || []).slice(0, 3).map((user) => (
                  <div key={`rejected-${user.user_id}`} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: T.text }}>{user.name}</strong>
                      <StatusChip tone="danger">Rejected</StatusChip>
                    </div>
                    <div style={{ color: T.text2, fontSize: '.82rem', marginTop: 4 }}>{user.email}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const renderSystem = () => (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <SectionCard title="Why these system details matter" subtitle="Every item below tells the admin one practical thing: is the platform up, can it recover, and can users trust the technical state.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
          <GuideCard icon="fas fa-server" title="Availability" purpose="The API and database must be reachable before any role can work." fix="If either shows degraded or down, restart the service or inspect its logs before chasing deeper workflow issues." />
          <GuideCard icon="fas fa-network-wired" title="Blockchain connectivity" purpose="Fabric reachability shows whether blockchain-backed proof and voting can actually talk to the peer network." fix="Start Docker peers and orderers, confirm ports and certificates, then refresh the page." />
          <GuideCard icon="fas fa-hard-drive" title="Recovery readiness" purpose="Backup freshness tells you whether the platform has a recent restore point." fix="If backup is missing or stale, run the scheduled backup flow and confirm the backup folder is updating." />
          <GuideCard icon="fas fa-link" title="Ledger confidence" purpose="The local ledger section warns if block hashes or mirrored records no longer line up." fix="Review invalid blocks manually before treating them as safe to repair, especially if tamper is suspected." tone="warning" />
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '1rem' }}>
        {monitoringCards.map((item) => (
          <StatCard
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            helper={item.helper}
            bg={item.bg}
            color={item.color}
          />
        ))}
      </div>

      <SectionCard title="System health details" subtitle="Only the important technical checks are shown here, with a clear admin purpose and next step." actions={<ActionButton icon="fas fa-heart-pulse" label="Refresh Health" onClick={load} tone="secondary" />}>
        <div style={{ display: 'grid', gap: '.85rem' }}>
          <HealthRow
            label="API Service"
            status={overview?.system?.api?.status}
            details={`Backend uptime is ${fmtUptime(overview?.system?.api?.uptimeSeconds)} in ${overview?.system?.api?.environment || 'development'} mode.`}
            meta={`Last checked ${fmtDateTime(overview?.system?.api?.checkedAt)}`}
            purpose="Confirms whether the application server itself is responding."
            fix="If this is down, restart the backend process and review the latest server errors before anything else."
          />
          <HealthRow
            label="Database"
            status={overview?.system?.database?.status}
            details={`Primary PostgreSQL connection is responding in ${overview?.system?.database?.latencyMs ?? '--'} ms.`}
            meta="This is a live round-trip check."
            purpose="Shows whether the core data store is reachable and responsive."
            fix="If latency spikes or status is down, verify PostgreSQL service health, credentials, disk, and slow queries."
          />
          <HealthRow
            label="Fabric Network"
            status={overview?.system?.fabricNetwork?.status}
            details={`${overview?.system?.fabricNetwork?.peers?.reachable || 0}/${overview?.system?.fabricNetwork?.peers?.total || 0} peers and ${overview?.system?.fabricNetwork?.orderers?.reachable || 0}/${overview?.system?.fabricNetwork?.orderers?.total || 0} orderers are reachable.`}
            meta={
              overview?.system?.fabricNetwork?.gatewayReady
                ? 'Gateway wallet and connection profile are ready.'
                : overview?.system?.fabricNetwork?.gatewayError || 'Gateway still needs attention.'
            }
            purpose="Shows whether blockchain-backed submission and verification can reach the network."
            fix="If peers or orderers are unreachable, start the Docker Fabric services, verify ports, certificates, and the gateway profile."
          />
          <HealthRow
            label="Backups"
            status={overview?.system?.backups?.status}
            details={
              overview?.system?.backups?.latestBackupAt
                ? `Latest backup ${overview?.system?.backups?.latestBackupId || '--'} was created ${fmtHours(overview?.system?.backups?.backupAgeHours)} ago using ${overview?.system?.backups?.latestBackupMode || '--'}.`
                : 'No backup is recorded yet.'
            }
            meta={
              overview?.system?.backups?.latestRestoreAt
                ? `Last restore ${fmtDateTime(overview?.system?.backups?.latestRestoreAt)}`
                : 'No restore run has been recorded yet.'
            }
            purpose="Tells the admin whether a recovery point exists if the platform fails."
            fix="If missing or stale, check the backup job, confirm the backup folder is being written, and trigger a fresh backup."
          />
          <HealthRow
            label="Migrations"
            status={overview?.system?.migrations?.status}
            details={`${overview?.system?.migrations?.appliedCount || 0} schema migrations are applied.`}
            meta={
              overview?.system?.migrations?.latestAppliedAt
                ? `Latest migration ${fmtDateTime(overview?.system?.migrations?.latestAppliedAt)}`
                : 'Migration table not available yet.'
            }
            purpose="Shows whether the database schema matches the running application code."
            fix="If migrations are missing or broken, apply the pending migration set before continuing with support work."
          />
          <HealthRow
            label="Local Ledger Integrity"
            status={overview?.system?.blockchain?.status}
            details={`${overview?.system?.blockchain?.totalBlocks || 0} blocks secure ${overview?.system?.blockchain?.totalProperties || 0} properties on the local PoA ledger.`}
            meta={
              overview?.system?.blockchain?.error
                ? overview.system.blockchain.error
                : overview?.system?.blockchain?.invalidBlocks
                  ? `${overview.system.blockchain.invalidBlocks} invalid blocks need review.`
                  : overview?.system?.blockchain?.lastMiningTime
                    ? `Last block mined ${fmtDateTime(overview.system.blockchain.lastMiningTime)}`
                    : 'No local PoA blocks have been mined yet.'
            }
            purpose="Warns when the local ledger chain no longer validates cleanly."
            fix="If invalid blocks appear, compare stored block hash, previous hash, and transaction snapshot first. Treat this as manual review, not a blind auto-repair."
          />
        </div>
      </SectionCard>
    </div>
  );

  const renderIntegrity = () => (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <SectionCard title="Purpose of the integrity watchlist" subtitle="This page exists so the admin can tell the difference between safe mirror drift and possible tamper. Only the technical trust picture belongs here.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
          <GuideCard icon="fas fa-shield-halved" title="Mirror drift" purpose="Some approved properties lose their local mirror or fall behind the latest trusted state." fix="Use rebuild only when the item is not flagged as tampered and the issue is a mirror/proof gap." />
          <GuideCard icon="fas fa-triangle-exclamation" title="Suspected tamper" purpose="A tampered item means the current data no longer matches the trusted snapshot." fix="Do not auto-rebuild. Review the property snapshot, ledger state, and recent audit events first." tone="danger" />
          <GuideCard icon="fas fa-clipboard-check" title="Admin result" purpose="The admin’s job is to restore technical confidence or escalate a suspicious record." fix="Rebuild safe items here, then use Audit Trail and Recovery Tools if the issue points to a wider system problem." />
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
        <StatCard icon="fas fa-shield-halved" label="Watchlist Items" value={issues.integrityIssues.length} helper="All current integrity issues" bg="#eff6ff" color="#2563eb" />
        <StatCard icon="fas fa-bug" label="Manual Review Required" value={tamperedCount} helper="Potential tamper or unsafe rebuild" bg="#fef2f2" color="#dc2626" />
        <StatCard icon="fas fa-wrench" label="Rebuildable Drift" value={rebuildableIntegrityCount} helper="Safe for mirror rebuild" bg="#ecfdf5" color="#059669" />
      </div>

      <SectionCard title="Current integrity items" subtitle="Only the property, classification, reason, and next admin action are shown so this list stays readable." actions={<ActionButton icon="fas fa-rotate-right" label="Refresh Watchlist" onClick={load} tone="secondary" />}>
        {!issues.integrityIssues.length ? (
          <div style={{ color: T.muted }}>No integrity watchlist items right now.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {issues.integrityIssues.map((item) => (
              <div key={item.propertyId} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, color: T.text }}>{item.propertyId}</div>
                  <StatusChip tone={item.tamperDetected ? 'danger' : 'warning'}>
                    {item.classification}
                  </StatusChip>
                </div>
                <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>{item.ownerName || 'Owner unavailable'}</div>
                <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: 6 }}>Proof source: {item.proofSource || '--'}</div>
                <div style={{ color: item.tamperDetected ? '#b91c1c' : T.text2, fontSize: '.8rem', lineHeight: 1.55, marginBottom: '.85rem' }}>
                  <strong style={{ color: T.text }}>What happened:</strong> {item.tamperReason || 'The local mirror can be rebuilt to match the current approved state.'}
                </div>
                <div style={{ color: T.text2, fontSize: '.8rem', lineHeight: 1.55, marginBottom: '.95rem' }}>
                  <strong style={{ color: T.text }}>Admin action:</strong> {item.tamperDetected ? 'Manual review only. Compare trusted proof, current property snapshot, and recent audit events before touching the record.' : 'Rebuild the local mirror if this is only a proof or snapshot gap.'}
                </div>
                <ActionButton
                  icon="fas fa-shield-halved"
                  label={recoveryBusy === item.propertyId ? 'Rebuilding...' : 'Rebuild Mirror'}
                  onClick={() => handleIntegrityRebuild(item.propertyId)}
                  disabled={Boolean(recoveryBusy) || item.tamperDetected}
                  tone="secondary"
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );

  // Removed renderRecovery function entirely

  const renderOwnership = () => (
    <OwnershipHistoryWorkspace viewer="admin" />
  );

  const renderAudit = () => (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <SectionCard title="Purpose of the audit trail" subtitle="The audit trail helps the admin explain what happened, who triggered it, and whether a repair or approval really occurred.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
          <GuideCard icon="fas fa-magnifying-glass" title="Support investigation" purpose="Use this when a user asks who approved, rejected, or changed something." fix="Search recent actions here before editing live data or rerunning repairs." />
          <GuideCard icon="fas fa-scale-balanced" title="Accountability" purpose="This proves which actor triggered an administrative or recovery action." fix="Compare the timestamp, actor, target, and summary before deciding on any follow-up fix." />
          <GuideCard icon="fas fa-receipt" title="Change evidence" purpose="Audit entries tell the story behind access decisions and system repairs." fix="Use the summary column to understand intent without reading large raw payloads." />
        </div>
      </SectionCard>

      <SectionCard title="Recent audit events" subtitle="Only the most useful columns are shown so the admin can scan the log quickly." actions={<ActionButton icon="fas fa-rotate-right" label="Refresh Audit" onClick={load} tone="secondary" />}>
        {!auditTrail.logs.length ? (
          <div style={{ color: T.muted }}>No audit events have been recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: T.text2, fontSize: '.76rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  <th style={{ textAlign: 'left', padding: '.8rem' }}>When</th>
                  <th style={{ textAlign: 'left', padding: '.8rem' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '.8rem' }}>Actor</th>
                  <th style={{ textAlign: 'left', padding: '.8rem' }}>Target</th>
                  <th style={{ textAlign: 'left', padding: '.8rem' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '.8rem' }}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.logs.map((item) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: '.8rem', color: T.text2, fontSize: '.8rem' }}>{fmtDateTime(item.created_at)}</td>
                    <td style={{ padding: '.8rem', color: T.text, fontWeight: 700 }}>{item.action_type}</td>
                    <td style={{ padding: '.8rem', color: T.text2, fontSize: '.8rem' }}>{item.user_id || '--'}</td>
                    <td style={{ padding: '.8rem', color: T.text2, fontSize: '.8rem' }}>
                      {item.target_type || '--'} {item.target_id ? `| ${item.target_id}` : ''}
                    </td>
                    <td style={{ padding: '.8rem' }}>
                      <StatusChip tone={String(item.status || 'SUCCESS').toUpperCase() === 'SUCCESS' ? 'success' : 'danger'}>
                        {item.status || 'SUCCESS'}
                      </StatusChip>
                    </td>
                    <td style={{ padding: '.8rem', color: T.text2, fontSize: '.78rem' }}>
                      {fmtJsonSummary(item.details_parsed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: '1rem', color: T.muted, fontSize: '.78rem' }}>
          Showing {auditTrail.logs.length} of {auditTrail.total} recent audit events.
        </div>
      </SectionCard>
    </div>
  );

  const renderBody = () => {
    if (currentSection === 'approvals') return renderApprovals();
    if (currentSection === 'system') return renderSystem();
    if (currentSection === 'integrity') return renderIntegrity();
    if (currentSection === 'ownership') return renderOwnership();
    if (currentSection === 'audit') return renderAudit();
    // Removed 'recovery' condition
    return renderOverview();
  };

  return (
    <OfficerLayout
      title={sectionMeta[currentSection].title}
      roleLabel="ADMIN"
      roleSubtitle="System Administrator"
      navLinks={navLinks}
    >
      <div style={{ display: 'grid', gap: '1.25rem' }}>
        <SectionCard
          title={sectionMeta[currentSection].title}
          subtitle={sectionMeta[currentSection].subtitle}
          actions={<ActionButton icon="fas fa-rotate-right" label="Refresh Data" onClick={load} tone="secondary" />}
        >
          <div style={{ color: T.text2, fontSize: '.84rem', lineHeight: 1.6 }}>
            This section is intentionally separated in the sidebar so the admin can read one responsibility at a time instead of one overloaded dashboard.
          </div>
        </SectionCard>

        {error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', padding: '0.95rem 1rem' }}>
            <strong>Admin dashboard error:</strong> {error}
          </div>
        ) : null}

        {notice ? (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 16, color: '#047857', padding: '0.95rem 1rem' }}>
            <strong>Update:</strong> {notice}
          </div>
        ) : null}

        {loading ? (
          <div style={{ ...cardStyle, padding: '4rem', textAlign: 'center', color: T.muted }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem' }} />
            <div>Loading admin workspace...</div>
          </div>
        ) : renderBody()}
      </div>
    </OfficerLayout>
  );
};

export default AdminDashboard;