import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { organizationsApi } from '@/services/organizations.api';
import { extractApiError } from '@/lib/api';
import type { AdminOrganization } from '@/types/api';

interface AiSettings {
  geminiApiKey?: string;
  textModel?: string;
  imageModel?: string;
  ttsModel?: string;
  deepgramApiKey?: string;
}

// Mirrors AdminOrganizationAiSettings.supportedGemini*Models in the Flutter app
// (see backup of lib/features/admin/data/admin_models.dart).
const TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
];
const IMAGE_MODELS = [
  'imagen-4.0-generate-001',
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
];
const TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.1-pro-tts-preview',
];

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL = 'imagen-4.0-generate-001';
const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

// Image: only the default model is supported on Google's free tier; others are
// surfaced for visibility but disabled with an "(Unsupported)" label, matching
// the Flutter dropdown behaviour.
function isImageModelCapable(model: string) {
  return model === DEFAULT_IMAGE_MODEL;
}

// Like Flutter's _modelOptions: if the persisted value isn't in the supported
// list, prepend it so the Select can still show the current selection.
function modelOptions(supported: string[], selected: string | undefined) {
  const trimmed = (selected ?? '').trim();
  if (!trimmed || supported.includes(trimmed)) return supported;
  return [trimmed, ...supported];
}

function readAiSettings(org: AdminOrganization | null | undefined): AiSettings {
  if (!org) return {};
  const settings = (org.settings ?? {}) as Record<string, unknown>;
  return (settings.ai as AiSettings) ?? {};
}

function withDefaults(ai: AiSettings): AiSettings {
  return {
    geminiApiKey: ai.geminiApiKey ?? '',
    textModel:
      ai.textModel && ai.textModel.trim().length > 0
        ? ai.textModel.trim()
        : DEFAULT_TEXT_MODEL,
    imageModel:
      ai.imageModel && ai.imageModel.trim().length > 0
        ? ai.imageModel.trim()
        : DEFAULT_IMAGE_MODEL,
    ttsModel:
      ai.ttsModel && ai.ttsModel.trim().length > 0
        ? ai.ttsModel.trim()
        : DEFAULT_TTS_MODEL,
    deepgramApiKey: ai.deepgramApiKey ?? '',
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: AdminOrganization | null;
}

export function AiSettingsDialog({ open, onOpenChange, organization }: Props) {
  const queryClient = useQueryClient();
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const { register, handleSubmit, reset, setValue, watch } = useForm<AiSettings>({
    defaultValues: withDefaults(readAiSettings(organization)),
  });

  useEffect(() => {
    if (open) reset(withDefaults(readAiSettings(organization)));
  }, [open, organization, reset]);

  const textModel = watch('textModel');
  const imageModel = watch('imageModel');
  const ttsModel = watch('ttsModel');
  const geminiApiKey = watch('geminiApiKey') ?? '';
  const deepgramApiKey = watch('deepgramApiKey') ?? '';

  const textOptions = useMemo(
    () => modelOptions(TEXT_MODELS, textModel),
    [textModel],
  );
  const imageOptions = useMemo(
    () => modelOptions(IMAGE_MODELS, imageModel),
    [imageModel],
  );
  const ttsOptions = useMemo(
    () => modelOptions(TTS_MODELS, ttsModel),
    [ttsModel],
  );

  const mutation = useMutation({
    mutationFn: async (values: AiSettings) => {
      if (!organization) return;
      return organizationsApi.update(organization.id, {
        settings: {
          ...(organization.settings as Record<string, unknown>),
          ai: values,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('AI settings saved');
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractApiError(err)),
  });

  const copyKey = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>AI configuration</DialogTitle>
          <DialogDescription>
            Per-organization keys and model selections for {organization.name}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Gemini API key
            </label>
            <div className="relative">
              <Input
                type={revealedKeys.gemini ? 'text' : 'password'}
                placeholder="AIzaSy..."
                className="pr-20"
                {...register('geminiApiKey')}
              />
              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setRevealedKeys((state) => ({
                      ...state,
                      gemini: !state.gemini,
                    }))
                  }
                  title={revealedKeys.gemini ? 'Hide Gemini key' : 'Show Gemini key'}
                >
                  {revealedKeys.gemini ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!geminiApiKey}
                  onClick={() => copyKey(geminiApiKey, 'Gemini API key')}
                  title="Copy Gemini key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Text model
              </label>
              <Select
                value={textModel}
                onValueChange={(v) => setValue('textModel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {textOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Image model
              </label>
              <Select
                value={imageModel}
                onValueChange={(v) => setValue('imageModel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {imageOptions.map((m) => {
                    const capable = isImageModelCapable(m);
                    return (
                      <SelectItem
                        key={m}
                        value={m}
                        disabled={!capable}
                        className={!capable ? 'text-ink-400' : undefined}
                      >
                        {capable ? m : `${m} (Unsupported)`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                TTS model
              </label>
              <Select
                value={ttsModel}
                onValueChange={(v) => setValue('ttsModel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ttsOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Deepgram API key
            </label>
            <div className="relative">
              <Input
                type={revealedKeys.deepgram ? 'text' : 'password'}
                placeholder="dg-..."
                className="pr-20"
                {...register('deepgramApiKey')}
              />
              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setRevealedKeys((state) => ({
                      ...state,
                      deepgram: !state.deepgram,
                    }))
                  }
                  title={
                    revealedKeys.deepgram
                      ? 'Hide Deepgram key'
                      : 'Show Deepgram key'
                  }
                >
                  {revealedKeys.deepgram ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!deepgramApiKey}
                  onClick={() => copyKey(deepgramApiKey, 'Deepgram API key')}
                  title="Copy Deepgram key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Spinner className="h-4 w-4" /> : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
