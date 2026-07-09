"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Loader2,
  PenLine,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  createMySignature,
  updateMySignature,
  activateMySignature,
  deleteMySignature,
  getMySignatureState,
} from "@/app/actions/user-signature";
import type {
  SignatureListItem,
  SignaturePageState,
} from "@/lib/domains/signature/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignatureClientProps {
  initialState: SignaturePageState | null;
  userName?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thDate(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignatureClient({
  initialState,
  userName,
}: SignatureClientProps) {
  const [state, setState] = useState<SignaturePageState>(
    initialState ?? { active: null, history: [] },
  );
  const [isPending, startTransition] = useTransition();

  // Draw dialog
  const [drawOpen, setDrawOpen] = useState(false);
  /** null = new signature, string = id of signature being redrawn */
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<SignatureListItem | null>(
    null,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // -------------------------------------------------------------------------
  // Canvas helpers
  // -------------------------------------------------------------------------

  const canvasPos = useCallback(
    (e: { clientX: number; clientY: number }): { x: number; y: number } => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const scaleX = canvasRef.current!.width / rect.width;
      const scaleY = canvasRef.current!.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }, []);

  useEffect(() => {
    if (!drawOpen) return;
    // Defer until the dialog is rendered and canvas has layout
    const id = setTimeout(initCanvas, 50);
    return () => clearTimeout(id);
  }, [drawOpen, initCanvas]);

  // Mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      isDrawingRef.current = true;
      const pos = canvasPos(e.nativeEvent);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [canvasPos],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = canvasPos(e.nativeEvent);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    },
    [canvasPos],
  );

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  // Touch events (prevents page scroll while drawing)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      isDrawingRef.current = true;
      const pos = canvasPos(e.touches[0]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [canvasPos],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = canvasPos(e.touches[0]);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    },
    [canvasPos],
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const refreshState = useCallback(() => {
    startTransition(async () => {
      const res = await getMySignatureState();
      if (res.success) setState(res.data);
    });
  }, []);

  const openNewDraw = useCallback(() => {
    setEditingId(null);
    setDrawOpen(true);
  }, []);

  const openEditDraw = useCallback((id: string) => {
    setEditingId(id);
    setDrawOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Could not read canvas data");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        startTransition(async () => {
          const result =
            editingId !== null
              ? await updateMySignature(editingId, dataUrl)
              : await createMySignature(dataUrl);

          if (result.success) {
            toast.success(editingId ? "Signature updated" : "Signature saved");
            setDrawOpen(false);
            refreshState();
          } else {
            toast.error(result.error);
          }
        });
      };
      reader.readAsDataURL(blob);
    }, "image/png");
  }, [editingId, refreshState]);

  const handleActivate = useCallback(
    (sig: SignatureListItem) => {
      startTransition(async () => {
        const result = await activateMySignature(sig.id);
        if (result.success) {
          toast.success("Signature activated");
          refreshState();
        } else {
          toast.error(result.error);
        }
      });
    },
    [refreshState],
  );

  const confirmDelete = useCallback(
    (sig: SignatureListItem) => setDeleteTarget(sig),
    [],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteMySignature(deleteTarget.id);
      if (result.success) {
        toast.success("Signature deleted");
        setDeleteTarget(null);
        refreshState();
      } else {
        toast.error(result.error);
      }
    });
  }, [deleteTarget, refreshState]);

  const handleDownload = useCallback(async (sig: SignatureListItem) => {
    try {
      const response = await fetch(sig.imageUrl);
      if (!response.ok) {
        toast.error("Could not download signature");
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `signature_${sig.id.slice(0, 8)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      toast.error("Could not download signature");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const { active, history } = state;
  const inactive = history.filter((s) => !s.isActive);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-10">
      {/* ---- Page Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            My Signature
          </h1>
          {userName && (
            <p className="text-sm text-muted-foreground">{userName}</p>
          )}
        </div>
        <Button
          onClick={openNewDraw}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          <PenLine className="mr-2 h-4 w-4" />
          Draw New Signature
        </Button>
      </div>

      {/* ---- Active Signature ---- */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Active Signature
          </CardTitle>
          <CardDescription>
            This signature will appear on approved documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {active ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-white p-4 flex items-center justify-center min-h-25">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.imageUrl}
                  alt="Active signature"
                  className="max-h-25 max-w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDraw(active.id)}
                  disabled={isPending}
                >
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                  Redraw
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownload(active)}
                  disabled={isPending}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => confirmDelete(active)}
                  disabled={isPending}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {active.activatedAt
                  ? `Activated ${thDate(active.activatedAt)}`
                  : `Created ${thDate(active.createdAt)}`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center gap-3">
              <PenLine className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">No active signature</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Draw a signature to get started.
                </p>
              </div>
              <Button size="sm" onClick={openNewDraw} disabled={isPending}>
                Draw Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- History ---- */}
      {inactive.length > 0 && (
        <>
          <Separator className="mb-6" />
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Signature History</h2>
              <Badge variant="secondary">{inactive.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Previous signatures are kept. You can restore one as active at any
              time.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inactive.map((sig) => (
                <div
                  key={sig.id}
                  className="rounded-xl border bg-card p-3 space-y-3 shadow-sm"
                >
                  <div className="rounded-md border bg-white flex items-center justify-center h-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sig.imageUrl}
                      alt="Signature"
                      className="max-h-full max-w-full object-contain p-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {thDate(sig.createdAt)}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleActivate(sig)}
                      disabled={isPending}
                    >
                      <Star className="mr-1 h-3 w-3" />
                      Use This
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openEditDraw(sig.id)}
                      disabled={isPending}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Redraw
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => confirmDelete(sig)}
                      disabled={isPending}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ---- Draw Dialog ---- */}
      <Dialog open={drawOpen} onClose={() => setDrawOpen(false)}>
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Redraw Signature" : "Draw New Signature"}
          </DialogTitle>
          <DialogDescription>
            Sign in the area below. Use a mouse, trackpad, or touch screen.
          </DialogDescription>
          <DialogClose onClose={() => setDrawOpen(false)} />
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="rounded-lg border bg-white touch-none">
            <canvas
              ref={canvasRef}
              className="block h-50 w-full cursor-crosshair rounded-lg"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={stopDrawing}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            disabled={isPending}
            className="w-full"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDrawOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="mr-2 h-4 w-4" />
            )}
            Save Signature
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ---- Delete Confirmation Dialog ---- */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Delete Signature?</DialogTitle>
          <DialogDescription>
            This signature will be removed from your history. This action cannot
            be undone.
          </DialogDescription>
          <DialogClose onClose={() => setDeleteTarget(null)} />
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
