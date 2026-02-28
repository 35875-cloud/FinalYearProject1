import React, { useEffect, useState } from 'react';
import OfficerLayout, { T, S } from '../officer/OfficerLayout';

const ADMIN_NAV_LINKS = [
  { to: '/admin/dashboard', icon: 'fas fa-user-shield', label: 'Admin Dashboard' },
];

const StatCard = ({ icon, label, value, bg, color }) => (
  <div style={{ background: 'white', borderRadius: 18, boxShadow: S.md, padding: '1.25rem', border: `1px solid ${bg}` }}>
    <div style={{ width: 50, height: 50, borderRadius: 14, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', marginBottom: '0.85rem' }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
    <div style={{ marginTop: 6, color: T.text2, fontWeight: 700, fontSize: '.84rem' }}>{label}</div>
  </div>
);

const AdminDashboard = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registrations, setRegistrations] = useState({ pending: [], approved: [], rejected: [], approvedToday: 0, rejectedToday: 0 });
  const [propertyStats, setPropertyStats] = useState({ pending: 0, approved: 0, rejected: 0, minedToBlockchain: 0, approvedButUnmined: 0 });
  const [busyUserId, setBusyUserId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [regRes, statsRes] = await Promise.all([
        fetch(`${base}/api/auth/all-registrations`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`${base}/api/properties/admin/property-stats`, { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);

      const regData = await regRes.json();
      const statsData = await statsRes.json();

      if (!regRes.ok || !regData.success) {
        throw new Error(regData.message || 'Unable to load officer registration data');
      }
      if (!statsRes.ok || !statsData.success) {
        throw new Error(statsData.message || 'Unable to load property summary');
      }

      setRegistrations({
        pending: regData.pending || [],
        approved: regData.approved || [],
        rejected: regData.rejected || [],
        approvedToday: regData.approvedToday || 0,
        rejectedToday: regData.rejectedToday || 0,
      });
      setPropertyStats(statsData.stats || {});
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const handleDecision = async (type, userId) => {
    const payload = type === 'approve'
      ? { userId, notes: 'Approved by admin' }
      : { userId, reason: window.prompt('Enter rejection reason for this officer registration:') || '' };

    if (type === 'reject' && !payload.reason.trim()) return;

    setBusyUserId(userId);
    try {
      const response = await fetch(`${base}/api/auth/${type === 'approve' ? 'approve-user' : 'reject-user'}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to update officer registration');
      }
      load();
    } catch (err) {
      setError(err.message);
    }
    setBusyUserId('');
  };

  return (
    <OfficerLayout title="Admin Dashboard" roleLabel="ADMIN" roleSubtitle="System Administrator" navLinks={ADMIN_NAV_LINKS}>
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.55rem 1.7rem' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: T.text, marginBottom: 6 }}>
            Admin Control Center
          </div>
          <div style={{ color: T.text2, fontSize: '.92rem' }}>
            Officer registrations and system-wide property summary are visible here. This keeps admin focused on approvals while LRO and DC handle case movement.
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', padding: '0.95rem 1rem' }}>
            <strong>Admin dashboard error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '4rem', textAlign: 'center', color: T.muted }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem' }} />
            <div>Loading admin dashboard...</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '1rem' }}>
              <StatCard icon="fas fa-user-clock" label="Pending Officer Approvals" value={registrations.pending.length} bg="#fff7ed" color="#ea580c" />
              <StatCard icon="fas fa-user-check" label="Approved Today" value={registrations.approvedToday} bg="#ecfdf5" color="#059669" />
              <StatCard icon="fas fa-user-times" label="Rejected Today" value={registrations.rejectedToday} bg="#fef2f2" color="#dc2626" />
              <StatCard icon="fas fa-database" label="Properties Pending" value={propertyStats.pending || 0} bg="#eef2ff" color="#4f46e5" />
              <StatCard icon="fas fa-link" label="Mined To Ledger" value={propertyStats.minedToBlockchain || 0} bg="#eff6ff" color="#2563eb" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
              <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.25rem' }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: '1rem' }}>
                  Pending Officer Registrations
                </div>
                {!registrations.pending.length ? (
                  <div style={{ color: T.muted }}>No pending LRO or DC registrations right now.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {registrations.pending.map((user) => (
                      <div key={user.user_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 8 }}>
                          <div style={{ fontWeight: 800, color: T.text }}>{user.name}</div>
                          <span style={{ padding: '4px 10px', borderRadius: 999, background: '#fff7ed', color: '#c2410c', fontWeight: 800, fontSize: '.72rem' }}>
                            {user.role}
                          </span>
                        </div>
                        <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>{user.email}</div>
                        <div style={{ color: T.muted, fontSize: '.76rem', marginBottom: '0.95rem' }}>User ID: {user.user_id}</div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleDecision('approve', user.user_id)}
                            disabled={busyUserId === user.user_id}
                            style={{ border: 'none', borderRadius: 12, padding: '10px 14px', background: '#059669', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision('reject', user.user_id)}
                            disabled={busyUserId === user.user_id}
                            style={{ border: 'none', borderRadius: 12, padding: '10px 14px', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.25rem' }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: '1rem' }}>
                  Property Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.85rem' }}>
                  <StatCard icon="fas fa-hourglass-half" label="Pending" value={propertyStats.pending || 0} bg="#fff7ed" color="#ea580c" />
                  <StatCard icon="fas fa-badge-check" label="Approved" value={propertyStats.approved || 0} bg="#ecfdf5" color="#059669" />
                  <StatCard icon="fas fa-triangle-exclamation" label="Rejected" value={propertyStats.rejected || 0} bg="#fef2f2" color="#dc2626" />
                  <StatCard icon="fas fa-unlink" label="Approved But Unmined" value={propertyStats.approvedButUnmined || 0} bg="#eef2ff" color="#4f46e5" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </OfficerLayout>
  );
};

export default AdminDashboard;
