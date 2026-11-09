import React from 'react';
import './shimmer.css';

interface ShimmerBlockProps {
  /** Tailwind sizing/shape classes, e.g. "h-4 w-32 rounded-full". */
  className?: string;
  style?: React.CSSProperties;
}

/** One shimmering placeholder shape. Decorative: hidden from screen readers. */
export const ShimmerBlock: React.FC<ShimmerBlockProps> = ({ className = '', style }) => (
  <div aria-hidden="true" className={`mp-shimmer ${className}`} style={style} />
);
