import React, { useEffect, useState } from 'react';
import OfficerLayout, { T, S, fmtCnic, fmtDateTime } from './OfficerLayout';

const searchFieldStyle = {
  width: '100%',
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: '.92rem',
  outline: 'none',
  color: T.text,
};

const StatTile = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '1rem' }}>
    <div style={{ fontSize: '.72rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: .45, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: T.text }}>{value}</div>
  </div>
);

const SectionCard = ({ title, children }) => (
  <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.25rem' }}>
    <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: '1rem' }}>{title}</div>
    {children}
  </div>
);

const OfficerCitizenHistory = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const loadSearch = async (term = '') => {
    if (!authToken) return;
    setSearching(true);
    setError('');
    try {
      const response = await fetch(`${base}/api/officer/citizen-history?search=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to search citizen history');
      }
      setResults(data.matches || []);
    } catch (err) {
      setError(err.message);
    }
    setSearching(false);
    setLoading(false);
  };

  const loadDetail = async (userId) => {
    if (!userId) return;
    setDetailLoading(true);
    setError('');
    try {
      const response = await fetch(`${base}/api/officer/citizen-history/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load citizen detail');
      }
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setError(err.message);
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    loadSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!results.length) {
      setSelectedId('');
      setDetail(null);
      return;
    }
    if (!results.some((item) => item.user_id === selectedId)) {
      setSelectedId(results[0].user_id);
    }
  }, [results, selectedId]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <OfficerLayout title="Citizen History">
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.5rem 1.65rem' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: T.text, marginBottom: 6 }}>
            Citizen History
          </div>
          <div style={{ color: T.text2, fontSize: '.92rem', marginBottom: '1rem' }}>
            Search by user ID, CNIC, email or name to inspect a citizen's approved properties and transfer history.
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadSearch(search);
            }}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) auto', gap: '0.85rem' }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search citizen by user ID, CNIC, email or name"
              style={searchFieldStyle}
            />
            <button
              type="submit"
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '12px 18px',
                background: `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})`,
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-search" style={{ marginRight: 8 }} />
              Search
            </button>
          </form>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', padding: '0.95rem 1rem' }}>
            <strong>Citizen history error:</strong> {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
          <SectionCard title="Citizen Results">
            {loading || searching ? (
              <div style={{ color: T.muted }}>Loading search results...</div>
            ) : !results.length ? (
              <div style={{ color: T.muted }}>No citizen matched the current search.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                {results.map((item) => {
                  const active = item.user_id === selectedId;
                  return (
                    <button
                      key={item.user_id}
                      onClick={() => setSelectedId(item.user_id)}
                      style={{
                        border: active ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
                        background: active ? '#eef2ff' : '#f8fafc',
                        borderRadius: 16,
                        padding: '0.95rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>{item.name}</div>
                      <div style={{ color: T.text2, fontSize: '.83rem', marginBottom: 4 }}>{item.user_id}</div>
                      <div style={{ color: T.muted, fontSize: '.76rem' }}>{fmtCnic(item.cnic)} | {item.email || 'No email'}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <SectionCard title="Citizen Summary">
              {detailLoading ? (
                <div style={{ color: T.muted }}>Loading citizen detail...</div>
              ) : !detail ? (
                <div style={{ color: T.muted }}>Select a citizen from the results list to inspect the recovered history.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                    <StatTile label="Properties" value={detail.summary?.totalProperties || 0} />
                    <StatTile label="Transfers" value={detail.summary?.totalTransfers || 0} />
                    <StatTile label="User ID" value={detail.citizen?.user_id || 'N/A'} />
                    <StatTile label="Role" value={detail.citizen?.role || 'CITIZEN'} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.85rem' }}>
                    <StatTile label="Name" value={detail.citizen?.name || 'N/A'} />
                    <StatTile label="CNIC" value={fmtCnic(detail.citizen?.cnic)} />
                    <StatTile label="Email" value={detail.citizen?.email || 'N/A'} />
                    <StatTile label="Mobile" value={detail.citizen?.mobile || 'N/A'} />
                  </div>
                </>
              )}
            </SectionCard>

            <SectionCard title="Approved Properties">
              {!detail?.properties?.length ? (
                <div style={{ color: T.muted }}>No property history found for this citizen.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem' }}>
                  {detail.properties.map((property) => (
                    <div key={property.property_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '0.95rem', background: '#f8fafc' }}>
                      <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>{property.property_id}</div>
                      <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>
                        {[property.district, property.tehsil, property.mauza].filter(Boolean).join(', ')}
                      </div>
                      <div style={{ color: T.muted, fontSize: '.76rem' }}>
                        {property.property_type || 'Property'} | {property.area_marla ? `${property.area_marla} Marla` : 'Area N/A'} | Updated {fmtDateTime(property.updated_at || property.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Transfer History">
              {!detail?.transfers?.length ? (
                <div style={{ color: T.muted }}>No transfer history found for this citizen.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.8rem' }}>
                  {detail.transfers.map((transfer) => (
                    <div key={transfer.transfer_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '0.95rem', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 4 }}>
                        <div style={{ fontWeight: 800, color: T.text }}>Transfer #{transfer.transfer_id}</div>
                        <div style={{ color: T.muted, fontSize: '.76rem' }}>{fmtDateTime(transfer.updated_at || transfer.created_at)}</div>
                      </div>
                      <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>
                        Property: {transfer.property_id} | Status: {transfer.status}
                      </div>
                      <div style={{ color: T.muted, fontSize: '.76rem' }}>
                        Seller: {transfer.seller_name || 'N/A'} | Buyer: {transfer.buyer_name || 'N/A'} | Agreed Price: {transfer.agreed_price || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </OfficerLayout>
  );
};

export default OfficerCitizenHistory;
