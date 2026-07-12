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
import { StatCard } from "@/features/admin/admin-list-ui";
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

const channelsForEnvironment = (environment: AppReleaseEnvironment) =>
  CHANNELS.filter((channel) => channel.environment === environment);

const channelSelectionFor = (
  channels: ReleaseChannel[],
  predicate: (channel: ReleaseChannel) => boolean,
) =>
  Object.fromEntries(
    channels.map((channel) => [
      channelKey(channel.environment, channel.brand, channel.platform),
      predicate(channel),
    ]),
  );

const allChannelSelectionFor = (channels: ReleaseChannel[]) =>
  channelSelectionFor(channels, () => true);

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
  const adminEnvironment = currentAdminEnvironment();
  const visibleChannels = useMemo(
    () => channelsForEnvironment(adminEnvironment),
    [adminEnvironment],
  );
  const environmentLabel =
    adminEnvironment === "production" ? "Production" : "Staging";
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
    useState<Record<string, boolean>>(() =>
      allChannelSelectionFor(visibleChannels),
    );
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
    queryKey: ["app-releases", adminEnvironment],
    queryFn: () => downloadsApi.listFiltered({ environment: adminEnvironment }),
  });

  const currentByChannel = useMemo(
    () => currentReleaseByChannel(releasesQuery.data ?? []),
    [releasesQuery.data],
  );

  const selectedReleaseChannels = useMemo(
    () =>
      visibleChannels.filter(
        (channel) =>
          selectedChannels[
            channelKey(channel.environment, channel.brand, channel.platform)
          ],
      ),
    [selectedChannels, visibleChannels],
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
      setSelectedChannels(allChannelSelectionFor(visibleChannels));
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
    setSelectedChannels(allChannelSelectionFor(visibleChannels));
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
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-brand-primary/5 via-white to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary shadow-sm">
              <Download className="h-6 w-6" />
            </span>
            <div>
              <Badge variant="navy">Super Admin release control</Badge>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-ink-900">
                App releases
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
                Publish one version and build number to the {environmentLabel} channels
                or only selected Android and Windows download links. Each installed app
                checks only its matching channel.
              </p>
            </div>
          </div>
          <Button
            onClick={openPublish}
            className="shrink-0 shadow-sm transition-all hover:shadow"
          >
            <Plus className="h-4 w-4" />
            Publish release
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active channels"
          value={visibleChannels.length}
          detail={`${environmentLabel} release channels`}
          tone="blue"
        />
        <StatCard
          label="Live releases"
          value={currentByChannel.size}
          detail={`${currentByChannel.size} of ${visibleChannels.length} channels active`}
          tone="green"
        />
        <StatCard
          label="Release history"
          value={releasesQuery.data?.length ?? 0}
          detail="Total historical builds logged"
          tone="purple"
        />
        <StatCard
          label="Forced updates"
          value={(releasesQuery.data ?? []).filter((r) => r.isCurrent && r.isForced).length}
          detail="Mandatory channel updates"
          tone="orange"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleChannels.map((channel) => {
          const release = currentByChannel.get(
            channelKey(channel.environment, channel.brand, channel.platform),
          );
          const isAndroid = channel.platform === "android";
          const Icon = isAndroid ? Smartphone : MonitorDown;
          return (
            <Card
              key={channel.label}
              className={`group relative overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                isAndroid
                  ? "border-emerald-500/45 shadow-emerald-950/5 hover:border-emerald-500/80"
                  : "border-blue-500/45 shadow-blue-950/5 hover:border-blue-500/80"
              }`}
            >
              <div
                className={`h-1 w-full ${
                  isAndroid
                    ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500"
                    : "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500"
                }`}
              />
              <div
                className={`flex flex-wrap items-center justify-between gap-3 border-b border-line/80 px-5 py-3 ${
                  isAndroid
                    ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-white"
                    : "bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 ${
                      isAndroid
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/25"
                        : "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/25"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">
                      {channel.brand === "softlogic"
                        ? "SoftLogic Channel"
                        : "AI Smart Board Channel"}
                    </span>
                    <h3 className="text-base font-black leading-tight text-ink-900">
                      {isAndroid
                        ? "Android APK Installer"
                        : "Windows Desktop EXE"}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide uppercase shadow-2xs ${
                      channel.environment === "production"
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border border-slate-300 bg-slate-100 text-slate-800"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        channel.environment === "production"
                          ? "bg-emerald-500"
                          : "bg-slate-500"
                      }`}
                    />
                    {channel.environment}
                  </span>
                  {release && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 shadow-2xs">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Live & Serving
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4">
                {release ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        Version
                      </span>
                      <p className="mt-0.5 font-mono text-sm font-black text-ink-900">
                        v{release.versionName}
                      </p>
                      <span className="text-[11px] font-semibold text-ink-500">
                        Build #{release.buildNumber}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        Update Mode
                      </span>
                      <div className="mt-1 flex items-center gap-1">
                        {release.isForced ? (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            <ShieldAlert className="h-3 w-3 text-amber-600" />
                            Forced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                            <CheckCircle2 className="h-3 w-3 text-blue-600" />
                            Optional
                          </span>
                        )}
                      </div>
                      <span className="mt-1 block text-[10px] text-ink-400">
                        {release.isForced
                          ? "Mandatory upgrade"
                          : "User dismissible"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        Published Date
                      </span>
                      <p className="mt-0.5 text-sm font-bold text-ink-900">
                        {release.releaseDate}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-400">
                        <CalendarDays className="h-3 w-3" />
                        Official release
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        Status
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-bold text-emerald-700">
                          Active & Serving
                        </span>
                      </div>
                      <span className="mt-1 block text-[10px] text-ink-400">
                        Client update target
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-danger/40 bg-danger/5 p-4 text-center">
                    <div>
                      <ShieldAlert className="mx-auto h-6 w-6 text-danger" />
                      <p className="mt-1.5 text-xs font-bold text-danger">
                        Channel Unassigned
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        Publish a release targeting this channel to activate
                        client update checks.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {release && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 bg-slate-50/80 px-5 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                    <span className="font-semibold text-ink-700">
                      Channel ID:
                    </span>
                    <code className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-ink-700">
                      {channel.environment}:{channel.brand}:{channel.platform}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 rounded-lg border-slate-300 bg-white px-3 text-xs font-bold text-ink-800 shadow-2xs transition-colors hover:border-brand-primary hover:bg-brand-primary/5 hover:text-brand-primary"
                      onClick={() => openEdit(release)}
                    >
                      <Pencil className="h-3 w-3" />
                      Configure
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg bg-brand-primary px-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow"
                      asChild
                    >
                      <a
                        href={release.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="h-3 w-3" />
                        Download Installer
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <section className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge variant="navy">
              <History className="mr-1.5 h-3.5 w-3.5" />
              Full release history
            </Badge>
            <h3 className="mt-3 text-xl font-black text-ink-900">
              {environmentLabel} app releases
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
              Search every {environmentLabel.toLowerCase()} release by channel,
              version, build number, notes, or URL, then manage current, active,
              and force-update status.
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
              ["all", `All ${environmentLabel}`],
              [adminEnvironment, environmentLabel],
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
              Select the exact {environmentLabel} brands and platforms that
              should receive this version.
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
                    {selectedReleaseChannels.length} of {visibleChannels.length}{" "}
                    selected
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelectedChannels(allChannelSelectionFor(visibleChannels))
                    }
                  >
                    All {environmentLabel}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSelectedChannels(
                        channelSelectionFor(visibleChannels, () => false),
                      )
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {visibleChannels.map((channel) => {
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
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-brand-primary/5 via-white to-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary shadow-sm">
            <Download className="h-6 w-6" />
          </span>
          <div>
            <Badge variant={environment === "production" ? "success" : "navy"}>
              {environment}
            </Badge>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink-900">
              {displayName} downloads
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
              Download the latest verified Android APK and Windows EXE installers
              for your workspace.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DownloadCard
          title={`${displayName} Android APK`}
          platform="android"
          icon={<Smartphone className="h-6 w-6" />}
          release={downloadsByPlatform.get("android")}
        />
        <DownloadCard
          title={`${displayName} Windows EXE`}
          platform="windows"
          icon={<MonitorDown className="h-6 w-6" />}
          release={downloadsByPlatform.get("windows")}
        />
      </div>
    </div>
  );
}

function DownloadCard({
  title,
  platform,
  icon,
  release,
}: {
  title: string;
  platform?: "android" | "windows";
  icon: ReactNode;
  release?: CurrentAppDownload;
}) {
  const isAndroid = platform === "android";
  return (
    <Card
      className={`group relative overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
        isAndroid
          ? "border-emerald-500/45 shadow-emerald-950/5 hover:border-emerald-500/80"
          : "border-blue-500/45 shadow-blue-950/5 hover:border-blue-500/80"
      }`}
    >
      <div
        className={`h-1 w-full ${
          isAndroid
            ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500"
            : "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500"
        }`}
      />
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-line/80 px-5 py-3 ${
          isAndroid
            ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-white"
            : "bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105 ${
              isAndroid
                ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/25"
                : "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/25"
            }`}
          >
            {icon}
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">
              Verified Client Package
            </span>
            <h3 className="text-base font-black leading-tight text-ink-900">
              {title}
            </h3>
          </div>
        </div>
        <div>
          {release ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Live Current
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-[11px] font-bold text-danger">
              Not Available
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {release ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3.5 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
                  Version Number
                </span>
                <p className="mt-1 font-mono text-lg font-black text-ink-900">
                  v{release.versionName}
                </p>
                <span className="text-[11px] font-semibold text-ink-500">
                  Build #{release.buildNumber}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Published Date
                </span>
                <p className="mt-0.5 text-sm font-bold text-ink-900">
                  {release.releaseDate}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] text-ink-400">
                  <CalendarDays className="h-3 w-3" />
                  Official release
                </span>
              </div>

              <div className="col-span-2 rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-2xs sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Update Requirement
                </span>
                <div className="mt-1 flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Production Ready
                  </span>
                </div>
                <span className="mt-1 block text-[10px] text-ink-400">
                  Verified signature
                </span>
              </div>
            </div>

            {release.notes && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-ink-700 shadow-2xs">
                <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Release Notes
                </span>
                {release.notes}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs font-medium text-ink-500">
            The latest installer for this platform has not been published yet.
          </p>
        )}
      </div>

      {release && (
        <div className="flex items-center justify-between border-t border-line/80 bg-slate-50/80 px-5 py-2.5">
          <span className="text-[11px] font-semibold text-ink-500">
            Secure Google Drive direct link
          </span>
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-lg bg-brand-primary px-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow"
            asChild
          >
            <a href={release.downloadUrl} target="_blank" rel="noreferrer">
              <Download className="h-3 w-3" />
              Download Installer
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
          </Button>
        </div>
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
