import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  MonitorDown,
  Pencil,
  Plus,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { extractApiError } from '@/lib/api';
import {
  downloadsApi,
  type AppRelease,
  type AppReleaseBrand,
  type AppReleaseEnvironment,
  type AppReleasePlatform,
  type PublishReleaseArtifact,
} from '@/services/downloads.api';

interface ReleaseChannel {
  environment: AppReleaseEnvironment;
  brand: AppReleaseBrand;
  platform: AppReleasePlatform;
  label: string;
}

const CHANNELS: ReleaseChannel[] = (
  ['staging', 'production'] as AppReleaseEnvironment[]
).flatMap((environment) =>
  (['softlogic', 'ai_smart_board'] as AppReleaseBrand[]).flatMap((brand) =>
    (['android', 'windows'] as AppReleasePlatform[]).map((platform) => ({
      environment,
      brand,
      platform,
      label: `${brand === 'softlogic' ? 'SoftLogic' : 'AI Smart Board'} ${
        platform === 'android' ? 'Android APK' : 'Windows EXE'
      } - ${environment === 'production' ? 'Production' : 'Staging'}`,
    })),
  ),
);

const channelKey = (
  environment: AppReleaseEnvironment,
  brand: AppReleaseBrand,
  platform: AppReleasePlatform,
) => `${environment}:${brand}:${platform}`;

const currentReleaseByChannel = (releases: AppRelease[]) =>
  new Map(
    releases
      .filter((release) => release.isCurrent && release.isActive)
      .map((release) => [
        channelKey(release.environment, release.brand, release.platform),
        release,
      ]),
  );

const initialLinks = () =>
  Object.fromEntries(CHANNELS.map((channel) => [
    channelKey(channel.environment, channel.brand, channel.platform),
    '',
  ]));

const nextPatchVersion = (version: string) => {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return '';
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
};

export function DownloadsPage() {
  const queryClient = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);
  const [editing, setEditing] = useState<AppRelease | null>(null);
  const [versionName, setVersionName] = useState('');
  const [buildNumber, setBuildNumber] = useState('');
  const [releaseDate, setReleaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState<Record<string, string>>(initialLinks);
  const [editUrl, setEditUrl] = useState('');

  const releasesQuery = useQuery({
    queryKey: ['app-releases'],
    queryFn: downloadsApi.list,
  });

  const currentByChannel = useMemo(
    () => currentReleaseByChannel(releasesQuery.data ?? []),
    [releasesQuery.data],
  );

  const publishMutation = useMutation({
    mutationFn: downloadsApi.publishFullRelease,
    onSuccess: async () => {
      toast.success(`Release ${versionName}+${buildNumber} published to all 8 channels`);
      setPublishOpen(false);
      setVersionName('');
      setBuildNumber('');
      setNotes('');
      setLinks(initialLinks());
      await queryClient.invalidateQueries({ queryKey: ['app-releases'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, downloadUrl }: { id: string; downloadUrl: string }) =>
      downloadsApi.updateRelease(id, { downloadUrl }),
    onSuccess: async () => {
      toast.success('Download link updated');
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['app-releases'] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const openPublish = () => {
    const first = [...currentByChannel.values()][0];
    setVersionName(first ? nextPatchVersion(first.versionName) : '');
    setBuildNumber(first ? String(first.buildNumber + 1) : '');
    setNotes('');
    setLinks(initialLinks());
    setPublishOpen(true);
  };

  const publish = (event: FormEvent) => {
    event.preventDefault();
    const parsedBuild = Number(buildNumber);
    if (!/^\d+\.\d+\.\d+$/.test(versionName.trim())) {
      toast.error('Enter a version like 1.0.20');
      return;
    }
    if (!Number.isInteger(parsedBuild) || parsedBuild <= 0) {
      toast.error('Enter a positive build number');
      return;
    }
    const artifacts: PublishReleaseArtifact[] = CHANNELS.map((channel) => ({
      environment: channel.environment,
      brand: channel.brand,
      platform: channel.platform,
      downloadUrl:
        links[channelKey(channel.environment, channel.brand, channel.platform)]?.trim() ??
        '',
    }));
    if (artifacts.some((artifact) => !artifact.downloadUrl)) {
      toast.error('All 8 Google Drive links are required');
      return;
    }

    publishMutation.mutate({
      versionName: versionName.trim(),
      buildNumber: parsedBuild,
      releaseDate,
      notes: notes.trim() || null,
      artifacts,
    });
  };

  if (releasesQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-primary" />
      </div>
    );
  }

  if (releasesQuery.isError) {
    return (
      <Card className="p-5">
        <Badge variant="danger">Release catalog unavailable</Badge>
        <p className="mt-3 text-sm text-ink-500">
          {extractApiError(releasesQuery.error)}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge variant="navy">Super Admin release control</Badge>
          <h2 className="mt-3 text-2xl font-black text-ink-900">
            App releases
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
            Publish one version and build number with all eight Android and Windows
            download links. Each installed app checks only its matching channel.
          </p>
        </div>
        <Button onClick={openPublish}>
          <Plus className="h-4 w-4" />
          Publish full release
        </Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-ink-400">Channels</p>
          <p className="mt-1 text-2xl font-black text-ink-900">8</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-ink-400">Current</p>
          <p className="mt-1 text-2xl font-black text-ink-900">
            {currentByChannel.size}/8
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-ink-400">History</p>
          <p className="mt-1 text-2xl font-black text-ink-900">
            {releasesQuery.data?.length ?? 0}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {CHANNELS.map((channel) => {
          const release = currentByChannel.get(
            channelKey(channel.environment, channel.brand, channel.platform),
          );
          const Icon = channel.platform === 'android' ? Smartphone : MonitorDown;
          return (
            <Card
              key={channel.label}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={channel.environment === 'production' ? 'success' : 'navy'}>
                    {channel.environment}
                  </Badge>
                  {release ? (
                    <Badge>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Current
                    </Badge>
                  ) : (
                    <Badge variant="danger">Missing</Badge>
                  )}
                </div>
                <h3 className="mt-2 font-black text-ink-900">{channel.label}</h3>
                {release ? (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
                    <span>v{release.versionName}+{release.buildNumber}</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {release.releaseDate}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-danger">Publish a full release to activate this channel.</p>
                )}
              </div>
              {release && (
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" asChild>
                    <a href={release.downloadUrl} target="_blank" rel="noreferrer" title="Open download">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Edit download link"
                    onClick={() => {
                      setEditing(release);
                      setEditUrl(release.downloadUrl);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Publish all 8 app channels</DialogTitle>
            <DialogDescription>
              This makes the supplied version current for both environments, both brands,
              and Android plus Windows.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={publish}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Version number">
                <Input
                  value={versionName}
                  onChange={(event) => setVersionName(event.target.value)}
                  placeholder="1.0.20"
                  required
                />
              </Field>
              <Field label="Build number">
                <Input
                  type="number"
                  min={1}
                  value={buildNumber}
                  onChange={(event) => setBuildNumber(event.target.value)}
                  placeholder="21"
                  required
                />
              </Field>
              <Field label="Release date">
                <Input
                  type="date"
                  value={releaseDate}
                  onChange={(event) => setReleaseDate(event.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Release notes">
              <textarea
                className="min-h-24 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What changed in this release?"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              {CHANNELS.map((channel) => {
                const key = channelKey(channel.environment, channel.brand, channel.platform);
                return (
                  <Field key={key} label={channel.label}>
                    <Input
                      type="url"
                      value={links[key] ?? ''}
                      onChange={(event) =>
                        setLinks((current) => ({ ...current, [key]: event.target.value }))
                      }
                      placeholder="https://drive.google.com/file/d/..."
                      required
                    />
                  </Field>
                );
              })}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPublishOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={publishMutation.isPending}>
                {publishMutation.isPending ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                Publish release
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct download link</DialogTitle>
            <DialogDescription>
              Update the direct Drive link for {editing?.versionName}+{editing?.buildNumber}.
            </DialogDescription>
          </DialogHeader>
          <Field label="Google Drive URL">
            <Input
              type="url"
              value={editUrl}
              onChange={(event) => setEditUrl(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editing || !editUrl.trim() || updateMutation.isPending}
              onClick={() =>
                editing &&
                updateMutation.mutate({ id: editing.id, downloadUrl: editUrl.trim() })
              }
            >
              Save link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
      {label}
      {children}
    </label>
  );
}
