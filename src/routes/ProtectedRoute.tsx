import { Navigate, Outlet } from 'react-router-dom';
import { useAuthState } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { isSignedIn, isLoading } = useAuthState();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return isSignedIn ? <Outlet /> : <Navigate to="/login" replace />;
}
