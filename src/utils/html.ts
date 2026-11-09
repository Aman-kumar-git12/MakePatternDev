/** True when a string looks like HTML markup (e.g. a LeetCode problem statement). */
export const looksLikeHtml = (value: string | null | undefined): boolean =>
  Boolean(value && /<\s*(p|div|pre|code|strong|em|ul|ol|li|img|sup|sub|br|span|table)\b[^>]*>/i.test(value));
