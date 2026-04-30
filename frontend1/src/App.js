import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import './App.css';
import { getStoredAuthValue, hydrateAuthSession } from './utils/authSession';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ResetPassword from './components/auth/ResetPassword';

// Citizen Components
import CitizenDashboard from './components/dashboards/CitizenDashboard';
import MyProperties from './components/citizen/MyProperties';
import CitizenOwnershipHistory from './components/citizen/CitizenOwnershipHistory';
import CitizenProfile from './components/citizen/CitizenProfile';
import SellerPortal from './components/citizen/SellerPortal';
import Marketplace from './components/citizen/Marketplace';
import TransferNegotiation from './components/citizen/TransferNegotiation';
import PendingTransfers from './components/citizen/PendingTransfers';
import Challan from './components/citizen/Challan';
import ChallanPayment from './components/citizen/ChallanPayment';
import CitizenSuccessionPlanner from './components/citizen/CitizenSuccessionPlanner';

// Officer (LRO) Components
import OfficerDashboard from './components/officer/OfficerDashboard';
import OfficerPendingRegistrations from './components/officer/OfficerPendingRegistrations';
import OfficerPendingTransfers from './components/officer/OfficerPendingTransfers';
import OfficerRejectedRegistrations from './components/officer/OfficerRejectedRegistrations';
import OfficerRejectedTransfers from './components/officer/OfficerRejectedTransfers';
import LROVotingPanel from './components/officer/LROVotingPanel';
import TransferVotingPanel from './components/officer/TransferVotingPanel';
import OfficerSuccessionCases from './components/officer/OfficerSuccessionCases';
import OfficerCitizenHistory from './components/officer/OfficerCitizenHistory';
import OfficerOwnershipHistory from './components/officer/OfficerOwnershipHistory';
import IntegrityDashboard from './components/officer/IntegrityDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import DCDashboard from './components/dc/DCDashboard';
import DCTransferDashboard from './components/dc/DCTransferDashboard';
import DCRestrictionDashboard from './components/dc/DCRestrictionDashboard';

// ── Coming Soon stub ─────────────────────────────────────────
const ComingSoon = ({ role }) => (
  <div style={{
    minHeight: '100vh', background: '#edf5f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'sans-serif'
  }}>
    <div style={{
      background: 'white', borderRadius: 16, padding: '3rem 4rem',
      boxShadow: '0 8px 32px rgba(13,124,124,.12)', textAlign: 'center',
      border: '1px solid #d6e8e8', maxWidth: 440
    }}>
      <div style={{
        width: 64, height: 64, background: '#0D7C7C', borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1.25rem', color: 'white', fontSize: '1.5rem'
      }}>
        <i className="fas fa-tools" />
      </div>
      <h2 style={{ color: '#111827', marginBottom: '.5rem', fontWeight: 700 }}>
        {role} Dashboard
      </h2>
      <p style={{ color: '#5C6878', marginBottom: '1.5rem' }}>
        This dashboard is under development and will be available soon.
      </p>
      <Link to="/login" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#0D7C7C', color: 'white', textDecoration: 'none',
        padding: '10px 24px', borderRadius: 10, fontWeight: 600, fontSize: '.9rem'
      }}>
        <i className="fas fa-arrow-left" style={{ marginRight: 4 }} /> Back to Login
      </Link>
    </div>
  </div>
);

// ── Protected Route ──────────────────────────────────────────
hydrateAuthSession();

const ProtectedRoute = ({ children, allowedRoles }) => {
  const userRole = getStoredAuthValue('userRole');
  const authToken = getStoredAuthValue('authToken');
  if (!authToken) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(userRole?.toUpperCase()))
    return <Navigate to="/login" replace />;
  return children;
};

const PR = ({ children }) => (
  <ProtectedRoute allowedRoles={['CITIZEN']}>{children}</ProtectedRoute>
);

const LRO = ({ children }) => (
  <ProtectedRoute allowedRoles={['LRO', 'LAND RECORD OFFICER']}>{children}</ProtectedRoute>
);

function App() {
  useEffect(() => {
    hydrateAuthSession();

    const interval = window.setInterval(() => {
      hydrateAuthSession();
    }, 5000);

    const handleFocus = () => {
      hydrateAuthSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hydrateAuthSession();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Router>
      <div className="app-shell route-fade">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ── Public ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── Citizen ── */}
          <Route path="/citizen/dashboard" element={<PR><CitizenDashboard /></PR>} />
          <Route path="/citizen/my-properties" element={<PR><MyProperties /></PR>} />
          <Route path="/citizen/ownership-history" element={<PR><CitizenOwnershipHistory /></PR>} />
          <Route path="/citizen/profile" element={<PR><CitizenProfile /></PR>} />
          <Route path="/citizen/transfers" element={<PR><PendingTransfers /></PR>} />
          <Route path="/citizen/marketplace" element={<PR><Marketplace /></PR>} />
          <Route path="/citizen/seller" element={<PR><SellerPortal /></PR>} />
          <Route path="/citizen/succession" element={<PR><CitizenSuccessionPlanner /></PR>} />
          <Route path="/citizen/negotiation" element={<PR><TransferNegotiation /></PR>} />
          <Route path="/citizen/challan" element={<PR><Challan /></PR>} />
          <Route path="/citizen/challan-payment" element={<PR><ChallanPayment /></PR>} />

          {/* ── LRO Officer ── */}
          <Route path="/lro/dashboard" element={<LRO><OfficerDashboard /></LRO>} />
          <Route path="/lro/pending-registrations" element={<LRO><OfficerPendingRegistrations /></LRO>} />
          <Route path="/lro/pending-transfers" element={<LRO><OfficerPendingTransfers /></LRO>} />
          <Route path="/lro/blockchain" element={<LRO><LROVotingPanel /></LRO>} />
          <Route path="/lro/transfer-voting" element={<LRO><TransferVotingPanel /></LRO>} />
          <Route path="/lro/succession" element={<LRO><OfficerSuccessionCases /></LRO>} />
          <Route path="/lro/citizen-history" element={<LRO><OfficerCitizenHistory /></LRO>} />
          <Route path="/lro/ownership-history" element={<LRO><OfficerOwnershipHistory /></LRO>} />
          <Route path="/lro/integrity" element={<LRO><IntegrityDashboard /></LRO>} />
          <Route path="/lro/rejected-registrations" element={<LRO><OfficerRejectedRegistrations /></LRO>} />
          <Route path="/lro/rejected-transfers" element={<LRO><OfficerRejectedTransfers /></LRO>} />

          {/* ── Admin / DC ── */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><Navigate to="/admin/dashboard" replace /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard section="overview" /></ProtectedRoute>} />
          <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard section="approvals" /></ProtectedRoute>} />
          <Route path="/admin/health" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard section="system" /></ProtectedRoute>} />
          <Route path="/admin/integrity" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard section="integrity" /></ProtectedRoute>} />
          <Route path="/admin/ownership-history" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard section="ownership" /></ProtectedRoute>} />
          <Route path="/admin/recovery" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard section="recovery" /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard section="audit" /></ProtectedRoute>} />
          <Route path="/dc/dashboard" element={<ProtectedRoute allowedRoles={['DC']}><DCDashboard /></ProtectedRoute>} />
          <Route path="/dc/transfers" element={<ProtectedRoute allowedRoles={['DC']}><DCTransferDashboard /></ProtectedRoute>} />
          <Route path="/dc/restrictions" element={<ProtectedRoute allowedRoles={['DC']}><DCRestrictionDashboard /></ProtectedRoute>} />

          {/* ── Legacy unsupported role stubs ── */}
          <Route path="/tehsildar/*" element={<ProtectedRoute allowedRoles={['TEHSILDAR']}><ComingSoon role="Tehsildar" /></ProtectedRoute>} />
          <Route path="/ac/*" element={<ProtectedRoute allowedRoles={['AC']}><ComingSoon role="AC" /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

const NotFound = () => (
  <div style={{ minHeight: '100vh', background: '#edf5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: '6rem', fontWeight: 900, color: '#0D7C7C', margin: 0 }}>404</h1>
      <h2 style={{ color: '#111827', marginBottom: '.5rem' }}>Page Not Found</h2>
      <p style={{ color: '#5C6878', marginBottom: '1.5rem' }}>The page you're looking for does not exist.</p>
      <a href="/login" style={{ background: '#0D7C7C', color: 'white', textDecoration: 'none', padding: '10px 24px', borderRadius: 10, fontWeight: 600 }}>
        Go to Login
      </a>
    </div>
  </div>
);

export default App;
