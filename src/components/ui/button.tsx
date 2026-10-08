import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

const buttonVariants = cva(
  "transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        plain: "",
        default:
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap border border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap border border-destructive bg-destructive text-primary-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap border border-transparent hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap text-primary underline-offset-4 hover:underline",
      },
      size: {
        content: "",
        default: "min-h-[34px] px-3 py-[7px]",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  type = "button",
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      type={asChild ? undefined : type}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
