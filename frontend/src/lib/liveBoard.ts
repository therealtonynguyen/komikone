import type { EventSummary } from './api';

/**
 * Which board the Live Board link should open.
 * Purchasing beats registration, which beats a board that is only being set up.
 * A finished Return Reg loses to an Open Reg that has not finished.
 * A tie goes to Open Reg, because that sale comes after Return.
 */
const PHASE: Record<EventSummary['status'], number> = {
  purchasing: 0,
  registration: 1,
  setup: 2,
  payment: 3,
  complete: 4,
};

export function pickLiveBoard(events: EventSummary[]): EventSummary | undefined {
  if (events.length === 0) return undefined;
  const year = Math.max(...events.map((e) => e.year));
  const inYear = events.filter((e) => e.year === year);
  return [...inYear].sort((a, b) => {
    const byPhase = PHASE[a.status] - PHASE[b.status];
    if (byPhase !== 0) return byPhase;
    if (a.reg_type !== b.reg_type) return a.reg_type === 'open' ? -1 : 1;
    return b.id - a.id;
  })[0];
}
