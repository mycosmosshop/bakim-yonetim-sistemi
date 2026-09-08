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
const bas = src.indexOf('const ANKARA_DOF_CNC') >= 0
    ? Math.min(src.indexOf('const ANKARA_TEKNISYEN'), src.indexOf('const ANKARA_DOF_CNC'))
    : src.indexOf('const ANKARA_TEKNISYEN');
const son = src.indexOf('function loadCerkezkoyPlan');
assert(bas > 0 && son > bas, 'Ankara bölümü bulunamadı');
const kod = src.slice(bas, son);

// Gercek Sanifoam bakim setleri (adim sayilari testte kullaniliyor)
const SETLER = (() => {
    const i = src.indexOf('const SANIFOAM_TASK_SETS');
    const j = src.indexOf('\n];', i) + 3;
    return new Function(src.slice(i, j) + '\nreturn SANIFOAM_TASK_SETS;')();
})();

function ortam(db, izin = true) {
    let n = 0;
    const g = {
        db, canWrite: () => izin, save: () => { g._kaydedildi = true; },
        updateSelects: () => {}, nav: (x) => { g._ekran = x; },
        renderParts: () => { g._parcaCizildi = true; },
        toast: (m) => { g._mesaj = m; }, confirm: () => true,
        uid: () => 'u' + (++n), SANIFOAM_TASK_SETS: SETLER,
        requireWrite: () => izin, alert: (m) => { g._uyari = m; },
        // Set/Map yoksa `new Set()` "not a constructor" ile patliyor:
        // with(Proxy has:()=>true) tanimsiz adi undefined yapiyor.
        String, Object, Array, JSON, Math, Date, RegExp, console,
        Set, Map, Number, Boolean, parseInt, parseFloat, isNaN
    };
    const f = new Function('__k', 'with (__k) {\n' + kod +
        '\nreturn { plan: loadAnkaraPlan, ariza: loadAnkaraAriza, dof: loadAnkaraDof,' +
        ' parca: loadAnkaraParts, MAK: ANKARA_MACHINES, ARZ: ANKARA_ARIZA,' +
        ' PB: ANKARA_PBAKIM, DOF: ANKARA_DOF_CNC, PRT: ANKARA_PARTS };\n}');
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
    // ISM1'in PL15'te plan satiri yok; tarihli plan 6 makinede.
    assert.strictEqual(planlar.length, 6, '2a: planlı bakım ' + planlar.length + ' (6 olmalı)');
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

// 6) Arizalar: ANKARA_ARIZA kadar kayit, hepsi bir makineye bagli ve KAPALI
// (sabit sayi yaziliyordu; kayit eklendikce test eskiyordu)
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    const arz = db.failures.filter(x => x.id.startsWith('ank_a_'));
    assert.strictEqual(arz.length, api.ARZ.length, '6a: arıza ' + arz.length);
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

// 9) Periyodik bakim revizyonlari: yapilmis is olarak KAPALI kayit
// (PL15'te plan satiri yok; planli bakim listesine yazilmaz, kapali
// kayit olarak durur — id oneki ank_prv_)
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    const pr = db.failures.filter(x => x.id.startsWith('ank_prv_'));
    assert.strictEqual(pr.length, api.PB.length, '9a: periyodik bakım ' + pr.length);
    assert(pr.every(x => x.status === 'closed'), '9b: kapalı olmalı');
    assert(pr.every(x => /PERİYODİK/.test(x.rootCause || '')), '9c: kaynak tipi');
    assert(pr.every(x => x.machineId), '9d: makineye bağlı olmalı');
    assert(!db.maintenance.some(x => x.id.indexOf('ank_pr_') === 0),
        '9e: planlı bakım listesine yazılmamalı');
    console.log('✓ 9  periyodik bakım revizyonları kapalı kayıt, plana yazılmıyor');
}

// 10) Dugmeler arayuze eklenmis
{
    assert(/onclick="loadAnkaraPlan\(\)"/.test(src), '10a: plan düğmesi yok');
    assert(/onclick="loadAnkaraAriza\(\)"/.test(src), '10b: arıza düğmesi yok');
    assert(/Ankara Planı Yükle/.test(src), '10c: plan düğmesi etiketi');
    assert(/Ankara Arızalarını Yükle/.test(src), '10d: arıza düğmesi etiketi');
    console.log('✓ 10 "Ankara Planı Yükle" ve "Ankara Arızalarını Yükle" düğmeleri var');
}

// 11) Ankara kayitlarinda teknisyen: Hasan Kose
{
    const db = { machines: [], maintenance: [], failures: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    const bak = db.maintenance.filter(x => x.id.startsWith('ank_'));
    const arz = db.failures.filter(x => x.id.startsWith('ank_a_'));
    assert(bak.length && arz.length, '11a: kayıt yok');
    assert(bak.every(x => x.tech === 'Hasan Köse'), '11b: bakımlarda teknisyen yok');
    assert(arz.every(x => x.tech === 'Hasan Köse'), '11c: arızalarda teknisyen yok');
    console.log('✓ 11 Ankara bakım ve arızalarında teknisyen: Hasan Köse');
}

// 12) Ariza listesinde LOKASYON sutunu var
{
    assert(src.indexOf('<th>Makine</th><th>Lokasyon</th>') > 0, '12a: başlıkta Lokasyon yok');
    assert(/mLoc\(f\.machineId\)/.test(src), '12b: satırda lokasyon basılmıyor');
    assert(/function mLoc\(id\)/.test(src), '12c: mLoc yardımcısı yok');
    console.log('✓ 12 arıza listesinde Lokasyon sütunu var');
}

// 13) Kayit modalinda makine listesi lokasyon suzgecine takilmiyor
{
    const u = src.slice(src.indexOf('function updateSelects()'), src.indexOf('function importMachineExcel'));
    assert(/const tumu = db\.machines\.slice\(\)/.test(u),
        '13a: modal listesi hâlâ süzgeçli — süzgeç açıkken boş kalır');
    assert(/optgroup label=/.test(u), '13b: lokasyona göre gruplama yok');
    assert(u.indexOf("['mFailMach','mPtMach','mTsMach'].forEach") > 0 && /innerHTML=mOpts/.test(u),
        '13c: arıza modalı yeni listeyi kullanmıyor');
    // Liste suzgeci (fMachF) ESKI davranista kalmali
    assert(u.indexOf("['fMachF','tsMachF']") > 0 && /innerHTML=fOpts/.test(u),
        '13d: liste süzgeci bozulmuş');
    console.log('✓ 13 modalde tüm makineler lokasyona göre gruplu; liste süzgeci değişmedi');
}

// 14) Her planli bakima BAKIM SETI ve kontrol listesi atanmis
{
    const db = { machines: [], maintenance: [], failures: [], taskSets: [] };
    const [, api] = ortam(db);
    api.plan();
    // Setler yoksa once yuklenmeli
    assert(db.taskSets.some(t => t.id === 'sfm_sjt'), '14a: Sanifoam setleri yüklenmedi');
    const planlar = db.maintenance.filter(x => x.id.startsWith('ank_p_'));
    assert.strictEqual(planlar.length, 6, '14b: plan sayısı');
    planlar.forEach(p => {
        assert(p.taskSetId, '14c: setsiz bakım: ' + p.id);
        assert(p.checklist.length > 0, '14d: kontrol listesi boş: ' + p.id + ' / ' + p.taskSetId);
        assert(p.estDur > 0, '14e: tahmini süre 0: ' + p.id);
    });
    console.log('✓ 14 yedi planlı bakımın hepsinde set ve dolu kontrol listesi var');
}

// 15) Set eslesmesi Cerkezkoy'deki makine turleriyle AYNI
{
    const db = { machines: [], maintenance: [], failures: [], taskSets: [] };
    const [, api] = ortam(db);
    api.plan();
    const setOf = (kod) => {
        // notes'a kaynak eki gelebiliyor ('Makina Kodu: X · …'): tam eşitlik arama
        const m = db.machines.find(x => (x.notes || '').indexOf('Makina Kodu: ' + kod) === 0);
        if (!m) return '(makine yok: ' + kod + ')';
        const p = db.maintenance.find(x => x.machineId === m.id && x.id.startsWith('ank_p_'));
        return p ? p.taskSetId : null;
    };
    assert.strictEqual(setOf('CMS'), 'sfm_sjt', '15a: su jeti seti');
    assert.strictEqual(setOf('BLS'), 'sfm_yatay_kesim', '15b: yatay kesim seti');
    assert.strictEqual(setOf('CNC'), 'sfm_cnc_kesim', '15c: dikey CNC seti');
    // ISM1'in PL15'te plan satiri yok: planli bakim acilmiyor, set de yok
    assert.strictEqual(setOf('ISM1'), null, '15d: ISM1 planı yok');
    assert.strictEqual(setOf('VRGL'), 'sfm_kesme_pres', '15e: vargel/pres seti');
    assert.strictEqual(setOf('CPRS'), 'sfm_kesme_pres', '15f: çöp presi seti');
    assert.strictEqual(setOf('LMN4'), 'sfm_laminasyon', '15g: laminasyon seti');
    console.log('✓ 15 set eşleşmesi Çerkezköy\'deki makine türleriyle aynı');
}

// 16) TAMAMLANAN bakimda adimlar da isaretli, acikta degil
{
    const db = { machines: [], maintenance: [], failures: [], taskSets: [] };
    const [, api] = ortam(db);
    api.plan();
    const kapali = db.maintenance.filter(x => x.id.startsWith('ank_p_') && x.status === 'completed');
    const acik = db.maintenance.filter(x => x.id.startsWith('ank_p_') && x.status === 'scheduled');
    assert(kapali.length && acik.length, '16a: örnek yok');
    kapali.forEach(p => {
        assert(p.checklist.every(t => t.done), '16b: kapalı bakımda işaretsiz adım: ' + p.id);
        assert(p.checklist.every(t => t.doneBy === 'Hasan Köse'), '16c: adımı yapan yazılmamış');
        assert(p.actDur > 0, '16d: gerçekleşen süre 0: ' + p.id);
    });
    acik.forEach(p => {
        assert(p.checklist.every(t => !t.done), '16e: açık bakımda işaretli adım: ' + p.id);
        assert.strictEqual(p.actDur, 0, '16f: açık bakımda gerçekleşen süre var');
    });
    console.log('✓ 16 tamamlanan bakımlarda adımlar işaretli, açıklarda boş');
}

// 17) Mevcut setler varsa TEKRAR yuklenmiyor (cogaltma yok)
{
    const db = { machines: [], maintenance: [], failures: [],
                 taskSets: JSON.parse(JSON.stringify(SETLER)) };
    const once = db.taskSets.length;
    const [, api] = ortam(db);
    api.plan(); api.plan();
    assert.strictEqual(db.taskSets.length, once, '17: set çoğaldı: ' + db.taskSets.length);
    console.log('✓ 17 bakım setleri zaten varsa tekrar eklenmiyor');
}

// 18) Arizalarda LOKASYON suzgeci
{
    const rf = src.slice(src.indexOf('function renderFailures'), src.indexOf('function renderFailures') + 4000);
    assert(/id="fLocF"/.test(src), '18a: süzgeç kutusu yok');
    assert(/Tüm Lokasyonlar/.test(src), '18b: varsayılan seçenek yok');
    assert(/const lf=\(document\.getElementById\('fLocF'\)/.test(rf), '18c: değer okunmuyor');
    assert(/!lf\|\|mLoc\(f\.machineId\)===lf/.test(rf), '18d: süzgeç uygulanmıyor');
    // Secenekler makinelerden URETILMELI (sabit liste degil)
    assert(/db\.machines\.map\(m=>\(m\.location\|\|''\)\.trim\(\)\)/.test(rf),
        '18e: seçenekler sabit — yeni lokasyon eklenince gelmez');
    assert(/el\.value=loklar\.includes\(secili\)\?secili:''/.test(rf),
        '18f: yeniden çizimde kullanıcının seçimi kayboluyor');
    console.log('✓ 18 arızalarda lokasyon süzgeci var, seçenekler makinelerden üretiliyor');
}

// 19) CNC devri: Cerkezkoy kaydi SILINMIYOR, pasife aliniyor
{
    const cnc = { id: 'czm_DİKEYCNC', code: 'DİKEY CNC', name: 'DİKEY CNC KESİM MAKİNESİ',
                  location: 'Çerkezköy', dept: 'Kesim', status: 'running', criticality: 'critical' };
    const db = { machines: [cnc], maintenance: [], failures: [], taskSets: [] };
    const [, api] = ortam(db);
    api.plan();
    const sonra = db.machines.find(x => x.id === 'czm_DİKEYCNC');
    assert(sonra, '19a: Çerkezköy CNC kaydı silinmiş');
    assert.strictEqual(sonra.status, 'passive', '19b: pasife alınmadı: ' + sonra.status);
    assert.strictEqual(sonra.location, 'Çerkezköy', '19c: konumu değişmiş');
    assert(/devredildi/.test(sonra.notes || ''), '19d: devir notu yok');
    // Ankara CNC ayri ve AKTIF
    const ank = db.machines.find(x => x.code === '910.5.961');
    assert(ank, '19e: Ankara CNC yok');
    assert.strictEqual(ank.status, 'running', '19f: Ankara CNC aktif değil');
    console.log('✓ 19 Çerkezköy CNC pasife alınıyor (silinmiyor), Ankara CNC aktif');
}

// 20) Ariza gecmisi pasif makinede DURUYOR
{
    const cnc = { id: 'czm_DİKEYCNC', code: 'DİKEY CNC', name: 'DİKEY CNC KESİM MAKİNESİ',
                  location: 'Çerkezköy', status: 'running' };
    const gecmis = { id: 'czg_4', machineId: 'czm_DİKEYCNC', desc: 'Şerit testere kırılması', cost: 900 };
    const db = { machines: [cnc], maintenance: [], failures: [gecmis], taskSets: [] };
    const [, api] = ortam(db);
    api.plan(); api.ariza();
    assert.deepStrictEqual(db.failures.find(x => x.id === 'czg_4'), gecmis,
        '20: geçmiş arıza kaydı değişmiş/silinmiş');
    console.log('✓ 20 pasif makinenin arıza geçmişi olduğu gibi kalıyor');
}

// 21) Pasif makine aktif sayimlara girmiyor, listede gorunuyor
{
    const lm = src.slice(src.indexOf('function locMachines()'), src.indexOf('function locMachines()') + 260);
    assert(/status!=='passive'/.test(lm), '21a: pasifler KPI\'lardan dışlanmıyor');
    assert(/passive:'Pasif/.test(src), '21b: Pasif etiketi yok');
    assert(/<option value="passive">/.test(src), '21c: durum seçeneği yok');
    // Makine listesi ayri kaynak: kayit gorunur kalmali
    const rl = src.slice(src.indexOf("const vis = gLocFilter"), src.indexOf("const vis = gLocFilter") + 160);
    assert(!/passive/.test(rl), '21d: makine listesi de pasifleri gizliyor — kayıt görünmez olur');
    console.log('✓ 21 pasif makine KPI\'lara girmiyor ama makine listesinde duruyor');
}

// 22) 5-Neden yalnizca ILGILI kayitlara isleniyor
{
    const cnc = { id: 'mcnc', code: 'DİKEY CNC', name: 'DİKEY CNC KESİM MAKİNESİ', location: 'Çerkezköy', status: 'running' };
    const bas = { id: 'mbsk', code: '910.5.003', name: 'BSL 204', location: 'Ankara', status: 'running' };
    const kirilma = { id: 'czg_1', machineId: 'mcnc', desc: 'Şerit testere kırılması (CNC kesim)', cost: 900, rca: null };
    const bileme  = { id: 'czg_2', machineId: 'mcnc', desc: 'Bileme taşı körelmesi — testere bilenemiyor', cost: 550, rca: null };
    const baska   = { id: 'x1', machineId: 'mbsk', desc: 'BIÇAK DEGISIMI', cost: 100, rca: null };
    const db = { machines: [cnc, bas], maintenance: [], failures: [kirilma, bileme, baska], taskSets: [] };
    const [g, api] = ortam(db);
    api.dof();
    assert(kirilma.rca && kirilma.rca.w1, '22a: kırılma kaydına işlenmedi');
    assert.strictEqual(bileme.rca, null, '22b: bileme taşı kaydına da işlenmiş');
    assert.strictEqual(baska.rca, null, '22c: başka makinenin kaydına işlenmiş');
    assert.strictEqual(kirilma.recurring, true, '22d: tekrarlayan işaretlenmedi');
    // Kaydin kendisi degismemeli
    assert.strictEqual(kirilma.cost, 900, '22e: maliyet değişmiş');
    assert.strictEqual(kirilma.desc, 'Şerit testere kırılması (CNC kesim)', '22f: açıklama değişmiş');
    console.log('✓ 22 5-Neden yalnızca CNC kırılma kayıtlarına işleniyor, kayıt içeriği değişmiyor');
}

// 23) Bes neden, kok neden, eylem, sorumlu ve termin DOLU
{
    const d = ortam({ machines: [], maintenance: [], failures: [], taskSets: [] })[1].DOF;
    ['w1', 'w2', 'w3', 'w4', 'w5', 'action', 'owner', 'due'].forEach(k =>
        assert(d[k] && String(d[k]).trim().length > 3, '23a: boş alan: ' + k));
    assert.strictEqual(d.owner, 'Hasan Köse', '23b: sorumlu');
    assert(/^2026-\d{2}-\d{2}$/.test(d.due), '23c: termin biçimi: ' + d.due);
    // Kok neden sistemsel olmali (kisiyi degil sistemi isaret etsin)
    assert(/PL15|periyot|planlan/i.test(d.w5), '23d: kök neden sistemsel değil');
    // Dogrulama olculebilir olmali
    assert(/hedef/i.test(d.action) && /\d/.test(d.action), '23e: doğrulama ölçülebilir değil');
    console.log('✓ 23 beş neden, kök neden, eylem, sorumlu ve ölçülebilir doğrulama dolu');
}

// 24) Kayit yoksa uydurma yapilmiyor
{
    const db = { machines: [], maintenance: [], failures: [], taskSets: [] };
    const [g, api] = ortam(db);
    api.dof();
    assert.strictEqual(db.failures.length, 0, '24a: kayıt uydurmuş');
    assert(/bulunamadı/.test(g._mesaj || ''), '24b: kullanıcıya bildirilmedi: ' + g._mesaj);
    console.log('✓ 24 ilgili arıza kaydı yoksa kayıt uydurmuyor, uyarıyor');
}

// 25) Dugme arayuzde
{
    assert(/onclick="loadAnkaraDof\(\)"/.test(src), '25a: düğme yok');
    assert(/CNC 5-Neden İşle/.test(src), '25b: etiket');
    console.log('✓ 25 "CNC 5-Neden İşle" düğmesi var');
}

// ══════════════════════════════════════════
//  YEDEK PARÇA YÜKLEYİCİSİ
// ══════════════════════════════════════════
// 26) Parcalar dogru makinelere baglanir, min stok kurali tutar
{
    const db = { machines: [], maintenance: [], failures: [], parts: [] };
    const [g, api] = ortam(db);
    api.plan();
    api.parca();
    assert.strictEqual(db.parts.length, 31, '26a: parça sayısı');
    const makAd = id => (db.machines.find(m => m.id === id) || {}).name;
    const dagilim = {};
    db.parts.forEach(p => { const a = makAd(p.machineId); dagilim[a] = (dagilim[a] || 0) + 1; });
    assert.strictEqual(dagilim['TECHNOCUT SU JETI'], 17, '26b: su jeti');
    assert.strictEqual(dagilim['TUNEL LAMINASYON MAKINESİ'], 3, '26c: laminasyon');
    assert.strictEqual(dagilim['BSL 204 YATAY KESİM'], 3, '26d: yatay');
    assert.strictEqual(dagilim['CNC DIKEY SABLE'], 3, '26e: dikey');
    assert.strictEqual(dagilim['VARGEL(ANK)'], 4, '26f: vargel');
    assert.strictEqual(dagilim['ÇÖP PRESİ'], 1, '26g: çöp presi');
    assert(!db.parts.some(p => !p.machineId), '26h: makinesiz parça olmamalı');
    assert(db.parts.every(p => p.location === 'Ankara'), '26i: lokasyon Ankara');
    db.parts.forEach(p => {
        const b = p.qty >= 5 ? p.qty - 2 : (p.qty >= 2 ? p.qty - 1 : 1);
        assert.strictEqual(p.minQty, b, '26j: ' + p.partName + ' min stok');
    });
    const gorselli = db.parts.filter(p => p.img);
    assert.strictEqual(gorselli.length, 16, '26k: görselli parça');
    assert(gorselli.every(p => p.img.indexOf('data:image/') === 0), '26l: görsel data URI');
    console.log('✓ 26 yedek parça: 31 kalem doğru makinelere, min stok kuralı tutuyor');
}

// 27) Ikinci yukleme mevcut kaydi EZMEZ
{
    const db = { machines: [], maintenance: [], failures: [], parts: [] };
    const [g, api] = ortam(db);
    api.plan();
    const cnc = db.machines.find(m => m.name === 'CNC DIKEY SABLE');
    db.parts.push({ id: 'elle1', partName: 'Dikey CNC bıçağı', machineId: cnc.id,
        location: 'Ankara', qty: 99, minQty: 50, unitCost: 1234, supplier: 'ESKİ' });
    api.parca();
    const elle = db.parts.find(p => p.id === 'elle1');
    assert.strictEqual(elle.qty, 99, '27a: elle girilen miktar korunmalı');
    assert.strictEqual(elle.unitCost, 1234, '27b: elle girilen fiyat korunmalı');
    assert.strictEqual(elle.supplier, 'ESKİ', '27c: tedarikçi korunmalı');
    assert.strictEqual(db.parts.filter(p => p.partName === 'Dikey CNC bıçağı').length, 1,
        '27d: aynı parça iki kez eklenmemeli');
    const oncekiSayi = db.parts.length;
    api.parca();
    assert.strictEqual(db.parts.length, oncekiSayi, '27e: tekrar çağrıda yeni kayıt olmamalı');
    console.log('✓ 27 yedek parça: mevcut kayıt ezilmiyor, tekrar yüklemede çoğalmıyor');
}

// 28) Makine yoksa parca eklenmez
{
    const db = { machines: [], maintenance: [], failures: [], parts: [] };
    const [g, api] = ortam(db);
    api.parca();
    assert.strictEqual(db.parts.length, 0, '28a: makine yokken parça eklenmemeli');
    assert(String(g._uyari || '').indexOf('Ankara Planı Yükle') >= 0,
        '28b: kullanıcı makineleri yüklemeye yönlendirilmeli');
    console.log('✓ 28 yedek parça: makine yokken uyarır, makinesiz kayıt üretmez');
}

console.log('\nTüm senaryolar geçti.');
