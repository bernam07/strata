-- Per-category colour for the expense tiles. Null means "use the neutral
-- default", so every category renders the same muted grey until the user
-- deliberately picks a colour.
alter table categories add column if not exists color text;

-- The value is interpolated into a CSS colour, so constrain it to a plain
-- 6-digit hex at the database boundary rather than trusting the client.
alter table categories drop constraint if exists categories_color_hex;
alter table categories
  add constraint categories_color_hex
  check (color is null or color ~ '^#[0-9a-f]{6}$');
