"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

// Avatar with a built-in upload affordance. Renders the current photo (or the
// user's initials), overlays a small camera button, and handles the full
// pipeline on file pick: validate → POST /api/upload (kind=avatar) → PATCH
// /api/profile/avatar → report the new URL upward.
//
// Uploads go through the server proxy to Cloudflare R2; if R2 isn't configured
// yet the endpoint returns 503 and we show a friendly message rather than a raw
// error, so the UI is safe to ship before the R2 keys land.

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024;

export function AvatarUploader({
  currentUrl,
  initials,
  onUploaded,
  sizeClass = "h-12 w-12",
  className,
}: {
  currentUrl: string | null;
  initials: string;
  onUploaded: (url: string) => void;
  sizeClass?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error("Unsupported image", "Use a JPG, PNG, WEBP, or GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", "Please pick an image under 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "avatar");
      const up = await fetch("/api/upload", { method: "POST", body: form });
      const upData = await up.json().catch(() => ({}));
      if (up.status === 503) {
        toast.info("Coming soon", "Photo uploads aren't enabled yet — check back shortly.");
        return;
      }
      if (!up.ok) throw new Error(upData.error ?? "Upload failed");

      const url = upData.url as string;
      const patch = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!patch.ok) {
        const pData = await patch.json().catch(() => ({}));
        throw new Error(pData.error ?? "Could not save your photo");
      }

      onUploaded(url);
      toast.info("Photo updated", "Your new profile picture is live.");
    } catch (err) {
      toast.error("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("relative shrink-0", sizeClass, className)}>
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt="Profile photo"
          referrerPolicy="no-referrer"
          className={cn("rounded-full object-cover shadow-[0_0_30px_rgba(8,124,255,0.24)] ring-2 ring-white/[0.08]", sizeClass)}
        />
      ) : (
        <div className={cn("flex items-center justify-center rounded-full bg-gradient-to-br from-[#087cff] to-[#0556c8] text-xl font-black text-white shadow-[0_0_30px_rgba(8,124,255,0.4)]", sizeClass)}>
          {initials}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile photo"
        className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-md outline-none ring-2 ring-[#151518] transition hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary-fixed/70 disabled:opacity-70"
      >
        {uploading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/40 border-t-current motion-reduce:animate-none" />
        ) : (
          <Icon name="photo_camera" className="text-[13px]" />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
