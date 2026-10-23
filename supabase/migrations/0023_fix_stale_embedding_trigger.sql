-- Fix for 0021: drop_stale_embedding referenced new.front / new.name in one expression for every
-- table, and PL/pgSQL resolves each record field when the expression runs, so every update of
-- units, cards and topics failed with 42703 ("record new has no field front"). One branch per
-- table, each touching only its own columns.

create or replace function public.drop_stale_embedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'units' then
    if new.title is distinct from old.title or new.notes is distinct from old.notes then
      delete from public.unit_embeddings where unit_id = new.id;
    end if;
  elsif tg_table_name = 'cards' then
    if new.front is distinct from old.front or new.back is distinct from old.back then
      delete from public.card_embeddings where card_id = new.id;
    end if;
  elsif tg_table_name = 'topics' then
    if new.name is distinct from old.name then
      delete from public.topic_embeddings where topic_id = new.id;
    end if;
  end if;
  return new;
end;
$$;
