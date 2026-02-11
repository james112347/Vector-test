import { Navigate, Outlet } from 'react-router-dom';
import { useAuthState } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { isSignedIn, isLoading, user } = useAuthState();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.isApproved) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
