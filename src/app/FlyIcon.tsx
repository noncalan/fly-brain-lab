/** Simple top-down fly mark (also used as the favicon, public/favicon.svg). */
export function FlyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="currentColor">
      <ellipse cx="10.5" cy="17" rx="4" ry="9" transform="rotate(-25 10.5 17)" opacity="0.45" />
      <ellipse cx="21.5" cy="17" rx="4" ry="9" transform="rotate(25 21.5 17)" opacity="0.45" />
      <ellipse cx="16" cy="20" rx="4" ry="7" />
      <circle cx="16" cy="11.5" r="3.6" />
      <circle cx="16" cy="7" r="2.8" />
    </svg>
  );
}
