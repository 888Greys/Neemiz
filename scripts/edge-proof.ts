// LIVE per-symbol edge proof: measure each symbol's data-driven edge, then show
// out-of-sample RTP for Rise/Fall priced at that edge. Read-only.
import { measureSymbolEdge, priceDirectionalContract, sampleWindows, type Window } from "@/lib/binary/pricing";
import { resolveContract, type ResolveParams } from "@/lib/binary/kernel";
import { makeRng } from "@/lib/binary/fairness";
const SYMBOLS = ["1HZ10V","1HZ25V","1HZ50V","1HZ75V","1HZ100V","R_10","R_25","R_50","R_75","R_100","JD10"];
const DUR = 8;
function fetchTicks(sym:string):Promise<number[]>{return new Promise(res=>{const ws=new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");const to=setTimeout(()=>{try{ws.close()}catch{}res([])},12000);ws.onopen=()=>ws.send(JSON.stringify({ticks_history:sym,count:8000,end:"latest",style:"ticks"}));ws.onmessage=(e:MessageEvent)=>{const d=JSON.parse(String(e.data));if(d.history){clearTimeout(to);ws.close();res(d.history.prices.map(Number))}if(d.error){clearTimeout(to);ws.close();res([])}};ws.onerror=()=>{clearTimeout(to);res([])};});}
const pct=(x:number)=>(x*100).toFixed(1)+"%";
function rtp(ticks:number[],side:"RISE"|"FALL",mult:number):number{const w=sampleWindows(ticks,DUR,30000,makeRng(7));let pay=0;for(const win of w){const p:ResolveParams={kind:"RISE_FALL",side,entrySpot:win.entry,barrier:null,durationTicks:DUR,stake:1,payout:1,payoutPerPoint:null};const r=resolveContract(p,win.forward.map((price,k)=>({price,epoch:k+1})));if(r.ready&&r.won)pay+=mult;}return pay/w.length;}
async function main(){
  console.log("symbol    per-symbol edge   Rise RTP   Fall RTP");
  let worst=0;
  for(const sym of SYMBOLS){const ticks=await fetchTicks(sym);if(ticks.length<2000){console.log(`${sym}: fail`);continue;}
    const mid=ticks.length>>1,train=ticks.slice(0,mid),test=ticks.slice(mid);
    const edge=measureSymbolEdge(train);
    const cfg={edgeFloor:edge,z:2.58,samples:4000,maxWinProb:0.90,maxMultiplier:50,minTicks:500};
    let line="";
    for(const side of ["RISE","FALL"] as const){const q=priceDirectionalContract("RISE_FALL",side,null,DUR,train,cfg);const r=q.accepted?rtp(test,side,q.payoutMultiplier):0;worst=Math.max(worst,r);line+=`  ${pct(r).padStart(7)}${r>1?"❌":"✅"}`;}
    console.log(`${sym.padEnd(8)}  ${pct(edge).padStart(6)}          ${line}`);
  }
  console.log(`\nworst-case RTP: ${pct(worst)}  ${worst<=1?"✅ house-safe on every symbol":"⚠️"}`);
}
main();
