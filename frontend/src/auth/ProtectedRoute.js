import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-mark">PTX</div>
        <p>Restoring secure session</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-mark">PTX</div>
        <p>Checking account</p>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
