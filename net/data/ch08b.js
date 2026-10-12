COURSE.add({
  id: 'ch08b',
  time: '≈ 6–8 часов',
  intro: `<p>«Лифт ми Ап» становится провайдером: несколько граничных маршрутизаторов, свои клиенты по BGP, несколько аплинков. Внешние маршруты должны распространиться <b>внутри</b> AS — это iBGP. У него свои правила (split horizon, неизменный next-hop), без понимания которых маршруты «есть, но не работают». Отсюда route reflector'ы, связка IGP + iBGP и, в конце главы, идея <b>BGP-free core</b>, которая подводит нас к MPLS.</p>`,
  goals: [
    'Объяснить, зачем iBGP, и правило iBGP split horizon, из которого следует full mesh',
    'Понимать, почему next-hop не меняется в iBGP, и решать это через next-hop-self или IGP',
    'Строить iBGP между loopback\'ами поверх IGP: зачем это и что нужно',
    'Настроить route reflector: клиенты, не-клиенты, ORIGINATOR_ID, CLUSTER_LIST, резервирование RR',
    'Понимать конфедерации, peer-group/templates и community как инструмент политик провайдера',
    'Объяснить проблему «транзитные P-маршрутизаторы без BGP» и почему её решает MPLS'
  ],
  why: `У любого провайдера десятки и сотни маршрутизаторов с BGP: PE с клиентами, бордеры с аплинками и пирами. Как они узнают маршруты друг друга, какие RR, где next-hop-self, как community протаскивают политику через всю сеть — это повседневная архитектура и повседневный траблшутинг («маршрут есть в BGP, но не в RIB»).`,
  refs: [
    { t: 'RFC 4456 — BGP Route Reflection', u: 'https://www.rfc-editor.org/rfc/rfc4456' },
    { t: 'RFC 5065 — Autonomous System Confederations for BGP', u: 'https://www.rfc-editor.org/rfc/rfc5065' },
    { t: 'RFC 7911 — Advertisement of Multiple Paths in BGP (add-path)', u: 'https://www.rfc-editor.org/rfc/rfc7911' },
    { t: 'J. Doyle — Routing TCP/IP Vol. II', n: 'гл. 2–3: iBGP, RR, конфедерации' },
    { t: 'linkmeup — СДСМ 8.1. iBGP', u: 'https://linkmeup.ru/blog/92.html' }
  ],
  theory: [
    {
      id: 'why', h: 'Зачем iBGP и почему не IGP',
      html: `
<p>Граничный маршрутизатор R2 получил от аплинка миллион маршрутов. Остальным маршрутизаторам AS их тоже нужно знать, иначе они не поймут, к какому бордеру слать трафик. Варианты:</p>
<ul><li><b>Редистрибуция BGP в IGP</b> — миллион LSA. Нет (глава 6).</li>
<li><b>Default на ближайший бордер</b> — работает для простых случаев, но теряется выбор лучшего выхода и политики.</li>
<li><b>iBGP</b> — BGP-сессии <b>внутри</b> одной AS. Маршруты переносятся со всеми атрибутами (LOCAL_PREF, community, MED), политики работают по всей AS.</li></ul>
<div class="callout info"><b>Разделение труда</b>IGP (OSPF/IS-IS) знает только инфраструктуру: loopback'и и линки, сотни префиксов, сходится быстро. iBGP знает внешний мир и клиентов, миллионы префиксов, работает медленнее, зато с политиками. iBGP опирается на IGP: сессии строятся между loopback'ами, а next-hop BGP-маршрутов разрешается через IGP.</div>`
    },
    {
      id: 'rules', h: 'Два правила iBGP, которые всё объясняют',
      html: `
<h3>1. iBGP split horizon → full mesh</h3>
<p>В eBGP от петель защищает AS_PATH. Внутри AS номер AS не добавляется, так что петлю по AS_PATH не увидеть. Поэтому правило: <b>маршрут, полученный от iBGP-соседа, не передаётся другим iBGP-соседям</b>. Следствие: каждый BGP-маршрутизатор AS должен иметь сессию с каждым (<b>full mesh</b>). Для N маршрутизаторов это N(N−1)/2 сессий: 10 → 45, 100 → 4950. Не масштабируется, отсюда route reflector'ы.</p>
<h3>2. NEXT_HOP не меняется в iBGP</h3>
<p>R2 получил от аплинка 8.8.8.0/24 с next-hop 10.24.0.2 (адрес аплинка) и передал его по iBGP на R5. На R5 next-hop <b>так и остался 10.24.0.2</b>. Если R5 не знает маршрута к 10.24.0.0/30, путь <b>невалидный</b>: в <code>show ip bgp</code> он есть, но без <code>&gt;</code>, и в RIB не попадёт.</p>
<p>Два решения:</p>
<ul><li><code>neighbor X next-hop-self</code> на бордере: при передаче по iBGP подставлять свой адрес (loopback). Стандарт для eBGP-маршрутов. На IOS-XE есть <code>next-hop-self all</code> для отражённых маршрутов.</li>
<li>Анонсировать линки к внешним соседям в IGP (как passive). Работает, но засоряет IGP чужими сетями.</li></ul>
<pre class="cli">R5#show ip bgp 8.8.8.0/24
BGP routing table entry for 8.8.8.0/24
Paths: (1 available, [[no best path]])
  64510
    [[10.24.0.2 (inaccessible)]] from 10.255.0.2 (10.255.0.2)
      Origin IGP, localpref 100, valid, internal</pre>
<h3>3. Сессии между loopback'ами</h3>
<p>Сессия iBGP на адресах физических линков умирает вместе с линком, даже если есть обходной путь. Поэтому iBGP строят между <b>loopback'ами</b> (<code>update-source Loopback0</code>), а достижимость loopback'ов обеспечивает IGP. Упал линк — IGP нашёл обход, BGP-сессия даже не заметила. TTL для iBGP по умолчанию 255, multihop не нужен.</p>
<div class="callout warn"><b>Синхронизация (историческое)</b>Старое правило «не используй iBGP-маршрут, пока его нет в IGP» (<code>synchronization</code>) давно выключено по умолчанию. Но проблема, которую оно решало, никуда не делась: транзитный маршрутизатор без BGP не знает внешних маршрутов и дропает трафик (см. последний раздел).</div>`
    },
    {
      id: 'rr', h: 'Route reflector',
      html: `
<p><b>RR</b> — iBGP-маршрутизатор, которому разрешено нарушать split horizon для своих <b>клиентов</b>. Клиенты держат сессии только с RR (обычно с двумя для резерва), а не со всеми.</p>
<table><tr><th>Маршрут получен от</th><th>RR передаёт</th></tr>
<tr><td>RR-клиента</td><td>всем: клиентам, не-клиентам, eBGP</td></tr>
<tr><td>не-клиента (обычный iBGP)</td><td>только клиентам и eBGP</td></tr>
<tr><td>eBGP</td><td>всем</td></tr></table>
<p>Клиент ничего особенного не настраивает: он даже не знает, что он клиент. Всё на RR: <code>neighbor X route-reflector-client</code>.</p>
<h3>Защита от петель при отражении</h3>
<ul><li><b>ORIGINATOR_ID</b> — router-id того, кто ввёл маршрут в AS. Получил маршрут со своим ORIGINATOR_ID — отбрось.</li>
<li><b>CLUSTER_LIST</b> — список cluster-id RR, через которые прошёл маршрут (по умолчанию cluster-id = router-id RR). Увидел свой cluster-id — отбрось.</li></ul>
<h3>Важное поведение RR</h3>
<ul><li>RR <b>не меняет next-hop</b> отражённых маршрутов (и не должен). Next-hop-self делают бордеры для своих eBGP-маршрутов.</li>
<li>RR передаёт клиентам только <b>свой лучший</b> путь. Если к префиксу два выхода (два бордера), клиенты видят только тот, что лучший для RR, то есть ближайший к RR по IGP, а не к ним. Решения: размещать RR с учётом топологии, <b>add-path</b> (передавать несколько путей), BGP Optimal Route Reflection (RFC 9107).</li>
<li>RR не обязан быть в пути трафика. Часто это отдельные выделенные машины (даже виртуальные: vRR, XRv, FRR/BIRD), которые не пересылают ни одного пакета абонентов. Это <b>control-plane RR</b>.</li></ul>
<pre class="cli">RR1(config)#router bgp 64500
RR1(config-router)#bgp cluster-id 1.1.1.1
RR1(config-router)#neighbor IBGP peer-group
RR1(config-router)#neighbor IBGP remote-as 64500
RR1(config-router)#neighbor IBGP update-source Loopback0
RR1(config-router)#neighbor IBGP route-reflector-client
RR1(config-router)#neighbor IBGP send-community both
RR1(config-router)#neighbor 10.255.0.2 peer-group IBGP
RR1(config-router)#neighbor 10.255.0.5 peer-group IBGP
R5#show ip bgp 8.8.8.0/24
  64510
    10.255.0.2 (metric 200) from 10.255.0.1 (10.255.0.1)
      Origin IGP, localpref 100, valid, internal, best
      [[Originator: 10.255.0.2, Cluster list: 1.1.1.1]]</pre>
<div class="callout pro"><b>Дизайн RR у провайдера</b>Два (или больше) RR на кластер, каждый клиент ходит к обоим. Одинаковый cluster-id у пары — экономия памяти, но меньше путей. Разный — больше устойчивости. Иерархия RR для очень больших сетей. Для разных сервисов (Internet, VPNv4, EVPN) часто отдельные RR. С приходом MPLS VPN (глава 11) на RR ложатся VPN-маршруты всех клиентов, поэтому им нужна память, а не скорость пересылки.</div>`
    },
    {
      id: 'conf', h: 'Конфедерации, peer-group, шаблоны',
      html: `
<p><b>Конфедерация</b> — альтернатива RR: AS делится на под-AS (обычно приватные номера). Внутри под-AS — full mesh iBGP, между под-AS — «eBGP конфедерации», где AS_PATH пишется в отдельном сегменте AS_CONFED_SEQUENCE (защита от петель), а NEXT_HOP, LOCAL_PREF и MED сохраняются как в iBGP. Снаружи конфедерация выглядит одной AS. Используется при слиянии сетей (две компании с разными AS) и в очень больших сетях. Чаще встречаются RR.</p>
<h3>Peer-group и шаблоны</h3>
<p>Десятки соседей с одинаковыми настройками удобно описать один раз:</p>
<ul><li><b>peer-group</b> — общие настройки, плюс на старых IOS общий расчёт исходящих UPDATE (производительность).</li>
<li><b>peer-session</b> / <b>peer-policy</b> templates — с наследованием, гибче.</li>
<li>Современный IOS сам группирует соседей с одинаковой исходящей политикой в <b>update-groups</b>.</li></ul>`
    },
    {
      id: 'comm', h: 'Community как язык политик внутри провайдера',
      html: `
<p>Хорошая провайдерская сеть помечает каждый маршрут на входе, откуда он, и дальше на всех маршрутизаторах принимает решения только по меткам. Пример схемы для AS64500:</p>
<table><tr><th>Community</th><th>Смысл</th><th>Кто ставит</th></tr>
<tr><td>64500:100</td><td>маршрут клиента</td><td>PE на входе от клиента</td></tr>
<tr><td>64500:200</td><td>маршрут пира</td><td>бордер на входе от пира</td></tr>
<tr><td>64500:300</td><td>маршрут транзитного аплинка</td><td>бордер</td></tr>
<tr><td>64500:1xxx</td><td>город или узел входа (1001 Москва, 1002 СПб…)</td><td>все</td></tr>
<tr><td>64500:80 / :120</td><td>«сделай меня резервным / основным» — от клиента</td><td>клиент</td></tr>
<tr><td>64500:666</td><td>blackhole</td><td>клиент или NOC</td></tr></table>
<p>Экспорт тогда пишется в одну строку: «к пирам и аплинкам — только 64500:100 и свои агрегаты». Клиенты получают всё. Это и есть правило Gao-Rexford из главы 8, реализованное в конфигурации.</p>
<div class="callout pro"><b>Типичный траблшутинг</b>«Клиент говорит, что его префикс не виден у пира X». Цепочка: принят ли префикс на PE (prefix-list, RPKI) → какие community он получил → дошёл ли до бордера через RR (<code>show ip bgp P</code> на бордере) → пропускает ли экспортная политика к пиру (<code>advertised-routes</code>) → виден ли он снаружи (looking glass, RIPEstat).</div>`
    },
    {
      id: 'free', h: 'Проблема транзита без BGP и путь к MPLS',
      html: `
<p>Представь ядро провайдера: бордеры и PE с BGP по краям, а посередине P-маршрутизаторы, которые просто перекачивают трафик. Пакет к 8.8.8.8 входит на PE1, должен выйти через бордер R2, а по дороге проходит P1 и P2.</p>
<ul><li>Если на P1 и P2 <b>нет BGP</b>, они не знают маршрута к 8.8.8.8, и пакет дропается: <b>чёрная дыра</b> посередине. Next-hop (бордер R2) достижим, но промежуточные хопы маршрутизируют по адресу назначения, а не по next-hop.</li>
<li>Поставить BGP с full view на <b>все</b> P — дорого: память, FIB, сходимость, и всё ядро завязано на интернет-таблицу.</li></ul>
<p>Решения:</p>
<ol class="steps"><li>Туннелировать трафик от PE до бордера, чтобы P видели только адрес назначения туннеля (loopback бордера, известный IGP): GRE — тяжело и неудобно.</li>
<li><b>MPLS</b>: PE1 навешивает на пакет <b>метку</b>, соответствующую loopback'у бордера R2 (по LDP), и P-маршрутизаторы коммутируют по метке, не заглядывая в IP-адрес назначения. Ядро без BGP — <b>BGP-free core</b>. Это тема главы 10, и именно поэтому MPLS появился у провайдеров.</li></ol>
<div class="callout info"><b>Что запомнить</b>«Next-hop достижим» ≠ «каждый хоп по пути знает маршрут к адресу назначения». В IP-сети без меток рекурсивная маршрутизация на PE не помогает транзитным узлам. Эта мысль — ключ к пониманию, зачем нужен MPLS.</div>`
    }
  ],
  cmds: [
    { g: 'iBGP' },
    { c: 'neighbor X remote-as 64500 (своя AS)', d: 'iBGP-сосед', hw: 'peer X as-number 64500', jn: 'group IBGP type internal' },
    { c: 'neighbor X update-source Loopback0', d: 'Сессия с loopback (адрес источника TCP)', hw: 'peer X connect-interface LoopBack0', jn: 'local-address 10.255.0.1' },
    { c: 'neighbor X next-hop-self [all]', d: 'Подставлять себя как next-hop при передаче по iBGP', hw: 'peer X next-hop-local', jn: 'export policy: then next-hop self' },
    { c: 'neighbor X route-reflector-client', d: 'Сделать соседа клиентом RR (на RR)', hw: 'peer X reflect-client', jn: 'group G cluster 1.1.1.1' },
    { c: 'bgp cluster-id 1.1.1.1', d: 'Идентификатор кластера RR', hw: 'reflector cluster-id 1.1.1.1', jn: 'cluster 1.1.1.1' },
    { c: 'neighbor G peer-group\nneighbor X peer-group G', d: 'Группа соседей с общими настройками', hw: 'group G internal\n peer X group G', jn: 'group G { neighbor X; }' },
    { c: 'template peer-session S / peer-policy P', d: 'Шаблоны с наследованием', hw: '—', jn: 'apply-groups' },
    { c: 'bgp confederation identifier 64500\nbgp confederation peers 65001 65002', d: 'Конфедерация (router bgp 65001)', hw: 'confederation id 64500 / confederation peer-as 65002', jn: 'set routing-options confederation 64500 members [65001 65002]' },
    { c: 'bgp additional-paths send receive / neighbor X advertise additional-paths best 2', d: 'Add-path: несколько путей к префиксу (IOS-XE)', hw: 'peer X capability-advertise add-path both', jn: 'add-path send path-count 2' },
    { g: 'Проверка' },
    { c: 'show ip bgp P', d: 'Next-hop (inaccessible?), Originator, Cluster list, от кого получен', hw: 'display bgp routing-table P', jn: 'show route P detail' },
    { c: 'show ip bgp summary', d: 'Сессии iBGP: все ли Established', hw: 'display bgp peer', jn: 'show bgp summary' },
    { c: 'show ip bgp update-group', d: 'Группы соседей с общей исходящей политикой', hw: 'display bgp update-peer-group', jn: '—' },
    { c: 'show ip route P / show ip cef P', d: 'Попал ли BGP-маршрут в RIB/FIB и через какой next-hop IGP', hw: 'display ip routing-table P verbose', jn: 'show route forwarding-table destination P' }
  ],
  cards: [
    ['Правило iBGP split horizon?', 'Маршрут, полученный от iBGP-соседа, не передаётся другим iBGP-соседям. Отсюда требование full mesh.'],
    ['Сколько iBGP-сессий в full mesh из N маршрутизаторов?', 'N(N−1)/2. Для 10 — 45, для 100 — 4950.'],
    ['Меняется ли NEXT_HOP в iBGP?', 'Нет. Остаётся адрес внешнего соседа. Если он недостижим по IGP, путь невалиден (inaccessible).'],
    ['Как решить проблему недостижимого next-hop в iBGP?', 'next-hop-self на бордере (стандарт) или анонс внешних линков в IGP (passive).'],
    ['Зачем iBGP между loopback\'ами?', 'Сессия не зависит от одного физического линка: IGP находит обход, сессия живёт. Нужен update-source Loopback0 и маршрут до loopback в IGP.'],
    ['Правила отражения RR?', 'От клиента — всем. От не-клиента — только клиентам (и eBGP). От eBGP — всем.'],
    ['ORIGINATOR_ID и CLUSTER_LIST?', 'ORIGINATOR_ID — RID того, кто ввёл маршрут в AS (свой — отбросить). CLUSTER_LIST — список cluster-id пройденных RR (свой — отбросить). Защита от петель отражения.'],
    ['Меняет ли RR next-hop отражённых маршрутов?', 'Нет (и не должен). next-hop-self делают бордеры для eBGP-маршрутов.'],
    ['Почему клиенты RR могут выбирать неоптимальный выход?', 'RR отдаёт только свой лучший путь — ближайший к RR по IGP, а не к клиенту. Лечится расстановкой RR, add-path, BGP ORR.'],
    ['Что такое control-plane RR?', 'RR вне пути трафика (выделенный или виртуальный), который только обменивается маршрутами и не пересылает абонентский трафик.'],
    ['Что такое конфедерация BGP?', 'AS делится на под-AS: внутри full mesh, между ними eBGP конфедерации (AS_CONFED_SEQUENCE), NEXT_HOP/LP/MED сохраняются. Снаружи одна AS.'],
    ['Как community помогают провайдеру?', 'Каждый маршрут помечается на входе (клиент, пир, аплинк, город), и экспортные политики пишутся по меткам: к пирам — только клиентские и свои.'],
    ['Что случится с пакетом к 8.8.8.8 на P-маршрутизаторе без BGP?', 'Нет маршрута → drop. Next-hop бордера достижим, но промежуточные хопы маршрутизируют по адресу назначения. Решение — MPLS (BGP-free core).'],
    ['Что такое BGP-free core?', 'Ядро (P-маршрутизаторы) без BGP: трафик коммутируется по MPLS-меткам до loopback бордера/PE, и P не нужны внешние маршруты.'],
    ['Что такое add-path?', 'Расширение BGP (RFC 7911): передавать несколько путей к одному префиксу (для быстрого переключения и оптимального выбора за RR).']
  ],
  quiz: [
    { q: 'R5 получил по iBGP маршрут 8.8.8.0/24, но он без «>» и не в RIB. В show ip bgp: «10.24.0.2 (inaccessible)». Что сделать?', o: ['ebgp-multihop', 'next-hop-self на бордере, передавшем маршрут (или 10.24.0.0/30 в IGP)', 'route-reflector-client на R5', 'Увеличить LOCAL_PREF'], a: 1, e: 'Next-hop внешнего соседа не меняется в iBGP и неизвестен IGP.' },
    { q: 'Три маршрутизатора: R1–R2 и R2–R3 iBGP, R1–R3 сессии нет (не RR). R1 получил маршрут по eBGP. Будет ли он на R3?', o: ['Да, через R2', 'Нет: R2 не передаёт iBGP-маршрут другому iBGP-соседу', 'Да, если next-hop-self', 'Только с send-community'], a: 1, e: 'iBGP split horizon. Нужна сессия R1–R3, или R2 — RR, а R1 и R3 — его клиенты.' },
    { q: 'На RR маршрут получен от не-клиента. Кому RR его передаст?', o: ['Всем', 'Только клиентам (и eBGP-соседям)', 'Никому', 'Только не-клиентам'], a: 1, e: 'Не-клиенты между собой связаны full mesh. Отражать им друг друга не нужно, иначе петли.' },
    { q: 'Почему iBGP строят между loopback\'ами? (несколько)', o: ['Сессия не падает при отказе одного линка, если есть обход', 'Loopback всегда up', 'Так быстрее передаются UPDATE', 'Удобная стабильная адресация (= router-id)'], a: [0, 1, 3], e: 'Скорость UPDATE от этого не зависит. Стабильность — главное.' },
    { q: 'Два бордера R2 (Москва) и R7 (Владивосток) получают 8.8.8.0/24 с одинаковыми атрибутами. RR стоит в Москве. Через какой бордер пойдёт трафик клиента из Владивостока (без add-path)?', o: ['Через R7, ближайший к нему', 'Через R2: RR выбрал ближайший к себе путь и отразил только его', 'ECMP', 'Случайно'], a: 1, e: 'Классическая проблема RR — hot-potato с точки зрения RR, а не клиента. Решения: add-path, ORR, RR в каждом регионе.' },
    { q: 'Маршрут с CLUSTER_LIST, содержащим собственный cluster-id RR. Что сделает RR?', o: ['Примет и отразит', 'Отбросит как петлю', 'Поменяет next-hop', 'Передаст только eBGP'], a: 1, e: 'Свой cluster-id в списке означает петлю.' },
    { q: 'P-маршрутизатор в ядре без BGP, по нему идёт трафик от PE к бордеру на 8.8.8.8 (обычный IP, без MPLS). Что будет?', o: ['Пакет дойдёт: next-hop бордера достижим', 'Пакет будет отброшен на P: у него нет маршрута к 8.8.8.8', 'P спросит бордер по ARP', 'P переправит по default'], a: 1, e: 'Если у P нет default — drop. Поэтому либо BGP на всех транзитных, либо MPLS.' },
    { q: 'Что из этого — настройка на КЛИЕНТЕ route reflector?', o: ['route-reflector-client', 'bgp cluster-id', 'Ничего специального — обычный iBGP-сосед к RR', 'next-hop-self all'], a: 2, e: 'Вся логика отражения на RR. Клиент просто держит сессию с RR.' },
    { q: 'Зачем помечать маршруты community на входе в сеть провайдера?', o: ['Для шифрования', 'Чтобы политики экспорта по всей сети работали по меткам «клиент/пир/аплинк/город»', 'Чтобы уменьшить таблицу', 'Это обязательно по RFC'], a: 1, e: 'Метка на входе + решение по метке на выходе — масштабируемая реализация политик.' }
  ],
  und: [
    { q: 'Объясни два правила iBGP (split horizon и неизменный next-hop): откуда они взялись и к каким проблемам и решениям приводят.', a: '<p>Split horizon: внутри AS номер AS не добавляется в AS_PATH, поэтому по пути нельзя распознать петлю. Значит, маршрут от iBGP-соседа не передаётся другим iBGP. Следствие — full mesh, который не масштабируется. Решения: RR (контролируемое нарушение правила с ORIGINATOR_ID и CLUSTER_LIST) или конфедерации. Неизменный next-hop: iBGP переносит информацию «выход вон там» без изменения, а путь к «вон там» внутри AS должен знать IGP. Если next-hop — адрес внешнего соседа, которого IGP не знает, маршрут невалиден. Решение: next-hop-self на бордере (next-hop = его loopback, известный IGP).</p>', k: ['нет AS_PATH внутри → split horizon', 'full mesh → RR/конфедерации', 'next-hop не меняется', 'next-hop-self / IGP'] },
    { q: 'Как работает route reflector, как он защищается от петель и какой у него главный побочный эффект?', a: '<p>RR — iBGP-маршрутизатор, который отражает маршруты: от клиентов — всем, от не-клиентов — только клиентам. Клиенты держат сессии только с RR (двумя для резерва). Петли предотвращаются ORIGINATOR_ID (кто ввёл маршрут в AS) и CLUSTER_LIST (через какие кластеры прошёл). Побочный эффект: RR отдаёт только свой лучший путь, выбранный с точки зрения RR (IGP-метрика от RR), поэтому клиенты могут выходить через неоптимальный бордер и теряют разнообразие путей (медленнее переключаются). Лечится add-path, ORR, расстановкой RR.</p>', k: ['правила отражения', 'ORIGINATOR_ID / CLUSTER_LIST', 'только лучший путь RR', 'add-path / ORR'] },
    { q: 'Почему в чистой IP-сети транзитным маршрутизаторам ядра нужен BGP, и как MPLS убирает эту необходимость?', a: '<p>Каждый IP-маршрутизатор принимает решение по адресу назначения пакета. PE знает, что 8.8.8.8 — через бордер R2 (iBGP, next-hop R2), и отправляет пакет к R2 по IGP-пути. Но следующий хоп P1 снова смотрит на адрес назначения 8.8.8.8 и, если не знает его (нет BGP), дропает. Значит, всем транзитным нужен full view. MPLS меняет модель: PE навешивает метку, привязанную к loopback R2 (LDP распределяет метки для префиксов IGP). P-маршрутизаторы коммутируют по метке, не глядя на IP-адрес назначения. Им достаточно IGP и LDP — это BGP-free core.</p>', k: ['решение по Dst IP на каждом хопе', 'P без BGP → drop', 'full view везде дорого', 'метка к loopback бордера', 'BGP-free core'] }
  ],
  lab: {
    title: 'Лаба 8.1. Провайдер изнутри: IGP + iBGP + route reflector',
    time: '≈ 3 часа',
    goal: `<p>AS64500 из шести маршрутизаторов: два бордера (R2 с аплинком в AS64510, R6 с клиентом AS64600), два транзитных P (R3, R4) и RR (R1). IS-IS как IGP. Сначала сломать iBGP «по учебнику» (next-hop, split horizon), потом построить RR и увидеть, что транзитные без BGP роняют трафик. Это мотивация для MPLS в главе 10.</p>`,
    topo: {
      w: 900, h: 430,
      zones: [{ x: 150, y: 20, w: 600, h: 390, label: 'AS64500 · IS-IS L2 · iBGP', c: '#2563eb' }],
      nodes: [
        { id: 'R1', t: 'router', x: 450, y: 80, label: 'R1 (RR)\nLo0 10.255.0.1', role: 'route reflector (вне пути трафика)', color: '#9333ea' },
        { id: 'R2', t: 'pe', x: 250, y: 220, label: 'R2 бордер\nLo0 10.255.0.2', role: 'бордер к аплинку AS64510' },
        { id: 'R3', t: 'p', x: 400, y: 330, label: 'R3 (P)\nLo0 10.255.0.3', role: 'транзит' },
        { id: 'R4', t: 'p', x: 520, y: 330, label: 'R4 (P)\nLo0 10.255.0.4', role: 'транзит' },
        { id: 'R6', t: 'pe', x: 660, y: 220, label: 'R6 PE\nLo0 10.255.0.6', role: 'PE к клиенту AS64600' },
        { id: 'UP', t: 'isp', x: 60, y: 220, label: 'UP AS64510\n8.8.8.0/24', role: 'аплинк (готов)' },
        { id: 'CUST', t: 'ce', x: 840, y: 220, label: 'CUST AS64600\n198.18.0.0/24', role: 'клиент (готов)' }
      ],
      links: [['UP', 'Gi0/0', 'R2', 'Gi0/0', '10.24.0.0/30'], ['R2', 'Gi0/1', 'R3', 'Gi0/1'], ['R3', 'Gi0/2', 'R4', 'Gi0/2'], ['R4', 'Gi0/1', 'R6', 'Gi0/1'], ['R6', 'Gi0/0', 'CUST', 'Gi0/0', '10.66.0.0/30'], ['R1', 'Gi0/1', 'R2', 'Gi0/2'], ['R1', 'Gi0/2', 'R6', 'Gi0/2']]
    },
    addr: [['Линки внутри AS', 'Rx–Ry', '10.1.xy.0/31 (меньший .0)'], ['Loopback0', 'R1–R6', '10.255.0.N/32'], ['UP–R2', '10.24.0.0/30', 'R2 .1, UP .2'], ['R6–CUST', '10.66.0.0/30', 'R6 .1, CUST .2'], ['UP', 'Lo1', '8.8.8.8/24'], ['CUST', 'Lo1', '198.18.0.1/24']],
    init: (function () {
      const b = n => `hostname R${n}\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.${n} 255.255.255.255\nline con 0\n logging synchronous\n exec-timeout 0 0\n`;
      const i = (ifc, ip) => `interface ${ifc}\n ip address ${ip} 255.255.255.254\n no shutdown\n`;
      return {
        R1: b(1) + i('Gi0/1', '10.1.12.0') + i('Gi0/2', '10.1.16.0'),
        R2: b(2) + 'interface Gi0/0\n ip address 10.24.0.1 255.255.255.252\n no shutdown\n' + i('Gi0/1', '10.1.23.0') + i('Gi0/2', '10.1.12.1'),
        R3: b(3) + i('Gi0/1', '10.1.23.1') + i('Gi0/2', '10.1.34.0'),
        R4: b(4) + i('Gi0/2', '10.1.34.1') + i('Gi0/1', '10.1.46.0'),
        R6: b(6) + 'interface Gi0/0\n ip address 10.66.0.1 255.255.255.252\n no shutdown\n' + i('Gi0/1', '10.1.46.1') + i('Gi0/2', '10.1.16.1'),
        UP: 'hostname UP\nno ip domain-lookup\ninterface Loopback1\n ip address 8.8.8.8 255.255.255.0\ninterface Gi0/0\n ip address 10.24.0.2 255.255.255.252\n no shutdown\nrouter bgp 64510\n network 8.8.8.0 mask 255.255.255.0\n neighbor 10.24.0.1 remote-as 64500\nline con 0\n logging synchronous\n exec-timeout 0 0',
        CUST: 'hostname CUST\nno ip domain-lookup\ninterface Loopback1\n ip address 198.18.0.1 255.255.255.0\ninterface Gi0/0\n ip address 10.66.0.2 255.255.255.252\n no shutdown\nrouter bgp 64600\n network 198.18.0.0 mask 255.255.255.0\n neighbor 10.66.0.1 remote-as 64500\nline con 0\n logging synchronous\n exec-timeout 0 0'
      };
    })(),
    pre: 'UP и CUST уже настроены. Обрати внимание на путь трафика R2 ↔ R6: через R3 и R4 (P) — это кратчайший по IGP путь. R1 стоит сбоку: линки R1–R2 и R1–R6 сделай дорогими в IS-IS (metric 1000), чтобы трафик через RR не шёл.',
    tasks: [
      { t: 'IGP ядра', d: 'IS-IS level-2-only, wide metrics, p2p на всех внутренних линках R1–R6, loopback\'и passive. На линках R1–R2 и R1–R6 metric 1000, на остальных 10. Внешние линки (к UP и CUST) в IS-IS не включай.',
        check: 'R6#show isis neighbors\nR6#show ip route isis\nR6#traceroute 10.255.0.2 source Lo0' },
      { t: 'eBGP на краях', d: 'R2 ↔ UP (AS64510), R6 ↔ CUST (AS64600). Проверь, что R2 знает 8.8.8.0/24, а R6 — 198.18.0.0/24.',
        check: 'R2#show ip bgp summary\nR6#show ip bgp' },
      { t: 'iBGP R2–R6 «как в учебнике» и invalid next-hop', d: 'Подними iBGP R2 ↔ R6 между loopback\'ами (update-source), <b>без</b> next-hop-self. Посмотри <code>show ip bgp 8.8.8.0/24</code> на R6. Почему путь невалиден? Почини через next-hop-self и объясни, почему так правильнее, чем включить 10.24.0.0/30 в IS-IS.',
        check: 'R6#show ip bgp 8.8.8.0/24\nR6#show ip route 8.8.8.0',
        sol: 'R2(config)#router bgp 64500\nR2(config-router)#neighbor 10.255.0.6 remote-as 64500\nR2(config-router)#neighbor 10.255.0.6 update-source Loopback0\nR6(config)#router bgp 64500\nR6(config-router)#neighbor 10.255.0.2 remote-as 64500\nR6(config-router)#neighbor 10.255.0.2 update-source Loopback0\n! next hop 10.24.0.2 (inaccessible) → \nR2(config-router)#neighbor 10.255.0.6 next-hop-self\nR6(config-router)#neighbor 10.255.0.2 next-hop-self' },
      { t: 'Транзит без BGP — чёрная дыра', d: 'Теперь у R2 и R6 есть все маршруты. С CUST: <code>ping 8.8.8.8 source Lo1</code>. Не работает? Найди, на каком хопе теряется пакет (traceroute с CUST и <code>show ip route 8.8.8.8</code> на R4 и R3). Запиши, почему так происходит. Это главная мотивация MPLS.',
        check: 'CUST#traceroute 8.8.8.8 source Lo1 numeric\nR4#show ip route 8.8.8.8\nR3#show ip route 198.18.0.1',
        hint: 'R6 отправляет пакет к next-hop 10.255.0.2 по IGP через R4. R4 смотрит на адрес назначения 8.8.8.8, а маршрута у него нет.' },
      { t: 'Временное решение: iBGP и на P', d: 'Чтобы трафик пошёл, R3 и R4 тоже должны знать внешние маршруты. Сделай full mesh iBGP между R2, R3, R4, R6 и проверь пинг CUST → 8.8.8.8. Посчитай, сколько сессий понадобилось и сколько понадобилось бы для 50 маршрутизаторов.',
        check: 'CUST#ping 8.8.8.8 source Lo1\nR3#show ip bgp summary' },
      { t: 'Route reflector', d: 'Убери full mesh. Сделай R1 route reflector: R2, R3, R4, R6 — его клиенты (peer-group, update-source, send-community). На клиентах — только сессия к R1. next-hop-self на бордерах (R2, R6) к R1. Проверь на R4 атрибуты маршрута 8.8.8.0/24: Originator, Cluster list, next-hop. Пинг CUST → 8.8.8.8 работает?',
        check: 'R4#show ip bgp 8.8.8.0/24\nR1#show ip bgp summary\nCUST#ping 8.8.8.8 source Lo1',
        sol: 'R1(config)#router bgp 64500\nR1(config-router)#bgp router-id 10.255.0.1\nR1(config-router)#bgp cluster-id 1.1.1.1\nR1(config-router)#neighbor CLIENTS peer-group\nR1(config-router)#neighbor CLIENTS remote-as 64500\nR1(config-router)#neighbor CLIENTS update-source Loopback0\nR1(config-router)#neighbor CLIENTS route-reflector-client\nR1(config-router)#neighbor CLIENTS send-community both\nR1(config-router)#neighbor 10.255.0.2 peer-group CLIENTS\nR1(config-router)#neighbor 10.255.0.3 peer-group CLIENTS\nR1(config-router)#neighbor 10.255.0.4 peer-group CLIENTS\nR1(config-router)#neighbor 10.255.0.6 peer-group CLIENTS\n! на R2: neighbor 10.255.0.1 remote-as 64500 / update-source Lo0 / next-hop-self' },
      { t: 'Community-политика провайдера', d: 'На R6 метить маршруты клиента <code>64500:100</code>, на R2 маршруты аплинка — <code>64500:300</code>. На R2 разреши экспорт к UP только маршрутов с 64500:100 (без своих P2P и чужих). Проверь на UP, что он видит 198.18.0.0/24, а на CUST — что видит 8.8.8.0/24.',
        check: 'R2#show ip bgp 198.18.0.0/24\nR2#show ip bgp neighbors 10.24.0.2 advertised-routes\nUP#show ip bgp' }
    ],
    brk: [
      { t: 'R4 потерял все BGP-маршруты, хотя сессия с R1 Established', inj: 'R1(config)#router bgp 64500\nR1(config-router)#no neighbor 10.255.0.4 route-reflector-client', h: '<code>show ip bgp summary</code> на R4 — сколько префиксов? <code>show ip bgp neighbors 10.255.0.4</code> на R1 — клиент ли он?', f: 'R4 больше не клиент RR: R1 не отражает ему маршруты от других iBGP-соседей (split horizon). R4 получает только маршруты, которые R1 сгенерировал сам (их нет). Верни route-reflector-client.' },
      { t: 'iBGP R2–R1 флапает при каждом изменении на линке R1–R2', inj: 'R2(config)#router bgp 64500\nR2(config-router)#no neighbor 10.255.0.1 update-source Loopback0', h: '<code>show ip bgp neighbors 10.255.0.1 | include Local host|Foreign host</code> на R2: с какого адреса R2 устанавливает TCP?', f: 'R2 шлёт TCP с адреса физического интерфейса, а R1 ждёт сессию от 10.255.0.2 (loopback). Соединение отвергается. Для iBGP по loopback нужен update-source с обеих сторон.' },
      { t: 'На R6 маршрут 8.8.8.0/24 есть, но «inaccessible»', inj: 'R2(config)#router bgp 64500\nR2(config-router)#no neighbor 10.255.0.1 next-hop-self', h: '<code>show ip bgp 8.8.8.0/24</code> на R6 — какой next-hop? Знает ли его IS-IS?', f: 'Бордер перестал менять next-hop: на RR и клиентах next-hop = 10.24.0.2 (внешний линк), неизвестный IGP. RR next-hop не меняет. Верни next-hop-self на R2.' }
    ],
    extra: '<p><b>Проблема «лучшего пути RR».</b> Добавь второй аплинк к UP с R6 (линк R6–UP) и анонсируй 8.8.8.0/24 через оба бордера. Перенеси RR ближе к R2 (metric 10 на R1–R2, 1000 на R1–R6). Посмотри, через какой бордер выходит R4 и R6. Затем на R1 включи <code>bgp additional-paths send</code> / <code>neighbor CLIENTS advertise additional-paths best 2</code> (IOS-XE / CSR) и сравни.</p>'
  }
});
