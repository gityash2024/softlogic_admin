import { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, apiObjectUrl, extractApiError } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { AdminLiveSessionRecord } from '@/types/api';

export type LiveSessionMediaAsset = NonNullable<AdminLiveSessionRecord['mediaAssets']>[number];

export function isStudyMaterial(asset: LiveSessionMediaAsset) {
  return asset.metadata?.category === 'STUDY_MATERIAL';
}

export function assetExtension(asset: LiveSessionMediaAsset) {
  const parts = asset.fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() ?? '' : '';
}

export function isPdfAsset(asset: LiveSessionMediaAsset) {
  return asset.mimeType === 'application/pdf' || assetExtension(asset) === 'pdf';
}

export function isTextAsset(asset: LiveSessionMediaAsset) {
  return asset.mimeType.startsWith('text/') || ['txt', 'csv'].includes(assetExtension(asset));
}

export function isOfficeAsset(asset: LiveSessionMediaAsset) {
  return ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(assetExtension(asset));
}

export function officeViewerUrl(publicUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;
}

export function mediaAssetUrl(asset: LiveSessionMediaAsset | null | undefined) {
  return apiObjectUrl(asset?.storageKey, asset?.publicUrl);
}

export function useBlobPreviewUrl(sourceUrl: string | null, enabled: boolean) {
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

export async function downloadMediaAsset(asset: LiveSessionMediaAsset) {
  const assetUrl = mediaAssetUrl(asset);
  if (!assetUrl) {
    toast.error('Download link is unavailable for this material');
    return;
  }

  try {
    const response = await api.get<Blob>(assetUrl, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = asset.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    toast.error(extractApiError(error));
  }
}

export function MaterialPreviewDialog({
  asset,
  onClose,
}: {
  asset: LiveSessionMediaAsset | null;
  onClose: () => void;
}) {
  const assetUrl = mediaAssetUrl(asset);
  const shouldUseBlobPreview = Boolean(asset && assetUrl && (isPdfAsset(asset) || isTextAsset(asset)));
  const blobPreview = useBlobPreviewUrl(assetUrl, shouldUseBlobPreview);
  const previewUrl = blobPreview.url ?? assetUrl;
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!asset) return;
    setIsDownloading(true);
    await downloadMediaAsset(asset);
    setIsDownloading(false);
  }

  function renderPreview() {
    if (!asset) return null;

    if (!previewUrl && !blobPreview.isLoading) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-variant px-5 text-center">
          <FileText className="h-10 w-10 text-ink-300" />
          <p className="mt-3 text-sm font-semibold text-ink-800">Preview link unavailable</p>
        </div>
      );
    }

    if (blobPreview.isLoading) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-line bg-surface-variant px-5 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          <p className="mt-3 text-sm font-semibold text-ink-800">Loading secure preview</p>
        </div>
      );
    }

    if (blobPreview.error) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-line bg-surface-variant px-5 text-center">
          <FileText className="h-10 w-10 text-danger" />
          <p className="mt-3 text-sm font-semibold text-ink-800">Preview could not load</p>
          <p className="mt-1 max-w-md text-sm text-ink-500">{blobPreview.error}</p>
        </div>
      );
    }

    if (asset.kind === 'IMAGE') {
      return (
        <img
          src={previewUrl ?? undefined}
          alt={asset.fileName}
          className="h-[min(62dvh,680px)] w-full rounded-lg border border-line bg-surface-variant object-contain"
        />
      );
    }

    if (asset.kind === 'VIDEO') {
      return (
        <video
          src={previewUrl ?? undefined}
          className="h-[min(62dvh,680px)] w-full rounded-lg border border-line bg-ink-900"
          controls
        />
      );
    }

    if (isPdfAsset(asset) || isTextAsset(asset)) {
      return (
        <iframe
          title={asset.fileName}
          src={previewUrl ?? undefined}
          className="h-[min(62dvh,680px)] w-full rounded-lg border border-line bg-white"
        />
      );
    }

    if (isOfficeAsset(asset) && assetUrl) {
      return (
        <div className="space-y-3">
          <iframe
            title={asset.fileName}
            src={officeViewerUrl(assetUrl)}
            className="h-[min(62dvh,680px)] w-full rounded-lg border border-line bg-white"
            allowFullScreen
          />
          <p className="text-xs text-ink-500">
            Office previews are rendered by Microsoft Office viewer. Use Download if the preview
            takes longer than expected.
          </p>
        </div>
      );
    }

    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-line bg-surface-variant px-5 text-center">
        <FileText className="h-10 w-10 text-brand-primary" />
        <p className="mt-3 max-w-md break-words text-sm font-semibold text-ink-800">
          {asset.fileName}
        </p>
        <p className="mt-1 text-sm text-ink-500">Download this material to open it on your device.</p>
      </div>
    );
  }

  return (
    <Dialog open={Boolean(asset)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(1180px,calc(100vw-2rem))] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-line px-5 py-4 pr-12">
          <DialogTitle className="break-words pr-2">{asset?.fileName ?? 'Study material'}</DialogTitle>
          <DialogDescription>
            {asset
              ? `${asset.kind} - ${asset.mimeType} - ${formatBytes(asset.sizeBytes)}`
              : 'Preview shared study material'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0 p-5">{renderPreview()}</div>
          <aside className="border-t border-line bg-surface-variant/40 p-5 lg:border-l lg:border-t-0">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Shared</p>
                <p className="mt-1 font-semibold text-ink-800">
                  {asset ? formatDateTime(asset.createdAt) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Access</p>
                <p className="mt-1 font-semibold text-ink-800">Students and parents</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">File type</p>
                <p className="mt-1 break-words font-semibold text-ink-800">{asset?.mimeType ?? '-'}</p>
              </div>
            </div>
            <Button type="button" className="mt-6 w-full" disabled={!asset || isDownloading} onClick={handleDownload}>
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download material
            </Button>
            {assetUrl && (
              <Button type="button" variant="outline" className="mt-3 w-full" asChild>
                <a href={assetUrl} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
              </Button>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
