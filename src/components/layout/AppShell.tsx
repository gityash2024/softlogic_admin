import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { useAuthStore } from '@/lib/auth-store';

function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!impersonation) return null;

  const label = impersonation.user.name?.trim() || impersonation.user.email;

  const handleExit = () => {
    stopImpersonation();
    // Refetch everything as the real admin again.
    queryClient.clear();
    navigate('/');
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Viewing as <strong>{label}</strong> ({impersonation.user.role})
      </span>
      <button
        type="button"
        onClick={handleExit}
        className="shrink-0 rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold text-amber-950 transition hover:bg-amber-950/20"
      >
        Exit
      </button>
    </div>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const scrollRoots = [document.documentElement, document.body, document.getElementById('root')]
      .filter((element): element is HTMLElement => Boolean(element));
    const previous = scrollRoots.map((element) => ({
      element,
      overflow: element.style.overflow,
      height: element.style.height,
    }));

    scrollRoots.forEach((element) => {
      element.style.overflow = 'hidden';
      element.style.height = '100%';
    });

    return () => {
      previous.forEach(({ element, overflow, height }) => {
        element.style.overflow = overflow;
        element.style.height = height;
      });
    };
  }, []);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[#F5F7FB] admin-grid-bg">
      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-thin sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
