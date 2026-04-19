import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Vitals } from './pages/Vitals';
import { Calendar } from './pages/Calendar';
import { Profile } from './pages/Profile';
import { PairingCode } from './pages/PairingCode';
import { Medications } from './pages/Medications';
import { Location } from './pages/Location';
import { FamilyOnboarding } from './pages/FamilyOnboarding';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" />;
  }

  // If user is a family member and not linked to a senior
  if (profile.role === 'family' && !profile.linkedSeniorId) {
    // If they are not on onboarding or pairing, send to onboarding
    if (location.pathname !== '/family-onboarding' && location.pathname !== '/pairing') {
      return <Navigate to="/family-onboarding" />;
    }
    // Otherwise allow them to stay on the page they are (onboarding or pairing)
  }

  // If user is a caregiver and not linked to any family, redirect to pairing page
  if (profile.role === 'caregiver' && (!profile.linkedFamilyUids || profile.linkedFamilyUids.length === 0)) {
    if (location.pathname !== '/pairing') {
      return <Navigate to="/pairing" />;
    }
  }

  // If we are on onboarding or pairing but ALREADY linked/ready, go to dashboard
  if (profile.role === 'family' && profile.linkedSeniorId && (location.pathname === '/family-onboarding' || location.pathname === '/pairing')) {
    return <Navigate to="/" />;
  }

  if (profile.role === 'caregiver' && profile.linkedFamilyUids && profile.linkedFamilyUids.length > 0 && location.pathname === '/pairing') {
    return <Navigate to="/" />;
  }

  // For pages that need layout
  const noLayoutPages = ['/family-onboarding', '/pairing'];
  if (noLayoutPages.includes(location.pathname)) {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/family-onboarding" element={<ProtectedRoute><FamilyOnboarding /></ProtectedRoute>} />
            <Route path="/pairing" element={<ProtectedRoute><PairingCode /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/vitals" element={<ProtectedRoute><Vitals /></ProtectedRoute>} />
            <Route path="/location" element={<ProtectedRoute><Location /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/medications" element={<ProtectedRoute><Medications /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
