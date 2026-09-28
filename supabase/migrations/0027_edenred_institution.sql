insert into institutions (id, display_name, brand_color, logo_path, sort_order)
values ('edenred', 'Edenred', '#F72717', '/institutions/edenred.svg', 105)
on conflict (id) do update
  set display_name = excluded.display_name,
      brand_color  = excluded.brand_color,
      logo_path    = excluded.logo_path,
      sort_order   = excluded.sort_order;
