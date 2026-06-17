import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertCircle, Camera, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/services/auth.api';
import { extractApiError } from '@/lib/api';
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

interface ParsedQrLoginPayload {
  attemptId: string;
  secret: string;
  type: 'softlogic.qr_login';
  version: number;
}

type CameraDevice = Awaited<ReturnType<typeof Html5Qrcode.getCameras>>[number];
type CameraStartTarget = string | MediaTrackConstraints;

const rearCameraPattern = /(back|rear|environment|world)/i;

const scanConfig = {
  fps: 10,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const shortestSide = Math.min(viewfinderWidth, viewfinderHeight);
    const maxSize = Math.max(120, shortestSide - 24);
    const preferredSize = Math.floor(shortestSide * 0.72);
    const size = Math.min(maxSize, Math.max(160, preferredSize));

    return { width: size, height: size };
  },
};

function parseQrLoginPayload(value: string): ParsedQrLoginPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<ParsedQrLoginPayload>;
    if (
      payload.type !== 'softlogic.qr_login' ||
      payload.version !== 1 ||
      typeof payload.attemptId !== 'string' ||
      typeof payload.secret !== 'string'
    ) {
      return null;
    }
    return {
      attemptId: payload.attemptId,
      secret: payload.secret,
      type: payload.type,
      version: payload.version,
    };
  } catch {
    return null;
  }
}

function isRearCamera(camera: CameraDevice) {
  return rearCameraPattern.test(camera.label);
}

function cameraLabel(camera: CameraDevice, index: number) {
  return camera.label?.trim() || `Camera ${index + 1}`;
}

function cameraErrorMessage(error: unknown) {
  const message = extractApiError(error);
  if (/permission|notallowed|denied/i.test(message)) {
    return 'Camera permission was denied. Allow camera access and try again.';
  }
  if (/notfound|no camera|not found/i.test(message)) {
    return 'No camera was found on this device.';
  }
  if (/notreadable|in use|could not start/i.test(message)) {
    return 'Camera could not start. Close other camera apps and try again.';
  }
  return message;
}

function buildCameraTargets(cameras: CameraDevice[], selectedCameraId: string | null) {
  const targets: CameraStartTarget[] = [];
  const usedCameraIds = new Set<string>();
  const addTarget = (target: CameraStartTarget | null | undefined) => {
    if (!target) return;
    if (typeof target === 'string') {
      if (usedCameraIds.has(target)) return;
      usedCameraIds.add(target);
    }
    targets.push(target);
  };

  const selectedCamera = selectedCameraId
    ? cameras.find((camera) => camera.id === selectedCameraId)
    : null;
  const rearCamera = cameras.find(isRearCamera);

  addTarget(selectedCamera?.id);
  if (!selectedCamera) {
    addTarget({ facingMode: { exact: 'environment' } });
    addTarget({ facingMode: 'environment' });
  }
  addTarget(rearCamera?.id);
  cameras.forEach((camera) => addTarget(camera.id));

  return targets;
}

export function QrLoginScannerCard() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'approving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('Camera ready');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const readerId = useMemo(
    () => `qr-login-reader-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    const stopScanner = async () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch {
        // Best-effort camera cleanup.
      }
    };

    const startScanner = async () => {
      handledRef.current = false;
      setStatus('starting');
      setMessage('Starting camera...');
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        setCameras(cameras);
        if (!cameras.length) {
          setStatus('error');
          setMessage('No camera was found on this device.');
          return;
        }

        let lastError: unknown;
        const targets = buildCameraTargets(cameras, selectedCameraId);

        for (const target of targets) {
          if (cancelled) return;
          const scanner = new Html5Qrcode(readerId, false);
          try {
            await scanner.start(
              target,
              scanConfig,
              async (decodedText) => {
                if (handledRef.current) return;
                handledRef.current = true;
                const payload = parseQrLoginPayload(decodedText);
                if (!payload) {
                  handledRef.current = false;
                  setStatus('error');
                  setMessage('This is not a SoftLogic QR login code.');
                  return;
                }
                setStatus('approving');
                setMessage('Approving QR login...');
                try {
                  await scanner.stop();
                  const result = await authApi.qrApprove(payload.attemptId, payload.secret);
                  setStatus('success');
                  setMessage(result.message);
                  toast.success(`QR login approved for ${result.approvedFor.email}`);
                } catch (error) {
                  handledRef.current = false;
                  setStatus('error');
                  setMessage(extractApiError(error));
                }
              },
              () => undefined,
            );
            if (cancelled) {
              if (scanner.isScanning) await scanner.stop();
              await scanner.clear();
              return;
            }
            scannerRef.current = scanner;
            const trackSettings = scanner.getRunningTrackSettings();
            const runningCameraId =
              typeof trackSettings.deviceId === 'string'
                ? trackSettings.deviceId
                : typeof target === 'string'
                  ? target
                  : null;
            setActiveCameraId(runningCameraId);
            setStatus('scanning');
            setMessage('Scan a SoftLogic QR login code.');
            return;
          } catch (error) {
            lastError = error;
            try {
              if (scanner.isScanning) await scanner.stop();
              await scanner.clear();
            } catch {
              // Ignore failed fallback cleanup.
            }
          }
        }
        setStatus('error');
        setMessage(cameraErrorMessage(lastError));
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(cameraErrorMessage(error));
      }
    };

    void startScanner();
    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, readerId, selectedCameraId]);

  const busy = status === 'starting' || status === 'approving';
  const activeCameraIndex = cameras.findIndex((camera) => camera.id === activeCameraId);
  const activeCameraName =
    activeCameraIndex >= 0 ? cameraLabel(cameras[activeCameraIndex], activeCameraIndex) : '';
  const canSwitchCamera = cameras.length > 1 && status !== 'starting' && status !== 'approving';
  const switchCamera = () => {
    if (!cameras.length) return;
    const currentCameraId = activeCameraId ?? selectedCameraId;
    const currentIndex = cameras.findIndex((camera) => camera.id === currentCameraId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cameras.length : 0;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    setActiveCameraId(nextCamera.id);
    setStatus('starting');
    setMessage(`Switching to ${cameraLabel(nextCamera, nextIndex)}...`);
  };
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStatus('idle');
      setMessage('Camera ready');
      setCameras([]);
      setSelectedCameraId(null);
      setActiveCameraId(null);
    }
  };
  const icon =
    status === 'success' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : status === 'error' ? (
      <AlertCircle className="h-4 w-4 text-danger" />
    ) : (
      <Camera className="h-4 w-4 text-brand-primary" />
    );

  return (
    <>
      <Card>
        <div className="border-b border-line px-4 py-5 sm:px-6">
          <h2 className="text-lg font-semibold text-ink-900">QR login scanner</h2>
          <p className="text-sm text-ink-500">
            Approve a SoftLogic QR login code from another device.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <p className="min-w-0 break-words text-sm text-ink-600">
              The scanned device signs in as your current account.
            </p>
          </div>
          <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
            <Camera className="h-4 w-4" />
            Open scanner
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR login scanner</DialogTitle>
            <DialogDescription>
              Use this camera to approve a login QR shown on another SoftLogic device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-line bg-[#F7F9FC]">
              <div id={readerId} className="min-h-[260px] w-full overflow-hidden sm:min-h-[320px]" />
            </div>
            {cameras.length > 1 && (
              <div className="flex flex-col gap-2 rounded-lg border border-line bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 break-words text-xs text-ink-500">
                  {activeCameraName ? `Camera: ${activeCameraName}` : `${cameras.length} cameras available`}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!canSwitchCamera}
                  onClick={switchCamera}
                >
                  <RefreshCw className="h-4 w-4" />
                  Switch camera
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-variant px-3 py-2 text-sm text-ink-600">
              {busy ? <Spinner className="h-4 w-4 text-brand-primary" /> : icon}
              <span className="min-w-0 break-words">{message}</span>
            </div>
            {(status === 'error' || status === 'success') && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  window.setTimeout(() => setOpen(true), 50);
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Scan another code
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
