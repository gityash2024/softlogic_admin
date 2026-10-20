import { Check, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCredits, formatMinor } from '@/features/ai/components/ai-format';
import { cn } from '@/lib/utils';
import type { AiPlan, BillingCurrency } from '@/types/ai';

export function PlanCards({
  plans,
  currency,
  gstPercent,
  onSelect,
}: {
  plans: AiPlan[];
  currency: BillingCurrency;
  gstPercent: number;
  onSelect: (plan: AiPlan) => void;
}) {
  const priced = plans.filter((plan) => plan.prices[currency]);
  if (!priced.length) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-500">
        No plans are available in {currency}. Try the other currency or custom credits.
      </p>
    );
  }
  return (
    <div className="ai-plan-grid" aria-label="Available Pro credit plans">
      {priced.map((plan) => {
        const price = plan.prices[currency]!;
        return (
          <div
            key={plan.id}
            data-popular={plan.isPopular}
            className={cn('ai-plan-card relative', plan.isPopular && 'border-brand-primary')}
          >
            {plan.isPopular ? (
              <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-brand-primary">
                <Sparkles className="h-3 w-3" />
                Most popular
              </span>
            ) : null}
            <h4 className="text-ink-900">{plan.name}</h4>
            <p className="ai-plan-description">{plan.description || 'Flexible Pro AI credits for your organization.'}</p>
            <p className="ai-plan-price text-ink-900">{formatMinor(currency, price.amountMinor)}</p>
            <p className="text-xs text-ink-500">
              {currency === 'INR' && gstPercent ? `+ ${gstPercent}% GST · ${formatMinor(currency, price.totalMinor)} total` : 'One-time credit purchase · no tax added'}
            </p>
            <div className="ai-plan-credits">
              <p className="text-xs font-medium text-ink-500">Pro AI credits included</p>
              <p className="my-1 break-words text-xl font-semibold text-brand-primary">{formatCredits(price.credits)}</p>
              <p className="text-xs text-ink-600">Valid for {plan.validityMonths} months</p>
            </div>
            {plan.features.length ? (
              <ul className="mt-4 space-y-1.5 text-sm text-ink-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-auto pt-5">
              <Button type="button" className="w-full" variant={plan.isPopular ? 'primary' : 'outline'} onClick={() => onSelect(plan)}>
                Choose {plan.name}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
