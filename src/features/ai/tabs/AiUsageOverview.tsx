import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/features/admin/admin-list-ui';
import { extractApiError } from '@/lib/api';
import { aiAdminApi } from '@/services/ai-admin.api';
import type { AiTimeseries } from '@/types/ai';
import { LoadingBlock, SectionHeader } from '../components/ai-ui';
import { formatCredits } from '../components/ai-format';

const PALETTE = ['#1149B5', '#7C3AED', '#FF7A00', '#059669', '#DC2626', '#0891B2', '#CA8A04', '#DB2777', '#4B5563', '#65A30D'];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function pivot(points: AiTimeseries['points'], metric: 'credits' | 'requests') {
  const buckets = new Map<string, Record<string, number | string>>();
  const totals = new Map<string, number>();
  for (const point of points) {
    const bucket = point.bucket.slice(0, 10);
    const row = buckets.get(bucket) ?? { bucket };
    row[point.series] = Number(row[point.series] ?? 0) + point[metric];
    buckets.set(bucket, row);
    totals.set(point.series, (totals.get(point.series) ?? 0) + point[metric]);
  }
  // Keep the 8 biggest series; fold the rest into "other".
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([series]) => series);
  const keep = new Set(ranked.slice(0, 8));
  const rows = [...buckets.values()]
    .map((row) => {
      const next: Record<string, number | string> = { bucket: row.bucket };
      for (const [key, value] of Object.entries(row)) {
        if (key === 'bucket') continue;
        const target = keep.has(key) ? key : 'other';
        next[target] = Number(next[target] ?? 0) + Number(value);
      }
      return next;
    })
    .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
  const series = [...ranked.slice(0, 8), ...(ranked.length > 8 ? ['other'] : [])];
  return { rows, series };
}

/** Phase 2 overview: per-tier KPIs and usage charts (additive, below the existing cards). */
export function AiUsageOverview() {
  const [days, setDays] = useState('30');
  const [groupBy, setGroupBy] = useState<AiTimeseries['groupBy']>('tier');
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - (Number(days) - 1) * 86_400_000);
    return { from: isoDay(from), to: isoDay(to) };
  }, [days]);

  const summaryQuery = useQuery({ queryKey: ['ai-summary'], queryFn: aiAdminApi.summary, refetchInterval: 30_000 });
  const seriesQuery = useQuery({
    queryKey: ['ai-timeseries', range.from, range.to, groupBy],
    queryFn: () =>
      aiAdminApi.timeseries({ from: range.from, to: range.to, granularity: Number(days) > 120 ? 'week' : 'day', groupBy }),
  });

  const credits = useMemo(() => pivot(seriesQuery.data?.points ?? [], 'credits'), [seriesQuery.data]);
  const requests = useMemo(() => pivot(seriesQuery.data?.points ?? [], 'requests'), [seriesQuery.data]);
  const offline = useMemo(
    () => (seriesQuery.data?.offline ?? []).map((row) => ({ bucket: row.day.slice(0, 10), requests: row.requests })),
    [seriesQuery.data],
  );

  const summary = summaryQuery.data;

  return (
    <Card className="space-y-5 px-4 py-5 sm:px-6">
      <SectionHeader
        title="Free & Pro usage"
        description={
          summary
            ? summary.tiersActive
              ? summary.proGloballyEnabled
                ? 'Tiers are active. Pro is switched ON.'
                : 'Tiers are active. Pro is switched OFF: everyone runs on Free.'
              : 'Tiers are not active yet. All usage runs on the existing paid path (Pro).'
            : 'Usage by tier, feature and provider.'
        }
        actions={
          <>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as AiTimeseries['groupBy'])}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tier">By tier</SelectItem>
                <SelectItem value="feature">By feature</SelectItem>
                <SelectItem value="provider">By provider</SelectItem>
                <SelectItem value="model">By model</SelectItem>
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {summaryQuery.isError ? (
        <p className="text-sm text-red-700">{extractApiError(summaryQuery.error)}</p>
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Pro master available" value={formatCredits(summary.PRO.master?.availableTokens)} detail={`${formatCredits(summary.PRO.usedTokens)} used overall`} tone="purple" />
          <StatCard label="Free master available" value={formatCredits(summary.FREE.master?.availableTokens)} detail={`${formatCredits(summary.FREE.usedTokens)} used overall`} tone="blue" />
          <StatCard label="Pro requests today" value={formatCredits(summary.PRO.today.requests)} detail={`${formatCredits(summary.PRO.today.credits)} credits`} tone="purple" />
          <StatCard label="Free requests today" value={formatCredits(summary.FREE.today.requests)} detail={`${formatCredits(summary.FREE.today.credits)} credits`} tone="blue" />
          <StatCard
            label="Pro → Free fallbacks"
            value={formatCredits(summary.PRO.today.fallbackRequests + summary.FREE.today.fallbackRequests)}
            detail={`${formatCredits(summary.PRO.today.failedRequests + summary.FREE.today.failedRequests)} failed today`}
            tone="orange"
          />
          <StatCard label="Offline requests today" value={formatCredits(summary.FREE.today.offlineRequests)} detail="On-device model, not charged" tone="green" />
        </div>
      ) : (
        <LoadingBlock />
      )}

      {seriesQuery.isLoading ? (
        <LoadingBlock />
      ) : seriesQuery.isError ? (
        <p className="text-sm text-red-700">{extractApiError(seriesQuery.error)}</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard title="Credits charged">
            {credits.rows.length ? (
              <BarChart data={credits.rows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => formatCredits(value)} width={80} />
                <Tooltip formatter={(value) => formatCredits(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {credits.series.map((series, index) => (
                  <Bar key={series} dataKey={series} stackId="credits" fill={PALETTE[index % PALETTE.length]} />
                ))}
              </BarChart>
            ) : null}
          </ChartCard>
          <ChartCard title="Requests">
            {requests.rows.length ? (
              <LineChart data={requests.rows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(value) => formatCredits(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {requests.series.map((series, index) => (
                  <Line key={series} type="monotone" dataKey={series} dot={false} strokeWidth={2} stroke={PALETTE[index % PALETTE.length]} />
                ))}
              </LineChart>
            ) : null}
          </ChartCard>
          {offline.length ? (
            <ChartCard title="Offline (on-device) requests">
              <BarChart data={offline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip />
                <Bar dataKey="requests" fill="#059669" />
              </BarChart>
            </ChartCard>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement | null }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <div className="h-64">
        {children ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-ink-500">No usage in this period.</p>
        )}
      </div>
    </div>
  );
}
