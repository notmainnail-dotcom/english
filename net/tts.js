// Озвучка: встроенный синтез речи браузера (Web Speech API). В Edge есть нейронные русские голоса «… Online (Natural)».
// Книга и конспект читаются по абзацам с подсветкой; «Проверь себя» — вопрос, пауза на подумать, ответ; карточки — на слух.
// Голос, скорость и пауза — настройки этого устройства (localStorage sdsm_tts): у каждого компьютера свои голоса.
'use strict';
const TTS = (() => {
  const SS = window.speechSynthesis;
  const ok = !!SS && typeof SpeechSynthesisUtterance == 'function';
  const cfg = { voice: '', rate: 1, think: 4 };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('sdsm_tts')) || {}); } catch (e) { }
  const saveCfg = () => { try { localStorage.setItem('sdsm_tts', JSON.stringify(cfg)); } catch (e) { } };
  let voices = [];
  const loadVoices = () => { voices = ok ? SS.getVoices() : []; };
  if (ok) { loadVoices(); SS.addEventListener('voiceschanged', loadVoices); }
  const ruVoices = () => voices.filter(v => /^ru/i.test(v.lang));
  function voice() {
    const ru = ruVoices();
    return voices.find(v => v.name === cfg.voice) || ru.find(v => /svetlana/i.test(v.name) && /natural/i.test(v.name)) || ru.find(v => /natural|online/i.test(v.name)) || ru[0] || null;
  }

  // ---------- произношение ----------
  const ABBR = {
    'IS-IS': 'ай-эс ай-эс', 'TI-LFA': 'ти-ай эл-эф-а', 'EVE-NG': 'ив эн-джи', 'IPv4': 'ай-пи вэ четыре', 'IPv6': 'ай-пи вэ шесть', 'uRPF': 'ю-эр-пэ-эф',
    IP: 'ай-пи', ID: 'ай-ди', ISP: 'ай-эс-пи', ACL: 'эй-си-эл', NAT: 'нат', PAT: 'пат', CGNAT: 'си-джи-нат', ARP: 'арп', MAC: 'мак', LAN: 'лан', WAN: 'ван',
    VLAN: 'влан', VPN: 'вэ-пэ-эн', LACP: 'лакп', DHCP: 'дэ-ха-цэ-пэ', DNS: 'дэ-эн-эс', ICMP: 'ай-си-эм-пи', TCP: 'тэ-цэ-пэ', UDP: 'у-дэ-пэ', SSH: 'эс-эс-аш',
    SNMP: 'эс-эн-эм-пэ', HTTP: 'аш-тэ-тэ-пэ', HTTPS: 'аш-тэ-тэ-пэ-эс', OSPF: 'о-эс-пэ-эф', BGP: 'бэ-гэ-пэ', RIP: 'рип', EIGRP: 'и-ай-джи-эр-пи', IGP: 'ай-джи-пи',
    EGP: 'и-джи-пи', MPLS: 'эм-пэ-эл-эс', LDP: 'эл-дэ-пэ', TE: 'тэ-е', SR: 'эс-эр', LSA: 'эл-эс-а', LSDB: 'эл-эс-дэ-бэ', LSP: 'эл-эс-пэ', LSR: 'эл-эс-эр',
    LSU: 'эл-эс-у', LSAck: 'эл-эс-эк', DBD: 'дэ-бэ-дэ', SPF: 'эс-пэ-эф', DR: 'дэ-эр', BDR: 'бэ-дэ-эр', DROTHER: 'дэ-эр-азер', DIS: 'дис', ABR: 'а-бэ-эр',
    ASBR: 'а-эс-бэ-эр', NSSA: 'эн-эс-эс-а', RID: 'эр-ай-ди', AD: 'а-дэ', NET: 'нэт', TLV: 'тэ-эл-вэ', OL: 'о-эл', BFD: 'бэ-эф-дэ', LFA: 'эл-эф-а',
    ECMP: 'и-си-эм-пи', MTU: 'эм-тэ-у', RIB: 'риб', FIB: 'фиб', CPU: 'цэ-пэ-у', NOC: 'нок', DWDM: 'дэ-вэ-дэ-эм', SFP: 'эс-эф-пэ', TTL: 'тэ-тэ-эл',
    STP: 'эс-тэ-пэ', RSTP: 'эр-эс-тэ-пэ', BPDU: 'бэ-пэ-дэ-у', DAI: 'дай', RFC: 'эр-эф-цэ', BCP: 'бэ-цэ-пэ', IOS: 'ай-о-эс', CLI: 'си-эл-ай', OSI: 'о-эс-ай',
    CLNS: 'си-эл-эн-эс', QoS: 'кью-о-эс', VRF: 'ви-эр-эф', EVPN: 'и-ви-пи-эн', VPLS: 'ви-пи-эл-эс', VXLAN: 'ви-экс-лан', PE: 'пэ-е', CE: 'цэ-е', IX: 'ай-экс',
    IANA: 'ай-эй-эн-эй', PPPoE: 'пэ-пэ-пэ-о-е', GRE: 'джи-ар-и', IPsec: 'ай-пи-сек', DMVPN: 'дэ-эм-вэ-пэ-эн', SLA: 'эс-эл-эй', LLC: 'эл-эл-цэ',
    Cisco: 'циско', Juniper: 'джунипер', Huawei: 'хуавей', Arista: 'ариста', Edge: 'эдж', GitHub: 'гитхаб',
    Hello: 'хэллоу', hello: 'хэллоу', dead: 'дэд', loopback: 'лупбэк', Loopback: 'лупбэк', cost: 'кост', area: 'эриа', stub: 'стаб', broadcast: 'бродкаст',
    master: 'мастер', overload: 'оверлоуд', narrow: 'нэрроу', wide: 'вайд', passive: 'пассив', debug: 'дебаг', ping: 'пинг', traceroute: 'трейсроут',
    show: 'шоу', router: 'роутер', permit: 'пёрмит', deny: 'дэнай', any: 'эни', host: 'хост', flooding: 'флудинг',
    // состояния и слова из выводов
    INIT: 'инит', FULL: 'фулл', DOWN: 'даун', UP: 'ап', EXSTART: 'экс-старт', EXCHANGE: 'иксчейндж', LOADING: 'лоадинг', '2-WAY': 'ту-вэй', P2P: 'пи-ту-пи',
    LOOP: 'луп', BROADCAST: 'бродкаст', OK: 'окей',
    // слова команд (в книге они в тексте как code)
    ip: 'ай-пи', ospf: 'о-эс-пэ-эф', isis: 'ай-эс ай-эс', bfd: 'бэ-эф-дэ', mtu: 'эм-тэ-у', neighbor: 'нэйбор', neighbors: 'нэйборс', 'interface': 'интерфейс',
    brief: 'бриф', database: 'датабейс', route: 'роут', detail: 'детэйл', distance: 'дистанс', network: 'нетворк', 'point-to-point': 'поинт-ту-поинт',
    'auto-cost': 'авто-кост', 'reference-bandwidth': 'референс-бэндвидс', 'set-overload-bit': 'сет-оверлоуд-бит', 'metric-style': 'метрик-стайл', metric: 'метрик',
    'is-type': 'из-тайп', 'level-2-only': 'левел-ту-онли', 'access-list': 'эксесс-лист', 'access-lists': 'эксесс-листс', 'running-config': 'раннинг-конфиг',
    section: 'секшн', priority: 'прайорити', interval: 'интервал', multiplier: 'мультиплаер', range: 'рейндж', adj: 'эдж', undebug: 'андебаг', all: 'олл',
    clear: 'клир', process: 'процесс', extended: 'экстендед', summary: 'саммари', redistribute: 'редистрибьют', connected: 'коннектед', static: 'статик',
    'passive-interface': 'пассив-интерфейс', 'hello-interval': 'хэллоу-интервал', 'dead-interval': 'дэд-интервал', 'mtu-ignore': 'эм-тэ-у-игнор', nssa: 'эн-эс-эс-а',
    'link-state': 'линк-стейт', 'distance-vector': 'дистанс-вектор', 'router-id': 'роутер-ай-ди',
    // MPLS (глава 10)
    LER: 'эл-е-эр', LIB: 'либ', LFIB: 'эл-фиб', FEC: 'фек', PHP: 'пэ-аш-пэ', CEF: 'цэф', SID: 'сид', SRGB: 'эс-эр-джи-би', MRU: 'эм-эр-ю', TC: 'тэ-цэ', EXP: 'экс-пи',
    push: 'пуш', swap: 'своп', pop: 'поп', Pop: 'поп', label: 'лейбл', Label: 'лейбл', Labels: 'лейблы', No: 'ноу', Untagged: 'антэгд', Oper: 'опер',
    'next-hop': 'некст-хоп', 'BGP-free': 'бэ-гэ-пэ фри', core: 'кор', 'black hole': 'блэк хол', implicit: 'имплисит', explicit: 'эксплисит', null: 'нал',
    'liberal retention': 'либерал ретеншн', 'penultimate hop popping': 'пенальтимейт хоп поппинг', 'label stack': 'лейбл стэк', 'Segment Routing': 'сегмент роутинг',
    mpls: 'эм-пэ-эл-эс', ldp: 'эл-дэ-пэ', cef: 'цэф', bindings: 'байндингс', 'forwarding-table': 'форвардинг-тейбл', ipv4: 'ай-пи вэ четыре', sync: 'синк',
    'propagate-ttl': 'пропагейт ти-ти-эл', forwarded: 'форвардед', 'df-bit': 'ди-эф бит', size: 'сайз', jumbo: 'джамбо', autoconfig: 'автоконфиг', force: 'форс', statistics: 'статистикс', logging: 'логгинг', interfaces: 'интерфейсы', 'default': 'дефолт', 'on-startup': 'он-стартап'
  };
  const LET = { A: 'а', B: 'бэ', C: 'цэ', D: 'дэ', E: 'е', F: 'эф', G: 'гэ', H: 'аш', I: 'и', J: 'джей', K: 'ка', L: 'эл', M: 'эм', N: 'эн', O: 'о', P: 'пэ', Q: 'кью', R: 'эр', S: 'эс', T: 'тэ', U: 'у', V: 'вэ', W: 'дабл-ю', X: 'икс', Y: 'игрек', Z: 'зэд' };
  const ABBR_RE = new RegExp('(^|[^A-Za-z0-9])(' + Object.keys(ABBR).sort((a, b) => b.length - a.length).map(k => k.replace(/[-]/g, '\\-')).join('|') + ')(?![A-Za-z0-9]|-[a-z])', 'g');
  function speakable(t) {
    return t
      .replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, '')
      .replace(/\b(\d{1,3}(?:\.\d{1,3}){3})(\/(\d{1,2}))?/g, (m, ip, p, n) => ip.split('.').join(' точка ') + (n ? ' слэш ' + n : ''))
      .replace(/(^|\s)\/(\d{1,2})\b/g, '$1слэш $2')
      .replace(/\bGi(\d+)\/(\d+)\b/g, 'гигабит $1 слэш $2').replace(/\bLo(\d+)\b/g, 'лупбэк $1')
      .replace(/(\d)\s?Мбит\/с/g, '$1 мегабит в секунду').replace(/(\d)\s?Гбит\/с/g, '$1 гигабит в секунду')
      .replace(/(\d)\s?мс(?=[\s.,;:)]|$)/g, '$1 миллисекунд').replace(/(\d)\s?с(?=[\s.,;:)]|$)/g, '$1 секунд')
      .replace(/\b(\d+)G\b/g, '$1 гигабит').replace(/\bL([1-3])(VPN)?\b/g, (m, n, v) => 'эл-' + ['один', 'два', 'три'][n - 1] + (v ? ' вэ-пэ-эн' : '')).replace(/\bR(\d)\b/g, 'эр $1').replace(/\b(PE|CE|P)(\d)\b/g, (m, w, n) => ({ PE: 'пэ-е', CE: 'цэ-е', P: 'пэ' })[w] + ' ' + n)
      .replace(ABBR_RE, (m, a, w) => a + ABBR[w])
      .replace(/\b[A-Z]{2,5}\b/g, w => w.split('').map(c => LET[c]).join('-'))
      .replace(/→|⇒/g, ' — ').replace(/×/g, ' на ').replace(/≈/g, ' примерно ').replace(/</g, ' меньше ').replace(/>/g, ' больше ')
      .replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
  }
  // куски до ~200 знаков по границам предложений (длинные фразы Chromium иногда обрывает)
  function chunks(t) {
    const out = []; let cur = '';
    (t.match(/[^.!?…;:]+[.!?…;:]*\s*/g) || [t]).forEach(s => {
      if ((cur + s).length > 200 && cur) { out.push(cur); cur = ''; }
      if (s.length > 260) { s.split(/(?<=,)\s+/).forEach(p => { if ((cur + p).length > 200 && cur) { out.push(cur); cur = ''; } cur += p + ' '; }); }
      else cur += s;
    });
    if (cur.trim()) out.push(cur);
    return out.map(x => x.trim()).filter(Boolean);
  }

  // ---------- текст страницы → очередь ----------
  const SEL = 'h2,h3,h4,p,li,.an,.callout,details.chk,figcaption,tr';
  const txt = el => (el.innerText || '').replace(/ /g, ' ').trim();
  function itemsOf(root) {
    // номер раздела = место среди section.sec с id «sec-…» (вступление и итог книги — вне разделов, -1)
    const secs = [...root.querySelectorAll('section.sec[id^="sec-"]')];
    const out = [];
    [...root.querySelectorAll(SEL)].forEach(el => {
      if (el.closest('pre,.secfoot,.figctl,.callout.lab,svg,.toc,.card')) return;
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) if (p.matches(SEL)) return;
      const s = secs.indexOf(el.closest('section.sec'));
      let t;
      if (el.matches('details.chk')) {
        const q = txt(el.querySelector('summary')), a = [...el.querySelectorAll('p')].map(txt).join(' ');
        out.push({ el, sec: s, text: q, gap: 300 });
        if (a) out.push({ el, sec: s, text: 'Ответ: ' + a, before: cfg.think * 1000, open: true, gap: 600 });
        return;
      }
      if (el.matches('h2')) t = txt(el).replace(/^(\d+)\.\s*/, 'Раздел $1. ');
      else if (el.matches('tr')) { const c = [...el.children].map(txt).filter(Boolean); t = c.join(', ') + '.'; if (el.querySelector('th')) t = 'Таблица: ' + t; }
      else if (el.matches('figcaption')) t = 'К схеме: ' + txt(el);
      else if (el.matches('.an,.callout')) t = txt(el).replace(/\n+/, '. ');
      else t = txt(el);
      if (t && t.replace(/[\s.,:]/g, '')) out.push({ el, sec: s, text: t, gap: el.matches('h2,h3,h4') ? 450 : 250 });
    });
    return out;
  }

  // ---------- проигрыватель ----------
  let Q = [], i = 0, k = 0, parts = [], gen = 0, state = 'off', opts = {}, timer = null, started = {}, keep = [];
  const bar = () => document.getElementById('ttsbar');
  function ensureBar() {
    if (bar()) return;
    const d = document.createElement('div'); d.id = 'ttsbar'; d.hidden = true;
    d.innerHTML = `<button class="btn sm" data-t="prev" title="Предыдущий абзац">⏮</button><button class="btn sm pri" data-t="pp" title="Пауза">⏸</button><button class="btn sm" data-t="next" title="Следующий абзац">⏭</button>
      <span class="tts-what"></span><select data-t="rate" title="Скорость">${[0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.7, 2].map(r => `<option value="${r}">${String(r).replace('.', ',')}×</option>`).join('')}</select><button class="btn sm" data-t="stop" title="Остановить">✕</button>`;
    document.body.appendChild(d);
    d.onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; const a = b.dataset.t;
      if (a === 'pp') state === 'play' ? pause() : resume(); else if (a === 'prev') jump(i - 1); else if (a === 'next') jump(i + 1); else if (a === 'stop') stop(); };
    d.querySelector('[data-t="rate"]').onchange = e => { cfg.rate = +e.target.value; saveCfg(); if (state === 'play') { const j = i; jump(j); } };
  }
  function ui() {
    const d = bar(); if (!d) return;
    d.hidden = state === 'off';
    d.querySelector('[data-t="pp"]').textContent = state === 'play' ? '⏸' : '▶';
    d.querySelector('[data-t="rate"]').value = String(cfg.rate);
    const it = Q[i];
    d.querySelector('.tts-what').textContent = opts.label ? opts.label(it, i, Q.length) : `${Math.min(i + 1, Q.length)} из ${Q.length}`;
  }
  function mark(on) {
    document.querySelectorAll('.tts-on').forEach(x => x.classList.remove('tts-on'));
    const it = Q[i]; if (!on || !it || !it.el) return;
    it.el.classList.add('tts-on');
    const r = it.el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 90) it.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function speakChunk(g) {
    if (g !== gen || state !== 'play') return;
    if (k >= parts.length) return itemDone(g);
    const u = new SpeechSynthesisUtterance(parts[k]);
    const v = voice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'ru-RU';
    u.rate = cfg.rate;
    u.onend = () => { if (g !== gen) return; k++; speakChunk(g); };
    u.onerror = e => { if (g !== gen || e.error === 'interrupted' || e.error === 'canceled') return; k++; speakChunk(g); };
    keep = [u];   // без ссылки Chromium может потерять onend
    SS.speak(u);
  }
  function startItem(g) {
    if (g !== gen || state !== 'play') return;
    if (i >= Q.length) return finish();
    const it = Q[i];
    if (it.sec >= 0 && (i === 0 || Q[i - 1].sec !== it.sec)) started[it.sec] = true;
    if (it.open && it.el.tagName === 'DETAILS') it.el.open = true;
    if (it.onStart) it.onStart(it);
    mark(true); ui();
    parts = chunks(speakable(it.text)); k = 0;
    const go = () => speakChunk(g);
    if (it.before) timer = setTimeout(go, it.before); else go();
  }
  function itemDone(g) {
    const it = Q[i], nx = Q[i + 1];
    if (it && it.sec >= 0 && started[it.sec] && (!nx || nx.sec !== it.sec) && opts.onSection) opts.onSection(it.sec);
    i++;
    timer = setTimeout(() => startItem(g), it && it.gap || 250);
  }
  function finish() { const f = opts.onEnd; stop(); if (f) f(); }
  function play(items, o, from) {
    if (!ok) { toast('В этом браузере нет синтеза речи'); return; }
    if (!voice()) toast('Русского голоса нет — открой курс в Edge');
    ensureBar(); halt();
    Q = items; opts = o || {}; i = Math.max(0, Math.min(from || 0, Q.length - 1)); started = {};
    state = 'play'; gen++; ui(); startItem(gen);
  }
  function halt() { clearTimeout(timer); gen++; if (ok) SS.cancel(); }
  function pause() { if (state !== 'play') return; halt(); state = 'pause'; ui(); }
  function resume() { if (state !== 'pause') return; state = 'play'; gen++; const g = gen; ui(); setTimeout(() => startItem(g), 60); }
  function jump(j) { if (state === 'off' || j < 0 || j >= Q.length) return; halt(); i = j; started = {}; state = 'play'; const g = gen; ui(); setTimeout(() => startItem(g), 60); }
  function stop() { halt(); state = 'off'; Q = []; mark(false); ui(); }

  // книга или конспект: читать с раздела sec (номер section.sec в контейнере)
  function readPage(root, sec, o) {
    const items = itemsOf(root);
    let from = items.findIndex(x => x.sec === sec); if (from < 0) from = 0;
    const label = it => { if (!it) return ''; const same = Q.filter(x => x.sec === it.sec); return `${it.sec >= 0 ? 'Раздел ' + (it.sec + 1) : 'Глава'} · ${same.indexOf(it) + 1} из ${same.length}`; };
    play(items, Object.assign({ label }, o), from);
    // щелчок по абзацу во время чтения — читать с него
    if (!root._tts) { root._tts = 1; root.addEventListener('click', e => {
      if (state === 'off') return;
      if (e.target.closest('a,button,summary,input,select,textarea,figure')) return;
      const j = Q.findIndex(x => x.el && x.el.contains(e.target)); if (j >= 0) jump(j);
    }); }
  }
  // карточки на слух: вопрос → пауза → ответ
  function readCards(b, keys, title, endHtml) {
    const strip = h => { const d = document.createElement('div'); d.innerHTML = h; d.querySelectorAll('pre').forEach(p => p.replaceWith(' (пример команд — на экране) ')); return d.innerText; };
    b.innerHTML = `<div class="card ttscard"><div class="row"><span class="muted">${title} на слух · <span class="tc-n"></span></span><span class="sp"></span><button class="btn sm" id="tcstop">Закончить</button></div>
      <div class="lbl muted" style="margin-top:10px">Вопрос</div><div class="tc-q content"></div><div class="tc-a" hidden><div class="lbl muted">Ответ</div><div class="tc-ab content"></div></div></div>
      <p class="muted" style="font-size:13.5px">Слушай вопрос и отвечай вслух в паузе, потом сверяйся с ответом. Прослушивание не меняет интервалы карточек: для них пройди обычное повторение.</p>`;
    const card = b.querySelector('.ttscard'), items = [];
    keys.forEach((key, n) => { const x = cardByKey(key); if (!x) return;
      const show = a => () => { b.querySelector('.tc-n').textContent = `${n + 1} из ${keys.length}`; b.querySelector('.tc-q').innerHTML = x.c[0]; b.querySelector('.tc-ab').innerHTML = x.c[1]; b.querySelector('.tc-a').hidden = !a; cliHighlight(card); };
      items.push({ el: card, text: 'Вопрос. ' + strip(x.c[0]), onStart: show(false), gap: 200 });
      items.push({ el: card, text: 'Ответ. ' + strip(x.c[1]), onStart: show(true), before: cfg.think * 1000, gap: 1200 });
    });
    b.querySelector('#tcstop').onclick = () => { stop(); route(); };
    play(items, { label: (it, n) => `карточка ${Math.floor(n / 2) + 1} из ${keys.length}`, onEnd: () => { b.innerHTML = `<div class="card" style="text-align:center"><div style="font-size:40px">🎧</div><h2 style="margin-top:4px">${title}: прослушано</h2><p class="muted">Чтобы карточки встали в расписание, пройди их обычным повторением с оценкой.</p>${endHtml || ''}</div>`; } });
  }
  function test(v) { const u = new SpeechSynthesisUtterance(speakable('Привет! Я буду читать тебе главы курса. OSPF, BGP и IS-IS, адрес 10.255.0.4/32.')); if (v) { u.voice = v; u.lang = v.lang; } u.rate = cfg.rate; SS.cancel(); SS.speak(u); }

  return {
    ok, cfg, saveCfg, voices: () => voices, ruVoices, voice, test, readPage, readCards, stop, speakable,
    busy: () => state !== 'off', state: () => state
  };
})();
