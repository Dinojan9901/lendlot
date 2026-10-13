-- Prevent double-booking in the database itself, not only in application code.
--
-- An application-level "is this range free?" check followed by an INSERT is a
-- race: two requests can both see the dates as free and both insert. An
-- exclusion constraint makes Postgres reject the second row atomically, no
-- matter how many app servers or requests run at the same time.
--
-- btree_gist lets a GiST index combine plain equality (itemId) with range
-- overlap (&&) in one constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A booking must end on or after the day it starts.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_dates_ordered" CHECK ("endDate" >= "startDate");

-- No two CONFIRMED bookings of the same item may share a day.
-- '[]' = both start and end days are included in the range.
-- Cancelled bookings are excluded so their dates become free again.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist (
    "itemId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  )
  WHERE ("status" = 'CONFIRMED');
