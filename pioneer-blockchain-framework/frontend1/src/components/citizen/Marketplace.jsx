import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout, { T, fmt, fmtDateTime } from './CitizenLayout';

/* ─── Constants ──────────────────────────────────────────── */
const REQUEST_STATES = {
  PENDING:  { label: 'Request Pending',  bg: '#FEF3C7', color: '#92400E', icon: 'fa-clock'        },
  ACCEPTED: { label: 'Accepted',         bg: '#D1FAE5', color: '#065F46', icon: 'fa-check-circle'  },
  REJECTED: { label: 'Declined',         bg: '#FEE2E2', color: '#991B1B', icon: 'fa-times-circle'  },
};

/* ─── Utility ────────────────────────────────────────────── */
const pill = (bg, color, icon, label) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 100,
    background: bg, color,
    fontSize: '.72rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
  }}>
    {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
    {label}
  </span>
);

/* ─── Request Modal ──────────────────────────────────────── */
const RequestModal = ({ property, loading, onConfirm, onClose }) => {
  const [message, setMessage] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 500,
        borderRadius: 24,
        border: `1px solid ${T.border}`,
        background: '#fff',
        boxShadow: '0 32px 72px rgba(15,23,42,0.22)',
        padding: '28px 28px 24px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 16,
            background: T.primaryLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.primary, fontSize: '1.1rem', flexShrink: 0,
          }}>
            <i className="fas fa-paper-plane" aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: T.text, fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif" }}>
              Send Buy Request
            </div>
            <div style={{ fontSize: '.82rem', color: T.text2, marginTop: 3 }}>
              {[property.district, property.tehsil].filter(Boolean).join(' · ')}
              {property.area_marla ? ` · ${property.area_marla} Marla` : ''}
            </div>
          </div>
        </div>

        {/* Info banners */}
        <div style={{ borderRadius: 12, border: '1px solid #bfdbfe', background: '#eff6ff', padding: '10px 14px', fontSize: '.83rem', lineHeight: 1.65, color: '#1d4ed8', marginBottom: 10 }}>
          <i className="fas fa-info-circle" aria-hidden="true" style={{ marginRight: 7 }} />
          The seller will see your <strong>full name</strong> and <strong>CNIC</strong> before accepting.
        </div>
        <div style={{ borderRadius: 12, border: '1px solid #fde68a', background: '#fffbeb', padding: '10px 14px', fontSize: '.83rem', lineHeight: 1.65, color: '#78350f', marginBottom: 20, fontWeight: 600 }}>
          <i className="fas fa-tag" aria-hidden="true" style={{ marginRight: 7 }} />
          Asking Price: <strong>{property.asking_price ? `PKR ${fmt(property.asking_price)}` : 'Not specified'}</strong>
          &nbsp;— final amount can still be settled in chat.
        </div>

        {/* Message textarea */}
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: T.text, marginBottom: 7 }}>
            Message to Seller <span style={{ color: T.muted, fontWeight: 400 }}>(optional)</span>
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="e.g. I am serious about this purchase and can proceed quickly."
            style={{
              width: '100%', resize: 'vertical', borderRadius: 12,
              border: `1.5px solid ${T.border}`, background: T.bg,
              padding: '11px 13px', fontFamily: 'inherit', fontSize: '.9rem',
              color: T.text, outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
            }}
          />
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose} disabled={loading}
            style={{
              padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${T.border}`,
              background: '#fff', color: T.text2, fontWeight: 600, fontSize: '.88rem',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(message)} disabled={loading}
            style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: T.primary, color: '#fff', fontWeight: 700, fontSize: '.88rem',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 7, opacity: loading ? 0.7 : 1,
            }}
          >
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
            {loading ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Stat Cell ──────────────────────────────────────────── */
const StatCell = ({ icon, label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <i className={`fas ${icon}`} aria-hidden="true" style={{ color: T.muted, fontSize: '.75rem', width: 12 }} />
      <span style={{ fontSize: '.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </span>
    </div>
    <span style={{ fontSize: '.92rem', fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{value}</span>
  </div>
);

/* ─── Listing Card ───────────────────────────────────────── */
const ListingCard = ({ listing, busy, onRequest }) => {
  const requestState = REQUEST_STATES[listing.my_request_status] || null;
  const location = [listing.district, listing.tehsil].filter(Boolean).join(', ') || 'Property Listing';
  const fullLocation = [listing.mauza, listing.tehsil, listing.district].filter(Boolean).join(', ') || '—';
  const typeLabel = listing.property_type
    ? listing.property_type.charAt(0).toUpperCase() + listing.property_type.slice(1).toLowerCase()
    : 'Property';

  /* accent colour depends on state */
  const accentColor = listing.is_own
    ? T.muted
    : requestState?.color ?? T.primary;

  return (
    <article style={{
      background: '#fff',
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      boxShadow: '0 4px 18px rgba(28,43,62,0.07)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(28,43,62,0.13)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(28,43,62,0.07)'; }}
    >
      {/* Top accent bar */}
      <div style={{ height: 4, background: accentColor, flexShrink: 0 }} />

      {/* Card body */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

        {/* Identity row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: T.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.primary, fontSize: '1rem', flexShrink: 0,
            }}>
              <i className="fas fa-home" aria-hidden="true" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                {typeLabel}
              </p>
              <h3 style={{ margin: '3px 0 0', fontSize: '1rem', fontWeight: 700, color: T.text, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {location}
              </h3>
              {listing.mauza && (
                <p style={{ margin: '3px 0 0', fontSize: '.82rem', color: T.text2 }}>{listing.mauza}</p>
              )}
            </div>
          </div>
          {requestState && pill(requestState.bg, requestState.color, requestState.icon, requestState.label)}
          {listing.is_own && pill('#F1F5F9', '#64748B', 'fa-user', 'Your Listing')}
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px 16px',
          padding: '14px 16px',
          background: T.bg,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
        }}>
          <StatCell icon="fa-map-marker-alt" label="Location" value={fullLocation} />
          <StatCell icon="fa-ruler-combined"  label="Area"     value={listing.area_marla ? `${listing.area_marla} Marla` : '—'} />
          <StatCell icon="fa-user"            label="Owner"    value={listing.owner_name || '—'} />
          <StatCell icon="fa-calendar"        label="Listed"   value={listing.listed_at ? fmtDateTime(listing.listed_at) : '—'} />
        </div>

        {/* Price band */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: listing.asking_price ? T.primaryLight : T.bg,
          borderRadius: 12,
          border: `1px solid ${listing.asking_price ? '#c3d9f0' : T.border}`,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '.72rem', fontWeight: 700, color: T.text2, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Asking Price
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '.8rem', color: T.muted, lineHeight: 1.4 }}>
              Final amount settled in chat
            </p>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: listing.asking_price ? T.primaryDark : T.muted, letterSpacing: '-.01em' }}>
            {listing.asking_price ? `PKR ${fmt(listing.asking_price)}` : 'Negotiable'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 20px',
        borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#FAFBFC',
        gap: 10,
      }}>
        {listing.is_own ? (
          <span style={{ fontSize: '.83rem', color: T.muted, fontWeight: 600 }}>Your listed property</span>
        ) : !listing.my_request_status ? (
          <button
            onClick={() => onRequest(listing)}
            disabled={busy === listing.property_id}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: T.primary, color: '#fff',
              fontSize: '.85rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', opacity: busy === listing.property_id ? 0.7 : 1,
              transition: 'background 0.15s',
            }}
          >
            <i className={`fas ${busy === listing.property_id ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
            {busy === listing.property_id ? 'Sending…' : 'Send Buy Request'}
          </button>
        ) : listing.my_request_status === 'PENDING' ? (
          <span style={{ fontSize: '.83rem', color: '#92400E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-clock" aria-hidden="true" /> Awaiting seller response
          </span>
        ) : listing.my_request_status === 'ACCEPTED' ? (
          <span style={{ fontSize: '.83rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-check-circle" aria-hidden="true" /> Accepted — check My Transfers
          </span>
        ) : (
          <span style={{ fontSize: '.83rem', color: '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-times-circle" aria-hidden="true" /> Seller declined this request
          </span>
        )}

        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.76rem', color: '#16a34a', fontWeight: 700 }}>
          <i className="fas fa-shield-alt" aria-hidden="true" />
          PLRA Verified
        </span>
      </div>
    </article>
  );
};

/* ─── Main Component ─────────────────────────────────────── */
const PropertyMarketplace = () => {
  const navigate    = useNavigate();
  const authToken   = sessionStorage.getItem('authToken');
  const userId      = sessionStorage.getItem('userId');
  const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [locations, setLocations] = useState([]);
  const [district, setDistrict] = useState('');
  const [tehsil,   setTehsil]   = useState('');
  const [search,   setSearch]   = useState('');
  const [busy,     setBusy]     = useState(null);
  const [modal,    setModal]    = useState(null);
  const [toast,    setToast]    = useState(null);

  const socketRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const api = useCallback((path, options = {}) => (
    fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
  ), [BASE, authToken]);

  const loadLocations = async () => {
    try {
      const res = await api('/api/marketplace/districts');
      const data = await res.json();
      if (data.success) setLocations(data.locations || []);
    } catch { /* silent */ }
  };

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (district) qs.set('district', district);
      if (tehsil)   qs.set('tehsil',   tehsil);
      if (search)   qs.set('search',   search);
      const res = await api(`/api/marketplace/listings?${qs}`);
      const data = await res.json();
      if (data.success) setListings(data.listings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, district, tehsil, search]);

  useEffect(() => {
    if (!authToken) { navigate('/login'); return; }
    loadLocations();
    import('socket.io-client').then(({ io }) => {
      const socket = io(BASE, { auth: { token: authToken } });
      socketRef.current = socket;
      socket.on('connect', () => socket.emit('join_user_room', { userId }));
      socket.on('buy_request_accepted', ({ propertyId }) => {
        setListings(prev => prev.map(l => l.property_id === propertyId ? { ...l, my_request_status: 'ACCEPTED' } : l));
        showToast('Your buy request was accepted. Open My Transfers to continue.', 'success');
      });
      socket.on('buy_request_rejected', ({ propertyId }) => {
        setListings(prev => prev.map(l => l.property_id === propertyId ? { ...l, my_request_status: 'REJECTED' } : l));
        showToast('Your buy request was declined by the seller.', 'error');
      });
    }).catch(() => {});
    return () => socketRef.current?.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadListings(); }, [district, tehsil]); // eslint-disable-line

  const handleSearch = (e) => { e.preventDefault(); loadListings(); };
  const clearSearch  = () => { setSearch(''); setTimeout(loadListings, 0); };

  const sendRequest = async (message) => {
    if (!modal) return;
    const propertyId = modal.property_id;
    setBusy(propertyId);
    setModal(null);
    try {
      const res = await api('/api/marketplace/request', {
        method: 'POST',
        body: JSON.stringify({ propertyId, message: message?.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Buy request sent. The seller has been notified.', 'success');
        setListings(prev => prev.map(l => l.property_id === propertyId ? { ...l, my_request_status: 'PENDING' } : l));
      } else {
        showToast(data.error || 'Failed to send request', 'error');
      }
    } catch {
      showToast('Network error — please try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const districts = [...new Set(locations.map(l => l.district).filter(Boolean))].sort();
  const tehsils   = [...new Set(
    locations.filter(l => !district || l.district === district).map(l => l.tehsil).filter(Boolean)
  )].sort();

  const pendingCount  = listings.filter(l => l.my_request_status === 'PENDING').length;
  const acceptedCount = listings.filter(l => l.my_request_status === 'ACCEPTED').length;

  /* Shared select / input styles */
  const selectStyle = {
    padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`,
    background: '#fff', color: T.text, fontSize: '.88rem', fontFamily: 'inherit',
    cursor: 'pointer', outline: 'none', minWidth: 140,
  };

  return (
    <CitizenLayout title="Property Marketplace">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 22, zIndex: 9999, maxWidth: 360,
          borderRadius: 14,
          border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#86efac'}`,
          background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color: toast.type === 'error' ? '#991b1b' : '#14532d',
          boxShadow: '0 16px 36px rgba(15,23,42,0.14)',
          padding: '13px 16px',
          display: 'flex', gap: 9, alignItems: 'flex-start',
          fontSize: '.86rem', fontWeight: 600, lineHeight: 1.5,
        }}>
          <i className={`fas fa-${toast.type === 'error' ? 'circle-exclamation' : 'circle-check'}`} aria-hidden="true" style={{ marginTop: 1 }} />
          {toast.msg}
        </div>
      )}

      {/* ── Request modal ── */}
      {modal && (
        <RequestModal
          property={modal}
          loading={busy === modal.property_id}
          onConfirm={sendRequest}
          onClose={() => setModal(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Page header ── */}
        <div style={{
          background: '#fff',
          borderRadius: 18,
          border: `1px solid ${T.border}`,
          boxShadow: '0 4px 18px rgba(28,43,62,0.06)',
          padding: '24px 28px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: T.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.primary, fontSize: '1.25rem', flexShrink: 0,
              }}>
                <i className="fas fa-store" aria-hidden="true" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                  Citizen Marketplace
                </p>
                <h1 style={{ margin: '4px 0 0', fontSize: '1.55rem', fontWeight: 800, color: T.text, lineHeight: 1.1, letterSpacing: '-.02em' }}>
                  Property Marketplace
                </h1>
                <p style={{ margin: '6px 0 0', fontSize: '.88rem', color: T.text2, lineHeight: 1.55, maxWidth: 520 }}>
                  Browse verified PLRA listings, compare asking prices, and send buy requests directly to sellers.
                </p>
              </div>
            </div>

            {/* Chips + refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!loading && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 100, background: T.primaryLight, color: T.primary, fontSize: '.78rem', fontWeight: 700 }}>
                  <i className="fas fa-store" aria-hidden="true" />
                  {listings.length} Listing{listings.length !== 1 && 's'}
                </span>
              )}
              {pendingCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 100, background: '#FEF3C7', color: '#92400E', fontSize: '.78rem', fontWeight: 700 }}>
                  <i className="fas fa-clock" aria-hidden="true" />
                  {pendingCount} Pending
                </span>
              )}
              {acceptedCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 100, background: '#D1FAE5', color: '#065F46', fontSize: '.78rem', fontWeight: 700 }}>
                  <i className="fas fa-check-circle" aria-hidden="true" />
                  {acceptedCount} Accepted
                </span>
              )}
              <button
                onClick={loadListings}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  border: `1.5px solid ${T.border}`, background: '#fff',
                  color: T.text2, fontSize: '.85rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <i className="fas fa-sync-alt" aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Search & filter bar ── */}
          <form
            onSubmit={handleSearch}
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
          >
            {/* Search input */}
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 220 }}>
              <i className="fas fa-search" aria-hidden="true" style={{
                position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                color: T.muted, fontSize: '.85rem', pointerEvents: 'none',
              }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search district, tehsil, mauza, owner…"
                style={{
                  width: '100%', padding: '9px 36px 9px 36px',
                  borderRadius: 10, border: `1.5px solid ${T.border}`,
                  background: '#fff', color: T.text, fontSize: '.88rem',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {search && (
                <button
                  type="button" onClick={clearSearch}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 2,
                  }}
                  aria-label="Clear search"
                >
                  <i className="fas fa-times" aria-hidden="true" />
                </button>
              )}
            </div>

            <select
              value={district}
              onChange={(e) => { setDistrict(e.target.value); setTehsil(''); }}
              style={selectStyle}
            >
              <option value="">All Districts</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select
              value={tehsil}
              onChange={(e) => setTehsil(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Tehsils</option>
              {tehsils.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <button
              type="submit"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 20px', borderRadius: 10, border: 'none',
                background: T.primary, color: '#fff',
                fontSize: '.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <i className="fas fa-filter" aria-hidden="true" />
              Apply
            </button>
          </form>
        </div>

        {/* ── Info strip ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '11px 16px', borderRadius: 12,
          background: '#eff6ff', border: '1px solid #bfdbfe',
          color: '#1d4ed8', fontSize: '.83rem', lineHeight: 1.6,
        }}>
          <i className="fas fa-circle-info" aria-hidden="true" style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Properties listed here belong to registered PLRA owners. The seller sees your name and CNIC before accepting,
            and each card shows the seller&apos;s asking price upfront.
          </span>
        </div>

        {/* ── Content area ── */}
        {loading ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '72px 24px', gap: 14, background: '#fff', borderRadius: 18, border: `1px solid ${T.border}`,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, background: T.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.primary, fontSize: '1.4rem',
            }}>
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: T.text }}>Loading Marketplace</h3>
            <p style={{ margin: 0, color: T.text2, fontSize: '.92rem', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
              Pulling the latest property listings, seller details, and request state.
            </p>
          </div>
        ) : listings.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '72px 24px', gap: 14, background: '#fff', borderRadius: 18, border: `1px solid ${T.border}`,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, background: T.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.primary, fontSize: '1.4rem',
            }}>
              <i className="fas fa-store-slash" aria-hidden="true" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: T.text }}>No Properties Found</h3>
            <p style={{ margin: 0, color: T.text2, fontSize: '.92rem', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
              {district || tehsil || search
                ? 'No properties match your filters. Try clearing the search or changing the district/tehsil.'
                : 'No properties are currently listed for sale. Check back later.'}
            </p>
            {(district || tehsil || search) && (
              <button
                onClick={() => { setDistrict(''); setTehsil(''); setSearch(''); setTimeout(loadListings, 0); }}
                style={{
                  marginTop: 6, display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${T.border}`,
                  background: '#fff', color: T.text2, fontSize: '.88rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <i className="fas fa-rotate-left" aria-hidden="true" />
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
          }}>
            {listings.map(listing => (
              <ListingCard
                key={listing.property_id}
                listing={listing}
                busy={busy}
                onRequest={(item) => setModal(item)}
              />
            ))}
          </div>
        )}
      </div>
    </CitizenLayout>
  );
};

export default PropertyMarketplace;