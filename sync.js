// Синхронизация приложения с облаком (таблица app_rows в Supabase). Общий файл для моих приложений, нужен cloud.js.
// localStorage остаётся главным, облако — копия. Приложение раскладывает свои данные на строки {ключ: значение};
// конфликт решается по строке: новее updated_at — побеждает. Удаление = deleted, строка не стирается.
//
// const sy = CloudSync({
//   app: 'sdsm',                 // поле app в таблице
//   meta: 'sdsm_sync',           // ключ служебных данных в localStorage
//   rows: () => ({ключ: значение}),
//   put: (ключ, значение) => {}, // чужая правка: записать в данные приложения
//   drop: ключ => {},            // чужое удаление
//   commit: () => {},            // после пачки put/drop: сохранить и перерисовать
//   pristine: () => bool,        // на устройстве ещё нет своего прогресса
//   busy: () => bool,            // сейчас данные трогать нельзя (идёт ввод), повторим позже
//   status: (st, msg) => {}      // '', 'out', 'sync', 'ok', 'net', 'err'
// });
// sy.soon() после каждой правки, sy.sync() — сразу.

// отпечаток записи (cyrb53 от JSON с отсортированными ключами): видно, что поменялось, без второй копии данных
const syncCanon = v => v == null ? 'null' : typeof v != 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(syncCanon).join(',') + ']' :
  '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + syncCanon(v[k])).join(',') + '}';
function syncHash(v) {
  const s = syncCanon(v); let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return 4294967296 * (2097151 & b) + (a >>> 0);
}
// id для записей-списков: старые — по дате, месту в списке и содержимому (одинаковы на всех устройствах), новые — по времени
const syncOldId = (x, i) => 'o' + (x.d || '') + '-' + String(i || 0).padStart(4, '0') + '-' + syncHash(x).toString(36);
const syncNewId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// постоянный id устройства: им подписываются счётчики, которые на каждом устройстве свои (минуты, задачи)
function syncDev() {
  let d = null; try { d = localStorage.getItem('cloud_dev'); } catch (e) { }
  if (!d) { d = Math.random().toString(36).slice(2, 10); try { localStorage.setItem('cloud_dev', d); } catch (e) { } }
  return d;
}

function CloudSync(o) {
  const on = () => typeof Cloud != 'undefined' && Cloud.on();
  const user = () => on() && Cloud.user();
  const SEED = Date.parse('2000-01-01T00:00:00Z');
  // M = {uid, cur: synced_at последней забранной строки, r: {ключ: [отпечаток, время правки, флаги: 1 удалена, 2 ждёт отправки]}}
  let M = null, st = '', msg = '', at = 0, running = false, again = false, timer = null;
  try { M = JSON.parse(localStorage.getItem(o.meta)); } catch (e) { }
  const saveM = () => { try { localStorage.setItem(o.meta, JSON.stringify(M)); } catch (e) { } };
  const set = (s, m) => { st = s; msg = m || ''; o.status(st, msg); };
  const waiting = () => M ? Object.values(M.r).filter(m => m[2] & 2).length : 0;
  const q = s => '"' + String(s).replace(/["\\]/g, '\\$&') + '"';
  const SEL = 'app_rows?select=id,data,deleted,updated_at,synced_at&app=eq.' + encodeURIComponent(o.app);

  // что поменялось с прошлой проверки: новые и изменённые строки ждут отправки, исчезнувшие помечаются удалёнными
  function scan() {
    if (!M) return; const R = o.rows(), t = Date.now(); let n = 0;
    for (const k in R) { const h = syncHash(R[k]), m = M.r[k]; if (!m || m[0] !== h) { M.r[k] = [h, m ? Math.max(t, m[1] + 1) : t, 2]; n++; } }
    for (const k in M.r) { const m = M.r[k]; if (!(k in R) && !(m[2] & 1)) { M.r[k] = [0, Math.max(t, m[1] + 1), 3]; n++; } }
    if (n) saveM();
  }

  // первый вход на устройстве. Есть свой прогресс: выгружаем всё со старой меткой времени,
  // чтобы при совпадении записей главным было облако. Устройство чистое: просто забираем облако.
  function bind(uid) {
    if (M && M.uid == uid) return;
    M = { uid, cur: null, r: {} };
    if (o.pristine()) M.fresh = 1;
    else { M.first = 1; const R = o.rows(); for (const k in R) M.r[k] = [syncHash(R[k]), SEED, 2]; }
    saveM();
  }

  // всё, что пришло на сервер после прошлого раза (с минутой внахлёст), страницами по 1000
  async function pull() {
    const rows = []; let after = M.cur ? new Date(Date.parse(M.cur) - 6e4).toISOString() : null, id = null;
    for (; ;) {
      let p = SEL + '&order=synced_at.asc,id.asc&limit=1000';
      if (id !== null) p += '&or=' + encodeURIComponent(`(synced_at.gt.${q(after)},and(synced_at.eq.${q(after)},id.gt.${q(id)}))`);
      else if (after) p += '&synced_at=gt.' + encodeURIComponent(after);
      const part = await Cloud.rest('GET', p); rows.push(...part);
      if (part.length < 1000) return rows;
      const z = part[part.length - 1]; after = z.synced_at; id = z.id;
    }
  }

  // правки с других устройств: берём строку, если она новее нашей (при равном времени — облачную)
  function apply(rows) {
    let n = 0;
    if (M.fresh && rows.length) {   // чистое устройство: оставляем только то, что есть в облаке
      const live = new Set(rows.filter(r => !r.deleted).map(r => r.id));
      for (const k in o.rows()) if (!live.has(k)) { o.drop(k); n++; }
      M.r = {};
    }
    for (const r of rows) {
      const u = Date.parse(r.updated_at), h = r.deleted ? 0 : syncHash(r.data), m = M.r[r.id];
      if (m && u < m[1]) continue;
      if (m && u == m[1] && h === m[0]) { m[2] &= ~2; continue; }
      M.r[r.id] = [h, u, r.deleted ? 1 : 0];
      if ((m ? m[0] : 0) === h) continue;
      if (r.deleted) o.drop(r.id); else o.put(r.id, r.data);
      n++;
    }
    delete M.fresh;
    if (n) o.commit();
    return n;
  }

  async function push() {
    for (; ;) {
      scan(); const ks = Object.keys(M.r).filter(k => M.r[k][2] & 2).slice(0, 200); if (!ks.length) return;
      const R = o.rows(), sent = ks.map(k => M.r[k][1]);
      const ok = await Cloud.rest('POST', 'app_rows?on_conflict=user_id,app,id&select=id', ks.map(k => {
        const m = M.r[k], del = !!(m[2] & 1);
        return { user_id: M.uid, app: o.app, id: k, data: del ? null : R[k], deleted: del, updated_at: new Date(m[1]).toISOString() };
      }), 'resolution=merge-duplicates,return=representation');
      ks.forEach((k, i) => { const m = M.r[k]; if (m && m[1] === sent[i]) m[2] &= ~2; }); saveM();
      // сервер не принял строки, у которых его версия новее (так бывает, если часы устройств разошлись): забираем его версию
      const got = new Set((ok || []).map(r => r.id)), lost = ks.filter(k => !got.has(k));
      for (let i = 0; i < lost.length; i += 50) {
        if (o.busy()) break;
        if (apply(await Cloud.rest('GET', SEL + '&id=in.' + encodeURIComponent('(' + lost.slice(i, i + 50).map(q).join(',') + ')')))) scan();
      }
      saveM();
    }
  }

  async function sync() {
    if (running) { again = true; return; }
    const u = user();
    if (u) bind(u.id);
    scan();
    if (!u) return set(on() ? 'out' : '');
    if (!navigator.onLine) return set('net');
    running = true; set('sync');
    try {
      const rows = await pull();
      if (o.busy()) {
        // идёт ввод или тест: чужие правки внесём позже (курсор не двигаем), свои отправим сейчас.
        // Первый вход ждёт целиком: сначала нужно спросить, чьи данные главнее.
        setTimeout(() => soon(0), 1e4);
        if (M.first || M.fresh) return;
      } else {
        scan();
        if (M.first && rows.some(r => !r.deleted)) {
          if (!confirm('В облаке уже есть прогресс с другого устройства.\n\nОК — где записи совпали, оставить облачные.\nОтмена — где совпали, оставить данные этого устройства.\n\nВсё, что есть только здесь, добавится в облако в любом случае.')) {
            const t = Date.now(); for (const k in M.r) if (M.r[k][2] & 2) M.r[k][1] = t;
          }
        }
        delete M.first;
        if (apply(rows)) scan();
        if (rows.length) { const z = rows[rows.length - 1].synced_at; if (!M.cur || Date.parse(z) >= Date.parse(M.cur)) M.cur = z; }
        saveM();
      }
      await push();
      at = Date.now(); set('ok');
    } catch (e) { set(e.net ? 'net' : Cloud.user() ? 'err' : 'out', e.message); }
    finally { running = false; if (again) { again = false; soon(); } }
  }
  function soon(d) { clearTimeout(timer); timer = setTimeout(sync, d === undefined ? 1500 : d); }

  if (on()) {
    window.addEventListener('online', () => soon(0));
    window.addEventListener('offline', () => { if (user()) set('net'); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(0); });
    setInterval(() => { if (!document.hidden) sync(); }, 3e5);
  }
  return {
    sync, soon, on, user, waiting,
    state: () => ({ st: user() ? st || 'sync' : on() ? 'out' : '', msg, at }),
    signIn: () => Cloud.signIn(),
    signOut: () => Cloud.signOut().then(() => set(on() ? 'out' : ''))
  };
}
