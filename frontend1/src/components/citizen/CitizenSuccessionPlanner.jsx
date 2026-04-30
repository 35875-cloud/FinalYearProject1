import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CitizenLayout, { T, S, fmtDate, fmtDateTime } from './CitizenLayout';

const cardStyle = {
  background: '#fff',
  border: `1px solid ${T.border}`,
  borderRadius: 22,
  boxShadow: S.md,
  padding: '1.25rem',
};

const relationOptions = [
  { value: 'WIFE', label: 'Wife' },
  { value: 'SON', label: 'Son' },
  { value: 'DAUGHTER', label: 'Daughter' },
];

const StatusChip = ({ tone = 'neutral', children }) => {
  const tones = {
    neutral: { bg: '#eef2ff', color: '#4338ca' },
    success: { bg: '#ecfdf5', color: '#047857' },
    warning: { bg: '#fff7ed', color: '#c2410c' },
    danger: { bg: '#fef2f2', color: '#b91c1c' },
  };
  const palette = tones[tone] || tones.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: palette.bg, color: palette.color, fontWeight: 800, fontSize: '.72rem' }}>
      {children}
    </span>
  );
};

const Field = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 14, padding: '.9rem 1rem' }}>
    <div style={{ fontSize: '.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{label}</div>
    <div style={{ color: T.text, fontWeight: 800 }}>{value || '--'}</div>
  </div>
);

const SectionCard = ({ title, subtitle = '', actions = null, children }) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
      <div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: '1.05rem', color: T.text }}>{title}</div>
        {subtitle ? <div style={{ marginTop: 6, color: T.text2, fontSize: '.84rem' }}>{subtitle}</div> : null}
      </div>
      {actions}
    </div>
    {children}
  </div>
);

const CitizenSuccessionPlanner = () => {
  const authToken = sessionStorage.getItem('authToken');
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth').replace('/api/auth', '');
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const propertyId = params.get('propertyId') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberBusy, setMemberBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [property, setProperty] = useState(null);
  const [ownedProperties, setOwnedProperties] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [preview, setPreview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [ownerGender, setOwnerGender] = useState('');
  const [notes, setNotes] = useState('');
  const [form, setForm] = useState({
    relationType: 'WIFE',
    fullName: '',
    cnic: '',
    dateOfBirth: '',
  });

  const allowedRelationOptions =
    ownerGender === 'MALE'
      ? relationOptions
      : relationOptions.filter((option) => option.value !== 'WIFE');

  const defaultRelationType = allowedRelationOptions[0]?.value || 'SON';
  const canAddMembers = Boolean(ownerGender);

  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  const load = async () => {
    setLoading(true);
    setError('');

    if (!propertyId) {
      try {
        const [propertyResponse, familyResponse] = await Promise.all([
          fetch(`${base}/api/properties/my-properties`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch(`${base}/api/succession/family-members`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        const propertyData = await propertyResponse.json();
        const familyData = await familyResponse.json().catch(() => ({}));

        if (!propertyResponse.ok || !propertyData.success) {
          throw new Error(propertyData.message || 'Unable to load your properties');
        }

        if (!familyResponse.ok || familyData.success === false) {
          throw new Error(familyData.message || 'Unable to load registered account gender');
        }

        setOwnedProperties(propertyData.properties || []);
        setProperty(null);
        setFamilyMembers(familyData.members || []);
        setPreview(null);
        setRequests([]);
        setOwnerGender(familyData.ownerGender || '');
        setForm((prev) => ({
          ...prev,
          relationType:
            (familyData.allowedRelations || []).includes(prev.relationType)
              ? prev.relationType
              : (familyData.allowedRelations?.[0] || 'SON'),
        }));
      } catch (err) {
        setError(err.message || 'Property ID is missing');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const response = await fetch(`${base}/api/succession/property/${propertyId}/preview`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load succession planner');
      }

      const nextOwnerGender = data.property?.owner_gender || '';
      const nextRelationOptions =
        nextOwnerGender === 'MALE'
          ? relationOptions
          : relationOptions.filter((option) => option.value !== 'WIFE');

      setProperty(data.property || null);
      setOwnedProperties([]);
      setFamilyMembers(data.familyMembers || []);
      setPreview(data.preview || null);
      setRequests(data.requests || []);
      setOwnerGender(nextOwnerGender);
      setForm((prev) => ({
        ...prev,
        relationType: nextRelationOptions.some((option) => option.value === prev.relationType)
          ? prev.relationType
          : (nextRelationOptions[0]?.value || 'SON'),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authToken) {
      navigate('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, propertyId]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/succession/family-members`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to add family member');
      }

      setForm({ relationType: defaultRelationType, fullName: '', cnic: '', dateOfBirth: '' });
      setNotice('Family member added.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMemberBusy(false);
    }
  };

  const handleRemoveMember = async (familyMemberId) => {
    setMemberBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/succession/family-members/${familyMemberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to remove family member');
      }

      setNotice('Family member removed.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMemberBusy(false);
    }
  };

  const handleSubmitRequest = async () => {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${base}/api/succession/requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          propertyId,
          notes,
          requestType: 'ISLAMIC_FAMILY_DIVISION',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to submit succession request');
      }

      setNotice('Succession request submitted successfully.');
      setNotes('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };


  return (
    <CitizenLayout
      title="Succession Planner"
      topbarActions={
        <button
          onClick={() => navigate('/citizen/my-properties')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,.92)', border: `1.5px solid #d9e3ec`,
            color: '#42586f', fontSize: '.82rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all .18s',
          }}
        >
          <i className="fas fa-arrow-left" /> Back to Properties
        </button>
      }
    >
      {/* ── Stat Cards — same style as MyProperties ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: '1.5rem',
        padding: '0 0 0',
        maxWidth: 1160,
        margin: '0 auto 1.5rem',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {[
          { label: 'Family Members', value: familyMembers.length,                                   icon: 'fas fa-people-group',   bg: '#EEF4FA', color: '#315D87', border: '#DCE7F2' },
          { label: 'Allocated',      value: preview ? `${preview.totalAllocatedPercent || 0}%` : '--', icon: 'fas fa-scale-balanced', bg: '#E9F8F1', color: '#1D8A64', border: '#CFEBDD' },
          { label: 'Requests',       value: requests.length,                                         icon: 'fas fa-file-signature', bg: '#FBF4E5', color: '#B6852D', border: '#ECD9AD' },
          { label: 'Status',         value: loading ? 'Loading…' : 'Ready',                          icon: 'fas fa-sitemap',        bg: '#EEF4FA', color: '#315D87', border: '#DCE7F2' },
        ].map((card) => (
          <div key={card.label} style={{
            background: '#ffffff',
            border: `1px solid ${card.border}`,
            borderRadius: 18,
            padding: '1.1rem 1.2rem',
            boxShadow: '0 2px 12px rgba(49,93,135,.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: card.bg, color: card.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', flexShrink: 0,
            }}>
              <i className={card.icon} />
            </div>
            <div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#182838', lineHeight: 1 }}>
                {card.value}
              </div>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#7e90a3', marginTop: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {card.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div style={{ ...cardStyle, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: '1rem' }}>
          <strong>Succession error:</strong> {error}
        </div>
      ) : null}

      {notice ? (
        <div style={{ ...cardStyle, background: '#ecfdf5', borderColor: '#bbf7d0', color: '#166534', marginBottom: '1rem' }}>
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: T.muted }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.4rem', marginBottom: 12 }} />
          <div>Loading succession planner...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <SectionCard title="Property Context" subtitle="The succession request will be attached to this direct ownership record.">
            {!propertyId && ownedProperties.length > 0 ? (
              <div style={{ display: 'grid', gap: '.75rem', marginBottom: '1rem' }}>
                {ownedProperties.map((item) => (
                  <div key={item.property_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: T.text }}>{item.property_id}</div>
                      <div style={{ color: T.text2, fontSize: '.84rem', marginTop: 4 }}>
                        {[item.district, item.tehsil, item.mauza].filter(Boolean).join(', ') || item.owner_name}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/citizen/succession?propertyId=${item.property_id}`)}
                      style={{ border: 'none', borderRadius: 12, padding: '10px 14px', background: `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})`, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Open Planner
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <Field label="Property ID" value={property?.property_id} />
              <Field label="Owner" value={property?.owner_name} />
              <Field label="Owner Gender" value={ownerGender || 'Missing in profile'} />
              <Field label="Location" value={[property?.district, property?.tehsil, property?.mauza].filter(Boolean).join(', ')} />
              <Field label="Area" value={property?.area_marla ? `${property.area_marla} Marla` : '--'} />
            </div>
          </SectionCard>

          <SectionCard
            title="Rule Inputs"
            subtitle="Succession now reads owner gender from the citizen account profile instead of a temporary page toggle."
          >
            {!ownerGender ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 12, padding: '12px 14px', lineHeight: 1.7 }}>
                  Succession strictly uses the gender saved in the registered citizen account. This account is missing profile gender, so update it from the profile page first before creating succession family entries.
                </div>
                <div>
                  <button
                    onClick={() => navigate('/citizen/profile')}
                    style={{ border: 'none', borderRadius: 12, padding: '10px 14px', background: T.primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                  >
                    <i className="fas fa-user-pen" style={{ marginRight: 8 }} />
                    Open Profile
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: T.text2, fontSize: '.88rem', lineHeight: 1.7 }}>
                Owner gender is read automatically from the registered citizen account and is stored as <strong>{ownerGender}</strong>. In this project, a male owner can add <strong>wife and children</strong>, while a female owner can add <strong>children only</strong>. Children split the estate with <strong>son = 2 shares</strong> and <strong>daughter = 1 share</strong>. If the owner is male, wife gets <strong>1/8</strong> when children exist and <strong>1/4</strong> when no child exists.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Family Members" subtitle={ownerGender === 'MALE' ? 'Male owner can add wife and children here.' : 'Female owner can add children here.'}>
            <form onSubmit={handleAddMember} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.85rem', marginBottom: '1rem' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: T.text2, fontWeight: 700, fontSize: '.82rem' }}>Relation</span>
                <select
                  value={form.relationType}
                  onChange={(e) => setForm((prev) => ({ ...prev, relationType: e.target.value }))}
                  disabled={!canAddMembers}
                  style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontFamily: 'inherit' }}
                >
                  {allowedRelationOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: T.text2, fontWeight: 700, fontSize: '.82rem' }}>Full Name</span>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  disabled={!canAddMembers}
                  placeholder="Family member name"
                  style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontFamily: 'inherit' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: T.text2, fontWeight: 700, fontSize: '.82rem' }}>CNIC</span>
                <input
                  value={form.cnic}
                  onChange={(e) => setForm((prev) => ({ ...prev, cnic: e.target.value }))}
                  disabled={!canAddMembers}
                  placeholder="Optional CNIC"
                  style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontFamily: 'inherit' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: T.text2, fontWeight: 700, fontSize: '.82rem' }}>Date of Birth</span>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                  disabled={!canAddMembers}
                  style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 12px', fontFamily: 'inherit' }}
                />
              </label>
            </form>

            {!canAddMembers ? (
              <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 12, padding: '10px 12px', marginBottom: '1rem' }}>
                Save owner gender first to unlock family-member entry.
              </div>
            ) : null}

            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={handleAddMember}
                disabled={memberBusy || !canAddMembers}
                style={{ border: 'none', borderRadius: 12, padding: '11px 16px', background: `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})`, color: '#fff', fontWeight: 800, cursor: memberBusy ? 'not-allowed' : 'pointer', opacity: memberBusy ? 0.7 : 1 }}
              >
                <i className={`fas ${memberBusy ? 'fa-spinner fa-spin' : 'fa-user-plus'}`} style={{ marginRight: 8 }} />
                {memberBusy ? 'Saving...' : 'Add Family Member'}
              </button>
            </div>

            {!familyMembers.length ? (
              <div style={{ color: T.muted }}>No family members added yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '.8rem' }}>
                {familyMembers.map((member) => (
                  <div key={member.family_member_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                        <div style={{ fontWeight: 800, color: T.text }}>{member.full_name}</div>
                        <StatusChip tone="neutral">{member.relation_type}</StatusChip>
                        {member.linked_user_id ? <StatusChip tone="success">Linked Citizen</StatusChip> : null}
                      </div>
                      <div style={{ color: T.text2, fontSize: '.84rem' }}>
                        {[member.cnic, member.date_of_birth ? fmtDate(member.date_of_birth) : null].filter(Boolean).join(' • ') || 'Profile details pending'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.family_member_id)}
                      disabled={memberBusy}
                      style={{ border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#b91c1c', fontWeight: 800, cursor: memberBusy ? 'not-allowed' : 'pointer', transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease' }}
                      onMouseEnter={e => { if (!memberBusy) { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#fff'; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.color = '#b91c1c'; }}
                    >
                      <i className="fas fa-user-minus" style={{ marginRight: 8 }} />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Calculated Allocation" subtitle={preview?.scenarioLabel || 'Share preview'} actions={(
              <button
              onClick={() => load()}
              style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', background: '#fff', color: T.text, fontWeight: 800, cursor: 'pointer' }}
            >
              <i className="fas fa-rotate" style={{ marginRight: 8 }} />
              Recalculate
            </button>
          )}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.85rem', marginBottom: '1rem' }}>
              <Field label="Owner Gender" value={ownerGender || 'Missing in profile'} />
              <Field label="Allocated" value={preview ? `${preview.totalAllocatedPercent || 0}%` : '--'} />
              <Field label="Heir Rows" value={preview?.totalHeirs || 0} />
              <Field label="Can Submit" value={preview?.canSubmit ? 'Yes' : 'No'} />
            </div>

            {(preview?.warnings || []).map((warning) => (
              <div key={warning} style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                <strong>Warning:</strong> {warning}
              </div>
            ))}
            {(preview?.blockers || []).map((blocker) => (
              <div key={blocker} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                <strong>Blocker:</strong> {blocker}
              </div>
            ))}

            {!preview?.allocations?.length ? (
              <div style={{ color: T.muted }}>No calculated heirs yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '.75rem' }}>
                {preview.allocations.map((item, index) => (
                  <div key={`${item.familyMemberId || item.fullName}-${index}`} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: T.text }}>{item.fullName}</div>
                        <div style={{ color: T.text2, fontSize: '.84rem', marginTop: 4 }}>{item.relationType}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <StatusChip tone="success">{item.shareFractionText}</StatusChip>
                        <StatusChip tone="neutral">{item.sharePercent}%</StatusChip>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, color: T.text2, fontSize: '.84rem', lineHeight: 1.65 }}>
                      {item.shareBasis}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'grid', gap: 8 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: T.text2, fontWeight: 700, fontSize: '.82rem' }}>Citizen Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add any succession context for the officer review..."
                  style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 14px', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
              <div>
                <button
                  onClick={handleSubmitRequest}
                  disabled={!preview?.canSubmit || saving}
                  style={{ border: 'none', borderRadius: 12, padding: '12px 16px', background: !preview?.canSubmit ? '#94a3b8' : `linear-gradient(135deg, ${T.primaryDark}, ${T.primary})`, color: '#fff', fontWeight: 800, cursor: !preview?.canSubmit || saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.75 : 1 }}
                >
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-file-signature'}`} style={{ marginRight: 8 }} />
                  {saving ? 'Submitting...' : 'Submit Succession Request'}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent Requests" subtitle="Your submitted succession requests for this property.">
            {!requests.length ? (
              <div style={{ color: T.muted }}>No succession requests yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '.75rem' }}>
                {requests.map((request) => (
                  <div key={request.succession_request_id} style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: T.text }}>{request.request_no}</div>
                        <div style={{ color: T.text2, fontSize: '.84rem', marginTop: 4 }}>
                          Submitted {fmtDateTime(request.submitted_at || request.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <StatusChip tone={String(request.status || '').toUpperCase() === 'COMPLETED' ? 'success' : 'warning'}>{request.status || 'PENDING'}</StatusChip>
                        <StatusChip tone="neutral">{request.lro_status || 'PENDING LRO'}</StatusChip>
                        <StatusChip tone="neutral">{request.dc_status || 'PENDING DC'}</StatusChip>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, color: T.text2, fontSize: '.84rem' }}>
                      {request.request_type || 'ISLAMIC_FAMILY_DIVISION'} • Total {request.total_allocated_percent || 0}% • {request.total_heirs || 0} heir rows
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </CitizenLayout>
  );
};

export default CitizenSuccessionPlanner;