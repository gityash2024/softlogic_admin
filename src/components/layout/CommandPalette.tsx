import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Files,
  Activity as ActivityIcon,
  HelpCircle,
  Inbox,
  KeyRound,
  BrainCircuit,
  Settings,
  Download,
  GraduationCap,
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from 'lucide-react';
import { isAdminRole, type UserRole } from '@/types/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { usersApi } from '@/services/users.api';
import { organizationsApi } from '@/services/organizations.api';
import { subscriptionsApi } from '@/services/subscriptions.api';

const BASE_NAV_ITEMS: NavCommand[] = [
  { kind: 'nav', to: '/dashboard', label: 'Dashboard', hint: 'Command center', icon: LayoutDashboard },
  { kind: 'nav', to: '/users', label: 'Users', hint: 'Access and roles', icon: Users },
  { kind: 'nav', to: '/content', label: 'Content', hint: 'Canvases and exports', icon: Files },
  { kind: 'nav', to: '/organizations', label: 'Organizations', hint: 'Partners and customers', icon: Building2 },
  { kind: 'nav', to: '/subscriptions', label: 'Subscriptions', hint: 'Plans and seats', icon: CreditCard },
  { kind: 'nav', to: '/activity', label: 'Activity', hint: 'Audit trail', icon: ActivityIcon },
  { kind: 'nav', to: '/license', label: 'License', hint: 'Billing reference', icon: KeyRound },
  { kind: 'nav', to: '/ai', label: 'AI', hint: 'Credits and models', icon: BrainCircuit },
  { kind: 'nav', to: '/downloads', label: 'Downloads', hint: 'APK and EXE', icon: Download },
  { kind: 'nav', to: '/settings', label: 'Settings', hint: 'Profile and locale', icon: Settings },
];

const SUPPORT_INBOX_ITEM: NavCommand = {
  kind: 'nav',
  to: '/support',
  label: 'Support Inbox',
  hint: 'Org admin requests',
  icon: Inbox,
};

const HELP_ITEM: NavCommand = {
  kind: 'nav',
  to: '/help',
  label: 'Help',
  hint: 'Ask the SoftLogic team',
  icon: HelpCircle,
};

// Mirrors Sidebar.getNavItems so the palette surfaces the same destinations,
// including role-specific Support/Help entries, without altering the sidebar.
function getNavCommands(role: UserRole | undefined): NavCommand[] {
  if (role === 'TEACHER' || role === 'STUDENT' || role === 'PARENT') {
    return [
      { kind: 'nav', to: '/portal', label: 'Portal', hint: 'Role workspace', icon: GraduationCap },
      { kind: 'nav', to: '/downloads', label: 'Downloads', hint: 'APK and EXE', icon: Download },
    ];
  }
  const items = [...BASE_NAV_ITEMS];
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
}

interface NavCommand {
  kind: 'nav';
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

interface RecordCommand {
  kind: 'record';
  to: string;
  label: string;
  hint: string;
  group: 'Organizations' | 'Users' | 'Subscriptions';
  icon: LucideIcon;
}

type Command = NavCommand | RecordCommand;

const matches = (query: string, ...fields: (string | null | undefined)[]) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
};

export function CommandPalette() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const canSearchAdminRecords = isAdminRole(role);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global Cmd/Ctrl+K toggle. Esc + backdrop close are handled by Radix Dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Reset transient state whenever the palette closes.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;

  const usersQuery = useQuery({
    queryKey: ['command-palette', 'users'],
    queryFn: usersApi.all,
    enabled: open && hasQuery && canSearchAdminRecords,
    staleTime: 60_000,
  });
  const orgsQuery = useQuery({
    queryKey: ['command-palette', 'organizations'],
    queryFn: organizationsApi.all,
    enabled: open && hasQuery && canSearchAdminRecords,
    staleTime: 60_000,
  });
  const subscriptionsQuery = useQuery({
    queryKey: ['command-palette', 'subscriptions'],
    queryFn: subscriptionsApi.all,
    enabled: open && hasQuery && canSearchAdminRecords,
    staleTime: 60_000,
  });

  const navCommands = useMemo(
    () => getNavCommands(role).filter((item) => matches(query, item.label, item.hint)),
    [role, query],
  );

  const recordCommands = useMemo<RecordCommand[]>(() => {
    if (!hasQuery) return [];
    const orgs = (orgsQuery.data ?? [])
      .filter((org) => matches(query, org.name, org.slug))
      .slice(0, 5)
      .map<RecordCommand>((org) => ({
        kind: 'record',
        group: 'Organizations',
        to: `/organizations/${org.id}/edit`,
        label: org.name,
        hint: org.slug ? `@${org.slug}` : 'Organization',
        icon: Building2,
      }));
    const users = (usersQuery.data ?? [])
      .filter((user) => matches(query, user.name, user.email))
      .slice(0, 5)
      .map<RecordCommand>((user) => ({
        kind: 'record',
        group: 'Users',
        to: `/users/${user.id}/edit`,
        label: user.name ?? user.email,
        hint: user.email,
        icon: Users,
      }));
    const subscriptions = (subscriptionsQuery.data ?? [])
      .filter((sub) =>
        matches(
          query,
          sub.planName,
          sub.organization?.name,
          sub.user?.name,
          sub.user?.email,
        ),
      )
      .slice(0, 5)
      .map<RecordCommand>((sub) => ({
        kind: 'record',
        group: 'Subscriptions',
        to: `/subscriptions/${sub.id}/details`,
        label: sub.planName,
        hint:
          sub.organization?.name ??
          sub.user?.name ??
          sub.user?.email ??
          'Subscription',
        icon: CreditCard,
      }));
    return [...orgs, ...users, ...subscriptions];
  }, [hasQuery, query, orgsQuery.data, usersQuery.data, subscriptionsQuery.data]);

  // Flat list drives keyboard selection; grouping is presentational only.
  const flatCommands = useMemo<Command[]>(
    () => [...navCommands, ...recordCommands],
    [navCommands, recordCommands],
  );

  // Keep the active index within range as results change.
  useEffect(() => {
    setActiveIndex((prev) =>
      flatCommands.length === 0 ? 0 : Math.min(prev, flatCommands.length - 1),
    );
  }, [flatCommands.length]);

  const runCommand = useCallback(
    (command: Command) => {
      setOpen(false);
      navigate(command.to);
    },
    [navigate],
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) =>
        flatCommands.length === 0 ? 0 : (prev + 1) % flatCommands.length,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) =>
        flatCommands.length === 0
          ? 0
          : (prev - 1 + flatCommands.length) % flatCommands.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = flatCommands[activeIndex];
      if (command) runCommand(command);
    }
  };

  // Keep the active row scrolled into view as selection moves.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const recordsLoading =
    hasQuery &&
    (usersQuery.isLoading || orgsQuery.isLoading || subscriptionsQuery.isLoading);

  const groupedRecords = useMemo(() => {
    const groups: Record<RecordCommand['group'], RecordCommand[]> = {
      Organizations: [],
      Users: [],
      Subscriptions: [],
    };
    for (const cmd of recordCommands) groups[cmd.group].push(cmd);
    return groups;
  }, [recordCommands]);

  // Map a command back to its index in the flat list for selection/aria state.
  const indexOf = useCallback(
    (command: Command) => flatCommands.indexOf(command),
    [flatCommands],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm animate-fade-in" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          aria-label="Command palette"
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-white shadow-elevated animate-slide-up"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search navigation, organizations, users, and subscriptions.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages, organizations, users, subscriptions..."
              className="h-12 w-full border-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto scrollbar-thin px-2 py-2"
          >
            {navCommands.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Navigation
                </p>
                <ul>
                  {navCommands.map((command) => (
                    <CommandRow
                      key={command.to}
                      command={command}
                      index={indexOf(command)}
                      activeIndex={activeIndex}
                      onHover={setActiveIndex}
                      onSelect={runCommand}
                    />
                  ))}
                </ul>
              </div>
            )}

            {hasQuery &&
              (
                ['Organizations', 'Users', 'Subscriptions'] as RecordCommand['group'][]
              ).map((group) =>
                groupedRecords[group].length > 0 ? (
                  <div key={group} className="mb-1">
                    <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      {group}
                    </p>
                    <ul>
                      {groupedRecords[group].map((command) => (
                        <CommandRow
                          key={command.to}
                          command={command}
                          index={indexOf(command)}
                          activeIndex={activeIndex}
                          onHover={setActiveIndex}
                          onSelect={runCommand}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}

            {recordsLoading && (
              <p className="px-3 py-3 text-sm text-ink-400">Searching records...</p>
            )}

            {!recordsLoading && flatCommands.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-400">
                No results found.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-variant/60 px-4 py-2 text-[11px] text-ink-500">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Kbd>
                  <ArrowUp className="h-3 w-3" />
                </Kbd>
                <Kbd>
                  <ArrowDown className="h-3 w-3" />
                </Kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>
                  <CornerDownLeft className="h-3 w-3" />
                </Kbd>
                to open
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd>
              to close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function CommandRow({
  command,
  index,
  activeIndex,
  onHover,
  onSelect,
}: {
  command: Command;
  index: number;
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (command: Command) => void;
}) {
  const isActive = index === activeIndex;
  const Icon = command.icon;
  return (
    <li>
      <button
        type="button"
        data-index={index}
        role="option"
        aria-selected={isActive}
        onMouseMove={() => onHover(index)}
        onClick={() => onSelect(command)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
          isActive ? 'bg-brand-primary/10 text-ink-900' : 'text-ink-700 hover:bg-surface-variant',
        )}
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            isActive
              ? 'bg-brand-primary/15 text-brand-primary'
              : 'bg-surface-variant text-ink-500',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{command.label}</span>
          <span className="block truncate text-xs text-ink-400">{command.hint}</span>
        </span>
      </button>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-line bg-white px-1 font-sans text-[10px] font-semibold text-ink-500 shadow-sm">
      {children}
    </kbd>
  );
}
