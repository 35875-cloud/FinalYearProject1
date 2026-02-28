import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OfficerLayout, { T, S, fmt, fmtCnic, fmtDateTime } from './OfficerLayout';

/* ─── Mini components ─── */
const InfoGroup = ({ label, value, mono, highlight }) => (
  <div style={{ background:'white', borderRadius:12, padding:'14px', border:`1px solid ${T.border}` }}>
    <div style={{ fontSize:'.72rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>{label}</div>
    <div style={{
      fontSize:'.88rem', color: highlight || T.text, fontWeight:600,
      fontFamily: mono ? "'JetBrains Mono',monospace" : undefined,
      wordBreak:'break-all'
    }}>
      {value || '—'}
    </div>
  </div>
);

const MetaBadge = ({ icon, children, color = '#1e40af', bg = '#dbeafe' }) => (
  <span style={{ background:bg, color, padding:'5px 10px', borderRadius:8, fontSize:'.78rem', fontWeight:600, display:'inline-flex', alignItems:'center', gap:5 }}>
    <i className={icon} />{children}
  </span>
);

const Btn = ({ children, onClick, color, outline, disabled, small }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 13px' : '9px 18px',
    border: outline ? `1.5px solid ${T.border}` : 'none',
    borderRadius:10, background: outline ? 'white' : (color || T.primary),
    color: outline ? T.text2 : 'white', fontWeight:700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: small ? '.78rem' : '.85rem',
    display:'flex', alignItems:'center', gap:6,
    opacity: disabled ? .65 : 1, fontFamily:"'DM Sans',sans-serif", transition:'all .15s',
  }}>
    {children}
  </button>
);

const StatCard = ({ icon, value, label, iconBg, iconColor }) => (
  <div style={{ background:'white', borderRadius:16, padding:'1.5rem', boxShadow:S.md, transition:'all .3s' }}
    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.12)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=S.md; }}
  >
    <div style={{ width:52, height:52, background:iconBg, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', color:iconColor, marginBottom:'1rem' }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize:'2rem', fontWeight:700, color:T.text, marginBottom:3 }}>{value}</div>
    <div style={{ fontSize:'.85rem', color:'#64748b', fontWeight:600 }}>{label}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const OfficerPendingTransfers = () => {
  const navigate  = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const BASE      = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth','');

  const [transfers,    setTransfers]    = useState([]);
  const [stats,        setStats]        = useState({ total:0, withScreenshot:0, approvedToday:0 });
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [rejectModal,  setRejectModal]  = useState(false);
  const [rejectId,     setRejectId]     = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting,    setRejecting]    = useState(false);

  const token = () => sessionStorage.getItem('authToken') || localStorage.getItem('token');

  // ─────────────────────────────────────────────────────────────
  // PHASE 5 — Load: property-wise dedupe and latest receipt/agreed case preference
  // Uses recovered /api/transfers/lro/review endpoint in transfer_new_routes.js
  // ─────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${BASE}/api/transfers/lro/review`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const d = await r.json();
      if (d.success) {
        setTransfers(d.transfers || []);
        setStats({
          total:          d.statistics?.total          || (d.transfers||[]).length,
          withScreenshot: d.statistics?.withScreenshot || 0,
          approvedToday:  d.statistics?.approvedToday  || 0,
        });
      } else throw new Error(d.message);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => {
    if (!authToken) { navigate('/login'); return; }
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────
  // PHASE 6a — Approve: triggers blockchain PoA mining
  // ─────────────────────────────────────────────────────────────
  const approveTransfer = async (transferId) => {
    if (!window.confirm('Submit this paid transfer into 5-node blockchain voting?')) return;
    try {
      const r = await fetch(`${BASE}/api/transfer-voting/lro/${transferId}/submit`, {
        method: 'POST',
        headers: { Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' },
      });
      const d = await r.json();
      if (d.success) {
        alert('Transfer submitted for blockchain voting.');
        await load();
        navigate('/lro/transfer-voting');
        return;
      }
      if (d.success) { alert('✅ Transfer approved. Blockchain block mined successfully.'); load(); }
      else throw new Error(d.message);
    } catch(e) { alert('Submit failed: ' + e.message); }
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 6b — Reject
  // ─────────────────────────────────────────────────────────────
  const submitReject = async () => {
    if (!rejectReason.trim()) { alert('Please enter a rejection reason'); return; }
    setRejecting(true);
    try {
      const r = await fetch(`${BASE}/api/transfers/reject`, {
        method: 'POST',
        headers: { Authorization:`Bearer ${token()}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ transferId: rejectId, reason: rejectReason }),
      });
      const d = await r.json();
      if (d.success) { alert('Transfer rejected.'); setRejectModal(false); load(); }
      else throw new Error(d.message);
    } catch(e) { alert('Reject failed: ' + e.message); }
    setRejecting(false);
  };

  // ─────────────────────────────────────────────────────────────
  // PHASE 4 — LRO views challan: fetches receipt from payment API
  // ─────────────────────────────────────────────────────────────
  const viewChallan = async (tr) => {
    const txnRef = tr.challan_txn_id;
    if (!txnRef) { alert('No TXN reference found for this transfer.'); return; }
    try {
      const r = await fetch(`${BASE}/api/payments/transaction/${txnRef}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const d = await r.json();
      if (!d.success) { alert('Could not fetch receipt details.'); return; }
      const t = d.transaction;
      const challan = {
        txnRef:      t.txnRef,
        amount:      t.amount,
        completedAt: t.completedAt,
        sender:      t.sender,
        receiver:    t.receiver,
        buyerCnic:   tr.buyer_cnic,
        sellerCnic:  tr.seller_cnic,
        transferId:  tr.transfer_id,
        channelId:   tr.channel_id,
        propertyId:  tr.property_id,
        location:    [tr.district, tr.tehsil, tr.mauza].filter(Boolean).join(', '),
      };
      const win = window.open('', '_blank');
      if (!win) { alert('Allow pop-ups to view challan.'); return; }
      win.document.write(buildChallanHtml(challan));
      win.document.close();
      setTimeout(() => win.print(), 600);
    } catch(e) { alert('Error loading challan: ' + e.message); }
  };

  const buildChallanHtml = (c) => {
    const amtWords = (n) => {
      n = Math.round(n);
      const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const tens  = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      if (!n) return 'Zero';
      let s = '';
      const cr = Math.floor(n/10000000); n%=10000000;
      const la = Math.floor(n/100000);   n%=100000;
      const th = Math.floor(n/1000);     n%=1000;
      const hu = Math.floor(n/100);       n%=100;
      if (cr) s += (cr<20?ones[cr]:tens[Math.floor(cr/10)]+(cr%10?' '+ones[cr%10]:''))+' Crore ';
      if (la) s += (la<20?ones[la]:tens[Math.floor(la/10)]+(la%10?' '+ones[la%10]:''))+' Lakh ';
      if (th) s += (th<20?ones[th]:tens[Math.floor(th/10)]+(th%10?' '+ones[th%10]:''))+' Thousand ';
      if (hu) s += ones[hu]+' Hundred ';
      if (n)  s += n<20?ones[n]:tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');
      return s.trim()+' Rupees Only';
    };
    const amt     = Number(c.amount);
    const dateStr = new Date(c.completedAt).toLocaleString('en-PK',{ dateStyle:'long', timeStyle:'medium' });
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Challan — ${c.txnRef}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;padding:2rem;max-width:720px;margin:0 auto;font-size:13px;}
      .header{text-align:center;border-bottom:3px solid #0D7C7C;padding-bottom:1rem;margin-bottom:1.25rem;}
      .header h2{color:#0D7C7C;font-size:1.1rem;letter-spacing:1px;text-transform:uppercase;margin-bottom:.2rem;}
      .header h1{font-size:1.5rem;font-weight:900;color:#111;margin-bottom:.15rem;}
      .header p{color:#6b7280;font-size:.8rem;}
      .txn-box{background:#f0faf9;border:2px solid #0D7C7C;border-radius:10px;padding:.75rem 1.25rem;text-align:center;margin-bottom:1.25rem;}
      .txn-ref{font-family:'Courier New',monospace;font-size:1.1rem;font-weight:900;color:#0D7C7C;letter-spacing:2px;}
      .txn-label{font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:.2rem;}
      .status-ok{display:inline-flex;align-items:center;gap:5px;background:#d1fae5;color:#065f46;border-radius:100px;padding:3px 12px;font-weight:700;font-size:.75rem;margin-top:.4rem;}
      .section{margin-bottom:1rem;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}
      .section-head{background:#f8fafc;padding:.5rem 1rem;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#374151;border-bottom:1px solid #e5e7eb;}
      .section-body{padding:.75rem 1rem;}
      table{width:100%;border-collapse:collapse;}
      td{padding:.35rem .5rem;vertical-align:top;}
      td:first-child{color:#6b7280;font-size:.75rem;width:38%;font-weight:600;}
      td:last-child{font-weight:700;font-size:.8rem;color:#111;}
      .amount-big{font-size:1.3rem;font-weight:900;color:#0D7C7C;}
      .amount-words{font-size:.72rem;color:#6b7280;margin-top:2px;font-style:italic;}
      .footer{margin-top:1.5rem;border-top:1px solid #e5e7eb;padding-top:.75rem;display:flex;justify-content:space-between;align-items:flex-end;}
      .stamp{width:90px;height:90px;border:3px solid #0D7C7C;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;color:#0D7C7C;font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;line-height:1.4;opacity:.6;}
      .note{font-size:.68rem;color:#9ca3af;max-width:500px;line-height:1.6;}
      @media print{.no-print{display:none;}}
    </style></head>
    <body>
    <button class="no-print" onclick="window.print()" style="position:fixed;top:1rem;right:1rem;padding:8px 18px;background:#0D7C7C;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;">🖨 Print / Save PDF</button>
    <div class="header">
      <h2>Government of Pakistan</h2><h1>Land Records Authority</h1>
      <p>Official Property Transfer Payment Challan — LRO Copy</p>
    </div>
    <div class="txn-box">
      <div class="txn-label">Transaction Reference</div>
      <div class="txn-ref">${c.txnRef}</div>
      <div class="status-ok">✅ PAYMENT VERIFIED</div>
    </div>
    <div class="section">
      <div class="section-head">Transaction Details</div>
      <div class="section-body"><table><tbody>
        <tr><td>Amount Transferred</td><td><span class="amount-big">PKR ${amt.toLocaleString('en-PK')}</span><div class="amount-words">${amtWords(amt)}</div></td></tr>
        <tr><td>Date &amp; Time</td><td>${dateStr}</td></tr>
        <tr><td>Property ID</td><td>${c.propertyId||'—'}</td></tr>
        <tr><td>Location</td><td>${c.location||'—'}</td></tr>
        <tr><td>Transfer ID</td><td>${c.transferId||'—'}</td></tr>
        <tr><td>Purpose</td><td>Property Transfer Payment</td></tr>
      </tbody></table></div>
    </div>
    <div class="section">
      <div class="section-head">💸 Payer (Buyer)</div>
      <div class="section-body"><table><tbody>
        <tr><td>Name</td><td>${c.sender?.name||'—'}</td></tr>
        <tr><td>CNIC</td><td>${c.buyerCnic||'—'}</td></tr>
        <tr><td>Account No.</td><td>${c.sender?.maskedNo||'—'}</td></tr>
      </tbody></table></div>
    </div>
    <div class="section">
      <div class="section-head">🏦 Payee (Seller)</div>
      <div class="section-body"><table><tbody>
        <tr><td>Name</td><td>${c.receiver?.name||'—'}</td></tr>
        <tr><td>CNIC</td><td>${c.sellerCnic||'—'}</td></tr>
        <tr><td>Account No.</td><td>${c.receiver?.maskedNo||'—'}</td></tr>
      </tbody></table></div>
    </div>
    <div class="footer">
      <div>
        <p class="note">Computer-generated challan. No physical signature required. Official proof of payment for property transfer. LRO verified copy.</p>
        <p style="margin-top:.5rem;font-size:.7rem;color:#9ca3af;">Channel: ${c.channelId} · Transfer: ${c.transferId}</p>
      </div>
      <div class="stamp">Land<br>Records<br>Authority<br>Pakistan<br>✓ PAID</div>
    </div></body></html>`;
  };

  /* ═══ RENDER ═══ */
  return (
    <OfficerLayout title="Pending Transfers">

      {/* Page header */}
      <div style={{ background:'white', borderRadius:24, padding:'2rem', marginBottom:'1.5rem', boxShadow:'0 8px 32px rgba(0,0,0,.1)' }}>
        <h2 style={{ color:T.text, fontFamily:"'Sora',sans-serif", fontWeight:700, margin:'0 0 6px 0' }}>
          <i className="fas fa-exchange-alt" style={{ color:T.primary, marginRight:10 }} />
          Pending Transfer Requests
        </h2>
        <p style={{ color:'#64748b', margin:0, fontSize:'.875rem' }}>
          Transfers where buyer has completed payment — review and approve or reject
        </p>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20, marginBottom:32 }}>
        <StatCard icon="fas fa-money-check-alt" value={stats.total}          label="Paid — Awaiting Review"   iconBg="#d1fae5" iconColor="#059669" />
        <StatCard icon="fas fa-image"           value={stats.withScreenshot} label="With Screenshot Evidence" iconBg="#dbeafe" iconColor="#2563eb" />
        <StatCard icon="fas fa-check-double"    value={stats.approvedToday}  label="Approved Today"           iconBg="#e0e7ff" iconColor="#6366f1" />
      </div>

      {/* Transfer list card */}
      <div style={{ background:'white', borderRadius:24, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.1)' }}>
        <div style={{ background:`linear-gradient(135deg,${T.primary},${T.primaryDark})`, padding:'1.5rem 2rem', color:'white', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h4 style={{ margin:0, fontWeight:700 }}>
            <i className="fas fa-list" style={{ marginRight:8 }} />Transfer Requests
          </h4>
          <button onClick={load} style={{ padding:'5px 13px', borderRadius:8, border:'1.5px solid rgba(255,255,255,.3)', background:'transparent', color:'white', fontWeight:600, fontSize:'.78rem', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <i className="fas fa-sync-alt" /> Refresh
          </button>
        </div>

        <div style={{ padding:'1.5rem' }}>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign:'center', padding:'3rem', color:T.muted }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ display:'block', marginBottom:'1rem', color:T.primary }} />
              Loading transfers…
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'1rem 1.5rem', color:'#991b1b', fontSize:'.875rem' }}>
              <i className="fas fa-exclamation-circle" style={{ marginRight:8 }} />{error}
              <button onClick={load} style={{ marginLeft:10, padding:'3px 10px', background:T.primary, color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:'.75rem' }}>Retry</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && transfers.length === 0 && (
            <div style={{ textAlign:'center', padding:'3rem', color:T.muted }}>
              <i className="fas fa-inbox fa-4x" style={{ display:'block', marginBottom:'1rem', opacity:.4 }} />
              <h5 style={{ color:T.text }}>No Pending Transfers</h5>
              <p style={{ margin:0 }}>No paid transfers awaiting LRO review right now.</p>
            </div>
          )}

          {/* Transfer cards */}
          {!loading && !error && transfers.map(tr => {
            const hasTxn        = Boolean(tr.challan_txn_id || tr.payment_transaction_id);
            const hasScreenshot = Boolean(tr.agreement_screenshot_url);
            // PHASE 5: isReady is purely based on payment_status — no screenshot required
            const votingStage   = String(tr.voting_status || '').toUpperCase();
            const isSubmittedToVoting = ['VOTING', 'READY_FOR_DC', 'FINALIZED'].includes(votingStage);
            const isReady       = tr.payment_status === 'PAID' && tr.seller_agreed && tr.buyer_agreed && !isSubmittedToVoting;
            const paidAmt       = Number(tr.txn_amount || tr.agreed_price || tr.transfer_amount || 0);
            const location      = [tr.district, tr.tehsil, tr.mauza].filter(Boolean).join(', ');

            return (
              <div key={tr.transfer_id} style={{
                background:'#f8fafc', border:`2px solid ${T.border}`, borderRadius:16, padding:'1.5rem',
                marginBottom:20, transition:'all .3s',
                borderLeft:`6px solid ${isSubmittedToVoting ? '#2563eb' : isReady ? '#059669' : '#d97706'}`,
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.1)'; e.currentTarget.style.transform='translateX(4px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateX(0)'; }}
              >

                {/* ── Header ── */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, paddingBottom:16, borderBottom:`2px solid ${T.border}`, flexWrap:'wrap', gap:10 }}>
                  <div>
                    <h5 style={{ color:T.text, fontWeight:700, margin:'0 0 8px 0' }}>
                      <i className="fas fa-home" style={{ marginRight:8, color:T.primary }} />
                      Property Transfer Request
                    </h5>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {location && <MetaBadge icon="fas fa-map-marker-alt">{location}</MetaBadge>}
                      {tr.area_marla && <MetaBadge icon="fas fa-ruler-combined" bg="#e0e7ff" color="#4338ca">{tr.area_marla} Marla</MetaBadge>}
                      {tr.payment_completed_at && (
                        <MetaBadge icon="fas fa-check-circle" bg="#d1fae5" color="#065f46">
                          Paid {new Date(tr.payment_completed_at).toLocaleDateString('en-PK')}
                        </MetaBadge>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                    <span style={{
                      padding:'7px 14px', borderRadius:10, fontWeight:700, fontSize:'.78rem',
                      background: isSubmittedToVoting ? '#dbeafe' : isReady ? '#d1fae5' : '#fef3c7',
                      color:      isSubmittedToVoting ? '#1d4ed8' : isReady ? '#065f46' : '#92400e',
                    }}>
                      {isReady ? '✅ Ready for Decision' : '⏳ Awaiting'}
                    </span>
                    {isSubmittedToVoting && (
                      <span style={{ padding:'3px 10px', borderRadius:8, fontWeight:700, fontSize:'.7rem', background:'#eff6ff', color:'#1d4ed8', display:'flex', alignItems:'center', gap:4 }}>
                        <i className="fas fa-gavel" /> {Number(tr.approval_count || 0)}/3 approvals
                      </span>
                    )}
                    <span style={{ padding:'3px 10px', borderRadius:8, fontWeight:700, fontSize:'.7rem', background:'#d1fae5', color:'#065f46', display:'flex', alignItems:'center', gap:4 }}>
                      <i className="fas fa-money-bill-transfer" /> Payment Confirmed
                    </span>
                  </div>
                </div>

                {/* ── Parties info ── */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(195px,1fr))', gap:12, marginBottom:16 }}>
                  <InfoGroup label="Transfer ID"  value={`#${tr.transfer_id}`} />
                  <InfoGroup label="Property ID"  value={tr.property_id} mono />
                  <InfoGroup label="Seller"       value={tr.seller_name} />
                  <InfoGroup label="Seller CNIC"  value={tr.seller_cnic} mono />
                  <InfoGroup label="Buyer"        value={tr.buyer_name} />
                  <InfoGroup label="Buyer CNIC"   value={tr.buyer_cnic} mono />
                </div>

                {/* ── PHASE 4: Payment section ── */}
                <div style={{ background:'#ecfdf5', border:'2px solid #10b981', borderRadius:12, padding:18, marginBottom:16 }}>
                  <div style={{ fontWeight:800, color:'#065f46', marginBottom:14, fontSize:'.95rem', display:'flex', alignItems:'center', gap:8 }}>
                    <i className="fas fa-money-bill-transfer" />Payment Verified
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(195px,1fr))', gap:12, marginBottom:14 }}>
                    <InfoGroup
                      label="Amount Paid"
                      value={`PKR ${paidAmt.toLocaleString('en-PK')}`}
                      highlight="#059669"
                    />
                    {tr.challan_txn_id && (
                      <InfoGroup label="TXN Reference" value={tr.challan_txn_id} mono />
                    )}
                    {tr.payment_completed_at && (
                      <InfoGroup label="Payment Date" value={new Date(tr.payment_completed_at).toLocaleString('en-PK', { dateStyle:'medium', timeStyle:'short' })} />
                    )}
                    {tr.sender_account_no && (
                      <InfoGroup label="Buyer Account" value={`••••${tr.sender_account_no.slice(-4)}`} mono />
                    )}
                    {tr.receiver_account_no && (
                      <InfoGroup label="Seller Account" value={`••••${tr.receiver_account_no.slice(-4)}`} mono />
                    )}
                  </div>

                  {/* Agreement status pills */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    {[
                      { role:'Seller', agreed:tr.seller_agreed, at:tr.seller_agreed_at },
                      { role:'Buyer',  agreed:tr.buyer_agreed,  at:tr.buyer_agreed_at  },
                    ].map(({ role, agreed, at }) => (
                      <div key={role} style={{ background:'white', borderRadius:10, padding:'11px 14px', textAlign:'center', border:'1px solid #d1fae5' }}>
                        <div style={{ fontSize:'.7rem', fontWeight:700, color:'#64748b', marginBottom:4 }}>{role}</div>
                        <div style={{ fontWeight:800, color: agreed ? '#059669' : '#d97706', fontSize:'.85rem' }}>
                          {agreed ? '✅ Agreed' : '⏳ Pending'}
                        </div>
                        {agreed && at && (
                          <div style={{ fontSize:'.63rem', color:'#94a3b8', marginTop:3 }}>
                            {new Date(at).toLocaleString('en-PK', { dateStyle:'short', timeStyle:'short' })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Screenshot (optional) ── */}
                {hasScreenshot && (
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:14, marginBottom:16 }}>
                    <div style={{ fontWeight:700, fontSize:'.82rem', color:'#1e40af', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                      <i className="fas fa-image" />Agreement Screenshot (extra evidence)
                    </div>
                    <img
                      src={`${BASE}${tr.agreement_screenshot_url}`}
                      alt="Agreement"
                      onClick={() => window.open(`${BASE}${tr.agreement_screenshot_url}`, '_blank')}
                      style={{ maxWidth:'100%', maxHeight:160, objectFit:'contain', borderRadius:8, cursor:'pointer', border:`1px solid ${T.border}` }}
                    />
                  </div>
                )}

                {/* ── Action buttons ── */}
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {/* PHASE 6a */}
                  {isReady && (
                    <Btn onClick={() => approveTransfer(tr.transfer_id)} color="#059669">
                      <i className="fas fa-gavel" />Submit For Voting
                    </Btn>
                  )}
                  {isSubmittedToVoting && (
                    <Btn onClick={() => navigate('/lro/transfer-voting')} color="#2563eb">
                      <i className="fas fa-arrow-right" />Open Vote Queue
                    </Btn>
                  )}
                  {/* PHASE 6b */}
                  {isReady && (
                    <Btn onClick={() => { setRejectId(tr.transfer_id); setRejectReason(''); setRejectModal(true); }} color="#dc2626">
                      <i className="fas fa-times-circle" />Reject Transfer
                    </Btn>
                  )}
                  {/* PHASE 4: View challan */}
                  {hasTxn && (
                    <Btn onClick={() => viewChallan(tr)} color="#6366f1">
                      <i className="fas fa-file-download" />View Challan
                    </Btn>
                  )}
                  {hasScreenshot && (
                    <Btn onClick={() => window.open(`${BASE}${tr.agreement_screenshot_url}`, '_blank')} outline small>
                      <i className="fas fa-image" />Screenshot
                    </Btn>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ REJECT MODAL ═══ */}
      {rejectModal && (
        <>
          <div onClick={() => setRejectModal(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:500, backdropFilter:'blur(3px)' }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(480px,95vw)', background:'white', borderRadius:20, zIndex:501, boxShadow:'0 20px 60px rgba(0,0,0,.25)', overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#dc2626,#b91c1c)', padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ color:'white', fontWeight:700 }}>
                <i className="fas fa-times-circle" style={{ marginRight:8 }} />Reject Transfer
              </span>
              <button onClick={() => setRejectModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:'50%', width:30, height:30, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ padding:'1.5rem' }}>
              <p style={{ fontSize:'.875rem', color:T.text2, marginBottom:'1rem' }}>
                <strong>Transfer ID:</strong>{' '}
                <code style={{ background:'#f1f5f9', padding:'2px 6px', borderRadius:4 }}>#{rejectId}</code>
              </p>
              <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, padding:'10px 14px', marginBottom:'1rem', fontSize:'.82rem', color:'#991b1b' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight:6 }} />
                Payment has already been made. Rejection will require manual refund coordination with both parties.
              </div>
              <label style={{ display:'block', fontWeight:600, fontSize:'.82rem', color:T.text2, marginBottom:6 }}>
                Rejection Reason <span style={{ color:'#dc2626' }}>*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Enter detailed reason for rejection…"
                style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:`1.5px solid ${T.border}`, fontSize:'.875rem', resize:'vertical', outline:'none', fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box' }}
              />
            </div>
            <div style={{ padding:'1rem 1.5rem', borderTop:`1px solid ${T.border}`, display:'flex', gap:8, justifyContent:'flex-end', background:'#f8fafc' }}>
              <Btn onClick={() => setRejectModal(false)} outline>Cancel</Btn>
              <Btn onClick={submitReject} color="#dc2626" disabled={rejecting}>
                {rejecting
                  ? <><i className="fas fa-spinner fa-spin" />Rejecting…</>
                  : <><i className="fas fa-times-circle" />Reject Transfer</>}
              </Btn>
            </div>
          </div>
        </>
      )}

    </OfficerLayout>
  );
};

export default OfficerPendingTransfers;
