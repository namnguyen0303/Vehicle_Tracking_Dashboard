-- Remove speed_kph from existing databases (run once if you already applied an older schema).
-- psql -d hollywood_microtransit -U hollywood_user -f sql/migrate-remove-speed-kph.sql

ALTER TABLE vehicles DROP COLUMN IF EXISTS speed_kph;
ALTER TABLE vehicle_positions DROP COLUMN IF EXISTS speed_kph;
