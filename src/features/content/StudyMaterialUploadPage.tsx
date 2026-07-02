import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosProgressEvent } from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  FileVideo,
  Files,
  Home,
  Image as ImageIcon,
  Loader2,
  MonitorPlay,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { api, apiObjectUrl, extractApiError } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { classroomApi } from '@/services/classroom.api';
import type { AdminLiveSessionRecord, ApiResponse } from '@/types/api';

type LiveSessionMediaAsset = NonNullable<AdminLiveSessionRecord['mediaAssets']>[number];
type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

type UploadEntry = {
  id: string;
  file: File;
  displayName: string;
  kind: LiveSessionMediaAsset['kind'];
  status: UploadStatus;
  progress: number;
  previewUrl: string;
  error: string | null;
  uploadedAsset: LiveSessionMediaAsset | null;
};

const acceptedStudyMaterialTypes = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.mp4',
  '.mov',
  '.webm',
  'image/*',
  'video/*',
  'application/pdf',
].join(',');

function createUploadId(file: File) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${file.name}-${file.size}-${file.lastModified}-${randomId}`;
}

function mediaKindForFile(file: File): LiveSessionMediaAsset['kind'] {
  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileSignature(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function fileExtension(name: string) {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() ?? '' : '';
}

function fileExtensionWithDot(name: string) {
  const extension = fileExtension(name);
  return extension ? `.${extension}` : '';
}

function normalizeDisplayFileName(value: string, originalName: string) {
  const fallbackName = originalName.trim() || 'study-material';
  const originalExtension = fileExtensionWithDot(fallbackName);
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/:"*?<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const candidate = cleaned || fallbackName;
  const withExtension =
    originalExtension && !fileExtensionWithDot(candidate)
      ? `${candidate}${originalExtension}`
      : candidate;
  return withExtension.slice(0, 180).trim() || fallbackName;
}

function isPdf(entry: UploadEntry) {
  return entry.file.type === 'application/pdf' || fileExtension(entry.file.name) === 'pdf';
}

function isOfficeDocument(entry: UploadEntry) {
  return ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(fileExtension(entry.file.name));
}

function isTextDocument(entry: UploadEntry) {
  return entry.file.type.startsWith('text/') || ['txt', 'csv'].includes(fileExtension(entry.file.name));
}

function officeViewerUrl(publicUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;
}

function uploadedAssetPreviewUrl(asset: LiveSessionMediaAsset | null | undefined) {
  return apiObjectUrl(asset?.storageKey, asset?.publicUrl);
}

function useBlobPreviewUrl(sourceUrl: string | null, enabled: boolean) {
  const [state, setState] = useState<{
    url: string | null;
    isLoading: boolean;
    error: string | null;
  }>({ url: null, isLoading: false, error: null });

  useEffect(() => {
    if (!sourceUrl || !enabled) {
      setState({ url: null, isLoading: false, error: null });
      return;
    }

    let isActive = true;
    let objectUrl: string | null = null;
    setState({ url: null, isLoading: true, error: null });

    api
      .get<Blob>(sourceUrl, { responseType: 'blob' })
      .then((response) => {
        if (!isActive) return;
        objectUrl = URL.createObjectURL(response.data);
        setState({ url: objectUrl, isLoading: false, error: null });
      })
      .catch((error) => {
        if (!isActive) return;
        setState({ url: null, isLoading: false, error: extractApiError(error) });
      });

    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, sourceUrl]);

  return state;
}

function statusBadge(status: UploadStatus) {
  if (status === 'success') return <Badge variant="success">Ready</Badge>;
  if (status === 'uploading') return <Badge variant="info">Uploading</Badge>;
  if (status === 'error') return <Badge variant="danger">Needs retry</Badge>;
  return <Badge variant="default">Queued</Badge>;
}

function FileKindIcon({
  kind,
  className,
}: {
  kind: LiveSessionMediaAsset['kind'];
  className?: string;
}) {
  const Icon = kind === 'IMAGE' ? ImageIcon : kind === 'VIDEO' ? FileVideo : FileText;
  return <Icon className={className} />;
}

async function uploadStudyMaterial({
  sessionId,
  entry,
  onProgress,
}: {
  sessionId: string;
  entry: UploadEntry;
  onProgress: (progress: number) => void;
}) {
  const displayFileName = normalizeDisplayFileName(entry.displayName, entry.file.name);
  const formData = new FormData();
  formData.append('file', entry.file);
  formData.append('kind', entry.kind);
  formData.append('displayFileName', displayFileName);
  formData.append(
    'metadata',
    JSON.stringify({
      category: 'STUDY_MATERIAL',
      source: 'TEACHER_PORTAL',
      originalFileName: entry.file.name,
      displayFileName,
      uploadedFrom: 'STUDY_MATERIAL_PAGE',
    }),
  );

  const response = await api.post<ApiResponse<LiveSessionMediaAsset>>(
    `/live-sessions/${sessionId}/media`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!event.total) {
          onProgress(18);
          return;
        }
        onProgress(Math.max(8, Math.min(96, Math.round((event.loaded / event.total) * 96))));
      },
    },
  );
  return response.data.data;
}

function MaterialPreview({
  entry,
  canUpload,
  isUploading,
  onUploadQueue,
}: {
  entry: UploadEntry | null;
  canUpload: boolean;
  isUploading: boolean;
  onUploadQueue: () => void;
}) {
  const uploadedUrl = entry ? uploadedAssetPreviewUrl(entry.uploadedAsset) : null;
  const shouldUseBlobPreview = Boolean(
    entry && uploadedUrl && (isPdf(entry) || isTextDocument(entry)),
  );
  const blobPreview = useBlobPreviewUrl(uploadedUrl, shouldUseBlobPreview);

  if (!entry) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-variant/50 px-5 text-center">
        <MonitorPlay className="h-10 w-10 text-ink-300" />
        <p className="mt-3 text-sm font-semibold text-ink-800">Preview appears here</p>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          Select a material from the queue to preview it in this workspace.
        </p>
      </div>
    );
  }

  const previewUrl = blobPreview.url ?? uploadedUrl ?? entry.previewUrl;

  if (entry.kind === 'IMAGE') {
    return (
      <img
        src={previewUrl}
        alt={entry.displayName}
        className="h-[clamp(380px,52vh,640px)] w-full rounded-2xl border border-line bg-surface-variant object-contain"
      />
    );
  }

  if (entry.kind === 'VIDEO') {
    return (
      <video
        src={previewUrl}
        className="h-[clamp(380px,52vh,640px)] w-full rounded-2xl border border-line bg-ink-900"
        controls
      />
    );
  }

  if (isPdf(entry) || isTextDocument(entry)) {
    if (blobPreview.isLoading) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-line bg-surface-variant px-5 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          <p className="mt-3 text-sm font-semibold text-ink-800">Loading secure preview</p>
        </div>
      );
    }

    if (blobPreview.error && uploadedUrl) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-line bg-surface-variant px-5 text-center">
          <AlertCircle className="h-9 w-9 text-danger" />
          <p className="mt-3 text-sm font-semibold text-ink-800">Preview could not load</p>
          <p className="mt-1 max-w-md text-sm text-ink-500">{blobPreview.error}</p>
        </div>
      );
    }

    return (
      <iframe
        title={entry.displayName}
        src={previewUrl}
        className="h-[clamp(380px,52vh,640px)] w-full rounded-2xl border border-line bg-white"
      />
    );
  }

  if (isOfficeDocument(entry) && uploadedUrl) {
    return (
      <iframe
        title={entry.displayName}
        src={officeViewerUrl(uploadedUrl)}
        className="h-[clamp(380px,52vh,640px)] w-full rounded-2xl border border-line bg-white"
        allowFullScreen
      />
    );
  }

  const isOfficeQueuedForPreview = isOfficeDocument(entry);

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-line bg-surface-variant px-5 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-brand-primary shadow-sm">
        <FileKindIcon kind={entry.kind} className="h-10 w-10" />
      </div>
      <p className="mt-4 max-w-md break-words text-base font-bold text-ink-900">{entry.displayName}</p>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        {isOfficeQueuedForPreview
          ? 'PowerPoint, Word, and Excel previews open here after upload from the secure shared file link.'
          : 'This file type can be reviewed from the shared material after upload.'}
      </p>
      {isOfficeQueuedForPreview && (
        <Button
          type="button"
          className="mt-5"
          disabled={!canUpload || isUploading}
          onClick={onUploadQueue}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" />
              Upload to preview
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function MaterialUploadWorkspace({
  session,
  onUploaded,
  onDone,
}: {
  session: AdminLiveSessionRecord;
  onUploaded: () => void;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
  const totals = useMemo(() => {
    const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
    const completed = entries.filter((entry) => entry.status === 'success').length;
    const failed = entries.filter((entry) => entry.status === 'error').length;
    const uploadable = entries.filter((entry) => entry.status === 'queued' || entry.status === 'error').length;
    return { totalBytes, completed, failed, uploadable };
  }, [entries]);
  const allUploadsDone = entries.length > 0 && totals.completed === entries.length && totals.failed === 0;

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  function revokePreview(entry: UploadEntry) {
    URL.revokeObjectURL(entry.previewUrl);
    previewUrlsRef.current.delete(entry.previewUrl);
  }

  function makeEntry(file: File): UploadEntry {
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    return {
      id: createUploadId(file),
      file,
      displayName: file.name,
      kind: mediaKindForFile(file),
      status: 'queued',
      progress: 0,
      previewUrl,
      error: null,
      uploadedAsset: null,
    };
  }

  function updateEntryDisplayName(entryId: string, value: string) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId && entry.status !== 'uploading' && entry.status !== 'success'
          ? { ...entry, displayName: value.slice(0, 180) }
          : entry,
      ),
    );
  }

  function commitEntryDisplayName(entryId: string) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId && entry.status !== 'uploading' && entry.status !== 'success'
          ? {
              ...entry,
              displayName: normalizeDisplayFileName(entry.displayName, entry.file.name),
            }
          : entry,
      ),
    );
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).filter((file) => file.size > 0);
    if (incoming.length === 0) return;

    setEntries((current) => {
      const seen = new Set(current.map((entry) => fileSignature(entry.file)));
      const nextEntries: UploadEntry[] = [];
      let duplicateCount = 0;
      for (const file of incoming) {
        const signature = fileSignature(file);
        if (seen.has(signature)) {
          duplicateCount += 1;
          continue;
        }
        seen.add(signature);
        nextEntries.push(makeEntry(file));
      }
      if (duplicateCount > 0) {
        toast.info(`${duplicateCount} duplicate file${duplicateCount === 1 ? '' : 's'} skipped`);
      }
      if (nextEntries.length > 0 && !selectedId) {
        setSelectedId(nextEntries[0].id);
      }
      return [...current, ...nextEntries];
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) addFiles(event.currentTarget.files);
    event.currentTarget.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    addFiles(event.dataTransfer.files);
  }

  function removeEntry(entryId: string) {
    setEntries((current) => {
      const entry = current.find((item) => item.id === entryId);
      if (entry?.status === 'uploading') return current;
      if (entry) revokePreview(entry);
      const next = current.filter((item) => item.id !== entryId);
      if (selectedId === entryId) {
        setSelectedId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function clearCompleted() {
    setEntries((current) => {
      const completed = current.filter((entry) => entry.status === 'success');
      completed.forEach(revokePreview);
      const next = current.filter((entry) => entry.status !== 'success');
      if (selectedId && !next.some((entry) => entry.id === selectedId)) {
        setSelectedId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function clearAll() {
    if (isUploading) return;
    entries.forEach(revokePreview);
    setEntries([]);
    setSelectedId(null);
  }

  async function uploadQueue() {
    const queue = entries.filter((entry) => entry.status === 'queued' || entry.status === 'error');
    if (queue.length === 0 || isUploading) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const queuedEntry of queue) {
      setSelectedId(queuedEntry.id);
      setEntries((current) =>
        current.map((entry) =>
          entry.id === queuedEntry.id
            ? { ...entry, status: 'uploading', progress: Math.max(entry.progress, 8), error: null }
            : entry,
        ),
      );

      try {
        const uploadedAsset = await uploadStudyMaterial({
          sessionId: session.id,
          entry: queuedEntry,
          onProgress: (progress) => {
            setEntries((current) =>
              current.map((entry) =>
                entry.id === queuedEntry.id ? { ...entry, progress } : entry,
              ),
            );
          },
        });
        successCount += 1;
        setEntries((current) =>
          current.map((entry) =>
            entry.id === queuedEntry.id
              ? {
                  ...entry,
                  displayName: uploadedAsset.fileName,
                  status: 'success',
                  progress: 100,
                  uploadedAsset,
                }
              : entry,
          ),
        );
      } catch (error) {
        errorCount += 1;
        setEntries((current) =>
          current.map((entry) =>
            entry.id === queuedEntry.id
              ? { ...entry, status: 'error', progress: 0, error: extractApiError(error) }
              : entry,
          ),
        );
      }
    }

    setIsUploading(false);
    if (successCount > 0) {
      toast.success(
        `${successCount} study material${successCount === 1 ? '' : 's'} uploaded`,
      );
      onUploaded();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} upload${errorCount === 1 ? '' : 's'} need attention`);
    }
  }

  return (
    <Card className="grid min-w-0 overflow-hidden p-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
      <section className="min-w-0 border-b border-line bg-surface-variant/30 lg:border-b-0 lg:border-r">
        <div className="grid shrink-0 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div
            className={cn(
              'flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-white px-5 py-7 text-center transition',
              isDragging
                ? 'border-brand-primary bg-brand-primary/5 ring-4 ring-brand-primary/10'
                : 'border-line hover:border-brand-primary/50 hover:bg-brand-primary/[0.025]',
              isUploading && 'cursor-not-allowed opacity-70',
            )}
            onClick={() => {
              if (!isUploading) inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isUploading) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              multiple
              accept={acceptedStudyMaterialTypes}
              disabled={isUploading}
              onChange={handleInputChange}
            />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-card">
              <UploadCloud className="h-7 w-7" />
            </div>
            <p className="mt-4 text-base font-bold text-ink-900">
              Drop files here or choose from device
            </p>
            <p className="mt-2 max-w-md text-sm text-ink-500">
              Multi-select documents, slides, spreadsheets, images, videos, and PDFs.
            </p>
            <Button type="button" variant="outline" className="mt-4">
              Select materials
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-xl border border-line bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase text-ink-400">Selected</p>
              <p className="mt-1 text-lg font-bold text-ink-900">{entries.length}</p>
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase text-ink-400">Total size</p>
              <p className="mt-1 text-lg font-bold text-ink-900">{formatBytes(totals.totalBytes)}</p>
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-3">
              <p className="text-xs font-semibold uppercase text-ink-400">Uploaded</p>
              <p className="mt-1 text-lg font-bold text-ink-900">
                {totals.completed}/{entries.length}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-ink-900">Upload queue</h3>
              <p className="text-xs text-ink-500">
                Rename files before upload, then select any item to preview it on the right.
              </p>
            </div>
            {entries.length > 0 && (
              <Button type="button" variant="ghost" size="sm" disabled={isUploading} onClick={clearAll}>
                Clear all
              </Button>
            )}
          </div>

          <div className="px-4 pb-4">
            {entries.length === 0 ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white px-4 text-center">
                <Files className="h-8 w-8 text-ink-300" />
                <p className="mt-3 text-sm font-semibold text-ink-800">No materials selected</p>
                <p className="mt-1 text-sm text-ink-500">Select files to build the upload queue.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'w-full rounded-xl border bg-white px-3 py-3 text-left transition hover:border-brand-primary/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20',
                      selectedEntry?.id === entry.id
                        ? 'border-brand-primary shadow-sm ring-2 ring-brand-primary/10'
                        : 'border-line',
                    )}
                    onClick={() => setSelectedId(entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(entry.id);
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                        <FileKindIcon kind={entry.kind} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <label className="min-w-[180px] flex-1">
                            <span className="sr-only">Display filename</span>
                            <input
                              value={entry.displayName}
                              disabled={entry.status === 'uploading' || entry.status === 'success'}
                              className={cn(
                                'h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-ink-900 outline-none transition focus:border-brand-primary/40 focus:bg-white focus:ring-2 focus:ring-brand-primary/10',
                                (entry.status === 'uploading' || entry.status === 'success') &&
                                  'cursor-default opacity-100',
                              )}
                              onChange={(event) => updateEntryDisplayName(entry.id, event.target.value)}
                              onBlur={() => commitEntryDisplayName(entry.id)}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                          </label>
                          {statusBadge(entry.status)}
                        </div>
                        <p className="mt-1 truncate text-xs text-ink-500">
                          Original: {entry.file.name} - {entry.file.type || entry.kind} -{' '}
                          {formatBytes(entry.file.size)}
                        </p>
                        {(entry.status === 'uploading' || entry.status === 'success') && (
                          <Progress className="mt-2 h-1.5" value={entry.progress} />
                        )}
                        {entry.error && (
                          <p className="mt-2 line-clamp-2 text-xs text-danger">{entry.error}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${entry.displayName}`}
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-surface-variant hover:text-danger',
                          entry.status === 'uploading' && 'pointer-events-none opacity-40',
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeEntry(entry.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="flex min-w-0 flex-col bg-white">
        <div className="shrink-0 border-b border-line px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Material preview</p>
          <div className="mt-1 flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 break-words text-base font-bold text-ink-900">
                {selectedEntry?.displayName ?? 'Select a material'}
              </h3>
              <p className="mt-1 truncate text-xs text-ink-500">
                {selectedEntry
                  ? `Original: ${selectedEntry.file.name} - ${selectedEntry.file.type || selectedEntry.kind} - ${formatBytes(selectedEntry.file.size)}`
                  : `${session.canvas?.name ?? 'Live Session'} - ${formatDateTime(session.createdAt)}`}
              </p>
            </div>
            {selectedEntry && <div className="shrink-0">{statusBadge(selectedEntry.status)}</div>}
          </div>
        </div>

        <div className="p-5">
          <MaterialPreview
            entry={selectedEntry}
            canUpload={totals.uploadable > 0}
            isUploading={isUploading}
            onUploadQueue={uploadQueue}
          />
        </div>

        <div className="shrink-0 border-t border-line bg-white px-5 py-4">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid min-w-0 grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:flex xl:flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Status</p>
                <p className="mt-1 font-semibold text-ink-800">
                  {selectedEntry ? selectedEntry.status : 'Waiting'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Access</p>
                <p className="mt-1 font-semibold text-ink-800">Students and parents</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Queued</p>
                <p className="mt-1 font-semibold text-ink-800">{entries.length}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Ready</p>
                <p className="mt-1 font-semibold text-ink-800">{totals.completed}</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap justify-end gap-2">
              {totals.completed > 0 && (
                <Button type="button" variant="ghost" disabled={isUploading} onClick={clearCompleted}>
                  <CheckCircle2 className="h-4 w-4" />
                  Clear uploaded
                </Button>
              )}
              {allUploadsDone && (
                <Button type="button" className="shrink-0" onClick={onDone}>
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </Button>
              )}
              {!allUploadsDone && (
                <Button
                  type="button"
                  className="shrink-0"
                  disabled={totals.uploadable === 0 || isUploading}
                  onClick={uploadQueue}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : totals.failed > 0 ? (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Retry failed
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      Upload {totals.uploadable || entries.length} material
                      {(totals.uploadable || entries.length) === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          {selectedEntry?.status === 'error' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{selectedEntry.error ?? 'Please retry this file.'}</p>
            </div>
          )}
        </div>
      </aside>
    </Card>
  );
}

export function StudyMaterialUploadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['live-session-material-upload', id],
    queryFn: () => {
      if (!id) throw new Error('Live session id is required');
      return classroomApi.liveSessionDetail(id);
    },
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <Spinner className="h-7 w-7 text-brand-primary" />
      </div>
    );
  }

  if (!query.data || query.isError) {
    return (
      <Card className="space-y-3 px-5 py-6">
        <p className="font-semibold text-ink-900">Study material upload is unavailable.</p>
        <p className="text-sm text-ink-500">
          {query.error ? extractApiError(query.error) : 'The session may be outside your teacher scope.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/teacher/sessions')}>
          <ArrowLeft className="h-4 w-4" />
          Back to sessions
        </Button>
      </Card>
    );
  }

  const session = query.data;
  const sharedMaterials = session.studyMaterials?.length ?? 0;

  return (
    <div className="space-y-4 pb-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
        <Link to="/teacher/dashboard" className="inline-flex items-center gap-1 hover:text-brand-primary">
          <Home className="h-4 w-4" />
          Teacher
        </Link>
        <ChevronRight className="h-4 w-4 text-ink-300" />
        <Link to="/teacher/sessions" className="hover:text-brand-primary">
          Sessions
        </Link>
        <ChevronRight className="h-4 w-4 text-ink-300" />
        <Link to={`/teacher/sessions/${session.id}`} className="max-w-[220px] truncate hover:text-brand-primary">
          {session.title ?? session.canvas?.name ?? 'Live Session'}
        </Link>
        <ChevronRight className="h-4 w-4 text-ink-300" />
        <span className="font-semibold text-ink-800">Study materials</span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => navigate(`/teacher/sessions/${session.id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-ink-900">Upload study materials</h2>
              <p className="truncate text-sm text-ink-500">
                {session.canvas?.name ?? 'Live Session'} - {session.organization?.name ?? 'No organization'}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase text-ink-400">Already shared</p>
            <p className="text-sm font-bold text-ink-900">{sharedMaterials}</p>
          </div>
          <div className="rounded-lg border border-line bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase text-ink-400">Session</p>
            <p className="text-sm font-bold text-ink-900">{session.status}</p>
          </div>
          <div className="rounded-lg border border-line bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase text-ink-400">Join code</p>
            <p className="font-mono text-sm font-bold text-ink-900">{session.joinCode ?? 'None'}</p>
          </div>
        </div>
      </div>

      <MaterialUploadWorkspace
        session={session}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ['live-session-material-upload', id] });
          queryClient.invalidateQueries({ queryKey: ['live-session-detail', id, 'TEACHER'] });
          queryClient.invalidateQueries({ queryKey: ['classroom', 'me'] });
        }}
        onDone={() => navigate(`/teacher/sessions/${session.id}`)}
      />
    </div>
  );
}
