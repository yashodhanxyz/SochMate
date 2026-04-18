/**
 * SochMate logo mark — two diagonal squares forming a chess-inspired symbol.
 *
 * The SVG uses currentColor so it inherits from CSS `color`.
 * Default usage on the dark navbar: white.
 * Pass color="black" for light backgrounds (e.g. email, OG image).
 */
export default function LogoMark({
  size = 24,
  color = "white",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 768 768"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="384" y="0" width="384" height="384" fill={color} />
      <rect x="0" y="384" width="384" height="384" fill={color} />
    </svg>
  );
}
