// Planli bakim listesinde makine KODU sutunu (Makine'den hemen sonra), siralanabilir, Excel'e de yansir.
//   node test_makine_kodu_sutunu.cjs
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync('C:/Users/User/Desktop/Bakım/bakim_yonetim_sistemi.html', 'utf8');

// 1) baslik sirasi: Makine → Kod → Tip
const th = src.indexOf(`onclick="sortMaint('makine')"`), tk = src.indexOf(`onclick="sortMaint('kod')"`), tt = src.indexOf(`onclick="sortMaint('type')"`);
assert(th > 0 && tk > th && tt > tk, 'Kod sutunu Makine ile Tip arasinda olmali');

// 2) satir sablonu: makine hucresinden sonra kod hucresi
const rb = src.indexOf("document.getElementById('pBody').innerHTML=list.map(p=>{");
const rowTpl = src.slice(rb, src.indexOf('}).join', rb));
const iMak = rowTpl.indexOf('mName(p.machineId)}${p.external'), iKod = rowTpl.indexOf("${mCode(p.machineId)||'—'}</td>"), iTip = rowTpl.indexOf('TYPE_PL[p.type]||p.type');
assert(iMak > 0 && iKod > iMak && iTip > iKod, 'satirda kod hucresi makine ile tip arasinda olmali');
// baslik ve satir hucre sayisi esit (th sayisi = td sayisi)
const theadBlok = src.slice(src.indexOf('<th style="width:34px;text-align:center"><input type="checkbox" id="maintChkAll"'), src.indexOf('<tbody id="pBody">'));
const nTh = (theadBlok.match(/<th/g) || []).length, nTd = (rowTpl.match(/<td/g) || []).length;
assert.strictEqual(nTd, nTh, 'satir hucre sayisi (' + nTd + ') baslik sayisina (' + nTh + ') esit degil');

// 3) mCode + siralama gercek govdeyle (parcalar satir sonu yorum tasidigindan '\n' ile birlestirilir)
const kes = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const db = { machines: [{ id: 'a', name: 'CNC DIKEY SABLE', code: '910.5.003' }, { id: 'b', name: 'FRT FORKLIFT' }] };
const govde = [kes('const mName = (id)', '\n'), kes('const mCode = (id)', '\n'), kes('const _MAINT_SORTV=', '\n};') + '\n};'].join('\n');
const F = new Function('db', govde + '\nreturn {mCode,_MAINT_SORTV};')(db);
assert.strictEqual(F.mCode('a'), '910.5.003'); assert.strictEqual(F.mCode('b'), ''); assert.strictEqual(F.mCode('yok'), '');
assert.strictEqual(F._MAINT_SORTV.kod({ machineId: 'a' }), '910.5.003');

// 4) Excel: MAKINE / KALIP hucresinde kod on ekiyle
assert(src.includes("(mCode(p.machineId)?mCode(p.machineId)+' — ':'')+mName(p.machineId)"), 'Excel satirinda makine kodu yok');

// 5) betik ayrisiyor
[...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => { try { new Function(m[1]); } catch (e) { assert.fail('betik ' + i + ': ' + e.message); } });
console.log('✔ planli bakim: Kod sutunu Makine ile Tip arasinda, siralanabilir, Excel\'e yansiyor (' + nTh + ' sutun)');
