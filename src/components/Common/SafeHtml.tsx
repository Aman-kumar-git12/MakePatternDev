import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface SafeHtmlProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * For content written by someone else (public shared patterns): only load images from LeetCode,
   * so a shared page can't embed a tracking pixel that reveals viewers' IP addresses.
   */
  restrictImages?: boolean;
}

const TRUSTED_IMAGE_HOSTS = /(^|\.)leetcode\.(com|cn)$/i;

function dropUntrustedImages(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelectorAll('img').forEach((img) => {
    let host = '';
    try {
      host = new URL(img.getAttribute('src') || '', 'https://invalid.invalid').hostname;
    } catch {
      // unparsable: drop
    }
    if (!TRUSTED_IMAGE_HOSTS.test(host)) img.remove();
  });
  return tpl.innerHTML;
}

/**
 * Renders untrusted HTML after sanitizing it with DOMPurify.
 * Never pass unsanitized HTML to dangerouslySetInnerHTML anywhere else.
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({ html, className, style, restrictImages }) => {
  const clean = useMemo(() => {
    const sanitized = DOMPurify.sanitize(html || '', {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload', 'srcset'],
    });
    return restrictImages ? dropUntrustedImages(sanitized) : sanitized;
  }, [html, restrictImages]);
  return <div className={`mp-prose ${className || ''}`} style={style} dangerouslySetInnerHTML={{ __html: clean }} />;
};
