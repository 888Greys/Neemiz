import { createClient } from "@/lib/supabase/server";
import { isR2Configured, uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

/** Per-kind upload rules. Keys are the client-supplied `kind` field. */
const KINDS = {
  avatar:     { prefix: "avatars",  maxBytes: 2 * 1024 * 1024 },
  "p2p-chat": { prefix: "p2p-chat", maxBytes: 5 * 1024 * 1024 },
} as const;
type Kind = keyof typeof KINDS;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

/**
 * POST multipart/form-data { file, kind, orderId? } — authenticated upload proxy
 * to Cloudflare R2. Returns { url } of the served object. R2 credentials stay
 * server-side; clients never touch storage directly.
 */
export async function POST(req: Request) {
  if (!isR2Configured()) {
    return Response.json({ error: "Uploads are not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: "Invalid form data" }, { status: 400 }); }

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "") as Kind;
  const orderId = form.get("orderId") ? String(form.get("orderId")) : null;

  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  const rules = KINDS[kind];
  if (!rules) return Response.json({ error: "Invalid upload kind" }, { status: 400 });

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) return Response.json({ error: "Unsupported image type" }, { status: 400 });
  if (file.size > rules.maxBytes) {
    return Response.json({ error: `Image must be under ${Math.round(rules.maxBytes / 1024 / 1024)} MB` }, { status: 400 });
  }

  // Key is namespaced by user (and order for chat) so paths are unguessable and
  // never collide. Timestamp keeps avatars fresh past the immutable CDN cache.
  const segments = [rules.prefix, user.id];
  if (kind === "p2p-chat" && orderId) segments.push(orderId);
  segments.push(`${Date.now()}.${ext}`);
  const key = segments.join("/");

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await uploadToR2(key, bytes, file.type);
    return Response.json({ url });
  } catch (err) {
    console.error("[upload] R2 upload failed", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
