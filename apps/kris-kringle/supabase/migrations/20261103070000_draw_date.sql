-- Move the draw (and the countdown shown in the app) to 17 November 2026.
-- draw_at only drives the countdown; the draw itself is run by the organiser.
update public.app_state
set draw_at = '2026-11-17 20:00:00 Australia/Melbourne', updated_at = now()
where id = 1;
