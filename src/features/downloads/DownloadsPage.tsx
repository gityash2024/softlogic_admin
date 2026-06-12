import { useQuery } from '@tanstack/react-query';
import { Download, MonitorDown, Smartphone } from 'lucide-react';

import { downloadsApi, type DownloadArtifact } from '@/services/downloads.api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

function artifactIcon(artifact: DownloadArtifact) {
  return artifact.platform.toLowerCase().includes('android')
    ? Smartphone
    : MonitorDown;
}

export function DownloadsPage() {
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
      <Card className="px-4 py-5 sm:px-5">
        <p className="font-semibold text-ink-900">Downloads are unavailable.</p>
        <p className="mt-1 text-sm text-ink-500">
          The release manifest could not be loaded from the SoftLogic download page.
        </p>
      </Card>
    );
  }

  const release = query.data;
  const artifacts = release.artifacts.filter((artifact) =>
    ['APK', 'EXE'].includes(artifact.format) &&
    artifact.platform.toLowerCase().startsWith('softlogic'),
  );

  return (
    <div className="space-y-5">
      <section className="rounded-lg bg-brand-navy px-4 py-5 text-white shadow-elevated sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
              SoftLogic Whiteboard
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              {release.version} Downloads
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/72">
              Android and Windows installers are loaded from the published SoftLogic release manifest.
            </p>
          </div>
          <Badge variant="info" className="w-fit border-white/20 bg-white/10 text-white">
            {release.status ?? 'Current'}
          </Badge>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {artifacts.map((artifact) => {
          const Icon = artifactIcon(artifact);
          return (
            <Card key={`${artifact.platform}-${artifact.format}`} className="px-4 py-5 sm:px-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold uppercase tracking-wide text-ink-400">
                    {artifact.platform}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-ink-900">
                    {artifact.label}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-500">
                    {artifact.description}
                  </p>
                  <Button asChild className="mt-4">
                    <a href={artifact.href} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                      Download {artifact.format}
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
