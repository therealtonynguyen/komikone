import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from './DashboardContext';
import { badgeTypeLabel } from './styles';
import BackgroundLayer from '../components/BackgroundLayer';
import { MemberId } from '../components/MemberId';
import { api, type EventSummary } from '../lib/api';
import { pickLiveBoard } from '../lib/liveBoard';
import { pendingInvite } from '../lib/pendingInvite';

const LIVE_BOARD_STATUS: Record<EventSummary['status'], string> = {
  setup: 'Getting ready for purchase day',
  registration: 'Practice and check your spot before purchase day',
  purchasing: 'Buying is happening now. Jump in.',
  payment: 'The board is finished. You can still look.',
  complete: 'The board is finished. You can still look.',
};

function PaybackTile({ eventId, title }: { eventId: number; title: string }) {
  return (
    <Link
      to={`/payment/${eventId}`}
      className="block backdrop-blur-md rounded-2xl p-6 shadow-2xl bg-white/90 dark:bg-gray-900/90 border border-purple-300/80 dark:border-purple-800/80 hover:border-purple-400"
    >
      <p className="text-purple-600 dark:text-purple-400 text-xs uppercase tracking-wider mb-1">Payback</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{title}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        See what you owe, who owes you, and how to send it →
      </p>
    </Link>
  );
}

function LiveBoardTile({ event }: { event: EventSummary }) {
  const live = event.status === 'purchasing';
  const tile = 'group block backdrop-blur-md rounded-2xl p-6 shadow-2xl transition-colors';

  return (
    <Link
      to={`/live/${event.id}`}
      className={`${tile} ${
        live
          ? 'bg-red-600/95 hover:bg-red-500 border border-red-400 text-white'
          : 'bg-white/90 dark:bg-gray-900/90 border border-gray-300/80 dark:border-gray-700/80 hover:border-blue-500 dark:hover:border-blue-500'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-xs uppercase tracking-wider mb-1 flex items-center gap-2 ${live ? 'text-red-100' : 'text-gray-500'}`}>
            {live && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
            {live ? 'Live now' : event.reg_type === 'return' ? 'Return Reg' : 'Open Reg'}
          </p>
          <p className={`text-2xl font-bold ${live ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Live Board</p>
          <p className={`text-sm mt-1 ${live ? 'text-red-50' : 'text-gray-500 dark:text-gray-400'}`}>
            {LIVE_BOARD_STATUS[event.status]}
          </p>
        </div>
        <span
          className={`text-2xl shrink-0 transition-transform group-hover:translate-x-1 ${
            live ? 'text-white' : 'text-blue-500'
          }`}
        >
          →
        </span>
      </div>
    </Link>
  );
}

function HelperHome() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const invite = pendingInvite();

  useEffect(() => {
    api.events.list().then(setEvents).catch(() => {});
  }, []);

  const board = pickLiveBoard(events);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">You can help from here</h1>
        <p className="text-gray-500 text-sm mt-2">
          You do not need to be on the participant list. Sign in is enough to claim people, record who bought, and join the line.
        </p>
        {board && (
          <div className="mt-5">
            <LiveBoardTile event={board} />
          </div>
        )}
        {invite && (
          <Link
            to={`/join/${invite}`}
            className="block mt-5 text-center bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Finish joining with your invite →
          </Link>
        )}
        <Link to="/" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300">
          Homepage
        </Link>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { member, primaryView, activeEvent, liveBoardEvent } = useDashboard();

  if (!member) {
    return <HelperHome />;
  }

  return (
    <BackgroundLayer className="flex-1" minHeight="min-h-[calc(100vh)]">
      <div className="flex flex-col justify-end min-h-[calc(100vh)] p-8 md:p-12">
        <div className="max-w-lg space-y-4">
          {activeEvent && (activeEvent.status === 'payment' || activeEvent.status === 'complete') && (
            <PaybackTile eventId={activeEvent.id} title="Who you owe" />
          )}
          {liveBoardEvent && (
            <LiveBoardTile event={liveBoardEvent} />
          )}
          {liveBoardEvent && liveBoardEvent.status === 'purchasing' && (
            <PaybackTile eventId={liveBoardEvent.id} title="Who to pay" />
          )}
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-300/80 dark:border-gray-700/80 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Welcome back</p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {member.first_name} {member.last_name}
                </h1>
              </div>
              <Link
                to="/dashboard/profile"
                className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
              >
                Edit
              </Link>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">Member ID</dt>
                <dd className="mt-0.5">
                  <MemberId
                    value={member.member_id}
                    className="font-mono text-sm tracking-wide"
                    letterClassName="text-gray-800 dark:text-gray-200"
                    digitClassName="text-amber-400"
                  />
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Badge type</dt>
                <dd className="text-gray-800 dark:text-gray-200 mt-0.5">{badgeTypeLabel(member.badge_type)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Return eligible</dt>
                <dd className={`mt-0.5 ${member.return_eligible ? 'text-green-400' : 'text-gray-400'}`}>
                  {member.return_eligible ? 'Yes' : 'No'}
                </dd>
              </div>
              {primaryView?.group && (
                <div>
                  <dt className="text-gray-500 text-xs">Group</dt>
                  <dd className="text-gray-800 dark:text-gray-200 mt-0.5 inline-flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: primaryView.group.color }}
                    />
                    {primaryView.group.name}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-800 flex gap-3">
              <Link
                to="/dashboard/registrations"
                className="text-xs text-gray-400 hover:text-gray-900 transition-colors"
              >
                Registrations →
              </Link>
              <Link
                to="/dashboard/invitations"
                className="text-xs text-gray-400 hover:text-gray-900 transition-colors"
              >
                Invitations →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </BackgroundLayer>
  );
}
