"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  type AreaData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

type ContractFamily = "evenOdd" | "matchDiffer" | "overUnder";
type ContractSide = "Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under";
type TradeStatus = "open" | "won" | "lost";
type StreamStatus = "connecting" | "live" | "fallback";

type BinaryMarket = {
  symbol: string;
  derivSymbol: string;
  name: string;
  price: number;
  volatility: number;
  speedMs: number;
};

type Tick = {
  time: UTCTimestamp;
  quote: number;
  digit: number;
};

type BinaryTrade = {
  id: string;
  market: string;
  side: ContractSide;
  stake: number;
  payout: number;
  entryDigit: number;
  targetDigit: number;
  exitDigit?: number;
  openedAt: number;
  settlesAt: number;
  status: TradeStatus;
  isReal?: boolean; // true when backed by real wallet
};

const MARKETS: BinaryMarket[] = [
  { symbol: "Vol 10 (1s)", derivSymbol: "R_10", name: "Deriv synthetic index", price: 9447.34, volatility: 0.65, speedMs: 900 },
  { symbol: "Vol 25 (1s)", derivSymbol: "R_25", name: "Deriv synthetic index", price: 3821.8, volatility: 0.95, speedMs: 850 },
  { symbol: "Vol 50 (1s)", derivSymbol: "R_50", name: "Deriv synthetic index", price: 602.91, volatility: 1.35, speedMs: 780 },
  { symbol: "Vol 75 (1s)", derivSymbol: "R_75", name: "Deriv synthetic index", price: 12843.2, volatility: 1.75, speedMs: 720 },
  { symbol: "Vol 100 (1s)", derivSymbol: "R_100", name: "Deriv synthetic index", price: 1762.48, volatility: 2.2, speedMs: 680 },
  { symbol: "Jump 10", derivSymbol: "JD10", name: "Deriv jump index", price: 119.56, volatility: 1.1, speedMs: 1050 },
];

const STAKE_PRESETS_LIVE = [10, 50, 100, 250, 500, 1000];
const STAKE_PRESETS_DEMO = [1, 5, 10, 25, 50, 100];
const DIGITS = Array.from({ length: 10 }, (_, index) => index);
const TICK_SECONDS = 1;
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "1089"}`;
const TOP_ACTIONS = [
  { label: "Trader's Hub", icon: "home" },
  { label: "Deposit", icon: "payments" },
  { label: "Withdraw", icon: "account_balance_wallet" },
  { label: "History", icon: "history" },
  { label: "Chat", icon: "chat" },
];

function seedTicks(market: BinaryMarket): Tick[] {
  let quote = market.price;
  const now = Math.floor(Date.now() / 1000) as UTCTimestamp;

  return Array.from({ length: 80 }, (_, index) => {
    const wave = Math.sin(index / 5) * market.volatility * 2.5;
    const drift = Math.cos(index / 9) * market.volatility;
    quote = Math.max(1, quote + wave + drift + ((index % 3) - 1) * market.volatility);
    return {
      time: (now - (80 - index) * TICK_SECONDS) as UTCTimestamp,
      quote,
      digit: Math.abs(Math.floor(quote * 100)) % 10,
    };
  });
}

function nextTick(previous: Tick, market: BinaryMarket): Tick {
  const shock = (Math.random() - 0.5) * market.volatility * 7;
  const micro = Math.sin(Date.now() / 1600) * market.volatility * 1.6;
  const quote = Math.max(1, previous.quote + shock + micro);

  return {
    time: (previous.time + TICK_SECONDS) as UTCTimestamp,
    quote,
    digit: Math.abs(Math.floor(quote * 100)) % 10,
  };
}

function toTick(epoch: number, quote: number): Tick {
  return {
    time: epoch as UTCTimestamp,
    quote,
    digit: Math.abs(Math.floor(quote * 100)) % 10,
  };
}

function formatMoney(value: number, isLive = false) {
  const fmt = value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isLive ? `KSh ${fmt}` : `$${fmt}`;
}

function formatQuote(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function payoutRate(side: ContractSide) {
  if (side === "Matches") return 9.15;
  if (side === "Differs") return 1.12;
  return 1.952;
}

function familyLabel(family: ContractFamily) {
  if (family === "evenOdd") return "Even / Odd";
  if (family === "matchDiffer") return "Matches / Differs";
  return "Over / Under";
}

function familySides(family: ContractFamily): ContractSide[] {
  if (family === "evenOdd") return ["Even", "Odd"];
  if (family === "matchDiffer") return ["Matches", "Differs"];
  return ["Over", "Under"];
}

function actionLabel(side: ContractSide) {
  if (side === "Matches") return "MATCH";
  if (side === "Differs") return "DIFFER";
  return side;
}

function evaluateTrade(side: ContractSide, digit: number, targetDigit: number) {
  if (side === "Even") return digit % 2 === 0;
  if (side === "Odd") return digit % 2 === 1;
  if (side === "Matches") return digit === targetDigit;
  if (side === "Differs") return digit !== targetDigit;
  if (side === "Over") return digit > targetDigit;
  return digit < targetDigit;
}

function TradingViewBinaryChart({ ticks }: { ticks: Tick[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#070b10" },
        textColor: "#8d99ae",
        fontFamily: "var(--font-jakarta), sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.045)" },
        horzLines: { color: "rgba(148,163,184,0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 7,
        barSpacing: 12,
      },
      crosshair: {
        vertLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" },
        horzLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" },
      },
      localization: {
        priceFormatter: (price: number) => formatQuote(price),
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#e5edf8",
      lineWidth: 3,
      topColor: "rgba(59,130,246,0.28)",
      bottomColor: "rgba(59,130,246,0.02)",
      priceLineColor: "#3b82f6",
      priceLineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#93c5fd",
      crosshairMarkerBackgroundColor: "#3b82f6",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    const data: AreaData<Time>[] = ticks.map((tick) => ({
      time: tick.time,
      value: tick.quote,
    }));
    seriesRef.current.setData(data);
    chartRef.current.timeScale().scrollToRealTime();
  }, [ticks]);

  return (
    <div className="relative h-full min-h-[180px] overflow-hidden bg-[#070b10] sm:min-h-[260px]">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded border border-white/[0.07] bg-black/45 px-3 py-2 text-[11px] font-black text-slate-400 backdrop-blur">
        <span>TradingView Lightweight Chart</span>
        <span className="text-emerald-300">LIVE</span>
      </div>
    </div>
  );
}

interface BinaryClientProps {
  userId?:   string;
  username?: string;
  balance?:  number;
}

export function BinaryClient({ userId, balance: initialBalance = 0 }: BinaryClientProps) {
  const isLive = !!userId;

  const [marketSymbol, setMarketSymbol] = useState(MARKETS[0].symbol);
  const market = MARKETS.find((item) => item.symbol === marketSymbol) ?? MARKETS[0];
  const [ticks, setTicks] = useState(() => seedTicks(market));
  const [family, setFamily] = useState<ContractFamily>("evenOdd");
  const [stake, setStake] = useState(isLive ? 10 : 10);
  const [targetDigit, setTargetDigit] = useState(5);
  const [duration, setDuration] = useState(5);
  const [autoMode, setAutoMode] = useState(false);
  const [targetProfit, setTargetProfit] = useState(30);
  const [stopLoss, setStopLoss] = useState(20);
  const [multiplier, setMultiplier] = useState(1.4);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState(initialBalance);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [placing, setPlacing] = useState(false);
  const [openTrades, setOpenTrades] = useState<BinaryTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<BinaryTrade[]>([]);
  const [persistedTrades, setPersistedTrades] = useState<BinaryTrade[]>([]);
  const [transactions, setTransactions] = useState<string[]>([]);
  const [tab, setTab] = useState<"open" | "closed" | "tx">("open");

  const balance = isLive ? liveBalance : demoBalance;

  // Load persisted closed trades from DB on mount (live users only)
  useEffect(() => {
    if (!isLive) return;
    fetch("/api/binary/history")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Array<{
        id: string; market: string; side: string; stake: number; payout: number;
        targetDigit: number; entryDigit: number; exitDigit?: number; status: string; createdAt: string;
      }>) => {
        const mapped: BinaryTrade[] = data
          .filter((t) => t.status !== "PENDING")
          .map((t) => ({
            id: t.id,
            market: t.market,
            side: t.side as ContractSide,
            stake: t.stake,
            payout: t.payout,
            entryDigit: t.entryDigit,
            targetDigit: t.targetDigit,
            exitDigit: t.exitDigit,
            openedAt: new Date(t.createdAt).getTime(),
            settlesAt: 0,
            status: (t.status === "WON" ? "won" : "lost") as TradeStatus,
            isReal: true,
          }));
        setPersistedTrades(mapped);
      })
      .catch(() => {});
  }, [isLive]);

  // Merge session trades with persisted DB trades (dedup by id)
  const allClosedTrades = useMemo(() => {
    const sessionIds = new Set(closedTrades.map((t) => t.id));
    return [...closedTrades, ...persistedTrades.filter((t) => !sessionIds.has(t.id))];
  }, [closedTrades, persistedTrades]);

  useEffect(() => {
    setTicks(seedTicks(market));
    setOpenTrades([]);
    setStreamStatus("connecting");
    setStreamError(null);
  }, [market]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | undefined;
    let fallbackTimer: number | undefined;

    function startFallback(message: string) {
      if (!active || fallbackTimer) return;
      setStreamStatus("fallback");
      setStreamError(message);
      fallbackTimer = window.setInterval(() => {
        setTicks((current) => [...current.slice(-119), nextTick(current[current.length - 1], market)]);
      }, market.speedMs);
    }

    socket = new WebSocket(DERIV_WS_URL);

    socket.onopen = () => {
      if (!active || !socket) return;
      socket.send(JSON.stringify({
        ticks_history: market.derivSymbol,
        adjust_start_time: 1,
        count: 120,
        end: "latest",
        style: "ticks",
        subscribe: 1,
      }));
    };

    socket.onmessage = (event) => {
      if (!active) return;
      let response: {
        error?: { message?: string };
        history?: { prices?: number[]; times?: number[] };
        tick?: { epoch: number; quote: number };
      };

      try {
        response = JSON.parse(event.data);
      } catch {
        startFallback("Deriv returned an unreadable tick message.");
        return;
      }

      if (response.error) {
        startFallback(response.error.message ?? "Deriv tick stream returned an error.");
        return;
      }

      if (response.history?.prices?.length && response.history.times?.length) {
        const historyTicks = response.history.prices
          .map((quote, index) => toTick(response.history?.times?.[index] ?? Math.floor(Date.now() / 1000), quote))
          .filter((tick, index, all) => index === 0 || tick.time > all[index - 1].time)
          .slice(-120);
        if (historyTicks.length > 0) {
          setTicks(historyTicks);
          setStreamStatus("live");
          setStreamError(null);
        }
      }

      if (response.tick) {
        setTicks((current) => {
          const next = toTick(response.tick!.epoch, response.tick!.quote);
          const last = current[current.length - 1];
          if (last?.time === next.time) return [...current.slice(0, -1), next];
          return [...current.slice(-119), next];
        });
        setStreamStatus("live");
        setStreamError(null);
      }
    };

    socket.onerror = () => {
      startFallback("Deriv tick stream is unavailable.");
    };

    socket.onclose = () => {
      startFallback("Deriv tick stream disconnected.");
    };

    return () => {
      active = false;
      if (fallbackTimer) window.clearInterval(fallbackTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, [market]);

  const latest = ticks[ticks.length - 1];
  const previous = ticks[ticks.length - 2];

  // Refs so interval callbacks always read latest state without stale closures
  const latestRef     = useRef(latest);
  const openTradesRef = useRef(openTrades);
  const settledIds    = useRef(new Set<string>());
  useEffect(() => { latestRef.current = latest; },         [latest]);
  useEffect(() => { openTradesRef.current = openTrades; }, [openTrades]);

  const change = latest.quote - (ticks[0]?.quote ?? latest.quote);
  const changePct = (change / Math.max(1, ticks[0]?.quote ?? latest.quote)) * 100;
  const selectedSides = familySides(family);
  const payout = stake * payoutRate(selectedSides[0]);

  const digitStats = useMemo(() => {
    const recent = ticks.slice(-80);
    return DIGITS.map((digit) => {
      const count = recent.filter((tick) => tick.digit === digit).length;
      return {
        digit,
        count,
        pct: recent.length ? (count / recent.length) * 100 : 0,
      };
    });
  }, [ticks]);

  const sessionPnl = closedTrades.reduce((total, trade) => {
    if (trade.status === "won") return total + trade.payout - trade.stake;
    if (trade.status === "lost") return total - trade.stake;
    return total;
  }, 0);
  const wins = closedTrades.filter((trade) => trade.status === "won").length;
  const losses = closedTrades.filter((trade) => trade.status === "lost").length;

  const settleReal = useCallback(async (trade: BinaryTrade, exitDigit: number) => {
    try {
      const res  = await fetch("/api/binary/settle", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tradeId: trade.id, exitDigit }),
      });
      const data = await res.json() as { won?: boolean; winAmount?: number; error?: string };
      if (!res.ok) {
        console.error("binary settle failed:", data.error);
        return;
      }
      if (data.won && data.winAmount) {
        setLiveBalance((b) => b + data.winAmount!);
        window.dispatchEvent(new Event("wallet-refresh"));
      }
    } catch (err) {
      console.error("binary settle error:", err);
    }
  }, []);

  // Settle expired trades every 500 ms — works even when the tick stream stalls.
  // The settledIds ref prevents double-settlement if both a tick and the timer
  // fire in the same window.
  useEffect(() => {
    const id = setInterval(() => {
      const now    = Date.now();
      const pending = openTradesRef.current.filter(
        (t) => t.settlesAt <= now && !settledIds.current.has(t.id),
      );
      if (pending.length === 0) return;

      // Mark as in-flight before any async work
      pending.forEach((t) => settledIds.current.add(t.id));

      const digit = latestRef.current.digit;

      setOpenTrades((cur) => cur.filter((t) => !settledIds.current.has(t.id)));
      setClosedTrades((cur) => {
        const settled = pending.map((trade) => {
          const won = evaluateTrade(trade.side, digit, trade.targetDigit);
          return { ...trade, exitDigit: digit, status: won ? "won" as const : "lost" as const };
        });
        return [...settled, ...cur].slice(0, 20);
      });

      for (const trade of pending) {
        const won = evaluateTrade(trade.side, digit, trade.targetDigit);
        if (isLive && trade.isReal) {
          settleReal(trade, digit);
        } else {
          setDemoBalance((b) => won ? b + trade.payout : b);
        }
        if (won) {
          toast.cashout(
            `+${isLive ? "KSh" : "$"}${trade.payout.toFixed(2)} — Trade won!`,
            `${trade.side} · Exit digit: ${digit}`,
          );
        } else {
          toast.error(`Trade lost`, `${trade.side} · Exit digit: ${digit}`);
        }
      }

      setTab("closed");
    }, 500);

    return () => clearInterval(id);
  }, [isLive, settleReal]);

  async function placeTrade(side: ContractSide) {
    if (placing || stake <= 0) return;
    if (balance < stake) {
      toast.error("Insufficient balance", isLive ? "Please deposit to continue." : "Increase your demo balance.");
      return;
    }

    if (isLive) {
      setPlacing(true);
      try {
        const res  = await fetch("/api/binary/bet", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            market:       market.derivSymbol,
            side,
            stake,
            targetDigit,
            entryDigit:   latest.digit,
            durationTicks: duration,
          }),
        });
        const data = await res.json() as { tradeId?: string; payout?: number; error?: string };
        if (!res.ok || !data.tradeId) {
          toast.error("Trade failed", data.error ?? "Could not place trade");
          return;
        }
        const trade: BinaryTrade = {
          id:          data.tradeId,
          market:      market.symbol,
          side,
          stake,
          payout:      data.payout ?? stake * payoutRate(side),
          entryDigit:  latest.digit,
          targetDigit,
          openedAt:    Date.now(),
          settlesAt:   Date.now() + duration * 1000,
          status:      "open",
          isReal:      true,
        };
        setLiveBalance((b) => b - stake);
        window.dispatchEvent(new Event("wallet-refresh"));
        setOpenTrades((current) => [trade, ...current].slice(0, 12));
        setTransactions((current) => [`${side} ${market.symbol} KSh ${stake}`, ...current].slice(0, 12));
      } finally {
        setPlacing(false);
      }
    } else {
      const trade: BinaryTrade = {
        id:          `demo-${Date.now()}`,
        market:      market.symbol,
        side,
        stake,
        payout:      stake * payoutRate(side),
        entryDigit:  latest.digit,
        targetDigit,
        openedAt:    Date.now(),
        settlesAt:   Date.now() + duration * 1000,
        status:      "open",
        isReal:      false,
      };
      setDemoBalance((b) => b - stake);
      setOpenTrades((current) => [trade, ...current].slice(0, 12));
      setTransactions((current) => [`${side} ${market.symbol} $${stake}`, ...current].slice(0, 12));
    }
  }

  return (
    <div className="min-h-full overflow-visible bg-[#050506] pb-16 text-white xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden xl:pb-0">
      <div className="z-20 shrink-0 border-b border-white/[0.08] bg-[#08090d]/95 px-1.5 py-1 backdrop-blur lg:px-3">
        <div className="flex h-10 items-center gap-2 overflow-hidden">
          <div className="mr-1 flex shrink-0 items-center gap-2 rounded bg-[#11151c] px-2 py-1.5">
            <span className="grid h-6 w-6 place-items-center rounded bg-sky-500/15 text-sky-300">
              <Icon name="analytics" className="text-[14px]" />
            </span>
            <div className="hidden min-[380px]:block">
              <div className="text-xs font-black leading-none">Binary Trader</div>
              <div className="mt-0.5 text-[10px] font-bold text-slate-500">
                {streamStatus === "live" ? "Deriv live feed" : streamStatus === "connecting" ? "Connecting feed" : "Demo fallback"}
              </div>
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          {TOP_ACTIONS.map((item) => (
            <button key={item.label} type="button" className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-black text-slate-300 transition hover:bg-white/[0.06] hover:text-white">
              <Icon name={item.icon} className="text-[14px] text-sky-300" />
              {item.label}
            </button>
          ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="rounded bg-[#151a22] px-2 py-1.5 text-right ring-1 ring-white/[0.07] sm:px-3">
              {isLive ? (
                <>
                  <div className="font-mono text-xs font-black">KSh {liveBalance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-[10px] font-bold text-emerald-300">Live wallet</div>
                </>
              ) : (
                <>
                  <div className="font-mono text-xs font-black">{formatMoney(demoBalance)} DEMO</div>
                  <div className="text-[10px] font-bold text-amber-400">Demo — login to play live</div>
                </>
              )}
            </div>
            <button type="button" className="grid h-9 w-9 place-items-center rounded bg-[#151a22] text-slate-300 ring-1 ring-white/[0.07]">
              <Icon name="person" className="text-[16px]" />
            </button>
          </div>
        </div>
      </div>

      <div data-binary-grid="true" className="grid min-w-0 gap-1 overflow-visible px-0 py-0 sm:px-2 sm:py-2 xl:min-h-0 xl:flex-1 xl:gap-0 xl:overflow-hidden xl:border-b xl:border-white/[0.08] xl:p-0 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
        <aside className="order-2 hidden min-h-0 flex-col overflow-hidden rounded border border-white/[0.08] xl:order-none xl:flex xl:rounded-none xl:border-y-0 xl:border-l-0 xl:border-r">
          <BinaryActivityPanel
            tab={tab} setTab={setTab}
            openTrades={openTrades} allClosedTrades={allClosedTrades} transactions={transactions}
            wins={wins} losses={losses} sessionPnl={sessionPnl} isLive={isLive}
          />
        </aside>

        <main className="order-1 flex min-h-[300px] min-w-0 flex-col overflow-hidden rounded-none border-y border-white/[0.08] sm:min-h-[520px] sm:rounded sm:border xl:order-none xl:min-h-0 xl:rounded-none xl:border-0">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0f1218]">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-2 py-1.5 sm:px-4 sm:py-2">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <select
                  value={market.symbol}
                  onChange={(event) => setMarketSymbol(event.target.value)}
                  className="h-9 rounded border border-white/[0.08] bg-[#151a22] px-2 text-xs font-black text-white outline-none sm:h-10 sm:px-3 sm:text-sm"
                >
                  {MARKETS.map((item) => (
                    <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
                  ))}
                </select>
                <div>
                  <div className="font-mono text-xl font-black leading-none sm:text-2xl">{formatQuote(latest.quote)}</div>
                  <div className={`mt-0.5 text-[11px] font-black sm:mt-1 sm:text-xs ${changePct >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                  </div>
                  {streamStatus === "fallback" && (
                    <div className="mt-1 max-w-[280px] truncate text-[10px] font-bold text-amber-300">
                      {streamError ?? "Using local fallback ticks"}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded bg-black/25 p-1">
                <button type="button" className="grid h-8 w-8 place-items-center rounded bg-white/[0.06] text-slate-300">
                  <Icon name="add" className="text-[15px]" />
                </button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded bg-white/[0.06] text-slate-300">
                  <Icon name="remove_circle" className="text-[15px]" />
                </button>
              </div>
            </div>
            <TradingViewBinaryChart ticks={ticks} />
          </section>

          <section className="grid h-[100px] shrink-0 grid-cols-10 gap-0 border-t border-white/[0.08] bg-[#0b0d12] sm:h-[116px]">
            {digitStats.map((stat) => (
              <button
                key={stat.digit}
                type="button"
                onClick={() => setTargetDigit(stat.digit)}
                className={`relative flex h-full flex-col items-center justify-center border-r border-white/[0.07] last:border-r-0 transition-colors ${
                  targetDigit === stat.digit
                    ? "bg-sky-400/10 ring-1 ring-inset ring-sky-400/40"
                    : latest.digit === stat.digit
                    ? "bg-amber-400/5 hover:bg-white/[0.04]"
                    : "bg-[#0b0d12] hover:bg-white/[0.04]"
                }`}
              >
                <DigitRing stat={stat} isActive={latest.digit === stat.digit} />
                {latest.digit === stat.digit && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] leading-none text-amber-400">▲</span>
                )}
              </button>
            ))}
          </section>
        </main>

        <aside className="order-2 flex min-h-0 flex-col overflow-hidden rounded-none border-y border-white/[0.08] sm:rounded sm:border xl:order-none xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-l">
          <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0f1218]">
            <div className="shrink-0 border-b border-white/[0.07] p-2">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Trading mode</div>
              <div className="mt-1.5 grid grid-cols-2 rounded bg-black/30 p-1">
                <button onClick={() => setAutoMode(true)} type="button" className={`rounded py-1.5 text-xs font-black ${autoMode ? "bg-sky-500 text-white" : "text-slate-500"}`}>AUTO</button>
                <button onClick={() => setAutoMode(false)} type="button" className={`rounded py-1.5 text-xs font-black ${!autoMode ? "bg-sky-500 text-white" : "text-slate-500"}`}>MANUAL</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              <div className="grid grid-cols-3 gap-2">
                {(["evenOdd", "matchDiffer", "overUnder"] as ContractFamily[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFamily(item)}
                    className={`rounded border px-1.5 py-2 text-[10px] font-black transition sm:px-2 sm:text-[11px] ${family === item ? "border-sky-400 bg-sky-400/10 text-sky-200" : "border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-white"}`}
                  >
                    {familyLabel(item)}
                  </button>
                ))}
              </div>

              <div>
                <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Stake amount</div>
                <Stepper value={stake} min={1} prefix={isLive ? "KSh" : "$"} onChange={setStake} compact />
                <div className="mt-1.5 grid grid-cols-6 gap-1">
                  {(isLive ? STAKE_PRESETS_LIVE : STAKE_PRESETS_DEMO).map((amount) => (
                    <button key={amount} type="button" onClick={() => setStake(amount)} className={`rounded px-1 py-1.5 text-[10px] font-black transition sm:px-2 sm:text-[11px] ${stake === amount ? "bg-sky-500 text-white" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"}`}>
                      {isLive ? amount : `$${amount}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumberBox label="Duration" value={duration} suffix="ticks" min={3} max={30} onChange={setDuration} compact />
                <NumberBox label="Digit line" value={targetDigit} min={0} max={9} onChange={setTargetDigit} compact />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <SmallInput label="Target" value={targetProfit} prefix={isLive ? "KSh" : "$"} onChange={setTargetProfit} />
                <SmallInput label="Stop loss" value={stopLoss} prefix={isLive ? "KSh" : "$"} onChange={setStopLoss} />
                <SmallInput label="Multiplier" value={multiplier} prefix="x" step={0.1} onChange={setMultiplier} />
              </div>

              <div className="rounded border border-white/[0.07] bg-black/25 px-3 py-1.5">
                <SummaryRow label="Stake" value={formatMoney(stake, isLive)} />
                <SummaryRow label="Est. payout" value={formatMoney(payout, isLive)} positive />
                <SummaryRow label="Last digit" value={String(latest.digit)} />
                <SummaryRow label="Previous digit" value={String(previous?.digit ?? "-")} />
              </div>

            </div>

            <div className="sticky bottom-0 z-10 -mx-0 hidden grid-cols-2 gap-2 border-t border-white/[0.08] bg-[#0f1218] p-2 shadow-[0_-12px_24px_rgba(0,0,0,.35)] xl:grid">
              {selectedSides.map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => placeTrade(side)}
                  disabled={placing}
                  className={`flex items-center justify-between rounded px-3 py-2 text-left transition active:scale-[0.98] disabled:opacity-50 ${side.toLowerCase().includes("differ") || side.toLowerCase().includes("odd") || side.toLowerCase().includes("under") ? "bg-red-500 hover:bg-red-400" : "bg-[#0b8f62] hover:bg-[#0da26f]"}`}
                >
                  <div className="text-sm font-black">{placing ? "…" : actionLabel(side)}</div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-black">{formatMoney(stake * payoutRate(side), isLive)}</div>
                    <div className="text-[10px] font-black text-emerald-100/80">{((payoutRate(side) - 1) * 100).toFixed(1)}%</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

        </aside>
      </div>

      {/* Mobile-only: positions / history / session — hidden on desktop where the left rail shows it */}
      <MobileBinaryActivity
        tab={tab} setTab={setTab}
        openTrades={openTrades} allClosedTrades={allClosedTrades} transactions={transactions}
        wins={wins} losses={losses} sessionPnl={sessionPnl} isLive={isLive}
      />

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] left-0 right-0 z-40 grid grid-cols-2 gap-2 border-t border-white/[0.08] bg-[#0f1218]/95 p-2 shadow-[0_-12px_24px_rgba(0,0,0,.45)] backdrop-blur lg:bottom-0 xl:hidden">
        {selectedSides.map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => placeTrade(side)}
            disabled={placing}
            className={`flex items-center justify-between rounded px-3 py-2 text-left transition active:scale-[0.98] disabled:opacity-50 ${side.toLowerCase().includes("differ") || side.toLowerCase().includes("odd") || side.toLowerCase().includes("under") ? "bg-red-500 hover:bg-red-400" : "bg-[#0b8f62] hover:bg-[#0da26f]"}`}
          >
            <div className="text-sm font-black">{placing ? "…" : actionLabel(side)}</div>
            <div className="text-right">
              <div className="font-mono text-sm font-black">{formatMoney(stake * payoutRate(side), isLive)}</div>
              <div className="text-[10px] font-black text-emerald-100/80">{((payoutRate(side) - 1) * 100).toFixed(1)}%</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ActivityPanelProps {
  tab: "open" | "closed" | "tx";
  setTab: (t: "open" | "closed" | "tx") => void;
  openTrades: BinaryTrade[];
  allClosedTrades: BinaryTrade[];
  transactions: string[];
  wins: number;
  losses: number;
  sessionPnl: number;
  isLive: boolean;
}

// Shared Open / Closed / Tx tabs + session stats — used by the desktop rail
// and the mobile collapsible so both views show identical detail.
function BinaryActivityPanel({
  tab, setTab, openTrades, allClosedTrades, transactions, wins, losses, sessionPnl, isLive,
}: ActivityPanelProps) {
  return (
    <>
      {/* Tab bar */}
      <div className="grid shrink-0 grid-cols-3 border-b border-white/[0.07] bg-[#0f1218] text-xs font-black">
        {(["open", "closed", "tx"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-2.5 transition ${tab === t ? "border-b-2 border-sky-400 text-sky-300" : "text-slate-500 hover:text-white"}`}
          >
            {t === "open" ? `Open (${openTrades.length})` : t === "closed" ? `Closed (${allClosedTrades.length})` : "Tx"}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f1218]">
        {tab === "open" && (
          <div className="space-y-1.5 p-3">
            {openTrades.length === 0 ? (
              <EmptyState title="No open positions" subtitle="Your active contracts will appear here" />
            ) : (
              openTrades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
            )}
          </div>
        )}
        {tab === "closed" && (
          <div className="space-y-1.5 p-3">
            {allClosedTrades.length === 0 ? (
              <EmptyState title="No closed trades" subtitle="Settled contracts will show here" />
            ) : (
              allClosedTrades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
            )}
          </div>
        )}
        {tab === "tx" && (
          <div className="space-y-1.5 p-3">
            {transactions.length === 0 ? (
              <EmptyState title="No transactions" subtitle="Trade activity will appear here" />
            ) : (
              transactions.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded bg-black/25 px-3 py-2 text-xs font-bold text-slate-300">{item}</div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Session stats — always visible */}
      <section className="shrink-0 border-t border-white/[0.08] bg-[#0f1218] p-3">
        <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Session</div>
        <div className="grid grid-cols-3 gap-1.5">
          <MiniStat label="Trades" value={String(allClosedTrades.length)} />
          <MiniStat label="Wins" value={String(wins)} positive />
          <MiniStat label="Losses" value={String(losses)} negative />
        </div>
        <div className="mt-2 bg-black/25 p-2.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Session P/L</div>
          <div className={`mt-1 font-mono text-xl font-black ${sessionPnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {sessionPnl >= 0 ? "+" : ""}{formatMoney(sessionPnl, isLive)}
          </div>
        </div>
      </section>
    </>
  );
}

// Mobile-only collapsible wrapper around the activity panel (matches the
// Aviator "Live Players" collapsible). Hidden on xl where the rail shows it.
function MobileBinaryActivity(props: ActivityPanelProps) {
  const [open, setOpen] = useState(true);
  const activeCount = props.openTrades.length;
  return (
    <div className="mx-2 mb-28 mt-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f1218] sm:mx-2 xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-3 text-[12px] font-black text-white/70 transition-colors hover:text-white active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 uppercase tracking-wider">
          My Activity
          {activeCount > 0 && (
            <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-black text-sky-300">{activeCount} open</span>
          )}
        </span>
        <Icon name={open ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-[18px] text-slate-500" />
      </button>
      {open && (
        <div className="flex max-h-[60vh] flex-col overflow-hidden border-t border-white/[0.07]">
          <BinaryActivityPanel {...props} />
        </div>
      )}
    </div>
  );
}

function DigitRing({ isActive, stat }: { isActive: boolean; stat: { digit: number; pct: number } }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, stat.pct / 100)) * circumference;
  const isHot = stat.pct >= 15;

  return (
    <div className="relative flex flex-col items-center gap-0.5">
      {isHot && (
        <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-red-400" />
      )}
      <div className="relative">
        <svg width="46" height="46" viewBox="0 0 46 46" className="sm:hidden">
          <circle cx="23" cy="23" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
          <circle
            cx="23" cy="23" r={radius}
            fill="none"
            stroke={isActive ? "#f59e0b" : "#22c55e"}
            strokeWidth={isActive ? "3" : "2"}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            strokeLinecap="round"
            transform="rotate(-90 23 23)"
          />
          <text x="23" y="27" textAnchor="middle" fontSize="13" fontWeight="900" fill={isActive ? "#fbbf24" : "white"} fontFamily="monospace">{stat.digit}</text>
        </svg>
        <svg width="56" height="56" viewBox="0 0 56 56" className="hidden sm:block">
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle
            cx="28" cy="28" r="24"
            fill="none"
            stroke={isActive ? "#f59e0b" : "#22c55e"}
            strokeWidth={isActive ? "3.5" : "2.5"}
            strokeDasharray={2 * Math.PI * 24}
            strokeDashoffset={2 * Math.PI * 24 - Math.max(0, Math.min(1, stat.pct / 100)) * 2 * Math.PI * 24}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
          />
          <text x="28" y="33" textAnchor="middle" fontSize="16" fontWeight="900" fill={isActive ? "#fbbf24" : "white"} fontFamily="monospace">{stat.digit}</text>
        </svg>
      </div>
      <span className={`text-[8px] font-black sm:text-[9px] ${stat.pct > 0 ? "text-emerald-400" : "text-slate-600"}`}>
        {stat.pct.toFixed(1)}%
      </span>
    </div>
  );
}

function EmptyState({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div className="px-2 py-2 text-center">
      <div className="text-xs font-black text-slate-400">{title}</div>
      <div className="mt-0.5 text-[11px] font-bold text-slate-600">{subtitle}</div>
    </div>
  );
}

function MiniStat({ label, negative, positive, value }: { label: string; negative?: boolean; positive?: boolean; value: string }) {
  return (
    <div className="bg-black/25 px-2 py-1.5">
      <div className="text-[10px] font-black uppercase text-slate-600">{label}</div>
      <div className={`font-mono text-sm font-black ${positive ? "text-emerald-300" : negative ? "text-red-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function TradeRow({ trade }: { trade: BinaryTrade }) {
  const isOpen = trade.status === "open";
  const isWon = trade.status === "won";
  const isReal = trade.isReal ?? false;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [isOpen]);

  const secondsLeft = Math.max(0, Math.ceil((trade.settlesAt - now) / 1000));

  return (
    <div className="border border-white/[0.07] bg-black/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{trade.side}</div>
          <div className="text-[11px] font-bold text-slate-500">{trade.market} · digit {trade.entryDigit}</div>
        </div>
        <span className={`rounded px-2 py-1 text-[10px] font-black ${isOpen ? "bg-sky-400/10 text-sky-300" : isWon ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
          {isOpen ? `${secondsLeft}s` : trade.status.toUpperCase()}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-black">
        <span className="text-slate-500">Stake {formatMoney(trade.stake, isReal)}</span>
        <span className={isOpen || isWon ? "text-emerald-300" : "text-red-300"}>{isOpen ? formatMoney(trade.payout, isReal) : isWon ? `+${formatMoney(trade.payout - trade.stake, isReal)}` : `-${formatMoney(trade.stake, isReal)}`}</span>
      </div>
    </div>
  );
}

function Stepper({ compact = false, min, onChange, prefix, value }: { compact?: boolean; min: number; onChange: (value: number) => void; prefix: string; value: number }) {
  return (
    <div className={`flex items-center overflow-hidden rounded border border-white/[0.08] bg-black/25 ${compact ? "h-9" : "h-12"}`}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-full w-11 place-items-center bg-white/[0.04] text-slate-300">
        <Icon name="remove_circle" className="text-[16px]" />
      </button>
      <div className="flex min-w-0 flex-1 items-center px-3">
        <span className="font-mono text-slate-500">{prefix}</span>
        <input value={value} min={min} type="number" onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))} className={`min-w-0 flex-1 bg-transparent px-2 font-mono font-black text-white outline-none ${compact ? "text-sm" : "text-lg"}`} />
      </div>
      <button type="button" onClick={() => onChange(value + 1)} className="grid h-full w-11 place-items-center bg-white/[0.04] text-slate-300">
        <Icon name="add" className="text-[16px]" />
      </button>
    </div>
  );
}

function NumberBox({ compact = false, label, max, min, onChange, suffix, value }: { compact?: boolean; label: string; max: number; min: number; onChange: (value: number) => void; suffix?: string; value: number }) {
  return (
    <label className={`block ${compact ? "px-2 py-2" : ""}`}>
      <span className={`${compact ? "mb-1 text-[10px]" : "mb-2 text-[11px]"} block font-black uppercase tracking-wider text-slate-500`}>{label}</span>
      <div className={`flex items-center rounded border border-white/[0.08] bg-black/25 px-3 focus-within:border-sky-400 ${compact ? "h-9" : "h-11"}`}>
        <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} className="min-w-0 flex-1 bg-transparent font-mono text-sm font-black text-white outline-none" />
        {suffix && <span className="text-[10px] font-black uppercase text-slate-600">{suffix}</span>}
      </div>
    </label>
  );
}

function SmallInput({ label, onChange, prefix, step = 1, value }: { label: string; onChange: (value: number) => void; prefix: string; step?: number; value: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex h-9 items-center rounded border border-white/[0.08] bg-black/25 px-2">
        <span className="font-mono text-xs font-black text-slate-600">{prefix}</span>
        <input type="number" step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} className="min-w-0 flex-1 bg-transparent px-1 font-mono text-xs font-black text-white outline-none" />
      </div>
    </label>
  );
}

function SummaryRow({ label, positive, value }: { label: string; positive?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-1.5 last:border-0">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`font-mono text-sm font-black ${positive ? "text-emerald-300" : "text-white"}`}>{value}</span>
    </div>
  );
}
