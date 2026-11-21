-- Account deletion (Privacy: "full account deletion ... remains a pre-launch blocker"), 14 Nov 2026.
-- The delete-account edge function calls this with the service role, then deletes the auth user, which cascades to
-- profiles, entitlements, checkout_attempts, legal_acceptances and pairing_tokens. This removes what has no foreign
-- key to auth.users: the public review, promo redemptions, trial history, and the account's name in the testers
-- list and in per-account feature rules. Admin accounts are never removed this way.
create or replace function public.forget_account(target uuid)
returns text
language plpgsql
security definer
set search_path = public, jyson_private, pg_temp
as $$
declare
  acct text;
begin
  if target is null then
    raise exception 'no account given';
  end if;
  if exists (select 1 from jyson_private.admins a where a.user_id = target) then
    raise exception 'admin accounts are removed by hand';
  end if;
  select e.account_name into acct from public.entitlements e where e.id = target;
  delete from public.reviews r where r.id = target;
  delete from jyson_private.promo_redemptions p where p.user_id = target;
  delete from jyson_private.trial_history t where t.user_id = target;
  if acct is not null and acct <> '' then
    delete from jyson_private.testers t where t.account_name = acct;
    update jyson_private.feature_rules f set accounts = array_remove(f.accounts, acct) where acct = any(f.accounts);
  end if;
  return coalesce(acct, '');
end;
$$;

revoke all on function public.forget_account(uuid) from public, anon, authenticated;
grant execute on function public.forget_account(uuid) to service_role;

-- 20261114h: the edge function asks this before anything else (jyson_private is not exposed to the API).
create or replace function public.account_is_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = jyson_private, pg_temp
as $$ select exists (select 1 from jyson_private.admins a where a.user_id = target) $$;

revoke all on function public.account_is_admin(uuid) from public, anon, authenticated;
grant execute on function public.account_is_admin(uuid) to service_role;
