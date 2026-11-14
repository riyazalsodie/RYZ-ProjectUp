import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-black shadow-[0_0_22px_-4px_rgba(0,255,136,0.55)] hover:bg-[#00e676] hover:shadow-[0_0_28px_-2px_rgba(0,255,136,0.65)]",
        secondary:
          "bg-white/[0.06] text-neutral-100 border border-white/10 hover:bg-white/[0.1] hover:border-white/20",
        outline:
          "border border-primary/25 bg-primary/[0.04] text-primary hover:bg-primary/10 hover:border-primary/45",
        ghost: "text-neutral-400 hover:text-white hover:bg-white/[0.06]",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 hover:text-red-300",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[11px] rounded-lg",
        lg: "h-11 px-5 text-sm rounded-xl",
        icon: "h-9 w-9 p-0 rounded-xl",
        "icon-sm": "h-8 w-8 p-0 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
