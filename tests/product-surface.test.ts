import { describe, it, expect, afterEach, vi } from "vitest";
import { productSurface, isBinarySurface } from "@/lib/product-surface";

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE DETECTION REGRESSION SUITE
//
// 2026-07-20 incident: www.nezeem.com was detected as the BINARY surface
// because hostLooksBinary() matched the container's own NEXT_PUBLIC_APP_URL
// host. The binary gate then bounced /auth-email/* (the Supabase GoTrue email
// templates) and /dashboard to /binary — signup "verification code" emails went
// out containing the binary trading page instead of a code.
// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("productSurface host detection", () => {
  it("treats www.nezeem.com as full even when NEXT_PUBLIC_APP_URL points at it", () => {
    // Exact prod-container config that shipped the bug.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.nezeem.com");
    expect(productSurface({ host: "www.nezeem.com" })).toBe("full");
    expect(isBinarySurface({ host: "www.nezeem.com" })).toBe(false);
  });

  it("treats nez-test.nezeem.com as full even when it is the container APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nez-test.nezeem.com");
    expect(productSurface({ host: "nez-test.nezeem.com" })).toBe("full");
  });

  it("treats apex nezeem.com as full", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.nezeem.com");
    expect(productSurface({ host: "nezeem.com" })).toBe("full");
  });

  it("treats known binary brand domains as binary without any env", () => {
    expect(productSurface({ host: "binaryoptionske.com" })).toBe("binary");
    expect(productSurface({ host: "www.binaryoptionske.com" })).toBe("binary");
    expect(productSurface({ host: "moneybinaryke.com" })).toBe("binary");
    expect(productSurface({ host: "www.moneybinaryke.com" })).toBe("binary");
    expect(productSurface({ host: "binarymarket.org" })).toBe("binary");
    expect(productSurface({ host: "www.binarymarket.org" })).toBe("binary");
  });

  it("lets PRODUCT_SURFACE=binary win on any host (binary containers)", () => {
    vi.stubEnv("PRODUCT_SURFACE", "binary");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://binaryoptionske.com");
    expect(productSurface({ host: "binaryoptionske.com" })).toBe("binary");
    // env wins even on a Nezeem host
    expect(productSurface({ host: "www.nezeem.com" })).toBe("binary");
  });

  it("lets PRODUCT_SURFACE=full win on a binary brand host", () => {
    vi.stubEnv("PRODUCT_SURFACE", "full");
    expect(productSurface({ host: "binaryoptionske.com" })).toBe("full");
  });

  it("treats unknown / ip / missing hosts as full", () => {
    expect(productSurface({ host: "127.0.0.1:3007" })).toBe("full");
    expect(productSurface({ host: null })).toBe("full");
    expect(productSurface()).toBe("full");
  });
});
