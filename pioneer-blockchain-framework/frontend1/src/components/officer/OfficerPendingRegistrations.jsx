import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OfficerLayout, { T, S, fmtCnic, fmtDateTime } from './OfficerLayout';

const Panel = ({ title, subtitle, action, children }) => (
  <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, overflow: 'hidden' }}>
    <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, color: T.text, marginBottom: 4 }}>{title}</div>
        {subtitle ? <div style={{ color: T.text2, fontSize: '.84rem' }}>{subtitle}</div> : null}
      </div>
      {action}
    </div>
    <div style={{ padding: '1.15rem 1.2rem' }}>{children}</div>
  </div>
);

const MetricCard = ({ label, value, tone = T.primary, icon }) => (
  <div style={{ background: 'white', borderRadius: 18, boxShadow: S.md, padding: '1.15rem 1.2rem', borderTop: `4px solid ${tone}` }}>
    <div style={{ width: 46, height: 46, borderRadius: 14, background: `${tone}18`, color: tone, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '.9rem' }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: T.text, lineHeight: 1, marginBottom: 6 }}>{value}</div>
    <div style={{ color: T.text2, fontWeight: 700, fontSize: '.84rem' }}>{label}</div>
  </div>
);

const DetailItem = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem .95rem' }}>
    <div style={{ fontSize: '.69rem', color: T.muted, fontWeight: 800, letterSpacing: .45, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
    <div style={{ color: T.text, fontWeight: 700, fontSize: '.9rem' }}>{value || 'N/A'}</div>
  </div>
);

const ToneBadge = ({ label, background, color }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background, color, padding: '6px 11px', borderRadius: 999, fontWeight: 800, fontSize: '.72rem', letterSpacing: .3, textTransform: 'uppercase' }}>
    <i className="fas fa-circle" style={{ fontSize: '.42rem' }} />
    {label}
  </span>
);

const ActionButton = ({ children, onClick, busy, tone = T.primary, outline = false, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled || busy}
    style={{
      border: outline ? `1px solid ${T.border}` : 'none',
      borderRadius: 12,
      padding: '11px 16px',
      background: outline ? 'white' : tone,
      color: outline ? T.text2 : 'white',
      fontWeight: 800,
      cursor: disabled || busy ? 'not-allowed' : 'pointer',
      opacity: disabled || busy ? .7 : 1,
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    {busy ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Working...</> : children}
  </button>
);

const Modal = ({ title, children, footer, onClose, headerTone }) => (
  <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.42)', zIndex: 600, backdropFilter: 'blur(4px)' }} />
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, 94vw)', background: 'white', borderRadius: 22, boxShadow: '0 20px 70px rgba(15,23,42,.24)', zIndex: 601, overflow: 'hidden' }}>
      <div style={{ background: headerTone, color: 'white', padding: '1.15rem 1.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: 'white', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer' }}>
          <i className="fas fa-times" />
        </button>
      </div>
      <div style={{ padding: '1.2rem 1.3rem' }}>{children}</div>
      <div style={{ padding: '1rem 1.3rem', borderTop: `1px solid ${T.border}`, background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '.7rem' }}>
        {footer}
      </div>
    </div>
  </>
);

const OfficerPendingRegistrations = () => {
  const navigate = useNavigate();
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');
  const api = `${base}/api`;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${api}/registration-voting/lro/pending-submissions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load pending registrations');
      }
      setRecords(data.properties || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!records.length) {
      setSelectedId('');
      return;
    }
    if (!records.some((record) => record.property_id === selectedId)) {
      setSelectedId(records[0].property_id);
    }
  }, [records, selectedId]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.property_id === selectedId) || null,
    [records, selectedId]
  );

  const submitForVoting = async (propertyId) => {
    setBusyAction(`submit:${propertyId}`);
    setMessage(null);
    try {
      const response = await fetch(`${api}/registration-voting/lro/${propertyId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to submit property for voting');
      }
      setMessage({ type: 'success', text: `Property ${propertyId} moved into 5-node voting.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusyAction('');
  };

  const confirmReject = async () => {
    if (!selectedRecord || !rejectReason.trim()) return;
    setBusyAction(`reject:${selectedRecord.property_id}`);
    setMessage(null);
    try {
      const response = await fetch(`${api}/properties/reject-property`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: selectedRecord.property_id,
          reason: rejectReason.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to reject property');
      }
      setRejectModal(false);
      setRejectReason('');
      setMessage({ type: 'success', text: `Property ${selectedRecord.property_id} rejected successfully.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusyAction('');
  };

  return (
    <OfficerLayout title="Pending Registrations">
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{ background: 'white', borderRadius: 24, boxShadow: S.md, padding: '1.45rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.55rem', color: T.text, marginBottom: 6 }}>
                Registration Intake Queue
              </div>
              <div style={{ color: T.text2, fontSize: '.92rem', maxWidth: 760 }}>
                Review freshly added land records here. Clean cases move into the 5-node LRO voting stage, and only cases with enough approvals move onward for DC final review.
              </div>
            </div>
            <ActionButton onClick={load} outline>
              <i className="fas fa-sync-alt" style={{ marginRight: 8 }} />
              Refresh
            </ActionButton>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
          <MetricCard label="Waiting Intake Cases" value={records.length} icon="fas fa-file-circle-plus" tone={T.warning} />
          <MetricCard label="Next Stage" value="5" icon="fas fa-users" tone={T.primary} />
          <MetricCard label="Votes Required" value="3" icon="fas fa-check-double" tone={T.success} />
        </div>

        {message ? (
          <div style={{
            background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
            borderRadius: 16,
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            padding: '.95rem 1rem',
            fontWeight: 700,
          }}>
            {message.text}
          </div>
        ) : null}

        {error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', padding: '.95rem 1rem' }}>
            <strong>Pending registrations error:</strong> {error}
          </div>
        ) : null}

        {loading ? (
          <Panel title="Loading queue">
            <div style={{ textAlign: 'center', color: T.muted, padding: '3.5rem 0' }}>
              <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem', display: 'block' }} />
              Loading pending registrations...
            </div>
          </Panel>
        ) : !records.length ? (
          <Panel title="Pending Registrations" subtitle="Nothing is waiting in the intake queue right now.">
            <div style={{ textAlign: 'center', color: T.muted, padding: '3rem 0' }}>
              <i className="fas fa-check-circle fa-3x" style={{ display: 'block', marginBottom: '.9rem', color: T.success }} />
              All newly added registration cases have already been handled.
            </div>
          </Panel>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1.05fr) minmax(360px, .95fr)', gap: '1.25rem', alignItems: 'start' }}>
            <Panel title="Case List" subtitle="Select a property row to inspect the intake details before submission.">
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(0,1.5fr) minmax(0,1fr) 140px', background: '#f8fafc', color: T.text2, fontWeight: 800, fontSize: '.76rem', textTransform: 'uppercase', letterSpacing: .35, padding: '.8rem 1rem', gap: '.8rem' }}>
                  <div>#</div>
                  <div>Property</div>
                  <div>Owner</div>
                  <div>Stage</div>
                </div>
                <div style={{ maxHeight: 720, overflowY: 'auto' }}>
                  {records.map((record, index) => {
                    const active = record.property_id === selectedId;
                    return (
                      <button
                        key={record.property_id}
                        onClick={() => setSelectedId(record.property_id)}
                        style={{
                          width: '100%',
                          border: 'none',
                          borderTop: `1px solid ${T.border}`,
                          background: active ? '#eef6ff' : 'white',
                          display: 'grid',
                          gridTemplateColumns: '58px minmax(0,1.5fr) minmax(0,1fr) 140px',
                          gap: '.8rem',
                          padding: '.95rem 1rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: active ? T.primaryDark : T.text }}>{index + 1}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>{record.property_id}</div>
                          <div style={{ color: T.text2, fontSize: '.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {[record.district, record.tehsil, record.mauza].filter(Boolean).join(', ')}
                          </div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: T.text, fontWeight: 700, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.owner_name || 'N/A'}</div>
                          <div style={{ color: T.muted, fontSize: '.76rem' }}>{fmtCnic(record.owner_cnic)}</div>
                        </div>
                        <div>
                          <ToneBadge label="Intake" background="#fff7ed" color="#c2410c" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>

            <Panel
              title={selectedRecord ? selectedRecord.property_id : 'Property Details'}
              subtitle={selectedRecord ? 'Review the record, then move it into voting or reject it here.' : 'Select a property first.'}
            >
              {!selectedRecord ? (
                <div style={{ color: T.muted }}>Choose a registration case from the left list to see details.</div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <ToneBadge label="Ready For LRO Review" background="#eff6ff" color="#1d4ed8" />
                    <div style={{ color: T.muted, fontSize: '.8rem' }}>Submitted {fmtDateTime(selectedRecord.created_at)}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '.85rem' }}>
                    <DetailItem label="Owner Name" value={selectedRecord.owner_name} />
                    <DetailItem label="Owner CNIC" value={fmtCnic(selectedRecord.owner_cnic)} />
                    <DetailItem label="Father Name" value={selectedRecord.father_name} />
                    <DetailItem label="District / Tehsil" value={[selectedRecord.district, selectedRecord.tehsil].filter(Boolean).join(', ')} />
                    <DetailItem label="Mauza" value={selectedRecord.mauza} />
                    <DetailItem label="Khewat" value={selectedRecord.khewat_no} />
                    <DetailItem label="Khatooni" value={selectedRecord.khatooni_no} />
                    <DetailItem label="Khasra" value={selectedRecord.khasra_no} />
                    <DetailItem label="Area" value={selectedRecord.area_marla ? `${selectedRecord.area_marla} Marla` : 'N/A'} />
                    <DetailItem label="Type" value={selectedRecord.property_type} />
                    <DetailItem label="Address" value={selectedRecord.address} />
                    <DetailItem label="Year" value={selectedRecord.year} />
                  </div>

                  <div style={{ borderRadius: 16, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem 1.05rem', color: '#1d4ed8' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      <i className="fas fa-circle-info" style={{ marginRight: 8 }} />
                      What happens after submission
                    </div>
                    <div style={{ fontSize: '.84rem', lineHeight: 1.6 }}>
                      This property moves into the shared LRO vote queue. The five mapped LRO nodes can cast one vote each, and once at least three approvals are recorded, the case moves forward for DC final approval.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap' }}>
                    <ActionButton
                      onClick={() => submitForVoting(selectedRecord.property_id)}
                      busy={busyAction === `submit:${selectedRecord.property_id}`}
                      tone={T.success}
                    >
                      <i className="fas fa-paper-plane" style={{ marginRight: 8 }} />
                      Submit For Voting
                    </ActionButton>
                    <ActionButton
                      onClick={() => {
                        setRejectReason('');
                        setRejectModal(true);
                      }}
                      busy={busyAction === `reject:${selectedRecord.property_id}`}
                      tone={T.danger}
                    >
                      <i className="fas fa-ban" style={{ marginRight: 8 }} />
                      Reject Case
                    </ActionButton>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>

      {rejectModal && selectedRecord ? (
        <Modal
          title={`Reject ${selectedRecord.property_id}`}
          onClose={() => setRejectModal(false)}
          headerTone="linear-gradient(135deg,#dc2626,#ef4444)"
          footer={
            <>
              <ActionButton onClick={() => setRejectModal(false)} outline>
                Cancel
              </ActionButton>
              <ActionButton onClick={confirmReject} busy={busyAction === `reject:${selectedRecord.property_id}`} tone={T.danger} disabled={!rejectReason.trim()}>
                <i className="fas fa-times" style={{ marginRight: 8 }} />
                Confirm Reject
              </ActionButton>
            </>
          }
        >
          <div style={{ color: T.text2, fontSize: '.9rem', marginBottom: '.9rem' }}>
            Add a clear reason before rejecting this registration intake case.
          </div>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={5}
            placeholder="Write the reason for rejection..."
            style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 14, padding: '.95rem 1rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
          />
        </Modal>
      ) : null}
    </OfficerLayout>
  );
};

export default OfficerPendingRegistrations;
