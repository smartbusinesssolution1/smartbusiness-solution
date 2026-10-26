import * as React from "react";
import { useLocation, useNavigate } from "react-router";

// The one-time token from a password-reset or invitation link.
//
// Links carry it after "#" (…/reset-password#token=…), which the browser never sends to any
// server. Emails sent before that change have it in the query (?token=…), and those links
// still work. Either way it is taken out of the address bar at once, so it doesn't stay in
// the browser history or get copied along with the address, and kept for this tab only
// (sessionStorage), so a refresh still works until the link has been used.

type LinkKind = "reset" | "invitation";

const storageKey = (kind: LinkKind) => `sb.link-token.${kind}`;

function readStored(kind: LinkKind): string | null {
  try {
    return sessionStorage.getItem(storageKey(kind));
  } catch {
    return null;
  }
}

function store(kind: LinkKind, token: string): void {
  try {
    sessionStorage.setItem(storageKey(kind), token);
  } catch {
    // Private mode or blocked storage: the token still works until the page is refreshed.
  }
}

// Forget the token once it has been used, or turned out to be invalid.
export function clearLinkToken(kind: LinkKind): void {
  try {
    sessionStorage.removeItem(storageKey(kind));
  } catch {
    // Nothing stored.
  }
}

export function useLinkToken(kind: LinkKind): string {
  const location = useLocation();
  const navigate = useNavigate();
  const [fromLink] = React.useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") ?? new URLSearchParams(location.search).get("token"),
  );
  const [token] = React.useState(() => {
    if (fromLink) {
      store(kind, fromLink);
      return fromLink;
    }
    return readStored(kind) ?? "";
  });

  React.useEffect(() => {
    if (fromLink) navigate({ pathname: location.pathname, search: "", hash: "" }, { replace: true });
    // Once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return token;
}
