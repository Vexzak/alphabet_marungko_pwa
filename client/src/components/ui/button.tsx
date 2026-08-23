import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: rounded, bold, no text-select, press transition
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-bold transition-all duration-75 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive select-none",
  {
    variants: {
      variant: {
        // Coral/red — matches "Home" button in screenshot
        default:
          // Use currentColor for the “plate” so the depth follows the button color.
          "bg-[#e8524a] text-white " +
          "shadow-[0_6px_0_rgba(0,0,0,0.25),inset_0_2px_0_rgba(255,255,255,0.25)] " +
          "hover:shadow-[0_5px_0_rgba(0,0,0,0.25),inset_0_2px_0_rgba(255,255,255,0.25)] hover:translate-y-[1px] " +
          "active:translate-y-[5px] active:shadow-[0_1px_0_rgba(0,0,0,0.25),inset_0_2px_0_rgba(255,255,255,0.15)]", 

        // Purple/violet — matches "Back" button in screenshot
        secondary:
          "bg-[#8b7fd4] text-white " +
          "shadow-[0_6px_0_#5a4fa8,inset_0_2px_0_rgba(255,255,255,0.25)] " +
          "hover:shadow-[0_5px_0_#5a4fa8,inset_0_2px_0_rgba(255,255,255,0.25)] hover:translate-y-[1px] " +
          "active:translate-y-[5px] active:shadow-[0_1px_0_#5a4fa8,inset_0_2px_0_rgba(255,255,255,0.15)]",

        destructive:
          "bg-red-500 text-white " +
          "shadow-[0_6px_0_#b91c1c,inset_0_2px_0_rgba(255,255,255,0.25)] " +
          "hover:shadow-[0_5px_0_#b91c1c,inset_0_2px_0_rgba(255,255,255,0.25)] hover:translate-y-[1px] " +
          "active:translate-y-[5px] active:shadow-[0_1px_0_#b91c1c,inset_0_2px_0_rgba(255,255,255,0.15)]",

        outline:
          "border-2 border-input bg-background text-foreground " +
          "shadow-[0_6px_0_rgba(0,0,0,0.18),inset_0_2px_0_rgba(255,255,255,0.5)] " +
          "hover:shadow-[0_5px_0_rgba(0,0,0,0.18),inset_0_2px_0_rgba(255,255,255,0.5)] hover:translate-y-[1px] " +
          "active:translate-y-[5px] active:shadow-[0_1px_0_rgba(0,0,0,0.18),inset_0_2px_0_rgba(255,255,255,0.3)]",

        ghost:
          "bg-accent/60 text-accent-foreground " +
          "shadow-[0_6px_0_rgba(0,0,0,0.10),inset_0_2px_0_rgba(255,255,255,0.3)] " +
          "hover:shadow-[0_5px_0_rgba(0,0,0,0.10),inset_0_2px_0_rgba(255,255,255,0.3)] hover:translate-y-[1px] " +
          "active:translate-y-[5px] active:shadow-[0_1px_0_rgba(0,0,0,0.10),inset_0_2px_0_rgba(255,255,255,0.2)]",

        link: "text-primary underline-offset-4 hover:underline active:translate-y-[2px]",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-[12px] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-[14px] px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };