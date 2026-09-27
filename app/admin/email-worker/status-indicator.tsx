import {
  Activity, CircleCheck, CircleHelp, CirclePause, CircleX, Clock,
  LoaderCircle, RotateCcw, SkipForward, Square, TriangleAlert, WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { EmailAttemptView } from "@/lib/domains/email-delivery/dashboard-types";
import type { EmailDeliveryStatus } from "@/lib/domains/email-delivery/types";
import type { EmailWorkerState } from "@/lib/domains/email-delivery/worker-monitor";
import { attemptLabels, deliveryLabels, workerLabels } from "./presentation";

type StatusStyle = { icon: LucideIcon; variant: BadgeVariant };

const deliveryStyles: Record<EmailDeliveryStatus, StatusStyle> = {
  PENDING: { icon: Clock, variant: "secondary" },
  PROCESSING: { icon: LoaderCircle, variant: "info" },
  RETRY_WAIT: { icon: RotateCcw, variant: "warning" },
  ACCEPTED: { icon: CircleCheck, variant: "success" },
  FAILED: { icon: CircleX, variant: "destructive" },
  SKIPPED: { icon: SkipForward, variant: "secondary" },
};

const workerStyles: Record<EmailWorkerState, StatusStyle> = {
  STARTING: { icon: LoaderCircle, variant: "secondary" },
  IDLE: { icon: Activity, variant: "secondary" },
  PROCESSING: { icon: LoaderCircle, variant: "info" },
  DEGRADED: { icon: TriangleAlert, variant: "destructive" },
  STALLED: { icon: TriangleAlert, variant: "warning" },
  NO_SIGNAL: { icon: WifiOff, variant: "destructive" },
  STOPPING: { icon: CirclePause, variant: "secondary" },
  STOPPED: { icon: Square, variant: "secondary" },
};

function StatusBadge({ label, icon: Icon, variant }: StatusStyle & { label: string }) {
  return <Badge variant={variant} className="max-w-full gap-1.5 py-1 leading-5">
    <Icon className="size-4 shrink-0" aria-hidden="true" />
    <span>{label}</span>
  </Badge>;
}

export function DeliveryStatusBadge({ status }: { status: EmailDeliveryStatus }) {
  return <StatusBadge {...deliveryStyles[status]} label={deliveryLabels[status]} />;
}

export function WorkerStatusBadge({ state }: { state: EmailWorkerState }) {
  return <StatusBadge {...workerStyles[state]} label={workerLabels[state]} />;
}

export function AttemptStatusBadge({ outcome }: { outcome: EmailAttemptView["outcome"] }) {
  if (!outcome) return <StatusBadge {...deliveryStyles.PROCESSING} label="กำลังประมวลผล" />;
  const additional: Record<"INTERRUPTED" | "MANUAL_RETRY" | "UNKNOWN", StatusStyle> = {
    INTERRUPTED: { icon: TriangleAlert, variant: "warning" },
    MANUAL_RETRY: { icon: RotateCcw, variant: "secondary" },
    UNKNOWN: { icon: CircleHelp, variant: "secondary" },
  };
  const styles: Record<Exclude<EmailAttemptView["outcome"], null>, StatusStyle> = { ...deliveryStyles, ...additional };
  return <StatusBadge {...styles[outcome]} label={attemptLabels[outcome]} />;
}
