import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ConfirmationTone = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  loading?: boolean;
  onConfirm: () => void;
}

const toneMeta: Record<
  ConfirmationTone,
  {
    icon: typeof ShieldAlert;
    iconClassName: string;
    buttonVariant: 'destructive' | 'primary' | 'default';
  }
> = {
  danger: {
    icon: ShieldAlert,
    iconClassName: 'bg-danger/10 text-danger ring-danger/15',
    buttonVariant: 'destructive',
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'bg-warning/10 text-warning ring-warning/15',
    buttonVariant: 'primary',
  },
  info: {
    icon: Info,
    iconClassName: 'bg-info/10 text-info ring-info/15',
    buttonVariant: 'default',
  },
  success: {
    icon: CheckCircle2,
    iconClassName: 'bg-success/10 text-success ring-success/15',
    buttonVariant: 'primary',
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'warning',
  loading = false,
  onConfirm,
}: ConfirmationDialogProps) {
  const meta = toneMeta[tone];
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-md gap-5 p-5">
        <DialogHeader className="gap-3">
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl ring-8',
              meta.iconClassName,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="mt-1.5 leading-6">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={meta.buttonVariant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
