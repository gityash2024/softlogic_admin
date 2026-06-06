import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileStack,
  Image as ImageIcon,
  KeyRound,
  MonitorPlay,
  Play,
  Presentation,
  Send,
  Square,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { api, extractApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateTime } from "@/lib/utils";
import {
  classroomApi,
  type ClassroomContentCanvas,
  type ClassroomContentCanvasDetail,
  type ClassroomContentSlide,
  type ClassroomSummary,
} from "@/services/classroom.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  ROLE_LABEL,
  type AdminLiveSessionRecord,
  type UserRole,
} from "@/types/api";

export type RolePortalModule =
  | "dashboard"
  | "boards"
  | "sessions"
  | "materials"
  | "join"
  | "previous"
  | "progress"
  | "linked-students"
  | "reports"
  | "sessions-boards";

function defaultPathForRole(role: UserRole | undefined) {
  if (role === "TEACHER") return "/teacher/dashboard";
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "PARENT") return "/parent/dashboard";
  return "/login";
}

export function RolePortalRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={defaultPathForRole(user?.role)} replace />;
}

function statusVariant(status: string) {
  if (status === "LIVE") return "success" as const;
  if (status === "SCHEDULED") return "info" as const;
  if (status === "ENDED") return "default" as const;
  return "warning" as const;
}

function moduleTitle(role: UserRole, module: RolePortalModule) {
  if (role === "TEACHER") {
    if (module === "boards") return "Boards";
    if (module === "sessions") return "Sessions";
    if (module === "materials") return "Materials";
    return "Teacher Dashboard";
  }
  if (role === "STUDENT") {
    if (module === "join") return "Join Session";
    if (module === "previous") return "Previous Sessions";
    if (module === "boards") return "Read-only Boards";
    if (module === "progress") return "Progress";
    return "Student Dashboard";
  }
  if (module === "linked-students") return "Linked Students";
  if (module === "sessions-boards") return "Sessions & Boards";
  if (module === "reports") return "Reports";
  return "Parent Dashboard";
}

function moduleSubtitle(role: UserRole, module: RolePortalModule) {
  if (role === "TEACHER") {
    if (module === "boards")
      return "Review your own boards and open the whiteboard app for editing.";
    if (module === "sessions")
      return "Manage live classes, join codes, and session state. Login devices are in Settings.";
    if (module === "materials")
      return "Review captures, recordings, imports, and board materials.";
    return "A compact overview of your boards, sessions, students, and recent activity.";
  }
  if (role === "STUDENT") {
    if (module === "join") return "Enter a session code to join a live class.";
    if (module === "previous") return "Review your live and previous sessions.";
    if (module === "boards")
      return "View assigned and joined-session boards in read-only mode.";
    if (module === "progress")
      return "Track recent classroom activity and available materials.";
    return "Your session access, read-only boards, and learning activity.";
  }
  if (module === "linked-students")
    return "Parent visibility is limited to linked students only.";
  if (module === "sessions-boards")
    return "Read-only sessions and boards for linked students.";
  if (module === "reports")
    return "Progress signals, reports, and recent linked-student activity.";
  return "Linked-student sessions, boards, and progress at a glance.";
}

function ModuleHeader({
  summary,
  module,
}: {
  summary: ClassroomSummary;
  module: RolePortalModule;
}) {
  return (
    <section className="rounded-lg border border-line bg-white px-5 py-4 shadow-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-primary">
            {ROLE_LABEL[summary.role]}
          </p>
          <h2 className="mt-1 text-2xl font-black text-ink-900">
            {moduleTitle(summary.role, module)}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            {moduleSubtitle(summary.role, module)}
          </p>
        </div>
        <Badge
          variant={summary.activeSessionId ? "success" : "default"}
          className="w-fit"
        >
          {summary.activeSessionId ? "Live now" : "Ready"}
        </Badge>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Presentation;
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
          {label}
        </p>
        <Icon className="h-4 w-4 text-brand-primary" />
      </div>
      <p className="mt-2 text-2xl font-black text-ink-900">{value}</p>
    </Card>
  );
}

function extractPreviewImage(slide?: ClassroomContentSlide | null) {
  const elements = slide?.elements;
  const seen = new Set<unknown>();
  const visit = (value: unknown): string | null => {
    if (!value || typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    const record = value as Record<string, unknown>;
    for (const key of [
      "mediaPath",
      "sourceUrl",
      "publicUrl",
      "fileUrl",
      "renderedImagePath",
    ]) {
      const candidate = record[key];
      if (
        typeof candidate === "string" &&
        (candidate.startsWith("http://") ||
          candidate.startsWith("https://") ||
          candidate.startsWith("/storage/") ||
          candidate.startsWith("/api/"))
      ) {
        return candidate;
      }
    }
    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(elements);
}

type PreviewPoint = { x: number; y: number };
type PreviewRect = { left: number; top: number; right: number; bottom: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pointFrom(value: unknown): PreviewPoint | null {
  const record = asRecord(value);
  if (!record) return null;
  const x = asNumber(record.x) ?? asNumber(record.dx) ?? asNumber(record.left);
  const y = asNumber(record.y) ?? asNumber(record.dy) ?? asNumber(record.top);
  return x == null || y == null ? null : { x, y };
}

function rectFromStroke(stroke: Record<string, unknown>): PreviewRect | null {
  const start = pointFrom(stroke.startPoint);
  const end = pointFrom(stroke.endPoint);
  if (!start || !end) return null;
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

function colorFrom(value: unknown, fallback = "#111827") {
  const numeric = asNumber(value);
  if (numeric == null) return fallback;
  const unsigned = numeric >>> 0;
  const rgb = unsigned & 0x00ffffff;
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

function pointsFromStroke(stroke: Record<string, unknown>): PreviewPoint[] {
  const rawPoints = Array.isArray(stroke.points) ? stroke.points : [];
  return rawPoints.map(pointFrom).filter((point): point is PreviewPoint => Boolean(point));
}

function strokesFromSlide(slide?: ClassroomContentSlide | null): Record<string, unknown>[] {
  const elements = asRecord(slide?.elements);
  const rawStrokes = Array.isArray(elements?.strokes) ? elements?.strokes : [];
  return rawStrokes
    .map(asRecord)
    .filter((stroke): stroke is Record<string, unknown> => Boolean(stroke));
}

function strokeBounds(stroke: Record<string, unknown>): PreviewRect | null {
  const rect = rectFromStroke(stroke);
  const points = pointsFromStroke(stroke);
  if (rect) return rect;
  if (points.length === 0) return null;
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

function combinedBounds(strokes: Record<string, unknown>[]): PreviewRect {
  const bounds = strokes.map(strokeBounds).filter((rect): rect is PreviewRect => Boolean(rect));
  if (bounds.length === 0) {
    return { left: 0, top: 0, right: 1280, bottom: 720 };
  }
  const left = Math.min(...bounds.map((rect) => rect.left));
  const top = Math.min(...bounds.map((rect) => rect.top));
  const right = Math.max(...bounds.map((rect) => rect.right));
  const bottom = Math.max(...bounds.map((rect) => rect.bottom));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const pad = Math.max(48, Math.max(width, height) * 0.12);
  return {
    left: left - pad,
    top: top - pad,
    right: right + pad,
    bottom: bottom + pad,
  };
}

function hasDrawableSlide(slide?: ClassroomContentSlide | null) {
  return strokesFromSlide(slide).some((stroke) => {
    const contentType = String(stroke.contentType ?? "");
    return (
      pointsFromStroke(stroke).length > 1 ||
      rectFromStroke(stroke) != null ||
      Boolean(String(stroke.contentText ?? "").trim()) ||
      Boolean(String(stroke.mediaPath ?? "").trim()) ||
      contentType === "image"
    );
  });
}

function pathFromPoints(points: PreviewPoint[]) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ${rest
    .map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ")}`;
}

function WhiteboardSlidePreview({
  slide,
  title,
}: {
  slide?: ClassroomContentSlide | null;
  title: string;
}) {
  const strokes = strokesFromSlide(slide);
  const bounds = combinedBounds(strokes);
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);

  return (
    <svg
      className="h-full w-full"
      role="img"
      aria-label={`${title} preview`}
      viewBox={`${bounds.left} ${bounds.top} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {strokes.map((stroke, index) => {
        const contentType = String(stroke.contentType ?? "");
        const strokeColor = colorFrom(stroke.strokeColor ?? stroke.color);
        const fillColor = colorFrom(stroke.fillColor, "transparent");
        const strokeWidth = asNumber(stroke.strokeWidth) ?? 3;
        const opacity = (asNumber(stroke.shapeOpacity) ?? 1).toString();
        const rect = rectFromStroke(stroke);
        const points = pointsFromStroke(stroke);
        const key = `${String(stroke.id ?? index)}-${index}`;
        const mediaPath = String(stroke.mediaPath ?? "").trim();

        if (contentType === "image" && mediaPath && rect) {
          return (
            <image
              key={key}
              href={mediaPath}
              x={rect.left}
              y={rect.top}
              width={Math.max(1, rect.right - rect.left)}
              height={Math.max(1, rect.bottom - rect.top)}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        }

        if (contentType === "text" && rect) {
          return (
            <text
              key={key}
              x={rect.left + 8}
              y={rect.top + Math.max(18, asNumber(stroke.fontSize) ?? 18)}
              fill={colorFrom(stroke.color)}
              fontSize={asNumber(stroke.fontSize) ?? 18}
              fontWeight={stroke.isBold ? 700 : 500}
            >
              {String(stroke.contentText ?? "")}
            </text>
          );
        }

        if (stroke.isShape && rect) {
          const shapeType = String(stroke.shapeType ?? "");
          if (shapeType === "ellipse" || shapeType === "circle") {
            return (
              <ellipse
                key={key}
                cx={(rect.left + rect.right) / 2}
                cy={(rect.top + rect.bottom) / 2}
                rx={Math.max(1, (rect.right - rect.left) / 2)}
                ry={Math.max(1, (rect.bottom - rect.top) / 2)}
                fill={stroke.shapeFillEnabled ? fillColor : "none"}
                opacity={opacity}
                stroke={stroke.shapeStrokeEnabled === false ? "none" : strokeColor}
                strokeWidth={strokeWidth}
              />
            );
          }
          if (shapeType === "line" || shapeType === "arrow") {
            return (
              <line
                key={key}
                x1={rect.left}
                y1={rect.top}
                x2={rect.right}
                y2={rect.bottom}
                stroke={strokeColor}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
              />
            );
          }
          return (
            <rect
              key={key}
              x={rect.left}
              y={rect.top}
              width={Math.max(1, rect.right - rect.left)}
              height={Math.max(1, rect.bottom - rect.top)}
              rx={Math.max(0, asNumber(stroke.shapeCornerRadius) ?? 0)}
              fill={stroke.shapeFillEnabled ? fillColor : "none"}
              opacity={opacity}
              stroke={stroke.shapeStrokeEnabled === false ? "none" : strokeColor}
              strokeWidth={strokeWidth}
            />
          );
        }

        if (points.length > 1) {
          return (
            <path
              key={key}
              d={pathFromPoints(points)}
              fill="none"
              stroke={stroke.isEraser ? "#ffffff" : colorFrom(stroke.color)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={strokeWidth}
            />
          );
        }

        return null;
      })}
    </svg>
  );
}

function BoardPreviewTile({
  board,
  compact = false,
}: {
  board: Pick<
    ClassroomContentCanvas,
    "title" | "thumbnail" | "firstSlide" | "counts"
  >;
  compact?: boolean;
}) {
  const fallbackImage = extractPreviewImage(board.firstSlide);
  const src = board.thumbnail || null;
  const canRenderSlide = !src && hasDrawableSlide(board.firstSlide);
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-line bg-white ${
        compact ? "aspect-[16/10]" : "aspect-[16/9]"
      }`}
    >
      {src ? (
        <img
          src={src}
          alt={board.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : canRenderSlide ? (
        <div className="h-full w-full bg-[linear-gradient(#edf2fa_1px,transparent_1px),linear-gradient(90deg,#edf2fa_1px,transparent_1px)] bg-[size:22px_22px] p-2">
          <WhiteboardSlidePreview slide={board.firstSlide} title={board.title} />
        </div>
      ) : fallbackImage ? (
        <img
          src={fallbackImage}
          alt={board.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full bg-[linear-gradient(#e8edf7_1px,transparent_1px),linear-gradient(90deg,#e8edf7_1px,transparent_1px)] bg-[size:22px_22px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <Presentation className="h-8 w-8 text-brand-primary/50" />
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink-600 shadow-sm">
        {board.counts.slides} page{board.counts.slides === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function DashboardModule({ summary }: { summary: ClassroomSummary }) {
  const activeOrNext = summary.schedule[0] ?? null;
  const activityQuery = useQuery({
    queryKey: ["classroom", "content", "activity", 5],
    queryFn: () => classroomApi.contentActivity({ limit: 5 }),
  });
  const recentNotifications = (
    activityQuery.data?.length ? activityQuery.data : summary.notifications
  ).slice(0, 5);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card className="px-5 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
              {ROLE_LABEL[summary.role]}
            </p>
            <h3 className="mt-2 text-xl font-black text-ink-900">
              {summary.profile.name ?? summary.profile.email}
            </h3>
            <p className="mt-1 text-sm text-ink-500">{summary.profile.email}</p>
          </div>
          <Badge variant={summary.activeSessionId ? "success" : "default"}>
            {summary.activeSessionId ? "Live now" : "Ready"}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Whiteboards"
            value={summary.canvases.length}
            icon={Presentation}
          />
          <StatTile
            label="Sessions"
            value={summary.sessions.length}
            icon={MonitorPlay}
          />
          <StatTile
            label={summary.role === "PARENT" ? "Reports" : "Materials"}
            value={summary.materials.length}
            icon={FileStack}
          />
          <StatTile
            label={summary.role === "TEACHER" ? "Students" : "People"}
            value={summary.participants.length}
            icon={Users}
          />
        </div>
      </Card>

      <Card className="px-5 py-5">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-brand-primary" />
          <h3 className="font-bold text-ink-900">Next Session</h3>
        </div>
        {activeOrNext ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-bold text-ink-900">
              {activeOrNext.title}
            </p>
            <p className="text-sm text-ink-500">
              {activeOrNext.participantCount} participants
            </p>
            <Badge variant={statusVariant(activeOrNext.status)}>
              {activeOrNext.status}
            </Badge>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-500">
            No live or scheduled sessions are available in your scope yet.
          </p>
        )}
      </Card>

      {summary.role === "TEACHER" && <TeacherQuickActions summary={summary} />}

      <Card className="px-5 py-5 xl:col-span-2">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-brand-orange" />
          <h3 className="font-bold text-ink-900">Recent Activity</h3>
        </div>
        <div className="mt-4 grid gap-2">
          {recentNotifications.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-line bg-surface-variant px-3 py-3"
            >
              <p className="text-sm font-semibold capitalize text-ink-900">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {item.actorName ?? "SoftLogic"} -{" "}
                {formatDateTime(item.createdAt)}
              </p>
            </div>
          ))}
          {recentNotifications.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">
              No recent classroom activity has been captured yet.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function TeacherQuickActions({ summary }: { summary: ClassroomSummary }) {
  const firstBoard = summary.canvases[0];
  const liveSession = summary.sessions.find((item) => item.status === "LIVE");
  return (
    <Card className="px-5 py-5 xl:col-span-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-bold text-ink-900">Main Actions</h3>
          <p className="mt-1 text-sm text-ink-500">
            Use the SoftLogic Whiteboard app for full editing and live board
            control.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/downloads">
              <Presentation className="h-4 w-4" />
              Open app downloads
            </Link>
          </Button>
          {firstBoard && (
            <Button asChild variant="outline">
              <Link to="/teacher/boards">
                <BookOpen className="h-4 w-4" />
                Review boards
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/teacher/sessions">
              {liveSession ? (
                <MonitorPlay className="h-4 w-4" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              {liveSession ? "Manage live session" : "Manage sessions"}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function BoardsModule({ summary }: { summary: ClassroomSummary }) {
  const canEdit = summary.role === "TEACHER";
  const contentQuery = useQuery({
    queryKey: ["classroom", "content", "canvases"],
    queryFn: classroomApi.contentCanvases,
  });
  const boards =
    contentQuery.data ??
    summary.canvases.map<ClassroomContentCanvas>((board) => ({
      id: board.id,
      title: board.title,
      description: board.description,
      thumbnail: null,
      createdAt: board.updatedAt,
      updatedAt: board.updatedAt,
      firstSlide: null,
      counts: {
        slides: board.slideCount,
        exports: 0,
        liveSessions: 0,
        imports: 0,
        recordings: 0,
        activity: 0,
      },
      assets: [],
    }));
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-ink-900">
            {canEdit ? "My Whiteboards" : "Read-only Whiteboards"}
          </h3>
          <p className="text-sm text-ink-500">
            {canEdit
              ? "Only boards created by you are editable in the SoftLogic Whiteboard app."
              : "Boards are available in read-only mode from your allowed sessions."}
          </p>
        </div>
        {canEdit ? (
          <Button asChild>
            <Link to="/downloads">
              <Presentation className="h-4 w-4" />
              Open whiteboard app
            </Link>
          </Button>
        ) : (
          <Badge variant="info" className="w-fit">
            <Eye className="h-3.5 w-3.5" />
            Read only
          </Badge>
        )}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {contentQuery.isLoading ? (
          <Card className="flex items-center gap-2 px-5 py-4 text-sm text-ink-500">
            <Spinner className="h-4 w-4 text-brand-primary" />
            Loading boards...
          </Card>
        ) : boards.length === 0 ? (
          <Card className="px-5 py-4 text-sm text-ink-500">
            No whiteboards are available in your scope yet.
          </Card>
        ) : (
          boards.map((board) => (
            <Card key={board.id} className="px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
                <BoardPreviewTile board={board} compact />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold text-ink-900">
                      {board.title}
                    </p>
                    <Badge variant={canEdit ? "success" : "default"}>
                      {canEdit ? "Editable in app" : "View"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {board.counts.slides} slides - Updated{" "}
                    {formatDateTime(board.updatedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-500">
                    <span>{board.counts.imports} imports/media</span>
                    <span>{board.counts.exports} exports</span>
                    <span>{board.counts.liveSessions} sessions</span>
                  </div>
                  {board.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-ink-500">
                      {board.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

function SessionsModule({
  summary,
  sessions,
  loading = false,
}: {
  summary: ClassroomSummary;
  sessions?: AdminLiveSessionRecord[];
  loading?: boolean;
}) {
  const rows = sessions ?? summary.sessions;
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="Live"
          value={rows.filter((item) => item.status === "LIVE").length}
          icon={MonitorPlay}
        />
        <StatTile
          label="Scheduled"
          value={rows.filter((item) => item.status === "SCHEDULED").length}
          icon={CalendarClock}
        />
        <StatTile
          label="Previous"
          value={rows.filter((item) => item.status === "ENDED").length}
          icon={ClipboardList}
        />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {loading ? (
          <Card className="flex items-center gap-2 px-5 py-4 text-sm text-ink-500">
            <Spinner className="h-4 w-4 text-brand-primary" />
            Loading sessions...
          </Card>
        ) : rows.length === 0 ? (
          <Card className="px-5 py-4 text-sm text-ink-500">
            No live teaching sessions are available yet. For account login
            sessions and device management, open{" "}
            <Link className="font-semibold text-brand-primary" to="/settings">
              Settings
            </Link>
            .
          </Card>
        ) : (
          rows.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              canManage={summary.role === "TEACHER"}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SessionCard({
  session,
  canManage,
}: {
  session: AdminLiveSessionRecord;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const actionMutation = useMutation({
    mutationFn: async (action: "start" | "end") => {
      const res = await api.post(`/live-sessions/${session.id}/${action}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom", "me"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["classroom", "content"] });
      toast.success("Session updated");
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const joinCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/live-sessions/${session.id}/join-code`, {
        expiresInMinutes: 240,
        forceRefresh: false,
      });
      return res.data?.data as { code?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["classroom", "me"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["classroom", "content"] });
      if (data?.code) {
        navigator.clipboard?.writeText(data.code).catch(() => undefined);
        toast.success(`Join code ${data.code} copied`);
      } else {
        toast.success("Join code generated");
      }
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await api.post(`/live-sessions/${session.id}/invites`, {
        email,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Invite sent");
      queryClient.invalidateQueries({ queryKey: ["classroom", "me"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["classroom", "content"] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const canStart = session.status === "SCHEDULED";
  const canEnd = session.status === "LIVE";
  return (
    <Card className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink-900">
            {session.title ?? session.canvas?.name ?? "Live Session"}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {session._count?.participants ?? 0} participants - Created{" "}
            {formatDateTime(session.createdAt)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Board: {session.canvas?.name ?? session.canvasId}
          </p>
        </div>
        <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
      </div>
      {canManage && (
        <div className="mt-4 space-y-3 border-t border-line pt-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canStart || actionMutation.isPending}
              onClick={() => actionMutation.mutate("start")}
            >
              <Play className="h-4 w-4" />
              Start
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEnd || actionMutation.isPending}
              onClick={() => actionMutation.mutate("end")}
            >
              <Square className="h-4 w-4" />
              End
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={joinCodeMutation.isPending}
              onClick={() => joinCodeMutation.mutate()}
            >
              <KeyRound className="h-4 w-4" />
              Generate code
            </Button>
            {session.joinCode && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(session.joinCode ?? "")
                    .catch(() => undefined);
                  toast.success("Join code copied");
                }}
              >
                <Copy className="h-4 w-4" />
                {session.joinCode}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="student@example.com"
            />
            <Button
              type="button"
              variant="primary"
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate(inviteEmail.trim())}
            >
              <Send className="h-4 w-4" />
              Invite
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function MaterialsModule({ summary }: { summary: ClassroomSummary }) {
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const canvasesQuery = useQuery({
    queryKey: ["classroom", "content", "canvases"],
    queryFn: classroomApi.contentCanvases,
  });
  const boards = canvasesQuery.data ?? [];
  const selectedId = selectedCanvasId ?? boards[0]?.id ?? null;
  const detailQuery = useQuery({
    queryKey: ["classroom", "content", "canvas", selectedId],
    queryFn: () => classroomApi.contentCanvas(selectedId as string),
    enabled: Boolean(selectedId),
  });
  const detail = detailQuery.data;
  const totals = boards.reduce(
    (acc, board) => ({
      materials: acc.materials + board.counts.imports + board.counts.recordings,
      exports: acc.exports + board.counts.exports,
      activity: acc.activity + board.counts.activity,
    }),
    { materials: 0, exports: 0, activity: 0 },
  );

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="Materials"
          value={canvasesQuery.data ? totals.materials : summary.materials.length}
          icon={FileStack}
        />
        <StatTile
          label="Boards"
          value={canvasesQuery.data ? boards.length : summary.canvases.length}
          icon={BookOpen}
        />
        <StatTile
          label="Activity"
          value={canvasesQuery.data ? totals.activity : summary.notifications.length}
          icon={ClipboardList}
        />
      </div>

      {canvasesQuery.isLoading ? (
        <Card className="flex items-center gap-2 px-5 py-4 text-sm text-ink-500">
          <Spinner className="h-4 w-4 text-brand-primary" />
          Loading board content...
        </Card>
      ) : boards.length === 0 ? (
        <Card className="px-5 py-4 text-sm text-ink-500">
          No board materials have been captured yet.
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            {boards.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => setSelectedCanvasId(board.id)}
                className={`w-full rounded-lg border bg-white p-3 text-left shadow-card transition hover:border-brand-primary/40 ${
                  selectedId === board.id ? "border-brand-primary" : "border-line"
                }`}
              >
                <BoardPreviewTile board={board} compact />
                <p className="mt-3 truncate text-sm font-bold text-ink-900">
                  {board.title}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Updated {formatDateTime(board.updatedAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-500">
                  <span>{board.counts.imports} imports</span>
                  <span>{board.counts.exports} exports</span>
                  <span>{board.counts.liveSessions} sessions</span>
                </div>
              </button>
            ))}
          </div>
          {detailQuery.isLoading ? (
            <Card className="flex items-center gap-2 px-5 py-4 text-sm text-ink-500">
              <Spinner className="h-4 w-4 text-brand-primary" />
              Loading selected board...
            </Card>
          ) : detail ? (
            <BoardContentDetail detail={detail} />
          ) : (
            <Card className="px-5 py-4 text-sm text-ink-500">
              Select a board to review its content.
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

function BoardContentDetail({ detail }: { detail: ClassroomContentCanvasDetail }) {
  return (
    <div className="space-y-4">
      <Card className="px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full lg:w-80">
            <BoardPreviewTile board={detail} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-primary">
              Board content
            </p>
            <h3 className="mt-1 truncate text-xl font-black text-ink-900">
              {detail.title}
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              Created {formatDateTime(detail.createdAt)} - Updated{" "}
              {formatDateTime(detail.updatedAt)}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <StatTile label="Materials" value={detail.assets.length} icon={FileStack} />
              <StatTile label="Exports" value={detail.exports.length} icon={Download} />
              <StatTile label="Sessions" value={detail.liveSessions.length} icon={MonitorPlay} />
              <StatTile label="Activity" value={detail.activity.length} icon={ClipboardList} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ContentSection
          title="Materials"
          empty="No imports, media, or recordings have been captured for this board."
          items={detail.assets.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: `${item.type} - ${formatDateTime(item.createdAt)}`,
            href: item.url ?? undefined,
            icon: item.url ? ImageIcon : FileStack,
          }))}
        />
        <ContentSection
          title="Exports"
          empty="No exports have been recorded for this board yet."
          items={detail.exports.map((item) => ({
            id: item.id,
            title: `${item.format} export`,
            subtitle: `${item.status} - ${formatDateTime(item.completedAt ?? item.createdAt)}`,
            href: item.fileUrl ?? undefined,
            icon: Download,
          }))}
        />
        <ContentSection
          title="Sessions"
          empty="No live sessions are linked with this board yet."
          items={detail.liveSessions.map((item) => ({
            id: item.id,
            title: item.title ?? "Live Session",
            subtitle: `${item.status} - ${item.participantCount} participants - ${formatDateTime(item.createdAt)}`,
            icon: MonitorPlay,
          }))}
        />
        <ContentSection
          title="Activity"
          empty="No activity has been captured for this board yet."
          items={detail.activity.map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: `${item.actorName ?? "SoftLogic"} - ${formatDateTime(item.createdAt)}`,
            icon: ClipboardList,
          }))}
        />
      </div>
    </div>
  );
}

function ContentSection({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    href?: string;
    icon: typeof FileStack;
  }>;
}) {
  return (
    <Card className="px-5 py-5">
      <h3 className="font-bold text-ink-900">{title}</h3>
      <div className="mt-4 grid gap-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">
            {empty}
          </p>
        ) : (
          items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-line bg-surface-variant px-3 py-3"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">{item.subtitle}</p>
                </div>
                {item.href && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={item.href} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function JoinSessionModule({ summary }: { summary: ClassroomSummary }) {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();
  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/live-sessions/join-code/join", {
        code: code.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Session joined");
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["classroom", "me"] });
    },
    onError: (error) => toast.error(extractApiError(error)),
  });
  const liveSession =
    summary.sessions.find((session) => session.status === "LIVE") ?? null;
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card className="px-5 py-5">
        <div className="flex items-center gap-3">
          <MonitorPlay className="h-5 w-5 text-brand-primary" />
          <h3 className="font-bold text-ink-900">Join by Code</h3>
        </div>
        <div className="mt-4 space-y-3">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter session code"
          />
          <Button
            type="button"
            className="w-full"
            disabled={!code.trim() || joinMutation.isPending}
            onClick={() => joinMutation.mutate()}
          >
            <ArrowRight className="h-4 w-4" />
            Join session
          </Button>
        </div>
      </Card>
      <Card className="px-5 py-5">
        <h3 className="font-bold text-ink-900">Live Session</h3>
        {liveSession ? (
          <SessionCard session={liveSession} canManage={false} />
        ) : (
          <p className="mt-4 text-sm text-ink-500">
            You do not have a live session in your scope right now.
          </p>
        )}
      </Card>
    </div>
  );
}

function ProgressModule({ summary }: { summary: ClassroomSummary }) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="Session records"
          value={summary.sessions.length}
          icon={CalendarClock}
        />
        <StatTile
          label="Board views"
          value={summary.canvases.length}
          icon={BookOpen}
        />
        <StatTile
          label="Activity records"
          value={summary.notifications.length}
          icon={ClipboardList}
        />
      </div>
      <MaterialsModule summary={summary} />
    </section>
  );
}

function ParentLinkedStudentsModule({
  summary,
}: {
  summary: ClassroomSummary;
}) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="Linked sessions"
          value={summary.sessions.length}
          icon={CalendarClock}
        />
        <StatTile
          label="Linked boards"
          value={summary.canvases.length}
          icon={BookOpen}
        />
        <StatTile
          label="Reports"
          value={summary.notifications.length}
          icon={ClipboardList}
        />
      </div>
      <Card className="px-5 py-5">
        <h3 className="font-bold text-ink-900">Linked Student Scope</h3>
        <p className="mt-2 text-sm text-ink-500">
          This portal only shows sessions, boards, and reports for students
          linked to this parent account.
        </p>
      </Card>
    </section>
  );
}

function PreviousSessionsModule({ summary }: { summary: ClassroomSummary }) {
  const sessions = summary.sessions.filter(
    (session) => session.status !== "LIVE",
  );
  return (
    <section className="grid gap-3 xl:grid-cols-2">
      {sessions.length === 0 ? (
        <Card className="px-5 py-4 text-sm text-ink-500">
          No previous sessions are available yet.
        </Card>
      ) : (
        sessions.map((session) => (
          <SessionCard key={session.id} session={session} canManage={false} />
        ))
      )}
    </section>
  );
}

function RoleModuleBody({
  summary,
  module,
  teacherSessions,
  teacherSessionsLoading = false,
}: {
  summary: ClassroomSummary;
  module: RolePortalModule;
  teacherSessions?: AdminLiveSessionRecord[];
  teacherSessionsLoading?: boolean;
}) {
  if (module === "boards") return <BoardsModule summary={summary} />;
  if (module === "sessions") {
    return (
      <SessionsModule
        summary={summary}
        sessions={summary.role === "TEACHER" ? teacherSessions : undefined}
        loading={summary.role === "TEACHER" && teacherSessionsLoading}
      />
    );
  }
  if (module === "materials") return <MaterialsModule summary={summary} />;
  if (module === "join") return <JoinSessionModule summary={summary} />;
  if (module === "previous")
    return <PreviousSessionsModule summary={summary} />;
  if (module === "progress" || module === "reports")
    return <ProgressModule summary={summary} />;
  if (module === "linked-students")
    return <ParentLinkedStudentsModule summary={summary} />;
  if (module === "sessions-boards") {
    return (
      <div className="space-y-5">
        <SessionsModule summary={summary} />
        <BoardsModule summary={summary} />
      </div>
    );
  }
  return <DashboardModule summary={summary} />;
}

function isModuleAllowed(role: UserRole, module: RolePortalModule) {
  if (role === "TEACHER") {
    return ["dashboard", "boards", "sessions", "materials"].includes(module);
  }
  if (role === "STUDENT") {
    return ["dashboard", "join", "previous", "boards", "progress"].includes(
      module,
    );
  }
  if (role === "PARENT") {
    return [
      "dashboard",
      "linked-students",
      "sessions-boards",
      "reports",
    ].includes(module);
  }
  return false;
}

export function RolePortalPage({
  module = "dashboard",
}: {
  module?: RolePortalModule;
}) {
  const query = useQuery({
    queryKey: ["classroom", "me"],
    queryFn: classroomApi.me,
  });

  const summary = query.data;
  const canonicalModule = useMemo(() => module, [module]);
  const teacherSessionsQuery = useQuery({
    queryKey: ["teacher", "live-sessions"],
    queryFn: async () => {
      const res = await api.get<{ data: AdminLiveSessionRecord[] }>(
        "/live-sessions",
      );
      return res.data.data ?? [];
    },
    enabled: summary?.role === "TEACHER" && canonicalModule === "sessions",
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-primary" />
      </div>
    );
  }

  if (!summary || query.isError) {
    return (
      <Card className="px-5 py-5">
        <p className="font-semibold text-ink-900">
          Portal data is unavailable.
        </p>
        <p className="mt-1 text-sm text-ink-500">
          Refresh the page or sign in again to reload your classroom scope.
        </p>
      </Card>
    );
  }

  if (!isModuleAllowed(summary.role, canonicalModule)) {
    return <Navigate to={defaultPathForRole(summary.role)} replace />;
  }

  return (
    <div className="space-y-5">
      <ModuleHeader summary={summary} module={canonicalModule} />
      <RoleModuleBody
        summary={summary}
        module={canonicalModule}
        teacherSessions={teacherSessionsQuery.data}
        teacherSessionsLoading={teacherSessionsQuery.isLoading}
      />
    </div>
  );
}
