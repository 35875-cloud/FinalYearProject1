/**
 * AgreementPanel.jsx
 *
 * Two exports:
 *  1. AgreementPanel  — sticky panel at the bottom of the chat
 *                       showing Agree / Disagree buttons + live status
 *  2. ChallanMessage  — renders a CHALLAN-type chat message bubble
 *
 * HOW TO USE in TransferNegotiation.jsx:
 * ──────────────────────────────────────
 * import { AgreementPanel, ChallanMessage } from './AgreementPanel';
 *
 * // Inside your chat render:
 * {messages.map(msg => (
 *   msg.message_type === 'CHALLAN'
 *     ? <ChallanMessage key={msg.message_id} msg={msg} myRole={myRole} channelId={channelId} transferId={transferId} />
 *     : <YourNormalMessageBubble key={msg.message_id} msg={msg} />
 * ))}
 *
 * // At the bottom, before or after the text-input bar:
 * <AgreementPanel
 *   channelId={channelId}
 *   channelStatus={channel.channel_status}   // from getChannelDetails
 *   sellerAgreed={channel.seller_agreed}
 *   buyerAgreed={channel.buyer_agreed}
 *   myRole={myRole}                           // 'SELLER' or 'BUYER'
 *   agreedPrice={channel.agreed_price}        // number
 *   onAgreementChange={reloadChannel}         // callback to refresh channel state
 *   authToken={authToken}
 *   BASE={BASE}
 * />
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const fmtPKR = n => 'PKR ' + Number(n || 0).toLocaleString('en-PK');

// ─────────────────────────────────────────────────────────────────
// AGREEMENT PANEL
// ─────────────────────────────────────────────────────────────────
export const AgreementPanel = ({
  channelId,
  channelStatus,
  sellerAgreed,
  buyerAgreed,
  myRole,           // 'SELLER' | 'BUYER'
  agreedPrice,
  onAgreementChange,
  authToken,
  BASE,
  agreedPriceInput, // optional: controlled input value if seller sets price
}) => {
  const [loading,      setLoading]      = useState(false);
  const [priceInput,   setPriceInput]   = useState('');
  const [showDisagree, setShowDisagree] = useState(false);
  const [disagreeMsg,  setDisagreeMsg]  = useState('');
  const [toast,        setToast]        = useState(null);

  const isSeller  = myRole === 'SELLER';
  const myAgreed  = isSeller ? sellerAgreed : buyerAgreed;
  const bothAgreed = sellerAgreed && buyerAgreed;

  // Don't render if channel isn't in a negotiating state
  const activeStatuses = ['ACTIVE', 'NEGOTIATING', 'AGREED'];
  if (!activeStatuses.includes(channelStatus)) return null;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const apiFetch = (path, opts = {}) =>
    fetch(BASE + path, {
      ...opts,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    });

  // ── AGREE ──────────────────────────────────────────────────────
  const handleAgree = async () => {
    // Seller must set a price before agreeing
    if (isSeller && !agreedPrice && !priceInput) {
      showToast('Please enter the agreed sale price first', 'error');
      return;
    }
    setLoading(true);
    try {
      const body = {
        agreedTerms: 'I agree to the negotiated terms and conditions.',
      };
      if (isSeller && priceInput) body.agreedPrice = parseFloat(priceInput);

      const r = await apiFetch(`/api/channels/${channelId}/agree`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.success && !d.agreed) throw new Error(d.error || d.message || 'Failed');
      showToast(d.bothAgreed
        ? '🎉 Both parties agreed! Challan has been issued.'
        : '✅ Your agreement has been recorded.'
      );
      onAgreementChange?.();
    } catch (e) {
      showToast('❌ ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── DISAGREE ───────────────────────────────────────────────────
  const handleDisagree = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/channels/${channelId}/disagree`, {
        method: 'POST',
        body: JSON.stringify({ reason: disagreeMsg }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || d.message || 'Failed');
      showToast('Disagreement recorded. Continue negotiating.', 'info');
      setShowDisagree(false);
      setDisagreeMsg('');
      onAgreementChange?.();
    } catch (e) {
      showToast('❌ ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Status chips ───────────────────────────────────────────────
  const PartyStatus = ({ label, agreed }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 20,
      background: agreed ? 'rgba(16,185,129,.12)' : 'rgba(100,116,139,.08)',
      border: `1px solid ${agreed ? '#10b981' : '#334155'}`,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: agreed ? '#10b981' : '#475569',
        boxShadow: agreed ? '0 0 6px #10b981' : 'none',
      }} />
      <span style={{ fontSize: '.72rem', fontWeight: 700, color: agreed ? '#34d399' : '#64748b' }}>
        {label}: {agreed ? 'Agreed ✓' : 'Pending…'}
      </span>
    </div>
  );

  return (
    <>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 120, right: 20, zIndex: 9999,
          padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: '.82rem',
          color: 'white', animation: 'fadeInRight .3s ease',
          background: toast.type === 'success' ? '#065f46'
                    : toast.type === 'error'   ? '#7f1d1d'
                    : '#0f172a',
          border: `1px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#dc2626' : '#1e293b'}`,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes fadeInRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        .agr-btn { border: none; border-radius: 10px; font-weight: 700; font-size: .82rem; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 6px; padding: 9px 18px; }
        .agr-btn:disabled { opacity: .5; cursor: not-allowed; }
        .agr-btn:hover:not(:disabled) { transform: translateY(-1px); }
      `}</style>

      {/* ── Main Panel ── */}
      <div style={{
        borderTop: '1px solid #1e293b',
        background: 'linear-gradient(180deg, #0a1628 0%, #060f1e 100%)',
        padding: '14px 16px',
        flexShrink: 0,
      }}>

        {/* Status row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <PartyStatus label="Seller" agreed={sellerAgreed} />
          <PartyStatus label="Buyer"  agreed={buyerAgreed}  />
          {bothAgreed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              background: 'rgba(14,165,233,.12)', border: '1px solid #0ea5e9',
            }}>
              <i className="fas fa-check-double" style={{ color: '#38bdf8', fontSize: '.65rem' }} />
              <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#38bdf8' }}>Challan Issued</span>
            </div>
          )}
        </div>

        {/* If channel is AGREED (both agreed), show done state */}
        {bothAgreed ? (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <i className="fas fa-handshake" style={{ color: '#10b981', fontSize: '1rem' }} />
            <div>
              <p style={{ fontSize: '.82rem', fontWeight: 700, color: '#34d399', margin: 0 }}>
                Agreement confirmed at {fmtPKR(agreedPrice)}
              </p>
              <p style={{ fontSize: '.72rem', color: '#64748b', margin: '2px 0 0' }}>
                Scroll up to see the challan issued in chat.
              </p>
            </div>
          </div>
        ) : myAgreed ? (
          /* Already agreed — waiting for other party */
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(14,165,233,.08)', border: '1px solid rgba(14,165,233,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#38bdf8',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <style>{`@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }`}</style>
              <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#94a3b8' }}>
                Your agreement is recorded — waiting for the {isSeller ? 'buyer' : 'seller'}…
              </span>
            </div>
            <button
              className="agr-btn"
              onClick={() => setShowDisagree(true)}
              style={{ background: 'rgba(239,68,68,.12)', color: '#f87171', border: '1px solid rgba(239,68,68,.2)', fontSize: '.72rem', padding: '6px 12px' }}
            >
              <i className="fas fa-times" /> Cancel
            </button>
          </div>
        ) : (
          /* Not yet agreed — show action buttons */
          <>
            {/* Seller: price input */}
            {isSeller && !agreedPrice && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Confirm Sale Price (PKR)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2500000"
                  value={priceInput}
                  onChange={e => setPriceInput(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 14px', borderRadius: 8,
                    border: '1.5px solid #1e293b', background: '#0d1b2a',
                    color: '#e2e8f0', fontSize: '.88rem', fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <p style={{ fontSize: '.68rem', color: '#334155', marginTop: 5 }}>
                  This price will be locked when you agree — buyer cannot change it.
                </p>
              </div>
            )}

            {/* Agree / Disagree buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="agr-btn"
                onClick={handleAgree}
                disabled={loading}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(5,150,105,.25)',
                }}
              >
                {loading
                  ? <><i className="fas fa-spinner fa-spin" />Processing…</>
                  : <><i className="fas fa-check-circle" />I Agree to Terms</>
                }
              </button>
              <button
                className="agr-btn"
                onClick={() => setShowDisagree(true)}
                disabled={loading}
                style={{
                  background: 'rgba(239,68,68,.1)',
                  color: '#f87171',
                  border: '1.5px solid rgba(239,68,68,.2)',
                }}
              >
                <i className="fas fa-times-circle" /> Disagree
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Disagree modal ── */}
      {showDisagree && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(6px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowDisagree(false); }}
        >
          <div style={{
            background: '#0a1628', border: '1px solid #1e293b', borderRadius: 16,
            padding: 24, width: '100%', maxWidth: 400,
            boxShadow: '0 30px 60px rgba(0,0,0,.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="fas fa-exclamation-triangle" style={{ color: 'white', fontSize: '.8rem' }} />
              </div>
              <div>
                <p style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '.95rem', margin: 0 }}>Disagree & Reopen Negotiation</p>
                <p style={{ fontSize: '.72rem', color: '#64748b', margin: '2px 0 0' }}>This will reset agreement status for both parties.</p>
              </div>
            </div>

            <label style={{ display: 'block', fontSize: '.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Reason (optional)
            </label>
            <textarea
              rows={3}
              value={disagreeMsg}
              onChange={e => setDisagreeMsg(e.target.value)}
              placeholder="e.g. Price is too high, please lower it..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #1e293b', background: '#060f1e',
                color: '#e2e8f0', fontSize: '.85rem', resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDisagree(false)}
                style={{
                  padding: '9px 18px', borderRadius: 9, border: '1.5px solid #1e293b',
                  background: 'transparent', color: '#64748b', fontWeight: 600,
                  fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDisagree}
                disabled={loading}
                style={{
                  padding: '9px 20px', borderRadius: 9, border: 'none',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: 'white', fontWeight: 700, fontSize: '.82rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? .6 : 1, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {loading
                  ? <><i className="fas fa-spinner fa-spin" />Sending…</>
                  : <><i className="fas fa-times" />Confirm Disagree</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// CHALLAN MESSAGE  — renders inside the chat message list
// ─────────────────────────────────────────────────────────────────
export const ChallanMessage = ({ msg, myRole, channelId, transferId }) => {
  const navigate  = useNavigate();
  const isBuyer   = myRole === 'BUYER';

  let data = {};
  try {
    data = typeof msg.message_content === 'string'
      ? JSON.parse(msg.message_content)
      : msg.message_content;
  } catch (_) {}

  const isPaid     = data.status === 'PAID';
  const price      = parseFloat(data.agreedPrice || 0);
  const fmtDate    = d => d ? new Date(d).toLocaleString('en-PK') : '—';

  return (
    <div style={{
      margin: '16px auto', maxWidth: 480,
      fontFamily: "'Sora', system-ui, sans-serif",
    }}>
      {/* Card */}
      <div style={{
        background: isPaid
          ? 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)'
          : 'linear-gradient(135deg, #0c2340 0%, #0a1628 100%)',
        border: `1px solid ${isPaid ? '#059669' : '#1e2d3d'}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
      }}>

        {/* Header */}
        <div style={{
          padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: `1px solid ${isPaid ? '#065f46' : '#1e2d3d'}`,
          background: isPaid
            ? 'rgba(5,150,105,.15)'
            : 'linear-gradient(90deg, #0d1f35 0%, #0a1628 100%)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: isPaid
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className={`fas fa-${isPaid ? 'check-circle' : 'file-invoice-dollar'}`}
               style={{ color: 'white', fontSize: '.75rem' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: '.88rem', color: '#f1f5f9', margin: 0 }}>
              {isPaid ? '✅ Payment Challan — PAID' : '📄 Payment Challan Issued'}
            </p>
            <p style={{ fontSize: '.68rem', color: '#4a6785', margin: '2px 0 0' }}>
              {data.challanId} · {fmtDate(data.issuedAt)}
            </p>
          </div>
          {isPaid && (
            <div style={{
              padding: '4px 10px', borderRadius: 20,
              background: '#059669', color: 'white',
              fontSize: '.65rem', fontWeight: 800, letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              PAID
            </div>
          )}
        </div>

        {/* Amount */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #1e2d3d' }}>
          <p style={{ fontSize: '.62rem', fontWeight: 700, color: '#4a6785', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Agreed Sale Price
          </p>
          <p style={{ fontSize: '1.8rem', fontWeight: 800, color: isPaid ? '#34d399' : '#38bdf8', margin: 0, lineHeight: 1 }}>
            {'PKR ' + price.toLocaleString('en-PK')}
          </p>
        </div>

        {/* Parties */}
        <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderBottom: '1px solid #1e2d3d' }}>
          {[
            { label: 'From (Buyer)',  name: data.buyer?.name,  cnic: data.buyer?.cnic },
            { label: 'To (Seller)',   name: data.seller?.name, cnic: data.seller?.cnic },
          ].map(p => (
            <div key={p.label} style={{ padding: '10px', background: '#0d1b2a', borderRadius: 10, border: '1px solid #1e2d3d' }}>
              <p style={{ fontSize: '.6rem', fontWeight: 700, color: '#4a6785', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>{p.label}</p>
              <p style={{ fontSize: '.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: 2 }}>{p.name || '—'}</p>
              <p style={{ fontSize: '.68rem', color: '#334155', fontFamily: 'monospace' }}>{p.cnic || '—'}</p>
            </div>
          ))}
        </div>

        {/* Property */}
        {data.property && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid #1e2d3d', display: 'flex', gap: 16 }}>
            {[
              ['Location', [data.property.district, data.property.tehsil, data.property.mauza].filter(Boolean).join(', ')],
              ['Area', data.property.areaMarla ? `${data.property.areaMarla} Marla` : '—'],
              ['Khasra', data.property.khasraNo],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <p style={{ fontSize: '.6rem', fontWeight: 700, color: '#4a6785', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 2 }}>{lbl}</p>
                <p style={{ fontSize: '.75rem', color: '#94a3b8', fontWeight: 600 }}>{val || '—'}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: '12px 18px' }}>
          {isPaid ? (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <i className="fas fa-check-circle" style={{ color: '#10b981' }} />
              <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#34d399' }}>
                Payment completed. Awaiting LRO approval for property transfer.
              </span>
            </div>
          ) : isBuyer ? (
            <button
              onClick={() => navigate(`/citizen/challan?channelId=${channelId}&transferId=${transferId}&role=BUYER`)}
              style={{
                width: '100%', padding: '11px', border: 'none', borderRadius: 10,
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: 'white', fontWeight: 800, fontSize: '.88rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(14,165,233,.3)',
              }}
            >
              <i className="fas fa-credit-card" /> Proceed to Payment
            </button>
          ) : (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(14,165,233,.06)', border: '1px solid rgba(14,165,233,.15)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.5s ease infinite' }} />
              <span style={{ fontSize: '.8rem', color: '#64748b', fontWeight: 600 }}>
                Awaiting buyer payment of PKR {price.toLocaleString('en-PK')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default { AgreementPanel, ChallanMessage };