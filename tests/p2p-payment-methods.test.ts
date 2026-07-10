import { describe, it, expect } from "vitest";
import { methodAllowedForFiat, paymentMethodsForFiat } from "@/lib/p2p/payment-methods";

// Regression for the "selected NGN but still shows Kenyan M-Pesa" bug: the ad
// form must only offer payment methods that make sense for the chosen fiat.
describe("methodAllowedForFiat", () => {
  it("hides a Kenyan-only rail (M-Pesa) on an NGN ad", () => {
    expect(methodAllowedForFiat("MPESA", "NGN")).toBe(false);
    expect(methodAllowedForFiat("AIRTEL", "NGN")).toBe(false);
  });

  it("offers the fiat's local rails", () => {
    expect(methodAllowedForFiat("OPAY", "NGN")).toBe(true);
    expect(methodAllowedForFiat("MONIEPOINT", "NGN")).toBe(true);
    expect(methodAllowedForFiat("MPESA", "KES")).toBe(true);
  });

  it("keeps universal rails available for every fiat", () => {
    for (const fiat of ["NGN", "KES", "GHS", "EUR", "USD"]) {
      expect(methodAllowedForFiat("BANK", fiat)).toBe(true);
      expect(methodAllowedForFiat("PAYPAL", fiat)).toBe(true);
    }
  });

  it("does not filter when there is no fiat context (null/undefined)", () => {
    expect(methodAllowedForFiat("MPESA", null)).toBe(true);
    expect(methodAllowedForFiat("MPESA", undefined)).toBe(true);
  });

  it("restricts a selected-but-unmapped currency to universal rails", () => {
    // Currencies not in the international catalogue must not leak local rails like M-Pesa.
    for (const fiat of ["AFN", "XYZ", "FOO"]) {
      expect(methodAllowedForFiat("MPESA", fiat)).toBe(false);
      expect(methodAllowedForFiat("AIRTEL", fiat)).toBe(false);
      expect(methodAllowedForFiat("BANK", fiat)).toBe(true);
      expect(methodAllowedForFiat("PAYPAL", fiat)).toBe(true);
    }
  });

  it("every fiat's own listed methods pass its own filter", () => {
    for (const fiat of ["KES", "NGN", "GHS", "ZAR", "TZS", "UGX", "USD", "EUR", "GBP", "INR", "BRL", "CAD"]) {
      for (const m of paymentMethodsForFiat(fiat)) {
        expect(methodAllowedForFiat(m.value, fiat)).toBe(true);
      }
    }
  });
});
