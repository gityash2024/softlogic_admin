import { useLocation } from 'react-router-dom';
import { CalendarDays, Menu, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { runtimeBrandForOrganization } from '@/lib/branding';
import { ROLE_LABEL } from '@/types/api';
import { Button } from '@/components/ui/button';

const PATH_TO_TITLE: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Executive overview, growth signals, and workspace health',
  },
  '/users': { title: 'Users', subtitle: 'Provision accounts and control access' },
  '/content': {
    title: 'Content',
    subtitle: 'Review canvases, live sessions, and generated exports',
  },
  '/organizations': {
    title: 'Organizations',
    subtitle: 'Manage partners, customers, branding, and AI access',
  },
  '/activity': {
    title: 'Activity',
    subtitle: 'Audit trail for administrative changes',
  },
  '/license': {
    title: 'License',
    subtitle: 'Activation keys, licence terms, and billing history',
  },
  '/ai': {
    title: 'AI',
    subtitle: 'Master key, AI credits, and live usage',
  },
  '/maintenance': {
    title: 'Maintenance',
    subtitle: 'Schedule service windows and platform access locks',
  },
  '/portal': {
    title: 'Role Portal',
    subtitle: 'Boards, sessions, materials, and role-scoped controls',
  },
  '/teacher/dashboard': {
    title: 'Teacher Dashboard',
    subtitle: 'Teaching overview, live sessions, and board activity',
  },
  '/teacher/boards': {
    title: 'Teacher Boards',
    subtitle: 'Manage your own whiteboards and app editing workflow',
  },
  '/teacher/sessions': {
    title: 'Teacher Sessions',
    subtitle: 'Control live sessions, join codes, and invites',
  },
  '/teacher/materials': {
    title: 'Teacher Materials',
    subtitle: 'Review captures, recordings, imports, and board materials',
  },
  '/student/dashboard': {
    title: 'Student Dashboard',
    subtitle: 'Learning overview, live access, and read-only boards',
  },
  '/student/join': {
    title: 'Join Session',
    subtitle: 'Enter a live-class session code',
  },
  '/student/previous': {
    title: 'Previous Sessions',
    subtitle: 'Review your session history',
  },
  '/student/boards': {
    title: 'Student Boards',
    subtitle: 'Read-only boards from allowed sessions',
  },
  '/student/progress': {
    title: 'Student Progress',
    subtitle: 'Recent activity, sessions, and learning materials',
  },
  '/parent/dashboard': {
    title: 'Parent Dashboard',
    subtitle: 'Linked-student progress and session overview',
  },
  '/parent/linked-students': {
    title: 'Linked Students',
    subtitle: 'Student scope for this parent account',
  },
  '/parent/sessions-boards': {
    title: 'Sessions & Boards',
    subtitle: 'Read-only session and board history for linked students',
  },
  '/parent/reports': {
    title: 'Parent Reports',
    subtitle: 'Progress signals and recent linked-student activity',
  },
  '/downloads': {
    title: 'Downloads',
    subtitle: 'SoftLogic Whiteboard Android and Windows installers',
  },
  '/settings': { title: 'Settings', subtitle: 'Personal profile and locale' },
};

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  const brand = runtimeBrandForOrganization(user?.primaryOrganization);
  const meta = PATH_TO_TITLE[location.pathname] ??
    (location.pathname.startsWith('/content/live-sessions/')
      ? {
          title: 'Live Session Details',
          subtitle: 'Participants, messages, media, events, and AI output',
        }
      : location.pathname.startsWith('/teacher/sessions/') && location.pathname.endsWith('/materials')
        ? {
            title: 'Study Materials',
            subtitle: 'Upload and preview session materials',
          }
      : location.pathname.startsWith('/teacher/sessions/')
        ? {
            title: 'Live Session Details',
            subtitle: 'Teaching session activity and learning records',
          }
      : location.pathname.startsWith('/users/')
      ? { title: 'User Form', subtitle: 'Create or edit account access' }
      : location.pathname.startsWith('/organizations/')
        ? {
            title: 'Organization Form',
            subtitle: 'Configure workspace identity and hierarchy',
          }
        : location.pathname.startsWith('/subscriptions/')
          ? {
              title: 'License',
              subtitle: 'Activation keys, licence terms, and billing history',
            }
          : {
    title: 'SoftLogic Console',
            subtitle: `${brand.name} workspace operations`,
          });
  const displayMeta =
    brand.isWhiteLabel && location.pathname === '/downloads'
      ? { ...meta, subtitle: 'AI Smart Board Android and Windows installers' }
      : meta;

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 px-3 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-ink-900 sm:text-xl">
                {displayMeta.title}
              </h1>
              <span className="hidden rounded-full border border-brand-primary/15 bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary sm:inline-flex">
                Live
              </span>
            </div>
            <p className="truncate text-xs text-ink-500 sm:text-sm">
              {displayMeta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-ink-500 shadow-sm md:flex">
            <CalendarDays className="h-4 w-4 text-brand-primary" />
            {new Date().toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 shadow-sm sm:flex">
            <ShieldCheck className="h-4 w-4 text-brand-orange" />
            <div className="text-right">
              <p className="max-w-[150px] truncate text-xs font-semibold text-ink-900">
                {user?.name ?? 'Administrator'}
              </p>
              <p className="text-[11px] text-ink-500">
                {user?.role ? ROLE_LABEL[user.role] : 'Admin'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
