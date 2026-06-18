import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectSearchContext = React.createContext<{ query: string } | null>(null);

function textFromChildren(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        return textFromChildren(child.props.children);
      }
      return '';
    })
    .join(' ');
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-11 w-full items-center justify-between rounded-lg border border-line bg-white px-3.5 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-ink-500" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    searchPlaceholder?: string;
  }
>(({ className, children, position = 'popper', searchPlaceholder = 'Search...', ...props }, ref) => {
  const [query, setQuery] = React.useState('');

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-line bg-white text-ink-900 shadow-elevated animate-fade-in',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        {...props}
      >
        <div className="border-b border-line p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') event.stopPropagation();
              }}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-line bg-white pl-8 pr-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
        </div>
        <SelectSearchContext.Provider value={{ query }}>
          <SelectPrimitive.Viewport
            className={cn(
              'max-h-72 overflow-y-auto p-1',
              position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]',
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
        </SelectSearchContext.Provider>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, value, ...props }, ref) => {
  const search = React.useContext(SelectSearchContext);
  const query = search?.query.trim().toLowerCase() ?? '';
  const searchableText = `${value ?? ''} ${textFromChildren(children)}`.toLowerCase();
  if (query && !searchableText.includes(query)) return null;

  return (
    <SelectPrimitive.Item
      ref={ref}
      value={value}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none focus:bg-surface-variant data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4 text-brand-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
};
