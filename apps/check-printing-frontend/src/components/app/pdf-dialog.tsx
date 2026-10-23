import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileWarning, Printer, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Skeleton } from "@/components/app/layout";
import { errorMessage } from "@/lib/api";

// Loads a PDF from the API and shows it with the one print setting that matters: actual
// size. A browser can't confirm what the printer did, so the person reports that after.
// `key` names the document: a new key (e.g. after a printer adjustment) loads a fresh copy.
export function usePdf(key: ReadonlyArray<unknown> | null, fetcher: () => Promise<Blob>) {
  const query = useQuery({
    queryKey: ["pdf", ...(key ?? [])],
    queryFn: async () => URL.createObjectURL(new Blob([await fetcher()], { type: "application/pdf" })),
    enabled: key !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const url = query.data ?? null;
  React.useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return { url, error: query.error, loading: query.isFetching };
}

export function PrintTips({ compact }: { compact?: boolean }) {
  const tips = [
    ["Scale", "Actual size, 100% (not “Fit to page”)"],
    ["Margins", "Default or none; never “Shrink”"],
    ["Paper", "Same size and tray as the printer profile"],
  ];
  return (
    <ul className={compact ? "flex flex-col gap-1.5" : "grid gap-2 sm:grid-cols-3"}>
      {tips.map(([k, v]) => (
        <li key={k} className="flex items-start gap-2 rounded-xl border border-line bg-subtle/60 px-3 py-2 text-xs">
          <Ruler className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span><span className="font-semibold text-ink">{k}:</span> <span className="text-muted">{v}</span></span>
        </li>
      ))}
    </ul>
  );
}

export function PdfFrame({ url, loading, error, title, height = "70vh" }: { url: string | null; loading: boolean; error: unknown; title: string; height?: string }) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-line bg-subtle" style={{ height }}>
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <Skeleton className="h-full w-full max-w-md rounded-lg" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <FileWarning className="size-6 text-danger-600" />
            <p className="text-sm font-medium">The PDF didn't load</p>
            <p className="max-w-sm text-xs text-muted">{errorMessage(error)}</p>
          </div>
        ) : url ? (
          <iframe ref={frame} src={url} title={title} className="h-full w-full" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!url}
          onClick={() => {
            // Prints the PDF itself through the browser's PDF viewer; falls back to a tab.
            try {
              frame.current?.contentWindow?.focus();
              frame.current?.contentWindow?.print();
            } catch {
              if (url) window.open(url, "_blank", "noopener");
            }
          }}
        >
          <Printer /> Print
        </Button>
        <Button variant="secondary" disabled={!url} onClick={() => url && window.open(url, "_blank", "noopener")}>
          <ExternalLink /> Open in new tab
        </Button>
      </div>
    </div>
  );
}

export function PdfDialog({
  open,
  onOpenChange,
  title,
  description,
  pdfKey,
  fetcher,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  pdfKey: ReadonlyArray<unknown>;
  fetcher: () => Promise<Blob>;
  footer?: React.ReactNode;
}) {
  const pdf = usePdf(open ? pdfKey : null, fetcher);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader icon={<Printer />} title={title} description={description} />
        <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6">
          <PrintTips />
          <PdfFrame {...pdf} title={title} height="60vh" />
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
