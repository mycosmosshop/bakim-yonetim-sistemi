// Makine kartı yazdırma = FR253 Makine Tanımı (Sicil) Kartı: antet, bağlı dokümanlar, kritik yedek parçalar, son 5 arıza/bakım, alt antet.
//   node test_sicil_karti.cjs
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/bakim_yonetim_sistemi.html', 'utf8');
const kes = (a, b) => { const i = src.indexOf(a); assert(i >= 0, 'yok: ' + a); return src.slice(i, src.indexOf(b, i) + b.length); };

// 1) form ayarları: eski BYS-MKN-001 kaydı FR253'e geçer, yenide varsayılan FR253
const yukle = kes('function loadFormSettings(){', '\n}');
const fsCalis = kayit => { const ls = { getItem: () => JSON.stringify(kayit) }; return new Function('localStorage', 'PRINT_FORM_KEY', 'let formSettings;' + yukle + '\nloadFormSettings(); return formSettings;')(ls, 'k'); };
let f = fsCalis({ mknDocNo: 'BYS-MKN-001', mknRevNo: '00 / 02.01.2025' });
assert.strictEqual(f.mknDocNo, 'FR253'); assert.strictEqual(f.mknRevNo, '00 / 13.11.2026'); assert.strictEqual(f.mknEffDate, '13.11.2026');
assert.strictEqual(f.mknHazirlayan, 'Volkan Pekatik (KGM)'); assert.strictEqual(f.mknOnaylayan, 'Ünal Ürkmez (ÜK)');
assert.strictEqual(fsCalis({}).mknDocNo, 'FR253');
assert.strictEqual(fsCalis({ mknDocNo: 'XYZ-1', mknRevNo: '03 / 01.01.2027' }).mknRevNo, '03 / 01.01.2027', 'kullanıcının kendi numarası korunmalı');

// 2) yazdırma: sahte DOM + veriyle çalıştır
const dokBlok = kes('const MAKINE_SICIL_DOK = ', '};');
const velMach = kes('const VELIKOY_MACHINES = ', '];'), velParts = kes('const VELIKOY_PARTS = ', '];');
const fonk = kes('function sicilParcalari(m){', '\n}') + '\n' + kes('function printMachineCard(){', '\n}');
const el = {}; const document = { getElementById: id => (el[id] = el[id] || { style: {}, textContent: '', innerHTML: '' }) };
const db = {
  machines: [{ id: 'k', code: '910.5.127', name: 'KP7 HIDROLIK KESME PRESI', location: 'Veliköy', dept: 'KESİM', criticality: 'high' },
             { id: 'c', code: '910.5.999', name: 'CERKEZKOY MAK', location: 'Çerkezköy' }],
  failures: Array.from({ length: 7 }, (_, i) => ({ machineId: 'k', failureType: 'mech', startTime: `2026-0${i + 1}-10T08:00`, desc: 'Arıza ' + (i + 1), status: 'closed', cost: 0 })),
  maintenance: [{ machineId: 'k', type: 'preventive', sched: '2026-03-19', estDur: 2, tech: 'Erdoğan Özçıkrık', status: 'completed', cost: 0 }],
  parts: [{ machineId: 'c', partName: 'Çerkezköy bıçak', partNo: 'X-1', minQty: 2 }],
};
const kur = new Function('document', 'db', 'window', 'formSettings', 'loadFormSettings', 'fillAntet', 'machMetrics', 'currentCardMachineId',
  'CRIT_LBL', 'TYPE_LBL', 'STAT_FL', 'TYPE_PL', 'STAT_PL', 'fmt', 'fmtD', 'fmtDt', 'downtimeH',
  dokBlok + '\n' + velMach + '\n' + velParts + '\n' + fonk + '\nreturn {printMachineCard, sicilParcalari};');
let basildi = 0;
const calis = id => kur(document, db, { print: () => basildi++ }, { mknDocNo: 'FR253', mknRevNo: '00 / 13.11.2026', mknEffDate: '13.11.2026', mknHazirlayan: 'Volkan Pekatik (KGM)', mknOnaylayan: 'Ünal Ürkmez (ÜK)' },
  () => {}, (a, b, c) => { el.pFormName = { textContent: a }; el.pDocNo = { textContent: b }; el.pRevNo = { textContent: c }; },
  () => ({ mtbf: '1', mttr: '2', avail: '99', totalCost: 0 }), id,
  { high: 'Yüksek' }, { mech: 'Mekanik' }, { closed: 'Kapalı' }, { preventive: 'Önleyici' }, { completed: 'Tamamlandı' },
  v => '₺' + (v || 0), d => d, d => d, () => 1.5);
let F = calis('k'); F.printMachineCard();
const h = el.printContent.innerHTML;
assert.strictEqual(el.pFormName.textContent, 'MAKİNE TANIMI (SİCİL) KARTI'); assert.strictEqual(el.pDocNo.textContent, 'FR253');
assert.strictEqual(el.pEffDate.textContent, '13.11.2026'); assert.strictEqual(basildi, 1);
assert(h.includes('BAĞLI DOKÜMANLAR') && h.includes('TL205') && h.includes('TL343') && h.includes('ISG.LS.02 rev02 (Veliköy)'), 'KP7 bağlı dokümanları yok');
assert(h.includes('930.5.714') && h.includes('960.5.622'), 'KP7 kritik yedek parçaları (LeanSys BKM006) yok');
assert(h.includes('Ortak kritik parçalar'), 'ortak parça satırı yok');
assert(h.includes('ARIZA KAYITLARI (son 5 / toplam 7)') && h.includes('Arıza 7') && !h.includes('Arıza 2<'), 'arıza: en yeni 5 kayıt gösterilmeli');
assert(h.includes('BAKIM KAYITLARI (1)') && h.includes('Erdoğan Özçıkrık'));
assert(h.includes('Volkan Pekatik (KGM)') && h.includes('Ünal Ürkmez (ÜK)'), 'alt antet yok');
assert.strictEqual(el.printArea.style.zoom, '', 'zoom yazdırmadan sonra sıfırlanmalı');
// paketleme makinesi: grup parçaları + ısı rezistansı; bağlantısız lokasyonda Veliköy parçası görünmez
db.machines.push({ id: 'p', code: '910.5.025', name: 'MP5', location: 'Veliköy' });
const mp5 = F.sicilParcalari(db.machines[2]).map(r => r[1]);
assert(['960.2.005', '900.5.609', '960.2.305', '930.4.020'].every(k => mp5.includes(k)), 'MP5 paketleme parçaları eksik: ' + mp5);
const crk = F.sicilParcalari(db.machines[1]);
assert.deepStrictEqual(crk.map(r => r[1]), ['X-1'], 'Çerkezköy makinesinde yalnız kendi parçası olmalı');
// bağlı doküman tablosu olmayan makinede bölüm çıkmaz
F = calis('c'); F.printMachineCard(); assert(!el.printContent.innerHTML.includes('BAĞLI DOKÜMANLAR'));

// 3) betikler ayrışıyor
[...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => { try { new Function(m[1]); } catch (e) { assert.fail('betik ' + i + ': ' + e.message); } });
console.log('✔ sicil kartı: FR253 antet, bağlı dokümanlar, yedek parça, son 5 arıza/bakım, alt antet');
