import { describe, expect, it } from "vitest";
import { detectCountryFromHeaders, WORLD_BY_CODE } from "@/lib/payments/world-countries";

describe("detectCountryFromHeaders", () => {
  it("reads Cloudflare CF-IPCountry", () => {
    expect(
      detectCountryFromHeaders((n) => (n === "cf-ipcountry" ? "KE" : null)),
    ).toBe("KE");
  });

  it("reads Vercel x-vercel-ip-country", () => {
    expect(
      detectCountryFromHeaders((n) => (n === "x-vercel-ip-country" ? "BR" : null)),
    ).toBe("BR");
  });

  it("ignores XX / Tor placeholders", () => {
    expect(
      detectCountryFromHeaders((n) => (n === "cf-ipcountry" ? "XX" : null)),
    ).toBeNull();
  });

  it("falls back to accept-language region", () => {
    expect(
      detectCountryFromHeaders((n) => (n === "accept-language" ? "en-NG,en;q=0.9" : null)),
    ).toBe("NG");
  });

  it("maps detected codes to known world countries", () => {
    const code = detectCountryFromHeaders((n) => (n === "cf-ipcountry" ? "FR" : null));
    expect(code).toBe("FR");
    expect(WORLD_BY_CODE[code!].currency).toBe("EUR");
  });
});
