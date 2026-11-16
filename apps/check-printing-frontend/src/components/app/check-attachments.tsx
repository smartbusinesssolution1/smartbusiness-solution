import { toast } from "sonner";
import { Download, FileText, Paperclip } from "lucide-react";
import { fetchAttachment } from "@/api/checks";
import type { Check } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Panel, PanelHeader } from "@/components/app/layout";
import { fileSize } from "@/components/app/file-drop";
import { errorMessage } from "@/lib/api";

// Opens a file the API serves (a PDF, an attachment) in a new tab.
export async function openBlob(load: () => Promise<Blob>, name: string) {
  // Open the tab first: a tab opened after an await is often blocked as a popup.
  const tab = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await load());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    toast.error(`Couldn't open ${name}`, { description: errorMessage(err) });
  }
}

// The invoices and receipts attached to a check, each opened with a click. Shown on the
// check's page and at the print station (BUG_014), so whoever prints can check the evidence
// without leaving the station. Anyone who can see the check may open them.
export function CheckAttachments({ check }: { check: Check }) {
  const { wid } = useWorkspaceContext();
  return (
    <Panel>
      <PanelHeader title="Attachments" description={check.attachments.length ? `${check.attachments.length} file${check.attachments.length === 1 ? "" : "s"}` : "None"} />
      {check.attachments.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No invoices or receipts were attached.</p>
      ) : (
        <ul className="divide-y divide-line">
          {check.attachments.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => openBlob(() => fetchAttachment(wid, check.id, a.id), a.fileName)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors hover:bg-subtle/60">
                <span className="flex size-8 items-center justify-center rounded-lg bg-subtle">{a.fileType === "application/pdf" ? <FileText className="size-4" /> : <Paperclip className="size-4" />}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{a.fileName}</span>
                  <span className="text-xs text-muted">{fileSize(a.sizeBytes)} · {a.uploadedBy.fullName}</span>
                </span>
                <Download className="size-4 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
