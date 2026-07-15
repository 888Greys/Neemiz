export const DEV_FAST = process.env.NEXT_PUBLIC_DEV_FAST === "1";

export const DEV_FAST_WALLET_STATE = {
  balance: 0,
  bonusBalance: 0,
  forexBalance: 0,
  currency: "KES",
  cryptoBalances: [],
  loading: false,
};

export const DEV_FAST_P2P_STATS = {
  volume24h: 0,
  trades24h: 0,
  tradesAllTime: 0,
  trades: 0,
  activeOffers: 0,
  onlineMerchants: 0,
  avgReleaseMin: 0,
  feePct: 0,
};
