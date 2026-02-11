import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthState } from '../contexts/AuthContext';
import { useUserProfile } from '../lib/useUserProfile';
import Onboarding from '../pages/Onboarding';

export function ProtectedRoute() {
  const { isSignedIn, isLoading, user } = useAuthState();
  const { profile, loading: profileLoading, reload } = useUserProfile(user?.id);
  const [onboardingDone, setOnboardingDone] = useState(false);

  if (isLoading || profileLoading) {
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

  // Show onboarding if profile not yet completed
  if (!profile && !onboardingDone) {
    return (
      <Onboarding
        onComplete={() => {
          setOnboardingDone(true);
          reload();
        }}
      />
    );
  }

  return <Outlet />;
}
