create table if not exists public.pipeline_stages (
  id text primary key,
  label text not null,
  color text not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.pipeline_stages (id, label, color, sort_order, is_default)
values
  ('lead', 'Lead', 'var(--status-warning)', 0, true),
  ('contacted', 'Contacted', '#60a5fa', 1, false),
  ('proposal', 'Proposal', '#a78bfa', 2, false),
  ('negotiation', 'Negotiation', '#f97316', 3, false),
  ('won', 'Won', 'var(--status-success)', 4, true),
  ('lost', 'Lost', '#ef4444', 5, true)
on conflict (id) do update set
  label = excluded.label,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_default = excluded.is_default;
