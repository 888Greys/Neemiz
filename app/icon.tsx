import { ImageResponse } from "next/og";
import { productSurface } from "@/lib/product-surface";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Runtime favicon — Binary surface gets a “B” mark; Nezeem keeps the blue “n”. */
export default function Icon() {
  const binary = productSurface() === "binary";

  if (binary) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#b8ff2a",
            borderRadius: 8,
            color: "#0a0f00",
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          B
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#151518",
          color: "#3b82f6",
          fontSize: 26,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
        }}
      >
        n
      </div>
    ),
    { ...size },
  );
}
