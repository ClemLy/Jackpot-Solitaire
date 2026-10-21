-- Actions rapides: la fonction serveur lisait puis ecrivait la sauvegarde en
-- plusieurs allers-retours (limitation, lecture, profil, ecriture, carte
-- publique). Ces deux fonctions les regroupent: une lecture, une ecriture.

-- Limitation + sauvegarde + profil, en un seul appel.
create or replace function public.act_load(uid uuid, max_hits integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
  saved_state jsonb;
  saved_version bigint;
  saved_pseudo text;
  saved_created timestamptz;
begin
  allowed := public.api_hit(uid, max_hits);
  select state, version into saved_state, saved_version
    from public.player_states where user_id = uid;
  select pseudo, created_at into saved_pseudo, saved_created
    from public.profiles where id = uid;
  return jsonb_build_object(
    'allowed', allowed,
    'state', saved_state,
    'version', saved_version,
    'pseudo', saved_pseudo,
    'created_at', saved_created
  );
end;
$$;

-- Ecriture de la sauvegarde (verrou optimiste) et de la carte publique.
-- Rend faux si la version a change entre la lecture et l'ecriture.
create or replace function public.act_save(
  uid uuid,
  new_state jsonb,
  expected_version bigint,
  card jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched integer;
begin
  update public.player_states
     set state = new_state,
         version = expected_version + 1,
         updated_at = now()
   where user_id = uid and version = expected_version;
  get diagnostics touched = row_count;
  if touched = 0 then
    return false;
  end if;
  update public.profiles set public_card = card where id = uid;
  return true;
end;
$$;

revoke all on function public.act_load(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.act_save(uuid, jsonb, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.act_load(uuid, integer) to service_role;
grant execute on function public.act_save(uuid, jsonb, bigint, jsonb) to service_role;
