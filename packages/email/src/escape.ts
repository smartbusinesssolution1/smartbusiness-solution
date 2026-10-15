// Every value that came from a user (names, company names) passes through escapeHtml
// before it goes into an email's HTML. Otherwise a company named
// `Acme<a href="https://evil.example">Verify your bank</a>` would put a working
// phishing link inside an email sent from our domain.

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

//A link that may go into an href. Only http(s) URLs are accepted, so a value such as
//`javascript:...` can never become a clickable link. Returns the escaped URL.

export function safeLink(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid link: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Links must use http or https, got ${parsed.protocol}`);
  }
  return escapeHtml(parsed.toString());
}
