import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface RequireAuthProps {
  children: React.JSX.Element;
  adminOnly?: boolean;
  doctorOnly?: boolean;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, adminOnly, doctorOnly }) => {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!token) {
    // Save the current location they tried to visit so we can redirect them back after logging in
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    // Redirect unauthorized customers to home
    return <Navigate to="/" replace />;
  }

  if (doctorOnly && user?.role !== 'doctor' && user?.role !== 'admin') {
    // Redirect unauthorized users to home
    return <Navigate to="/" replace />;
  }

  return children;
};
