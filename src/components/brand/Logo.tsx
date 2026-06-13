import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';
import { runtimeBrandForOrganization } from '@/lib/branding';
import appIcon from '@/assets/brand/app-icon.png';
import logoLight from '@/assets/brand/softlogic-logo.png';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
  withWordmark?: boolean;
}

export function Logo({
  className,
  variant = 'dark',
  withWordmark = true,
}: LogoProps) {
  const user = useAuthStore((state) => state.user);
  const brand = runtimeBrandForOrganization(user?.primaryOrganization);

  if (brand.isWhiteLabel) {
    const mark = brand.logoUrl ? (
      <img
        src={brand.logoUrl}
        alt={brand.name}
        className="block h-9 w-9 rounded-xl object-contain"
      />
    ) : (
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black',
          variant === 'light' ? 'bg-white/15 text-white' : 'bg-brand-primary text-white',
        )}
      >
        {brand.name.slice(0, 1).toUpperCase()}
      </span>
    );

    return (
      <div className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
        {mark}
        {withWordmark && (
          <span
            className={cn(
              'truncate text-lg font-black tracking-normal',
              variant === 'light' ? 'text-white' : 'text-brand-navy',
            )}
          >
            {brand.name}
          </span>
        )}
      </div>
    );
  }

  if (!withWordmark) {
    return (
      <div className={cn('inline-flex items-center', className)}>
        <img
          src={appIcon}
          alt="SoftLogic app icon"
          className="block h-9 w-9 rounded-xl object-contain"
        />
      </div>
    );
  }

  if (variant === 'light') {
    return (
      <div className={cn('inline-flex items-center', className)}>
        <img
          src={logoLight}
          alt="SoftLogic"
          className="block h-9 w-auto max-w-[210px] object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={appIcon}
        alt="SoftLogic app icon"
        className="block h-9 w-9 rounded-xl object-contain"
      />
      <span className="text-lg font-black tracking-normal text-brand-navy">
        SoftLogic
      </span>
    </div>
  );
}

export function BlueprintBackdrop({ className }: { className?: string }) {
  return (
    <svg
      className={cn('absolute inset-0 h-full w-full opacity-[0.07]', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="blueprint"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke="white"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#blueprint)" />
      <circle cx="8%" cy="18%" r="90" fill="none" stroke="white" strokeWidth="1" />
      <circle cx="88%" cy="82%" r="130" fill="none" stroke="white" strokeWidth="1" />
      <path
        d="M70 76h180m-150 0v80m36-80v46m36-46v64m36-64v36"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </svg>
  );
}
