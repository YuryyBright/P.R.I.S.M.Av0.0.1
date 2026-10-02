import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Base wrapper: decorative by default (aria-hidden), inherits colour from text. */
function Icon({ children, className = "size-4", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Job tile icon: stacked layers = a pipeline run. */
export const QueueIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 9 4.5-9 4.5-9-4.5Z" />
    <path d="m3 12 9 4.5 9-4.5" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const AlertTriangleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

/** Loading spinner; stops spinning for users who prefer reduced motion. */
export const SpinnerIcon = ({ className = "size-4", ...p }: IconProps) => (
  <Icon
    className={`${className} animate-spin motion-reduce:animate-none`}
    {...p}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Icon>
);

/**
 * Layout for any button that contains an icon/spinner + text.
 * Tailwind preflight makes <svg> `display:block`, so without a flex row the
 * icon drops above the label. Append to btnPrimary / btnSecondary / btnDanger.
 */
export const btnContent =
  "inline-flex! flex-row! flex-nowrap! items-center! justify-center! gap-2! whitespace-nowrap [&>svg]:shrink-0";
