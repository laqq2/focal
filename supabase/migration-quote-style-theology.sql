-- Allow theology quote style (run once on existing databases).
alter table profiles drop constraint if exists profiles_quote_style_check;
alter table profiles add constraint profiles_quote_style_check
  check (quote_style in ('motivational', 'stoic', 'theology', 'custom'));

alter table profiles alter column quote_style set default 'theology';
