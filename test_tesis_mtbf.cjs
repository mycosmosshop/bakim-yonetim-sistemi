// Pano MTBF'si TESİS saatiyle mi: tek vardiyalı lokasyonda aylık MTBF tesisin aylık çalışma saatini aşamaz.
//   Önce makine başı saatler toplanıyordu (Ankara: 8 makine × ~217 sa ÷ 3 arıza ≈ 580 sa). Makine kartındaki
//   makine başı MTBF ise değişmemeli.
//   node test_tesis_mtbf.cjs
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/bakim_yonetim_sistemi.html', 'utf8');
const bas = src.indexOf('function downtimeH('), son = src.indexOf('// KPI evaluation: returns');
assert(bas > 0 && son > bas, 'KPI bölümü bulunamadı');
const pmc = src.slice(src.indexOf('function _pmcKapsam('), src.indexOf('\nfunction ', src.indexOf('function _pmcKapsam(') + 10));
// 3 makine, A lokasyonu (10 sa/gün, 5 gün/hafta, 08:00), Ocak 2026'da 3 arıza (hafta içi 10:00–12:00)
const ar = (id, mid, gun) => ({ id, machineId: mid, status: 'closed', startTime: `2026-01-${gun}T10:00:00`, endTime: `2026-01-${gun}T12:00:00` });
const db = { machines: [1, 2, 3].map(i => ({ id: 'm' + i, name: 'M' + i, location: 'A', status: 'active' })),
  failures: [ar('f1', 'm1', '05'), ar('f2', 'm2', '13'), ar('f3', 'm3', '21')],
  maintenance: [1, 2, 3].map(i => ({ id: 'p' + i, machineId: 'm' + i, type: 'preventive', status: 'completed', comp: '2026-01-01' })), parts: [] };
const f = new Function('db', '__v', 'gLocFilter', 'localStorage', 'cloudPush', 'cloudReady', 'scheduleCloudSync', 'renderDashboard', 'renderAnalytics', 'renderMaint',
  src.slice(bas, son) + '\n' + pmc + '\nvardiyaAyar = __v;\nreturn { calcFleetKPIs, machMetrics, aralik: (a, b) => { _dashRange = { from: a, to: b }; _dashRangeActive = true; } };');
const K = f(db, { A: { bas: '08:00', saatGun: 10, gunHafta: 5 } }, 'A', { getItem: () => null, setItem: () => {} }, () => {}, false, () => {}, () => {}, () => {}, () => {});
K.aralik(new Date(2026, 0, 1), new Date(2026, 0, 31, 23, 59, 59));
const k = K.calcFleetKPIs('A');
const plan = 31 * 24 * (10 / 24) * (5 / 7);                       // ≈ 221 sa
assert(k.mtbf <= plan, `aylık MTBF tesis saatini aşamaz: ${k.mtbf} > ${plan.toFixed(0)}`);
assert.strictEqual(k.mtbf, Math.round((plan - 6) / 3), 'tesis MTBF = (vardiya saati − duruş) ÷ arıza');
assert(k.mtbfFilo > 2 * k.mtbf, 'eski makine-başı toplam (filo) karşılaştırma için kalmalı');
assert.strictEqual(k._calc.tesisH, Math.round(plan - 6));
// makine kartı (makine başı) aynı kalır: tek makinenin saatleri ÷ kendi arızası
const mx = K.machMetrics('m1');
assert(+mx.mtbf > k.mtbf, 'makine kartı makine başı MTBF gösterir');
console.log('✔ tesis MTBF: tek vardiyada aylık', k.mtbf, 'sa (plan', plan.toFixed(0), 'sa) · filo', k.mtbfFilo, '· makine kartı', mx.mtbf);
