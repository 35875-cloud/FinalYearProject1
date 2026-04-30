import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OfficerLayout, { T, S, fmtCnic, fmtDateTime } from './OfficerLayout';

/* ─── DetailItem ─── */
const DetailItem = ({ label, value }) => (
  <div style={{ padding:'10px 12px', background:'#f8f9fa', borderRadius:10 }}>
    <div style={{ fontSize:'.75rem', color:'#64748b', marginBottom:3, fontWeight:500 }}>{label}</div>
    <div style={{ fontWeight:600, color:'#333', fontSize:'.9rem' }}>{value || 'N/A'}</div>
  </div>
);

const downloadRejectedRegistrationMemo = (record) => {
  if (!record) return;

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Rejected Registration Memo - ${record.property_id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 28px; color: #102033; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p { margin: 0 0 18px; color: #4b5563; }
        .tag { display:inline-block; padding:6px 10px; border-radius:999px; background:#fef2f2; color:#b91c1c; font-weight:700; font-size:12px; margin-bottom:16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #dbe4ea; padding: 10px 12px; text-align: left; font-size: 13px; vertical-align: top; }
        th { background:#f8fafc; text-transform: uppercase; font-size: 11px; color:#64748b; letter-spacing:.08em; width: 220px; }
      </style>
    </head>
    <body>
      <div class="tag">Rejected Registration Memo</div>
      <h1>${record.property_id}</h1>
      <p>Prepared from the rejected registration queue for reconsideration or audit review.</p>
      <table>
        <tbody>
          <tr><th>Owner Name</th><td>${record.owner_name || 'N/A'}</td></tr>
          <tr><th>Owner CNIC</th><td>${fmtCnic(record.owner_cnic || '')}</td></tr>
          <tr><th>Father Name</th><td>${record.father_name || 'N/A'}</td></tr>
          <tr><th>District / Tehsil</th><td>${[record.district, record.tehsil].filter(Boolean).join(', ') || 'N/A'}</td></tr>
          <tr><th>Mauza</th><td>${record.mauza || 'N/A'}</td></tr>
          <tr><th>Property Type</th><td>${record.property_type || 'N/A'}</td></tr>
          <tr><th>Area</th><td>${record.area_marla ? `${record.area_marla} Marla` : 'N/A'}</td></tr>
          <tr><th>Rejected By</th><td>${record.rejected_by_name || 'N/A'}</td></tr>
          <tr><th>Submitted Date</th><td>${fmtDateTime(record.created_at)}</td></tr>
          <tr><th>Rejected Date</th><td>${fmtDateTime(record.updated_at)}</td></tr>
          <tr><th>Reason</th><td>${record.rejection_reason || 'No rejection reason recorded'}</td></tr>
        </tbody>
      </table>
    </body>
  </html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Rejected-Registration-${record.property_id || Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
const OfficerRejectedRegistrations = () => {
  const navigate  = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const BASE      = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth','');
  const API       = `${BASE}/api`;

  const [all,       setAll]       = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState('');

  /* ── Load ── */
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/properties/officer-rejected`, { headers: { Authorization:`Bearer ${authToken}` } });
      const d = await r.json();
      if (d.success) {
        const list = d.properties || [];
        setAll(list); setFiltered(list);
      } else setError(d.message);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    if (!authToken) { navigate('/login'); return; }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search ── */
  const handleSearch = (raw) => {
    const v = raw.replace(/\D/g,'');
    setSearch(raw);
    if (!v) { setFiltered(all); return; }
    setFiltered(all.filter(r => (r.owner_cnic||'').replace(/\D/g,'').includes(v)));
  };

  /* ── Reconsider ── */
  const reconsider = async (propertyId, ownerName) => {
    const notes = window.prompt(`Reconsider Registration ${propertyId}\n\nOwner: ${ownerName}\n\nEnter reconsideration notes:`);
    if (!notes?.trim()) return;
    if (!window.confirm(`Move ${propertyId} back to Pending?\n\nThis will allow fresh review.`)) return;
    try {
      const r = await fetch(`${API}/properties/reconsider`, {
        method:'POST', headers: { Authorization:`Bearer ${authToken}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ propertyId, notes }),
      });
      const d = await r.json();
      if (d.success) { alert(`✅ ${propertyId} moved to Pending.\n\nNotes: ${notes}`); load(); }
      else alert('❌ ' + d.message);
    } catch(e) { alert('Error: ' + e.message); }
  };

  const btnStyle = (color) => ({
    flex:1, minWidth:140, padding:'9px 16px', border:'none', borderRadius:10,
    fontWeight:600, cursor:'pointer', background:`linear-gradient(135deg,${color},${color}cc)`,
    color:'white', fontSize:'.82rem', display:'flex', alignItems:'center', gap:6,
    justifyContent:'center', fontFamily:"'DM Sans',sans-serif", transition:'transform .2s, box-shadow .2s',
  });

  /* ═══ RENDER ═══ */
  return (
    <OfficerLayout title="Rejected Registrations">

      {/* Page header */}
      <div style={{ background:'white', borderRadius:20, padding:'1.5rem 2rem', marginBottom:'1.5rem', boxShadow:S.md, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <div style={{ fontSize:'1.6rem', fontWeight:700, color:'#1b5e20', fontFamily:"'Sora',sans-serif", marginBottom:4 }}>
            <i className="fas fa-times-circle" style={{ color:T.danger, marginRight:8 }} />
            Rejected Property Registrations
          </div>
          <p style={{ color:T.muted, margin:0, fontSize:'.875rem' }}>View and manage rejected property registration requests</p>
        </div>
        <span style={{ background:'#fef2f2', color:T.danger, padding:'6px 16px', borderRadius:20, fontWeight:700, fontSize:'.8rem', border:`1px solid #fca5a5` }}>
          <i className="fas fa-times-circle" style={{ marginRight:5 }} />{filtered.length} Rejected
        </span>
      </div>

      {/* Search */}
      <div style={{ background:'white', borderRadius:16, padding:'1.25rem', marginBottom:'1.5rem', boxShadow:S.md }}>
        <div style={{ position:'relative' }}>
          <i className="fas fa-search" style={{ position:'absolute', left:'1rem', top:'50%', transform:'translateY(-50%)', color:'#999', fontSize:'1rem' }} />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search by Owner CNIC (e.g., 12345-1234567-1)"
            maxLength={15}
            style={{ width:'100%', paddingLeft:'3rem', paddingRight:'1rem', paddingTop:'12px', paddingBottom:'12px', border:`2px solid ${T.border}`, borderRadius:12, fontSize:'1rem', outline:'none', fontFamily:"'DM Sans',sans-serif", transition:'border-color .15s' }}
            onFocus={e => { e.target.style.borderColor=T.danger; e.target.style.boxShadow=`0 0 0 3px rgba(239,68,68,.1)`; }}
            onBlur={e => { e.target.style.borderColor=T.border; e.target.style.boxShadow='none'; }}
          />
        </div>
        <small style={{ display:'block', marginTop:6, color:T.muted, fontSize:'.75rem' }}>
          <i className="fas fa-info-circle" style={{ marginRight:4 }} />Search rejected registrations by applicant CNIC
        </small>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', background:'white', borderRadius:20, boxShadow:S.md }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ display:'block', marginBottom:'1rem', color:T.danger }} />
          <p style={{ color:T.muted }}>Loading rejected registrations…</p>
        </div>
      ) : error ? (
        <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'1rem 1.5rem', color:'#991b1b' }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight:8 }} />{error}
          <button onClick={load} style={{ marginLeft:10, padding:'4px 12px', background:T.primary, color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:'.78rem', fontWeight:600 }}>
            <i className="fas fa-sync" style={{ marginRight:4 }} />Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem', background:'white', borderRadius:20, boxShadow:S.md }}>
          <i className="fas fa-check-circle fa-4x" style={{ display:'block', marginBottom:'1rem', color:T.success }} />
          <h4 style={{ color:T.text, marginBottom:'.5rem' }}>No Rejected Registrations Found</h4>
          <p style={{ color:T.muted, margin:0 }}>{search ? 'No matches for your search.' : 'All registrations are either approved or pending.'}</p>
        </div>
      ) : (
        filtered.map(reg => (
          <div key={reg.property_id} style={{
            background:'white', borderRadius:16, padding:'1.5rem', marginBottom:'1.5rem',
            boxShadow:'0 4px 20px rgba(0,0,0,.08)', borderLeft:`6px solid ${T.danger}`,
            transition:'all .3s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 30px rgba(0,0,0,.13)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.08)'; }}
          >
            {/* Card header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem', flexWrap:'wrap', gap:'1rem' }}>
              <div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', fontWeight:700, color:'#1b5e20' }}>{reg.property_id}</div>
                <small style={{ color:T.muted, fontSize:'.72rem' }}>Registration ID: {reg.property_id}</small>
              </div>
              <span style={{ padding:'6px 14px', borderRadius:20, fontWeight:700, fontSize:'.78rem', background:`linear-gradient(135deg,#f44336,#c62828)`, color:'white' }}>
                <i className="fas fa-times-circle" style={{ marginRight:5 }} />REJECTED
              </span>
            </div>

            {/* Rejection reason */}
            {reg.rejection_reason && (
              <div style={{ background:'#ffebee', borderLeft:`4px solid ${T.danger}`, padding:'12px 16px', borderRadius:10, marginBottom:'1rem' }}>
                <div style={{ fontWeight:700, color:T.danger, marginBottom:6, display:'flex', alignItems:'center', gap:6, fontSize:'.85rem' }}>
                  <i className="fas fa-exclamation-triangle" />Rejection Reason
                </div>
                <div style={{ color:'#c62828', fontSize:'.88rem' }}>{reg.rejection_reason}</div>
              </div>
            )}

            {/* Details grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:'1rem', marginBottom:'1.25rem' }}>
              <DetailItem label="Owner Name"     value={reg.owner_name} />
              <DetailItem label="Owner CNIC"     value={fmtCnic(reg.owner_cnic||'')} />
              <DetailItem label="Father's Name"  value={reg.father_name} />
              <DetailItem label="Property Type"  value={reg.property_type} />
              <DetailItem label="Area"           value={`${reg.area_marla || 'N/A'} Marla`} />
              <DetailItem label="Location"       value={`${reg.district||'N/A'}, ${reg.tehsil||'N/A'}`} />
              <DetailItem label="Fard No"        value={reg.fard_no} />
              <DetailItem label="Khasra No"      value={reg.khasra_no} />
              <DetailItem label="Khatooni No"    value={reg.khatooni_no} />
              <DetailItem label="Mauza"          value={reg.mauza} />
              <DetailItem label="Submitted Date" value={fmtDateTime(reg.created_at)} />
              <DetailItem label="Rejected Date"  value={fmtDateTime(reg.updated_at)} />
            </div>

            {/* Rejected by */}
            {reg.rejected_by_name && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'#fce4ec', borderRadius:10, fontSize:'.85rem', marginBottom:'1rem' }}>
                <i className="fas fa-user-shield" style={{ color:T.danger }} />
                <strong>Rejection Authority:</strong> {reg.rejected_by_name}
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:'1rem' }}>
              <button style={btnStyle('#2196f3')}
                onClick={() => downloadRejectedRegistrationMemo(reg)}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 5px 20px rgba(33,150,243,.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}>
                <i className="fas fa-file-export" />Download Memo
              </button>
              <button style={btnStyle('#ff9800')}
                onClick={() => reconsider(reg.property_id, reg.owner_name)}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 5px 20px rgba(255,152,0,.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}>
                <i className="fas fa-redo" />Reconsider Application
              </button>
            </div>
          </div>
        ))
      )}

    </OfficerLayout>
  );
};

export default OfficerRejectedRegistrations;
