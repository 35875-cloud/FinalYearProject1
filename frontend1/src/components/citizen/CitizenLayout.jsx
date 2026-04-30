/**
 * CitizenLayout.jsx
 * ─────────────────────────────────────────────────────────────
 * Layout shell for all Citizen pages.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './CitizenLayout.css';
import { clearAuthSession, getStoredAuthValue } from '../../utils/authSession';

/* ─── Design Tokens ─ */
export const T = {
  primary: '#0047AB',
  primaryLight: '#dbeafe',
  primaryMid: '#155E75',
  primaryDark: '#003080',
  accent: '#ffce12',
  accentLight: '#fef9c3',
  seller: '#D97706',
  sellerLight: '#FFFBEB',
  buyer: '#0047AB',
  buyerLight: '#dbeafe',
  bg: '#f5f9ff',
  surface: '#FFFFFF',
  surface2: '#f0f5ff',
  border: '#c8ddf7',
  text: '#111827',
  text2: '#374151',
  muted: '#6B7280',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
};

export const S = {
  sm: '0 1px 3px rgba(0,71,171,.06)',
  md: '0 12px 28px rgba(0,71,171,.10)',
  lg: '0 24px 64px rgba(0,0,0,.28)',
  r: { sm: 6, md: 10, lg: 16, xl: 24 },
};

/* ─── StatusPill ─ */
export const StatusPill = ({ status, small }) => {
  const map = {
    PENDING: { bg: '#FEF3C7', color: '#92400E' },
    CHANNEL_ACTIVE: { bg: T.buyerLight, color: T.buyer },
    NEGOTIATING: { bg: T.buyerLight, color: T.buyer },
    ACTIVE: { bg: T.buyerLight, color: T.buyer },
    PAYMENT_PENDING: { bg: '#FEF3C7', color: '#92400E' },
    PAYMENT_UPLOADED: { bg: T.sellerLight, color: T.seller },
    AGREED: { bg: T.successBg, color: T.success },
    APPROVED: { bg: T.successBg, color: T.success },
    REJECTED: { bg: T.errorBg, color: T.error },
    CLOSED: { bg: '#F1F5F9', color: '#64748B' },
    SCREENSHOT_UPLOADED: { bg: T.sellerLight, color: T.seller },
    FROZEN: { bg: '#EFF6FF', color: '#1E40AF' },
    PENDING_APPROVAL: { bg: '#FEF3C7', color: '#92400E' },
  };
  const s = map[status] || { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span
      className="cit-pill"
      style={{
        background: s.bg,
        color: s.color,
        padding: small ? '1px 6px' : '2px 8px',
        fontSize: small ? '.6rem' : '.65rem',
      }}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

/* ─── Formatters ─ */
export const fmt = (n) => Number(n || 0).toLocaleString();
export const fmtCnic = (c) => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 13
    ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
    : (c || '--');
};
export const fmtDate = (s) => {
  if (!s) return '--';
  return new Date(s).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};
export const fmtDateTime = (s) => {
  if (!s) return '--';
  return new Date(s).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/* ─── PageHero ─ */
export const PageHero = ({
  eyebrow, icon, title, subtitle, actions, stats = [], children, color,
}) => {
  const bg = color || T.primary;
  const bgDark = color || T.primaryDark;
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${bgDark}, ${bg})`,
        borderRadius: S.r.xl,
        padding: '1.75rem 2rem',
        marginBottom: '1.75rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: S.md,
      }}
    >
      <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, border: '2px solid rgba(255,255,255,.08)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -30, right: 60, width: 100, height: 100, border: '2px solid rgba(255,255,255,.06)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', flex: '1 1 560px', minWidth: 0 }}>
            {icon && (
              <div style={{ width: 54, height: 54, background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.25)', borderRadius: S.r.md, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.35rem', flexShrink: 0 }}>
                <i className={icon} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {eyebrow && (
                <div style={{ fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: 'rgba(255,255,255,.72)', marginBottom: 6 }}>
                  {eyebrow}
                </div>
              )}
              {title && (
                <div style={{ fontFamily: "'Changa One',serif", fontWeight: 400, fontSize: '1.7rem', color: 'white', lineHeight: 1.15, letterSpacing: '.5px' }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize: '.94rem', color: 'rgba(255,255,255,.82)', marginTop: 6, lineHeight: 1.6, maxWidth: 740 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {(actions || children) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {actions}
              {children}
            </div>
          )}
        </div>

        {stats.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.value}`}
                style={{
                  background: stat.bg || 'rgba(255,255,255,.12)',
                  border: `1px solid ${stat.border || 'rgba(255,255,255,.18)'}`,
                  borderRadius: 18,
                  padding: '13px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backdropFilter: 'blur(6px)',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 14, background: stat.iconBg || 'rgba(255,255,255,.14)', color: stat.iconColor || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '.98rem' }}>
                  <i className={stat.icon} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: stat.valueColor || 'white', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: stat.labelColor || 'rgba(255,255,255,.72)', marginTop: 5 }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Navigation links ─ */
const NAV_LINKS = [
  { to: '/citizen/dashboard', icon: 'fas fa-th-large', label: 'Dashboard' },
  { to: '/citizen/my-properties', icon: 'fas fa-home', label: 'My Properties' },
  { to: '/citizen/ownership-history', icon: 'fas fa-history', label: 'Ownership History' },
  { to: '/citizen/succession', icon: 'fas fa-sitemap', label: 'Succession' },
  { to: '/citizen/marketplace', icon: 'fas fa-store', label: 'Marketplace' },
  { to: '/citizen/transfers', icon: 'fas fa-comments-dollar', label: 'Transfer Inbox' },
  { to: '/citizen/seller', icon: 'fas fa-hand-holding-usd', label: 'Seller Portal' },
];

/* ─── CitizenLayout ─ */
const CitizenLayout = ({ children, title, topbarActions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const authToken = getStoredAuthValue('authToken');
  const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth')
    .replace('/api/auth', '');

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const logout = () => { clearAuthSession(); navigate('/login'); };

  const openProfile = async () => {
    setProfileOpen(true);
    if (profileData) return;
    setProfileLoading(true);
    try {
      const r = await fetch(`${BASE}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await r.json();
      if (d.success && d.user) setProfileData(d.user);
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <>
      <div className="cit-shell">

        <div
          className={`cit-overlay${menuOpen ? ' is-open' : ''}`}
          onClick={() => setMenuOpen(false)}
        />

        <div className="cit-unified-card">

          {/* ── SIDEBAR ── */}
          <aside className={`cit-sidebar${menuOpen ? ' is-open' : ''}`}>

            {/* Brand */}
            <div className="cit-sidebar-brand">
              <div className="cit-sidebar-brand-icon">
                <i className="fas fa-landmark" />
              </div>
              <div>
                <div className="cit-sidebar-brand-name">Land Records</div>
              </div>
            </div>



            {/* Nav */}
            <nav className="cit-nav">
              <div className="cit-nav-label">Navigation</div>
              {NAV_LINKS.map((l) => {
                const active = location.pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    className={`cit-nav-link${active ? ' active' : ''}`}
                  >
                    <span className="cit-nav-link-icon">
                      <i className={l.icon} />
                    </span>
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="cit-sidebar-footer">
              <button className="cit-logout-btn" onClick={logout}>
                <i className="fas fa-sign-out-alt" /> Sign Out
              </button>
            </div>
          </aside>

          {/* ── MAIN ── */}
          <div className="cit-main">

            <div className="cit-topbar">
              <button
                className="cit-hamburger"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                <i className="fas fa-bars" />
              </button>

              {title && <div className="cit-topbar-title">{title}</div>}

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '.625rem' }}>
                {topbarActions}
                {location.pathname !== '/citizen/dashboard' && (
                  <Link to="/citizen/dashboard" className="cit-topbar-back">
                    <i className="fas fa-arrow-left" /> Back
                  </Link>
                )}
                <button
                  className="cit-profile-btn"
                  onClick={openProfile}
                  title="View Profile"
                  aria-label="View profile"
                >
                  <i className="fas fa-user" />
                </button>
              </div>
            </div>

            <div className="cit-content-card">
              <div className="cit-content-inner">
                {children}
              </div>
            </div>

          </div>{/* /cit-main */}

        </div>{/* /cit-unified-card */}
      </div>{/* /cit-shell */}

      {/* ── PROFILE DRAWER ── */}
      {profileOpen && (
        <div className="cit-profile-backdrop" onClick={() => setProfileOpen(false)} />
      )}
      <div className={`cit-profile-drawer${profileOpen ? '' : ' is-closed'}`}>

        <div className="cit-profile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
            <div className="cit-profile-avatar">
              <i className="fas fa-user" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="cit-profile-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profileData?.name || 'Citizen'}
              </div>
              <div className="cit-profile-badge">
                <i className="fas fa-check-circle" style={{ color: '#86EFAC' }} />
                Verified Citizen
              </div>
            </div>
          </div>
          <button
            className="cit-profile-close"
            onClick={() => setProfileOpen(false)}
            aria-label="Close profile"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="cit-profile-body">
          {profileLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: T.muted }}>
              <i className="fas fa-spinner fa-spin fa-2x" style={{ display: 'block', marginBottom: '.75rem', color: T.primary }} />
              Loading profile…
            </div>
          ) : !profileData ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: T.muted }}>
              <i className="fas fa-exclamation-circle fa-2x" style={{ display: 'block', marginBottom: '.75rem' }} />
              Could not load profile
            </div>
          ) : (
            <>
              {[
                { icon: 'fas fa-user', label: 'Full Name', value: profileData.name },
                { icon: 'fas fa-id-card', label: 'CNIC', value: fmtCnic(profileData.cnic) },
                { icon: 'fas fa-calendar-alt', label: 'Date of Birth', value: fmtDate(profileData.date_of_birth) },
                { icon: 'fas fa-envelope', label: 'Email', value: profileData.email },
                { icon: 'fas fa-phone', label: 'Mobile', value: profileData.mobile || 'Not provided' },
                { icon: 'fas fa-fingerprint', label: 'User ID', value: profileData.user_id },
                { icon: 'fas fa-calendar', label: 'Joined', value: fmtDate(profileData.created_at) },
              ].map((row) => (
                <div key={row.label} className="cit-profile-row">
                  <div className="cit-profile-row-icon">
                    <i className={row.icon} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cit-profile-row-label">{row.label}</div>
                    <div className="cit-profile-row-value">{row.value || '--'}</div>
                  </div>
                </div>
              ))}


            </>
          )}
        </div>

        <div className="cit-profile-footer">
          <button
            className="cit-btn-primary"
            onClick={() => { setProfileOpen(false); navigate('/citizen/profile'); }}
          >
            <i className="fas fa-edit" /> Edit Full Profile
          </button>
          <button className="cit-btn-ghost" onClick={() => setProfileOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default CitizenLayout;
