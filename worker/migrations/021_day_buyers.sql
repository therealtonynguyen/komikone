-- Who paid for each badge day. A person can have a different buyer per day.
ALTER TABLE participants ADD COLUMN who_preview TEXT NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN who_thu TEXT NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN who_fri TEXT NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN who_sat TEXT NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN who_sun TEXT NOT NULL DEFAULT '';
