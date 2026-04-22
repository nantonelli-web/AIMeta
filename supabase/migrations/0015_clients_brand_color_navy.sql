-- =====================================================================
-- MAIT — Brand accent refined from royal blue to deep navy
-- Updates mait_clients.color default and backfills rows still carrying
-- any previous default (the original gold or the interim royal blue).
-- Custom colours chosen by the user are untouched.
-- =====================================================================

alter table mait_clients alter column color set default '#0e3590';

update mait_clients
set color = '#0e3590'
where color in ('#d4a843', '#2667ff');
