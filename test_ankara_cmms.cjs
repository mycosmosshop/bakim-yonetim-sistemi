// CMMS Pro'ya eklenen Ankara yukleyicileri: dogru veriyi mi yaziyor?
//
// Kaynak (salt okunur, NAS): PL15 Yillik Bakim Plani_2026 + 2026 Bakim Kayitlari
// Riskli noktalar: mevcut kayitlarin ezilmesi, ayni kaydin iki kez eklenmesi,
// makinesi olmayan ariza uretilmesi, "SAATLİK BAKIM YAPILIR" gibi tarih
// olmayan degerlerin plana tarih diye girmesi.
const fs = require('fs'), assert = require('assert');
const KOK = 'C:/Users/User/AppData/Local/Temp/claude/D--Yaz-l-m/651c3d70-fb75-4585-8b7d-1923454b8e83/scratchpad/cmms/';
const src = fs.readFileSync(KOK + 'bakim_yonetim_sistemi.html', 'utf8');

// Eklenen bolumu cikar ve gercek fonksiyonlari calistir
const bas = src.indexOf('const ANKARA_MACHINES');
const son = src.indexOf('function loadCerkezkoyPlan');
assert(bas > 0 && son > bas, 'Ankara bölümü bulunamadı');
const kod = src.slice(bas, son);

function ortam(db, izin = true) {
    const g = {
        db, canWrite: () => izin, save: () => { g._kaydedildi = true; },
        updateSelects: () => {}, nav: (x) => { g._ekran = x; },
        toast: (m) => { g._mesaj = m; }, confirm: () => true,
        String, Object, Array, JSON, Math, Date, RegExp, console
    };
    const f = new Function('__k', 'with (__k) {\n' + kod +
        '\nreturn { plan: loadAnkaraPlan, ariza: loadAnkaraAriza, MAK: ANKARA_MACHINES, ARZ: ANKARA_ARIZA, PB: ANKARA_PBAKIM };\n}');
    return [g, f(new Proxy(g, { has: () => true, get: (t, p) => (p in t ? t[p] : undefined) }))];
}

// 1) Bos veritabanina yukleme: 9 makine, hepsi Ankara
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [g, api] = ortam(db);
    api.plan();
    assert.strictEqual(db.machines.length, 9, '1a: makine ' + db.machines.length);
    assert(db.machines.every(m => m.location === 'Ankara'), '1b: konum Ankara değil');
    // Sanifoam kodu MAKINE KODU sutununda gorunmeli, notlara gomulu degil
    assert(db.machines.every(m => /^910\.5\.\d+$/.test(m.code)),
        '1c: makine kodu Sanifoam kodu değil: ' + db.machines.map(m => m.code).join(', '));
    assert(db.machines.every(m => /Makina Kodu: /.test(m.notes)), '1d: kısa kod notlarda yok');
    const cnc = db.machines.find(m => m.name === 'CNC DIKEY SABLE');
    assert.strictEqual(cnc.code, '910.5.961', '1e: CNC kodu: ' + cnc.code);
    assert.strictEqual(cnc.notes, 'Makina Kodu: CNC', '1f: not: ' + cnc.notes);
    assert(g._kaydedildi, '1d: kaydedilmedi');
    console.log('✓ 1  9 makine Ankara konumuyla ve Sanifoam koduyla yazılıyor');
}

// 2) Planli bakim: tarih olanlara kayit, "SAATLİK BAKIM" olanlara YOK
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan();
    const planlar = db.maintenance.filter(x => x.id.startsWith('ank_p_'));
    assert.strictEqual(planlar.length, 7, '2a: planlı bakım ' + planlar.length + ' (7 olmalı)');
    planlar.forEach(p => assert(/^\d{4}-\d{2}-\d{2}$/.test(p.sched), '2b: geçersiz tarih: ' + p.sched));
    // FRT ve KOMP1 saatlik bakim: plana girmemeli
    assert(!db.maintenance.some(x => x.id === 'ank_p_FRT_2026'), '2c: FRT saatlik bakım plana girmiş');
    assert(!db.maintenance.some(x => x.id === 'ank_p_KOMP1_2026'), '2d: KOMP1 saatlik bakım plana girmiş');
    console.log('✓ 2  yalnızca tarihi olan 7 makineye planlı bakım; "SAATLİK BAKIM" tarihe çevrilmedi');
}

// 3) Biten bakimlar KAPALI, gelecektekiler acik
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan();
    const kapali = db.maintenance.filter(x => x.id.startsWith('ank_p_') && x.status === 'completed');
    const acik = db.maintenance.filter(x => x.id.startsWith('ank_p_') && x.status === 'scheduled');
    assert.strictEqual(kapali.length, 4, '3a: kapalı ' + kapali.length + ' (Nis/May/Haz/Tem = 4)');
    assert(kapali.every(x => x.comp), '3b: tamamlandı ama comp boş');
    assert(acik.every(x => !x.comp), '3c: açık ama comp dolu');
    assert(db.maintenance.some(x => x.id === 'ank_p_VRGL_2026' && x.status === 'scheduled'),
        '3d: Eylül planı kapatılmış');
    console.log('✓ 3  geçmiş 4 bakım kapalı, Eylül/Kasım açık');
}

// 4) Ayni yukleyici IKI KEZ calisirsa cift kayit olmuyor
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    const m1 = db.machines.length, b1 = db.maintenance.length, a1 = db.failures.length;
    api.plan(); api.ariza();
    assert.strictEqual(db.machines.length, m1, '4a: makine çoğaldı: ' + db.machines.length);
    assert.strictEqual(db.maintenance.length, b1, '4b: bakım çoğaldı: ' + db.maintenance.length);
    assert.strictEqual(db.failures.length, a1, '4c: arıza çoğaldı: ' + db.failures.length);
    console.log('✓ 4  iki kez çalıştırılsa da çift kayıt oluşmuyor');
}

// 5) MEVCUT kayitlar bozulmuyor (Cerkezkoy verisi duruyor)
{
    const cerkez = { id: 'czm_SJT', code: 'SJT', name: 'Su Jeti', location: 'Çerkezköy', criticality: 'high' };
    const eskiBakim = { id: 'cz_x_2025', machineId: 'czm_SJT', status: 'completed' };
    const db = { machines: [cerkez], maintenance: [eskiBakim], failures: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    assert.deepStrictEqual(db.machines.find(x => x.id === 'czm_SJT'), cerkez, '5a: Çerkezköy makinesi değişti');
    assert(db.maintenance.some(x => x.id === 'cz_x_2025'), '5b: Çerkezköy bakımı silinmiş');
    console.log('✓ 5  mevcut Çerkezköy kayıtlarına dokunulmuyor');
}

// 5b) AYNI KODLU Cerkezkoy makinesi olsa bile EZILMIYOR
{
    // Bugun cakisan kod yok; ama ileride Cerkezkoy'e 'CNC' eklenirse
    // Ankara yukleyicisi onu ezip konumunu degistirmemeli.
    const cz = { id: 'czm_CNC', code: 'CNC', name: 'Çerkezköy Dikey CNC',
                 location: 'Çerkezköy', dept: 'Kesim', criticality: 'critical',
                 status: 'running', notes: 'Cerkezkoy makinesi' };
    const db = { machines: [cz], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan();
    const sonra = db.machines.find(x => x.id === 'czm_CNC');
    assert.deepStrictEqual(sonra, cz, '5b1: Çerkezköy makinesi değiştirildi: ' + JSON.stringify(sonra));
    assert.strictEqual(sonra.location, 'Çerkezköy', '5b2: konumu Ankara yapılmış');
    // Ankara'nin kendi CNC'si AYRI bir kayit olarak acilmali
    const ankCnc = db.machines.filter(x => x.code === '910.5.961' && x.location === 'Ankara');
    assert.strictEqual(ankCnc.length, 1, '5b3: Ankara CNC açılmadı: ' + ankCnc.length);
    assert.strictEqual(db.machines.length, 10, '5b4: makine sayısı ' + db.machines.length + ' (1 + 9)');
    console.log('✓ 5b aynı kodlu Çerkezköy makinesi ezilmiyor, Ankara ayrı kayıt açıyor');
}

// 5c) Sanifoam kodu AYNI ise ayni makine sayilir (cift kayit acilmaz)
{
    // Eski yukleme: kod kisa kisaltmaydi, Sanifoam kodu nottaydi
    const mevcut = { id: 'eski1', code: 'CMS', name: 'Eski ad',
                     location: 'Ankara', notes: 'Sanifoam Kodu: 910.5.163' };
    const db = { machines: [mevcut], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan();
    assert.strictEqual(db.machines.length, 9, '5c1: çift kayıt: ' + db.machines.length);
    const g = db.machines.find(x => x.id === 'eski1');
    assert.strictEqual(g.code, '910.5.163', '5c2: kod Sanifoam koduna çevrilmedi: ' + g.code);
    console.log('✓ 5c eski (kısa kodlu) yükleme güncelleniyor, ikinci kayıt açılmıyor');
}

// 6) Arizalar: 19 kayit, hepsi bir makineye bagli ve KAPALI
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    const arz = db.failures.filter(x => x.id.startsWith('ank_a_'));
    assert.strictEqual(arz.length, 19, '6a: arıza ' + arz.length);
    const idler = new Set(db.machines.map(m => m.id));
    assert(arz.every(f => idler.has(f.machineId)), '6b: makinesiz arıza var');
    assert(arz.every(f => f.status === 'closed'), '6c: kapatılmamış arıza var');
    assert(arz.every(f => /^2026-\d\d-\d\dT\d\d:\d\d$/.test(f.startTime)), '6d: tarih biçimi');
    assert(arz.every(f => f.endTime >= f.startTime), '6e: teslim arızadan önce');
    console.log('✓ 6  19 arıza doğru makineye bağlı, tarihleri tutarlı, kapalı');
}

// 7) Makine YOKSA uydurma ariza acilmiyor
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [g, api] = ortam(db);
    api.ariza();                       // once plan calismadi: makine yok
    assert.strictEqual(db.failures.length, 0, '7a: makinesiz arıza yazıldı: ' + db.failures.length);
    assert(/atland/.test(g._mesaj || ''), '7b: kullanıcıya bildirilmedi: ' + g._mesaj);
    console.log('✓ 7  makine yokken arıza uydurulmuyor, atlandığı bildiriliyor');
}

// 8) Goruntuleme modunda YAZMIYOR
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [g, api] = ortam(db, false);
    api.plan(); api.ariza();
    assert.strictEqual(db.machines.length, 0, '8a: görüntüleme modunda yazdı');
    assert.strictEqual(db.failures.length, 0, '8b: görüntüleme modunda arıza yazdı');
    console.log('✓ 8  görüntüleme modunda hiçbir şey yazılmıyor');
}

// 9) Periyodik bakim revizyonlari ariza degil, BAKIM olarak giriyor
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    const pr = db.maintenance.filter(x => x.id.startsWith('ank_pr_'));
    assert.strictEqual(pr.length, 2, '9a: periyodik bakım ' + pr.length);
    assert(pr.every(x => x.status === 'completed' && x.type === 'preventive'), '9b: durum/tip');
    assert(!db.failures.some(f => /PERİYODİK/.test(f.rootCause || '')), '9c: periyodik bakım arızaya yazılmış');
    console.log('✓ 9  periyodik bakım revizyonları arıza değil, tamamlanmış bakım');
}

// 10) Dugmeler arayuze eklenmis
{
    assert(/onclick="loadAnkaraPlan\(\)"/.test(src), '10a: plan düğmesi yok');
    assert(/onclick="loadAnkaraAriza\(\)"/.test(src), '10b: arıza düğmesi yok');
    assert(/Ankara Planı Yükle/.test(src), '10c: plan düğmesi etiketi');
    assert(/Ankara Arızalarını Yükle/.test(src), '10d: arıza düğmesi etiketi');
    console.log('✓ 10 "Ankara Planı Yükle" ve "Ankara Arızalarını Yükle" düğmeleri var');
}

console.log('\nTüm senaryolar geçti.');
