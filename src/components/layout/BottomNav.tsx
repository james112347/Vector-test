import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PenLine, Clock, Settings } from 'lucide-react';

const tabs = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/log', label: 'Registra', icon: PenLine },
  { path: '/history', label: 'Storico', icon: Clock },
  { path: '/settings', label: 'Impost.', icon: Settings },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border safe-area-bottom">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
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
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
