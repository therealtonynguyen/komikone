import { useState } from 'react';
import type { Participant, SaleDay } from '../lib/api';
import { SALE_DAYS, SALE_DAY_FULL, isClaimLive } from '../lib/purchaseBoard';

const fullName = (p: Participant) => `${p.first_name} ${p.last_name}`.trim();

function dayBuyer(p: Participant, day: SaleDay): string {
  return (p[`who_${day}`] ?? '').trim();
}

/** One name, or Split when the bought days were paid for by different people. */
export function buyerLabel(p: Participant): string {
  const names = SALE_DAYS
    .filter((d) => p[`pur_${d}`])
    .map((d) => dayBuyer(p, d))
    .filter(Boolean);
  const unique: string[] = [];
  for (const name of names) {
    if (!unique.some((u) => u.toLowerCase() === name.toLowerCase())) unique.push(name);
  }
  if (unique.length > 1) return 'Split';
  if (unique.length === 1) return unique[0];
  return p.who_purchased.trim();
}

/**
 * Record which days were bought and who paid, without claiming the person.
 * Opening this card does not take or release a claim.
 */
export function BoughtForCard({
  person, people, canRecord, canMarkUnrequested, now, onSaveDay, onClose,
}: {
  person: Participant;
  people: Participant[];
  canRecord: boolean;
  /** Admin can record a substitute day that was never requested. */
  canMarkUnrequested: boolean;
  now: number;
  onSaveDay: (day: SaleDay, bought: boolean, buyer: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<SaleDay | null>(null);
  const [otherDay, setOtherDay] = useState<SaleDay | null>(null);
  const [otherName, setOtherName] = useState('');

  const names = [...people]
    .map(fullName)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const days = SALE_DAYS.filter((d) => canMarkUnrequested || person[`req_${d}`] || person[`pur_${d}`]);
  const claimed = isClaimLive(person, now);

  const save = async (day: SaleDay, bought: boolean, buyer: string) => {
    setBusy(day);
    try { await onSaveDay(day, bought, buyer); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Bought for ${fullName(person)}`}
      >
        <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Bought for</div>
            <h2 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{fullName(person)}</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {claimed
                ? `${person.purchasing_claimed_by} has them claimed. Recording a day leaves that claim alone.`
                : 'Recording a day does not claim them.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-lg px-1" aria-label="Close">✕</button>
        </div>

        <ul className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {days.map((day) => {
            const bought = !!person[`pur_${day}`];
            const buyer = dayBuyer(person, day);
            const onBoard = names.some((n) => n.toLowerCase() === buyer.toLowerCase());
            const selectValue = otherDay === day
              ? '__other__'
              : !buyer ? '' : onBoard ? names.find((n) => n.toLowerCase() === buyer.toLowerCase())! : '__other__';
            return (
              <li key={day} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={bought}
                    disabled={!canRecord || busy === day}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (!next) setOtherDay((d) => (d === day ? null : d));
                      void save(day, next, next ? buyer : '');
                    }}
                    className="w-4 h-4 accent-green-600"
                  />
                  {SALE_DAY_FULL[day]}
                  {!person[`req_${day}`] && <span className="text-[10px] font-bold text-amber-600">Not requested</span>}
                </label>
                {bought && (
                  <div className="mt-2">
                    <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Purchaser</label>
                    <select
                      value={selectValue}
                      disabled={!canRecord || busy === day}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '__other__') {
                          setOtherDay(day);
                          setOtherName(onBoard ? '' : buyer);
                          return;
                        }
                        setOtherDay((d) => (d === day ? null : d));
                        void save(day, true, value);
                      }}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-gray-50"
                    >
                      <option value="">Who paid?</option>
                      {names.map((n) => <option key={n} value={n}>{n}</option>)}
                      <option value="__other__">Someone else…</option>
                    </select>
                    {buyer && !onBoard && otherDay !== day && (
                      <p className="text-xs text-gray-700 dark:text-gray-200 mt-1">{buyer}</p>
                    )}
                    {otherDay === day && (
                      <form
                        className="mt-2 flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = otherName.trim();
                          if (!name) return;
                          void save(day, true, name).then(() => setOtherDay(null));
                        }}
                      >
                        <input
                          autoFocus
                          value={otherName}
                          onChange={(e) => setOtherName(e.target.value)}
                          placeholder="Name"
                          className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-gray-50"
                        />
                        <button type="submit" className="text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 px-3 rounded">
                          Save
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
