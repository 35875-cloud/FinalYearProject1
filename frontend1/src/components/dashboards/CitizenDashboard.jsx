import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout, { T } from '../citizen/CitizenLayout';

const FINAL_TRANSFER_STATUSES = new Set(['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
const LIVE_CHANNEL_STATUSES   = new Set(['ACTIVE', 'NEGOTIATING', 'AGREED', 'PAYMENT_DONE', 'PAYMENT_CONFIRMED']);

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const userId    = sessionStorage.getItem('userId');
  const BASE      = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [properties, setProperties] = useState([]);
  const [buyerTransfers,    setBuyerTransfers]    = useState([]);
  const [sellerTransfers,   setSellerTransfers]   = useState([]);
  const [channels,          setChannels]          = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [sellerRequests,    setSellerRequests]    = useState([]);

  const headers = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);

  useEffect(() => {
    if (!authToken || !userId) { navigate('/login'); return; }
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
    [...sellerTransfers.map((t) => ({ ...t, _myRole: 'SELLER' })), ...buyerTransfers.map((t) => ({ ...t, _myRole: 'BUYER' }))]
      .forEach((t) => { if (t?.transfer_id && !map.has(t.transfer_id)) map.set(t.transfer_id, t); });
    return [...map.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [buyerTransfers, sellerTransfers]);

  const stats = useMemo(() => {
    const liveChats = channels.filter((c) => LIVE_CHANNEL_STATUSES.has(String(c.channel_status || '').toUpperCase())).length;
    const listed    = marketplaceListings.filter((l) => l.is_for_sale).length;
    const requests  = sellerRequests.filter((r) => r.status === 'PENDING').length;
    const activeTransfers = transfers.filter((t) => !FINAL_TRANSFER_STATUSES.has(String(t.status || '').toUpperCase())).length;
    return { properties: properties.length, listed, requests, chats: liveChats, transfers: activeTransfers };
  }, [channels, marketplaceListings, properties.length, sellerRequests, transfers]);

  return (
    <CitizenLayout title="Dashboard">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        padding: '1.5rem',
      }}>
        {[
          { label: 'Approved Properties', value: stats.properties, icon: 'fas fa-home',    iconBg: '#E6F4F2', iconColor: '#0D7C7C', border: '#D6E8E8' },
          { label: 'Listed on Market',    value: stats.listed,     icon: 'fas fa-store',   iconBg: '#EFF6FF', iconColor: '#1D4ED8', border: '#DBEAFE' },
          { label: 'Buyer Requests',      value: stats.requests,   icon: 'fas fa-inbox',   iconBg: '#ECFDF5', iconColor: '#059669', border: '#D1FAE5' },
          { label: lastUpdated ? `Updated ${lastUpdated}` : 'Live Chats', value: stats.chats, icon: 'fas fa-comments', iconBg: '#FFFBEB', iconColor: '#D97706', border: '#FDE68A' },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: '#ffffff',
              border: `1px solid ${card.border}`,
              borderRadius: 22,
              padding: '1.35rem 1.4rem',
              boxShadow: '0 4px 18px rgba(0,71,171,.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: card.iconBg, color: card.iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem',
            }}>
              <i className={card.icon} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: T.text, lineHeight: 1 }}>
                {loading ? '—' : card.value}
              </div>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: T.muted, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {card.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          borderRadius: 18,
          padding: '14px 16px',
          margin: '0 1.5rem 1.5rem',
          fontSize: '.9rem',
          lineHeight: 1.65,
        }}>
          <strong>Dashboard error:</strong> {error}
        </div>
      )}
    </CitizenLayout>
  );
};

export default CitizenDashboard;