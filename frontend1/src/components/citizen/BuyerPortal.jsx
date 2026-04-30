import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout, { PageHero, StatusPill, fmt } from './CitizenLayout';

const BuyerPortal = () => {
  const navigate = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BASE}/api/transfers/buyer-pending`, { headers });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load buyer transfers');
      }

      setTransfers(data.transfers || []);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const openChat = (transfer) => {
    if (!transfer.channel_id) return;
    navigate(`/citizen/negotiation?channelId=${transfer.channel_id}&transferId=${transfer.transfer_id}`);
  };

  const openReceipt = async (transfer) => {
    if (!transfer.challan_txn_id) return;

    try {
      const response = await fetch(`${BASE}/api/payments/transaction/${transfer.challan_txn_id}`, {
        headers,
      });
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
    .foot { margin-top: 20px; font-size: 12px; color: #64748b; }
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
          <div class="value">${transfer.property_id}</div>
        </div>
        <div class="box">
          <div class="label">Paid At</div>
          <div class="value">${new Date(transaction.completedAt).toLocaleString('en-PK')}</div>
        </div>
        <div class="box">
          <div class="label">Seller</div>
          <div class="value">${transfer.seller_name || 'N/A'}</div>
        </div>
        <div class="box">
          <div class="label">Buyer Account</div>
          <div class="value">${transaction.sender?.maskedNo || 'N/A'}</div>
        </div>
        <div class="box">
          <div class="label">Seller Account</div>
          <div class="value">${transaction.receiver?.maskedNo || 'N/A'}</div>
        </div>
      </div>
      <div class="foot">This receipt is generated from the recorded transfer payment and is linked to your property transfer workflow.</div>
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

  const summary = {
    total: transfers.length,
    readyToPay: transfers.filter((item) => item.payment_status !== 'PAID' && item.channel_id).length,
    paid: transfers.filter((item) => item.payment_status === 'PAID' || item.challan_txn_id).length,
    waiting: transfers.filter((item) => !item.channel_id || item.channel_status === 'INACTIVE').length,
  };

  return (
    <CitizenLayout title="Buyer Portal">
      <PageHero
        eyebrow="Buyer Workspace"
        icon="fas fa-comments-dollar"
        title="Buyer Portal"
        subtitle="Yahan se buyer-side transfers, negotiation chat, challan payment, aur receipt status track kiya ja sakta hai."
        actions={(
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-sm border-0 cursor-pointer hover:bg-teal-700 transition-colors"
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`} />
            Refresh
          </button>
        )}
        stats={[
          { label: 'Total Transfers', value: summary.total, icon: 'fas fa-layer-group', bg: '#ffffff', border: '#d6e8e8', iconBg: '#E6F4F2', iconColor: '#0D7C7C' },
          { label: 'Open for Chat', value: summary.readyToPay, icon: 'fas fa-comments', bg: '#ffffff', border: '#dbeafe', iconBg: '#EFF6FF', iconColor: '#1D4ED8' },
          { label: 'Paid', value: summary.paid, icon: 'fas fa-check-circle', bg: '#ffffff', border: '#d1fae5', iconBg: '#ECFDF5', iconColor: '#059669' },
          { label: 'Waiting', value: summary.waiting, icon: 'fas fa-hourglass-half', bg: '#ffffff', border: '#fef3c7', iconBg: '#FFFBEB', iconColor: '#D97706' },
        ]}
      />

      {false && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Transfers', value: summary.total, color: 'text-slate-900', bg: 'bg-slate-50', icon: 'fas fa-layer-group' },
          { label: 'Open for Chat', value: summary.readyToPay, color: 'text-teal-700', bg: 'bg-teal-50', icon: 'fas fa-comments' },
          { label: 'Paid', value: summary.paid, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: 'fas fa-check-circle' },
          { label: 'Waiting', value: summary.waiting, color: 'text-amber-700', bg: 'bg-amber-50', icon: 'fas fa-hourglass-half' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className={`w-11 h-11 rounded-xl ${card.bg} ${card.color} flex items-center justify-center text-lg mb-3`}>
              <i className={card.icon} />
            </div>
            <div className="text-3xl font-extrabold text-gray-900">{card.value}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-bold mt-1">{card.label}</div>
          </div>
        ))}
      </div>}

      {loading && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center text-gray-500">
          <i className="fas fa-spinner fa-spin text-2xl text-teal-500 mb-3 block" />
          Loading buyer transfers...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-5">
          <strong>Buyer portal error:</strong> {error}
        </div>
      )}

      {!loading && !error && transfers.length === 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center text-gray-500">
          <i className="fas fa-inbox text-4xl text-gray-300 mb-4 block" />
          No buyer-side transfers found yet.
        </div>
      )}

      {!loading && !error && transfers.length > 0 && (
        <div className="grid gap-4">
          {transfers.map((transfer) => {
            const isPaid = transfer.payment_status === 'PAID' || Boolean(transfer.challan_txn_id);
            const canOpenChat = Boolean(transfer.channel_id) && transfer.channel_status !== 'INACTIVE' && transfer.channel_status !== 'CLOSED';
            const location = [transfer.district, transfer.tehsil, transfer.mauza].filter(Boolean).join(', ');
            const displayAmount = Number(
              transfer.total_amount ||
              transfer.agreed_price ||
              transfer.transfer_amount ||
              0
            );

            return (
              <div key={transfer.transfer_id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Property Transfer</div>
                    <div className="text-xl font-extrabold text-gray-900">{transfer.property_id}</div>
                    <div className="text-sm text-gray-500 mt-1">{location || 'Location pending'}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <StatusPill status={transfer.status} />
                    {transfer.channel_status && <StatusPill status={transfer.channel_status} />}
                    {isPaid && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                        <i className="fas fa-check-circle text-[10px]" />
                        Paid
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ['Seller', transfer.seller_name || 'N/A'],
                    ['Amount', `PKR ${fmt(displayAmount)}`],
                    ['Channel', transfer.channel_id || 'Not opened yet'],
                    ['TXN Ref', transfer.challan_txn_id || 'Awaiting payment'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-2xl p-4">
                      <div className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-1">{label}</div>
                      <div className="font-extrabold text-sm text-gray-900 break-all">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="px-6 pb-6 flex gap-3 flex-wrap">
                  <button
                    onClick={() => canOpenChat && openChat(transfer)}
                    disabled={!canOpenChat}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border-0 transition-colors ${
                      canOpenChat
                        ? 'bg-teal-600 text-white cursor-pointer hover:bg-teal-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <i className="fas fa-comments" />
                    {isPaid ? 'Open Chat History' : 'Open Chat & Pay'}
                  </button>

                  {isPaid && transfer.challan_txn_id && (
                    <button
                      onClick={() => openReceipt(transfer)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <i className="fas fa-file-download" />
                      View Receipt
                    </button>
                  )}

                  {!canOpenChat && (
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-sm">
                      <i className="fas fa-hourglass-half" />
                      Waiting for seller to start the chat
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CitizenLayout>
  );
};

export default BuyerPortal;
