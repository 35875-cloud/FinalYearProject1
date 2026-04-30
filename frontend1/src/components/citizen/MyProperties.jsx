import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout, { fmtDate } from './CitizenLayout';

/* ─── Design tokens ──────────────────────────────────────────── */
const C = {
  primary:      '#315d87',
  primaryDark:  '#1f3f5f',
  primaryLight: '#e8f1f8',
  primaryBorder:'#c8d9e8',
  green:        '#1d8a64',
  greenLight:   '#e9f8f1',
  greenBorder:  '#bde5d5',
  gold:         '#b6852d',
  goldLight:    '#fbf4e5',
  goldBorder:   '#ead7a7',
  text:         '#182838',
  text2:        '#42586f',
  muted:        '#7e90a3',
  border:       '#d9e3ec',
  surface:      '#ffffff',
  surface2:     '#f6fafd',
  bg:           '#eef4f9',
};

/* ─── Inline styles scoped to this page ─────────────────────── */
const S = {
  /* Page wrapper */
  page: {
    padding: '0 0 3rem',
    maxWidth: 1160,
    margin: '0 auto',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },

  /* ── Page Header ── */
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.875rem' },
  headerIcon: {
    width: 44, height: 44,
    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: '1rem', flexShrink: 0,
    boxShadow: '0 4px 14px rgba(13,124,124,.30)',
  },
  eyebrow: {
    fontSize: '.63rem', fontWeight: 800, letterSpacing: '.14em',
    textTransform: 'uppercase', color: C.primary, marginBottom: 2,
  },
  pageTitle: {
    fontFamily: "'Sora', system-ui, sans-serif",
    fontSize: '1.25rem', fontWeight: 800, color: C.text, margin: 0,
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' },

  /* ── Chips / Counts ── */
  chip: (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 11px', borderRadius: 100,
    fontSize: '.73rem', fontWeight: 700,
    background: color === 'teal' ? C.primaryLight : color === 'green' ? C.greenLight : '#f1f5f9',
    color: color === 'teal' ? C.primary : color === 'green' ? C.green : '#475569',
    border: `1px solid ${color === 'teal' ? C.primaryBorder : color === 'green' ? C.greenBorder : '#e2e8f0'}`,
  }),

  /* ── Buttons ── */
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 14,
    background: 'rgba(255,255,255,.92)', border: `1.5px solid ${C.border}`,
    color: C.text2, fontSize: '.82rem', fontWeight: 600,
    cursor: 'pointer', transition: 'all .18s',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 14,
    background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`, border: 'none',
    color: '#fff', fontSize: '.82rem', fontWeight: 600,
    cursor: 'pointer', transition: 'all .18s',
    boxShadow: '0 14px 28px rgba(49,93,135,.22)',
  },

  /* ── Outer container — single white card wrapping all content ── */
  outerCard: {
    background: 'linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,251,254,.98))',
    border: `1px solid ${C.border}`,
    borderRadius: 28,
    boxShadow: '0 20px 46px rgba(32,58,86,.10), 0 6px 16px rgba(24,40,56,.04)',
    overflow: 'hidden',
    marginBottom: '1.5rem',
  },

  /* ── Section header bar inside card ── */
  cardSectionBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.1rem 1.45rem',
    borderBottom: `1px solid ${C.border}`,
    background: 'linear-gradient(180deg, #fbfdff, #f3f8fc)',
  },
  cardSectionLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  cardSectionDot: (color = C.primary) => ({
    width: 8, height: 32, borderRadius: 4,
    background: color, flexShrink: 0,
  }),
  sectionTitle: {
    fontFamily: "'Sora', system-ui, sans-serif",
    fontSize: '.95rem', fontWeight: 700, color: C.text, margin: 0,
  },
  sectionDesc: { fontSize: '.75rem', color: C.muted, margin: '2px 0 0' },
  cardCount: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 11px', borderRadius: 100,
    fontSize: '.73rem', fontWeight: 700,
    background: C.primaryLight, color: C.primary,
    border: `1px solid ${C.primaryBorder}`,
  },

  /* ── Property row (list item) ── */
  propRow: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '1rem 1.45rem',
    borderBottom: `1px solid ${C.border}`,
    transition: 'background .15s',
    background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
  },
  propRowIndex: {
    width: 34, height: 34, borderRadius: 10,
    background: C.goldLight, border: `1px solid ${C.goldBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Sora', system-ui, sans-serif",
    fontSize: '.72rem', fontWeight: 800, color: C.gold, flexShrink: 0,
  },
  propRowIcon: {
    width: 46, height: 46, borderRadius: 14,
    background: 'linear-gradient(135deg, #eef5fb, #dbe9f5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: C.primary, fontSize: '1rem', flexShrink: 0,
  },
  propRowMain: { flex: 1, minWidth: 0 },
  propRowTitle: {
    fontFamily: "'Sora', system-ui, sans-serif",
    fontSize: '1rem', fontWeight: 800, color: C.text,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  propRowMeta: {
    display: 'flex', gap: '1.1rem', marginTop: 6, flexWrap: 'wrap',
  },
  metaItem: { display: 'flex', gap: 4, alignItems: 'baseline' },
  metaLabel: { fontSize: '.68rem', color: C.muted, fontWeight: 600 },
  metaValue: { fontSize: '.76rem', color: C.text2, fontWeight: 600 },
  metaMono: { fontFamily: "'JetBrains Mono', monospace", fontSize: '.7rem' },

  /* ── Share row (same list style as propRow but green accent) ── */
  shareRow: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '1rem 1.45rem',
    borderBottom: `1px solid ${C.border}`,
    transition: 'background .15s',
    background: 'linear-gradient(180deg, #ffffff 0%, #fcfffd 100%)',
    borderLeft: `4px solid ${C.green}`,
  },
  shareRowIcon: {
    width: 46, height: 46, borderRadius: 14,
    background: 'linear-gradient(135deg, #eefbf5, #daf4e8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: C.green, fontSize: '1rem', flexShrink: 0,
  },

  /* ── Spacer (remove last border) ── */
  propRowLast: { borderBottom: 'none' },

  /* ── Status pill ── */
  pill: (tone) => {
    const map = {
      success: { bg: '#d1fae5', color: '#059669', dot: '#059669' },
      warning: { bg: '#fef3c7', color: '#92400e', dot: '#d97706' },
      danger:  { bg: '#fee2e2', color: '#991b1b', dot: '#dc2626' },
      primary: { bg: C.primaryLight, color: C.primary, dot: C.primary },
      neutral: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
    };
    const t = map[tone] || map.neutral;
    return {
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 100,
      fontSize: '.7rem', fontWeight: 700,
      background: t.bg, color: t.color,
      '--dot': t.dot,
    };
  },

  /* ── Detail overlay ── */
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(14,25,38,.56)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem',
    overflowY: 'auto',
  },
  detailPanel: {
    width: '100%', maxWidth: 960,
    maxHeight: '88vh',
    background: 'linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: 28,
    border: `1px solid rgba(255,255,255,.55)`,
    boxShadow: '0 30px 80px rgba(0,0,0,.28)',
  },
  detailHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    background: `linear-gradient(135deg, ${C.primaryDark} 0%, ${C.primary} 100%)`,
    color: '#fff', flexShrink: 0,
  },
  detailHeaderLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  detailHeaderIcon: {
    width: 42, height: 42, borderRadius: 12,
    background: C.primaryLight,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.1rem',
  },
  detailTitle: {
    fontFamily: "'Sora', system-ui, sans-serif",
    fontSize: '1.05rem', fontWeight: 800, margin: 0,
  },
  detailSub: { fontSize: '.75rem', color: 'rgba(255,255,255,.7)', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '.85rem',
  },
  detailBody: { padding: '1.5rem', flex: 1, overflowY: 'auto' },
  detailGroup: { marginBottom: '1.5rem' },
  detailGroupLabel: {
    fontSize: '.63rem', fontWeight: 800, letterSpacing: '.14em',
    textTransform: 'uppercase', color: C.primary,
    borderBottom: `1px solid ${C.primaryLight}`, paddingBottom: 6, marginBottom: 10,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '.625rem',
  },
  detailField: {
    background: C.surface2, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '10px 12px',
  },
  detailFieldLabel: {
    fontSize: '.63rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.1em', color: C.muted, marginBottom: 4,
  },
  detailFieldValue: {
    fontSize: '.85rem', fontWeight: 600, color: C.text,
    wordBreak: 'break-all',
  },
  hashBox: {
    background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
    borderRadius: 10, padding: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '.75rem', color: C.text2, wordBreak: 'break-all',
    marginBottom: '.625rem',
  },
  hashBoxLabel: {
    fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.12em', color: C.primary, marginBottom: 5,
  },
  detailFooter: {
    padding: '1rem 1.5rem',
    borderTop: `1px solid ${C.border}`,
    display: 'flex', gap: '.75rem', flexWrap: 'wrap',
    flexShrink: 0, background: 'linear-gradient(180deg, #fcfdff, #f2f7fb)',
  },

  /* ── States ── */
  emptyState: {
    textAlign: 'center', padding: '3.5rem 2rem',
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 16,
    background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 1rem', color: C.primary, fontSize: '1.3rem',
  },
  infoStrip: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
    borderRadius: 10, padding: '12px 14px',
    fontSize: '.82rem', color: C.primaryDark, marginBottom: '1rem',
  },
};

/* ─── Helpers ────────────────────────────────────────────────── */
const STATUS = {
  APPROVED:         { label: 'Approved',  tone: 'success' },
  PENDING_APPROVAL: { label: 'Pending',   tone: 'warning' },
  FROZEN:           { label: 'Frozen',    tone: 'primary' },
  REJECTED:         { label: 'Rejected',  tone: 'danger'  },
};

const getFreezeDetails = (property) => {
  if (!property?.is_frozen) return null;
  return property.freeze_details || {
    reasonCode: property.freeze_reason_code || null,
    reasonLabel: property.freeze_reason_label || 'Dispute Hold',
    referenceNo: property.freeze_reference_no || null,
    notes: property.freeze_notes || null,
    authorityRole: property.freeze_authority_role || null,
    authorityUserId: property.freeze_authority_user_id || null,
    startedAt: property.freeze_started_at || null,
  };
};

const getEncumbranceDetails = (property) => {
  if (!property?.is_encumbered) return null;
  return property.encumbrance_details || {
    active: true,
    count: Number(property.active_encumbrance_count || 0),
    summaryLabel: property.encumbrance_summary || 'Active Encumbrance',
    recordedAt: property.last_encumbrance_recorded_at || null,
    releasedAt: property.last_encumbrance_released_at || null,
    items: property.active_encumbrances || [],
  };
};

const getCoOwnershipDetails = (property) => {
  return null;
};

const getConsentDetails = (property) => {
  const consent = property?.sale_transfer_consent || null;
  if (!consent) return null;
  return {
    ...consent,
    participants: Array.isArray(consent.participants) ? consent.participants : [],
  };
};

const getConsentPill = (consent) => {
  if (!consent?.required) return null;
  if (consent.actionableForViewer) return { label: 'Your Consent Needed', tone: 'danger' };
  if (consent.status === 'APPROVED') return { label: 'Consent Approved', tone: 'success' };
  if (consent.status === 'REJECTED') return { label: 'Consent Rejected', tone: 'danger' };
  if (consent.status === 'PENDING') return { label: 'Consent Pending', tone: 'warning' };
  return { label: 'Consent Not Started', tone: 'neutral' };
};

const getDisplayStatus = (property) => {
  const key = property?.is_frozen ? 'FROZEN' : String(property?.status || 'PENDING_APPROVAL').toUpperCase();
  return STATUS[key] || STATUS.PENDING_APPROVAL;
};

const priceFmt  = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(n)}` : '—';
};
const propTypeFmt = (v) => v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : '—';
const relationFmt = (v) => v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';
const sharePctFmt = (v) => { const n = Number(v); return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—'; };

const proofState = (proof) => {
  if (!proof) return null;
  if (proof.integrity === 'TRANSFERRED' || proof.source === 'TRANSFER_BLOCKCHAIN') return { label: 'Transferred on Chain', tone: 'success' };
  if (proof.onChain && ['APPROVED','FINALIZED','DC_APPROVED','LRO_APPROVED','COMPLETED'].includes(String(proof.chainStatus||'').toUpperCase())) return { label: 'Approved on Chain', tone: 'success' };
  if (proof.source === 'LEGACY_BLOCKCHAIN_LEDGER') return { label: 'Legacy Mirror', tone: 'warning' };
  if (proof.mirrorOnly || proof.source === 'LOCAL_MIRROR_ONLY') return { label: 'DB Mirror Only', tone: 'warning' };
  if (proof.integrity === 'CLEAN') return { label: 'Verified Clean', tone: 'success' };
  if (proof.integrity === 'TAMPERED') return { label: 'Tampered', tone: 'danger' };
  if (proof.onChain) return { label: 'On Chain', tone: 'primary' };
  return { label: 'Not Anchored', tone: 'neutral' };
};

/* ─── Pill ───────────────────────────────────────────────────── */
const Pill = ({ label, tone = 'neutral' }) => (
  <span style={S.pill(tone)}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dot)', flexShrink: 0 }} />
    {label}
  </span>
);

/* ─── Detail field ───────────────────────────────────────────── */
const Field = ({ label, value, mono }) => (
  <div style={S.detailField}>
    <div style={S.detailFieldLabel}>{label}</div>
    <div style={{ ...S.detailFieldValue, fontFamily: mono ? "'JetBrains Mono', monospace" : undefined, fontSize: mono ? '.78rem' : '.85rem' }}>
      {value || '—'}
    </div>
  </div>
);

/* ─── Property List Row (owned) ─────────────────────────────── */
const downloadPropertyProof = (property, proofLabel) => {
  if (!property) return;
  const freeze = getFreezeDetails(property);
  const coOwnership = getCoOwnershipDetails(property);
  const encumbrance = getEncumbranceDetails(property);
  const displayStatus = getDisplayStatus(property);

  const rows = [
    ['Property ID', property.property_id || 'N/A'],
    ['Owner Name', property.owner_name || 'N/A'],
    ['Owner CNIC', property.owner_cnic || 'N/A'],
    ['Father Name', property.father_name || 'N/A'],
    ['District / Tehsil', [property.district, property.tehsil].filter(Boolean).join(', ') || 'N/A'],
    ['Mauza', property.mauza || 'N/A'],
    ['Khasra No.', property.khasra_no || 'N/A'],
    ['Khatooni No.', property.khatooni_no || 'N/A'],
    ['Khewat No.', property.khewat_no || 'N/A'],
    ['Area', property.area_marla ? `${property.area_marla} Marla` : 'N/A'],
    ['Property Type', propTypeFmt(property.property_type)],
    ['Status', displayStatus.label || property.status || 'N/A'],
    ['Dispute Hold', property.is_frozen ? 'Active' : 'No'],
    ['Hold Reason', freeze?.reasonLabel || 'N/A'],
    ['Hold Reference', freeze?.referenceNo || 'N/A'],
    ['Hold Started', fmtDate(freeze?.startedAt)],
    ['Ownership Model', coOwnership?.ownershipModel || property.ownership_model || 'SOLE'],
    ['Co-Owners', coOwnership?.count || 0],
    ['Co-Owner Summary', coOwnership?.summaryLabel || 'N/A'],
    ['Encumbrance', encumbrance?.active ? 'Active' : 'No'],
    ['Encumbrance Summary', encumbrance?.summaryLabel || 'N/A'],
    ['Encumbrance Count', encumbrance?.count || 0],
    ['Encumbrance Recorded', fmtDate(encumbrance?.recordedAt)],
    ['Proof Status', proofLabel || 'Not Anchored'],
    ['Proof Source', property.proof?.source || 'N/A'],
    ['Chain Status', property.proof?.chainStatus || 'N/A'],
    ['Anchored At', fmtDate(property.proof?.anchoredAt)],
    ['Downloaded At', new Date().toLocaleString('en-PK')],
  ];

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Property Proof - ${property.property_id || 'Record'}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 28px; color: #102033; }
        h1 { margin: 0 0 6px; font-size: 24px; }
        p { margin: 0 0 18px; color: #4b5563; }
        .tag { display:inline-block; padding:6px 10px; border-radius:999px; background:#e6f4f4; color:#0d7c7c; font-weight:700; font-size:12px; margin-bottom:16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align:left; border:1px solid #dbe4ea; padding:10px 12px; font-size:14px; vertical-align:top; }
        th { width: 220px; background:#f8fafc; text-transform:uppercase; font-size:11px; letter-spacing:.08em; color:#64748b; }
      </style>
    </head>
    <body>
      <div class="tag">Citizen Property Proof</div>
      <h1>${property.property_id || 'Property Record'}</h1>
      <p>This summary captures the current visible registry and proof status for citizen review.</p>
      <table>
        <tbody>
          ${rows.map(([label, value]) => `<tr><th>${label}</th><td>${value || 'N/A'}</td></tr>`).join('')}
        </tbody>
      </table>
    </body>
  </html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Property-Proof-${property.property_id || Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const PropRow = ({ property, idx, onOpen, isLast }) => {
  const status = getDisplayStatus(property);
  const coOwnership = getCoOwnershipDetails(property);
  const consent = getConsentDetails(property);
  const consentPill = getConsentPill(consent);
  const proof  = proofState(property.proof);
  const encumbrance = getEncumbranceDetails(property);
  const loc    = [property.district, property.tehsil].filter(Boolean).join(', ') || 'Registered Property';

  return (
    <div
      style={{ ...S.propRow, ...(isLast ? S.propRowLast : {}) }}
    >
      <div style={S.propRowIndex}>{idx + 1}</div>
      <div style={S.propRowIcon}><i className="fas fa-home" /></div>

      <div style={S.propRowMain}>
        <div style={S.propRowTitle}>{loc}</div>
        <div style={S.propRowMeta}>
          <div style={S.metaItem}>
            <span style={S.metaLabel}>Type</span>
            <span style={S.metaValue}>{propTypeFmt(property.property_type)}</span>
          </div>
          {property.area_marla && (
            <div style={S.metaItem}>
              <span style={S.metaLabel}>Area</span>
              <span style={S.metaValue}>{property.area_marla} Marla</span>
            </div>
          )}
          {property.khasra_no && (
            <div style={S.metaItem}>
              <span style={S.metaLabel}>Khasra</span>
              <span style={{ ...S.metaValue, ...S.metaMono }}>{property.khasra_no}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <Pill label={status.label} tone={status.tone} />
        {coOwnership?.active && <Pill label={coOwnership.summaryLabel || `${coOwnership.count} Co-Owners`} tone="primary" />}
        {consentPill && <Pill label={consentPill.label} tone={consentPill.tone} />}
        {encumbrance?.active && <Pill label={encumbrance.summaryLabel || 'Encumbered'} tone="warning" />}
        {proof && <Pill label={proof.label} tone={proof.tone} />}
      </div>

      <button
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 18px', borderRadius: 10,
          background: 'linear-gradient(135deg, #ffce12 0%, #f8bd19 100%)',
          border: 'none',
          color: '#000000',
          fontSize: '.82rem', fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(255,206,18,.40)',
          textShadow: 'none',
        }}
        onClick={onOpen}
        onMouseEnter={e => { e.currentTarget.style.background = '#e6a800'; e.currentTarget.style.color = '#000000'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #ffce12 0%, #f8bd19 100%)'; e.currentTarget.style.color = '#000000'; }}
      >
        <i className="fas fa-eye" /> Details
      </button>
    </div>
  );
};

/* ─── Shared Allocation Row ──────────────────────────────────── */
const ShareCard = ({ property, onOpen, isLast }) => {
  const share  = property.viewer_share || property.shareAllocation || {};
  const proof  = proofState(property.proof);
  const consent = getConsentDetails(property);
  const consentPill = getConsentPill(consent);
  const status = getDisplayStatus(property);
  const encumbrance = getEncumbranceDetails(property);
  const loc    = [property.district, property.tehsil].filter(Boolean).join(', ') || 'Shared Property';

  return (
    <div
      style={{ ...S.shareRow, ...(isLast ? S.propRowLast : {}) }}
    >
      <div style={S.shareRowIcon}><i className="fas fa-sitemap" /></div>

      <div style={S.propRowMain}>
        <div style={S.propRowTitle}>{loc}</div>
        <div style={S.propRowMeta}>
          {property.mauza && (
            <div style={S.metaItem}>
              <span style={S.metaLabel}>Mauza</span>
              <span style={S.metaValue}>{property.mauza}</span>
            </div>
          )}
          <div style={S.metaItem}>
            <span style={S.metaLabel}>Type</span>
            <span style={S.metaValue}>{propTypeFmt(property.property_type)}</span>
          </div>
          {share.share_fraction_text && (
            <div style={S.metaItem}>
              <span style={S.metaLabel}>Fraction</span>
              <span style={S.metaValue}>{share.share_fraction_text}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <Pill label={status.label} tone={status.tone} />
        {consentPill && <Pill label={consentPill.label} tone={consentPill.tone} />}
        {encumbrance?.active && <Pill label={encumbrance.summaryLabel || 'Encumbered'} tone="warning" />}
        {share.share_percent && (
          <span style={{ ...S.pill('success'), fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} />
            {sharePctFmt(share.share_percent)}
          </span>
        )}
        {proof && <Pill label={proof.label} tone={proof.tone} />}
        {share.relation_type && <Pill label={relationFmt(share.relation_type)} tone="neutral" />}
      </div>

      <button
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 18px', borderRadius: 10,
          background: 'linear-gradient(135deg, #ffce12 0%, #f8bd19 100%)',
          border: 'none', color: '#000000',
          fontSize: '.82rem', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(255,206,18,.40)',
          textShadow: 'none',
        }}
        onClick={onOpen}
        onMouseEnter={e => { e.currentTarget.style.background = '#e6a800'; e.currentTarget.style.color = '#000000'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #ffce12 0%, #f8bd19 100%)'; e.currentTarget.style.color = '#000000'; }}
      >
        <i className="fas fa-eye" /> Details
      </button>
    </div>
  );
};

/* ─── Full-Screen Detail Panel ───────────────────────────────── */
const DetailPanel = ({ property, loading, onClose, onOpenSuccession, onManageSale, onOpenOwnershipHistory }) => {
  useEffect(() => {
    if (!property) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', handler); };
  }, [property, onClose]);

  if (!property) return null;

  const status       = getDisplayStatus(property);
  const freeze       = getFreezeDetails(property);
  const coOwnership  = getCoOwnershipDetails(property);
  const encumbrance  = getEncumbranceDetails(property);
  const proof        = proofState(property.proof);
  const shareCtx     = property.viewer_share || property.shareAllocation || null;
  const loc          = [property.district, property.tehsil].filter(Boolean).join(', ') || 'Property Details';
  const saleBlocked  = Boolean(freeze || coOwnership?.active || encumbrance?.active);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.detailPanel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.detailHeader}>
          <div style={S.detailHeaderLeft}>
            <div style={{...S.detailHeaderIcon, color: C.primary}}><i className="fas fa-home" /></div>
            <div>
              <div style={S.detailTitle}>{loc}</div>
              <div style={S.detailSub}>
                {[property.mauza, propTypeFmt(property.property_type)].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Status bar */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 1.5rem', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', background: '#fafafa' }}>
          <Pill label={status.label} tone={status.tone} />
          {coOwnership?.active && <Pill label={coOwnership.summaryLabel || `${coOwnership.count} Co-Owners`} tone="primary" />}
          {encumbrance?.active && <Pill label={encumbrance.summaryLabel || 'Encumbered'} tone="warning" />}
          {proof && <Pill label={proof.label} tone={proof.tone} />}
          {shareCtx && <Pill label={`${sharePctFmt(shareCtx.share_percent)} Share`} tone="primary" />}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 1.5rem', background: '#e0f2f2', color: '#065f5f', fontSize: '.82rem', fontWeight: 600 }}>
            <i className="fas fa-spinner fa-spin" /> Loading latest proof details…
          </div>
        )}

        {freeze && (
          <div style={{ ...S.infoStrip, margin: '1rem 1.5rem 0' }}>
            <i className="fas fa-lock" style={{ marginTop: 2 }} />
            <div>
              <strong>Dispute hold is active.</strong> {freeze.reasonLabel || 'This property is frozen.'}
              {freeze.referenceNo ? ` Reference: ${freeze.referenceNo}.` : ''}
              {freeze.startedAt ? ` Started ${fmtDate(freeze.startedAt)}.` : ''}
              {freeze.notes ? ` ${freeze.notes}` : ''}
            </div>
          </div>
        )}

        {coOwnership?.active && (
          <div style={{ ...S.infoStrip, margin: freeze ? '0.75rem 1.5rem 0' : '1rem 1.5rem 0', background: '#ecfeff', borderColor: '#a5f3fc', color: '#155e75' }}>
            <i className="fas fa-people-group" style={{ marginTop: 2 }} />
            <div>
              <strong>Joint ownership is active.</strong> {coOwnership.summaryLabel || 'This property has registered co-owners.'}
              {coOwnership.syncedAt ? ` Synced ${fmtDate(coOwnership.syncedAt)}.` : ''}
            </div>
          </div>
        )}

        {encumbrance?.active && (
          <div style={{ ...S.infoStrip, margin: freeze || coOwnership?.active ? '0.75rem 1.5rem 0' : '1rem 1.5rem 0', background: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' }}>
            <i className="fas fa-file-circle-exclamation" style={{ marginTop: 2 }} />
            <div>
              <strong>Active encumbrance is recorded.</strong> {encumbrance.summaryLabel || 'This property is under a mortgage or lien hold.'}
              {encumbrance.recordedAt ? ` Recorded ${fmtDate(encumbrance.recordedAt)}.` : ''}
            </div>
          </div>
        )}

        {/* Body */}
        <div style={S.detailBody}>

          {/* Location */}
          <div style={S.detailGroup}>
            <div style={S.detailGroupLabel}><i className="fas fa-map-marked-alt" style={{ marginRight: 6 }} />Location</div>
            <div style={S.detailGrid}>
              <Field label="District"   value={property.district} />
              <Field label="Tehsil"     value={property.tehsil} />
              <Field label="Mauza"      value={property.mauza} />
              <Field label="Khasra No." value={property.khasra_no} mono />
              {property.khatooni_no && <Field label="Khatooni No." value={property.khatooni_no} mono />}
              {property.khewat_no   && <Field label="Khewat No."   value={property.khewat_no}   mono />}
            </div>
          </div>

          {/* Property Info */}
          <div style={S.detailGroup}>
            <div style={S.detailGroupLabel}><i className="fas fa-home" style={{ marginRight: 6 }} />Property Information</div>
            <div style={S.detailGrid}>
              <Field label="Type"        value={propTypeFmt(property.property_type)} />
              <Field label="Area (Marla)" value={property.area_marla} />
              {property.fard_no  && <Field label="Fard No."  value={property.fard_no}  mono />}
              {property.year     && <Field label="Year"      value={property.year} />}
              <Field label="Sale Status" value={freeze ? 'Blocked by dispute hold' : coOwnership?.active ? 'Blocked by joint ownership' : encumbrance?.active ? 'Blocked by active encumbrance' : property.is_for_sale ? 'Listed for Sale' : 'Not Listed'} />
              {property.is_for_sale && <Field label="Asking Price" value={priceFmt(property.asking_price)} />}
            </div>
          </div>

          {/* Owner */}
          <div style={S.detailGroup}>
            <div style={S.detailGroupLabel}><i className="fas fa-user" style={{ marginRight: 6 }} />Owner Information</div>
            <div style={S.detailGrid}>
              <Field label="Owner Name"  value={property.owner_name} />
              <Field label="Father Name" value={property.father_name} />
              <Field label="Owner CNIC"  value={property.owner_cnic} mono />
              <Field label="Ownership Model" value={coOwnership?.ownershipModel || property.ownership_model || 'SOLE'} />
            </div>
            {/* Property ID full width */}
            <div style={{ ...S.hashBox, marginTop: 8 }}>
              <div style={S.hashBoxLabel}>Property ID</div>
              {property.property_id || '—'}
            </div>
          </div>

          {coOwnership?.active && (
            <div style={S.detailGroup}>
              <div style={S.detailGroupLabel}><i className="fas fa-people-group" style={{ marginRight: 6 }} />Joint Ownership Register</div>
              <div style={S.detailGrid}>
                <Field label="Co-Owners" value={coOwnership.count} />
                <Field label="Summary" value={coOwnership.summaryLabel} />
                <Field label="Synced On" value={fmtDate(coOwnership.syncedAt)} />
                <Field label="Allocated Share" value={coOwnership.totalAllocatedPercent ? `${coOwnership.totalAllocatedPercent}%` : '—'} />
              </div>
              {(coOwnership.items || []).length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {coOwnership.items.map((item) => (
                    <div key={item.allocationId || item.allocation_id || `${item.ownerCnic || item.owner_cnic || item.ownerName || item.owner_name}-${item.grantedAt || item.granted_at || ''}`} style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#155e75' }}>{item.ownerName || item.owner_name || 'Co-Owner'}</div>
                        <div style={{ fontSize: '.78rem', color: '#0f766e', fontWeight: 700 }}>
                          {sharePctFmt(item.sharePercent ?? item.share_percent)}{(item.shareFractionText || item.share_fraction_text) ? ` • ${item.shareFractionText || item.share_fraction_text}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '.8rem', color: '#155e75', marginTop: 4 }}>
                        {[relationFmt(item.relationType || item.relation_type), item.ownerCnic || item.owner_cnic, fmtDate(item.grantedAt || item.granted_at)].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Share allocation */}
          {shareCtx && (
            <div style={S.detailGroup}>
              <div style={S.detailGroupLabel}><i className="fas fa-sitemap" style={{ marginRight: 6 }} />Your Allocation</div>
              <div style={S.detailGrid}>
                <Field label="Approved Share"   value={sharePctFmt(shareCtx.share_percent)} />
                <Field label="Share Fraction"   value={shareCtx.share_fraction_text} />
                <Field label="Relation"         value={relationFmt(shareCtx.relation_type)} />
                <Field label="Request No."      value={shareCtx.request_no} mono />
                <Field label="Activated On"     value={fmtDate(shareCtx.granted_at)} />
              </div>
            </div>
          )}

          {encumbrance?.active && (
            <div style={S.detailGroup}>
              <div style={S.detailGroupLabel}><i className="fas fa-file-circle-exclamation" style={{ marginRight: 6 }} />Encumbrance Register</div>
              <div style={S.detailGrid}>
                <Field label="Summary" value={encumbrance.summaryLabel} />
                <Field label="Active Records" value={encumbrance.count} />
                <Field label="Recorded On" value={fmtDate(encumbrance.recordedAt)} />
              </div>
              {(encumbrance.items || []).length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {encumbrance.items.map((item) => (
                    <div key={item.encumbranceId || `${item.typeLabel}-${item.recordedAt || ''}`} style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: '.78rem', fontWeight: 800, color: '#9a3412' }}>{item.typeLabel || 'Encumbrance'}</div>
                      <div style={{ fontSize: '.82rem', color: '#7c2d12', marginTop: 4 }}>
                        {[item.holderName, item.referenceNo].filter(Boolean).join(' • ') || 'Reference pending'}
                      </div>
                      {item.notes ? (
                        <div style={{ fontSize: '.8rem', color: '#9a3412', marginTop: 6 }}>{item.notes}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


        </div>

        
          <button
            style={S.btnSecondary}
            onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text2; }}
          >
            <i className="fas fa-arrow-left" /> Back
          </button>
        </div>
      </div>
    
  );
};

/* ─── Empty State ────────────────────────────────────────────── */
const EmptyState = () => (
  <div style={S.emptyState}>
    <div style={S.emptyIcon}><i className="fas fa-home" /></div>
    <div style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: 6 }}>No Properties Found</div>
    <div style={{ fontSize: '.84rem', color: '#6b7280' }}>Your registered properties will appear here once added by the Land Record Officer.</div>
  </div>
);

/* ─── Main Page ──────────────────────────────────────────────── */
const MyProperties = () => {
  const navigate  = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const BASE      = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [ownedProperties,  setOwnedProperties]  = useState([]);
  const [sharedProperties, setSharedProperties] = useState([]);
  const [claimSync,        setClaimSync]         = useState(null);
  const [loading,          setLoading]           = useState(true);
  const [error,            setError]             = useState('');
  const [shareWarning,     setShareWarning]      = useState('');
  const [selected,         setSelected]          = useState(null);
  const [detailLoading,    setDetailLoading]      = useState(false);

  useEffect(() => {
    if (!authToken) navigate('/login');
    else load();
  }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    setError('');
    setShareWarning('');
    try {
      const [ownedResult, shareResult] = await Promise.allSettled([
        fetch(`${BASE}/api/properties/my-properties`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${BASE}/api/properties/my-share-properties`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
      ]);

      if (ownedResult.status !== 'fulfilled') {
        throw new Error('Failed to load properties');
      }

      const oData = await ownedResult.value.json();
      if (!oData.success) {
        setError(oData.message || 'Failed to load properties');
        return;
      }

      setOwnedProperties(oData.properties || []);

      if (shareResult.status === 'fulfilled') {
        const sData = await shareResult.value.json();
        if (sData.success) {
          setSharedProperties(sData.shares || []);
          setClaimSync(sData.claimSync || null);
        } else {
          setSharedProperties([]);
          setClaimSync(null);
          setShareWarning(sData.message || 'Share allocations are temporarily unavailable.');
        }
      } else {
        setSharedProperties([]);
        setClaimSync(null);
        setShareWarning('Share allocations are temporarily unavailable.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (property) => {
    setSelected(property);
    setDetailLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/properties/property/${property.property_id}`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) {
        setSelected({
          ...property,
          ...(data.property || {}),
          proof:                   data.proof || data.property?.proof || property.proof,
          viewer_share:            data.viewerShare || data.property?.viewer_share || property.viewer_share || property.shareAllocation || null,
          shareAllocation:         data.viewerShare || data.property?.viewer_share || property.viewer_share || property.shareAllocation || null,
          blockchainHistory:       data.blockchainHistory || [],
          registrationLedgerHistory: data.registrationLedgerHistory || [],
        });
      }
    } catch { /* keep list data */ }
    finally { setDetailLoading(false); }
  };

  const totalCount = ownedProperties.length + sharedProperties.length;

  return (
    <CitizenLayout
      title="My Properties"
      topbarActions={
        <button
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,.92)', border: `1.5px solid ${C.border}`,
            color: C.text2, fontSize: '.82rem', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onClick={load}
          disabled={loading}
        >
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`} /> Refresh
        </button>
      }
    >
      <style>{`
        @keyframes rowIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        .mp-row-in { animation: rowIn .24s cubic-bezier(.4,0,.2,1) both; }
      `}</style>

      <div style={S.page}>
        {/* ── Stats ── */}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: '1.5rem',
        }}>
          {[
            { label: 'Total Records',    value: totalCount,              icon: 'fas fa-layer-group',  bg: '#EEF4FA', color: '#315D87', border: '#DCE7F2' },
            { label: 'Direct Ownership', value: ownedProperties.length,  icon: 'fas fa-home',         bg: '#FBF4E5', color: '#B6852D', border: '#ECD9AD' },
            { label: 'Family Shares',    value: sharedProperties.length, icon: 'fas fa-sitemap',      bg: '#E9F8F1', color: '#1D8A64', border: '#CFEBDD' },
            { label: loading ? 'Syncing' : 'Registry View', value: loading ? '...' : 'Ready', icon: 'fas fa-shield-check', bg: '#EEF4FA', color: '#315D87', border: '#DCE7F2' },
          ].map((card) => (
            <div key={card.label} style={{
              background: '#ffffff',
              border: `1px solid ${card.border}`,
              borderRadius: 18,
              padding: '1.1rem 1.2rem',
              boxShadow: '0 2px 12px rgba(49,93,135,.07)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: card.bg, color: card.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', flexShrink: 0,
              }}>
                <i className={card.icon} />
              </div>
              <div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: C.text, lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: C.muted, marginTop: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {card.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Notices ── */}
        {!loading && (sharedProperties.length > 0 || claimSync?.linkedAllocations > 0) && (
          <div style={S.infoStrip}>
            <i className="fas fa-sitemap" style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              <strong>Family shares are now visible here.</strong>{' '}
              Approved succession allocations are linked to heirs by citizen account or CNIC.
            </span>
          </div>
        )}
        {!loading && !error && shareWarning && (
          <div style={{ ...S.infoStrip, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
            <i className="fas fa-info-circle" style={{ color: '#d97706', flexShrink: 0 }} />
            <span>{shareWarning}</span>
          </div>
        )}
        {error && (
          <div style={{ ...S.infoStrip, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
            <i className="fas fa-exclamation-triangle" style={{ color: '#dc2626', flexShrink: 0 }} />
            <span>
              <strong>Failed to load properties.</strong> {error}{' '}
              <button onClick={load} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
            </span>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={S.outerCard}>
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: C.primary }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem' }} />
              <div style={{ marginTop: 12, fontWeight: 600, color: C.text2 }}>Loading your properties…</div>
            </div>
          </div>
        )}

        {/* ── Content — single outer card ── */}
        {!loading && !error && (
          <div style={S.outerCard}>

            {/* Empty */}
            {ownedProperties.length === 0 && sharedProperties.length === 0 && <EmptyState />}

            {/* ── Direct Ownership section ── */}
            {ownedProperties.length > 0 && (
              <>
                <div style={S.cardSectionBar}>
                  <div style={S.cardSectionLeft}>
                    <div style={S.cardSectionDot(C.primary)} />
                    <div>
                      <div style={S.sectionTitle}>Direct Ownership</div>
                      <div style={S.sectionDesc}>Properties fully registered to your account</div>
                    </div>
                  </div>
                  <span style={S.cardCount}>
                    <i className="fas fa-home" style={{ fontSize: '.65rem' }} />
                    {ownedProperties.length}
                  </span>
                </div>
                {ownedProperties.map((p, i) => (
                  <div key={p.property_id} className="mp-row-in" style={{ animationDelay: `${i * 40}ms` }}>
                    <PropRow
                      property={p}
                      idx={i}
                      onOpen={() => openDetail(p)}
                      isLast={i === ownedProperties.length - 1 && sharedProperties.length === 0}
                    />
                  </div>
                ))}
              </>
            )}

            {/* ── Family Allocation section ── */}
            {sharedProperties.length > 0 && (
              <>
                <div style={{ ...S.cardSectionBar, borderTop: ownedProperties.length > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={S.cardSectionLeft}>
                    <div style={S.cardSectionDot(C.green)} />
                    <div>
                      <div style={S.sectionTitle}>Family Allocation</div>
                      <div style={S.sectionDesc}>Approved shares linked to your account through succession</div>
                    </div>
                  </div>
                  <span style={{ ...S.cardCount, background: C.greenLight, color: C.green, borderColor: C.greenBorder }}>
                    <i className="fas fa-sitemap" style={{ fontSize: '.65rem' }} />
                    {sharedProperties.length}
                  </span>
                </div>
                {sharedProperties.map((p, i) => (
                  <div key={`${p.viewer_share?.allocation_id || p.property_id}-${i}`} className="mp-row-in" style={{ animationDelay: `${i * 40}ms` }}>
                    <ShareCard
                      property={p}
                      onOpen={() => openDetail(p)}
                      isLast={i === sharedProperties.length - 1}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <DetailPanel
        property={selected}
        loading={detailLoading}
        onClose={() => setSelected(null)}
        onOpenOwnershipHistory={(p) => navigate(`/citizen/ownership-history?propertyId=${p.property_id}`)}
        onOpenSuccession={(p) => navigate(`/citizen/succession?propertyId=${p.property_id}`)}
        onManageSale={(p) => navigate(`/citizen/seller?propertyId=${p.property_id}`)}
      />
    </CitizenLayout>
  );
};

export default MyProperties;
