import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

/* ── helpers ── */
const fmtCnic = c => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 13 ? `${d.slice(0,5)}-${d.slice(5,12)}-${d.slice(12)}` : (c || '—');
};
const fmtPKR = n => 'PKR ' + Number(n || 0).toLocaleString('en-PK');

const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const tensW = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function chunk(n) {
  if (n < 20) return ones[n];
  if (n < 100) return tensW[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
  return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+chunk(n%100) : '');
}
function numWords(n) {
  if (!n || isNaN(n)) return '';
  let r = Math.floor(n);
  const c = Math.floor(r/10000000); r %= 10000000;
  const l = Math.floor(r/100000);   r %= 100000;
  const t = Math.floor(r/1000);     r %= 1000;
  let w = '';
  if (c) w += chunk(c) + ' Crore ';
  if (l) w += chunk(l) + ' Lakh ';
  if (t) w += chunk(t) + ' Thousand ';
  if (r) w += chunk(r);
  return w.trim() + ' Rupees Only';
}

/* ── small UI atoms ── */
const InfoRow = ({ icon, label, value, mono, accent }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '13px 0', borderBottom: '1px solid #1e2d3d'
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 8, background: '#0d1b2a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, border: '1px solid #1e2d3d'
    }}>
      <i className={`fas fa-${icon}`} style={{ color: '#38bdf8', fontSize: '.75rem' }} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#4a6785', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{
        fontSize: mono ? '.88rem' : '.95rem', fontWeight: 600,
        color: accent || '#e2e8f0',
        fontFamily: mono ? "'JetBrains Mono', 'Courier New', monospace" : 'inherit',
        wordBreak: 'break-all'
      }}>{value || '—'}</div>
    </div>
  </div>
);

const SectionCard = ({ title, icon, children, style = {} }) => (
  <div style={{
    background: '#0a1628', border: '1px solid #1e2d3d', borderRadius: 14,
    overflow: 'hidden', ...style
  }}>
    <div style={{
      padding: '14px 20px', borderBottom: '1px solid #1e2d3d',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'linear-gradient(90deg, #0d1f35 0%, #0a1628 100%)'
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <i className={`fas fa-${icon}`} style={{ color: 'white', fontSize: '.72rem' }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: '.85rem', color: '#cbd5e1', letterSpacing: .5 }}>{title}</span>
    </div>
    <div style={{ padding: '0 20px' }}>{children}</div>
  </div>
);

/* ── main component ── */
const Challan = () => {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const TRANSFER_ID    = params.get('transferId');
  const CHANNEL_ID     = params.get('channelId');
  const ROLE           = (params.get('role') || '').toUpperCase();
  const authToken      = sessionStorage.getItem('authToken');
  const userId         = sessionStorage.getItem('userId');
  const BASE           = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [channel,      setChannel]      = useState({});
  const [agreedPrice,  setAgreedPrice]  = useState(0);
  const [sellerUserId, setSellerUserId] = useState(null);
  const [buyerAccNo,   setBuyerAccNo]   = useState('');
  const [loading,      setLoading]      = useState(true);
  const [paid,         setPaid]         = useState(false);
  const [receipt,      setReceipt]      = useState(null);

  /* form state */
  const [entryAcc,     setEntryAcc]     = useState('');
  const [entryAmt,     setEntryAmt]     = useState('');
  const [entryPin,     setEntryPin]     = useState('');
  const [processing,   setProcessing]   = useState(false);

  /* upload-to-LRO */
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [uploadFile,    setUploadFile]    = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [submittingLro, setSubmittingLro] = useState(false);

  /* toasts */
  const [toasts, setToasts] = useState([]);

  const socketRef = useRef(null);
  const fileRef   = useRef();

  const toast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  };

  const apiFetch = (path, opts = {}) =>
    fetch(BASE + path, { ...opts, headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json', ...opts.headers } });

  useEffect(() => {
    if (!authToken) { navigate('/citizen/dashboard'); return; }
    loadAll(); connectSocket();
    return () => socketRef.current?.disconnect();
  }, []); // eslint-disable-line

  const loadAll = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/channels/${CHANNEL_ID}/details?userId=${userId}`);
      const d = await r.json();
      if (!d.success) { toast('Could not load transfer details', 'error'); return; }

      const ch = d.channel;
      setChannel(ch);
      const fixedAmount = parseFloat(ch.agreed_price) || 0;
      setAgreedPrice(fixedAmount);
      setEntryAmt(String(fixedAmount || ''));
      setSellerUserId(ch.seller_id);

      /* fetch seller account */
      if (ch.seller_id) {
        try {
          const ar = await apiFetch(`/api/payments/account/${ch.seller_id}`);
          const ad = await ar.json();
          if (ad.success) setChannel(prev => ({ ...prev, sellerAccMasked: ad.account.maskedNo, sellerBank: ad.account.bankName }));
        } catch (_) {}
        try {
          const ur = await apiFetch(`/api/auth/user-profile?userId=${ch.seller_id}`);
          const ud = await ur.json();
          const u  = ud.user || ud;
          if (u.cnic) setChannel(prev => ({ ...prev, sellerCnic: fmtCnic(u.cnic) }));
        } catch (_) {}
      }

      /* fetch buyer account */
      try {
        const mr = await apiFetch('/api/payments/my-account');
        const md = await mr.json();
        if (md.success) {
          setBuyerAccNo(md.account.accountNo || '');
          setEntryAcc(md.account.accountNo || '');
          setChannel(prev => ({
            ...prev,
            buyerAccMasked: md.account.maskedNo,
            buyerBank:      md.account.bankName,
            buyerCnic:      fmtCnic(md.account.cnic),
            buyerAccTitle:  md.account.accountTitle,
            buyerBalance:   md.account.balance,
          }));
        }
      } catch (_) {}
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  const connectSocket = useCallback(async () => {
    try {
      const { io } = await import('socket.io-client');
      const sock = io(BASE, { auth: { token: authToken }, transports: ['websocket', 'polling'] });
      socketRef.current = sock;
      sock.on('payment_received', data => toast(`💰 Payment received: ${fmtPKR(data.amount)}`, 'success'));
    } catch (_) {}
  }, []); // eslint-disable-line

  const submitPayment = async () => {
    const lockedAmount = Number(agreedPrice || 0);
    const buyerAccountNumber = String(entryAcc || buyerAccNo || '').trim();
    if (!buyerAccountNumber)                { toast('Your registered account is still loading', 'error'); return; }
    if (!lockedAmount)                      { toast('Challan amount is missing', 'error'); return; }
    if (!entryPin || entryPin.length !== 4) { toast('Enter your 4-digit PIN', 'error'); return; }
    if (!sellerUserId)                      { toast('Seller information missing', 'error'); return; }

    setProcessing(true);
    try {
      const r = await apiFetch('/api/payments/transfer', {
        method: 'POST',
        body: JSON.stringify({ transferId: TRANSFER_ID, channelId: CHANNEL_ID, receiverUserId: sellerUserId, amount: lockedAmount, pin: entryPin })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'Payment failed');
      setReceipt(d.receipt);
      setPaid(true);
      toast('✅ Payment successful!', 'success');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
    finally { setProcessing(false); }
  };

  const applyFile = file => {
    setUploadFile(file);
    if (file?.type.startsWith('image/')) {
      const r = new FileReader(); r.onload = e => setUploadPreview(e.target.result); r.readAsDataURL(file);
    } else setUploadPreview('');
  };

  const submitToLro = async () => {
    if (!uploadFile) { toast('Select a file first', 'error'); return; }
    setSubmittingLro(true);
    try {
      const fd = new FormData();
      fd.append('screenshot', uploadFile);
      fd.append('agreedPrice', agreedPrice);
      fd.append('agreedTerms', 'Payment challan submitted for LRO review.');
      const r = await fetch(`${BASE}/api/channels/${CHANNEL_ID}/upload-screenshot`, {
        method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd
      });
      const d = await r.json();
      if (d.success) { setUploadOpen(false); toast('✅ Submitted to LRO! Awaiting approval.', 'success'); setTimeout(() => navigate('/citizen/dashboard'), 2500); }
      else throw new Error(d.error || 'Upload failed');
    } catch (e) { toast('Upload failed: ' + e.message, 'error'); }
    finally { setSubmittingLro(false); }
  };

  const ch = channel;

  /* ── render ── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { font-family: 'Sora', sans-serif; }
        .challan-input {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1.5px solid #1e2d3d; background: #0d1b2a;
          color: #e2e8f0; font-size: .93rem; font-family: 'Sora', sans-serif;
          outline: none; transition: border-color .2s;
        }
        .challan-input:focus { border-color: #38bdf8; }
        .challan-input.mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 1px; }
        .pay-btn {
          width: 100%; padding: 15px; border: none; border-radius: 12px;
          font-family: 'Sora', sans-serif; font-weight: 800; font-size: 1rem;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 10px; transition: opacity .2s, transform .1s;
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white; letter-spacing: .5px;
        }
        .pay-btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
        .pay-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .pay-btn.green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .lbl { display: block; font-size: .72rem; font-weight: 700; color: #4a6785; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 7px; }
        .input-hint { font-size: .68rem; color: #4a6785; margin-top: 5px; }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(60px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#060f1e',
        fontFamily: "'Sora', sans-serif", color: '#e2e8f0',
        padding: '0 0 80px',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(6,15,30,.95)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1e2d3d', padding: '0 24px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link to="/citizen/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#4a6785', textDecoration: 'none', fontSize: '.85rem', fontWeight: 600
          }}>
            <i className="fas fa-arrow-left" /> Dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <i className="fas fa-file-invoice-dollar" style={{ color: 'white', fontSize: '.7rem' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#cbd5e1' }}>Payment Challan</span>
          </div>
          <div style={{ width: 80 }} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              border: '3px solid #1e2d3d', borderTopColor: '#38bdf8',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#4a6785', fontSize: '.9rem' }}>Loading challan details…</p>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px', animation: 'fadeInUp .5s ease both' }}>

            {/* ── Status banner ── */}
            {paid && (
              <div style={{
                background: 'linear-gradient(135deg, #065f46, #047857)', borderRadius: 14,
                padding: '16px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
                border: '1px solid #059669'
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, background: '#10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <i className="fas fa-check-circle" style={{ color: 'white', fontSize: '1.1rem' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#a7f3d0' }}>Payment Successful</div>
                  <div style={{ fontSize: '.8rem', color: '#6ee7b7', marginTop: 2 }}>
                    TXN Ref: {receipt?.txnRef} &nbsp;·&nbsp; {receipt && new Date(receipt.completedAt).toLocaleString('en-PK')}
                  </div>
                </div>
              </div>
            )}

            {/* ── Amount highlight ── */}
            <div style={{
              background: 'linear-gradient(135deg, #0c2340 0%, #0a1628 100%)',
              border: '1px solid #1e2d3d', borderRadius: 14, padding: '28px 28px 24px',
              marginBottom: 20, position: 'relative', overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 140, height: 140,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,.12) 0%, transparent 70%)'
              }} />
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#4a6785', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                Amount Agreed by Seller
              </div>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1, letterSpacing: -1 }}>
                {fmtPKR(agreedPrice)}
              </div>
              <div style={{ fontSize: '.78rem', color: '#4a6785', marginTop: 8, fontStyle: 'italic' }}>
                {numWords(agreedPrice)}
              </div>
              <div style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#0d1b2a', border: '1px solid #1e2d3d', borderRadius: 8,
                padding: '6px 12px', fontSize: '.72rem', color: '#4a6785'
              }}>
                <i className="fas fa-lock" style={{ color: '#38bdf8', fontSize: '.65rem' }} />
                This price is fixed and cannot be changed
              </div>
            </div>

            {/* ── Seller Info ── */}
            <SectionCard title="Seller Details" icon="user-tie" style={{ marginBottom: 20 }}>
              <InfoRow icon="user"        label="Seller Name" value={ch.seller_name} />
              <InfoRow icon="id-card"     label="Seller CNIC" value={ch.sellerCnic} mono />
              <InfoRow icon="university"  label="Bank"        value={ch.sellerBank} />
              <InfoRow icon="credit-card" label="Account No." value={ch.sellerAccMasked} mono />
            </SectionCard>

            {/* ── Buyer Info ── */}
            <SectionCard title="Buyer Details" icon="user" style={{ marginBottom: 20 }}>
              <InfoRow icon="user"        label="Buyer Name"       value={ch.buyerAccTitle || ch.buyer_name} />
              <InfoRow icon="id-card"     label="Buyer CNIC"       value={ch.buyerCnic} mono />
              <InfoRow icon="university"  label="Bank"             value={ch.buyerBank} />
              <InfoRow icon="credit-card" label="Account No."      value={ch.buyerAccMasked} mono />
              <InfoRow icon="wallet"      label="Available Balance" value={fmtPKR(ch.buyerBalance)} accent="#34d399" />
            </SectionCard>

            {/* ── Payment form (buyer only, not paid) ── */}
            {!paid && ROLE !== 'SELLER' && (
              <div style={{
                background: '#0a1628', border: '1px solid #1e2d3d', borderRadius: 14,
                overflow: 'hidden', marginBottom: 20
              }}>
                <div style={{
                  padding: '16px 22px', borderBottom: '1px solid #1e2d3d',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'linear-gradient(90deg, #0d1f35 0%, #0a1628 100%)'
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <i className="fas fa-paper-plane" style={{ color: 'white', fontSize: '.72rem' }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '.85rem', color: '#cbd5e1' }}>Complete Payment</span>
                </div>

                <div style={{ padding: '24px 22px', display: 'grid', gap: 20 }}>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{
                      background: '#0d1b2a',
                      border: '1px solid #1e2d3d',
                      borderRadius: 12,
                      padding: '16px 16px 14px',
                    }}>
                      <label className="lbl" style={{ marginBottom: 10 }}>Paying From</label>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.96rem', color: '#e2e8f0', fontWeight: 700 }}>
                        {ch.buyerAccMasked || 'Loading...'}
                      </div>
                      <p className="input-hint">Registered buyer account selected automatically</p>
                    </div>

                    <div style={{
                      background: '#0d1b2a',
                      border: '1px solid #1e2d3d',
                      borderRadius: 12,
                      padding: '16px 16px 14px',
                    }}>
                      <label className="lbl" style={{ marginBottom: 10 }}>Locked Amount</label>
                      <div style={{ fontSize: '1.05rem', color: '#38bdf8', fontWeight: 800 }}>
                        {fmtPKR(entryAmt || agreedPrice)}
                      </div>
                      <p className="input-hint">Amount is fixed from the confirmed challan</p>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(14, 165, 233, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.18)',
                    color: '#cbd5e1',
                    borderRadius: 12,
                    padding: '14px 16px',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '.84rem', marginBottom: 4, color: '#7dd3fc' }}>
                      Separate payment screen active
                    </div>
                    <div style={{ fontSize: '.78rem', lineHeight: 1.6, color: '#94a3b8' }}>
                      We already locked your account and challan amount here so the only step left is entering your PIN. This avoids the chat from scrolling while you pay.
                    </div>
                  </div>

                  {/* PIN */}
                  <div>
                    <label className="lbl">4-Digit Transaction PIN</label>
                    <input
                      className="challan-input mono"
                      type="password"
                      placeholder="••••"
                      maxLength={4}
                      inputMode="numeric"
                      value={entryPin}
                      onChange={e => setEntryPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      style={{ letterSpacing: 8, fontSize: '1.2rem' }}
                    />
                    <p className="input-hint">Default PIN: 1234</p>
                  </div>

                  <button className="pay-btn" onClick={submitPayment} disabled={processing}>
                    {processing
                      ? <><i className="fas fa-spinner fa-spin" />Processing Payment…</>
                      : <><i className="fas fa-university" />Pay {fmtPKR(agreedPrice)}</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ── Seller waiting view ── */}
            {ROLE === 'SELLER' && !paid && (
              <div style={{
                background: '#0a1628', border: '1px solid #1e2d3d', borderRadius: 14,
                padding: '28px 24px', textAlign: 'center', marginBottom: 20
              }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                <p style={{ fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Awaiting Buyer Payment</p>
                <p style={{ fontSize: '.82rem', color: '#4a6785' }}>
                  You will be notified once {fmtPKR(agreedPrice)} is credited to your account.
                </p>
              </div>
            )}

            {/* ── Receipt after payment ── */}
            {paid && receipt && (
              <div style={{
                background: '#0a1628', border: '1px solid #059669',
                borderRadius: 14, overflow: 'hidden', marginBottom: 20
              }}>
                <div style={{ padding: '16px 22px', background: '#065f46', borderBottom: '1px solid #047857' }}>
                  <span style={{ fontWeight: 700, fontSize: '.85rem', color: '#a7f3d0' }}>
                    <i className="fas fa-receipt" style={{ marginRight: 8 }} />Transaction Receipt
                  </span>
                </div>
                <div style={{ padding: '8px 22px' }}>
                  {[
                    ['TXN Reference',    receipt.txnRef,                                                      true],
                    ['Amount Paid',      receipt.amountFormatted,                                             false],
                    ['Paid From',        `${receipt.sender?.name || '—'} · ${receipt.sender?.maskedNo || '—'}`, false],
                    ['Paid To',          `${receipt.receiver?.name || '—'} · ${receipt.receiver?.maskedNo || '—'}`, false],
                    ['Your Balance',     fmtPKR(receipt.sender?.balanceAfter),                               false],
                    ['Completed At',     new Date(receipt.completedAt).toLocaleString('en-PK'),              false],
                  ].map(([l, v, m]) => (
                    <InfoRow key={l} icon={m ? 'hashtag' : 'check'} label={l} value={v} mono={m} accent={l === 'Amount Paid' ? '#34d399' : undefined} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Post-payment actions ── */}
            {paid && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button className="pay-btn" style={{ background: '#0d1b2a', border: '1.5px solid #1e2d3d', color: '#cbd5e1' }}
                  onClick={() => {
                    const w = window.open('', '_blank');
                    w.document.write(`<!DOCTYPE html><html><head><title>Challan Receipt</title></head><body style="font-family:monospace;padding:40px;background:#f9f9f9"><h2>Payment Challan — Punjab Land Registry</h2><hr><p><b>TXN:</b> ${receipt?.txnRef}</p><p><b>Amount:</b> ${fmtPKR(agreedPrice)}</p><p><b>Seller:</b> ${ch.seller_name}</p><p><b>Buyer:</b> ${ch.buyerAccTitle || ch.buyer_name}</p><p><b>Date:</b> ${receipt && new Date(receipt.completedAt).toLocaleString('en-PK')}</p><p><b>Status:</b> PAID</p><script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`);
                    w.document.close();
                  }}>
                  <i className="fas fa-download" /> Download Receipt
                </button>
                <button className="pay-btn green" onClick={() => setUploadOpen(true)}>
                  <i className="fas fa-cloud-upload-alt" /> Submit to LRO
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Upload to LRO modal ── */}
      {uploadOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
          backdropFilter: 'blur(8px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={e => { if (e.target === e.currentTarget) setUploadOpen(false); }}>
          <div style={{
            background: '#0a1628', border: '1px solid #1e2d3d', borderRadius: 18,
            padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 40px 80px rgba(0,0,0,.6)'
          }}>
            <h3 style={{ color: '#cbd5e1', fontWeight: 800, marginBottom: 6 }}>
              <i className="fas fa-cloud-upload-alt" style={{ color: '#38bdf8', marginRight: 10 }} />
              Submit Challan to LRO
            </h3>
            <p style={{ color: '#4a6785', fontSize: '.83rem', marginBottom: 20 }}>
              Upload your payment receipt for Land Record Officer review and approval.
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${uploadFile ? '#10b981' : '#1e2d3d'}`,
                borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', marginBottom: 20,
                background: uploadFile ? 'rgba(16,185,129,.05)' : '#060f1e',
                transition: 'border-color .2s'
              }}>
              {uploadFile ? (
                <>
                  {uploadPreview && <img src={uploadPreview} alt="preview" style={{ maxHeight: 80, borderRadius: 8, marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />}
                  <p style={{ color: '#10b981', fontWeight: 600, fontSize: '.87rem' }}>📎 {uploadFile.name}</p>
                </>
              ) : (
                <>
                  <i className="fas fa-file-upload" style={{ fontSize: '2rem', color: '#1e2d3d', marginBottom: 10, display: 'block' }} />
                  <p style={{ color: '#4a6785', fontSize: '.85rem' }}><span style={{ color: '#38bdf8' }}>Click to select</span> or drag file here</p>
                  <p style={{ color: '#2d3f55', fontSize: '.72rem', marginTop: 4 }}>PDF, JPG, PNG — max 10MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => applyFile(e.target.files[0])} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setUploadOpen(false)} style={{
                padding: '10px 20px', borderRadius: 10, border: '1.5px solid #1e2d3d',
                background: 'transparent', color: '#4a6785', fontFamily: 'Sora, sans-serif',
                fontWeight: 600, fontSize: '.85rem', cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={submitToLro} disabled={submittingLro} style={{
                padding: '10px 22px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white', fontFamily: 'Sora, sans-serif',
                fontWeight: 700, fontSize: '.85rem', cursor: submittingLro ? 'not-allowed' : 'pointer',
                opacity: submittingLro ? .6 : 1, display: 'flex', alignItems: 'center', gap: 7
              }}>
                {submittingLro ? <><i className="fas fa-spinner fa-spin" />Uploading…</> : <><i className="fas fa-paper-plane" />Submit to LRO</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 18px', borderRadius: 12, fontWeight: 600, fontSize: '.83rem',
            color: 'white', maxWidth: 320, animation: 'toastIn .3s ease both',
            background: t.type === 'success' ? 'linear-gradient(135deg,#065f46,#047857)'
                      : t.type === 'error'   ? 'linear-gradient(135deg,#7f1d1d,#991b1b)'
                      :                        '#0d1b2a',
            border: `1px solid ${t.type === 'success' ? '#059669' : t.type === 'error' ? '#b91c1c' : '#1e2d3d'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)'
          }}>{t.msg}</div>
        ))}
      </div>
    </>
  );
};

export default Challan;
