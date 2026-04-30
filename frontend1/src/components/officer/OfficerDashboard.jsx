/**
 * OfficerDashboard.jsx
 * ─────────────────────────────────────────────────────────────
 * LRO dashboard rebuilt to use LROLayout — the same unified-card
 * shell pattern as CitizenDashboard / CitizenLayout.
 * All data-fetching and modal logic preserved from the original.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OfficerLayout, { T, S, fmtDateTime } from './OfficerLayout';
/* ─── helpers ─────────────────────────────────────────────────── */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const DISTRICTS = [
  'Lahore', 'Faisalabad', 'Rawalpindi', 'Gujranwala', 'Multan', 'Sialkot',
  'Sargodha', 'Sheikhupura', 'Bahawalpur', 'Gujrat', 'Sahiwal',
  'Rahim Yar Khan', 'Kasur', 'Okara', 'Narowal',
];
const PROPERTY_TYPES = ['residential', 'commercial', 'agricultural', 'industrial'];

/* ─── sub-components ──────────────────────────────────────────── */
const StatCard = ({ icon, number, label, badge, accentColor }) => (
  <div
    style={{
      background: T.surface,
      borderRadius: 22,
      padding: '1.35rem 1.4rem',
      boxShadow: S.md,
      position: 'relative',
      overflow: 'hidden',
      borderTop: `4px solid ${accentColor}`,
      border: `1px solid ${T.border}`,
      transition: 'transform .25s, box-shadow .25s',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,.11)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = S.md;
    }}
  >
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 14,
        background: `${accentColor}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.1rem',
        color: accentColor,
      }}
    >
      <i className={icon} />
    </div>
    <div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color: T.text, lineHeight: 1 }}>{number}</div>
      <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.muted, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      {badge && (
        <span
          style={{
            display: 'inline-block',
            marginTop: 8,
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: '.68rem',
            fontWeight: 700,
            background: `${accentColor}18`,
            color: accentColor,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  </div>
);


const SectionTitle = ({ icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: `2px solid ${T.border}` }}>
    <i className={icon} style={{ color: T.primary }} />
    <span style={{ fontWeight: 700, fontSize: '.85rem', color: T.text2, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
  </div>
);

const Field = ({ label, required, extra, children }) => (
  <div>
    <label style={{ display: 'block', fontWeight: 600, fontSize: '.8rem', color: T.text2, marginBottom: 5 }}>
      {label} {required ? <span style={{ color: T.danger }}>*</span> : null}
      {extra ? <span style={{ float: 'right' }}>{extra}</span> : null}
    </label>
    {children}
  </div>
);

/* ─── OfficerDashboard ────────────────────────────────────────── */
const OfficerDashboard = () => {
  const navigate  = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const userName  = sessionStorage.getItem('userName') || 'Officer';
  const BASE      = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');
  const API       = `${BASE}/api`;

  const [stats, setStats] = useState({
    pendingRegistrations: 0,
    pendingTransfers: 0,
    frozenProperties: 0,
    approvedToday: 0,
  });
  const [lastUpdate,  setLastUpdate]  = useState('Just now');
  const [showModal,   setShowModal]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitMsg,   setSubmitMsg]   = useState(null);
  const [fatherStatus,    setFatherStatus]    = useState('');
  const [fatherReadOnly,  setFatherReadOnly]  = useState(false);

  const [form, setForm] = useState({
    ownerName: '', ownerCnic: '', fatherName: '',
    khewatNo: '', khatooniNo: '', khasraNo: '',
    areaMarla: '', propertyType: 'residential',
    district: '', tehsil: '', mauza: '', address: '',
    year: new Date().getFullYear(),
  });

  /* ── data loaders ── */
  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/properties/officer-stats`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) {
        const d = await r.json();
        if (d.success) {
          setStats({
            pendingRegistrations: d.pendingRegistrations || 0,
            pendingTransfers:     d.pendingTransfers     || 0,
            frozenProperties:     d.frozenProperties     || 0,
            approvedToday:        d.approvedToday        || 0,
          });
        }
      }
    } catch (e) { console.error(e); }
    setLastUpdate(new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }));
  };


  useEffect(() => {
    if (!authToken) { navigate('/login'); return; }
    loadStats();
    const iv = setInterval(() => {
      loadStats();
    }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── CNIC helpers ── */
  const handleCnic = (raw) => {
    let v = raw.replace(/\D/g, '');
    if (v.length > 5)  v = v.slice(0, 5)  + '-' + v.slice(5);
    if (v.length > 13) v = v.slice(0, 13) + '-' + v.slice(13, 14);
    setForm((f) => ({ ...f, ownerCnic: v }));
  };

  const handleCnicBlur = async () => {
    const cnic = form.ownerCnic.replace(/\D/g, '');
    if (cnic.length !== 13) return;
    setFatherStatus('Checking...');
    try {
      const r = await fetch(`${API}/properties/get-father-name/${cnic}`, { headers: { Authorization: `Bearer ${authToken}` } });
      const d = await r.json();
      if (d.success && d.fatherName) {
        setForm((f) => ({ ...f, fatherName: d.fatherName }));
        setFatherReadOnly(true);
        setFatherStatus('Auto-filled from database');
      } else {
        setFatherReadOnly(false);
        setFatherStatus('Please enter father name manually');
      }
    } catch {
      setFatherReadOnly(false);
      setFatherStatus('Please enter manually');
    }
  };

  /* ── form submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = [];
    if (!form.ownerName)  missing.push('Owner Name');
    if (!form.ownerCnic)  missing.push('CNIC');
    if (!form.fatherName) missing.push('Father Name');
    if (!form.khewatNo)   missing.push('Khewat Number');
    if (!form.khatooniNo) missing.push('Khatooni Number');
    if (!form.khasraNo)   missing.push('Khasra Number');
    if (!form.areaMarla)  missing.push('Area (Marla)');
    if (!form.district)   missing.push('District');
    if (!form.tehsil)     missing.push('Tehsil');
    if (missing.length) { setSubmitMsg({ type: 'error', text: 'Missing: ' + missing.join(', ') }); return; }

    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const payload = { ...form, ownerCnic: form.ownerCnic.replace(/\D/g, '') };
      const r = await fetch(`${API}/properties/add-property-simple`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.success) {
        setSubmitMsg({ type: 'success', text: `Property ${d.propertyId} added — Pending Approval` });
        setForm({
          ownerName: '', ownerCnic: '', fatherName: '',
          khewatNo: '', khatooniNo: '', khasraNo: '',
          areaMarla: '', propertyType: 'residential',
          district: '', tehsil: '', mauza: '', address: '',
          year: new Date().getFullYear(),
        });
        setFatherStatus('');
        setFatherReadOnly(false);
        loadStats();
        setTimeout(() => { setShowModal(false); setSubmitMsg(null); }, 2000);
      } else {
        setSubmitMsg({ type: 'error', text: d.message || 'Unable to add property' });
      }
    } catch (err) {
      setSubmitMsg({ type: 'error', text: err.message });
    }
    setSubmitting(false);
  };

  const inp = (field) => ({
    value: form[field],
    onChange: (e) => setForm((f) => ({ ...f, [field]: e.target.value })),
  });

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1.5px solid ${T.border}`,
    fontSize: '.875rem',
    outline: 'none',
    fontFamily: "'DM Sans',sans-serif",
    color: T.text,
    background: 'white',
    transition: 'border-color .15s',
  };

  /* ── render ── */
  return (
    <OfficerLayout
      title="Officer Dashboard"
      topBarActions={
        <button
          onClick={() => setShowModal(true)}
          style={{
            border: 'none',
            borderRadius: 12,
            padding: '8px 15px',
            background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
            color: 'white',
            fontWeight: 700,
            fontSize: '.82rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 6px 20px rgba(102,126,234,.28)',
            fontFamily: "'Sora',sans-serif",
          }}
        >
          <i className="fas fa-plus-circle" />
          New Record
        </button>
      }
    >
      {/* ── Greeting banner ── */}
      <div
        style={{
          background: T.surface,
          borderRadius: 22,
          padding: '1.5rem 2rem',
          marginBottom: '2rem',
          boxShadow: S.md,
          border: `1px solid ${T.border}`,
          borderLeft: `5px solid ${T.primary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '1.45rem', fontWeight: 800, color: T.text, marginBottom: 4 }}>
            <i className="fas fa-sun" style={{ color: T.warning, marginRight: 10 }} />
            {greeting()}, {userName}
          </div>
          <div style={{ color: T.muted, fontSize: '.88rem' }}>Real-time monitoring and management dashboard</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted, fontSize: '.85rem' }}>
          <i className="fas fa-sync-alt" style={{ color: T.primary }} />
          Updated: <strong style={{ color: T.text, marginLeft: 4 }}>{lastUpdate}</strong>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <StatCard icon="fas fa-home"         number={stats.pendingRegistrations} label="Pending Registrations" badge="Requires Action" accentColor={T.danger} />
        <StatCard icon="fas fa-exchange-alt" number={stats.pendingTransfers}     label="Pending Transfers"     badge="In Review"       accentColor={T.blue} />
        <StatCard icon="fas fa-lock"         number={stats.frozenProperties}     label="Frozen Properties"     badge="Court Orders"    accentColor={T.orange} />
        <StatCard icon="fas fa-check-circle" number={stats.approvedToday}        label="Approved Today"                                accentColor={T.success} />
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '.75rem', color: T.muted }}>
        <i className="fas fa-shield-alt" style={{ marginRight: 6 }} />
        Punjab Land Records Authority · Blockchain System v2.8
      </div>

      {/* ── New Record Modal ── */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, backdropFilter: 'blur(4px)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(900px,95vw)',
              maxHeight: '90vh',
              background: T.surface,
              borderRadius: 24,
              zIndex: 501,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(0,0,0,.25)',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
                padding: '1.25rem 1.5rem',
                borderRadius: '24px 24px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ color: 'white', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '1rem' }}>
                <i className="fas fa-plus-circle" style={{ marginRight: 8 }} />
                Add New Land Record
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.9rem' }}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {submitMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, marginBottom: '1rem', fontSize: '.85rem', fontWeight: 600,
                  background: submitMsg.type === 'success' ? T.successBg : T.dangerBg,
                  color:      submitMsg.type === 'success' ? '#065f46'   : '#991b1b',
                  border: `1px solid ${submitMsg.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
                }}>
                  {submitMsg.text}
                </div>
              )}

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: '1.5rem', fontSize: '.82rem', color: '#1e40af' }}>
                <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
                All fields marked <span style={{ color: T.danger }}>*</span> are required. CNIC will auto-fill father name if a record already exists.
              </div>

              <SectionTitle icon="fas fa-user" label="Owner Information" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Field label="Full Name" required>
                  <input style={inputStyle} placeholder="Enter full name" {...inp('ownerName')} required />
                </Field>
                <Field label="CNIC" required>
                  <input
                    style={inputStyle}
                    placeholder="12345-1234567-1"
                    maxLength={15}
                    value={form.ownerCnic}
                    onChange={(e) => handleCnic(e.target.value)}
                    onBlur={handleCnicBlur}
                    required
                  />
                </Field>
                <Field
                  label="Father Name"
                  required
                  extra={fatherStatus
                    ? <span style={{ fontSize: '.7rem', color: fatherReadOnly ? T.success : T.warning }}>{fatherStatus}</span>
                    : null}
                >
                  <input style={inputStyle} placeholder="Enter father name" {...inp('fatherName')} readOnly={fatherReadOnly} required />
                </Field>
              </div>

              <SectionTitle icon="fas fa-map" label="Property Information" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Field label="Khewat No" required>
                  <input style={inputStyle} placeholder="e.g. 123" {...inp('khewatNo')} required />
                </Field>
                <Field label="Khatooni No" required>
                  <input style={inputStyle} placeholder="e.g. 456" {...inp('khatooniNo')} required />
                </Field>
                <Field label="Khasra No" required>
                  <input style={inputStyle} placeholder="e.g. 789" {...inp('khasraNo')} required />
                </Field>
                <Field label="Area (Marla)" required>
                  <input style={inputStyle} type="number" step="0.01" placeholder="e.g. 5" {...inp('areaMarla')} required />
                </Field>
                <Field label="Property Type">
                  <select style={inputStyle} {...inp('propertyType')}>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Year">
                  <input style={inputStyle} type="number" {...inp('year')} />
                </Field>
              </div>

              <SectionTitle icon="fas fa-map-marker-alt" label="Location" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Field label="District" required>
                  <select style={inputStyle} {...inp('district')} required>
                    <option value="">Select District</option>
                    {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Tehsil" required>
                  <input style={inputStyle} placeholder="Enter tehsil" {...inp('tehsil')} required />
                </Field>
                <Field label="Mauza">
                  <input style={inputStyle} placeholder="Enter mauza (optional)" {...inp('mauza')} />
                </Field>
                <Field label="Address">
                  <input style={inputStyle} placeholder="Street or area (optional)" {...inp('address')} />
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: '1rem', borderTop: `1px solid ${T.border}` }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 20px', border: `1.5px solid ${T.border}`, borderRadius: 10, background: 'white', color: T.text2, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 24px',
                    background: `linear-gradient(135deg,${T.primaryDark},${T.primary})`,
                    border: 'none',
                    borderRadius: 10,
                    color: 'white',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting
                    ? <><i className="fas fa-spinner fa-spin" /> Submitting…</>
                    : <><i className="fas fa-check" /> Submit Record</>}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </OfficerLayout>
  );
};

export default OfficerDashboard;