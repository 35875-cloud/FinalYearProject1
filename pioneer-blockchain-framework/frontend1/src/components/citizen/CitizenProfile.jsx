import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout, { PageHero, fmtCnic, fmtDateTime, fmtDate } from './CitizenLayout';

/* ─── helpers ─── */
const GY = '#9ca3af';   /* muted gray   */
const BK = '#111827';   /* near-black   */
const BD = '#e5e7eb';   /* border       */
const BG = '#f5f6f7';   /* page bg      */

/* ─── single info row ─── */
const InfoRow = ({ icon, label, value }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '14px 0', borderBottom: `1px solid ${BD}`,
  }}>
    <span style={{
      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
      background: BG, border: `1px solid ${BD}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#6b7280', fontSize: 13, marginTop: 1,
    }}>
      <i className={icon} aria-hidden="true" />
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.07em', color: GY, marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: BK,
        wordBreak: 'break-all', lineHeight: 1.45,
      }}>
        {value || '—'}
      </div>
    </div>
  </div>
);

/* ─── section card ─── */
const Card = ({ title, icon, children }) => (
  <div style={{
    background: '#fff', border: `1px solid ${BD}`,
    borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,.05)',
    marginBottom: 16,
  }}>
    {/* card header */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 20px', borderBottom: `1px solid ${BD}`,
      background: '#fafafa',
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8,
        background: BG, border: `1px solid ${BD}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#374151', fontSize: 12,
      }}>
        <i className={icon} aria-hidden="true" />
      </span>
      <span style={{
        fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        fontWeight: 700, fontSize: 13.5, color: BK,
      }}>
        {title}
      </span>
    </div>
    {/* card body */}
    <div style={{ padding: '0 20px' }}>
      {children}
    </div>
  </div>
);

/* ══════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════ */
const CitizenProfile = () => {
  const navigate  = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const BASE      = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!authToken) { navigate('/login'); return; }
    loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${BASE}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await r.json();
      if (d.success && d.user) setUser(d.user);
      else throw new Error(d.message || 'Could not load profile');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* initials */
  const initials = (user?.name || '')
    .trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <CitizenLayout title="My Profile">
      <PageHero
        eyebrow="Citizen Identity"
        icon="fas fa-id-card"
        title="My Profile"
        subtitle="Apni verified citizen information, contact details, aur account activity yahan review kar sakte hain."
        stats={[
          { label: 'Profile Status', value: user ? 'Active' : 'Loading', icon: 'fas fa-user-check', bg: '#ffffff', border: '#d1fae5', iconBg: '#ECFDF5', iconColor: '#059669' },
          { label: 'Member Since', value: user?.created_at ? fmtDate(user.created_at) : '—', icon: 'fas fa-calendar-plus', bg: '#ffffff', border: '#d6e8e8', iconBg: '#E6F4F2', iconColor: '#0D7C7C' },
        ]}
      />

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '5rem 0', color: GY }}>
          <i className="fas fa-spinner fa-spin"
            style={{ fontSize: 24, display: 'block', marginBottom: 12 }} />
          <span style={{ fontSize: 14 }}>Loading profile…</span>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <i className="fas fa-exclamation-circle" style={{ color: '#dc2626', fontSize: 16 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#b91c1c', fontSize: 13.5, marginBottom: 4 }}>
              Failed to load profile
            </div>
            <div style={{ fontSize: 12.5, color: '#9b1c1c' }}>{error}</div>
          </div>
          <button onClick={loadProfile}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid #fca5a5',
              background: '#fff', color: '#dc2626', fontWeight: 600,
              fontSize: 12.5, cursor: 'pointer',
            }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && user && (
        <div style={{ maxWidth: 680 }}>

          {/* ── Profile hero — neutral, no color ── */}
          <div style={{
            background: '#fff', border: `1px solid ${BD}`,
            borderRadius: 16, padding: '28px 24px',
            marginBottom: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
            {/* Avatar circle */}
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              background: BK, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, fontWeight: 700,
              fontFamily: "'DM Sans',sans-serif", letterSpacing: '.03em',
            }}>
              {initials || <i className="fas fa-user" style={{ fontSize: 26 }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
                fontWeight: 800, fontSize: 20, color: BK,
                marginBottom: 4, lineHeight: 1.2,
              }}>
                {user.name}
              </div>
              <div style={{
                fontSize: 13, color: GY, marginBottom: 10, fontWeight: 500,
              }}>
                {user.email}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 100, padding: '3px 12px',
                  fontSize: 11, fontWeight: 700, color: '#15803d',
                  textTransform: 'uppercase', letterSpacing: '.05em',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                  Active
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: BG, border: `1px solid ${BD}`,
                  borderRadius: 100, padding: '3px 12px',
                  fontSize: 11, fontWeight: 700, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '.05em',
                }}>
                  <i className="fas fa-user-check" style={{ fontSize: 9 }} />
                  {user.role || 'Citizen'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Personal Information ── */}
          <Card icon="fas fa-id-card" title="Personal Information">
            <InfoRow icon="fas fa-user"     label="Full Name"     value={user.name} />
            <InfoRow icon="fas fa-id-card"  label="CNIC Number"   value={fmtCnic(user.cnic)} />
            <InfoRow icon="fas fa-envelope" label="Email Address" value={user.email} />
            <InfoRow icon="fas fa-phone"    label="Mobile Number"
              value={user.mobile || 'Not provided'} />
          </Card>

          {/* ── Account Information ── */}
          <Card icon="fas fa-user-shield" title="Account Details">
            <InfoRow icon="fas fa-calendar-plus" label="Member Since"
              value={fmtDate(user.created_at)} />
            <InfoRow icon="fas fa-clock"         label="Last Login"
              value={fmtDateTime(user.last_login)} />
          </Card>

        </div>
      )}

    </CitizenLayout>
  );
};

export default CitizenProfile;
