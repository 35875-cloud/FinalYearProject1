import React, { useEffect, useMemo, useState } from 'react';
import OfficerLayout, { T, S, fmtDateTime } from './OfficerLayout';

function getRowId(row) {
  return row?.succession_request_id || row?.request_no || row?.id || '';
}

function getValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return '';
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function formatPercent(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? `${number}%` : '0%';
}

const StatusPill = ({ value, bg = '#eef2ff', color = '#4338ca' }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    borderRadius: 999,
    background: bg,
    color,
    fontWeight: 800,
    fontSize: '.72rem',
    textTransform: 'uppercase',
    letterSpacing: .3,
  }}>
    {value || 'N/A'}
  </span>
);

const Box = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '0.95rem' }}>
    <div style={{ fontSize: '.69rem', color: T.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45, marginBottom: 6 }}>{label}</div>
    <div style={{ color: T.text, fontWeight: 700, fontSize: '.9rem' }}>{value || 'N/A'}</div>
  </div>
);

const SummaryCard = ({ icon, label, value, toneBg, toneColor, helper }) => (
  <div style={{
    background: '#fff',
    border: `1px solid ${toneBg}`,
    borderRadius: 18,
    padding: '1rem 1.05rem',
    boxShadow: S.sm,
  }}>
    <div style={{
      width: 44,
      height: 44,
      borderRadius: 14,
      background: toneBg,
      color: toneColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1rem',
      marginBottom: '.8rem',
    }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: T.text, lineHeight: 1 }}>
      {value}
    </div>
    <div style={{ marginTop: 8, color: T.text2, fontSize: '.82rem', fontWeight: 800 }}>
      {label}
    </div>
    {helper ? (
      <div style={{ marginTop: 6, color: T.muted, fontSize: '.75rem' }}>
        {helper}
      </div>
    ) : null}
  </div>
);

const Panel = ({ title, subtitle = '', action = null, children }) => (
  <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.3rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: 4 }}>
          {title}
        </div>
        {subtitle ? <div style={{ color: T.text2, fontSize: '.84rem' }}>{subtitle}</div> : null}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const MiniTable = ({ columns, rows, emptyText = 'No rows available.' }) => (
  !rows?.length ? (
    <div style={{ color: T.muted }}>{emptyText}</div>
  ) : (
    <div style={{ display: 'grid', gap: '.65rem' }}>
      {rows.map((row, index) => (
        <div key={index} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '.95rem 1rem', background: '#f8fafc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '.7rem' }}>
            {columns.map((column) => (
              <div key={column.key}>
                <div style={{ fontSize: '.68rem', color: T.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>
                  {column.label}
                </div>
                <div style={{ color: T.text, fontWeight: 700, fontSize: '.86rem' }}>
                  {column.render ? column.render(row) : row[column.key]}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
);

const OfficerSuccessionCases = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tables, setTables] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedId, setSelectedId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [casesResponse, analyticsResponse] = await Promise.all([
        fetch(`${base}/api/officer/succession/cases`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${base}/api/succession/analytics/summary`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const [casesData, analyticsData] = await Promise.all([
        casesResponse.json(),
        analyticsResponse.json(),
      ]);

      if (!casesResponse.ok || !casesData.success) {
        throw new Error(casesData.message || 'Unable to load succession cases');
      }
      if (!analyticsResponse.ok || !analyticsData.success) {
        throw new Error(analyticsData.message || 'Unable to load succession analytics');
      }

      setTables(casesData.tables || []);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const requestTable = tables.find((table) => table.table === 'succession_requests' && table.exists);
  const heirTable = tables.find((table) => table.table === 'succession_heirs' && table.exists);
  const eventTable = tables.find((table) => table.table === 'succession_events' && table.exists);

  const requests = useMemo(() => requestTable?.rows || [], [requestTable]);

  useEffect(() => {
    if (!requests.length) {
      setSelectedId('');
      return;
    }
    if (!requests.some((row) => getRowId(row) === selectedId)) {
      setSelectedId(getRowId(requests[0]));
    }
  }, [requests, selectedId]);

  const selectedRequest = requests.find((row) => getRowId(row) === selectedId) || null;
  const heirs = (heirTable?.rows || []).filter((row) => String(row.succession_request_id) === String(selectedId));
  const events = (eventTable?.rows || []).filter((row) => String(row.succession_request_id) === String(selectedId));

  const downloadSuccessionSnapshot = () => {
    if (!selectedRequest) return;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Succession Snapshot - ${getValue(selectedRequest, ['request_no', 'succession_request_id', 'id'])}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; background: #f8fafc; }
    .card { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #dbe4ea; border-radius: 22px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #27445F, #4E78A5); color: white; padding: 24px 28px; }
    .head h1 { margin: 0 0 6px; font-size: 28px; }
    .head p { margin: 0; opacity: 0.88; }
    .body { padding: 24px 28px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; font-weight: 700; margin-bottom: 6px; }
    .value { font-size: 15px; font-weight: 700; word-break: break-word; }
    .section { margin-top: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .row:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <h1>Succession Snapshot</h1>
      <p>Recovered officer review sheet</p>
    </div>
    <div class="body">
      <div class="grid">
        <div class="box"><div class="label">Request</div><div class="value">${getValue(selectedRequest, ['request_no', 'succession_request_id', 'id']) || 'N/A'}</div></div>
        <div class="box"><div class="label">Property ID</div><div class="value">${getValue(selectedRequest, ['property_id']) || 'N/A'}</div></div>
        <div class="box"><div class="label">LRO Status</div><div class="value">${getValue(selectedRequest, ['lro_status']) || 'N/A'}</div></div>
        <div class="box"><div class="label">DC Status</div><div class="value">${getValue(selectedRequest, ['dc_status']) || 'N/A'}</div></div>
        <div class="box"><div class="label">Current Status</div><div class="value">${getValue(selectedRequest, ['status']) || 'N/A'}</div></div>
        <div class="box"><div class="label">Submitted At</div><div class="value">${fmtDateTime(getValue(selectedRequest, ['submitted_at', 'created_at']))}</div></div>
      </div>
      <div class="section">
        <strong>Heir Allocation</strong>
        ${heirs.length ? heirs.map((heir, index) => `
          <div class="row">
            ${getValue(heir, ['full_name', 'heir_name', 'name', 'nominee_name']) || `Heir ${index + 1}`} ·
            ${getValue(heir, ['relation_type']) || 'N/A'} ·
            Share ${getValue(heir, ['share_percent', 'share_ratio', 'share']) || 'N/A'}
          </div>
        `).join('') : '<div class="row">No heir rows were found in the current recovery snapshot.</div>'}
      </div>
      <div class="section">
        <strong>Audit Trail</strong>
        ${events.length ? events.map((event) => `
          <div class="row">
            ${getValue(event, ['event_type']) || 'Recovered event'} ·
            ${getValue(event, ['actor_role']) || 'N/A'} ·
            ${fmtDateTime(getValue(event, ['created_at']))}
          </div>
        `).join('') : '<div class="row">No event rows were found in the current recovery snapshot.</div>'}
      </div>
    </div>
  </div>
  <script>setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const downloadAnalyticsReport = () => {
    if (!analytics) return;

    const summary = analytics.summary || {};
    const sectionRows = (rows, keys) =>
      rows?.length
        ? rows.map((row) => `
            <tr>${keys.map((key) => `<td>${row[key] ?? 'N/A'}</td>`).join('')}</tr>
          `).join('')
        : '<tr><td colspan="4">No data available.</td></tr>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Succession Analytics Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; background: #f8fafc; }
    .wrap { max-width: 980px; margin: 0 auto; background: #fff; border: 1px solid #dbe4ea; border-radius: 22px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #27445F, #4E78A5); color: white; padding: 24px 28px; }
    .head h1 { margin: 0 0 6px; font-size: 28px; }
    .body { padding: 24px 28px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; font-weight: 700; margin-bottom: 6px; }
    .value { font-size: 24px; font-weight: 800; }
    .section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 13px; }
    th { background: #eff6ff; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>Succession Analytics Report</h1>
      <p>Operational summary and reporting view</p>
    </div>
    <div class="body">
      <div class="grid">
        <div class="card"><div class="label">Total Requests</div><div class="value">${formatNumber(summary.total_requests)}</div></div>
        <div class="card"><div class="label">Open Requests</div><div class="value">${formatNumber(summary.open_requests)}</div></div>
        <div class="card"><div class="label">Completed</div><div class="value">${formatNumber(summary.completed_requests)}</div></div>
        <div class="card"><div class="label">Ready For DC</div><div class="value">${formatNumber(summary.ready_for_dc)}</div></div>
        <div class="card"><div class="label">Rejected</div><div class="value">${formatNumber(summary.rejected_requests)}</div></div>
        <div class="card"><div class="label">Heir Rows</div><div class="value">${formatNumber(summary.total_heir_rows)}</div></div>
      </div>

      <div class="section">
        <h3>Request Type Breakdown</h3>
        <table>
          <tr><th>Request Type</th><th>Count</th><th>Percentage</th></tr>
          ${sectionRows(analytics.requestTypes, ['request_type', 'request_count', 'percentage'])}
        </table>
      </div>

      <div class="section">
        <h3>Heir Relation Breakdown</h3>
        <table>
          <tr><th>Relation</th><th>Count</th><th>Percentage</th></tr>
          ${sectionRows(analytics.heirRelations, ['relation_type', 'heir_count', 'percentage'])}
        </table>
      </div>

      <div class="section">
        <h3>Monthly Trend</h3>
        <table>
          <tr><th>Month</th><th>Requests</th><th>Approved</th><th>Rejected</th></tr>
          ${sectionRows(analytics.monthlyTrend, ['month_label', 'request_count', 'approved_count', 'rejected_count'])}
        </table>
      </div>
    </div>
  </div>
  <script>setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const summary = analytics?.summary || {};

  return (
    <OfficerLayout title="Succession Cases">
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{
          background: 'white',
          borderRadius: 22,
          boxShadow: S.md,
          padding: '1.5rem 1.65rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: T.text, marginBottom: 6 }}>
              Succession Review & Reporting
            </div>
            <div style={{ color: T.text2, fontSize: '.92rem' }}>
              Case review, heir allocations, and succession analytics are combined here for operational reporting.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={downloadAnalyticsReport}
              disabled={!analytics}
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '10px 16px',
                background: 'white',
                color: T.text,
                fontWeight: 700,
                cursor: analytics ? 'pointer' : 'not-allowed',
              }}
            >
              <i className="fas fa-chart-pie" style={{ marginRight: 8 }} />
              Download Report
            </button>
            <button
              onClick={load}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '10px 16px',
                background: `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})`,
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-sync-alt" style={{ marginRight: 8 }} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '4rem', textAlign: 'center', color: T.muted }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem' }} />
            <div>Loading succession data...</div>
          </div>
        ) : error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', padding: '1rem 1.15rem' }}>
            <strong>Succession load error:</strong> {error}
          </div>
        ) : !requestTable?.exists ? (
          <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '2rem' }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: '0.5rem' }}>
              Succession tables are missing in this recovery snapshot
            </div>
            <div style={{ color: T.text2 }}>
              The UI has been restored, but the underlying succession tables are not currently present in the database. Once those tables or routes are restored, this screen will populate automatically.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <SummaryCard icon="fas fa-file-signature" label="Total Requests" value={formatNumber(summary.total_requests)} toneBg="#eef2ff" toneColor="#4338ca" helper="All succession submissions" />
              <SummaryCard icon="fas fa-folder-open" label="Open Requests" value={formatNumber(summary.open_requests)} toneBg="#fff7ed" toneColor="#c2410c" helper="Still under review" />
              <SummaryCard icon="fas fa-scale-balanced" label="Ready For DC" value={formatNumber(summary.ready_for_dc)} toneBg="#eff6ff" toneColor="#1d4ed8" helper="Threshold reached" />
              <SummaryCard icon="fas fa-circle-check" label="Completed" value={formatNumber(summary.completed_requests)} toneBg="#ecfdf5" toneColor="#047857" helper="Closed successfully" />
              <SummaryCard icon="fas fa-circle-xmark" label="Rejected" value={formatNumber(summary.rejected_requests)} toneBg="#fef2f2" toneColor="#b91c1c" helper="Rejected cases" />
              <SummaryCard icon="fas fa-people-group" label="Heir Rows" value={formatNumber(summary.total_heir_rows)} toneBg="#f8fafc" toneColor="#475569" helper={`Avg ${summary.avg_heirs_per_request || 0} heirs/request`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              <Panel title="Request Type Breakdown" subtitle="Which succession flows are being submitted.">
                <MiniTable
                  rows={analytics?.requestTypes || []}
                  columns={[
                    { key: 'request_type', label: 'Request Type' },
                    { key: 'request_count', label: 'Requests', render: (row) => formatNumber(row.request_count) },
                    { key: 'percentage', label: 'Share', render: (row) => formatPercent(row.percentage) },
                  ]}
                />
              </Panel>

              <Panel title="Heir Relation Breakdown" subtitle="How heir rows are distributed across relations.">
                <MiniTable
                  rows={analytics?.heirRelations || []}
                  columns={[
                    { key: 'relation_type', label: 'Relation' },
                    { key: 'heir_count', label: 'Heir Rows', render: (row) => formatNumber(row.heir_count) },
                    { key: 'percentage', label: 'Share', render: (row) => formatPercent(row.percentage) },
                  ]}
                />
              </Panel>

              <Panel title="District Activity" subtitle="Where succession requests are most active.">
                <MiniTable
                  rows={analytics?.topDistricts || []}
                  columns={[
                    { key: 'district', label: 'District' },
                    { key: 'request_count', label: 'Requests', render: (row) => formatNumber(row.request_count) },
                    { key: 'approved_count', label: 'Approved', render: (row) => formatNumber(row.approved_count) },
                    { key: 'avg_heirs', label: 'Avg Heirs', render: (row) => row.avg_heirs || '0' },
                  ]}
                />
              </Panel>

              <Panel title="Property Type Activity" subtitle="Succession load by property type.">
                <MiniTable
                  rows={analytics?.propertyTypes || []}
                  columns={[
                    { key: 'property_type', label: 'Property Type' },
                    { key: 'request_count', label: 'Requests', render: (row) => formatNumber(row.request_count) },
                    { key: 'approved_count', label: 'Approved', render: (row) => formatNumber(row.approved_count) },
                    { key: 'avg_heirs', label: 'Avg Heirs', render: (row) => row.avg_heirs || '0' },
                  ]}
                />
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              <Panel title="Monthly Trend" subtitle="Last six months of succession volume.">
                <MiniTable
                  rows={analytics?.monthlyTrend || []}
                  columns={[
                    { key: 'month_label', label: 'Month' },
                    { key: 'request_count', label: 'Requests', render: (row) => formatNumber(row.request_count) },
                    { key: 'approved_count', label: 'Approved', render: (row) => formatNumber(row.approved_count) },
                    { key: 'rejected_count', label: 'Rejected', render: (row) => formatNumber(row.rejected_count) },
                  ]}
                />
              </Panel>

              <Panel title="Recent Succession Requests" subtitle="Latest submitted or updated cases.">
                <MiniTable
                  rows={analytics?.recentRequests || []}
                  columns={[
                    { key: 'request_no', label: 'Request' },
                    { key: 'property_id', label: 'Property' },
                    { key: 'status', label: 'Status' },
                    { key: 'submitted_at', label: 'Submitted', render: (row) => fmtDateTime(row.submitted_at || row.created_at) },
                  ]}
                />
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
              <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${T.border}`, fontWeight: 800, color: T.text }}>
                  Request Queue
                </div>
                {!requests.length ? (
                  <div style={{ padding: '2rem 1.2rem', color: T.muted }}>No succession requests were found.</div>
                ) : (
                  <div style={{ maxHeight: 720, overflowY: 'auto' }}>
                    {requests.map((row, index) => {
                      const id = getRowId(row);
                      const active = id === selectedId;
                      return (
                        <button
                          key={id || index}
                          onClick={() => setSelectedId(id)}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: active ? '#eef2ff' : 'white',
                            borderBottom: `1px solid ${T.border}`,
                            padding: '0.95rem 1rem',
                            display: 'grid',
                            gridTemplateColumns: '42px minmax(0,1fr)',
                            gap: '0.9rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: active ? T.primaryDark : T.text }}>{index + 1}</div>
                          <div>
                            <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>
                              {getValue(row, ['request_no', 'succession_request_id', 'id']) || 'Recovered case'}
                            </div>
                            <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>
                              Property: {getValue(row, ['property_id']) || 'N/A'}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <StatusPill value={getValue(row, ['status']) || 'PENDING'} />
                              {getValue(row, ['lro_status']) && <StatusPill value={getValue(row, ['lro_status'])} bg="#eff6ff" color="#1d4ed8" />}
                              {getValue(row, ['dc_status']) && <StatusPill value={getValue(row, ['dc_status'])} bg="#ecfdf5" color="#047857" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <Panel
                  title="Selected Case"
                  subtitle={selectedRequest ? 'Review the active succession case and export its detail sheet.' : 'Choose a case to inspect its details.'}
                  action={selectedRequest ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={downloadSuccessionSnapshot}
                        style={{
                          border: 'none',
                          borderRadius: 12,
                          padding: '10px 14px',
                          background: `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})`,
                          color: 'white',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <i className="fas fa-file-export" style={{ marginRight: 8 }} />
                        Download Snapshot
                      </button>
                      <StatusPill value={getValue(selectedRequest, ['status']) || 'PENDING'} />
                    </div>
                  ) : null}
                >
                  {!selectedRequest ? (
                    <div style={{ color: T.muted }}>Select a succession case from the queue to inspect its details.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.85rem' }}>
                      <Box label="Request" value={getValue(selectedRequest, ['request_no', 'succession_request_id', 'id'])} />
                      <Box label="Property ID" value={getValue(selectedRequest, ['property_id'])} />
                      <Box label="Request Type" value={getValue(selectedRequest, ['request_type'])} />
                      <Box label="LRO Status" value={getValue(selectedRequest, ['lro_status'])} />
                      <Box label="DC Status" value={getValue(selectedRequest, ['dc_status'])} />
                      <Box label="Submitted At" value={fmtDateTime(getValue(selectedRequest, ['submitted_at', 'created_at']))} />
                    </div>
                  )}
                </Panel>

                <Panel title="Heir Allocation Snapshot" subtitle="Current calculated heirs and percentages for the selected case.">
                  {!selectedRequest ? (
                    <div style={{ color: T.muted }}>Choose a case to inspect heirs.</div>
                  ) : !heirs.length ? (
                    <div style={{ color: T.muted }}>No heir rows were found for this request in the current recovery snapshot.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                      {heirs.map((heir, index) => (
                        <div key={`${heir.succession_request_id}-${index}`} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '0.95rem', background: '#f8fafc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                            <div style={{ fontWeight: 800, color: T.text }}>
                              {getValue(heir, ['full_name', 'heir_name', 'name', 'nominee_name']) || `Heir ${index + 1}`}
                            </div>
                            <StatusPill value={getValue(heir, ['share_fraction_text', 'share_percent']) || 'N/A'} bg="#ecfdf5" color="#047857" />
                          </div>
                          <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>
                            Relation: {getValue(heir, ['relation_type']) || 'N/A'}
                          </div>
                          <div style={{ color: T.muted, fontSize: '.76rem' }}>
                            Share: {getValue(heir, ['share_percent', 'share_ratio', 'share']) || 'N/A'}
                            {getValue(heir, ['share_basis']) ? ` • ${getValue(heir, ['share_basis'])}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Audit Trail" subtitle="Workflow actions recorded against this succession request.">
                  {!selectedRequest ? (
                    <div style={{ color: T.muted }}>Choose a case to inspect events.</div>
                  ) : !events.length ? (
                    <div style={{ color: T.muted }}>No event rows were found for this request in the current recovery snapshot.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.85rem' }}>
                      {events.map((event, index) => (
                        <div key={`${event.succession_request_id}-${index}`} style={{ borderLeft: `4px solid ${T.primary}`, padding: '0.25rem 0 0.25rem 0.9rem' }}>
                          <div style={{ fontWeight: 800, color: T.text, marginBottom: 3 }}>
                            {getValue(event, ['event_type']) || 'Recovered event'}
                          </div>
                          <div style={{ color: T.text2, fontSize: '.83rem', marginBottom: 3 }}>
                            Actor: {getValue(event, ['actor_role']) || 'N/A'}
                          </div>
                          <div style={{ color: T.muted, fontSize: '.76rem' }}>
                            {fmtDateTime(getValue(event, ['created_at']))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </>
        )}
      </div>
    </OfficerLayout>
  );
};

export default OfficerSuccessionCases;
