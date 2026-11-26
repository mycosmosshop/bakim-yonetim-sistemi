// Tarayıcı depolaması doluyken (QuotaExceededError) save() buluta yazmayı sürdürmeli, açılış durmamalı (Edge, 26.11.2026).
//   node test_kota_dolu.cjs
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/bakim_yonetim_sistemi.html', 'utf8');
const kes = (a, b) => { const i = src.indexOf(a); assert(i >= 0, 'yok: ' + a); return src.slice(i, src.indexOf(b, i) + b.length); };
const kod = kes('let _lsUyarildi=false;', '\n}') + '\n' + kes('function _lsYaz(k, v){', '\n}') + '\n' + kes('function save(){', '\n}');
let silinen = [], bulut = 0, uyari = 0;
const ls = { setItem: () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }, removeItem: k => silinen.push(k) };
const f = new Function('localStorage', 'canWrite', 'toast', 'logActivity', 'scheduleCloudSync', '_bakimAnlikPlanla', 'db', 'STORAGE_KEY', 'console',
  kod + '\nreturn {save, _lsYaz};');
const F = f(ls, () => true, () => uyari++, () => {}, () => bulut++, () => {}, { machines: [] }, 'cmms_pro_v2', { warn: () => {} });
assert.doesNotThrow(() => F.save()); F.save();
assert.strictEqual(bulut, 2, 'kota doluyken de buluta yazılmalı');
assert.deepStrictEqual(silinen, ['cmms_pro_v2', 'cmms_pro_v2'], 'eski önbellek silinmeli');
assert.strictEqual(uyari, 1, 'uyarı bir kez gösterilmeli');
assert.strictEqual(F._lsYaz('x', 'y'), false);
assert.strictEqual(src.indexOf('localStorage.setItem(STORAGE_KEY,'), -1, 'korumasız önbellek yazımı kalmamalı');
console.log('test tamam');
