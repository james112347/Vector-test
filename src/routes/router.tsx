import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Terms from '../pages/Terms';
import Dashboard from '../pages/Dashboard';
import LogEnergy from '../pages/LogEnergy';
import History from '../pages/History';
import Health from '../pages/Health';
import Settings from '../pages/Settings';
import AdminDashboard from '../pages/AdminDashboard';
import Profile from '../pages/Profile';
import ProfileEdit from '../pages/ProfileEdit';
import FeedbackChat from '../pages/FeedbackChat';
import Orientation from '../pages/Orientation';
import FoodScanner from '../pages/FoodScanner';
import Goals from '../pages/Goals';

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
          { path: '/health', element: <Health /> },
          { path: '/settings', element: <Settings /> },
          { path: '/profile', element: <Profile /> },
          { path: '/profile/edit', element: <ProfileEdit /> },
          { path: '/admin', element: <AdminDashboard /> },
          { path: '/feedback', element: <FeedbackChat /> },
          { path: '/orientation', element: <Orientation /> },
          { path: '/food', element: <FoodScanner /> },
          { path: '/goals', element: <Goals /> },
        ],
      },
    ],
  },
], {
  basename: '/Vector-test',
});
