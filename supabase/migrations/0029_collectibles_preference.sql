alter table if exists user_preferences
  add column if not exists include_collectibles_in_net_worth boolean not null default true;
