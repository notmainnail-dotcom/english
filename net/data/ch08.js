COURSE.add({
  id: 'ch08',
  time: '≈ 12–15 часов (2 недели в норме)',
  intro: `<p>«Лифт ми Ап» получает свою автономную систему и подключается к двум провайдерам. Это BGP, протокол, на котором держится весь интернет. Для тебя это самая важная глава Части II: на стыках провайдера с клиентами, пирами и аплинками работает только BGP. Глава построена с обеих сторон: ты настраиваешь и <b>клиента</b> (multihoming, балансировка), и <b>провайдера</b> (фильтрация клиента, max-prefix, community, blackhole).</p>
<p class="muted">Стартовая оценка BGP — 1/10, поэтому глава подробная. Не торопись: две недели в норме — нормальный темп.</p>`,
  goals: [
    'Объяснить устройство интернета: AS, транзит, пиринг, клиенты, IX, PI/PA и откуда берутся номера',
    'Поднять eBGP-сессию, читать состояния FSM и по ним сразу назвать проблему',
    'Читать show ip bgp как родной: *, >, i, next-hop, path, origin; понимать Adj-RIB-In/Out',
    'Назвать алгоритм выбора лучшего пути по шагам и предсказать выбор маршрутизатора',
    'Писать политики: prefix-list с ge/le, as-path regex, community, route-map. Управлять входящим и исходящим трафиком',
    'Защищать стык: фильтры клиента, max-prefix, bogons, RPKI, GTSM. Делать RTBH-blackhole по community',
    'Отслеживать доступность через IP SLA + track и BFD'
  ],
  why: `BGP — это работа инженера провайдера: подключение клиентов с их AS, приём и анонс префиксов, пиринг на IX, выбор аплинков, борьба с DDoS через blackhole, расследование «у клиента пропал префикс в интернете». Ошибка в BGP-фильтре может положить чужие сети в масштабе страны (route leak), такие истории попадают в новости.`,
  refs: [
    { t: 'RFC 4271 — A Border Gateway Protocol 4 (BGP-4)', u: 'https://www.rfc-editor.org/rfc/rfc4271', n: 'первоисточник: FSM, сообщения, атрибуты, выбор пути' },
    { t: 'RFC 1997 (communities), RFC 8092 (large communities), RFC 7999 (BLACKHOLE community)', u: 'https://www.rfc-editor.org/rfc/rfc7999' },
    { t: 'RFC 6811 — BGP Prefix Origin Validation (RPKI)', u: 'https://www.rfc-editor.org/rfc/rfc6811' },
    { t: 'RFC 7454 — BGP Operations and Security', u: 'https://www.rfc-editor.org/rfc/rfc7454', n: 'чек-лист фильтров провайдера' },
    { t: 'Cisco: BGP Best Path Selection Algorithm', u: 'https://www.cisco.com/c/en/us/support/docs/ip/border-gateway-protocol-bgp/13753-25.html' },
    { t: 'S. Halabi — Internet Routing Architectures', n: 'классика: политики, multihoming, экономика' },
    { t: 'I. Pepelnjak — ipspace.net, BGP-статьи', u: 'https://blog.ipspace.net/tag/bgp/' },
    { t: 'MANRS — Mutually Agreed Norms for Routing Security', u: 'https://www.manrs.org/' },
    { t: 'Инструменты: bgp.he.net, RIPEstat, RIPE RIS, looking glass', u: 'https://stat.ripe.net/' }
  ],
  theory: [
    {
      id: 'inet', h: 'Как устроен интернет: AS, транзит, пиринг',
      html: `
<p><b>Автономная система (AS)</b> — сети под единой политикой маршрутизации: провайдер, крупная компания, облако. У каждой — номер <b>ASN</b>. Номера и PI-адреса раздают RIR (для России и Европы — RIPE NCC) через своих членов LIR.</p>
<table><tr><th>ASN</th><th>Диапазон</th></tr>
<tr><td>16-битные публичные</td><td>1 – 64495</td></tr>
<tr><td>частные 16-бит</td><td>64512 – 65534 (как RFC1918 для AS)</td></tr>
<tr><td>32-битные (asdot 1.10 = asplain 65546)</td><td>до 4 294 967 295, частные: 4200000000 – 4294967294</td></tr>
<tr><td>документация (примеры)</td><td>64496–64511, 65536–65551</td></tr></table>
<h3>Экономика: кто кому платит</h3>
<div class="vs"><div><b>Транзит (customer → provider)</b><br>Клиент платит провайдеру за доступ ко <b>всему</b> интернету. Провайдер анонсирует клиенту всё (full view или default), а клиентские префиксы — всему миру.</div>
<div><b>Пиринг (peer ↔ peer)</b><br>Две сети обмениваются трафиком <b>своих</b> клиентов бесплатно (settlement-free), напрямую или на точке обмена трафиком (<b>IX</b>: MSK-IX, DE-CIX). Пиру отдают только свои и клиентские маршруты, но не маршруты аплинков и других пиров.</div></div>
<p>Из этого вытекает главное правило экспорта (Gao-Rexford): маршруты от <b>клиентов</b> — всем. Маршруты от <b>пиров и провайдеров</b> — только клиентам. Нарушение этого правила — <b>route leak</b>: ты становишься бесплатным транзитом между двумя крупными сетями, твой канал забивается, у них ломается маршрутизация.</p>
<h3>PI и PA адреса</h3>
<ul><li><b>PA</b> (Provider Aggregatable) — адреса из блока провайдера. Сменил провайдера — сменил адреса. Анонсирует провайдер в составе своего агрегата.</li>
<li><b>PI</b> (Provider Independent) — свои адреса (через LIR, для IPv4 сейчас только покупка на рынке). Анонсируются со своей AS через любых провайдеров. Это нужно для настоящего multihoming.</li></ul>
<div class="callout info"><b>Почему именно BGP</b>Таблица интернета — больше миллиона IPv4-префиксов и сотни тысяч IPv6. Link-state протокол, где каждый знает топологию всех, на таком масштабе невозможен. BGP — path-vector: знает только «путь из AS» до префикса. Это защита от петель (своя AS в пути — отбросить) и основа для политик: решения принимаются не по скорости, а по деньгам и договорам.</div>`
    },
    {
      id: 'session', h: 'Сессия BGP: TCP 179, FSM, сообщения',
      html: `
<p>BGP работает поверх <b>TCP 179</b>: надёжность доставки обеспечивает TCP, поэтому BGP отправляет обновления только при изменениях (инкрементально), а живость проверяет keepalive. Соседей (peers) BGP <b>всегда задают вручную</b>, автообнаружения нет.</p>
<h3>Сообщения</h3>
<table><tr><th>Тип</th><th>Зачем</th></tr>
<tr><td>OPEN</td><td>версия, своя AS, hold time, BGP ID (router-id), capabilities (32-бит AS, address families, route refresh, add-path…)</td></tr>
<tr><td>UPDATE</td><td>новые префиксы (NLRI) с атрибутами и/или отзыв (withdrawn routes)</td></tr>
<tr><td>KEEPALIVE</td><td>«я жив» каждые 60 с (hold time 180 с, договаривается меньший)</td></tr>
<tr><td>NOTIFICATION</td><td>ошибка, сессия закрывается (код и подкод в логе)</td></tr>
<tr><td>ROUTE-REFRESH</td><td>«пришли мне все маршруты заново» — для применения новой входящей политики без разрыва</td></tr></table>
<h3>FSM и что значит «застрял»</h3>
<table><tr><th>Состояние</th><th>Смысл</th><th>Если висит здесь</th></tr>
<tr><td>Idle</td><td>ничего не делаем</td><td>нет маршрута к соседу, сессия выключена (shutdown), max-prefix сработал (Idle (PfxCt))</td></tr>
<tr><td>Connect</td><td>пытаемся установить TCP</td><td>коротко: идёт SYN</td></tr>
<tr><td><b>Active</b></td><td>TCP не получилось, ждём или повторяем</td><td><b>не устанавливается TCP</b>: нет IP-связности, ACL режет 179, неверный адрес соседа, сосед не настроен на нас, update-source не тот, eBGP multihop при TTL=1. Имя обманчивое: «active» — это плохо</td></tr>
<tr><td>OpenSent / OpenConfirm</td><td>обмен OPEN</td><td>кратко. Если рвётся — NOTIFICATION: неверный remote-as, дубль router-id, MD5</td></tr>
<tr><td>Established</td><td>работаем</td><td>в <code>show ip bgp summary</code> вместо состояния число принятых префиксов</td></tr></table>
<pre class="cli">R1#show ip bgp summary
BGP router identifier 100.0.0.1, local AS number 64500
Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
101.0.0.1       4 64501     125     120       42    0    0 01:52:11        [[5]]
102.0.0.1       4 64502       8      10        0    0    0 00:00:42 [[Active]]
R1#show ip bgp neighbors 102.0.0.1 | include state|Last reset|NOTIFICATION
  BGP state = Active
  Last reset 00:00:42, due to [[BGP Notification sent, peer in wrong AS]]</pre>
<h3>Особенности eBGP</h3>
<ul><li>eBGP-пакеты по умолчанию идут с <b>TTL=1</b>: сосед должен быть непосредственно подключён. Сессия между loopback'ами требует <code>ebgp-multihop 2</code> (или <code>disable-connected-check</code>) и маршрута до loopback соседа.</li>
<li><b>GTSM</b> (<code>neighbor X ttl-security hops 1</code>) — наоборот, шлём TTL=255 и принимаем только TTL ≥ 254. Подделать пакет издалека нельзя: защита сессии от атак.</li>
<li><b>MD5</b> (<code>neighbor X password</code>) или TCP-AO — подпись TCP-сегментов сессии. На стыках провайдера обычно обязательно.</li></ul>`
    },
    {
      id: 'table', h: 'Как маршруты попадают в BGP и как читать таблицу',
      html: `
<h3>Три способа ввести префикс в BGP</h3>
<ul><li><code>network 100.0.0.0 mask 255.255.254.0</code> — анонсировать, <b>если точно такой маршрут (префикс + маска) есть в RIB</b>. Нет в RIB — нет анонса. Поэтому для агрегата делают <code>ip route 100.0.0.0 255.255.254.0 Null0</code> (глава 3 — вот где это пригодилось).</li>
<li><code>redistribute</code> — из IGP, connected или static, обязательно через route-map.</li>
<li><code>aggregate-address … summary-only</code> — агрегат из более специфичных маршрутов в BGP-таблице.</li></ul>
<h3>Три таблицы (логически)</h3>
<p><b>Adj-RIB-In</b> (что прислал каждый сосед) → входная политика → <b>Loc-RIB</b> (BGP-таблица, из которой выбирается лучший) → лучший идёт в RIB (если AD победит) и через выходную политику в <b>Adj-RIB-Out</b> для каждого соседа.</p>
<pre class="cli">R1#show ip bgp
BGP table version is 42, local router ID is 100.0.0.1
Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,
              r RIB-failure, S Stale
Origin codes: i - IGP, e - EGP, ? - incomplete
     Network          Next Hop            Metric LocPrf Weight Path
 *>  8.8.8.0/24       101.0.0.1                              0 [[64501 64510 i]]
 *                    102.0.0.1                              0 64502 64510 i
 *>  100.0.0.0/23     0.0.0.0                  0         32768 i
 *>  203.0.113.0/24   102.0.0.1                              0 64502 i
R1#show ip bgp 8.8.8.0/24                         ! все пути к префиксу и почему выбран лучший
R1#show ip bgp neighbors 101.0.0.1 advertised-routes   ! что я ему отдаю
R1#show ip bgp neighbors 101.0.0.1 received-routes     ! что он прислал до политики (нужен soft-reconfig inbound)
R1#show ip bgp neighbors 101.0.0.1 routes              ! что принято после политики</pre>
<ul><li><code>*</code> — валидный путь, <code>&gt;</code> — лучший, <code>i</code> в начале строки — получен по iBGP.</li>
<li><b>Path</b> читается справа налево: последний номер — <b>origin AS</b> (где родился префикс), первый — сосед. Буква в конце — ORIGIN: <code>i</code> (network/aggregate), <code>?</code> (redistribute).</li>
<li>Weight 32768 — маршрут сгенерирован локально.</li>
<li><code>r RIB-failure</code> — BGP выбрал путь, но в RIB его не поставили: там есть тот же префикс с меньшей AD (статика, IGP).</li></ul>
<div class="callout warn"><b>Изменил политику — примени её</b>Новый route-map или prefix-list не применяется к уже полученным маршрутам сам собой. Нужно <code>clear ip bgp X soft in</code> (route refresh) или <code>soft out</code>. Никогда не делай <code>clear ip bgp *</code> без soft в проде: это жёсткий разрыв всех сессий и перезагрузка full view.</div>`
    },
    {
      id: 'attrs', h: 'Атрибуты пути',
      html: `
<table><tr><th>Категория</th><th>Атрибут</th><th>Что делает</th></tr>
<tr><td rowspan="3">Well-known mandatory (есть в каждом UPDATE)</td><td><b>AS_PATH</b></td><td>список AS, через которые прошёл маршрут. Защита от петель и критерий выбора (короче — лучше)</td></tr>
<tr><td><b>NEXT_HOP</b></td><td>куда слать трафик. eBGP: адрес соседа. Внутри AS по iBGP <b>не меняется</b> (глава 8.1)</td></tr>
<tr><td><b>ORIGIN</b></td><td>i (IGP) &lt; e (EGP) &lt; ? (incomplete) — как маршрут попал в BGP</td></tr>
<tr><td rowspan="2">Well-known discretionary</td><td><b>LOCAL_PREF</b></td><td>предпочтение выхода из AS (больше — лучше), по умолчанию 100. Только внутри AS, eBGP-соседям не передаётся</td></tr>
<tr><td>ATOMIC_AGGREGATE</td><td>маршрут — агрегат, часть информации о пути потеряна</td></tr>
<tr><td rowspan="3">Optional transitive (передаются дальше, даже если непонятны)</td><td><b>COMMUNITY</b></td><td>метки ASN:значение (64502:80). Язык договорённостей между AS</td></tr>
<tr><td>LARGE_COMMUNITY</td><td>ASN(32):x:y — для 32-битных AS</td></tr>
<tr><td>AGGREGATOR</td><td>кто агрегировал</td></tr>
<tr><td rowspan="2">Optional non-transitive</td><td><b>MED</b> (metric)</td><td>подсказка <b>соседней</b> AS, через какой из моих линков входить (меньше — лучше). Сравнивается по умолчанию только между путями от одной и той же AS</td></tr>
<tr><td>ORIGINATOR_ID, CLUSTER_LIST</td><td>route reflector (глава 8.1)</td></tr></table>
<p>Плюс Cisco-специфичный <b>Weight</b>: локальный для маршрутизатора (никуда не передаётся), больше — лучше, проверяется первым.</p>
<h3>Well-known community</h3>
<ul><li><code>no-export</code> — не передавать за пределы AS (или конфедерации).</li>
<li><code>no-advertise</code> — не передавать никому.</li>
<li><code>65535:666</code> BLACKHOLE (RFC 7999) — «отбрось трафик к этому префиксу» (см. раздел о безопасности).</li></ul>
<div class="callout pro"><b>Community — интерфейс провайдера для клиентов</b>Крупные провайдеры публикуют свои community (в IRR/RIPE DB или на сайте), например: <code>AS:80</code> — понизить local-pref до 80 (сделать резервным), <code>AS:1x</code> — не анонсировать в регион X, <code>AS:2x</code> — prepend ×x к пиру Y, <code>AS:666</code> — blackhole. Клиент управляет маршрутизацией провайдера, не звоня ему. Ты будешь и использовать такие community у своих аплинков, и поддерживать свои для клиентов.</div>`
    },
    {
      id: 'best', h: 'Выбор лучшего пути',
      html: `
<p>Перед сравнением путь должен быть <b>валидным</b>: next-hop достижим (есть маршрут в RIB), нет своей AS в AS_PATH, путь прошёл входную политику. Дальше — строго по порядку, первый различающий критерий решает (Cisco):</p>
<ol class="steps">
<li>Наибольший <b>Weight</b> (Cisco, локально).</li>
<li>Наибольший <b>LOCAL_PREF</b>.</li>
<li>Маршрут, <b>сгенерированный локально</b> (network, aggregate, redistribute).</li>
<li>Кратчайший <b>AS_PATH</b> (AS_SET считается за 1, конфедерации не считаются).</li>
<li>Наименьший <b>ORIGIN</b>: i &lt; e &lt; ?.</li>
<li>Наименьший <b>MED</b> (по умолчанию только между путями от одной соседней AS).</li>
<li><b>eBGP лучше iBGP</b>.</li>
<li>Наименьшая <b>IGP-метрика до next-hop</b> («горячая картошка»: отдай трафик из своей сети побыстрее).</li>
<li>(Если включено <code>maximum-paths</code> — здесь пути могут стать ECMP.)</li>
<li>Для eBGP — <b>самый старый</b> путь (стабильность).</li>
<li>Наименьший <b>router-id</b> соседа (или ORIGINATOR_ID).</li>
<li>Короче <b>CLUSTER_LIST</b>.</li>
<li>Наименьший <b>адрес соседа</b>.</li></ol>
<div class="callout info"><b>Мнемоника</b>«<b>W</b>e <b>L</b>ove <b>O</b>ranges <b>A</b>s <b>O</b>ranges <b>M</b>ean <b>P</b>ure <b>R</b>efreshment»: Weight, Local pref, Originate, As path, Origin, MED, Paths (eBGP &gt; iBGP), Router ID. Между P и R вставь IGP-метрику и «самый старый».</div>
<h3>Что из этого управляет каким трафиком</h3>
<div class="vs"><div><b>Исходящий</b> (куда <i>мы</i> шлём) — решаем сами:<br>Weight (один маршрутизатор), <b>LOCAL_PREF</b> (вся AS). Например: всё через дешёвого провайдера, а через второго — только его клиенты.</div>
<div><b>Входящий</b> (как <i>к нам</i> идут) — только убеждаем других:<br><b>AS_PATH prepend</b> (делаем путь длиннее), <b>MED</b> (одному соседу с двумя линками), <b>более специфичные префиксы</b> (всегда побеждают по longest match!), <b>community</b> провайдера (он сам понизит local-pref).</div></div>
<pre class="cli">R1#show ip bgp 8.8.8.0/24
BGP routing table entry for 8.8.8.0/24, version 31
Paths: (2 available, best #1, table default)
  Advertised to update-groups: 1
  64501 64510
    101.0.0.1 from 101.0.0.1 (10.255.2.2)
      Origin IGP, localpref 100, valid, external, [[best]]
  64502 64510
    102.0.0.1 from 102.0.0.1 (10.255.3.3)
      Origin IGP, localpref 100, valid, external
! одинаковые weight, LP, длина пути, origin; MED не сравнивается (разные AS); оба eBGP;
! IGP-метрика до next-hop одинакова (connected) → «самый старый» путь</pre>`
    },
    {
      id: 'policy', h: 'Политики: prefix-list, as-path, community, route-map',
      html: `
<h3>Prefix-list: ge и le</h3>
<table><tr><th>Запись</th><th>Что совпадает</th></tr>
<tr><td><code>permit 10.0.0.0/8</code></td><td>ровно 10.0.0.0/8</td></tr>
<tr><td><code>permit 10.0.0.0/8 le 24</code></td><td>10/8 и все его подсети до /24</td></tr>
<tr><td><code>permit 10.0.0.0/8 ge 16 le 24</code></td><td>подсети 10/8 с маской от /16 до /24</td></tr>
<tr><td><code>permit 0.0.0.0/0</code></td><td>только default</td></tr>
<tr><td><code>permit 0.0.0.0/0 le 32</code></td><td>всё</td></tr>
<tr><td><code>deny 0.0.0.0/0 ge 25</code></td><td>всё длиннее /24 (в интернете такое не принимают)</td></tr></table>
<h3>AS-path regex</h3>
<table><tr><th>Regex</th><th>Смысл</th></tr>
<tr><td><code>^$</code></td><td>пустой путь — <b>мои собственные</b> маршруты</td></tr>
<tr><td><code>^64501$</code></td><td>маршруты, родившиеся в соседней 64501</td></tr>
<tr><td><code>^64501_</code></td><td>получены от 64501 (сосед первый в пути)</td></tr>
<tr><td><code>_64510$</code></td><td>родились в 64510 (origin)</td></tr>
<tr><td><code>_64510_</code></td><td>64510 где угодно в пути</td></tr>
<tr><td><code>^64501(_64501)*$</code></td><td>сосед 64501 с любым числом prepend'ов</td></tr></table>
<pre class="cli">ip prefix-list OWN seq 10 permit 100.0.0.0/23 le 24
ip as-path access-list 1 permit ^$
ip community-list standard ISP-BACKUP permit 64502:80
route-map TO-ISP2 permit 10
 match ip address prefix-list OWN
 set as-path prepend 64500 64500 64500
 set community 64502:80 additive
route-map FROM-ISP1 permit 10
 set local-preference 200
router bgp 64500
 neighbor 102.0.0.1 route-map TO-ISP2 out
 neighbor 102.0.0.1 filter-list 1 out           ! только свои маршруты (страховка от leak)
 neighbor 101.0.0.1 route-map FROM-ISP1 in
 neighbor 102.0.0.1 send-community</pre>
<div class="callout warn"><b>Логика route-map</b>Как ACL: проверка сверху вниз, первое совпадение, <b>в конце неявный deny</b>. Route-map из одного <code>permit 10</code> с match пропустит только совпавшее, а остальное отбросит. Если хочешь изменить часть маршрутов и пропустить остальные — добавь пустой <code>route-map X permit 100</code> в конце. Классическая ошибка, после которой «пропал весь full view».</div>
<h3>Как провайдер фильтрует клиента (обязательно)</h3>
<ol class="steps"><li><b>Prefix-list по разрешённым префиксам клиента</b>: строится из IRR (RIPE DB: as-set, route-объекты) автоматически (bgpq4) и проверяется по RPKI.</li>
<li><b>AS-path</b>: только AS клиента и его клиентов (as-set).</li>
<li><b>maximum-prefix</b> с запасом: при превышении сессия рвётся. Защита от утечки full view клиентом.</li>
<li>Отбросить <b>bogons</b> (RFC1918, 100.64/10, 0/8, 127/8, 224/4…), default, свои префиксы, слишком длинные (&gt;/24 для IPv4, &gt;/48 для IPv6).</li>
<li><b>RPKI origin validation</b>: invalid отбрасывать.</li></ol>`
    },
    {
      id: 'mh', h: 'Multihoming: схемы подключения',
      html: `
<table><tr><th>Схема</th><th>Что принимать</th><th>Плюсы и минусы</th></tr>
<tr><td>Один провайдер, два линка</td><td>default или full по обоим</td><td>резерв линка, но не провайдера. Можно без своей AS (приватная AS, провайдер её снимет: remove-private-as)</td></tr>
<tr><td>Два провайдера, default от обоих</td><td>0/0</td><td>дёшево по ресурсам, но выход всегда через «основного», без понимания, где ближе</td></tr>
<tr><td>Два провайдера, full view</td><td>вся таблица (~1 млн IPv4)</td><td>оптимальный выход, точная балансировка. Нужно железо с большим FIB</td></tr>
<tr><td>Partial view</td><td>маршруты самих провайдеров и их клиентов + default</td><td>золотая середина: к «их» сетям — напрямую, остальное по default</td></tr></table>
<div class="callout bad"><b>Не стань транзитом</b>Клиент с двумя провайдерами принимает маршруты ISP1. Если без фильтра он отдаёт их в ISP2, то ISP2 (если сам не фильтрует клиента, а он обязан) может направить трафик к сетям ISP1 через тонкий канал клиента. Защита на клиенте: экспортировать только свои префиксы (<code>as-path ^$</code> или prefix-list). Защита на провайдере: принимать от клиента только его префиксы. Должны работать обе.</div>`
    },
    {
      id: 'sec', h: 'Безопасность маршрутизации: hijack, leak, RPKI, blackhole',
      html: `
<ul><li><b>Hijack</b> — кто-то анонсирует чужой префикс (по ошибке или нарочно). Классика: 2008 год, Pakistan Telecom анонсировал более специфичный префикс YouTube, и тот пропал из интернета на пару часов. Более специфичный маршрут побеждает по longest match везде, куда долетел.</li>
<li><b>Route leak</b> — легитимные маршруты распространились нарушая политику: клиент отдал маршруты одного аплинка другому.</li></ul>
<h3>RPKI</h3>
<p>Владелец адресов подписывает в своём RIR <b>ROA</b> (Route Origin Authorization): «префикс 100.0.0.0/23 с максимальной длиной /24 может анонсировать только AS64500». Маршрутизаторы получают проверенные данные от валидатора (Routinator, rpki-client, FORT) по протоколу RTR и помечают каждый маршрут: <b>Valid</b>, <b>Invalid</b> (origin или длина не совпадает — отбросить) или <b>NotFound</b> (ROA нет — принять). Это защищает от hijack по origin, но не от подделки пути. Для пути есть ASPA и BGPsec — следующий шаг.</p>
<h3>RTBH — remote triggered blackhole</h3>
<p>На клиента летит DDoS 50 Гбит/с, канал клиента 1 Гбит/с, страдает весь узел провайдера. Клиент (или NOC) анонсирует атакуемый <b>/32</b> с community <code>65535:666</code> (или <code>ASпровайдера:666</code>). Провайдер по этой community ставит next-hop в Null0 и передаёт blackhole своим аплинкам. Трафик к этому адресу отбрасывается <b>на границе</b> сети, ещё до узкого места. Жертва целиком недоступна (атака «удалась»), но остальные клиенты живы. Более тонкий инструмент — <b>BGP FlowSpec</b>: отбросить или ограничить по совокупности полей (порт, протокол, размер) и пропустить остальное.</p>
<pre class="cli">! провайдер: принимать /32 с blackhole-community от клиента
ip community-list standard BLACKHOLE permit 65535:666
route-map FROM-CUST permit 5
 match community BLACKHOLE
 match ip address prefix-list CUST-ANY-32
 set ip next-hop 192.0.2.1          ! адрес, маршрутизированный в Null0 на всех граничных
 set community no-export additive
ip route 192.0.2.1 255.255.255.255 Null0</pre>
<div class="callout pro"><b>Чек-лист стыка провайдера (по RFC 7454 и MANRS)</b>Фильтры префиксов и AS-path клиента из IRR · RPKI drop invalid · max-prefix · bogon-фильтр · MD5/TCP-AO и GTSM · iACL/CoPP на сессию (глава 5) · uRPF (BCP38) · поддержка blackhole community · опубликованная политика community · контакты в PeeringDB.</div>`
    },
    {
      id: 'sla', h: 'IP SLA и track: когда маршрут должен знать о качестве',
      html: `
<p>Статика и PBR не знают, жив ли путь (глава 3). <b>IP SLA</b> — встроенный генератор тестов (icmp-echo, udp-jitter, tcp-connect, http, dns…), который регулярно измеряет доступность и качество. <b>Track</b> превращает результат в состояние Up/Down, на которое подписываются статические маршруты, PBR, HSRP/VRRP, EEM.</p>
<pre class="cli">ip sla 1
 icmp-echo 8.8.8.8 source-interface Gi0/0
 frequency 5
 threshold 500
 timeout 1000
ip sla schedule 1 life forever start-time now
track 1 ip sla 1 reachability
 delay down 10 up 30                      ! гистерезис: не флапать
ip route 0.0.0.0 0.0.0.0 101.0.0.1 track 1
ip route 0.0.0.0 0.0.0.0 102.0.0.1 250    ! резерв
R1#show ip sla statistics 1
R1#show track 1
Track 1
  IP SLA 1 reachability
  Reachability is [[Up]]
    2 changes, last change 00:12:40</pre>
<div class="callout warn"><b>Ловушка: тест уходит не тем путём</b>Если основной канал умер, а маршрут к 8.8.8.8 сам переключился на резервный, тест через резерв проходит, track Up, и система «чинит» себя обратно на мёртвый канал. Тест должен быть привязан к своему каналу: <code>source-interface</code> плюс отдельный /32-маршрут к цели теста строго через основной next-hop.</div>
<p>Для BGP вместо SLA используют <b>BFD</b> (<code>neighbor X fall-over bfd</code>): сессия рвётся за доли секунды при отказе пути, маршруты отзываются, трафик уходит через второго провайдера.</p>`
    }
  ],
  cmds: [
    { g: 'Сессия' },
    { c: 'router bgp 64500\n bgp router-id 100.0.0.1\n neighbor X remote-as 64501', d: 'Процесс BGP и сосед', hw: 'bgp 64500\n router-id …\n peer X as-number 64501', jn: 'set protocols bgp group G type external peer-as 64501 neighbor X' },
    { c: 'neighbor X description …\nneighbor X password KEY', d: 'Описание и MD5 сессии', hw: 'peer X description … / peer X password cipher KEY', jn: 'authentication-key KEY' },
    { c: 'neighbor X update-source Lo0\nneighbor X ebgp-multihop 2', d: 'Сессия с loopback, eBGP не напрямую', hw: 'peer X connect-interface LoopBack0 / peer X ebgp-max-hop 2', jn: 'local-address / multihop ttl 2' },
    { c: 'neighbor X ttl-security hops 1', d: 'GTSM: принимать только пакеты с TTL ≥ 254', hw: 'peer X valid-ttl-hops 1', jn: 'ttl 255 / accept-remote-nexthop' },
    { c: 'neighbor X fall-over bfd', d: 'BFD для BGP-сессии', hw: 'peer X bfd enable', jn: 'bfd-liveness-detection' },
    { c: 'neighbor X maximum-prefix 100 80 [restart 15]', d: 'Лимит префиксов от соседа (предупреждение на 80%)', hw: 'peer X route-limit 100 80', jn: 'family inet unicast prefix-limit maximum 100 teardown 80' },
    { c: 'show ip bgp summary', d: 'Соседи, состояние, число префиксов', hw: 'display bgp peer', jn: 'show bgp summary' },
    { c: 'show ip bgp neighbors X', d: 'Детали сессии: capabilities, таймеры, причина последнего разрыва', hw: 'display bgp peer X verbose', jn: 'show bgp neighbor X' },
    { g: 'Таблица и анонсы' },
    { c: 'network 100.0.0.0 mask 255.255.254.0\nip route 100.0.0.0 255.255.254.0 Null0', d: 'Анонс префикса (должен быть в RIB точно)', hw: 'network 100.0.0.0 23', jn: 'export policy + static discard' },
    { c: 'aggregate-address 100.0.0.0 255.255.254.0 summary-only', d: 'Агрегат из специфичных маршрутов BGP', hw: 'aggregate 100.0.0.0 23 detail-suppressed', jn: 'aggregate route' },
    { c: 'show ip bgp [prefix]', d: 'BGP-таблица / все пути к префиксу и выбор', hw: 'display bgp routing-table [prefix]', jn: 'show route receive-protocol bgp X / show route P extensive' },
    { c: 'show ip bgp neighbors X advertised-routes | routes | received-routes', d: 'Что отдаю / что принято / что прислано до политики', hw: 'display bgp routing-table peer X advertised-routes | received-routes', jn: 'show route advertising-protocol bgp X / receive-protocol bgp X' },
    { c: 'neighbor X soft-reconfiguration inbound', d: 'Хранить копию полученного до политики (для received-routes)', hw: 'peer X keep-all-routes', jn: 'keep all' },
    { c: 'clear ip bgp X soft in | out', d: 'Применить изменённую политику без разрыва', hw: 'refresh bgp X import | export', jn: 'clear bgp neighbor X soft-inbound' },
    { g: 'Политики' },
    { c: 'ip prefix-list NAME seq 10 permit 10.0.0.0/8 le 24', d: 'Prefix-list', hw: 'ip ip-prefix NAME index 10 permit 10.0.0.0 8 less-equal 24', jn: 'policy-statement + route-filter 10.0.0.0/8 upto /24' },
    { c: 'ip as-path access-list 1 permit ^$', d: 'Фильтр по AS-path (regex)', hw: 'ip as-path-filter 1 permit ^$', jn: 'as-path NAME "()"' },
    { c: 'ip community-list standard N permit 64502:80', d: 'Список community', hw: 'ip community-filter 1 permit 64502:80', jn: 'community NAME members 64502:80' },
    { c: 'route-map RM permit 10\n match …\n set local-preference | as-path prepend | community | metric', d: 'Политика: условия и действия', hw: 'route-policy RM permit node 10\n if-match … / apply …', jn: 'policy-statement RM term T from … then …' },
    { c: 'neighbor X route-map RM in|out\nneighbor X prefix-list PL in|out\nneighbor X filter-list 1 out', d: 'Применение политик к соседу', hw: 'peer X route-policy RM import|export', jn: 'import RM / export RM' },
    { c: 'neighbor X send-community [both]', d: 'Передавать community соседу (на IOS по умолчанию не передаются!)', hw: 'peer X advertise-community', jn: 'передаются по умолчанию' },
    { c: 'neighbor X remove-private-as', d: 'Удалить приватные AS из пути при анонсе', hw: 'peer X public-as-only', jn: 'remove-private' },
    { c: 'maximum-paths 2', d: 'ECMP по eBGP-путям', hw: 'maximum load-balancing 2', jn: 'multipath' },
    { g: 'IP SLA / track' },
    { c: 'ip sla 1\n icmp-echo 8.8.8.8 source-interface Gi0/0\nip sla schedule 1 life forever start-time now', d: 'Тест доступности', hw: 'nqa test-instance admin T\n test-type icmp', jn: 'services rpm probe' },
    { c: 'track 1 ip sla 1 reachability\nip route 0.0.0.0 0.0.0.0 X track 1', d: 'Маршрут, зависящий от теста', hw: 'ip route-static 0.0.0.0 0 X track nqa admin T', jn: 'ip-monitoring' },
    { c: 'show ip sla statistics / show track', d: 'Результаты тестов и состояние track', hw: 'display nqa results', jn: 'show services rpm probe-results' }
  ],
  cards: [
    ['Что такое AS и ASN? Диапазоны частных ASN?', 'AS — сети под единой политикой маршрутизации. ASN — номер. Частные: 64512–65534 (16-бит), 4200000000–4294967294 (32-бит).'],
    ['Транзит vs пиринг?', 'Транзит: клиент платит провайдеру за доступ ко всему интернету (получает всё, его префиксы отдаются всем). Пиринг: бесплатный обмен трафиком своих клиентов (отдаются только свои и клиентские маршруты).'],
    ['Главное правило экспорта (Gao-Rexford)?', 'Маршруты от клиентов — всем. Маршруты от пиров и провайдеров — только клиентам. Нарушение — route leak.'],
    ['PI vs PA?', 'PA — из блока провайдера, при смене провайдера меняются. PI — свои, анонсируются со своей AS через любых провайдеров.'],
    ['Транспорт BGP и таймеры по умолчанию?', 'TCP 179. Keepalive 60 с, hold 180 с (договаривается меньший).'],
    ['Состояние Active в BGP — что значит?', 'TCP-сессия не устанавливается: нет связности, ACL на 179, неверный адрес, сосед не настроен, update-source, TTL для eBGP-multihop. «Active» — плохо.'],
    ['Почему eBGP между loopback\'ами не поднимается по умолчанию?', 'eBGP шлёт пакеты с TTL=1 и проверяет, что сосед в connected-сети. Нужны ebgp-multihop 2 (или disable-connected-check), update-source и маршрут до loopback соседа.'],
    ['Что такое GTSM?', 'TTL Security: шлём TTL=255, принимаем только ≥ 254. Пакеты издалека (с меньшим TTL) отбрасываются: защита сессии от удалённых атак.'],
    ['Условие анонса через network в BGP?', 'В RIB должен быть маршрут с точно таким же префиксом и маской. Для агрегата — статика в Null0.'],
    ['Как читать AS_PATH «64501 64510 i»?', 'Справа налево: префикс родился в AS64510 (origin), пришёл к нам от соседа AS64501. «i» — ORIGIN IGP.'],
    ['Что значит r RIB-failure в show ip bgp?', 'BGP выбрал путь, но в RIB он не установлен: там тот же префикс от источника с меньшей AD.'],
    ['Well-known mandatory атрибуты?', 'AS_PATH, NEXT_HOP, ORIGIN.'],
    ['LOCAL_PREF vs MED?', 'LOCAL_PREF: внутри своей AS, больше — лучше, выбор выхода (исходящий трафик). MED: подсказка соседней AS, меньше — лучше, выбор входа к нам (сравнивается между путями от одной AS).'],
    ['Порядок выбора пути BGP (Cisco) — первые 8 шагов?', 'Weight ↑ → Local Pref ↑ → локально сгенерированный → AS_PATH короче → Origin (i<e<?) → MED ↓ → eBGP > iBGP → IGP-метрика до next-hop ↓. Далее: oldest eBGP, RID ↓, cluster-list, neighbor IP ↓.'],
    ['Инструменты управления исходящим трафиком?', 'Weight (локально на маршрутизаторе), LOCAL_PREF (вся AS).'],
    ['Инструменты управления входящим трафиком?', 'AS_PATH prepend, MED (для одной соседней AS), более специфичные префиксы, community провайдера (он сам меняет local-pref).'],
    ['Prefix-list «10.0.0.0/8 ge 16 le 24» — что совпадёт?', 'Подсети внутри 10.0.0.0/8 с длиной маски от /16 до /24 (сам /8 — нет).'],
    ['AS-path regex ^$ и _64510$?', '^$ — пустой путь, свои маршруты. _64510$ — маршруты, родившиеся в AS 64510.'],
    ['Неявное поведение route-map без последнего permit?', 'Неявный deny в конце: всё, что не совпало ни с одной секцией, отбрасывается.'],
    ['Как применить новую входящую политику без разрыва сессии?', '<code>clear ip bgp X soft in</code> (route refresh) или soft-reconfiguration inbound.'],
    ['Как провайдер обязан фильтровать BGP-клиента?', 'Prefix-list и AS-path по IRR, RPKI drop invalid, maximum-prefix, bogons, не длиннее /24 (/48 v6), не принимать default и свои префиксы.'],
    ['Что такое RPKI ROA и состояния валидации?', 'ROA: подписанное «префикс P (до maxLength) анонсирует только AS N». Valid / Invalid (отбросить) / NotFound.'],
    ['Как работает RTBH?', 'Анонс атакуемого /32 с blackhole-community (65535:666). Провайдер ставит next-hop в Null0 и передаёт дальше. Трафик к жертве отбрасывается на границе, остальные клиенты не страдают.'],
    ['Зачем send-community на Cisco?', 'IOS по умолчанию не передаёт community соседям. Без send-community твои метки (blackhole, LP-сигналы) не дойдут.'],
    ['Что такое route leak и как защититься с обеих сторон?', 'Маршруты от одного аплинка или пира ушли другому. Клиент: экспортировать только свои префиксы (^$ / prefix-list). Провайдер: принимать от клиента только его префиксы, max-prefix.'],
    ['IP SLA + track: главная ловушка?', 'Тест к цели уходит через резервный канал после переключения, показывает Up и возвращает маршрут на мёртвый канал. Привязывай тест к своему каналу (source-interface + /32 через основной next-hop).']
  ],
  quiz: [
    { q: 'show ip bgp summary показывает соседа в состоянии Active. Что НЕ является возможной причиной?', o: ['ACL блокирует TCP 179', 'Неверный адрес соседа', 'Сосед прислал 10 000 префиксов', 'Нет маршрута до адреса соседа'], a: 2, e: 'Active — TCP не установлен. Префиксы приходят только в Established. Превышение max-prefix дало бы Idle (PfxCt).' },
    { q: 'Ты ввёл network 100.0.0.0 mask 255.255.254.0, но префикс не анонсируется. В RIB есть 100.0.0.0/24 и 100.0.1.0/24 (connected). Почему?', o: ['Нужен send-community', 'В RIB нет точного маршрута 100.0.0.0/23', 'Сосед не в Established', 'Нужен redistribute'], a: 1, e: 'network требует точного совпадения префикса и маски в RIB. Добавь ip route 100.0.0.0 255.255.254.0 Null0 (или aggregate-address).' },
    { q: 'Два пути к 8.8.8.0/24: через ISP1 (AS_PATH 64501 64510, LP 100) и через ISP2 (AS_PATH 64502 64520 64510, LP 150). Какой лучший?', o: ['ISP1 — путь короче', 'ISP2 — LOCAL_PREF выше и проверяется раньше длины пути', 'ECMP', 'Зависит от MED'], a: 1, e: 'LOCAL_PREF (шаг 2) решает раньше длины AS_PATH (шаг 4).' },
    { q: 'Клиент хочет, чтобы входящий трафик шёл в основном через ISP1, а через ISP2 — только при аварии. Что он может сделать? (несколько)', o: ['Поставить LOCAL_PREF 200 на маршруты от ISP1', 'Сделать AS_PATH prepend в анонсе к ISP2', 'Пометить анонс к ISP2 community «понизить local-pref», если ISP2 их поддерживает', 'Анонсировать более специфичные префиксы только в ISP1'], a: [1, 2, 3], e: 'LOCAL_PREF управляет только исходящим трафиком клиента. На входящий влияют prepend, community и специфичные префиксы (самый сильный способ: longest match).' },
    { q: 'Что совпадёт с ip as-path access-list 5 permit ^64501_?', o: ['Маршруты, родившиеся в 64501', 'Маршруты, полученные непосредственно от соседа 64501', 'Только собственные маршруты', 'Маршруты, где 64501 в конце'], a: 1, e: '^64501_ — первый номер в пути (сосед), дальше что угодно.' },
    { q: 'Ты написал route-map FROM-ISP permit 10 / match ip address prefix-list GOOGLE / set local-preference 200 и применил «in». После soft in из 900 тысяч маршрутов осталось 3. Почему?', o: ['Слишком большой LP', 'Неявный deny в конце route-map: всё, что не совпало с GOOGLE, отброшено', 'Нужен send-community', 'Prefix-list сломан'], a: 1, e: 'Добавь route-map FROM-ISP permit 20 без match, чтобы пропустить остальное без изменений.' },
    { q: 'Клиент с двумя провайдерами не фильтрует экспорт. Что произойдёт, если ISP2 тоже не фильтрует клиента?', o: ['Ничего', 'Клиент станет транзитом: маршруты ISP1 уйдут в ISP2, трафик между ними может пойти через узкий канал клиента (route leak)', 'Сессии упадут', 'BGP не позволит'], a: 1, e: 'Именно так случаются крупные утечки. Фильтр нужен с обеих сторон.' },
    { q: 'Почему community, выставленные на клиенте Cisco, не доходят до провайдера?', o: ['Провайдер их удаляет', 'Не настроен neighbor X send-community', 'Community не транзитивны', 'Нужен ebgp-multihop'], a: 1, e: 'IOS по умолчанию не отправляет community. Нужен send-community (both — с extended).' },
    { q: 'На клиента идёт DDoS, канал забит, страдают соседние клиенты на узле. Какой BGP-инструмент провайдер использует быстрее всего?', o: ['AS_PATH prepend', 'RTBH: /32 жертвы с blackhole-community, next-hop в Null0 на границе', 'MED', 'LOCAL_PREF'], a: 1, e: 'Blackhole отрезает трафик к жертве на входе в сеть и спасает остальных. FlowSpec — более тонкий вариант.' },
    { q: 'Префикс клиента в RPKI: ROA 100.0.0.0/23 maxLength 23, AS64500. Кто-то анонсирует 100.0.0.0/24 из AS64500. Статус?', o: ['Valid', 'Invalid — длина больше maxLength', 'NotFound', 'Valid, потому что AS совпадает'], a: 1, e: 'Совпадает origin, но длина /24 превышает maxLength /23, значит Invalid. Если клиент хочет анонсировать /24, ROA должна иметь maxLength 24.' },
    { q: 'Зачем провайдеру maximum-prefix на сессии с клиентом?', o: ['Ускоряет сходимость', 'Если клиент по ошибке отдаст full view, сессия разорвётся, а не зальёт сеть миллионом маршрутов', 'Шифрует сессию', 'Для балансировки'], a: 1, e: 'Защита от утечки. Сессия уходит в Idle (PfxCt), и в логе будет причина.' },
    { q: 'Два пути от одной AS64501 через два разных линка, MED 50 и MED 10, остальное одинаково. Какой выберется?', o: ['MED 50', 'MED 10', 'ECMP', 'Самый старый'], a: 1, e: 'MED: меньше — лучше. Пути от одной соседней AS, поэтому MED сравнивается.' },
    { q: 'IP SLA пингует 8.8.8.8 и управляет default через ISP1, резервный default через ISP2 с AD 250. При аварии ISP1 маршрут переключается на ISP2, а через минуту обратно на мёртвый ISP1, и так по кругу. Причина?', o: ['Мало frequency', 'Тест к 8.8.8.8 после переключения идёт через ISP2, успешен, и track снова Up', 'Сломан ISP2', 'Нужен BFD'], a: 1, e: 'Тест должен идти строго через свой канал: /32 к цели через next-hop ISP1 и source-interface.' },
    { q: 'Какие префиксы провайдер должен отбрасывать от клиента в любом случае? (несколько)', o: ['10.0.0.0/8 и другие RFC1918', 'Default 0.0.0.0/0', 'Префиксы длиннее /24 (IPv4)', 'Зарегистрированный в IRR префикс клиента'], a: [0, 1, 2], e: 'Зарегистрированный префикс клиента как раз нужно принимать.' },
    { q: 'eBGP-сессия с loopback соседа. Маршрут к loopback есть, update-source настроен. Сессия в Active. Что ещё нужно?', o: ['send-community', 'ebgp-multihop 2 (или disable-connected-check)', 'next-hop-self', 'maximum-paths'], a: 1, e: 'TTL=1 и проверка connected не дают установить eBGP с непрямого адреса.' },
    { q: 'Почему BGP, а не OSPF, для обмена маршрутами между AS? (несколько)', o: ['Масштаб: миллион префиксов', 'Политики: решения по договорам, а не по скорости', 'Защита от петель через AS_PATH без знания топологии чужих сетей', 'BGP сходится быстрее OSPF'], a: [0, 1, 2], e: 'BGP как раз медленнее IGP. Его сила — масштаб и политики.' }
  ],
  und: [
    { q: 'Объясни, как устроен интернет с точки зрения BGP: AS, транзит, пиринг, и почему правило экспорта именно такое.', a: '<p>Интернет — десятки тысяч AS, связанных деловыми отношениями. Клиент платит провайдеру за транзит: провайдер передаёт клиенту все маршруты и анонсирует префиксы клиента всему миру. Пиры обмениваются трафиком своих клиентов бесплатно, потому что им обоим выгодно не платить транзиту. Отсюда правило экспорта: маршруты клиентов отдаю всем (за их трафик мне платят), а маршруты пиров и аплинков — только клиентам. Если отдать маршрут аплинка пиру, я бесплатно повезу трафик пира к аплинку и заплачу за это (route leak). AS_PATH защищает от петель и описывает путь в терминах организаций.</p>', k: ['AS и отношения', 'транзит vs пиринг', 'правило экспорта и экономика', 'route leak'] },
    { q: 'Опиши алгоритм выбора лучшего пути BGP и объясни, какие шаги используют для управления исходящим, а какие — входящим трафиком.', a: '<p>Сначала путь должен быть валиден (next-hop достижим, нет своей AS в пути). Потом: Weight, LOCAL_PREF, локально сгенерированный, длина AS_PATH, ORIGIN, MED, eBGP &gt; iBGP, IGP-метрика до next-hop, самый старый, router-id, cluster-list, адрес соседа. Исходящим трафиком я управляю сам на своих маршрутизаторах: LOCAL_PREF (вся AS) или Weight (один маршрутизатор). Входящим — только косвенно, влияя на выбор чужих маршрутизаторов: prepend (шаг 4 у них), MED (шаг 6 у соседа), более специфичные префиксы (вообще вне BGP-алгоритма, longest match), community провайдера (он сам поменяет свой LOCAL_PREF).</p>', k: ['порядок шагов', 'LP/weight — исходящий', 'prepend/MED/specifics/community — входящий', 'specifics сильнее всего (LPM)'] },
    { q: 'Ты провайдер и подключаешь нового BGP-клиента. Какие фильтры и настройки ты сделаешь на сессии и почему каждый?', a: '<p>Входящие: prefix-list только из его зарегистрированных в IRR префиксов (иначе hijack), AS-path только его AS и as-set его клиентов, отбросить bogons, default и длиннее /24, RPKI drop invalid, maximum-prefix с запасом (защита от утечки full view), поддержка blackhole-community для его /32. Исходящие: то, что он заказал (full/default/partial). Защита сессии: MD5 или TCP-AO, GTSM, CoPP. Плюс uRPF или ACL по его префиксам на интерфейсе (BCP38) и документирование community.</p>', k: ['prefix-list из IRR', 'AS-path', 'bogons, /24, default', 'RPKI', 'max-prefix', 'blackhole', 'MD5/GTSM', 'BCP38'] },
    { q: 'Как работает RTBH и почему это одновременно спасение и «победа атакующего»?', a: '<p>Клиент или NOC анонсирует атакуемый адрес /32 с blackhole-community. Провайдер по community ставит next-hop в адрес, маршрутизируемый в Null0, на всех граничных маршрутизаторах и передаёт blackhole своим аплинкам. Трафик к жертве отбрасывается на входе в сеть, ещё до узкого места: забитый канал освобождается, соседние клиенты на узле работают. Но жертва полностью недоступна, как и хотел атакующий. Поэтому RTBH — крайняя мера. Тоньше — FlowSpec (фильтр по портам и протоколам) или очистка трафика (scrubbing) с возвратом чистого трафика по GRE.</p>', k: ['анонс /32 с community', 'next-hop Null0 на границе', 'спасает остальных', 'жертва недоступна', 'FlowSpec и scrubbing как альтернатива'] }
  ],
  lab: {
    title: 'Лаба 8. «Лифт ми Ап» с двумя провайдерами — с обеих сторон стыка',
    time: '≈ 4–5 часов (лучше в два захода)',
    goal: `<p>AS64500 «Лифт ми Ап» (R1) подключена к двум провайдерам: ISP1 AS64501 (R2 — его настраиваешь ты как инженер провайдера) и ISP2 AS64502 (R3, уже настроен). Оба получают «интернет» от AS64510 (R4), а между собой пирингуются. Поднять сессии, прочитать таблицу, отфильтровать клиента правильно, не стать транзитом, управлять входящим и исходящим трафиком, сделать blackhole и IP SLA.</p>`,
    topo: {
      w: 900, h: 470,
      zones: [{ x: 20, y: 150, w: 230, h: 200, label: 'AS64500 Лифт ми Ап', c: '#2563eb' }, { x: 330, y: 20, w: 230, h: 170, label: 'AS64501 ISP1 (ты)', c: '#7c3aed' }, { x: 330, y: 290, w: 230, h: 170, label: 'AS64502 ISP2', c: '#0f766e' }, { x: 640, y: 150, w: 240, h: 200, label: 'AS64510 «Интернет»', c: '#64748b' }],
      nodes: [
        { id: 'R1', t: 'router', x: 130, y: 250, label: 'R1 msk-arbat\nLo1 100.0.0.1/24\nLo2 100.0.1.1/24', role: 'клиент AS64500' },
        { id: 'R2', t: 'pe', x: 440, y: 105, label: 'R2 ISP1\nLo0 10.255.2.2', role: 'провайдер AS64501 — настраиваешь ты' },
        { id: 'R3', t: 'pe', x: 440, y: 375, label: 'R3 ISP2\nLo0 10.255.3.3', role: 'провайдер AS64502 (готов)', color: '#0f766e' },
        { id: 'R4', t: 'isp', x: 760, y: 250, label: 'R4 «Интернет»\n8.8.8.0/24, 1.1.1.0/24\n203.0.113.0/24', role: 'AS64510 (готов)' }
      ],
      links: [['R1', 'Gi0/0', 'R2', 'Gi0/0', '101.0.0.0/30'], ['R1', 'Gi0/1', 'R3', 'Gi0/0', '102.0.0.0/30'], ['R2', 'Gi0/1', 'R4', 'Gi0/0', '10.24.0.0/30'], ['R3', 'Gi0/1', 'R4', 'Gi0/1', '10.34.0.0/30'], ['R2', 'Gi0/2', 'R3', 'Gi0/2', 'пиринг 10.23.0.0/30']]
    },
    addr: [['R1 Gi0/0 ↔ R2 Gi0/0', '101.0.0.0/30', 'R2 .1, R1 .2'], ['R1 Gi0/1 ↔ R3 Gi0/0', '102.0.0.0/30', 'R3 .1, R1 .2'], ['R2 ↔ R4', '10.24.0.0/30', 'R2 .1, R4 .2'], ['R3 ↔ R4', '10.34.0.0/30', 'R3 .1, R4 .2'], ['R2 ↔ R3 (пиринг)', '10.23.0.0/30', 'R2 .1, R3 .2'], ['R1', 'сеть клиента', '100.0.0.0/23 (Lo1, Lo2)'], ['R4', '«интернет»', 'Lo 8.8.8.8/24, 1.1.1.1/24, 203.0.113.1/24']],
    init: {
      R1: 'hostname R1\nno ip domain-lookup\ninterface Loopback1\n ip address 100.0.0.1 255.255.255.0\ninterface Loopback2\n ip address 100.0.1.1 255.255.255.0\ninterface Gi0/0\n description ISP1\n ip address 101.0.0.2 255.255.255.252\n no shutdown\ninterface Gi0/1\n description ISP2\n ip address 102.0.0.2 255.255.255.252\n no shutdown\nline con 0\n logging synchronous\n exec-timeout 0 0',
      R2: 'hostname R2\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.2.2 255.255.255.255\ninterface Gi0/0\n description CUST-LIFTMEUP-AS64500\n ip address 101.0.0.1 255.255.255.252\n no shutdown\ninterface Gi0/1\n description UPSTREAM-AS64510\n ip address 10.24.0.1 255.255.255.252\n no shutdown\ninterface Gi0/2\n description PEER-ISP2-AS64502\n ip address 10.23.0.1 255.255.255.252\n no shutdown\nline con 0\n logging synchronous\n exec-timeout 0 0',
      R3: 'hostname R3\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.3.3 255.255.255.255\ninterface Gi0/0\n description CUST-LIFTMEUP-AS64500\n ip address 102.0.0.1 255.255.255.252\n no shutdown\ninterface Gi0/1\n ip address 10.34.0.1 255.255.255.252\n no shutdown\ninterface Gi0/2\n ip address 10.23.0.2 255.255.255.252\n no shutdown\nip prefix-list CUST seq 10 permit 100.0.0.0/23 le 24\nip community-list standard LP80 permit 64502:80\nroute-map FROM-CUST permit 10\n match community LP80\n match ip address prefix-list CUST\n set local-preference 80\nroute-map FROM-CUST permit 20\n match ip address prefix-list CUST\nrouter bgp 64502\n bgp router-id 10.255.3.3\n bgp log-neighbor-changes\n neighbor 102.0.0.2 remote-as 64500\n neighbor 102.0.0.2 description CUST-LIFTMEUP\n neighbor 102.0.0.2 route-map FROM-CUST in\n neighbor 102.0.0.2 maximum-prefix 20 80\n neighbor 10.34.0.2 remote-as 64510\n neighbor 10.23.0.1 remote-as 64501\n neighbor 10.23.0.1 description PEER-ISP1\nline con 0\n logging synchronous\n exec-timeout 0 0',
      R4: 'hostname R4\nno ip domain-lookup\ninterface Loopback1\n ip address 8.8.8.8 255.255.255.0\ninterface Loopback2\n ip address 1.1.1.1 255.255.255.0\ninterface Loopback3\n ip address 203.0.113.1 255.255.255.0\ninterface Gi0/0\n ip address 10.24.0.2 255.255.255.252\n no shutdown\ninterface Gi0/1\n ip address 10.34.0.2 255.255.255.252\n no shutdown\nrouter bgp 64510\n bgp router-id 10.255.4.4\n bgp log-neighbor-changes\n network 8.8.8.0 mask 255.255.255.0\n network 1.1.1.0 mask 255.255.255.0\n network 203.0.113.0 mask 255.255.255.0\n neighbor 10.24.0.1 remote-as 64501\n neighbor 10.34.0.1 remote-as 64502\nline con 0\n logging synchronous\n exec-timeout 0 0'
    },
    pre: 'R3 (ISP2) и R4 («интернет») уже настроены. R3 поддерживает community <code>64502:80</code> (понизить local-pref клиента до 80) и пускает от клиента только 100.0.0.0/23 le 24. R1 и R2 — твоя работа. Подумай заранее, где ты клиент (R1), а где провайдер (R2).',
    tasks: [
      { t: 'Сессии и FSM', d: 'На R1 подними eBGP к R2 и R3, на R2 — к R1, R4 и пиру R3 (адреса в схеме). Включи <code>debug ip bgp</code> (на одном маршрутизаторе) и поймай переходы состояний одной сессии. Проверь <code>show ip bgp summary</code> везде.',
        check: 'R1#show ip bgp summary\nR2#show ip bgp summary\nR2#show ip bgp neighbors 101.0.0.2 | include state|capabilit',
        sol: 'R1(config)#router bgp 64500\nR1(config-router)#bgp router-id 100.0.0.1\nR1(config-router)#bgp log-neighbor-changes\nR1(config-router)#neighbor 101.0.0.1 remote-as 64501\nR1(config-router)#neighbor 102.0.0.1 remote-as 64502\nR2(config)#router bgp 64501\nR2(config-router)#bgp router-id 10.255.2.2\nR2(config-router)#neighbor 101.0.0.2 remote-as 64500\nR2(config-router)#neighbor 10.24.0.2 remote-as 64510\nR2(config-router)#neighbor 10.23.0.2 remote-as 64502' },
      { t: 'Анонс своей сети', d: 'На R1 анонсируй 100.0.0.0/23 через <code>network</code>. Сначала без маршрута в Null0: появился ли анонс? Затем с ним. Проверь, что R4 видит 100.0.0.0/23 и по какому пути. Пингани с R1 <code>ping 8.8.8.8 source Lo1</code>.',
        check: 'R1#show ip bgp\nR1#show ip bgp neighbors 101.0.0.1 advertised-routes\nR4#show ip bgp 100.0.0.0/23\nR1#ping 8.8.8.8 source Loopback1',
        sol: 'R1(config)#ip route 100.0.0.0 255.255.254.0 Null0\nR1(config)#router bgp 64500\nR1(config-router)#network 100.0.0.0 mask 255.255.254.0' },
      { t: 'Прочитай выбор пути', d: 'На R1: <code>show ip bgp 8.8.8.0/24</code>. Сколько путей, какой лучший, и <b>на каком шаге</b> алгоритма принято решение? Обоснуй письменно. То же на R4 для 100.0.0.0/23.',
        hint: 'Если всё одинаково до шага «eBGP vs iBGP» включительно, а IGP-метрика до next-hop равна (connected), решает «самый старый путь», затем router-id.' },
      { t: 'R1 — транзит? Проверь и закрой', d: 'Посмотри на R2 (ISP1 пока без фильтров): есть ли у него путь к 8.8.8.0/24 через AS64500 (то есть «64500 64502 64510»)? Если есть, клиент стал транзитом между провайдерами. Закрой на R1 экспорт всего, кроме своих маршрутов (as-path <code>^$</code>), в обе стороны. Почему R3 такой путь не показывает даже без фильтра на R1?',
        check: 'R2#show ip bgp 8.8.8.0/24\nR3#show ip bgp 8.8.8.0/24\nR1#show ip bgp neighbors 101.0.0.1 advertised-routes',
        sol: 'R1(config)#ip as-path access-list 1 permit ^$\nR1(config)#router bgp 64500\nR1(config-router)#neighbor 101.0.0.1 filter-list 1 out\nR1(config-router)#neighbor 102.0.0.1 filter-list 1 out\nR1#clear ip bgp * soft out\n! R3 тоже защищён своим prefix-list CUST — посмотри, почему путь через 64500 у него всё равно может отсутствовать' },
      { t: 'Ты — ISP1: правильно прими клиента', d: 'На R2 для клиента 101.0.0.2: prefix-list <code>CUST-64500</code> (100.0.0.0/23 le 24), AS-path только <code>^64500(_64500)*$</code>, maximum-prefix 10 с предупреждением на 80%, клиенту — только default (<code>default-originate</code> + фильтр, чтобы ушёл <b>только</b> 0/0). Пиру R3 отдавай только свои и клиентские маршруты, без маршрутов от R4.',
        hint: 'Для «только default» к клиенту: prefix-list DEFAULT-ONLY permit 0.0.0.0/0 + <code>neighbor 101.0.0.2 prefix-list DEFAULT-ONLY out</code>. Для пира: маршруты клиента отличишь по AS-path <code>^64500_</code>, а свои — <code>^$</code>. Удобно пометить клиентские маршруты community 64501:100 на входе и выпускать к пиру только их.',
        check: 'R2#show ip bgp neighbors 101.0.0.2 routes\nR2#show ip bgp neighbors 101.0.0.2 advertised-routes\nR2#show ip bgp neighbors 10.23.0.2 advertised-routes\nR1#show ip bgp',
        sol: 'R2(config)#ip prefix-list CUST-64500 seq 10 permit 100.0.0.0/23 le 24\nR2(config)#ip as-path access-list 10 permit ^64500(_64500)*$\nR2(config)#ip prefix-list DEFAULT-ONLY seq 10 permit 0.0.0.0/0\nR2(config)#route-map FROM-CUST-64500 permit 10\nR2(config-route-map)#match ip address prefix-list CUST-64500\nR2(config-route-map)#match as-path 10\nR2(config-route-map)#set community 64501:100\nR2(config)#ip community-list standard CUSTOMERS permit 64501:100\nR2(config)#ip as-path access-list 20 permit ^$\nR2(config)#route-map TO-PEER permit 10\nR2(config-route-map)#match community CUSTOMERS\nR2(config)#route-map TO-PEER permit 20\nR2(config-route-map)#match as-path 20\nR2(config)#router bgp 64501\nR2(config-router)#neighbor 101.0.0.2 route-map FROM-CUST-64500 in\nR2(config-router)#neighbor 101.0.0.2 maximum-prefix 10 80\nR2(config-router)#neighbor 101.0.0.2 default-originate\nR2(config-router)#neighbor 101.0.0.2 prefix-list DEFAULT-ONLY out\nR2(config-router)#neighbor 10.23.0.2 route-map TO-PEER out\nR2(config-router)#neighbor 10.23.0.2 send-community' },
      { t: 'Исходящий трафик клиента — через ISP1', d: 'На R1 сделай так, чтобы весь исходящий трафик шёл через ISP1, а ISP2 был резервом (LOCAL_PREF 200 на всё от ISP1). Проверь traceroute с R1 до 203.0.113.1 и 1.1.1.1.',
        check: 'R1#show ip bgp\nR1#traceroute 203.0.113.1 source Lo1 numeric',
        sol: 'R1(config)#route-map FROM-ISP1 permit 10\nR1(config-route-map)#set local-preference 200\nR1(config)#router bgp 64500\nR1(config-router)#neighbor 101.0.0.1 route-map FROM-ISP1 in\nR1#clear ip bgp 101.0.0.1 soft in' },
      { t: 'Входящий трафик: prepend, community, specifics', d: 'Сделай ISP2 резервным и для входящего трафика тремя способами по очереди, каждый раз проверяя на R4 <code>show ip bgp 100.0.0.0/23</code>: 1) prepend ×3 в сторону ISP2; 2) вместо prepend — community 64502:80 (не забудь send-community) — посмотри local-pref на R3; 3) анонс в ISP1 двух /24, а в ISP2 только /23. Объясни, какой способ «сильнее» и почему.',
        check: 'R4#show ip bgp 100.0.0.0/23\nR3#show ip bgp 100.0.0.0/23\nR4#show ip bgp | include 100.0',
        sol: 'R1(config)#route-map TO-ISP2 permit 10\nR1(config-route-map)#set as-path prepend 64500 64500 64500\nR1(config)#router bgp 64500\nR1(config-router)#neighbor 102.0.0.1 route-map TO-ISP2 out\n! вариант 2:\nR1(config)#route-map TO-ISP2 permit 10\nR1(config-route-map)#no set as-path prepend 64500 64500 64500\nR1(config-route-map)#set community 64502:80\nR1(config-router)#neighbor 102.0.0.1 send-community\n! вариант 3: network 100.0.0.0 mask 255.255.255.0 и 100.0.1.0 mask 255.255.255.0 (+ Null0-статика)\n! и prefix-list к ISP2, пропускающий только /23\n! specifics сильнее всего: longest match работает до BGP-алгоритма' },
      { t: 'Blackhole', d: 'На R2 (ISP1) реализуй приём blackhole от клиента: /32 из его сети с community <code>65535:666</code> → next-hop 192.0.2.1 (маршрут 192.0.2.1/32 → Null0) + no-export. На R1 анонсируй <code>100.0.0.66/32</code> с этой community (Null0-статика + network + route-map). С R4 пингани 100.0.0.66 и 100.0.0.1: что дошло, а что нет?',
        hint: 'Prefix-list клиента на R2 должен пропускать /32 только вместе с blackhole-community (отдельная секция route-map раньше обычной). На R1 нужен send-community к R2.',
        check: 'R2#show ip bgp 100.0.0.66/32\nR2#show ip route 100.0.0.66\nR4#ping 100.0.0.66\nR4#ping 100.0.0.1 source Loopback1',
        sol: 'R2(config)#ip route 192.0.2.1 255.255.255.255 Null0\nR2(config)#ip prefix-list CUST-64500-32 seq 10 permit 100.0.0.0/23 ge 32\nR2(config)#ip community-list standard BLACKHOLE permit 65535:666\nR2(config)#route-map FROM-CUST-64500 permit 5\nR2(config-route-map)#match community BLACKHOLE\nR2(config-route-map)#match ip address prefix-list CUST-64500-32\nR2(config-route-map)#set ip next-hop 192.0.2.1\nR2(config-route-map)#set community no-export additive\n! не забудь max-prefix запас и soft in\nR1(config)#ip route 100.0.0.66 255.255.255.255 Null0\nR1(config)#ip prefix-list BH seq 10 permit 100.0.0.66/32\nR1(config)#route-map TO-ISP1 permit 10\nR1(config-route-map)#match ip address prefix-list BH\nR1(config-route-map)#set community 65535:666\nR1(config)#route-map TO-ISP1 permit 20\nR1(config)#router bgp 64500\nR1(config-router)#network 100.0.0.66 mask 255.255.255.255\nR1(config-router)#neighbor 101.0.0.1 route-map TO-ISP1 out\nR1(config-router)#neighbor 101.0.0.1 send-community\n! важно: filter-list 1 out (^$) пропустит /32 — это свой маршрут' },
      { t: 'IP SLA + track (без BGP)', d: 'Представь, что у R1 нет BGP с ISP2, только статика. Сделай default через ISP1 с track по IP SLA (icmp-echo к 10.24.0.1 — адрес аплинка ISP1 в сторону «интернета», через Gi0/0, частота 5 с) и резервный default через ISP2 с AD 250. Не забудь /32 к цели теста строго через ISP1. Проверь, выключив Gi0/1 на R2: адрес упавшего интерфейса перестаёт отвечать.',
        hint: 'Для опыта временно сделай <code>neighbor … shutdown</code> для обоих соседей в BGP на R1, чтобы не мешал. Маршрут к цели SLA: <code>ip route 10.24.0.1 255.255.255.255 101.0.0.1</code>. Цель — именно аплинк провайдера, а не его адрес в твою сторону: тот отвечал бы и при мёртвом аплинке.',
        check: 'R1#show ip sla statistics 1\nR1#show track 1\nR1#show ip route 0.0.0.0',
        sol: 'R1(config)#ip sla 1\nR1(config-ip-sla)#icmp-echo 10.24.0.1 source-interface Gi0/0\nR1(config-ip-sla-echo)#frequency 5\nR1(config)#ip sla schedule 1 life forever start-time now\nR1(config)#track 1 ip sla 1 reachability\nR1(config-track)#delay down 10 up 20\nR1(config)#ip route 10.24.0.1 255.255.255.255 101.0.0.1\nR1(config)#ip route 0.0.0.0 0.0.0.0 101.0.0.1 track 1\nR1(config)#ip route 0.0.0.0 0.0.0.0 102.0.0.1 250' }
    ],
    brk: [
      { t: 'Сессия R1–R3 не поднимается, в логах NOTIFICATION', inj: 'R1(config)#router bgp 64500\nR1(config-router)#no neighbor 102.0.0.1\nR1(config-router)#neighbor 102.0.0.1 remote-as 64520', h: '<code>show ip bgp neighbors 102.0.0.1 | include state|reset|Notification</code>, <code>show logging | include BGP</code>.', f: 'Неверный remote-as: R3 присылает OPEN с AS64502, R1 ждёт 64520 и отвечает NOTIFICATION «bad peer AS» (в логе «peer in wrong AS»). Сессия циклично уходит в Idle/Active. Исправь remote-as.' },
      { t: 'Интернет «не видит» сеть клиента, хотя сессии Established', inj: 'R1(config)#no ip route 100.0.0.0 255.255.254.0 Null0', h: '<code>show ip bgp 100.0.0.0/23</code> на R1. <code>advertised-routes</code>. Есть ли такой маршрут в RIB?', f: 'network требует точного маршрута в RIB. Статика Null0 удалена, /23 в RIB нет (есть только /24 connected), анонс отозван. Верни Null0-маршрут.' },
      { t: 'Сессия R2–R1 упала и не поднимается: в логах MAXPFX', inj: 'R2(config)#router bgp 64501\nR2(config-router)#neighbor 101.0.0.2 maximum-prefix 1\n! и на R1 анонсируй ещё 100.0.0.0/24 и 100.0.1.0/24', h: '<code>show ip bgp summary</code> на R2 — «Idle (PfxCt)». <code>show logging | include MAXPFX</code>.', f: 'Клиент прислал больше префиксов, чем разрешено maximum-prefix: сессия разорвана и стоит в Idle. После исправления лимита нужен <code>clear ip bgp 101.0.0.2</code> (или <code>restart N</code> в maximum-prefix для автоподъёма). Лимит должен быть с запасом относительно реального числа.' },
      { t: 'После «добавления политики» R1 получает от ISP1 только default, а от ISP2 — пусто', inj: 'R1(config)#ip prefix-list ONLY8 seq 10 permit 8.8.8.0/24\nR1(config)#route-map FROM-ISP2 permit 10\nR1(config-route-map)#match ip address prefix-list ONLY8\nR1(config-route-map)#set local-preference 50\nR1(config)#router bgp 64500\nR1(config-router)#neighbor 102.0.0.1 route-map FROM-ISP2 in\nR1#clear ip bgp 102.0.0.1 soft in', h: '<code>show route-map FROM-ISP2</code>, <code>show ip bgp neighbors 102.0.0.1 routes</code>. Что происходит с маршрутами, не попавшими в ONLY8?', f: 'Неявный deny в конце route-map: всё, кроме 8.8.8.0/24, отброшено. (Если ISP2 не присылал 8.8.8.0/24 по каким-то причинам — отброшено вообще всё.) Добавь <code>route-map FROM-ISP2 permit 20</code> без условий.' },
      { t: 'Клиентская сеть видна у R4 только через ISP2, хотя ISP1 работает', inj: 'R2(config)#ip prefix-list CUST-64500 seq 10 permit 100.0.0.0/23\nR2(config)#ip prefix-list CUST-64500 seq 5 deny 100.0.0.0/23', h: '<code>show ip prefix-list CUST-64500</code> на R2: порядок строк. <code>show ip bgp neighbors 101.0.0.2 routes</code>.', f: 'В prefix-list строка 5 deny стоит раньше permit: префикс клиента отбрасывается на входе R2. Prefix-list, как и ACL, — первое совпадение. Удали лишнюю строку.' }
    ],
    extra: '<p><b>RPKI в лабе.</b> Подними в EVE-NG Linux-узел (Ubuntu) с Routinator или rpki-client, а на CSR1000v (вместо R2) настрой <code>bgp rpki server tcp X port 3323 refresh 600</code> и <code>bgp bestpath prefix-validate allow-invalid</code> / route-map с <code>match rpki invalid</code>. Посмотри статусы V/I/N в <code>show ip bgp</code>. Для лабы с частными адресами RPKI-данные реального интернета не подойдут: используй локальные исключения (SLURM) Routinator, чтобы «подписать» свои префиксы.</p>'
  }
});
