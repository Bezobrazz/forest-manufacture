alter table trips
  add column if not exists total_distance_km numeric;

comment on column trips.total_distance_km is 'Загальний пробіг (км) для комерційних поїздок; якщо задано — одометр початку/кінця не використовується';
