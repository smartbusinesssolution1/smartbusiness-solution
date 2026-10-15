// User-supplied file names are only ever DISPLAYED (stored files get random names).
// Still, a name is shown in pages and sent back in a download header, so it is cleaned:
// no folders ("../../etc/passwd" becomes "passwd"), no control characters or line
// breaks (header injection), no quotes, at most 150 characters, and an extension
// that matches the file's real type.

const MAX_LENGTH = 150;

export function cleanFileName(original: string | undefined, extension: string): string {
  let name = (original ?? "").normalize("NFC");
  name = name.split(/[\\/]/).pop() ?? ""; // drop any folder part
  name = name.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, " "); // control chars, quotes, reserved
  name = name.replace(/\s+/g, " ").trim().replace(/^\.+/, ""); // no hidden-file names

  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim() || "attachment";
  const room = MAX_LENGTH - extension.length - 1;
  return `${base.slice(0, room).trim()}.${extension}`;
}

// A Content-Disposition header that is safe for any name: an ASCII-only fallback plus
// the exact name encoded per RFC 5987 for browsers that support it.
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/[\\"]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
