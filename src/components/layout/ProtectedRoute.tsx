import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminRole } from '@/types/api';
import { Spinner } from '@/components/ui/spinner';

export function ProtectedRoute() {
  const location = useLocation();
  const { user, hydrated } = useAuthStore();

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner className="h-6 w-6 text-brand-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdminRole(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
