import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getUserRole } from '../../services/storage/preferences';

interface HostRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Route protection guard ensuring Player role cannot access Host-specific views
 * (Collection, Workshop, Import, Prompts, Settings, or Host Session creation).
 */
export const HostRouteGuard: React.FC<HostRouteGuardProps> = ({ children }) => {
  const role = getUserRole();
  const location = useLocation();

  if (role !== 'host') {
    // Redirect non-host or unselected roles directly to player portal or home
    return <Navigate to="/play" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
