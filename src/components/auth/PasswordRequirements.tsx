import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  password: string;
}

const RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'At least 12 characters', test: (value) => value.length >= 12 },
  { label: 'Includes at least one letter', test: (value) => /[A-Za-z]/.test(value) },
  { label: 'Includes at least one number', test: (value) => /[0-9]/.test(value) },
];

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <ul className="space-y-1.5">
      {RULES.map((rule) => {
        const satisfied = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              satisfied ? 'text-success' : 'text-ink-500',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full',
                satisfied ? 'bg-success/10 text-success' : 'bg-surface-variant text-ink-400',
              )}
            >
              {satisfied ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
