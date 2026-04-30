import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

const P = {
  ink: '#132235',
  text: '#42586f',
  muted: '#7e90a3',
  border: '#d9e3ec',
  surface: '#ffffff',
  surface2: '#f6fafe',
  page: '#eef4f9',
  blue: '#315d87',
  blueDark: '#1f3f5f',
  blueSoft: '#e8f1f8',
  blueBorder: '#c8d9e8',
  green: '#1d8a64',
  greenSoft: '#e9f8f1',
  greenBorder: '#bde5d5',
  gold: '#b6852d',
  goldSoft: '#fbf4e5',
  goldBorder: '#ead7a7',
  red: '#b42318',
  redSoft: '#fef3f2',
  redBorder: '#fecdca',
};

const viewerCopy = {
  citizen: {
    eyebrow: 'Citizen Registry',
    title: 'Ownership History',
    subtitle: 'See how each property moved from first registration through later transfers and approved succession allocations.',
    listTitle: 'Your Properties',
    listHint: 'Select a property to inspect its complete ownership chain.',
    empty: 'Your properties will appear here once they are approved in the registry.',
  },
  officer: {
    eyebrow: 'Investigation Workspace',
    title: 'Ownership History',
    subtitle: 'Search registered properties and inspect the original registration, transfers, and succession-linked history in one ordered timeline.',
    listTitle: 'Property Register',
    listHint: 'Search by property ID, fard, khasra, or khatooni to inspect land history.',
    empty: 'No matching registered properties were found.',
  },
  admin: {
    eyebrow: 'System Verification',
    title: 'Ownership History',
    subtitle: 'Use this to verify how ownership moved across approved workflows without opening raw database tables.',
    listTitle: 'Tracked Properties',
    listHint: 'Search a property and review the history chain alongside the current record.',
    empty: 'No tracked properties were returned.',
  },
};

const wrap = {
  display: 'grid',
  gap: '1.1rem',
};

const hero = {
  background: 'linear-gradient(135deg, #f8fbff 0%, #eef6ff 54%, #f7fffd 100%)',
  border: `1px solid ${P.border}`,
  borderRadius: 28,
  boxShadow: '0 20px 46px rgba(32,58,86,.10), 0 6px 16px rgba(24,40,56,.04)',
  padding: '1.45rem 1.55rem',
};

const card = {
  background: P.surface,
  border: `1px solid ${P.border}`,
  borderRadius: 24,
  boxShadow: '0 18px 38px rgba(32,58,86,.08)',
};

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '1.1rem',
  alignItems: 'start',
};

const badgeTone = (type = '') => {
  const normalized = String(type).toUpperCase();
  if (normalized === 'REGISTRATION') return { bg: P.blueSoft, border: P.blueBorder, color: P.blue };
  if (normalized === 'SUCCESSION' || normalized === 'SUCCESSION_ALLOCATION') return { bg: P.greenSoft, border: P.greenBorder, color: P.green };
  if (normalized === 'SALE' || normalized === 'TRANSFER') return { bg: P.goldSoft, border: P.goldBorder, color: P.gold };
  return { bg: '#f1f5f9', border: '#dbe3eb', color: '#475569' };
};

const money = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '--';
  return `PKR ${parsed.toLocaleString()}`;
};

const dateTime = (value) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ownershipLabel = (event) => {
  const normalized = String(event?.transfer_type || event?.event_type || '').toUpperCase();
  if (normalized === 'REGISTRATION' || normalized === 'ORIGINAL_REGISTRATION') return 'Original Registration';
  if (normalized === 'SUCCESSION' || normalized === 'SUCCESSION_ALLOCATION') return 'Succession Allocation';
  if (normalized === 'SALE' || normalized === 'TRANSFER' || normalized === 'OWNERSHIP_TRANSFER') return 'Transfer';
  return normalized || 'History Event';
};

const ownerName = (event, side) => {
  if (side === 'previous') return event.previous_owner_name || '--';
  return event.new_owner_name || event.owner_name || '--';
};

const ownerCnic = (event, side) => {
  if (side === 'previous') return event.previous_owner_cnic || '--';
  return event.new_owner_cnic || event.owner_cnic || '--';
};

function TimelineItem({ event, index }) {
  const tone = badgeTone(event.transfer_type || event.event_type);
  const isRegistration = String(event.event_type || event.transfer_type || '').toUpperCase().includes('REGISTRATION');
  const isSuccession = String(event.event_type || event.transfer_type || '').toUpperCase().includes('SUCCESSION');

  return (
    <div
      style={{
        position: 'relative',
        padding: '1rem 1rem 1rem 4rem',
        borderBottom: `1px solid ${P.border}`,
        background: index % 2 ? '#fcfdff' : '#ffffff',
      }}
    >
      <div style={{
        position: 'absolute',
        left: 22,
        top: 22,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: tone.color,
        boxShadow: `0 0 0 6px ${tone.bg}`,
      }} />
      <div style={{
        position: 'absolute',
        left: 28,
        top: 38,
        bottom: -2,
        width: 2,
        background: '#dbe6ef',
        display: index === 0 ? 'none' : 'block',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ color: P.ink, fontSize: '.96rem' }}>{ownershipLabel(event)}</strong>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 999,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
            color: tone.color,
            fontSize: '.72rem',
            fontWeight: 800,
          }}>
            {String(event.transfer_type || '').toUpperCase() || 'HISTORY'}
          </span>
        </div>
        <div style={{ color: P.muted, fontSize: '.78rem', fontWeight: 700 }}>{dateTime(event.event_date || event.transfer_date)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isRegistration ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.9rem', marginTop: '.9rem' }}>
        {!isRegistration && (
          <div style={{ border: `1px solid ${P.border}`, borderRadius: 18, background: '#fbfdff', padding: '.9rem' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: P.muted, marginBottom: 6 }}>
              Previous Owner
            </div>
            <div style={{ color: P.ink, fontWeight: 800 }}>{ownerName(event, 'previous')}</div>
            <div style={{ color: P.text, fontSize: '.8rem', marginTop: 4 }}>{ownerCnic(event, 'previous')}</div>
          </div>
        )}
        <div style={{ border: `1px solid ${P.border}`, borderRadius: 18, background: isSuccession ? '#fcfffd' : '#fbfdff', padding: '.9rem' }}>
          <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: P.muted, marginBottom: 6 }}>
            {isRegistration ? 'Registered Owner' : isSuccession ? 'Approved Heir' : 'New Owner'}
          </div>
          <div style={{ color: P.ink, fontWeight: 800 }}>{ownerName(event, 'new')}</div>
          <div style={{ color: P.text, fontSize: '.8rem', marginTop: 4 }}>{ownerCnic(event, 'new')}</div>
          {event.new_owner_father_name ? (
            <div style={{ color: P.muted, fontSize: '.75rem', marginTop: 6 }}>Father: {event.new_owner_father_name}</div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '.9rem' }}>
        <span style={{ color: P.text, fontSize: '.8rem' }}><strong style={{ color: P.ink }}>Amount:</strong> {money(event.transfer_amount)}</span>
        {event.transfer_id ? <span style={{ color: P.text, fontSize: '.8rem' }}><strong style={{ color: P.ink }}>Transfer ID:</strong> {event.transfer_id}</span> : null}
        {event.reference_type && event.reference_id ? <span style={{ color: P.text, fontSize: '.8rem' }}><strong style={{ color: P.ink }}>Reference:</strong> {event.reference_type} / {event.reference_id}</span> : null}
      </div>

      {event.remarks ? (
        <div style={{
          marginTop: '.85rem',
          padding: '.8rem .9rem',
          borderRadius: 16,
          background: '#f8fbfd',
          border: `1px solid ${P.border}`,
          color: P.text,
          fontSize: '.82rem',
          lineHeight: 1.65,
        }}>
          <strong style={{ color: P.ink }}>Notes:</strong> {event.remarks}
        </div>
      ) : null}
    </div>
  );
}

const OwnershipHistoryWorkspace = ({ viewer = 'citizen' }) => {
  const copy = viewerCopy[viewer] || viewerCopy.citizen;
  const authToken = sessionStorage.getItem('authToken');
  const headers = useMemo(() => ({ Authorization: `Bearer ${authToken}` }), [authToken]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('propertyId') || '');

  const filteredCitizenItems = useMemo(() => {
    if (viewer !== 'citizen') return items;
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.property_id, item.owner_name, item.owner_cnic, item.district, item.tehsil, item.khasra_no, item.fard_no]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [items, search, viewer]);

  const listItems = viewer === 'citizen' ? filteredCitizenItems : items;

  useEffect(() => {
    if (!authToken) return;
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, viewer]);

  useEffect(() => {
    if (viewer === 'citizen') return;
    const handle = window.setTimeout(() => {
      loadList();
    }, 260);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, viewer]);

  useEffect(() => {
    const requested = searchParams.get('propertyId');
    if (requested && requested !== selectedId) {
      setSelectedId(requested);
    }
  }, [searchParams, selectedId]);

  useEffect(() => {
    if (!listItems.length) {
      setDetail(null);
      return;
    }

    const fallbackId = listItems[0]?.property_id || '';
    const nextId = selectedId && listItems.some((item) => item.property_id === selectedId)
      ? selectedId
      : fallbackId;

    if (!nextId) return;
    if (nextId !== selectedId) {
      setSelectedId(nextId);
      const params = new URLSearchParams(searchParams);
      params.set('propertyId', nextId);
      setSearchParams(params, { replace: true });
      return;
    }

    loadDetail(nextId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listItems, selectedId]);

  const loadList = async () => {
    setLoadingList(true);
    setError('');

    try {
      if (viewer === 'citizen') {
        const [ownedRes, sharedRes] = await Promise.all([
          fetch(`${BASE}/api/properties/my-properties`, { headers }),
          fetch(`${BASE}/api/properties/my-share-properties`, { headers }),
        ]);
        const [ownedData, sharedData] = await Promise.all([
          ownedRes.json().catch(() => ({})),
          sharedRes.json().catch(() => ({})),
        ]);
        if (!ownedRes.ok || ownedData.success === false) {
          throw new Error(ownedData.message || 'Unable to load your property register');
        }

        const merged = new Map();
        (ownedData.properties || []).forEach((item) => {
          merged.set(item.property_id, { ...item, _citizenViewType: 'DIRECT' });
        });
        const shareRows = sharedData.properties || sharedData.shares || [];
        shareRows.forEach((item) => {
          const existing = merged.get(item.property_id);
          merged.set(item.property_id, {
            ...existing,
            ...item,
            _citizenViewType: existing ? 'DIRECT_AND_SHARE' : 'SHARE',
          });
        });

        setItems([...merged.values()]);
        return;
      }

      const term = search.trim();
      const endpoint = term.length >= 2
        ? `${BASE}/api/ownership-history/search/${encodeURIComponent(term)}`
        : `${BASE}/api/ownership-history/all/properties-with-history`;

      const response = await fetch(endpoint, { headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to load ownership-history register');
      }
      setItems(data.properties || []);
    } catch (err) {
      setItems([]);
      setError(err.message || 'Unable to load ownership-history register');
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (propertyId) => {
    if (!propertyId) return;
    setLoadingDetail(true);

    try {
      const response = await fetch(`${BASE}/api/ownership-history/${propertyId}`, { headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to load ownership history');
      }
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setError(err.message || 'Unable to load ownership history');
    } finally {
      setLoadingDetail(false);
    }
  };

  const selectProperty = (propertyId) => {
    setSelectedId(propertyId);
    const params = new URLSearchParams(searchParams);
    params.set('propertyId', propertyId);
    setSearchParams(params, { replace: true });
  };

  const selectedSummary = detail?.property || listItems.find((item) => item.property_id === selectedId) || null;

  return (
    <div style={wrap}>
      <div style={hero}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: '#e0f2fe', color: '#075985', fontWeight: 800, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {copy.eyebrow}
        </div>
        <div style={{ display: 'grid', gap: '.8rem', marginTop: '.95rem' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.7rem', color: P.ink }}>
            {copy.title}
          </div>
          <div style={{ color: P.text, fontSize: '.95rem', lineHeight: 1.72, maxWidth: 920 }}>
            {copy.subtitle}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.7rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, background: P.blueSoft, border: `1px solid ${P.blueBorder}`, color: P.blue, fontWeight: 800, fontSize: '.76rem' }}>
              <i className="fas fa-folder-tree" /> {listItems.length} properties
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, background: P.greenSoft, border: `1px solid ${P.greenBorder}`, color: P.green, fontWeight: 800, fontSize: '.76rem' }}>
              <i className="fas fa-history" /> {detail?.ownership_chain?.length || detail?.history_records?.length || 0} history events
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ ...card, padding: '1rem 1.1rem', color: P.red, background: P.redSoft, borderColor: P.redBorder }}>
          <strong>Ownership history error:</strong> {error}
        </div>
      ) : null}

      <div style={grid}>
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.1rem', borderBottom: `1px solid ${P.border}`, background: 'linear-gradient(180deg, #fbfdff, #f4f8fc)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, color: P.ink }}>{copy.listTitle}</div>
                <div style={{ color: P.muted, fontSize: '.78rem', marginTop: 4 }}>{copy.listHint}</div>
              </div>
              <button
                type="button"
                onClick={loadList}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 14,
                  border: `1px solid ${P.border}`,
                  background: '#ffffff',
                  color: P.text,
                  padding: '9px 12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-rotate-right" />
                Refresh
              </button>
            </div>

            <div style={{ position: 'relative', marginTop: '.9rem' }}>
              <i className="fas fa-magnifying-glass" style={{ position: 'absolute', left: 14, top: 13, color: P.muted, fontSize: '.82rem' }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={viewer === 'citizen' ? 'Search by property, owner, district, or CNIC' : 'Search property ID, fard, khasra, khatooni'}
                style={{
                  width: '100%',
                  borderRadius: 16,
                  border: `1px solid ${P.border}`,
                  background: '#ffffff',
                  padding: '11px 14px 11px 38px',
                  fontSize: '.85rem',
                  color: P.ink,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ padding: '1.4rem', color: P.muted }}>Loading property register...</div>
            ) : !listItems.length ? (
              <div style={{ padding: '1.4rem', color: P.muted }}>{copy.empty}</div>
            ) : (
              listItems.map((item, index) => {
                const active = item.property_id === selectedId;
                return (
                  <button
                    key={item.property_id}
                    type="button"
                    onClick={() => selectProperty(item.property_id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: `1px solid ${P.border}`,
                      background: active ? 'linear-gradient(135deg, #f4f9ff, #f9fffd)' : '#ffffff',
                      padding: '1rem 1.1rem',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: active ? P.blueSoft : P.goldSoft,
                        border: `1px solid ${active ? P.blueBorder : P.goldBorder}`,
                        color: active ? P.blue : P.gold,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '.76rem',
                        flexShrink: 0,
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <strong style={{ color: P.ink, fontSize: '.92rem' }}>{item.property_id}</strong>
                          {item.transfer_count !== undefined ? (
                            <span style={{ color: P.muted, fontSize: '.72rem', fontWeight: 800 }}>
                              {item.transfer_count} sale event{Number(item.transfer_count) === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ color: P.text, fontSize: '.82rem', marginTop: 6, lineHeight: 1.55 }}>
                          {(item.district || selectedSummary?.district) ? `${item.district || selectedSummary?.district}, ${item.tehsil || selectedSummary?.tehsil || '--'}` : (item.owner_name || 'Property')}
                        </div>
                        <div style={{ display: 'flex', gap: '.9rem', flexWrap: 'wrap', marginTop: 8, color: P.muted, fontSize: '.74rem' }}>
                          {item.owner_name ? <span><strong style={{ color: P.text }}>Owner:</strong> {item.owner_name}</span> : null}
                          {item.owner_cnic ? <span><strong style={{ color: P.text }}>CNIC:</strong> {item.owner_cnic}</span> : null}
                          {item.property_type ? <span><strong style={{ color: P.text }}>Type:</strong> {item.property_type}</span> : null}
                          {viewer === 'citizen' && item._citizenViewType ? (
                            <span>
                              <strong style={{ color: P.text }}>Access:</strong>{' '}
                              {item._citizenViewType === 'DIRECT' ? 'Direct' : item._citizenViewType === 'SHARE' ? 'Approved share' : 'Direct + share'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          {!selectedSummary ? (
            <div style={{ padding: '1.5rem', color: P.muted }}>Select a property to view its ownership history.</div>
          ) : (
            <>
              <div style={{
                padding: '1.15rem 1.25rem',
                borderBottom: `1px solid ${P.border}`,
                background: 'linear-gradient(135deg, #ffffff 0%, #f6fbff 100%)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.08rem', color: P.ink }}>
                      {selectedSummary.property_id}
                    </div>
                    <div style={{ color: P.text, fontSize: '.88rem', marginTop: 6 }}>
                      {selectedSummary.current_owner_name || selectedSummary.owner_name || '--'}
                    </div>
                    <div style={{ color: P.muted, fontSize: '.78rem', marginTop: 4 }}>
                      {(selectedSummary.district || '--')}, {(selectedSummary.tehsil || '--')} {selectedSummary.mauza ? `• ${selectedSummary.mauza}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: P.blueSoft, border: `1px solid ${P.blueBorder}`, color: P.blue, fontWeight: 800, fontSize: '.72rem' }}>
                      <i className="fas fa-user-shield" /> Current owner
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: P.greenSoft, border: `1px solid ${P.greenBorder}`, color: P.green, fontWeight: 800, fontSize: '.72rem' }}>
                      <i className="fas fa-clock-rotate-left" /> {detail?.ownership_chain?.length || detail?.history_records?.length || 0} events
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '.9rem', color: P.text, fontSize: '.8rem' }}>
                  <span><strong style={{ color: P.ink }}>Owner CNIC:</strong> {selectedSummary.current_owner_cnic || selectedSummary.owner_cnic || '--'}</span>
                  <span><strong style={{ color: P.ink }}>Property Type:</strong> {selectedSummary.property_type || '--'}</span>
                  <span><strong style={{ color: P.ink }}>Area:</strong> {selectedSummary.area_marla || '--'} Marla</span>
                </div>
              </div>

              <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {loadingDetail ? (
                  <div style={{ padding: '1.4rem', color: P.muted }}>Loading ownership timeline...</div>
                ) : !(detail?.ownership_chain?.length || detail?.history_records?.length) ? (
                  <div style={{ padding: '1.4rem', color: P.muted }}>No ownership events are recorded for this property yet.</div>
                ) : (
                  (detail.ownership_chain || detail.history_records || []).map((event, index) => (
                    <TimelineItem key={`${event.transfer_id || event.reference_id || event.event_date || index}-${index}`} event={event} index={index} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnershipHistoryWorkspace;
