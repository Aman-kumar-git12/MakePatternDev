import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface SafeHtmlProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders untrusted HTML after sanitizing it with DOMPurify.
 * Never pass unsanitized HTML to dangerouslySetInnerHTML anywhere else.
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({ html, className, style }) => {
  const clean = useMemo(
    () =>
      DOMPurify.sanitize(html || '', {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload'],
      }),
    [html]
  );
  return <div className={`mp-prose ${className || ''}`} style={style} dangerouslySetInnerHTML={{ __html: clean }} />;
};
