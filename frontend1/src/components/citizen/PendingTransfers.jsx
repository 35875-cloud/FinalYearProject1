import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CitizenLayout, { PageHero, StatusPill, T, fmt } from './CitizenLayout';

const sectionStyle = {
  background: '#fff',
  border: `1px solid ${T.border}`,
  borderRadius: 24,
  boxShadow: '0 10px 26px rgba(28,43,62,.06)',
};

const RoleBadge = ({ role }) => {
  const seller = role === 'SELLER';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: '.7rem',
      fontWeight: 800,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      background: seller ? '#F5EDFF' : '#EEF4FA',
      color: seller ? '#7C3AED' : T.primary,
    }}>
      <i className={`fas ${seller ? 'fa-user-tie' : 'fa-shopping-cart'}`} />
      {seller ? 'Seller' : 'Buyer'}
    </span>
  );
};

const InfoRow = ({ icon, label, value, mono, bold }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 0',
    borderBottom: `1px solid ${T.border}`,
  }}>
    <div style={{
      width: 28,
      height: 28,
      borderRadius: 10,
      background: T.surface2,
      color: T.muted,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '.76rem',
      flexShrink: 0,
    }}>
      <i className={icon} />
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '.66rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: bold ? '.96rem' : '.84rem',
        fontWeight: bold ? 800 : 700,
        color: T.text,
        wordBreak: 'break-word',
        fontFamily: mono ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif",
      }}>
        {value || '—'}
      </div>
    </div>
  </div>
);

/* ── WhatsApp-style Transfer Row ── */
const TransferRow = ({ transfer, navigate, onActivate, onOpenReceipt, onDownloadSummary, isLast }) => {
  const [hovered, setHovered] = useState(false);
  const isSeller   = transfer._myRole === 'SELLER';
  const hasChannel = transfer.channel_id && transfer.channel_status !== 'INACTIVE' && transfer.channel_status !== 'CLOSED';
  const partnerName = isSeller
    ? (transfer.buyer_name  || transfer.buyer_cnic  || 'Unknown Buyer')
    : (transfer.seller_name || transfer.seller_cnic || 'Unknown Seller');
  const location  = [transfer.district, transfer.tehsil].filter(Boolean).join(', ') || 'Location pending';
  const amount    = transfer.transfer_amount ? `PKR ${fmt(transfer.transfer_amount)}` : 'Amount TBD';
  const areaVal   = transfer.area_marla || transfer.area || transfer.area_sq_ft || transfer.plot_area || transfer.land_area || transfer.marla || transfer.size_marla || null;
  const isExpired = transfer.expires_at && new Date(transfer.expires_at) < new Date();
  const isPaid    = transfer.payment_status === 'PAID' || Boolean(transfer.challan_txn_id);
  const needsLroReceipt = !isSeller && isPaid && !transfer.agreement_screenshot_url && Boolean(transfer.channel_id);
  const avatarBg  = isSeller ? '#0D7C7C' : '#1D4ED8';

  /* format last-activity time */
  const timeStr = (() => {
    const d = transfer.updated_at || transfer.created_at || transfer.listed_at;
    if (!d) return '';
    const dt   = new Date(d);
    const now  = new Date();
    const diff = now - dt;
    if (diff < 86400000) return dt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return dt.toLocaleDateString('en-PK', { weekday: 'short' });
    return dt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  })();

  /* status label for preview line */
  const statusLabel = (transfer.status || '').replace(/_/g, ' ');

  /* action btn helper — outline by default, fills with color on hover (like MyProperties) */
  const Btn = ({ onClick, fillColor, children, title }) => {
    const [btnHovered, setBtnHovered] = useState(false);
    const fc = fillColor || '#0D7C7C';
    return (
      <button
        onClick={onClick}
        title={title}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 16px',
          borderRadius: 8,
          minHeight: 38,
          fontWeight: 700,
          fontSize: '.8rem',
          cursor: onClick ? 'pointer' : 'not-allowed',
          whiteSpace: 'nowrap',
          fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif",
          border: `1.5px solid ${btnHovered ? fc : T.border}`,
          background: btnHovered ? fc : '#fff',
          color: btnHovered ? '#fff' : T.text2,
          transition: 'all .18s',
        }}
      >
        {children}
      </button>
    );
  };

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '22px 16px 14px',
          background: hovered ? '#f5f6f6' : '#fff',
          transition: 'background .12s',
          cursor: 'default',
        }}
      >
        {/* ── Avatar ── */}
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          background: avatarBg, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', flexShrink: 0, position: 'relative',
        }}>
          <i className={isSeller ? 'fas fa-user-tie' : 'fas fa-shopping-cart'} />
          {transfer.unread_count > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 18, height: 18, borderRadius: 999,
              background: '#25D366', color: '#fff',
              fontSize: '.62rem', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px', border: '2px solid #fff',
            }}>
              {transfer.unread_count > 9 ? '9+' : transfer.unread_count}
            </span>
          )}
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top line: name + time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '.98rem', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {partnerName}
              </span>
              <RoleBadge role={transfer._myRole} />
              {isExpired && (
                <span style={{ fontSize: '.65rem', fontWeight: 800, color: '#DC2626', background: '#FEF2F2', padding: '2px 7px', borderRadius: 999 }}>
                  EXPIRED
                </span>
              )}
            </div>
            {timeStr && (
              <span style={{ fontSize: '.75rem', color: T.muted, flexShrink: 0, marginLeft: 8 }}>{timeStr}</span>
            )}
          </div>

          {/* Preview line: location · area · amount */}
          <div style={{ fontSize: '.84rem', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 10 }}>
            <i className="fas fa-map-marker-alt" style={{ fontSize: '.7rem', marginRight: 4 }} />
            {location}
            {areaVal ? ` · ${areaVal} Marla` : ''}
            {' · '}
            <span style={{ fontWeight: 700, color: T.primary }}>{amount}</span>
            {statusLabel ? (
              <span style={{ marginLeft: 6, fontSize: '.72rem', fontWeight: 700, color: T.muted }}>
                · {statusLabel}
              </span>
            ) : null}
          </div>

          {/* Action buttons row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {hasChannel ? (
              <Btn fillColor="#0D7C7C" onClick={() => navigate(`/citizen/negotiation?channelId=${transfer.channel_id}&transferId=${transfer.transfer_id}`)}>
                <i className="fas fa-comments" /> Open Chat
              </Btn>
            ) : isSeller && (transfer.status === 'PENDING' || transfer.status === 'CHANNEL_ACTIVE') ? (
              <Btn fillColor="#047857" onClick={() => onActivate(transfer.transfer_id)}>
                <i className="fas fa-comments" /> Start Chat
              </Btn>
            ) : (
              <Btn>
                <i className="fas fa-hourglass-half" /> Awaiting
              </Btn>
            )}

            {transfer.challan_txn_id && (
              <Btn onClick={() => onOpenReceipt(transfer)}>
                <i className="fas fa-file-invoice" /> Receipt
              </Btn>
            )}

            {needsLroReceipt && (
              <Btn fillColor="#047857" onClick={() => navigate(`/citizen/challan-payment?transferId=${transfer.transfer_id}&channelId=${transfer.channel_id}&role=${transfer._myRole}`)}>
                <i className="fas fa-paper-plane" /> Send to LRO
              </Btn>
            )}

            <Btn onClick={() => onDownloadSummary(transfer)}>
              <i className="fas fa-download" /> Download
            </Btn>

            {isSeller && (
              <Link to="/citizen/seller" style={{ textDecoration: 'none' }}>
                <Btn><i className="fas fa-list-ul" /> Details</Btn>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp-style indented divider */}
      {!isLast && (
        <div style={{ height: 1, background: '#e9edef', marginLeft: 80 }} />
      )}
    </div>
  );
};

const EmptyState = ({ filter }) => (
  <div style={{
    ...sectionStyle,
    borderStyle: 'dashed',
    padding: '3rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 12,
  }}>
    <div style={{
      width: 58,
      height: 58,
      borderRadius: 20,
      background: T.primaryLight,
      color: T.primary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.35rem',
    }}>
      <i className="fas fa-inbox" />
    </div>
    <div style={{ fontSize: '1rem', fontWeight: 800, color: T.text }}>
      {filter === 'ALL' ? 'No active transfers' : filter === 'SELLER' ? 'No transfers as seller' : 'No transfers as buyer'}
    </div>
    <div style={{ fontSize: '.9rem', color: T.text2, lineHeight: 1.7, maxWidth: 420 }}>
      {filter === 'ALL'
        ? "You do not have any active property transfers yet."
        : filter === 'SELLER'
        ? 'List a direct-owned property in Seller Portal, accept a buyer request, and your negotiation inbox will appear here.'
        : 'Accepted marketplace requests and active buyer-side negotiations will appear here.'}
    </div>
    {filter !== 'BUYER' && (
      <Link
        to="/citizen/seller"
        style={{
          textDecoration: 'none',
          padding: '10px 16px',
          borderRadius: 12,
          background: '#0D7C7C',
          color: '#fff',
          fontWeight: 800,
        }}
      >
        <i className="fas fa-store" style={{ marginRight: 8 }} />
        Open Seller Portal
      </Link>
    )}
  </div>
);

const PendingTransfers = () => {
  const navigate = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const userId = sessionStorage.getItem('userId');
  const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');
  const headers = { Authorization: `Bearer ${authToken}` };

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [lastRefreshed, setLastRefreshed] = useState('');

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [buyR, selR] = await Promise.all([
        fetch(`${BASE}/api/transfers/buyer-pending`, { headers }),
        fetch(`${BASE}/api/transfers/seller/${userId}/pending`, { headers }),
      ]);

      let buyer = [];
      let seller = [];

      if (buyR.ok) {
        const d = await buyR.json();
        buyer = d.transfers || [];
      }
      if (selR.ok) {
        const d = await selR.json();
        seller = d.transfers || [];
      }

      setTransfers([
        ...seller.map((t) => ({ ...t, _myRole: 'SELLER' })),
        ...buyer.map((t) => ({ ...t, _myRole: 'BUYER' })),
      ]);
      setLastRefreshed(new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openReceipt = async (transfer) => {
    if (!transfer?.challan_txn_id) return;

    try {
      const response = await fetch(`${BASE}/api/payments/transaction/${transfer.challan_txn_id}`, { headers });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load receipt');
      }

      const transaction = data.transaction;
      const receiptWindow = window.open('', '_blank');
      if (!receiptWindow) {
        alert('Allow pop-ups to view the payment receipt.');
        return;
      }

      receiptWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt - ${transaction.txnRef}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
    .card { max-width: 760px; margin: 0 auto; border: 1px solid #dbe4ea; border-radius: 20px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; padding: 24px 28px; }
    .head h1 { margin: 0 0 6px; font-size: 28px; }
    .head p { margin: 0; opacity: 0.9; }
    .body { padding: 24px 28px; }
    .amount { font-size: 34px; font-weight: 800; color: #0f766e; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-bottom: 6px; }
    .value { font-size: 15px; font-weight: 700; word-break: break-word; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <h1>Payment Receipt</h1>
      <p>Property transfer payment confirmed</p>
    </div>
    <div class="body">
      <div class="amount">PKR ${Number(transaction.amount || 0).toLocaleString('en-PK')}</div>
      <div style="font-weight:700;">Transaction Ref: ${transaction.txnRef}</div>
      <div class="grid">
        <div class="box">
          <div class="label">Transfer ID</div>
          <div class="value">${transfer.transfer_id}</div>
        </div>
        <div class="box">
          <div class="label">Property ID</div>
          <div class="value">${transfer.property_id || 'N/A'}</div>
        </div>
        <div class="box">
          <div class="label">Paid At</div>
          <div class="value">${new Date(transaction.completedAt).toLocaleString('en-PK')}</div>
        </div>
        <div class="box">
          <div class="label">Buyer Account</div>
          <div class="value">${transaction.sender?.maskedNo || 'N/A'}</div>
        </div>
        <div class="box">
          <div class="label">Seller Account</div>
          <div class="value">${transaction.receiver?.maskedNo || 'N/A'}</div>
        </div>
        <div class="box">
          <div class="label">Status</div>
          <div class="value">PAID</div>
        </div>
      </div>
    </div>
  </div>
  <script>setTimeout(() => window.print(), 500);</script>
</body>
</html>`);
      receiptWindow.document.close();
    } catch (err) {
      alert(`Unable to open receipt: ${err.message}`);
    }
  };

  const downloadTransferSummary = async (transfer) => {
    try {
      let transaction = null;

      if (transfer?.challan_txn_id) {
        const response = await fetch(`${BASE}/api/payments/transaction/${transfer.challan_txn_id}`, { headers });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          transaction = data.transaction || null;
        }
      }

      const partnerName = transfer._myRole === 'SELLER'
        ? (transfer.buyer_name || transfer.buyer_cnic || 'N/A')
        : (transfer.seller_name || transfer.seller_cnic || 'N/A');
      const location = [transfer.district, transfer.tehsil, transfer.mauza].filter(Boolean).join(', ') || 'Location pending';
      const amount = Number(transfer.total_amount || transfer.agreed_price || transfer.transfer_amount || 0);
      const isPaid = transfer.payment_status === 'PAID' || Boolean(transfer.challan_txn_id);
      const receiptStage = !transfer.agreement_screenshot_url && isPaid ? 'Receipt still pending for LRO' : (transfer.agreement_screenshot_url ? 'Receipt submitted to LRO' : 'Receipt not generated yet');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Transfer Summary - ${transfer.transfer_id}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; background: #f8fafc; }
    .card { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #dbe4ea; border-radius: 22px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #27445F, #4E78A5); color: white; padding: 24px 28px; }
    .head h1 { margin: 0 0 6px; font-size: 28px; }
    .head p { margin: 0; opacity: 0.9; }
    .body { padding: 24px 28px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 12px; margin-right: 8px; }
    .pill.alt { background: #ecfdf5; color: #047857; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-bottom: 6px; }
    .value { font-size: 15px; font-weight: 700; word-break: break-word; }
    .wide { margin-top: 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 14px; }
    .wide h2 { margin: 0 0 8px; font-size: 17px; color: #9a3412; }
    .wide p { margin: 0; line-height: 1.65; color: #7c2d12; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <h1>Property Transfer Summary</h1>
      <p>Citizen-facing workflow sheet for ${transfer.transfer_id}</p>
    </div>
    <div class="body">
      <div>
        <span class="pill">${transfer._myRole}</span>
        <span class="pill alt">${String(transfer.status || 'PENDING').replace(/_/g, ' ')}</span>
      </div>
      <div class="grid">
        <div class="box"><div class="label">Transfer ID</div><div class="value">${transfer.transfer_id}</div></div>
        <div class="box"><div class="label">Property ID</div><div class="value">${transfer.property_id || 'N/A'}</div></div>
        <div class="box"><div class="label">Your Counterparty</div><div class="value">${partnerName}</div></div>
        <div class="box"><div class="label">Location</div><div class="value">${location}</div></div>
        <div class="box"><div class="label">Transfer Amount</div><div class="value">PKR ${fmt(amount)}</div></div>
        <div class="box"><div class="label">Channel</div><div class="value">${transfer.channel_id || 'Not active yet'}</div></div>
        <div class="box"><div class="label">Payment Status</div><div class="value">${isPaid ? 'PAID' : (transfer.payment_status || 'PENDING')}</div></div>
        <div class="box"><div class="label">Receipt Status</div><div class="value">${receiptStage}</div></div>
      </div>
      ${transaction ? `
      <div class="wide">
        <h2>Payment Confirmation</h2>
        <p>
          TXN Ref: ${transaction.txnRef}<br />
          Paid At: ${new Date(transaction.completedAt).toLocaleString('en-PK')}<br />
          Buyer Account: ${transaction.sender?.maskedNo || 'N/A'}<br />
          Seller Account: ${transaction.receiver?.maskedNo || 'N/A'}
        </p>
      </div>` : ''}
    </div>
  </div>
  <script>setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

      const summaryWindow = window.open('', '_blank');
      if (!summaryWindow) {
        alert('Allow pop-ups to download the transfer summary.');
        return;
      }

      summaryWindow.document.write(html);
      summaryWindow.document.close();
    } catch (err) {
      alert(`Unable to download transfer summary: ${err.message}`);
    }
  };

  const activateChannel = async (transferId) => {
    try {
      const r = await fetch(`${BASE}/api/transfers/${transferId}/seller-confirm`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (d.success && d.channelId) {
        navigate(`/citizen/negotiation?channelId=${d.channelId}&transferId=${transferId}`);
      } else {
        alert(`Failed: ${d.message}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const sellerCount = transfers.filter((t) => t._myRole === 'SELLER').length;
  const buyerCount = transfers.filter((t) => t._myRole === 'BUYER').length;
  const filtered = filter === 'ALL' ? transfers : transfers.filter((t) => t._myRole === filter);

  const renderTab = (value, label, count) => {
    const active = filter === value;
    return (
      <button
        key={value}
        onClick={() => setFilter(value)}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          border: `1.5px solid ${active ? T.primary : T.border}`,
          background: active ? T.primaryLight : '#fff',
          color: active ? T.primary : T.text2,
          fontWeight: 700,
          fontSize: '.78rem',
          minHeight: 42,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        {label}
        <span style={{
          minWidth: 18,
          height: 18,
          borderRadius: 999,
          padding: '0 5px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? T.primary : '#E5E7EB',
          color: active ? '#fff' : '#6B7280',
          fontSize: '.68rem',
          fontWeight: 900,
        }}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <CitizenLayout title="Transfer Inbox">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 10 }}>
          {[
            { label: 'All Transfers', value: transfers.length, icon: 'fas fa-layer-group', border: '#D6E8E8', iconBg: '#E6F4F2', iconColor: '#0D7C7C' },
            { label: 'As Seller',     value: sellerCount,       icon: 'fas fa-user-tie',    border: '#DBEAFE', iconBg: '#EFF6FF', iconColor: '#1D4ED8' },
            { label: 'As Buyer',      value: buyerCount,         icon: 'fas fa-shopping-cart', border: '#FDE68A', iconBg: '#FFFBEB', iconColor: '#D97706' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: '#fff', border: `1px solid ${stat.border}`,
              borderRadius: 18, padding: '13px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 2px 8px rgba(28,43,62,.05)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 14,
                background: stat.iconBg, color: stat.iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: '.98rem',
              }}>
                <i className={stat.icon} />
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: T.text, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted, marginTop: 4 }}>{stat.label}</div>
              </div>
            </div>
          ))}
      </div>

      {/* ── Filter tabs — below, right-aligned ── */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
        {renderTab('ALL',    'All Transfers', transfers.length)}
        {renderTab('SELLER', 'As Seller',     sellerCount)}
        {renderTab('BUYER',  'As Buyer',       buyerCount)}
      </div>

      {loading ? (
        <div style={{
          ...sectionStyle,
          padding: '3rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 20,
            background: T.primaryLight,
            color: T.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
          }}>
            <i className="fas fa-spinner fa-spin" />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: T.text }}>Loading transfers</div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div style={{
          background: '#fff',
          borderRadius: 18,
          border: `1px solid ${T.border}`,
          boxShadow: '0 4px 18px rgba(28,43,62,.07)',
          overflow: 'hidden',
        }}>
          {filtered.map((transfer, index) => (
            <TransferRow
              key={`${transfer.transfer_id}-${index}`}
              transfer={transfer}
              navigate={navigate}
              onActivate={activateChannel}
              onOpenReceipt={openReceipt}
              onDownloadSummary={downloadTransferSummary}
              isLast={index === filtered.length - 1}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '.8rem', color: T.muted }}>
          Showing {filtered.length} {filtered.length === 1 ? 'transfer' : 'transfers'}
          {filter !== 'ALL' ? ` as ${filter.toLowerCase()}` : ''}
        </div>
      )}
    </CitizenLayout>
  );
};

export default PendingTransfers;