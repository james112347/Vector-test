import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Heart, Compass, Target, Settings } from 'lucide-react';
import { usePendingUsers } from '../../lib/usePendingUsers';

const tabs = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/orientation', label: 'Guida', icon: Compass },
  { path: '/goals', label: 'Obiettivi', icon: Target },
  { path: '/health', label: 'Salute', icon: Heart },
  { path: '/settings', label: 'Altro', icon: Settings },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingCount = usePendingUsers();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border safe-area-bottom">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          const showBadge = tab.path === '/settings' && pendingCount > 0;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
