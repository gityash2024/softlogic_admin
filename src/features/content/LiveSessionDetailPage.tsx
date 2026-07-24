import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Download,
  Eye,
  ExternalLink,
  FileText,
  FileUp,
  FileVideo,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquareText,
  MonitorPlay,
  Plus,
  Radio,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, apiObjectUrl, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatBytes } from '@/lib/utils';
import { classroomApi } from '@/services/classroom.api';
import { contentApi } from '@/services/content.api';
import {
  getAssessmentsBySession,
  type Assessment,
} from '@/services/assessment.api';
import { AssessmentSubmissionsModal } from './AssessmentSubmissionsModal';
import {
  LIVE_SESSION_STATUS_LABEL,
  type AdminLiveSessionRecord,
  type LiveSessionStatus,
  type UserRole,
} from '@/types/api';
import { BoardPreviewTile, type WhiteboardPreviewSlide } from './WhiteboardPreview';

import {
  MaterialPreviewDialog,
  downloadMediaAsset,
  isStudyMaterial,
  type LiveSessionMediaAsset,
} from '@/components/MaterialPreviewDialog';
type LiveSessionRecording = NonNullable<AdminLiveSessionRecord['recordings']>[number];
type LiveSessionEvent = AdminLiveSessionRecord['events'][number];

function statusVariant(status: LiveSessionStatus) {
  if (status === 'LIVE') return 'success' as const;
  if (status === 'SCHEDULED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'default' as const;
}

function durationLabel(session: AdminLiveSessionRecord) {
  if (!session.startedAt) return 'Not started';
  const end = session.endedAt ? new Date(session.endedAt) : new Date();
  const elapsed = Math.max(0, end.getTime() - new Date(session.startedAt).getTime());
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function personLabel(person?: {
  name: string | null;
  email: string;
  role: string;
} | null) {
  if (!person) return 'Not assigned';
  return `${person.name ?? person.email} (${person.role.replaceAll('_', ' ')})`;
}

function payloadText(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function payloadList(payload: Record<string, unknown> | null | undefined, key: string) {
  const value = payload?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}



function backPathForRole(role: UserRole | undefined) {
  if (role === 'TEACHER') return '/teacher/sessions';
  if (role === 'STUDENT') return '/student/previous';
  if (role === 'PARENT') return '/parent/sessions-boards';
  return '/content?tab=live-sessions';
}

function DetailStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="truncate text-lg font-bold text-ink-900">{value}</p>
      </div>
    </Card>
  );
}

function StudyMaterialUploader({
  sessionId,
  onAddAssessment,
}: {
  sessionId: string;
  onAddAssessment?: () => void;
}) {
  return (
    <Card className="border-brand-primary/20 bg-brand-primary/[0.025] px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-brand-primary" />
            <h3 className="text-base font-bold text-ink-900">Share study materials & assessments</h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            Open the dedicated upload workspace for multi-file upload, or attach file upload and auto-scored MCQ assessments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onAddAssessment && (
            <Button type="button" variant="outline" onClick={onAddAssessment}>
              <Plus className="h-4 w-4" />
              Add Assessment
            </Button>
          )}
          <Button asChild>
            <Link to={`/teacher/sessions/${sessionId}/materials`}>
              <FileUp className="h-4 w-4" />
              Upload materials
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MaterialCard({
  asset,
  onPreview,
}: {
  asset: LiveSessionMediaAsset;
  onPreview: (asset: LiveSessionMediaAsset) => void;
}) {
  const Icon = asset.kind === 'VIDEO' ? FileVideo : asset.kind === 'IMAGE' ? ImageIcon : FileText;
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    await downloadMediaAsset(asset);
    setIsDownloading(false);
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-line bg-white px-4 py-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-variant text-brand-primary">
          <Icon className="h-5 w-5" />
        </div>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onPreview(asset)}
        >
          <p className="truncate text-sm font-semibold text-ink-900">{asset.fileName}</p>
          <p className="mt-1 truncate text-xs text-ink-500">
            {asset.kind} - {asset.mimeType} - {formatBytes(asset.sizeBytes)}
          </p>
          <p className="mt-1 text-xs text-ink-400">{formatDateTime(asset.createdAt)}</p>
        </button>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onPreview(asset)}>
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={isDownloading} onClick={handleDownload}>
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}



function RecordingCard({ recording }: { recording: LiveSessionRecording }) {
  return (
    <div className="rounded-lg border border-line px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-ink-900">
          {recording.createdBy?.name ?? recording.createdBy?.email ?? 'Recording'}
        </p>
        <Badge
          variant={
            recording.status === 'READY'
              ? 'success'
              : recording.status === 'FAILED'
                ? 'danger'
                : 'warning'
          }
        >
          {recording.status}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-ink-500">
        {recording.durationSeconds ? `${recording.durationSeconds}s` : 'Duration pending'}
      </p>
      <p className="mt-1 text-xs text-ink-400">{formatDateTime(recording.createdAt)}</p>
      {recording.publicUrl && (
        <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
          <a href={recording.publicUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open recording
          </a>
        </Button>
      )}
    </div>
  );
}

function BoardPreviewSection({ session }: { session: AdminLiveSessionRecord }) {
  const boardPreview = session.boardPreview ?? {
    id: session.canvas.id,
    title: session.canvas.name,
    thumbnail: session.canvas.thumbnail ?? null,
    slides: session.canvas.slides ?? [],
  };
  const firstSlide = boardPreview.slides[0] as WhiteboardPreviewSlide | undefined;
  const pageCount = boardPreview.slides.length;

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full lg:w-[420px]">
          <BoardPreviewTile
            title={boardPreview.title}
            thumbnail={boardPreview.thumbnail}
            slide={firstSlide}
            pageCount={pageCount || undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 text-brand-primary" />
            <h3 className="text-base font-bold text-ink-900">Read-only board preview</h3>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Pages from the session board are available here for review without editing tools.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {boardPreview.slides.slice(0, 6).map((slide, index) => (
              <div key={slide.id} className="rounded-lg border border-line bg-surface-variant p-2">
                <BoardPreviewTile
                  title={slide.title ?? slide.name ?? `Page ${index + 1}`}
                  thumbnail={slide.thumbnail}
                  slide={slide as WhiteboardPreviewSlide}
                  compact
                />
                <p className="mt-2 truncate text-xs font-semibold text-ink-700">
                  {slide.title ?? slide.name ?? `Page ${index + 1}`}
                </p>
              </div>
            ))}
            {pageCount === 0 && (
              <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">
                No saved board pages are available yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function LiveSessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const actor = useAuthStore((state) => state.user);
  const [previewAsset, setPreviewAsset] = useState<LiveSessionMediaAsset | null>(null);
  const [selectedAssessmentForSubmissions, setSelectedAssessmentForSubmissions] =
    useState<Assessment | null>(null);

  const portalRole =
    actor?.role === 'TEACHER' || actor?.role === 'STUDENT' || actor?.role === 'PARENT';

  const query = useQuery({
    queryKey: ['live-session-detail', id, actor?.role],
    queryFn: () => {
      if (!id) throw new Error('Live session id is required');
      return portalRole ? classroomApi.liveSessionDetail(id) : contentApi.liveSessions.get(id);
    },
    enabled: Boolean(id),
  });

  const assessmentsQuery = useQuery({
    queryKey: ['assessments-session', id],
    queryFn: () => {
      if (!id) return [];
      return getAssessmentsBySession(id);
    },
    enabled: Boolean(id),
  });
  const assessments = assessmentsQuery.data || [];

  if (query.isLoading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  if (!query.data || query.isError) {
    return (
      <Card className="space-y-3 px-5 py-6">
        <p className="font-semibold text-ink-900">Live session details are unavailable.</p>
        <p className="text-sm text-ink-500">
          {query.error ? extractApiError(query.error) : 'The session may be outside your account scope.'}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </Card>
    );
  }

  const session = query.data;
  const isTeacher = actor?.role === 'TEACHER';
  const backPath = backPathForRole(actor?.role);
  const studyMaterials =
    session.studyMaterials && session.studyMaterials.length > 0
      ? session.studyMaterials
      : (session.mediaAssets ?? []).filter(isStudyMaterial);
  const sessionMedia = (session.mediaAssets ?? []).filter((asset) => !isStudyMaterial(asset));
  const aiSummaryEvent =
    session.aiSummary ?? session.events.find((event) => event.type === 'AI_SUMMARY_GENERATED');
  const rawSummaryText = payloadText(aiSummaryEvent?.payload, ['summary', 'overview']);
  let parsedAiSummary: Record<string, any> | null = null;
  if (rawSummaryText) {
    try {
      parsedAiSummary = JSON.parse(rawSummaryText);
    } catch (e) {
      // Ignore parse error
    }
  }
  const finalSummary = parsedAiSummary?.summary || rawSummaryText;
  const finalKeyPoints = Array.isArray(parsedAiSummary?.keyPoints) ? parsedAiSummary.keyPoints : payloadList(aiSummaryEvent?.payload, 'keyPoints');
  const studentQuestions = Array.isArray(parsedAiSummary?.studentQuestions) ? parsedAiSummary.studentQuestions : [];
  const participationInsights = Array.isArray(parsedAiSummary?.participationInsights) ? parsedAiSummary.participationInsights : [];
  const homework = Array.isArray(parsedAiSummary?.homework) ? parsedAiSummary.homework : [];
  const weakTopics = Array.isArray(parsedAiSummary?.weakTopics) ? parsedAiSummary.weakTopics : [];
  const technicalRows = [
    ['Session ID', session.id],
    ['Organization ID', session.organizationId ?? 'None'],
    ['Canvas ID', session.canvasId],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button type="button" size="icon" variant="outline" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold text-ink-900">
                {session.title ?? session.canvas?.name ?? 'Live Session'}
              </h2>
              <Badge variant={statusVariant(session.status)}>
                {LIVE_SESSION_STATUS_LABEL[session.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {session.canvas?.name ?? 'Session board'} -{' '}
              {session.organization?.name ?? 'No organization'}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold text-ink-900">{session.organization?.name ?? 'No organization'}</p>
          <p className="text-xs text-ink-500">{session.canvas?.name ?? 'Live Session board'}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DetailStat icon={Users} label="Participants" value={session._count.participants} />
        <DetailStat icon={MessageSquareText} label="Messages" value={session._count.messages} />
        <DetailStat icon={FileText} label="Materials" value={studyMaterials.length} />
        <DetailStat icon={Radio} label="Events" value={session._count.events} />
        <DetailStat icon={CalendarClock} label="Duration" value={durationLabel(session)} />
      </div>

      {isTeacher && id && (
        <StudyMaterialUploader
          sessionId={id}
          onAddAssessment={() => navigate('/teacher/sessions/' + id + '/assessments/new')}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="px-5 py-5">
          <h3 className="text-base font-bold text-ink-900">Session overview</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-ink-400">Host</dt><dd className="mt-1 text-sm text-ink-800">{personLabel(session.host)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Created by</dt><dd className="mt-1 text-sm text-ink-800">{personLabel(session.createdBy)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Organization</dt><dd className="mt-1 text-sm text-ink-800">{session.organization?.name ?? 'None'}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Canvas</dt><dd className="mt-1 text-sm text-ink-800">{session.canvas?.name ?? 'Live Session'}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Created</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.createdAt)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Updated</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.updatedAt)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Started</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.startedAt)}</dd></div>
            <div><dt className="text-xs font-semibold text-ink-400">Ended</dt><dd className="mt-1 text-sm text-ink-800">{formatDateTime(session.endedAt)}</dd></div>
          </dl>
        </Card>

        <Card className="px-5 py-5">
          <h3 className="text-base font-bold text-ink-900">Join and access</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-variant px-4 py-3">
              <Link2 className="mt-0.5 h-4 w-4 text-brand-primary" />
              <div>
                <p className="text-xs font-semibold text-ink-400">Join code</p>
                <p className="mt-1 font-mono text-sm font-bold text-ink-900">{session.joinCode ?? 'Not generated'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-400">Join code expiry</p>
              <p className="mt-1 text-sm text-ink-800">{formatDateTime(session.joinCodeExpiresAt)}</p>
            </div>
            <details className="rounded-lg border border-line bg-white px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold text-ink-700">Technical identifiers</summary>
              <dl className="mt-3 space-y-2">
                {technicalRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-ink-400">{label}</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-ink-600">{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        </Card>
      </div>

      <BoardPreviewSection session={session} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden px-5 py-5">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-primary" />
              <h3 className="text-base font-bold text-ink-900">Study materials</h3>
            </div>
            {isTeacher && (
              <Button
                asChild
                variant="outline"
                size="sm"
              >
                <Link to={`/teacher/sessions/${id}/materials`}>
                  <Plus className="h-4 w-4" />
                  Add Study Material
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-3">
            {studyMaterials.map((asset) => (
              <MaterialCard key={asset.id} asset={asset} onPreview={setPreviewAsset} />
            ))}
            {studyMaterials.length === 0 && (
              <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-500">
                No study materials have been shared for this session yet.
              </p>
            )}
          </div>
        </Card>

        {/* Assessments Section */}
        <Card className="min-w-0 overflow-hidden px-5 py-5">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-brand-primary" />
              <h3 className="text-base font-bold text-ink-900">Assessments</h3>
            </div>
            {isTeacher && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/teacher/sessions/' + id + '/assessments/new')}
              >
                <Plus className="h-4 w-4" />
                Add Assessment
              </Button>
            )}
          </div>

          <div className="mt-4 grid gap-3" style={{ minWidth: 0 }}>
            {assessments.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-lg border border-line bg-white p-4"
              >
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-ink-900" style={{ wordBreak: 'break-word' }}>{item.title}</h4>
                    <Badge variant={item.type === 'MCQ' ? 'info' : 'default'} className="shrink-0 whitespace-nowrap">
                      {item.type === 'MCQ' ? 'Auto-Scored MCQ' : 'File Upload'}
                    </Badge>
                    <Badge variant="default" className="bg-brand-primary/10 text-brand-primary font-semibold shrink-0 whitespace-nowrap">
                      {item.submissionCount ?? 0} Submissions
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">{item.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-400">
                    {item.dueDate && <span>Due: {formatDateTime(item.dueDate)}</span>}
                    {item.maxScore && <span>Max Score: {item.maxScore} pts</span>}
                    {item.timeLimitMinutes && <span>Time Limit: {item.timeLimitMinutes} mins</span>}
                    {item.questions && <span>Questions: {item.questions.length}</span>}
                  </div>
                  {item.settings?.attachmentAsset && (
                    <div className="mt-2 overflow-hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-brand-primary hover:text-brand-primary/80 hover:bg-transparent justify-start"
                        style={{ maxWidth: '100%' }}
                        onClick={() => setPreviewAsset(item.settings!.attachmentAsset as LiveSessionMediaAsset)}
                      >
                        <FileText className="mr-2 h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium underline underline-offset-4" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {(item.settings!.attachmentAsset as LiveSessionMediaAsset).fileName || 'View Attachment'}
                        </span>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAssessmentForSubmissions(item)}
                  >
                    View Submissions
                  </Button>
                </div>
              </div>
            ))}

            {assessments.length === 0 && (
              <div className="rounded-lg border border-dashed border-line p-6 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-ink-300" />
                <p className="mt-2 text-sm font-semibold text-ink-800">No assessments attached</p>
                <p className="text-xs text-ink-500">
                  {isTeacher
                    ? 'Click "Add Assessment" to create a new assignment or quiz for students.'
                    : 'No assessments have been assigned for this session.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

        <Card className="min-w-0 overflow-hidden px-5 py-5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-brand-primary" />
            <h3 className="text-base font-bold text-ink-900">AI summary</h3>
          </div>
          <div className="mt-4 rounded-lg border border-line bg-surface-variant px-4 py-4">
            {finalSummary ? (
              <div className="space-y-6">
                <div>
                  <p className="whitespace-pre-wrap text-sm text-ink-800 leading-relaxed">{finalSummary}</p>
                </div>

                {finalKeyPoints.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-ink-900 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                      Key Points
                    </h4>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-700">
                      {finalKeyPoints.map((point: string, i: number) => <li key={i}>{point}</li>)}
                    </ul>
                  </div>
                )}

                {studentQuestions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-ink-900 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                      Student Questions
                    </h4>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-700">
                      {studentQuestions.map((point: string, i: number) => <li key={i}>{point}</li>)}
                    </ul>
                  </div>
                )}

                {participationInsights.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-ink-900 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                      Participation Insights
                    </h4>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-700">
                      {participationInsights.map((point: string, i: number) => <li key={i}>{point}</li>)}
                    </ul>
                  </div>
                )}

                {homework.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-ink-900 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                      Homework / Tasks
                    </h4>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-700">
                      {homework.map((point: string, i: number) => <li key={i}>{point}</li>)}
                    </ul>
                  </div>
                )}

                {weakTopics.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-ink-900 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
                      Weak Topics
                    </h4>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-700">
                      {weakTopics.map((point: string, i: number) => <li key={i}>{point}</li>)}
                    </ul>
                  </div>
                )}

                <div className="pt-3 border-t border-line/60">
                  <p className="text-xs font-medium text-ink-400">
                    Generated on {formatDateTime(aiSummaryEvent?.createdAt)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium text-ink-500">
                Summary is being prepared from the session events and messages.
              </p>
            )}
          </div>
        </Card>

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-base font-bold text-ink-900">Participants</h3>
          <p className="text-sm text-ink-500">Join history, role, and disconnect timing.</p>
        </div>
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <TableHead>Participant</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Left</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(session.participants ?? []).map((participant) => (
              <TableRow key={participant.id}>
                <TableCell>
                  <p className="font-semibold text-ink-900">{participant.user.name ?? participant.user.email}</p>
                  <p className="text-xs text-ink-500">{participant.user.email}</p>
                </TableCell>
                <TableCell><Badge variant="default">{participant.role}</Badge></TableCell>
                <TableCell>{formatDateTime(participant.joinedAt)}</TableCell>
                <TableCell>{formatDateTime(participant.leftAt)}</TableCell>
              </TableRow>
            ))}
            {(session.participants ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-ink-500">
                  No participant records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Messages</h3></div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
            {(session.messages ?? []).map((message) => (
              <div key={message.id} className="rounded-lg border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900">{message.sender?.name ?? message.sender?.email ?? message.guestParticipant?.displayName ?? 'System'}</p>
                  <Badge variant="default">{message.type}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">{message.body || message.attachmentName || 'No text body'}</p>
                <p className="mt-2 text-xs text-ink-400">{formatDateTime(message.createdAt)}</p>
              </div>
            ))}
            {(session.messages ?? []).length === 0 && <p className="text-sm text-ink-500">No messages recorded.</p>}
          </div>
        </Card>

        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><FileVideo className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Recordings</h3></div>
          <div className="mt-4 space-y-3">
            {(session.recordings ?? []).map((recording) => (
              <RecordingCard key={recording.id} recording={recording} />
            ))}
            {(session.recordings ?? []).length === 0 && <p className="text-sm text-ink-500">No recordings.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden px-5 py-5">
          <div className="flex items-center gap-2"><MonitorPlay className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Session media</h3></div>
          <div className="mt-4 space-y-3">
            {sessionMedia.map((asset) => (
              <MaterialCard key={asset.id} asset={asset} onPreview={setPreviewAsset} />
            ))}
            {sessionMedia.length === 0 && <p className="text-sm text-ink-500">No other media assets.</p>}
          </div>
        </Card>

        <Card className="px-5 py-5">
          <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-brand-primary" /><h3 className="text-base font-bold text-ink-900">Event timeline</h3></div>
          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
            {session.events.map((event: LiveSessionEvent) => (
              <div key={event.id} className="border-l-2 border-brand-primary/30 pl-3">
                <p className="text-sm font-semibold text-ink-900">{event.type.replaceAll('_', ' ')}</p>
                <p className="text-xs text-ink-500">{event.actor?.name ?? event.actor?.email ?? 'System'} - {formatDateTime(event.createdAt)}</p>
              </div>
            ))}
            {session.events.length === 0 && <p className="text-sm text-ink-500">No events recorded.</p>}
          </div>
        </Card>
      </div>

      <MaterialPreviewDialog asset={previewAsset} onClose={() => setPreviewAsset(null)} />

      <AssessmentSubmissionsModal
        open={Boolean(selectedAssessmentForSubmissions)}
        onOpenChange={(open) => !open && setSelectedAssessmentForSubmissions(null)}
        assessment={selectedAssessmentForSubmissions}
      />
    </div>
  );
}
