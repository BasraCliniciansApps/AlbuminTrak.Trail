'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// ───────── المسارات ─────────
// كل شيء داخل: المستندات \ AlbuminTrak
const DATA_DIR = path.join(app.getPath('documents'), 'AlbuminTrak');
const BACKUP_DIR = path.join(DATA_DIR, 'Backups');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const BACKUP_FILES = { A: path.join(BACKUP_DIR, 'Backup_A.json'), B: path.join(BACKUP_DIR, 'Backup_B.json') };

const FIRESTORE_URL =
  'https://firestore.googleapis.com/v1/projects/albumintrak/databases/(default)/documents/albumin_orders';
const FIRESTORE_KEY = 'AIzaSyAWIfG8ZSyKdzq_BcKOAZsi-dcQ8xpQF58';

let records = [];
let mainWindow = null;
let lastBackup = null; // { slot, time, reason, count }
let closingDone = false;

// ───────── أدوات الملفات ─────────
function ensureDirs() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// كتابة آمنة: ملف مؤقت ثم إعادة تسمية، حتى لا يتلف الملف إذا انقطعت الكهرباء أثناء الكتابة
function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

function isValidRecord(r) {
  return (
    r && typeof r === 'object' &&
    typeof r.id === 'string' && r.id &&
    typeof r.patientName === 'string' &&
    r.recordNumber != null &&
    typeof r.orderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.orderDate) &&
    Number.isFinite(Number(r.quantity))
  );
}

// يطبّع السجل ليطابق شكل البيانات المتوقع في الواجهة
function normalizeRecord(r) {
  return {
    id: String(r.id),
    patientName: String(r.patientName || '').trim(),
    age: r.age === '' || r.age == null ? null : Number(r.age),
    recordNumber: String(r.recordNumber).trim(),
    quantity: Number(r.quantity),
    diagnosis: String(r.diagnosis || '').trim(),
    doctorName: String(r.doctorName || '').trim(),
    orderDate: r.orderDate,
    monthYear: r.orderDate.substring(0, 7),
    isUploaded: r.isUploaded === true
  };
}

function extractRecords(json) {
  const list = Array.isArray(json) ? json : json && Array.isArray(json.records) ? json.records : null;
  if (!list) return null;
  return list.filter(isValidRecord).map(normalizeRecord);
}

// ───────── النسخ الاحتياطي (A / B بالتناوب) ─────────
function pickBackupSlot() {
  const a = fs.existsSync(BACKUP_FILES.A) ? fs.statSync(BACKUP_FILES.A).mtimeMs : -1;
  const b = fs.existsSync(BACKUP_FILES.B) ? fs.statSync(BACKUP_FILES.B).mtimeMs : -1;
  if (a < 0) return 'A';
  if (b < 0) return 'B';
  return a <= b ? 'A' : 'B'; // الأقدم يُستبدل
}

function doBackup(reason) {
  try {
    if (!records.length) return; // لا نستبدل نسخة سليمة بنسخة فارغة
    ensureDirs();
    const slot = pickBackupSlot();
    const payload = {
      app: 'AlbuminTrak',
      version: 1,
      savedAt: new Date().toISOString(),
      reason,
      count: records.length,
      records
    };
    writeAtomic(BACKUP_FILES[slot], JSON.stringify(payload));
    lastBackup = { slot, time: payload.savedAt, reason, count: records.length };
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('backup:done', lastBackup);
  } catch (e) {
    console.error('Backup failed:', e);
  }
}

function newestValidBackup() {
  let best = null;
  for (const slot of ['A', 'B']) {
    const j = readJson(BACKUP_FILES[slot]);
    const list = j && extractRecords(j);
    if (list && j.savedAt && (!best || j.savedAt > best.savedAt)) best = { slot, savedAt: j.savedAt, records: list };
  }
  return best;
}

// ───────── تحميل / حفظ البيانات ─────────
function loadData() {
  ensureDirs();
  if (fs.existsSync(DATA_FILE)) {
    const list = extractRecords(readJson(DATA_FILE));
    if (list) { records = list; return { restored: false }; }
    // الملف تالف: نحتفظ به باسم آخر ونسترجع من أحدث نسخة احتياطية
    try { fs.renameSync(DATA_FILE, DATA_FILE.replace('.json', `.corrupt-${Date.now()}.json`)); } catch (e) {}
    const b = newestValidBackup();
    if (b) { records = b.records; writeAtomic(DATA_FILE, JSON.stringify(records)); return { restored: true, slot: b.slot }; }
    records = [];
    return { restored: false };
  }
  // لا يوجد ملف بيانات (أول تشغيل أو حُذف): نحاول من النسخ الاحتياطية
  const b = newestValidBackup();
  if (b) { records = b.records; writeAtomic(DATA_FILE, JSON.stringify(records)); return { restored: true, slot: b.slot }; }
  records = [];
  return { restored: false };
}

function persist() {
  ensureDirs();
  writeAtomic(DATA_FILE, JSON.stringify(records));
}

function mergeRecords(incoming) {
  const have = new Set(records.map((r) => r.id));
  let added = 0;
  for (const r of incoming) {
    if (!have.has(r.id)) { records.push(r); have.add(r.id); added++; }
  }
  if (added) persist();
  return { added, skipped: incoming.length - added, total: records.length };
}

// ───────── الاستيراد من السحابة (مرة واحدة) ─────────
function fsValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  return null;
}

function parseFirestoreDocs(docs) {
  return docs.map((d) => {
    const o = {};
    for (const [k, v] of Object.entries(d.fields || {})) o[k] = fsValue(v);
    if (!o.id && d.name) o.id = d.name.split('/').pop();
    return o;
  });
}

async function fetchCloudRecords() {
  const all = [];
  let token = '';
  for (let i = 0; i < 200; i++) {
    const url = `${FIRESTORE_URL}?pageSize=300&key=${FIRESTORE_KEY}${token ? '&pageToken=' + encodeURIComponent(token) : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    all.push(...parseFirestoreDocs(j.documents || []));
    if (!j.nextPageToken) break;
    token = j.nextPageToken;
  }
  return all.filter(isValidRecord).map(normalizeRecord);
}

// ───────── قنوات الاتصال مع الواجهة ─────────
let startupInfo = { restored: false };

ipcMain.on('data:load', (e) => {
  e.returnValue = { records, restored: startupInfo.restored, slot: startupInfo.slot, lastBackup, dataDir: DATA_DIR };
});

ipcMain.on('data:save', (e, list) => {
  if (!Array.isArray(list)) return;
  records = list;
  try { persist(); } catch (err) { console.error('Save failed:', err); }
});

ipcMain.handle('import:cloud', async () => {
  try {
    const incoming = await fetchCloudRecords();
    doBackup('before-import');
    const r = mergeRecords(incoming);
    return { ok: true, fetched: incoming.length, ...r, records };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('import:file', async () => {
  const pick = await dialog.showOpenDialog(mainWindow, {
    title: 'اختر ملف بيانات (JSON)',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true };
  const list = extractRecords(readJson(pick.filePaths[0]));
  if (!list) return { ok: false, error: 'الملف غير صالح' };
  doBackup('before-import');
  const r = mergeRecords(list);
  return { ok: true, fetched: list.length, ...r, records };
});

ipcMain.handle('backup:restore', async () => {
  const b = newestValidBackup();
  if (!b) return { ok: false, error: 'لا توجد نسخة احتياطية صالحة' };
  try {
    // نحفظ الوضع الحالي قبل الاسترجاع
    writeAtomic(path.join(DATA_DIR, 'data.before-restore.json'), JSON.stringify(records));
    records = b.records;
    persist();
    return { ok: true, count: records.length, slot: b.slot, savedAt: b.savedAt, records };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('folder:open', async () => {
  ensureDirs();
  await shell.openPath(DATA_DIR);
  return true;
});

// ───────── النافذة ─────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f8fafc',
    title: 'AlbuminTrak',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // لا نسمح بفتح صفحات خارجية داخل البرنامج
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (ev) => ev.preventDefault());

  mainWindow.on('close', () => {
    if (!closingDone) { closingDone = true; doBackup('close'); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    startupInfo = loadData();
    doBackup('open'); // نسخة احتياطية عند الفتح
    createWindow();
  });
  app.on('before-quit', () => {
    if (!closingDone) { closingDone = true; doBackup('close'); }
  });
  app.on('window-all-closed', () => app.quit());
}

module.exports = { parseFirestoreDocs, extractRecords, normalizeRecord, isValidRecord };
