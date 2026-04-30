import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../auth/Auth.css';
import DC_NAV_LINKS from './dcNavLinks';

/* ── Design tokens (same palette as OfficerLayout) ─────────── */
export const T = {
  primary:     '#0047AB',
  primaryDark: '#003080',
  success:     '#059669',
  warning:     '#D97706',
  danger:      '#DC2626',
  text:        '#111827',
  text2:       '#5C6878',
  muted:       '#9BA8B5',
  border:      '#c8ddf7',
};

export const S = {
  md: '0 4px 16px rgba(0,0,0,.08), 0 2px 8px rgba(0,0,0,.04)',
};

export const fmtDateTime = (val) => {
  if (!val) return 'N/A';
  try {
    return new Date(val).toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(val);
  }
};

/* ── DC Layout Shell ────────────────────────────────────────── */
const DCLayout = ({ children, title }) => {
  const location = useLocation();
  const navigate  = useNavigate();

  const userName = sessionStorage.getItem('userName') || 'Deputy Commissioner';

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="auth-page" style={{ minHeight: '100vh' }}>

      {/* ── Top Nav ──────────────────────────────────────────── */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        height: 60,
        background: 'rgba(0,0,0,.18)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,.10)',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <Link to="/dc/dashboard" className="auth-brand" style={{ textDecoration: 'none' }}>
          <div className="auth-brand-icon">
            <i className="fas fa-landmark" />
          </div>
          <div className="auth-brand-text">
             Land Records
            <span className="auth-brand-sub">Punjab Land Registry System</span>
          </div>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="auth-nav-badge">
            <i className="fas fa-user-tie" />&nbsp; DC
          </span>
          <span style={{ color: 'rgba(255,255,255,.75)', fontSize: '.82rem', fontFamily: "'Roboto Condensed', sans-serif" }}>
            {userName}
          </span>
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,.12)',
              border: '1px solid rgba(255,255,255,.2)',
              color: 'rgba(255,255,255,.85)',
              padding: '6px 14px',
              borderRadius: 8,
              fontFamily: "'Roboto Condensed', sans-serif",
              fontSize: '.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '.3px',
              transition: 'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.12)'; }}
          >
            <i className="fas fa-sign-out-alt" /> Sign Out
          </button>
        </div>
      </nav>

      {/* ── Page Body ────────────────────────────────────────── */}
      <div
        className="auth-body"
        style={{ alignItems: 'flex-start', padding: '2rem 1.5rem 4rem' }}
      >
        {/* ── DC Card ──────────────────────────────────────────
            Slightly wider than Register's auth-card-wide (900px)
            so the blue gradient background is still visible.     */}
        <div
          className="auth-card"
          style={{ maxWidth: 1180, width: '100%' }}
        >
          {/* Card header: DC identity + nav tabs */}
          <div
            className="auth-card-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '1.35rem 2rem',
            }}
          >
            {/* Title block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: 42, height: 42,
                background: 'linear-gradient(135deg,#ffce12,#f8bd19)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0047AB', fontSize: '1.1rem',
                boxShadow: '0 4px 12px rgba(255,206,18,.35)',
                flexShrink: 0,
              }}>
                <i className="fas fa-balance-scale" />
              </div>
              <div>
                <div style={{
                  fontFamily: "'Changa One', serif",
                  fontSize: '1.2rem',
                  fontWeight: 400,
                  color: T.text,
                  letterSpacing: '.4px',
                  lineHeight: 1.2,
                }}>
                  {title}
                </div>
                <div style={{
                  fontFamily: "'Roboto Condensed', sans-serif",
                  fontSize: '.78rem',
                  color: T.text2,
                  marginTop: 2,
                }}>
                  Deputy Commissioner · Punjab Land Registry
                </div>
              </div>
            </div>

            {/* Nav tabs */}
            <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
              {DC_NAV_LINKS.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontFamily: "'Roboto Condensed', sans-serif",
                      fontSize: '.82rem',
                      fontWeight: isActive ? 700 : 600,
                      textDecoration: 'none',
                      letterSpacing: '.2px',
                      transition: 'all .18s',
                      background: isActive
                        ? 'linear-gradient(135deg,#ffce12,#f8bd19)'
                        : 'transparent',
                      color: isActive ? '#003080' : T.text2,
                      border: isActive
                        ? '1px solid #f8bd19'
                        : `1px solid ${T.border}`,
                      boxShadow: isActive
                        ? '0 3px 10px rgba(255,206,18,.28)'
                        : 'none',
                    }}
                  >
                    <i className={link.icon} style={{ fontSize: '.75rem' }} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Card body — dashboard content */}
          <div style={{ padding: '1.5rem 2rem 2rem' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DCLayout;