
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  notifications_enabled boolean not null default true,
  dark_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Scans
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  barcode text,
  product_name text not null,
  brand text,
  image_url text,
  health_score int not null,
  data jsonb not null,
  scanned_at timestamptz not null default now()
);
alter table public.scans enable row level security;
create policy "scans_select_own" on public.scans for select using (auth.uid() = user_id);
create policy "scans_insert_own" on public.scans for insert with check (auth.uid() = user_id);
create policy "scans_delete_own" on public.scans for delete using (auth.uid() = user_id);
create index scans_user_time_idx on public.scans(user_id, scanned_at desc);

-- Saved alternatives
create table public.saved_alternatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  barcode text,
  product_name text not null,
  brand text,
  image_url text,
  health_score int,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, barcode)
);
alter table public.saved_alternatives enable row level security;
create policy "saved_select_own" on public.saved_alternatives for select using (auth.uid() = user_id);
create policy "saved_insert_own" on public.saved_alternatives for insert with check (auth.uid() = user_id);
create policy "saved_delete_own" on public.saved_alternatives for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
