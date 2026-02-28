import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import OfficerLayout, { T, S, fmtDateTime } from './OfficerLayout';

/* ─── Helpers ─── */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const DISTRICTS = ['Lahore','Faisalabad','Rawalpindi','Gujranwala','Multan','Sialkot','Sargodha','Sheikhupura','Bahawalpur','Gujrat','Sahiwal','Rahim Yar Khan','Kasur','Okara','Narowal'];
const PROPERTY_TYPES = ['residential','commercial','agricultural','industrial'];

/* ─── StatCard ─── */
const StatCard = ({ icon, number, label, badge, accentColor }) => (
  <div style={{
    background: T.surface, borderRadius:16, padding:'1.5rem',
    boxShadow: S.md, position:'relative', overflow:'hidden',
    borderTop: `4px solid ${accentColor}`,
    transition:'transform .25s, box-shadow .25s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,.12)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=S.md; }}
  >
    <div style={{ width:56, height:56, borderRadius:12, background:`${accentColor}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', color:accentColor, marginBottom:'1rem' }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize:'2.5rem', fontWeight:700, lineHeight:1, marginBottom:'.4rem', color:T.text }}>{number}</div>
    <div style={{ fontSize:'.9rem', color:T.text2, fontWeight:500 }}>{label}</div>
    {badge && (
      <span style={{ display:'inline-block', marginTop:'.5rem', padding:'2px 10px', borderRadius:20, fontSize:'.72rem', fontWeight:700, background:`${accentColor}18`, color:accentColor }}>
        {badge}
      </span>
    )}
  </div>
);

/* ─── ActionCard ─── */
const ActionCard = ({ icon, title, subtitle, to, onClick, accentColor, badge }) => {
  const inner = (
    <div style={{
      background: T.surface, borderRadius:16, padding:'1.25rem 1.5rem',
      boxShadow: S.md, display:'flex', alignItems:'center', gap:16,
      textDecoration:'none', color:'inherit', cursor:'pointer',
      border:`1px solid ${T.border}`, transition:'all .25s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor=accentColor; e.currentTarget.style.boxShadow=`0 8px 28px rgba(0,0,0,.1)`; e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.boxShadow=S.md; e.currentTarget.style.transform='translateY(0)'; }}
    >
      <div style={{ width:50, height:50, borderRadius:14, background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'1.3rem', flexShrink:0, boxShadow:`0 4px 12px ${accentColor}44` }}>
        <i className={icon} />
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:'.92rem', color:T.text, marginBottom:2 }}>{title}</div>
        <div style={{ fontSize:'.78rem', color:T.muted }}>{subtitle}</div>
      </div>
      {badge && <span style={{ background:`${accentColor}18`, color:accentColor, padding:'2px 8px', borderRadius:20, fontSize:'.7rem', fontWeight:700, flexShrink:0 }}>{badge}</span>}
      <i className="fas fa-arrow-right" style={{ color:T.muted, fontSize:'.75rem', flexShrink:0 }} />
    </div>
  );
  if (to) return <Link to={to} style={{ textDecoration:'none' }}>{inner}</Link>;
  return <div onClick={onClick}>{inner}</div>;
};

/* ─── Activity Item ─── */
const ActivityItem = ({ item }) => {
  const icon = item.type === 'REGISTRATION' ? 'fas fa-home' : item.type === 'TRANSFER' ? 'fas fa-exchange-alt' : 'fas fa-bell';
  const color = item.status === 'APPROVED' ? T.success : item.status === 'REJECTED' ? T.danger : T.warning;
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 0', borderBottom:`1px solid ${T.border}` }}>
      <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', color, fontSize:'.8rem', flexShrink:0 }}>
        <i className={icon} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:'.82rem', color:T.text, marginBottom:2 }}>
          {item.description || `${item.type} — ${item.property_id || item.transfer_id}`}
        </div>
        <div style={{ fontSize:'.72rem', color:T.muted }}>{fmtDateTime(item.created_at || item.timestamp)}</div>
      </div>
      <span style={{ background:`${color}18`, color, padding:'2px 8px', borderRadius:20, fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', flexShrink:0 }}>
        {item.status}
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
const OfficerDashboard = () => {
  const navigate   = useNavigate();
  const authToken  = sessionStorage.getItem('authToken');
  const userName   = sessionStorage.getItem('userName') || 'Officer';
  const BASE       = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth','');
  const API        = `${BASE}/api`;

  /* ── State ── */
  const [stats,      setStats]      = useState({ pendingRegistrations:0, pendingTransfers:0, frozenProperties:0, approvedToday:0 });
  const [activities, setActivities] = useState([]);
  const [lastUpdate, setLastUpdate] = useState('Just now');
  const [showModal,  setShowModal]  = useState(false);

  /* Add Record Form */
  const [form, setForm] = useState({
    ownerName:'', ownerCnic:'', fatherName:'', khewatNo:'', khatooniNo:'',
    khasraNo:'', areaMarla:'', propertyType:'residential', district:'',
    tehsil:'', mauza:'', address:'', year: new Date().getFullYear(),
  });
  const [fatherStatus, setFatherStatus] = useState('');
  const [fatherReadOnly, setFatherReadOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg,  setSubmitMsg]  = useState(null);

  /* ── Load data ── */
  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/properties/officer-stats`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) {
        const d = await r.json();
        if (d.success) {
          setStats({
            pendingRegistrations: d.pendingRegistrations || 0,
            pendingTransfers: d.pendingTransfers || 0,
            frozenProperties: d.frozenProperties || 0,
            approvedToday: d.approvedToday || 0,
          });
        }
      }
    } catch(e) { console.error(e); }
    setLastUpdate(new Date().toLocaleTimeString());
  };

  const loadActivities = async () => {
    try {
      const r = await fetch(`${API}/officer/recent-activity`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) { const d = await r.json(); if (d.success) setActivities(d.activities || []); }
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    if (!authToken) { navigate('/login'); return; }
    loadStats();
    loadActivities();
    const iv = setInterval(() => { loadStats(); loadActivities(); }, 30000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── CNIC auto-format ── */
  const handleCnic = (raw) => {
    let v = raw.replace(/\D/g,'');
    if (v.length > 5)  v = v.slice(0,5)  + '-' + v.slice(5);
    if (v.length > 13) v = v.slice(0,13) + '-' + v.slice(13,14);
    setForm(f => ({ ...f, ownerCnic: v }));
  };

  /* ── CNIC blur → fetch father name ── */
  const handleCnicBlur = async () => {
    const cnic = form.ownerCnic.replace(/\D/g,'');
    if (cnic.length !== 13) return;
    setFatherStatus('Checking...');
    try {
      const r = await fetch(`${API}/properties/get-father-name/${cnic}`, { headers: { Authorization: `Bearer ${authToken}` } });
      const d = await r.json();
      if (d.success && d.fatherName) {
        setForm(f => ({ ...f, fatherName: d.fatherName }));
        setFatherReadOnly(true);
        setFatherStatus('✓ Auto-filled from database');
      } else {
        setFatherReadOnly(false);
        setFatherStatus('Please enter father name manually');
      }
    } catch { setFatherReadOnly(false); setFatherStatus('Please enter manually'); }
  };

  /* ── Submit record ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = [];
    if (!form.ownerName)   missing.push('Owner Name');
    if (!form.ownerCnic)   missing.push('CNIC');
    if (!form.fatherName)  missing.push('Father Name');
    if (!form.khewatNo)    missing.push('Khewat Number');
    if (!form.khatooniNo)  missing.push('Khatooni Number');
    if (!form.khasraNo)    missing.push('Khasra Number');
    if (!form.areaMarla)   missing.push('Area (Marla)');
    if (!form.district)    missing.push('District');
    if (!form.tehsil)      missing.push('Tehsil');
    if (missing.length) { setSubmitMsg({ type:'error', text: 'Missing: ' + missing.join(', ') }); return; }

    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const payload = { ...form, ownerCnic: form.ownerCnic.replace(/\D/g,'') };
      const r = await fetch(`${API}/properties/add-property-simple`, {
        method:'POST', headers: { Authorization:`Bearer ${authToken}`, 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.success) {
        setSubmitMsg({ type:'success', text:`✅ Property ${d.propertyId} added — Pending Approval` });
        setForm({ ownerName:'', ownerCnic:'', fatherName:'', khewatNo:'', khatooniNo:'', khasraNo:'', areaMarla:'', propertyType:'residential', district:'', tehsil:'', mauza:'', address:'', year: new Date().getFullYear() });
        setFatherStatus(''); setFatherReadOnly(false);
        loadStats();
        setTimeout(() => { setShowModal(false); setSubmitMsg(null); }, 2000);
      } else {
        setSubmitMsg({ type:'error', text: '❌ ' + d.message });
      }
    } catch(err) {
      setSubmitMsg({ type:'error', text: '❌ ' + err.message });
    }
    setSubmitting(false);
  };

  const inp = (field) => ({
    value: form[field],
    onChange: e => setForm(f => ({ ...f, [field]: e.target.value })),
  });

  const inputStyle = {
    width:'100%', padding:'10px 14px', borderRadius:10, border:`1.5px solid ${T.border}`,
    fontSize:'.875rem', outline:'none', fontFamily:"'DM Sans',sans-serif", color:T.text,
    background:'white', transition:'border-color .15s',
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <OfficerLayout title="Officer Dashboard">

      {/* Welcome bar */}
      <div style={{ background:T.surface, borderRadius:20, padding:'1.5rem 2rem', marginBottom:'2rem', boxShadow:S.md, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem', borderLeft:`5px solid ${T.primary}` }}>
        <div>
          <div style={{ fontFamily:"'Sora',sans-serif", fontSize:'1.6rem', fontWeight:800, color:T.text, marginBottom:4 }}>
            <i className="fas fa-sun" style={{ color:T.warning, marginRight:10 }} />
            {greeting()}, {userName}
          </div>
          <div style={{ color:T.muted, fontSize:'.9rem' }}>Real-time monitoring and management dashboard</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, color:T.muted, fontSize:'.85rem' }}>
          <i className="fas fa-sync-alt" style={{ color:T.primary }} />
          Updated: <strong style={{ color:T.text }}>{lastUpdate}</strong>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1.25rem', marginBottom:'2rem' }}>
        <StatCard icon="fas fa-home"         number={stats.pendingRegistrations} label="Pending Registrations" badge="Requires Action"  accentColor={T.danger}   />
        <StatCard icon="fas fa-exchange-alt" number={stats.pendingTransfers}     label="Pending Transfers"     badge="In Review"        accentColor={T.blue}     />
        <StatCard icon="fas fa-lock"         number={stats.frozenProperties}     label="Frozen Properties"     badge="Court Orders"     accentColor={T.orange}   />
        <StatCard icon="fas fa-check-circle" number={stats.approvedToday}   label="Approved Today"                                accentColor={T.success}  />
      </div>

      {/* Action cards */}
      <div style={{ marginBottom:'2rem' }}>
        <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:'.95rem', color:T.text, marginBottom:'1rem' }}>
          <i className="fas fa-bolt" style={{ color:T.warning, marginRight:8 }} />Quick Actions
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'1rem' }}>
          <ActionCard icon="fas fa-plus-circle"   title="Add New Record"           subtitle="Register new land record"           onClick={() => setShowModal(true)}                           accentColor={T.orange}  badge="Quick Action" />
          <ActionCard icon="fas fa-clipboard-list" title="Pending Registrations"   subtitle="Review and submit clean cases into voting" to="/lro/pending-registrations"                              accentColor={T.danger}  badge={stats.pendingRegistrations > 0 ? `${stats.pendingRegistrations} pending` : null} />
          <ActionCard icon="fas fa-exchange-alt"   title="Pending Transfers"       subtitle="Approve or reject transfers"         to="/lro/pending-transfers"                                  accentColor={T.blue}    badge={stats.pendingTransfers > 0 ? `${stats.pendingTransfers} pending` : null} />
          <ActionCard icon="fas fa-link"           title="Registration Voting"     subtitle="Cast node votes and monitor case progress"   to="/lro/blockchain"                                         accentColor={T.primary} />
          <ActionCard icon="fas fa-shield-alt"     title="Integrity Review"        subtitle="Check clean, tampered and missing"   to="/lro/integrity"                                          accentColor={T.success} />
          <ActionCard icon="fas fa-users"          title="Succession Cases"        subtitle="Inspect recovered inheritance data"  to="/lro/succession"                                         accentColor={T.orange} />
          <ActionCard icon="fas fa-address-card"   title="Citizen History"         subtitle="Search citizen records and transfers" to="/lro/citizen-history"                                  accentColor={T.blue} />
          <ActionCard icon="fas fa-times-circle"   title="Rejected Registrations"  subtitle="View rejected records"               to="/lro/rejected-registrations"                             accentColor={T.muted}   />
          <ActionCard icon="fas fa-ban"            title="Rejected Transfers"       subtitle="View rejected transfer history"      to="/lro/rejected-transfers"                                 accentColor={T.muted}   />
          <ActionCard icon="fas fa-chart-line"     title="Market Dashboard"         subtitle="Trends, rates, analytics"           to="/lro/market"                                             accentColor={T.primaryDark} />
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ background:T.surface, borderRadius:20, padding:'1.5rem', boxShadow:S.md }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:'.95rem', color:T.text }}>
            <i className="fas fa-history" style={{ color:T.primary, marginRight:8 }} />Recent Activity
          </div>
          <button onClick={loadActivities} style={{ border:'none', background:T.bg, borderRadius:8, padding:'5px 12px', fontSize:'.75rem', color:T.text2, cursor:'pointer', fontWeight:600 }}>
            <i className="fas fa-sync-alt" style={{ marginRight:5 }} />Refresh
          </button>
        </div>
        {activities.length === 0 ? (
          <div style={{ textAlign:'center', padding:'2rem', color:T.muted }}>
            <i className="fas fa-inbox fa-2x" style={{ display:'block', marginBottom:'.5rem' }} />
            No recent activity
          </div>
        ) : (
          activities.slice(0,10).map((item, i) => <ActivityItem key={i} item={item} />)
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', marginTop:'2rem', fontSize:'.75rem', color:T.muted }}>
        <i className="fas fa-shield-alt" style={{ marginRight:6 }} />
        Punjab Land Records Authority — Blockchain System v2.8
      </div>

      {/* ════ ADD RECORD MODAL ════ */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:500, backdropFilter:'blur(4px)' }} />
          <div style={{
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            width:'min(900px,95vw)', maxHeight:'90vh',
            background:T.surface, borderRadius:20, zIndex:501,
            display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.25)',
          }}>
            {/* Modal header */}
            <div style={{ background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, padding:'1.25rem 1.5rem', borderRadius:'20px 20px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ color:'white', fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:'1rem' }}>
                <i className="fas fa-plus-circle" style={{ marginRight:8 }} />Add New Land Record
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:'50%', width:32, height:32, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} style={{ flex:1, overflowY:'auto', padding:'1.5rem' }}>
              {submitMsg && (
                <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:'1rem', fontSize:'.85rem', fontWeight:600, background: submitMsg.type==='success' ? '#ecfdf5' : '#fef2f2', color: submitMsg.type==='success' ? '#065f46' : '#991b1b', border:`1px solid ${submitMsg.type==='success' ? '#6ee7b7' : '#fca5a5'}` }}>
                  {submitMsg.text}
                </div>
              )}

              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 14px', marginBottom:'1.5rem', fontSize:'.82rem', color:'#1e40af' }}>
                <i className="fas fa-info-circle" style={{ marginRight:6 }} />
                All fields marked <span style={{ color:T.danger }}>*</span> are required. CNIC will auto-fill Father Name if record exists.
              </div>

              {/* Owner Info */}
              <SectionTitle icon="fas fa-user" label="Owner Information" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
                <Field label="Full Name" required>
                  <input style={inputStyle} placeholder="Enter full name" {...inp('ownerName')} required />
                </Field>
                <Field label="CNIC" required>
                  <input style={inputStyle} placeholder="12345-1234567-1" maxLength={15}
                    value={form.ownerCnic} onChange={e => handleCnic(e.target.value)} onBlur={handleCnicBlur} required />
                </Field>
                <Field label="Father Name" required extra={fatherStatus && <span style={{ fontSize:'.7rem', color: fatherReadOnly ? T.success : T.warning }}>{fatherStatus}</span>}>
                  <input style={inputStyle} placeholder="Enter father name" {...inp('fatherName')} readOnly={fatherReadOnly} required />
                </Field>
              </div>

              {/* Property Info */}
              <SectionTitle icon="fas fa-map" label="Property Information" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
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
                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="Year">
                  <input style={inputStyle} type="number" {...inp('year')} />
                </Field>
              </div>

              {/* Location */}
              <SectionTitle icon="fas fa-map-marker-alt" label="Location" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
                <Field label="District" required>
                  <select style={inputStyle} {...inp('district')} required>
                    <option value="">Select District</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Tehsil" required>
                  <input style={inputStyle} placeholder="Enter tehsil" {...inp('tehsil')} required />
                </Field>
                <Field label="Mauza">
                  <input style={inputStyle} placeholder="Enter mauza (optional)" {...inp('mauza')} />
                </Field>
                <Field label="Address">
                  <input style={inputStyle} placeholder="Street/Area (optional)" {...inp('address')} />
                </Field>
              </div>

              {/* Footer */}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:'1rem', borderTop:`1px solid ${T.border}` }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding:'10px 20px', border:`1.5px solid ${T.border}`, borderRadius:10, background:'white', color:T.text2, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding:'10px 24px', background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, border:'none', borderRadius:10, color:'white', fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:8, opacity: submitting ? .7 : 1 }}>
                  {submitting ? <><i className="fas fa-spinner fa-spin" />Submitting…</> : <><i className="fas fa-check" />Submit Record</>}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

    </OfficerLayout>
  );
};

/* ── Mini helpers ── */
const SectionTitle = ({ icon, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'.75rem', paddingBottom:'.5rem', borderBottom:`2px solid ${T.border}` }}>
    <i className={icon} style={{ color:T.primary }} />
    <span style={{ fontWeight:700, fontSize:'.85rem', color:T.text2, textTransform:'uppercase', letterSpacing:.5 }}>{label}</span>
  </div>
);

const Field = ({ label, required, extra, children }) => (
  <div>
    <label style={{ display:'block', fontWeight:600, fontSize:'.8rem', color:T.text2, marginBottom:5 }}>
      {label} {required && <span style={{ color:T.danger }}>*</span>}
      {extra && <span style={{ float:'right' }}>{extra}</span>}
    </label>
    {children}
  </div>
);

export default OfficerDashboard;
