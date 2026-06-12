import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
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
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Users;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'overflow-hidden',
        onClick && 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-elevated',
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
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black text-ink-900">{value}</p>
          <p className="mt-1 text-xs text-ink-500">{detail}</p>
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="h-1.5" style={{ backgroundColor: accent }} />
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
    { name: 'Used seats', value: data.subscriptions.seatUsage },
    {
      name: 'Available seats',
      value: Math.max(data.subscriptions.seatLimit - data.subscriptions.seatUsage, 0),
    },
  ];
  const activityHasData = data.activity.trend.some((bucket) => bucket.value > 0);
  const roleData = data.users.byRole.filter((bucket) => bucket.value > 0);
  const subscriptionData = data.subscriptions.byStatus.filter((bucket) => bucket.value > 0);
  const orgKindData = data.organizations.byKind.filter((bucket) => bucket.value > 0);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg bg-brand-navy text-white shadow-elevated">
        <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase text-white/70">
              <ShieldCheck className="h-4 w-4 text-brand-orange" />
              {data.scope.type === 'GLOBAL' ? 'Global command view' : 'Managed scope'}
            </div>
            <h2 className="mt-5 text-3xl font-black text-white">
              Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'}.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              The workspace is tracking {data.users.active} active users across{' '}
              {data.organizations.active} active organizations with{' '}
              {data.subscriptions.utilizationRate}% seat utilization.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-xs text-white/55">Generated</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatDateTime(data.generatedAt)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-xs text-white/55">Role</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {user?.role ? ROLE_LABEL[user.role] : 'Admin'}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-xs text-white/55">New users</p>
              <p className="mt-1 text-2xl font-black text-white">
                {data.users.newThisPeriod}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-3">
              <p className="text-xs text-white/55">Expiring plans</p>
              <p className="mt-1 text-2xl font-black text-white">
                {data.subscriptions.expiringSoon}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Users"
          value={data.users.active}
          detail={`${data.users.disabled} suspended accounts`}
          icon={Users}
          accent="#1149B5"
        />
        <MetricCard
          label="Organizations"
          value={data.organizations.total}
          detail={`${data.organizations.active} active, ${data.organizations.inactive} inactive`}
          icon={Building2}
          accent="#0EA5E9"
        />
        <MetricCard
          label="Seat Usage"
          value={`${data.subscriptions.seatUsage}/${data.subscriptions.seatLimit}`}
          detail={`${data.subscriptions.utilizationRate}% allocated`}
          icon={CreditCard}
          accent="#FF7A00"
        />
        <MetricCard
          label="Content"
          value={data.content.canvases.total}
          detail={`${data.content.liveSessions.total} live sessions, ${data.content.exports.total} exports`}
          icon={Presentation}
          accent="#7C3AED"
          onClick={() => navigate('/content')}
        />
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

        <ChartCard title="Seat Utilization" subtitle="Current allocation">
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
                {data.subscriptions.seatUsage} of {data.subscriptions.seatLimit} seats in use
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
              <p className="text-xs text-ink-500">Subscription and organization health</p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
                  Subscriptions
                </p>
                <div className="space-y-2">
                  {subscriptionData.map((bucket, index) => (
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
                  {subscriptionData.length === 0 && (
                    <p className="text-sm text-ink-400">No subscriptions found.</p>
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
