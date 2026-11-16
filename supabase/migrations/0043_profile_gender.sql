-- Address form (grammatical gender of the copy that speaks to the user in Bosnian: "Koliko si
-- učila?" / "Koliko si učio?"). Asked once in onboarding, changeable in Postavke. Null = not
-- asked yet: the copy keeps its default form. Additive, so the released app keeps working.
alter table public.profiles
  add column gender text check (gender in ('female', 'male'));
