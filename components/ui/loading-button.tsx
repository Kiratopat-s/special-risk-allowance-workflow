import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  isLoading?: boolean;
  loadingText?: React.ReactNode;
};

function LoadingButton({
  children,
  className,
  disabled,
  isLoading = false,
  loadingText,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      aria-busy={isLoading || undefined}
      className={cn("min-w-fit", className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {isLoading && loadingText ? loadingText : children}
    </Button>
  );
}

export { LoadingButton };
