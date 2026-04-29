import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';
import { persistAuthSession } from '../../utils/authSession';

const initialFormState = {
  identifier: '',
  password: '',
  rememberMe: false,
};

const initialErrors = {
  identifier: '',
  password: '',
};

const initialMessage = {
  type: '',
  text: '',
};

const Login = () => {
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/auth';

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState(initialErrors);
  const [message, setMessage] = useState(initialMessage);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFormMessage = (type, text) => {
    setMessage({ type, text });
  };

  const persistAndNavigate = async (result) => {
    persistAuthSession({
      authToken: result.token,
      userId: result.userId,
      userRole: result.role,
      authRememberMe: formData.rememberMe,
    });

    try {
      const profileRes = await fetch(`${API_URL}/user-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${result.token}`,
        },
      });
      const userDetails = await profileRes.json();
      if (userDetails.success) {
        persistAuthSession({
          userName: userDetails.name || '',
          userBlockchainId: userDetails.blockchain_address || '',
          userEmail: userDetails.email || '',
          authRememberMe: formData.rememberMe,
        });
      }
    } catch (_error) {
      // Profile fetch failure should not block a successful login.
    }

    const role = String(result.role || '').toUpperCase();
    if (role === 'CITIZEN') navigate('/citizen/dashboard');
    else if (role === 'LRO' || role === 'LAND RECORD OFFICER') navigate('/lro/dashboard');
    else if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'TEHSILDAR') navigate('/tehsildar/dashboard');
    else if (role === 'AC') navigate('/ac/dashboard');
    else if (role === 'DC') navigate('/dc/dashboard');
    else navigate('/citizen/dashboard');
  };

  const validateCredentials = () => {
    const nextErrors = { ...initialErrors };
    let valid = true;

    if (!formData.identifier.trim()) {
      nextErrors.identifier = 'User ID or CNIC is required.';
      valid = false;
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required.';
      valid = false;
    }

    setErrors(nextErrors);
    return valid;
  };

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [id]: nextValue }));

    if (id === 'identifier') {
      if (!value.trim()) {
        setErrors((prev) => ({ ...prev, identifier: 'User ID or CNIC is required.' }));
      } else {
        setErrors((prev) => ({ ...prev, identifier: '' }));
      }
    }

    if (id === 'password') {
      setErrors((prev) => ({ ...prev, password: value ? '' : 'Password is required.' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMessage('', '');
    if (!validateCredentials()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: formData.identifier.trim(),
          password: formData.password,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Login failed. Please check your credentials.');
      }

      await persistAndNavigate(result);
    } catch (err) {
      console.error('Login Error:', err);
      setFormMessage('error', err.message || 'Server connection error. Ensure the backend server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const alertClass = message.type ? `auth-alert auth-alert-${message.type}` : '';

  return (
    <div className="auth-page">
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

      <div className="auth-body" style={{ alignItems: 'center' }}>
        <div className="auth-card auth-card-login">
          <div className="auth-login-logo">
            <div className="auth-login-logo-icon">
              <i className="fas fa-shield-alt"></i>
            </div>
            <p className="auth-login-brand-name">Blockchain Land Records</p>
            <p className="auth-login-brand-sub">Punjab Land Registry System</p>
          </div>

          <div className="auth-panel-right">
            {message.text ? (
              <div className={alertClass}>
                <i className="fas fa-circle-exclamation"></i>
                <div>{message.text}</div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} noValidate>
              <div className="field-group">
                <label className="field-label" htmlFor="identifier">User ID or CNIC</label>
                <div className="field-input-wrap">
                  <i className="fas fa-id-card field-icon"></i>
                  <input
                    type="text"
                    id="identifier"
                    className={`auth-input${errors.identifier ? ' is-error' : ''}`}
                    placeholder="Enter your User ID or CNIC"
                    value={formData.identifier}
                    onChange={handleInputChange}
                    autoComplete="username"
                  />
                </div>
                {errors.identifier ? (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i>{errors.identifier}
                  </span>
                ) : null}
              </div>

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
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {errors.password ? (
                  <span className="field-error">
                    <i className="fas fa-exclamation-circle"></i>{errors.password}
                  </span>
                ) : null}
              </div>

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

              <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><i className="fas fa-circle-notch btn-spinner"></i> Signing in...</>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="auth-register-prompt">
              <p>
                Don&apos;t have an account?{' '}
                <Link to="/register" className="btn-auth-ghost" style={{ fontSize: '.84rem' }}>
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
