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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {priced.map((plan) => {
        const price = plan.prices[currency]!;
        return (
          <div
            key={plan.id}
            className={cn(
              'relative flex flex-col rounded-2xl border bg-white px-5 py-5 shadow-xs transition hover:shadow-card',
              plan.isPopular ? 'border-brand-primary ring-2 ring-brand-primary/15' : 'border-line',
            )}
          >
            {plan.isPopular ? (
              <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-brand-primary px-2.5 py-0.5 text-[11px] font-bold text-white">
                <Sparkles className="h-3 w-3" />
                Most popular
              </span>
            ) : null}
            <p className="text-lg font-black text-ink-900">{plan.name}</p>
            {plan.description ? <p className="mt-0.5 text-xs text-ink-500">{plan.description}</p> : null}
            <p className="mt-4 text-3xl font-black text-ink-900">{formatMinor(currency, price.amountMinor)}</p>
            <p className="text-xs text-ink-500">
              {currency === 'INR' && gstPercent ? `+ ${gstPercent}% GST · ${formatMinor(currency, price.totalMinor)} total` : 'No tax added'}
            </p>
            <div className="mt-4 rounded-xl bg-surface-variant px-3 py-3">
              <p className="text-2xl font-black text-brand-primary">{formatCredits(price.credits)}</p>
              <p className="text-xs font-semibold text-ink-600">Pro credits · valid {plan.validityMonths} months</p>
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
