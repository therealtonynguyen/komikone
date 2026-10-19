import { describe, expect, it } from 'vitest';
import type { Participant } from './api';
import { payback } from './payback';

function person(over: Partial<Participant> & Pick<Participant, 'id' | 'first_name' | 'last_name'>): Participant {
  return {
    event_id: 2,
    member_id: '',
    email: '',
    badge_type: 'ADULT',
    return_eligible: true,
    notes: '',
    req_preview: false, req_thu: false, req_fri: false, req_sat: true, req_sun: false,
    sort_order: 0,
    purchasing_coordinator: '',
    purchasing_claimed_by: '',
    purchasing_claimed_at: null,
    purchasing_claimed_queue_id: null,
    pur_preview: false, pur_thu: false, pur_fri: false, pur_sat: false, pur_sun: false,
    who_purchased: '',
    paid: false,
    gaps: [],
    sold_out_gaps: [],
    all_purchased: false,
    any_purchased: false,
    purchase_total: 0,
    claim_active: false,
    created_at: '',
    group_id: null,
    group_name: null,
    group_color: null,
    group_owner_clerk_user_id: null,
    clerk_user_id: null,
    registered_by_clerk_user_id: null,
    updated_at: '',
    ...over,
  };
}

describe('payback', () => {
  const me = person({ id: 1, first_name: 'Alex', last_name: 'Nguyen', purchase_total: 9500, pur_sat: true, who_purchased: 'Tony Nguyen' });
  const kid = person({ id: 2, first_name: 'Sam', last_name: 'Nguyen', purchase_total: 5500, pur_sun: true, who_purchased: 'Tony Nguyen' });
  const henry = person({ id: 3, first_name: 'Henry', last_name: 'Garcia', purchase_total: 9500, pur_sat: true, who_purchased: 'Alex Nguyen' });
  const selfBought = person({ id: 4, first_name: 'Alex', last_name: 'Nguyen', purchase_total: 4000, pur_fri: true, who_purchased: 'Alex Nguyen' });

  it('says the household owes the person who bought their badges', () => {
    const { owe, owedToMe } = payback([me, kid, henry], {
      myName: 'Alex Nguyen',
      myId: 1,
      householdIds: new Set([1, 2]),
    });

    expect(owe).toHaveLength(1);
    expect(owe[0].buyer).toBe('Tony Nguyen');
    expect(owe[0].cents).toBe(15000);
    expect(owe[0].lines.map((l) => l.name)).toEqual(['Alex Nguyen', 'Sam Nguyen']);
    expect(owedToMe.map((l) => l.name)).toEqual(['Henry Garcia']);
  });

  it('does not bill you for a badge you bought yourself', () => {
    const { owe, owedToMe } = payback([selfBought], {
      myName: 'Alex Nguyen',
      myId: 4,
      householdIds: new Set([4]),
    });
    expect(owe).toEqual([]);
    expect(owedToMe).toEqual([]);
  });

  it('groups a missing buyer separately and skips paid amounts in the unpaid total', () => {
    const paid = person({ ...me, paid: true });
    const unknown = person({ id: 9, first_name: 'Sam', last_name: 'Nguyen', purchase_total: 2000, pur_fri: true, who_purchased: '' });
    const { owe } = payback([paid, unknown], {
      myName: 'Alex Nguyen',
      myId: 1,
      householdIds: new Set([1, 9]),
    });
    const tony = owe.find((b) => b.buyer === 'Tony Nguyen');
    const missing = owe.find((b) => b.buyer === '');
    expect(tony?.unpaidCents).toBe(0);
    expect(tony?.cents).toBe(9500);
    expect(missing?.unpaidCents).toBe(2000);
  });
});
