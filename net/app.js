// СДСМ — приложение курса. Данные прогресса: localStorage (ключ sdsm_v1) + файл data.json в Tauri.
'use strict';
const KEY = 'sdsm_v1';
const TAURI = window.__TAURI__ && window.__TAURI__.core;
const DEF_IMGS = {
  vios: 'vios-adventerprisek9-m.SPA.156-1.T',
  viosl2: 'viosl2-adventerprisek9-m.cml.SSA.high_iron_20180510',
  csr: 'csr1000vng-universalk9.16.09.01.Fuji',
  veos: 'veos-4.21.1.1F'
};
const BOX_DAYS = [0, 1, 3, 7, 16, 35, 80];

let S = null;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;

// Веб-версия (сайт english/net) синхронизирует прогресс через облако; в программе Tauri облака нет.
const WEB = !TAURI && typeof CloudSync == 'function';
const DEV = WEB ? syncDev() : 'pc';
const HOSTED = /\/net\/(index\.html)?$/.test(location.pathname);   // курс лежит внутри приложения английского
const newId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function blank() {
  // days — минуты этого устройства, daysX — минуты других устройств {устройство: {дата: минуты}}
  return { v: 1, ts: 0, ch: {}, cards: {}, days: {}, daysX: {}, unclear: [], last: null, exams: [],
    settings: { theme: 'dark', imgs: { ...DEF_IMGS }, newPerDay: 20 } };
}
function migrate(s) {
  const b = blank();
  s = Object.assign(b, s || {});
  s.settings = Object.assign(b.settings, s.settings || {});
  s.settings.imgs = Object.assign({ ...DEF_IMGS }, s.settings.imgs || {});
  // у записей-списков постоянный id: по нему они синхронизируются
  if (typeof syncOldId == 'function') [s.unclear, s.exams].forEach(a => a.forEach((x, i) => { if (!x.id) x.id = syncOldId(x, i); }));
  return s;
}
// минуты за день со всех устройств
function dayMin(d) { let m = S.days[d] || 0; for (const k in S.daysX) m += S.daysX[k][d] || 0; return Math.round(m * 10) / 10; }
function loadLocal() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
// Пока прогресс не прочитан, ничего не пишем: иначе пустое состояние затрёт настоящее.
let loaded = false;
let saveT = null;
function stamp() { const d = new Date(); return today() + '_' + String(d.getHours()).padStart(2, '0'); }
// quiet — без немедленной синхронизации (счётчик минут сохраняет каждые 30 секунд, их унесёт плановая)
function save(quiet) {
  if (!loaded) return;
  S.ts = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
  if (TAURI) { clearTimeout(saveT); saveT = setTimeout(flush, 150); }
  if (SY && !quiet) SY.soon();
}
// Запись в data.json (с почасовой автокопией на стороне Rust).
function flush() {
  clearTimeout(saveT); saveT = null;
  if (!loaded || !TAURI) return;
  TAURI.invoke('save_state', { data: JSON.stringify(S), stamp: stamp() }).catch(e => console.error('save_state', e));
}
window.addEventListener('beforeunload', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
// «Вес» прогресса: чтобы никогда не выбрать пустое состояние вместо настоящего.
function progressScore(s) {
  if (!s || typeof s !== 'object') return -1;
  let n = Object.keys(s.cards || {}).length + (s.unclear || []).length + (s.exams || []).length;
  Object.values(s.ch || {}).forEach(c => {
    if (!c) return;
    n += Object.keys(c.read || {}).length + (c.quiz ? 1 : 0) + (c.quizRun ? 1 : 0) + Object.keys(c.und || {}).length + Object.keys(c.sim || {}).length;
    if (c.lab) n += Object.keys(c.lab.t || {}).length + Object.keys(c.lab.b || {}).length;
  });
  Object.values(s.days || {}).forEach(m => n += +m || 0);
  Object.values(s.daysX || {}).forEach(o => Object.values(o).forEach(m => n += +m || 0));
  return n;
}
function C(id) { return S.ch[id] || (S.ch[id] = { read: {}, quiz: null, lab: { t: {}, b: {} }, und: {} }); }
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200); }
function go(h) { location.hash = h; }
window.go = go;

// ---------- прогресс ----------
function bookOf(id) { return window.BOOK && window.BOOK[id] && window.BOOK[id].parts ? window.BOOK[id] : null; }
function chapterStats(id) {
  const ch = COURSE.ch[id]; const st = C(id);
  if (!ch) return null;
  const th = ch.theory || [], tasks = (ch.lab && ch.lab.tasks) || [], und = ch.und || [], cards = ch.cards || [];
  // если у главы есть «Книга», чтение считается по её разделам (конспект — по желанию)
  const thKeys = bookOf(id) ? bookOf(id).parts.map((p, i) => 'book:' + i) : th.map(s => s.id);
  const r = {
    th: [thKeys.filter(k => st.read[k]).length, thKeys.length],
    quiz: st.quiz ? st.quiz.best : null,
    lab: [tasks.filter((t, i) => st.lab.t[i]).length, tasks.length],
    und: [und.filter((u, i) => st.und[i] && st.und[i].g).length, und.length],
    cards: [cards.filter((c, i) => { const x = S.cards[id + ':' + i]; return x && x.box >= 3; }).length, cards.length],
    sim: simStats(id)
  };
  const parts = [[r.th, 25], [[r.quiz != null ? Math.min(r.quiz, 100) : 0, 100], 25], [r.lab, 25], [r.und, 15], [r.cards, 10]];
  let p = 0; parts.forEach(([v, w]) => p += v[1] ? v[0] / v[1] * w : w);
  r.p = Math.round(p);
  r.done = r.th[0] === r.th[1] && r.quiz >= 80 && r.lab[0] === r.lab[1] && r.und[0] === r.und[1];
  r.started = r.th[0] > 0 || r.quiz != null || r.lab[0] > 0 || r.und[0] > 0 || !!(r.sim && r.sim[0]);
  return r;
}
function statusCls(id) { const r = chapterStats(id); if (!r) return ''; return r.done ? 'd' : r.started ? 'p' : ''; }

// ---------- время занятий ----------
let lastAct = Date.now();
['mousemove', 'keydown', 'click', 'scroll', 'wheel'].forEach(e => document.addEventListener(e, () => lastAct = Date.now(), { passive: true, capture: true }));
setInterval(() => {
  if (S && loaded && document.visibilityState === 'visible' && Date.now() - lastAct < 120000) {
    const d = today(); S.days[d] = Math.round(((S.days[d] || 0) + 0.5) * 10) / 10; save(true);
  }
}, 30000);

// ---------- облако ----------
// Прогресс раскладывается на строки: прочитанный раздел, тест, ответ «Объясни», задание лабы, карточка, минуты дня.
// Чужие правки вносятся точечно (put/drop), поэтому открытый тест и набранный ответ не теряются.
// На устройстве остаются: тема, «где остановился», незаконченный счёт времени других приложений.
function rowsOf(s) {
  const R = { set: { imgs: s.settings.imgs, newPerDay: s.settings.newPerDay } };
  for (const id in s.ch) {
    const c = s.ch[id]; if (!c) continue;
    for (const k in c.read || {}) if (c.read[k]) R['r:' + id + ':' + k] = 1;
    if (c.quiz) R['q:' + id] = c.quiz;
    if (c.quizRun) R['qr:' + id] = c.quizRun;
    if (c.lab) { for (const i in c.lab.t) if (c.lab.t[i]) R['lt:' + id + ':' + i] = 1; for (const i in c.lab.b) if (c.lab.b[i]) R['lb:' + id + ':' + i] = 1; }
    for (const i in c.und || {}) if (c.und[i]) R['u:' + id + ':' + i] = c.und[i];
    for (const i in c.sim || {}) if (c.sim[i]) R['s:' + id + ':' + i] = c.sim[i];
  }
  for (const k in s.cards) R['c:' + k] = s.cards[k];
  for (const d in s.days) if (s.days[d]) R['m:' + d + ':' + DEV] = s.days[d];
  for (const dv in s.daysX) for (const d in s.daysX[dv]) if (s.daysX[dv][d]) R['m:' + d + ':' + dv] = s.daysX[dv][d];
  s.unclear.forEach(x => { if (x.id) R['n:' + x.id] = x; });
  s.exams.forEach(x => { if (x.id) R['e:' + x.id] = x; });
  return R;
}
// ключ строки → [тип, глава, остаток]
function rowKey(k) {
  const a = k.indexOf(':'); if (a < 0) return [k, '', ''];   // 'set' — без двоеточия
  const b = k.indexOf(':', a + 1); return [k.slice(0, a), b < 0 ? k.slice(a + 1) : k.slice(a + 1, b), b < 0 ? '' : k.slice(b + 1)];
}
function rowPut(k, v) {
  const [t, x, y] = rowKey(k);
  if (t === 'set') { S.settings.imgs = Object.assign({ ...DEF_IMGS }, v.imgs || {}); S.settings.newPerDay = v.newPerDay || 20; }
  else if (t === 'r') C(x).read[y] = true;
  else if (t === 'q') C(x).quiz = v;
  else if (t === 'qr') C(x).quizRun = v;
  else if (t === 'lt') C(x).lab.t[y] = true;
  else if (t === 'lb') C(x).lab.b[y] = true;
  else if (t === 'u') C(x).und[y] = v;
  else if (t === 's') (C(x).sim = C(x).sim || {})[y] = v;
  else if (t === 'c') S.cards[k.slice(2)] = v;
  else if (t === 'm') { const d = k.slice(2, 12), dv = k.slice(13); if (dv === DEV) S.days[d] = v; else (S.daysX[dv] = S.daysX[dv] || {})[d] = v; }
  else if (t === 'n' || t === 'e') { const a = t === 'n' ? S.unclear : S.exams, id = k.slice(2), i = a.findIndex(z => z.id === id); if (i >= 0) a[i] = v; else { a.push(v); a.sort((p, q) => p.id < q.id ? -1 : 1); } }
}
function rowDrop(k) {
  const [t, x, y] = rowKey(k), c = S.ch[x];
  if (t === 'r') { if (c) delete c.read[y]; }
  else if (t === 'q') { if (c) c.quiz = null; }
  else if (t === 'qr') { if (c) delete c.quizRun; }
  else if (t === 'lt') { if (c) delete c.lab.t[y]; }
  else if (t === 'lb') { if (c) delete c.lab.b[y]; }
  else if (t === 'u') { if (c) delete c.und[y]; }
  else if (t === 's') { if (c && c.sim) delete c.sim[y]; }
  else if (t === 'c') delete S.cards[k.slice(2)];
  else if (t === 'm') { const d = k.slice(2, 12), dv = k.slice(13); if (dv === DEV) delete S.days[d]; else if (S.daysX[dv]) delete S.daysX[dv][d]; }
  else if (t === 'n') S.unclear = S.unclear.filter(z => z.id !== k.slice(2));
  else if (t === 'e') S.exams = S.exams.filter(z => z.id !== k.slice(2));
}
// сейчас что-то вводят или идёт тест/карточки: перерисовывать нельзя
const inputBusy = () => { const a = document.activeElement; return !!(a && a.matches && a.matches('input,textarea,select')) || !!$('.qcard') || !!$('#fl') || !!$('.sim-live') || TTS.busy(); };
const SY = WEB ? CloudSync({
  app: 'sdsm', meta: 'sdsm_sync',
  rows: () => rowsOf(S), put: rowPut, drop: rowDrop,
  commit: () => { save(true); const m = $('#main'), y = m.scrollTop; route(); m.scrollTop = y; },
  pristine: () => progressScore(S) <= 0,
  trivial: k => k === 'set',
  busy: inputBusy,
  status: () => syncUI()
}) : null;
const SYNC_T = { out: ['Войти', 'Вход не выполнен'], sync: ['Обмен…', 'Синхронизация…'], ok: ['В облаке', 'Синхронизировано'], net: ['Офлайн', 'Офлайн'], err: ['Ошибка', 'Ошибка'] };
function syncPill() {
  if (!SY || !SY.on()) return '';
  const s = SY.state().st;
  return `<a href="#/settings/sync" class="spill s-${s}">${SYNC_T[s][0]}</a>`;
}
function syncUI() {
  $$('[data-sync]').forEach(el => el.innerHTML = syncPill());
  const c = $('#synccard'); if (c) c.innerHTML = syncCard();
}
function syncCard() {
  if (!SY || !SY.on()) return '<p class="muted">Облако не настроено.</p>';
  const u = SY.user(), s = SY.state(), n = SY.waiting();
  if (!u) return `<p class="muted" style="font-size:13.5px">Войди тем же GitHub, что в трекере: прогресс курса будет одинаковым на телефоне и на компьютере. На этом сайте вход общий, поэтому, скорее всего, ты уже вошёл.</p>${s.st === 'err' && s.msg ? `<p style="color:var(--bad)">${esc(s.msg)}</p>` : ''}<button class="btn pri" data-sy="in">Войти через GitHub</button>`;
  return `<div class="row"><b>${esc(u.name ? '@' + u.name : 'GitHub')}</b><span class="spill s-${s.st}">${SYNC_T[s.st][1]}</span></div>
    <p class="muted" style="font-size:13.5px">${s.at ? 'Последний раз в ' + new Date(s.at).toTimeString().slice(0, 5) + '. ' : ''}${n ? 'Ждут отправки: ' + n + '.' : 'Все изменения в облаке.'}${s.st === 'net' ? ' Нет сети: всё сохраняется здесь и уйдёт в облако, когда сеть появится.' : ''}</p>
    ${s.st === 'err' && s.msg ? `<p style="color:var(--bad)">${esc(s.msg)}</p>` : ''}
    <div class="row"><button class="btn" data-sy="now">Синхронизировать</button><button class="btn" data-sy="out">Выйти</button></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sy]'); if (!b || !SY) return;
  const a = b.dataset.sy;
  if (a === 'in') { if (!navigator.onLine) return toast('Нет сети'); SY.signIn().catch(() => toast('Не удалось начать вход')); }
  else if (a === 'now') SY.sync();
  else if (a === 'out' && confirm('Выйти из аккаунта? Прогресс на этом устройстве останется.')) SY.signOut().then(syncUI);
});

// Один раз переносим прогресс глав, пройденных в телефонной вкладке «Сети» приложения английского (тот же сайт, ключ eng_v1).
const PHONE_BOOKS = ['ch01', 'ch02'];   // главы, у которых на телефоне была та же книга
function importPhone() {
  if (!WEB || S.phoneImported) return;
  let E = null; try { E = JSON.parse(localStorage.getItem('eng_v1')); } catch (e) { }
  if (!E || !E.L) return;
  let n = 0;
  COURSE.list.forEach(m => {
    const L = E.L['sd_' + m.id], ch = COURSE.ch[m.id]; if (!L || !ch) return;
    const st = C(m.id);
    Object.entries(L.und || {}).forEach(([i, t]) => { if (t && t.trim() && !(st.und[i] && (st.und[i].t || '').trim())) { st.und[i] = { t, d: L.ownD || today() }; n++; } });
    const bk = bookOf(m.id);
    if (bk && PHONE_BOOKS.includes(m.id) && (L.done || ['tasks', 'brk', 'und', 'done'].includes(L.st))) bk.parts.forEach((p, i) => { if (!st.read['book:' + i]) { st.read['book:' + i] = true; n++; } });
    if (L.sc && L.sc[1]) {
      const p = pct(L.sc[0], L.sc[1]);
      if (!st.quiz) { st.quiz = { best: p, n: 1, lastScore: p, last: L.done || today(), wrong: (L.r || []).map((x, k) => x === 0 ? k : -1).filter(k => k >= 0) }; n++; }
      else if (p > st.quiz.best) { st.quiz.best = p; n++; }
    }
  });
  Object.entries(E.cards || {}).forEach(([k, c]) => {
    const m = /^n:sd_([^:]+):(\d+)$/.exec(k); if (!m || !COURSE.ch[m[1]]) return;
    const key = m[1] + ':' + m[2];
    if (!S.cards[key] && c.n) { S.cards[key] = { box: Math.min(6, c.b || 0), n: c.n, lapse: c.x || 0, due: c.due || today(), first: '', last: '' }; n++; }
  });
  S.phoneImported = today(); save();
  if (n) toast('Перенесено с телефона: ' + n);
}
// Перенос из программы СДСМ: объединяем, ничего не удаляя (обычное «Восстановить» заменяет прогресс целиком)
// (минуты программы становятся минутами этого компьютера: rowsOf подписывает их текущим устройством)
function mergeFrom(d) {
  const T = migrate(d), R = rowsOf(T);
  for (const k in R) rowPut(k, R[k]);
  save();
}

// ---------- карточки (интервальные повторения) ----------
function cardKey(ch, i) { return ch + ':' + i; }
function rateCard(key, r) { // r: 0 снова, 1 трудно, 2 хорошо, 3 легко
  const c = S.cards[key] || { box: 0, n: 0, lapse: 0, first: today() };
  c.n++;
  if (r === 0) { c.box = 1; c.lapse++; c.due = today(); }
  else if (r === 1) { c.box = Math.max(1, c.box); c.due = addDays(today(), 1); }
  else if (r === 2) { c.box = Math.min(6, c.box + 1); c.due = addDays(today(), BOX_DAYS[c.box]); }
  else { c.box = Math.min(6, c.box + 2); c.due = addDays(today(), BOX_DAYS[c.box]); }
  c.last = today();
  S.cards[key] = c; save();
}
function dueCards() {
  const t = today(), due = [], fresh = [];
  let newToday = Object.values(S.cards).filter(c => c.first === t).length;
  COURSE.list.forEach(m => {
    const ch = COURSE.ch[m.id]; if (!ch || !ch.cards) return;
    const opened = Object.keys(C(m.id).read).length > 0;
    ch.cards.forEach((c, i) => {
      const k = cardKey(m.id, i), s = S.cards[k];
      if (s) { if (s.due <= t) due.push(k); }
      else if (opened) fresh.push(k);
    });
  });
  const room = Math.max(0, S.settings.newPerDay - newToday);
  return due.concat(fresh.slice(0, room));
}
function cardByKey(k) { const [id, i] = k.split(':'); const ch = COURSE.ch[id]; return ch && { ch, id, i: +i, c: ch.cards[+i] }; }

// ---------- оформление контента ----------
function cliHighlight(root) {
  $$('pre.cli', root).forEach(pre => {
    if (pre.dataset.done) return; pre.dataset.done = 1;
    const raw = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    const out = raw.split('\n').map(line => {
      let h = esc(line);
      h = h.replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>');
      const m = /^([A-Za-z0-9_\-\.\/:@~]+(?:\([a-z0-9\-\.\/]+\))?[#>$%])(\s?)(.*)$/.exec(h);
      if (m && !/^\d/.test(m[1])) return `<span class="pr">${m[1]}</span>${m[2]}<span class="cmd">${m[3]}</span>`;
      if (/^\s*(!|\/\/)/.test(line)) return `<span class="cm">${h}</span>`;
      return h;
    }).join('\n');
    pre.innerHTML = out;
    addCopy(pre, raw.replace(/\[\[(.+?)\]\]/g, '$1'));
  });
  $$('pre:not(.cli)', root).forEach(pre => { if (!pre.dataset.done) { pre.dataset.done = 1; addCopy(pre, pre.textContent); } });
}
function addCopy(pre, text) {
  const b = document.createElement('button'); b.className = 'copy'; b.textContent = 'копировать';
  b.onclick = e => { e.stopPropagation(); copyText(text); };
  pre.appendChild(b);
}
function copyText(t) {
  const done = () => toast('Скопировано');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  else fallbackCopy(t, done);
}
function fallbackCopy(t, cb) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); cb(); } catch (e) { } ta.remove(); }
function cliBlock(text) { return `<pre class="cli">${esc(text)}</pre>`; }

// ---------- навигация ----------
function renderSide() {
  const due = dueCards().length;
  const r = location.hash;
  const nav = [['#/', '🏠', 'Главная'], ['#/review', '🃏', 'Повторение', due], ['#/exam', '🎯', 'Экзамен'], ['#/sim', '🚨', 'Дежурство'], ['#/report', '📋', 'Отчёт наставнику'], ['#/guide', '🧭', 'Как учиться + EVE-NG'], ['#/search', '🔎', 'Поиск'], ['#/settings', '⚙️', 'Настройки']];
  $('#mainnav').innerHTML = (HOSTED ? '<a href="../" class="back">‹ Английский и тренажёр подсетей</a>' : '') + nav.map(([h, i, t, b]) => `<a href="${h}" class="${(r === h || (h !== '#/' && r.startsWith(h))) || (h === '#/' && (r === '' || r === '#/')) ? 'on' : ''}"><span>${i}</span>${t}${b ? `<span class="badge">${b}</span>` : ''}</a>`).join('');
  let h = '';
  COURSE.parts.forEach(p => {
    h += `<div class="ptitle">${p.title}</div><div class="cnav">`;
    COURSE.list.filter(m => m.part === p.id).forEach(m => {
      const ok = !!COURSE.ch[m.id];
      const on = r.startsWith('#/c/' + m.id + '/') || r === '#/c/' + m.id;
      h += `<a href="#/c/${m.id}/overview" class="${on ? 'on' : ''} ${ok ? '' : 'na'}"><span class="num">${m.num}</span><span class="ttl">${m.title}</span><span class="st ${statusCls(m.id)}"></span></a>`;
    });
    h += '</div>';
  });
  $('#chapnav').innerHTML = h;
}

function route() {
  const h = location.hash || '#/';
  const v = $('#view');
  const p = h.slice(2).split('/');
  TTS.stop();   // страница меняется — читать больше нечего
  try {
    if (p[0] === 'c') viewChapter(v, p[1], p[2] || 'overview', p[3]);
    else if (p[0] === 'review') viewReview(v);
    else if (p[0] === 'exam') viewExam(v);
    else if (p[0] === 'sim') viewSimAll(v);
    else if (p[0] === 'report') viewReport(v);
    else if (p[0] === 'guide') viewGuide(v);
    else if (p[0] === 'settings') viewSettings(v, p[1]);
    else if (p[0] === 'search') viewSearch(v, decodeURIComponent(p[1] || ''));
    else viewHome(v);
  } catch (e) { v.innerHTML = `<div class="callout bad"><b>Ошибка отображения</b><pre>${esc(e.stack || e)}</pre></div>`; console.error(e); }
  renderSide();
  syncUI();
  cliHighlight(v);
  figControls(v);
  if (!p[3]) $('#main').scrollTop = 0;
}
window.addEventListener('hashchange', route);
// телефон: боковое меню выезжает по кнопке ☰ и прячется после перехода
$('#menubtn').onclick = () => document.body.classList.toggle('menu');
$('#scrim').onclick = () => document.body.classList.remove('menu');
window.addEventListener('hashchange', () => document.body.classList.remove('menu'));

// ---------- главная ----------
function viewHome(v) {
  const t = today();
  const mins = dayMin(t);
  const due = dueCards().length;
  const all = COURSE.list.map(m => ({ m, r: chapterStats(m.id) }));
  const avail = all.filter(x => x.r);
  const done = avail.filter(x => x.r.done).length;
  const quizzes = avail.filter(x => x.r.quiz != null);
  const avgQ = quizzes.length ? Math.round(quizzes.reduce((a, x) => a + x.r.quiz, 0) / quizzes.length) : null;
  const totalP = avail.length ? Math.round(avail.reduce((a, x) => a + x.r.p, 0) / COURSE.list.length) : 0;
  let cont = S.last && COURSE.ch[S.last.id] ? S.last : null;
  if (!cont) { const f = avail.find(x => !x.r.done); if (f) cont = { id: f.m.id, tab: 'overview' }; }
  const cm = cont && COURSE.list.find(m => m.id === cont.id);
  const lvl = mins >= 120 ? 'максимум' : mins >= 45 ? 'норма' : mins >= 15 ? 'минимум' : null;
  // тепловая карта 12 недель
  let heat = ''; for (let i = 83; i >= 0; i--) { const d = addDays(t, -i), m = dayMin(d); heat += `<i title="${d}: ${m} мин" class="${m >= 120 ? 'l3' : m >= 45 ? 'l2' : m >= 15 ? 'l1' : m > 0 ? 'l1' : ''}"></i>`; }
  let streak = 0; for (let i = 0; i < 400; i++) { const d = addDays(t, -i); if (dayMin(d) >= 15) streak++; else if (i > 0) break; }

  let h = `<div class="hero"><div class="row"><div class="sp">
    <div class="kicker" style="color:var(--acc2);font-weight:700;font-size:13px;letter-spacing:.6px">НАСТАВНИК</div>
    <h1>Цель: инженер, который понимает сеть провайдера насквозь</h1>
    <p class="sub">Каждая глава: теория → карточки → тест → «объясни своими словами» → лаба в EVE-NG → «сломай и почини». Глава засчитывается, только когда пройдены все пять шагов.</p>
    ${cm ? `<a class="btn pri" href="#/c/${cont.id}/${cont.tab || 'overview'}">▶ Продолжить: ${cm.num}. ${cm.title}</a>` : ''}
    ${due ? ` <a class="btn" href="#/review">🃏 Повторить карточки (${due})</a>` : ''}
    </div></div></div>
  <div class="grid g4">
    <div class="card stat"><b>${mins} мин</b><span>сегодня ${lvl ? '· ' + lvl + ' ✓' : '· минимум 15 мин'}</span></div>
    <div class="card stat"><b>${streak}</b><span>дней подряд от 15 минут</span></div>
    <div class="card stat"><b>${done} / ${COURSE.list.length}</b><span>глав освоено · курс ${totalP}%</span></div>
    <div class="card stat"><b>${avgQ == null ? '—' : avgQ + '%'}</b><span>средний лучший результат тестов</span></div>
  </div>
  <div class="card"><div class="row"><b>Активность за 12 недель</b><span class="sp"></span><span class="muted" style="font-size:13px">светлее — меньше; 15 / 45 / 120 мин</span></div><div class="heat" style="margin-top:10px">${heat}</div></div>`;
  COURSE.parts.forEach(p => {
    h += `<h2>${p.title}</h2><p class="sub">${p.sub}</p><div class="grid g3">`;
    COURSE.list.filter(m => m.part === p.id).forEach(m => {
      const r = chapterStats(m.id);
      if (!r) { h += `<div class="chapcard na"><div class="n">ГЛАВА ${m.num}</div><div class="t">${m.title}</div><div class="muted" style="font-size:13px">готовится</div></div>`; return; }
      h += `<a class="chapcard" href="#/c/${m.id}/overview"><div class="n">ГЛАВА ${m.num} ${r.done ? '· <span style="color:var(--ok)">ОСВОЕНА</span>' : ''}</div><div class="t">${m.title}</div>
        <div class="bar ${r.done ? 'ok' : ''}"><i style="width:${r.p}%"></i></div>
        <div class="mini"><span class="${r.th[0] === r.th[1] ? 'd' : ''}">📖 ${r.th[0]}/${r.th[1]}</span><span class="${r.quiz >= 80 ? 'd' : ''}">🎯 ${r.quiz == null ? '—' : r.quiz + '%'}</span><span class="${r.lab[0] === r.lab[1] && r.lab[1] ? 'd' : ''}">🧪 ${r.lab[0]}/${r.lab[1]}</span><span class="${r.und[0] === r.und[1] ? 'd' : ''}">💬 ${r.und[0]}/${r.und[1]}</span></div></a>`;
    });
    h += '</div>';
  });
  v.innerHTML = h;
}

// ---------- глава ----------
const TABS = [['overview', 'Обзор'], ['theory', 'Теория'], ['cmds', 'Команды'], ['cards', 'Карточки'], ['quiz', 'Тест'], ['und', 'Понимание'], ['lab', 'Лаба EVE-NG']];
function tabsFor(id) {
  const t = bookOf(id) ? [['overview', 'Обзор'], ['book', '📖 Книга'], ['theory', 'Конспект'], ['cmds', 'Команды'], ['cards', 'Карточки'], ['quiz', 'Тест'], ['und', 'Понимание'], ['lab', 'Лаба EVE-NG']] : TABS.slice();
  if (simOf(id)) t.splice(t.length - 1, 0, ['sim', '🚨 Дежурство']);
  return t;
}
function viewChapter(v, id, tab, anchor) {
  const ch = COURSE.ch[id], m = COURSE.list.find(x => x.id === id);
  if (!m) { v.innerHTML = '<p>Глава не найдена</p>'; return; }
  if (!ch) { v.innerHTML = `<div class="chhead"><div class="kicker">Глава ${m.num}</div><h1>${m.title}</h1></div><div class="callout info"><b>Глава готовится</b>Наставник пишет её следующей. Исходная статья: <a href="${m.src}" target="_blank">${m.src}</a></div>`; return; }
  S.last = { id, tab }; save(true);
  const r = chapterStats(id);
  const bk = bookOf(id);
  const cnt = { cards: (ch.cards || []).length, quiz: r.quiz == null ? (ch.quiz || []).length : r.quiz + '%', und: `${r.und[0]}/${r.und[1]}`, lab: `${r.lab[0]}/${r.lab[1]}` };
  if (bk) cnt.book = `${r.th[0]}/${r.th[1]}`; else cnt.theory = `${r.th[0]}/${r.th[1]}`;
  if (r.sim) cnt.sim = `${r.sim[0]}/${r.sim[1]}`;
  let h = `<div class="chhead"><div class="kicker">Глава ${m.num} · ${COURSE.parts.find(p => p.id === m.part).title.replace(/^Часть [IV]+\. /, '')}</div><h1>${m.title}</h1>
    <div class="row" style="margin-top:6px"><div class="bar ${r.done ? 'ok' : ''}" style="width:240px"><i style="width:${r.p}%"></i></div><span class="muted" style="font-size:13px">${r.p}% ${r.done ? '· глава освоена ✓' : ''}</span></div></div>
    <div class="tabs">${tabsFor(id).map(([k, t]) => `<a href="#/c/${id}/${k}" class="${tab === k ? 'on' : ''}">${t}${cnt[k] != null ? `<span class="c">${cnt[k]}</span>` : ''}</a>`).join('')}</div><div id="tabbody"></div>`;
  v.innerHTML = h;
  const b = $('#tabbody');
  ({ overview: tOverview, book: bk ? tBook : tTheory, theory: tTheory, cmds: tCmds, cards: tCards, quiz: tQuiz, und: tUnd, sim: tSim, lab: tLab }[tab] || tOverview)(b, ch, id, anchor);
}

function tOverview(b, ch, id) {
  const r = chapterStats(id), m = COURSE.list.find(x => x.id === id);
  const step = (ok, t, d, href) => `<a class="chapcard" href="${href}" style="display:flex;gap:12px;align-items:center"><span style="font-size:22px">${ok ? '✅' : '⬜'}</span><span><b>${t}</b><br><span class="muted" style="font-size:13px">${d}</span></span></a>`;
  b.innerHTML = `<div class="content">${ch.intro || ''}</div>
  ${ch.goals ? `<div class="card"><b>После главы ты сможешь:</b><ul>${ch.goals.map(g => `<li>${g}</li>`).join('')}</ul></div>` : ''}
  ${ch.why ? `<div class="callout pro"><b>Зачем это инженеру провайдера</b>${ch.why}</div>` : ''}
  <h3>Маршрут главы ${ch.time ? `<span class="pill">${ch.time}</span>` : ''}</h3>
  <div class="grid g2">
    ${bookOf(id) ? step(r.th[0] === r.th[1], '1. Книга', `прочитано разделов: ${r.th[0]} из ${r.th[1]} · конспект — по желанию`, `#/c/${id}/book`)
      : step(r.th[0] === r.th[1], '1. Теория', `прочитано разделов: ${r.th[0]} из ${r.th[1]}`, `#/c/${id}/theory`)}
    ${step(r.cards[0] === r.cards[1] && r.cards[1] > 0, '2. Карточки', `выучено (3+ уровень): ${r.cards[0]} из ${r.cards[1]}`, `#/c/${id}/cards`)}
    ${step(r.quiz >= 80, '3. Тест на понимание', r.quiz == null ? 'не пройден · порог 80%' : `лучший результат ${r.quiz}% · порог 80%`, `#/c/${id}/quiz`)}
    ${step(r.und[0] === r.und[1], '4. Объясни своими словами', `ответов с самооценкой: ${r.und[0]} из ${r.und[1]}`, `#/c/${id}/und`)}
    ${step(r.lab[0] === r.lab[1] && r.lab[1] > 0, '5. Лаба в EVE-NG', `заданий выполнено: ${r.lab[0]} из ${r.lab[1]}`, `#/c/${id}/lab`)}
    ${r.sim ? step(r.sim[0] === r.sim[1], '🚨 Дежурство (без EVE-NG)', `вызовов решено: ${r.sim[0]} из ${r.sim[1]} · можно до лабы и с телефона`, `#/c/${id}/sim`) : ''}
  </div>
  <h3>Источники</h3><div class="content"><ul>
    <li>Исходная статья цикла: <a href="${m.src}" target="_blank">${m.src}</a></li>
    ${(ch.refs || []).map(x => `<li>${x.u ? `<a href="${x.u}" target="_blank">${x.t}</a>` : `<b>${x.t}</b>`}${x.n ? ' — ' + x.n : ''}</li>`).join('')}
  </ul></div>`;
}

// озвучка (tts.js): кнопка у раздела и строка в начале; дослушанный раздел отмечается прочитанным
const ttsBtn = i => TTS.ok ? `<button class="btn sm" data-tts="${i}">🔊 Слушать</button>&nbsp;` : '';
const ttsTop = () => TTS.ok ? `<div class="row ttstop"><button class="btn sm" data-tts="0">🔊 Слушать с начала</button><span class="muted" style="font-size:13px">читает голос браузера · щёлкни по абзацу — продолжит с него · дослушанный раздел отмечается прочитанным</span></div>` : '';
function setReadUI(b, k, sec, v) {
  const r = $(`[data-read="${k}"]`, b); if (r) { r.classList.toggle('ok', v); r.textContent = v ? '✓ Прочитано' : 'Отметить прочитанным'; }
  const a = $(`.toc a[data-sec="${sec}"]`, b); if (a) a.classList.toggle('rd', v);
  renderSide();
}
function tTheory(b, ch, id, anchor) {
  const st = C(id);
  const secs = ch.theory || [];
  let toc = secs.map((s, i) => `<a href="#/c/${id}/theory/${s.id}" class="${st.read[s.id] ? 'rd' : ''}" data-sec="${s.id}">${i + 1}. ${s.h}</a>`).join('');
  let body = `<div class="ttswrap">${ttsTop()}</div>` + secs.map((s, i) => `<section class="sec content" id="sec-${s.id}"><h2><span class="n">${i + 1}.</span>${s.h}</h2>${s.html}
    <div class="secfoot">${ttsBtn(i)}<button class="btn sm" data-unclear="${s.id}">❓ Непонятно</button>&nbsp;<button class="btn sm ${st.read[s.id] ? 'ok' : ''}" data-read="${s.id}">${st.read[s.id] ? '✓ Прочитано' : 'Отметить прочитанным'}</button></div></section>`).join('');
  body += `<div class="card"><div class="row"><b>Теория пройдена?</b><span class="sp"></span><a class="btn pri" href="#/c/${id}/cards">Дальше: карточки →</a></div></div>`;
  b.innerHTML = `<div class="theory"><div>${body}</div><nav class="toc">${toc}</nav></div>`;
  b.onclick = e => {
    const r = e.target.closest('[data-read]');
    if (r) { const k = r.dataset.read; st.read[k] = !st.read[k]; save(); setReadUI(b, k, k, !!st.read[k]); return; }
    const tt = e.target.closest('[data-tts]');
    if (tt) { TTS.readPage(b, +tt.dataset.tts, { onSection: i => { const k = secs[i] && secs[i].id; if (k && !st.read[k]) { st.read[k] = true; save(); setReadUI(b, k, k, true); } } }); return; }
    const u = e.target.closest('[data-unclear]');
    if (u) {
      const sec = secs.find(s => s.id === u.dataset.unclear);
      const t = prompt('Что именно непонятно в разделе «' + sec.h + '»? Запиши своими словами — это уйдёт в отчёт наставнику.');
      if (t && t.trim()) { S.unclear.push({ id: newId(), ch: id, sec: sec.h, t: t.trim(), d: today() }); save(); toast('Записано. Разберём в отчёте.'); }
    }
  };
  $$('.toc a', b).forEach(a => a.onclick = e => { e.preventDefault(); const el = $('#sec-' + a.dataset.sec); if (el) el.scrollIntoView({ behavior: 'smooth' }); });
  if (anchor) setTimeout(() => { const el = $('#sec-' + anchor); if (el) el.scrollIntoView(); }, 30);
}

// --- книга: цельный текст по разделам, со схемами и анимацией
function tBook(b, ch, id, anchor) {
  const st = C(id), bk = bookOf(id);
  const key = i => 'book:' + i;
  const toc = bk.parts.map((p, i) => `<a href="#/c/${id}/book/${i}" class="${st.read[key(i)] ? 'rd' : ''}" data-sec="${i}">${i + 1}. ${p.h}</a>`).join('');
  let body = `<section class="sec content book">${ttsTop()}${bk.lead || ''}</section>`;
  body += bk.parts.map((p, i) => `<section class="sec content book" id="sec-${i}"><h2><span class="n">${i + 1}.</span>${p.h}</h2>${p.html}
    <div class="secfoot">${ttsBtn(i)}<button class="btn sm" data-unclear="${i}">❓ Непонятно</button>&nbsp;<button class="btn sm ${st.read[key(i)] ? 'ok' : ''}" data-read="${key(i)}" data-i="${i}">${st.read[key(i)] ? '✓ Прочитано' : 'Отметить прочитанным'}</button></div></section>`).join('');
  if (bk.end) body += `<section class="sec content book">${bk.end}</section>`;
  body += `<div class="card"><div class="row"><b>Книга прочитана?</b><span class="sp"></span><a class="btn" href="#/c/${id}/theory">Конспект (по желанию)</a><a class="btn pri" href="#/c/${id}/cards">Дальше: карточки →</a></div></div>`;
  b.innerHTML = `<div class="theory"><div>${body}</div><nav class="toc">${toc}</nav></div>`;
  b.onclick = e => {
    const r = e.target.closest('[data-read]');
    if (r) { const k = r.dataset.read; st.read[k] = !st.read[k]; save(); setReadUI(b, k, r.dataset.i, !!st.read[k]); return; }
    const tt = e.target.closest('[data-tts]');
    if (tt) { TTS.readPage(b, +tt.dataset.tts, { onSection: i => { const k = key(i); if (!st.read[k]) { st.read[k] = true; save(); setReadUI(b, k, i, true); } } }); return; }
    const u = e.target.closest('[data-unclear]');
    if (u) {
      const sec = bk.parts[+u.dataset.unclear];
      const t = prompt('Что именно непонятно в разделе «' + sec.h + '»? Запиши своими словами — это уйдёт в отчёт наставнику.');
      if (t && t.trim()) { S.unclear.push({ id: newId(), ch: id, sec: sec.h, t: t.trim(), d: today() }); save(); toast('Записано. Разберём в отчёте.'); }
    }
  };
  $$('.toc a', b).forEach(a => a.onclick = e => { e.preventDefault(); const el = $('#sec-' + a.dataset.sec); if (el) el.scrollIntoView({ behavior: 'smooth' }); });
  if (anchor) setTimeout(() => { const el = $('#sec-' + anchor); if (el) el.scrollIntoView(); }, 30);
}
// Кнопки «пауза / сначала» под анимированными схемами
function figControls(root) {
  $$('figure.dg', root).forEach(f => {
    const svg = $('svg', f);
    if (!svg || f.dataset.ctl || !svg.querySelector('animate,animateMotion,animateTransform')) return;
    f.dataset.ctl = 1;
    const bar = document.createElement('div'); bar.className = 'figctl';
    bar.innerHTML = '<button class="btn sm" data-f="pp">⏸ Пауза</button><button class="btn sm" data-f="rs">↺ Сначала</button><span class="muted">анимация повторяется</span>';
    bar.onclick = e => {
      const t = e.target.closest('[data-f]'); if (!t) return;
      const pp = $('[data-f="pp"]', bar);
      if (t.dataset.f === 'pp') {
        if (svg.animationsPaused()) { svg.unpauseAnimations(); pp.textContent = '⏸ Пауза'; } else { svg.pauseAnimations(); pp.textContent = '▶ Дальше'; }
      } else { svg.setCurrentTime(0); svg.unpauseAnimations(); pp.textContent = '⏸ Пауза'; }
    };
    f.insertBefore(bar, $('figcaption', f));
  });
}

function tCmds(b, ch) {
  const rows = ch.cmds || [];
  b.innerHTML = `<p class="sub">Шпаргалка главы. Cisco IOS — основной синтаксис курса; рядом аналоги Huawei VRP и Juniper Junos, которые встречаются у провайдеров.</p>
    <input type="search" id="cmdq" placeholder="Фильтр по командам и описаниям…">
    <table class="cmdtbl" id="cmdtbl"><thead><tr><th>Cisco IOS</th><th>Что делает</th><th>Huawei / Junos</th></tr></thead><tbody>
    ${rows.map(r => r.g ? `<tr class="grp"><td colspan="3">${esc(r.g)}</td></tr>` : `<tr><td class="c">${esc(r.c)}</td><td>${r.d}</td><td class="v">${r.hw ? 'HW: ' + esc(r.hw) : ''}${r.hw && r.jn ? '\n' : ''}${r.jn ? 'JN: ' + esc(r.jn) : ''}</td></tr>`).join('')}
    </tbody></table>`;
  $('#cmdq').oninput = e => { const q = e.target.value.toLowerCase(); $$('#cmdtbl tbody tr').forEach(tr => { if (!tr.classList.contains('grp')) tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; }); };
}

// --- карточки главы
function flashUI(b, keys, title, onEnd) {
  let i = 0, flipped = false;
  const stats = [0, 0, 0, 0];
  function show() {
    if (i >= keys.length) {
      b.innerHTML = `<div class="card" style="text-align:center"><div style="font-size:44px">🎉</div><h2 style="margin-top:4px">${title}: готово</h2>
        <p class="sub">Снова: ${stats[0]} · Трудно: ${stats[1]} · Хорошо: ${stats[2]} · Легко: ${stats[3]}</p>
        <p class="muted">Карточки вернутся сами, когда подойдёт срок: 1 → 3 → 7 → 16 → 35 → 80 дней.</p>${onEnd || ''}</div>`;
      renderSide(); return;
    }
    const x = cardByKey(keys[i]); const s = S.cards[keys[i]];
    flipped = false;
    b.innerHTML = `<div class="row" style="max-width:720px;margin:0 auto"><span class="muted">${title} · ${i + 1} из ${keys.length}</span><span class="sp"></span><span class="pill">${s ? 'уровень ' + s.box : 'новая'}</span><span class="pill acc">гл. ${COURSE.list.find(m => m.id === x.id).num}</span></div>
      <div class="flash" id="fl"><div class="inner"><div class="face"><span class="lbl">Вопрос</span><div class="q">${x.c[0]}</div><div class="muted" style="text-align:center;margin-top:18px;font-size:13px">Ответь вслух или в голове, потом нажми <span class="kbd">Пробел</span></div></div>
      <div class="face back content"><span class="lbl">Ответ</span><div class="a">${x.c[1]}</div></div></div></div>
      <div class="rate" id="rate" style="visibility:hidden">
        <button class="btn bad" data-r="0">Снова<small>не вспомнил</small></button><button class="btn" data-r="1">Трудно<small>завтра</small></button>
        <button class="btn pri" data-r="2">Хорошо<small>${BOX_DAYS[Math.min(6, (s ? s.box : 0) + 1)]} дн.</small></button><button class="btn ok" data-r="3">Легко<small>${BOX_DAYS[Math.min(6, (s ? s.box : 0) + 2)]} дн.</small></button></div>`;
    cliHighlight(b);
    $('#fl').onclick = flip;
    $$('#rate [data-r]').forEach(bt => bt.onclick = () => rate(+bt.dataset.r));
  }
  function flip() { flipped = !flipped; $('#fl').classList.toggle('flip', flipped); $('#rate').style.visibility = 'visible'; }
  function rate(r) { rateCard(keys[i], r); stats[r]++; if (r === 0) keys.push(keys[i]); i++; show(); }
  b._key = e => {
    if (!$('#fl')) return;
    if (e.code === 'Space') { e.preventDefault(); flip(); }
    else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code) && $('#rate').style.visibility === 'visible') rate(+e.code.slice(-1) - 1);
  };
  document.onkeydown = b._key;
  show();
}
function tCards(b, ch, id) {
  const all = (ch.cards || []).map((c, i) => cardKey(id, i));
  const t = today();
  const due = all.filter(k => S.cards[k] && S.cards[k].due <= t), fresh = all.filter(k => !S.cards[k]);
  const learned = all.filter(k => S.cards[k] && S.cards[k].box >= 3).length;
  b.innerHTML = `<div class="card"><div class="row"><div class="sp"><b>Колода главы: ${all.length} карточек</b><br><span class="muted">новых ${fresh.length} · к повторению ${due.length} · выучено ${learned}</span></div>
    <button class="btn pri" id="c1" ${due.length + fresh.length ? '' : 'disabled'}>Учить новые и повторить (${due.length + fresh.length})</button><button class="btn" id="c2">Прогнать всю колоду</button>${TTS.ok ? '<button class="btn" id="c3">🎧 Слушать колоду</button>' : ''}</div></div>
    <div class="callout info"><b>Как работать с карточками</b>Сначала честно вспомни ответ, только потом переворачивай. «Снова», если не вспомнил главное. Пробел — перевернуть, 1–4 — оценка. Новые карточки этой главы попадут и в общее «Повторение».</div>
    <h3>Все карточки главы</h3><div class="content">${(ch.cards || []).map((c, i) => { const s = S.cards[cardKey(id, i)]; return `<details class="more"><summary>${c[0]} ${s ? `<span class="pill ${s.box >= 3 ? 'ok' : ''}">ур. ${s.box}</span>` : ''}</summary><div style="margin-top:8px">${c[1]}</div></details>`; }).join('')}</div>`;
  const run = keys => flashUI(b, keys, 'Карточки главы', `<a class="btn pri" href="#/c/${id}/quiz">Дальше: тест →</a> <a class="btn" href="#/c/${id}/cards">К колоде</a>`);
  $('#c1').onclick = () => run(shuffle(due).concat(fresh));
  $('#c2').onclick = () => run(shuffle(all));
  if ($('#c3')) $('#c3').onclick = () => TTS.readCards(b, all, 'Колода главы', `<a class="btn pri" href="#/c/${id}/cards" onclick="setTimeout(route, 0)">Учить с оценкой</a>`);
}

// --- тест
function quizUI(b, items, opts) {
  // items: [{q, o, a, e, code, src}] ; opts: {title, start{i,right,wrong}, onStep(i,right,wrong), onDone(score, wrongIdx)}
  const st0 = opts.start || {};
  let i = st0.i || 0, right = st0.right || 0, wrong = (st0.wrong || []).slice();
  const order = items.map(q => {
    const idx = shuffle(q.o.map((_, k) => k));
    return { q, idx };
  });
  function show() {
    if (i >= order.length) {
      const sc = pct(right, order.length);
      opts.onDone && opts.onDone(sc, wrong);
      b.innerHTML = `<div class="card" style="text-align:center"><div class="score" style="color:${sc >= 80 ? 'var(--ok)' : sc >= 60 ? 'var(--warn)' : 'var(--bad)'}">${sc}%</div>
        <p>${right} из ${order.length} верно. ${sc >= 80 ? 'Порог пройден.' : 'Порог 80% не пройден: перечитай разделы по ошибкам и попробуй снова.'}</p>
        <div class="row" style="justify-content:center">${opts.again || ''}${wrong.length ? '<button class="btn" id="qwrong">Повторить только ошибки (' + wrong.length + ')</button>' : ''}${opts.next || ''}</div></div>
        ${wrong.length ? '<h3>Разбор ошибок</h3>' + wrong.map(w => { const q = items[w]; const right = Array.isArray(q.a) ? q.a : [q.a]; return `<div class="card"><b>${q.q}</b>${q.code ? cliBlock(q.code) : ''}<p>Верно: ${right.map(k => esc(q.o[k])).join('; ')}</p><div class="expl">${q.e || ''}</div></div>`; }).join('') : ''}`;
      cliHighlight(b);
      const w = $('#qwrong'); if (w) w.onclick = () => quizUI(b, wrong.map(k => items[k]), { title: 'Работа над ошибками' });
      return;
    }
    const { q, idx } = order[i];
    const multi = Array.isArray(q.a);
    const sel = new Set();
    b.innerHTML = `<div class="card qcard"><div class="row"><span class="qn">${opts.title || 'Тест'} · вопрос ${i + 1} из ${order.length}${q.src ? ' · ' + q.src : ''}</span><span class="sp"></span><span class="qn">верно: ${right}</span></div>
      <div class="bar" style="margin:8px 0 14px"><i style="width:${pct(i, order.length)}%"></i></div>
      <div class="qt">${q.q}</div>${q.code ? cliBlock(q.code) : ''}${multi ? '<p class="muted" style="font-size:13px">Несколько верных ответов</p>' : ''}
      <div id="opts">${idx.map((k, n) => `<div class="opt" data-k="${k}"><span class="k">${'АБВГДЕЖ'[n]}</span><span>${esc(q.o[k])}</span></div>`).join('')}</div>
      <div id="qfoot" class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="qok" ${multi ? '' : 'style="display:none"'}>Проверить</button></div></div>`;
    cliHighlight(b);
    let locked = false;
    const check = () => {
      if (locked) return; locked = true;
      const ans = new Set(multi ? q.a : [q.a]);
      const ok = sel.size === ans.size && [...sel].every(k => ans.has(k));
      if (ok) right++; else wrong.push(items.indexOf(q));
      if (opts.onStep) opts.onStep(i + 1, right, wrong);   // ответ сохраняется сразу
      $$('.opt', b).forEach(o => { const k = +o.dataset.k; o.classList.add('lock'); if (ans.has(k)) o.classList.add('right'); else if (sel.has(k)) o.classList.add('wrong'); });
      $('#qfoot').innerHTML = `<div class="expl" style="flex:1"><b>${ok ? '✅ Верно.' : '❌ Неверно.'}</b> ${q.e || ''}</div>`;
      $('#qfoot').insertAdjacentHTML('afterend', `<div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="qnext">${i + 1 < order.length ? 'Следующий →' : 'Результат'}</button></div>`);
      $('#qnext').onclick = () => { i++; show(); };
      $('#qnext').focus();
    };
    $$('.opt', b).forEach(o => o.onclick = () => {
      if (locked) return;
      const k = +o.dataset.k;
      if (multi) { sel.has(k) ? sel.delete(k) : sel.add(k); o.classList.toggle('sel'); }
      else { sel.clear(); sel.add(k); check(); }
    });
    if (multi) $('#qok').onclick = check;
  }
  document.onkeydown = e => {
    if (!$('.qcard')) return;
    const n = '1234567'.indexOf(e.key);
    if (n >= 0) { const o = $$('.opt', b)[n]; if (o) o.click(); }
    if (e.key === 'Enter') { const nx = $('#qnext') || $('#qok'); if (nx && nx.offsetParent) { e.preventDefault(); nx.click(); } }
  };
  show();
}
function tQuiz(b, ch, id) {
  const st = C(id);
  const items = ch.quiz || [];
  const prev = st.quiz;
  // незаконченная попытка (сохраняется после каждого ответа)
  const saved = st.quizRun && Array.isArray(st.quizRun.ids) && st.quizRun.ids.length === items.length && st.quizRun.ids.every(k => items[k]) && st.quizRun.i < items.length ? st.quizRun : null;
  b.innerHTML = `<div class="card"><div class="row"><div class="sp"><b>Тест на понимание: ${items.length} вопросов</b><br><span class="muted">Порог главы — 80%. Вопросы и варианты перемешиваются. Клавиши 1–4 и Enter. Каждый ответ сохраняется сразу.</span>
    ${prev ? `<br><span class="muted">Лучший результат: <b>${prev.best}%</b> · попыток: ${prev.n} · последний: ${prev.lastScore}%</span>` : ''}</div>
    ${saved ? `<button class="btn pri" id="qc">▶ Продолжить тест (вопрос ${saved.i + 1} из ${items.length}, верно ${saved.right})</button><button class="btn" id="qs">Начать заново</button>` : '<button class="btn pri" id="qs">Начать тест</button>'}</div></div>
    <div class="callout info"><b>Как проходить</b>Не угадывай. Если не уверен, сначала сформулируй, почему вариант верный, и только потом выбирай. Пояснение после каждого ответа читай даже при верном ответе.</div>`;
  const start = fresh => {
    const ids = fresh ? shuffle(items.map((_, k) => k)) : saved.ids;
    const run = ids.map(k => items[k]);
    st.quizRun = fresh ? { ids, i: 0, right: 0, wrong: [] } : saved; save();
    quizUI(b, run, {
      title: 'Тест', again: `<a class="btn" href="#/c/${id}/quiz" onclick="setTimeout(()=>route(),0)">Пройти заново</a>`,
      next: `<a class="btn pri" href="#/c/${id}/und">Дальше: объясни своими словами →</a>`,
      start: fresh ? null : { i: saved.i, right: saved.right, wrong: saved.wrong },
      onStep: (i, right, wrong) => { st.quizRun = { ids, i, right, wrong: wrong.slice() }; save(); },
      onDone: (sc, wrong) => {
        const q = st.quiz || { best: 0, n: 0 };
        q.n++; q.best = Math.max(q.best, sc); q.lastScore = sc; q.last = today(); q.wrong = wrong.map(k => ch.quiz.indexOf(run[k]));
        st.quiz = q; delete st.quizRun; save();
      }
    });
  };
  $('#qs').onclick = () => start(true);
  if (saved) $('#qc').onclick = () => start(false);
}

// --- понимание
function tUnd(b, ch, id) {
  const st = C(id);
  const list = ch.und || [];
  b.innerHTML = `<div class="callout info"><b>Метод Фейнмана</b>Объясни так, будто рассказываешь новичку на смене. Пиши своими словами, без копирования. Потом открой эталон, сравни по ключевым пунктам и честно оцени себя. Твои ответы уходят в «Отчёт наставнику»: по ним я проверяю понимание и решаю, что разобрать ещё раз.</div>` +
    list.map((u, i) => { const s = st.und[i] || {}; return `<div class="card und" data-i="${i}"><div class="row"><span class="pill acc">${i + 1}</span><span class="q sp">${u.q}</span>${s.g ? `<span class="pill ${s.g === 'ok' ? 'ok' : s.g === 'part' ? 'warn' : ''}">${{ ok: 'понял', part: 'частично', no: 'не понял' }[s.g]}</span>` : ''}</div>
      <textarea placeholder="Твоё объяснение…" style="margin-top:10px">${esc(s.t || '')}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-show>Показать эталон</button><span class="muted" style="font-size:12.5px">${s.d ? 'сохранено ' + s.d : ''}</span></div>
      <div class="model content" style="display:none">${u.a}${u.k ? `<p><b>Проверь, есть ли у тебя:</b></p><ul>${u.k.map(k => `<li>${k}</li>`).join('')}</ul>` : ''}
      <div class="grade"><span>Оценка себя:</span><button class="btn sm ok" data-g="ok">Понял полностью</button><button class="btn sm" data-g="part">Частично</button><button class="btn sm bad" data-g="no">Не понял</button></div></div></div>`; }).join('') +
    `<div class="row"><span class="sp"></span><a class="btn pri" href="#/c/${id}/lab">Дальше: лаба →</a></div>`;
  $$('.und', b).forEach(card => {
    const i = +card.dataset.i, ta = $('textarea', card);
    ta.oninput = () => { const s = st.und[i] || (st.und[i] = {}); s.t = ta.value; s.d = today(); save(); };
    $('[data-show]', card).onclick = () => {
      if (ta.value.trim().length < 20 && !confirm('Ты почти ничего не написал. Открыть эталон без своей попытки? (Так запоминается хуже.)')) return;
      $('.model', card).style.display = 'block'; cliHighlight(card);
    };
    $$('[data-g]', card).forEach(bt => bt.onclick = () => { const s = st.und[i] || (st.und[i] = {}); s.g = bt.dataset.g; s.t = ta.value; s.d = today(); save(); toast('Оценка сохранена'); tUnd(b, ch, id); renderSide(); });
  });
}

// --- лаба
async function saveLabFile(name, content) {
  if (TAURI) {
    try { const p = await TAURI.invoke('save_lab', { name, content }); toast('Сохранено: ' + p); return; } catch (e) { toast('Ошибка сохранения: ' + e); }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/xml' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  toast('Файл скачан: ' + name);
}
function tLab(b, ch, id) {
  const L = ch.lab; const st = C(id);
  if (!L) { b.innerHTML = '<p>Лаба готовится.</p>'; return; }
  const m = COURSE.list.find(x => x.id === id);
  const fname = `SDSM-${m.num.replace('.', '_')}-${id}.unl`;
  const nodes = L.topo.nodes.filter(n => n.t !== 'cloud' && !n.virtual);
  const tplName = n => { const t = EVE.TPL[n.t] || EVE.TPL.router; return t.type === 'vpcs' ? 'VPCS' : t.template === 'viosl2' ? 'vIOS-L2' : t.template === 'csr1000vng' ? 'CSR1000v' : t.template === 'veos' ? 'Arista vEOS' : 'vIOS'; };
  b.innerHTML = `<div class="card"><h2 style="margin-top:0">${L.title}</h2><div class="content">${L.goal}</div>
    ${L.nounl ? `<div class="callout info" style="margin-bottom:0"><b>Файл .unl не нужен</b>${L.nounl}</div>` : ''}
    <div class="row" style="margin-top:10px">${L.nounl ? '' : '<button class="btn pri" id="unl">⬇ Скачать лабу для EVE-NG (.unl)</button>'}${L.init ? '<button class="btn" id="cfgall">Копировать все стартовые конфиги</button>' : ''}<a class="btn" href="#/guide">Как импортировать в EVE-NG</a><span class="pill">${nodes.length} узлов</span>${L.time ? `<span class="pill">${L.time}</span>` : ''}</div></div>
    <div class="topo">${EVE.svg(L.topo)}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><b>Узлы</b><table class="cmdtbl nodes"><tr><th>Узел</th><th>Образ</th><th>Роль</th></tr>${nodes.map(n => `<tr><td><b>${esc(n.id)}</b></td><td>${tplName(n)}</td><td>${esc(n.role || '')}</td></tr>`).join('')}</table></div>
      ${L.addr ? `<div class="card"><b>Адресация</b><table class="cmdtbl nodes"><tr><th>Узел</th><th>Интерфейс</th><th>Адрес</th></tr>${L.addr.map(a => `<tr><td>${esc(a[0])}</td><td style="font-family:var(--mono);font-size:12.5px">${esc(a[1])}</td><td style="font-family:var(--mono);font-size:12.5px">${esc(a[2])}</td></tr>`).join('')}</table></div>` : ''}
    </div>
    ${L.init ? `<details class="more"><summary>Стартовые конфиги (уже вшиты в .unl — применятся при первом запуске)</summary>${Object.entries(L.init).map(([k, v]) => `<h4>${esc(k)}</h4>${cliBlock(v)}`).join('')}</details>` : ''}
    ${L.pre ? `<div class="callout info"><b>Перед началом</b>${L.pre}</div>` : ''}
    <h2>Задания</h2><div id="tasks"></div>
    ${L.brk && L.brk.length ? `<h2>Сломай и почини</h2><p class="sub">Внеси поломку командой из блока (или попроси кого-то), потом найди её только по выводам show/debug. Это ровно то, что ты делаешь на смене.</p><div id="brk"></div>` : ''}
    ${L.extra ? `<h2>Со звёздочкой</h2><div class="content card">${L.extra}</div>` : ''}`;
  const tk = $('#tasks', b);
  tk.innerHTML = L.tasks.map((t, i) => `<div class="task ${st.lab.t[i] ? 'done' : ''}" data-i="${i}"><div class="th"><input type="checkbox" ${st.lab.t[i] ? 'checked' : ''}><div class="tt"><b>${i + 1}. ${t.t}</b><div class="content">${t.d || ''}</div>
    <div class="tools">${t.hint ? '<button class="btn sm" data-x="hint">💡 Подсказка</button>' : ''}${t.check ? '<button class="btn sm" data-x="check">🔍 Как проверить</button>' : ''}${t.sol ? '<button class="btn sm" data-x="sol">🔑 Решение</button>' : ''}</div>
    ${t.hint ? `<div class="rev content" data-r="hint" hidden><div class="callout info"><b>Подсказка</b>${t.hint}</div></div>` : ''}
    ${t.check ? `<div class="rev" data-r="check" hidden><b>Проверка:</b>${cliBlock(t.check)}</div>` : ''}
    ${t.sol ? `<div class="rev" data-r="sol" hidden><b>Решение:</b>${cliBlock(t.sol)}</div>` : ''}</div></div></div>`).join('');
  $$('.task', tk).forEach(el => {
    const i = +el.dataset.i;
    $('input', el).onchange = e => { st.lab.t[i] = e.target.checked; save(); el.classList.toggle('done', e.target.checked); renderSide(); };
    $$('[data-x]', el).forEach(bt => bt.onclick = () => {
      const r = $(`[data-r="${bt.dataset.x}"]`, el);
      if (bt.dataset.x === 'sol' && r.hidden && !confirm('Открыть готовое решение? Сначала попробуй сам минимум 10 минут, иначе навык не появится.')) return;
      r.hidden = !r.hidden;
    });
  });
  if (L.brk && L.brk.length) {
    const bk = $('#brk', b);
    bk.innerHTML = L.brk.map((t, i) => `<div class="task ${st.lab.b[i] ? 'done' : ''}" data-i="${i}"><div class="th"><input type="checkbox" ${st.lab.b[i] ? 'checked' : ''}><div class="tt"><b>🧨 ${t.t}</b>
      <div class="tools">${t.inj ? '<button class="btn sm" data-x="inj">Поломка</button>' : ''}<button class="btn sm" data-x="h">💡 Где искать</button><button class="btn sm" data-x="f">🔑 Причина и решение</button></div>
      ${t.inj ? `<div class="rev" data-r="inj" hidden>${cliBlock(t.inj)}</div>` : ''}
      <div class="rev content" data-r="h" hidden><div class="callout info"><b>Где искать</b>${t.h}</div></div>
      <div class="rev content" data-r="f" hidden><div class="callout ok"><b>Разбор</b>${t.f}</div></div></div></div></div>`).join('');
    $$('.task', bk).forEach(el => {
      const i = +el.dataset.i;
      $('input', el).onchange = e => { st.lab.b[i] = e.target.checked; save(); el.classList.toggle('done', e.target.checked); };
      $$('[data-x]', el).forEach(bt => bt.onclick = () => { const r = $(`[data-r="${bt.dataset.x}"]`, el); r.hidden = !r.hidden; cliHighlight(el); });
    });
  }
  if ($('#unl')) $('#unl').onclick = () => saveLabFile(fname, EVE.unl(L, fname.replace('.unl', ''), S.settings.imgs));
  if ($('#cfgall')) $('#cfgall').onclick = () => copyText(Object.entries(L.init || {}).map(([k, v]) => `!===== ${k} =====\n${v}`).join('\n\n'));
}

// ---------- общее повторение ----------
function viewReview(v) {
  const keys = dueCards();
  v.innerHTML = `<h1>Повторение</h1><p class="sub">Карточки всех начатых глав, у которых подошёл срок, и до ${S.settings.newPerDay} новых в день. Новые карточки главы появляются, когда ты прочитал в ней хотя бы один раздел.</p><div id="rv"></div>`;
  const b = $('#rv');
  if (!keys.length) { b.innerHTML = `<div class="card" style="text-align:center"><div style="font-size:40px">✨</div><p>На сегодня всё повторено. Следующие карточки вернутся по расписанию.</p></div>`; return; }
  b.innerHTML = `<div class="card"><div class="row"><b class="sp">К повторению: ${keys.length}</b>${TTS.ok ? '<button class="btn" id="ls">🎧 Сначала послушать</button>' : ''}<button class="btn pri" id="go">Начать</button></div></div>`;
  $('#go').onclick = () => flashUI(b, shuffle(keys), 'Повторение', '<a class="btn pri" href="#/">На главную</a>');
  if ($('#ls')) $('#ls').onclick = () => TTS.readCards(b, shuffle(keys), 'Повторение', '<a class="btn pri" href="#/review" onclick="setTimeout(route, 0)">Повторить с оценкой</a>');
}

// ---------- экзамен ----------
function viewExam(v) {
  const chs = COURSE.list.filter(m => COURSE.ch[m.id] && (COURSE.ch[m.id].quiz || []).length);
  v.innerHTML = `<h1>Экзамен</h1><p class="sub">Смешанные вопросы из выбранных глав. Так проверяется, держатся ли старые темы, и тренируется переключение между ними, как на собеседовании и на смене.</p>
    <div class="card"><b>Главы</b><div class="grid g3" style="margin-top:10px">${chs.map(m => { const r = chapterStats(m.id); return `<label class="row" style="gap:8px"><input type="checkbox" value="${m.id}" ${r.started ? 'checked' : ''}> ${m.num}. ${m.title}</label>`; }).join('')}</div>
    <div class="row" style="margin-top:14px"><span>Вопросов:</span><select id="exn" style="width:auto"><option>15</option><option selected>30</option><option>50</option></select><span class="sp"></span><button class="btn pri" id="exgo">Начать экзамен</button></div></div>
    ${S.exams.length ? `<div class="card"><b>История</b><table class="cmdtbl">${S.exams.slice(-10).reverse().map(e => `<tr><td>${e.d}</td><td>${e.n} вопросов</td><td><b>${e.s}%</b></td><td class="muted">${e.ch.join(', ')}</td></tr>`).join('')}</table></div>` : ''}<div id="exb"></div>`;
  $('#exgo').onclick = () => {
    const sel = $$('input[type=checkbox]:checked', v).map(x => x.value);
    if (!sel.length) return toast('Выбери хотя бы одну главу');
    let pool = []; sel.forEach(id => COURSE.ch[id].quiz.forEach(q => pool.push(Object.assign({ src: 'гл. ' + COURSE.list.find(m => m.id === id).num }, q))));
    pool = shuffle(pool).slice(0, +$('#exn').value);
    const b = $('#exb'); v.innerHTML = ''; v.appendChild(b);
    quizUI(b, pool, { title: 'Экзамен', again: '<a class="btn" href="#/exam" onclick="setTimeout(()=>route(),0)">Новый экзамен</a>', onDone: sc => { S.exams.push({ id: newId(), d: today(), n: pool.length, s: sc, ch: sel.map(id => COURSE.list.find(m => m.id === id).num) }); save(); } });
  };
}

// ---------- отчёт ----------
function buildReport() {
  const t = today();
  let r = `ОТЧЁТ ДЛЯ НАСТАВНИКА (курс СДСМ) — ${t}\n\n`;
  let wk = 0; const days = []; for (let i = 6; i >= 0; i--) { const d = addDays(t, -i); const m = dayMin(d); wk += m; days.push(`${d.slice(5)}: ${m}`); }
  r += `Время за 7 дней: ${Math.round(wk)} мин (${days.join(', ')})\n`;
  r += `Карточки: в работе ${Object.keys(S.cards).length}, выучено (ур. 3+) ${Object.values(S.cards).filter(c => c.box >= 3).length}, к повторению сегодня ${dueCards().length}\n`;
  if (S.exams.length) r += `Экзамены (последние): ${S.exams.slice(-5).map(e => `${e.d} ${e.s}% (${e.n} вопр.)`).join('; ')}\n`;
  r += '\n';
  COURSE.list.forEach(m => {
    const ch = COURSE.ch[m.id]; if (!ch) return;
    const s = chapterStats(m.id); if (!s.started) return;
    const st = C(m.id);
    r += `=== Глава ${m.num}. ${m.title} — ${s.p}%${s.done ? ' (освоена)' : ''}\n`;
    r += `Теория ${s.th[0]}/${s.th[1]}; тест: ${s.quiz == null ? 'не пройден' : `лучший ${s.quiz}%, попыток ${st.quiz.n}, последний ${st.quiz.lastScore}%`}; лаба ${s.lab[0]}/${s.lab[1]}, поломки ${Object.values(st.lab.b).filter(Boolean).length}/${((ch.lab && ch.lab.brk) || []).length}; карточки ${s.cards[0]}/${s.cards[1]}\n`;
    if (st.quiz && st.quiz.wrong && st.quiz.wrong.length) r += `Ошибки в последнем тесте:\n${st.quiz.wrong.map(k => ch.quiz[k] ? '  - ' + ch.quiz[k].q.replace(/<[^>]+>/g, '') : '').filter(Boolean).join('\n')}\n`;
    if (s.sim && s.sim[0]) {
      const sm = simOf(m.id), ss = simSt(m.id);
      r += `Дежурство: решено ${s.sim[0]} из ${s.sim[1]}\n${sm.cases.filter(k => ss[k.id] && ss[k.id].ok).map(k => { const x = ss[k.id]; return `  - ${k.t}: команд ${x.n} (эталон ${(k.best || []).length}), ошибок в ответах ${x.w}${x.h ? ', подсказок ' + x.h : ''}`; }).join('\n')}\n`;
    }
    const hard = (ch.cards || []).map((c, i) => [c, S.cards[m.id + ':' + i]]).filter(([c, x]) => x && x.lapse >= 2);
    if (hard.length) r += `Трудные карточки (забывал 2+ раза):\n${hard.map(([c, x]) => `  - ${c[0].replace(/<[^>]+>/g, '')} (забывал ${x.lapse})`).join('\n')}\n`;
    const und = (ch.und || []).map((u, i) => [u, st.und[i]]).filter(([u, x]) => x && x.t && x.t.trim());
    if (und.length) r += `Объяснения своими словами:\n${und.map(([u, x]) => `  [${{ ok: 'понял', part: 'частично', no: 'не понял' }[x.g] || 'без оценки'}] ${u.q.replace(/<[^>]+>/g, '')}\n  Ответ: ${x.t.trim().replace(/\n/g, '\n  ')}`).join('\n\n')}\n`;
    r += '\n';
  });
  if (S.unclear.length) r += `НЕПОНЯТНО (записано при чтении):\n${S.unclear.map(u => `  - [${u.d}] гл. ${(COURSE.list.find(m => m.id === u.ch) || {}).num}, «${u.sec}»: ${u.t}`).join('\n')}\n`;
  r += `\nПросьба к наставнику: проверь объяснения (что неточно или неверно), разбери пункты «Непонятно» и ошибки теста, дай 3 вопроса на закрепление.\n`;
  return r;
}
function viewReport(v) {
  const r = buildReport();
  v.innerHTML = `<h1>Отчёт наставнику</h1><p class="sub">Скопируй и вставь в чат с Claude. По нему я проверю понимание: объяснения своими словами, ошибки, непонятные места. Отчёт обновляется сам.</p>
    <div class="row"><button class="btn pri" id="cp">📋 Скопировать отчёт</button>${S.unclear.length ? '<button class="btn" id="clr">Очистить «Непонятно» (после разбора)</button>' : ''}</div><pre style="white-space:pre-wrap">${esc(r)}</pre>`;
  $('#cp').onclick = () => copyText(r);
  const c = $('#clr'); if (c) c.onclick = () => { if (confirm('Удалить список «Непонятно»? Делай это только после разбора с наставником.')) { S.unclear = []; save(); route(); } };
}

// ---------- поиск ----------
function viewSearch(v, q) {
  v.innerHTML = `<h1>Поиск</h1><input type="search" id="sq" placeholder="Например: LSA, route-target, native vlan, MED…" value="${esc(q)}" autofocus><div class="search-res" id="sr"></div>`;
  const run = q => {
    q = q.trim().toLowerCase(); const out = [];
    if (q.length < 2) { $('#sr').innerHTML = ''; return; }
    const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const snip = (txt, q) => { const i = txt.toLowerCase().indexOf(q); if (i < 0) return ''; const a = Math.max(0, i - 80); return (a ? '…' : '') + esc(txt.slice(a, i)) + '<mark>' + esc(txt.slice(i, i + q.length)) + '</mark>' + esc(txt.slice(i + q.length, i + q.length + 120)) + '…'; };
    COURSE.list.forEach(m => {
      const ch = COURSE.ch[m.id]; if (!ch) return;
      const bk = bookOf(m.id);
      if (bk) bk.parts.forEach((s, i) => { const t = strip(s.h + ' ' + s.html.replace(/<svg[\s\S]*?<\/svg>/g, ' ')); if (t.toLowerCase().includes(q)) out.push(`<div class="r"><a href="#/c/${m.id}/book/${i}">Гл. ${m.num} · Книга · ${s.h}</a><div class="muted">${snip(t, q)}</div></div>`); });
      (ch.theory || []).forEach(s => { const t = strip(s.h + ' ' + s.html); if (t.toLowerCase().includes(q)) out.push(`<div class="r"><a href="#/c/${m.id}/theory/${s.id}">Гл. ${m.num} · Теория · ${s.h}</a><div class="muted">${snip(t, q)}</div></div>`); });
      (ch.cards || []).forEach(c => { const t = strip(c[0] + ' — ' + c[1]); if (t.toLowerCase().includes(q)) out.push(`<div class="r"><a href="#/c/${m.id}/cards">Гл. ${m.num} · Карточка</a><div class="muted">${snip(t, q)}</div></div>`); });
      (ch.cmds || []).forEach(c => { if (c.g) return; const t = strip(c.c + ' — ' + c.d + ' ' + (c.hw || '') + ' ' + (c.jn || '')); if (t.toLowerCase().includes(q)) out.push(`<div class="r"><a href="#/c/${m.id}/cmds">Гл. ${m.num} · Команда</a><div class="muted">${snip(t, q)}</div></div>`); });
    });
    $('#sr').innerHTML = out.length ? `<p class="muted">Найдено: ${out.length}</p>` + out.slice(0, 120).join('') : '<p class="muted">Ничего не найдено</p>';
  };
  $('#sq').oninput = e => run(e.target.value);
  run(q); $('#sq').focus();
}

// ---------- настройки ----------
function viewSettings(v, part) {
  const im = S.settings.imgs, cloud = SY && SY.user();
  v.innerHTML = `<h1>Настройки</h1>
  ${SY && SY.on() ? `<div class="card" id="syncwrap"><b>Синхронизация</b><div id="synccard" style="margin-top:6px">${syncCard()}</div></div>
  <div class="card"><b>Перенос из программы СДСМ</b><p class="muted" style="font-size:13.5px">Один раз, чтобы прогресс с компьютера попал сюда. В программе СДСМ: Настройки → «📋 Копировать как текст». Здесь вставь текст и нажми «Объединить». Объединение ничего не удаляет: что уже есть здесь, останется.</p>
    <textarea id="mergt" placeholder="Вставь сюда текст из программы" style="min-height:70px"></textarea><div class="row" style="margin-top:8px"><button class="btn pri" id="merge">Объединить</button></div></div>` : ''}
  <div class="card"><b>Тема</b><div class="row" style="margin-top:8px"><button class="btn ${S.settings.theme === 'dark' ? 'pri' : ''}" data-th="dark">🌙 Тёмная</button><button class="btn ${S.settings.theme === 'light' ? 'pri' : ''}" data-th="light">☀️ Светлая</button></div></div>
  ${TTS.ok ? `<div class="card"><b>Озвучка</b><p class="muted" style="font-size:13.5px">Голос браузера читает книгу, конспект и карточки. Лучшие русские голоса — в Edge: «Svetlana Online (Natural)» и «Dmitry Online (Natural)», им нужен интернет. Настройка хранится только на этом устройстве.</p>
    <div class="row"><label>Голос <select id="ttsv" style="width:auto;max-width:100%"></select></label></div>
    <div class="row" style="margin-top:8px"><label>Скорость <select id="ttsr" style="width:auto">${[0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.7, 2].map(r => `<option value="${r}" ${r === TTS.cfg.rate ? 'selected' : ''}>${String(r).replace('.', ',')}×</option>`).join('')}</select></label>
      <label>Пауза на ответ <select id="ttst" style="width:auto">${[2, 4, 6, 8, 10].map(n => `<option value="${n}" ${n === TTS.cfg.think ? 'selected' : ''}>${n} с</option>`).join('')}</select></label><button class="btn" id="ttsp">▶ Проверить голос</button></div>
    <p class="muted" id="ttsn" style="font-size:13px;margin-bottom:0"></p></div>` : ''}
  <div class="card"><b>Образы EVE-NG</b><p class="muted" style="font-size:13.5px">Имена папок в <code>/opt/unetlab/addons/qemu/</code> на твоём EVE-NG. Подставляются в скачиваемые .unl. По умолчанию — образы из папки EVE-FULL.</p>
    <label>vIOS (маршрутизатор)<input type="text" id="i-vios" value="${esc(im.vios)}"></label><br><br>
    <label>vIOS-L2 (коммутатор)<input type="text" id="i-viosl2" value="${esc(im.viosl2)}"></label><br><br>
    <label>CSR1000v (IOS-XE, для MPLS/EVPN/TE)<input type="text" id="i-csr" value="${esc(im.csr)}"></label><br><br>
    <label>Arista vEOS (EVPN-VXLAN)<input type="text" id="i-veos" value="${esc(im.veos)}"></label>
    <div class="row" style="margin-top:10px"><button class="btn pri" id="saveimg">Сохранить</button><button class="btn" id="defimg">По умолчанию</button></div></div>
  <div class="card"><b>Новых карточек в день</b><div class="row" style="margin-top:8px"><select id="npd" style="width:auto">${[10, 15, 20, 30, 50].map(n => `<option ${n === S.settings.newPerDay ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
  <div class="card"><b>Резервная копия</b><p class="muted" style="font-size:13.5px">Весь прогресс: прочитанное, тесты, карточки, ответы, время. ${TAURI ? 'Программа сама хранит его в файле data.json, но копия не помешает.' : ''}</p>
    <div class="row"><button class="btn" id="exp">⬇ Сохранить копию в файл</button><button class="btn" id="expc">📋 Копировать как текст</button><button class="btn" id="imp">⬆ Восстановить из текста</button></div>
    <textarea id="impt" placeholder="Вставь сюда текст резервной копии и нажми «Восстановить»" style="display:none;margin-top:10px"></textarea></div>
  ${TAURI ? `<div class="card"><b>Автокопии</b><p class="muted" style="font-size:13.5px">Программа сама раз в час сохраняет копию прогресса (хранятся последние 72). Если что-то пропало, выбери копию по времени и восстанови.</p>
    <div class="row"><select id="bk" style="width:auto"><option>загрузка…</option></select><button class="btn" id="bkr">Восстановить эту копию</button><button class="btn" id="bko">📂 Открыть папку с прогрессом</button></div></div>` : ''}
  <div class="card"><b>Сброс</b><p class="muted" style="font-size:13.5px">Стирает весь прогресс без возврата${cloud ? ', в том числе в облаке и на всех устройствах' : ''}.</p><button class="btn bad" id="rst">Сбросить всё</button></div>`;
  if ($('#merge')) $('#merge').onclick = () => {
    let d; try { d = JSON.parse($('#mergt').value); if (!d || !d.ch) throw 0; } catch (e) { return toast('Не похоже на текст из программы'); }
    mergeFrom(d); toast('Прогресс программы перенесён'); route();
  };
  if (part === 'sync' && $('#syncwrap')) $('#syncwrap').scrollIntoView();
  $$('[data-th]', v).forEach(b => b.onclick = () => { S.settings.theme = b.dataset.th; applyTheme(); save(); route(); });
  if ($('#ttsv')) {
    // голоса подгружаются не сразу: список заполняется и при событии voiceschanged
    const fill = () => {
      const all = TTS.voices(), ru = TTS.ruVoices(), cur = TTS.voice();
      const list = ru.concat(all.filter(x => !ru.includes(x)));
      $('#ttsv').innerHTML = list.length ? list.map(x => `<option value="${esc(x.name)}" ${cur && x.name === cur.name ? 'selected' : ''}>${esc(x.name)}${/^ru/i.test(x.lang) ? '' : ' (' + esc(x.lang) + ')'}</option>`).join('') : '<option value="">голоса загружаются…</option>';
      $('#ttsn').textContent = ru.length ? `Русских голосов: ${ru.length}${ru.some(x => /natural/i.test(x.name)) ? '' : '. Нейронных (Natural) нет — они есть в Edge.'}` : 'Русского голоса в этом браузере нет. Открой курс в Edge.';
    };
    fill(); speechSynthesis.addEventListener('voiceschanged', fill, { once: true });
    $('#ttsv').onchange = e => { TTS.cfg.voice = e.target.value; TTS.saveCfg(); TTS.test(TTS.voice()); };
    $('#ttsr').onchange = e => { TTS.cfg.rate = +e.target.value; TTS.saveCfg(); };
    $('#ttst').onchange = e => { TTS.cfg.think = +e.target.value; TTS.saveCfg(); };
    $('#ttsp').onclick = () => TTS.test(TTS.voice());
  }
  $('#saveimg').onclick = () => { ['vios', 'viosl2', 'csr', 'veos'].forEach(k => S.settings.imgs[k] = $('#i-' + k).value.trim()); save(); toast('Сохранено'); };
  $('#defimg').onclick = () => { S.settings.imgs = { ...DEF_IMGS }; save(); route(); };
  $('#npd').onchange = e => { S.settings.newPerDay = +e.target.value; save(); };
  $('#exp').onclick = () => saveLabFile(`sdsm-backup-${today()}.json`, JSON.stringify(S));
  $('#expc').onclick = () => copyText(JSON.stringify(S));
  $('#imp').onclick = () => {
    const ta = $('#impt'); if (ta.style.display === 'none') { ta.style.display = 'block'; return; }
    let d; try { d = JSON.parse(ta.value); if (!d || !d.ch) throw 0; } catch (e) { return toast('Не похоже на резервную копию'); }
    if (cloud && !confirm('Восстановление заменит прогресс целиком, в том числе в облаке и на других устройствах. Если нужно добавить прогресс из программы, используй «Перенос из программы СДСМ». Заменить?')) return;
    S = migrate(d); save(); applyTheme(); toast('Восстановлено'); route();
  };
  $('#rst').onclick = () => { if (confirm('Точно стереть весь прогресс?') && confirm('Последнее предупреждение: восстановить можно будет только из автокопии.')) { S = blank(); save(); route(); } };
  if (TAURI) {
    const nice = n => { const m = /data-(\d{4})-(\d\d)-(\d\d)_(\d\d)(?:-(\d\d))?/.exec(n); return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5] || '00'}${/before-restore/.test(n) ? ' (до восстановления)' : ''}` : n; };
    TAURI.invoke('list_backups').then(list => {
      $('#bk').innerHTML = list.length ? list.map(n => `<option value="${esc(n)}">${nice(n)}</option>`).join('') : '<option value="">копий пока нет</option>';
    }).catch(() => { $('#bk').innerHTML = '<option value="">не удалось прочитать</option>'; });
    $('#bkr').onclick = async () => {
      const n = $('#bk').value; if (!n) return;
      try {
        const d = JSON.parse(await TAURI.invoke('load_backup', { name: n }));
        if (!confirm(`Восстановить прогресс на ${nice(n)}? Текущее состояние сохранится отдельной копией «до восстановления».`)) return;
        const t = new Date();
        await TAURI.invoke('save_state', { data: JSON.stringify(S), stamp: stamp() + '-' + String(t.getMinutes()).padStart(2, '0') + String(t.getSeconds()).padStart(2, '0') + '-before-restore' });
        S = migrate(d); loaded = true; save(); flush(); applyTheme(); toast('Прогресс восстановлен'); route();
      } catch (e) { toast('Не получилось: ' + e); }
    };
    $('#bko').onclick = () => TAURI.invoke('open_data_dir').catch(() => { });
  }
}
function applyTheme() { document.documentElement.dataset.theme = S.settings.theme; }

// ---------- как учиться + EVE-NG ----------
function viewGuide(v) {
  v.innerHTML = window.GUIDE_HTML ? GUIDE_HTML : '<p>Загрузка…</p>';
  cliHighlight(v);
}

// ---------- старт ----------
(async function init() {
  const local = loadLocal();
  let file = null, fileOK = !TAURI;
  // файл читаем с повторами: при старте IPC иногда отвечает не сразу
  for (let i = 0; i < 10 && !fileOK; i++) {
    try { const f = await TAURI.invoke('load_state'); file = f ? JSON.parse(f) : null; fileOK = true; }
    catch (e) { console.error('load_state', e); await new Promise(r => setTimeout(r, 400)); }
  }
  let s = local;
  if (file && (!s || (file.ts || 0) >= (s.ts || 0))) s = file;
  const other = s === file ? local : file;
  if (progressScore(s) <= 0 && progressScore(other) > 0) s = other;   // пустое никогда не побеждает
  S = migrate(s);
  applyTheme();
  loaded = fileOK;
  if (!fileOK) {
    document.body.insertAdjacentHTML('afterbegin', `<div style="position:fixed;top:0;left:0;right:0;z-index:100;background:#b91c1c;color:#fff;padding:10px 16px;font-weight:600;text-align:center">⚠️ Не удалось прочитать файл прогресса. Чтобы ничего не потерять, сейчас изменения НЕ сохраняются. Закрой программу и открой её снова.</div>`);
  }
  importPhone();
  route();
  if (loaded && file && local && progressScore(local) > progressScore(file) && (local.ts || 0) > (file.ts || 0)) flush(); // догнать файл до локальной копии
  if (SY && SY.on()) Cloud.ready.then(() => SY.sync(), e => toast('Вход не удался: ' + e.message));
  // офлайн-работа: тот же service worker, что у приложения английского
  if (HOSTED && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => { });
})();
