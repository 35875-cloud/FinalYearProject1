import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

/* ─── Design tokens ─── */
export const T = {
  primary: '#667eea', primaryDark: '#764ba2', primaryMid: '#7c72ea',
  success: '#10b981', successBg: '#ecfdf5',
  danger: '#ef4444',  dangerBg: '#fef2f2',
  warning: '#f59e0b', warningBg: '#fffbeb',
  blue: '#3b82f6',   blueBg: '#dbeafe',
  orange: '#f97316', orangeBg: '#fff7ed',
  bg: '#f0f4ff', surface: '#ffffff', surface2: '#f8fafc',
  border: '#e2e8f0', text: '#1e293b', text2: '#475569', muted: '#94a3b8',
};

export const S = {
  sm: '0 1px 3px rgba(0,0,0,.07)', md: '0 4px 16px rgba(0,0,0,.09)',
  lg: '0 8px 32px rgba(102,126,234,.15)',
  r: { sm: 6, md: 10, lg: 16, xl: 22 },
};

export const fmt      = n => Number(n || 0).toLocaleString();
export const fmtCnic  = c => { const d = String(c||'').replace(/\D/g,''); return d.length===13 ? `${d.slice(0,5)}-${d.slice(5,12)}-${d.slice(12)}` : (c||'—'); };
export const fmtDate  = s => { if (!s) return '—'; return new Date(s).toLocaleDateString('en-PK',{year:'numeric',month:'long',day:'numeric'}); };
export const fmtDateTime = s => { if (!s) return '—'; return new Date(s).toLocaleString('en-PK',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); };

export const StatusBadge = ({ label, color = 'warning' }) => {
  const map = {
    warning: { bg: T.warningBg, color: '#92400e' },
    success: { bg: T.successBg, color: '#065f46' },
    danger:  { bg: T.dangerBg,  color: '#991b1b' },
    blue:    { bg: T.blueBg,    color: '#1e40af' },
  };
  const s = map[color] || map.warning;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>
      {label}
    </span>
  );
};

export const DEFAULT_LRO_NAV_LINKS = [
  { to: '/lro/dashboard',               icon: 'fas fa-th-large',       label: 'Dashboard'              },
  { to: '/lro/pending-registrations',   icon: 'fas fa-clipboard-list', label: 'Pending Registrations'  },
  { to: '/lro/pending-transfers',       icon: 'fas fa-exchange-alt',   label: 'Pending Transfers'      },
  { to: '/lro/blockchain',              icon: 'fas fa-gavel',          label: 'Registration Voting'    },
  { to: '/lro/transfer-voting',         icon: 'fas fa-link',           label: 'Transfer Voting'        },
  { to: '/lro/succession',              icon: 'fas fa-users',          label: 'Succession Cases'       },
  { to: '/lro/citizen-history',         icon: 'fas fa-address-card',   label: 'Citizen History'        },
  { to: '/lro/integrity',               icon: 'fas fa-shield-alt',     label: 'Integrity'              },
  { to: '/lro/rejected-registrations',  icon: 'fas fa-times-circle',   label: 'Rejected Registrations' },
  { to: '/lro/rejected-transfers',      icon: 'fas fa-ban',            label: 'Rejected Transfers'     },
  { to: '/lro/market',                  icon: 'fas fa-chart-line',     label: 'Market Dashboard'       },
];

const OfficerLayout = ({ children, title, roleLabel = 'LRO', roleSubtitle = 'Land Record Officer', navLinks = DEFAULT_LRO_NAV_LINKS }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const userName  = sessionStorage.getItem('userName') || 'Officer';

  const [menuOpen, setMenuOpen] = useState(false);

  const logout = () => { sessionStorage.clear(); navigate('/login'); };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <style>{`
        body { margin:0; background:${T.bg}; font-family:'DM Sans',system-ui,sans-serif; }
        *,*::before,*::after { box-sizing:border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-thumb { background:#c7d2fe; border-radius:10px; }
        @media(max-width:900px){
          .off-sidebar { transform:${menuOpen ? 'translateX(0)' : 'translateX(-100%)'} !important; }
          .off-main { margin-left:0 !important; }
          .off-menu-btn { display:flex !important; }
        }
      `}</style>

      <div style={{ display:'flex', minHeight:'100vh', background:T.bg, color:T.text }}>

        {menuOpen && (
          <div onClick={() => setMenuOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:299, backdropFilter:'blur(2px)' }} />
        )}

        {/* ── SIDEBAR ── */}
        <aside className="off-sidebar" style={{
          width: 252, flexShrink: 0, background: T.surface,
          borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 300,
          boxShadow: '2px 0 20px rgba(102,126,234,.08)',
          transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Brand */}
          <div style={{ height:64, display:'flex', alignItems:'center', padding:'0 1.125rem', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'.95rem', flexShrink:0 }}>
                <i className="fas fa-shield-alt" />
              </div>
              <div>
                <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:'.875rem', lineHeight:1.2, color:T.text }}>Land Records</div>
                <div style={{ fontSize:'.65rem', color:T.muted, marginTop:1 }}>Officer Portal · PLRA</div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ flex:1, padding:'.75rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:'.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:.6, color:T.muted, padding:'4px 8px', marginBottom:4 }}>Navigation</div>
            {navLinks.map(l => {
              const active = location.pathname === l.to;
              return (
                <Link key={l.to} to={l.to} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 10px',
                  borderRadius:10, textDecoration:'none', fontWeight: active ? 600 : 500,
                  fontSize:'.83rem', color: active ? T.primary : T.text2,
                  background: active ? '#eef0fe' : 'transparent',
                  borderLeft: active ? `3px solid ${T.primary}` : '3px solid transparent',
                  transition:'all .15s',
                }}>
                  <i className={l.icon} style={{ width:16, fontSize:'.8rem', color: active ? T.primary : T.muted }} />
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* User area */}
          <div style={{ padding:'1rem', borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:10, borderRadius:12, background:T.surface2, border:`1px solid ${T.border}` }}>
              <div style={{ width:36, height:36, background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'.8rem', flexShrink:0 }}>
                <i className="fas fa-user-tie" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:'.8rem', color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userName}</div>
                <div style={{ fontSize:'.65rem', color:T.muted }}>{roleSubtitle}</div>
              </div>
              <button onClick={logout} title="Logout"
                style={{ width:30, height:30, border:'none', borderRadius:8, background:T.dangerBg, color:T.danger, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.75rem', flexShrink:0 }}>
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN AREA ── */}
        <div className="off-main" style={{ flex:1, marginLeft:252, display:'flex', flexDirection:'column', minHeight:'100vh' }}>
          {/* Top nav */}
          <nav style={{ height:64, background:T.surface, borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.5rem', position:'sticky', top:0, zIndex:200, boxShadow:'0 1px 8px rgba(102,126,234,.06)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {/* Mobile menu btn */}
              <button className="off-menu-btn" onClick={() => setMenuOpen(o => !o)}
                style={{ display:'none', width:36, height:36, background:'transparent', border:`1px solid ${T.border}`, borderRadius:8, alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.text2 }}>
                <i className="fas fa-bars" />
              </button>
              <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:'.95rem', color:T.text }}>{title || 'Officer Dashboard'}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, color:'white', padding:'4px 14px', borderRadius:20, fontSize:'.75rem', fontWeight:700 }}>
                <i className="fas fa-user-tie" style={{ marginRight:5 }} />{roleLabel}
              </span>
              <div style={{ width:36, height:36, background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'.85rem', cursor:'pointer', flexShrink:0 }}>
                <i className="fas fa-user" />
              </div>
            </div>
          </nav>

          {/* Page content */}
          <main style={{ flex:1, maxWidth:1200, width:'100%', margin:'0 auto', padding:'2rem 1.5rem' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
};

export default OfficerLayout;
