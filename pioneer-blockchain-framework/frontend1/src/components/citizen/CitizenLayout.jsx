import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './CitizenLayout.css';

/* ─── Design tokens ─── */
export const T = {
  primary: '#4E78A5', primaryLight: '#EEF4FA', primaryMid: '#6E95BE', primaryDark: '#27445F',
  accent: '#1F8F5F', accentLight: '#E7F5EE',
  seller: '#C58A22', sellerLight: '#FBF3E3',
  buyer: '#4E78A5', buyerLight: '#EEF4FA',
  bg: '#F2F6FB', surface: '#FFFFFF', surface2: '#F8FAFC',
  border: '#D6E0EA', text: '#1C2B3E', text2: '#4F6278', muted: '#708198',
  error: '#DC2626', errorBg: '#FEF2F2',
  success: '#1F8F5F', successBg: '#EDF7F2',
  warning: '#8A651C', warningBg: '#FCF7ED',
};
export const S = {
  sm: '0 1px 3px rgba(28,43,62,.06)', md: '0 12px 28px rgba(28,43,62,.08)', lg: '0 18px 42px rgba(28,43,62,.12)',
  r: { sm: 8, md: 12, lg: 18, xl: 24 },
};

export const StatusPill = ({ status, small }) => {
  const map = {
    PENDING:             { bg: '#FEF3C7',    color: '#92400E' },
    CHANNEL_ACTIVE:      { bg: T.buyerLight, color: T.buyer   },
    NEGOTIATING:         { bg: T.buyerLight, color: T.buyer   },
    ACTIVE:              { bg: T.buyerLight, color: T.buyer   },
    PAYMENT_PENDING:     { bg: '#FEF3C7',    color: '#92400E' },
    PAYMENT_UPLOADED:    { bg: T.sellerLight,color: T.seller  },
    AGREED:              { bg: T.successBg,  color: T.success },
    APPROVED:            { bg: T.successBg,  color: T.success },
    REJECTED:            { bg: T.errorBg,    color: T.error   },
    CLOSED:              { bg: '#F1F5F9',    color: '#64748B' },
    SCREENSHOT_UPLOADED: { bg: T.sellerLight,color: T.seller  },
    FROZEN:              { bg: '#EFF6FF',    color: '#1E40AF' },
    PENDING_APPROVAL:    { bg: '#FEF3C7',    color: '#92400E' },
  };
  const s = map[status] || { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: small ? '1px 6px' : '2px 8px', borderRadius: 100, fontSize: small ? '.6rem' : '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>
      {status?.replace(/_/g,' ')}
    </span>
  );
};

export const fmt         = n => Number(n || 0).toLocaleString();
export const fmtCnic     = c => { const d = String(c||'').replace(/\D/g,''); return d.length===13 ? `${d.slice(0,5)}-${d.slice(5,12)}-${d.slice(12)}` : (c||'—'); };
export const fmtDate     = s => { if (!s) return '—'; return new Date(s).toLocaleDateString('en-PK', { year:'numeric', month:'long', day:'numeric' }); };
export const fmtDateTime = s => { if (!s) return '—'; return new Date(s).toLocaleString('en-PK', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); };

/* ─── PageHero ─── */
export const PageHero = ({ eyebrow, icon, title, subtitle, actions, stats = [], children, color }) => {
  const bg     = color || T.primary;
  const bgDark = color ? color : T.primaryDark;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${bgDark}, ${bg})`,
      borderRadius: S.r.xl,
      padding: '1.75rem 2rem',
      marginBottom: '1.75rem',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: S.md,
    }}>
      <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, border:'2px solid rgba(255,255,255,.08)', borderRadius:'50%', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-30, right:60, width:100, height:100, border:'2px solid rgba(255,255,255,.06)', borderRadius:'50%', pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:'1.1rem' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1.25rem', flexWrap:'wrap', flex:'1 1 560px', minWidth:0 }}>
            {icon && (
              <div style={{ width:54, height:54, background:'rgba(255,255,255,.15)', border:'2px solid rgba(255,255,255,.25)', borderRadius:S.r.md, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'1.35rem', flexShrink:0 }}>
                <i className={icon} />
              </div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              {eyebrow && (
                <div style={{ fontSize:'.68rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.14em', color:'rgba(255,255,255,.72)', marginBottom:6 }}>
                  {eyebrow}
                </div>
              )}
              {title && (
                <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'1.7rem', color:'white', lineHeight:1.1, letterSpacing:'-.03em' }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize:'.96rem', color:'rgba(255,255,255,.84)', marginTop:6, lineHeight:1.6, maxWidth:740 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {(actions || children) && (
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'flex-end', flex:'0 1 auto' }}>
              {actions}
              {children}
            </div>
          )}
        </div>

        {stats.length > 0 && (
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(165px, 1fr))',
            gap:12,
          }}>
            {stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.value}`}
                style={{
                  background: stat.bg || 'rgba(255,255,255,.12)',
                  border: `1px solid ${stat.border || 'rgba(255,255,255,.18)'}`,
                  borderRadius:18,
                  padding:'13px 14px',
                  display:'flex',
                  alignItems:'center',
                  gap:12,
                  backdropFilter:'blur(6px)',
                }}
              >
                <div style={{
                  width:40,
                  height:40,
                  borderRadius:14,
                  background: stat.iconBg || 'rgba(255,255,255,.14)',
                  color: stat.iconColor || '#fff',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  flexShrink:0,
                  fontSize:'.98rem',
                }}>
                  <i className={stat.icon} />
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'1.15rem', fontWeight:900, color: stat.valueColor || T.text, lineHeight:1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color: stat.labelColor || T.muted, marginTop:5 }}>
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Nav links ─── */
const NAV_LINKS = [
  { to: '/citizen/dashboard',     icon: 'fas fa-th-large',          label: 'Dashboard'      },
  { to: '/citizen/my-properties', icon: 'fas fa-home',              label: 'My Properties'  },
  { to: '/citizen/marketplace',   icon: 'fas fa-store',             label: 'Marketplace'    },
  { to: '/citizen/transfers',     icon: 'fas fa-comments-dollar',   label: 'Transfer Inbox' },
  { to: '/citizen/seller',        icon: 'fas fa-hand-holding-usd',  label: 'Seller Portal'  },
];

const CitizenLayout = ({ children, title }) => {
  const navigate    = useNavigate();
  const location    = useLocation();
  const authToken   = sessionStorage.getItem('authToken');
  const userName    = sessionStorage.getItem('userName') || 'Citizen';
  const BASE        = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth','');

  const [menuOpen,       setMenuOpen]       = useState(false);
  const [profileOpen,    setProfileOpen]    = useState(false);
  const [profileData,    setProfileData]    = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const logout = () => { sessionStorage.clear(); navigate('/login'); };

  const openProfile = async () => {
    setProfileOpen(true);
    if (profileData) return;
    setProfileLoading(true);
    try {
      const r = await fetch(`${BASE}/api/auth/profile`, { headers: { Authorization: `Bearer ${authToken}` } });
      const d = await r.json();
      if (d.success && d.user) setProfileData(d.user);
    } catch(e) { console.error(e); }
    finally { setProfileLoading(false); }
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <style>{`
        body {
          margin:0;
          background:
            radial-gradient(circle at top left, rgba(78,120,165,.11), transparent 24%),
            radial-gradient(circle at bottom right, rgba(31,143,95,.08), transparent 28%),
            linear-gradient(180deg, #fafcff 0%, ${T.bg} 48%, #eef3f8 100%);
          font-family:'DM Sans',system-ui,sans-serif;
        }
        *,*::before,*::after { box-sizing:border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-thumb { background:#c6d2de; border-radius:10px; }
        @media(max-width:900px){
          .cit-sidebar { transform:${menuOpen ? 'translateX(0)' : 'translateX(-100%)'} !important; }
          .cit-main { margin-left:0 !important; }
          .cit-menu-btn { display:flex !important; }
        }
      `}</style>

      <div style={{ display:'flex', minHeight:'100vh', background:T.bg, color:T.text }}>

        {/* Mobile overlay */}
        {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:299, backdropFilter:'blur(2px)' }} />}

        {/* ── SIDEBAR ── */}
        <aside className="cit-sidebar" style={{
          width:240, flexShrink:0, background:T.surface, borderRight:`1px solid ${T.border}`,
          display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:300,
          boxShadow:'2px 0 26px rgba(58,123,213,.10)', transition:'transform .25s cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Brand */}
          <div style={{ height:64, display:'flex', alignItems:'center', padding:'0 1.125rem', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, background:`linear-gradient(135deg,${T.primaryDark},${T.primaryMid})`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'.95rem', flexShrink:0 }}>
                <i className="fas fa-landmark" />
              </div>
              <div>
                <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'.875rem', lineHeight:1.2, color:T.text }}>Land Records</div>
                <div style={{ fontSize:'.65rem', color:T.muted, marginTop:1 }}>Punjab Blockchain System</div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ flex:1, padding:'.75rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:'.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:.6, color:T.muted, padding:'4px 8px', marginBottom:4 }}>Navigation</div>
            {NAV_LINKS.map(l => {
              const active = location.pathname === l.to;
              return (
                <Link key={l.to} to={l.to} onClick={()=>setMenuOpen(false)} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10,
                  textDecoration:'none', fontWeight:600, fontSize:'.875rem', transition:'all .15s',
                  background: active ? T.primaryLight : 'transparent',
                  color: active ? T.primary : T.text2,
                  borderLeft: active ? `3px solid ${T.primary}` : '3px solid transparent',
                }}>
                  <span style={{ width:30, height:30, borderRadius:8, background:active?T.primary:T.bg, display:'flex', alignItems:'center', justifyContent:'center', color:active?'white':T.muted, fontSize:'.8rem', flexShrink:0 }}>
                    <i className={l.icon} />
                  </span>
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* Sign Out */}
          <div style={{ padding:'.875rem .75rem', borderTop:`1px solid ${T.border}` }}>
            <button onClick={logout} style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:`1.5px solid ${T.border}`, background:'transparent', cursor:'pointer', color:T.error, fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:'.82rem', display:'flex', alignItems:'center', justifyContent:'center', gap:7, transition:'all .15s' }}
              onMouseEnter={e=>{e.currentTarget.style.background=T.errorBg;e.currentTarget.style.borderColor=T.error;}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor=T.border;}}>
              <i className="fas fa-sign-out-alt" /> Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN AREA ── */}
        <div className="cit-main" style={{ flex:1, marginLeft:240, display:'flex', flexDirection:'column', minHeight:'100vh' }}>

          {/* Top nav */}
          <nav style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, height:64, display:'flex', alignItems:'center', padding:'0 1.5rem', position:'sticky', top:0, zIndex:200, boxShadow:S.sm, gap:'1rem' }}>
            <button className="cit-menu-btn" onClick={()=>setMenuOpen(v=>!v)} style={{ display:'none', border:'none', background:'none', cursor:'pointer', color:T.text2, fontSize:'1.1rem', padding:4, flexShrink:0, alignItems:'center', justifyContent:'center' }}>
              <i className="fas fa-bars" />
            </button>
            {title && <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:'.9rem', color:T.text }}>{title}</div>}

            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'.75rem' }}>
              {location.pathname !== '/citizen/dashboard' && (
                <Link to="/citizen/dashboard" style={{ display:'flex', alignItems:'center', gap:6, border:`1.5px solid ${T.border}`, borderRadius:100, padding:'5px 12px', color:T.text2, fontSize:'.82rem', fontWeight:600, textDecoration:'none', background:T.bg, transition:'all .15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.text2;}}>
                  <i className="fas fa-arrow-left" />Back
                </Link>
              )}
              {/* Profile avatar → opens drawer */}
              <button onClick={openProfile} title="View Profile"
                style={{ width:40, height:40, background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, border:'none', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'1rem', cursor:'pointer', boxShadow:'0 2px 10px rgba(58,123,213,.30)', transition:'transform .2s, box-shadow .2s', flexShrink:0 }}
                onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.08)';e.currentTarget.style.boxShadow='0 4px 18px rgba(58,123,213,.42)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='0 2px 10px rgba(58,123,213,.30)';}}>
                <i className="fas fa-user" />
              </button>
            </div>
          </nav>

          {/* Page content */}
          <main style={{ flex:1, maxWidth:1100, width:'100%', margin:'0 auto', padding:'2rem 1.5rem' }}>
            {children}
          </main>
        </div>
      </div>

      {/* ════════ PROFILE DRAWER ════════ */}
      {profileOpen && (
        <div onClick={()=>setProfileOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:400, backdropFilter:'blur(3px)' }} />
      )}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0,
        width:'30%', minWidth:320,
        background:T.surface,
        boxShadow:'-8px 0 40px rgba(0,0,0,.18)',
        zIndex:401,
        display:'flex', flexDirection:'column',
        transform: profileOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform .3s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Drawer header */}
        <div style={{ background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, padding:'1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, border:'2px solid rgba(255,255,255,.1)', borderRadius:'50%', pointerEvents:'none' }} />
          <div style={{ display:'flex', alignItems:'center', gap:12, position:'relative', zIndex:1 }}>
            <div style={{ width:52, height:52, background:'rgba(255,255,255,.18)', border:'2px solid rgba(255,255,255,.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'1.25rem', flexShrink:0 }}>
              <i className="fas fa-user" />
            </div>
            <div>
              <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:'1rem', color:'white' }}>
                {profileData?.name || userName}
              </div>
              <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.7)', marginTop:2, display:'flex', alignItems:'center', gap:5 }}>
                <i className="fas fa-check-circle" style={{ color:'#86EFAC' }} /> Verified Citizen
              </div>
            </div>
          </div>
          <button onClick={()=>setProfileOpen(false)}
            style={{ position:'relative', zIndex:1, width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,.15)', border:'none', color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem', transition:'all .2s', flexShrink:0 }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.3)';e.currentTarget.style.transform='rotate(90deg)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.15)';e.currentTarget.style.transform='rotate(0)';}}>
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Drawer body */}
        <div style={{ flex:1, padding:'1.25rem', overflowY:'auto' }}>
          {profileLoading ? (
            <div style={{ textAlign:'center', padding:'3rem', color:T.muted }}>
              <i className="fas fa-spinner fa-spin fa-2x" style={{ display:'block', marginBottom:'.75rem', color:T.primary }} />
              Loading profile…
            </div>
          ) : !profileData ? (
            <div style={{ textAlign:'center', padding:'3rem', color:T.muted }}>
              <i className="fas fa-exclamation-circle fa-2x" style={{ display:'block', marginBottom:'.75rem' }} />
              Could not load profile
            </div>
          ) : (
            <>
              {[
                { icon:'fas fa-user',        label:'Full Name', value: profileData.name },
                { icon:'fas fa-id-card',     label:'CNIC',      value: fmtCnic(profileData.cnic) },
                { icon:'fas fa-calendar-alt',label:'Date of Birth', value: fmtDate(profileData.date_of_birth) },
                { icon:'fas fa-envelope',    label:'Email',     value: profileData.email },
                { icon:'fas fa-phone',       label:'Mobile',    value: profileData.mobile || 'Not provided' },
                { icon:'fas fa-fingerprint', label:'User ID',   value: profileData.user_id },
                { icon:'fas fa-calendar',    label:'Joined',    value: fmtDate(profileData.created_at) },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 0', borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ width:34, height:34, background:T.primaryLight, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:T.primary, fontSize:'.8rem', flexShrink:0, marginTop:1 }}>
                    <i className={row.icon} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'.67rem', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:T.muted, marginBottom:3 }}>{row.label}</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, fontSize:'.85rem', color:T.text, wordBreak:'break-all' }}>{row.value || '—'}</div>
                  </div>
                </div>
              ))}
              {profileData.blockchain_address && (
                <div style={{ marginTop:'1rem', background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, borderRadius:S.r.lg, padding:'1rem 1.25rem', cursor:'pointer' }}
                  onClick={()=>navigator.clipboard.writeText(profileData.blockchain_address).catch(()=>{})}>
                  <div style={{ fontSize:'.65rem', color:'rgba(255,255,255,.65)', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
                    <i className="fas fa-cube" /> Blockchain Address
                  </div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'.78rem', color:'white', wordBreak:'break-all', fontWeight:600 }}>
                    {profileData.blockchain_address}
                  </div>
                  <div style={{ fontSize:'.65rem', color:'rgba(255,255,255,.5)', marginTop:6, display:'flex', alignItems:'center', gap:4 }}>
                    <i className="fas fa-copy" /> Click to copy
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer footer */}
        <div style={{ padding:'1rem 1.25rem', borderTop:`1px solid ${T.border}`, flexShrink:0, display:'flex', gap:8 }}>
          <button
            onClick={()=>{ setProfileOpen(false); navigate('/citizen/profile'); }}
            style={{ flex:1, padding:'10px', background:`linear-gradient(135deg,${T.primaryDark},${T.primary})`, color:'white', border:'none', borderRadius:S.r.md, fontWeight:700, fontSize:'.875rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontFamily:"'DM Sans',sans-serif" }}
          >
            <i className="fas fa-edit" /> Edit Full Profile
          </button>
          <button onClick={()=>setProfileOpen(false)}
            style={{ padding:'10px 16px', background:'transparent', color:T.muted, border:`1.5px solid ${T.border}`, borderRadius:S.r.md, fontWeight:600, fontSize:'.875rem', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default CitizenLayout;
