import React, { useEffect, useMemo, useState } from 'react';
import OfficerLayout, { T, S, fmtDateTime } from '../officer/OfficerLayout';

const DC_NAV_LINKS = [
  { to: '/dc/dashboard', icon: 'fas fa-scale-balanced', label: 'Registration Approvals' },
  { to: '/dc/transfers', icon: 'fas fa-exchange-alt', label: 'Transfer Approvals' },
];

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

const SummaryCard = ({ label, value, icon, tone }) => (
  <div style={{ background: 'white', borderRadius: 18, boxShadow: S.md, padding: '1.15rem 1.2rem', borderTop: `4px solid ${tone}` }}>
    <div style={{ width: 46, height: 46, borderRadius: 14, background: `${tone}18`, color: tone, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '.85rem' }}>
      <i className={icon} />
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: T.text, lineHeight: 1, marginBottom: 6 }}>{value}</div>
    <div style={{ color: T.text2, fontWeight: 700, fontSize: '.84rem' }}>{label}</div>
  </div>
);

const Badge = ({ label, background, color }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, background, color, padding: '6px 11px', fontWeight: 800, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: .3 }}>
    <i className="fas fa-circle" style={{ fontSize: '.42rem' }} />
    {label}
  </span>
);

const DetailItem = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem .95rem' }}>
    <div style={{ fontSize: '.69rem', color: T.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45, marginBottom: 6 }}>{label}</div>
    <div style={{ color: T.text, fontWeight: 700, fontSize: '.9rem', wordBreak: 'break-word' }}>{value || 'N/A'}</div>
  </div>
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
      opacity: disabled || busy ? .72 : 1,
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    {busy ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Working...</> : children}
  </button>
);

const voteTone = (vote) => {
  const normalized = String(vote || '').toUpperCase();
  if (normalized === 'APPROVE') return { background: '#ecfdf5', color: '#047857' };
  if (normalized === 'REJECT') return { background: '#fef2f2', color: '#b91c1c' };
  return { background: '#f8fafc', color: T.text2 };
};

const DCTransferDashboard = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${base}/api/transfer-voting/dc/queue`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load transfer DC queue');
      }
      setRecords(data.cases || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authToken) loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!records.length) {
      setSelectedId('');
      return;
    }
    if (!records.some((record) => record.transfer_id === selectedId)) {
      setSelectedId(records[0].transfer_id);
    }
  }, [records, selectedId]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.transfer_id === selectedId) || null,
    [records, selectedId]
  );

  const handleApprove = async () => {
    if (!selectedRecord) return;
    setBusyAction('approve');
    setMessage(null);
    try {
      const response = await fetch(`${base}/api/transfer-voting/dc/${selectedRecord.transfer_id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: decisionNotes.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to finalize transfer approval');
      }
      setDecisionNotes('');
      setMessage({ type: 'success', text: `Transfer ${selectedRecord.transfer_id} was finalized successfully.` });
      await loadQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusyAction('');
  };

  const handleReject = async () => {
    if (!selectedRecord) return;
    if (!decisionNotes.trim()) {
      setMessage({ type: 'error', text: 'Add a rejection reason in the notes box before rejecting this transfer.' });
      return;
    }
    setBusyAction('reject');
    setMessage(null);
    try {
      const response = await fetch(`${base}/api/transfer-voting/dc/${selectedRecord.transfer_id}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: decisionNotes.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to reject transfer');
      }
      setDecisionNotes('');
      setMessage({ type: 'success', text: `Transfer ${selectedRecord.transfer_id} was rejected.` });
      await loadQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusyAction('');
  };

  return (
    <OfficerLayout title="Transfer DC Dashboard" roleLabel="DC" roleSubtitle="Deputy Commissioner" navLinks={DC_NAV_LINKS}>
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{ background: 'white', borderRadius: 24, boxShadow: S.md, padding: '1.45rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.55rem', color: T.text, marginBottom: 6 }}>
                Final Transfer Approval
              </div>
              <div style={{ color: T.text2, fontSize: '.92rem', maxWidth: 760 }}>
                Only transfer cases that already crossed the LRO approval threshold appear here. Approval finalizes ownership transfer and refreshes the ledger-backed property hash.
              </div>
            </div>
            <ActionButton onClick={loadQueue} outline>
              <i className="fas fa-sync-alt" style={{ marginRight: 8 }} />
              Refresh Queue
            </ActionButton>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
          <SummaryCard label="Ready For Decision" value={records.length} icon="fas fa-scale-balanced" tone={T.primary} />
          <SummaryCard label="Required Approvals" value="3" icon="fas fa-check-double" tone={T.success} />
          <SummaryCard label="Voting Nodes" value="5" icon="fas fa-users" tone={T.warning} />
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
            <strong>DC queue error:</strong> {error}
          </div>
        ) : null}

        {loading ? (
          <Panel title="Loading queue">
            <div style={{ textAlign: 'center', color: T.muted, padding: '3.5rem 0' }}>
              <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem', display: 'block' }} />
              Loading transfer cases ready for DC review...
            </div>
          </Panel>
        ) : !records.length ? (
          <Panel title="DC Transfer Review Queue" subtitle="No transfer cases have reached the final approval stage yet.">
            <div style={{ textAlign: 'center', color: T.muted, padding: '3rem 0' }}>
              <i className="fas fa-inbox fa-3x" style={{ display: 'block', marginBottom: '.9rem', color: T.primary }} />
              Nothing is waiting for DC transfer review right now.
            </div>
          </Panel>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(430px, 1.02fr) minmax(360px, .98fr)', gap: '1.25rem', alignItems: 'start' }}>
            <Panel title="Ready Transfer Cases" subtitle="Select a case from the left list to inspect the vote trail and finalize the decision.">
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1.55fr) 132px 120px', background: '#f8fafc', color: T.text2, fontWeight: 800, fontSize: '.76rem', letterSpacing: .35, textTransform: 'uppercase', padding: '.8rem 1rem', gap: '.8rem' }}>
                  <div>#</div>
                  <div>Transfer</div>
                  <div>Approvals</div>
                  <div>Status</div>
                </div>
                <div style={{ maxHeight: 760, overflowY: 'auto' }}>
                  {records.map((record, index) => (
                    <button
                      key={record.transfer_id}
                      onClick={() => setSelectedId(record.transfer_id)}
                      style={{
                        width: '100%',
                        border: 'none',
                        borderTop: `1px solid ${T.border}`,
                        background: record.transfer_id === selectedId ? '#eef6ff' : 'white',
                        display: 'grid',
                        gridTemplateColumns: '56px minmax(0,1.55fr) 132px 120px',
                        gap: '.8rem',
                        padding: '.95rem 1rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: record.transfer_id === selectedId ? T.primaryDark : T.text }}>{index + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>{record.transfer_id}</div>
                        <div style={{ color: T.text2, fontSize: '.82rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {record.property_id} · {[record.district, record.tehsil, record.mauza].filter(Boolean).join(', ')}
                        </div>
                        <div style={{ color: T.muted, fontSize: '.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {record.seller_name} to {record.buyer_name}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: T.text }}>{record.approvals}/{record.threshold}</div>
                      <div>
                        <Badge label="Ready" background="#eff6ff" color="#1d4ed8" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title={selectedRecord ? selectedRecord.transfer_id : 'Case Details'} subtitle={selectedRecord ? 'Review the transfer and its vote history before making the final decision.' : 'Select a case first.'}>
              {!selectedRecord ? (
                <div style={{ color: T.muted }}>Choose a case from the left queue to inspect it.</div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <Badge label="Ready For Final Approval" background="#eff6ff" color="#1d4ed8" />
                    <div style={{ color: T.muted, fontSize: '.8rem' }}>
                      LRO threshold reached {fmtDateTime(selectedRecord.lro_approved_at || selectedRecord.updated_at)}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '.85rem' }}>
                    <DetailItem label="Transfer ID" value={selectedRecord.transfer_id} />
                    <DetailItem label="Property ID" value={selectedRecord.property_id} />
                    <DetailItem label="Seller" value={selectedRecord.seller_name} />
                    <DetailItem label="Buyer" value={selectedRecord.buyer_name} />
                    <DetailItem label="District / Tehsil" value={[selectedRecord.district, selectedRecord.tehsil].filter(Boolean).join(', ')} />
                    <DetailItem label="Channel ID" value={selectedRecord.channel_id} />
                    <DetailItem label="Agreed Amount" value={`PKR ${Number(selectedRecord.displayAmount || 0).toLocaleString('en-PK')}`} />
                    <DetailItem label="Current Approval Count" value={`${selectedRecord.approvals}/${selectedRecord.threshold}`} />
                  </div>

                  <div style={{ borderRadius: 16, border: '1px solid #bfdbfe', background: '#eff6ff', padding: '1rem 1.05rem', color: '#1d4ed8' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      <i className="fas fa-circle-info" style={{ marginRight: 8 }} />
                      Final decision note
                    </div>
                    <div style={{ fontSize: '.84rem', lineHeight: 1.6 }}>
                      Approval completes the transfer, changes the owner in the registry, records the transfer agreement on the ledger, and refreshes the latest property hash for tamper checks.
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 800, color: T.text2, fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: .4 }}>
                      DC Notes / Rejection Reason
                    </label>
                    <textarea
                      value={decisionNotes}
                      onChange={(event) => setDecisionNotes(event.target.value)}
                      rows={4}
                      placeholder="Add approval notes, or write the rejection reason here..."
                      style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 14, padding: '.95rem 1rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap' }}>
                    <ActionButton onClick={handleApprove} busy={busyAction === 'approve'} tone={T.success}>
                      <i className="fas fa-check" style={{ marginRight: 8 }} />
                      Finalize Approval
                    </ActionButton>
                    <ActionButton onClick={handleReject} busy={busyAction === 'reject'} tone={T.danger}>
                      <i className="fas fa-times" style={{ marginRight: 8 }} />
                      Reject Case
                    </ActionButton>
                  </div>

                  <div style={{ display: 'grid', gap: '.75rem' }}>
                    <div style={{ fontWeight: 800, color: T.text }}>Recorded LRO Votes</div>
                    {!selectedRecord.votes?.length ? (
                      <div style={{ color: T.muted, fontSize: '.84rem' }}>No vote trail is available for this transfer.</div>
                    ) : selectedRecord.votes.map((vote) => {
                      const tone = voteTone(vote.vote);
                      return (
                        <div key={`${vote.transfer_id}-${vote.lro_node_id}-${vote.voted_at}`} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '.95rem 1rem', background: '#f8fafc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: T.text }}>{vote.lro_name || vote.lro_node_id}</div>
                              <div style={{ color: T.muted, fontSize: '.76rem' }}>{vote.lro_node_id}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap' }}>
                              <Badge label={vote.vote} background={tone.background} color={tone.color} />
                              <div style={{ color: T.muted, fontSize: '.78rem' }}>{fmtDateTime(vote.voted_at)}</div>
                            </div>
                          </div>
                          {vote.reason ? <div style={{ color: T.text2, fontSize: '.82rem' }}>{vote.reason}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </OfficerLayout>
  );
};

export default DCTransferDashboard;
