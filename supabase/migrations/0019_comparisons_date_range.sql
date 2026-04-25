-- Persist the analysis date window on each saved comparison row so the
-- cache invalidates correctly when the user picks a different window.
-- Without these columns the GET endpoint cannot tell whether the cached
-- technical_data was computed against the same dates the user is asking
-- for now — and the refresh-rate metric depends on the window.

alter table mait_comparisons
  add column if not exists date_from text,
  add column if not exists date_to   text;
