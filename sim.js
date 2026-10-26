// Тренажёр дежурного: аварии в сети главы, которые разбираются командами show без EVE-NG.
// Данные — sim/<глава>.js (SIM.chNN = {intro, topo, links, addr, build(опции) → устройства, cases[]}).
// Результат случая: C(глава).sim[id] = {ok, n (команд), w (ошибок в ответах), h (подсказок), d}; в облаке строка s:<глава>:<id>.
'use strict';
function simOf(id) { return window.SIM && SIM[id] && SIM[id].cases && SIM[id].cases.length ? SIM[id] : null; }
function simSt(id) { const c = C(id); return c.sim || (c.sim = {}); }
function simStats(id) { const s = simOf(id); if (!s) return null; const st = simSt(id); return [s.cases.filter(k => st[k.id] && st[k.id].ok).length, s.cases.length]; }

// ---------- разбор команд ----------
const SIM_IF = /^(g|gi|gig|giga|gigabit|gigabitethernet)(\d+\/\d+)$/, SIM_LO = /^(l|lo|loop|loopback)(\d+)$/;
const SIM_IP = /^\d{1,3}(\.\d{1,3}){3}$/;
function simTok(s) {
  const t = String(s).toLowerCase().trim().split(/\s+/).filter(Boolean), out = [];
  for (let i = 0; i < t.length; i++) {
    let x = t[i];
    if (/^(g|gi|gig|giga|gigabit|gigabitethernet|l|lo|loop|loopback)$/.test(x) && /^\d+(\/\d+)?$/.test(t[i + 1] || '')) x += t[++i];
    let m = SIM_IF.exec(x); if (m) x = 'gi' + m[2];
    m = SIM_LO.exec(x); if (m) x = 'lo' + m[2];
    out.push(x);
  }
  return out;
}
// typed — введённое, keys — команды устройства. → {key} | {err:'incomplete'|'ambiguous'|'unknown'}
function simMatch(typed, keys) {
  const T = simTok(typed); if (!T.length) return { err: 'empty' };
  const exact = (a, b) => /^(gi|lo)\d/.test(b) || SIM_IP.test(b) || b === '|' ? a === b : b.startsWith(a);
  const hit = [], longer = [];
  keys.forEach(k => {
    const K = simTok(k);
    if (K.length < T.length) return;
    if (!T.every((t, i) => exact(t, K[i]))) return;
    (K.length === T.length ? hit : longer).push(k);
  });
  if (hit.length === 1) return { key: hit[0] };
  if (hit.length > 1) { const ex = hit.find(k => simTok(k).join(' ') === T.join(' ')); return ex ? { key: ex } : { err: 'ambiguous' }; }
  return { err: longer.length ? 'incomplete' : 'unknown' };
}

// ---------- список вызовов ----------
function tSim(b, ch, id, anchor) {
  const S6 = simOf(id);
  if (!S6) { b.innerHTML = '<p>Для этой главы вызовов пока нет.</p>'; return; }
  const c = anchor && S6.cases.find(k => k.id === anchor);
  if (c) return simRun(b, id, S6, c);
  const st = simSt(id), [done, all] = simStats(id);
  b.innerHTML = `<div class="callout pro"><b>Ты на смене</b>Приходит заявка или тревога. Заходишь на маршрутизаторы, смотришь выводы show, ставишь диагноз и выбираешь, как починить. Команды можно сокращать, как на настоящем Cisco: <code>sh ip os nei</code>, <code>sh ip int br</code>. Знак <code>?</code> — список команд на устройстве. После каждого вызова — разбор: каким путём шёл бы опытный дежурный.</div>
    <div class="content">${S6.intro || ''}</div>
    <p class="sub">Решено ${done} из ${all}. Порядок любой, но лучше от простых к сложным.</p>
    <div class="grid g2 simlist">${S6.cases.map((k, i) => { const r = st[k.id];
      return `<a class="chapcard" href="#/c/${id}/sim/${k.id}"><div class="n">ВЫЗОВ ${i + 1} · ${'●'.repeat(k.lvl)}${'○'.repeat(3 - k.lvl)} ${r && r.ok ? '· <span style="color:var(--ok)">РЕШЁН</span>' : ''}</div><div class="t">${k.t}</div>
        <div class="muted" style="font-size:13px">${r && r.ok ? `команд ${r.n} · ошибок в ответах ${r.w}${r.h ? ' · подсказок ' + r.h : ''}` : 'не решён'}</div></a>`; }).join('')}</div>`;
}

// ---------- один вызов ----------
function simRun(b, id, S6, c) {
  const base = c.net || {};
  const devsOf = (net, extra) => { const D = S6.build(net); if (extra) for (const r in extra) Object.assign(D[r].cmds, extra[r]); return D; };
  const R = { dev: devsOf(base, c.extra), cur: c.start || Object.keys(S6.build({}))[0], log: [], cmds: [], w: 0, h: 0, stage: 'look', fixed: false, hist: [], hp: 0 };
  const names = Object.keys(R.dev);
  const lvl = '●'.repeat(c.lvl) + '○'.repeat(3 - c.lvl);
  let chips = false; try { chips = localStorage.getItem('sdsm_simchips') === '1'; } catch (e) { }
  b.innerHTML = `<div class="sim-live">
    <div class="row"><a href="#/c/${id}/sim">‹ Все вызовы</a><span class="sp"></span><span class="pill">${lvl}</span></div>
    <h2 style="margin:8px 0 6px">${c.t}</h2>
    <div class="callout warn"><b>Заявка</b>${c.ticket}</div>
    <details class="more simmap"><summary>Схема сети и адреса</summary><figure class="dg">${S6.topo || ''}<figcaption>${S6.links || ''}<br>${S6.addr || ''}</figcaption></figure></details>
    <div class="term">
      <div class="tdev">${names.map(n => `<button data-dev="${n}">${n}<small>${esc(R.dev[n].city || '')}</small></button>`).join('')}</div>
      <div class="tout" aria-live="polite"></div>
      <form class="tin"><span class="tp"></span><input autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="команда, например sh ip os nei · ? — список"><button class="btn sm" type="submit">⏎</button></form>
      <div class="tchips" ${chips ? '' : 'hidden'}></div>
    </div>
    <div class="row"><button class="btn sm" data-s="chips">${chips ? 'Скрыть список команд' : 'Показать список команд'}</button><button class="btn sm" data-s="hint">💡 С чего начать?</button><span class="muted sc" style="font-size:13px"></span><span class="sp"></span><button class="btn pri" data-s="diag">Поставить диагноз →</button></div>
    <div class="simhint"></div>
    <div class="simq"></div></div>`;
  const out = $('.tout', b), inp = $('.tin input', b), tp = $('.tp', b), chipBox = $('.tchips', b), q = $('.simq', b);
  $('#main').scrollTop = 0;

  const print = (html) => { out.insertAdjacentHTML('beforeend', html); out.scrollTop = out.scrollHeight; };
  const prompt = d => `<span class="pr">${d}#</span>`;
  function setDev(d) {
    R.cur = d; tp.textContent = d + '#';
    $$('.tdev button', b).forEach(x => x.classList.toggle('on', x.dataset.dev === d));
    renderChips();
  }
  function score() { $('.sc', b).textContent = `команд: ${R.cmds.length}${R.w ? ' · ошибок в ответах: ' + R.w : ''}`; }
  function keys() { return Object.keys(R.dev[R.cur].cmds); }
  function renderChips() {
    const k = keys(), isis = k.includes('show isis neighbors');
    const pick = (isis ? ['show isis neighbors', 'show isis database', 'show isis database detail', 'show ip route isis', 'show running-config | section router isis']
      : ['show ip ospf neighbor', 'show ip ospf interface brief', 'show ip ospf interface Gi0/', 'show ip route ospf', 'show ip ospf', 'show ip ospf database', 'show running-config | section router ospf', 'debug ip ospf adj', 'debug ip ospf hello'])
      .concat(['show ip interface brief', 'show interfaces Gi0/', 'show ip interface Gi0/', 'show running-config interface Gi0/', 'show logging', 'show bfd neighbors', 'show access-lists', 'ping 10.255.0.', 'traceroute 10.255.0.']);
    chipBox.innerHTML = pick.map(x => `<button type="button" data-c="${esc(x)}">${esc(x)}${/[\/.]$/.test(x) ? '…' : ''}</button>`).join('');
  }
  function run(line) {
    const raw = line.trim();
    if (raw) { R.hist.push(raw); R.hp = R.hist.length; }
    const head = prompt(R.cur) + esc(raw) + '\n';
    if (!raw) return print(head);
    const low = raw.toLowerCase().replace(/\s+/g, ' ');
    const T = simTok(raw);
    // переход на другое устройство: «R4», «ssh r4», «telnet 10.255.0.4»
    const to = names.find(n => low === n.toLowerCase() || low === 'ssh ' + n.toLowerCase() || low === 'telnet ' + n.toLowerCase() || ((T[0] === 'ssh' || T[0] === 'telnet') && T[1] === '10.255.0.' + n.slice(1)));
    if (to) { print(head + `<span class="nt">— подключился к ${to} (${esc(R.dev[to].city || '')})</span>\n`); setDev(to); return; }
    if (low === '?' || low === 'help') {
      return print(head + `<span class="nt">Команды на ${R.cur} (сокращать можно):</span>\n` + keys().map(k => '  ' + esc(k)).join('\n') + '\n  ping &lt;адрес&gt;\n  traceroute &lt;адрес&gt;\n  show ip route &lt;адрес&gt;\n  R1 … R6 — перейти на другой маршрутизатор\n');
    }
    if (low === 'cls' || low === 'clear') { out.innerHTML = ''; return; }
    if (/^(u|un|und|undeb|undebug) all$|^no debug all$/.test(low)) return print(head + 'All possible debugging has been turned off\n');
    if (/^term(inal)? (len|length) 0$/.test(low)) return print(head);
    if (/^(conf|config|configure)( t| terminal)?$/.test(low) || /^(wr|write|reload|clear )/.test(low)) return print(head + `<span class="nt">Тренажёр: здесь только смотрим. Сначала поставь диагноз — кнопка под терминалом, там же выберешь, как починить.</span>\n`);
    const dv = R.dev[R.cur];
    // ping / traceroute / show ip route <адрес>
    const ipArg = T.find(t => SIM_IP.test(t));
    if (ipArg && 'ping'.startsWith(T[0]) && T[0].length >= 1) return done(raw, head, dv.fn.ping(ipArg));
    if (ipArg && ('traceroute'.startsWith(T[0]) && T[0].length >= 2)) return done(raw, head, dv.fn.traceroute(ipArg));
    if (ipArg && T.length === 4 && 'show'.startsWith(T[0]) && T[1] === 'ip' && 'route'.startsWith(T[2]) && T[2].length >= 2) return done(raw, head, dv.fn.route(ipArg));
    const m = simMatch(raw, keys());
    if (m.key) return done(raw, head, dv.cmds[m.key], m.key);
    if (m.err === 'incomplete') return print(head + '<span class="er">% Incomplete command.</span>\n');
    if (m.err === 'ambiguous') return print(head + `<span class="er">% Ambiguous command:  "${esc(raw)}"</span>\n`);
    print(head + `<span class="er">% Invalid input detected at '^' marker.</span>\n<span class="nt">Тренажёр: такой вывод здесь не подготовлен. «?» — список команд на ${R.cur}.</span>\n`);
  }
  function done(raw, head, text, key) {
    R.cmds.push(R.cur + ': ' + (key || raw)); score();
    let body = esc(text == null ? '' : text);
    if (key && /^debug/.test(key)) body = `<span class="nt">${R.cur}: отладка включена, ждём 30 секунд…</span>\n` + body + '\n' + prompt(R.cur) + 'undebug all\nAll possible debugging has been turned off';
    print(head + body + (body ? '\n' : ''));
  }

  // ---------- вопросы ----------
  function askDiag() {
    const Q = c.diag;
    q.innerHTML = `<h3>🩺 Диагноз: ${Q.q}</h3>` + Q.o.map((x, i) => `<button class="simopt" data-o="${i}">${x[0]}</button>`).join('');
    q.scrollIntoView({ behavior: 'smooth', block: 'start' });
    q.onclick = e => {
      const btn = e.target.closest('.simopt'); if (!btn || btn.classList.contains('ok') || btn.disabled) return;
      const i = +btn.dataset.o, right = i === Q.a;
      btn.classList.add(right ? 'ok' : 'bad'); btn.disabled = !right;
      btn.insertAdjacentHTML('beforeend', `<span class="ex">${right ? '✓ ' : '✕ '}${Q.o[i][1]}</span>`);
      if (!right) { R.w++; score(); return; }
      $$('.simopt', q).forEach(x => x.disabled = true);
      R.stage = 'fix'; const nx = document.createElement('div'); q.appendChild(nx); setTimeout(() => askFix(nx), 350);
    };
  }
  function askFix(box) {
    const Q = c.fix;
    box.innerHTML = `<h3>🔧 Починка: ${Q.q}</h3>` + Q.o.map((x, i) => `<button class="simopt" data-o="${i}">${x[0]}</button>`).join('');
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    box.onclick = e => {
      e.stopPropagation();
      const btn = e.target.closest('.simopt'); if (!btn || btn.disabled) return;
      const i = +btn.dataset.o, right = i === Q.a;
      btn.classList.add(right ? 'ok' : 'bad'); btn.disabled = true;
      btn.insertAdjacentHTML('beforeend', `<span class="ex">${right ? '✓ ' : '✕ '}${Q.o[i][1]}</span>`);
      if (!right) { R.w++; score(); return; }
      $$('.simopt', box).forEach(x => x.disabled = true);
      applyFix();
    };
  }
  function applyFix() {
    const F = c.fix, who = (/^(R\d)/.exec(F.cfg || '') || [])[1] || R.cur;
    const net = Object.assign({}, F.after || {}, { proto: base.proto, age: '00:00:09' });
    if (base.log) { net.log = Object.assign({}, base.log); if (F.log && /^\*/.test(F.log)) net.log[who] = (net.log[who] ? net.log[who] + '\n' : '') + F.log; }
    R.dev = devsOf(net, F.extra); R.fixed = true; R.stage = 'done';
    setDev(who);
    print(`<span class="cm">${esc(F.cfg || '')}</span>\n` + (F.log ? (/^\*/.test(F.log) ? esc(F.log) : `<span class="nt">${esc(F.log)}</span>`) + '\n' : '') + `<span class="nt">Исправлено. Проверь сам: ${esc(c.verify || '')}</span>\n`);
    // результат: лучший из попыток (меньше ошибок, потом меньше команд)
    const st = simSt(id), old = st[c.id], res = { ok: 1, n: R.cmds.length, w: R.w, h: R.h, d: today() };
    if (!old || !old.ok || res.w < old.w || (res.w === old.w && res.n < old.n)) { st[c.id] = res; save(); }
    const bookPart = c.book != null && bookOf(id) ? `<a href="#/c/${id}/book/${c.book}">раздел ${c.book + 1} книги «${bookOf(id).parts[c.book].h}»</a>` : '';
    const nx = (() => { const k = S6.cases.findIndex(x => x.id === c.id); return S6.cases[k + 1]; })();
    const dbg = document.createElement('div');
    dbg.className = 'card simdone';
    dbg.innerHTML = `<h3 style="margin-top:0">✅ Вызов закрыт</h3>
      <p>Твой путь: <b>${R.cmds.length}</b> ${plural(R.cmds.length, 'команда', 'команды', 'команд')}, ошибок в ответах: <b>${R.w}</b>${R.h ? ', подсказок: ' + R.h : ''}. Опытный дежурный обошёлся бы так:</p>
      <ol>${(c.best || []).map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ol>
      ${R.cmds.length ? `<details class="more"><summary>Твои команды</summary><ol>${R.cmds.map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ol></details>` : ''}
      <div class="content">${c.why || ''}</div>
      <p class="muted" style="font-size:13.5px">${bookPart ? 'Повторить теорию: ' + bookPart + '. ' : ''}${c.lab ? `В лабе: <a href="#/c/${id}/lab">${esc(c.lab)}</a>.` : ''}</p>
      <div class="row"><a class="btn" href="#/c/${id}/sim">Все вызовы</a>${nx ? `<a class="btn pri" href="#/c/${id}/sim/${nx.id}">Следующий вызов →</a>` : ''}<button class="btn" data-s="again">Пройти заново</button></div>`;
    q.appendChild(dbg);
    $('.sim-live', b).classList.remove('sim-live');   // дальше синхронизация может перерисовывать
    renderSide();
  }

  // ---------- события ----------
  $('.tin', b).onsubmit = e => { e.preventDefault(); const v = inp.value; inp.value = ''; run(v); };
  inp.onkeydown = e => {
    if (e.key === 'ArrowUp' && R.hist.length) { e.preventDefault(); R.hp = Math.max(0, R.hp - 1); inp.value = R.hist[R.hp] || ''; }
    else if (e.key === 'ArrowDown' && R.hist.length) { e.preventDefault(); R.hp = Math.min(R.hist.length, R.hp + 1); inp.value = R.hist[R.hp] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const T = simTok(inp.value); if (!T.length) return;
      const cand = keys().map(simTok).filter(K => K.length >= T.length && T.slice(0, -1).every((t, i) => K[i].startsWith(t)) && K[T.length - 1].startsWith(T[T.length - 1]));
      const words = [...new Set(cand.map(K => K[T.length - 1]))];
      if (words.length === 1) { T[T.length - 1] = words[0]; inp.value = T.join(' ') + ' '; }
    }
  };
  b.onclick = e => {
    const d = e.target.closest('[data-dev]'); if (d) { if (d.dataset.dev !== R.cur) { print(`<span class="nt">— подключился к ${d.dataset.dev} (${esc(R.dev[d.dataset.dev].city || '')})</span>\n`); setDev(d.dataset.dev); } inp.focus({ preventScroll: true }); return; }
    const ch = e.target.closest('[data-c]');
    if (ch) { const v = ch.dataset.c; if (/[\/.]$/.test(v)) { inp.value = v; inp.focus(); } else { run(v); } return; }
    const s = e.target.closest('[data-s]'); if (!s) return;
    if (s.dataset.s === 'chips') { chips = !chips; chipBox.hidden = !chips; s.textContent = chips ? 'Скрыть список команд' : 'Показать список команд'; try { localStorage.setItem('sdsm_simchips', chips ? '1' : '0'); } catch (e2) { } }
    else if (s.dataset.s === 'hint') {
      const best = c.best || [], k = Math.min(R.h, best.length - 1);
      if (R.h < best.length) R.h++;
      $('.simhint', b).innerHTML = `<div class="callout info"><b>Подсказка ${k + 1} из ${best.length}</b>${R.h === 1 ? 'Начни с этого: ' : 'Дальше посмотри: '}<code>${esc(best[k] || '')}</code>${R.h >= best.length ? '. Больше подсказок нет — теперь думай, что видишь.' : ''}</div>`;
    }
    else if (s.dataset.s === 'diag') { if (R.stage !== 'look') return; R.stage = 'diag'; s.disabled = true; askDiag(); }
    else if (s.dataset.s === 'again') { simRun(b, id, S6, c); }
  };
  setDev(R.cur);
  print(`<span class="nt">Ты на ${R.cur} (${esc(R.dev[R.cur].city || '')}). Вверху — переход на другие маршрутизаторы. «?» — список команд.</span>\n`);
  score();
  if (matchMedia('(min-width: 900px)').matches) inp.focus({ preventScroll: true });
}
function plural(n, a, b, c) { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; }

// ---------- все вызовы курса ----------
function viewSimAll(v) {
  const L = COURSE.list.filter(m => simOf(m.id));
  let h = `<h1>🚨 Дежурство</h1><p class="sub">Аварии в сетях из глав курса. Разбираются командами show прямо здесь, без EVE-NG, — на телефоне тоже. Это тренировка того, что ты делаешь на смене: заявка → выводы → диагноз → починка.</p>`;
  if (!L.length) h += '<p>Пока нет ни одного вызова.</p>';
  L.forEach(m => { const [a, n] = simStats(m.id);
    h += `<a class="chapcard" href="#/c/${m.id}/sim" style="margin:10px 0"><div class="n">ГЛАВА ${m.num}</div><div class="t">${m.title}</div><div class="bar ${a === n ? 'ok' : ''}"><i style="width:${pct(a, n)}%"></i></div><div class="muted" style="font-size:13px">решено ${a} из ${n}</div></a>`; });
  h += `<p class="muted" style="font-size:13.5px">Вызовы появляются вместе с книгой главы. Пока они есть для главы 6 (OSPF и IS-IS).</p>`;
  v.innerHTML = h;
}
