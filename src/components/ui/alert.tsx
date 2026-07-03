import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-xl border p-4 text-sm [&>svg]:size-4", {
  variants: {
    variant: {
      default: "border-border bg-surface text-muted-strong",
      info: "border-primary/30 bg-primary/10 text-primary-strong",
      warning: "border-warning/30 bg-warning-surface text-warning",
      danger: "border-danger/30 bg-danger-surface text-danger",
      success: "border-success/30 bg-success-surface text-success",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-medium leading-none", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm opacity-90", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
