import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, checkingSession } = useAuth();

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] text-sm text-[#52616b]">
        Verificando acesso...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}
