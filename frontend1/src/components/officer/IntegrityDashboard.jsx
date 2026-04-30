import React, { useEffect, useState } from 'react';
import OfficerLayout, { T, S, fmtDateTime } from './OfficerLayout';

const FILTERS = [
  { key: 'ALL', label: 'All Records' },
  { key: 'CLEAN', label: 'Clean' },
  { key: 'TAMPERED', label: 'Tampered' },
  { key: 'NOT_ON_CHAIN', label: 'Not On Chain' },
];

const cardTone = {
  CLEAN: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  TAMPERED: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  NOT_ON_CHAIN: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  ALL: { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
};

function getTone(status) {
  return cardTone[status] || cardTone.ALL;
}

function formatStatus(status) {
  if (status === 'NOT_ON_CHAIN') return 'Not On Chain';
  return String(status || 'Unknown').replace(/_/g, ' ');
}

const SummaryCard = ({ icon, value, label, toneKey }) => {
  const tone = getTone(toneKey);
  return (
    <div style={{
      background: 'white',
      borderRadius: 18,
      border: `1px solid ${tone.border}`,
      boxShadow: S.md,
      padding: '1.35rem',
    }}>
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        background: tone.bg,
        color: tone.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.15rem',
        marginBottom: '0.9rem',
      }}>
        <i className={icon} />
      </div>
      <div style={{ fontSize: '2.25rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: '.85rem', fontWeight: 700, color: T.text2 }}>{label}</div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const tone = getTone(status);
  return (
    <span style={{
      padding: '5px 10px',
      borderRadius: 999,
      background: tone.bg,
      color: tone.color,
      fontSize: '.72rem',
      fontWeight: 800,
      letterSpacing: .25,
      textTransform: 'uppercase',
    }}>
      {formatStatus(status)}
    </span>
  );
};

const DetailBox = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '0.95rem' }}>
    <div style={{ fontSize: '.69rem', fontWeight: 800, color: T.muted, letterSpacing: .45, textTransform: 'uppercase', marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ fontSize: '.9rem', fontWeight: 700, color: T.text }}>{value || 'N/A'}</div>
  </div>
);

const IntegrityDashboard = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState({ summary: null, records: [] });
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${base}/api/officer/integrity/summary`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load integrity summary');
      }
      setPayload({
        summary: data.summary,
        records: data.records || [],
      });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authToken) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const records = payload.records || [];
  const filteredRecords = activeFilter === 'ALL'
    ? records
    : records.filter((item) => item.integrity === activeFilter);

  useEffect(() => {
    if (!filteredRecords.length) {
      setSelectedId('');
      return;
    }
    if (!filteredRecords.some((item) => item.property_id === selectedId)) {
      setSelectedId(filteredRecords[0].property_id);
    }
  }, [filteredRecords, selectedId]);

  const selectedRecord = filteredRecords.find((item) => item.property_id === selectedId) || null;

  return (
    <OfficerLayout title="Integrity Dashboard">
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{
          background: 'white',
          borderRadius: 22,
          boxShadow: S.md,
          padding: '1.6rem 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: T.text, marginBottom: 6 }}>
              Property Integrity Review
            </div>
            <div style={{ color: T.text2, fontSize: '.92rem' }}>
              Clean, tampered and missing ledger records are separated here so we can quickly inspect what still needs attention.
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
          <SummaryCard icon="fas fa-database" value={payload.summary?.scannedRecords || 0} label="Scanned Records" toneKey="ALL" />
          <SummaryCard icon="fas fa-shield-alt" value={payload.summary?.clean || 0} label="Clean" toneKey="CLEAN" />
          <SummaryCard icon="fas fa-exclamation-triangle" value={payload.summary?.tampered || 0} label="Tampered" toneKey="TAMPERED" />
          <SummaryCard icon="fas fa-unlink" value={payload.summary?.notOnChain || 0} label="Not On Chain" toneKey="NOT_ON_CHAIN" />
        </div>

        <div style={{
          background: 'white',
          borderRadius: 22,
          boxShadow: S.md,
          padding: '1rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          {FILTERS.map((filter) => {
            const active = filter.key === activeFilter;
            return (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                style={{
                  border: active ? 'none' : `1px solid ${T.border}`,
                  borderRadius: 999,
                  padding: '9px 15px',
                  background: active ? `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})` : 'white',
                  color: active ? 'white' : T.text2,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '4rem', textAlign: 'center', color: T.muted }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem' }} />
            <div>Loading integrity records...</div>
          </div>
        ) : error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 18, color: '#b91c1c', padding: '1rem 1.15rem' }}>
            <strong>Unable to load integrity dashboard:</strong> {error}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '1.25rem', alignItems: 'start' }}>
            <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${T.border}`, fontWeight: 800, color: T.text }}>
                Property Records
              </div>
              {!filteredRecords.length ? (
                <div style={{ padding: '2rem 1.2rem', color: T.muted }}>No records found for this filter.</div>
              ) : (
                <div style={{ maxHeight: 680, overflowY: 'auto' }}>
                  {filteredRecords.map((record, index) => {
                    const active = record.property_id === selectedId;
                    return (
                      <button
                        key={record.property_id}
                        onClick={() => setSelectedId(record.property_id)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: active ? '#eef2ff' : 'white',
                          borderBottom: `1px solid ${T.border}`,
                          padding: '0.95rem 1rem',
                          display: 'grid',
                          gridTemplateColumns: '52px minmax(0,1fr) auto',
                          gap: '0.9rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: active ? T.primaryDark : T.text }}>
                          {index + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>{record.property_id}</div>
                          <div style={{ color: T.text2, fontSize: '.84rem', marginBottom: 4 }}>
                            {[record.district, record.tehsil, record.mauza].filter(Boolean).join(', ') || 'Location pending'}
                          </div>
                          <div style={{ color: T.muted, fontSize: '.77rem' }}>
                            {record.owner_name || 'Owner unavailable'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <StatusBadge status={record.integrity} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, padding: '1.3rem' }}>
                {!selectedRecord ? (
                  <div style={{ color: T.muted }}>Select a property from the list to inspect its current ledger integrity.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '.78rem', color: T.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45, marginBottom: 6 }}>
                          Selected Property
                        </div>
                        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.25rem', color: T.text }}>
                          {selectedRecord.property_id}
                        </div>
                      </div>
                      <StatusBadge status={selectedRecord.integrity} />
                    </div>

                    {selectedRecord.integrity === 'TAMPERED' && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 14, padding: '0.95rem', marginBottom: '1rem' }}>
                        <strong>Tamper detected.</strong> This property has a ledger verification mismatch and should be reviewed before any further approval action.
                      </div>
                    )}

                    {selectedRecord.integrity === 'NOT_ON_CHAIN' && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#a16207', borderRadius: 14, padding: '0.95rem', marginBottom: '1rem' }}>
                        <strong>Not yet anchored.</strong> The property exists locally but no ledger record was found for it in the current chain summary.
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.85rem' }}>
                      <DetailBox label="Owner" value={selectedRecord.owner_name} />
                      <DetailBox label="District / Tehsil" value={[selectedRecord.district, selectedRecord.tehsil].filter(Boolean).join(', ')} />
                      <DetailBox label="Mauza" value={selectedRecord.mauza} />
                      <DetailBox label="Area" value={selectedRecord.area_marla ? `${selectedRecord.area_marla} Marla` : 'N/A'} />
                      <DetailBox label="Property Type" value={selectedRecord.property_type} />
                      <DetailBox label="Proof Source" value={selectedRecord.proofSource} />
                      <DetailBox label="Ledger Block" value={selectedRecord.block_index ?? 'Not recorded'} />
                      <DetailBox label="Latest Ledger Time" value={fmtDateTime(selectedRecord.mined_at)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </OfficerLayout>
  );
};

export default IntegrityDashboard;
