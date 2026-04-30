import React, { useEffect, useState } from 'react';
import DCLayout, { T, S, fmtDateTime } from './DcLayout';


const pageCard = {
  background: 'white',
  borderRadius: 22,
  boxShadow: S.md,
  padding: '1.2rem',
};

const freezeReasons = [
  { value: 'OWNERSHIP_DISPUTE', label: 'Ownership Dispute' },
  { value: 'COURT_ORDER', label: 'Court Order' },
  { value: 'FRAUD_REVIEW', label: 'Fraud Review' },
  { value: 'SUCCESSION_DISPUTE', label: 'Succession Dispute' },
];

const encumbranceTypes = [
  { value: 'MORTGAGE', label: 'Mortgage' },
  { value: 'BANK_LIEN', label: 'Bank Lien' },
  { value: 'COURT_ATTACHMENT', label: 'Court Attachment' },
  { value: 'TAX_HOLD', label: 'Tax Hold' },
];

const ActionButton = ({ icon, label, onClick, disabled = false, tone = 'primary' }) => {
  const tones = {
    primary: { bg: '#0f766e', color: 'white', border: '#0f766e' },
    secondary: { bg: 'white', color: T.text, border: T.border },
    warning: { bg: '#fff7ed', color: '#b45309', border: '#fdba74' },
  };
  const palette = tones[tone] || tones.primary;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        background: disabled ? '#e2e8f0' : palette.bg,
        color: disabled ? '#64748b' : palette.color,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <i className={icon} />
      {label}
    </button>
  );
};

const StatusChip = ({ tone = 'neutral', children }) => {
  const tones = {
    neutral: { bg: '#eef2ff', color: '#4338ca' },
    success: { bg: '#ecfdf5', color: '#047857' },
    warning: { bg: '#fff7ed', color: '#c2410c' },
  };
  const palette = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        fontWeight: 800,
        fontSize: '.72rem',
      }}
    >
      {children}
    </span>
  );
};

const SummaryCard = ({ icon, label, value, helper, bg, color }) => (
  <div style={{ ...pageCard, border: `1px solid ${bg}` }}>
    <div
      style={{
        width: 50,
        height: 50,
        borderRadius: 14,
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.1rem',
        marginBottom: '0.85rem',
      }}
    >
      <i className={icon} />
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
    <div style={{ marginTop: 6, color: T.text2, fontWeight: 700, fontSize: '.84rem' }}>{label}</div>
    <div style={{ marginTop: 6, color: T.muted, fontSize: '.76rem' }}>{helper}</div>
  </div>
);

const SectionCard = ({ title, subtitle = '', actions = null, children }) => (
  <div style={pageCard}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
      }}
    >
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.08rem', color: T.text }}>{title}</div>
        {subtitle ? <div style={{ marginTop: 6, color: T.text2, fontSize: '.84rem' }}>{subtitle}</div> : null}
      </div>
      {actions}
    </div>
    {children}
  </div>
);

const emptyState = (text) => (
  <div style={{ border: `1px dashed ${T.border}`, borderRadius: 16, padding: '1.2rem', textAlign: 'center', color: T.muted }}>
    {text}
  </div>
);

const fmtMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '--';
  return `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(numeric)}`;
};

const DCRestrictionDashboard = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [freezeBusy, setFreezeBusy] = useState('');
  const [encumbranceBusy, setEncumbranceBusy] = useState('');
  const [freezeCases, setFreezeCases] = useState([]);
  const [encumbranceCases, setEncumbranceCases] = useState([]);
  const [freezeForm, setFreezeForm] = useState({
    propertyId: '',
    reasonCode: 'OWNERSHIP_DISPUTE',
    referenceNo: '',
    notes: '',
  });
  const [encumbranceForm, setEncumbranceForm] = useState({
    propertyId: '',
    typeCode: 'MORTGAGE',
    holderName: '',
    amountSecured: '',
    referenceNo: '',
    notes: '',
  });

  const headers = {
    Authorization: `Bearer ${authToken}`,
  };

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [freezeRes, encumbranceRes] = await Promise.all([
        fetch(`${base}/api/properties/freeze-cases?limit=8`, { headers }),
        fetch(`${base}/api/properties/encumbrances?limit=8`, { headers }),
      ]);

      const [freezeData, encumbranceData] = await Promise.all([
        freezeRes.json(),
        encumbranceRes.json(),
      ]);

      if (!freezeRes.ok || !freezeData.success) {
        throw new Error(freezeData.message || 'Unable to load dispute hold register');
      }
      if (!encumbranceRes.ok || !encumbranceData.success) {
        throw new Error(encumbranceData.message || 'Unable to load encumbrance register');
      }

      setFreezeCases(freezeData.cases || []);
      setEncumbranceCases(encumbranceData.cases || []);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (authToken) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const handleFreezeInput = (field, value) => {
    setFreezeForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEncumbranceInput = (field, value) => {
    setEncumbranceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFreezeSubmit = async () => {
    if (!freezeForm.propertyId.trim()) {
      setError('Property ID is required for a dispute hold.');
      return;
    }

    setFreezeBusy('submit');
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/properties/freeze`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(freezeForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to place property under dispute hold');
      }

      setNotice(data.message || 'Dispute hold applied successfully.');
      setFreezeForm({
        propertyId: '',
        reasonCode: 'OWNERSHIP_DISPUTE',
        referenceNo: '',
        notes: '',
      });
      await load();
    } catch (err) {
      setError(err.message);
    }

    setFreezeBusy('');
  };

  const handleReleaseFreeze = async (propertyId) => {
    const notes = window.prompt('Enter release notes for this dispute hold:', 'Released after DC review') || '';
    if (!notes.trim()) return;

    setFreezeBusy(propertyId);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/properties/freeze/${propertyId}/release`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to release dispute hold');
      }

      setNotice(data.message || 'Dispute hold released successfully.');
      await load();
    } catch (err) {
      setError(err.message);
    }

    setFreezeBusy('');
  };

  const handleEncumbranceSubmit = async () => {
    if (!encumbranceForm.propertyId.trim()) {
      setError('Property ID is required for an encumbrance record.');
      return;
    }

    setEncumbranceBusy('submit');
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/properties/encumbrances`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...encumbranceForm,
          amountSecured: encumbranceForm.amountSecured || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to record encumbrance');
      }

      setNotice(data.message || 'Encumbrance recorded successfully.');
      setEncumbranceForm({
        propertyId: '',
        typeCode: 'MORTGAGE',
        holderName: '',
        amountSecured: '',
        referenceNo: '',
        notes: '',
      });
      await load();
    } catch (err) {
      setError(err.message);
    }

    setEncumbranceBusy('');
  };

  const handleReleaseEncumbrance = async (encumbranceId) => {
    const notes = window.prompt('Enter release notes for this encumbrance:', 'Released after clearance review') || '';
    if (!notes.trim()) return;

    setEncumbranceBusy(encumbranceId);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/properties/encumbrances/${encumbranceId}/release`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to release encumbrance');
      }

      setNotice(data.message || 'Encumbrance released successfully.');
      await load();
    } catch (err) {
      setError(err.message);
    }

    setEncumbranceBusy('');
  };

  const activeHoldCount = freezeCases.filter((item) => item.is_frozen).length;
  const activeEncumbranceCount = encumbranceCases.filter((item) => item.active).length;

  return (
    <DCLayout title="Property Restrictions">
      <div style={{ display: 'grid', gap: '1.35rem' }}>
        <div
          style={{
            ...pageCard,
            padding: '1.55rem 1.7rem',
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef6ff 52%, #f7fffd 100%)',
            border: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: '#e0f2fe', color: '#075985', fontWeight: 800, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Legal restriction control
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.6rem', color: T.text, marginTop: 14, marginBottom: 8 }}>
            Freeze and encumbrance decisions belong to DC
          </div>
          <div style={{ color: T.text2, fontSize: '.94rem', maxWidth: 920, lineHeight: 1.65 }}>
            This workspace is for legal property controls only. Use dispute holds to stop sale and transfer activity immediately,
            and use encumbrances to record mortgages, liens, court attachments, and tax holds that must remain visible until cleared.
          </div>
        </div>

        {error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#b91c1c', padding: '0.95rem 1rem' }}>
            <strong>DC restriction error:</strong> {error}
          </div>
        ) : null}

        {notice ? (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 16, color: '#047857', padding: '0.95rem 1rem' }}>
            <strong>Update:</strong> {notice}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
          <SummaryCard icon="fas fa-lock" label="Active Dispute Holds" value={activeHoldCount} helper="Properties currently blocked by DC hold." bg="#eff6ff" color="#2563eb" />
          <SummaryCard icon="fas fa-file-circle-exclamation" label="Active Encumbrances" value={activeEncumbranceCount} helper="Mortgage, lien, court, or tax restrictions still open." bg="#fff7ed" color="#c2410c" />
          <SummaryCard icon="fas fa-folder-open" label="Recent Hold Cases" value={freezeCases.length} helper="Latest hold records visible on this page." bg="#eef2ff" color="#4f46e5" />
          <SummaryCard icon="fas fa-scale-balanced" label="Recent Encumbrance Cases" value={encumbranceCases.length} helper="Latest encumbrance records visible on this page." bg="#ecfdf5" color="#059669" />
        </div>

        {loading ? (
          <div style={{ ...pageCard, padding: '4rem', textAlign: 'center', color: T.muted }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ marginBottom: '1rem' }} />
            <div>Loading DC restriction workspace...</div>
          </div>
        ) : (
          <>
            <SectionCard
              title="Property Freeze / Dispute Hold"
              subtitle="Apply a DC hold when an ownership dispute, court order, fraud review, or succession conflict must immediately block property activity."
              actions={
                <ActionButton
                  icon="fas fa-lock"
                  label={freezeBusy === 'submit' ? 'Applying...' : 'Apply Hold'}
                  onClick={handleFreezeSubmit}
                  disabled={freezeBusy === 'submit'}
                />
              }
            >
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Property ID</span>
                    <input
                      value={freezeForm.propertyId}
                      onChange={(e) => handleFreezeInput('propertyId', e.target.value)}
                      placeholder="PROP-..."
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Hold Reason</span>
                    <select
                      value={freezeForm.reasonCode}
                      onChange={(e) => handleFreezeInput('reasonCode', e.target.value)}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem', background: 'white' }}
                    >
                      {freezeReasons.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Reference No.</span>
                    <input
                      value={freezeForm.referenceNo}
                      onChange={(e) => handleFreezeInput('referenceNo', e.target.value)}
                      placeholder="Court case / memo / file number"
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Notes</span>
                  <textarea
                    value={freezeForm.notes}
                    onChange={(e) => handleFreezeInput('notes', e.target.value)}
                    rows={3}
                    placeholder="Explain why this property must be blocked from sale and transfer activity."
                    style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </label>

                {freezeCases.length === 0 ? emptyState('No dispute hold records are available right now.') : (
                  <div style={{ display: 'grid', gap: '.8rem' }}>
                    {freezeCases.map((item) => (
                      <div key={item.property_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc', display: 'grid', gap: '.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 800, color: T.text }}>{item.property_id}</div>
                            <div style={{ color: T.text2, fontSize: '.82rem', marginTop: 4 }}>
                              {[item.owner_name, item.district, item.tehsil].filter(Boolean).join(' | ')}
                            </div>
                          </div>
                          <StatusChip tone={item.is_frozen ? 'warning' : 'neutral'}>
                            {item.is_frozen ? 'ACTIVE HOLD' : 'RELEASED'}
                          </StatusChip>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '.7rem' }}>
                          <div><strong>Reason:</strong> {item.freeze_reason_label || '--'}</div>
                          <div><strong>Reference:</strong> {item.freeze_reference_no || '--'}</div>
                          <div><strong>Started:</strong> {fmtDateTime(item.freeze_started_at)}</div>
                          <div><strong>Authority:</strong> {item.freeze_authority_role || '--'}</div>
                        </div>
                        {item.freeze_notes ? <div style={{ color: T.text2, fontSize: '.84rem' }}>{item.freeze_notes}</div> : null}
                        {item.is_frozen ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <ActionButton
                              icon="fas fa-lock-open"
                              label={freezeBusy === item.property_id ? 'Releasing...' : 'Release Hold'}
                              onClick={() => handleReleaseFreeze(item.property_id)}
                              disabled={freezeBusy === item.property_id}
                              tone="warning"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Mortgage / Lien / Encumbrance Register"
              subtitle="Record financial or court-backed restrictions that must remain attached to the property until they are formally cleared."
              actions={
                <ActionButton
                  icon="fas fa-file-circle-plus"
                  label={encumbranceBusy === 'submit' ? 'Recording...' : 'Record Encumbrance'}
                  onClick={handleEncumbranceSubmit}
                  disabled={encumbranceBusy === 'submit'}
                  tone="warning"
                />
              }
            >
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Property ID</span>
                    <input
                      value={encumbranceForm.propertyId}
                      onChange={(e) => handleEncumbranceInput('propertyId', e.target.value)}
                      placeholder="PROP-..."
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Encumbrance Type</span>
                    <select
                      value={encumbranceForm.typeCode}
                      onChange={(e) => handleEncumbranceInput('typeCode', e.target.value)}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem', background: 'white' }}
                    >
                      {encumbranceTypes.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Holder / Institution</span>
                    <input
                      value={encumbranceForm.holderName}
                      onChange={(e) => handleEncumbranceInput('holderName', e.target.value)}
                      placeholder="Bank, court, tax office, or authority"
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Amount Secured</span>
                    <input
                      type="number"
                      min="0"
                      value={encumbranceForm.amountSecured}
                      onChange={(e) => handleEncumbranceInput('amountSecured', e.target.value)}
                      placeholder="Optional secured amount"
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Reference No.</span>
                    <input
                      value={encumbranceForm.referenceNo}
                      onChange={(e) => handleEncumbranceInput('referenceNo', e.target.value)}
                      placeholder="Mortgage deed, court file, or lien memo"
                      style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 800, color: T.text2 }}>Notes</span>
                  <textarea
                    value={encumbranceForm.notes}
                    onChange={(e) => handleEncumbranceInput('notes', e.target.value)}
                    rows={3}
                    placeholder="Describe why this encumbrance blocks sale or transfer and what clearance is required."
                    style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontSize: '.88rem', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </label>

                {encumbranceCases.length === 0 ? emptyState('No encumbrance records are available right now.') : (
                  <div style={{ display: 'grid', gap: '.8rem' }}>
                    {encumbranceCases.map((item) => (
                      <div key={item.encumbrance_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc', display: 'grid', gap: '.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 800, color: T.text }}>{item.property_id}</div>
                            <div style={{ color: T.text2, fontSize: '.82rem', marginTop: 4 }}>
                              {[item.owner_name, item.district, item.tehsil].filter(Boolean).join(' | ')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                            <StatusChip tone={item.active ? 'warning' : 'neutral'}>
                              {item.active ? 'ACTIVE ENCUMBRANCE' : 'RELEASED'}
                            </StatusChip>
                            <StatusChip tone="neutral">{item.type_label || 'Encumbrance'}</StatusChip>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '.7rem' }}>
                          <div><strong>Holder:</strong> {item.holder_name || '--'}</div>
                          <div><strong>Reference:</strong> {item.reference_no || '--'}</div>
                          <div><strong>Recorded:</strong> {fmtDateTime(item.recorded_at)}</div>
                          <div><strong>Amount:</strong> {fmtMoney(item.amount_secured)}</div>
                        </div>
                        {item.notes ? <div style={{ color: T.text2, fontSize: '.84rem' }}>{item.notes}</div> : null}
                        {item.active ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <ActionButton
                              icon="fas fa-file-circle-check"
                              label={encumbranceBusy === item.encumbrance_id ? 'Releasing...' : 'Release Encumbrance'}
                              onClick={() => handleReleaseEncumbrance(item.encumbrance_id)}
                              disabled={encumbranceBusy === item.encumbrance_id}
                              tone="warning"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </DCLayout>
  );
};

export default DCRestrictionDashboard;