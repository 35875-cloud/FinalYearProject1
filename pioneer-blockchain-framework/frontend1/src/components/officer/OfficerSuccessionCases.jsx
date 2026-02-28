import React, { useEffect, useState } from 'react';
import OfficerLayout, { T, S, fmtDateTime } from './OfficerLayout';

function getRowId(row) {
  return row?.succession_request_id || row?.request_no || row?.id || '';
}

function getValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return '';
}

const StatusPill = ({ value, bg = '#eef2ff', color = '#4338ca' }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    borderRadius: 999,
    background: bg,
    color,
    fontWeight: 800,
    fontSize: '.72rem',
    textTransform: 'uppercase',
    letterSpacing: .3,
  }}>
    {value || 'N/A'}
  </span>
);

const Box = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '0.95rem' }}>
    <div style={{ fontSize: '.69rem', color: T.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45, marginBottom: 6 }}>{label}</div>
    <div style={{ color: T.text, fontWeight: 700, fontSize: '.9rem' }}>{value || 'N/A'}</div>
  </div>
);

const OfficerSuccessionCases = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${base}/api/officer/succession/cases`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load succession cases');
      }
      setTables(data.tables || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const requestTable = tables.find((table) => table.table === 'succession_requests' && table.exists);
  const heirTable = tables.find((table) => table.table === 'succession_heirs' && table.exists);
  const eventTable = tables.find((table) => table.table === 'succession_events' && table.exists);

  const requests = requestTable?.rows || [];

  useEffect(() => {
    if (!requests.length) {
      setSelectedId('');
      return;
    }
    if (!requests.some((row) => getRowId(row) === selectedId)) {
      setSelectedId(getRowId(requests[0]));
    }
  }, [requests, selectedId]);

  const selectedRequest = requests.find((row) => getRowId(row) === selectedId) || null;
  const heirs = (heirTable?.rows || []).filter((row) => String(row.succession_request_id) === String(selectedId));
  const events = (eventTable?.rows || []).filter((row) => String(row.succession_request_id) === String(selectedId));

  return (
    <OfficerLayout title="Succession Cases">
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{
          background: 'white',
          borderRadius: 22,
          boxShadow: S.md,
          padding: '1.5rem 1.65rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: T.text, marginBottom: 6 }}>
              Succession Review
            </div>
            <div style={{ color: T.text2, fontSize: '.92rem' }}>
              Recovered inheritance requests, heir allocations and officer activity are shown here from the current database snapshot.
            </div>
          </div>
          <button
            onClick={load}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '10px 16px',
              background: `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})`,
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-sync-alt" style={{ marginRight: 8 }} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '4rem', textAlign: 'center', color: T.muted }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem' }} />
            <div>Loading succession data...</div>
          </div>
        ) : error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', padding: '1rem 1.15rem' }}>
            <strong>Succession load error:</strong> {error}
          </div>
        ) : !requestTable?.exists ? (
          <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '2rem' }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: '0.5rem' }}>
              Succession tables are missing in this recovery snapshot
            </div>
            <div style={{ color: T.text2 }}>
              The UI has been restored, but the underlying succession tables are not currently present in the database. Once those tables or routes are restored, this screen will populate automatically.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
            <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${T.border}`, fontWeight: 800, color: T.text }}>
                Request Queue
              </div>
              {!requests.length ? (
                <div style={{ padding: '2rem 1.2rem', color: T.muted }}>No succession requests were found.</div>
              ) : (
                <div style={{ maxHeight: 720, overflowY: 'auto' }}>
                  {requests.map((row, index) => {
                    const id = getRowId(row);
                    const active = id === selectedId;
                    return (
                      <button
                        key={id || index}
                        onClick={() => setSelectedId(id)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: active ? '#eef2ff' : 'white',
                          borderBottom: `1px solid ${T.border}`,
                          padding: '0.95rem 1rem',
                          display: 'grid',
                          gridTemplateColumns: '42px minmax(0,1fr)',
                          gap: '0.9rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: active ? T.primaryDark : T.text }}>{index + 1}</div>
                        <div>
                          <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>
                            {getValue(row, ['request_no', 'succession_request_id', 'id']) || 'Recovered case'}
                          </div>
                          <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>
                            Property: {getValue(row, ['property_id']) || 'N/A'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <StatusPill value={getValue(row, ['status']) || 'PENDING'} />
                            {getValue(row, ['lro_status']) && <StatusPill value={getValue(row, ['lro_status'])} bg="#eff6ff" color="#1d4ed8" />}
                            {getValue(row, ['dc_status']) && <StatusPill value={getValue(row, ['dc_status'])} bg="#ecfdf5" color="#047857" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.3rem' }}>
                {!selectedRequest ? (
                  <div style={{ color: T.muted }}>Select a succession case from the queue to inspect its details.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '.72rem', color: T.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45, marginBottom: 6 }}>
                          Selected Case
                        </div>
                        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.22rem', color: T.text }}>
                          {getValue(selectedRequest, ['request_no', 'succession_request_id', 'id']) || 'Recovered case'}
                        </div>
                      </div>
                      <StatusPill value={getValue(selectedRequest, ['status']) || 'PENDING'} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.85rem' }}>
                      <Box label="Property ID" value={getValue(selectedRequest, ['property_id'])} />
                      <Box label="Request Type" value={getValue(selectedRequest, ['request_type'])} />
                      <Box label="LRO Status" value={getValue(selectedRequest, ['lro_status'])} />
                      <Box label="DC Status" value={getValue(selectedRequest, ['dc_status'])} />
                      <Box label="Current Status" value={getValue(selectedRequest, ['status'])} />
                      <Box label="Submitted At" value={fmtDateTime(getValue(selectedRequest, ['submitted_at', 'created_at']))} />
                    </div>
                  </>
                )}
              </div>

              <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.3rem' }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: '1rem' }}>
                  Heir Allocation Snapshot
                </div>
                {!selectedRequest ? (
                  <div style={{ color: T.muted }}>Choose a case to inspect heirs.</div>
                ) : !heirs.length ? (
                  <div style={{ color: T.muted }}>No heir rows were found for this request in the current recovery snapshot.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.8rem' }}>
                    {heirs.map((heir, index) => (
                      <div key={`${heir.succession_request_id}-${index}`} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '0.95rem', background: '#f8fafc' }}>
                        <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>
                          {getValue(heir, ['heir_name', 'name', 'nominee_name']) || `Heir ${index + 1}`}
                        </div>
                        <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>
                          Relation: {getValue(heir, ['relation_type']) || 'N/A'}
                        </div>
                        <div style={{ color: T.muted, fontSize: '.76rem' }}>
                          Share: {getValue(heir, ['share_percent', 'share_ratio', 'share']) || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.3rem' }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: T.text, marginBottom: '1rem' }}>
                  Audit Trail
                </div>
                {!selectedRequest ? (
                  <div style={{ color: T.muted }}>Choose a case to inspect events.</div>
                ) : !events.length ? (
                  <div style={{ color: T.muted }}>No event rows were found for this request in the current recovery snapshot.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {events.map((event, index) => (
                      <div key={`${event.succession_request_id}-${index}`} style={{ borderLeft: `4px solid ${T.primary}`, padding: '0.25rem 0 0.25rem 0.9rem' }}>
                        <div style={{ fontWeight: 800, color: T.text, marginBottom: 3 }}>
                          {getValue(event, ['event_type']) || 'Recovered event'}
                        </div>
                        <div style={{ color: T.text2, fontSize: '.83rem', marginBottom: 3 }}>
                          Actor: {getValue(event, ['actor_role']) || 'N/A'}
                        </div>
                        <div style={{ color: T.muted, fontSize: '.76rem' }}>
                          {fmtDateTime(getValue(event, ['created_at']))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </OfficerLayout>
  );
};

export default OfficerSuccessionCases;
