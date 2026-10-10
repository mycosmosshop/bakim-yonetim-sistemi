// Velikoy yukleyicileri (loadVelikoyPlan / loadVelikoyAriza): dogru veriyi mi yaziyor?
// Kaynak: D:\Yazılım\vileda-16qa\velikoy_cmms.py (PL15 Velikoy 2024 + LeanSys). node test_velikoy_cmms.cjs
// Riskler: baska lokasyonun makinesini ezmek, ayni kaydi iki kez eklemek, kullanicinin
// kapattigi bakimi geri acmak, tarihi olmayan bakima tarih uydurmak, makinesiz ariza.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/bakim_yonetim_sistemi.html', 'utf8');
const bas = src.indexOf('/* VELIKOY-BASLA'), son = src.indexOf('/* VELIKOY-BITIS */');
assert(bas > 0 && son > bas, 'Veliköy bloğu bulunamadı');
const kod = src.slice(bas, son);
assert(src.includes('onclick="loadVelikoyPlan()"') && src.includes('onclick="loadVelikoyAriza()"') && src.includes('onclick="loadVelikoyParts()"'), 'butonlar yok');
const SETLER = (() => { const i = src.indexOf('const SANIFOAM_TASK_SETS'), j = src.indexOf('\n];', i) + 3;
  return new Function(src.slice(i, j) + '\nreturn SANIFOAM_TASK_SETS;')(); })();

function ortam(db) {
  let n = 0;
  const g = { db, canWrite: () => true, save: () => { g._kayit = true; }, updateSelects() {}, nav(x) { g._ekran = x; },
    toast: (m) => { g._mesaj = m; }, confirm: () => true, renderParts() {}, uid: () => 'u' + (++n), SANIFOAM_TASK_SETS: SETLER };
  // Tanimsiz ad SESSIZCE undefined olmasin (onceki testte 2 hata boyle kacti): yoksa ReferenceError
  const px = new Proxy(g, { has: (t, p) => p !== '__k', get: (t, p) => {
    if (p in t) return t[p]; if (p in globalThis) return globalThis[p]; if (p === Symbol.unscopables) return undefined;
    throw new ReferenceError(String(p) + ' tanımsız'); } });
  return [g, new Function('__k', 'with (__k) {\n' + kod +
    '\nreturn { plan: loadVelikoyPlan, ariza: loadVelikoyAriza, parca: loadVelikoyParts, MAK: VELIKOY_MACHINES, ARZ: VELIKOY_ARIZA, PRC: VELIKOY_PARTS, planlar: _velPlanlar };\n}')(px)];
}

// 1) Diger lokasyonlar dolu bir veritabani: Ankara'da ayni Sanifoam kodlu forklift (910.5.019) var
const ankaraFRT = { id: 'ank_FRT', code: '910.5.019', name: 'FRT FORKLIFT', location: 'Ankara', status: 'running', notes: 'Makina Kodu: FRT' };
const czMak = { id: 'czm_ISM2', code: 'ISM2', name: 'ISM2 ISM DIKEY KESIM 2', location: 'Çerkezköy', status: 'running' };
const czBakim = { id: 'cz_m_ISM2_2026', machineId: 'czm_ISM2', status: 'completed', comp: '2026-07-07' };
const db = { machines: [JSON.parse(JSON.stringify(ankaraFRT)), JSON.parse(JSON.stringify(czMak))],
  maintenance: [JSON.parse(JSON.stringify(czBakim))], failures: [{ id: 'ank_a_0', machineId: 'ank_FRT', desc: 'x' }] };
const [g, api] = ortam(db);
api.plan();
// 1a) Ankara/Cerkezkoy kayitlari degismedi
assert.deepStrictEqual(db.machines.find(m => m.id === 'ank_FRT'), ankaraFRT, '1a: Ankara FRT değişti');
assert.deepStrictEqual(db.machines.find(m => m.id === 'czm_ISM2'), czMak, '1a: Çerkezköy makinesi değişti');
assert.deepStrictEqual(db.maintenance.find(m => m.id === 'cz_m_ISM2_2026'), czBakim, '1a: Çerkezköy bakımı değişti');
// 1b) FRT Velikoy'e acilmadi, mesajda bildirildi
const vel = db.machines.filter(m => m.location === 'Veliköy');
assert.strictEqual(vel.length, api.MAK.length - 1, '1b: Veliköy makine sayısı ' + vel.length);
assert(!vel.some(m => m.code === '910.5.019'), '1b: FRT Veliköy\'e açıldı');
assert(/atlandı.*FRT → Ankara/.test(g._mesaj), '1b: atlama bildirilmedi: ' + g._mesaj);
assert(!vel.some(m => /^VT /.test(m.name)), '1c: VT makinesi alınmış');
// 1d) Butun Velikoy bakimlari "planlandi", tarih ve makine dolu; tamamlandi YOK (kayit yok)
const vb = db.maintenance.filter(p => String(p.id).startsWith('vel_p_'));
assert(vb.length > 30, '1d: bakım sayısı ' + vb.length);
assert(vb.every(p => p.status === 'scheduled' && p.comp === null && /^\d{4}-\d{2}-\d{2}$/.test(p.sched) && p.machineId), '1d: biçim');
// 1e) Saatlik bakimli makinelere tarihli bakim yazilmadi
const saatli = new Set(api.MAK.filter(m => m.saatlik).map(m => 'vel_' + m.code.replace(/[^A-Za-z0-9]/g, '')));
assert(!vb.some(p => saatli.has(p.machineId)), '1e: saatlik makineye tarih uyduruldu');
// 1f) Onerilen tarihler yalniz 2026, hafta ici, bugunden (planlama tarihi) sonra; PL15'tekiler 2025+2026
const on = vb.filter(p => /Önerilen/.test(p.desc));
assert(on.length >= 9 && on.every(p => p.sched >= '2026-11-02' && p.sched < '2027-01-01'), '1f: önerilen tarih');
assert(on.every(p => { const d = new Date(p.sched + 'T12:00:00').getDay(); return d > 0 && d < 6; }), '1f: hafta sonu');
assert(on.some(p => p.machineId === 'vel_LMN1') && on.some(p => p.machineId === 'vel_MDT'), '1f: LMN1/metal dedektör planda yok');
const mp4 = vb.filter(p => p.machineId === 'vel_MP4').map(p => p.sched).sort();
assert.deepStrictEqual(mp4, ['2025-01-18', '2025-07-11', '2026-01-18', '2026-07-11'], '1g: MP4 ' + mp4);
assert(vb.filter(p => p.machineId === 'vel_MP4').every(p => p.period === 6), '1g: MP4 periyot 6 ay');

// 2) Kullanici bir bakimi kapatti; tekrar yukleme onu geri acmaz, cift kayit uretmez
const k = vb.find(p => p.id === 'vel_p_ISM3_2025_1');
Object.assign(k, { status: 'completed', comp: '2025-11-20', actDur: 2, cost: 750 });
const sayi = db.maintenance.length, mak = db.machines.length;
api.plan();
assert.strictEqual(db.maintenance.length, sayi, '2a: tekrar yüklemede kayıt arttı');
assert.strictEqual(db.machines.length, mak, '2a: tekrar yüklemede makine arttı');
const k2 = db.maintenance.find(p => p.id === 'vel_p_ISM3_2025_1');
assert(k2.status === 'completed' && k2.comp === '2025-11-20' && k2.cost === 750, '2b: kapatılan bakım ezildi');
assert(/korundu/.test(g._mesaj), '2c: korunma bildirilmedi');

// 3) Arizalar: hepsi Velikoy makinesine bagli, kimlik LeanSys durus no'su, ikinci yuklemede cift yok
api.ariza();
const va = db.failures.filter(f => String(f.id).startsWith('vel_a_'));
assert.strictEqual(va.length, api.ARZ.length, '3a: arıza sayısı ' + va.length);
const velId = new Set(db.machines.filter(m => m.location === 'Veliköy').map(m => m.id));
assert(va.every(f => velId.has(f.machineId)), '3b: Veliköy dışı makineye arıza');
assert(va.every(f => f.cost === 0 && f.tech === '' && /LeanSys duruş #\d+/.test(f.notes)), '3c: maliyet/teknisyen uydurulmuş');
assert(va.every(f => ['mechanical', 'electrical'].includes(f.failureType)), '3d: tür');
const fr5 = va.filter(f => f.machineId === 'vel_FR5');
assert(fr5.length >= 20 && fr5.filter(f => f.recurring).length >= 5, '3e: FR5 tekrar işareti ' + fr5.filter(f => f.recurring).length);
va[0].cost = 1234; va[0].rootCause = 'Kullanıcı kök nedeni';
api.ariza();
assert.strictEqual(db.failures.filter(f => String(f.id).startsWith('vel_a_')).length, api.ARZ.length, '3f: çift arıza');
assert(va[0].cost === 1234 && va[0].rootCause === 'Kullanıcı kök nedeni', '3g: kullanıcı girdisi ezildi');
assert(db.failures.find(f => f.id === 'ank_a_0').desc === 'x', '3h: Ankara arızası değişti');

// 4) Yedek parca: Ankara'da ayni stok kodlu parca ve kullanicinin elle girdigi Velikoy parcasi var
const ankParca = { id: 'ank_p1', partName: '6206 RULMAN', partNo: '960.2.014', machineId: 'ank_FRT', location: 'Ankara', qty: 9, minQty: 2 };
const elle = { id: 'u_elle', partName: 'START BUTONU (sayıldı)', partNo: '900.5.435', machineId: '', location: 'Veliköy', qty: 5, minQty: 2 };
db.parts = [JSON.parse(JSON.stringify(ankParca)), JSON.parse(JSON.stringify(elle))];
api.parca();
const vp = db.parts.filter(x => String(x.id).startsWith('velp_'));
assert.strictEqual(vp.length, api.PRC.length - 1, '4a: Veliköy parça sayısı ' + vp.length);
assert.deepStrictEqual(db.parts.find(x => x.id === 'ank_p1'), ankParca, '4b: Ankara parçası değişti');
assert.deepStrictEqual(db.parts.find(x => x.id === 'u_elle'), elle, '4c: elle girilen Veliköy parçası değişti');
assert(!vp.some(x => x.partNo === '900.5.435'), '4c: elle girilen parça çift eklendi');
assert(vp.some(x => x.partNo === '960.2.014' && x.location === 'Veliköy'), '4d: Ankara\'daki kod yüzünden Veliköy parçası atlandı');
assert(vp.every(x => x.location === 'Veliköy' && x.isCritical && x.qty === 0 && x.minQty > 0 && /sayım yapılıp girilmeli/.test(x.notes)), '4e: biçim / miktar uyduruldu');
const bagli = vp.filter(x => x.machineId);
assert(bagli.length === 4 && bagli.every(x => ['vel_ISM3', 'vel_KP7', 'vel_YTY2'].includes(x.machineId)), '4f: makine bağı ' + bagli.map(x => x.machineId));
assert(vp.find(x => x.partNo === '960.2.005').minQty === 4, '4g: 6004 rulman min PL65 2021 değil');
api.parca();
assert.strictEqual(db.parts.filter(x => String(x.id).startsWith('velp_')).length, vp.length, '4h: ikinci yüklemede çift kayıt');
// 5) locPartsList: Velikoy filtresi makinesiz Velikoy parcalarini gosterir, Ankara parcasini gostermez
const lp = (() => { const i = src.indexOf('function locMids()'), j = src.indexOf('\n', src.indexOf('function locPartsList()'));
  return new Function('db', 'gLocFilter', src.slice(i, src.indexOf('\n', i)) + '\n' + src.slice(src.indexOf('function locPartsList()'), j) + '\nreturn locPartsList();'); })();
const velList = lp(db, 'Veliköy'), ankList = lp(db, 'Ankara');
assert(velList.some(x => x.id === 'u_elle') && velList.filter(x => String(x.id).startsWith('velp_')).length === vp.length, '5a: Veliköy genel parçaları görünmüyor');
assert(!velList.some(x => x.id === 'ank_p1') && ankList.some(x => x.id === 'ank_p1') && !ankList.some(x => x.location === 'Veliköy'), '5b: lokasyon karıştı');
assert.strictEqual(lp(db, '').length, db.parts.length, '5c: filtresiz liste');

console.log('TAMAM — Veliköy:', vel.length, 'makine,', vb.length, 'bakım (', on.length, 'önerilen ),', va.length, 'arıza,', vp.length, 'yedek parça');
