import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supportApi } from '@/services/support.api';
import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  CalendarClock,
  CreditCard,
  Files,
  Activity as ActivityIcon,
  HelpCircle,
  Inbox,
  KeyRound,
  Settings,
  Download,
  GraduationCap,
  ClipboardList,
  MonitorPlay,
  Presentation,
  LogOut,
  ChevronUp,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { UserRole } from '@/types/api';
import { cn, initials } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { authApi } from '@/services/auth.api';
import { ROLE_LABEL } from '@/types/api';
import { Logo } from '@/components/brand/Logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const BASE_NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    description: 'Command center',
    icon: LayoutDashboard,
  },
  { to: '/users', label: 'Users', description: 'Access and roles', icon: Users },
  {
    to: '/content',
    label: 'Content',
    description: 'Canvases and exports',
    icon: Files,
  },
  {
    to: '/organizations',
    label: 'Organizations',
    description: 'Partners and customers',
    icon: Building2,
  },
  {
    to: '/subscriptions',
    label: 'Subscriptions',
    description: 'Plans and seats',
    icon: CreditCard,
  },
  {
    to: '/activity',
    label: 'Activity',
    description: 'Audit trail',
    icon: ActivityIcon,
  },
  {
    to: '/license',
    label: 'License',
    description: 'Billing reference',
    icon: KeyRound,
  },
  {
    to: '/downloads',
    label: 'Downloads',
    description: 'APK and EXE',
    icon: Download,
  },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Profile and locale',
    icon: Settings,
  },
];

const SUPPORT_INBOX_ITEM = {
  to: '/support',
  label: 'Support Inbox',
  description: 'Org admin requests',
  icon: Inbox,
};

const HELP_ITEM = {
  to: '/help',
  label: 'Help',
  description: 'Ask the SoftLogic team',
  icon: HelpCircle,
};

const getNavItems = (role: UserRole | undefined) => {
  if (role === 'TEACHER') {
    return [
      {
        to: '/teacher/dashboard',
        label: 'Dashboard',
        description: 'Teaching overview',
        icon: LayoutDashboard,
      },
      {
        to: '/teacher/boards',
        label: 'Boards',
        description: 'Own whiteboards',
        icon: Presentation,
      },
      {
        to: '/teacher/sessions',
        label: 'Sessions',
        description: 'Live classes',
        icon: MonitorPlay,
      },
      {
        to: '/teacher/materials',
        label: 'Materials',
        description: 'Files and captures',
        icon: Files,
      },
      {
        to: '/downloads',
        label: 'Downloads',
        description: 'APK and EXE',
        icon: Download,
      },
      {
        to: '/settings',
        label: 'Settings',
        description: 'Profile and devices',
        icon: Settings,
      },
    ];
  }
  if (role === 'STUDENT') {
    return [
      {
        to: '/student/dashboard',
        label: 'Dashboard',
        description: 'Learning overview',
        icon: LayoutDashboard,
      },
      {
        to: '/student/join',
        label: 'Join Session',
        description: 'Enter code',
        icon: MonitorPlay,
      },
      {
        to: '/student/previous',
        label: 'Previous Sessions',
        description: 'History',
        icon: CalendarClock,
      },
      {
        to: '/student/boards',
        label: 'Boards',
        description: 'Read only',
        icon: BookOpen,
      },
      {
        to: '/student/progress',
        label: 'Progress',
        description: 'Activity',
        icon: ClipboardList,
      },
      {
        to: '/downloads',
        label: 'Downloads',
        description: 'APK and EXE',
        icon: Download,
      },
      {
        to: '/settings',
        label: 'Settings',
        description: 'Profile and devices',
        icon: Settings,
      },
    ];
  }
  if (role === 'PARENT') {
    return [
      {
        to: '/parent/dashboard',
        label: 'Dashboard',
        description: 'Parent overview',
        icon: LayoutDashboard,
      },
      {
        to: '/parent/linked-students',
        label: 'Linked Students',
        description: 'Student scope',
        icon: GraduationCap,
      },
      {
        to: '/parent/sessions-boards',
        label: 'Sessions & Boards',
        description: 'Read only',
        icon: BookOpen,
      },
      {
        to: '/parent/reports',
        label: 'Reports',
        description: 'Progress',
        icon: ClipboardList,
      },
      {
        to: '/downloads',
        label: 'Downloads',
        description: 'APK and EXE',
        icon: Download,
      },
      {
        to: '/settings',
        label: 'Settings',
        description: 'Profile and devices',
        icon: Settings,
      },
    ];
  }
  let items = [...BASE_NAV_ITEMS];
  // Customer/Org admins manage a single workspace, so they don't get the
  // Organizations directory — their own org details are shown read-only in
  // Settings. Super admins and partner admins (who resell to customers) keep it.
  if (role === 'CUSTOMER_ADMIN' || role === 'ADMIN') {
    items = items.filter((item) => item.to !== '/organizations');
  }
  // Insert role-specific entry just before the License item for visual grouping.
  const insertAt = items.findIndex((item) => item.to === '/license');
  const supportEntry =
    role === 'SUPER_ADMIN'
      ? SUPPORT_INBOX_ITEM
      : role === 'PARTNER_ADMIN' || role === 'CUSTOMER_ADMIN' || role === 'ADMIN'
      ? HELP_ITEM
      : null;
  if (supportEntry) {
    items.splice(insertAt >= 0 ? insertAt : items.length, 0, supportEntry);
  }
  return items;
};

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({
  open,
  onOpenChange,
  collapsed,
  onCollapsedChange,
}: SidebarProps) {
  const navigate = useNavigate();
  const { user, tokens, clear } = useAuthStore();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navItems = getNavItems(user?.role);
  const showSupportBadge =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'PARTNER_ADMIN' ||
    user?.role === 'CUSTOMER_ADMIN' ||
    user?.role === 'ADMIN';
  const supportRoute =
    user?.role === 'SUPER_ADMIN' ? '/support' : '/help';
  const unreadQuery = useQuery({
    queryKey: ['support', 'unread-count', user?.role],
    queryFn: supportApi.unreadCount,
    enabled: showSupportBadge,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = unreadQuery.data ?? 0;
  const consoleLabel =
    user?.role === 'TEACHER' || user?.role === 'STUDENT' || user?.role === 'PARENT'
      ? 'Web Panel'
      : 'Admin Console';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (tokens?.refreshToken) {
        try {
          await authApi.logout(tokens.refreshToken);
        } catch {
          // Local session cleanup still happens if the server call fails.
        }
      }
      clear();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-ink-900/35 backdrop-blur-sm lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-[292px] flex-col overflow-hidden border-r border-white/10 bg-brand-navy text-white shadow-2xl transition-[width,transform] duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
          collapsed ? 'lg:w-[88px]' : 'lg:w-[292px]',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full admin-grid-bg" />
        </div>

        <div className="relative flex items-center justify-between px-5 py-4">
          <Logo
            variant="light"
            withWordmark={!collapsed}
            className={cn(
              'min-w-0 transition-all duration-300',
              collapsed && 'lg:mx-auto',
            )}
          />
          <button
            type="button"
            className="hidden rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => onOpenChange(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            'relative mx-4 overflow-hidden rounded-lg border border-white/10 bg-white/10 px-4 py-2.5 transition-all duration-300',
            collapsed && 'lg:mx-3 lg:max-h-0 lg:border-0 lg:p-0 lg:opacity-0',
          )}
        >
          <p className="text-xs font-semibold uppercase text-white/55">
            {consoleLabel}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {user?.role ? ROLE_LABEL[user.role] : 'Administrator'}
          </p>
        </div>

        <nav
          className={cn(
            'relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 transition-all duration-300',
            collapsed && 'lg:px-2',
          )}
        >
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => onOpenChange(false)}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5 text-sm transition-all duration-200',
                      isActive
                        ? 'bg-white text-brand-navy shadow-sidebar'
                        : 'text-white/75 hover:bg-white/10 hover:text-white',
                      collapsed && 'lg:justify-center lg:px-2',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 hidden h-8 w-1 -translate-y-1/2 rounded-r-full bg-brand-orange lg:block" />
                      )}
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
                          isActive
                            ? 'bg-brand-orange/15 text-brand-orange'
                            : 'bg-white/10 text-white/80',
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      <span
                        className={cn(
                          'min-w-0 transition-all duration-200',
                          collapsed && 'lg:w-0 lg:opacity-0',
                        )}
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          {item.label}
                          {item.to === supportRoute && unreadCount > 0 && (
                            <span
                              className={cn(
                                'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none',
                                isActive
                                  ? 'bg-brand-orange text-white'
                                  : 'bg-brand-orange text-white',
                              )}
                            >
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            'block truncate text-xs',
                            isActive ? 'text-brand-navy/60' : 'text-white/45',
                          )}
                        >
                          {item.description}
                        </span>
                      </span>
                      {collapsed && item.to === supportRoute && unreadCount > 0 && (
                        <span className="absolute right-1 top-1 hidden h-2 w-2 rounded-full bg-brand-orange ring-2 ring-brand-navy lg:block" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className={cn(
            'relative border-t border-white/10 p-3 transition-all duration-300',
            collapsed && 'lg:px-2',
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-white transition hover:bg-white/10 focus:outline-none',
                  collapsed && 'lg:justify-center',
                )}
              >
                <Avatar className="h-10 w-10 border border-white/15">
                  <AvatarImage src={user?.avatar ?? undefined} />
                  <AvatarFallback className="bg-brand-orange text-white">
                    {initials(user?.name ?? user?.email, 'A')}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'min-w-0 flex-1 transition-all duration-200',
                    collapsed && 'lg:hidden',
                  )}
                >
                  <p className="truncate text-sm font-semibold">
                    {user?.name ?? 'Administrator'}
                  </p>
                  <p className="truncate text-xs text-white/50">{user?.email}</p>
                </div>
                <ChevronUp
                  className={cn(
                    'h-4 w-4 text-white/45 transition-all duration-200',
                    collapsed && 'lg:hidden',
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-[250px]">
              <DropdownMenuLabel>
                <div className="font-semibold text-ink-900">
                  {user?.name ?? 'Administrator'}
                </div>
                <div className="text-xs text-ink-500">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmLogout(true)}
                className="text-danger focus:text-danger"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <ConfirmationDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Sign out of SoftLogic?"
        description="Your local session will be cleared on this device. You can sign back in with your account credentials."
        confirmLabel="Sign out"
        tone="warning"
        loading={loggingOut}
        onConfirm={handleLogout}
      />
    </>
  );
}
