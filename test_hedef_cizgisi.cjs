// Rapor grafiklerindeki HEDEF cizgisi her iki temada gorunuyor mu?
//
// KIRILAN HAL (21.09.2026): "KPI Aylik Trend" grafiklerinde hedef cizgisi
// borderColor:'rgba(255,255,255,.2)' ile ciziliyordu. Koyu temada zar zor,
// ACIK TEMADA HIC gorunmuyor (beyaz zemin uzerinde %20 beyaz). Legendde
// "Hedef 200 saat" yaziyordu ama grafikte cizgi yok saniliyordu.
// Ayni hata iki OEE grafiginde de vardi.
//
// Duzeltme: renk '#8b949e' -> _themeForCharts bunu temanin --chart-muted
// degerine cevirir (koyu #8b949e, acik #526073).
//
// Calistir:  node test_hedef_cizgisi.cjs
const fs = require('fs'), assert = require('assert'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'bakim_yonetim_sistemi.html'), 'utf8');

let hata = 0;
const ok = (ad, kosul, ek) => {
    console.log((kosul ? '  OK  ' : '  !!  ') + ad + (!kosul && ek !== undefined ? '   ' + JSON.stringify(ek) : ''));
    if (!kosul) hata++;
};

// ── 1) Kaynak: hicbir hedef cizgisi sabit beyaz kalmadi ─────────────────
const beyaz = (src.match(/borderColor:'rgba\(255,255,255[^']*'/g) || []);
ok('grafiklerde sabit beyaz borderColor yok', beyaz.length === 0, beyaz);

const hedefler = (src.match(/label:\s*[`'"]Hedef [^,]*,\s*data:[^}]*?borderColor:'([^']+)'/g) || []);
ok('3 hedef çizgisi tanımlı (1 KPI trend + 2 OEE)', hedefler.length === 3, hedefler.length);
ok('hepsi tema anahtarı #8b949e kullanıyor',
    hedefler.every(h => /borderColor:'#8b949e'/.test(h)), hedefler.map(h => h.slice(-30)));

// ── 2) Tema cevirisi GERCEKTEN calisiyor mu ─────────────────────────────
function cikar(imza, bitis) {
    const i = src.indexOf(imza); assert(i > 0, 'bulunamadi: ' + imza);
    const j = src.indexOf(bitis, i); assert(j > i, 'sonu yok: ' + imza);
    return src.slice(i, j + bitis.length);
}
const kod = [cikar('function themeVars(){', '\n}'),
             cikar('function _themeMapChartConfig(', '\n}'),
             cikar('function _themeForCharts(cfg){', '\n}')].join('\n\n');

// index.html'deki gercek tema degerleri (:root ve [data-theme=light])
const DEGER = {
    dark:  { '--chart-text': '#e6edf3', '--chart-muted': '#8b949e', '--chart-grid': '#1c2128', '--chart-border': '#161b22' },
    light: { '--chart-text': '#1f2937', '--chart-muted': '#526073', '--chart-grid': '#d5dde8', '--chart-border': '#dfe6f2' },
};
for (const tema of ['dark', 'light']) {
    const g = {
        document: { documentElement: {} },
        getComputedStyle: () => ({ getPropertyValue: p => DEGER[tema][p] || '' }),
        Array, Object, String, JSON,
    };
    const f = new Function('__k', 'with (__k) {\n' + kod + '\nreturn _themeForCharts;\n}');
    const _themeForCharts = f(new Proxy(g, { has: () => true, get: (t, p) => (p in t ? t[p] : undefined) }));

    // Gercek hedef dataset'i gibi bir yapilandirma
    const cfg = { data: { datasets: [
        { label: 'Ankara', borderColor: '#42a5f5' },
        { label: 'Hedef 200 saat', borderColor: '#8b949e', borderDash: [6, 4], borderWidth: 2 },
    ] }, options: { scales: { y: { ticks: { color: '#8b949e' } } } } };
    const c = _themeForCharts(cfg);
    const hedef = c.data.datasets[1];
    ok(`${tema}: hedef rengi temaya çevrildi`, hedef.borderColor === DEGER[tema]['--chart-muted'], hedef.borderColor);
    ok(`${tema}: zemin rengiyle aynı değil`,
        hedef.borderColor !== (tema === 'light' ? '#ffffff' : '#0d1117') && !/255,\s*255,\s*255/.test(hedef.borderColor));
    ok(`${tema}: kesikli ve kalın (2px) korundu`,
        hedef.borderWidth === 2 && Array.isArray(hedef.borderDash) && hedef.borderDash[0] === 6);
    ok(`${tema}: veri çizgisinin rengi bozulmadı`, c.data.datasets[0].borderColor === '#42a5f5');
}

// ── 3) Legenddeki "Hedef …" yazisi duruyor (kullanici korunmasini istedi) ─
ok('legend etiketi hâlâ "Hedef <değer><birim>"',
    /label:`Hedef \$\{tgt\.target\}\$\{_tgtBirim\}`/.test(src));
ok('birim ile değer arasında boşluk var (% hariç)',
    /_tgtBirim\s*=\s*def\.unit===\s*'%'\s*\?\s*'%'\s*:\s*' '\+def\.unit/.test(src));

console.log('='.repeat(58));
console.log(hata ? hata + ' HATA' : 'TÜM KONTROLLER GEÇTİ');
process.exit(hata ? 1 : 0);
