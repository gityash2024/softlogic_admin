import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';

import { supportApi } from '@/services/support.api';
import { extractApiError } from '@/lib/api';
import { type SupportCategory } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { SUPPORT_CATEGORY_PRESETS, findPreset } from './presets';

export function NewSupportThreadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SupportCategory>(SUPPORT_CATEGORY_PRESETS[0].category);
  const [subject, setSubject] = useState(SUPPORT_CATEGORY_PRESETS[0].subjectTemplate);
  const [body, setBody] = useState('');
  const [seatTarget, setSeatTarget] = useState<number>(0);

  const createMutation = useMutation({
    mutationFn: supportApi.create,
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ['support', 'threads'] });
      toast.success('Support request created');
      navigate(`/help/${thread.id}`);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const preset = findPreset(category);

  const handleCategoryChange = (next: SupportCategory) => {
    const preset = findPreset(next);
    setCategory(next);
    if (preset) setSubject(preset.subjectTemplate);
  };

  const handleSubmit = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please add a subject and body before submitting');
      return;
    }
    let requestedAction: { kind: string; params: Record<string, unknown> } | undefined;
    if (preset?.actionable) {
      if (preset.actionKind === 'seats_increase' && seatTarget > 0) {
        requestedAction = { kind: 'seats_increase', params: { to: seatTarget } };
      } else if (preset.actionKind === 'reset_device') {
        // Reset device requires the activation ID, which org admin doesn't know.
        // Super admin will pick it from the action panel on the thread.
        requestedAction = undefined;
      }
    }
    createMutation.mutate({
      category,
      subject: subject.trim(),
      body: body.trim(),
      priority: preset?.defaultPriority,
      requestedAction: requestedAction ?? null,
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/help')}>
            <ArrowLeft className="h-4 w-4" />
            Back to Help
          </Button>
          <h2 className="mt-2 text-2xl font-black text-ink-900">Start a new request</h2>
          <p className="text-sm text-ink-500">Pick a category, give us a short summary, and we’ll reply by email.</p>
        </div>
        <Button type="submit" variant="primary" disabled={createMutation.isPending}>
          {createMutation.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          Send to SoftLogic
        </Button>
      </div>

      <Card className="space-y-4 px-4 py-5 sm:px-6">
        <h3 className="text-base font-semibold text-ink-900">Category</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SUPPORT_CATEGORY_PRESETS.map((option) => {
            const active = category === option.category;
            return (
              <button
                type="button"
                key={option.category}
                onClick={() => handleCategoryChange(option.category)}
                className={`text-left rounded-xl border px-4 py-3 transition ${
                  active
                    ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                    : 'border-line bg-white hover:border-ink-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900">{option.label}</p>
                  {option.actionable && <Badge variant="info">Actionable</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-500">{option.helperText}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-5 px-4 py-5 sm:px-6">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Subject
          </label>
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Short summary"
            maxLength={180}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Description
          </label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add context — what you need, deadline, any error message…"
            rows={6}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-primary focus:outline-none"
          />
        </div>

        {preset?.actionable && preset.actionKind === 'seats_increase' && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              New teacher licence capacity you’d like (optional)
            </label>
            <Input
              type="number"
              min={1}
              value={seatTarget || ''}
              onChange={(event) => setSeatTarget(Number(event.target.value))}
              placeholder="e.g. 100"
            />
            <p className="text-xs text-ink-500">
              When the super admin opens this request they’ll see a one-click button to apply this
              teacher licence capacity change.
            </p>
          </div>
        )}
      </Card>
    </form>
  );
}
