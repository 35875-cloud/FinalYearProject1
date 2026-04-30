/**
 * OfficerLayout.jsx
 * ─────────────────────────────────────────────────────────────
 * Layout shell for all LRO / Officer pages.
 * Mirrors CitizenLayout structure — unified card, profile drawer,
 * responsive sidebar — using LROLayout.css design tokens.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './LROLayout.css';
import { clearAuthSession, getStoredAuthValue } from '../../utils/authSession';

/* ─── Design Tokens ────────────────────────────────────────────── */
export var T = {
  primary: '#667eea',
  primaryDark: '#0047AB',
  primaryMid: '#7c72ea',
  primaryLight: '#eef0fe',
  success: '#10b981', successBg: '#ecfdf5',
  danger: '#ef4444', dangerBg: '#fef2f2',
  warning: '#f59e0b', warningBg: '#fffbeb',
  blue: '#3b82f6', blueBg: '#dbeafe',
  orange: '#f97316', orangeBg: '#fff7ed',
  bg: '#f0f4ff',
  surface: '#ffffff',
  surface2: '#f8fafc',
  border: '#e2e8f0',
  text: '#1e293b',
  text2: '#475569',
  muted: '#94a3b8',
};

export var S = {
  sm: '0 1px 3px rgba(0,0,0,.07)',
  md: '0 4px 16px rgba(102,126,234,.09)',
  lg: '0 8px 32px rgba(102,126,234,.15)',
  r: { sm: 6, md: 10, lg: 16, xl: 22 },
};

/* ─── Formatters ───────────────────────────────────────────────── */
export function fmt(n) { return Number(n || 0).toLocaleString(); }

export function fmtCnic(c) {
  var d = String(c || '').replace(/\D/g, '');
  return d.length === 13
    ? d.slice(0, 5) + '-' + d.slice(5, 12) + '-' + d.slice(12)
    : (c || '--');
}

export function fmtDate(s) {
  if (!s) return '--';
  return new Date(s).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function fmtDateTime(s) {
  if (!s) return '--';
  return new Date(s).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ─── StatusBadge ──────────────────────────────────────────────── */
export function StatusBadge(props) {
  var label = props.label;
  var color = props.color || 'warning';
  var map = {
    warning: { bg: '#fffbeb', color: '#92400e' },
    success: { bg: '#ecfdf5', color: '#065f46' },
    danger: { bg: '#fef2f2', color: '#991b1b' },
    blue: { bg: '#dbeafe', color: '#1e40af' },
  };
  var s = map[color] || map.warning;
  return React.createElement(
    'span',
    { className: 'lro-pill', style: { background: s.bg, color: s.color } },
    label
  );
}

/* ─── Nav Links ────────────────────────────────────────────────── */
export var DEFAULT_LRO_NAV_LINKS = [
  { to: '/lro/dashboard', icon: 'fas fa-th-large', label: 'Dashboard' },
  { to: '/lro/pending-registrations', icon: 'fas fa-clipboard-list', label: 'Pending Registrations' },
  { to: '/lro/pending-transfers', icon: 'fas fa-exchange-alt', label: 'Pending Transfers' },
  { to: '/lro/blockchain', icon: 'fas fa-gavel', label: 'Registration Voting' },
  { to: '/lro/transfer-voting', icon: 'fas fa-link', label: 'Transfer Voting' },
  { to: '/lro/succession', icon: 'fas fa-users', label: 'Succession Cases' },
  { to: '/lro/citizen-history', icon: 'fas fa-address-card', label: 'Citizen History' },
  { to: '/lro/ownership-history', icon: 'fas fa-history', label: 'Ownership History' },
  { to: '/lro/integrity', icon: 'fas fa-shield-alt', label: 'Integrity' },
  { to: '/lro/rejected-registrations', icon: 'fas fa-times-circle', label: 'Rejected Registrations' },
  { to: '/lro/rejected-transfers', icon: 'fas fa-ban', label: 'Rejected Transfers' },
];

/* ═══════════════════════════════════════════════════════════════
   OfficerLayout
═══════════════════════════════════════════════════════════════ */
function OfficerLayout(props) {
  var children = props.children;
  var title = props.title;
  var roleLabel = props.roleLabel || 'LRO';
  var roleSubtitle = props.roleSubtitle || 'Land Record Officer';
  var navLinks = props.navLinks || DEFAULT_LRO_NAV_LINKS;
  var topBarActions = props.topBarActions || props.topbarActions || null;

  var navigate = useNavigate();
  var location = useLocation();
  var authToken = getStoredAuthValue('authToken');
  var userName = getStoredAuthValue('userName') || 'Officer';
  var BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth')
    .replace('/api/auth', '');

  var menuOpenState = useState(false);
  var menuOpen = menuOpenState[0];
  var setMenuOpen = menuOpenState[1];

  var profileOpenState = useState(false);
  var profileOpen = profileOpenState[0];
  var setProfileOpen = profileOpenState[1];

  var profileDataState = useState(null);
  var profileData = profileDataState[0];
  var setProfileData = profileDataState[1];

  var profileLoadState = useState(false);
  var profileLoading = profileLoadState[0];
  var setProfileLoading = profileLoadState[1];

  function logout() { clearAuthSession(); navigate('/login'); }

  function openProfile() {
    setProfileOpen(true);
    if (profileData) return;
    setProfileLoading(true);
    fetch(BASE + '/api/auth/profile', {
      headers: { Authorization: 'Bearer ' + authToken },
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.success && d.user) setProfileData(d.user); })
      .catch(function (e) { console.error(e); })
      .finally(function () { setProfileLoading(false); });
  }

  return (
    <>
      <div className="lro-shell">

        {/* Mobile overlay */}
        <div
          className={'lro-overlay' + (menuOpen ? ' is-open' : '')}
          onClick={function () { setMenuOpen(false); }}
        />

        {/* ── UNIFIED CARD ── */}
        <div className="lro-unified-card">

          {/* ── SIDEBAR ── */}
          <aside className={'lro-sidebar' + (menuOpen ? ' is-open' : '')}>

            {/* Brand */}
            <div className="lro-sidebar-brand">
              <div className="lro-sidebar-brand-icon">
                <i className="fas fa-shield-alt" />
              </div>
              <div>
                <div className="lro-sidebar-brand-name">Land Records</div>
                <span className="lro-sidebar-brand-sub">Officer Portal — PLRA</span>
              </div>
            </div>

            {/* User badge */}
            <div className="lro-sidebar-user">
              <div className="lro-sidebar-user-avatar">
                <i className="fas fa-user-tie" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lro-sidebar-user-name">{}</div>
                <div className="lro-sidebar-user-role">
                  <i className="fas fa-circle" style={{ fontSize: '.45rem', color: '#86efac' }} />
                  {roleSubtitle}
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="lro-nav">
              <div className="lro-nav-label">Navigation</div>
              {navLinks.map(function (l) {
                var active = location.pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={function () { setMenuOpen(false); }}
                    className={'lro-nav-link' + (active ? ' active' : '')}
                  >
                    <span className="lro-nav-link-icon">
                      <i className={l.icon} />
                    </span>
                    {l.label}
                    {l.badge !== undefined && (
                      <span className="lro-nav-badge">{l.badge}</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="lro-sidebar-footer">
              <button className="lro-logout-btn" onClick={logout}>
                <i className="fas fa-sign-out-alt" /> Sign Out
              </button>
            </div>
          </aside>

          {/* ── MAIN ── */}
          <div className="lro-main">

            {/* Topbar */}
            <div className="lro-topbar">
              <button
                className="lro-hamburger"
                onClick={function () { setMenuOpen(function (v) { return !v; }); }}
                aria-label="Toggle menu"
              >
                <i className="fas fa-bars" />
              </button>

              {title && <div className="lro-topbar-title">{title}</div>}

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '.625rem' }}>
                {topBarActions}

                {location.pathname !== '/lro/dashboard' && (
                  <Link to="/lro/dashboard" className="lro-topbar-back">
                    <i className="fas fa-arrow-left" /> Back
                  </Link>
                )}

               

                
              </div>
            </div>

            {/* Content */}
            <div className="lro-content-card">
              <div className="lro-content-inner">
                {children}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── PROFILE DRAWER ── */}
      {profileOpen && (
        <div className="lro-profile-backdrop" onClick={function () { setProfileOpen(false); }} />
      )}
      <div className={'lro-profile-drawer' + (profileOpen ? '' : ' is-closed')}>

        <div className="lro-profile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
            <div className="lro-profile-avatar">
              <i className="fas fa-user-tie" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="lro-profile-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profileData ? profileData.name : userName}
              </div>
              <div className="lro-profile-badge">
                <i className="fas fa-shield-alt" style={{ color: '#86efac' }} />
                {roleSubtitle}
              </div>
            </div>
          </div>
          <button
            className="lro-profile-close"
            onClick={function () { setProfileOpen(false); }}
            aria-label="Close profile"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="lro-profile-body">
          {profileLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <i className="fas fa-spinner fa-spin fa-2x" style={{ display: 'block', marginBottom: '.75rem', color: '#667eea' }} />
              Loading profile…
            </div>
          ) : !profileData ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <i className="fas fa-exclamation-circle fa-2x" style={{ display: 'block', marginBottom: '.75rem' }} />
              Could not load profile
            </div>
          ) : (
            [
              { icon: 'fas fa-user', label: 'Full Name', value: profileData.name },
              { icon: 'fas fa-id-card', label: 'CNIC', value: fmtCnic(profileData.cnic) },
              { icon: 'fas fa-calendar-alt', label: 'Date of Birth', value: fmtDate(profileData.date_of_birth) },
              { icon: 'fas fa-envelope', label: 'Email', value: profileData.email },
              { icon: 'fas fa-phone', label: 'Mobile', value: profileData.mobile || 'Not provided' },
              { icon: 'fas fa-fingerprint', label: 'User ID', value: profileData.user_id },
              { icon: 'fas fa-calendar', label: 'Joined', value: fmtDate(profileData.created_at) },
            ].map(function (row) {
              return (
                <div key={row.label} className="lro-profile-row">
                  <div className="lro-profile-row-icon">
                    <i className={row.icon} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lro-profile-row-label">{row.label}</div>
                    <div className="lro-profile-row-value">{row.value || '--'}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="lro-profile-footer">
          <button className="lro-btn-primary" onClick={function () { setProfileOpen(false); }}>
            <i className="fas fa-check" /> Done
          </button>
          <button className="lro-btn-ghost" onClick={function () { setProfileOpen(false); }}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export default OfficerLayout;
