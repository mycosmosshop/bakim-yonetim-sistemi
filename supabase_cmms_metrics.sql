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
  pmr          numeric,           -- Planlı Bakım Oranı %
  pmc          numeric,           -- Planlı Bakım Uyumu %
  unplanned    numeric,           -- Plansız Bakım %
  mttf         numeric,           -- Ortalama ilk arızaya kadar süre (saat)
  updated_at   timestamptz default now(),
  primary key (location, year, month)
);

-- Tabloyu daha önce oluşturduysan eksik sütunları ekler (yeniden çalıştırması güvenli):
alter table public.cmms_metrics
  add column if not exists pmr       numeric,
  add column if not exists pmc       numeric,
  add column if not exists unplanned numeric,
  add column if not exists mttf      numeric;

alter table public.cmms_metrics enable row level security;

-- Okuma: herkese açık (sadece agregat; KPI Takip cross-project anon ile okur)
drop policy if exists "cmms_metrics read" on public.cmms_metrics;
create policy "cmms_metrics read" on public.cmms_metrics
  for select to anon, authenticated using (true);

-- Yazma: yalnızca giriş yapmış CMMS kullanıcıları (CMMS app cloudPush sırasında yazar)
drop policy if exists "cmms_metrics write" on public.cmms_metrics;
create policy "cmms_metrics write" on public.cmms_metrics
  for all to authenticated using (true) with check (true);
