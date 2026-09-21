// KPI hedefi "Kaydet & Uygula"dan sonra yenilemede kaliyor mu?
//
// KIRILAN HAL (21.09.2026): Ankara MTBF hedefi 200->500, MTTR 4->10 yapilip
// kaydedildi, sayfa yenilenince eski degerler geri geldi. Iki hata birlikte:
//
//   1) SIRA — saveKpiConfig() once _vardiyaFormKaydet() cagiriyordu; o da
//      saveVardiya() -> cloudPush() yapiyor. O anda kpiConfig HENUZ
//      guncellenmemisti: vardiya kaydi ESKI hedefleri buluta yaziyordu.
//   2) GECIKME — saveKpiStore() scheduleCloudSync() (1,2 sn) kullaniyordu.
//      saveVardiya Eylul'de beklemeden push'a cevrilmisti, bu atlanmisti.
//
// Acilista `kpiConfig = cloud.kpiConfig` yereli de ezdigi icin kayip kalici.
//
// Test GERCEK fonksiyonlari HTML'den cikarip sahte DOM/bulut ile kosar ve
// PUSH ANINDAKI kpiConfig'e bakar — "kaydedildi" mesaji degil, buluta giden
// veri olculur.
//
// Calistir:  node test_kpi_hedef_kalici.cjs
const fs = require('fs'), assert = require('assert'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'bakim_yonetim_sistemi.html'), 'utf8');

function cikar(imza, bitis) {
    const i = src.indexOf(imza);
    assert(i > 0, 'bulunamadi: ' + imza);
    const j = src.indexOf(bitis, i);
    assert(j > i, 'sonu bulunamadi: ' + imza);
    return src.slice(i, j + bitis.length);
}

// Imza ESNEK: ayni test hem duzeltilmis (async saveKpiConfig) hem eski
// (sync) surumde kosar. Boylece "eski kodda gercekten kiriliyor mu"
// olculebilir — testin kendi dogrulugunun kaniti budur.
function cikarRe(re, bitis) {
    const m = src.match(re);
    assert(m, 'bulunamadi: ' + re);
    return cikar(m[0], bitis);
}
const kod = [
    cikarRe(/function saveKpiStore\(\)\{/, '\n}'),
    cikarRe(/function setSyncStatus\(state\)\{/, '\n}'),
    cikarRe(/(?:async )?function saveKpiConfig\(\)\{/, '\n}'),
].join('\n\n');

// Sahte ortam. NOT: with(Proxy has:()=>true) tanimsiz adi undefined yapar,
// bu yuzden kullanilan her global ACIKCA verilir (Set/Map/Date dahil).
function ortam({ pushHata = false } = {}) {
    const KPI_DEFS = {
        mtbf: { defaultTarget: 200, unit: 'saat', label: 'MTBF' },
        mttr: { defaultTarget: 4, unit: 'saat', label: 'MTTR' },
        pmr: { defaultTarget: 70, unit: '%', label: 'PMR' },
    };
    // Kullanicinin ekranindaki durum: kayitli hedefler eski, kutulara yeni
    // degerler yazilmis (MTBF 500, MTTR 10).
    const alanlar = { kpiTgt_mtbf: '500', kpiTgt_mttr: '10', kpiTgt_pmr: '70',
                      kpiEn_mtbf: true, kpiEn_mttr: true, kpiEn_pmr: true,
                      vardiyaBas: '08:00', vardiyaBitis: '18:00', vardiyaGun: '5' };
    const g = {
        KPI_DEFS,
        kpiConfig: { '': { mtbf: { enabled: true, target: 200 }, mttr: { enabled: true, target: 4 }, pmr: { enabled: true, target: 70 } },
                     '2026_Ankara': { mtbf: { enabled: true, target: 200 }, mttr: { enabled: true, target: 4 }, pmr: { enabled: true, target: 70 } } },
        vardiyaAyar: {},
        STORAGE_KPI_KEY: 'cmms_kpi',
        _kpiModalYear: '2026', _kpiModalLoc: 'Ankara',
        cloudReady: true,
        localStorage: { _d: {}, setItem(k, v) { this._d[k] = v; }, getItem(k) { return this._d[k] ?? null; } },
        pushlar: [], scheduleCagrildi: 0, durumSatiri: '', toastlar: [],
        renderDashboard() {},
        _vdSure(a, b) { const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number);
                        return (h2 * 60 + m2 - h1 * 60 - m1) / 60; },
        toast(m, t) { g.toastlar.push([m, t || 'success']); },
        document: {
            getElementById(id) {
                if (id === 'kpiSaveStatus') return { set innerHTML(v) { g.durumSatiri = v; }, get innerHTML() { return g.durumSatiri; } };
                if (id === 'syncStatus') return null;      // pano kapali: erken return yolu
                if (!(id in alanlar)) return null;
                return { value: String(alanlar[id]), checked: alanlar[id] === true };
            },
        },
        // GERCEK zincir: vardiya kaydi da buluta yaziyor (hatanin kaynagi buydu)
        _vardiyaFormKaydet() {
            g.vardiyaAyar[g._kpiModalLoc] = { bas: '08:00', saatGun: 10, gunHafta: 5 };
            g.cloudPush();
        },
        async cloudPush() {
            g.setSyncStatus('pending');
            // Buluta giden veri: O ANKI kpiConfig'in anlik kopyasi
            g.pushlar.push(JSON.parse(JSON.stringify(g.kpiConfig)));
            await null;
            g.setSyncStatus(pushHata ? 'error' : 'ok');
        },
        scheduleCloudSync() { g.scheduleCagrildi++; },
        String, Object, Array, JSON, Math, Date, Number, Boolean,
        parseFloat, parseInt, isNaN, console, Promise,
    };
    const f = new Function('__k', 'with (__k) {\n' + kod +
        '\nreturn { saveKpiConfig, saveKpiStore, setSyncStatus };\n}');
    const api = f(new Proxy(g, { has: () => true, get: (t, p) => (p in t ? t[p] : undefined) }));
    // setSyncStatus kod icinde tanimli; sahte cloudPush'un cagirabilmesi icin
    g.setSyncStatus = api.setSyncStatus;
    return [g, api];
}

let hata = 0;
const ok = (ad, kosul, ek) => {
    console.log((kosul ? '  OK  ' : '  !!  ') + ad + (!kosul && ek !== undefined ? '   ' + JSON.stringify(ek) : ''));
    if (!kosul) hata++;
};

(async () => {
    // ── 1) Buluta giden HER push yeni hedefi tasimali ────────────────────
    {
        const [g, api] = ortam();
        await api.saveKpiConfig();
        ok('en az bir bulut yazimi oldu', g.pushlar.length >= 1, g.pushlar.length);
        const hedefler = g.pushlar.map(p => p['2026_Ankara'].mtbf.target);
        ok('HICBIR push eski hedefi yazmadi (500 bekleniyor)',
            hedefler.every(h => h === 500), hedefler);
        const mttr = g.pushlar.map(p => p['2026_Ankara'].mttr.target);
        ok('MTTR de her pushta yeni (10)', mttr.every(h => h === 10), mttr);
    }

    // ── 2) Debounce beklenmiyor: dogrudan cloudPush ──────────────────────
    {
        const [g, api] = ortam();
        await api.saveKpiConfig();
        ok('scheduleCloudSync (1,2 sn gecikme) kullanilmadi', g.scheduleCagrildi === 0, g.scheduleCagrildi);
        ok('localStorage da yazildi',
            JSON.parse(g.localStorage.getItem('cmms_kpi'))['2026_Ankara'].mtbf.target === 500);
    }

    // ── 3) Bulut yazilamazsa kullanici UYARILIR (sessiz kayip yok) ───────
    {
        const [g, api] = ortam({ pushHata: true });
        await api.saveKpiConfig();
        ok('durum satiri hatayi gosteriyor', /YAZILAMADI/.test(g.durumSatiri), g.durumSatiri.slice(0, 90));
        ok('uyari toast kirmizi (danger)',
            g.toastlar.some(([m, t]) => t === 'danger' && /yazılamadı/i.test(m)), g.toastlar);
        ok('yereldeki kayit yine de duruyor',
            JSON.parse(g.localStorage.getItem('cmms_kpi'))['2026_Ankara'].mtbf.target === 500);
    }

    // ── 4) Basarili yazimda eski davranis korunuyor ──────────────────────
    {
        const [g, api] = ortam();
        await api.saveKpiConfig();
        ok('kaydedildi mesaji veriliyor', /kaydedildi/.test(g.durumSatiri));
        ok('vardiya da kaydedildi', g.vardiyaAyar.Ankara?.gunHafta === 5, g.vardiyaAyar);
        ok('durum satirinda vardiya notu var', /vardiya 08:00/.test(g.durumSatiri), g.durumSatiri.slice(-80));
    }

    console.log('='.repeat(58));
    console.log(hata ? hata + ' HATA' : 'TÜM KONTROLLER GEÇTİ');
    process.exit(hata ? 1 : 0);
})();
