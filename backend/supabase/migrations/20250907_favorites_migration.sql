-- Favorites migration: enforce a per-user immutable Favorites playlist and route likes via playlist_songs

-- 1) Schema changes: add is_favorites flag and optional privacy flag
alter table if exists public.playlists
  add column if not exists is_favorites boolean not null default false;

alter table if exists public.users
  add column if not exists show_activity boolean not null default true;

-- 2) Ensure each user has at most one Favorites playlist
create unique index if not exists playlists_one_favorites_per_user
  on public.playlists (creator_id)
  where (is_favorites);

-- 3) RPC to ensure favorites playlist exists and return its id
create or replace function public.ensure_favorites_playlist(p_user_id uuid)
returns uuid
language plpgsql
as $$
declare
  fav_id uuid;
begin
  select id into fav_id from public.playlists where creator_id = p_user_id and is_favorites = true limit 1;
  if fav_id is null then
    insert into public.playlists (name, description, creator_id, is_public, is_favorites)
    values ('Favorites', null, p_user_id, false, true)
    returning id into fav_id;
  end if;
  return fav_id;
end;
$$;

-- 4) Triggers to prevent rename/delete of Favorites
create or replace function public.prevent_modify_favorites()
returns trigger as $$
begin
  if (tg_op = 'UPDATE') then
    if old.is_favorites and (
         coalesce(new.name, '') <> coalesce(old.name, '')
      or coalesce(new.is_public, false) <> coalesce(old.is_public, false)
      or new.creator_id <> old.creator_id
      or new.is_favorites <> old.is_favorites
    ) then
      raise exception 'Favorites playlist is immutable';
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if old.is_favorites then
      raise exception 'Cannot delete Favorites playlist';
    end if;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_modify_favorites_update on public.playlists;
create trigger trg_prevent_modify_favorites_update
  before update on public.playlists
  for each row execute function public.prevent_modify_favorites();

drop trigger if exists trg_prevent_modify_favorites_delete on public.playlists;
create trigger trg_prevent_modify_favorites_delete
  before delete on public.playlists
  for each row execute function public.prevent_modify_favorites();

-- 5) Optional data migration: move rows from user_favorites into Favorites playlist_songs
-- This block will insert entries for any users that had favorites in user_favorites
do $$
declare
  r record;
  fav_id uuid;
  pos integer;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_favorites') then
    for r in (
      select uf.user_id, uf.song_id, uf.created_at
      from public.user_favorites uf
      order by uf.user_id, uf.created_at
    ) loop
      fav_id := public.ensure_favorites_playlist(r.user_id);
      select coalesce(max(position), 0) into pos from public.playlist_songs where playlist_id = fav_id;
      insert into public.playlist_songs (playlist_id, song_id, position)
      values (fav_id, r.song_id, pos + 1)
      on conflict do nothing;
    end loop;
  end if;
end$$;

-- Note: consider dropping user_favorites after verifying data
-- drop table if exists public.user_favorites;


