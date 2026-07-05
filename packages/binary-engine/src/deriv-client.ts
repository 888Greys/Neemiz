export interface DerivClientOptions {
  wsUrl?: string;
  wsTimeoutMs?: number;
  WebSocketClass?: any;
}

export interface TickPoint {
  price: number;
  epoch: number;
}

export class DerivClient {
  private wsUrl: string;
  private wsTimeoutMs: number;
  private WebSocketClass: any;

  constructor(options: DerivClientOptions = {}) {
    this.wsUrl = options.wsUrl ?? "wss://api.derivws.com/trading/v1/options/ws/public";
    this.wsTimeoutMs = options.wsTimeoutMs ?? 6000;
    this.WebSocketClass = options.WebSocketClass !== undefined
      ? options.WebSocketClass
      : (typeof globalThis !== "undefined" ? (globalThis as any).WebSocket : null);
  }

  private getWebSocket(): any {
    if (!this.WebSocketClass) {
      throw new Error(
        "WebSocket implementation is missing. Please ensure globalThis.WebSocket is available, or pass a custom WebSocket constructor via options.WebSocketClass."
      );
    }
    return new this.WebSocketClass(this.wsUrl);
  }

  /**
   * Fetch the latest live tick price for a symbol.
   */
  async fetchLatestPrice(symbol: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let socket: any;

      try {
        socket = this.getWebSocket();
      } catch (err) {
        reject(err);
        return;
      }

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {}
        fn();
      };

      const timer = setTimeout(
        () => finish(() => reject(new Error(`Deriv tick timeout for symbol ${symbol}`))),
        this.wsTimeoutMs
      );

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            ticks_history: symbol,
            count: 1,
            end: "latest",
            style: "ticks",
          })
        );
      };

      socket.onmessage = (event: any) => {
        let response: any;
        try {
          response = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (response.error) {
          finish(() => reject(new Error(response.error.message ?? "Deriv error")));
          return;
        }

        const last = response.history?.prices?.[response.history.prices.length - 1];
        const quote = response.tick?.quote;
        const price = typeof last === "number" ? last : typeof quote === "number" ? quote : undefined;

        if (typeof price === "number") {
          finish(() => resolve(price));
        }
      };

      socket.onerror = (err: any) => finish(() => reject(new Error(`Deriv stream error: ${err?.message || "unknown"}`)));
      socket.onclose = () => finish(() => reject(new Error("Deriv stream closed")));
    });
  }

  /**
   * Fetch tick history for a symbol since a starting epoch timestamp.
   */
  async fetchTickHistory(
    symbol: string,
    startEpoch: number,
    count: number = 1000
  ): Promise<TickPoint[]> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let socket: any;

      try {
        socket = this.getWebSocket();
      } catch (err) {
        reject(err);
        return;
      }

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch {}
        fn();
      };

      const timer = setTimeout(
        () => finish(() => reject(new Error(`Deriv history timeout for symbol ${symbol}`))),
        this.wsTimeoutMs
      );

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            ticks_history: symbol,
            start: startEpoch,
            end: "latest",
            count,
            style: "ticks",
          })
        );
      };

      socket.onmessage = (event: any) => {
        let response: any;
        try {
          response = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (response.error) {
          finish(() => reject(new Error(response.error.message ?? "Deriv error")));
          return;
        }

        const prices = response.history?.prices;
        const times = response.history?.times;

        if (Array.isArray(prices) && Array.isArray(times)) {
          const out: TickPoint[] = [];
          for (let i = 0; i < prices.length; i++) {
            const price = prices[i];
            const epoch = times[i];
            if (typeof price === "number" && typeof epoch === "number" && epoch > startEpoch) {
              out.push({ price, epoch });
            }
          }
          out.sort((a, b) => a.epoch - b.epoch);
          finish(() => resolve(out));
        }
      };

      socket.onerror = (err: any) => finish(() => reject(new Error(`Deriv stream error: ${err?.message || "unknown"}`)));
      socket.onclose = () => finish(() => reject(new Error("Deriv stream closed")));
    });
  }
}
