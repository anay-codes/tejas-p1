import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth';

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [userRole, setUserRole] = useState(authService.getRole());

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(authService.isAuthenticated());
      setUserRole(authService.getRole());
    };
    window.addEventListener('tejas_auth_changed', handleAuthChange);
    return () => window.removeEventListener('tejas_auth_changed', handleAuthChange);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const upperRoles = allowedRoles.map(r => r.toUpperCase());
    if (!upperRoles.includes(userRole)) {
      return (
        <div className="p-8 text-center font-mono">
          <div className="max-w-md mx-auto p-6 rounded-xl bg-red-950/20 border border-red-500/40 text-red-300">
            <h2 className="text-lg font-bold mb-2">ACCESS RESTRICTED</h2>
            <p className="text-xs text-slate-400 mb-4">
              Your role <span className="text-red-400 font-bold">[{userRole}]</span> does not have authorization to view this command module.
            </p>
            <p className="text-[11px] text-slate-500">
              Required privileges: {allowedRoles.join(', ')}
            </p>
          </div>
        </div>
      );
    }
  }

  return children;
}
