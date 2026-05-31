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
  geminiTextModel?: string;
  geminiImageModel?: string;
  geminiTtsModel?: string;
  // Legacy fields are read only for old saved organization settings.
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

const DEFAULT_TEXT_MODEL = 'gemini-3.5-flash';
const DEFAULT_IMAGE_MODEL = 'imagen-4.0-generate-001';
const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

// Only one model per type is enabled/supported; all others are surfaced for
// visibility but disabled with an "(Unsupported)" label and the supported one
// is auto-selected.
function isTextModelCapable(model: string) {
  return model === DEFAULT_TEXT_MODEL;
}

function isImageModelCapable(model: string) {
  return model === DEFAULT_IMAGE_MODEL;
}

function isTtsModelCapable(model: string) {
  return model === DEFAULT_TTS_MODEL;
}

// Coerce a persisted/legacy value to the single allowed model so the dropdown
// always auto-selects it, even for organizations saved with an older model.
function coerceCapable(
  value: string | undefined,
  legacy: string | undefined,
  isCapable: (m: string) => boolean,
  fallback: string,
) {
  const current = (value ?? '').trim() || (legacy ?? '').trim();
  return current && isCapable(current) ? current : fallback;
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
    geminiTextModel: coerceCapable(
      ai.geminiTextModel,
      ai.textModel,
      isTextModelCapable,
      DEFAULT_TEXT_MODEL,
    ),
    geminiImageModel: coerceCapable(
      ai.geminiImageModel,
      ai.imageModel,
      isImageModelCapable,
      DEFAULT_IMAGE_MODEL,
    ),
    geminiTtsModel: coerceCapable(
      ai.geminiTtsModel,
      ai.ttsModel,
      isTtsModelCapable,
      DEFAULT_TTS_MODEL,
    ),
    deepgramApiKey: ai.deepgramApiKey ?? '',
  };
}

function normalizeAiSettingsForSave(values: AiSettings): AiSettings {
  return {
    geminiApiKey: values.geminiApiKey?.trim() ?? '',
    geminiTextModel:
      values.geminiTextModel?.trim() || DEFAULT_TEXT_MODEL,
    geminiImageModel:
      values.geminiImageModel?.trim() || DEFAULT_IMAGE_MODEL,
    geminiTtsModel: values.geminiTtsModel?.trim() || DEFAULT_TTS_MODEL,
    deepgramApiKey: values.deepgramApiKey?.trim() ?? '',
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

  const textModel = watch('geminiTextModel');
  const imageModel = watch('geminiImageModel');
  const ttsModel = watch('geminiTtsModel');
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
          ai: normalizeAiSettingsForSave(values),
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
                onValueChange={(v) => setValue('geminiTextModel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {textOptions.map((m) => {
                    const capable = isTextModelCapable(m);
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
                Image model
              </label>
              <Select
                value={imageModel}
                onValueChange={(v) => setValue('geminiImageModel', v)}
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
                onValueChange={(v) => setValue('geminiTtsModel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ttsOptions.map((m) => {
                    const capable = isTtsModelCapable(m);
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
