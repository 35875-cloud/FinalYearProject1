import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const [errors, setErrors] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth';

  const emailRegex    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [id]: type === 'checkbox' ? checked : value }));

    if (id === 'email') {
      if (!value)                        setErrors(p => ({ ...p, email: 'Email is required.' }));
      else if (!emailRegex.test(value))  setErrors(p => ({ ...p, email: 'Enter a valid email address.' }));
      else                               setErrors(p => ({ ...p, email: '' }));
    }

    if (id === 'password') {
      if (!value)                           setErrors(p => ({ ...p, password: 'Password is required.' }));
      else if (!passwordRegex.test(value))  setErrors(p => ({ ...p, password: 'Must be 8+ chars with uppercase, lowercase, number & symbol.' }));
      else                                  setErrors(p => ({ ...p, password: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let valid = true;

    if (!formData.email) {
      setErrors(p => ({ ...p, email: 'Email is required.' })); valid = false;
    } else if (!emailRegex.test(formData.email)) {
      setErrors(p => ({ ...p, email: 'Enter a valid email address.' })); valid = false;
    }

    if (!formData.password) {
      setErrors(p => ({ ...p, password: 'Password is required.' })); valid = false;
    } else if (!passwordRegex.test(formData.password)) {
      setErrors(p => ({ ...p, password: 'Must be 8+ chars with uppercase, lowercase, number & symbol.' })); valid = false;
    }

    if (!valid) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });
      const result = await response.json();

      if (result.success) {
        sessionStorage.setItem('authToken', result.token);
        sessionStorage.setItem('userId',    result.userId);
        sessionStorage.setItem('userRole',  result.role);

        const profileRes = await fetch(`${API_URL}/user-profile`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${result.token}` }
        });
        const userDetails = await profileRes.json();
        if (userDetails.success) {
          sessionStorage.setItem('userName',          userDetails.name);
          sessionStorage.setItem('userBlockchainId',  userDetails.blockchain_address);
          sessionStorage.setItem('userEmail',         userDetails.email);
        }

        const role = result.role.toUpperCase();
        if      (role === 'CITIZEN')                               navigate('/citizen/dashboard');
        else if (role === 'LRO' || role === 'LAND RECORD OFFICER') navigate('/lro/dashboard');
        else if (role === 'ADMIN')                                 navigate('/admin/dashboard');
        else if (role === 'TEHSILDAR')                             navigate('/tehsildar/dashboard');
        else if (role === 'AC')                                    navigate('/ac/dashboard');
        else if (role === 'DC')                                    navigate('/dc/dashboard');
        else { alert(`Login successful! Role: ${role}. Dashboard not configured yet.`); navigate('/citizen/dashboard'); }
      } else {
        alert(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login Error:', err);
      alert('Server connection error. Ensure the backend server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="auth-nav">
        <div className="auth-nav-inner">
          <Link to="/" className="auth-brand">
            <div className="auth-brand-icon">
              <i className="fas fa-landmark"></i>
            </div>
            <div className="auth-brand-text">
              Blockchain Land Records
              <span className="auth-brand-sub">Punjab Land Registry System</span>
            </div>
          </Link>
          <span className="auth-nav-badge">
            <i className="fas fa-shield-alt"></i>&nbsp; Secure Portal
          </span>
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="auth-body" style={{ alignItems: 'center' }}>
        <div className="auth-card auth-card-login">

          {/* Logo / Brand block */}
          <div className="auth-login-logo">
            <div className="auth-login-logo-icon">
              <i className="fas fa-shield-alt"></i>
            </div>
            <p className="auth-login-brand-name">Blockchain Land Records</p>
            <p className="auth-login-brand-sub">Punjab Land Registry System</p>
          </div>

          {/* Form panel */}
          <div className="auth-panel-right">
            <form onSubmit={handleSubmit} noValidate>

              {/* Email */}
              <div className="field-group">
                <label className="field-label" htmlFor="email">Email</label>
                <div className="field-input-wrap">
                  <i className="fas fa-envelope field-icon"></i>
                  <input
                    type="email"
                    id="email"
                    className={`auth-input${errors.email ? ' is-error' : ''}`}
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i>{errors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="field-group">
                <label className="field-label" htmlFor="password">Password</label>
                <div className="field-input-wrap">
                  <i className="fas fa-lock field-icon"></i>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className={`auth-input input-has-right${errors.password ? ' is-error' : ''}`}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="field-action"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {errors.password && (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i>{errors.password}
                  </span>
                )}
              </div>

              {/* Remember / Forgot */}
              <div className="auth-row-flex">
                <label className="auth-check-wrap">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                  />
                  <span className="auth-check-label">Remember me</span>
                </label>
                <Link to="/reset-password" className="btn-auth-ghost" style={{ fontSize: '.84rem' }}>
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
                {isSubmitting
                  ? <><i className="fas fa-circle-notch btn-spinner"></i> Signing in…</>
                  : 'Sign In'
                }
              </button>

            </form>

            {/* Register prompt */}
            <div className="auth-register-prompt">
              <p>Don't have an account? <Link to="/register" className="btn-auth-ghost" style={{ fontSize: '.84rem' }}>Create Account</Link></p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;