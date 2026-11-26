// FR45 Haftalık & Günlük Makina Bakım Kartı (printGunlukForm, ExcelJS): antet, 31 gün × 1./2. vardiya ızgarası, madde satırları, bakım sorumlusu.
//   node test_fr45_kart.cjs [çıktı.xlsx]   (exceljs gerekir)
const fs=require('fs'), assert=require('assert'), ExcelJS=require('exceljs');
const src=fs.readFileSync(__dirname+'/bakim_yonetim_sistemi.html','utf8');
const kes=(a,b)=>{const i=src.indexOf(a); assert(i>=0,a); return src.slice(i, src.indexOf(b,i)+b.length);};
const fn=kes('async function printGunlukForm(machineId){','\n}');
const logo=kes('const SANIFOAM_LOGO_B64','\n');
const db={machines:[{id:'hdk_LMN5',code:'910.5.506',name:'LMN5 LAMİNASYON MERDANESİ (HENDEK)',location:'Hendek',dept:'LAMİNASYON'}],
  taskSets:[{machineId:'hdk_LMN5',type:'autonomous',tasks:[{title:'Çalışma yapılacaksa dişlileri yağla.'},{title:'Silindirleri, dişlileri ve makine gövdesini temizleyici solventle sil; solventle temizlikte gözlük, eldiven ve maske kullan.'},{title:'Hazneyi boşalt ve temizle.'}]}],
  maintenance:[{machineId:'hdk_LMN5',tech:'Ahmet Durmaz'}]};
let out;
const run=new Function('ExcelJS','db','formSettings','loadFormSettings','toast','window', logo+'\n'+fn+'\nreturn printGunlukForm;');
const f=run(ExcelJS,db,{gobDocNo:'FR45',gobRevNo:'05 / 27.03.2026',gobEffDate:'02.04.2013'},()=>{},(m)=>{throw new Error(m)},{__testBuf:b=>out=b});
f('hdk_LMN5').then(async()=>{
  assert(out,'çıktı yok'); if(process.argv[2]) fs.writeFileSync(process.argv[2],Buffer.from(out));
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(out); const ws=wb.worksheets[0];
  assert.strictEqual(ws.getCell('B1').value,'KALİTE YÖNETİM SİSTEMİ DOKÜMANTASYONU');
  assert.strictEqual(ws.getCell('B2').value,'HAFTALIK & GÜNLÜK MAKİNA BAKIM KARTI');
  assert.strictEqual(ws.getCell(9,2).value,1); assert.strictEqual(ws.getCell(9,62).value,31);
  assert.strictEqual(ws.getCell(10,2).value,'1.VRD'); assert.strictEqual(ws.getCell(10,63).value,'2.VRD');
  assert(String(ws.getCell('A11').value).startsWith('1. Çalışma')); assert(/Ahmet Durmaz/.test(JSON.stringify(ws.getSheetValues())));
  console.log('test tamam');
});
