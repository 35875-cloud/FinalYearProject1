import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CitizenLayout, { PageHero, StatusPill, T, fmt, fmtDateTime } from '../citizen/CitizenLayout';

const FINAL_TRANSFER_STATUSES = new Set(['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
const LIVE_CHANNEL_STATUSES = new Set(['ACTIVE', 'NEGOTIATING', 'AGREED', 'PAYMENT_DONE', 'PAYMENT_CONFIRMED']);

const styles = {
  section: {
    background: '#fff',
    border: `1px solid ${T.border}`,
    borderRadius: 24,
    boxShadow: '0 10px 28px rgba(28,43,62,.07)',
    overflow: 'hidden',
  },
  sectionHead: {
    padding: '1.2rem 1.35rem',
    borderBottom: `1px solid ${T.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionEyebrow: {
    fontSize: '.7rem',
    fontWeight: 800,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: T.muted,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '1.15rem',
    fontWeight: 800,
    color: T.text,
    margin: 0,
  },
  sectionLink: {
    textDecoration: 'none',
    color: T.primary,
    fontSize: '.82rem',
    fontWeight: 800,
  },
};

const ActionCard = ({ to, icon, title, text, tone }) => (
  <Link
    to={to}
    style={{
      textDecoration: 'none',
      background: '#fff',
      border: `1px solid ${T.border}`,
      borderRadius: 22,
      padding: '1.1rem',
      boxShadow: '0 6px 18px rgba(28,43,62,.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 170,
      transition: 'transform .15s ease, box-shadow .15s ease',
    }}
  >
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.05rem',
      ...tone,
    }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '1.02rem', fontWeight: 800, color: T.text }}>{title}</div>
    <div style={{ fontSize: '.88rem', color: T.text2, lineHeight: 1.65 }}>{text}</div>
  </Link>
);

const TrackerStep = ({ step, title, text, value, done }) => (
  <div style={{
    background: '#fff',
    border: `1px solid ${done ? '#B7E4DA' : T.border}`,
    borderRadius: 20,
    padding: '1rem',
    boxShadow: '0 6px 18px rgba(28,43,62,.05)',
    display: 'grid',
    gap: 10,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        background: done ? '#ECFDF5' : T.primaryLight,
        color: done ? '#047857' : T.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '.82rem',
        fontWeight: 900,
      }}>
        {done ? <i className="fas fa-check" /> : step}
      </div>
      <div style={{
        padding: '4px 10px',
        borderRadius: 999,
        background: done ? '#ECFDF5' : '#F8FAFC',
        color: done ? '#047857' : T.text2,
        fontSize: '.74rem',
        fontWeight: 800,
      }}>
        {value}
      </div>
    </div>
    <div>
      <div style={{ fontSize: '.98rem', fontWeight: 800, color: T.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '.84rem', color: T.text2, lineHeight: 1.6 }}>{text}</div>
    </div>
  </div>
);

const AlertCard = ({ icon, title, text, to, cta, tone = {} }) => (
  <div style={{
    background: '#fff',
    border: `1px solid ${tone.border || T.border}`,
    borderRadius: 18,
    padding: '1rem',
    boxShadow: '0 6px 18px rgba(28,43,62,.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    flexWrap: 'wrap',
  }}>
    <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 240 }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        background: tone.bg || T.primaryLight,
        color: tone.color || T.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
        flexShrink: 0,
      }}>
        <i className={icon} />
      </div>
      <div>
        <div style={{ fontSize: '.95rem', fontWeight: 800, color: T.text, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: '.84rem', color: T.text2, lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
    {to && cta ? (
      <Link
        to={to}
        style={{
          textDecoration: 'none',
          padding: '10px 14px',
          borderRadius: 12,
          border: `1px solid ${tone.border || T.border}`,
          background: '#fff',
          color: tone.color || T.primary,
          fontWeight: 800,
          fontSize: '.82rem',
          whiteSpace: 'nowrap',
        }}
      >
        {cta}
      </Link>
    ) : null}
  </div>
);

const RoleTag = ({ role }) => {
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

const EmptyPanel = ({ icon, title, text }) => (
  <div style={{
    padding: '3.2rem 1.4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: T.text2,
    gap: 12,
  }}>
    <div style={{
      width: 54,
      height: 54,
      borderRadius: 18,
      background: T.primaryLight,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: T.primary,
      fontSize: '1.3rem',
    }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '1rem', fontWeight: 800, color: T.text }}>{title}</div>
    <div style={{ fontSize: '.9rem', maxWidth: 380, lineHeight: 1.65 }}>{text}</div>
  </div>
);

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const userId = sessionStorage.getItem('userId');
  const userName = sessionStorage.getItem('userName') || 'Citizen';
  const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [properties, setProperties] = useState([]);
  const [buyerTransfers, setBuyerTransfers] = useState([]);
  const [sellerTransfers, setSellerTransfers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [sellerRequests, setSellerRequests] = useState([]);

  const headers = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);

  useEffect(() => {
    if (!authToken || !userId) {
      navigate('/login');
      return;
    }

    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, userId]);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const [propertiesRes, buyerRes, sellerRes, channelsRes, listingsRes, requestsRes] = await Promise.all([
        fetch(`${BASE}/api/properties/my-properties`, { headers }),
        fetch(`${BASE}/api/transfers/buyer-pending`, { headers }),
        fetch(`${BASE}/api/transfers/seller/${userId}/pending`, { headers }),
        fetch(`${BASE}/api/channels/my-channels?userId=${userId}`, { headers }),
        fetch(`${BASE}/api/marketplace/seller/listings`, { headers }),
        fetch(`${BASE}/api/marketplace/seller/requests`, { headers }),
      ]);

      const [propertiesData, buyerData, sellerData, channelsData, listingsData, requestsData] = await Promise.all([
        propertiesRes.json().catch(() => ({})),
        buyerRes.json().catch(() => ({})),
        sellerRes.json().catch(() => ({})),
        channelsRes.json().catch(() => ({})),
        listingsRes.json().catch(() => ({})),
        requestsRes.json().catch(() => ({})),
      ]);

      if (!propertiesRes.ok || propertiesData.success === false) {
        throw new Error(propertiesData.message || 'Unable to load properties');
      }

      setProperties(propertiesData.properties || []);
      setBuyerTransfers(buyerData.transfers || []);
      setSellerTransfers(sellerData.transfers || []);
      setChannels(channelsData.channels || []);
      setMarketplaceListings(listingsData.listings || []);
      setSellerRequests(requestsData.requests || []);
      setLastUpdated(new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError(err.message || 'Unable to load citizen dashboard');
    } finally {
      setLoading(false);
    }
  };

  const transfers = useMemo(() => {
    const map = new Map();
    [...sellerTransfers.map((item) => ({ ...item, _myRole: 'SELLER' })), ...buyerTransfers.map((item) => ({ ...item, _myRole: 'BUYER' }))]
      .forEach((item) => {
        if (!item?.transfer_id) return;
        if (!map.has(item.transfer_id)) {
          map.set(item.transfer_id, item);
        }
      });

    return [...map.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [buyerTransfers, sellerTransfers]);

  const stats = useMemo(() => {
    const liveChats = channels.filter((item) => LIVE_CHANNEL_STATUSES.has(String(item.channel_status || '').toUpperCase())).length;
    const listed = marketplaceListings.filter((item) => item.is_for_sale).length;
    const requests = sellerRequests.filter((item) => item.status === 'PENDING').length;
    const activeTransfers = transfers.filter((item) => !FINAL_TRANSFER_STATUSES.has(String(item.status || '').toUpperCase())).length;

    return {
      properties: properties.length,
      listed,
      requests,
      chats: liveChats,
      transfers: activeTransfers,
    };
  }, [channels, marketplaceListings, properties.length, sellerRequests, transfers]);

  const recentTransfers = transfers.slice(0, 4);
  const liveChannels = channels.filter((item) => LIVE_CHANNEL_STATUSES.has(String(item.channel_status || '').toUpperCase())).slice(0, 4);
  const recentProperties = properties.slice(0, 4);
  const workflowSteps = useMemo(() => {
    const listedCount = marketplaceListings.filter((item) => item.is_for_sale).length;
    const pendingRequests = sellerRequests.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length;
    const liveChatCount = channels.filter((item) => LIVE_CHANNEL_STATUSES.has(String(item.channel_status || '').toUpperCase())).length;
    const receiptPendingCount = transfers.filter((item) =>
      item._myRole === 'BUYER' &&
      (item.payment_status === 'PAID' || Boolean(item.challan_txn_id)) &&
      !item.agreement_screenshot_url &&
      Boolean(item.channel_id)
    ).length;
    const finalizedCount = transfers.filter((item) =>
      ['APPROVED', 'COMPLETED'].includes(String(item.status || '').toUpperCase())
    ).length;

    return [
      {
        step: 1,
        title: 'Approved Property Ready',
        text: 'Your approved ownership records appear here first and become available for sale or succession.',
        value: `${properties.length} record${properties.length === 1 ? '' : 's'}`,
        done: properties.length > 0,
      },
      {
        step: 2,
        title: 'Marketplace Listing',
        text: 'List direct-owned properties for sale so buyers can send requests from the marketplace.',
        value: `${listedCount} listed`,
        done: listedCount > 0,
      },
      {
        step: 3,
        title: 'Buyer Requests / Seller Inbox',
        text: 'Incoming requests appear in Seller Portal, where you accept or reject them for negotiation.',
        value: `${pendingRequests} waiting`,
        done: pendingRequests > 0,
      },
      {
        step: 4,
        title: 'Negotiation and Payment',
        text: 'Accepted requests move into encrypted chat, then challan payment and receipt submission continue from there.',
        value: `${liveChatCount + receiptPendingCount} active`,
        done: liveChatCount + receiptPendingCount > 0,
      },
      {
        step: 5,
        title: 'Voting and Final Ownership',
        text: 'After LRO voting and DC approval, finalized transfers and clean ownership updates become visible here.',
        value: `${finalizedCount} finalized`,
        done: finalizedCount > 0,
      },
    ];
  }, [channels, marketplaceListings, properties.length, sellerRequests, transfers]);

  const attentionItems = useMemo(() => {
    const items = [];
    const receiptPending = transfers.find((item) =>
      item._myRole === 'BUYER' &&
      (item.payment_status === 'PAID' || Boolean(item.challan_txn_id)) &&
      !item.agreement_screenshot_url &&
      Boolean(item.channel_id)
    );
    const pendingSellerRequest = sellerRequests.find((item) => String(item.status || '').toUpperCase() === 'PENDING');
    const liveChat = channels.find((item) => LIVE_CHANNEL_STATUSES.has(String(item.channel_status || '').toUpperCase()));

    if (receiptPending) {
      items.push({
        icon: 'fas fa-file-signature',
        title: 'Receipt still needs to go to LRO',
        text: `Transfer ${receiptPending.transfer_id} is paid, but the receipt upload step is still pending. Send it now so officer review can start.`,
        to: `/citizen/challan-payment?transferId=${receiptPending.transfer_id}&channelId=${receiptPending.channel_id}&role=${receiptPending._myRole}`,
        cta: 'Send Receipt to LRO',
        tone: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
      });
    }

    if (pendingSellerRequest) {
      items.push({
        icon: 'fas fa-inbox',
        title: 'Buyer request waiting in Seller Portal',
        text: `A buyer request is pending on ${pendingSellerRequest.property_id || 'your listed property'}. Accept it to open negotiation chat.`,
        to: '/citizen/seller',
        cta: 'Open Seller Portal',
        tone: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
      });
    }

    if (!items.length && liveChat) {
      items.push({
        icon: 'fas fa-comments',
        title: 'Live negotiation is active',
        text: `Channel ${liveChat.channel_id} already has activity. Open the chat to continue negotiation, receipt, or challan flow.`,
        to: `/citizen/negotiation?channelId=${liveChat.channel_id}&transferId=${liveChat.transfer_id || ''}`,
        cta: 'Open Chat',
        tone: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
      });
    }

    if (!items.length && properties.length && !marketplaceListings.some((item) => item.is_for_sale)) {
      items.push({
        icon: 'fas fa-store',
        title: 'Approved property is ready for listing',
        text: 'You already have approved ownership records. If you want to sell, list one property in Seller Portal to start the marketplace flow.',
        to: '/citizen/seller',
        cta: 'List Property',
        tone: { bg: '#F5EDFF', color: '#7C3AED', border: '#DDD6FE' },
      });
    }

    return items;
  }, [channels, marketplaceListings, properties.length, sellerRequests, transfers]);

  return (
    <CitizenLayout title="Dashboard">
      <PageHero
        eyebrow="Citizen Command Center"
        icon="fas fa-house-user"
        title={`Assalam-o-Alaikum, ${userName}`}
        subtitle="Approved properties, seller listings, buyer requests, live chats, and transfer progress are all visible here in one clean workspace."
        actions={(
          <button
            onClick={loadDashboard}
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
              fontSize: '.84rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`} />
            Refresh
          </button>
        )}
        stats={[
          { label: 'Approved Properties', value: stats.properties, icon: 'fas fa-home', bg: '#FFFFFF', border: '#D6E8E8', iconBg: '#E6F4F2', iconColor: '#0D7C7C' },
          { label: 'Listed on Market', value: stats.listed, icon: 'fas fa-store', bg: '#FFFFFF', border: '#DBEAFE', iconBg: '#EFF6FF', iconColor: '#1D4ED8' },
          { label: 'Buyer Requests', value: stats.requests, icon: 'fas fa-inbox', bg: '#FFFFFF', border: '#D1FAE5', iconBg: '#ECFDF5', iconColor: '#059669' },
          { label: lastUpdated ? `Updated ${lastUpdated}` : 'Live Chats', value: stats.chats, icon: 'fas fa-comments', bg: '#FFFFFF', border: '#FDE68A', iconBg: '#FFFBEB', iconColor: '#D97706' },
        ]}
      />

      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          borderRadius: 18,
          padding: '14px 16px',
          marginBottom: 18,
          fontSize: '.9rem',
          lineHeight: 1.65,
        }}>
          <strong>Dashboard error:</strong> {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 18,
      }}>
        <ActionCard
          to="/citizen/my-properties"
          icon="fas fa-folder-open"
          title="My Properties"
          text="Approved land records aur ownership details clearly dekhne ke liye."
          tone={{ background: '#E6F4F2', color: '#0D7C7C' }}
        />
        <ActionCard
          to="/citizen/marketplace"
          icon="fas fa-store"
          title="Marketplace"
          text="Market mein listed properties browse karein aur buy request bhejein."
          tone={{ background: '#EFF6FF', color: '#1D4ED8' }}
        />
        <ActionCard
          to="/citizen/transfers"
          icon="fas fa-comments-dollar"
          title="Transfer Inbox"
          text="Accepted requests, negotiation chats, challan, aur receipts ek jagah."
          tone={{ background: '#FFFBEB', color: '#D97706' }}
        />
        <ActionCard
          to="/citizen/seller"
          icon="fas fa-hand-holding-usd"
          title="Seller Portal"
          text="Apni direct-owned properties list karein aur incoming buyer requests manage karein."
          tone={{ background: '#F5EDFF', color: '#7C3AED' }}
        />
      </div>

      <section style={{ ...styles.section, marginBottom: 18 }}>
        <div style={styles.sectionHead}>
          <div>
            <div style={styles.sectionEyebrow}>Workflow Tracker</div>
            <h2 style={styles.sectionTitle}>Citizen Transfer Journey</h2>
          </div>
          <span style={{ color: T.text2, fontSize: '.82rem', fontWeight: 700 }}>Live snapshot of your current stage</span>
        </div>

        <div style={{
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}>
          {workflowSteps.map((item) => (
            <TrackerStep key={item.step} {...item} />
          ))}
        </div>
      </section>

      <section style={{ ...styles.section, marginBottom: 18 }}>
        <div style={styles.sectionHead}>
          <div>
            <div style={styles.sectionEyebrow}>Attention Needed</div>
            <h2 style={styles.sectionTitle}>Next Best Actions</h2>
          </div>
          <span style={{ color: T.text2, fontSize: '.82rem', fontWeight: 700 }}>This section keeps the workflow moving after logout/login too.</span>
        </div>

        <div style={{ padding: '1rem', display: 'grid', gap: 12 }}>
          {attentionItems.length ? attentionItems.map((item) => (
            <AlertCard key={item.title} {...item} />
          )) : (
            <EmptyPanel icon="fas fa-check-circle" title="No immediate action pending" text="Your current citizen tasks are clear right now. New buyer requests, chats, and receipt steps will appear here automatically." />
          )}
        </div>
      </section>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, .95fr)',
        gap: 18,
        marginBottom: 18,
      }}>
        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.sectionEyebrow}>Transfer Activity</div>
              <h2 style={styles.sectionTitle}>Recent Transfers</h2>
            </div>
            <Link to="/citizen/transfers" style={styles.sectionLink}>View all</Link>
          </div>

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <EmptyPanel icon="fas fa-spinner fa-spin" title="Loading transfers" text="Pulling the latest transfer progress, challan status, and negotiation activity." />
            ) : recentTransfers.length === 0 ? (
              <EmptyPanel icon="fas fa-inbox" title="No transfer activity yet" text="Accepted requests and active property transfer cases will appear here." />
            ) : (
              recentTransfers.map((transfer) => {
                const canOpenChat = Boolean(transfer.channel_id) && !['INACTIVE', 'CLOSED'].includes(String(transfer.channel_status || '').toUpperCase());
                const isPaid = transfer.payment_status === 'PAID' || Boolean(transfer.challan_txn_id);
                const needsLroReceipt = transfer._myRole === 'BUYER' && isPaid && !transfer.agreement_screenshot_url && Boolean(transfer.channel_id);
                const location = [transfer.district, transfer.tehsil, transfer.mauza].filter(Boolean).join(', ');
                const amount = Number(transfer.total_amount || transfer.agreed_price || transfer.transfer_amount || 0);

                return (
                  <div key={transfer.transfer_id} style={{
                    background: '#F8FAFC',
                    border: `1px solid ${T.border}`,
                    borderRadius: 18,
                    padding: '1rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <RoleTag role={transfer._myRole} />
                          <StatusPill status={transfer.status} />
                          {transfer.channel_status && <StatusPill status={transfer.channel_status} />}
                        </div>
                        <div style={{ fontSize: '1.02rem', fontWeight: 800, color: T.text }}>{transfer.property_id || transfer.transfer_id}</div>
                        <div style={{ fontSize: '.84rem', color: T.text2, marginTop: 4 }}>{location || 'Location pending'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted }}>Amount</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: T.primary, marginTop: 4 }}>PKR {fmt(amount)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: '.76rem', color: T.text2 }}>
                      <span><strong>Transfer:</strong> {transfer.transfer_id}</span>
                      {transfer.created_at && <span><strong>Created:</strong> {fmtDateTime(transfer.created_at)}</span>}
                      {transfer.challan_txn_id && <span><strong>Receipt:</strong> Ready</span>}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      {canOpenChat && (
                        <button
                          onClick={() => navigate(`/citizen/negotiation?channelId=${transfer.channel_id}&transferId=${transfer.transfer_id}`)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg,#27445F,#4E78A5)',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          <i className="fas fa-comments" style={{ marginRight: 8 }} />
                          {isPaid ? 'Open Chat History' : 'Open Negotiation'}
                        </button>
                      )}
                      {isPaid && (
                        <Link
                          to="/citizen/transfers"
                          style={{
                            textDecoration: 'none',
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: `1px solid ${T.border}`,
                            background: '#fff',
                            color: T.text2,
                            fontWeight: 800,
                          }}
                        >
                          <i className="fas fa-file-download" style={{ marginRight: 8 }} />
                          View Receipt
                        </Link>
                      )}
                      {needsLroReceipt && (
                        <button
                          onClick={() => navigate(`/citizen/challan-payment?transferId=${transfer.transfer_id}&channelId=${transfer.channel_id}&role=${transfer._myRole}`)}
                          style={{
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.sectionEyebrow}>Negotiation Room</div>
              <h2 style={styles.sectionTitle}>Live Chats</h2>
            </div>
            <Link to="/citizen/transfers" style={styles.sectionLink}>Open inbox</Link>
          </div>

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <EmptyPanel icon="fas fa-spinner fa-spin" title="Loading live chats" text="Checking active buyer and seller negotiation channels." />
            ) : liveChannels.length === 0 ? (
              <EmptyPanel icon="fas fa-comments" title="No active chat yet" text="Once a seller accepts a request, the transfer chat will appear here." />
            ) : (
              liveChannels.map((channel) => (
                <div key={channel.channel_id} style={{
                  background: '#F8FAFC',
                  border: `1px solid ${T.border}`,
                  borderRadius: 18,
                  padding: '1rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: T.text }}>{channel.property_id || 'Property Channel'}</div>
                      <div style={{ fontSize: '.84rem', color: T.text2, marginTop: 4 }}>
                        {[channel.district, channel.tehsil, channel.mauza].filter(Boolean).join(', ') || channel.property_location || 'Location pending'}
                      </div>
                    </div>
                    <StatusPill status={channel.channel_status} />
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: '.76rem', color: T.text2 }}>
                    {channel.transfer_id && <span><strong>Transfer:</strong> {channel.transfer_id}</span>}
                    <span><strong>Unread:</strong> {channel.unread_count || 0}</span>
                    {channel.last_message_at && <span><strong>Last activity:</strong> {fmtDateTime(channel.last_message_at)}</span>}
                  </div>

                  <button
                    onClick={() => navigate(`/citizen/negotiation?channelId=${channel.channel_id}&transferId=${channel.transfer_id || ''}`)}
                    style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: '#0D7C7C',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fas fa-comments" style={{ marginRight: 8 }} />
                    Open Chat
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <div>
            <div style={styles.sectionEyebrow}>Ownership</div>
            <h2 style={styles.sectionTitle}>Recent Approved Properties</h2>
          </div>
          <Link to="/citizen/my-properties" style={styles.sectionLink}>View all</Link>
        </div>

        <div style={{
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyPanel icon="fas fa-spinner fa-spin" title="Loading properties" text="Refreshing approved ownership records for your dashboard." />
            </div>
          ) : recentProperties.length === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyPanel icon="fas fa-home" title="No approved properties yet" text="Approved direct-owned properties will appear here once they are finalized." />
            </div>
          ) : (
            recentProperties.map((property) => (
              <div key={property.property_id} style={{
                background: '#F8FAFC',
                border: `1px solid ${T.border}`,
                borderRadius: 18,
                padding: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    background: T.primaryLight,
                    color: T.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                  }}>
                    <i className="fas fa-home" />
                  </div>
                  <StatusPill status={property.status} />
                </div>
                <div style={{ fontSize: '.98rem', fontWeight: 800, color: T.text, wordBreak: 'break-word' }}>{property.property_id}</div>
                <div style={{ fontSize: '.84rem', color: T.text2, marginTop: 8, lineHeight: 1.6 }}>
                  {[property.district, property.tehsil, property.mauza].filter(Boolean).join(', ') || 'Location pending'}
                </div>
                <div style={{ fontSize: '.82rem', color: T.text2, marginTop: 12, lineHeight: 1.7 }}>
                  <div><strong>Area:</strong> {property.area_marla ? `${property.area_marla} Marla` : '—'}</div>
                  <div><strong>Khasra:</strong> {property.khasra_no || '—'}</div>
                  <div><strong>Type:</strong> {property.property_type || '—'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </CitizenLayout>
  );
};

export default CitizenDashboard;
