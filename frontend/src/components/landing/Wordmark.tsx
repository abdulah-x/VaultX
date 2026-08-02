"use client";

import Logo from "./Logo";

/**
 * The brand lockup: symbolic mark + wordmark, optionally over the tagline.
 *
 * Per the brand guideline, "Vault" stays solid white and only the "X" carries
 * the cyan-to-violet gradient -- the same gradient the icon uses, and the only
 * two places on the page allowed to use it.
 *
 * This replaces the letterspaced all-caps "VAULTX" the nav and footer each
 * spelled out by hand, so the lockup is defined once and both surfaces track
 * any future change to it.
 */
export default function Wordmark({
  size = "md",
  tagline = false,
}: {
  /** md is the nav/footer lockup; lg is display size for a brand surface. */
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
}) {
  const mark = { sm: "h-6 w-6", md: "h-7 w-7", lg: "h-[52px] w-[52px]" }[size];
  const text = { sm: "text-[17px]", md: "text-[20px]", lg: "text-[44px]" }[size];
  const gap = { sm: "gap-2", md: "gap-2.5", lg: "gap-4" }[size];

  return (
    <span className="inline-flex flex-col gap-2">
      <span className={`inline-flex items-center ${gap}`}>
        <Logo className={mark} />
        <span className={`vx-wordmark ${text}`}>
          Vault<span className="vx-wordmark-x">X</span>
        </span>
      </span>
      {tagline && <span className="vx-tagline">Portfolio Intelligence</span>}
    </span>
  );
}
