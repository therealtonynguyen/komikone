import { describe, expect, it } from 'vitest';
import type { EventSummary } from './api';
import { pickLiveBoard } from './liveBoard';

function event(over: Partial<EventSummary> & Pick<EventSummary, 'id' | 'reg_type' | 'status'>): EventSummary {
  return { year: 2027, name: over.reg_type === 'open' ? 'Open' : 'Return', ...over };
}

describe('pickLiveBoard', () => {
  it('stays on Return while that sale is the one in progress', () => {
    const board = pickLiveBoard([
      event({ id: 1, reg_type: 'return', status: 'purchasing' }),
      event({ id: 2, reg_type: 'open', status: 'setup' }),
    ]);
    expect(board?.id).toBe(1);
  });

  it('moves to Open Reg once Return is finished and Open is the live sale', () => {
    const board = pickLiveBoard([
      event({ id: 1, reg_type: 'return', status: 'payment' }),
      event({ id: 2, reg_type: 'open', status: 'purchasing' }),
    ]);
    expect(board?.reg_type).toBe('open');
  });

  it('opens Open Reg registration instead of a Return board that is already in payback', () => {
    const board = pickLiveBoard([
      event({ id: 1, reg_type: 'return', status: 'complete' }),
      event({ id: 2, reg_type: 'open', status: 'registration' }),
    ]);
    expect(board?.id).toBe(2);
  });

  it('uses the latest year when older cons are still in the list', () => {
    const board = pickLiveBoard([
      event({ id: 9, year: 2026, reg_type: 'open', status: 'purchasing' }),
      event({ id: 2, year: 2027, reg_type: 'open', status: 'registration' }),
      event({ id: 1, year: 2027, reg_type: 'return', status: 'complete' }),
    ]);
    expect(board?.id).toBe(2);
  });
});
