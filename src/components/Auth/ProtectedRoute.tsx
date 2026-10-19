import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Layers } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#080C14] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-pulse">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-blue-500/20 blur-md -z-10 animate-ping opacity-40" />
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0.4s]" />
          <span className="ml-1 tracking-wide">Authenticating MakePattern...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
