-- Comptes de Jackpot Solitaire: profils, sauvegardes et amis.
--
-- Principe de securite: aucune table n'est accessible directement depuis le
-- navigateur (RLS active, aucune politique, droits retires a anon et
-- authenticated). Tout passe par la fonction serveur "api", qui valide
-- chaque action avec la cle de service.

-- ---------------------------------------------------------------------------
-- Profils publics
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null,
  pseudo_key text generated always as (lower(pseudo)) stored,
  created_at timestamptz not null default now(),
  -- Vitrine du joueur (avatar, cadre, rang, statistiques), recalculee par
  -- le serveur a chaque changement de sauvegarde.
  public_card jsonb not null default '{}'::jsonb,
  constraint profiles_pseudo_format
    check (pseudo ~ '^[A-Za-z0-9_-]{3,16}$'),
  constraint profiles_pseudo_key_unique unique (pseudo_key)
);

-- ---------------------------------------------------------------------------
-- Sauvegardes (privees)
-- ---------------------------------------------------------------------------

create table public.player_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  -- Verrou optimiste: une ecriture n'aboutit que sur la version lue.
  version bigint not null default 0,
  -- Vrai si la sauvegarde d'invite du navigateur a ete reprise.
  imported boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Amis
-- ---------------------------------------------------------------------------

create table public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  constraint friendships_not_self check (requester <> addressee),
  constraint friendships_status check (status in ('pending', 'accepted'))
);

create index friendships_addressee_idx on public.friendships (addressee);

-- ---------------------------------------------------------------------------
-- Limitation du nombre d'actions par minute et par joueur
-- ---------------------------------------------------------------------------

create table public.api_hits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, window_start)
);

create or replace function public.api_hit(uid uuid, max_hits integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  total integer;
begin
  insert into public.api_hits (user_id, window_start, hits)
  values (uid, current_window, 1)
  on conflict (user_id, window_start)
  do update set hits = public.api_hits.hits + 1
  returning hits into total;
  -- Menage des fenetres passees.
  delete from public.api_hits
  where user_id = uid and window_start < current_window - interval '5 minutes';
  return total <= max_hits;
end;
$$;

-- ---------------------------------------------------------------------------
-- Creation du profil a l'inscription
-- ---------------------------------------------------------------------------

-- Pseudos reserves: on ne se fait pas passer pour la maison.
create or replace function public.pseudo_is_reserved(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(p) = any (array[
    'admin', 'administrateur', 'moderateur', 'modo', 'support', 'staff',
    'croupier', 'casino', 'jackpot', 'banque', 'systeme', 'system', 'root'
  ]);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text := new.raw_user_meta_data ->> 'pseudo';
begin
  if p is null or p !~ '^[A-Za-z0-9_-]{3,16}$' then
    raise exception 'pseudo_invalide';
  end if;
  if public.pseudo_is_reserved(p) then
    raise exception 'pseudo_reserve';
  end if;
  -- L'identifiant de connexion est derive du pseudo: les deux doivent
  -- correspondre, sans quoi on pourrait reserver le pseudo d'un autre.
  if lower(new.email) <> lower(p) || '@joueurs.jackpot-solitaire.invalid' then
    raise exception 'pseudo_incoherent';
  end if;
  insert into public.profiles (id, pseudo) values (new.id, p);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Verrouillage: rien n'est accessible hors de la cle de service
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.player_states enable row level security;
alter table public.friendships enable row level security;
alter table public.api_hits enable row level security;

revoke all on public.profiles, public.player_states, public.friendships,
  public.api_hits from anon, authenticated;
revoke all on function public.api_hit(uuid, integer) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.pseudo_is_reserved(text) from public, anon, authenticated;

grant execute on function public.api_hit(uuid, integer) to service_role;
