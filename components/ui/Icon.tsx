// Material Icons (outlined) via the self-hosted `material-icons` package.
// The outlined font + `.material-icons-outlined` class are loaded once in the
// root layout (import 'material-icons/iconfont/outlined.css').
export function Icon({
  name,
  className = '',
  size,
  filled = false,
}: {
  /** Material icon ligature name, e.g. "search", "chevron_right". */
  name: string;
  className?: string;
  /** Pixel size; defaults to inherit (1em). */
  size?: number;
  /** Use the filled variant instead of outlined. */
  filled?: boolean;
}) {
  return (
    <span
      className={`${filled ? 'material-icons' : 'material-icons-outlined'} select-none leading-none ${className}`}
      style={size ? { fontSize: size } : undefined}
      aria-hidden
    >
      {name}
    </span>
  );
}
