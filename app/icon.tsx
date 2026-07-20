import { ImageResponse } from "next/og";
import { productSurface, surfaceBrand } from "@/lib/product-surface";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Runtime favicon — each brand gets its own mark. */
export default function Icon() {
  if (productSurface() === "binary") {
    const brand = surfaceBrand();

    // MoneyBinary: green bg + white "M"
    if (brand === "MoneyBinary") {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#22c55e",
              borderRadius: 8,
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            M
          </div>
        ),
        { ...size },
      );
    }

    // BinaryOptionsKE (default binary): black bg + lime "B"
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000000",
            borderRadius: 8,
            color: "#b8ff2a",
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

  // Nezeem: light blue bg + white italic bold "n"
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3b82f6",
          borderRadius: 8,
          color: "#ffffff",
          fontSize: 26,
          fontWeight: 900,
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
