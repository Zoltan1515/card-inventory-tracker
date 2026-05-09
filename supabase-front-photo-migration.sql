-- Front photo support for Card Inventory Tracker
-- Paste this into Supabase Dashboard > SQL Editor > New query > Run.

alter table public.cards
add column if not exists front_photo_url text default '';

insert into storage.buckets (id, name, public)
values ('card-photos', 'card-photos', true)
on conflict (id) do update set public = true;

create policy "Users can upload their own card photos"
  on storage.objects for insert
  with check (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view card photos"
  on storage.objects for select
  using (bucket_id = 'card-photos');

create policy "Users can update their own card photos"
  on storage.objects for update
  using (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own card photos"
  on storage.objects for delete
  using (
    bucket_id = 'card-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
