-- cmms_metrics tablosuna bakım maliyeti sütunu
--
-- KPI Takip Tablosu'nda "Bakım Maliyetleri" satırının CMMS'ten otomatik
-- çekilebilmesi için gerekli. Sütun eklenene kadar CMMS maliyeti
-- yazmayı dener, hata alınca maliyetsiz yazar (diğer metrikler etkilenmez).
--
-- NEREDE ÇALIŞTIRILIR
--   Supabase → proje bgraqliedgmksqdbddkp → SQL Editor → çalıştır.
--
-- GÜVENLİ: yalnız sütun ekler, veri silmez/değiştirmez. İki kez
-- çalıştırılabilir (if not exists).

alter table public.cmms_metrics
  add column if not exists cost numeric;

comment on column public.cmms_metrics.cost is
  'Aylık bakım maliyeti (TL): arıza + planlı bakım + yedek parça. '
  'CMMS syncCmmsMetrics() yazar, KPI Takip fetchCmmsMetrics() okur.';

-- Doğrulama: sütun geldi mi?
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'cmms_metrics'
 order by ordinal_position;
