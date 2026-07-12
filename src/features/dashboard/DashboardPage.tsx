import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CreditCard,
  Database,
  HardDrive,
  Presentation,
  ShieldCheck,
  Users,
  HelpCircle,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { dashboardApi } from '@/services/dashboard.api';
import { useAuthStore } from '@/lib/auth-store';
import { cn, formatDateTime, initials } from '@/lib/utils';
import { ROLE_LABEL } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';

const chartColors = ['#1149B5', '#FF7A00', '#7C3AED', '#22C55E', '#0EA5E9', '#EF4444'];

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function MetricCard({
  label,
  value,
  detail,
  explanation,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  explanation?: string;
  icon: typeof Users;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated',
        onClick && 'cursor-pointer',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
    >
      <div className="flex items-start justify-between px-5 py-4">
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
              {label}
            </p>
            {explanation && (
              <span
                className="inline-flex cursor-help items-center text-ink-400 transition hover:text-ink-700"
                title={explanation}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <p className="mt-2 text-3xl font-black text-ink-900">{value}</p>
          <p className="mt-1 text-xs font-semibold text-ink-600">{detail}</p>
          {explanation && (
            <p className="mt-1 text-[11px] text-ink-400">{explanation}</p>
          )}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="h-1.5 transition-all duration-300 group-hover:h-2" style={{ backgroundColor: accent }} />
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-h-[320px]">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-base font-bold text-ink-900">{title}</h3>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
      <div className="h-[245px] px-3 py-4">{children}</div>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line bg-surface-variant text-sm text-ink-400">
      {label}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showGuide, setShowGuide] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardApi.overview,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="mx-auto mt-12 max-w-lg px-4 py-8 text-center sm:px-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-danger/10 text-danger">
          <Activity className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink-900">
          Dashboard metrics unavailable
        </h2>
        <p className="mt-2 text-sm text-ink-500">
          The admin API did not return dashboard analytics. Try refreshing once
          the backend deployment is available.
        </p>
        <Button className="mt-5" variant="primary" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  const utilizationData = [
    { name: 'Used teacher licences', value: data.subscriptions.seatUsage },
    {
      name: 'Available teacher licences',
      value: Math.max(data.subscriptions.seatLimit - data.subscriptions.seatUsage, 0),
    },
  ];
  const activityHasData = data.activity.trend.some((bucket) => bucket.value > 0);
  const roleData = data.users.byRole.filter((bucket) => bucket.value > 0);
  const licenceData = data.subscriptions.byStatus.filter((bucket) => bucket.value > 0);
  const orgKindData = data.organizations.byKind.filter((bucket) => bucket.value > 0);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg bg-brand-navy text-white shadow-elevated">
        <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase text-white/70">
                <ShieldCheck className="h-4 w-4 text-brand-orange" />
                {data.scope.type === 'GLOBAL' ? 'Global command view' : 'Managed scope'}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(!showGuide)}
                className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <HelpCircle className="mr-1.5 h-4 w-4 text-brand-orange" />
                {showGuide ? 'Hide Metrics Guide' : 'Metrics Guide & FAQ'}
              </Button>
            </div>
            <h2 className="mt-5 text-3xl font-black text-white">
              Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              The workspace is tracking {data.users.active} active users across{' '}
              {data.organizations.active} active organizations with{' '}
              {data.subscriptions.utilizationRate}% teacher licence utilization.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-xs text-white/55">Generated</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatDateTime(data.generatedAt)}
              </p>
              <p className="mt-0.5 text-[11px] text-white/50">Real-time snapshot</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-xs text-white/55">Role</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {user?.role ? ROLE_LABEL[user.role] : 'Admin'}
              </p>
              <p className="mt-0.5 text-[11px] text-white/50">Access scope</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3" title="Accounts created within the last 30 days">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/55">New users</p>
                <span className="rounded bg-brand-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  30 days
                </span>
              </div>
              <p className="mt-1 text-2xl font-black text-white">
                {data.users.newThisPeriod}
              </p>
              <p className="mt-0.5 text-[11px] text-white/70">Added in last 30 days</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3" title="Licence keys scheduled to expire within the next 30 days">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/55">Expiring licences</p>
                <span className="rounded bg-brand-orange/40 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Action req.
                </span>
              </div>
              <p className="mt-1 text-2xl font-black text-white">
                {data.subscriptions.expiringSoon}
              </p>
              <p className="mt-0.5 text-[11px] text-white/70">Keys expiring within 30 days</p>
            </div>
          </div>
        </div>
      </section>

      {showGuide && (
        <Card className="border border-brand-primary/30 bg-brand-primary/5 p-5 transition-all">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 className="text-base font-bold text-ink-900">
              Quick Metrics Guide & Portal FAQ
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGuide(false)}
              className="text-xs text-ink-500"
            >
              Close
            </Button>
          </div>
          <div className="mt-4 grid gap-4 text-xs leading-5 text-ink-700 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-3.5 shadow-sm">
              <p className="font-bold text-ink-900">1. Teacher Licences</p>
              <p className="mt-1 text-ink-600">
                Represents total activation seats allocated across classroom boards. Each active interactive panel uses one seat out of your total limit.
              </p>
            </div>
            <div className="rounded-lg bg-white p-3.5 shadow-sm">
              <p className="font-bold text-ink-900">2. Expiring Licences</p>
              <p className="mt-1 text-ink-600">
                Shows the number of activation keys that will reach their end date within the next 30 days. Renew them in the License module to avoid disruption.
              </p>
            </div>
            <div className="rounded-lg bg-white p-3.5 shadow-sm">
              <p className="font-bold text-ink-900">3. New Users</p>
              <p className="mt-1 text-ink-600">
                Shows user accounts created or added to your organization within the past 30 days across teachers, admins, or partner scopes.
              </p>
            </div>
            <div className="rounded-lg bg-white p-3.5 shadow-sm">
              <p className="font-bold text-ink-900">4. Licence Utilization</p>
              <p className="mt-1 text-ink-600">
                Shows the percentage of total teacher seats currently assigned and active. Keep an eye on this to know when to purchase additional capacity.
              </p>
            </div>
          </div>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Users"
          value={data.users.active}
          detail={`${data.users.disabled} suspended accounts`}
          explanation="Workspace accounts active and logged in"
          icon={Users}
          accent="#1149B5"
        />
        <MetricCard
          label="Organizations"
          value={data.organizations.total}
          detail={`${data.organizations.active} active, ${data.organizations.inactive} inactive`}
          explanation="Customer and partner organizations managed"
          icon={Building2}
          accent="#0EA5E9"
        />
        <MetricCard
          label="Teacher Licences"
          value={`${data.subscriptions.seatUsage}/${data.subscriptions.seatLimit}`}
          detail={`${data.subscriptions.utilizationRate}% allocated`}
          explanation="Total classroom teacher seats assigned"
          icon={CreditCard}
          accent="#FF7A00"
        />
        <MetricCard
          label="Content"
          value={data.content.canvases.total}
          detail={`${data.content.liveSessions.total} live sessions, ${data.content.exports.total} exports`}
          explanation="Whiteboard canvases, live classes & exports"
          icon={Presentation}
          accent="#7C3AED"
          onClick={() => navigate('/content')}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 transition-all duration-300 hover:shadow-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
                Activation Keys Overview
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-900">
                {data.subscriptions.seatUsage} active keys · {data.subscriptions.expiringSoon} expiring soon
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {Math.max(data.subscriptions.seatLimit - data.subscriptions.seatUsage, 0)} unallocated seats remaining
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <KeyRound className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 transition-all duration-300 hover:shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="w-full pr-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
                  Licence Capacity Bar
                </p>
                <span className="text-xs font-bold text-brand-orange">
                  {data.subscriptions.utilizationRate}% Used
                </span>
              </div>
              <div className="mt-2.5">
                <Progress value={data.subscriptions.utilizationRate} className="h-2.5" />
              </div>
              <p className="mt-1.5 text-xs text-ink-500">
                {data.subscriptions.seatUsage} of {data.subscriptions.seatLimit} total capacity allocated
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 transition-all duration-300 hover:shadow-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
                System Sync & Health
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-success">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Live & Synchronized
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                All cloud activations & fingerprints operating normally
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ChartCard
          title="Activity Trend"
          subtitle="Admin actions over the last 14 days"
        >
          {activityHasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.activity.trend}>
                <defs>
                  <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#1149B5" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#1149B5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Actions"
                  stroke="#1149B5"
                  strokeWidth={3}
                  fill="url(#activity-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No admin actions in this period" />
          )}
        </ChartCard>

        <ChartCard title="User Mix" subtitle="Accounts by role">
          {roleData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" name="Users" radius={[0, 6, 6, 0]} fill="#1149B5" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No users found" />
          )}
        </ChartCard>

        <ChartCard title="Teacher Licence Utilization" subtitle="Current allocation">
          <div className="grid h-full gap-3 sm:grid-cols-[1fr_130px] sm:items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={utilizationData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="82%"
                  paddingAngle={3}
                >
                  <Cell fill="#FF7A00" />
                  <Cell fill="#E2E8F0" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div>
              <p className="text-4xl font-black text-ink-900">
                {data.subscriptions.utilizationRate}%
              </p>
              <p className="mt-2 text-sm text-ink-500">
                {data.subscriptions.seatUsage} of {data.subscriptions.seatLimit} teacher licences in use
              </p>
            </div>
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h3 className="text-base font-bold text-ink-900">Recent Activity</h3>
              <p className="text-xs text-ink-500">Latest administrative changes</p>
            </div>
            {user?.role === 'SUPER_ADMIN' && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="divide-y divide-line">
            {data.activity.recent.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-4">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {initials(entry.actorUser?.name ?? entry.actorUser?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {entry.summary ?? entry.action}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {entry.actorUser?.name ?? entry.actorUser?.email} -{' '}
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                <Badge variant="info">{entry.targetType}</Badge>
              </div>
            ))}
            {data.activity.recent.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-ink-500">
                No recent admin activity in this scope.
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="border-b border-line px-5 py-4">
              <h3 className="text-base font-bold text-ink-900">Operational Mix</h3>
              <p className="text-xs text-ink-500">Licence capacity and organization health</p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
                  Licence capacity
                </p>
                <div className="space-y-2">
                  {licenceData.map((bucket, index) => (
                    <div key={bucket.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        />
                        {bucket.label}
                      </span>
                      <span className="font-bold text-ink-900">{bucket.value}</span>
                    </div>
                  ))}
                  {licenceData.length === 0 && (
                    <p className="text-sm text-ink-400">No licence capacity found.</p>
                  )}
                </div>
              </div>
              <div className="border-t border-line pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
                  Organizations
                </p>
                <div className="space-y-2">
                  {orgKindData.map((bucket, index) => (
                    <div key={bucket.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: chartColors[(index + 2) % chartColors.length] }}
                        />
                        {bucket.label}
                      </span>
                      <span className="font-bold text-ink-900">{bucket.value}</span>
                    </div>
                  ))}
                  {orgKindData.length === 0 && (
                    <p className="text-sm text-ink-400">No organizations found.</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-4 text-center">
                <Database className="mx-auto h-5 w-5 text-brand-primary" />
                <p className="mt-2 text-lg font-black text-ink-900">
                  {data.content.liveSessions.total}
                </p>
                <p className="text-xs text-ink-500">Sessions</p>
              </div>
              <div className="px-4 py-4 text-center">
                <HardDrive className="mx-auto h-5 w-5 text-brand-orange" />
                <p className="mt-2 text-lg font-black text-ink-900">
                  {formatBytes(data.content.exports.storageBytes)}
                </p>
                <p className="text-xs text-ink-500">Exports</p>
              </div>
              <div className="px-4 py-4 text-center">
                <ShieldCheck className="mx-auto h-5 w-5 text-success" />
                <p className="mt-2 text-lg font-black text-ink-900">
                  {data.users.admins}
                </p>
                <p className="text-xs text-ink-500">Admins</p>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
