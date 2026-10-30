/**
 * DISC mark: a solid disc with a "D" cut out of it and a purple spindle dot in the counter.
 * One path (even-odd) so it stays crisp from 16px favicon to large promo sizes. Uses currentColor.
 */


import { Disc3 } from 'lucide-react';

export function LogoMark({ size = 28, className = '', title }) {
  return (
    <Disc3
      size={size}
      className={className}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      strokeWidth={2}
    />
  );
}

export function Logo({ size = 28, withWordmark = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-fg ${className}`}>
      <LogoMark size={size} title={withWordmark ? undefined : 'DISC'} />
      {withWordmark && <span className="text-[1.15rem] font-semibold tracking-[0.22em]">DISC</span>}
    </span>
  );
}
