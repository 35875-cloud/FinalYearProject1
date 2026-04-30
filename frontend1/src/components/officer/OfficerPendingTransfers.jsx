import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OfficerLayout, { T, S, fmtDateTime } from './OfficerLayout';

const InfoGroup = ({ label, value, mono, highlight }) => (
  <div style={{ background: 'white', borderRadius: 12, padding: 14, border: `1px solid ${T.border}` }}>
    <div
      style={{
        fontSize: '.72rem',
        fontWeight: 700,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 5,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: '.9rem',
        color: highlight || T.text,
        fontWeight: 600,
        fontFamily: mono ? "'JetBrains Mono',monospace" : undefined,
        wordBreak: 'break-word',
      }}
    >
      {value || '--'}
    </div>
  </div>
);

const MetaBadge = ({ icon, children, color = '#1e40af', bg = '#dbeafe' }) => (
  <span
    style={{
      background: bg,
      color,
      padding: '5px 10px',
      borderRadius: 999,
      fontSize: '.78rem',
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
    }}
  >
    <i className={icon} />
    {children}
  </span>
);

const Btn = ({ children, onClick, color, outline, disabled, small, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: small ? '7px 13px' : '10px 18px',
      border: outline ? `1.5px solid ${T.border}` : 'none',
      borderRadius: 10,
      background: outline ? 'white' : (color || T.primary),
      color: outline ? T.text2 : 'white',
      fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: small ? '.78rem' : '.84rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      opacity: disabled ? 0.65 : 1,
      fontFamily: "'DM Sans',sans-serif",
      flexWrap: 'nowrap',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </button>
);

const StatCard = ({ icon, value, label, iconBg, iconColor }) => (
  <div
    style={{
      background: 'white',
      borderRadius: 16,
      padding: '1.35rem',
      boxShadow: S.md,
      transition: 'all .25s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = S.md;
    }}
  >
    <div
      style={{
        width: 50,
        height: 50,
        background: iconBg,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.35rem',
        color: iconColor,
        marginBottom: '.95rem',
      }}
    >
      <i className={icon} />
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: T.text, marginBottom: 3 }}>{value}</div>
    <div style={{ fontSize: '.85rem', color: '#64748b', fontWeight: 600 }}>{label}</div>
  </div>
);

const PropertyListItem = ({ transfer, index, active, onSelect }) => {
  const isSubmittedToVoting = ['VOTING', 'READY_FOR_DC', 'FINALIZED'].includes(
    String(transfer.voting_status || '').toUpperCase()
  );
  const location = [transfer.district, transfer.tehsil, transfer.mauza].filter(Boolean).join(', ') || 'Location pending';

  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        border: active ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
        background: active ? '#eef2ff' : 'white',
        borderRadius: 16,
        padding: '14px 15px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        boxShadow: active ? '0 10px 24px rgba(102,126,234,.14)' : 'none',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: active ? T.primary : '#e2e8f0',
          color: active ? 'white' : T.text2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, color: T.text, fontSize: '.88rem' }}>{transfer.property_id}</div>
          <span
            style={{
              background: isSubmittedToVoting ? '#dbeafe' : '#d1fae5',
              color: isSubmittedToVoting ? '#1d4ed8' : '#065f46',
              padding: '4px 8px',
              borderRadius: 999,
              fontSize: '.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
            }}
          >
            {isSubmittedToVoting ? 'In Voting' : 'Ready'}
          </span>
        </div>
        <div style={{ color: T.text2, fontSize: '.8rem', fontWeight: 700, marginBottom: 4 }}>
          {transfer.current_owner || transfer.seller_name || 'Property record'}
        </div>
        <div style={{ color: T.muted, fontSize: '.76rem', lineHeight: 1.45, marginBottom: 8 }}>
          {location}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {transfer.current_owner_cnic ? (
            <span style={{ fontSize: '.72rem', color: T.text2, background: '#f8fafc', padding: '4px 8px', borderRadius: 999 }}>
              Owner CNIC: {transfer.current_owner_cnic}
            </span>
          ) : null}
          {transfer.buyer_cnic ? (
            <span style={{ fontSize: '.72rem', color: T.text2, background: '#f8fafc', padding: '4px 8px', borderRadius: 999 }}>
              Buyer CNIC: {transfer.buyer_cnic}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
};

const OfficerPendingTransfers = () => {
  const navigate = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [transfers, setTransfers] = useState([]);
  const [selectedTransferId, setSelectedTransferId] = useState(null);
  const [stats, setStats] = useState({ total: 0, withScreenshot: 0, approvedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const token = () => sessionStorage.getItem('authToken') || localStorage.getItem('token');

  const updateSelectedTransfer = (nextTransfers) => {
    setSelectedTransferId((currentId) => {
      if (currentId && nextTransfers.some((item) => item.transfer_id === currentId)) {
        return currentId;
      }
      return nextTransfers[0]?.transfer_id || null;
    });
  };

  const load = async (searchValue = activeSearch) => {
    setLoading(true);
    setError(null);

    try {
      const trimmed = String(searchValue || '').trim();
      const query = trimmed ? `?search=${encodeURIComponent(trimmed)}` : '';
      const r = await fetch(`${BASE}/api/transfers/lro/review${query}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();

      if (!d.success) throw new Error(d.message || 'Unable to load transfers');

      const nextTransfers = d.transfers || [];
      setTransfers(nextTransfers);
      updateSelectedTransfer(nextTransfers);
      setStats({
        total: d.statistics?.total || nextTransfers.length,
        withScreenshot: d.statistics?.withScreenshot || 0,
        approvedToday: d.statistics?.approvedToday || 0,
      });
      setActiveSearch(trimmed);
    } catch (e) {
      setError(e.message);
      setTransfers([]);
      setSelectedTransferId(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }

    load('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const iv = setInterval(() => load(activeSearch), 30000);
    return () => clearInterval(iv);
  }, [activeSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTransfer =
    transfers.find((item) => item.transfer_id === selectedTransferId) ||
    transfers[0] ||
    null;

  const approveTransfer = async (transferId) => {
    if (!window.confirm('Submit this paid transfer into blockchain voting?')) return;

    try {
      const r = await fetch(`${BASE}/api/transfer-voting/lro/${transferId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'Unable to submit transfer');

      alert('Transfer submitted for blockchain voting.');
      await load(activeSearch);
      navigate('/lro/transfer-voting');
    } catch (e) {
      alert(`Submit failed: ${e.message}`);
    }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }

    setRejecting(true);
    try {
      const r = await fetch(`${BASE}/api/transfers/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId: rejectId, reason: rejectReason }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'Unable to reject transfer');

      alert('Transfer rejected.');
      setRejectModal(false);
      setRejectId(null);
      setRejectReason('');
      await load(activeSearch);
    } catch (e) {
      alert(`Reject failed: ${e.message}`);
    }
    setRejecting(false);
  };

  const downloadTransferReviewSheet = (tr) => {
    const paidAmt = Number(tr.txn_amount || tr.agreed_price || tr.transfer_amount || 0);
    const location = [tr.district, tr.tehsil, tr.mauza].filter(Boolean).join(', ') || 'N/A';
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Transfer Review Sheet - ${tr.transfer_id}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; background: #f8fafc; }
    .card { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #dbe4ea; border-radius: 22px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #27445F, #4E78A5); color: white; padding: 24px 28px; }
    .head h1 { margin: 0 0 6px; font-size: 28px; }
    .head p { margin: 0; opacity: 0.88; }
    .body { padding: 24px 28px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; font-weight: 700; margin-bottom: 6px; }
    .value { font-size: 15px; font-weight: 700; word-break: break-word; }
    .strip { margin-top: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 14px; padding: 14px; line-height: 1.65; color: #065f46; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <h1>LRO Transfer Review Sheet</h1>
      <p>Prepared for blockchain voting submission</p>
    </div>
    <div class="body">
      <div class="grid">
        <div class="box"><div class="label">Transfer ID</div><div class="value">${tr.transfer_id}</div></div>
        <div class="box"><div class="label">Property ID</div><div class="value">${tr.property_id || 'N/A'}</div></div>
        <div class="box"><div class="label">Seller</div><div class="value">${tr.seller_name || 'N/A'}<br/>${tr.seller_cnic || 'N/A'}</div></div>
        <div class="box"><div class="label">Buyer</div><div class="value">${tr.buyer_name || 'N/A'}<br/>${tr.buyer_cnic || 'N/A'}</div></div>
        <div class="box"><div class="label">Location</div><div class="value">${location}</div></div>
        <div class="box"><div class="label">Area</div><div class="value">${tr.area_marla ? `${tr.area_marla} Marla` : 'N/A'}</div></div>
        <div class="box"><div class="label">Paid Amount</div><div class="value">PKR ${paidAmt.toLocaleString('en-PK')}</div></div>
        <div class="box"><div class="label">TXN Ref</div><div class="value">${tr.challan_txn_id || 'N/A'}</div></div>
      </div>
      <div class="strip">
        Seller agreed: ${tr.seller_agreed ? 'YES' : 'NO'}<br />
        Buyer agreed: ${tr.buyer_agreed ? 'YES' : 'NO'}<br />
        Payment completed: ${tr.payment_completed_at ? new Date(tr.payment_completed_at).toLocaleString('en-PK') : 'N/A'}<br />
        Voting status: ${tr.voting_status || 'Not yet submitted'}
      </div>
    </div>
  </div>
  <script>setTimeout(function(){ window.print(); }, 400);</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Allow pop-ups to download the review sheet.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  const buildChallanHtml = (c) => {
    const amt = Number(c.amount || 0);
    const dateStr = c.completedAt
      ? new Date(c.completedAt).toLocaleString('en-PK', { dateStyle: 'long', timeStyle: 'medium' })
      : 'N/A';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Transfer Challan - ${c.txnRef}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 26px; color: #0f172a; background: #f8fafc; }
    .card { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #dbe4ea; border-radius: 22px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #0f766e, #0f9f90); color: white; padding: 24px 28px; }
    .head h1 { margin: 0 0 6px; font-size: 28px; }
    .head p { margin: 0; opacity: 0.9; }
    .body { padding: 24px 28px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; font-weight: 700; margin-bottom: 6px; }
    .value { font-size: 15px; font-weight: 700; word-break: break-word; }
    .amount { margin-top: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 14px; padding: 16px; }
    .amount strong { font-size: 24px; color: #065f46; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <h1>Transfer Payment Challan</h1>
      <p>Verified payment details for LRO review</p>
    </div>
    <div class="body">
      <div class="grid">
        <div class="box"><div class="label">Transaction Ref</div><div class="value">${c.txnRef || 'N/A'}</div></div>
        <div class="box"><div class="label">Property ID</div><div class="value">${c.propertyId || 'N/A'}</div></div>
        <div class="box"><div class="label">Transfer ID</div><div class="value">${c.transferId || 'N/A'}</div></div>
        <div class="box"><div class="label">Completed At</div><div class="value">${dateStr}</div></div>
        <div class="box"><div class="label">Buyer</div><div class="value">${c.sender?.name || 'N/A'}<br/>${c.buyerCnic || 'N/A'}</div></div>
        <div class="box"><div class="label">Seller</div><div class="value">${c.receiver?.name || 'N/A'}<br/>${c.sellerCnic || 'N/A'}</div></div>
      </div>
      <div class="amount">
        <div class="label">Amount Paid</div>
        <strong>PKR ${amt.toLocaleString('en-PK')}</strong>
      </div>
    </div>
  </div>
  <script>setTimeout(function(){ window.print(); }, 400);</script>
</body>
</html>`;
  };

  const viewChallan = async (tr) => {
    const txnRef = tr.challan_txn_id;
    if (!txnRef) {
      alert('No transaction reference found for this transfer.');
      return;
    }

    try {
      const r = await fetch(`${BASE}/api/payments/transaction/${txnRef}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (!d.success) {
        alert('Could not fetch challan details.');
        return;
      }

      const t = d.transaction;
      const challan = {
        txnRef: t.txnRef,
        amount: t.amount,
        completedAt: t.completedAt,
        sender: t.sender,
        receiver: t.receiver,
        buyerCnic: tr.buyer_cnic,
        sellerCnic: tr.seller_cnic,
        transferId: tr.transfer_id,
        propertyId: tr.property_id,
      };

      const win = window.open('', '_blank');
      if (!win) {
        alert('Allow pop-ups to view challan.');
        return;
      }
      win.document.write(buildChallanHtml(challan));
      win.document.close();
    } catch (e) {
      alert(`Error loading challan: ${e.message}`);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    load(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    load('');
  };

  const renderDetailPane = () => {
    if (!selectedTransfer) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: T.muted }}>
          <i className="fas fa-folder-open fa-3x" style={{ display: 'block', marginBottom: '1rem', opacity: 0.5 }} />
          Select a property from the numbered list to view its transfer details.
        </div>
      );
    }

    const tr = selectedTransfer;
    const hasTxn = Boolean(tr.challan_txn_id || tr.payment_transaction_id);
    const hasScreenshot = Boolean(tr.agreement_screenshot_url);
    const votingStage = String(tr.voting_status || '').toUpperCase();
    const isSubmittedToVoting = ['VOTING', 'READY_FOR_DC', 'FINALIZED'].includes(votingStage);
    const isReady = tr.payment_status === 'PAID' && tr.seller_agreed && tr.buyer_agreed && !isSubmittedToVoting;
    const paidAmt = Number(tr.txn_amount || tr.agreed_price || tr.transfer_amount || 0);
    const location = [tr.district, tr.tehsil, tr.mauza].filter(Boolean).join(', ') || '--';

    return (
      <div style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1.2rem',
            paddingBottom: '1rem',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '1.15rem', fontWeight: 800, color: T.text, marginBottom: 6 }}>
              {tr.property_id}
            </div>
            <div style={{ color: T.muted, fontSize: '.84rem', lineHeight: 1.5 }}>
              Transfer ID #{tr.transfer_id}
              <br />
              {location}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MetaBadge icon="fas fa-money-check-alt" bg="#d1fae5" color="#065f46">
              Paid PKR {paidAmt.toLocaleString('en-PK')}
            </MetaBadge>
            {isSubmittedToVoting ? (
              <MetaBadge icon="fas fa-gavel">Voting {Number(tr.approval_count || 0)}/3</MetaBadge>
            ) : (
              <MetaBadge icon="fas fa-check-circle" bg="#ecfdf5" color="#047857">
                Ready for decision
              </MetaBadge>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginBottom: 16 }}>
          <InfoGroup label="Current Owner" value={tr.current_owner} />
          <InfoGroup label="Current Owner CNIC" value={tr.current_owner_cnic} mono />
          <InfoGroup label="Seller" value={tr.seller_name} />
          <InfoGroup label="Seller CNIC" value={tr.seller_cnic} mono />
          <InfoGroup label="Buyer" value={tr.buyer_name} />
          <InfoGroup label="Buyer CNIC" value={tr.buyer_cnic} mono />
          <InfoGroup label="Property Type" value={tr.property_type} />
          <InfoGroup label="Area" value={tr.area_marla ? `${tr.area_marla} Marla` : '--'} />
          <InfoGroup label="Khewat No" value={tr.khewat_no} />
          <InfoGroup label="Khasra No" value={tr.khasra_no} />
        </div>

        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: '1rem', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: '#065f46', marginBottom: 10 }}>
            <i className="fas fa-money-bill-transfer" style={{ marginRight: 8 }} />
            Payment and Agreement Status
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <InfoGroup label="Payment Completed" value={fmtDateTime(tr.payment_completed_at)} />
            <InfoGroup label="TXN Reference" value={tr.challan_txn_id || tr.payment_transaction_id} mono />
            <InfoGroup label="Seller Agreed" value={tr.seller_agreed ? 'Yes' : 'No'} highlight={tr.seller_agreed ? '#047857' : '#b45309'} />
            <InfoGroup label="Buyer Agreed" value={tr.buyer_agreed ? 'Yes' : 'No'} highlight={tr.buyer_agreed ? '#047857' : '#b45309'} />
          </div>
        </div>

        {hasScreenshot ? (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: '1rem', marginBottom: 16 }}>
            <div style={{ fontWeight: 800, color: '#1d4ed8', marginBottom: 10 }}>
              <i className="fas fa-image" style={{ marginRight: 8 }} />
              Agreement Screenshot
            </div>
            <img
              src={`${BASE}${tr.agreement_screenshot_url}`}
              alt="Agreement Screenshot"
              onClick={() => window.open(`${BASE}${tr.agreement_screenshot_url}`, '_blank')}
              style={{
                maxWidth: '100%',
                maxHeight: 200,
                objectFit: 'contain',
                borderRadius: 10,
                cursor: 'pointer',
                border: `1px solid ${T.border}`,
                background: 'white',
              }}
            />
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isReady ? (
            <Btn onClick={() => approveTransfer(tr.transfer_id)} color="#059669">
              <i className="fas fa-gavel" />
              Submit For Voting
            </Btn>
          ) : null}

          {isSubmittedToVoting ? (
            <Btn onClick={() => navigate('/lro/transfer-voting')} color="#2563eb">
              <i className="fas fa-arrow-right" />
              Open Vote Queue
            </Btn>
          ) : null}

          {isReady ? (
            <Btn
              onClick={() => {
                setRejectId(tr.transfer_id);
                setRejectReason('');
                setRejectModal(true);
              }}
              color="#dc2626"
            >
              <i className="fas fa-times-circle" />
              Reject Transfer
            </Btn>
          ) : null}

          {hasTxn ? (
            <Btn onClick={() => viewChallan(tr)} color="#6366f1">
              <i className="fas fa-file-invoice" />
              View Challan
            </Btn>
          ) : null}

          <Btn onClick={() => downloadTransferReviewSheet(tr)} outline small>
            <i className="fas fa-file-export" />
            Review Sheet
          </Btn>

          {hasScreenshot ? (
            <Btn onClick={() => window.open(`${BASE}${tr.agreement_screenshot_url}`, '_blank')} outline small>
              <i className="fas fa-up-right-from-square" />
              Open Screenshot
            </Btn>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <OfficerLayout title="Pending Transfers">
      <style>{`
        @media (max-width: 1024px) {
          .lro-transfer-shell {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ background: 'white', borderRadius: 24, padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ color: T.text, fontFamily: "'Sora',sans-serif", fontWeight: 700, margin: '0 0 6px 0' }}>
              <i className="fas fa-exchange-alt" style={{ color: T.primary, marginRight: 10 }} />
              Pending Transfer Properties
            </h2>
            <p style={{ color: '#64748b', margin: 0, fontSize: '.875rem' }}>
              Search by CNIC, review the numbered property list, then click a property to inspect full transfer details.
            </p>
          </div>

          <Btn onClick={() => load(activeSearch)} outline>
            <i className="fas fa-sync-alt" />
            Refresh
          </Btn>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 260 }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by owner, seller, or buyer CNIC"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1.5px solid ${T.border}`,
                fontSize: '.9rem',
                outline: 'none',
                fontFamily: "'DM Sans',sans-serif",
              }}
            />
          </div>
          <Btn type="submit" color={T.primary}>
            <i className="fas fa-search" />
            Search
          </Btn>
          <Btn type="button" onClick={clearSearch} outline>
            <i className="fas fa-eraser" />
            Clear
          </Btn>
        </form>

        {activeSearch ? (
          <div style={{ marginTop: '1rem', color: T.text2, fontSize: '.82rem' }}>
            Showing properties linked to CNIC search: <strong>{activeSearch}</strong>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20, marginBottom: 28 }}>
        <StatCard icon="fas fa-list-ol" value={stats.total} label="Properties In Review List" iconBg="#dbeafe" iconColor="#2563eb" />
        <StatCard icon="fas fa-image" value={stats.withScreenshot} label="With Screenshot Evidence" iconBg="#ede9fe" iconColor="#7c3aed" />
        <StatCard icon="fas fa-check-double" value={stats.approvedToday} label="Approved Today" iconBg="#d1fae5" iconColor="#059669" />
      </div>

      <div className="lro-transfer-shell" style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: 22 }}>
        <div style={{ background: 'white', borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1.1rem 1.2rem', borderBottom: `1px solid ${T.border}`, background: '#f8fafc' }}>
            <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>
              <i className="fas fa-list-ol" style={{ color: T.primary, marginRight: 8 }} />
              Property List
            </div>
            <div style={{ color: T.muted, fontSize: '.78rem' }}>
              Numbered order. Click any property to open its transfer details.
            </div>
          </div>

          <div style={{ padding: '1rem', display: 'grid', gap: 10, maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: T.muted }}>
                <i className="fas fa-spinner fa-spin fa-2x" style={{ display: 'block', marginBottom: '.75rem', color: T.primary }} />
                Loading properties...
              </div>
            ) : null}

            {!loading && error ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 14, padding: '1rem', color: '#991b1b', fontSize: '.84rem' }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: 8 }} />
                {error}
              </div>
            ) : null}

            {!loading && !error && transfers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: T.muted }}>
                <i className="fas fa-inbox fa-3x" style={{ display: 'block', marginBottom: '.85rem', opacity: 0.45 }} />
                No transfer properties found for this search.
              </div>
            ) : null}

            {!loading && !error
              ? transfers.map((transfer, index) => (
                  <PropertyListItem
                    key={transfer.transfer_id}
                    transfer={transfer}
                    index={index}
                    active={selectedTransfer?.transfer_id === transfer.transfer_id}
                    onSelect={() => setSelectedTransferId(transfer.transfer_id)}
                  />
                ))
              : null}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1.1rem 1.4rem', borderBottom: `1px solid ${T.border}`, background: '#f8fafc' }}>
            <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>
              <i className="fas fa-file-alt" style={{ color: T.primary, marginRight: 8 }} />
              Selected Property Details
            </div>
            <div style={{ color: T.muted, fontSize: '.78rem' }}>
              Full transfer information, payment evidence, and LRO decision actions.
            </div>
          </div>
          {loading && transfers.length === 0 ? null : renderDetailPane()}
        </div>
      </div>

      {rejectModal ? (
        <>
          <div
            onClick={() => setRejectModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, backdropFilter: 'blur(3px)' }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(480px,95vw)',
              background: 'white',
              borderRadius: 20,
              zIndex: 501,
              boxShadow: '0 20px 60px rgba(0,0,0,.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'white', fontWeight: 700 }}>
                <i className="fas fa-times-circle" style={{ marginRight: 8 }} />
                Reject Transfer
              </span>
              <button
                onClick={() => setRejectModal(false)}
                style={{
                  background: 'rgba(255,255,255,.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '.875rem', color: T.text2, marginBottom: '1rem' }}>
                <strong>Transfer ID:</strong>{' '}
                <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>#{rejectId}</code>
              </p>

              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', marginBottom: '1rem', fontSize: '.82rem', color: '#991b1b' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
                Payment has already been made. Rejection will require manual refund coordination with both parties.
              </div>

              <label style={{ display: 'block', fontWeight: 600, fontSize: '.82rem', color: T.text2, marginBottom: 6 }}>
                Rejection Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Enter detailed reason for rejection..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${T.border}`,
                  fontSize: '.875rem',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: "'DM Sans',sans-serif",
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#f8fafc' }}>
              <Btn onClick={() => setRejectModal(false)} outline>
                Cancel
              </Btn>
              <Btn onClick={submitReject} color="#dc2626" disabled={rejecting}>
                {rejecting ? (
                  <>
                    <i className="fas fa-spinner fa-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-times-circle" />
                    Reject Transfer
                  </>
                )}
              </Btn>
            </div>
          </div>
        </>
      ) : null}
    </OfficerLayout>
  );
};

export default OfficerPendingTransfers;
