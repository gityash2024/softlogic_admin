import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, CheckCircle2, Clock, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { authApi, type QrLoginStartResponse } from '@/services/auth.api';
import type { AuthResponse } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { extractApiError } from '@/lib/api';

type QrState = 'loading' | 'ready' | 'completed' | 'error' | 'expired';

export function QrLoginPanel({
  onCompleted,
}: {
  onCompleted: (session: AuthResponse) => void;
}) {
  const [attempt, setAttempt] = useState<QrLoginStartResponse | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [message, setMessage] = useState('Preparing secure QR login...');
  const [state, setState] = useState<QrState>('loading');
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    clearPoll();
    completedRef.current = false;
    setState('loading');
    setAttempt(null);
    setQrImage(null);
    setMessage('Preparing secure QR login...');
    try {
      const nextAttempt = await authApi.qrStart();
      const image = await QRCode.toDataURL(nextAttempt.qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
      });
      setAttempt(nextAttempt);
      setQrImage(image);
      setState('ready');
      setMessage('Scan from Settings on a signed-in SoftLogic web panel.');
    } catch (error) {
      setState('error');
      setMessage(extractApiError(error));
    }
  }, [clearPoll]);

  useEffect(() => {
    void start();
    return clearPoll;
  }, [clearPoll, start]);

  useEffect(() => {
    if (!attempt || state !== 'ready') return undefined;

    const poll = async () => {
      if (completedRef.current) return;
      if (new Date(attempt.expiresAt).getTime() <= Date.now()) {
        setState('expired');
        setMessage('QR login expired. Generate a new code.');
        return;
      }

      try {
        const status = await authApi.qrStatus(attempt.attemptId, attempt.secret);
        if (status.status === 'completed' && status.session) {
          completedRef.current = true;
          setState('completed');
          setMessage('QR login approved. Opening workspace...');
          onCompleted(status.session);
          return;
        }
        if (status.status === 'failed' || status.status === 'expired') {
          setState(status.status === 'expired' ? 'expired' : 'error');
          setMessage(status.message ?? 'QR login could not be completed.');
          return;
        }
        timeoutRef.current = window.setTimeout(poll, attempt.pollIntervalMs);
      } catch (error) {
        timeoutRef.current = window.setTimeout(poll, attempt.pollIntervalMs);
      }
    };

    timeoutRef.current = window.setTimeout(poll, attempt.pollIntervalMs);
    return clearPoll;
  }, [attempt, clearPoll, onCompleted, state]);

  const isBusy = state === 'loading';
  const statusIcon =
    state === 'completed' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : state === 'error' || state === 'expired' ? (
      <AlertCircle className="h-4 w-4 text-danger" />
    ) : (
      <Clock className="h-4 w-4 text-brand-primary" />
    );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-[#F7F9FC] px-4 py-5 text-center">
        <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-lg border border-line bg-white p-3 shadow-sm">
          {isBusy ? (
            <Spinner className="h-7 w-7 text-brand-primary" />
          ) : qrImage ? (
            <img src={qrImage} alt="SoftLogic QR login code" className="h-full w-full" />
          ) : (
            <QrCode className="h-20 w-20 text-ink-300" />
          )}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-600">
          {statusIcon}
          <span>{message}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isBusy}
        onClick={() => {
          toast.dismiss();
          void start();
        }}
      >
        {isBusy ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
        Generate new QR
      </Button>
    </div>
  );
}
