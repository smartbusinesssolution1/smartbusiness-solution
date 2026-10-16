import * as React from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignaturePadHandle {
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
}

// Draw a signature with a mouse, pen or finger. Exported as a PNG and uploaded through
// the same endpoint as a scanned signature, which cleans it the same way.
export const SignaturePad = React.forwardRef<SignaturePadHandle, { onChange?: (hasInk: boolean) => void; className?: string }>(
  ({ onChange, className }, ref) => {
    const canvas = React.useRef<HTMLCanvasElement>(null);
    const drawing = React.useRef(false);
    const last = React.useRef<{ x: number; y: number; t: number } | null>(null);
    const width = React.useRef(2.4);
    const [hasInk, setHasInk] = React.useState(false);

    const setup = React.useCallback(() => {
      const c = canvas.current;
      if (!c) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 2);
      const rect = c.getBoundingClientRect();
      c.width = rect.width * ratio;
      c.height = rect.height * ratio;
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111114";
    }, []);

    React.useEffect(() => {
      setup();
    }, [setup]);

    const clear = React.useCallback(() => {
      const c = canvas.current;
      if (!c) return;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      setHasInk(false);
      onChange?.(false);
    }, [onChange]);

    React.useImperativeHandle(ref, () => ({
      clear,
      // Cropped to the ink, on white, so the server sees a tight, high-contrast signature.
      toBlob: () =>
        new Promise((resolve) => {
          const c = canvas.current;
          if (!c || !hasInk) return resolve(null);
          const ctx = c.getContext("2d")!;
          const { data, width: w, height: h } = ctx.getImageData(0, 0, c.width, c.height);
          let minX = w, minY = h, maxX = 0, maxY = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (data[(y * w + x) * 4 + 3]! > 20) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (maxX <= minX || maxY <= minY) return resolve(null);
          const pad = 24;
          const inkW = maxX - minX;
          const inkH = maxY - minY;
          const out = document.createElement("canvas");
          // The server needs at least 150 × 40 px; a short initial would fall under that.
          out.width = Math.max(inkW + pad * 2, 300);
          out.height = Math.max(inkH + pad * 2, 100);
          const o = out.getContext("2d")!;
          o.fillStyle = "#ffffff";
          o.fillRect(0, 0, out.width, out.height);
          o.drawImage(c, minX, minY, inkW, inkH, (out.width - inkW) / 2, (out.height - inkH) / 2, inkW, inkH);
          out.toBlob((b) => resolve(b), "image/png");
        }),
    }));

    const point = (e: React.PointerEvent) => {
      const rect = canvas.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() };
    };

    return (
      <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-[#fcfcfd]", className)}>
        <canvas
          ref={canvas}
          className="block h-48 w-full touch-none cursor-crosshair"
          aria-label="Signature drawing area. Draw your signature with a mouse, pen or finger."
          role="img"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
            width.current = 2.4;
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = point(e);
            const ctx = canvas.current!.getContext("2d")!;
            // Faster strokes draw thinner, like ink.
            const speed = Math.hypot(p.x - last.current.x, p.y - last.current.y) / Math.max(p.t - last.current.t, 1);
            width.current = width.current * 0.7 + Math.max(1.2, Math.min(3.2, 3.4 - speed * 1.4)) * 0.3;
            ctx.lineWidth = width.current;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
            if (!hasInk) {
              setHasInk(true);
              onChange?.(true);
            }
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
        <div className="pointer-events-none absolute right-6 bottom-12 left-6 border-b border-dashed border-line-strong" />
        <span className="pointer-events-none absolute bottom-5 left-6 font-mono text-[0.625rem] tracking-wider text-faint uppercase">Sign above the line</span>
        {!hasInk && <span className="pointer-events-none absolute inset-x-0 top-14 text-center text-sm text-faint">Draw your signature here</span>}
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white shadow-button transition-opacity disabled:opacity-0"
        >
          <Eraser className="size-3.5" /> Clear
        </button>
      </div>
    );
  },
);
SignaturePad.displayName = "SignaturePad";
