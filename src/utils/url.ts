/**
 * Absolute URL for a user-entered problem link. "leetcode.com/problems/x" (no scheme) would
 * otherwise be treated as a path inside the app. Only http(s) links are allowed.
 */
export function problemHref(raw: string | null | undefined): string {
  const url = (raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''; // javascript:, data:, … are never opened
  return `https://${url.replace(/^\/+/, '')}`;
}
