import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OfficerLayout, { T, S, fmt, fmtCnic, fmtDateTime } from './OfficerLayout';

const DetailItem = ({ label, value }) => (
  <div style={{ padding:'10px 12px', background:'white', borderRadius:10 }}>
    <div style={{ fontSize:'.75rem', color:'#64748b', marginBottom:3 }}>{label}</div>
    <div style={{ fontWeight:600, color:'#333', fontSize:'.9rem' }}>{value || 'N/A'}</div>
  </div>
);

const SectionBox = ({ icon, title, children }) => (
  <div style={{ background:'#f8f9fa', borderRadius:10, padding:'1rem', marginBottom:'1rem' }}>
    <div style={{ fontWeight:700, color:'#666', marginBottom:'.75rem', display:'flex', alignItems:'center', gap:6, fontSize:'.85rem' }}>
      <i className={icon} />{title}
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:'1rem' }}>
      {children}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
const OfficerRejectedTransfers = () => {
  const navigate  = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const BASE      = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth','');
  const API       = `${BASE}/api`;

  const [all,      setAll]      = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState('');

  /* ── Load ── */
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/transfers/officer-rejected`, { headers: { Authorization:`Bearer ${authToken}` } });
      const d = await r.json();
      if (d.success) {
        const list = d.transfers || [];
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
    setFiltered(all.filter(t => {
      const s = (t.seller_cnic||'').replace(/\D/g,'');
      const b = (t.buyer_cnic||'').replace(/\D/g,'');
      return s.includes(v) || b.includes(v);
    }));
  };

  /* ── Reconsider ── */
  const reconsider = async (transferId, propertyId, buyerName) => {
    const notes = window.prompt(`Reconsider Transfer ${transferId}\n\nProperty: ${propertyId}\nBuyer: ${buyerName}\n\nEnter reconsideration notes:`);
    if (!notes?.trim()) return;
    if (!window.confirm(`Move ${transferId} back to Pending?`)) return;
    try {
      const r = await fetch(`${API}/transfers/reconsider`, {
        method:'POST', headers: { Authorization:`Bearer ${authToken}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ transferId, notes }),
      });
      const d = await r.json();
      if (d.success) { alert(`✅ Transfer ${transferId} moved to Pending.\n\nNotes: ${notes}`); load(); }
      else alert('❌ ' + d.message);
    } catch(e) { alert('Error: ' + e.message); }
  };

  const btnStyle = (color) => ({
    flex:1, minWidth:140, padding:'9px 16px', border:'none', borderRadius:10, fontWeight:600,
    cursor:'pointer', background:`linear-gradient(135deg,${color},${color}cc)`, color:'white',
    fontSize:'.82rem', display:'flex', alignItems:'center', gap:6, justifyContent:'center',
    fontFamily:"'DM Sans',sans-serif", transition:'transform .2s, box-shadow .2s',
  });

  /* ═══ RENDER ═══ */
  return (
    <OfficerLayout title="Rejected Transfers">

      {/* Page header */}
      <div style={{ background:'white', borderRadius:20, padding:'1.5rem 2rem', marginBottom:'1.5rem', boxShadow:S.md, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <div style={{ fontSize:'1.6rem', fontWeight:700, color:'#1b5e20', fontFamily:"'Sora',sans-serif", marginBottom:4 }}>
            <i className="fas fa-times-circle" style={{ color:T.danger, marginRight:8 }} />
            Rejected Property Transfers
          </div>
          <p style={{ color:T.muted, margin:0, fontSize:'.875rem' }}>View and manage rejected property transfer requests</p>
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
            placeholder="Search by CNIC (Current or New Owner)" maxLength={15}
            style={{ width:'100%', paddingLeft:'3rem', paddingRight:'1rem', paddingTop:'12px', paddingBottom:'12px', border:`2px solid ${T.border}`, borderRadius:12, fontSize:'1rem', outline:'none', fontFamily:"'DM Sans',sans-serif" }}
            onFocus={e => { e.target.style.borderColor=T.danger; e.target.style.boxShadow=`0 0 0 3px rgba(239,68,68,.1)`; }}
            onBlur={e => { e.target.style.borderColor=T.border; e.target.style.boxShadow='none'; }}
          />
        </div>
        <small style={{ display:'block', marginTop:6, color:T.muted, fontSize:'.75rem' }}>
          <i className="fas fa-info-circle" style={{ marginRight:4 }} />Search by seller or buyer CNIC
        </small>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', background:'white', borderRadius:20, boxShadow:S.md }}>
          <i className="fas fa-spinner fa-spin fa-3x" style={{ display:'block', marginBottom:'1rem', color:T.danger }} />
          <p style={{ color:T.muted }}>Loading rejected transfers…</p>
        </div>
      ) : error ? (
        <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'1rem 1.5rem', color:'#991b1b' }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight:8 }} />{error}
          <button onClick={load} style={{ marginLeft:10, padding:'4px 12px', background:T.primary, color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:'.78rem', fontWeight:600 }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem', background:'white', borderRadius:20, boxShadow:S.md }}>
          <i className="fas fa-check-circle fa-4x" style={{ display:'block', marginBottom:'1rem', color:T.success }} />
          <h4 style={{ color:T.text, marginBottom:'.5rem' }}>No Rejected Transfers Found</h4>
          <p style={{ color:T.muted, margin:0 }}>{search ? 'No matches for your search.' : 'All transfers are either approved or pending.'}</p>
        </div>
      ) : (
        filtered.map(t => (
          <div key={t.transfer_id} style={{
            background:'white', borderRadius:16, padding:'1.5rem', marginBottom:'1.5rem',
            boxShadow:'0 4px 20px rgba(0,0,0,.08)', borderLeft:`6px solid ${T.danger}`,
            transition:'all .3s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 30px rgba(0,0,0,.13)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.08)'; }}
          >
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem', flexWrap:'wrap', gap:'1rem' }}>
              <div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.1rem', fontWeight:700, color:'#1b5e20' }}>{t.property_id}</div>
                <small style={{ color:T.muted, fontSize:'.72rem' }}>Transfer ID: {t.transfer_id}</small>
              </div>
              <span style={{ padding:'6px 14px', borderRadius:20, fontWeight:700, fontSize:'.78rem', background:`linear-gradient(135deg,#f44336,#c62828)`, color:'white' }}>
                <i className="fas fa-times-circle" style={{ marginRight:5 }} />REJECTED
              </span>
            </div>

            {/* Rejection reason */}
            <div style={{ background:'#ffebee', borderLeft:`4px solid ${T.danger}`, padding:'12px 16px', borderRadius:10, marginBottom:'1rem' }}>
              <div style={{ fontWeight:700, color:T.danger, marginBottom:6, display:'flex', alignItems:'center', gap:6, fontSize:'.85rem' }}>
                <i className="fas fa-exclamation-triangle" />Rejection Reason
              </div>
              <div style={{ color:'#c62828', fontSize:'.88rem' }}>{t.rejection_reason || 'No reason provided'}</div>
            </div>

            {/* Seller */}
            <SectionBox icon="fas fa-user-minus" title="Current Owner (Seller)">
              <DetailItem label="Name"  value={t.seller_name} />
              <DetailItem label="CNIC"  value={fmtCnic(t.seller_cnic||'')} />
            </SectionBox>

            {/* Buyer */}
            <SectionBox icon="fas fa-user-plus" title="Proposed New Owner (Buyer)">
              <DetailItem label="Name"         value={t.buyer_name} />
              <DetailItem label="CNIC"         value={fmtCnic(t.buyer_cnic||'')} />
              <DetailItem label="Father's Name" value={t.buyer_father_name} />
            </SectionBox>

            {/* Transfer details */}
            <SectionBox icon="fas fa-info-circle" title="Transfer Details">
              <DetailItem label="Property Type"  value={t.property_type} />
              <DetailItem label="Area"           value={`${t.area_marla||'N/A'} Marla`} />
              <DetailItem label="Location"       value={`${t.district||'N/A'}, ${t.tehsil||'N/A'}`} />
              <DetailItem label="Transfer Amount" value={`PKR ${(t.transfer_amount||0).toLocaleString()}`} />
              <DetailItem label="Total Amount"   value={`PKR ${(t.total_amount||0).toLocaleString()}`} />
              <DetailItem label="Submitted Date" value={fmtDateTime(t.created_at)} />
              <DetailItem label="Rejected Date"  value={fmtDateTime(t.rejected_at)} />
            </SectionBox>

            {/* Rejected by */}
            {t.rejected_by_name && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'#fce4ec', borderRadius:10, fontSize:'.85rem', marginBottom:'1rem' }}>
                <i className="fas fa-user-shield" style={{ color:T.danger }} />
                <strong>Rejected By:</strong> {t.rejected_by_name}
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:'1rem' }}>
              <button style={btnStyle('#2196f3')}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 5px 20px rgba(33,150,243,.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}>
                <i className="fas fa-eye" />View Full Details
              </button>
              <button style={btnStyle('#ff9800')}
                onClick={() => reconsider(t.transfer_id, t.property_id, t.buyer_name)}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 5px 20px rgba(255,152,0,.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}>
                <i className="fas fa-redo" />Reconsider Request
              </button>
            </div>
          </div>
        ))
      )}

    </OfficerLayout>
  );
};

export default OfficerRejectedTransfers;