import type { Participant } from './api';
import { SALE_DAYS, SALE_DAY_LABEL } from './purchaseBoard';

export function samePerson(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function boughtDayLabels(p: Participant): string[] {
  return SALE_DAYS.filter((d) => p[`pur_${d}`]).map((d) => SALE_DAY_LABEL[d]);
}

export type PayLine = {
  id: number;
  name: string;
  days: string[];
  cents: number;
  paid: boolean;
};

export type PayBill = {
  /** Buyer to pay. Empty when the board never recorded who bought. */
  buyer: string;
  lines: PayLine[];
  cents: number;
  unpaidCents: number;
};

function lineOf(p: Participant): PayLine {
  return {
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
    days: boughtDayLabels(p),
    cents: p.purchase_total,
    paid: !!p.paid,
  };
}

function bill(buyer: string, lines: PayLine[]): PayBill {
  return {
    buyer,
    lines,
    cents: lines.reduce((s, l) => s + l.cents, 0),
    unpaidCents: lines.filter((l) => !l.paid).reduce((s, l) => s + l.cents, 0),
  };
}

/**
 * Who the signed-in household pays, and who owes the buyer back.
 * One buyer is stored per person today, so a badge split across two buyers
 * still shows under whichever name was recorded last.
 */
export function payback(
  participants: Participant[],
  opts: { myName: string; myId: number | null; householdIds: Set<number> },
): { owe: PayBill[]; owedToMe: PayLine[] } {
  const oweMap = new Map<string, PayLine[]>();
  const owedToMe: PayLine[] = [];

  for (const p of participants) {
    if (p.purchase_total <= 0) continue;
    const buyer = p.who_purchased.trim();
    const iBought = !!opts.myName && !!buyer && samePerson(buyer, opts.myName);
    const inHousehold = opts.householdIds.has(p.id);
    const isMe = opts.myId != null && p.id === opts.myId;

    if (inHousehold && !iBought) {
      const list = oweMap.get(buyer) ?? [];
      list.push(lineOf(p));
      oweMap.set(buyer, list);
    }
    if (iBought && !isMe) owedToMe.push(lineOf(p));
  }

  const owe = [...oweMap.entries()]
    .map(([buyer, lines]) => bill(buyer, lines))
    .sort((a, b) => b.unpaidCents - a.unpaidCents || b.cents - a.cents);

  owedToMe.sort((a, b) => Number(a.paid) - Number(b.paid) || b.cents - a.cents);
  return { owe, owedToMe };
}
