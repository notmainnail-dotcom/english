COURSE.add({
  id: 'ch13',
  time: '≈ 10 часов',
  intro: `<p>IGP всегда ведёт трафик кратчайшим путём. Если кратчайший путь забит, а соседний пустует, IGP с этим ничего не сделает. <b>Traffic Engineering</b> позволяет направлять трафик по путям, выбранным с учётом полосы, задержки, политик, и защищать его с переключением за 50 мс. Глава охватывает классический <b>RSVP-TE</b> (до сих пор в сетях почти всех крупных операторов) и современный <b>Segment Routing TE</b> с TI-LFA.</p>`,
  goals: [
    'Объяснить «проблему рыбы» и почему метрики IGP её не решают',
    'Описать четыре компонента RSVP-TE: распространение ресурсов в IGP, CSPF, сигнализация RSVP, направление трафика в туннель',
    'Понимать приоритеты и вытеснение, affinity, make-before-break, auto-bandwidth',
    'Объяснить FRR: facility backup (link и node protection), bypass, NHOP/NNHOP',
    'Понимать SR-TE (SID list, policy, color), PCE и TI-LFA и их отличия от RSVP-TE',
    'Диагностировать туннель, который не поднимается («no path», RSVP-ошибки)'
  ],
  why: `TE и FRR — это то, что обеспечивает SLA магистрали: защита от обрыва за 50 мс, загрузка параллельных путей, отдельные пути для голоса или IPTV. В заявках это выглядит как «после аварии трафик пошёл не туда», «туннель упал в down с причиной no path», «при обрыве потеряли секунду голоса».`,
  refs: [
    { t: 'RFC 3209 — RSVP-TE: Extensions to RSVP for LSP Tunnels', u: 'https://www.rfc-editor.org/rfc/rfc3209' },
    { t: 'RFC 4090 — Fast Reroute Extensions to RSVP-TE', u: 'https://www.rfc-editor.org/rfc/rfc4090' },
    { t: 'RFC 5305 (IS-IS TE), RFC 3630 (OSPF TE)', u: 'https://www.rfc-editor.org/rfc/rfc3630' },
    { t: 'RFC 8402 — Segment Routing Architecture; RFC 9256 — SR Policy Architecture', u: 'https://www.rfc-editor.org/rfc/rfc9256' },
    { t: 'draft-ietf-rtgwg-segment-routing-ti-lfa / RFC 9855', n: 'TI-LFA' },
    { t: 'E. Osborne, A. Simha — Traffic Engineering with MPLS (Cisco Press)', n: 'классика RSVP-TE' },
    { t: 'linkmeup — СДСМ ч. 13. MPLS Traffic Engineering', u: 'https://linkmeup.ru/blog/302.html', n: 'одна из лучших русскоязычных статей по TE' }
  ],
  theory: [
    {
      id: 'fish', h: 'Проблема рыбы',
      html: `
<div class="figure"><svg viewBox="0 0 560 200" width="560"><g font-family="Segoe UI" font-size="13">
<line x1="60" y1="100" x2="160" y2="100" stroke="var(--tx3)" stroke-width="3"/><line x1="160" y1="100" x2="260" y2="40" stroke="#ef4444" stroke-width="5"/><line x1="260" y1="40" x2="380" y2="40" stroke="#ef4444" stroke-width="5"/><line x1="380" y1="40" x2="480" y2="100" stroke="#ef4444" stroke-width="5"/>
<line x1="160" y1="100" x2="230" y2="160" stroke="var(--tx3)" stroke-width="3"/><line x1="230" y1="160" x2="320" y2="160" stroke="var(--tx3)" stroke-width="3"/><line x1="320" y1="160" x2="410" y2="160" stroke="var(--tx3)" stroke-width="3"/><line x1="410" y1="160" x2="480" y2="100" stroke="var(--tx3)" stroke-width="3"/>
<circle cx="60" cy="100" r="16" fill="#2563eb"/><circle cx="160" cy="100" r="16" fill="#2563eb"/><circle cx="260" cy="40" r="16" fill="#2563eb"/><circle cx="380" cy="40" r="16" fill="#2563eb"/><circle cx="480" cy="100" r="16" fill="#2563eb"/><circle cx="230" cy="160" r="16" fill="#2563eb"/><circle cx="320" cy="160" r="16" fill="#2563eb"/><circle cx="410" cy="160" r="16" fill="#2563eb"/>
<text x="320" y="25" fill="#ef4444" text-anchor="middle" font-weight="700">короткий путь: перегружен</text><text x="320" y="190" fill="var(--tx2)" text-anchor="middle">длинный путь: простаивает</text></g></svg>
<div class="cap">«Рыба»: весь трафик идёт по кратчайшему пути, параллельный простаивает</div></div>
<p>Можно поднять метрику верхнего пути, но тогда <b>весь</b> трафик уйдёт вниз, и перегрузится уже он. IGP не умеет делить трафик по долям или вести разные потоки разными путями (кроме ECMP при строго равных метриках). Нужна маршрутизация, которая учитывает ресурсы и политику: это TE.</p>`
    },
    {
      id: 'rsvp', h: 'RSVP-TE: четыре компонента',
      html: `
<ol class="steps">
<li><b>Распространение информации о ресурсах.</b> IGP с TE-расширениями (OSPF opaque LSA 10, IS-IS TLV 22) рассказывает про каждый линк: максимальная полоса, резервируемая полоса, <b>свободная полоса по 8 приоритетам</b>, TE-метрика, административные группы (affinity, «цвета» линков), SRLG (общие риски: два линка в одном кабеле). Получается <b>TED</b> (TE database).</li>
<li><b>Вычисление пути — CSPF.</b> Headend (головной маршрутизатор туннеля) убирает из графа линки, которые не подходят по ограничениям (мало свободной полосы, «не тот цвет»), и на оставшемся графе запускает SPF. Или путь задан явно (<b>explicit path</b>) — список хопов strict/loose.</li>
<li><b>Сигнализация — RSVP.</b> Headend шлёт <b>PATH</b> по вычисленному пути (ERO — explicit route object). Каждый узел проверяет и резервирует полосу. Tail отвечает <b>RESV</b> обратно, и по пути раздаются метки (как LDP, только по запросу и вдоль пути). LSP поднят. Состояние (soft state) поддерживается периодическим обновлением PATH/RESV.</li>
<li><b>Направление трафика в туннель.</b> Сам туннель трафик не притягивает. Варианты: статика в tunnel-интерфейс, <b>autoroute announce</b> (IGP считает туннель линком headend → tail для своих SPF), forwarding adjacency (анонсировать туннель в IGP всем), PBR, CBTS (по классу QoS), в SR — color/ODN.</li></ol>
<pre class="cli">interface Tunnel10
 ip unnumbered Loopback0
 tunnel mode mpls traffic-eng
 tunnel destination 10.255.0.6
 tunnel mpls traffic-eng bandwidth 30000              ! 30 Мбит/с
 tunnel mpls traffic-eng priority 5 5                 ! setup / hold
 tunnel mpls traffic-eng path-option 1 explicit name VIA-SOUTH
 tunnel mpls traffic-eng path-option 2 dynamic        ! запасной вариант
 tunnel mpls traffic-eng autoroute announce
 tunnel mpls traffic-eng fast-reroute
ip explicit-path name VIA-SOUTH enable
 next-address 10.255.0.4
 next-address 10.255.0.5
R1#show mpls traffic-eng tunnels Tunnel10
  Admin: up         Oper: [[up]]   Path: valid       Signalling: connected
    path option 1, type explicit VIA-SOUTH (Basis for Setup, path weight 30)
  RSVP Path Info:
      Explicit Route: 10.1.14.1 10.1.45.1 10.1.56.1 10.255.0.6
R1#show ip rsvp reservation
R1#show mpls traffic-eng topology brief</pre>`
    },
    {
      id: 'pol', h: 'Приоритеты, affinity, оптимизация',
      html: `
<ul><li><b>Приоритеты setup/hold</b> (0 — высший, 7 — низший). Новый LSP с setup 2 может <b>вытеснить</b> (preempt) существующий с hold 3+, если не хватает полосы. Так голос и важные сервисы получают путь в первую очередь.</li>
<li><b>Affinity / admin groups</b>: линкам присваивают «цвета» (биты: «спутник», «дорогой», «через Казахстан»), а туннелю — маску: «только зелёные» или «не через красные».</li>
<li><b>SRLG</b>: при поиске резервного пути исключить линки с общим риском (одна траншея, одна DWDM-система).</li>
<li><b>Make-before-break</b>: при изменении пути новый LSP поднимается рядом со старым (shared explicit reservation, полоса не считается дважды), трафик переключается, и только потом старый удаляется. Без потерь.</li>
<li><b>Reoptimization</b>: периодический пересчёт (таймер) — не появился ли путь лучше.</li>
<li><b>Auto-bandwidth</b>: туннель сам измеряет свой трафик и периодически подстраивает резервируемую полосу.</li></ul>
<div class="callout warn"><b>Резервирование ≠ полисинг</b>RSVP-TE резервирует полосу только <b>в контрольной плоскости</b> (бухгалтерия). Если туннель зарезервировал 30 Мбит/с, а в него льётся 100 — никто это не ограничит (если нет QoS-полисера). Поэтому auto-bandwidth и мониторинг обязательны.</div>`
    },
    {
      id: 'frr', h: 'Fast Reroute: защита за 50 мс',
      html: `
<p>Обычная сходимость RSVP-TE (headend узнаёт об отказе, считает новый путь, сигнализирует) занимает секунды. <b>FRR</b> (RFC 4090) — локальная защита: обход заранее поднят, и при отказе узел, обнаруживший его (<b>PLR</b>, point of local repair), сразу переключает трафик в обход.</p>
<table><tr><th>Вид</th><th>Как</th></tr>
<tr><td><b>Facility backup (bypass)</b></td><td>один bypass-туннель защищает <b>все</b> LSP через данный линк или узел. Масштабируется. Используется в 95% случаев</td></tr>
<tr><td>One-to-one (detour)</td><td>отдельный обход для каждого LSP. Не масштабируется</td></tr>
<tr><td><b>Link protection</b></td><td>bypass от PLR до следующего узла (<b>NHOP</b>) в обход линка</td></tr>
<tr><td><b>Node protection</b></td><td>bypass от PLR до узла через один (<b>NNHOP</b>), в обход следующего узла целиком</td></tr></table>
<p>Как это работает в data plane: PLR снимает метку защищаемого LSP, ставит метку, которую ожидает merge point (узел, где bypass вливается в основной путь), и сверху метку bypass-туннеля. Пакет доходит по bypass и дальше по основному пути. Headend получает уведомление (PathErr) и спокойно, через make-before-break, пересчитывает основной путь.</p>
<pre class="cli">R2(config)#interface Tunnel100
R2(config-if)#description BYPASS-R2-R3-link
R2(config-if)#tunnel destination 10.255.0.3
R2(config-if)#tunnel mpls traffic-eng path-option 1 explicit name AROUND-R2R3
R2(config)#interface Gi0/2
R2(config-if)#mpls traffic-eng backup-path Tunnel100      ! защищает линк Gi0/2
R1#show mpls traffic-eng tunnels protection
R2#show mpls traffic-eng fast-reroute database</pre>
<div class="callout pro"><b>Обнаружение — тоже важно</b>FRR срабатывает по сигналу о падении линка: потеря сигнала на оптике — мгновенно. Если линк через транспорт и интерфейс не гаснет — нужен <b>BFD</b> (глава 6), иначе «защита за 50 мс» сработает через 40 секунд.</div>`
    },
    {
      id: 'sr', h: 'Segment Routing TE, PCE и TI-LFA',
      html: `
<p>RSVP-TE держит состояние каждого LSP на каждом транзитном узле (тысячи туннелей = тысячи состояний на P) и требует сигнализации. <b>SR-TE</b> устроен иначе: путь кодируется на headend <b>списком сегментов</b> (SID list), транзитные узлы просто выполняют инструкции из стека меток. Состояний в ядре нет.</p>
<ul><li><b>Prefix-SID</b> (node): «доберись до узла N кратчайшим путём» (с ECMP!). <b>Adjacency-SID</b>: «выйди через этот линк». Путь: [16005, 24012, 16009] = «до R5, затем линк R5→R7, затем до R9».</li>
<li><b>SR Policy</b> (RFC 9256): <b>headend + color + endpoint</b>. Color — «намерение» (low-latency, avoid-red). Маршруты BGP с extended community color автоматически притягиваются в нужную политику (<b>ODN</b>, on-demand next-hop, и automated steering).</li>
<li><b>PCE</b> (Path Computation Element): путь считает централизованный контроллер, видящий всю сеть и все потребности (через BGP-LS), и спускает его на headend по <b>PCEP</b>. Решает задачи, которые CSPF на одном headend не видит (глобальная оптимизация, непересекающиеся пути двух разных туннелей).</li>
<li><b>Flex-Algo</b>: несколько «вариантов IGP» в одной сети (по задержке, без определённых линков) — SPF по другой метрике, и свои SID на каждый алгоритм.</li>
<li><b>TI-LFA</b> (Topology-Independent LFA): для каждого префикса заранее считается обход по <b>post-convergence</b> пути (каким он станет после сходимости) и кодируется стеком SID. Защищает 100% топологий (классический LFA — нет), переключение меньше 50 мс, без bypass-туннелей и без RSVP.</li></ul>
<table><tr><th></th><th>RSVP-TE</th><th>SR-TE</th></tr>
<tr><td>Состояние на транзите</td><td>на каждый LSP</td><td>нет</td></tr>
<tr><td>Сигнализация</td><td>RSVP PATH/RESV</td><td>нет (метки из IGP)</td></tr>
<tr><td>Резервирование полосы</td><td>да (в control plane)</td><td>нет встроенного, через PCE</td></tr>
<tr><td>Защита</td><td>FRR bypass</td><td>TI-LFA</td></tr>
<tr><td>ECMP по пути</td><td>нет (один путь)</td><td>да (node-SID использует ECMP)</td></tr>
<tr><td>Стек меток</td><td>1 транспортная</td><td>может быть глубоким (MSD — ограничение железа)</td></tr></table>`
    },
    {
      id: 'ts', h: 'Диагностика TE',
      html: `
<table><tr><th>Симптом</th><th>Где смотреть</th></tr>
<tr><td>Туннель down, «No path» / «path option unknown»</td><td><code>show mpls traffic-eng tunnels</code> — причина. TED: <code>show mpls traffic-eng topology</code> — есть ли линки, хватает ли полосы, совпадает ли affinity. TE включён в IGP на всех узлах и интерфейсах? RSVP bandwidth на интерфейсах?</td></tr>
<tr><td>Path valid, Signalling down</td><td>RSVP по пути: <code>show ip rsvp interface</code>, <code>debug ip rsvp</code> — PathErr/ResvErr на каком узле, admission control (нет полосы), LDP/MPLS на интерфейсе</td></tr>
<tr><td>Туннель up, трафик не идёт в него</td><td>autoroute/статика/PBR: <code>show ip route</code> — указывает ли маршрут в Tunnel. <code>show mpls traffic-eng autoroute</code></td></tr>
<tr><td>Трафик в туннеле, но потери</td><td>реальная загрузка против резервирования, QoS, MTU (туннельная метка + сервисные)</td></tr>
<tr><td>FRR не сработал</td><td><code>show mpls traffic-eng tunnels protection</code>: «Ready»? Обнаружение отказа (BFD)? Bypass физически не идёт ли по тому же линку (SRLG)?</td></tr></table>`
    }
  ],
  cmds: [
    { g: 'Включение TE' },
    { c: 'mpls traffic-eng tunnels (глобально и на интерфейсе)', d: 'Включить TE', hw: 'mpls te (глобально и на интерфейсе)', jn: 'set protocols mpls interface X; set protocols rsvp interface X' },
    { c: 'ip rsvp bandwidth 100000 (на интерфейсе)', d: 'Резервируемая полоса линка, кбит/с', hw: 'mpls te bandwidth max-reservable-bandwidth 100000', jn: 'set protocols rsvp interface X bandwidth 100m' },
    { c: 'router isis\n metric-style wide\n mpls traffic-eng router-id Lo0\n mpls traffic-eng level-2', d: 'TE-расширения в IS-IS', hw: 'isis 1\n traffic-eng level-2', jn: 'set protocols isis traffic-engineering' },
    { c: 'router ospf 1\n mpls traffic-eng router-id Lo0\n mpls traffic-eng area 0', d: 'TE-расширения в OSPF', hw: 'ospf 1\n opaque-capability enable\n area 0 / mpls-te enable', jn: 'set protocols ospf traffic-engineering' },
    { c: 'mpls traffic-eng attribute-flags 0x1 (на интерфейсе)', d: 'Admin group (цвет) линка', hw: 'mpls te link administrative group 1', jn: 'admin-group red' },
    { g: 'Туннель' },
    { c: 'interface Tunnel10\n tunnel mode mpls traffic-eng\n tunnel destination X\n tunnel mpls traffic-eng path-option 1 dynamic', d: 'Туннель RSVP-TE', hw: 'interface Tunnel0/0/10\n tunnel-protocol mpls te\n destination X\n mpls te commit', jn: 'set protocols mpls label-switched-path L to X' },
    { c: 'tunnel mpls traffic-eng bandwidth 30000\ntunnel mpls traffic-eng priority 5 5', d: 'Полоса и приоритеты', hw: 'mpls te bandwidth ct0 30000 / mpls te priority 5 5', jn: 'bandwidth 30m / priority 5 5' },
    { c: 'ip explicit-path name P enable\n next-address X [loose]', d: 'Явный путь', hw: 'explicit-path P\n next hop X', jn: 'set protocols mpls path P X strict' },
    { c: 'tunnel mpls traffic-eng affinity 0x0 mask 0x1', d: 'Избегать линков с битом 0x1', hw: 'mpls te affinity property …', jn: 'admin-group exclude red' },
    { c: 'tunnel mpls traffic-eng autoroute announce', d: 'Использовать туннель в SPF headend', hw: 'mpls te igp shortcut isis', jn: 'install / igp-shortcut' },
    { c: 'tunnel mpls traffic-eng auto-bw', d: 'Авто-подстройка полосы', hw: 'mpls te auto-bandwidth adjustment', jn: 'auto-bandwidth' },
    { c: 'tunnel mpls traffic-eng fast-reroute [node-protect]', d: 'Запросить FRR для LSP', hw: 'mpls te fast-reroute', jn: 'fast-reroute / link-protection / node-link-protection' },
    { c: 'mpls traffic-eng backup-path TunnelN (на интерфейсе PLR)', d: 'Bypass для линка', hw: 'mpls te bypass-tunnel', jn: 'link-protection на интерфейсе rsvp' },
    { g: 'Проверка' },
    { c: 'show mpls traffic-eng tunnels [brief | protection]', d: 'Состояние туннелей, путь, причина down, FRR', hw: 'display mpls te tunnel-interface', jn: 'show mpls lsp extensive' },
    { c: 'show mpls traffic-eng topology [brief]', d: 'TED: линки, полосы, affinity', hw: 'display mpls te cspf tedb all', jn: 'show ted database extensive' },
    { c: 'show ip rsvp interface / reservation / sender', d: 'RSVP: полоса, резервирования', hw: 'display mpls rsvp-te', jn: 'show rsvp session / interface' },
    { c: 'show mpls traffic-eng fast-reroute database', d: 'Защищённые LSP и bypass', hw: 'display mpls te fast-reroute', jn: 'show rsvp session detail' },
    { g: 'Segment Routing (IOS-XE / XR)' },
    { c: 'segment-routing mpls\nrouter isis\n segment-routing mpls\ninterface Loopback0\n isis prefix-sid index 5', d: 'SR-MPLS и Node-SID', hw: 'segment-routing\n isis … segment-routing mpls\n isis prefix-sid index 5', jn: 'source-packet-routing node-segment ipv4-index 5' },
    { c: 'router isis\n fast-reroute per-prefix level-2 all\n fast-reroute ti-lfa level-2', d: 'TI-LFA (синтаксис зависит от платформы)', hw: 'frr / ti-lfa', jn: 'backup-spf-options use-post-convergence-lfa' }
  ],
  cards: [
    ['Что такое «проблема рыбы»?', 'IGP ведёт весь трафик по кратчайшему пути. Он перегружен, параллельный простаивает, а изменение метрики просто переносит всю нагрузку.'],
    ['Четыре компонента RSVP-TE?', '1) Распространение ресурсов линков в IGP (TED). 2) Вычисление пути CSPF или явный путь. 3) Сигнализация RSVP PATH/RESV с резервированием и метками. 4) Направление трафика в туннель (autoroute, статика, PBR).'],
    ['Что такое CSPF?', 'Constrained SPF: удалить из графа линки, не удовлетворяющие ограничениям (полоса, affinity, SRLG), затем SPF по TE-метрике.'],
    ['PATH и RESV в RSVP?', 'PATH — от headend к tail по ERO, запрос и резервирование. RESV — от tail обратно с раздачей меток и подтверждением.'],
    ['Setup/hold priority?', '0 — высший, 7 — низший. LSP с setup X может вытеснить LSP с hold хуже (больше) X при нехватке полосы.'],
    ['Что такое make-before-break?', 'Новый LSP поднимается рядом со старым (без двойного учёта полосы), трафик переключается, старый удаляется. Без потерь при изменении пути.'],
    ['Резервирует ли RSVP-TE полосу в data plane?', 'Нет, только учёт в control plane. Без полисера туннель может пропускать больше, чем зарезервировал.'],
    ['Facility backup vs one-to-one?', 'Facility (bypass): один обход на все LSP через линк/узел, масштабируется. One-to-one (detour): отдельный обход на каждый LSP.'],
    ['Link vs node protection?', 'Link: bypass до следующего узла (NHOP) в обход линка. Node: bypass до узла через один (NNHOP) в обход следующего узла.'],
    ['Что такое PLR и merge point?', 'PLR — узел, обнаруживший отказ и переключивший в обход. Merge point — узел, где bypass вливается обратно в основной путь.'],
    ['SR-TE: главное отличие от RSVP-TE?', 'Путь кодируется списком сегментов на headend, состояния на транзите нет и нет сигнализации. Node-SID использует ECMP.'],
    ['Что такое SR Policy и color?', 'Политика (headend, color, endpoint) с одним или несколькими SID list. Color — «намерение». BGP-маршруты с color-community автоматически направляются в нужную политику (ODN).'],
    ['Зачем PCE?', 'Централизованное вычисление путей с видом на всю сеть (BGP-LS) и спуск на headend по PCEP: глобальная оптимизация, непересекающиеся пути.'],
    ['Что такое TI-LFA?', 'Топологически независимый LFA для SR: обход по post-convergence пути, закодированный SID-стеком. 100% покрытие, < 50 мс.'],
    ['Туннель down с «No path». Что смотреть?', 'TED (show mpls traffic-eng topology): есть ли линки с TE, хватает ли свободной полосы, affinity, TE в IGP на всех узлах, RSVP bandwidth на интерфейсах.']
  ],
  quiz: [
    { q: 'Почему нельзя решить «проблему рыбы» просто увеличив метрику IGP перегруженного пути?', o: ['IGP не позволяет менять метрики', 'Весь трафик перейдёт на другой путь и перегрузит его: IGP не делит трафик по долям', 'Сломается BGP', 'Это решит проблему'], a: 1, e: 'IGP выбирает один лучший путь (или ECMP при строгом равенстве).' },
    { q: 'Туннель в состоянии «Path: valid, Signalling: down». Где проблема?', o: ['В CSPF', 'В сигнализации RSVP по пути (admission control, RSVP/MPLS на интерфейсе узла)', 'В autoroute', 'В BGP'], a: 1, e: 'Путь вычислен, но PATH/RESV не прошли. Ищи PathErr.' },
    { q: 'Туннель up, но трафик к tail идёт мимо него по IGP. Чего не хватает?', o: ['Полосы', 'Механизма направления: autoroute announce, статики или PBR', 'FRR', 'Affinity'], a: 1, e: 'Сам туннель трафик не притягивает.' },
    { q: 'LSP голоса (setup 1, hold 1) не может подняться из-за нехватки полосы. На пути LSP данных с hold 6. Что произойдёт?', o: ['Голос не поднимется', 'LSP голоса вытеснит LSP данных (preemption)', 'Оба упадут', 'Резервирование удвоится'], a: 1, e: 'Setup 1 лучше hold 6, данные вытесняются и ищут другой путь.' },
    { q: 'Link protection: bypass идёт от PLR до…', o: ['Tail туннеля', 'Следующего узла (NHOP)', 'Узла через один (NNHOP)', 'Headend'], a: 1, e: 'Обход линка до следующего узла. Node protection — до NNHOP.' },
    { q: 'FRR настроен и в состоянии Ready, но при обрыве в DWDM трафик пропал на 40 с. Почему?', o: ['FRR не работает с DWDM', 'Интерфейс не погас, отказ не обнаружен: нужен BFD', 'Мало полосы на bypass', 'Неверный приоритет'], a: 1, e: 'FRR срабатывает по сигналу об отказе. Без LoS и без BFD сигнала нет.' },
    { q: 'Что из этого верно про SR-TE в сравнении с RSVP-TE? (несколько)', o: ['Нет состояний LSP на транзитных узлах', 'Нет сигнализации RSVP', 'Node-SID может использовать ECMP', 'Встроенное резервирование полосы на каждом узле'], a: [0, 1, 2], e: 'Резервирования полосы в SR нет, это задача PCE.' },
    { q: 'Зачем SRLG при вычислении резервного пути?', o: ['Для ускорения CSPF', 'Чтобы резерв не шёл по линкам с общим риском (тот же кабель или траншея)', 'Для QoS', 'Для affinity'], a: 1, e: 'Два «разных» линка в одной траншее падают вместе.' },
    { q: 'Какой механизм SR даёт защиту для 100% топологий?', o: ['LFA', 'TI-LFA', 'RSVP FRR', 'ECMP'], a: 1, e: 'Классический LFA покрывает не всё (кольца). TI-LFA использует стек SID.' }
  ],
  und: [
    { q: 'Объясни, как поднимается RSVP-TE туннель с требованием 30 Мбит/с, от настройки до прохождения первого пакета.', a: '<p>IGP с TE-расширениями уже разослал по сети информацию о линках: свободная полоса по приоритетам, affinity, TE-метрика. На headend получилась TED. Headend запускает CSPF: выкидывает линки, где свободно меньше 30 Мбит/с (или не подходит affinity), и считает кратчайший путь по остатку (или берёт явный путь). По этому пути шлёт RSVP PATH с ERO. Каждый узел проверяет admission control и резервирует 30 Мбит/с. Tail отвечает RESV обратно: каждый узел выдаёт метку предыдущему. LSP установлен. Чтобы туда пошёл трафик, нужен autoroute announce (туннель как линк в SPF headend), статика или PBR. Пакет на headend получает метку туннеля, транзит делает swap по RSVP-меткам, на конце PHP.</p>', k: ['TED из IGP', 'CSPF или explicit', 'PATH с ERO, резервирование', 'RESV с метками', 'направление трафика'] },
    { q: 'Сравни защиту RSVP-TE FRR и SR TI-LFA: как каждая работает и что лучше для новой сети.', a: '<p>FRR: заранее подняты bypass-туннели (link/node protection) по RSVP. PLR при отказе ставит пакеты основного LSP в bypass до merge point (метка MP + метка bypass), headend затем перестраивает основной путь через make-before-break. Нужны RSVP-состояния и настройка bypass (или auto-tunnel). TI-LFA: для каждого префикса IGP заранее вычисляет обход по пути, который станет кратчайшим после сходимости, и кодирует его стеком SID. При отказе PLR сразу шлёт по нему. Покрытие 100% топологий, без RSVP-состояний и сигнализации, путь совпадает с итоговым после сходимости (без лишних переключений). Для новой сети — SR с TI-LFA. RSVP-TE остаётся там, где нужно жёсткое резервирование полосы или он уже есть.</p>', k: ['FRR: bypass, PLR, merge point', 'TI-LFA: post-convergence, SID-стек', 'состояния и сигнализация', 'покрытие', 'выбор'] }
  ],
  lab: {
    title: 'Лаба 13. Рыба, туннели и FRR',
    time: '≈ 3–4 часа',
    goal: `<p>Топология «рыба»: R1 → R6 через короткий верхний путь (R2–R3) и длинный нижний (R4–R5). IS-IS и LDP уже работают. Включить TE, поднять туннели с резервированием полосы, явным путём и affinity, увидеть вытеснение, защитить линк R2–R3 через FRR bypass.</p>`,
    topo: {
      w: 880, h: 380,
      nodes: [
        { id: 'R1', t: 'pe', x: 80, y: 190, label: 'R1 headend\nLo0 10.255.0.1', role: 'headend' },
        { id: 'R2', t: 'p', x: 260, y: 80, label: 'R2\n10.255.0.2', role: 'P' },
        { id: 'R3', t: 'p', x: 560, y: 80, label: 'R3\n10.255.0.3', role: 'P' },
        { id: 'R4', t: 'p', x: 260, y: 300, label: 'R4\n10.255.0.4', role: 'P' },
        { id: 'R5', t: 'p', x: 560, y: 300, label: 'R5\n10.255.0.5', role: 'P' },
        { id: 'R6', t: 'pe', x: 780, y: 190, label: 'R6 tail\nLo0 10.255.0.6', role: 'tail' }
      ],
      links: [['R1', 'Gi0/0', 'R2', 'Gi0/0', 'metric 10'], ['R2', 'Gi0/1', 'R3', 'Gi0/1', '«красный» 10'], ['R3', 'Gi0/2', 'R6', 'Gi0/0', '10'], ['R1', 'Gi0/1', 'R4', 'Gi0/0', '20'], ['R4', 'Gi0/1', 'R5', 'Gi0/1', '20'], ['R5', 'Gi0/2', 'R6', 'Gi0/1', '20'], ['R2', 'Gi0/2', 'R4', 'Gi0/2', 'перемычка 20'], ['R3', 'Gi0/3', 'R5', 'Gi0/3', 'перемычка 20']]
    },
    addr: [['Линки', 'Rx–Ry', '10.1.xy.0/31 (меньший .0)'], ['Loopback0', '', '10.255.0.N/32'], ['RSVP bandwidth', 'все линки', '100 Мбит/с (100000)']],
    init: (function () {
      const b = n => `hostname R${n}\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.${n} 255.255.255.255\n ip router isis CORE\nmpls ldp router-id Loopback0 force\nrouter isis CORE\n net 49.0001.0000.0000.000${n}.00\n is-type level-2-only\n metric-style wide\n passive-interface Loopback0\n mpls ldp autoconfig\nline con 0\n logging synchronous\n exec-timeout 0 0\n`;
      const i = (ifc, a, b2, me) => { const x = Math.min(a, b2), y = Math.max(a, b2); return `interface ${ifc}\n ip address 10.1.${x}${y}.${a === x ? 0 : 1} 255.255.255.254\n ip router isis CORE\n isis network point-to-point\n isis metric ${me}\n no shutdown\n`; };
      return {
        R1: b(1) + i('Gi0/0', 1, 2, 10) + i('Gi0/1', 1, 4, 20),
        R2: b(2) + i('Gi0/0', 2, 1, 10) + i('Gi0/1', 2, 3, 10) + i('Gi0/2', 2, 4, 20),
        R3: b(3) + i('Gi0/1', 3, 2, 10) + i('Gi0/2', 3, 6, 10) + i('Gi0/3', 3, 5, 20),
        R4: b(4) + i('Gi0/0', 4, 1, 20) + i('Gi0/1', 4, 5, 20) + i('Gi0/2', 4, 2, 20),
        R5: b(5) + i('Gi0/1', 5, 4, 20) + i('Gi0/2', 5, 6, 20) + i('Gi0/3', 5, 3, 20),
        R6: b(6) + i('Gi0/0', 6, 3, 10) + i('Gi0/1', 6, 5, 20)
      };
    })(),
    pre: 'IS-IS (wide) и LDP работают. Кратчайший путь R1 → R6: R1–R2–R3–R6 (метрика 30). Проверь <code>traceroute 10.255.0.6 source Lo0</code> на R1.',
    tasks: [
      { t: 'Включи TE', d: 'На всех: <code>mpls traffic-eng tunnels</code> глобально и на всех линках, <code>ip rsvp bandwidth 100000</code> на линках, в IS-IS — <code>mpls traffic-eng router-id Loopback0</code> и <code>mpls traffic-eng level-2</code>. Проверь TED на R1.',
        check: 'R1#show mpls traffic-eng topology brief\nR1#show ip rsvp interface',
        sol: 'R2(config)#mpls traffic-eng tunnels\nR2(config)#interface range Gi0/0 - 2\nR2(config-if-range)#mpls traffic-eng tunnels\nR2(config-if-range)#ip rsvp bandwidth 100000\nR2(config)#router isis CORE\nR2(config-router)#mpls traffic-eng router-id Loopback0\nR2(config-router)#mpls traffic-eng level-2' },
      { t: 'Динамический туннель с полосой', d: 'На R1 Tunnel10 к R6: bandwidth 60000, path-option dynamic, autoroute announce. Каким путём пошёл? Подними Tunnel11 с bandwidth 60000 тем же способом. Каким путём пошёл второй и почему?',
        check: 'R1#show mpls traffic-eng tunnels brief\nR1#show mpls traffic-eng tunnels Tunnel11 | include Explicit|path\nR2#show ip rsvp reservation',
        sol: 'R1(config)#interface Tunnel10\nR1(config-if)#ip unnumbered Loopback0\nR1(config-if)#tunnel mode mpls traffic-eng\nR1(config-if)#tunnel destination 10.255.0.6\nR1(config-if)#tunnel mpls traffic-eng bandwidth 60000\nR1(config-if)#tunnel mpls traffic-eng path-option 1 dynamic\nR1(config-if)#tunnel mpls traffic-eng autoroute announce\n! Tunnel11 так же — на верхнем пути осталось 40 Мбит/с, CSPF уводит его вниз' },
      { t: 'Явный путь и affinity', d: 'Пометь линк R2–R3 «красным» (<code>mpls traffic-eng attribute-flags 0x1</code> на обоих концах). Сделай Tunnel12, который избегает красных линков (affinity 0x0 mask 0x1), и Tunnel13 с явным путём через R4–R5. Проверь пути.',
        check: 'R1#show mpls traffic-eng topology 10.255.0.2 | include attribute\nR1#show mpls traffic-eng tunnels Tunnel12 | include Explicit' },
      { t: 'Вытеснение', d: 'Пусть Tunnel10 и Tunnel11 будут с приоритетом 7/7 и занимают полосу. Создай Tunnel20 (bandwidth 80000, priority 1 1, только верхний путь явно). Что случилось с туннелями 7/7?',
        check: 'R1#show mpls traffic-eng tunnels brief\nR1#show logging | include TUNNEL|preempt' },
      { t: 'FRR: защити линк R2–R3', d: 'Запроси fast-reroute на Tunnel20. На R2 создай bypass Tunnel100 к R3 в обход линка R2–R3 (явный путь через R4–R5) и назначь его <code>backup-path</code> на интерфейсе R2 Gi0/1. Проверь статус защиты «Ready». Запусти пинг через туннель и выключи R2 Gi0/1: сколько потерь? Что стало с Tunnel20 через несколько секунд?',
        check: 'R1#show mpls traffic-eng tunnels protection\nR2#show mpls traffic-eng fast-reroute database\nR1#ping 10.255.0.6 source Lo0 repeat 10000 timeout 1' }
    ],
    brk: [
      { t: 'Новый туннель Tunnel30 к R6 down: «no path»', inj: 'R1(config)#interface Tunnel30\nR1(config-if)#ip unnumbered Loopback0\nR1(config-if)#tunnel mode mpls traffic-eng\nR1(config-if)#tunnel destination 10.255.0.6\nR1(config-if)#tunnel mpls traffic-eng bandwidth 150000\nR1(config-if)#tunnel mpls traffic-eng path-option 1 dynamic', h: '<code>show mpls traffic-eng tunnels Tunnel30</code> — причина. Сколько можно зарезервировать на линках?', f: 'Запрошено 150 Мбит/с, а резервируемая полоса линка 100 Мбит/с: CSPF не находит ни одного подходящего пути. Уменьши требование или увеличь ip rsvp bandwidth (если это соответствует реальности).' },
      { t: 'Туннель перестал ходить нижним путём, нижние линки исчезли из TED', inj: 'R4(config)#router isis CORE\nR4(config-router)#no mpls traffic-eng level-2', h: '<code>show mpls traffic-eng topology</code> на R1 — есть ли узел R4 и его линки?', f: 'На R4 выключены TE-расширения в IS-IS: его линки не попадают в TED, и CSPF не может строить пути через R4. TE должен быть включён в IGP на всех узлах.' }
    ],
    extra: '<p><b>SR-TE и TI-LFA (CSR1000v).</b> На шести CSR: <code>segment-routing mpls</code>, prefix-SID на Lo0, выключи LDP. Включи TI-LFA в IS-IS и посмотри <code>show isis fast-reroute ti-lfa tunnel</code> — какие стеки SID используются как обходы. Затем сделай SR-policy (color 100, endpoint R6) с явным SID-list через R4 и R5 и привяжи к ней маршрут.</p>'
  }
});
