"use client";

import { merchantAvatarUrl } from "@/lib/p2p/merchant-avatar";

type Props = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  rounded?: "full" | "xl" | "2xl";
  online?: boolean;
  onlineRingClass?: string;
};

/**
 * Merchant / trader face: Google/email/uploaded photo when present,
 * else DiceBear Personas (business-style people) seeded by id.
 */
export function MerchantAvatar({
  id,
  name,
  avatarUrl,
  size = 28,
  className = "",
  rounded = "full",
  online,
  onlineRingClass = "border-[#151518]",
}: Props) {
  const src = avatarUrl?.trim() || merchantAvatarUrl(id || name, { size: size * 2 });
  const radius =
    rounded === "2xl" ? "rounded-2xl" : rounded === "xl" ? "rounded-xl" : "rounded-full";

  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`h-full w-full object-cover ${radius} bg-white/[0.04] ring-1 ring-white/[0.06]`}
        loading="lazy"
      />
      {online != null && (
        <span
          className={`absolute -bottom-0 -right-0 h-2 w-2 rounded-full border-2 ${onlineRingClass} ${
            online ? "bg-[#05b957]" : "bg-slate-600"
          }`}
        />
      )}
    </span>
  );
}
