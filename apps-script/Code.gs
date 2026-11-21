/**
 * โรงชิพ — ตัวรับ/ส่งข้อมูลระหว่างแอปลงค่า กับ Google Sheet
 * วางโค้ดนี้ใน Extensions > Apps Script ของ Google Sheet แล้ว Deploy เป็น Web app
 * (ดูขั้นตอนใน "คู่มือตั้งค่า Google Sheet.md")
 *
 * POST  body(text/plain) = {"action":"push","items":[{kind:'entry'|'issue'|'settings', payload:{...}}]}
 * GET   ?action=pull&since=<ms>  ->  {ok, entries, issues, settings, now}
 * ถ้าตั้ง KEY ไว้ ลิงก์ที่ใส่ในแอปต้องลงท้ายด้วย ?key=<รหัส>
 */

var KEY = ''; // ใส่รหัสลับถ้าต้องการ เช่น 'chip2569' แล้วใช้ลิงก์ .../exec?key=chip2569

var SHEET_ENTRIES = 'entries';
var SHEET_ISSUES = 'issues';
var SHEET_SETTINGS = 'settings';
var SECTION_SHEETS = {
  yuka: 'ไม้ยูคา', fuel: 'ไม้เชื้อเพลิง', edge: 'สับขอบบอร์ด',
  meters: 'มิเตอร์ไฟ', machines: 'จักรกลหนัก', shifts: 'เวลาเดินเครื่อง'
};
var RAW_HEAD = ['id', 'date', 'section', 'by', 'updatedAt', 'device', 'serverAt', 'json'];

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function checkKey_(e) {
  return !KEY || (e && e.parameter && e.parameter.key === KEY);
}
function sheet_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (head) { sh.appendRow(head); sh.setFrozenRows(1); }
  }
  return sh;
}
function rowIndex_(sh) {
  var map = {};
  var last = sh.getLastRow();
  if (last < 2) return map;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) map[String(ids[i][0])] = i + 2;
  return map;
}

/** upsert แถวดิบ (เก็บ JSON เต็ม) — ใช้ updatedAt ที่ใหม่กว่าชนะ */
function upsertRaw_(name, id, date, extra, payload, now) {
  var sh = sheet_(name, RAW_HEAD);
  var idx = rowIndex_(sh);
  var row = [id, date, extra.section || '', payload.by || '', payload.updatedAt || now, payload.device || '', now, JSON.stringify(payload)];
  var r = idx[id];
  if (r) {
    var old = sh.getRange(r, 5).getValue();
    if (Number(old) > Number(payload.updatedAt || 0)) return false;
    sh.getRange(r, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return true;
}

/** แผ่นอ่านง่ายต่อแผนก: 1 แถว/วัน คอลัมน์ = ชื่อช่องในแอป */
function flatten_(obj, prefix, out) {
  for (var k in obj) {
    var v = obj[k], key = prefix ? prefix + '.' + k : k;
    if (v !== null && typeof v === 'object' && !(v instanceof Array)) flatten_(v, key, out);
    else out[key] = (v instanceof Array) ? JSON.stringify(v) : v;
  }
  return out;
}
function upsertReadable_(entry) {
  var name = SECTION_SHEETS[entry.section];
  if (!name) return;
  var flat = flatten_(entry.data || {}, '', {});
  var sh = sheet_(name, ['วันที่', 'ผู้บันทึก', 'เวลาบันทึก']);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var add = [];
  for (var k in flat) if (head.indexOf(k) < 0) add.push(k);
  if (add.length) {
    sh.getRange(1, head.length + 1, 1, add.length).setValues([add]);
    head = head.concat(add);
  }
  var row = head.map(function (h) {
    if (h === 'วันที่') return entry.date;
    if (h === 'ผู้บันทึก') return entry.by || '';
    if (h === 'เวลาบันทึก') return new Date(entry.updatedAt || Date.now());
    return flat.hasOwnProperty(h) ? flat[h] : '';
  });
  var idx = rowIndex_(sh);
  var r = idx[entry.date];
  if (r) sh.getRange(r, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

function doPost(e) {
  if (!checkKey_(e)) return json_({ ok: false, error: 'รหัสไม่ถูกต้อง' });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action !== 'push') return json_({ ok: false, error: 'unknown action' });
    var now = Date.now(), n = 0;
    (body.items || []).forEach(function (it) {
      var p = it.payload || {};
      if (it.kind === 'entry') {
        if (upsertRaw_(SHEET_ENTRIES, p.id, p.date, { section: p.section }, p, now)) upsertReadable_(p);
      } else if (it.kind === 'issue') {
        upsertRaw_(SHEET_ISSUES, p.id, p.date, {}, p, now);
      } else if (it.kind === 'settings') {
        p.syncUrl = '';
        upsertRaw_(SHEET_SETTINGS, 'settings', '', {}, p, now);
      }
      n++;
    });
    return json_({ ok: true, saved: n, now: now });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function readSince_(name, since) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, RAW_HEAD.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (Number(vals[i][6]) > since) {
      try { out.push(JSON.parse(vals[i][7])); } catch (x) {}
    }
  }
  return out;
}

function doGet(e) {
  if (!checkKey_(e)) return json_({ ok: false, error: 'รหัสไม่ถูกต้อง' });
  var action = (e.parameter && e.parameter.action) || '';
  if (action !== 'pull') return json_({ ok: true, app: 'chip-dept', hint: 'ใช้ ?action=pull&since=0' });
  var since = Number(e.parameter.since || 0);
  var now = Date.now();
  var settings = readSince_(SHEET_SETTINGS, since);
  return json_({
    ok: true,
    entries: readSince_(SHEET_ENTRIES, since),
    issues: readSince_(SHEET_ISSUES, since),
    settings: settings.length ? settings[0] : null,
    now: now
  });
}
