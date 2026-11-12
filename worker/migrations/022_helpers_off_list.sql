-- Someone can sign in to help on purchase day without a row on the board.
-- Their claim is tied to the Clerk account, and a place in line does not need a participant.

ALTER TABLE participants ADD COLUMN purchasing_claimed_clerk_user_id TEXT;

PRAGMA foreign_keys=OFF;

CREATE TABLE purchase_queue_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK(status IN ('waiting', 'on_deck', 'in_queueit', 'buying', 'done', 'skipped')),
  eta_minutes INTEGER,
  eta_at TEXT,
  label TEXT NOT NULL DEFAULT '',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO purchase_queue_new (
  id, event_id, participant_id, clerk_user_id, buyer_name, position, status,
  eta_minutes, eta_at, label, joined_at, updated_at
)
SELECT
  id, event_id, participant_id, clerk_user_id, '', position, status,
  eta_minutes, eta_at, label, joined_at, updated_at
FROM purchase_queue;

DROP TABLE purchase_queue;
ALTER TABLE purchase_queue_new RENAME TO purchase_queue;

CREATE INDEX IF NOT EXISTS idx_purchase_queue_event_pos ON purchase_queue(event_id, position);
CREATE INDEX IF NOT EXISTS idx_purchase_queue_event_clerk ON purchase_queue(event_id, clerk_user_id);

PRAGMA foreign_keys=ON;
