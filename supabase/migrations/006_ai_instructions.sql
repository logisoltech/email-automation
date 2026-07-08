create table ai_instructions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_instructions_created_at_idx on ai_instructions (created_at asc);

alter table ai_instructions enable row level security;

create policy "Authenticated users can read ai instructions"
  on ai_instructions for select to authenticated using (true);

create policy "Authenticated users can insert ai instructions"
  on ai_instructions for insert to authenticated with check (true);

create policy "Authenticated users can update ai instructions"
  on ai_instructions for update to authenticated using (true);

create policy "Authenticated users can delete ai instructions"
  on ai_instructions for delete to authenticated using (true);
