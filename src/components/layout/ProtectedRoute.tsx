import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminRole, type UserRole } from '@/types/api';
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

  return <Outlet />;
}

export function AdminRoute() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdminRole(user.role)) return <Navigate to="/portal" replace />;
  return <Outlet />;
}

export function RoleRoute({ roles }: { roles: UserRole[] }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={isAdminRole(user.role) ? '/dashboard' : '/portal'} replace />;
  }
  return <Outlet />;
}
