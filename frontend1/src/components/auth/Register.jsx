import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1: Form, 2: OTP, 3: Success
  const [tempUser,    setTempUser]     = useState(null);

  const [formData, setFormData] = useState({
    role: '', cnic: '', fatherCnic: '', name: '', fatherName: '',
    gender: '',
    mobile: '', email: '', password: '', confirmPassword: '', termsAccepted: false
  });

  const [otp,                 setOtp]                 = useState('');
  const [userId,              setUserId]              = useState('');
  const [displayedOtp,        setDisplayedOtp]        = useState('');
  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength,    setPasswordStrength]    = useState(0);
  const [passwordMatch,       setPasswordMatch]       = useState('');
  const [isSubmitting,        setIsSubmitting]        = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth';

  const formatCNIC = (value) => {
    const c = value.replace(/\D/g, '');
    if (c.length <= 5)  return c;
    if (c.length <= 12) return `${c.slice(0,5)}-${c.slice(5)}`;
    return `${c.slice(0,5)}-${c.slice(5,12)}-${c.slice(12,13)}`;
  };

  const calcStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8)          s++;
    if (/[a-z]/.test(pw))        s++;
    if (/[A-Z]/.test(pw))        s++;
    if (/[0-9]/.test(pw))        s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    return s;
  };

  const strengthMeta = [
    null,
    { label: 'Very weak',  color: '#EF4444', pct: 20 },
    { label: 'Weak',       color: '#F97316', pct: 40 },
    { label: 'Fair',       color: '#EAB308', pct: 60 },
    { label: 'Strong',     color: '#22C55E', pct: 80 },
    { label: 'Very strong',color: '#16A34A', pct: 100 },
  ];

  const sm = passwordStrength > 0 ? strengthMeta[passwordStrength] : null;

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;

    if (id === 'cnic' || id === 'fatherCnic') {
      setFormData(p => ({ ...p, [id]: formatCNIC(value) }));
    } else if (type === 'checkbox') {
      setFormData(p => ({ ...p, [id]: checked }));
    } else {
      setFormData(p => ({ ...p, [id]: value }));
    }

    if (id === 'password') setPasswordStrength(calcStrength(value));

    if (id === 'confirmPassword') {
      if (!value)                          setPasswordMatch('');
      else if (formData.password === value) setPasswordMatch('match');
      else                                 setPasswordMatch('nomatch');
    }
    if (id === 'password' && formData.confirmPassword) {
      setPasswordMatch(formData.confirmPassword === value ? 'match' : 'nomatch');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { role, cnic, fatherCnic, name, fatherName, gender, mobile, email, password, confirmPassword, termsAccepted } = formData;

    if (!role)         { alert('Please select a role.');                 setIsSubmitting(false); return; }
    if (!fatherName)   { alert("Father's name is required.");            setIsSubmitting(false); return; }
    if (!gender)       { alert('Please select gender.');                 setIsSubmitting(false); return; }

    const cc  = cnic.replace(/\D/g,'');
    const cfc = fatherCnic.replace(/\D/g,'');
    if (!/^\d{13}$/.test(cc))   { alert('Enter a valid 13-digit CNIC');          setIsSubmitting(false); return; }
    if (!/^\d{13}$/.test(cfc))  { alert("Enter a valid 13-digit Father's CNIC"); setIsSubmitting(false); return; }
    if (!/^03\d{9}$/.test(mobile))   { alert('Enter a valid mobile number (03XXXXXXXXX)'); setIsSubmitting(false); return; }
    if (password.length < 8)    { alert('Password must be at least 8 characters.');  setIsSubmitting(false); return; }
    if (password !== confirmPassword) { alert('Passwords do not match.'); setIsSubmitting(false); return; }
    if (!termsAccepted) { alert('Please accept the Terms of Service and Privacy Policy.'); setIsSubmitting(false); return; }

    const data = { role, cnic: cc, fatherCnic: cfc, name, fatherName, gender, mobile, email, password };
    setTempUser(data);

    try {
      const res = await fetch(`${API_URL}/register-citizen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.success) {
        setCurrentStep(2);
        if (result.otp) { setOtp(result.otp); setDisplayedOtp(result.otp); }
        alert('Verification code generated. Use the code shown below or from the backend terminal.');
      } else { alert(result.message || 'Registration failed'); }
    } catch (err) {
      console.error(err);
      alert('Server unreachable. Please check server connection.');
    } finally { setIsSubmitting(false); }
  };

  const handleOtpVerification = async (e) => {
    e.preventDefault();
    if (!otp)                  { alert('Please enter OTP');      return; }
    if (!/^\d{6}$/.test(otp))  { alert('OTP must be 6 digits'); return; }
    setIsSubmitting(true);

    const data = { ...tempUser, otp };
    try {
      const res = await fetch(`${API_URL}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.success) {
        setUserId(result.userID);
        setCurrentStep(3);
        setTimeout(() => navigate('/login'), 3000);
      } else { alert(result.message || 'Invalid OTP'); }
    } catch (err) {
      console.error(err);
      alert('Server unreachable or verification failed');
    } finally { setIsSubmitting(false); }
  };

  const handleResendOtp = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/register-citizen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tempUser)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        if (result.otp) { setOtp(result.otp); setDisplayedOtp(result.otp); }
        alert('Verification code generated again. Use the code shown below or from the backend terminal.');
      } else { alert(result.message || 'Failed to resend OTP'); }
    } catch (err) {
      console.error(err);
      alert('Failed to resend OTP. Please try again.');
    } finally { setIsSubmitting(false); }
  };

  const steps = ['Account Details', 'Verify Email', 'Complete'];

  return (
    <div className="auth-page">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="auth-nav">
        <div className="auth-nav-inner">
          <Link to="/" className="auth-brand">
            <div className="auth-brand-icon"><i className="fas fa-landmark"></i></div>
            <div className="auth-brand-text">
              Land Records
              <span className="auth-brand-sub">Land Registry System</span>
            </div>
          </Link>
          <span className="auth-nav-badge"><i className="fas fa-shield-alt"></i>&nbsp; Secure Portal</span>
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="auth-body">
        <div className="auth-card auth-card-wide">

          {/* Card header */}
          <div className="auth-card-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div className="auth-card-header-icon" style={{ marginBottom: '.75rem' }}>
                  <i className="fas fa-user-plus"></i>
                </div>
                <h1 className="auth-card-title">Create your account</h1>
                <p className="auth-card-subtitle">Register to access the Land Registry System.</p>
              </div>

              {/* Stepper */}
              <div className="auth-stepper" style={{ minWidth: '280px', marginBottom: 0 }}>
                {steps.map((label, i) => {
                  const num     = i + 1;
                  const isDone  = currentStep > num;
                  const isActive = currentStep === num;
                  return (
                    <React.Fragment key={num}>
                      <div className={`auth-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}>
                        <div className="step-dot">
                          {isDone ? <i className="fas fa-check" style={{ fontSize: '.7rem' }}></i> : num}
                        </div>
                        <span className="step-text">{label}</span>
                      </div>
                      {i < steps.length - 1 && <div className="step-connector"></div>}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="auth-card-body">

            {/* ── STEP 1: Registration Form ── */}
            {currentStep === 1 && (
              <form onSubmit={handleRegisterSubmit} noValidate>

                {/* Role */}
                <div className="auth-section-title">Account Type</div>
                <div className="field-group">
                  <label className="field-label" htmlFor="role">
                    Select Role <span className="field-required">*</span>
                  </label>
                  <select
                    className="auth-select"
                    id="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    style={{ width: '100%', height: '44px' }}
                  >
                    <option value="">— Select your role —</option>
                    <option value="citizen">Citizen</option>
                    <option value="lro">Land Record Officer (LRO)</option>
                    <option value="dc">Deputy Commissioner (DC)</option>
                  </select>
                </div>

                {/* Identity */}
                <div className="auth-section-title" style={{ marginTop: '1.5rem' }}>Identity Information</div>
                <div className="form-row-2">

                  <div className="field-group">
                    <label className="field-label" htmlFor="cnic">
                      Your CNIC <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-id-card field-icon"></i>
                      <input type="text" id="cnic" className="auth-input" placeholder="XXXXX-XXXXXXX-X"
                        maxLength="15" value={formData.cnic} onChange={handleInputChange} required />
                    </div>
                    <span className="field-hint">13-digit CNIC — auto-formatted</span>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="fatherCnic">
                      Father's CNIC <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-id-card-alt field-icon"></i>
                      <input type="text" id="fatherCnic" className="auth-input" placeholder="XXXXX-XXXXXXX-X"
                        maxLength="15" value={formData.fatherCnic} onChange={handleInputChange} required />
                    </div>
                    <span className="field-hint">Father's 13-digit CNIC</span>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="name">
                      Full Name <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-user field-icon"></i>
                      <input type="text" id="name" className="auth-input" placeholder="As on CNIC"
                        value={formData.name} onChange={handleInputChange} required />
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="fatherName">
                      Father's Name <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-user-tie field-icon"></i>
                      <input type="text" id="fatherName" className="auth-input" placeholder="Father's full name"
                        value={formData.fatherName} onChange={handleInputChange} required />
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="gender">
                      Gender <span className="field-required">*</span>
                    </label>
                    <select
                      className="auth-select"
                      id="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      required
                      style={{ width: '100%', height: '44px' }}
                    >
                      <option value="">— Select gender —</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>
                </div>

                {/* Contact */}
                <div className="auth-section-title" style={{ marginTop: '1.5rem' }}>Contact Details</div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="mobile">
                      Mobile Number <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-mobile-alt field-icon"></i>
                      <input type="text" id="mobile" className="auth-input" placeholder="03XXXXXXXXX"
                        maxLength="11" value={formData.mobile} onChange={handleInputChange} required />
                    </div>
                    <span className="field-hint">Format: 03XXXXXXXXX</span>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="email">
                      Email Address <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-envelope field-icon"></i>
                      <input type="email" id="email" className="auth-input" placeholder="you@example.com"
                        value={formData.email} onChange={handleInputChange} required autoComplete="email" />
                    </div>
                  </div>
                </div>

                {/* Security */}
                <div className="auth-section-title" style={{ marginTop: '1.5rem' }}>Security</div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="password">
                      Password <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-lock field-icon"></i>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        className="auth-input input-has-right"
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        autoComplete="new-password"
                      />
                      <button type="button" className="field-action" onClick={() => setShowPassword(v => !v)}>
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {formData.password && sm && (
                      <div className="pw-strength">
                        <div className="pw-strength-track">
                          <div className="pw-strength-fill" style={{ width: `${sm.pct}%`, backgroundColor: sm.color }}></div>
                        </div>
                        <span className="pw-strength-text" style={{ color: sm.color }}>{sm.label}</span>
                      </div>
                    )}
                    <span className="field-hint">8+ chars · uppercase · lowercase · number · symbol</span>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="confirmPassword">
                      Confirm Password <span className="field-required">*</span>
                    </label>
                    <div className="field-input-wrap">
                      <i className="fas fa-lock field-icon"></i>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        className={`auth-input input-has-right${passwordMatch === 'nomatch' ? ' is-error' : ''}`}
                        placeholder="Re-enter your password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        autoComplete="new-password"
                      />
                      <button type="button" className="field-action" onClick={() => setShowConfirmPassword(v => !v)}>
                        <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {passwordMatch === 'match'   && <span className="pw-match-ok"><i className="fas fa-check-circle"></i>&nbsp;Passwords match</span>}
                    {passwordMatch === 'nomatch' && <span className="pw-match-err"><i className="fas fa-times-circle"></i>&nbsp;Passwords do not match</span>}
                  </div>
                </div>

                {/* Terms */}
                <div className="field-group" style={{ marginTop: '.5rem' }}>
                  <label className="auth-check-wrap">
                    <input
                      type="checkbox"
                      id="termsAccepted"
                      checked={formData.termsAccepted}
                      onChange={handleInputChange}
                      required
                    />
                    <span className="auth-check-label">
                      I have read and agree to the&nbsp;
                      <button type="button" style={{ background:'none', border:'none', padding:0, color:'#2563eb', textDecoration:'underline', cursor:'pointer', font: 'inherit' }}>Terms of Service</button> and <button type="button" style={{ background:'none', border:'none', padding:0, color:'#2563eb', textDecoration:'underline', cursor:'pointer', font: 'inherit' }}>Privacy Policy</button>
                    </span>
                  </label>
                </div>

                <button type="submit" className="btn-auth-primary" disabled={isSubmitting} style={{ marginTop: '.5rem' }}>
                  {isSubmitting
                    ? <><i className="fas fa-circle-notch btn-spinner"></i> Creating Account…</>
                    : <><i className="fas fa-user-plus"></i> Create Account</>
                  }
                </button>

                <p className="auth-footer-text">
                  Already have an account?&nbsp;
                  <Link to="/login">Sign in here</Link>
                </p>
              </form>
            )}

            {/* ── STEP 2: OTP ── */}
            {currentStep === 2 && (
              <div className="otp-display-box">
                <div className="otp-icon-wrap"><i className="fas fa-envelope-open-text"></i></div>
                <h2 className="otp-title">Verify your email</h2>
                <p className="otp-desc">
                  We sent a 6-digit code to&nbsp;
                  <span className="otp-email">{formData.email}</span>
                </p>

                {displayedOtp && (
                  <div className="auth-alert auth-alert-info" style={{ marginTop: '1rem', textAlign: 'left' }}>
                    <i className="fas fa-info-circle"></i>
                    <span><strong>Dev mode – OTP auto-filled:</strong> {displayedOtp}</span>
                  </div>
                )}

                <form onSubmit={handleOtpVerification} noValidate>
                  <input
                    type="text"
                    className="otp-input"
                    maxLength="6"
                    placeholder="000000"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />

                  <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
                    {isSubmitting
                      ? <><i className="fas fa-circle-notch btn-spinner"></i> Verifying…</>
                      : <><i className="fas fa-check"></i> Verify &amp; Continue</>
                    }
                  </button>
                </form>

                <p className="otp-resend-row" style={{ marginTop: '1.25rem' }}>
                  Didn't receive it?&nbsp;
                  <button type="button" className="btn-auth-ghost" onClick={handleResendOtp} disabled={isSubmitting}>
                    Resend code
                  </button>
                </p>
              </div>
            )}

            {/* ── STEP 3: Success ── */}
            {currentStep === 3 && (
              <div className="auth-success-box">
                <div className="success-icon-wrap"><i className="fas fa-check"></i></div>
                <h2 className="success-title">Registration successful!</h2>
                <p className="success-desc">Your account has been created and verified.</p>

                {userId && (
                  <div>
                    <p style={{ fontSize: '.8rem', color: 'var(--clr-text-muted)', marginTop: '1rem', marginBottom: '.4rem' }}>Your User ID</p>
                    <div className="user-id-badge">{userId}</div>
                  </div>
                )}

                <p className="redirect-hint">Redirecting to login in 3 seconds</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
