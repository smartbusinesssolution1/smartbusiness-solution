import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// The one-time token from a password-reset link.
//
// Links carry it after "#" (/reset-password#token=...), which the browser never sends to any
// server, so it stays out of server logs and Referer headers. Emails sent before that change
// have it in the query (?token=...), and those links still work. Either way it is removed
// from the address bar at once, so it doesn't stay in the browser history or get copied with
// the address, and kept for this tab only (sessionStorage), so a refresh still works until
// the link has been used. Same behaviour as Check Printing's link-token.ts.

const STORAGE_KEY = 'sb.link-token.reset';

// Pure: which token the address carries ("#token=" first, then "?token=").
export function tokenFromAddress(hash: string, search: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? new URLSearchParams(search).get('token');
}

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Private mode or blocked storage: the token still works until the page is refreshed.
  }
}

// Forget the token once it has been used.
export function clearLinkToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

export function useLinkToken(): string {
  const location = useLocation();
  const navigate = useNavigate();
  const [fromLink] = useState(() => tokenFromAddress(location.hash, location.search));
  const [token] = useState(() => {
    if (fromLink) {
      store(fromLink);
      return fromLink;
    }
    return readStored() ?? '';
  });

  useEffect(() => {
    if (fromLink) navigate({ pathname: location.pathname, search: '', hash: '' }, { replace: true });
    // Once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return token;
}
