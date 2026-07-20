import { ImageResponse } from "next/og";
import { productSurface, surfaceBrand } from "@/lib/product-surface";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
              background: "#000000",
              borderRadius: 40,
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#22c55e",
                borderRadius: 28,
                color: "#ffffff",
                fontSize: 72,
                fontWeight: 800,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              M
            </div>
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
            borderRadius: 40,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#b8ff2a",
              borderRadius: 28,
              color: "#0a0f00",
              fontSize: 72,
              fontWeight: 800,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            B
          </div>
        </div>
      ),
      { ...size },
    );
  }

  // Nezeem: black bg + light blue "n"
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
          fontSize: 120,
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
