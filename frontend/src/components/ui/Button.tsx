import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default:
          'text-white shadow-sm active:scale-[0.97]',
        outline:
          'border active:scale-[0.97]',
        ghost:
          'active:scale-[0.97]',
        destructive:
          'bg-red-600/90 text-white hover:bg-red-500 shadow-sm shadow-red-900/30 active:scale-[0.97]',
        secondary:
          'active:scale-[0.97]',
        link:
          'underline-offset-4 hover:underline text-blue-400 p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 px-3 text-xs',
        lg:      'h-11 px-6 text-[15px]',
        xl:      'h-12 px-8 text-[15px]',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    // Build inline styles per variant
    const variantStyles: React.CSSProperties =
      variant === 'default' || !variant
        ? {
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#ffffff',
            boxShadow: '0 0 0 0 rgba(59,130,246,0)',
            transition: 'all 150ms ease',
          }
        : variant === 'outline'
        ? {
            background: 'var(--surface-2, #1a2235)',
            borderColor: 'var(--clr-border-2, #243250)',
            color: 'var(--clr-text-2)',
            transition: 'all 150ms ease',
          }
        : variant === 'ghost'
        ? {
            background: 'transparent',
            color: 'var(--clr-text-2)',
            transition: 'all 150ms ease',
          }
        : variant === 'secondary'
        ? {
            background: 'var(--surface-2, #1a2235)',
            border: '1px solid var(--clr-border, #1e2d45)',
            color: 'var(--clr-text-2)',
            transition: 'all 150ms ease',
          }
        : {};

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={{ ...variantStyles, ...style }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          if (variant === 'default' || !variant) {
            el.style.background = 'linear-gradient(135deg, #60a5fa, #3b82f6)';
            el.style.boxShadow = '0 0 20px rgba(59,130,246,0.4)';
          } else if (variant === 'outline') {
            el.style.background = 'var(--surface-3, #1e2a40)';
            el.style.borderColor = '#3b82f6';
            el.style.color = 'var(--clr-text)';
          } else if (variant === 'ghost') {
            el.style.background = 'var(--surface-2, #1a2235)';
            el.style.color = 'var(--clr-text)';
          } else if (variant === 'secondary') {
            el.style.background = 'var(--surface-3, #1e2a40)';
            el.style.color = 'var(--clr-text)';
          }
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          Object.assign(el.style, variantStyles);
          props.onMouseLeave?.(e);
        }}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
