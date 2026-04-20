import React, { useEffect, useState } from 'react';
import OfficerLayout, { T, S } from '../officer/OfficerLayout';

const ADMIN_NAV_LINKS = [
  { to: '/admin/dashboard', icon: 'fas fa-user-shield', label: 'Admin Dashboard' },
];

const cardStyle = {
  background: 'white',
  borderRadius: 22,
  boxShadow: S.md,
  padding: '1.25rem',
};

const StatCard = ({ icon, label, value, bg, color, helper = '' }) => (
  <div style={{ ...cardStyle, border: `1px solid ${bg}` }}>
    <div style={{ width: 50, height: 50, borderRadius: 14, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', marginBottom: '0.85rem' }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
    <div style={{ marginTop: 6, color: T.text2, fontWeight: 700, fontSize: '.84rem' }}>{label}</div>
    {helper ? <div style={{ marginTop: 6, color: T.muted, fontSize: '.76rem' }}>{helper}</div> : null}
  </div>
);

const SectionCard = ({ title, subtitle = '', actions = null, children }) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: T.text }}>{title}</div>
        {subtitle ? <div style={{ marginTop: 6, color: T.text2, fontSize: '.84rem' }}>{subtitle}</div> : null}
      </div>
      {actions}
    </div>
    {children}
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
  if (['HEALTHY', 'ONLINE', 'SUCCESS', 'READY'].includes(normalized)) return 'success';
  if (['DEGRADED', 'STALE', 'SLOW', 'NO_BACKUP'].includes(normalized)) return 'warning';
  if (['DOWN', 'OFFLINE', 'FAILED', 'ERROR', 'TAMPERED'].includes(normalized)) return 'danger';
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

const HealthRow = ({ label, status, details, meta = '' }) => (
  <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem 1rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
    <div style={{ minWidth: 220, flex: 1 }}>
      <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>{label}</div>
      <div style={{ color: T.text2, fontSize: '.82rem' }}>{details}</div>
      {meta ? <div style={{ color: T.muted, fontSize: '.76rem', marginTop: 5 }}>{meta}</div> : null}
    </div>
    <StatusChip tone={toneForStatus(status)}>{status || 'UNKNOWN'}</StatusChip>
  </div>
);

const AdminDashboard = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState('');
  const [registrations, setRegistrations] = useState({ pending: [], approved: [], rejected: [], approvedToday: 0, rejectedToday: 0 });
  const [propertyStats, setPropertyStats] = useState({ pending: 0, approved: 0, rejected: 0, minedToBlockchain: 0, approvedButUnmined: 0 });
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
      const [regRes, statsRes, overviewRes, issuesRes, auditRes] = await Promise.all([
        fetch(`${base}/api/auth/all-registrations`, { headers }),
        fetch(`${base}/api/properties/admin/property-stats`, { headers }),
        fetch(`${base}/api/admin/recovery/overview`, { headers }),
        fetch(`${base}/api/admin/recovery/issues`, { headers }),
        fetch(`${base}/api/admin/recovery/audit-logs?limit=10`, { headers }),
      ]);

      const [regData, statsData, overviewData, issuesData, auditData] = await Promise.all([
        regRes.json(),
        statsRes.json(),
        overviewRes.json(),
        issuesRes.json(),
        auditRes.json(),
      ]);

      if (!regRes.ok || !regData.success) {
        throw new Error(regData.message || 'Unable to load officer registration data');
      }
      if (!statsRes.ok || !statsData.success) {
        throw new Error(statsData.message || 'Unable to load property summary');
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
      setPropertyStats(statsData.stats || {});
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

      setNotice(
        type === 'registration'
          ? `Registration case ${caseId} repaired successfully.`
          : `Transfer case ${caseId} repaired successfully.`
      );
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
      return;
    }
  };

  const recoveryCards = overview ? [
    {
      icon: overview.fabric?.connected ? 'fas fa-link' : 'fas fa-unlink',
      label: 'Fabric Status',
      value: overview.fabric?.connected ? 'Online' : 'Offline',
      helper: `Threshold ${overview.fabric?.voteThreshold || 3}/${overview.fabric?.nodeCount || 5}`,
      bg: overview.fabric?.connected ? '#ecfdf5' : '#fef2f2',
      color: overview.fabric?.connected ? '#059669' : '#dc2626',
    },
    {
      icon: 'fas fa-shield-halved',
      label: 'Tamper Flags',
      value: overview.integrity?.tampered || 0,
      helper: `${overview.integrity?.approvedMissingMirror || 0} approved properties still need a mirror`,
      bg: '#fff7ed',
      color: '#ea580c',
    },
    {
      icon: 'fas fa-diagram-project',
      label: 'Registration Sync Gaps',
      value: overview.registration?.stale || 0,
      helper: `${overview.registration?.readyForDc || 0} ready for DC right now`,
      bg: '#eef2ff',
      color: '#4f46e5',
    },
    {
      icon: 'fas fa-right-left',
      label: 'Transfer Sync Gaps',
      value: overview.transfer?.stale || 0,
      helper: `${overview.transfer?.paidBacklog || 0} paid transfers are waiting for blockchain submit`,
      bg: '#eff6ff',
      color: '#2563eb',
    },
    {
      icon: 'fas fa-clipboard-list',
      label: 'Audit Events In 24h',
      value: overview.audit?.last24h || 0,
      helper: `${overview.audit?.failures24h || 0} failures captured in the last 24h`,
      bg: '#f8fafc',
      color: '#0f172a',
    },
  ] : [];

  const monitoringCards = overview ? [
    {
      icon: 'fas fa-heart-pulse',
      label: 'API Uptime',
      value: fmtUptime(overview.system?.api?.uptimeSeconds),
      helper: `Env ${overview.system?.api?.environment || 'development'}`,
      bg: '#ecfeff',
      color: '#0f766e',
    },
    {
      icon: 'fas fa-database',
      label: 'DB Latency',
      value: `${overview.system?.database?.latencyMs ?? '--'} ms`,
      helper: overview.system?.database?.status || 'UNKNOWN',
      bg: '#eff6ff',
      color: '#2563eb',
    },
    {
      icon: 'fas fa-network-wired',
      label: 'Reachable Peers',
      value: `${overview.system?.fabricNetwork?.peers?.reachable || 0}/${overview.system?.fabricNetwork?.peers?.total || 0}`,
      helper: `${overview.system?.fabricNetwork?.orderers?.reachable || 0}/${overview.system?.fabricNetwork?.orderers?.total || 0} orderers`,
      bg: '#eef2ff',
      color: '#4f46e5',
    },
    {
      icon: 'fas fa-hard-drive',
      label: 'Backup Freshness',
      value: overview.system?.backups?.latestBackupAt ? fmtHours(overview.system?.backups?.backupAgeHours) : 'Missing',
      helper: overview.system?.backups?.status || 'UNAVAILABLE',
      bg: '#fff7ed',
      color: '#c2410c',
    },
    {
      icon: 'fas fa-triangle-exclamation',
      label: 'Active Alerts',
      value: overview.alerts?.total || 0,
      helper: `${overview.alerts?.critical || 0} critical | ${overview.alerts?.high || 0} high`,
      bg: '#fef2f2',
      color: '#b91c1c',
    },
  ] : [];

  return (
    <OfficerLayout title="Admin Dashboard" roleLabel="ADMIN" roleSubtitle="System Administrator" navLinks={ADMIN_NAV_LINKS}>
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{ ...cardStyle, padding: '1.55rem 1.7rem' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: T.text, marginBottom: 6 }}>
            Admin Control Center
          </div>
          <div style={{ color: T.text2, fontSize: '.92rem', maxWidth: 900 }}>
            This panel now combines officer approvals, Fabric and database recovery health, and a recent audit trail in one place.
            Use the recovery actions here after a Fabric reset, a stale vote count, or any integrity mirror drift.
          </div>
        </div>

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
            <div>Loading admin dashboard...</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '1rem' }}>
              <StatCard icon="fas fa-user-clock" label="Pending Officer Approvals" value={registrations.pending.length} bg="#fff7ed" color="#ea580c" />
              <StatCard icon="fas fa-user-check" label="Approved Today" value={registrations.approvedToday} bg="#ecfdf5" color="#059669" />
              <StatCard icon="fas fa-user-times" label="Rejected Today" value={registrations.rejectedToday} bg="#fef2f2" color="#dc2626" />
              <StatCard icon="fas fa-database" label="Properties Pending" value={propertyStats.pending || 0} bg="#eef2ff" color="#4f46e5" />
              <StatCard icon="fas fa-link" label="Mined To Ledger" value={propertyStats.minedToBlockchain || 0} bg="#eff6ff" color="#2563eb" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '1rem' }}>
              {recoveryCards.map((item) => (
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

            <SectionCard
              title="System Health Monitoring"
              subtitle="This gives you the live operating view: API uptime, database responsiveness, Fabric reachability, backup freshness, migrations, and PoA ledger integrity."
              actions={
                <ActionButton
                  icon="fas fa-heart-pulse"
                  label="Refresh Health"
                  onClick={load}
                  tone="secondary"
                />
              }
            >
              <div style={{ display: 'grid', gap: '.8rem' }}>
                <HealthRow
                  label="API Service"
                  status={overview.system?.api?.status}
                  details={`Backend uptime is ${fmtUptime(overview.system?.api?.uptimeSeconds)} in ${overview.system?.api?.environment || 'development'} mode.`}
                  meta={`Last checked ${fmtDateTime(overview.system?.api?.checkedAt)}`}
                />
                <HealthRow
                  label="Database"
                  status={overview.system?.database?.status}
                  details={`Primary PostgreSQL connection is healthy with ${overview.system?.database?.latencyMs ?? '--'} ms response time.`}
                  meta="This check runs a live database round-trip query."
                />
                <HealthRow
                  label="Fabric Network"
                  status={overview.system?.fabricNetwork?.status}
                  details={`${overview.system?.fabricNetwork?.peers?.reachable || 0}/${overview.system?.fabricNetwork?.peers?.total || 0} peers and ${overview.system?.fabricNetwork?.orderers?.reachable || 0}/${overview.system?.fabricNetwork?.orderers?.total || 0} orderers are reachable.`}
                  meta={
                    overview.system?.fabricNetwork?.gatewayReady
                      ? 'Gateway wallet and connection profile are ready.'
                      : overview.system?.fabricNetwork?.gatewayError || 'Gateway still needs attention.'
                  }
                />
                <HealthRow
                  label="Backups"
                  status={overview.system?.backups?.status}
                  details={
                    overview.system?.backups?.latestBackupAt
                      ? `Latest backup ${overview.system?.backups?.latestBackupId || '--'} was created ${fmtHours(overview.system?.backups?.backupAgeHours)} ago using ${overview.system?.backups?.latestBackupMode || '--'}.`
                      : 'No backup is recorded yet.'
                  }
                  meta={
                    overview.system?.backups?.latestRestoreAt
                      ? `Last restore ${fmtDateTime(overview.system?.backups?.latestRestoreAt)}`
                      : 'No restore run has been recorded yet.'
                  }
                />
                <HealthRow
                  label="Migrations"
                  status={overview.system?.migrations?.status}
                  details={`${overview.system?.migrations?.appliedCount || 0} schema migrations are applied.`}
                  meta={
                    overview.system?.migrations?.latestAppliedAt
                      ? `Latest migration ${fmtDateTime(overview.system?.migrations?.latestAppliedAt)}`
                      : 'Migration table not available yet.'
                  }
                />
                <HealthRow
                  label="PoA Ledger Integrity"
                  status={overview.system?.blockchain?.status}
                  details={`${overview.system?.blockchain?.totalBlocks || 0} blocks secure ${overview.system?.blockchain?.totalProperties || 0} properties on the local PoA ledger.`}
                  meta={
                    overview.system?.blockchain?.invalidBlocks
                      ? `${overview.system?.blockchain?.invalidBlocks} invalid blocks need review.`
                      : overview.system?.blockchain?.lastMiningTime
                        ? `Last block mined ${fmtDateTime(overview.system?.blockchain?.lastMiningTime)}`
                        : 'No local PoA blocks have been mined yet.'
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Recovery Actions"
              subtitle="These actions safely reconcile local mirrors and vote counters with the current workflow state. Use the full pass after a Fabric reset."
              actions={
                <ActionButton
                  icon="fas fa-rotate-right"
                  label="Refresh Dashboard"
                  onClick={load}
                  tone="secondary"
                />
              }
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                <ActionButton
                  icon="fas fa-diagram-project"
                  label={recoveryBusy === 'registration' ? 'Running...' : 'Reconcile Registration Cases'}
                  onClick={() => handleRecovery('registration')}
                  disabled={Boolean(recoveryBusy)}
                />
                <ActionButton
                  icon="fas fa-right-left"
                  label={recoveryBusy === 'transfer' ? 'Running...' : 'Reconcile Transfer Cases'}
                  onClick={() => handleRecovery('transfer')}
                  disabled={Boolean(recoveryBusy)}
                />
                <ActionButton
                  icon="fas fa-shield-halved"
                  label={recoveryBusy === 'integrity' ? 'Running...' : 'Refresh Integrity Mirrors'}
                  onClick={() => handleRecovery('integrity')}
                  disabled={Boolean(recoveryBusy)}
                  tone="warning"
                />
                <ActionButton
                  icon="fas fa-wand-magic-sparkles"
                  label={recoveryBusy === 'all' ? 'Running...' : 'Run Full Recovery Pass'}
                  onClick={() => handleRecovery('all')}
                  disabled={Boolean(recoveryBusy)}
                />
              </div>
              {overview?.audit?.topActions?.length ? (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                  {overview.audit.topActions.map((item) => (
                    <StatusChip key={item.actionType} tone="neutral">
                      {item.actionType}: {item.count}
                    </StatusChip>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Active Tamper & Health Alerts"
              subtitle="Critical alerts surface integrity mismatches, ledger tampering, Fabric outages, stale backups, and workflow drift that need action before users are affected."
            >
              {!overview?.alerts?.items?.length ? (
                <div style={{ color: T.muted }}>No active tamper or health alerts right now.</div>
              ) : (
                <div style={{ display: 'grid', gap: '.8rem' }}>
                  {overview.alerts.items.map((alert) => {
                    const canAutoFix = ['INTEGRITY_GAP', 'REGISTRATION_SYNC', 'TRANSFER_SYNC'].includes(alert.category);
                    return (
                      <div key={alert.id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 8 }}>
                          <div style={{ fontWeight: 800, color: T.text }}>{alert.title}</div>
                          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                            <StatusChip tone={toneForStatus(alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'DOWN' : 'DEGRADED')}>
                              {alert.severity}
                            </StatusChip>
                            <StatusChip tone="neutral">{alert.category}</StatusChip>
                          </div>
                        </div>
                        <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 6 }}>{alert.message}</div>
                        <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: '.9rem' }}>
                          {alert.targetType || 'SYSTEM'}{alert.targetId ? ` | ${alert.targetId}` : ''} | {fmtDateTime(alert.occurredAt)}
                        </div>
                        {canAutoFix ? (
                          <ActionButton
                            icon="fas fa-bolt"
                            label={recoveryBusy === alert.category ? 'Working...' : alert.actionLabel || 'Run Fix'}
                            onClick={async () => {
                              setRecoveryBusy(alert.category);
                              await handleAlertAction(alert);
                              setRecoveryBusy('');
                            }}
                            disabled={Boolean(recoveryBusy)}
                            tone="secondary"
                          />
                        ) : (
                          <div style={{ color: '#b45309', fontSize: '.78rem', fontWeight: 700 }}>
                            {alert.actionLabel || 'Manual review required'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
              <SectionCard title="Pending Officer Registrations" subtitle="Approve or reject LRO and DC registrations from the same admin workspace.">
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
                        <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: '0.95rem' }}>User ID: {user.user_id}</div>
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

              <SectionCard title="Property Summary" subtitle="Quick property counts stay visible here alongside the recovery module.">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.85rem' }}>
                  <StatCard icon="fas fa-hourglass-half" label="Pending" value={propertyStats.pending || 0} bg="#fff7ed" color="#ea580c" />
                  <StatCard icon="fas fa-badge-check" label="Approved" value={propertyStats.approved || 0} bg="#ecfdf5" color="#059669" />
                  <StatCard icon="fas fa-triangle-exclamation" label="Rejected" value={propertyStats.rejected || 0} bg="#fef2f2" color="#dc2626" />
                  <StatCard icon="fas fa-unlink" label="Approved But Unmined" value={propertyStats.approvedButUnmined || 0} bg="#eef2ff" color="#4f46e5" />
                </div>
              </SectionCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
              <SectionCard title="Integrity Watchlist" subtitle="These properties are not in the ideal approved-on-chain state yet.">
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
                        <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: 6 }}>Source: {item.proofSource || '--'}</div>
                        <div style={{ color: item.tamperDetected ? '#b91c1c' : T.text2, fontSize: '.78rem', marginBottom: '0.95rem' }}>
                          {item.tamperReason || 'Mirror rebuild can restore the local integrity snapshot for this property.'}
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

              <SectionCard title="Workflow Sync Issues" subtitle="These are the registration and transfer cases where stored counters or status no longer match the live vote rows.">
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: T.text, marginBottom: '.6rem' }}>Registration Cases</div>
                    {!issues.registrationIssues.length ? (
                      <div style={{ color: T.muted, fontSize: '.84rem' }}>Registration workflow is in sync.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '.75rem' }}>
                        {issues.registrationIssues.map((item) => (
                          <div key={item.property_id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 6 }}>
                              <strong style={{ color: T.text }}>{item.property_id}</strong>
                              <StatusChip tone="warning">{item.status}</StatusChip>
                            </div>
                            <div style={{ color: T.text2, fontSize: '.82rem', marginBottom: 4 }}>{item.owner_name || 'Owner unavailable'}</div>
                            <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: '.75rem' }}>
                              Stored {item.stored_approvals}/{item.stored_rejections} vs live {item.live_approvals}/{item.live_rejections}
                            </div>
                            <ActionButton
                              icon="fas fa-screwdriver-wrench"
                              label={recoveryBusy === item.property_id ? 'Repairing...' : 'Repair Case'}
                              onClick={() => handleCaseRepair('registration', item.property_id)}
                              disabled={Boolean(recoveryBusy)}
                              tone="secondary"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, color: T.text, marginBottom: '.6rem' }}>Transfer Cases</div>
                    {!issues.transferIssues.length ? (
                      <div style={{ color: T.muted, fontSize: '.84rem' }}>Transfer workflow is in sync.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '.75rem' }}>
                        {issues.transferIssues.map((item) => (
                          <div key={item.transfer_id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 6 }}>
                              <strong style={{ color: T.text }}>{item.transfer_id}</strong>
                              <StatusChip tone="warning">{item.status}</StatusChip>
                            </div>
                            <div style={{ color: T.text2, fontSize: '.82rem', marginBottom: 4 }}>
                              {item.property_id} | {item.seller_name || 'Seller unavailable'} to {item.buyer_name || 'Buyer unavailable'}
                            </div>
                            <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: '.75rem' }}>
                              Stored {item.stored_approvals}/{item.stored_rejections} vs live {item.live_approvals}/{item.live_rejections}
                            </div>
                            <ActionButton
                              icon="fas fa-screwdriver-wrench"
                              label={recoveryBusy === item.transfer_id ? 'Repairing...' : 'Repair Case'}
                              onClick={() => handleCaseRepair('transfer', item.transfer_id)}
                              disabled={Boolean(recoveryBusy)}
                              tone="secondary"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Recent Audit Trail" subtitle="Admin, officer, and recovery activity lands here so you can see who changed what and when.">
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
                        <th style={{ textAlign: 'left', padding: '.8rem' }}>Details</th>
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
          </>
        )}
      </div>
    </OfficerLayout>
  );
};

export default AdminDashboard;
