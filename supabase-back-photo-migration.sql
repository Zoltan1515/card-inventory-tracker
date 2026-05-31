-- Add optional back-of-card photos for eBay listings.
-- Run this in Supabase SQL editor for the Wicked Card Tracker project.

alter table public.cards
add column if not exists back_photo_url text default '';
