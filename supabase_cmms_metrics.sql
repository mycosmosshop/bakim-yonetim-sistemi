-- ============================================================
-- cmms_metrics — KPI Takip köprüsü (aylık MTBF/MTTR özeti)
-- Proje: CMMS Bakım Supabase (bgraqliedgmksqdbddkp)
-- Çalıştırma: Supabase Dashboard > SQL Editor > New query > yapıştır > Run
-- Yalnızca agregat metrik tutar (lokasyon/yıl/ay → mtbf/mttr/availability);
-- ham CMMS verisi açığa çıkmaz. anon SELECT açıktır (KPI Takip uygulaması okur).
-- ============================================================

create table if not exists public.cmms_metrics (
  location     text not null,
  year         int  not null,
  month        int  not null,        -- 1..12
  mtbf         numeric,
  mttr         numeric,
  availability numeric,
  updated_at   timestamptz default now(),
  primary key (location, year, month)
);

alter table public.cmms_metrics enable row level security;

-- Okuma: herkese açık (sadece agregat; KPI Takip cross-project anon ile okur)
drop policy if exists "cmms_metrics read" on public.cmms_metrics;
create policy "cmms_metrics read" on public.cmms_metrics
  for select to anon, authenticated using (true);

-- Yazma: yalnızca giriş yapmış CMMS kullanıcıları (CMMS app cloudPush sırasında yazar)
drop policy if exists "cmms_metrics write" on public.cmms_metrics;
create policy "cmms_metrics write" on public.cmms_metrics
  for all to authenticated using (true) with check (true);
