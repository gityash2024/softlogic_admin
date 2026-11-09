import { useState } from 'react';
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supportApi } from '@/services/support.api';
import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  CalendarClock,
  Files,
  Activity as ActivityIcon,
  HelpCircle,
  Inbox,
  KeyRound,
  BrainCircuit,
  Wrench,
  Settings,
  Download,
  GraduationCap,
  ClipboardList,
  MonitorPlay,
  Presentation,
  LogOut,
  ChevronUp,
  ChevronDown,
  CloudCog,
  CreditCard,
  SlidersHorizontal,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { UserRole } from '@/types/api';
import { cn, initials } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { runtimeBrandForOrganization } from '@/lib/branding';
import { canAccessAiModule } from '@/lib/ai-access';
import { AI_NAVIGATION, aiGroup, aiTab } from '@/features/ai/components/ai-navigation';
import { canManageMaintenance } from '@/lib/maintenance-access';
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
    to: '/ai',
    label: 'AI',
    description: 'Credits and models',
    icon: BrainCircuit,
  },
  {
    to: '/maintenance',
    label: 'Maintenance',
    description: 'Service windows',
    icon: Wrench,
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

const AI_GROUP_ICONS = {
  Overview: LayoutDashboard,
  'Access & credits': SlidersHorizontal,
  'Plans & payments': CreditCard,
  Accounts: Building2,
  Providers: CloudCog,
};

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

const getNavItems = (
  role: UserRole | undefined,
  showAiModule: boolean,
  showMaintenanceModule: boolean,
) => {
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
  if (!showAiModule) {
    items = items.filter((item) => item.to !== '/ai');
  }
  if (!showMaintenanceModule) {
    items = items.filter((item) => item.to !== '/maintenance');
  }
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
  const location = useLocation();
  const inAi = Boolean(useMatch('/ai'));
  const [aiDisclosure, setAiDisclosure] = useState({ inAi, expanded: inAi });
  if (aiDisclosure.inAi !== inAi) setAiDisclosure({ inAi, expanded: inAi });
  const aiExpanded = aiDisclosure.expanded;
  const { user, tokens, clear } = useAuthStore();
  const brand = runtimeBrandForOrganization(user?.primaryOrganization);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navItems = getNavItems(
    user?.role,
    canAccessAiModule(user),
    canManageMaintenance(user),
  ).map((item) =>
    brand.isWhiteLabel && item.to === '/help'
      ? { ...item, description: 'Ask support' }
      : item,
  );
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

        <div className="relative flex items-center justify-between px-5 py-3">
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
            'relative mx-3 overflow-hidden rounded-lg border border-white/10 bg-white/10 px-4 py-2 transition-all duration-300',
            collapsed && 'lg:mx-3 lg:max-h-0 lg:border-0 lg:p-0 lg:opacity-0',
          )}
        >
          <p className="text-[11px] font-semibold uppercase leading-4 text-white/55">
            {consoleLabel}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-5 text-white">
            {user?.role ? ROLE_LABEL[user.role] : 'Administrator'}
          </p>
        </div>

        <nav
          className={cn(
            'relative min-h-0 flex-1 overflow-hidden px-3 py-1.5 transition-all duration-300',
            collapsed && 'lg:px-2',
            canAccessAiModule(user) && aiExpanded &&
              'overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          <ul className="space-y-0">
            {navItems.map((item) => item.to === '/ai' ? (
              <AiSidebarItem
                key={item.to}
                search={inAi ? location.search : undefined}
                collapsed={collapsed}
                expanded={aiExpanded}
                onToggle={() => setAiDisclosure({ inAi, expanded: !aiExpanded })}
                onNavigate={() => onOpenChange(false)}
              />
            ) : (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  data-tour={`tour-${item.to.replace(/^\//, '')}`}
                  onClick={() => onOpenChange(false)}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-3 py-1 text-sm transition-all duration-200',
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
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
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
                            'block truncate text-[11px] leading-4',
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
            'relative border-t border-white/10 p-2 transition-all duration-300',
            collapsed && 'lg:px-2',
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-white transition hover:bg-white/10 focus:outline-none',
                  collapsed && 'lg:justify-center',
                )}
              >
                <Avatar className="h-9 w-9 border border-white/15">
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
        title={`Sign out of ${brand.name}?`}
        description="Your local session will be cleared on this device. You can sign back in with your account credentials."
        confirmLabel="Sign out"
        tone="warning"
        loading={loggingOut}
        onConfirm={handleLogout}
      />
    </>
  );
}

function AiSidebarItem({ search, collapsed, expanded, onToggle, onNavigate }: {
  search?: string;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const activeGroup = search === undefined ? undefined : aiGroup(aiTab(new URLSearchParams(search).get('tab'))).label;
  const groupLinks = AI_NAVIGATION.map(({ label, tabs: [first] }) => {
    const params = new URLSearchParams(search);
    if (first.id === 'overview') params.delete('tab');
    else params.set('tab', first.id);
    return { label, to: { pathname: '/ai', search: params.toString() }, Icon: AI_GROUP_ICONS[label] };
  });

  return (
    <li>
      <button
        type="button"
        data-tour="tour-ai"
        aria-expanded={expanded}
        aria-controls="sidebar-ai-sections"
        onClick={onToggle}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-lg px-3 py-1 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-orange',
          activeGroup ? 'bg-white text-brand-navy shadow-sidebar' : 'text-white/75 hover:bg-white/10 hover:text-white',
          collapsed && 'lg:hidden',
        )}
      >
        <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-lg', activeGroup ? 'bg-brand-orange/15 text-brand-orange' : 'bg-white/10 text-white/80')}>
          <BrainCircuit size={14} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">AI</span>
          <span className={cn('block truncate text-[11px] leading-4', activeGroup ? 'text-brand-navy/70' : 'text-white/60')}>Credits and models</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={cn('shrink-0 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} />
      </button>

      <ul id="sidebar-ai-sections" className={cn(
        'mb-1.5 ml-5 mt-1.5 space-y-0.5 border-l border-white/20 pl-2.5',
        !expanded && 'hidden',
        collapsed && 'lg:hidden',
      )}>
        {groupLinks.map(({ label, to, Icon }) => (
          <li key={label}>
            <Link
              to={to}
              onClick={onNavigate}
              aria-current={activeGroup === label ? 'true' : undefined}
              className={cn(
                'flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] leading-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-orange',
                activeGroup === label ? 'bg-white/20 font-semibold text-white' : 'font-medium text-white/80 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={14} aria-hidden="true" className="shrink-0" />
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {collapsed && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="AI sections" title="AI sections" className={cn(
              'hidden min-h-9 w-full place-items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-orange lg:grid',
              activeGroup ? 'bg-white text-brand-navy shadow-sidebar' : 'text-white/80 hover:bg-white/10 hover:text-white',
            )}>
              <BrainCircuit size={17} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            <DropdownMenuLabel>AI sections</DropdownMenuLabel>
            {groupLinks.map(({ label, to, Icon }) => (
              <DropdownMenuItem asChild key={label}>
                <Link to={to} aria-current={activeGroup === label ? 'true' : undefined} className={cn(activeGroup === label && 'bg-surface-variant font-semibold text-brand-primary')}>
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
