import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CitizenLayout, { PageHero, StatusPill, T, fmt, fmtDateTime } from './CitizenLayout';

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

const TransferCard = ({ transfer, navigate, onActivate, onOpenReceipt, index }) => {
  const isSeller = transfer._myRole === 'SELLER';
  const hasChannel = transfer.channel_id && transfer.channel_status !== 'INACTIVE' && transfer.channel_status !== 'CLOSED';
  const partnerName = isSeller ? (transfer.buyer_name || transfer.buyer_cnic || '—') : (transfer.seller_name || transfer.seller_cnic || '—');
  const location = [transfer.district, transfer.tehsil].filter(Boolean).join(', ') || 'Location pending';
  const amount = transfer.transfer_amount ? `PKR ${fmt(transfer.transfer_amount)}` : '—';
  const areaVal = transfer.area_marla || transfer.area || transfer.area_sq_ft || transfer.plot_area || transfer.land_area || transfer.marla || transfer.size_marla || null;
  const isExpired = transfer.expires_at && new Date(transfer.expires_at) < new Date();
  const expiryStr = transfer.expires_at ? new Date(transfer.expires_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const isPaid = transfer.payment_status === 'PAID' || Boolean(transfer.challan_txn_id);
  const needsLroReceipt = !isSeller && isPaid && !transfer.agreement_screenshot_url && Boolean(transfer.channel_id);

  return (
    <article style={{
      ...sectionStyle,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 360,
      animation: `fadeUp .28s ease ${index * 70}ms both`,
    }}>
      <div style={{ height: 5, background: isSeller ? '#0D7C7C' : '#4E78A5' }} />

      <div style={{
        padding: '1rem 1.1rem',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        background: isSeller ? '#F0FDFA' : '#EFF6FF',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: '#fff',
            border: `1px solid ${T.border}`,
            color: isSeller ? '#0D7C7C' : '#1D4ED8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            flexShrink: 0,
          }}>
            <i className={isSeller ? 'fas fa-user' : 'fas fa-user-tie'} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '.66rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
              {isSeller ? 'Buyer' : 'Seller'}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: T.text, lineHeight: 1.2 }}>{partnerName}</div>
          </div>
        </div>
        <RoleBadge role={transfer._myRole} />
      </div>

      <div style={{ padding: '1rem 1.1rem', flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <StatusPill status={transfer.status} />
          {transfer.channel_status && transfer.channel_status !== 'INACTIVE' && <StatusPill status={transfer.channel_status} />}
          {transfer.seller_agreed && transfer.buyer_agreed && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 999,
              background: '#ECFDF5',
              color: '#047857',
              fontSize: '.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
            }}>
              <i className="fas fa-handshake" />
              Both Agreed
            </span>
          )}
          {isExpired && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 999,
              background: '#FEF2F2',
              color: '#DC2626',
              fontSize: '.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
            }}>
              <i className="fas fa-exclamation-circle" />
              Expired
            </span>
          )}
        </div>

        <InfoRow icon="fas fa-map-marker-alt" label="Location" value={location} />
        <InfoRow icon="fas fa-ruler-combined" label="Area" value={areaVal ? `${areaVal} Marla` : '—'} />
        <InfoRow icon="fas fa-money-bill-wave" label="Amount" value={amount} bold />
        {transfer.property_id && <InfoRow icon="fas fa-home" label="Property" value={transfer.property_id} mono />}
        {isSeller && transfer.channel_id && <InfoRow icon="fas fa-link" label="Channel" value={transfer.channel_id} mono />}

        {expiryStr && (
          <div style={{ marginTop: 12, fontSize: '.8rem', fontWeight: 700, color: isExpired ? '#DC2626' : '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-clock" />
            {isExpired ? 'Expired' : 'Expires'}: {expiryStr}
          </div>
        )}
      </div>

      <div style={{
        padding: '1rem 1.1rem',
        borderTop: `1px solid ${T.border}`,
        background: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {hasChannel ? (
          <button
            onClick={() => navigate(`/citizen/negotiation?channelId=${transfer.channel_id}&transferId=${transfer.transfer_id}`)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#27445F,#4E78A5)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <i className="fas fa-comments" style={{ marginRight: 8 }} />
            Open Chat
            {transfer.unread_count > 0 && (
              <span style={{
                position: 'absolute',
                top: -7,
                right: 10,
                minWidth: 20,
                height: 20,
                padding: '0 5px',
                borderRadius: 999,
                background: '#EF4444',
                color: '#fff',
                fontSize: '.68rem',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {transfer.unread_count > 9 ? '9+' : transfer.unread_count}
              </span>
            )}
          </button>
        ) : isSeller && (transfer.status === 'PENDING' || transfer.status === 'CHANNEL_ACTIVE') ? (
          <button
            onClick={() => onActivate(transfer.transfer_id)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#047857,#10B981)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-comments" style={{ marginRight: 8 }} />
            Start Chat
          </button>
        ) : (
          <button
            disabled
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid #E5E7EB',
              background: '#F3F4F6',
              color: '#9CA3AF',
              fontWeight: 800,
              cursor: 'not-allowed',
            }}
          >
            <i className="fas fa-hourglass-half" style={{ marginRight: 8 }} />
            Awaiting
          </button>
        )}

        {transfer.challan_txn_id && (
          <button
            onClick={() => onOpenReceipt(transfer)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.text2,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-file-download" style={{ marginRight: 8 }} />
            View Receipt
          </button>
        )}

        {needsLroReceipt && (
          <button
            onClick={() => navigate(`/citizen/challan-payment?transferId=${transfer.transfer_id}&channelId=${transfer.channel_id}&role=${transfer._myRole}`)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#047857,#10B981)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-paper-plane" style={{ marginRight: 8 }} />
            Send Receipt to LRO
          </button>
        )}

        {isSeller && (
          <Link
            to="/citizen/seller"
            style={{
              textDecoration: 'none',
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.text2,
              fontWeight: 800,
              textAlign: 'center',
            }}
          >
            <i className="fas fa-list-ul" style={{ marginRight: 8 }} />
            Full Details
          </Link>
        )}
      </div>
    </article>
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
          padding: '10px 16px',
          borderRadius: 14,
          border: `1.5px solid ${active ? T.primary : T.border}`,
          background: active ? T.primaryLight : '#fff',
          color: active ? T.primary : T.text2,
          fontWeight: 800,
          fontSize: '.88rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {label}
        <span style={{
          minWidth: 22,
          height: 22,
          borderRadius: 999,
          padding: '0 7px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? T.primary : '#E5E7EB',
          color: active ? '#fff' : '#6B7280',
          fontSize: '.72rem',
          fontWeight: 900,
        }}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <CitizenLayout title="Transfer Inbox">
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <PageHero
        eyebrow="Transfer Timeline"
        icon="fas fa-route"
        title="Transfer Inbox"
        subtitle={`Accepted buyer requests, active negotiations, challan payment, and receipts are visible here. ${lastRefreshed ? `Last refresh ${lastRefreshed}.` : ''}`}
        actions={(
          <>
            <button
              onClick={load}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,.22)',
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`} />
              Refresh
            </button>
            <Link
              to="/citizen/marketplace"
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,.22)',
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              <i className="fas fa-store" style={{ marginRight: 8 }} />
              Marketplace
            </Link>
            <Link
              to="/citizen/seller"
              style={{
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,.22)',
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              <i className="fas fa-list-check" style={{ marginRight: 8 }} />
              Seller Requests
            </Link>
          </>
        )}
        stats={[
          { label: 'All Transfers', value: transfers.length, icon: 'fas fa-layer-group', bg: '#FFFFFF', border: '#D6E8E8', iconBg: '#E6F4F2', iconColor: '#0D7C7C' },
          { label: 'As Seller', value: sellerCount, icon: 'fas fa-user-tie', bg: '#FFFFFF', border: '#DBEAFE', iconBg: '#EFF6FF', iconColor: '#1D4ED8' },
          { label: 'As Buyer', value: buyerCount, icon: 'fas fa-shopping-cart', bg: '#FFFFFF', border: '#FDE68A', iconBg: '#FFFBEB', iconColor: '#D97706' },
        ]}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {renderTab('ALL', 'All Transfers', transfers.length)}
        {renderTab('SELLER', 'As Seller', sellerCount)}
        {renderTab('BUYER', 'As Buyer', buyerCount)}
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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {filtered.map((transfer, index) => (
            <TransferCard
              key={`${transfer.transfer_id}-${index}`}
              transfer={transfer}
              index={index}
              navigate={navigate}
              onActivate={activateChannel}
              onOpenReceipt={openReceipt}
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
