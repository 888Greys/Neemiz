export const PROFIT_RETENTION_RATE = 0.30;
export const USER_PROFIT_RATE = 1 - PROFIT_RETENTION_RATE;

export function applyProfitRetention(stake: number, grossPayout: number) {
  if (!Number.isFinite(stake) || !Number.isFinite(grossPayout)) return 0;
  if (grossPayout <= stake) return Number(grossPayout.toFixed(2));
  return Number((stake + (grossPayout - stake) * USER_PROFIT_RATE).toFixed(2));
}

export function retainedProfit(stake: number, grossPayout: number) {
  if (!Number.isFinite(stake) || !Number.isFinite(grossPayout) || grossPayout <= stake) return 0;
  return Number(((grossPayout - stake) * PROFIT_RETENTION_RATE).toFixed(2));
}

export function applyForexProfitRetention(margin: number, profitLoss: number) {
  if (!Number.isFinite(margin) || !Number.isFinite(profitLoss)) return 0;
  if (profitLoss <= 0) return Number(Math.max(0, margin + profitLoss).toFixed(2));
  return Number((margin + profitLoss * USER_PROFIT_RATE).toFixed(2));
}
