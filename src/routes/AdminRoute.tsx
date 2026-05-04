import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';

export default function AdminRoute() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
