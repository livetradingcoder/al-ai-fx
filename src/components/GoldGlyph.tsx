import type { SVGProps } from "react";

// Shared line-art glyph set used across the landing page and its spin-off pages
// (roadmap, licensing). Extracted from page.tsx so those pages can render the
// same iconography without duplicating the switch.
export function GoldGlyph({
  kind,
  ...props
}: { kind: string } & SVGProps<SVGSVGElement>) {
  switch (kind) {
    case "halo":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="32" cy="32" r="11" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M32 5v10M32 49v10M5 32h10M49 32h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "signal":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M8 44c6-10 12-15 18-15s10 6 16 6 8-4 14-15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 52c6-10 12-15 18-15s10 6 16 6 8-4 14-15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".45"
          />
          <circle cx="26" cy="29" r="4" fill="currentColor" />
          <circle cx="42" cy="35" r="4" fill="currentColor" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M32 8l18 7v13c0 13-7.6 22.7-18 28-10.4-5.3-18-15-18-28V15l18-7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="m24 32 5.5 5.5L41 25"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "vault":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <rect x="10" y="14" width="44" height="36" rx="10" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M32 24v16M24 32h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M12 22c0-4.4 3.6-8 8-8h28c2.2 0 4 1.8 4 4v6H20c-4.4 0-8 3.6-8 8v-10Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect x="12" y="24" width="40" height="26" rx="10" stroke="currentColor" strokeWidth="2" />
          <circle cx="41.5" cy="37" r="2.5" fill="currentColor" />
        </svg>
      );
    case "launch":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <path
            d="M36 12c10 3 16 13 16 24-10 0-20 6-24 16-7-11-6-27 8-40Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M20 44c-3 1-6 4-7 8 4-1 7-4 8-7M26 38l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="39" cy="25" r="3" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
          <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

export function SectionWireframe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 320 72" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 36h76l18-18h124l18 18h76"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".7"
      />
      <circle cx="160" cy="18" r="6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="160" cy="54" r="6" fill="currentColor" />
      <path d="M160 24v24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default GoldGlyph;
