import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminGuard({ children }) {
  const { isAuthenticated, mustChangePw } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (mustChangePw && location.pathname !== '/admin/change-password') {
    return <Navigate to="/admin/change-password" replace />;
  }

  return children;
}
