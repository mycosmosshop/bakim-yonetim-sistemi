// Rapor grafiklerindeki HEDEF cizgisi her grafikte gorunuyor mu?
//
// KIRILAN HAL — iki ayri sebep, ikisi de "legendde Hedef yaziyor ama
// grafikte cizgi yok" seklinde goruluyordu (21.09.2026):
//
//  a) RENK: borderColor 'rgba(255,255,255,.2)' sabit beyazdi. Acik temada
//     beyaz zemin uzerinde hic gorunmuyordu.
//  b) EKSEN: y ekseni hedefi tam KENARINDA birakiyordu. PMR'de hedef 70 ve
//     veri en cok 68 -> eksen tavani 70, cizgi cerceveyle cakisiyor;
//     Kullanilabilirlik'te veri sabit 100 / hedef 95 -> cizgi mavi dolgunun
//     icinde kayboluyordu. MTBF/MTTR'de sorun yoktu cunku hedef veri
//     araliginin ORTASINDA kaliyordu — bu yuzden bazi grafiklerde cizgi
//     vardi, bazilarinda yoktu.
//
// Duzeltme: hedefe ozel kirmizi (#e53935) + eksen tavani = max(veri, hedef)
// x 1.08.
//
// Calistir:  node test_hedef_cizgisi.cjs
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'bakim_yonetim_sistemi.html'), 'utf8');

let hata = 0;
const ok = (ad, kosul, ek) => {
    console.log((kosul ? '  OK  ' : '  !!  ') + ad + (!kosul && ek !== undefined ? '   ' + JSON.stringify(ek) : ''));
    if (!kosul) hata++;
};

// ── 1) Renk: hicbir hedef cizgisi zemine karisan renkte degil ───────────
ok('grafiklerde sabit beyaz borderColor yok',
    (src.match(/borderColor:'rgba\(255,255,255[^']*'/g) || []).length === 0);
ok('3 hedef çizgisi de kırmızı (#e53935)',
    (src.match(/borderColor:'#e53935',borderDash:\[6,4\]/g) || []).length === 3,
    (src.match(/borderColor:'#e53935',borderDash:\[6,4\]/g) || []).length);
ok('hedef çizgisi kesikli ve 2px',
    (src.match(/borderColor:'#e53935',borderDash:\[6,4\],pointRadius:0,borderWidth:2/g) || []).length === 3);
// Veri cizgisi renkleri (mavi palet) bozulmadi
ok('veri çizgisi paleti duruyor', /colors=\['#42a5f5','#69f0ae','#ffa726'/.test(src));

// ── 2) Eksen payi: hedef hicbir zaman tam tepede kalmiyor ───────────────
ok('eksen tavanı hesabı eklendi', /_tavan=Math\.max\(\.\.\.\(_degerler/.test(src));
ok('suggestedMax eksene bağlandı', /suggestedMax:_tavan>0\?_tavan\*1\.08:undefined/.test(src));

// Hesabin kendisi: kullanicinin sikayet ettigi iki senaryo + iki saglam olan
const tavan = (veri, hedef) => {
    const d = [...veri, ...Array(veri.length).fill(hedef)].filter(v => typeof v === 'number' && isFinite(v));
    const t = Math.max(...(d.length ? d : [0]), Number(hedef) || 0);
    return t > 0 ? t * 1.08 : undefined;
};
const senaryo = [
    ['PMR — hedef 70, veri en çok 68', [42, 68, 36, 20, 42], 70],
    ['Kullanılabilirlik — hedef 95, veri hep 100', [100, 100, 100], 95],
    ['MTBF — hedef 400, veri 290-880', [600, 800, 290, 880], 400],
    ['MTTR — hedef 10, veri 1,4-1,9', [1.9, 1.4, 1.8], 10],
];
senaryo.forEach(([ad, veri, hedef]) => {
    const t = tavan(veri, hedef);
    ok(`${ad}: hedef eksenin içinde (tavan ${t.toFixed(1)})`, t > hedef, { tavan: t, hedef });
    ok(`${ad}: hedef ile tavan arası ≥ %5 pay`, (t - hedef) / t >= 0.05,
        { pay: ((t - hedef) / t * 100).toFixed(1) + '%' });
});

// ── 3) Legenddeki "Hedef …" yazisi duruyor (kullanici korunmasini istedi) ─
ok('legend etiketi hâlâ "Hedef <değer><birim>"',
    /label:`Hedef \$\{tgt\.target\}\$\{_tgtBirim\}`/.test(src));
ok('birim ile değer arasında boşluk var (% hariç)',
    /_tgtBirim\s*=\s*def\.unit===\s*'%'\s*\?\s*'%'\s*:\s*' '\+def\.unit/.test(src));
ok('hedef çizgisinde dolgu yok (veriyi örtmesin)',
    /borderColor:'#e53935'[^}]*fill:false/.test(src));

console.log('='.repeat(58));
console.log(hata ? hata + ' HATA' : 'TÜM KONTROLLER GEÇTİ');
process.exit(hata ? 1 : 0);
