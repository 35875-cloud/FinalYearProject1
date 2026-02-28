import React, { useEffect, useMemo, useState } from 'react';
import OfficerLayout, { T, S, fmtDateTime } from './OfficerLayout';

const Panel = ({ title, subtitle, action, children }) => (
  <div style={{ background: 'white', borderRadius: 22, boxShadow: S.md, overflow: 'hidden' }}>
    <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, color: T.text, marginBottom: 4 }}>{title}</div>
        {subtitle ? <div styzle={{ color: T.text2, fontSize: '.84rem' }}>{subtitle}</div> : null}
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
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '6px 11px', fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3, background, color }}>
    <i className="fas fa-circle" style={{ fontSize: '.42rem' }} />
    {label}
  </span>
);

const stageTone = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'READY_FOR_DC') return { background: '#eff6ff', color: '#1d4ed8', label: 'Ready For DC' };
  if (normalized === 'FINALIZED') return { background: '#ecfdf5', color: '#047857', label: 'Finalized' };
  if (normalized === 'REJECTED') return { background: '#fef2f2', color: '#b91c1c', label: 'Rejected' };
  return { background: '#fff7ed', color: '#c2410c', label: 'Voting Open' };
};

const voteTone = (vote) => {
  const normalized = String(vote || '').toUpperCase();
  if (normalized === 'APPROVE') return { background: '#ecfdf5', color: '#047857' };
  if (normalized === 'REJECT') return { background: '#fef2f2', color: '#b91c1c' };
  return { background: '#f8fafc', color: T.text2 };
};

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

const TransferVotingPanel = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${base}/api/transfer-voting/lro/queue`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load transfer voting queue');
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
    if (!records.some((item) => item.transfer_id === selectedId)) {
      setSelectedId(records[0].transfer_id);
    }
  }, [records, selectedId]);

  const selectedRecord = useMemo(
    () => records.find((item) => item.transfer_id === selectedId) || null,
    [records, selectedId]
  );

  const summary = useMemo(() => ({
    votingOpen: records.filter((item) => String(item.status).toUpperCase() === 'VOTING').length,
    readyForDc: records.filter((item) => String(item.status).toUpperCase() === 'READY_FOR_DC').length,
    finalized: records.filter((item) => String(item.status).toUpperCase() === 'FINALIZED').length,
  }), [records]);

  const castVote = async (vote) => {
    if (!selectedRecord) return;
    setBusyAction(vote);
    setMessage(null);
    try {
      const response = await fetch(`${base}/api/transfer-voting/lro/${selectedRecord.transfer_id}/vote`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote,
          reason: decisionNote.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to record transfer vote');
      }
      setDecisionNote('');
      setMessage({ type: 'success', text: `Your ${vote.toLowerCase()} vote was recorded for ${selectedRecord.transfer_id}.` });
      await loadQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setBusyAction('');
  };

  const selectedStage = stageTone(selectedRecord?.status);

  return (
    <OfficerLayout title="Transfer Voting">
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div style={{ background: 'white', borderRadius: 24, boxShadow: S.md, padding: '1.45rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.55rem', color: T.text, marginBottom: 6 }}>
                5-Node Transfer Voting
              </div>
              <div style={{ color: T.text2, fontSize: '.92rem', maxWidth: 760 }}>
                Paid and mutually agreed transfer cases appear here. Each mapped LRO node can vote once. Once a transfer reaches three approvals, it moves to DC for final ownership transfer and ledger sync.
              </div>
            </div>
            <ActionButton onClick={loadQueue} outline>
              <i className="fas fa-sync-alt" style={{ marginRight: 8 }} />
              Refresh Queue
            </ActionButton>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
          <SummaryCard label="Voting Open" value={summary.votingOpen} icon="fas fa-gavel" tone={T.warning} />
          <SummaryCard label="Ready For DC" value={summary.readyForDc} icon="fas fa-scale-balanced" tone={T.primary} />
          <SummaryCard label="Finalized Transfers" value={summary.finalized} icon="fas fa-circle-check" tone={T.success} />
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
            <strong>Voting queue error:</strong> {error}
          </div>
        ) : null}

        {loading ? (
          <Panel title="Loading queue">
            <div style={{ textAlign: 'center', color: T.muted, padding: '3.5rem 0' }}>
              <i className="fas fa-spinner fa-spin fa-2x" style={{ display: 'block', marginBottom: '1rem' }} />
              Loading transfer vote queue...
            </div>
          </Panel>
        ) : !records.length ? (
          <Panel title="Transfer Voting Queue" subtitle="No transfer cases are in the shared vote queue right now.">
            <div style={{ textAlign: 'center', color: T.muted, padding: '3rem 0' }}>
              <i className="fas fa-inbox fa-3x" style={{ display: 'block', marginBottom: '.9rem', color: T.primary }} />
              The transfer queue is empty for now.
            </div>
          </Panel>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(430px, 1.02fr) minmax(360px, .98fr)', gap: '1.25rem', alignItems: 'start' }}>
            <Panel title="Case List" subtitle="Open a row to inspect the transfer and cast your single node vote.">
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1.5fr) 156px 132px', background: '#f8fafc', color: T.text2, fontWeight: 800, fontSize: '.76rem', letterSpacing: .35, textTransform: 'uppercase', padding: '.8rem 1rem', gap: '.8rem' }}>
                  <div>#</div>
                  <div>Transfer</div>
                  <div>Stage</div>
                  <div>Votes</div>
                </div>
                <div style={{ maxHeight: 760, overflowY: 'auto' }}>
                  {records.map((record, index) => {
                    const active = record.transfer_id === selectedId;
                    const tone = stageTone(record.status);
                    return (
                      <button
                        key={record.transfer_id}
                        onClick={() => setSelectedId(record.transfer_id)}
                        style={{
                          width: '100%',
                          border: 'none',
                          borderTop: `1px solid ${T.border}`,
                          background: active ? '#eef6ff' : 'white',
                          display: 'grid',
                          gridTemplateColumns: '56px minmax(0,1.5fr) 156px 132px',
                          gap: '.8rem',
                          padding: '.95rem 1rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: active ? T.primaryDark : T.text }}>{index + 1}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: T.text, marginBottom: 4 }}>{record.transfer_id}</div>
                          <div style={{ color: T.text2, fontSize: '.82rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {record.property_id} · {[record.district, record.tehsil, record.mauza].filter(Boolean).join(', ')}
                          </div>
                          <div style={{ color: T.muted, fontSize: '.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {record.seller_name} to {record.buyer_name}
                          </div>
                        </div>
                        <div>
                          <Badge label={tone.label} background={tone.background} color={tone.color} />
                        </div>
                        <div style={{ fontWeight: 800, color: T.text }}>
                          {record.approvals}/{record.threshold}
                          <div style={{ color: T.muted, fontSize: '.74rem', fontWeight: 700 }}>Reject {record.rejections}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>

            <Panel title={selectedRecord ? selectedRecord.transfer_id : 'Case Details'} subtitle={selectedRecord ? 'Inspect the transfer, its vote trail and your current action state.' : 'Select a case first.'}>
              {!selectedRecord ? (
                <div style={{ color: T.muted }}>Choose a case from the left queue to inspect it.</div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge label={selectedStage.label} background={selectedStage.background} color={selectedStage.color} />
                    <div style={{ color: T.muted, fontSize: '.8rem' }}>
                      Submitted {fmtDateTime(selectedRecord.submitted_at || selectedRecord.created_at)}
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
                    <DetailItem label="Current Progress" value={`${selectedRecord.approvals}/${selectedRecord.threshold} approvals`} />
                  </div>

                  <div style={{ borderRadius: 16, border: '1px solid #bfdbfe', background: '#eff6ff', padding: '1rem 1.05rem', color: '#1d4ed8' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      <i className="fas fa-route" style={{ marginRight: 8 }} />
                      Current case position
                    </div>
                    <div style={{ fontSize: '.84rem', lineHeight: 1.6 }}>
                      {String(selectedRecord.status).toUpperCase() === 'VOTING' && 'This transfer is waiting for node votes. Each mapped LRO node can vote once.'}
                      {String(selectedRecord.status).toUpperCase() === 'READY_FOR_DC' && 'This transfer has crossed the approval threshold and is now waiting for DC final review.'}
                      {String(selectedRecord.status).toUpperCase() === 'FINALIZED' && 'This transfer has completed the voting flow and ownership has been finalized.'}
                      {String(selectedRecord.status).toUpperCase() === 'REJECTED' && 'This transfer has been rejected and is no longer in the active approval path.'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 18, padding: '1rem' }}>
                    <div style={{ fontWeight: 800, color: T.text, marginBottom: '.8rem' }}>Your Vote Panel</div>
                    {selectedRecord.currentUserVote ? (
                      <div style={{ display: 'grid', gap: '.7rem' }}>
                        <Badge
                          label={`Already ${String(selectedRecord.currentUserVote.vote).toUpperCase()}D`}
                          background={voteTone(selectedRecord.currentUserVote.vote).background}
                          color={voteTone(selectedRecord.currentUserVote.vote).color}
                        />
                        <div style={{ color: T.text2, fontSize: '.84rem' }}>
                          Your node already voted on {fmtDateTime(selectedRecord.currentUserVote.voted_at)}.
                        </div>
                        {selectedRecord.currentUserVote.reason ? (
                          <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${T.border}`, padding: '.85rem .95rem', color: T.text2, fontSize: '.84rem' }}>
                            {selectedRecord.currentUserVote.reason}
                          </div>
                        ) : null}
                      </div>
                    ) : !selectedRecord.canVote ? (
                      <div style={{ color: T.text2, fontSize: '.84rem' }}>
                        Voting is not open for your node on this transfer right now.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '.8rem' }}>
                        <textarea
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                          rows={4}
                          placeholder="Optional note for your vote..."
                          style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem 1rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                        />
                        <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap' }}>
                          <ActionButton onClick={() => castVote('APPROVE')} busy={busyAction === 'APPROVE'} tone={T.success}>
                            <i className="fas fa-check" style={{ marginRight: 8 }} />
                            Approve
                          </ActionButton>
                          <ActionButton onClick={() => castVote('REJECT')} busy={busyAction === 'REJECT'} tone={T.danger}>
                            <i className="fas fa-times" style={{ marginRight: 8 }} />
                            Reject
                          </ActionButton>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: '.75rem' }}>
                    <div style={{ fontWeight: 800, color: T.text }}>Vote History</div>
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

export default TransferVotingPanel;
