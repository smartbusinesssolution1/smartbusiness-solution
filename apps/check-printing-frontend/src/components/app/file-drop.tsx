import * as React from "react";
import { motion } from "motion/react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Drop a file or click to choose one. Keyboard: the zone is a button.
export function FileDrop({
  accept,
  hint,
  title = "Drop a file here, or click to choose",
  onFile,
  disabled,
  multiple,
  className,
  compact,
}: {
  accept: string;
  hint: string;
  title?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  const take = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, multiple ? undefined : 1).forEach(onFile);
  };

  return (
    <>
      <motion.button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        animate={{ scale: over ? 1.01 : 1 }}
        className={cn(
          "dot-grid flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "px-4 py-5" : "px-6 py-10",
          over ? "border-accent bg-primary-50/60" : "border-line-strong bg-subtle/40 hover:border-ink/30 hover:bg-subtle/70",
          className,
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-panel shadow-card">
          <FileUp className="size-4" />
        </span>
        <span className="text-sm font-semibold">{over ? "Drop to upload" : title}</span>
        <span className="text-xs text-muted">{hint}</span>
      </motion.button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
