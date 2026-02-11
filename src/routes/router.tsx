import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Terms from '../pages/Terms';
import Dashboard from '../pages/Dashboard';
import LogEnergy from '../pages/LogEnergy';
import History from '../pages/History';
import Settings from '../pages/Settings';

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/terms', element: <Terms /> },
  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/log', element: <LogEnergy /> },
          { path: '/history', element: <History /> },
          { path: '/settings', element: <Settings /> },
        ],
      },
    ],
  },
], {
  basename: '/Vector-test',
});
