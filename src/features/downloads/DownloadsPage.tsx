import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  MonitorDown,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';

import { downloadsApi, type DownloadArtifact } from '@/services/downloads.api';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import type { SafeUserContext } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

type DownloadBrand = 'SoftLogic' | 'AI Smart Board';

interface BrandDownloadGroup {
  title: DownloadBrand;
  badge?: string;
  description?: string;
  artifacts: DownloadArtifact[];
}

const brandStyles: Record<
  DownloadBrand,
  {
    eyebrow: string;
    gradient: string;
    iconWrap: string;
    icon: string;
    button: string;
  }
> = {
  SoftLogic: {
    eyebrow: 'SoftLogic branded app',
    gradient: 'from-brand-navy via-brand-primary to-brand-blue',
    iconWrap: 'bg-brand-primary/10 text-brand-primary ring-brand-primary/15',
    icon: 'text-brand-primary',
    button: 'bg-brand-blue hover:bg-brand-blue-dark text-white',
  },
  'AI Smart Board': {
    eyebrow: 'White-label app identity',
    gradient: 'from-brand-purple via-brand-primary to-brand-blue',
    iconWrap: 'bg-brand-purple/10 text-brand-purple ring-brand-purple/15',
    icon: 'text-brand-purple',
    button: 'bg-brand-purple hover:bg-brand-purple/90 text-white',
  },
};

function artifactIcon(artifact: DownloadArtifact) {
  return artifact.format === 'APK' || artifact.platform.toLowerCase().includes('android')
    ? Smartphone
    : MonitorDown;
}

function artifactMeta(artifact: DownloadArtifact) {
  if (artifact.format === 'APK') {
    return {
      title: 'Android APK',
      detail: 'Direct Android installer',
      helper: 'Use on tablets, mobile devices, and smart-board Android hardware.',
    };
  }
  return {
    title: 'Windows EXE',
    detail: 'Single-file Windows installer',
    helper: 'Use on Windows teaching stations and classroom PCs.',
  };
}

function isSuperAdminDownloadsUser(user: SafeUserContext | null) {
  return (
    user?.role === 'SUPER_ADMIN' &&
    user.email.trim().toLowerCase() === 'anirudha@softlogic.co.in'
  );
}

function normalizeArtifact(
  brand: DownloadBrand,
  artifact: {
    format: string;
    label: string;
    href: string;
    description?: string;
  },
): DownloadArtifact {
  return {
    platform: `${brand} ${artifact.format === 'APK' ? 'Android' : 'Windows'}`,
    format: artifact.format,
    label: artifact.label,
    href: artifact.href,
    description:
      artifact.description ??
      `${brand} ${artifact.format} installer for the current release.`,
  };
}

function buildBrandGroups(
  releaseGroups: NonNullable<Awaited<ReturnType<typeof downloadsApi.currentRelease>>['release']['downloadGroups']>,
  releaseArtifacts: DownloadArtifact[],
  visibleBrands: DownloadBrand[],
): BrandDownloadGroup[] {
  const groups = releaseGroups
    .filter((group): group is typeof group & { title: DownloadBrand } =>
      visibleBrands.includes(group.title as DownloadBrand),
    )
    .map((group) => ({
      title: group.title,
      badge: group.badge,
      description: group.description,
      artifacts: group.artifacts
        .filter((artifact) => ['APK', 'EXE'].includes(artifact.format))
        .map((artifact) => normalizeArtifact(group.title, artifact)),
    }))
    .filter((group) => group.artifacts.length > 0);

  if (groups.length > 0) {
    return groups;
  }

  return visibleBrands
    .map((brand) => ({
      title: brand,
      artifacts: releaseArtifacts.filter((artifact) => {
        if (!['APK', 'EXE'].includes(artifact.format)) return false;
        return artifact.platform.toLowerCase().startsWith(brand.toLowerCase());
      }),
    }))
    .filter((group) => group.artifacts.length > 0);
}

export function DownloadsPage() {
  const { user } = useAuthStore();
  const query = useQuery({
    queryKey: ['downloads', 'current-release'],
    queryFn: downloadsApi.currentRelease,
    staleTime: 10 * 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-primary" />
      </div>
    );
  }

  if (!query.data || query.isError) {
    return (
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-danger/5 px-5 py-4">
          <Badge variant="danger">Manifest unavailable</Badge>
        </div>
        <div className="px-5 py-5">
          <p className="font-semibold text-ink-900">Downloads are unavailable.</p>
          <p className="mt-1 text-sm text-ink-500">
            The release manifest could not be loaded from the SoftLogic download page.
          </p>
        </div>
      </Card>
    );
  }

  const { environment, environmentLabel, release } = query.data;
  const showBoth = isSuperAdminDownloadsUser(user);
  const whiteLabel = user?.primaryOrganization?.brandingMode === 'WHITE_LABEL';
  const visibleBrands: DownloadBrand[] = showBoth
    ? ['SoftLogic', 'AI Smart Board']
    : [whiteLabel ? 'AI Smart Board' : 'SoftLogic'];
  const brandGroups = buildBrandGroups(
    release.downloadGroups ?? [],
    release.artifacts,
    visibleBrands,
  );
  const releaseDate = release.releaseDate ?? '2026-06-13';
  const releaseStatus = release.status ?? 'Current release';
  const environmentIsProduction = environment === 'production';

  return (
    <div className="space-y-5">
      <section
        className={cn(
          'relative overflow-hidden rounded-xl bg-gradient-to-br px-5 py-6 text-white shadow-elevated sm:px-7',
          environmentIsProduction
            ? 'from-emerald-950 via-brand-navy to-brand-primary'
            : 'from-brand-navy via-brand-primary to-brand-blue',
        )}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-brand-orange/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/10 text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                {environmentLabel} downloads
              </Badge>
              <Badge className="border-white/20 bg-white/10 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {releaseStatus}
              </Badge>
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-white/62">
              {showBoth
                ? 'SoftLogic and AI Smart Board'
                : whiteLabel
                  ? 'AI Smart Board'
                  : 'SoftLogic Whiteboard'}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {release.version} Downloads
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/76 sm:text-base">
              Install the latest Android and Windows builds matched to this admin
              environment. Branding visibility follows the signed-in account and
              organization branding mode.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-white/58">Version</p>
              <p className="mt-1 text-xl font-black text-white">{release.version}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-white/58">Build</p>
              <p className="mt-1 text-xl font-black text-white">{release.build ?? '20'}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-white/58">Brands</p>
              <p className="mt-1 text-xl font-black text-white">{brandGroups.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-ink-900">Release source</p>
              <p className="text-sm text-ink-500">SoftLogic download manifest</p>
            </div>
          </div>
        </Card>
        <Card className="px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-ink-900">Environment</p>
              <p className="text-sm text-ink-500">
                {environmentIsProduction ? 'Production download links' : 'Staging download links'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-ink-900">Release date</p>
              <p className="text-sm text-ink-500">{releaseDate}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className={cn('grid gap-5', showBoth ? 'xl:grid-cols-2' : 'xl:grid-cols-1')}>
        {brandGroups.map((group) => {
          const style = brandStyles[group.title];
          return (
            <Card key={group.title} className="overflow-hidden">
              <div className={cn('h-2 bg-gradient-to-r', style.gradient)} />
              <div className="space-y-5 px-4 py-5 sm:px-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Badge variant={group.title === 'SoftLogic' ? 'navy' : 'purple'}>
                      {group.badge ?? `${environmentLabel} build`}
                    </Badge>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-ink-400">
                      {style.eyebrow}
                    </p>
                    <h3 className="mt-1 text-2xl font-black text-ink-900">
                      {group.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-ink-500">
                      {group.description ??
                        `Download the ${group.title} ${release.version} installers for ${environmentLabel.toLowerCase()}.`}
                    </p>
                  </div>
                  <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1', style.iconWrap)}>
                    <Download className="h-7 w-7" />
                  </div>
                </div>

                <div className={cn('grid gap-3', showBoth ? '' : 'xl:grid-cols-2')}>
                  {group.artifacts.map((artifact) => {
                    const Icon = artifactIcon(artifact);
                    const meta = artifactMeta(artifact);
                    return (
                      <div
                        key={`${group.title}-${artifact.format}`}
                        className="group rounded-xl border border-line bg-gradient-to-br from-white to-surface-variant/60 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-elevated"
                      >
                        <div
                          className={cn(
                            'flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between',
                            !showBoth && 'xl:h-full xl:flex-col xl:items-start',
                          )}
                        >
                          <div className="flex min-w-0 gap-3">
                            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-line', style.icon)}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-ink-900">{meta.title}</p>
                              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                                {meta.detail}
                              </p>
                              <p className="mt-2 text-sm leading-5 text-ink-500">
                                {artifact.description || meta.helper}
                              </p>
                            </div>
                          </div>

                          <Button
                            asChild
                            className={cn(
                              'w-full lg:w-auto',
                              !showBoth && 'xl:mt-auto xl:w-full',
                              style.button,
                            )}
                          >
                            <a href={artifact.href} target="_blank" rel="noreferrer">
                              <Download className="h-4 w-4" />
                              Download {artifact.format}
                              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
