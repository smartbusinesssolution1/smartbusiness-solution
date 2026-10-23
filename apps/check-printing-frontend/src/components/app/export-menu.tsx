import * as React from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import type { ExportFormat } from "@/api/checks";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { errorMessage } from "@/lib/api";

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string; icon: React.ReactNode }> = [
  { format: "xlsx", label: "Excel", hint: "Real numbers and dates, totals row", icon: <FileSpreadsheet /> },
  { format: "csv", label: "CSV", hint: "For accounting software and imports", icon: <Sheet /> },
  { format: "pdf", label: "PDF", hint: "To print or attach for an auditor", icon: <FileText /> },
];

// "Export" with a choice of format. The file comes from the server (the same filters as
// the screen), and the browser saves it; errors such as "too many checks" show as a toast.
export function ExportMenu({
  onExport,
  disabled,
  label = "Export",
  note,
  size = "sm",
}: {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
  label?: string;
  // What the file will hold, shown at the top of the menu.
  note?: string;
  size?: "sm" | "md";
}) {
  const [running, setRunning] = React.useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    setRunning(format);
    try {
      await onExport(format);
    } catch (err) {
      toast.error("Export failed", { description: errorMessage(err) });
    } finally {
      setRunning(null);
    }
  };

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size={size} disabled={disabled} loading={running !== null}>
          <Download /> {label}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-72">
        {note && <p className="px-2.5 pt-2 pb-1 text-xs leading-snug text-muted">{note}</p>}
        <MenuLabel>Download as</MenuLabel>
        {FORMATS.map((f) => (
          <MenuItem key={f.format} onSelect={() => void run(f.format)} className="items-start">
            <span className="mt-0.5">{f.icon}</span>
            <span className="flex flex-col">
              <span className="font-medium text-ink">{f.label}</span>
              <span className="text-xs text-muted">{f.hint}</span>
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
