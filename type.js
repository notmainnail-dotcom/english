// Игра «Печать»: спокойная слепая печать. Без таймера и штрафов — ошибка просто подсвечивается.
// Клавиши понимаем по месту на клавиатуре (e.code), поэтому русская раскладка не мешает.
(() => {
  const KEY = 'type_v1';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const PAUSE = 3000; // паузы дольше 3 секунд в скорость не идут: можно задуматься, отвлечься

  // ---------- клавиатура: что печатает клавиша и каким пальцем ----------
  const ROWS = [
    ['`1234567890-=', '~!@#$%^&*()_+'],
    ['qwertyuiop[]', 'QWERTYUIOP{}'],
    ["asdfghjkl;'", 'ASDFGHJKL:"'],
    ['zxcvbnm,./', 'ZXCVBNM<>?'],
  ];
  const CODE = {}; // e.code → [обычный, с Shift]
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c) => { CODE['Key' + c.toUpperCase()] = [c, c.toUpperCase()]; });
  '0123456789'.split('').forEach((d, i) => { CODE['Digit' + d] = [d, ')!@#$%^&*('[i]]; });
  Object.assign(CODE, {
    Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Semicolon: [';', ':'],
    Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], Backquote: ['`', '~'], Space: [' ', ' '],
  });
  // Палец для клавиши (по обычному символу)
  const FINGER = {};
  const set = (chars, f) => chars.split('').forEach((c) => { FINGER[c] = f; });
  set('`1qaz', 'lp'); set('2wsx', 'lr'); set('3edc', 'lm'); set('45rtfgvb', 'li');
  set('67yuhjnm', 'ri'); set('8ik,', 'rm'); set('9ol.', 'rr'); set("0-=p[];'/", 'rp'); set(' ', 'th');
  const FINGER_NAME = { lp: 'левый мизинец', lr: 'левый безымянный', lm: 'левый средний', li: 'левый указательный',
    ri: 'правый указательный', rm: 'правый средний', rr: 'правый безымянный', rp: 'правый мизинец', th: 'большой палец' };

  /** Для символа текста: какая клавиша (обычный символ) и нужен ли Shift. */
  function keyFor(ch) {
    for (const [base, shift] of ROWS) {
      let i = base.indexOf(ch);
      if (i >= 0) return { k: base[i], shift: false };
      i = shift.indexOf(ch);
      if (i >= 0) return { k: base[i], shift: true };
    }
    return { k: ch, shift: false }; // пробел
  }

  // ---------- состояние ----------
  let S = { mode: 'dialog', stage: 1, done: {}, cur: null, days: {}, kb: true, tr: true };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* с начала */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* без сохранения */ } };

  let target = ''; // строка, которую печатаем
  let typed = []; // что напечатано
  let errs = 0; // ошибочных нажатий в строке
  let active = 0; // «чистое» время печати строки, мс
  let lastKey = 0;
  let words = []; // слова строки (режимы «Пальцы» и «Слова») — для перевода
  let finished = false; // диалог закончен — показываем итог

  // ---------- что печатать ----------
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const STAGE_LETTERS = { 1: 'asdfghjkl', 2: 'asdfghjklqwertyuiop', 3: 'abcdefghijklmnopqrstuvwxyz' };
  const STAGE_NAME = { 1: 'Основной ряд', 2: '+ верхний ряд', 3: 'Все буквы' };

  function fingerLine() {
    const letters = STAGE_LETTERS[S.stage];
    const pool = [...TYPE_HOME, ...TYPE_WORDS].filter(([w]) => [...w].every((c) => letters.includes(c)));
    words = Array.from({ length: 6 }, () => {
      if (pool.length >= 8 && Math.random() < 0.7) return pick(pool);
      const len = 3 + Math.floor(Math.random() * 3); // буквосочетание для пальцев
      return [Array.from({ length: len }, () => pick(letters)).join(''), ''];
    });
    return words.map((w) => w[0]).join(' ');
  }

  function wordLine() {
    words = Array.from({ length: 6 }, () => pick(TYPE_WORDS));
    return words.map((w) => w[0]).join(' ');
  }

  const dialog = () => TYPE_DIALOGS.find((d) => d.id === (S.cur && S.cur.id)) || TYPE_DIALOGS[0];

  function startDialog(id) {
    S.cur = { id, i: 0 };
    finished = false;
    save();
    newLine();
  }

  function nextDialogId() {
    const d = TYPE_DIALOGS.find((x) => !S.done[x.id]);
    return (d || pick(TYPE_DIALOGS)).id;
  }

  function newLine() {
    typed = []; errs = 0; active = 0; lastKey = 0;
    if (S.mode === 'dialog') {
      if (!S.cur) S.cur = { id: nextDialogId(), i: 0 };
      target = dialog().l[S.cur.i][1];
      words = [];
    } else if (S.mode === 'words') {
      target = wordLine();
    } else {
      target = fingerLine();
    }
    render();
  }

  // ---------- статистика (тихо, по дням) ----------
  function record() {
    const d = (S.days[today()] = S.days[today()] || { ch: 0, er: 0, ms: 0 });
    d.ch += target.length; d.er += errs; d.ms += active;
    // храним последние 60 дней
    const keys = Object.keys(S.days).sort();
    while (keys.length > 60) delete S.days[keys.shift()];
  }

  const wpm = (ch, ms) => (ms > 0 ? Math.round((ch / 5) / (ms / 60000)) : 0);
  const acc = (ch, er) => (ch ? Math.max(0, Math.round(100 - (er / ch) * 100)) : 0);

  function sumDays(from, to) { // дни от from до to дней назад
    const s = { ch: 0, er: 0, ms: 0, n: 0 };
    for (let i = from; i <= to; i++) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const d = S.days[k];
      if (d) { s.ch += d.ch; s.er += d.er; s.ms += d.ms; s.n++; }
    }
    return s;
  }

  function statsText() {
    const t = S.days[today()];
    const w1 = sumDays(0, 6), w0 = sumDays(7, 13);
    const parts = [];
    if (t && t.ms) parts.push(`Сегодня: ${Math.round(t.ms / 60000) || '<1'} мин, ${wpm(t.ch, t.ms)} сл/мин, точность ${acc(t.ch, t.er)}%`);
    if (w1.ms && w0.ms) parts.push(`За неделю ${wpm(w1.ch, w1.ms)} сл/мин — неделей раньше было ${wpm(w0.ch, w0.ms)}`);
    else if (w1.ms) parts.push(`За неделю: ${wpm(w1.ch, w1.ms)} сл/мин, точность ${acc(w1.ch, w1.er)}%`);
    return parts.join(' · ') || 'Скорость и точность запишутся сами. Здесь их и увидишь — во время печати их нет.';
  }

  // ---------- ввод ----------
  function typeChar(ch) {
    if (finished) return;
    if (typed.length >= target.length) return;
    const now = Date.now();
    if (lastKey) active += Math.min(now - lastKey, PAUSE);
    lastKey = now;
    if (ch !== target[typed.length]) errs++;
    typed.push(ch);
    if (typed.length === target.length) lineDone();
    render();
  }

  function backspace() {
    if (finished || !typed.length) return;
    typed.pop();
    render();
  }

  function lineDone() {
    record();
    save();
    setTimeout(() => {
      if (S.mode === 'dialog') {
        const d = dialog();
        if (S.cur.i < d.l.length - 1) { S.cur.i++; save(); newLine(); }
        else { S.done[d.id] = true; finished = true; save(); renderList(); render(); }
      } else {
        newLine();
      }
    }, 350);
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches; // телефон: ввод через скрытое поле

  document.addEventListener('keydown', (e) => {
    if (coarse || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Backspace') { e.preventDefault(); backspace(); return; }
    if (e.code === 'Enter' && finished) { e.preventDefault(); startDialog(nextDialogId()); return; }
    const m = CODE[e.code];
    if (m) { e.preventDefault(); typeChar(e.shiftKey ? m[1] : m[0]); return; }
    if (e.key.length === 1) { e.preventDefault(); typeChar(e.key); }
  });

  // на телефоне — обычная экранная клавиатура через скрытое поле
  const hidden = $('hidden');
  if (coarse) {
    hidden.addEventListener('input', (e) => {
      if (e.inputType === 'deleteContentBackward') backspace();
      else if (e.data) [...e.data].forEach(typeChar);
      hidden.value = '';
    });
    // нажатие на строку открывает клавиатуру — обработчик вешает render()
  }

  // ---------- отрисовка ----------
  function lineHtml() {
    return [...target].map((c, i) => {
      let cls = 'p';
      if (i < typed.length) cls = typed[i] === c ? 'ok' : 'bad';
      else if (i === typed.length) cls = 'cur';
      const shown = c === ' ' ? (cls === 'bad' ? '·' : '&nbsp;') : esc(c);
      return `<span class="${cls}">${shown}</span>`;
    }).join('');
  }

  function keyboardHtml() {
    const next = target[typed.length];
    const need = next !== undefined ? keyFor(next) : null;
    const rows = ROWS.map(([base], r) => `<div class="kr r${r}">${[...base].map((k) => {
      const on = need && need.k === k;
      return `<span class="k f-${FINGER[k]} ${on ? 'on' : ''} ${'fj'.includes(k) ? 'bump' : ''}">${esc(k.toUpperCase())}</span>`;
    }).join('')}</div>`).join('');
    const sh = need && need.shift;
    const space = need && need.k === ' ';
    // Shift жмём мизинцем другой руки: буква левой рукой — правый Shift, и наоборот
    const leftKey = sh && FINGER[need.k] && FINGER[need.k][0] === 'l';
    const finger = need ? FINGER_NAME[FINGER[need.k]] + (sh ? ` + ${leftKey ? 'правый' : 'левый'} Shift (мизинец другой руки)` : '') : '';
    return `<div class="kb">${rows}<div class="kr"><span class="k sh ${sh && !leftKey ? 'on' : ''}">Shift</span><span class="k space f-th ${space ? 'on' : ''}">пробел</span><span class="k sh ${sh && leftKey ? 'on' : ''}">Shift</span></div></div>
      <div class="finger">${finger ? 'Палец: ' + finger : ''}</div>`;
  }

  function render() {
    document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.m === S.mode));
    $('stats').textContent = statsText();
    let h = '';

    if (S.mode === 'finger') {
      h += `<div class="seg small">${[1, 2, 3].map((s) => `<button data-st="${s}" class="${S.stage === s ? 'on' : ''}">${STAGE_NAME[s]}</button>`).join('')}</div>`;
      h += '<p class="mu tip">Пальцы на ряду ASDF и JKL (на F и J есть бугорки). Смотри на экран, а не на клавиатуру.</p>';
    }

    if (S.mode === 'dialog') {
      const d = dialog();
      h += `<div class="dhead"><b>💬 ${esc(d.t)}</b><span class="mu">${finished ? 'готово' : `реплика ${S.cur.i + 1} из ${d.l.length}`}</span></div>`;
      h += '<div class="chat">' + d.l.slice(0, finished ? d.l.length : S.cur.i).map((x) =>
        `<div class="msg ${x[0]}"><div>${esc(x[1])}</div>${S.tr ? `<small>${esc(x[2])}</small>` : ''}</div>`).join('') + '</div>';
      if (finished) {
        const n = Object.keys(S.done).length;
        h += `<div class="done">Диалог напечатан ✓<div class="mu">Пройдено диалогов: ${n} из ${TYPE_DIALOGS.length}</div>
          <button class="btn" data-a="nextd">Следующий диалог (Enter)</button>
          <button class="btn g" data-a="again">Ещё раз этот</button></div>`;
      } else {
        const line = d.l[S.cur.i];
        h += `<div class="who">${line[0] === 'A' ? '🙂 A' : '😊 B'} ${voiceOk() ? '<button class="say" data-a="say">🔊</button>' : ''}</div>`;
        h += `<div class="line" id="area">${lineHtml()}</div>`;
        if (S.tr) h += `<div class="trn">${esc(line[2])}</div>`;
      }
    } else {
      h += `<div class="line" id="area">${lineHtml()}</div>`;
      const real = words.filter((w) => w[1]);
      if (S.tr && real.length) h += `<div class="trn">${real.map((w) => `<b>${esc(w[0])}</b> — ${esc(w[1])}`).join(' · ')}</div>`;
    }

    // подсказка клавиатуры — только для настоящей клавиатуры, на телефоне у него своя
    if (!finished && S.kb && !coarse) h += keyboardHtml();
    if (coarse) h += '<p class="mu tip">Нажми на строку, чтобы появилась клавиатура. Слепую печать удобнее учить на компьютере.</p>';
    $('game').innerHTML = h;
    $('opt-kb').checked = S.kb;
    $('opt-tr').checked = S.tr;
    if (coarse && $('area')) $('area').addEventListener('click', () => hidden.focus());
  }

  // ---------- озвучка (если в системе есть английский голос) ----------
  let voice = null;
  function loadVoice() {
    if (!('speechSynthesis' in window)) return;
    voice = speechSynthesis.getVoices().find((v) => /^en[-_]/i.test(v.lang)) || null;
  }
  const voiceOk = () => !!voice;
  if ('speechSynthesis' in window) { loadVoice(); speechSynthesis.onvoiceschanged = () => { loadVoice(); render(); }; }
  function say(text) {
    if (!voice) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = 0.85;
    speechSynthesis.speak(u);
  }

  // ---------- кнопки ----------
  $('modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    S.mode = b.dataset.m; finished = false; save(); newLine();
  });
  $('game').addEventListener('click', (e) => {
    const st = e.target.closest('[data-st]');
    if (st) { S.stage = Number(st.dataset.st); save(); newLine(); return; }
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'nextd') startDialog(nextDialogId());
    if (a.dataset.a === 'again') startDialog(dialog().id);
    if (a.dataset.a === 'say') say(target);
    a.blur(); // чтобы пробел/Enter не нажимали кнопку повторно
  });
  $('list').addEventListener('change', (e) => { S.mode = 'dialog'; startDialog(e.target.value); e.target.blur(); });
  $('opt-kb').addEventListener('change', (e) => { S.kb = e.target.checked; save(); render(); e.target.blur(); });
  $('opt-tr').addEventListener('change', (e) => { S.tr = e.target.checked; save(); render(); e.target.blur(); });

  if (coarse) $('opt-kb').parentElement.hidden = true;

  // список диалогов (✓ — уже напечатан)
  function renderList() {
    $('list').innerHTML = '<option value="">Выбрать диалог…</option>' +
      TYPE_DIALOGS.map((d) => `<option value="${d.id}">${S.done[d.id] ? '✓ ' : ''}${esc(d.t)}</option>`).join('');
  }
  renderList();

  // тема как в приложении английского
  try {
    const th = (JSON.parse(localStorage.getItem('eng_v1')) || {}).theme;
    if (th && th !== 'auto') document.documentElement.dataset.theme = th;
  } catch { /* как в системе */ }

  newLine();
  window.__type = { keyFor, CODE, state: () => ({ target, typed: typed.join(''), errs, S }) }; // для проверки
})();
