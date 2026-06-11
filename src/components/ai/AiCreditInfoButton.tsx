import { useState } from 'react';
import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AiCreditInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full text-ink-500 hover:text-brand-primary"
        aria-label="AI credit calculation details"
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        <Info className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>SoftLogic AI credit calculation</DialogTitle>
            <DialogDescription>
              AI credits are internal prepaid units converted from estimated Google AI cost.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-ink-600">
            <p>
              <strong className="text-ink-900">1 AI credit = $0.000001 USD.</strong>
              {' '}A $0.01 request uses about 10,000 AI credits.
            </p>
            <p>
              Text requests charge input tokens, output tokens, and thinking tokens separately
              using the active model pricing. Thinking tokens are billed at the output rate.
            </p>
            <p>
              Image generation uses the configured per-image price. Google Search grounding,
              when enabled by Super Admin, adds the configured search charge per grounded request.
            </p>
            <p>
              Example: 1,000 input tokens at $0.30/1M and 800 output tokens at $2.50/1M
              costs about $0.0023, so it uses about 2,300 AI credits.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
