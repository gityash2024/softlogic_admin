import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { licensingApi } from '@/services/licensing.api';
import { extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ActivationKeyLabelDialogProps {
  keyId: string | null;
  currentLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ActivationKeyLabelDialog({
  keyId,
  currentLabel,
  open,
  onOpenChange,
  onSaved,
}: ActivationKeyLabelDialogProps) {
  const [label, setLabel] = useState(currentLabel);

  const mutation = useMutation({
    mutationFn: () => licensingApi.updateActivationKeyLabel(keyId!, label.trim()),
    onSuccess: () => {
      toast.success('Activation key label updated');
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(extractApiError(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!keyId || !label.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit activation key label</DialogTitle>
            <DialogDescription>
              Use a recognizable label for the board, user, or location receiving this key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Label
            </label>
            <Input
              autoFocus
              maxLength={120}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending || !label.trim()}
            >
              {mutation.isPending && <Spinner className="h-4 w-4" />}
              Save label
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
