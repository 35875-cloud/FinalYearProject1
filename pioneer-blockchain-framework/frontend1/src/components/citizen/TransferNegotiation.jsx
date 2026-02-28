import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CitizenLayout from './CitizenLayout';

const escHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmtTime  = ts => new Date(ts||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const maskAccount = acc => {
  const raw = String(acc || '').replace(/\s+/g, '');
  if (!raw) return '—';
  if (raw.length <= 6) return raw;
  return `${raw.slice(0, 2)}${'*'.repeat(Math.max(raw.length - 6, 4))}${raw.slice(-4)}`;
};
const P  = '#0D7C7C';
const PD = '#095c5c';
const PL = '#E6F4F2';

const getMessageKey = msg => msg.messageId || msg.message_id || msg._tempId || '';
const parseMessagePayload = msg => {
  try {
    return JSON.parse(msg?.messageContent || msg?.message_content || '{}');
  } catch (_) {
    return {};
  }
};
const isPaidChallanMessage = (msg, paidChallans = {}) => {
  if (((msg?.messageType || msg?.message_type || '').toUpperCase()) !== 'CHALLAN') return false;
  const msgKey = getMessageKey(msg);
  const payload = parseMessagePayload(msg);
  const receipt = paidChallans?.[msgKey] || payload.receipt || null;
  return payload.status === 'PAID' || !!receipt || !!payload.txnRef || !!payload.paidAt;
};

/* ═══════════════════════════════════════════════════════════════════
   CHALLAN BUBBLE — rendered inline in the chat for CHALLAN messages
   ═══════════════════════════════════════════════════════════════════ */
const ChallanBubble = ({
  msg, myRole, myAccount,
  sellerAccount,
  paidChallans,
  onOpenPayment,
  isLatestPending,
}) => {
  const cd = parseMessagePayload(msg);

  const msgKey   = getMessageKey(msg) || 'ch';
  const receipt  = paidChallans?.[msgKey] || cd.receipt || null;
  // isPaid: check all possible sources — local state, embedded receipt in JSON,
  // txnRef presence (set by payment.js on DB update), or explicit PAID status
  const isPaid   = cd.status === 'PAID' || !!receipt || !!(cd.txnRef) || !!(cd.paidAt);
  const isBuyer  = myRole === 'BUYER';
  const canAfford = myAccount && (myAccount.balance >= (cd.agreedPrice || 0));

  const InfoRow = ({ label, value }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #f3f4f6', fontSize:'.7rem' }}>
      <span style={{ color:'#6b7280', fontWeight:600 }}>{label}</span>
      <span style={{ color:'#111827', fontWeight:700, textAlign:'right', maxWidth:'55%', wordBreak:'break-word' }}>{value || '—'}</span>
    </div>
  );

  const downloadChallan = () => {
    // Build receipt data — check both local state and embedded cd.receipt
    const rec = receipt || cd.receipt || null;
    const txnRef = rec?.txnRef || cd.txnRef || '—';
    const paidAt = rec?.completedAt || cd.paidAt || null;

    // Format CNIC: 3578838398938 → 35788-3839893-8
    const fmtCnic = c => {
      const d = String(c||'').replace(/\D/g,'');
      return d.length===13 ? `${d.slice(0,5)}-${d.slice(5,12)}-${d.slice(12)}` : (c||'—');
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Challan - Punjab Land Records</title>
<style>
  @page { size:A4; margin:12mm 18mm; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Courier New',Courier,monospace; color:#111; font-size:10.5pt; background:#fff; }
  .page { max-width:170mm; margin:0 auto; padding:6mm 0; }
  .header { text-align:center; border-bottom:3px double #0D7C7C; padding-bottom:8px; margin-bottom:10px; }
  .header h1 { font-size:13pt; font-weight:900; color:#0D7C7C; letter-spacing:.5px; }
  .header .sub { font-size:9pt; color:#555; margin-top:2px; }
  .badge-wrap { text-align:center; margin:10px 0; }
  .badge { display:inline-block; padding:3px 18px; border-radius:100px; font-weight:900; font-size:10.5pt; letter-spacing:1.5px; border:2px solid; }
  .badge.paid   { background:#d1fae5; color:#065f46; border-color:#6ee7b7; }
  .badge.unpaid { background:#fef3c7; color:#92400e; border-color:#fcd34d; }
  .amount { text-align:center; font-size:24pt; font-weight:900; color:#0D7C7C; margin:10px 0 4px; letter-spacing:-1px; }
  .txn-ref { text-align:center; font-size:8.5pt; color:#666; margin-bottom:10px; }
  .section { margin:8px 0; border:1px solid #ccc; border-radius:4px; overflow:hidden; page-break-inside:avoid; }
  .section-title { background:#0D7C7C; color:white; font-size:8.5pt; font-weight:900; text-transform:uppercase; letter-spacing:.8px; padding:5px 10px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:5px 10px; border-bottom:1px solid #e5e7eb; font-size:9.5pt; vertical-align:top; }
  td:first-child { background:#f8fafb; font-weight:700; width:42%; color:#374151; white-space:nowrap; }
  tr:last-child td { border-bottom:none; }
  .confirm-section { border-color:#6ee7b7; }
  .confirm-title { background:#059669; }
  .confirm-section td:first-child { background:#f0fdf4; }
  .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg);
               font-size:90pt; font-weight:900; color:rgba(5,150,105,.06); pointer-events:none; z-index:0; white-space:nowrap; letter-spacing:4px; }
  .footer { text-align:center; font-size:7.5pt; color:#888; margin-top:14px; border-top:1px solid #ddd; padding-top:6px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
${isPaid ? '<div class="watermark">PAID</div>' : ''}
<div class="page">
  <div class="header">
    <div class="header h1">PUNJAB LAND RECORDS SYSTEM</div>
    <div class="sub">Property Transfer Payment Challan &nbsp;|&nbsp; Blockchain Verified</div>
  </div>

  <div class="badge-wrap">
    <span class="badge ${isPaid?'paid':'unpaid'}">${isPaid ? '✓  PAID' : '⏳  UNPAID'}</span>
  </div>

  <div class="amount">PKR ${Number(cd.agreedPrice||0).toLocaleString('en-PK')}</div>
  <div class="txn-ref">
    ${isPaid ? `TXN Ref: ${txnRef}` : `Challan ID: ${cd.challanId||'—'}`}
    ${paidAt ? `&nbsp;&nbsp;|&nbsp;&nbsp;Paid: ${new Date(paidAt).toLocaleString('en-PK')}` : ''}
  </div>

  <div class="section">
    <div class="section-title">Property Details</div>
    <table>
      <tr><td>Property ID</td><td>${cd.property?.propertyId||'—'}</td></tr>
      <tr><td>District / Tehsil</td><td>${cd.property?.district||'—'} / ${cd.property?.tehsil||'—'}</td></tr>
      <tr><td>Mauza</td><td>${cd.property?.mauza||'—'}</td></tr>
      <tr><td>Area</td><td>${cd.property?.areaMarla||'—'} Marla</td></tr>
      <tr><td>Khasra No.</td><td>${cd.property?.khasraNo||'—'}</td></tr>
      <tr><td>Khewat No.</td><td>${cd.property?.khewatNo||'—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Seller (Transferring From)</div>
    <table>
      <tr><td>Name</td><td>${cd.seller?.name||'—'}</td></tr>
      <tr><td>CNIC</td><td>${fmtCnic(cd.seller?.cnic)}</td></tr>
      <tr><td>Father Name</td><td>${cd.seller?.fatherName||'—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Buyer (Transferring To)</div>
    <table>
      <tr><td>Name</td><td>${cd.buyer?.name||'—'}</td></tr>
      <tr><td>CNIC</td><td>${fmtCnic(cd.buyer?.cnic)}</td></tr>
      <tr><td>Father Name</td><td>${cd.buyer?.fatherName||'—'}</td></tr>
    </table>
  </div>

  ${isPaid && rec ? `
  <div class="section confirm-section">
    <div class="section-title confirm-title">Payment Confirmation</div>
    <table>
      <tr><td>Transaction Ref</td><td>${txnRef}</td></tr>
      <tr><td>Amount Transferred</td><td>PKR ${Number(rec.amount||cd.agreedPrice||0).toLocaleString('en-PK')}</td></tr>
      <tr><td>Payment Date</td><td>${paidAt ? new Date(paidAt).toLocaleString('en-PK') : '—'}</td></tr>
    </table>
  </div>` : ''}

  <div class="footer">
    This document is computer generated &nbsp;|&nbsp; Punjab Land Records Authority &nbsp;|&nbsp; Blockchain Verified<br/>
    For verification contact your nearest Land Records office
  </div>
</div>
</body>
</html>`;

    // Inject auto-print script into the HTML so when it opens it immediately
    // shows the browser print dialog — user selects "Save as PDF" as destination.
    const htmlWithPrint = html.replace(
      '</body>',
      `<script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 600);
        };
      </script></body>`
    );

    try {
      const blob = new Blob([htmlWithPrint], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);

      // Open in new tab → auto-print dialog fires → user saves as PDF
      const tab = window.open(url, '_blank');
      if (!tab) {
        // If popup blocked, fall back to direct file download
        const a = document.createElement('a');
        a.href = url;
        a.download = `Challan-${cd.challanId || txnRef || Date.now()}.html`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // Revoke after enough time for tab to load and download
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch(e) {
      console.error('Download/print failed:', e);
    }
  };

  return (
    <div style={{ position:'relative', background:'white', border:`2px solid ${isPaid?'#10b981':'#d97706'}`, borderRadius:16, overflow:'hidden', maxWidth:390, boxShadow:'0 6px 24px rgba(0,0,0,.12)', margin:'4px 0' }}>

      {/* ── Header ── */}
      <div style={{ background: isPaid ? 'linear-gradient(135deg,#047857,#10b981)' : 'linear-gradient(135deg,#92400e,#d97706)', padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'white', fontWeight:800, fontSize:'.88rem', fontFamily:"'Sora',sans-serif", display:'flex', alignItems:'center', gap:7 }}>
              <i className="fas fa-file-invoice" />Payment Challan
            </div>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.62rem', marginTop:2 }}>Punjab Land Records System</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ background:'rgba(255,255,255,.22)', borderRadius:100, padding:'3px 11px', color:'white', fontWeight:800, fontSize:'.7rem' }}>
              {isPaid ? '✅ PAID' : '⏳ UNPAID'}
            </div>
            <div style={{ color:'rgba(255,255,255,.55)', fontSize:'.6rem', marginTop:3 }}>
              {new Date(cd.generatedAt||Date.now()).toLocaleDateString('en-PK')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding:'12px 14px' }}>

        {/* Amount */}
        <div style={{ textAlign:'center', padding:'10px 12px', background: isPaid?'#ecfdf5':'#fffbeb', borderRadius:10, marginBottom:12, border:`1px solid ${isPaid?'#bbf7d0':'#fde68a'}` }}>
          <div style={{ fontSize:'.62rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.8 }}>Agreed Transfer Amount</div>
          <div style={{ fontSize:'1.5rem', fontWeight:900, color: isPaid?'#047857':'#92400e', fontFamily:"'JetBrains Mono',monospace", letterSpacing:-1 }}>
            PKR {Number(cd.agreedPrice||0).toLocaleString('en-PK')}
          </div>
          {isPaid && (receipt?.txnRef || cd.txnRef) && (
            <div style={{ fontSize:'.62rem', color:'#6b7280', marginTop:2, fontFamily:"'JetBrains Mono',monospace" }}>
              TXN: {receipt?.txnRef || cd.txnRef}
            </div>
          )}
        </div>

        {/* Property */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:'.62rem', fontWeight:800, color:P, textTransform:'uppercase', letterSpacing:.8, marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
            <i className="fas fa-home" /> Property Details
          </div>
          <InfoRow label="Property ID" value={cd.property?.propertyId} />
          <InfoRow label="District / Tehsil" value={`${cd.property?.district||'—'} / ${cd.property?.tehsil||'—'}`} />
          <InfoRow label="Mauza" value={cd.property?.mauza} />
          <InfoRow label="Area" value={cd.property?.areaMarla ? `${cd.property.areaMarla} Marla` : null} />
          <InfoRow label="Khasra No." value={cd.property?.khasraNo} />
        </div>

        {/* From / To grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
          <div style={{ background:'#fef3c7', borderRadius:10, padding:'8px 10px', border:'1px solid #fde68a' }}>
            <div style={{ fontSize:'.58rem', fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>
              <i className="fas fa-user-tie" style={{ marginRight:4 }} />Seller (From)
            </div>
            <div style={{ fontSize:'.72rem', fontWeight:800, color:'#111827' }}>{cd.seller?.name||'—'}</div>
            <div style={{ fontSize:'.62rem', color:'#6b7280', marginTop:3 }}>CNIC: {cd.seller?.cnic||'—'}</div>
            <div style={{ fontSize:'.62rem', color:'#6b7280' }}>Father: {cd.seller?.fatherName||'—'}</div>
          </div>
          <div style={{ background:'#eff6ff', borderRadius:10, padding:'8px 10px', border:'1px solid #bfdbfe' }}>
            <div style={{ fontSize:'.58rem', fontWeight:800, color:'#1e40af', textTransform:'uppercase', letterSpacing:.5, marginBottom:5 }}>
              <i className="fas fa-user" style={{ marginRight:4 }} />Buyer (To)
            </div>
            <div style={{ fontSize:'.72rem', fontWeight:800, color:'#111827' }}>{cd.buyer?.name||'—'}</div>
            <div style={{ fontSize:'.62rem', color:'#6b7280', marginTop:3 }}>CNIC: {cd.buyer?.cnic||'—'}</div>
            <div style={{ fontSize:'.62rem', color:'#6b7280' }}>Father: {cd.buyer?.fatherName||'—'}</div>
          </div>
        </div>

        {/* ── PAID STATE ── */}
        {isPaid && (
          <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:12, padding:'10px 12px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <i className="fas fa-check-circle" style={{ color:'#16a34a', fontSize:'1.2rem' }} />
              <div>
                <div style={{ fontWeight:800, fontSize:'.82rem', color:'#15803d' }}>Payment Completed</div>
                {(receipt?.completedAt || cd.paidAt) && (
                  <div style={{ fontSize:'.62rem', color:'#6b7280' }}>
                    {new Date(receipt?.completedAt || cd.paidAt).toLocaleString('en-PK')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BUYER PAYMENT HANDOFF (unpaid) ── */}
        {!isPaid && isBuyer && (
          <div style={{ background:'#f8fafc', border:'1.5px solid #e5e7eb', borderRadius:12, padding:'10px 12px' }}>
            <div style={{ fontSize:'.68rem', fontWeight:800, color:'#374151', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-credit-card" style={{ color:P }} /> Payment Step
            </div>
            {myAccount ? (
              <div style={{ marginBottom:8, padding:'6px 10px', borderRadius:8, background: canAfford?'#f0fdf4':'#fef2f2', border:`1px solid ${canAfford?'#bbf7d0':'#fecaca'}` }}>
                <div style={{ fontSize:'.67rem', fontWeight:700, color: canAfford?'#15803d':'#dc2626', display:'flex', alignItems:'center', gap:5 }}>
                  <i className={`fas fa-${canAfford?'check-circle':'exclamation-triangle'}`} />
                  {canAfford ? 'Sufficient balance — ready to pay' : 'Insufficient balance'}
                </div>
                <div style={{ fontSize:'.62rem', color:'#6b7280', marginTop:2 }}>
                  Your balance: PKR {Number(myAccount.balance||0).toLocaleString('en-PK')}
                  {!canAfford && ` · Need PKR ${Number((cd.agreedPrice||0)-(myAccount.balance||0)).toLocaleString('en-PK')} more`}
                </div>
              </div>
            ) : (
              <div style={{ padding:'6px 10px', borderRadius:8, background:'#f3f4f6', marginBottom:8, fontSize:'.67rem', color:'#6b7280' }}>
                <i className="fas fa-spinner fa-spin" style={{ marginRight:5 }} />Loading account…
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:8 }}>
              <div>
                <label style={{ display:'block', fontSize:'.62rem', fontWeight:700, color:'#6b7280', marginBottom:3 }}>Your Account No.</label>
                <input value={myAccount?.maskedNo || maskAccount(myAccount?.accountNo) || '—'} readOnly
                  style={{ width:'100%', padding:'7px 8px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:'.65rem', background:'#f8fafc', boxSizing:'border-box', fontFamily:"'JetBrains Mono',monospace", color:'#374151' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'.62rem', fontWeight:700, color:'#6b7280', marginBottom:3 }}>Seller Account</label>
                <input value={sellerAccount?.maskedNo || maskAccount(sellerAccount?.accountNo) || '—'} readOnly
                  style={{ width:'100%', padding:'7px 8px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:'.65rem', background:'#f8fafc', boxSizing:'border-box', fontFamily:"'JetBrains Mono',monospace", color:'#374151' }} />
              </div>
            </div>

            <div style={{ padding:'8px 10px', borderRadius:8, background:'#eef6ff', border:'1px solid #cfe2ff', marginBottom:8 }}>
              <div style={{ fontSize:'.68rem', fontWeight:700, color:'#1d4ed8', marginBottom:2 }}>
                Payment now opens on a separate screen
              </div>
              <div style={{ fontSize:'.63rem', color:'#475569', lineHeight:1.55 }}>
                This keeps the chat stable while you enter your PIN and prevents multiple challan forms from stacking in the conversation.
              </div>
            </div>

            {isLatestPending ? (
              <button
                onClick={() => onOpenPayment(cd, msgKey)}
                style={{
                  width:'100%', padding:'10px', borderRadius:10, border:'none',
                  background:'linear-gradient(135deg,#0f766e,#14b8a6)',
                  color:'white',
                  fontWeight:800, fontSize:'.82rem',
                  cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                  boxShadow:'0 4px 14px rgba(20,184,166,.3)',
                  transition:'all .15s',
                }}>
                <i className="fas fa-external-link-alt" /> Open Payment Screen
              </button>
            ) : (
              <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:'.72rem', fontWeight:800, color:'#92400e', marginBottom:3 }}>
                  Older challan kept for record
                </div>
                <div style={{ fontSize:'.64rem', color:'#b45309', lineHeight:1.5 }}>
                  A newer challan is already active in this negotiation. Use the latest challan row to continue payment.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SELLER VIEW (unpaid) ── */}
        {!isPaid && !isBuyer && (
          <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'12px', textAlign:'center', marginBottom:8 }}>
            <i className="fas fa-hourglass-half" style={{ color:'#d97706', fontSize:'1.3rem', marginBottom:6, display:'block' }} />
            <div style={{ fontSize:'.8rem', fontWeight:800, color:'#92400e' }}>
              {isLatestPending ? 'Awaiting Buyer Payment' : 'Older Challan Archived'}
            </div>
            <div style={{ fontSize:'.67rem', color:'#b45309', marginTop:4 }}>
              {isLatestPending
                ? `Buyer will pay PKR ${Number(cd.agreedPrice||0).toLocaleString('en-PK')} on the dedicated payment screen.`
                : 'A newer challan is active for this transfer. This older challan remains visible only for record history.'}
            </div>
          </div>
        )}

        {/* ── DOWNLOAD BUTTON — SELLER ONLY after payment ── */}
        {!isBuyer && isPaid && (
          <button onClick={downloadChallan}
            style={{
              width:'100%', padding:'10px', borderRadius:9, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#047857,#16a34a)',
              color:'white', fontWeight:800, fontSize:'.78rem',
              display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              marginTop:6,
              boxShadow:'0 3px 10px rgba(22,163,74,.35)',
            }}>
            <i className="fas fa-file-download" style={{ fontSize:'.9rem' }} />
            Download Paid Challan (PDF)
          </button>
        )}
      </div>
    </div>
  );
};

const ReceiptProposalBubble = ({ msg, isMe, onUseReceipt }) => {
  let payload = {};
  try { payload = JSON.parse(msg.messageContent || msg.message_content || '{}'); } catch (_) {}

  const amount = Number(payload.price || payload.agreedPrice || 0);
  const durationDays = Number(payload.durationDays || 0);
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;

  return (
    <div style={{
      background: isMe ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : '#EFF6FF',
      color: isMe ? 'white' : '#1E3A8A',
      borderRadius: 16,
      padding: '12px 14px',
      minWidth: 250,
      border: isMe ? 'none' : '1px solid #BFDBFE',
      boxShadow: isMe ? '0 4px 16px rgba(37,99,235,.28)' : 'none',
    }}>
      <div style={{ fontSize: '.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .78, marginBottom: 6 }}>
        Seller Receipt Proposal
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: -.4 }}>
        PKR {Number.isFinite(amount) ? amount.toLocaleString('en-PK') : '0'}
      </div>
      <div style={{ fontSize: '.76rem', marginTop: 6, lineHeight: 1.6, opacity: .9 }}>
        Valid for {durationDays > 0 ? `${durationDays} day${durationDays > 1 ? 's' : ''}` : 'the active transfer period'}
      </div>
      {expiresAt && (
        <div style={{ fontSize: '.72rem', marginTop: 3, opacity: .8 }}>
          Expires {expiresAt.toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      {payload.note && (
        <div style={{
          marginTop: 8,
          fontSize: '.74rem',
          lineHeight: 1.55,
          background: isMe ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.65)',
          color: isMe ? 'white' : '#1E3A8A',
          borderRadius: 10,
          padding: '8px 10px',
        }}>
          {payload.note}
        </div>
      )}
      {!isMe && (
        <button
          onClick={() => onUseReceipt(amount)}
          style={{
            marginTop: 10,
            padding: '7px 12px',
            borderRadius: 10,
            border: 'none',
            background: '#1D4ED8',
            color: 'white',
            fontWeight: 800,
            fontSize: '.74rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <i className="fas fa-file-signature" />
          Review & Confirm
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const TransferNegotiation = () => {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const CHANNEL_ID   = params.get('channelId');
  const TRANSFER_ID  = params.get('transferId');
  const authToken    = sessionStorage.getItem('authToken');
  const userId       = sessionStorage.getItem('userId');
  const BASE         = (process.env.REACT_APP_API_URL||'http://localhost:5000/api/auth').replace('/api/auth','');

  const [channel,       setChannel]       = useState({});
  const [messages,      setMessages]      = useState([]);
  const [myRole,        setMyRole]        = useState(null);
  const [connStatus,    setConn]          = useState('connecting');
  const [text,          setText]          = useState('');
  const [offerAmt,      setOfferAmt]      = useState('');
  const [showOffer,     setShowOffer]     = useState(false);
  const [iAgreed,       setIAgreed]       = useState(false);
  const [bothAgreed,    setBothAgreed]    = useState(false);
  const [sellerOnline,  setSellerOnline]  = useState(false);
  const [buyerOnline,   setBuyerOnline]   = useState(false);
  const [typing,        setTyping]        = useState(false);
  const [toasts,        setToasts]        = useState([]);
  const [uploadModal,   setUploadModal]   = useState(false);
  const [uploadFile,    setUploadFile]    = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [agreedPrice,   setAgreedPrice]   = useState('');
  const [uploading,     setUploading]     = useState(false);
  const [isRecording,   setIsRecording]   = useState(false);
  const [recSec,        setRecSec]        = useState(0);
  const [imgUploading,  setImgUploading]  = useState(false);

  // Agree panel
  const [lastOffer,     setLastOffer]     = useState(0);
  const [agreeModal,    setAgreeModal]    = useState(false);
  const [agreePrice,    setAgreePrice]    = useState('');
  const [, setAgreePriceOk] = useState(null);
  const [receiptModal,  setReceiptModal]  = useState(false);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDays,   setReceiptDays]   = useState('7');
  const [receiptNote,   setReceiptNote]   = useState('');
  const [issuingReceipt, setIssuingReceipt] = useState(false);

  // Disagree
  const [disagreeModal,   setDisagreeModal]   = useState(false);
  const [disagreeReason,  setDisagreeReason]  = useState('');
  const [disagreeing,     setDisagreeing]     = useState(false);

  // Challan / payment state
  const [myAccount,       setMyAccount]       = useState(null);
  const [sellerAccount,   setSellerAccount]   = useState(null);
  const [challanPin,      setChallanPin]      = useState('');
  const [challanPaying,   setChallanPaying]   = useState(false);
  const [paidChallans,    setPaidChallans]    = useState({});   // msgKey → receipt
  const [sellerBalAfter,  setSellerBalAfter]  = useState(null); // seller's balance after payment

  // Auto-channel
  const [autoChannels, setAutoChannels] = useState([]);
  const [autoLoading,  setAutoLoading]  = useState(false);
  const [autoFetched,  setAutoFetched]  = useState(false);

  const socketRef   = useRef(null);
  const msgRef      = useRef(null);
  const typTimer    = useRef(null);
  const imgRef      = useRef();
  const scFileRef   = useRef();
  const mediaRec    = useRef(null);
  const recChunks   = useRef([]);
  const recTimer    = useRef(null);
  const recSecRef   = useRef(0);
  const textareaRef = useRef(null);

  // ── WebRTC refs ────────────────────────────────────────────
  const pcRef       = useRef(null);   // RTCPeerConnection
  const dcRef       = useRef(null);   // RTCDataChannel (send side)
  const [p2pStatus, setP2pStatus] = useState('idle');
  // idle | connecting | open | failed | closed
  // 'open'  → messages go through DataChannel (true P2P)
  // else    → messages fall back through WebSocket

  useEffect(() => {
    if (CHANNEL_ID || autoFetched) return;
    setAutoLoading(true); setAutoFetched(true);
    fetch(`${BASE}/api/channels/my-channels?userId=${userId}`, { headers:{ Authorization:`Bearer ${authToken}` } })
      .then(r=>r.json())
      .then(d => {
        const active = (d.channels||[]).filter(ch => ['ACTIVE','NEGOTIATING','AGREED','PAYMENT_PENDING','PAYMENT_DONE'].includes(ch.channel_status));
        if (active.length===1) navigate(`/citizen/negotiation?channelId=${active[0].channel_id}&transferId=${active[0].transfer_id||''}`);
        else setAutoChannels(active);
      })
      .catch(()=>{})
      .finally(()=>setAutoLoading(false));
  }, [CHANNEL_ID]); // eslint-disable-line

  useEffect(() => {
    if (!authToken || !CHANNEL_ID) return;
    loadAll(); connectSocket(); loadMyAccount();
    return () => { socketRef.current?.disconnect(); clearInterval(recTimer.current); closeWebRTC(); };
  }, []); // eslint-disable-line

  const apiFetch = (path, opts={}) =>
    fetch(BASE+path, { ...opts, headers:{ Authorization:`Bearer ${authToken}`, 'Content-Type':'application/json', ...opts.headers } });

  const toast = (msg, type='info') => {
    const id = Date.now();
    setToasts(p => [...p, {id, msg, type}]);
    setTimeout(() => setToasts(p => p.filter(t=>t.id!==id)), 4500);
  };

  const scrollBottom = () => requestAnimationFrame(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  });

  const addSystem = msg => setMessages(p => [...p, { isSystemMessage:true, messageContent:msg, timestamp:new Date() }]);

  const loadMyAccount = async () => {
    try {
      const r = await apiFetch('/api/payments/my-account');
      const d = await r.json();
      if (d.success) setMyAccount(d.account);
    } catch(e) { console.warn('Could not load account:', e); }
  };

  const loadSellerAccount = async (sellerId) => {
    if (!sellerId) return;
    try {
      const r = await apiFetch(`/api/payments/account/${sellerId}`);
      const d = await r.json();
      if (d.success) setSellerAccount(d.account);
    } catch (e) {
      console.warn('Could not load seller account:', e);
    }
  };

  // ── loadAll: fetches channel details + messages in ONE sequential call ──
  // Keeping them together means payment_status is available when messages are
  // patched — avoids the 304-no-body problem that happened when both functions
  // raced to hit the same /details endpoint simultaneously.
  const loadChannel = async () => {
    try {
      const r = await apiFetch(`/api/channels/${CHANNEL_ID}/details?userId=${userId}`);
      const d = await r.json();
      if (!d.success) return;
      const ch = d.channel||{};
      setChannel(ch);
      const role = (userId && userId===String(ch.seller_id||ch.sellerId||'')) ? 'SELLER' : 'BUYER';
      setMyRole(role);
      loadSellerAccount(ch.seller_id || ch.sellerId);
      if (ch.seller_agreed && ch.buyer_agreed) setBothAgreed(true);
      if ((role==='SELLER'&&ch.seller_agreed)||(role==='BUYER'&&ch.buyer_agreed)) setIAgreed(true);
      if (ch.agreed_price) setLastOffer(parseFloat(ch.agreed_price));
      else if (ch.transfer_amount) setLastOffer(parseFloat(ch.transfer_amount));
      if (!receiptAmount) {
        const baseAmount = ch.agreed_price || ch.transfer_amount || '';
        if (baseAmount) setReceiptAmount(String(baseAmount));
      }
      return ch; // return so loadAll can pass it to loadHistory
    } catch(e) { console.error(e); }
  };

  const loadHistory = async (ch = null) => {
    try {
      const r = await apiFetch(`/api/channels/${CHANNEL_ID}/messages?limit=100&userId=${userId}`);
      const d = await r.json();
      if (d.success) {
        let normalised = (d.messages||[]).map(m => ({
          ...m,
          messageId:      m.message_id      || m.messageId,
          senderId:       m.sender_id       || m.senderId,
          senderRole:     m.sender_role     || m.senderRole,
          messageType:    m.message_type    || m.messageType,
          messageContent: m.message_content || m.messageContent,
          isSystemMessage:m.is_system_message||m.isSystemMessage,
          priceOffer:     m.price_offer     || m.priceOffer,
        }));

        // Use the channel data passed in (from loadAll).
        // ch.payment_status lives in transfer_requests — always updated by payment.js.
        // Falls back to checking challan_txn_id which is also set on payment.
        const chData = ch || {};
        const alreadyPaid = chData.payment_status === 'PAID'
          || !!(chData.challan_txn_id)
          || chData.channel_status === 'PAYMENT_DONE';
        if (alreadyPaid) {
          normalised = normalised.map(m => {
            if ((m.messageType||'').toUpperCase() !== 'CHALLAN') return m;
            try {
              const payload = JSON.parse(m.messageContent || '{}');
              payload.status = 'PAID';
              if (chData.challan_txn_id)       payload.txnRef = chData.challan_txn_id;
              if (chData.payment_completed_at) payload.paidAt = chData.payment_completed_at;
              return { ...m, messageContent: JSON.stringify(payload) };
            } catch(_) { return m; }
          });
        }

        setMessages(normalised);
        const lastPriceMsg = [...normalised].reverse().find(m => (m.messageType||'').toUpperCase()==='PRICE_OFFER' && m.priceOffer);
        if (lastPriceMsg) setLastOffer(parseFloat(lastPriceMsg.priceOffer));
        setTimeout(scrollBottom, 120);
      }
    } catch(e) { console.error(e); }
  };

  // Always call these sequentially so loadHistory receives the channel object
  const loadAll = async () => {
    const ch = await loadChannel();
    await loadHistory(ch);
  };


  // ════════════════════════════════════════════════════════════════
  //  WebRTC — P2P DataChannel for TEXT + PRICE_OFFER messages
  //  The server sees ONLY the signaling handshake (offer/answer/ICE).
  //  Once the DataChannel opens, ALL chat messages travel browser→browser.
  //  System events (agree, challan, payment) ALWAYS use WebSocket.
  // ════════════════════════════════════════════════════════════════

  // ICE servers — Google STUN (free) + we can add TURN later if needed
  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const closeWebRTC = () => {
    try { dcRef.current?.close(); } catch(_) {}
    try { pcRef.current?.close(); } catch(_) {}
    dcRef.current = null;
    pcRef.current = null;
    setP2pStatus('closed');
  };

  const setupDataChannel = (dc) => {
    dcRef.current = dc;
    dc.onopen = () => {
      console.log('⚡ WebRTC DataChannel open — P2P chat active');
      setP2pStatus('open');
      addSystem('⚡ P2P connection established — chat is now end-to-end encrypted');
    };
    dc.onclose = () => {
      console.log('WebRTC DataChannel closed');
      setP2pStatus('closed');
      addSystem('P2P connection closed — falling back to server relay');
    };
    dc.onerror = (e) => {
      console.warn('DataChannel error:', e);
      setP2pStatus('failed');
    };
    dc.onmessage = (evt) => {
      // Incoming P2P message from the other peer
      try {
        const msg = JSON.parse(evt.data);
        const msgType = (msg.messageType || '').toUpperCase();
        const _id = `p2p-${Date.now()}-${Math.random()}`;
        setMessages(p => [...p, {
          ...msg,
          _p2p: true,          // mark so we know it came via DataChannel
          messageId: msg.messageId || _id,
          timestamp: msg.timestamp || new Date(),
        }]);
        if (msgType === 'PRICE_OFFER' && msg.priceOffer) {
          setLastOffer(parseFloat(msg.priceOffer));
        }
        scrollBottom();
      } catch(e) { console.warn('Bad P2P message', e); }
    };
  };

  const initWebRTC = async (isInitiator) => {
    // isInitiator = whoever joined the channel first sends the offer
    if (pcRef.current) return; // already initialised
    setP2pStatus('connecting');
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Trickle ICE — send each candidate as it arrives
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit('webrtc_ice', { channelId: CHANNEL_ID, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setP2pStatus('failed');
        addSystem('⚠️ P2P connection lost — messages going through server');
      }
    };

    if (isInitiator) {
      // Initiator creates the DataChannel
      const dc = pc.createDataChannel('chat', { ordered: true });
      setupDataChannel(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc_offer', { channelId: CHANNEL_ID, offer });
      console.log('📡 WebRTC offer sent');
    } else {
      // Responder waits for remote DataChannel
      pc.ondatachannel = ({ channel }) => {
        setupDataChannel(channel);
      };
    }
  };

  // Send a message through DataChannel if open, else fall back to socket
  const sendP2P = (payload) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(payload));
      return true; // sent via P2P
    }
    return false;  // caller should use socket fallback
  };

  const connectSocket = useCallback(async () => {
    try {
      const { io } = await import('socket.io-client');
      const sock = io(BASE, { auth:{ token:authToken }, transports:['websocket','polling'] });
      socketRef.current = sock;
      sock.on('connect',       () => { setConn('connected'); sock.emit('join_channel', { channelId:CHANNEL_ID }); });
      sock.on('disconnect',    () => setConn('offline'));
      sock.on('connect_error', () => setConn('error'));

      // ── WebRTC signaling listeners ────────────────────────────────
      // Server relays these blindly — it never reads the content.
      // 'self_joined' fires after join_channel — use it to decide who initiates.

      sock.on('self_joined', data => {
        if (data.role==='SELLER') setSellerOnline(true);
        if (data.role==='BUYER')  setBuyerOnline(true);
        // If the other peer is already online when we join, we are the initiator
        if (data.peerAlreadyOnline) {
          console.log('⚡ Peer already online — initiating WebRTC');
          initWebRTC(true);
        }
      });

      sock.on('user_joined', data => {
        if (data.role==='SELLER') setSellerOnline(true);
        if (data.role==='BUYER')  setBuyerOnline(true);
        if (!data.alreadyOnline) addSystem(`${data.role==='SELLER'?'Seller':'Buyer'} joined the chat`);
        // Other peer just joined while we were already here — they will initiate,
        // so we become the responder (non-initiator)
        if (!pcRef.current) {
          console.log('⚡ Peer joined — waiting for WebRTC offer (responder)');
          initWebRTC(false);
        }
      });

      sock.on('webrtc_offer', async ({ offer }) => {
        console.log('📡 WebRTC offer received');
        if (!pcRef.current) await initWebRTC(false);
        const pc = pcRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('webrtc_answer', { channelId: CHANNEL_ID, answer });
        console.log('📡 WebRTC answer sent');
      });

      sock.on('webrtc_answer', async ({ answer }) => {
        console.log('📡 WebRTC answer received');
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      });

      sock.on('webrtc_ice', async ({ candidate }) => {
        try {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch(e) { console.warn('ICE candidate error:', e); }
      });

      sock.on('webrtc_hangup', () => {
        closeWebRTC();
        setP2pStatus('closed');
      });
      // ─────────────────────────────────────────────────────────────


      sock.on('new_message', msg => {
        const sid     = String(msg.senderId||msg.sender_id||'');
        const content = msg.messageContent||msg.message_content||'';
        const msgType = (msg.messageType||msg.message_type||'').toUpperCase();

        setMessages(p => {
          if (msgType === 'CHALLAN') {
            // Always append challan messages — deduplicate by messageId
            const msgId = msg.messageId || msg.message_id;
            if (msgId && p.some(m => (m.messageId||m.message_id) === msgId)) return p;
            return [...p, msg];
          }
          if (sid && sid !== '0' && sid === String(userId)) {
            const tempIdx = p.findIndex(m =>
              m._tempId && String(m.senderId) === sid &&
              m.messageContent === content &&
              (m.messageType||'').toUpperCase() === msgType
            );
            if (tempIdx !== -1) {
              const updated = [...p]; updated[tempIdx] = { ...msg }; return updated;
            }
            return p;
          }
          return [...p, msg];
        });

        if (msgType === 'PRICE_OFFER') {
          const offer = parseFloat(msg.priceOffer||msg.price_offer||0);
          if (offer > 0) setLastOffer(offer);
        }
        scrollBottom();
      });

      sock.on('agreement_updated', data => {
        setChannel(prev => ({
          ...prev,
          seller_agreed: data.role==='SELLER' ? data.agreed : prev.seller_agreed,
          buyer_agreed:  data.role==='BUYER'  ? data.agreed : prev.buyer_agreed,
        }));
        if (data.agreedPrice) setLastOffer(parseFloat(data.agreedPrice));
        if (data.bothAgreed) handleBothAgreed(data.agreedPrice);
      });

      // Payment received by seller (broadcasted by server after buyer pays)
      sock.on('payment_received', data => {
        setSellerBalAfter(data.sellerBalanceAfter || null);
        // Flip all CHALLAN messages to PAID + reload account
        setMessages(p => p.map(m => {
          if ((m.messageType||m.message_type||'').toUpperCase() === 'CHALLAN') {
            try {
              const cd = JSON.parse(m.messageContent||m.message_content||'{}');
              if (cd.status !== 'PAID') {
                cd.status   = 'PAID';
                cd.txnRef   = data.txnRef;
                cd.paidAt   = new Date(data.timestamp||Date.now()).toISOString();
                return { ...m, messageContent: JSON.stringify(cd) };
              }
            } catch(e) {}
          }
          return m;
        }));
        loadMyAccount();
        toast(`💰 Payment of PKR ${Number(data.amount||0).toLocaleString('en-PK')} received!`, 'success');
      });

      sock.on('user_left', data => {
        if (data.role==='SELLER') setSellerOnline(false);
        if (data.role==='BUYER')  setBuyerOnline(false);
        addSystem(`${data.role==='SELLER'?'Seller':'Buyer'} left the chat`);
        // Peer left — clean up WebRTC connection
        closeWebRTC();
      });
      sock.on('typing', () => { setTyping(true); clearTimeout(typTimer.current); typTimer.current = setTimeout(()=>setTyping(false), 2500); });
      sock.on('both_agreed', (data) => handleBothAgreed(data?.agreedPrice));

      // Challan was generated on server — reload messages to pull it in
      sock.on('challan_issued', async (data) => {
        handleBothAgreed(data?.agreedPrice);
        await loadAll();
      });

      // Other party disagreed — reset local agree state
      sock.on('disagreed', () => {
        setIAgreed(false);
        setBothAgreed(false);
        setChannel(prev => ({ ...prev, seller_agreed: false, buyer_agreed: false }));
        toast(`${peerLabel} disagreed. Negotiation is open again.`, 'info');
      });

      sock.on('error', err => toast(err.message||'Socket error','error'));
    } catch(e) { console.warn('Socket unavailable',e); }
  }, []); // eslint-disable-line

  // Both agreed — stay in chat, challan appears via new_message socket event
  const handleBothAgreed = (price) => {
    setBothAgreed(true);
    const finalPrice = price || lastOffer;
    addSystem(`🤝 Both parties agreed at PKR ${Number(finalPrice||0).toLocaleString('en-PK')}. Payment challan appearing below…`);
    toast('Both agreed! Payment challan generated in chat.', 'success');
  };

  const useReceiptProposal = (amount) => {
    if (!amount || amount <= 0) {
      toast('Receipt amount is missing', 'error');
      return;
    }
    setAgreePrice(String(amount));
    setAgreePriceOk(true);
    setLastOffer(amount);
    setAgreeModal(true);
  };

  const openReceiptModal = () => {
    const baseAmount = parseFloat(lastOffer || channel.agreed_price || channel.transfer_amount || 0);
    setReceiptAmount(baseAmount > 0 ? String(baseAmount) : '');
    setReceiptDays('7');
    setReceiptNote('');
    setReceiptModal(true);
  };

  const issueReceiptProposal = async () => {
    const amount = parseFloat(receiptAmount);
    const durationDays = parseInt(receiptDays, 10);

    if (!amount || amount <= 0) {
      toast('Enter a valid receipt amount', 'error');
      return;
    }
    if (!durationDays || durationDays <= 0) {
      toast('Enter valid receipt duration', 'error');
      return;
    }

    const receiptPayload = {
      type: 'RECEIPT_PROPOSAL',
      price: amount,
      durationDays,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (durationDays * 24 * 60 * 60 * 1000)).toISOString(),
      propertyId: channel.property_id || null,
      note: receiptNote?.trim() || 'Seller has issued a receipt proposal for confirmation.',
    };

    setIssuingReceipt(true);
    try {
      if (socketRef.current) {
        socketRef.current.emit('send_message', {
          channelId: CHANNEL_ID,
          messageType: 'RECEIPT_PROPOSAL',
          message: JSON.stringify(receiptPayload),
        });
      } else {
        const r = await apiFetch(`/api/channels/${CHANNEL_ID}/send`, {
          method: 'POST',
          body: JSON.stringify({
            userId,
            messageType: 'RECEIPT_PROPOSAL',
            message: JSON.stringify(receiptPayload),
          }),
        });
        const d = await r.json();
        if (!d.success) {
          throw new Error(d.error || d.message || 'Failed to send receipt');
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          _tempId: `receipt-${Date.now()}`,
          senderId: userId,
          senderRole: myRole,
          messageType: 'RECEIPT_PROPOSAL',
          messageContent: JSON.stringify(receiptPayload),
          timestamp: new Date(),
        },
      ]);

      setLastOffer(amount);
      setReceiptModal(false);
      toast('Receipt proposal sent in chat.', 'success');
      scrollBottom();
    } catch (e) {
      toast(`Failed to send receipt: ${e.message}`, 'error');
    } finally {
      setIssuingReceipt(false);
    }
  };

  const openAgreeModal = () => {
    if (iAgreed) return;
    const listed = parseFloat(
      lastOffer || channel.agreed_price || channel.transfer_amount || 0
    );
    setAgreePrice(listed > 0 ? String(listed) : '');
    setAgreePriceOk(listed > 0);
    setAgreeModal(true);
  };

  const confirmAgreement = async () => {
    const price = parseFloat(agreePrice);
    if (!price || price <= 0) { toast('Enter the final agreed amount','error'); return; }
    setAgreeModal(false);
    try {
      // ── Call REST API — this persists agreement in DB and auto-generates
      //    the CHALLAN message when both parties have agreed ──
      const r = await apiFetch(`/api/channels/${CHANNEL_ID}/agree`, {
        method: 'POST',
        body: JSON.stringify({
          agreedTerms: `Agreed at PKR ${price.toLocaleString()}`,
          agreedPrice: price,
        }),
      });
      const d = await r.json();
      if (!d.success && !d.agreed) throw new Error(d.error || d.message || 'Failed to record agreement');

      setIAgreed(true);
      setLastOffer(price);

      if (d.bothAgreed) {
        // Challan was already inserted in DB — reload messages to pull it in
        handleBothAgreed(price);
        await loadAll();
      } else {
        addSystem(`You agreed at PKR ${price.toLocaleString()}. Waiting for ${myRole==='SELLER'?'Buyer':'Seller'}…`);
        toast('Agreement recorded. Waiting for other party…','success');
      }

      // Refresh channel state so agree chips update
      await loadAll();

    } catch (e) {
      toast('Failed to record agreement: ' + e.message, 'error');
      setIAgreed(false);
    }
  };

  /* ── Disagree ── */
  const confirmDisagreement = async () => {
    setDisagreeing(true);
    try {
      const r = await apiFetch(`/api/channels/${CHANNEL_ID}/disagree`, {
        method: 'POST',
        body: JSON.stringify({ reason: disagreeReason }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || d.message || 'Failed');
      setIAgreed(false);
      setBothAgreed(false);
      setDisagreeModal(false);
      setDisagreeReason('');
      // Notify other party via socket
      socketRef.current?.emit('disagreed', { channelId: CHANNEL_ID, reason: disagreeReason });
      toast('Disagreement sent. Continue negotiating.', 'info');
      await loadAll();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      setDisagreeing(false);
    }
  };

  const openChallanPayment = (cd, msgKey) => {
    const params = new URLSearchParams({
      transferId: String(TRANSFER_ID || cd.transferId || ''),
      channelId: String(CHANNEL_ID || ''),
      role: String(myRole || ''),
      challanId: String(cd.challanId || ''),
      challanKey: String(msgKey || ''),
      source: 'negotiation-chat',
    });
    navigate(`/citizen/challan-payment?${params.toString()}`);
  };

  const payChallan = async (cd, msgKey) => {
    if (!challanPin || challanPin.length < 4) { toast('Enter your PIN (min 4 digits)', 'error'); return; }
    setChallanPaying(true);
    try {
      const r = await apiFetch('/api/payments/transfer', {
        method: 'POST',
        body: JSON.stringify({
          transferId:     TRANSFER_ID || cd.transferId,
          channelId:      CHANNEL_ID,
          receiverUserId: cd.seller?.userId || cd.sellerId,
          amount:         cd.agreedPrice,
          pin:            challanPin,
        })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'Payment failed');

      const receipt = d.receipt;

      // Mark challan as paid locally
      setPaidChallans(prev => ({ ...prev, [msgKey]: receipt }));
      setMessages(prev => prev.map(m => {
        if ((m.messageType||m.message_type||'').toUpperCase() === 'CHALLAN') {
          try {
            const content = JSON.parse(m.messageContent||m.message_content||'{}');
            content.status = 'PAID';
            content.txnRef = receipt.txnRef;
            content.receipt = receipt;
            return { ...m, messageContent: JSON.stringify(content) };
          } catch(e) { return m; }
        }
        return m;
      }));
      // Refresh buyer balance
      setMyAccount(prev => prev ? { ...prev, balance: receipt.sender.balanceAfter } : prev);

      // Notify seller via websocket
      socketRef.current?.emit('notify_payment_done', {
        channelId:        CHANNEL_ID,
        txnRef:           receipt.txnRef,
        amount:           receipt.amount,
        buyerName:        receipt.sender.name,
        sellerBalanceAfter: receipt.receiver.balanceAfter,
      });

      toast('💸 Payment successful!', 'success');
      setChallanPin('');
    } catch(e) {
      toast('Payment failed: ' + e.message, 'error');
    } finally {
      setChallanPaying(false);
    }
  };

  const sendMessage = () => {
    const t = text.trim();
    if (!t) return;
    const _tempId = `temp-txt-${Date.now()}`;
    const payload = {
      senderId: userId, senderRole: myRole,
      messageType: 'TEXT', messageContent: t,
      timestamp: new Date().toISOString(),
    };
    // Try P2P first — server never sees this message if DataChannel is open
    const sentP2P = sendP2P(payload);
    if (!sentP2P) {
      // Fallback: server relay (stored in DB as usual)
      socketRef.current?.emit('send_message', { channelId:CHANNEL_ID, message:t, messageType:'TEXT' });
    }
    setMessages(p => [...p, { _tempId, ...payload }]);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height='auto';
    scrollBottom();
  };

  const sendOffer = () => {
    const amt = parseFloat(offerAmt);
    if (!amt||amt<=0) { toast('Enter a valid amount','error'); return; }
    const _offerId = `temp-offer-${Date.now()}`;
    const payload = {
      senderId: userId, senderRole: myRole,
      messageType: 'PRICE_OFFER',
      messageContent: `Offered price: PKR ${amt.toLocaleString()}`,
      priceOffer: amt,
      timestamp: new Date().toISOString(),
    };
    // Price offers also go P2P if possible
    const sentP2P = sendP2P(payload);
    if (!sentP2P) {
      socketRef.current?.emit('send_price_offer', { channelId:CHANNEL_ID, offeredPrice:amt });
    }
    setMessages(p => [...p, { _tempId:_offerId, ...payload }]);
    setLastOffer(amt);
    setOfferAmt(''); setShowOffer(false); scrollBottom();
  };

  const sendImage = async file => {
    if (!file) return;
    if (file.size>10*1024*1024) { toast('Max 10 MB','error'); return; }
    const blobUrl = URL.createObjectURL(file);
    setMessages(p => [...p, { _tempId:`temp-${Date.now()}`, senderId:userId, senderRole:myRole, messageType:'IMAGE_MESSAGE', messageContent:blobUrl, _isBlob:true, fileName:file.name, timestamp:new Date() }]);
    scrollBottom(); setImgUploading(true);
    try {
      const fd = new FormData(); fd.append('media', file);
      const r  = await fetch(`${BASE}/api/channels/${CHANNEL_ID}/send-media`, { method:'POST', headers:{ Authorization:`Bearer ${authToken}` }, body:fd });
      const d  = await r.json();
      if (d.success) socketRef.current?.emit('send_message', { channelId:CHANNEL_ID, message:JSON.stringify({ url:d.mediaUrl, fn:file.name }), messageType:'IMAGE_MESSAGE' });
    } catch(e) { toast('Image upload failed','error'); }
    finally { setImgUploading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      recChunks.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mr   = new MediaRecorder(stream, { mimeType:mime });
      mediaRec.current = mr;
      mr.ondataavailable = e => { if (e.data.size>0) recChunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(recChunks.current, { type:mime });
        const dur  = recSecRef.current; recSecRef.current = 0; setRecSec(0);
        await sendVoice(blob, dur);
      };
      mr.start(); setIsRecording(true); setRecSec(0); recSecRef.current = 0;
      recTimer.current = setInterval(() => { recSecRef.current += 1; setRecSec(recSecRef.current); }, 1000);
    } catch(e) { toast('Microphone access denied','error'); }
  };
  const stopRecording   = () => { clearInterval(recTimer.current); mediaRec.current?.stop(); setIsRecording(false); };
  const cancelRecording = () => {
    clearInterval(recTimer.current);
    try { mediaRec.current?.stream?.getTracks().forEach(t=>t.stop()); } catch(e){}
    try { mediaRec.current?.stop(); } catch(e){}
    mediaRec.current = null; recChunks.current = [];
    setIsRecording(false); setRecSec(0);
  };

  const sendVoice = async (blob, dur) => {
    const blobUrl = URL.createObjectURL(blob);
    setMessages(p => [...p, { _tempId:`temp-${Date.now()}`, senderId:userId, senderRole:myRole, messageType:'VOICE_MESSAGE', messageContent:blobUrl, _isBlob:true, durationSec:dur, timestamp:new Date() }]);
    scrollBottom();
    try {
      const voiceExt = blob.type.includes('ogg') ? '.ogg' : '.webm';
      const fd = new FormData(); fd.append('media', blob, `voice-${Date.now()}${voiceExt}`);
      const r  = await fetch(`${BASE}/api/channels/${CHANNEL_ID}/send-media`, { method:'POST', headers:{ Authorization:`Bearer ${authToken}` }, body:fd });
      const d  = await r.json();
      if (d.success) socketRef.current?.emit('send_message', { channelId:CHANNEL_ID, message:JSON.stringify({ url:d.mediaUrl, dur }), messageType:'VOICE_MESSAGE' });
    } catch(e) {}
  };

  const handleKeyDown   = e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleTypingEvt = () => {
    // Typing indicator always uses socket — it's metadata, not message content
    socketRef.current?.emit('typing', { channelId:CHANNEL_ID });
  };

  const submitScreenshot = async () => {
    if (!uploadFile)  { toast('Select a file','error'); return; }
    if (!agreedPrice) { toast('Enter agreed price','error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('screenshot', uploadFile); fd.append('agreedPrice', agreedPrice); fd.append('agreedTerms','Both parties agreed via direct negotiation.');
      const r = await fetch(`${BASE}/api/channels/${CHANNEL_ID}/upload-screenshot`, { method:'POST', headers:{ Authorization:`Bearer ${authToken}` }, body:fd });
      const d = await r.json();
      if (d.success) { setUploadModal(false); toast('Submitted for LRO review','success'); addSystem('Agreement screenshot submitted for LRO verification.'); }
      else throw new Error(d.error||'Upload failed');
    } catch(e) { toast('Upload failed: '+e.message,'error'); }
    finally { setUploading(false); }
  };

  const latestPendingChallanKey = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      const msgType = (candidate?.messageType || candidate?.message_type || '').toUpperCase();
      if (msgType !== 'CHALLAN') continue;
      if (!isPaidChallanMessage(candidate, paidChallans)) {
        return getMessageKey(candidate);
      }
    }
    return null;
  })();

  /* ─── Message Bubble ─── */
  const MsgBubble = ({ msg }) => {
    const isMe     = String(msg.senderId||msg.sender_id||'')===String(userId);
    const msgType  = (msg.messageType||msg.message_type||'').toUpperCase();
    const rawContent = msg.messageContent||msg.message_content||'';
    const ts       = fmtTime(msg.timestamp);
    const isOffer  = msgType==='PRICE_OFFER';
    const isImage  = msgType==='IMAGE_MESSAGE';
    const isVoice  = msgType==='VOICE_MESSAGE';
    const isChallan= msgType==='CHALLAN';
    const isReceipt= msgType==='RECEIPT_PROPOSAL';
    const sRole    = (msg.senderRole||msg.sender_role||'').toUpperCase();
    const challanKey = getMessageKey(msg);

    // ── CHALLAN check FIRST — must come before isSystemMessage check because
    //    CHALLAN rows are stored with is_system_message=true in the DB, so the
    //    system-message branch would catch them and render raw JSON text. ──
    if (isChallan) {
      // Both roles see the full ChallanBubble — ChallanBubble handles role-specific rendering internally
      return (
        <div style={{ display:'flex', justifyContent:'center', margin:'10px 0' }}>
          <ChallanBubble
            msg={msg}
            myRole={myRole}
            myAccount={myAccount}
            sellerAccount={sellerAccount}
            challanPin={challanPin}
            setChallanPin={setChallanPin}
            challanPaying={challanPaying}
            onPay={payChallan}
            paidChallans={paidChallans}
            sellerBalanceAfter={sellerBalAfter}
            onOpenPayment={openChallanPayment}
            isLatestPending={challanKey && challanKey === latestPendingChallanKey}
          />
        </div>
      );
    }

    if (isReceipt) {
      return (
        <div style={{ display:'flex', justifyContent:isMe ? 'flex-end' : 'flex-start', margin:'8px 0' }}>
          <ReceiptProposalBubble
            msg={msg}
            isMe={isMe}
            onUseReceipt={useReceiptProposal}
          />
        </div>
      );
    }

    if (msg.isSystemMessage||msg.message_type==='SYSTEM'||msg.is_system_message||msgType==='SYSTEM') {
      return (
        <div style={{ textAlign:'center', margin:'8px 0' }}>
          <span style={{ background:'#f0f4f8', color:'#6b7280', borderRadius:100, padding:'3px 14px', fontSize:'.72rem', fontWeight:600 }}>{rawContent}</span>
        </div>
      );
    }

    let content = rawContent, mediaFileName = msg.fileName||null, mediaDurSec = msg.durationSec!=null ? msg.durationSec : null;
    if ((isImage||isVoice) && !msg._isBlob && rawContent.startsWith('{')) {
      try { const p = JSON.parse(rawContent); if(p.url) content=p.url; if(p.fn) mediaFileName=p.fn; if(p.dur!=null) mediaDurSec=p.dur; } catch(e){}
    }

    const serverUrl = content.startsWith('http') ? content : `${BASE}${content}`;
    const imgSrc    = msg._isBlob ? content : serverUrl;

    return (
      <div style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:8, margin:'3px 0', alignItems:'flex-end' }}>
        <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.65rem', color:'white', background:sRole==='SELLER'?P:'#6366f1' }}>
          <i className={sRole==='SELLER'?'fas fa-user-tie':'fas fa-user'} />
        </div>
        <div style={{ maxWidth:'68%', display:'flex', flexDirection:'column', alignItems:isMe?'flex-end':'flex-start' }}>
          <div style={{
            background: isMe ? (isOffer?'linear-gradient(135deg,#d97706,#f59e0b)':`linear-gradient(135deg,${PD},${P})`) : (isOffer?'linear-gradient(135deg,#ea580c,#f97316)':'#ffffff'),
            color: isMe||isOffer ? 'white' : '#111827',
            borderRadius: isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',
            padding: isImage||isVoice ? '6px' : '10px 14px',
            boxShadow: isMe?`0 2px 8px rgba(13,124,124,.25)`:'0 1px 4px rgba(0,0,0,.07)',
            border: isMe?'none':'1px solid #e5e7eb', overflow:'hidden',
          }}>
            {isOffer && (
              <div>
                <div style={{ fontSize:'.62rem', fontWeight:800, textTransform:'uppercase', letterSpacing:.8, opacity:.75, marginBottom:4, display:'flex', alignItems:'center', gap:5 }}>
                  <i className="fas fa-tag" /> Price Offer
                </div>
                <div style={{ fontSize:'1.2rem', fontWeight:900, letterSpacing:-.5 }}>
                  PKR {Number(msg.priceOffer||msg.price_offer||0).toLocaleString()}
                </div>
                {!isMe && !iAgreed && (
                  <button
                    onClick={() => { const amt = parseFloat(msg.priceOffer||msg.price_offer||0); setAgreePrice(String(amt)); setAgreePriceOk(true); setLastOffer(amt); setAgreeModal(true); }}
                    style={{ marginTop:8, padding:'5px 12px', borderRadius:8, background:'rgba(255,255,255,.25)', border:'1.5px solid rgba(255,255,255,.5)', color:'white', fontWeight:700, fontSize:'.7rem', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                    <i className="fas fa-check" /> Accept this offer
                  </button>
                )}
              </div>
            )}
            {isImage && (
              <div>
                <img src={imgSrc} alt={mediaFileName||'image'} crossOrigin="anonymous"
                  style={{ maxWidth:240, maxHeight:200, borderRadius:12, display:'block', cursor:'pointer', objectFit:'cover' }}
                  onClick={e=>window.open(e.target.src,'_blank')}
                  onError={e=>{ e.target.style.display='none'; const n=e.target.nextElementSibling; if(n) n.style.display='flex'; }} />
                <a href={imgSrc} target="_blank" rel="noreferrer" style={{ display:'none', alignItems:'center', gap:6, padding:'8px 10px', fontSize:'.78rem', fontWeight:600, color:isMe?'white':'#0D7C7C', textDecoration:'none', background:isMe?'rgba(255,255,255,.15)':'#E6F4F2', borderRadius:8 }}>
                  <i className="fas fa-download" />{mediaFileName||'Download image'}
                </a>
              </div>
            )}
            {isVoice && (
              <div style={{ padding:'8px 10px', minWidth:200 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:isMe?'rgba(255,255,255,.2)':PL, display:'flex', alignItems:'center', justifyContent:'center', color:isMe?'white':P, fontSize:'.8rem' }}>
                    <i className="fas fa-microphone" />
                  </div>
                  <div>
                    <div style={{ fontSize:'.7rem', fontWeight:700, color:isMe?'white':'#374151' }}>Voice Message</div>
                    {mediaDurSec!=null && <div style={{ fontSize:'.62rem', opacity:.55 }}>{mediaDurSec}s</div>}
                  </div>
                </div>
                <audio controls crossOrigin="anonymous" style={{ width:'100%', height:28, display:'block', outline:'none' }}>
                  <source src={imgSrc} /><source src={imgSrc} type="audio/webm" /><source src={imgSrc} type="audio/ogg" />
                </audio>
              </div>
            )}
            {!isOffer&&!isImage&&!isVoice && (
              <div style={{ fontSize:'.875rem', lineHeight:1.5, wordBreak:'break-word' }} dangerouslySetInnerHTML={{ __html:escHtml(content) }} />
            )}
          </div>
          <div style={{ fontSize:'.63rem', color:'#9ca3af', marginTop:3, padding:'0 4px' }}>{ts}</div>
        </div>
      </div>
    );
  };

  const connPill = ({ connected:['#10b981','● Live'], offline:['#6b7280','⚫ Offline'], error:['#ef4444','● Error'], connecting:['#f59e0b','● Connecting'] })[connStatus] || ['#f59e0b','● …'];
  // P2P pill — shown alongside connPill to indicate DataChannel status
  const p2pPill = {
    open:       ['#10b981', '⚡ P2P'],
    connecting: ['#f59e0b', '⚡ Connecting'],
    failed:     ['#ef4444', '⚡ P2P Failed'],
    closed:     ['#6b7280', '⚡ Relay'],
    idle:       ['#6b7280', '⚡ Relay'],
  }[p2pStatus] || ['#6b7280', '⚡ Relay'];
  const peerLabel  = myRole==='SELLER' ? 'Buyer'  : 'Seller';
  const peerOnline = myRole==='SELLER' ? buyerOnline : sellerOnline;

  const navTitle = (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div>
        <div style={{ fontWeight:800, fontSize:'.85rem', fontFamily:"'Sora',sans-serif", color:'#111827', display:'flex', alignItems:'center', gap:6 }}>
          Direct Negotiation
          <span style={{ background:PL, color:P, borderRadius:100, padding:'1px 8px', fontSize:'.6rem', fontWeight:700 }}>
            #{CHANNEL_ID?.slice(-6)||'——'}
          </span>
        </div>
        <div style={{ fontSize:'.67rem', color:'#6b7280', marginTop:2, display:'flex', alignItems:'center', gap:8 }}>
          <span><span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:peerOnline?'#10b981':'#d1d5db', marginRight:3, verticalAlign:'middle' }} />{peerLabel}: {peerOnline?'Online':'Offline'}</span>
          <span style={{ background:connPill[0], color:'white', borderRadius:100, padding:'1px 7px', fontSize:'.58rem', fontWeight:700 }}>{connPill[1]}</span>
          <span style={{ background:p2pPill[0], color:'white', borderRadius:100, padding:'1px 7px', fontSize:'.58rem', fontWeight:700, marginLeft:3 }}>{p2pPill[1]}</span>
        </div>
      </div>
    </div>
  );

  if (!CHANNEL_ID) {
    return (
      <CitizenLayout title="Negotiation">
        {autoLoading ? (
          <div style={{ textAlign:'center', padding:'5rem', color:'#6b7280' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize:'1.5rem', color:P, display:'block', marginBottom:12 }} />Finding your active chats…
          </div>
        ) : autoChannels.length>0 ? (
          <div style={{ maxWidth:520, margin:'0 auto' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', color:'#111827', marginBottom:'1rem', fontFamily:"'Sora',sans-serif" }}>
              <i className="fas fa-comments-dollar" style={{ color:P, marginRight:8 }} />Your Active Negotiations
            </div>
            {autoChannels.map(ch => (
              <div key={ch.channel_id} onClick={()=>navigate(`/citizen/negotiation?channelId=${ch.channel_id}&transferId=${ch.transfer_id||''}`)}
                style={{ background:'#fff', border:'1.5px solid #d6e8e8', borderRadius:12, padding:'1rem 1.25rem', marginBottom:'.75rem', cursor:'pointer', display:'flex', alignItems:'center', gap:14 }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=P;e.currentTarget.style.boxShadow='0 4px 14px rgba(13,124,124,.12)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#d6e8e8';e.currentTarget.style.boxShadow='none';}}>
                <div style={{ width:44, height:44, background:PL, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', color:P, fontSize:'1.1rem', flexShrink:0 }}>
                  <i className="fas fa-comments" />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'.9rem', color:'#111827' }}>{ch.channel_id}</div>
                  <div style={{ fontSize:'.72rem', color:'#6b7280', marginTop:2 }}>Status: {ch.channel_status} · Transfer: {ch.transfer_id||'—'}</div>
                </div>
                <i className="fas fa-chevron-right" style={{ color:'#d1d5db' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'5rem', color:'#6b7280' }}>
            <i className="fas fa-comments" style={{ fontSize:'2rem', color:'#d1d5db', display:'block', marginBottom:12 }} />No active negotiations found.
          </div>
        )}
      </CitizenLayout>
    );
  }

  return (
    <CitizenLayout title={navTitle}>
      <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{ const f=e.target.files[0]; if(f) sendImage(f); e.target.value=''; }} />
      <input ref={scFileRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>{ const f=e.target.files[0]; if(f){setUploadFile(f);if(f.type.startsWith('image/')){const r=new FileReader();r.onload=ev=>setUploadPreview(ev.target.result);r.readAsDataURL(f);}else setUploadPreview('');} }} />

      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,.06)', height:'calc(100vh - 124px)', display:'flex', flexDirection:'column' }}>

        {/* STATUS BAR */}
        <div style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb', padding:'7px 16px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', flexShrink:0 }}>
          {channel.property_id && (
            <span style={{ fontSize:'.72rem', color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-home" style={{ color:P, fontSize:'.65rem' }} />
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{channel.property_id}</span>
            </span>
          )}
          {channel.transfer_amount && (
            <span style={{ fontSize:'.72rem', color:'#374151', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-coins" style={{ color:'#d97706', fontSize:'.65rem' }} />
              <strong>Listed: PKR {Number(channel.transfer_amount).toLocaleString()}</strong>
            </span>
          )}
          {lastOffer > 0 && (
            <span style={{ background:'#fffbeb', color:'#92400e', borderRadius:100, padding:'2px 10px', fontSize:'.72rem', fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-tag" style={{ fontSize:'.62rem' }} />Latest offer: PKR {Number(lastOffer).toLocaleString()}
            </span>
          )}
          <div style={{ display:'flex', gap:5, alignItems:'center', marginLeft:'auto' }}>
            {[['Seller',channel.seller_agreed],['Buyer',channel.buyer_agreed]].map(([role,agreed])=>(
              <span key={role} style={{ padding:'2px 9px',borderRadius:100,fontSize:'.62rem',fontWeight:700,background:agreed?'#d1fae5':'#fef3c7',color:agreed?'#065f46':'#92400e' }}>
                {role}: {agreed?'✅':'⏳'}
              </span>
            ))}
          </div>
        </div>

        {/* MESSAGES */}
        <div ref={msgRef} style={{ flex:1, overflowY:'auto', padding:'14px 16px', background:'#f8fafc', display:'flex', flexDirection:'column' }}>
          <div style={{ textAlign:'center', marginBottom:10 }}>
            <span style={{ background:'#e0f2fe',color:'#0369a1',borderRadius:100,padding:'3px 13px',fontSize:'.68rem',fontWeight:600,display:'inline-flex',alignItems:'center',gap:5 }}>
              <i className="fas fa-comments" style={{ fontSize:'.58rem' }} />Direct negotiation channel · Messages recorded in system
            </span>
          </div>
          {messages.map((m,i) => <MsgBubble key={m.message_id||m.messageId||m._tempId||i} msg={m} />)}
          {typing && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', color:'#9ca3af', fontSize:'.78rem' }}>
              <div style={{ display:'flex', gap:3 }}>
                {[0,1,2].map(i=><span key={i} style={{ width:5,height:5,background:'#d1d5db',borderRadius:'50%',display:'inline-block',animation:`bounce .7s ${i*.15}s infinite` }} />)}
              </div>
              {peerLabel} is typing…
            </div>
          )}
          {imgUploading && <div style={{ textAlign:'right', fontSize:'.7rem', color:P }}><i className="fas fa-spinner fa-spin" /> Sending…</div>}
        </div>

        {/* PRICE OFFER PANEL */}
        {showOffer && (
          <div style={{ background:'#fffbeb', borderTop:'1px solid #fde68a', padding:'10px 14px', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <i className="fas fa-tag" style={{ color:'#d97706', flexShrink:0 }} />
            <input type="number" value={offerAmt} onChange={e=>setOfferAmt(e.target.value)}
              placeholder="Enter amount in PKR…" min="0" autoFocus
              style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1.5px solid #fcd34d', fontSize:'.875rem', outline:'none', background:'white' }}
              onKeyDown={e=>{ if(e.key==='Enter') sendOffer(); }} />
            <button onClick={sendOffer} style={{ padding:'8px 16px',borderRadius:8,background:'#d97706',color:'white',border:'none',fontWeight:700,fontSize:'.78rem',cursor:'pointer' }}>Send</button>
            <button onClick={()=>setShowOffer(false)} style={{ width:30,height:30,borderRadius:7,background:'transparent',border:'1.5px solid #e5e7eb',color:'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <i className="fas fa-times" />
            </button>
          </div>
        )}

        {/* INPUT BAR */}
        <div style={{ borderTop:'1px solid #e5e7eb', background:'#fff', padding:'10px 12px', flexShrink:0 }}>
          {isRecording ? (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:10,height:10,borderRadius:'50%',background:'#ef4444',flexShrink:0,animation:'pulse 1s infinite' }} />
              <span style={{ fontWeight:800, color:'#ef4444', fontSize:'1rem', minWidth:44, fontFamily:"'JetBrains Mono',monospace" }}>
                {String(Math.floor(recSec/60)).padStart(2,'0')}:{String(recSec%60).padStart(2,'0')}
              </span>
              <div style={{ flex:1, height:4, background:'#fee2e2', borderRadius:100 }}>
                <div style={{ height:'100%', background:'#ef4444', width:`${Math.min((recSec/120)*100,100)}%`, transition:'width 1s linear', borderRadius:100 }} />
              </div>
              <button onClick={cancelRecording} style={{ padding:'7px 13px',borderRadius:9,border:'1.5px solid #e5e7eb',background:'transparent',color:'#6b7280',fontWeight:600,fontSize:'.78rem',cursor:'pointer' }}>Cancel</button>
              <button onClick={stopRecording} style={{ padding:'7px 14px',borderRadius:9,border:'none',background:'#ef4444',color:'white',fontWeight:700,fontSize:'.78rem',cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
                <i className="fas fa-stop" /> Send
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'flex-end', gap:7 }}>
              <button onClick={()=>imgRef.current?.click()} title="Send image"
                style={{ width:35,height:35,borderRadius:10,border:'1.5px solid #e5e7eb',background:'transparent',color:'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.85rem' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=P;e.currentTarget.style.color=P;e.currentTarget.style.background=PL;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.color='#9ca3af';e.currentTarget.style.background='transparent';}}>
                <i className="fas fa-image" />
              </button>
              <button onClick={()=>setShowOffer(v=>!v)} title="Make price offer"
                style={{ width:35,height:35,borderRadius:10,border:`1.5px solid ${showOffer?'#fcd34d':'#e5e7eb'}`,background:showOffer?'#fffbeb':'transparent',color:showOffer?'#d97706':'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.85rem' }}>
                <i className="fas fa-tag" />
              </button>
              {myRole === 'SELLER' && !bothAgreed && (
                <button
                  onClick={openReceiptModal}
                  title="Issue receipt proposal"
                  style={{
                    height:35, padding:'0 10px', borderRadius:10, flexShrink:0,
                    border:'1.5px solid #bfdbfe',
                    background:'#eff6ff',
                    color:'#1d4ed8',
                    fontWeight:800, fontSize:'.72rem', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
                  }}>
                  <i className="fas fa-file-invoice-dollar" />Receipt
                </button>
              )}
              {/* AGREE BUTTON — shown to both parties until they've each agreed */}
              {!bothAgreed && (
                <>
                  <button
                    onClick={iAgreed ? undefined : openAgreeModal}
                    title={iAgreed ? `You agreed · waiting for ${peerLabel}` : 'Agree to this deal'}
                    style={{
                      height:35, padding:'0 12px', borderRadius:10, flexShrink:0,
                      border: iAgreed ? '1.5px solid #bbf7d0' : '1.5px solid #34d399',
                      background: iAgreed ? '#d1fae5' : '#ecfdf5',
                      color: iAgreed ? '#047857' : '#065f46',
                      fontWeight:800, fontSize:'.72rem', cursor: iAgreed ? 'default' : 'pointer',
                      display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
                    }}>
                    {iAgreed
                      ? <><i className="fas fa-check" />Agreed</>
                      : <><i className="fas fa-handshake" />Agree</>
                    }
                  </button>
                  {/* DISAGREE BUTTON */}
                  <button
                    onClick={() => setDisagreeModal(true)}
                    title="Disagree and reopen negotiation"
                    style={{
                      height:35, padding:'0 10px', borderRadius:10, flexShrink:0,
                      border:'1.5px solid #fecaca',
                      background:'#fef2f2',
                      color:'#dc2626',
                      fontWeight:700, fontSize:'.72rem', cursor:'pointer',
                      display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
                    }}>
                    <i className="fas fa-times" />No
                  </button>
                </>
              )}
              <textarea ref={textareaRef} value={text}
                onChange={e=>{setText(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}}
                onKeyDown={handleKeyDown} onInput={handleTypingEvt}
                placeholder="Type a message…" rows={1}
                style={{ flex:1,padding:'9px 13px',borderRadius:12,border:'1.5px solid #e5e7eb',fontSize:'.875rem',resize:'none',outline:'none',fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,maxHeight:120,overflowY:'auto' }}
                onFocus={e=>e.target.style.borderColor=P} onBlur={e=>e.target.style.borderColor='#e5e7eb'}
              />
              {text.trim() ? (
                <button onClick={sendMessage} style={{ width:37,height:37,borderRadius:11,border:'none',background:`linear-gradient(135deg,${PD},${P})`,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem',flexShrink:0 }}>
                  <i className="fas fa-paper-plane" />
                </button>
              ) : (
                <button onClick={startRecording} style={{ width:37,height:37,borderRadius:11,border:'1.5px solid #e5e7eb',background:'transparent',color:'#9ca3af',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem',flexShrink:0 }}>
                  <i className="fas fa-microphone" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RECEIPT PROPOSAL MODAL */}
      {receiptModal && (
        <>
          <div onClick={()=>setReceiptModal(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:1000,backdropFilter:'blur(4px)' }} />
          <div style={{ position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:1001,background:'white',borderRadius:24,width:'min(460px,92vw)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#1d4ed8,#2563eb)', padding:'1.35rem 1.5rem' }}>
              <div style={{ color:'white', fontWeight:800, fontSize:'1.05rem', fontFamily:"'Sora',sans-serif" }}>Issue Receipt Proposal</div>
              <div style={{ color:'rgba(255,255,255,.75)', fontSize:'.78rem', marginTop:4 }}>
                Seller amount aur duration set karega. Buyer isi receipt ko review karke agreement confirm karega.
              </div>
            </div>
            <div style={{ padding:'1.5rem' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:'.72rem', fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                    Receipt Amount (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={receiptAmount}
                    onChange={(e) => setReceiptAmount(e.target.value)}
                    placeholder="e.g. 4500000"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid #dbe4ea', fontSize:'.9rem', outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.72rem', fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={receiptDays}
                    onChange={(e) => setReceiptDays(e.target.value)}
                    placeholder="7"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid #dbe4ea', fontSize:'.9rem', outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              </div>
              <div style={{ marginTop:12 }}>
                <label style={{ display:'block', fontSize:'.72rem', fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                  Note
                </label>
                <textarea
                  rows={3}
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="e.g. This amount includes the final negotiated price."
                  style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid #dbe4ea', fontSize:'.88rem', outline:'none', resize:'none', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif" }}
                />
              </div>

              <div style={{ marginTop:14, padding:'11px 13px', borderRadius:12, background:'#eff6ff', border:'1px solid #bfdbfe', fontSize:'.8rem', color:'#1d4ed8', lineHeight:1.6 }}>
                Buyer pehle receipt ko chat mein dekhega, phir <strong>Review &amp; Confirm</strong> se agreement confirm karega. Dono confirm karne ke baad challan generate hoga.
              </div>

              <div style={{ display:'flex', gap:10, marginTop:'1.25rem' }}>
                <button onClick={()=>setReceiptModal(false)}
                  style={{ flex:1, padding:'11px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'white', color:'#6b7280', fontWeight:700, cursor:'pointer', fontSize:'.9rem' }}>
                  Cancel
                </button>
                <button onClick={issueReceiptProposal} disabled={issuingReceipt}
                  style={{ flex:2, padding:'11px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'white', fontWeight:800, fontSize:'.9rem', cursor:issuingReceipt?'not-allowed':'pointer', opacity:issuingReceipt?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {issuingReceipt
                    ? <><i className="fas fa-spinner fa-spin" />Sending…</>
                    : <><i className="fas fa-paper-plane" />Send Receipt</>
                  }
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AGREE MODAL */}
      {agreeModal && (
        <>
          <div onClick={()=>setAgreeModal(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:1000,backdropFilter:'blur(4px)' }} />
          <div style={{ position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:1001,background:'white',borderRadius:24,width:'min(460px,92vw)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#065f46,#047857)', padding:'1.5rem', textAlign:'center' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:8 }}>🤝</div>
              <div style={{ color:'white', fontWeight:800, fontSize:'1.1rem', fontFamily:"'Sora',sans-serif" }}>Confirm Your Agreement</div>
              <div style={{ color:'rgba(255,255,255,.75)', fontSize:'.78rem', marginTop:4 }}>
                Both parties must confirm the same receipt amount.<br/>
                A payment challan will appear automatically in this chat.
              </div>
            </div>
            <div style={{ padding:'1.5rem' }}>
              {/* ── Final amount selected from receipt / latest offer ── */}
              <div style={{ fontSize:'.72rem', fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:.6, marginBottom:8 }}>
                Transfer Amount
              </div>
              {agreePrice ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderRadius:14, border:'2px solid #10b981', background:'#ecfdf5', marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:'1.5rem', fontWeight:900, color:'#047857', fontFamily:"'JetBrains Mono',monospace", letterSpacing:-1 }}>
                      PKR {Number(parseFloat(agreePrice)).toLocaleString('en-PK')}
                    </div>
                    <div style={{ fontSize:'.68rem', color:'#6b7280', marginTop:3 }}>
                      Final receipt / negotiated amount selected for confirmation
                    </div>
                  </div>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'#d1fae5', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <i className="fas fa-lock" style={{ color:'#059669', fontSize:'.9rem' }} />
                  </div>
                </div>
              ) : (
                <div style={{ padding:'12px 16px', borderRadius:12, background:'#fef2f2', border:'1.5px solid #fecaca', fontSize:'.82rem', color:'#dc2626', marginBottom:14 }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight:6 }} />
                  Transfer amount not loaded. Close and reopen.
                </div>
              )}
              <div style={{ display:'flex', gap:10, marginTop:'1.25rem' }}>
                <button onClick={()=>setAgreeModal(false)}
                  style={{ flex:1, padding:'11px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'white', color:'#6b7280', fontWeight:700, cursor:'pointer', fontSize:'.9rem' }}>
                  Cancel
                </button>
                <button onClick={confirmAgreement} disabled={!agreePrice||parseFloat(agreePrice)<=0}
                  style={{ flex:2, padding:'11px', borderRadius:12, border:'none',
                    background: !agreePrice||parseFloat(agreePrice)<=0 ? '#d1d5db' : 'linear-gradient(135deg,#065f46,#10b981)',
                    color: !agreePrice||parseFloat(agreePrice)<=0 ? '#9ca3af' : 'white',
                    fontWeight:800, fontSize:'.9rem', cursor:!agreePrice||parseFloat(agreePrice)<=0?'not-allowed':'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    boxShadow: !agreePrice||parseFloat(agreePrice)<=0 ? 'none' : '0 4px 16px rgba(16,185,129,.35)',
                  }}>
                  <i className="fas fa-handshake" /> Confirm Agreement
                </button>
              </div>
              <p style={{ textAlign:'center', fontSize:'.68rem', color:'#9ca3af', marginTop:10 }}>
                This is recorded on the blockchain and cannot be undone.
              </p>
            </div>
          </div>
        </>
      )}

      {/* DISAGREE MODAL */}
      {disagreeModal && (
        <>
          <div onClick={()=>setDisagreeModal(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:1000,backdropFilter:'blur(4px)' }} />
          <div style={{ position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:1001,background:'white',borderRadius:24,width:'min(440px,92vw)',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#7f1d1d,#dc2626)', padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:'1.75rem' }}>❌</div>
              <div>
                <div style={{ color:'white', fontWeight:800, fontSize:'1rem', fontFamily:"'Sora',sans-serif" }}>Disagree &amp; Reopen Negotiation</div>
                <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.75rem', marginTop:2 }}>This will reset both parties' agreement status.</div>
              </div>
            </div>
            <div style={{ padding:'1.5rem' }}>
              <label style={{ display:'block', fontSize:'.75rem', fontWeight:800, color:'#374151', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                Reason (optional)
              </label>
              <textarea
                rows={3} value={disagreeReason}
                onChange={e=>setDisagreeReason(e.target.value)}
                placeholder="e.g. Price is too high, please reconsider…"
                style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid #e5e7eb', fontSize:'.875rem', resize:'none', outline:'none', fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box' }}
                onFocus={e=>e.target.style.borderColor='#dc2626'}
                onBlur={e=>e.target.style.borderColor='#e5e7eb'}
              />
              <div style={{ display:'flex', gap:10, marginTop:'1.25rem' }}>
                <button onClick={()=>setDisagreeModal(false)}
                  style={{ flex:1, padding:'11px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'white', color:'#6b7280', fontWeight:700, cursor:'pointer', fontSize:'.9rem' }}>
                  Cancel
                </button>
                <button onClick={confirmDisagreement} disabled={disagreeing}
                  style={{ flex:2, padding:'11px', borderRadius:12, border:'none',
                    background:'linear-gradient(135deg,#7f1d1d,#dc2626)',
                    color:'white', fontWeight:800, fontSize:'.9rem',
                    cursor:disagreeing?'not-allowed':'pointer',
                    opacity:disagreeing?.6:1,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  }}>
                  {disagreeing
                    ? <><i className="fas fa-spinner fa-spin" />Sending…</>
                    : <><i className="fas fa-times-circle" />Confirm Disagree</>
                  }
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SCREENSHOT MODAL */}
      {uploadModal && (
        <>
          <div onClick={()=>setUploadModal(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1000,backdropFilter:'blur(4px)' }} />
          <div style={{ position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:1001,background:'#1e293b',borderRadius:20,padding:'1.5rem',width:'min(440px,90vw)',boxShadow:'0 24px 60px rgba(0,0,0,.4)' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem' }}>
              <div>
                <div style={{ color:'white',fontWeight:800,fontSize:'1rem' }}>Upload Agreement Screenshot</div>
                <div style={{ color:'rgba(255,255,255,.4)',fontSize:'.72rem',marginTop:2 }}>For LRO verification</div>
              </div>
              <button onClick={()=>setUploadModal(false)} style={{ width:30,height:30,borderRadius:8,background:'rgba(255,255,255,.08)',border:'none',color:'rgba(255,255,255,.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div onClick={()=>scFileRef.current?.click()}
              style={{ border:'2px dashed rgba(255,255,255,.15)',borderRadius:14,padding:'1.75rem',textAlign:'center',cursor:'pointer',marginBottom:'1rem',background:uploadFile?'rgba(16,185,129,.07)':'rgba(255,255,255,.02)' }}>
              {uploadFile
                ? <><img src={uploadPreview} alt="" style={{ maxHeight:90,borderRadius:8,display:uploadPreview?'block':'none',margin:'0 auto 8px' }} /><div style={{ color:'#34d399',fontWeight:700,fontSize:'.85rem' }}>{uploadFile.name}</div></>
                : <><i className="fas fa-cloud-upload-alt" style={{ color:'rgba(255,255,255,.2)',fontSize:'2rem',display:'block',marginBottom:8 }} /><div style={{ color:'rgba(255,255,255,.55)',fontWeight:600,fontSize:'.85rem' }}>Click to upload screenshot</div><div style={{ color:'rgba(255,255,255,.25)',fontSize:'.72rem',marginTop:3 }}>JPG, PNG, PDF — max 10 MB</div></>
              }
            </div>
            <div style={{ marginBottom:'1rem' }}>
              <label style={{ display:'block',color:'rgba(255,255,255,.65)',fontSize:'.78rem',fontWeight:700,marginBottom:5 }}>Final Agreed Price (PKR) *</label>
              <input type="number" value={agreedPrice||lastOffer||''} onChange={e=>setAgreedPrice(e.target.value)} placeholder="e.g. 2500000"
                style={{ width:'100%',padding:'10px 13px',borderRadius:10,border:'1.5px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.05)',color:'white',fontSize:'.875rem',outline:'none',boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
              <button onClick={()=>setUploadModal(false)} style={{ padding:'9px 16px',borderRadius:10,border:'1.5px solid rgba(255,255,255,.15)',background:'transparent',color:'rgba(255,255,255,.5)',fontWeight:600,cursor:'pointer',fontSize:'.85rem' }}>Cancel</button>
              <button onClick={submitScreenshot} disabled={uploading}
                style={{ padding:'9px 18px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${PD},${P})`,color:'white',fontWeight:700,cursor:uploading?'not-allowed':'pointer',opacity:uploading?.6:1,display:'flex',alignItems:'center',gap:7,fontSize:'.85rem' }}>
                {uploading?<><i className="fas fa-spinner fa-spin" />Uploading…</>:<><i className="fas fa-upload" />Submit to LRO</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* TOASTS */}
      <div style={{ position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:8 }}>
        {toasts.map(t=>(
          <div key={t.id} style={{ padding:'10px 16px',borderRadius:12,fontWeight:600,fontSize:'.85rem',color:'white',boxShadow:'0 4px 20px rgba(0,0,0,.2)',background:t.type==='success'?'#059669':t.type==='error'?'#dc2626':'#1e293b' }}>
            {t.msg}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        audio { accent-color:${P}; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:10px}
      `}</style>
    </CitizenLayout>
  );
};

export default TransferNegotiation;
