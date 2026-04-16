import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
      <p className="text-6xl font-bold" style={{ color: "var(--border)" }}>
        404
      </p>
      <p className="text-base" style={{ color: "var(--text-secondary)" }}>
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="text-sm px-5 py-2.5 rounded-lg font-medium"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        Go home
      </Link>
    </div>
  );
}
