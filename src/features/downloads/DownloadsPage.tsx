import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  Filter,
  History,
  MonitorDown,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extractApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { runtimeBrandForOrganization } from "@/lib/branding";
import {
  currentAdminEnvironment,
  downloadsApi,
  type AppRelease,
  type AppReleaseBrand,
  type AppReleaseEnvironment,
  type AppReleasePlatform,
  type CurrentAppDownload,
  type PublishReleaseArtifact,
} from "@/services/downloads.api";

interface ReleaseChannel {
  environment: AppReleaseEnvironment;
  brand: AppReleaseBrand;
  platform: AppReleasePlatform;
  label: string;
}

const CHANNELS: ReleaseChannel[] = (
  ["staging", "production"] as AppReleaseEnvironment[]
).flatMap((environment) =>
  (["softlogic", "ai_smart_board"] as AppReleaseBrand[]).flatMap((brand) =>
    (["android", "windows"] as AppReleasePlatform[]).map((platform) => ({
      environment,
      brand,
      platform,
      label: `${brand === "softlogic" ? "SoftLogic" : "AI Smart Board"} ${
        platform === "android" ? "Android APK" : "Windows EXE"
      } - ${environment === "production" ? "Production" : "Staging"}`,
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
  Object.fromEntries(
    CHANNELS.map((channel) => [
      channelKey(channel.environment, channel.brand, channel.platform),
      "",
    ]),
  );

const channelSelection = (predicate: (channel: ReleaseChannel) => boolean) =>
  Object.fromEntries(
    CHANNELS.map((channel) => [
      channelKey(channel.environment, channel.brand, channel.platform),
      predicate(channel),
    ]),
  );

const allChannelSelection = () => channelSelection(() => true);

const nextPatchVersion = (version: string) => {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return "";
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
};

type ReleaseStatusFilter =
  | "all"
  | "current"
  | "previous"
  | "active"
  | "inactive";
type ForceFilter = "all" | "forced" | "optional";
type EnvironmentFilter = "all" | AppReleaseEnvironment;
type BrandFilter = "all" | AppReleaseBrand;
type PlatformFilter = "all" | AppReleasePlatform;

interface EditReleaseDraft {
  versionName: string;
  buildNumber: string;
  releaseDate: string;
  notes: string;
  downloadUrl: string;
  isCurrent: boolean;
  isActive: boolean;
  isForced: boolean;
}

type ConfirmationAction =
  | { type: "mark-current"; release: AppRelease }
  | { type: "toggle-active"; release: AppRelease };

const releaseChannelLabel = (
  release: Pick<AppRelease, "environment" | "brand" | "platform">,
) =>
  CHANNELS.find(
    (channel) =>
      channel.environment === release.environment &&
      channel.brand === release.brand &&
      channel.platform === release.platform,
  )?.label ?? `${release.environment} ${release.brand} ${release.platform}`;

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const releaseDraftFrom = (release: AppRelease): EditReleaseDraft => ({
  versionName: release.versionName,
  buildNumber: String(release.buildNumber),
  releaseDate: release.releaseDate,
  notes: release.notes ?? "",
  downloadUrl: release.downloadUrl,
  isCurrent: release.isCurrent,
  isActive: release.isActive,
  isForced: release.isForced,
});

export function DownloadsPage() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "SUPER_ADMIN") {
    return <BrandDownloadsPage />;
  }

  return <SuperAdminDownloadsPage />;
}

function SuperAdminDownloadsPage() {
  const queryClient = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);
  const [editing, setEditing] = useState<AppRelease | null>(null);
  const [versionName, setVersionName] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [releaseDate, setReleaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [isForcedRelease, setIsForcedRelease] = useState<boolean | null>(null);
  const [links, setLinks] = useState<Record<string, string>>(initialLinks);
  const [selectedChannels, setSelectedChannels] =
    useState<Record<string, boolean>>(allChannelSelection);
  const [editDraft, setEditDraft] = useState<EditReleaseDraft | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [environmentFilter, setEnvironmentFilter] =
    useState<EnvironmentFilter>("all");
  const [brandFilter, setBrandFilter] = useState<BrandFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ReleaseStatusFilter>("all");
  const [forceFilter, setForceFilter] = useState<ForceFilter>("all");
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction | null>(null);

  const releasesQuery = useQuery({
    queryKey: ["app-releases"],
    queryFn: downloadsApi.list,
  });

  const currentByChannel = useMemo(
    () => currentReleaseByChannel(releasesQuery.data ?? []),
    [releasesQuery.data],
  );

  const selectedReleaseChannels = useMemo(
    () =>
      CHANNELS.filter(
        (channel) =>
          selectedChannels[
            channelKey(channel.environment, channel.brand, channel.platform)
          ],
      ),
    [selectedChannels],
  );

  const filteredReleases = useMemo(() => {
    const search = historySearch.trim().toLowerCase();
    return (releasesQuery.data ?? []).filter((release) => {
      if (
        environmentFilter !== "all" &&
        release.environment !== environmentFilter
      ) {
        return false;
      }
      if (brandFilter !== "all" && release.brand !== brandFilter) {
        return false;
      }
      if (platformFilter !== "all" && release.platform !== platformFilter) {
        return false;
      }
      if (forceFilter === "forced" && !release.isForced) {
        return false;
      }
      if (forceFilter === "optional" && release.isForced) {
        return false;
      }
      if (statusFilter === "current" && !release.isCurrent) {
        return false;
      }
      if (statusFilter === "previous" && release.isCurrent) {
        return false;
      }
      if (statusFilter === "active" && !release.isActive) {
        return false;
      }
      if (statusFilter === "inactive" && release.isActive) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [
        release.versionName,
        String(release.buildNumber),
        release.notes ?? "",
        release.downloadUrl,
        releaseChannelLabel(release),
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [
    brandFilter,
    environmentFilter,
    forceFilter,
    historySearch,
    platformFilter,
    releasesQuery.data,
    statusFilter,
  ]);

  const publishMutation = useMutation({
    mutationFn: downloadsApi.publishFullRelease,
    onSuccess: async (releases) => {
      toast.success(
        `Release ${versionName}+${buildNumber} published to ${releases.length} selected channel${releases.length === 1 ? "" : "s"}`,
      );
      setPublishOpen(false);
      setVersionName("");
      setBuildNumber("");
      setNotes("");
      setIsForcedRelease(null);
      setLinks(initialLinks());
      setSelectedChannels(allChannelSelection());
      await queryClient.invalidateQueries({ queryKey: ["app-releases"] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof downloadsApi.updateRelease>[1];
    }) => downloadsApi.updateRelease(id, payload),
    onSuccess: async () => {
      toast.success("Release updated");
      setEditing(null);
      setEditDraft(null);
      setConfirmationAction(null);
      await queryClient.invalidateQueries({ queryKey: ["app-releases"] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const openPublish = () => {
    const first = [...currentByChannel.values()][0];
    setVersionName(first ? nextPatchVersion(first.versionName) : "");
    setBuildNumber(first ? String(first.buildNumber + 1) : "");
    setNotes("");
    setIsForcedRelease(null);
    setLinks(initialLinks());
    setSelectedChannels(allChannelSelection());
    setPublishOpen(true);
  };

  const openEdit = (release: AppRelease) => {
    setEditing(release);
    setEditDraft(releaseDraftFrom(release));
  };

  const publish = (event: FormEvent) => {
    event.preventDefault();
    const parsedBuild = Number(buildNumber);
    if (!/^\d+\.\d+\.\d+$/.test(versionName.trim())) {
      toast.error("Enter a version like 1.0.20");
      return;
    }
    if (!Number.isInteger(parsedBuild) || parsedBuild <= 0) {
      toast.error("Enter a positive build number");
      return;
    }
    if (isForcedRelease === null) {
      toast.error("Select whether this release is optional or forced");
      return;
    }
    if (selectedReleaseChannels.length === 0) {
      toast.error("Select at least one release channel");
      return;
    }
    const artifacts: PublishReleaseArtifact[] = selectedReleaseChannels.map(
      (channel) => ({
        environment: channel.environment,
        brand: channel.brand,
        platform: channel.platform,
        downloadUrl:
          links[
            channelKey(channel.environment, channel.brand, channel.platform)
          ]?.trim() ?? "",
      }),
    );
    if (artifacts.some((artifact) => !artifact.downloadUrl)) {
      toast.error("Google Drive links are required for selected channels");
      return;
    }

    publishMutation.mutate({
      versionName: versionName.trim(),
      buildNumber: parsedBuild,
      releaseDate,
      notes: notes.trim() || null,
      isForced: isForcedRelease,
      artifacts,
    });
  };

  const saveEditedRelease = () => {
    if (!editing || !editDraft) {
      return;
    }
    const parsedBuild = Number(editDraft.buildNumber);
    if (!/^\d+\.\d+\.\d+$/.test(editDraft.versionName.trim())) {
      toast.error("Enter a version like 1.0.20");
      return;
    }
    if (!Number.isInteger(parsedBuild) || parsedBuild <= 0) {
      toast.error("Enter a positive build number");
      return;
    }
    if (!editDraft.downloadUrl.trim()) {
      toast.error("Download URL is required");
      return;
    }

    updateMutation.mutate({
      id: editing.id,
      payload: {
        versionName: editDraft.versionName.trim(),
        buildNumber: parsedBuild,
        releaseDate: editDraft.releaseDate,
        notes: editDraft.notes.trim() || null,
        downloadUrl: editDraft.downloadUrl.trim(),
        isCurrent: editDraft.isCurrent,
        isActive: editDraft.isActive,
        isForced: editDraft.isForced,
      },
    });
  };

  const runConfirmationAction = () => {
    if (!confirmationAction) {
      return;
    }
    const { release } = confirmationAction;
    if (confirmationAction.type === "mark-current") {
      updateMutation.mutate({
        id: release.id,
        payload: { isCurrent: true, isActive: true },
      });
      return;
    }
    updateMutation.mutate({
      id: release.id,
      payload: { isActive: !release.isActive },
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
            Publish one version and build number to all channels or only the
            selected Android and Windows download links. Each installed app
            checks only its matching channel.
          </p>
        </div>
        <Button onClick={openPublish}>
          <Plus className="h-4 w-4" />
          Publish release
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
          const Icon =
            channel.platform === "android" ? Smartphone : MonitorDown;
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
                  <Badge
                    variant={
                      channel.environment === "production" ? "success" : "navy"
                    }
                  >
                    {channel.environment}
                  </Badge>
                  {release ? (
                    <>
                      <Badge>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Current
                      </Badge>
                      <Badge variant={release.isForced ? "warning" : "info"}>
                        {release.isForced ? "Forced" : "Optional"}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="danger">Missing</Badge>
                  )}
                </div>
                <h3 className="mt-2 font-black text-ink-900">
                  {channel.label}
                </h3>
                {release ? (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
                    <span>
                      v{release.versionName}+{release.buildNumber}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {release.releaseDate}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-danger">
                    Publish a release to activate this channel.
                  </p>
                )}
              </div>
              {release && (
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" asChild>
                    <a
                      href={release.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open download"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="View and edit release"
                    onClick={() => openEdit(release)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <section className="rounded-lg border border-line bg-white">
        <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="navy">
              <History className="h-3.5 w-3.5" />
              Full release history
            </Badge>
            <h3 className="mt-3 text-xl font-black text-ink-900">
              All app releases
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
              Search every release by channel, version, build number, notes, or
              URL, then manage current, active, and force-update status.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-variant px-3 py-2 text-sm font-semibold text-ink-700">
            <Filter className="h-4 w-4 text-brand-primary" />
            {filteredReleases.length} of {releasesQuery.data?.length ?? 0}
          </div>
        </div>

        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-9"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Search version, build, notes, URL"
            />
          </div>
          <HistorySelect
            value={environmentFilter}
            onValueChange={(value) =>
              setEnvironmentFilter(value as EnvironmentFilter)
            }
            options={[
              ["all", "All environments"],
              ["staging", "Staging"],
              ["production", "Production"],
            ]}
          />
          <HistorySelect
            value={brandFilter}
            onValueChange={(value) => setBrandFilter(value as BrandFilter)}
            options={[
              ["all", "All brands"],
              ["softlogic", "SoftLogic"],
              ["ai_smart_board", "AI Smart Board"],
            ]}
          />
          <HistorySelect
            value={platformFilter}
            onValueChange={(value) =>
              setPlatformFilter(value as PlatformFilter)
            }
            options={[
              ["all", "All platforms"],
              ["android", "Android"],
              ["windows", "Windows"],
            ]}
          />
          <HistorySelect
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as ReleaseStatusFilter)
            }
            options={[
              ["all", "All status"],
              ["current", "Current"],
              ["previous", "Previous"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ]}
          />
          <HistorySelect
            value={forceFilter}
            onValueChange={(value) => setForceFilter(value as ForceFilter)}
            options={[
              ["all", "All modes"],
              ["forced", "Forced"],
              ["optional", "Optional"],
            ]}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Release date</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReleases.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-ink-500"
                >
                  No releases match the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredReleases.map((release) => (
                <TableRow key={release.id}>
                  <TableCell className="min-w-64">
                    <p className="font-bold text-ink-900">
                      {releaseChannelLabel(release)}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      Created {formatDateTime(release.createdAt)}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-semibold">
                    v{release.versionName}+{release.buildNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant={release.isForced ? "warning" : "info"}>
                      {release.isForced ? "Forced" : "Optional"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {release.isCurrent && (
                        <Badge>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Current
                        </Badge>
                      )}
                      <Badge variant={release.isActive ? "success" : "danger"}>
                        {release.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {release.releaseDate}
                  </TableCell>
                  <TableCell className="max-w-72">
                    <p className="line-clamp-2 text-sm text-ink-600">
                      {release.notes || "No notes"}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-500">
                    {formatDateTime(release.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" asChild>
                        <a
                          href={release.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open download"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="View details and edit"
                        onClick={() => openEdit(release)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Mark current"
                        disabled={release.isCurrent || updateMutation.isPending}
                        onClick={() =>
                          setConfirmationAction({
                            type: "mark-current",
                            release,
                          })
                        }
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title={release.isActive ? "Deactivate" : "Activate"}
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          setConfirmationAction({
                            type: "toggle-active",
                            release,
                          })
                        }
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Publish app release</DialogTitle>
            <DialogDescription>
              Select the exact environments, brands, and platforms that should
              receive this version.
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
            <div className="space-y-2">
              <p className="text-sm font-bold text-ink-900">
                Force update? <span className="text-danger">*</span>
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <ReleaseModeOption
                  selected={isForcedRelease === false}
                  title="Optional update"
                  description="Users can choose Later. The prompt returns on the next app launch while outdated."
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  onClick={() => setIsForcedRelease(false)}
                />
                <ReleaseModeOption
                  selected={isForcedRelease === true}
                  title="Force update"
                  description="Users cannot dismiss the modal and must open the update link before continuing."
                  icon={<ShieldAlert className="h-5 w-5" />}
                  tone="warning"
                  onClick={() => setIsForcedRelease(true)}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-ink-900">
                    Release channels
                  </p>
                  <p className="text-xs text-ink-500">
                    {selectedReleaseChannels.length} of {CHANNELS.length}{" "}
                    selected
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedChannels(allChannelSelection())}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelectedChannels(
                        channelSelection(
                          (channel) => channel.environment === "staging",
                        ),
                      )
                    }
                  >
                    Staging
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelectedChannels(
                        channelSelection(
                          (channel) => channel.environment === "production",
                        ),
                      )
                    }
                  >
                    Production
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSelectedChannels(channelSelection(() => false))
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {CHANNELS.map((channel) => {
                  const key = channelKey(
                    channel.environment,
                    channel.brand,
                    channel.platform,
                  );
                  const checked = Boolean(selectedChannels[key]);
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                        checked
                          ? "border-brand-primary bg-brand-primary/5 text-ink-900"
                          : "border-line bg-white text-ink-600 hover:bg-surface-variant"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-line text-brand-primary focus:ring-brand-primary/30"
                        checked={checked}
                        onChange={(event) =>
                          setSelectedChannels((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                      <span className="min-w-0">
                        <span className="block font-bold">{channel.label}</span>
                        <span className="text-xs text-ink-500">
                          {channel.environment === "production"
                            ? "Production"
                            : "Staging"}{" "}
                          channel
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {selectedReleaseChannels.length > 0 ? (
                selectedReleaseChannels.map((channel) => {
                  const key = channelKey(
                    channel.environment,
                    channel.brand,
                    channel.platform,
                  );
                  return (
                    <Field key={key} label={channel.label}>
                      <Input
                        type="url"
                        value={links[key] ?? ""}
                        onChange={(event) =>
                          setLinks((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder="https://drive.google.com/file/d/..."
                        required
                      />
                    </Field>
                  );
                })
              ) : (
                <p className="rounded-lg border border-line bg-surface-variant p-3 text-sm text-ink-500 md:col-span-2">
                  Select at least one app channel to add release links.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPublishOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={publishMutation.isPending}>
                {publishMutation.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Publish release
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Release details</DialogTitle>
            <DialogDescription>
              View and manage all editable fields for{" "}
              {editing ? releaseChannelLabel(editing) : "this release"}.
            </DialogDescription>
          </DialogHeader>
          {editing && editDraft && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Version number">
                  <Input
                    value={editDraft.versionName}
                    onChange={(event) =>
                      setEditDraft((draft) =>
                        draft
                          ? { ...draft, versionName: event.target.value }
                          : draft,
                      )
                    }
                  />
                </Field>
                <Field label="Build number">
                  <Input
                    type="number"
                    min={1}
                    value={editDraft.buildNumber}
                    onChange={(event) =>
                      setEditDraft((draft) =>
                        draft
                          ? { ...draft, buildNumber: event.target.value }
                          : draft,
                      )
                    }
                  />
                </Field>
                <Field label="Release date">
                  <Input
                    type="date"
                    value={editDraft.releaseDate}
                    onChange={(event) =>
                      setEditDraft((draft) =>
                        draft
                          ? { ...draft, releaseDate: event.target.value }
                          : draft,
                      )
                    }
                  />
                </Field>
              </div>
              <Field label="Release notes">
                <textarea
                  className="min-h-24 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={editDraft.notes}
                  onChange={(event) =>
                    setEditDraft((draft) =>
                      draft ? { ...draft, notes: event.target.value } : draft,
                    )
                  }
                />
              </Field>
              <Field label="Download URL">
                <Input
                  type="url"
                  value={editDraft.downloadUrl}
                  onChange={(event) =>
                    setEditDraft((draft) =>
                      draft
                        ? { ...draft, downloadUrl: event.target.value }
                        : draft,
                    )
                  }
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <ReleaseModeOption
                  selected={!editDraft.isForced}
                  title="Optional update"
                  description="Users may dismiss for the current app run."
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  onClick={() =>
                    setEditDraft((draft) =>
                      draft ? { ...draft, isForced: false } : draft,
                    )
                  }
                />
                <ReleaseModeOption
                  selected={editDraft.isForced}
                  title="Force update"
                  description="Users must open the update link before continuing."
                  icon={<ShieldAlert className="h-5 w-5" />}
                  tone="warning"
                  onClick={() =>
                    setEditDraft((draft) =>
                      draft ? { ...draft, isForced: true } : draft,
                    )
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField
                  checked={editDraft.isCurrent}
                  title="Current release"
                  description="This channel points installed apps to this release."
                  onChange={(checked) =>
                    setEditDraft((draft) =>
                      draft ? { ...draft, isCurrent: checked } : draft,
                    )
                  }
                />
                <ToggleField
                  checked={editDraft.isActive}
                  title="Active release"
                  description="Inactive releases are hidden from app update checks."
                  onChange={(checked) =>
                    setEditDraft((draft) =>
                      draft ? { ...draft, isActive: checked } : draft,
                    )
                  }
                />
              </div>
              <div className="rounded-lg border border-line bg-surface-variant p-3 text-xs leading-5 text-ink-500">
                <p>ID: {editing.id}</p>
                <p>Created: {formatDateTime(editing.createdAt)}</p>
                <p>Updated: {formatDateTime(editing.updatedAt)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setEditDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editing || !editDraft || updateMutation.isPending}
              onClick={saveEditedRelease}
            >
              {updateMutation.isPending ? "Saving..." : "Save release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(confirmationAction)}
        onOpenChange={(open) => !open && setConfirmationAction(null)}
        title={
          confirmationAction?.type === "mark-current"
            ? "Mark release current?"
            : confirmationAction?.release.isActive
              ? "Deactivate release?"
              : "Activate release?"
        }
        description={
          confirmationAction?.type === "mark-current"
            ? "This will make the selected release current for its environment, brand, and platform. Previous current releases in that channel will be replaced."
            : confirmationAction?.release.isActive
              ? "This release will no longer be returned to installed apps. Backend validation will block unsafe current-release deactivation."
              : "This release will become available again for admin management and app update checks if current."
        }
        confirmLabel={
          confirmationAction?.type === "mark-current"
            ? "Mark current"
            : confirmationAction?.release.isActive
              ? "Deactivate"
              : "Activate"
        }
        tone={
          confirmationAction?.type === "mark-current"
            ? "warning"
            : confirmationAction?.release.isActive
              ? "danger"
              : "success"
        }
        loading={updateMutation.isPending}
        onConfirm={runConfirmationAction}
      />
    </div>
  );
}

function HistorySelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ReleaseModeOption({
  selected,
  title,
  description,
  icon,
  tone = "info",
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: "info" | "warning";
  onClick: () => void;
}) {
  const selectedClass =
    tone === "warning"
      ? "border-warning bg-warning/10 text-warning"
      : "border-brand-primary bg-brand-primary/5 text-brand-primary";

  return (
    <button
      type="button"
      className={`flex min-h-28 w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
        selected
          ? selectedClass
          : "border-line bg-white text-ink-700 hover:bg-surface-variant"
      }`}
      onClick={onClick}
    >
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-black text-ink-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-ink-500">
          {description}
        </span>
      </span>
    </button>
  );
}

function ToggleField({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-4">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-line text-brand-primary focus:ring-brand-primary/30"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-black text-ink-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-ink-500">
          {description}
        </span>
      </span>
    </label>
  );
}

function BrandDownloadsPage() {
  const user = useAuthStore((state) => state.user);
  const runtimeBrand = runtimeBrandForOrganization(user?.primaryOrganization);
  const environment = currentAdminEnvironment();
  const releaseBrand: AppReleaseBrand = runtimeBrand.isWhiteLabel
    ? "ai_smart_board"
    : "softlogic";
  const displayName =
    releaseBrand === "ai_smart_board" ? "AI Smart Board" : "SoftLogic";

  const downloadsQuery = useQuery({
    queryKey: ["app-downloads", environment, releaseBrand],
    queryFn: () =>
      downloadsApi.current({
        environment,
        brand: releaseBrand,
      }),
  });

  const downloadsByPlatform = useMemo(
    () =>
      new Map(
        (downloadsQuery.data ?? []).map((release) => [
          release.platform,
          release,
        ]),
      ),
    [downloadsQuery.data],
  );

  if (downloadsQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-primary" />
      </div>
    );
  }

  if (downloadsQuery.isError) {
    return (
      <Card className="p-5">
        <Badge variant="danger">Downloads unavailable</Badge>
        <p className="mt-3 text-sm text-ink-500">
          {extractApiError(downloadsQuery.error)}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5">
        <Badge variant={environment === "production" ? "success" : "navy"}>
          {environment}
        </Badge>
        <h2 className="mt-3 text-2xl font-black text-ink-900">
          {displayName} downloads
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
          Download the latest Android APK and Windows EXE for your workspace.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DownloadCard
          title={`${displayName} Android APK`}
          icon={<Smartphone className="h-5 w-5" />}
          release={downloadsByPlatform.get("android")}
        />
        <DownloadCard
          title={`${displayName} Windows EXE`}
          icon={<MonitorDown className="h-5 w-5" />}
          release={downloadsByPlatform.get("windows")}
        />
      </div>
    </div>
  );
}

function DownloadCard({
  title,
  icon,
  release,
}: {
  title: string;
  icon: ReactNode;
  release?: CurrentAppDownload;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          {release ? (
            <Badge>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Current
            </Badge>
          ) : (
            <Badge variant="danger">Not available</Badge>
          )}
        </div>
        <h3 className="mt-2 text-lg font-black text-ink-900">{title}</h3>
        {release ? (
          <>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
              <span>
                v{release.versionName}+{release.buildNumber}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {release.releaseDate}
              </span>
            </div>
            {release.notes && (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-500">
                {release.notes}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-500">
            The latest installer has not been published yet.
          </p>
        )}
      </div>
      {release && (
        <Button asChild>
          <a href={release.downloadUrl} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" />
            Download
          </a>
        </Button>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink-700">
      {label}
      {children}
    </label>
  );
}
