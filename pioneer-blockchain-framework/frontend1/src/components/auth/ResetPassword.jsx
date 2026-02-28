import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Auth.css';

const ResetPassword = () => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [formData, setFormData] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [showNewPassword,     setShowNewPassword]     = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatch,       setPasswordMatch]       = useState('');
  const [displayedOtp,        setDisplayedOtp]        = useState('');
  const [isSubmitting,        setIsSubmitting]        = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth';

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));

    if (id === 'confirmPassword') {
      if (!value)                             setPasswordMatch('');
      else if (formData.newPassword === value) setPasswordMatch('match');
      else                                    setPasswordMatch('nomatch');
    }
    if (id === 'newPassword' && formData.confirmPassword) {
      setPasswordMatch(formData.confirmPassword === value ? 'match' : 'nomatch');
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res    = await fetch(`${API_URL}/request-password-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email }) });
      const result = await res.json();
      if (result.success) {
        setCurrentStep(2);
        if (result.otp) { setFormData(p => ({ ...p, otp: result.otp })); setDisplayedOtp(result.otp); }
        alert('✅ Reset code sent! Check your email.');
      } else { alert('❌ ' + result.message); }
    } catch { alert('❌ Server error. Please try again.'); }
    finally  { setIsSubmitting(false); }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res    = await fetch(`${API_URL}/verify-reset-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email, otp: formData.otp }) });
      const result = await res.json();
      if (result.success) { setCurrentStep(3); }
      else { alert('❌ ' + result.message); }
    } catch { alert('❌ Server error. Please try again.'); }
    finally  { setIsSubmitting(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) { alert('❌ Passwords do not match!'); return; }
    if (formData.newPassword.length < 8) { alert('❌ Password must be at least 8 characters!'); return; }
    setIsSubmitting(true);
    try {
      const res    = await fetch(`${API_URL}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email, otp: formData.otp, newPassword: formData.newPassword }) });
      const result = await res.json();
      if (result.success) { setCurrentStep(4); }
      else { alert('❌ ' + result.message); }
    } catch { alert('❌ Server error. Please try again.'); }
    finally  { setIsSubmitting(false); }
  };

  const handleResendOtp = async () => {
    if (!formData.email) return;
    setIsSubmitting(true);
    try {
      const res    = await fetch(`${API_URL}/request-password-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email }) });
      const result = await res.json();
      if (result.success) {
        if (result.otp) { setFormData(p => ({ ...p, otp: result.otp })); setDisplayedOtp(result.otp); }
        alert('✅ New code sent!');
      } else { alert('❌ ' + result.message); }
    } catch { alert('❌ Failed to resend code.'); }
    finally  { setIsSubmitting(false); }
  };

  const steps = ['Enter Email', 'Verify Code', 'New Password'];

  return (
    <div className="auth-page">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="auth-nav">
        <div className="auth-nav-inner">
          <Link to="/" className="auth-brand">
            <div className="auth-brand-icon"><i className="fas fa-landmark"></i></div>
            <div className="auth-brand-text">
              Blockchain Land Records
              <span className="auth-brand-sub">Punjab Land Registry System</span>
            </div>
          </Link>
          <span className="auth-nav-badge"><i className="fas fa-shield-alt"></i>&nbsp; Secure Portal</span>
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="auth-body" style={{ alignItems: 'flex-start', paddingTop: '3rem' }}>
        <div className="auth-card auth-card-single">

          {/* Card header */}
          <div className="auth-card-header">
            <div className="auth-card-header-icon"><i className="fas fa-key"></i></div>
            <h1 className="auth-card-title">Reset your password</h1>
            <p className="auth-card-subtitle">Follow the steps to securely reset your account password.</p>
          </div>

          <div className="auth-card-body">

            {/* Stepper — only shown for steps 1-3 */}
            {currentStep < 4 && (
              <div className="auth-stepper">
                {steps.map((label, i) => {
                  const num    = i + 1;
                  const isDone = currentStep > num;
                  const isActive = currentStep === num;
                  return (
                    <React.Fragment key={num}>
                      <div className={`auth-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}>
                        <div className="step-dot">
                          {isDone ? <i className="fas fa-check" style={{ fontSize: '.75rem' }}></i> : num}
                        </div>
                        <span className="step-text">{label}</span>
                      </div>
                      {i < steps.length - 1 && <div className="step-connector"></div>}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* ── STEP 1 ── */}
            {currentStep === 1 && (
              <form onSubmit={handleEmailSubmit} noValidate>
                <p className="form-page-subtitle" style={{ marginBottom: '1.5rem' }}>
                  Enter the email address linked to your account and we'll send you a verification code.
                </p>

                <div className="field-group">
                  <label className="field-label" htmlFor="email">
                    Email Address <span className="field-required">*</span>
                  </label>
                  <div className="field-input-wrap">
                    <i className="fas fa-envelope field-icon"></i>
                    <input
                      type="email"
                      id="email"
                      className="auth-input"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
                  {isSubmitting
                    ? <><i className="fas fa-circle-notch btn-spinner"></i> Sending…</>
                    : <><i className="fas fa-paper-plane"></i> Send Reset Code</>
                  }
                </button>

                <p className="auth-footer-text">
                  <Link to="/login" className="btn-auth-ghost">
                    <i className="fas fa-arrow-left"></i> Back to Login
                  </Link>
                </p>
              </form>
            )}

            {/* ── STEP 2 ── */}
            {currentStep === 2 && (
              <div className="otp-display-box" style={{ padding: '0' }}>
                <div className="otp-icon-wrap"><i className="fas fa-envelope-open-text"></i></div>
                <h2 className="otp-title">Check your inbox</h2>
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

                <form onSubmit={handleOtpSubmit} noValidate>
                  <input
                    type="text"
                    className="otp-input"
                    maxLength="6"
                    placeholder="000000"
                    value={formData.otp}
                    onChange={e => setFormData(p => ({ ...p, otp: e.target.value }))}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />

                  <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
                    {isSubmitting
                      ? <><i className="fas fa-circle-notch btn-spinner"></i> Verifying…</>
                      : <><i className="fas fa-check"></i> Verify Code</>
                    }
                  </button>
                </form>

                <p className="otp-resend-row" style={{ marginTop: '1rem' }}>
                  Didn't receive it?&nbsp;
                  <button className="btn-auth-ghost" onClick={handleResendOtp} disabled={isSubmitting} type="button">
                    Resend code
                  </button>
                </p>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {currentStep === 3 && (
              <form onSubmit={handlePasswordSubmit} noValidate>
                <p className="form-page-subtitle" style={{ marginBottom: '1.5rem' }}>
                  Choose a strong password. Use at least 8 characters with uppercase, lowercase, number, and symbol.
                </p>

                <div className="field-group">
                  <label className="field-label" htmlFor="newPassword">
                    New Password <span className="field-required">*</span>
                  </label>
                  <div className="field-input-wrap">
                    <i className="fas fa-lock field-icon"></i>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      className="auth-input input-has-right"
                      placeholder="Create a strong password"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      required
                    />
                    <button
                      type="button"
                      className="field-action"
                      onClick={() => setShowNewPassword(v => !v)}
                      aria-label="Toggle password visibility"
                    >
                      <i className={`fas ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
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
                    />
                    <button
                      type="button"
                      className="field-action"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      aria-label="Toggle password visibility"
                    >
                      <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {passwordMatch === 'match'   && <span className="pw-match-ok"><i className="fas fa-check-circle"></i>&nbsp;Passwords match</span>}
                  {passwordMatch === 'nomatch' && <span className="pw-match-err"><i className="fas fa-times-circle"></i>&nbsp;Passwords do not match</span>}
                </div>

                <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
                  {isSubmitting
                    ? <><i className="fas fa-circle-notch btn-spinner"></i> Resetting…</>
                    : <><i className="fas fa-shield-alt"></i> Reset Password</>
                  }
                </button>
              </form>
            )}

            {/* ── STEP 4 — Success ── */}
            {currentStep === 4 && (
              <div className="auth-success-box">
                <div className="success-icon-wrap"><i className="fas fa-check"></i></div>
                <h2 className="success-title">Password updated!</h2>
                <p className="success-desc">
                  Your password has been reset successfully.<br />
                  You can now sign in with your new credentials.
                </p>
                <div style={{ marginTop: '1.75rem' }}>
                  <Link to="/login" className="btn-auth-primary" style={{ display: 'inline-flex', textDecoration: 'none', width: 'auto', padding: '0 2rem' }}>
                    <i className="fas fa-sign-in-alt"></i> Go to Login
                  </Link>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;