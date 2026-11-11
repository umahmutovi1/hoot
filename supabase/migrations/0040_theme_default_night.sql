-- Sprint 19 (Noćna sova redesign): the default theme is Noć (`ocean`). `lavender` was only the
-- old default (the Liquid Glass look), so profiles on it move to the new default; it stays a
-- valid value and is now the Šljiva theme. The released app keeps working: same values.
alter table public.profiles
  alter column theme set default 'ocean';

update public.profiles
  set theme = 'ocean'
  where theme = 'lavender';
