-- Every table is readable by signed-in users (rls.test.sql), per column where a secret is hidden:
-- the owner may see which calendars have a push channel and until when, never the channel's
-- token or ids (they let a caller post fake notifications).
grant select (id, user_id, account_id, google_calendar_id, expires_at, created_at, updated_at)
  on public.calendar_channels to authenticated;
