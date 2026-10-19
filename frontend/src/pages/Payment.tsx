import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api, type EventDetail, type Participant, type Coordinator, formatDollars } from '../lib/api';
import { AppPage } from '../components/AppPage';
import { payback, type PayBill, type PayLine } from '../lib/payback';

export default function Payment() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [error, setError] = useState('');

  // Coordinator self-entry
  const [myCoordName, setMyCoordName] = useState('');
  const [coordForm, setCoordForm] = useState({ venmo: '', zelle: '', paypal: '', phone_last4: '' });
  const [coordSaved, setCoordSaved] = useState(false);
  const [profilePrefill, setProfilePrefill] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/sign-in?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    if (!eventId) return;
    getToken({ template: 'komikone' }).then((tok) => {
      if (!tok) return;
      Promise.all([
        api.events.get(Number(eventId), tok),
        api.participants.list(Number(eventId), tok, { includeIneligible: true }),
        api.coordinators.list(Number(eventId), tok),
        api.profile.get(tok).catch(() => null),
        api.participants.getMyIdentity(Number(eventId), tok).catch(() => null),
      ]).then(([ev, ps, cs, profile, identity]) => {
        setEvent(ev);
        setParticipants(ps);
        setCoordinators(cs);
        const linked = identity?.linked ? identity.participant ?? null : null;
        setMe(linked);
        if (linked) {
          const name = `${linked.first_name} ${linked.last_name}`.trim();
          setMyCoordName((n) => n || name);
        }
        if (profile && !profilePrefill) {
          setCoordForm((f) => ({
            ...f,
            venmo: f.venmo || profile.venmo || '',
            zelle: f.zelle || profile.zelle || '',
            paypal: f.paypal || profile.paypal || '',
          }));
          setProfilePrefill(true);
        }
      }).catch((e) => setError(e.message));
    });
  }, [isLoaded, isSignedIn, eventId, getToken, navigate, profilePrefill]);

  // Group participants by who_purchased
  const byCoordinator: Record<string, Participant[]> = {};
  for (const p of participants) {
    const coord = p.who_purchased || '(unknown)';
    if (!byCoordinator[coord]) byCoordinator[coord] = [];
    byCoordinator[coord].push(p);
  }

  const handleCoordSave = async () => {
    if (!myCoordName.trim()) return;
    try {
      const tok = await getToken({ template: 'komikone' });
      if (!tok) return;
      await api.coordinators.upsert(Number(eventId), myCoordName, tok, coordForm);
      // Keep dashboard billing profile in sync so handles aren't siloed
      await api.profile.update(tok, {
        venmo: coordForm.venmo,
        zelle: coordForm.zelle,
        paypal: coordForm.paypal,
      }).catch(() => {});
      const cs = await api.coordinators.list(Number(eventId), tok);
      setCoordinators(cs);
      setCoordSaved(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleMarkPaid = async (p: Participant) => {
    try {
      const tok = await getToken({ template: 'komikone' });
      if (!tok) return;
      await api.participants.markPaid(Number(eventId), p.id, tok, !p.paid);
      const ps = await api.participants.list(Number(eventId), tok, { includeIneligible: true });
      setParticipants(ps);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  if (!isLoaded || (!event && !error)) {
    return (
      <AppPage title="Payment">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading…</div>
        </div>
      </AppPage>
    );
  }

  if (error) {
    return (
      <AppPage title="Payment">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-400">{error}</div>
        </div>
      </AppPage>
    );
  }

  const unpaidTotal = participants
    .filter((p) => !p.paid && p.purchase_total > 0)
    .reduce((sum, p) => sum + p.purchase_total, 0);

  const clerkId = user?.id ?? null;
  const householdIds = new Set<number>();
  if (me) householdIds.add(me.id);
  if (clerkId) {
    for (const p of participants) {
      if (p.clerk_user_id === clerkId || p.registered_by_clerk_user_id === clerkId) householdIds.add(p.id);
    }
  }
  const myName = me ? `${me.first_name} ${me.last_name}`.trim() : '';
  const { owe, owedToMe } = payback(participants, { myName, myId: me?.id ?? null, householdIds });
  const iOwe = owe.reduce((s, b) => s + b.unpaidCents, 0);
  const theyOwe = owedToMe.filter((l) => !l.paid).reduce((s, l) => s + l.cents, 0);

  const coordinatorFor = (name: string) => {
    const key = name.trim().toLowerCase();
    return coordinators.find((c) => c.name.trim().toLowerCase() === key);
  };

  return (
    <AppPage title={event?.name ?? 'Payment'} backTo={{ to: '/', label: '← Home' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <p className="text-gray-400 text-sm mb-6">Who to pay back</p>

        {!me && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3 mb-6 text-sm text-amber-900 dark:text-amber-100">
            Link yourself on the Live Board to see your own bill. The full list is still below.
          </div>
        )}

        {me && (
          <section className="mb-8 space-y-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 sm:p-5">
              <p className="text-xs uppercase tracking-wider text-gray-500">You owe</p>
              <p className="text-3xl font-mono font-semibold text-gray-900 dark:text-white mt-1">{formatDollars(iOwe)}</p>
              <p className="text-sm text-gray-500 mt-1">
                Badges bought for you{householdIds.size > 1 ? ' and people you added' : ''}. The $15 handling fee is included once per person.
              </p>
            </div>

            {owe.length === 0 && (
              <p className="text-sm text-gray-500">Nothing to pay back. Nobody else is recorded as buying your badges.</p>
            )}

            {owe.map((bill) => (
              <BillCard key={bill.buyer || 'unknown'} bill={bill} info={coordinatorFor(bill.buyer)} />
            ))}

            <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 sm:p-5">
              <p className="text-xs uppercase tracking-wider text-gray-500">Owed to you</p>
              <p className="text-3xl font-mono font-semibold text-gray-900 dark:text-white mt-1">{formatDollars(theyOwe)}</p>
              <p className="text-sm text-gray-500 mt-1">
                People whose badges were bought under your name.
              </p>
              {owedToMe.length === 0 ? (
                <p className="text-sm text-gray-500 mt-3">You are not listed as the buyer for anyone else.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800">
                  {owedToMe.map((line) => (
                    <PayLineRow key={line.id} line={line} onToggle={() => {
                      const p = participants.find((x) => x.id === line.id);
                      if (p) handleMarkPaid(p);
                    }} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Coordinator self-entry */}
        <section className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-5 mb-8">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">How people pay you</h2>
          <p className="text-gray-400 text-sm mb-4">
            Save Venmo, Zelle, or PayPal so the people you bought for can send it back.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Your Name (as listed in the board)</label>
              <input
                type="text"
                value={myCoordName}
                onChange={(e) => setMyCoordName(e.target.value)}
                placeholder="e.g. Tony"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-50 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone last 4 (for Zelle)</label>
              <input
                type="text"
                value={coordForm.phone_last4}
                maxLength={4}
                onChange={(e) => setCoordForm((f) => ({ ...f, phone_last4: e.target.value }))}
                placeholder="1234"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-50 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Venmo handle</label>
              <input
                type="text"
                value={coordForm.venmo}
                onChange={(e) => setCoordForm((f) => ({ ...f, venmo: e.target.value }))}
                placeholder="@handle"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-50 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Zelle (phone or email)</label>
              <input
                type="text"
                value={coordForm.zelle}
                onChange={(e) => setCoordForm((f) => ({ ...f, zelle: e.target.value }))}
                placeholder="phone or email"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-50 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">PayPal (handle or email)</label>
              <input
                type="text"
                value={coordForm.paypal}
                onChange={(e) => setCoordForm((f) => ({ ...f, paypal: e.target.value }))}
                placeholder="@handle"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-gray-50 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleCoordSave}
            className="bg-blue-600 hover:bg-blue-500 text-white dark:text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            Save Payment Info
          </button>
          {coordSaved && <span className="ml-3 text-green-400 text-sm">Saved!</span>}
        </section>

        {/* Summary */}
        {unpaidTotal > 0 && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            <span className="text-red-700 dark:text-red-300 font-medium">Outstanding: </span>
            <span className="text-gray-900 dark:text-white font-mono">{formatDollars(unpaidTotal)}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-2">total unpaid across all participants</span>
          </div>
        )}

        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Everyone</h2>

        {/* By coordinator */}
        {Object.entries(byCoordinator)
          .filter(([, ps]) => ps.some((p) => p.purchase_total > 0))
          .map(([name, ps]) => {
            const info = coordinatorFor(name === '(unknown)' ? '' : name);
            const total = ps.reduce((s, p) => s + p.purchase_total, 0);
            const unpaid = ps.filter((p) => !p.paid && p.purchase_total > 0).reduce((s, p) => s + p.purchase_total, 0);

            return (
              <div key={name} className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-5 mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{name}</h3>
                    {info && (
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-400">
                        {info.venmo && (
                          <span>Venmo: <span className="text-gray-900 dark:text-gray-100">{info.venmo}</span></span>
                        )}
                        {info.zelle && (
                          <span>Zelle: <span className="text-gray-900 dark:text-gray-100">{info.zelle}</span></span>
                        )}
                        {info.paypal && (
                          <span>PayPal: <span className="text-gray-900 dark:text-gray-100">{info.paypal}</span></span>
                        )}
                        {info.phone_last4 && (
                          <span>Phone: <span className="text-gray-900 dark:text-gray-100">...{info.phone_last4}</span></span>
                        )}
                      </div>
                    )}
                    {!info && (
                      <p className="text-yellow-500 text-xs mt-1">
                        Payment info not yet entered — ask {name} to fill out the form above.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-gray-900 dark:text-white font-mono font-semibold">{formatDollars(total)}</div>
                    <div className="text-xs text-gray-400">total paid out</div>
                    {unpaid > 0 && (
                      <div className="text-red-400 text-xs font-mono">{formatDollars(unpaid)} owed</div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[32rem]">
                  <thead>
                    <tr className="text-gray-400 text-xs">
                      <th className="text-left py-1">Participant</th>
                      <th className="text-left py-1">Days Purchased</th>
                      <th className="text-right py-1">Amount<span className="font-normal text-gray-400"> (incl. $15 fee)</span></th>
                      <th className="text-center py-1">Paid?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {ps.filter((p) => p.purchase_total > 0).map((p) => (
                      <tr key={p.id} className={p.paid ? 'opacity-50' : ''}>
                        <td className="py-2 text-gray-900 dark:text-white">
                          {p.first_name} {p.last_name}
                        </td>
                        <td className="py-2 text-gray-400 text-xs">
                          {[
                            p.pur_preview && 'Preview',
                            p.pur_thu && 'Thu',
                            p.pur_fri && 'Fri',
                            p.pur_sat && 'Sat',
                            p.pur_sun && 'Sun',
                          ].filter(Boolean).join(', ')}
                        </td>
                        <td className="py-2 text-right font-mono text-gray-900 dark:text-white">
                          {formatDollars(p.purchase_total)}
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => handleMarkPaid(p)}
                            className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                              p.paid
                                ? 'bg-green-800 text-green-300 hover:bg-green-700'
                                : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-600 dark:hover:bg-gray-600'
                            }`}
                          >
                            {p.paid ? 'Paid ✓' : 'Mark Paid'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            );
          })}

        {Object.keys(byCoordinator).length === 0 && (
          <div className="text-gray-500 text-center py-12">
            No purchases recorded yet.
          </div>
        )}
      </div>
    </AppPage>
  );
}

function BillCard({ bill, info }: { bill: PayBill; info?: Coordinator }) {
  const label = bill.buyer || 'Buyer not recorded';
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-gray-500">Pay</p>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{label}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-semibold text-gray-900 dark:text-white">{formatDollars(bill.unpaidCents)}</div>
          {bill.cents !== bill.unpaidCents && (
            <div className="text-xs text-gray-400">{formatDollars(bill.cents)} including paid</div>
          )}
        </div>
      </div>
      {bill.buyer && <Handles info={info} missingName={bill.buyer} />}
      <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800">
        {bill.lines.map((line) => (
          <li key={line.id} className={`py-2 flex items-start justify-between gap-3 text-sm ${line.paid ? 'opacity-50' : ''}`}>
            <div className="min-w-0">
              <div className="text-gray-900 dark:text-white">{line.name}</div>
              <div className="text-xs text-gray-500">{line.days.join(', ') || 'Days not listed'}{line.paid ? ' · paid' : ''}</div>
            </div>
            <div className="font-mono text-gray-900 dark:text-white shrink-0">{formatDollars(line.cents)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PayLineRow({ line, onToggle }: { line: PayLine; onToggle: () => void }) {
  return (
    <li className={`py-2 flex items-center justify-between gap-3 text-sm ${line.paid ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <div className="text-gray-900 dark:text-white">{line.name}</div>
        <div className="text-xs text-gray-500">{line.days.join(', ') || 'Days not listed'}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-gray-900 dark:text-white">{formatDollars(line.cents)}</span>
        <button
          type="button"
          onClick={onToggle}
          className={`text-xs px-2 py-1 rounded font-medium ${
            line.paid
              ? 'bg-green-800 text-green-200'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
          }`}
        >
          {line.paid ? 'Paid' : 'Mark paid'}
        </button>
      </div>
    </li>
  );
}

function Handles({ info, missingName }: { info?: Coordinator; missingName: string }) {
  const handles = [
    info?.venmo && { label: 'Venmo', value: info.venmo },
    info?.zelle && { label: 'Zelle', value: info.zelle },
    info?.paypal && { label: 'PayPal', value: info.paypal },
  ].filter((h): h is { label: string; value: string } => !!h);

  if (handles.length === 0) {
    return (
      <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">
        {missingName} has not added Venmo, Zelle, or PayPal yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {handles.map((h) => (
        <CopyHandle key={h.label} label={h.label} value={h.value} />
      ))}
    </div>
  );
}

function CopyHandle({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      className="text-left text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-w-[8rem]"
    >
      <span className="block text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white break-all">{value}</span>
      <span className="block text-[10px] text-gray-400">{copied ? 'Copied' : 'Tap to copy'}</span>
    </button>
  );
}
