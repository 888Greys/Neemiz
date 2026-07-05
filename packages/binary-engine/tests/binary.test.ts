import { describe, it, expect, vi } from "vitest";
import { quoteToDigit } from "../src/digit";
import { evaluateTrade, payoutRate } from "../src/settle";
import { DerivClient } from "../src/deriv-client";

describe("Binary Option Digit Math", () => {
  it("should extract last digit from quotes correctly", () => {
    expect(quoteToDigit(1.055)).toBe(5);
    expect(quoteToDigit(10.234)).toBe(3);
    expect(quoteToDigit(0.007)).toBe(0);
    expect(quoteToDigit(99.99)).toBe(9);
  });
});

describe("Contract Rule Evaluation", () => {
  it("should evaluate Even/Odd correctly", () => {
    expect(evaluateTrade("Even", 2, 0)).toBe(true);
    expect(evaluateTrade("Even", 3, 0)).toBe(false);
    expect(evaluateTrade("Odd", 3, 0)).toBe(true);
    expect(evaluateTrade("Odd", 4, 0)).toBe(false);
  });

  it("should evaluate Matches/Differs correctly", () => {
    expect(evaluateTrade("Matches", 5, 5)).toBe(true);
    expect(evaluateTrade("Matches", 5, 6)).toBe(false);
    expect(evaluateTrade("Differs", 5, 6)).toBe(true);
    expect(evaluateTrade("Differs", 5, 5)).toBe(false);
  });

  it("should evaluate Over/Under correctly", () => {
    expect(evaluateTrade("Over", 6, 5)).toBe(true);
    expect(evaluateTrade("Over", 5, 5)).toBe(false);
    expect(evaluateTrade("Under", 4, 5)).toBe(true);
    expect(evaluateTrade("Under", 5, 5)).toBe(false);
  });
});

describe("Payout Rates Calculation", () => {
  it("should compute correct multipliers", () => {
    expect(payoutRate("Matches", 5)).toBe(9.15);
    expect(payoutRate("Differs", 5)).toBe(1.05);
    expect(payoutRate("Even", 5)).toBe(1.90);
    expect(payoutRate("Odd", 5)).toBe(1.90);
    expect(payoutRate("Over", 5)).toBe(2.37); // 9.5 / (9-5) = 2.375 -> floor is 2.37
    expect(payoutRate("Under", 5)).toBe(1.90); // 9.5 / 5 = 1.90
  });
});

describe("Deriv Client WebSocket Connection", () => {
  it("should throw if WebSocket is missing in Node environment", async () => {
    const client = new DerivClient({ WebSocketClass: null });
    await expect(client.fetchLatestPrice("R_100")).rejects.toThrow("WebSocket implementation is missing");
  });

  it("should fetch latest price successfully using mock WebSocket", async () => {
    class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor() {
        // Trigger onopen asynchronously to give client time to register handlers
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 5);
      }
      send = vi.fn(() => {
        // Simulate response from Deriv API tick feed after a short delay
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({
              data: JSON.stringify({
                history: {
                  prices: [123.456]
                }
              })
            });
          }
        }, 10);
      });
      close = vi.fn();
    }

    // Instantiating with MockWebSocket
    const client = new DerivClient({
      WebSocketClass: MockWebSocket
    });

    const price = await client.fetchLatestPrice("R_100");
    expect(price).toBe(123.456);
  });
});
