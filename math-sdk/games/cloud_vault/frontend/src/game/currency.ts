/** Currency comes from the wallet (or the explicit replay URL), never locale.
 * Amounts stay in their original currency; no exchange-rate conversion. */
const META:Record<string,{symbol:string;digits:number;post?:boolean}>={
 USD:{symbol:'$',digits:2},CAD:{symbol:'CA$',digits:2},JPY:{symbol:'¥',digits:0},EUR:{symbol:'€',digits:2},
 RUB:{symbol:'₽',digits:2},CNY:{symbol:'CN¥',digits:2},PHP:{symbol:'₱',digits:2},INR:{symbol:'₹',digits:2},
 IDR:{symbol:'Rp',digits:0},KRW:{symbol:'₩',digits:0},BRL:{symbol:'R$',digits:2},MXN:{symbol:'MX$',digits:2},
 DKK:{symbol:'kr',digits:2,post:true},PLN:{symbol:'zł',digits:2,post:true},VND:{symbol:'₫',digits:0,post:true},
 // Stake.US social coins.
 XSC:{symbol:'SC',digits:2,post:true},XGC:{symbol:'GC',digits:2,post:true},XEC:{symbol:'SC',digits:2,post:true},
};
// Reuse number formatters across animation frames; precision and currency remain unchanged.
const FORMATTERS=new Map<string,Intl.NumberFormat>();

/** Stake Engine: wins (payouts) show up to 4 decimals; balances, bets and prices keep the currency's own (2 for USD). */
export const WIN_MAX_DIGITS=4;

/** Plain number (board win labels show no symbol). Board labels are wins, so up to 4 decimals. */
export function formatPlain(amount:number,currency:string,reference=amount,maxDigits=WIN_MAX_DIGITS){
 const s=formatCurrency(amount,currency,'en-US',reference,maxDigits);const m=META[currency.toUpperCase()]??{symbol:currency.toUpperCase(),post:true};
 return (m.post?s.slice(0,-(m.symbol.length+1)):s.slice(m.symbol.length)).trim();
}
/**
 * Money in the wallet's currency. By default (balance, bet, prices) exactly the currency's decimals, never more.
 * Wins pass maxDigits=WIN_MAX_DIGITS: an authoritative sub-cent win then shows its decimals, up to 4.
 */
export function formatCurrency(amount:number,currency:string,locale='en-US',reference=amount,maxDigits?:number){
 const code=currency.toUpperCase(),m=META[code]??{symbol:code,digits:2,post:true};
 const value=Number.isFinite(amount)?amount:0;
 const cap=Math.max(m.digits,maxDigits??m.digits);
 // Count-ups use the final authoritative amount as the precision reference.
 // Easing fractions never invent additional visible decimal places.
 const units=Math.round(Math.abs(Number.isFinite(reference)?reference:0)*10**cap);
 let digits=cap;while(digits>m.digits&&units%10**(cap-digits+1)===0)digits--;
 const key=`${locale}:${digits}`;
 let formatter=FORMATTERS.get(key);
 if(!formatter){formatter=new Intl.NumberFormat(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits});FORMATTERS.set(key,formatter);}
 const number=formatter.format(value);
 return m.post?`${number} ${m.symbol}`:`${m.symbol}${number}`;
}
export const SUPPORTED_CURRENCIES=Object.keys(META);
