import { cn } from '@/lib/utils';

/**
 * Brand mark for P.R.I.S.M.A. — a beam of light entering a prism and
 * leaving as a fanned spectrum. Ties the icon literally to the name
 * instead of using a generic logo shape.
 */
export const PrismaMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    className={cn('h-8 w-8', className)}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="prisma-spectrum" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="45%" stopColor="#c026d3" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
    </defs>
    {/* incoming beam */}
    <line
      x1="2"
      y1="16"
      x2="12"
      y2="16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.6"
    />
    {/* the prism */}
    <polygon points="12,6 24,16 12,26" fill="url(#prisma-spectrum)" />
    {/* fanned spectrum leaving the prism */}
    <line
      x1="24"
      y1="12"
      x2="30"
      y2="7"
      stroke="#6366f1"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="24"
      y1="16"
      x2="31"
      y2="16"
      stroke="#c026d3"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="24"
      y1="20"
      x2="30"
      y2="25"
      stroke="#f97316"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
