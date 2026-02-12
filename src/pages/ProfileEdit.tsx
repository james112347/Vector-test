import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../lib/useUserProfile';
import Onboarding from './Onboarding';

export default function ProfileEdit() {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile(user?.id);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Caricamento profilo...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Profilo non trovato</p>
      </div>
    );
  }

  return (
    <Onboarding
      editMode
      initialProfile={profile}
      onComplete={() => navigate('/profile')}
    />
  );
}
