// اختبار آلي: يشغّل البرنامج الحقيقي ويتحقق من الإدخال والحفظ والخميس والتاريخ السريع
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const m = require('../main.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

async function shot(win, name) {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(`/tmp/shot_${name}.png`, img.toPNG());
}
const ev = (win, code) => win.webContents.executeJavaScript(code, true);

app.whenReady().then(async () => {
  let win;
  for (let i = 0; i < 60; i++) { win = BrowserWindow.getAllWindows()[0]; if (win && !win.webContents.isLoading()) break; await sleep(200); }
  await sleep(800);
  try {
    out.prep = await ev(win, `(async()=>{
      const $=id=>document.getElementById(id); const R={};
      R.loaded = recordsCache.length;
      R.agg = aggregateRecords(getLocalRecords()).map(a=>a.recordNumber+'@'+a.monthYear+':'+a.totalQuantity);
      const ref=new Date(2026,10,22);
      R.parse = ['22','2211','22/11','22/11/26','221126','22112026','٢٢١١','311','31','abc','3011','5-12-2026'].map(x=>x+'=>'+parseQuickDate(x,ref));
      R.initialFocus = document.activeElement.id;
      R.today = $('orderDate').value;
      $('recordNumber').value='1001'; checkAutoSuggest('1001'); R.sugVisible=!$('suggestionCard').classList.contains('hidden');
      $('recordNumber').focus();
      $('recordNumber').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      await new Promise(r=>setTimeout(r,60));
      R.focusAfterSuggest = document.activeElement.id;
      R.filled=[$('patientName').value,$('age').value,$('diagnosis').value,$('doctorName').value].join('|');
      $('quantity').value='2'; $('quantity').dispatchEvent(new Event('input',{bubbles:true}));
      $('orderDateText').value='26/11/2026'; $('orderDateText').dispatchEvent(new Event('input',{bubbles:true}));
      R.thuBox=!$('thursdayBox').classList.contains('hidden'); R.thuPreview=$('thursdayPreview').innerText; R.dateHint=$('orderDateHint').innerText;
      return R; })()`);
    await sleep(500); await ev(win, 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); await shot(win, 'entry_thursday');

    out.submit = await ev(win, `(async()=>{
      const $=id=>document.getElementById(id); const R={}; const sl=ms=>new Promise(r=>setTimeout(r,ms));
      $('patientForm').requestSubmit(); await sl(120);
      let recs=getLocalRecords(); let last=recs[recs.length-1];
      R.t1_qty=last.quantity; R.t1_date=last.orderDate; R.t1_month=last.monthYear;
      R.toast1=document.querySelector('#toastHost').innerText.replace(/\\n/g,' / ');
      R.focusAfter=document.activeElement.id; R.dateKept=$('orderDate').value; R.formCleared=$('recordNumber').value==='' && $('quantity').value==='';
      R.toggleReset=$('thursdayDouble').checked;
      // thursday, toggle OFF
      $('recordNumber').value='1002'; checkAutoSuggest('1002'); applySuggestion(); $('quantity').value='3'; $('thursdayDouble').checked=false; updateThursdayBox();
      R.preview_off=$('thursdayPreview').innerText;
      $('patientForm').requestSubmit(); await sl(120);
      recs=getLocalRecords(); last=recs[recs.length-1]; R.t2_qty=last.quantity; R.toast2=document.querySelector('#toastHost').innerText.replace(/\\n/g,' / ');
      // friday: no doubling, box hidden
      $('recordNumber').value='1002'; checkAutoSuggest('1002'); applySuggestion(); $('quantity').value='5';
      setFastDate('orderDate','2026-11-27'); R.friBoxHidden=$('thursdayBox').classList.contains('hidden');
      $('patientForm').requestSubmit(); await sl(120);
      recs=getLocalRecords(); last=recs[recs.length-1]; R.t3_qty=last.quantity;
      // enter-key chain
      $('recordNumber').focus(); $('recordNumber').value='zz'; 
      const press=(el,k,o={})=>el.dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
      const chain=[]; for (let i=0;i<4;i++){ press(document.activeElement,'Enter'); await sl(30); chain.push(document.activeElement.id); }
      R.enterChain=chain.join('>');
      // name suggestion keyboard
      $('patientName').value='احمد علي'; checkNameSuggest('احمد علي'); R.nameSugCount=nameSuggestions.length;
      $('patientName').focus(); press($('patientName'),'ArrowDown'); R.nameSugIdx=nameSugIndex;
      press($('patientName'),'Enter'); await sl(40); R.afterNameEnter=document.activeElement.id+'|'+$('recordNumber').value;
      // monthly aggregation
      R.agg=aggregateRecords(getLocalRecords()).map(a=>a.recordNumber+'@'+a.monthYear+':'+a.totalQuantity);
      // edit modal date
      openEditModal('3'); R.editText=$('editOrderDateText').value; R.editHidden=$('editOrderDate').value;
      $('editOrderDateText').value='7/11'; $('editOrderDateText').dispatchEvent(new Event('input',{bubbles:true}));
      R.editHidden2=$('editOrderDate').value; await handleEditSubmit({preventDefault(){}});
      R.edited=getLocalRecords().find(r=>r.id==='3').orderDate;
      document.getElementById('customModal').classList.add('hidden');
      R.iconsLeft=document.querySelectorAll('i[data-icon]').length;
      R.emoji=/[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF\\u2705\\u274C]/u.test(document.body.innerHTML);
      return R; })()`);

    await ev(win, `switchTab('register')`); await sleep(200);
    await shot(win, 'register');
    await ev(win, `document.getElementById('dataMenu').classList.remove('hidden')`); await sleep(100);
    await shot(win, 'menu');
    await ev(win, `document.getElementById('dataMenu').classList.add('hidden'); switchTab('entry')`); await sleep(100);

    out.sug = await ev(win, `(async()=>{
      const $=id=>document.getElementById(id); const sl=ms=>new Promise(r=>setTimeout(r,ms)); const R={};
      const press=(el,k)=>el.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
      $('patientForm').reset(); setFastDate('orderDate','2026-11-22');
      // diagnosis: type partial -> suggestion -> Enter applies and jumps to doctor
      $('diagnosis').focus(); $('diagnosis').value='asc'; $('diagnosis').dispatchEvent(new Event('input',{bubbles:true}));
      R.diagItems=sugState.diagnosis.items.map(i=>i.text);
      press($('diagnosis'),'ArrowDown'); press($('diagnosis'),'Enter'); await sl(40);
      R.diagValue=$('diagnosis').value; R.afterDiagFocus=document.activeElement.id;
      // doctor focus with empty value -> top list
      $('doctorName').value=''; $('doctorName').dispatchEvent(new Event('focus'));
      R.docTop=sugState.doctorName.items.map(i=>i.text+'x'+i.count);
      // Enter without highlight -> default navigation (submit on last field would validate form; just check box state)
      $('doctorName').value='د. ك'; $('doctorName').dispatchEvent(new Event('input',{bubbles:true}));
      R.docFiltered=sugState.doctorName.items.map(i=>i.text);
      // delete the suggestion via mouse
      const del=document.querySelector('#sugBox_doctorName [data-del="0"]');
      del.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); await sl(40);
      R.afterDelete=sugState.doctorName.items.map(i=>i.text); R.hidden=JSON.stringify(hiddenSug);
      // exact-match typed value shows nothing
      $('diagnosis').value='Ascites'; $('diagnosis').dispatchEvent(new Event('input',{bubbles:true}));
      R.exactHidden=!sugVisible(SUG_FIELDS[0]);
      return R; })()`);
    await sleep(300);
    out.settingsFile = fs.existsSync(process.env.HOME + '/Documents/AlbuminTrak/settings.json') ? fs.readFileSync(process.env.HOME + '/Documents/AlbuminTrak/settings.json', 'utf8') : 'missing';

    // مفتاح الاستيراد السحابي: اختبار محلل Firestore
    out.parser = m.parseFirestoreDocs([{ name: 'projects/x/databases/(default)/documents/albumin_orders/abc', fields: {
      id: { stringValue: 'abc' }, patientName: { stringValue: 'اختبار' }, age: { integerValue: '33' }, recordNumber: { stringValue: '77' },
      quantity: { integerValue: '4' }, diagnosis: { stringValue: 'x' }, doctorName: { stringValue: 'y' }, orderDate: { stringValue: '2026-09-03' },
      monthYear: { stringValue: '2026-09' }, isUploaded: { booleanValue: true } } }]).map(r => m.normalizeRecord(r));
  } catch (e) { out.error = String(e && e.stack || e); }
  console.log('RESULT ' + JSON.stringify(out, null, 1));
  app.quit();
});
