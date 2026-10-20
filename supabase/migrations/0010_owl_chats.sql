-- Owl conversations kept in the database (history like a chat app), plus prompt-cache
-- bookkeeping per conversation and cached tokens in the AI log.

create table owl_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default '',
  last_message_at timestamptz not null default now(),
  -- Explicit prompt cache of the stable prompt prefix (instructions + state summary).
  cache_name text,
  cache_key text,
  cache_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on owl_conversations (user_id, last_message_at desc);

create table owl_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  conversation_id uuid not null references owl_conversations on delete cascade,
  role text not null check (role in ('user','owl')),
  type text not null check (type in ('text','file','answer','error','document','proposal')),
  -- The message as the app renders it (text, citations, proposal rows, ...).
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on owl_messages (conversation_id, created_at);
create index on owl_messages (user_id);

do $$
declare t text;
begin
  foreach t in array array['owl_conversations','owl_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- Tokens served from a prompt cache (explicit or implicit) for each AI call.
alter table ai_runs add column cached_tokens int;
