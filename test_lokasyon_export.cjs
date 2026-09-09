// Disa aktarim lokasyon filtresine uyuyor mu?
//
// Sikayet: "yedek parca listesinde excel disari alirken tum lokasyonlari
// aliyor, Ankara secili iken Ankara'yi alsin". Rapor basligi da lokasyonu
// yazar; liste ile baslik AYNI seyi soylemeli.
//
// Gercek fonksiyonlar calistirilir (yardimci degil): _exportPartsExcelImpl,
// _printPartsListImpl ve genExcelReport'un baslik satiri.
const fs = require('fs'), assert = require('assert');
const YOL = 'C:/Users/User/Desktop/Bakım/bakim_yonetim_sistemi.html';
const src = fs.readFileSync(YOL, 'utf8');

function kes(bas, son, etiket) {
    const i = src.indexOf(bas);
    assert(i > 0, etiket + ' bulunamadı: ' + bas);
    const j = src.indexOf(son, i);
    assert(j > i, etiket + ' sonu bulunamadı');
    return src.slice(i, j);
}

// Test edilen gercek kod parcalari
const kodLoc = kes('function locMids()', 'function locFix()', 'locMids');
const kodExp = kes('function exportPartsExcel()', '// Fikstür / Kalıp → Excel',
    'exportPartsExcel');

function ortam(db, loc) {
    const g = {
        db, gLocFilter: loc, formSettings: { ptDocNo: 'BYS-YP-001', ptRevNo: '00' },
        loadFormSettings: () => {}, _askPrintDate: (f) => f(),
        mName: (id) => (db.machines.find(m => m.id === id) || {}).name || '—',
        _ptActiveCols: () => [], daysDiff: () => 0, fmtD: (d) => d,
        _genDate: () => '09.09.2026', toast: (m) => { g._mesaj = m; },
        document: { querySelectorAll: () => [], getElementById: () => null },
        genExcelReport: (o) => { g._excel = o; },
        _printHTML: () => {}, window: {}, open: () => null,
        String, Object, Array, JSON, Math, Date, RegExp, console,
        Set, Map, Number, Boolean, parseInt, parseFloat, isNaN
    };
    const f = new Function('__k', 'with (__k) {\n' + kodLoc + '\n' + kodExp +
        '\nreturn { excel: _exportPartsExcelImpl, mids: locMids };\n}');
    return [g, f(new Proxy(g, { has: () => true, get: (t, p) => (p in t ? t[p] : undefined) }))];
}

// Iki lokasyonlu gercekci veri
function veri() {
    return {
        machines: [
            { id: 'ank_CMS', name: 'TECHNOCUT SU JETI', location: 'Ankara' },
            { id: 'ank_VRGL', name: 'VARGEL(ANK)', location: 'Ankara' },
            { id: 'ank_ESKI', name: 'ESKI ANK MAKINE', location: 'Ankara', status: 'passive' },
            { id: 'ck_SJT', name: 'SJT SU JETİ KESİM', location: 'Çerkezköy' },
            { id: 'ck_DLM', name: 'DLM DILIMLEME MAKINESI', location: 'Çerkezköy' }
        ],
        parts: [
            { id: 'p1', machineId: 'ank_CMS', partName: 'Orifiz', qty: 16, minQty: 14 },
            { id: 'p2', machineId: 'ank_CMS', partName: 'Mantar', qty: 2, minQty: 1 },
            { id: 'p3', machineId: 'ank_VRGL', partName: 'Gergi kayışı', qty: 5, minQty: 3 },
            { id: 'p4', machineId: 'ank_ESKI', partName: 'Devredilen parça', qty: 1, minQty: 1 },
            { id: 'p5', machineId: 'ck_SJT', partName: 'Su jeti orifis', qty: 15, minQty: 4 },
            { id: 'p6', machineId: 'ck_DLM', partName: 'Bıçak takımı', qty: 10, minQty: 3 },
            { id: 'p7', machineId: 'yok_makine', partName: 'Sahipsiz parça', qty: 1, minQty: 1 }
        ]
    };
}

let hata = 0;
const ol = (ad, kosul, mesaj) => {
    if (kosul) { console.log('  ✓ ' + ad); }
    else { console.log('  ✗ ' + ad + ' — ' + mesaj); hata++; }
};

// 1) Ankara secili: yalniz Ankara parcalari
{
    const [g, api] = ortam(veri(), 'Ankara');
    api.excel();
    const r = g._excel.rows;
    ol('Ankara seçili → yalnız Ankara parçaları', r.length === 4,
        'beklenen 4, gelen ' + r.length);
    const makineler = new Set(r.map(x => x.values[1]));
    ol('Çerkezköy parçası sızmıyor',
        !makineler.has('SJT SU JETİ KESİM') && !makineler.has('DLM DILIMLEME MAKINESI'),
        [...makineler].join(', '));
    ol('Devredilen (pasif) makinenin parçası da geliyor',
        r.some(x => x.values[2] === 'Devredilen parça'),
        'pasif makine parçası düşmüş — geçmiş kaybolur');
    ol('Sahipsiz parça Ankara listesine girmiyor',
        !r.some(x => x.values[2] === 'Sahipsiz parça'), 'sahipsiz parça sızdı');
}

// 2) Filtre yok: hepsi
{
    const [g, api] = ortam(veri(), '');
    api.excel();
    ol('Filtre yok → tüm parçalar (7)', g._excel.rows.length === 7,
        'gelen ' + g._excel.rows.length);
}

// 3) Cerkezkoy secili
{
    const [g, api] = ortam(veri(), 'Çerkezköy');
    api.excel();
    ol('Çerkezköy seçili → 2 parça', g._excel.rows.length === 2,
        'gelen ' + g._excel.rows.length);
}

// 4) Baslik ile liste ayni lokasyonu soylemeli
{
    const satir = kes("scl.value=`${opts.reportTitle", '`;', 'başlık satırı');
    ol('Excel başlığı gLocFilter okuyor', /gLocFilter\|\|'Tüm Lokasyonlar'/.test(satir),
        satir.slice(0, 90));
    ol('Excel başlığı kayıt sayısını listeden alıyor',
        /opts\.rows\.length/.test(satir), satir.slice(0, 90));
}

// 5) Bos lokasyon: uyari verilmeli, bos dosya uretilmemeli
{
    const db = veri();
    db.parts = db.parts.filter(p => p.machineId.startsWith('ck_'));
    const [g, api] = ortam(db, 'Ankara');
    api.excel();
    const bos = !g._excel || !g._excel.rows.length;
    ol('Ankara’da parça yokken boş Excel üretilmiyor', bos,
        'boş listeyle dosya üretildi (' + (g._excel && g._excel.rows.length) + ' satır)');
}

// 6) Secim SAYFA YENILENINCE korunmali
//    Asil hata buydu: gLocFilter yalniz bellekteydi. Yenilemeden sonra
//    bosaliyor, <select> ise tarayicinin form geri yuklemesiyle "Ankara"
//    gosteriyordu — ekran Ankara, rapor tum lokasyonlar.
{
    const kodLoc2 = kes('// ── Global Location Filter ──', 'function _updateLocBadges',
        'applyGlobalLoc');
    const kodRol = kes('function applyRoleUI()', 'function nav(sec)', 'applyRoleUI');
    const depo = {};
    const secim = { value: '', disabled: false };
    const g = {
        db: veri(), gLocFilter: '', _lockedLoc: null, currentProfile: null,
        isAdminUser: () => true, _userRole: () => 'admin',
        localStorage: {
            getItem: (k) => (k in depo ? depo[k] : null),
            setItem: (k, v) => { depo[k] = String(v); }
        },
        document: {
            getElementById: (id) => (id === 'gLocFilterEl' ? secim : null),
            querySelectorAll: () => [], querySelector: () => null,
            body: { classList: { toggle: () => {}, contains: () => false } }
        },
        nav: () => {}, _updateLocBadges: () => {},
        String, Object, Array, JSON, Math, Date, RegExp, console,
        Set, Map, Number, Boolean, parseInt, parseFloat, isNaN
    };
    const api = new Function('__k', 'with (__k) {\n' + kodLoc2 + '\n' + kodRol +
        '\nreturn { sec: applyGlobalLoc, rol: applyRoleUI, oku: ()=>gLocFilter };\n}'
    )(new Proxy(g, { has: () => true, get: (t, p) => (p in t ? t[p] : undefined) }));

    api.sec('Ankara');
    ol('Seçim saklanıyor', depo.cmms_loc_filter === 'Ankara',
        'localStorage: ' + JSON.stringify(depo));

    // Sayfa yenilendi: gLocFilter sifir, select tarayicidan "Ankara" ile geldi
    const [g2, api2] = [g, null]; void api2;
    const depo2 = depo;
    const secim2 = { value: 'Ankara', disabled: false };
    const g3 = Object.assign({}, g2, {
        gLocFilter: '', localStorage: g2.localStorage,
        document: Object.assign({}, g2.document,
            { getElementById: (id) => (id === 'gLocFilterEl' ? secim2 : null) })
    });
    const api3 = new Function('__k', 'with (__k) {\n' + kodLoc2 + '\n' + kodRol +
        '\nreturn { rol: applyRoleUI, oku: ()=>gLocFilter };\n}'
    )(new Proxy(g3, { has: () => true, get: (t, p) => (p in t ? t[p] : undefined) }));
    api3.rol();
    ol('Yenileme sonrası seçim geri yükleniyor', api3.oku() === 'Ankara',
        'gLocFilter="' + api3.oku() + '" — ekranda Ankara, raporda tüm lokasyonlar');
    void depo2;
}

console.log('\n' + (hata ? hata + ' test BAŞARISIZ' : 'tüm testler geçti'));
process.exit(hata ? 1 : 0);
