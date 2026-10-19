import { useState } from 'react';
import type { EventDetail, Participant } from '../lib/api';
import {
  BLOCKER_LABEL,
  holdsClaimSlot,
  isClaimLive,
  nothingLeftToBuy,
  purchaseBlockers,
} from '../lib/purchaseBoard';

/**
 * Who you should be buying for: yourself, people you added, and your group.
 * Claiming one of them does not add them to your saved list and does not need a place in line.
 */
export function WhoToBuyForPanel({
  people, event, myDisplayName, now, reasonFor, onClaim, onRelease, onDismiss,
}: {
  people: Participant[];
  event: EventDetail | null;
  myDisplayName: string;
  now: number;
  reasonFor: (p: Participant) => string;
  onClaim: (p: Participant) => Promise<void>;
  onRelease: (p: Participant) => Promise<void>;
  onDismiss: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const run = async (p: Participant, action: (p: Participant) => Promise<void>) => {
    setBusyId(p.id);
    try { await action(p); } finally { setBusyId(null); }
  };

  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] rounded-t-2xl shadow-2xl border-t sm:static sm:z-auto sm:max-h-none sm:rounded-none sm:shadow-none sm:border-t-0 sm:border-l sm:w-80 shrink-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col min-h-0">
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase tracking-widest">Who to buy for</div>
          <button type="button" onClick={onDismiss} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm px-1.5" aria-label="Close">✕</button>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-[11px] mt-1 leading-snug">
          You, people you added, and your group. Claim locks that one person for you. It does not add them to your list, and you do not have to be in line.
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
        {people.length === 0 && (
          <li className="px-3 py-6 text-sm text-gray-500">Nobody left for you to buy for.</li>
        )}
        {people.map((p) => {
          const mine = holdsClaimSlot(p, myDisplayName, now);
          const taken = !mine && isClaimLive(p, now);
          const done = nothingLeftToBuy(p);
          const blockers = purchaseBlockers(p, event);
          const canClaim = !mine && !taken && !done && blockers.length === 0;
          return (
            <li key={p.id} className="px-3 py-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {p.first_name} {p.last_name}
                </div>
                <div className="text-[11px] text-gray-500 leading-snug">
                  {mine ? 'You claimed them' : taken ? `${p.purchasing_claimed_by} claimed them` : done ? 'Done' : reasonFor(p)}
                </div>
                {blockers.length > 0 && !done && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    {blockers.map((b) => BLOCKER_LABEL[b]).join(' · ')}
                  </div>
                )}
              </div>
              {mine ? (
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => void run(p, onRelease)}
                  className="shrink-0 text-[11px] font-bold text-gray-500 hover:text-red-600 underline disabled:opacity-50"
                >
                  Release
                </button>
              ) : canClaim ? (
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => void run(p, onClaim)}
                  className="shrink-0 text-[11px] font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 px-2 py-1 rounded"
                >
                  {busyId === p.id ? 'Claiming…' : 'Claim'}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
