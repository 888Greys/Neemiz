"use client";

import { useMemo } from "react";

export type TicketData = {
  id: string;
  ticketCode: string;
  shopName: string;
  shopCode: string;
  roundNumber: number;
  stake: number;
  autoCashout: number | null;
  placedAt: string;
};

export function ThermalTicket({ ticket }: { ticket: TicketData }) {
  const formattedDate = useMemo(() => {
    try {
      return new Date(ticket.placedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ticket.placedAt;
    }
  }, [ticket.placedAt]);

  return (
    <div className="ticket-print-container hidden print:block print:w-[78mm] print:p-2 print:text-black print:font-mono print:text-xs">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .ticket-print-container, .ticket-print-container * { visibility: visible; }
          .ticket-print-container { position: absolute; left: 0; top: 0; width: 78mm; }
        }
      `}</style>
      
      <div className="text-center font-bold text-sm uppercase tracking-wider mb-1">
        {ticket.shopName}
      </div>
      <div className="text-center text-[10px] uppercase mb-2">
        Branch: {ticket.shopCode} | Aviator Retail
      </div>
      
      <div className="border-t border-b border-black py-1.5 my-1 text-center">
        <div className="text-[10px] text-gray-600">TICKET CODE</div>
        <div className="text-xl font-black tracking-widest my-0.5">{ticket.ticketCode}</div>
        
        {/* Simple barcode visual pattern */}
        <div className="flex justify-center items-center gap-[2px] h-8 my-1 bg-black p-1">
          <div className="w-1 h-full bg-white"></div>
          <div className="w-2 h-full bg-white"></div>
          <div className="w-1 h-full bg-white"></div>
          <div className="w-3 h-full bg-white"></div>
          <div className="w-1 h-full bg-white"></div>
          <div className="w-2 h-full bg-white"></div>
          <div className="w-1 h-full bg-white"></div>
          <div className="w-2 h-full bg-white"></div>
          <div className="w-3 h-full bg-white"></div>
          <div className="w-1 h-full bg-white"></div>
        </div>
      </div>

      <div className="space-y-1 my-2 text-xs">
        <div className="flex justify-between">
          <span>Game:</span>
          <span className="font-bold">Aviator Crash</span>
        </div>
        <div className="flex justify-between">
          <span>Round #:</span>
          <span className="font-bold">#{ticket.roundNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Stake:</span>
          <span className="font-bold">KSh {ticket.stake.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Target Multiplier:</span>
          <span className="font-bold">
            {ticket.autoCashout ? `${ticket.autoCashout.toFixed(2)}x` : "Manual Cashout"}
          </span>
        </div>
        {ticket.autoCashout && (
          <div className="flex justify-between text-emerald-800">
            <span>Potential Payout:</span>
            <span className="font-bold">
              KSh {(ticket.stake * ticket.autoCashout).toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex justify-between text-[10px] text-gray-600 pt-1">
          <span>Date:</span>
          <span>{formattedDate}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black pt-2 mt-2 text-[9px] text-center space-y-0.5">
        <div>Hand receipt to cashier for cash redemption.</div>
        <div>Valid for 7 days post-round. Terms Apply.</div>
      </div>
    </div>
  );
}
