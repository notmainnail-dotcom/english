COURSE.add({
  id: 'ch06',
  time: '≈ 10–12 часов (1,5–2 недели в норме)',
  intro: `<p>Начинается настоящая маршрутизация. В исходной статье — OSPF и EIGRP. У провайдера EIGRP практически не встречается (он Cisco-only), а в ядре почти всегда <b>IS-IS</b> или OSPF. Поэтому глава построена так: OSPF глубоко, до уровня LSDB и типов LSA, затем IS-IS как рабочий IGP провайдера, затем быстрая сходимость (BFD, таймеры, LFA). EIGRP и редистрибуция — кратко, для общего понимания.</p>
<p class="muted">Стартовая оценка OSPF — 4/10, пробелы: состояния соседства, SPF, причины проблем с соседством. Именно этому здесь уделено больше всего места.</p>`,
  goals: [
    'Объяснить, как link-state протокол строит одинаковую карту сети на всех маршрутизаторах и считает по ней SPF',
    'Пройти все состояния соседства OSPF и по застрявшему состоянию сразу назвать причину',
    'Читать LSDB: типы LSA 1/2/3/4/5/7, кто их генерирует и куда они распространяются',
    'Проектировать зоны (backbone, stub, NSSA), суммировать на ABR/ASBR',
    'Настроить IS-IS (NET, L1/L2, wide metrics, overload bit) и объяснить, почему провайдеры выбирают его',
    'Ускорить сходимость: BFD, SPF/LSA-троттлинг, LFA. Мигрировать с OSPF на IS-IS без простоя'
  ],
  why: `IGP — фундамент провайдерской сети: по нему строятся LDP/MPLS, на нём держатся iBGP-сессии между loopback'ами, от его сходимости зависит, сколько миллисекунд абоненты не увидят при обрыве волокна. «Почему OSPF-сосед не поднимается» и «почему трафик пошёл не тем путём» — ежедневные вопросы в NOC.`,
  refs: [
    { t: 'RFC 2328 — OSPF Version 2', u: 'https://www.rfc-editor.org/rfc/rfc2328', n: 'первоисточник: состояния, LSA, SPF' },
    { t: 'J. Doyle — Routing TCP/IP Vol. I (2nd ed.)', n: 'гл. 8–9 (OSPF), гл. 10 (IS-IS). Лучшее изложение link-state' },
    { t: 'ISO/IEC 10589 и RFC 1195 — IS-IS for IP', u: 'https://www.rfc-editor.org/rfc/rfc1195' },
    { t: 'RFC 5305 — IS-IS Extensions for Traffic Engineering (wide metrics)', u: 'https://www.rfc-editor.org/rfc/rfc5305' },
    { t: 'RFC 5880 — Bidirectional Forwarding Detection', u: 'https://www.rfc-editor.org/rfc/rfc5880' },
    { t: 'RFC 5286 — Basic Specification for IP Fast Reroute: Loop-Free Alternates', u: 'https://www.rfc-editor.org/rfc/rfc5286' },
    { t: 'Cisco: OSPF Neighbor Problems Explained', u: 'https://www.cisco.com/c/en/us/support/docs/ip/open-shortest-path-first-ospf/13699-29.html' },
    { t: 'R. White, A. Retana — IS-IS: Deployment in IP Networks', n: 'IS-IS глазами архитекторов провайдерских сетей' }
  ],
  theory: [
    {
      id: 'idea', h: 'Как работают протоколы маршрутизации: две философии',
      html: `
<div class="vs"><div><b>Distance-vector</b> (RIP, EIGRP; BGP — path-vector)<br>Маршрутизатор знает только «до сети X — расстояние N через соседа Y». Соседи передают друг другу свои таблицы. Просто, но каждый видит сеть «чужими глазами», а петли нужно предотвращать специальными механизмами (split horizon, poison reverse, DUAL, AS-path).</div>
<div><b>Link-state</b> (OSPF, IS-IS)<br>Каждый маршрутизатор рассказывает всем о <b>себе</b>: какие у него линки, соседи и стоимости. Эти описания (LSA/LSP) рассылаются флудом по всей зоне без изменений. В итоге у всех <b>одинаковая карта</b> (LSDB), и каждый сам считает по ней кратчайшие пути алгоритмом Дейкстры (SPF).</div></div>
<h3>Сходимость = четыре этапа</h3>
<ol class="steps"><li><b>Обнаружение</b> отказа: потеря линка (мгновенно), истечение dead-таймера (40 с по умолчанию!) или BFD (десятки мс).</li>
<li><b>Распространение</b>: генерация и флуд нового LSA.</li>
<li><b>Вычисление</b>: SPF по обновлённой LSDB.</li>
<li><b>Установка</b> маршрутов в RIB, а затем в FIB (железо). На больших таблицах это самый долгий этап.</li></ol>
<p>Ускорять нужно все четыре. Об этом последний раздел главы.</p>
<div class="callout info"><b>Почему не BGP внутри и не OSPF в интернете</b>IGP оптимизирует <b>кратчайший путь</b> внутри одной администрации и сходится быстро, но не масштабируется на миллион префиксов и не умеет в политики. BGP (глава 8) переносит огромные таблицы и политики между организациями, но медленный и ничего не знает о топологии. У провайдера они работают вместе: IGP знает только инфраструктуру (loopback'и и линки, сотни и тысячи префиксов), BGP — всё остальное.</div>`
    },
    {
      id: 'adj', h: 'OSPF: соседство по шагам и диагностика по состоянию',
      html: `
<p>OSPF работает прямо поверх IP (протокол 89). Hello шлются на <b>224.0.0.5</b> (все OSPF-маршрутизаторы), на broadcast-сетях DR/BDR слушают ещё <b>224.0.0.6</b>. По умолчанию hello каждые 10 с, dead через 40 с (на broadcast и p2p).</p>
<h3>Что должно совпадать в Hello (иначе соседства не будет)</h3>
<table><tr><th>Параметр</th><th>Что если не совпадает</th></tr>
<tr><td>Area ID</td><td>hello игнорируются, в логе «mismatched area»</td></tr>
<tr><td>Hello и Dead интервалы</td><td>соседа нет вообще</td></tr>
<tr><td>Подсеть и маска (на broadcast)</td><td>соседа нет (на p2p маска не проверяется)</td></tr>
<tr><td>Флаги зоны (stub/NSSA)</td><td>соседа нет</td></tr>
<tr><td>Аутентификация</td><td>соседа нет, в debug «mismatched authentication»</td></tr>
<tr><td>Router ID должен <b>различаться</b></td><td>%OSPF-4-DUP_RTRID_NBR, соседство не встаёт или LSDB ломается</td></tr>
<tr><td>MTU (проверяется в DBD, а не в hello)</td><td>застревание в EXSTART/EXCHANGE</td></tr></table>
<h3>Состояния и что значит «застрял в X»</h3>
<table><tr><th>Состояние</th><th>Что происходит</th><th>Если застрял</th></tr>
<tr><td>Down</td><td>hello от соседа нет</td><td>L1/L2, ACL блокирует 224.0.0.5 или протокол 89, passive-interface, OSPF не включён на интерфейсе</td></tr>
<tr><td>Init</td><td>я получаю hello соседа, но в нём <b>нет моего RID</b></td><td>одностороннее: сосед не получает мои hello (ACL, односторонний линк, проблемы с multicast)</td></tr>
<tr><td>2-Way</td><td>видим друг друга в hello</td><td>на broadcast-сети <b>норма для двух DROther</b>: FULL только с DR и BDR. Иначе — выборы DR не прошли</td></tr>
<tr><td>ExStart</td><td>выбор master/slave для обмена описанием баз (по большему RID)</td><td><b>MTU mismatch</b>, дубль RID</td></tr>
<tr><td>Exchange</td><td>обмен DBD: заголовки всех LSA</td><td>MTU mismatch (тоже часто), проблемы с unicast между соседями</td></tr>
<tr><td>Loading</td><td>запрос недостающих LSA (LSR) и получение (LSU)</td><td>битые или слишком большие LSA, фрагментация</td></tr>
<tr><td>Full</td><td>базы синхронизированы</td><td>—</td></tr></table>
<pre class="cli">R1#show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
10.255.0.2        0   [[FULL/  -]]        00:00:36    10.1.12.1       GigabitEthernet0/0
10.255.0.3        1   [[EXSTART/DR]]      00:00:38    10.1.13.1       GigabitEthernet0/1
R1#show ip ospf interface Gi0/1
  Internet Address 10.1.13.0/31, Area 0, Attached via Interface Enable
  Process ID 1, Router ID 10.255.0.1, Network Type BROADCAST, Cost: 1
  Timer intervals configured, Hello 10, Dead 40, Wait 40, Retransmit 5
R1#debug ip ospf adj
OSPF-1 ADJ   Gi0/1: Nbr 10.255.0.3 has [[larger interface MTU]]</pre>
<div class="callout pro"><b>Правило NOC</b>Сосед не поднимается: 1) <code>show ip ospf interface</code> с обеих сторон — area, таймеры, тип сети, passive, аутентификация; 2) <code>show ip ospf neighbor</code> — в каком состоянии; 3) <code>debug ip ospf adj</code> (на проде — с осторожностью) — он прямо пишет причину. В 90% случаев это таймеры, area, MTU или passive.</div>`
    },
    {
      id: 'nettype', h: 'Типы сетей OSPF и DR/BDR',
      html: `
<p>На multi-access сети (Ethernet-сегмент с N маршрутизаторами) полное соседство «каждый с каждым» дало бы N(N−1)/2 соседств и лавину флуда. Поэтому выбираются <b>DR</b> (designated router) и <b>BDR</b>. Все устанавливают FULL только с ними, DR генерирует LSA типа 2 за весь сегмент. Выбор: наибольший <code>ip ospf priority</code> (по умолчанию 1, 0 — никогда не DR), затем наибольший RID. Выбор <b>не вытесняющий</b>: новый маршрутизатор с priority 255 не отнимет роль у действующего DR.</p>
<table><tr><th>Тип сети</th><th>DR/BDR</th><th>Hello/Dead</th><th>Где</th></tr>
<tr><td>broadcast</td><td>да</td><td>10/40</td><td>Ethernet по умолчанию</td></tr>
<tr><td>point-to-point</td><td>нет</td><td>10/40</td><td>serial, туннели, <b>Ethernet между двумя маршрутизаторами (надо ставить вручную)</b></td></tr>
<tr><td>non-broadcast (NBMA)</td><td>да, соседи вручную</td><td>30/120</td><td>Frame Relay — история</td></tr>
<tr><td>point-to-multipoint</td><td>нет</td><td>30/120</td><td>DMVPN-фазы, хаб-спок</td></tr></table>
<div class="callout pro"><b>Почему у провайдера на всех линках network point-to-point</b>Линк ядра — это Ethernet между двумя маршрутизаторами. Тип broadcast на нём бесполезен и вреден: выборы DR (лишние ~40 с wait-таймера при старте), лишний LSA типа 2, транзитная «псевдо-нода» в SPF. <code>ip ospf network point-to-point</code> убирает всё это: соседство поднимается быстрее, LSDB меньше. В IS-IS аналог — <code>isis network point-to-point</code>.</div>
<div class="callout warn"><b>Несовпадение типов сети</b>Одна сторона p2p, другая broadcast: таймеры одинаковые (10/40), поэтому соседство может дойти до FULL. Но LSA описывают линк по-разному: broadcast-сторона ждёт DR и LSA типа 2, p2p-сторона его не создаёт. SPF не может построить связь, и маршруты через этот линк <b>не устанавливаются</b>. Коварная поломка: соседство «зелёное», а трафик не идёт. Есть в лабе.</div>`
    },
    {
      id: 'lsdb', h: 'LSDB: типы LSA, SPF и метрика',
      html: `
<table><tr><th>Тип</th><th>Название</th><th>Кто создаёт</th><th>Что описывает</th><th>Где живёт</th></tr>
<tr><td>1</td><td>Router</td><td>каждый маршрутизатор</td><td>свои линки в зоне, соседей, стоимости, stub-сети (loopback'и)</td><td>в своей зоне</td></tr>
<tr><td>2</td><td>Network</td><td>DR</td><td>multi-access сегмент и всех подключённых к нему</td><td>в своей зоне</td></tr>
<tr><td>3</td><td>Summary</td><td>ABR</td><td>префиксы <b>других</b> зон (без топологии!) + стоимость до них от ABR</td><td>в зону, куда ABR их отдаёт</td></tr>
<tr><td>4</td><td>ASBR Summary</td><td>ABR</td><td>«как добраться до ASBR из другой зоны»</td><td>как тип 3</td></tr>
<tr><td>5</td><td>External</td><td>ASBR</td><td>внешние (редистрибутированные) префиксы</td><td>во всём домене, кроме stub/NSSA</td></tr>
<tr><td>7</td><td>NSSA External</td><td>ASBR в NSSA</td><td>внешние префиксы внутри NSSA</td><td>только в NSSA; ABR транслирует в тип 5</td></tr></table>
<p>Внутри зоны OSPF — честный link-state: по LSA 1 и 2 строится граф, и SPF ищет кратчайшие пути. Между зонами он ведёт себя как <b>distance-vector</b>: LSA 3 говорят только «префикс X за ABR со стоимостью N». Поэтому межзоновый трафик обязан идти через area 0. Это правило предотвращает петли.</p>
<pre class="cli">R1#show ip ospf database
            OSPF Router with ID (10.255.0.1) (Process ID 1)
                Router Link States (Area 0)
Link ID         ADV Router      Age         Seq#       Checksum Link count
10.255.0.1      10.255.0.1      312         0x80000006 0x00A1B2 5
10.255.0.3      10.255.0.3      298         0x80000004 0x00C3D4 3
                Summary Net Link States (Area 0)
Link ID         ADV Router      Age         Seq#       Checksum
172.16.16.0     10.255.0.1      120         0x80000001 0x0011AA
                Type-5 AS External Link States
Link ID         ADV Router      Age         Seq#       Checksum Tag
192.168.100.0   10.255.0.1      95          0x80000001 0x00BB22 0
R1#show ip ospf database router 10.255.0.3     ! содержимое конкретного LSA
R1#show ip ospf statistics                       ! сколько раз и как долго считался SPF</pre>
<h3>Метрика (cost)</h3>
<p><b>cost = reference bandwidth / bandwidth интерфейса</b>. Reference по умолчанию 100 Мбит/с, поэтому FastEthernet, 1G, 10G и 100G получают одинаковую стоимость 1. В современной сети это бессмыслица. <code>auto-cost reference-bandwidth 100000</code> (100G) на <b>всех</b> маршрутизаторах: тогда 1G = 100, 10G = 10, 100G = 1. У провайдеров часто вообще задают стоимости вручную (<code>ip ospf cost</code>) по задержке или по плану трафика.</p>
<h3>Коды маршрутов</h3>
<ul><li><code>O</code> — внутризоновый (intra-area). Всегда предпочтительнее остальных при равном префиксе.</li>
<li><code>O IA</code> — межзоновый (из LSA 3).</li>
<li><code>O E1</code> / <code>O E2</code> — внешние. E2 (по умолчанию): метрика = только внешняя, не растёт внутри домена. E1: внешняя + внутренняя до ASBR. Порядок предпочтения: O &gt; O IA &gt; E1 &gt; E2 (и N1 &gt; N2 для NSSA).</li></ul>
<div class="callout info"><b>Sequence number и age</b>Каждый LSA имеет номер версии (seq, растёт при изменении) и возраст (освежается раз в 30 минут, умирает в 60). Если seq одного LSA растёт каждые несколько секунд — где-то флапает линк. Это видно в <code>show ip ospf database</code> и по счётчику SPF в <code>show ip ospf statistics</code>.</div>`
    },
    {
      id: 'areas', h: 'Зоны OSPF: зачем, правила, stub и NSSA',
      html: `
<p>Зоны ограничивают флуд LSA 1/2 и область пересчёта SPF: изменение в area 10 не заставляет пересчитывать SPF в area 20, туда долетает только обновлённый LSA 3. Правила:</p>
<ul><li>Все зоны подключены к <b>area 0</b> (backbone). Межзоновый трафик идёт через area 0.</li>
<li><b>ABR</b> — маршрутизатор с интерфейсами в area 0 и в другой зоне. <b>ASBR</b> — маршрутизатор, который редистрибутирует внешние маршруты.</li>
<li>Суммаризация возможна только на ABR (<code>area X range</code>) и на ASBR (<code>summary-address</code>), не внутри зоны: внутри LSDB одинаковая у всех.</li>
<li>Virtual link — костыль для зоны, не касающейся area 0. Используется только при миграциях.</li></ul>
<table><tr><th>Тип зоны</th><th>LSA 3</th><th>LSA 5</th><th>LSA 7</th><th>Что получает взамен</th></tr>
<tr><td>Обычная</td><td>✓</td><td>✓</td><td>—</td><td>—</td></tr>
<tr><td>Stub</td><td>✓</td><td>✗</td><td>—</td><td>default (LSA 3) от ABR</td></tr>
<tr><td>Totally stubby</td><td>✗ (кроме default)</td><td>✗</td><td>—</td><td>только default</td></tr>
<tr><td>NSSA</td><td>✓</td><td>✗</td><td>✓</td><td>внешние маршруты <b>внутри</b> зоны можно редистрибутировать (тип 7)</td></tr>
<tr><td>Totally NSSA</td><td>✗ (кроме default)</td><td>✗</td><td>✓</td><td>default + свои внешние</td></tr></table>
<pre class="cli">R1(config-router)#area 1 nssa                         ! на всех в area 1
R1(config-router)#area 1 range 172.16.16.0 255.255.248.0   ! суммаризация на ABR
R1(config-router)#summary-address 192.168.0.0 255.255.0.0  ! на ASBR для внешних
R1(config-router)#default-information originate [always]   ! анонс default</pre>
<div class="callout pro"><b>Дизайн у провайдера</b>Многие операторы держат IGP <b>в одной зоне</b> (OSPF area 0 или IS-IS L2) до тысячи и более маршрутизаторов: современное железо считает SPF за миллисекунды, а одна зона упрощает MPLS-TE и Segment Routing. Зоны вводят, когда реально упираются в масштаб: например, сеть доступа в отдельной зоне или уровне L1.</div>`
    },
    {
      id: 'isis', h: 'IS-IS: IGP провайдеров',
      html: `
<p>IS-IS (Intermediate System to Intermediate System) создан ISO для стека OSI и позже научился носить IP (Integrated IS-IS, RFC 1195). Алгоритм тот же, что у OSPF (link-state + SPF), но устройство другое, и это нравится провайдерам.</p>
<h3>Ключевые отличия от OSPF</h3>
<table><tr><th></th><th>OSPF</th><th>IS-IS</th></tr>
<tr><td>Транспорт</td><td>поверх IP (протокол 89)</td><td>прямо на L2 (CLNS), <b>не IP</b>. Атаковать его по IP нельзя, ошибка в IP-адресации не ломает соседство</td></tr>
<tr><td>Иерархия</td><td>зоны вокруг area 0, граница зоны — на маршрутизаторе</td><td>уровни L1 и L2, граница — <b>по линку</b>. Маршрутизатор целиком в одной area. Backbone = все L2-маршрутизаторы</td></tr>
<tr><td>Расширяемость</td><td>новые типы LSA (тяжело)</td><td><b>TLV</b>: новый функционал (IPv6, TE, Segment Routing) — просто новые TLV в тех же LSP</td></tr>
<tr><td>IPv6</td><td>отдельный протокол OSPFv3</td><td>тот же процесс, ещё TLV</td></tr>
<tr><td>Единица флуда</td><td>много разных LSA</td><td>один LSP на маршрутизатор (с фрагментами)</td></tr>
<tr><td>Аналог DR</td><td>DR + BDR, не вытесняющий</td><td>DIS, без backup, <b>вытесняющий</b></td></tr></table>
<h3>Адрес NET</h3>
<p>Маршрутизатор в IS-IS идентифицируется по <b>NET</b> (Network Entity Title), например <code>49.0001.0100.2550.0001.00</code>:</p>
<ul><li><code>49</code> — AFI «частные адреса», как RFC1918.</li>
<li><code>0001</code> — номер area.</li>
<li><code>0100.2550.0001</code> — <b>System ID</b> (6 байт, уникален в домене). Удобный приём — закодировать loopback: 10.255.0.1 → 010.255.000.001 → 0102.5500.0001. Попроще — использовать номер маршрутизатора.</li>
<li><code>00</code> — NSEL, для маршрутизатора всегда 00.</li></ul>
<h3>Уровни</h3>
<ul><li><b>L1</b> — маршрутизация внутри area (как totally stubby: наружу через ближайший L1/L2 по биту <b>ATT</b> — attached).</li>
<li><b>L2</b> — между area, backbone.</li>
<li><b>L1/L2</b> — пограничные (по умолчанию на Cisco маршрутизатор L1/L2: держит две LSDB).</li></ul>
<p>Типичный провайдерский дизайн: все маршрутизаторы <code>is-type level-2-only</code> в одной area. Просто и предсказуемо.</p>
<pre class="cli">router isis CORE
 net 49.0001.0102.5500.0001.00
 is-type level-2-only
 metric-style wide                 ! 24-битные метрики (обязательно для TE/SR)
 log-adjacency-changes
 passive-interface Loopback0
interface Gi0/1
 ip router isis CORE
 isis network point-to-point
 isis metric 100
R1#show isis neighbors
System Id      Type Interface   IP Address      State Holdtime Circuit Id
R3             L2   Gi0/1       10.1.13.1       [[UP]]    25       00
R1#show isis database detail R3.00-00
R1#show isis topology</pre>
<div class="callout info"><b>Metric-style wide</b>Исторические «narrow» метрики — 6 бит на линк (максимум 63), этого мало. <code>metric-style wide</code> (RFC 5305) даёт 24 бита на линк и нужна для MPLS-TE и SR. Ставится одинаково на всех маршрутизаторах: при смешении narrow и wide маршрутизаторы не поймут TLV друг друга.</div>
<h3>Overload bit — «не вези через меня транзит»</h3>
<p><code>set-overload-bit</code> выставляет в LSP флаг: «я есть, мои собственные префиксы достижимы, но транзитом меня не используйте». Применение: плановые работы (трафик заранее уходит в обход, потом ты спокойно перезагружаешь узел) и старт после перезагрузки (<code>set-overload-bit on-startup wait-for-bgp</code>: пока BGP не получил полную таблицу, транзит не идёт, и трафик не падает в чёрную дыру). Аналог в OSPF — <code>max-metric router-lsa [on-startup]</code>.</p>
<div class="callout pro"><b>Почему провайдеры любят IS-IS</b>Не зависит от IP (меньше способов сломать его ошибкой адресации или атакой), TLV-расширяемость (SR, TE, flex-algo пришли сначала в IS-IS), один процесс для IPv4 и IPv6, простой плоский L2-дизайн. Исторически крупные операторы стартовали на IS-IS, и экосистема (вендоры, опыт) сложилась вокруг него. OSPF при этом тоже встречается у провайдеров повсеместно. Знать нужно оба.</div>`
    },
    {
      id: 'fast', h: 'Быстрая сходимость: BFD, таймеры, LFA',
      html: `
<h3>1. Обнаружение: BFD</h3>
<p>Если линк умер «посередине» (транспорт DWDM, промежуточный L2-коммутатор), интерфейс остаётся up, и OSPF узнает об отказе только через dead (40 с). <b>BFD</b> — лёгкий протокол «пульса» между соседями: например, 50 мс × 3 = отказ обнаружен за 150 мс. IGP (и BGP, и статика) подписываются на BFD и рвут соседство немедленно.</p>
<pre class="cli">interface Gi0/1
 bfd interval 50 min_rx 50 multiplier 3
router ospf 1
 bfd all-interfaces                ! или ip ospf bfd на интерфейсе
router isis CORE
 bfd all-interfaces
R1#show bfd neighbors [details]</pre>
<h3>2. Распространение и вычисление: троттлинг</h3>
<p>Сгенерировать LSA и посчитать SPF хочется мгновенно, но при флапающем линке мгновенный пересчёт каждые 100 мс положит CPU. Поэтому используется <b>экспоненциальный backoff</b>: первое событие обрабатывается почти сразу (например, через 50 мс), повторные — с растущей задержкой до максимума.</p>
<pre class="cli">router ospf 1
 timers throttle spf 50 200 5000     ! старт 50 мс, шаг 200 мс, максимум 5 с
 timers throttle lsa 0 200 5000
router isis CORE
 spf-interval 5 50 200
 prc-interval 5 50 200
 lsp-gen-interval 5 50 200</pre>
<h3>3. Не ждать сходимости: LFA и TI-LFA</h3>
<p><b>Loop-Free Alternate</b>: маршрутизатор заранее, ещё до аварии, вычисляет резервный next-hop для каждого префикса. Это такой сосед, через которого путь к цели гарантированно не вернётся обратно (условие RFC 5286: dist(N, D) &lt; dist(N, S) + dist(S, D)). Резерв уже записан в FIB, и при отказе основного линка железо переключается за <b>&lt;50 мс</b>, а IGP спокойно досчитывает новую топологию. В кольцах классический LFA покрывает не всё. <b>TI-LFA</b> на Segment Routing покрывает 100% топологий. Это уже глава 13.</p>
<div class="callout pro"><b>Типичные цели у провайдера</b>Обнаружение — BFD 50–150 мс (или моментально по падению оптики). Защита — LFA/TI-LFA или MPLS-TE FRR, переключение меньше 50 мс. Полная сходимость IGP — сотни миллисекунд. Абонент VoIP такой отказ не замечает.</div>`
    },
    {
      id: 'eigrp', h: 'EIGRP и редистрибуция — для общего понимания',
      html: `
<p><b>EIGRP</b> — «продвинутый distance-vector» от Cisco (открыт в RFC 7868, но реализован почти только у Cisco). Алгоритм <b>DUAL</b> держит топологическую таблицу. <b>Successor</b> — лучший next-hop. <b>Feasible successor</b> — резервный сосед, удовлетворяющий <i>feasibility condition</i>: его заявленное расстояние (reported distance) меньше моего текущего лучшего (feasible distance). Это гарантирует отсутствие петли, и переключение мгновенное. Если FS нет, маршрут уходит в Active и рассылаются Query. Отсюда проблема «Stuck in Active» в больших сетях и лечение через stub и суммаризацию. Метрика по умолчанию — минимальная полоса и суммарная задержка. AD внутренних — 90, внешних — 170. У провайдеров не используется. В корпоративных сетях встречается, на собеседованиях спрашивают.</p>
<h3>Редистрибуция</h3>
<p>Перенос маршрутов из одного источника в другой (connected/static/BGP/EIGRP → OSPF и обратно). Правила безопасности:</p>
<ul><li>В OSPF на IOS нужен <code>subnets</code> (иначе уйдут только классовые сети). На новых версиях он по умолчанию.</li>
<li><b>Всегда фильтруй</b> route-map'ом: только то, что нужно. Редистрибуция «всего BGP в IGP» — классическая авария: миллион префиксов в OSPF кладёт всю сеть.</li>
<li><b>Взаимная</b> редистрибуция в двух точках — риск петель и неоптимальных путей. Решение — <b>теги</b>: при переносе A→B ставь tag, при переносе B→A отбрасывай маршруты с этим тегом.</li>
<li>Метрику внешнего маршрута задавай явно (seed metric), иначе в EIGRP он не установится (бесконечность), а в RIP получит бесконечную метрику.</li></ul>
<pre class="cli">route-map CONN-TO-OSPF permit 10
 match interface Loopback2
 set tag 100
router ospf 1
 redistribute connected subnets route-map CONN-TO-OSPF
router eigrp 1
 redistribute ospf 1 metric 100000 10 255 1 1500 route-map NO-TAG-200</pre>`
    }
  ],
  cmds: [
    { g: 'OSPF: настройка' },
    { c: 'router ospf 1\n router-id 10.255.0.1', d: 'Процесс OSPF и Router ID (всегда задавать явно = loopback)', hw: 'ospf 1 router-id 10.255.0.1', jn: 'set routing-options router-id 10.255.0.1' },
    { c: 'interface Gi0/1\n ip ospf 1 area 0', d: 'Включить OSPF на интерфейсе (точнее, чем network)', hw: 'ospf 1 area 0 (в интерфейсе) или network в area', jn: 'set protocols ospf area 0 interface ge-0/0/1' },
    { c: 'network 10.1.0.0 0.0.255.255 area 0', d: 'Классический способ: по wildcard-маске', hw: 'area 0\n network 10.1.0.0 0.0.255.255' },
    { c: 'passive-interface Loopback0 | default', d: 'Анонсировать сеть, но не слать hello', hw: 'silent-interface X', jn: 'interface lo0.0 passive' },
    { c: 'ip ospf network point-to-point', d: 'Тип сети p2p на Ethernet-линке (без DR)', hw: 'ospf network-type p2p', jn: 'interface X interface-type p2p' },
    { c: 'ip ospf cost 100 / auto-cost reference-bandwidth 100000', d: 'Стоимость линка / опорная полоса', hw: 'ospf cost 100 / bandwidth-reference 100000', jn: 'metric 100 / reference-bandwidth 100g' },
    { c: 'area 1 nssa | stub [no-summary]', d: 'Тип зоны', hw: 'area 1\n nssa | stub', jn: 'area 0.0.0.1 nssa | stub' },
    { c: 'area 1 range 172.16.16.0 255.255.248.0', d: 'Суммаризация на ABR', hw: 'abr-summary 172.16.16.0 255.255.248.0', jn: 'area 0.0.0.1 area-range 172.16.16.0/21' },
    { c: 'default-information originate [always]', d: 'Анонсировать default в OSPF', hw: 'default-route-advertise [always]', jn: 'export policy с 0/0' },
    { c: 'ip ospf authentication message-digest\nip ospf message-digest-key 1 md5 KEY', d: 'MD5-аутентификация на интерфейсе', hw: 'ospf authentication-mode md5 1 cipher KEY', jn: 'authentication md5 1 key KEY' },
    { c: 'max-metric router-lsa [on-startup 300]', d: 'Не быть транзитом (работы / старт)', hw: 'stub-router [on-startup 300]', jn: 'overload [timeout 300]' },
    { g: 'OSPF: диагностика' },
    { c: 'show ip ospf neighbor [detail]', d: 'Соседи и состояния', hw: 'display ospf peer [brief]', jn: 'show ospf neighbor [extensive]' },
    { c: 'show ip ospf interface [brief]', d: 'Area, тип сети, таймеры, cost, DR/BDR на интерфейсах', hw: 'display ospf interface', jn: 'show ospf interface detail' },
    { c: 'show ip ospf database [router|network|summary|external] [ID]', d: 'LSDB и содержимое LSA', hw: 'display ospf lsdb [router …]', jn: 'show ospf database [router] detail' },
    { c: 'show ip ospf statistics', d: 'Запуски SPF: сколько, когда, почему', hw: 'display ospf spf-statistics', jn: 'show ospf log' },
    { c: 'show ip route ospf', d: 'OSPF-маршруты в RIB (O, IA, E1/E2, N1/N2)', hw: 'display ip routing-table protocol ospf', jn: 'show route protocol ospf' },
    { c: 'debug ip ospf adj | hello', d: 'Почему не поднимается соседство (осторожно на проде)', hw: 'debugging ospf event', jn: 'traceoptions flag hello' },
    { g: 'IS-IS' },
    { c: 'router isis CORE\n net 49.0001.0000.0000.0001.00\n is-type level-2-only\n metric-style wide', d: 'Процесс IS-IS', hw: 'isis 1\n network-entity 49.0001.0000.0000.0001.00\n is-level level-2\n cost-style wide', jn: 'set interfaces lo0 unit 0 family iso address 49.0001…; set protocols isis level 1 disable' },
    { c: 'interface Gi0/1\n ip router isis CORE\n isis network point-to-point\n isis metric 100', d: 'IS-IS на интерфейсе', hw: 'isis enable 1\n isis circuit-type p2p\n isis cost 100', jn: 'set protocols isis interface ge-0/0/1 point-to-point level 2 metric 100' },
    { c: 'show isis neighbors', d: 'Соседи IS-IS', hw: 'display isis peer', jn: 'show isis adjacency' },
    { c: 'show isis database [detail] [LSPID]', d: 'LSDB (LSP и их TLV)', hw: 'display isis lsdb [verbose]', jn: 'show isis database [extensive]' },
    { c: 'show isis topology', d: 'Результат SPF: путь и метрика до каждого узла', hw: 'display isis spf-log', jn: 'show isis spf results' },
    { c: 'set-overload-bit [on-startup wait-for-bgp]', d: 'Overload: не использовать как транзит', hw: 'set-overload [on-startup wait-for-bgp]', jn: 'set protocols isis overload' },
    { g: 'Сходимость' },
    { c: 'bfd interval 50 min_rx 50 multiplier 3\nbfd all-interfaces (в протоколе)', d: 'BFD: обнаружение отказа за 150 мс', hw: 'bfd\n isis bfd enable', jn: 'bfd-liveness-detection minimum-interval 50' },
    { c: 'show bfd neighbors [details]', d: 'Сессии BFD', hw: 'display bfd session all', jn: 'show bfd session' },
    { c: 'timers throttle spf 50 200 5000', d: 'Троттлинг SPF (OSPF)', hw: 'spf-schedule-interval intelligent-timer 5000 50 200', jn: 'spf-options delay 50 holddown 5000' },
    { c: 'fast-reroute per-prefix enable prefix-priority low (в OSPF/IS-IS)', d: 'LFA (IOS-XE / XR, синтаксис зависит от платформы)', hw: 'frr\n loop-free-alternate', jn: 'link-protection' }
  ],
  cards: [
    ['Чем link-state отличается от distance-vector?', 'LS: каждый рассказывает о своих линках всем, у всех одинаковая LSDB, каждый сам считает SPF. DV: соседи передают друг другу готовые «расстояния до сетей», и каждый видит сеть со слов соседей.'],
    ['Четыре этапа сходимости?', 'Обнаружение отказа → распространение (флуд LSA) → вычисление (SPF) → установка в RIB/FIB.'],
    ['Адреса и протокол OSPF?', 'IP-протокол 89. 224.0.0.5 — все OSPF-маршрутизаторы, 224.0.0.6 — DR/BDR.'],
    ['Что должно совпадать для соседства OSPF?', 'Area, hello/dead, подсеть и маска (на broadcast), флаги stub/NSSA, аутентификация. MTU (проверяется в DBD). RID должен различаться.'],
    ['Сосед в INIT — что это значит?', 'Я получаю его hello, но в них нет моего RID: он не получает мои hello. Одностороння проблема (ACL, multicast, односторонний линк).'],
    ['Застряли в EXSTART/EXCHANGE — первая гипотеза?', 'MTU mismatch (проверка MTU в DBD). Вторая — одинаковый Router ID.'],
    ['2-WAY на broadcast-сети — проблема?', 'Нет, если оба DROther: они в 2-WAY друг с другом и в FULL только с DR и BDR.'],
    ['Как выбирается DR?', 'Наибольший OSPF priority (по умолч. 1; 0 — не участвует), затем наибольший RID. Выбор не вытесняющий.'],
    ['Зачем ip ospf network point-to-point на Ethernet между двумя маршрутизаторами?', 'Нет выборов DR и wait-таймера, нет LSA типа 2, соседство быстрее, LSDB меньше. Стандарт для линков ядра.'],
    ['Типы LSA 1, 2, 3, 4, 5, 7?', '1 Router (каждый), 2 Network (DR), 3 Summary (ABR, префиксы других зон), 4 ASBR-summary (ABR, путь к ASBR), 5 External (ASBR), 7 NSSA External (ASBR в NSSA, транслируется ABR в 5).'],
    ['Почему межзоновый OSPF похож на distance-vector?', 'LSA 3 несут только префикс и стоимость от ABR, без топологии. Поэтому весь межзоновый трафик через area 0 — защита от петель.'],
    ['Формула cost OSPF и проблема по умолчанию?', 'cost = reference BW / BW интерфейса; reference 100 Мбит/с → 100M, 1G, 10G, 100G все cost 1. Решение: auto-cost reference-bandwidth 100000 на всех.'],
    ['E1 vs E2?', 'E2 (по умолчанию): метрика только внешняя, внутри домена не растёт. E1: внешняя + внутренняя стоимость до ASBR. Предпочтение: O > O IA > E1 > E2.'],
    ['Stub, totally stubby, NSSA?', 'Stub: нет LSA 5, есть default. Totally stubby: нет LSA 3 и 5, только default. NSSA: нет LSA 5, но можно редистрибутировать внутри (LSA 7).'],
    ['Где в OSPF можно суммаризировать?', 'Только на ABR (area range) для межзоновых и на ASBR (summary-address) для внешних.'],
    ['Что такое NET в IS-IS? Разбери 49.0001.0102.5500.0001.00', '49 — AFI (private), 0001 — area, 0102.5500.0001 — System ID (6 байт, уникален), 00 — NSEL (маршрутизатор).'],
    ['Уровни IS-IS?', 'L1 — внутри area, наружу через L1/L2 по биту ATT. L2 — backbone между area. L1/L2 — пограничный. У провайдеров часто всё level-2-only.'],
    ['Почему провайдеры любят IS-IS? (3+ причины)', 'Работает на L2 (CLNS), не зависит от IP и не атакуется по IP; TLV-расширяемость (TE, SR, IPv6 в одном процессе); простой плоский L2-дизайн; исторически так сложилось у крупных операторов.'],
    ['Что такое DIS и чем он отличается от DR?', 'Designated IS на broadcast-сети в IS-IS. Нет backup, выбор вытесняющий (по priority, затем MAC/SNPA).'],
    ['Зачем metric-style wide?', 'Narrow — 6 бит на линк (максимум 63). Wide — 24 бита. Нужно для TE и SR. Должно быть одинаково на всех.'],
    ['Overload bit / max-metric router-lsa — зачем?', 'Узел объявляет: «через меня транзит не возить». Для плановых работ и старта после перезагрузки (wait-for-bgp), чтобы не создать чёрную дыру.'],
    ['Что даёт BFD?', 'Быстрое обнаружение отказа (десятки–сотни мс) там, где интерфейс остаётся up. Клиенты BFD — OSPF, IS-IS, BGP, статика.'],
    ['Зачем экспоненциальный троттлинг SPF?', 'Первое событие — быстрая реакция (мс), повторные (флапы) — с растущей задержкой, чтобы не положить CPU.'],
    ['Что такое LFA?', 'Заранее посчитанный резервный next-hop без петли (dist(N,D) < dist(N,S) + dist(S,D)). Он уже в FIB, поэтому переключение < 50 мс до сходимости IGP.'],
    ['Feasibility condition в EIGRP?', 'Сосед — feasible successor, если его reported distance до цели меньше моего feasible distance. Гарантирует отсутствие петли.'],
    ['Главное правило безопасной редистрибуции?', 'Всегда фильтровать route-map. При взаимной редистрибуции в нескольких точках — теги, чтобы не вернуть маршрут туда, откуда он пришёл.']
  ],
  quiz: [
    { q: 'По выводу: что, скорее всего, не так?', code: 'R1#show ip ospf neighbor\nNeighbor ID   Pri  State          Dead Time  Address    Interface\n10.255.0.3      1  EXSTART/DR     00:00:35   10.1.13.1  Gi0/1', o: ['Не совпадает area', 'Не совпадает MTU на интерфейсах', 'Разные hello-таймеры', 'Сосед в passive'], a: 1, e: 'Hello совпадают (иначе соседа не было бы вообще). Застревание в EXSTART/EXCHANGE — классика MTU mismatch.' },
    { q: 'R1 видит R2 в состоянии INIT, а R2 вообще не видит R1. Причина?', o: ['MTU', 'Hello R1 не доходят до R2 (ACL, multicast, односторонний линк)', 'Разные area', 'Дубль RID'], a: 1, e: 'INIT на R1: hello от R2 доходят, но в них нет RID R1, значит R2 не слышит R1.' },
    { q: 'На Ethernet-сегменте 4 маршрутизатора. R3 и R4 — DROther. В каком состоянии они друг с другом?', o: ['FULL', '2-WAY', 'EXSTART', 'INIT'], a: 1, e: 'DROther устанавливают FULL только с DR и BDR. Между собой 2-WAY — это норма.' },
    { q: 'Какой LSA несёт в area 0 информацию о префиксах area 1?', o: ['Тип 1', 'Тип 2', 'Тип 3, сгенерированный ABR', 'Тип 5'], a: 2, e: 'Межзоновые префиксы — Summary LSA (тип 3) от ABR.' },
    { q: 'ASBR в NSSA area 1 редистрибутирует статический маршрут. Как он выглядит в area 1 и в area 0?', o: ['LSA 5 везде', 'LSA 7 в area 1, ABR транслирует его в LSA 5 для area 0', 'LSA 3 везде', 'В area 0 не попадёт'], a: 1, e: 'Тип 7 существует только в NSSA. ABR (с наибольшим RID, если их несколько) переводит его в тип 5.' },
    { q: 'Без изменений настроек у тебя линки 1G и 10G. Какие OSPF cost у них по умолчанию на IOS?', o: ['10 и 1', '1 и 1', '100 и 10', '4 и 2'], a: 1, e: 'Reference bandwidth 100 Мбит/с, всё быстрее 100M получает cost 1. Поэтому OSPF не отличает 1G от 10G, пока не задашь reference.' },
    { q: 'Соседство OSPF FULL, но маршруты через этот линк не появились. На одной стороне ip ospf network point-to-point, на другой broadcast. Почему?', o: ['MTU', 'Типы сети описывают линк по-разному в LSA, SPF не может связать узлы', 'Разные hello', 'Нет default-information'], a: 1, e: 'Hello-таймеры одинаковые (10/40), поэтому соседство встаёт. Но broadcast-сторона ждёт транзитную сеть с DR (LSA 2), а p2p-сторона описывает p2p-линк. Двусторонняя проверка в SPF не проходит.' },
    { q: 'Маршрут к 192.168.100.0/24 есть в двух вариантах: O E2 с метрикой 20 и O IA с метрикой 500. Какой выберет OSPF?', o: ['E2 — метрика меньше', 'O IA — межзоновый всегда лучше внешнего', 'Оба (ECMP)', 'Зависит от AD'], a: 1, e: 'Порядок предпочтения типов маршрутов OSPF: intra > inter > E1 > E2, независимо от метрики.' },
    { q: 'Что из этого — преимущество IS-IS перед OSPF у провайдеров? (несколько)', o: ['Работает прямо на L2, не поверх IP', 'Новые функции добавляются как TLV', 'IPv4 и IPv6 в одном процессе', 'Не нуждается в SPF'], a: [0, 1, 2], e: 'SPF IS-IS считает точно так же, это link-state протокол.' },
    { q: 'NET 49.0010.0000.0000.0007.00. Какая area и какой System ID?', o: ['area 49, ID 0010', 'area 0010, System ID 0000.0000.0007', 'area 0007, ID 49', 'area 00, ID 0010.0000.0000'], a: 1, e: 'AFI 49 | area 0010 | System ID 6 байт | NSEL 00.' },
    { q: 'Узел с BGP-full-view перезагрузился. IGP поднялся за 30 с, BGP получает таблицу 3 минуты. Что будет без overload bit / max-metric on-startup?', o: ['Ничего страшного', 'Соседи начнут слать через него транзитный трафик, а маршрутов BGP у него ещё нет — чёрная дыра', 'BGP не поднимется', 'IGP не сойдётся'], a: 1, e: 'Поэтому set-overload-bit on-startup wait-for-bgp: узел не транзитный, пока BGP не сошёлся.' },
    { q: 'Линк ядра идёт через DWDM. Оптика на маршрутизаторе не гаснет при обрыве на трассе. Как быстро OSPF с таймерами по умолчанию заметит отказ и что поможет?', o: ['Мгновенно', 'Через dead 40 с; поможет BFD', 'Через 10 с; поможет LFA', 'Никогда'], a: 1, e: 'Интерфейс up, поэтому остаётся только dead-таймер. BFD обнаружит за десятки–сотни мс.' },
    { q: 'Что делает LFA?', o: ['Ускоряет флуд LSA', 'Заранее вычисляет и ставит в FIB резервный next-hop без петли', 'Уменьшает LSDB', 'Заменяет BFD'], a: 1, e: 'LFA — локальная защита: переключение в железе до того, как IGP пересчитает топологию.' },
    { q: 'Ты мигрируешь с OSPF (AD 110) на IS-IS (AD 115), оба протокола уже работают на всех узлах. Как переключить трафик на IS-IS без простоя?', o: ['Удалить OSPF на всех сразу', 'Поднять AD OSPF выше 115 (например, distance 130), проверить, что в RIB i L2, затем удалить OSPF', 'Понизить метрики IS-IS', 'Поставить IS-IS level-1'], a: 1, e: 'Сравниваются AD для одинаковых префиксов. Поднимаешь AD OSPF, маршруты IS-IS выигрывают, OSPF остаётся «страховкой», потом удаляешь его.' },
    { q: 'Как найти флапающий линк в OSPF-домене по LSDB?', o: ['По возрасту LSA', 'По быстро растущему sequence number LSA одного маршрутизатора и частому SPF', 'По количеству LSA типа 5', 'Никак'], a: 1, e: 'Каждое изменение — новая версия LSA (seq+1) и новый SPF. show ip ospf statistics и database покажут виновника.' },
    { q: 'Почему опасна редистрибуция полной BGP-таблицы в OSPF?', o: ['OSPF не поддерживает внешние маршруты', 'Миллион LSA 5 перегрузит память, CPU и флуд на всех маршрутизаторах', 'Снизится AD', 'BGP упадёт'], a: 1, e: 'IGP предназначен для инфраструктурных префиксов. Full view — дело BGP.' }
  ],
  und: [
    { q: 'Объясни своими словами, как OSPF-маршрутизаторы получают одинаковую карту сети и почему на ней не бывает петель внутри зоны.', a: '<p>Каждый маршрутизатор описывает только себя (LSA 1: мои линки, соседи, стоимости, мои сети), а DR описывает сегмент (LSA 2). LSA флудятся по зоне без изменений, с проверкой версии (seq). Поэтому у всех в зоне одинаковая LSDB. Каждый запускает над ней Дейкстру от себя: дерево кратчайших путей. Раз карта одинаковая и алгоритм детерминированный, решения всех маршрутизаторов согласованы: если A считает, что путь к X идёт через B, то и B по той же карте продолжит путь к X, а не вернёт пакет в A. Петли возможны только на время, пока LSDB ещё не синхронизирована (микропетли при сходимости).</p>', k: ['описание только себя (LSA 1/2)', 'флуд без изменений, одинаковая LSDB', 'SPF у каждого', 'согласованность решений → нет петель (кроме переходных)'] },
    { q: 'Сосед OSPF не поднимается. Опиши свой алгоритм диагностики по состояниям: что проверяешь при Down, Init, 2-Way, ExStart/Exchange.', a: '<p><b>Down</b>: hello не приходят. Физика и L2, включён ли OSPF на интерфейсе, passive, ACL на протокол 89 или 224.0.0.5, разные area, таймеры, подсеть, аутентификация (они дают «тишину» — hello отбрасываются). <b>Init</b>: hello соседа приходят, а мои до него нет (односторонняя проблема). <b>2-Way</b>: на broadcast норма для DROther; если должен быть FULL — проблемы выбора DR (priority 0 у всех). <b>ExStart/Exchange</b>: MTU mismatch или дубль RID. Инструменты: show ip ospf interface с обеих сторон, show ip ospf neighbor, debug ip ospf adj/hello.</p>', k: ['Down: L1/L2, параметры hello, ACL, passive', 'Init: одностороннее', '2-Way: норма для DROther', 'ExStart: MTU / RID'] },
    { q: 'Почему провайдеры выбирают IS-IS для ядра? Ответь так, как ответил бы на собеседовании.', a: '<p>IS-IS работает прямо на канальном уровне (CLNS), поэтому не зависит от IP-адресации, и его нельзя атаковать IP-пакетами извне. Его LSP построены из TLV: новые возможности (IPv6, TE, Segment Routing, flex-algo) добавляются новыми TLV без изменения протокола, и в IS-IS они обычно появляются первыми. Один процесс для IPv4 и IPv6. Простой дизайн: плоский level-2 на всё ядро, граница уровней по линку, а не по маршрутизатору. Плюс историческая причина: крупные операторы начинали на IS-IS, и вендоры отлаживали провайдерские фичи именно на нём. OSPF при этом тоже широко применяется, и у него свои плюсы (знакомство инженеров, богатые типы зон).</p>', k: ['L2/CLNS, независимость от IP', 'TLV-расширяемость', 'IPv4+IPv6 в одном процессе', 'плоский L2-дизайн', 'история и экосистема'] },
    { q: 'Как сделать так, чтобы при обрыве волокна в ядре абоненты не заметили перерыва? Перечисли механизмы по этапам сходимости.', a: '<p>Обнаружение: потеря сигнала (LoS) мгновенно гасит интерфейс; если линк через транспорт и интерфейс не гаснет — BFD 50×3. Защита до сходимости: LFA/TI-LFA (или MPLS-TE FRR) — резервный next-hop уже в FIB, переключение за &lt;50 мс. Распространение и расчёт: быстрые начальные значения троттлинга LSA и SPF (мс), p2p-тип сети. Установка: приоритизация важных префиксов (loopback\'и для BGP/LDP) при обновлении FIB. Защита от обратного эффекта: экспоненциальный backoff при флапах, overload/max-metric при старте узла.</p>', k: ['LoS/BFD', 'LFA/TI-LFA/FRR', 'троттлинг SPF/LSA', 'FIB, приоритизация', 'overload при старте'] },
    { q: 'Опиши план миграции работающей сети с OSPF на IS-IS без простоя. Почему он безопасен?', a: '<p>1) Поднять IS-IS на всех узлах параллельно с OSPF: те же интерфейсы, метрики, согласованные с OSPF (чтобы пути не поменялись), wide metrics, p2p, passive loopback\'и. 2) Проверить: соседства IS-IS UP, в <code>show isis database</code> все узлы, <code>show ip route isis</code> пуст (AD 115 &gt; 110, маршруты IS-IS не установлены), но <code>show isis topology</code> корректна. 3) На всех узлах поднять AD OSPF (<code>distance 130</code>): маршруты i L2 замещают O, проверить трафик (traceroute не изменился). 4) Через время удалить OSPF. Безопасно, потому что в каждый момент работает полный IGP, а переключение — смена «кому верить» с моментальным откатом (вернуть distance).</p>', k: ['параллельный запуск', 'проверка до переключения', 'переключение через AD', 'откат и удаление старого'] }
  ],
  lab: {
    title: 'Лаба 6. Сибирское кольцо: OSPF глубоко и миграция на IS-IS',
    time: '≈ 4 часа (лучше в два захода)',
    goal: `<p>Шесть маршрутизаторов «Лифт ми Ап»: Москва, Питер и сибирское кольцо Кемерово–Красноярск–Хабаровск–Владивосток. Поднять OSPF «по-провайдерски», разобрать LSDB руками, сделать NSSA с внешними маршрутами, ускорить сходимость через BFD. Затем мигрировать всё на IS-IS без простоя и потренировать overload bit.</p>`,
    topo: {
      w: 900, h: 470,
      zones: [{ x: 230, y: 30, w: 650, h: 420, label: 'area 0 / IS-IS L2' }, { x: 20, y: 30, w: 190, h: 300, label: 'area 1 (NSSA)', c: '#059669' }],
      nodes: [
        { id: 'R2', t: 'router', x: 110, y: 190, label: 'R2 СПб\nLo0 10.255.0.2\nLo1 172.16.16.1/24\nLo2 192.168.100.1 (партнёр)', role: 'СПб, ASBR в NSSA' },
        { id: 'R1', t: 'router', x: 330, y: 190, label: 'R1 Москва\nLo0 10.255.0.1\nLo1 172.16.0.1/24', role: 'Москва, ABR' },
        { id: 'R3', t: 'router', x: 520, y: 90, label: 'R3 Кемерово\nLo0 10.255.0.3', role: 'Кемерово' },
        { id: 'R4', t: 'router', x: 780, y: 90, label: 'R4 Красноярск\nLo0 10.255.0.4', role: 'Красноярск' },
        { id: 'R5', t: 'router', x: 520, y: 360, label: 'R5 Владивосток\nLo0 10.255.0.5', role: 'Владивосток' },
        { id: 'R6', t: 'router', x: 780, y: 360, label: 'R6 Хабаровск\nLo0 10.255.0.6', role: 'Хабаровск' }
      ],
      links: [['R1', 'Gi0/0', 'R2', 'Gi0/0', '10.1.12.0/31'], ['R1', 'Gi0/1', 'R3', 'Gi0/1', '10.1.13.0/31'], ['R1', 'Gi0/2', 'R5', 'Gi0/2', '10.1.15.0/31'],
        ['R3', 'Gi0/2', 'R4', 'Gi0/2', '10.1.34.0/31'], ['R4', 'Gi0/3', 'R6', 'Gi0/3', '10.1.46.0/31'], ['R6', 'Gi0/1', 'R5', 'Gi0/1', '10.1.56.0/31']]
    },
    addr: [['Линк Rx–Ry', '—', '10.1.xy.0/31: меньший номер .0, больший .1'], ['Loopback0', 'все', '10.255.0.N/32'], ['R1 Lo1', 'LAN Москвы', '172.16.0.1/24'], ['R2 Lo1', 'LAN СПб', '172.16.16.1/24'], ['R2 Lo2', '«сеть партнёра» (внешняя)', '192.168.100.1/24']],
    init: (function () {
      const base = n => `hostname R${n}\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.${n} 255.255.255.255\nline con 0\n logging synchronous\n exec-timeout 0 0\n`;
      const ifc = (i, ip) => `interface ${i}\n ip address ${ip} 255.255.255.254\n no shutdown\n`;
      return {
        R1: base(1) + 'interface Loopback1\n ip address 172.16.0.1 255.255.255.0\n' + ifc('Gi0/0', '10.1.12.0') + ifc('Gi0/1', '10.1.13.0') + ifc('Gi0/2', '10.1.15.0'),
        R2: base(2) + 'interface Loopback1\n ip address 172.16.16.1 255.255.255.0\ninterface Loopback2\n ip address 192.168.100.1 255.255.255.0\n' + ifc('Gi0/0', '10.1.12.1'),
        R3: base(3) + ifc('Gi0/1', '10.1.13.1') + ifc('Gi0/2', '10.1.34.0'),
        R4: base(4) + ifc('Gi0/2', '10.1.34.1') + ifc('Gi0/3', '10.1.46.0'),
        R5: base(5) + ifc('Gi0/2', '10.1.15.1') + ifc('Gi0/1', '10.1.56.1'),
        R6: base(6) + ifc('Gi0/3', '10.1.46.1') + ifc('Gi0/1', '10.1.56.0')
      };
    })(),
    pre: 'Адреса на линках (/31) и loopback\'и уже настроены. На /31 vIOS может выдать предупреждение — это нормально. Проверь пинги по каждому линку перед стартом.',
    tasks: [
      { t: 'OSPF «по-провайдерски» в area 0', d: 'На R1, R3–R6: <code>router ospf 1</code>, router-id = Lo0, <code>auto-cost reference-bandwidth 100000</code>, OSPF включается <b>на интерфейсах</b> (<code>ip ospf 1 area 0</code>), все линки <code>point-to-point</code>, loopback\'и passive. Lo1 Москвы тоже в OSPF. Проверь: все соседи FULL, у всех в RIB все loopback\'и.',
        hint: 'passive-interface default + no passive-interface на линках — удобный провайдерский шаблон: новый интерфейс не начнёт случайно слать hello.',
        check: 'R1#show ip ospf neighbor\nR1#show ip ospf interface brief\nR4#show ip route ospf\nR4#ping 10.255.0.5 source Loopback0',
        sol: 'R3(config)#router ospf 1\nR3(config-router)#router-id 10.255.0.3\nR3(config-router)#auto-cost reference-bandwidth 100000\nR3(config-router)#passive-interface default\nR3(config-router)#no passive-interface Gi0/1\nR3(config-router)#no passive-interface Gi0/2\nR3(config)#interface range Gi0/1 - 2\nR3(config-if-range)#ip ospf 1 area 0\nR3(config-if-range)#ip ospf network point-to-point\nR3(config)#interface Loopback0\nR3(config-if)#ip ospf 1 area 0\n! так же на R1, R4, R5, R6; на R1 ещё Lo1' },
      { t: 'Посмотри рождение соседства', d: 'На R3 включи <code>debug ip ospf adj</code>, на R4 сделай <code>shutdown</code> / <code>no shutdown</code> на Gi0/2. Найди в выводе переходы состояний, выбор master/slave (кто master и почему), DBD, LSR, LSU. Потом временно убери <code>point-to-point</code> с обеих сторон линка R3–R4 и повтори: появились выборы DR и ожидание ~40 с.',
        check: 'R3#debug ip ospf adj\nR4(config-if)#shutdown\nR4(config-if)#no shutdown\nR3#undebug all' },
      { t: 'SPF руками', d: 'По <code>show ip ospf database router</code> (без show ip route!) посчитай на бумаге стоимость пути R1 → Lo0 R4 через Кемерово и через Владивосток. Какой путь выберет OSPF? Сверь с <code>show ip route 10.255.0.4</code> и traceroute. Затем поставь <code>ip ospf cost 500</code> на R1 Gi0/1 и предскажи новый путь до проверки.',
        check: 'R1#show ip ospf database router 10.255.0.3\nR1#show ip route 10.255.0.4\nR1#traceroute 10.255.0.4 source Lo0 numeric' },
      { t: 'NSSA, ASBR и трансляция 7→5', d: 'Линк R1–R2 и R2 — area 1, тип NSSA. На R2 Lo1 (172.16.16.0/24) — в OSPF, а Lo2 (сеть партнёра) — редистрибуцией connected через route-map (только Lo2, tag 100). Найди маршрут 192.168.100.0/24 на R2 и R1 (тип LSA 7) и на R4 (тип 5, кто ADV Router?). Какой код маршрута на R4?',
        check: 'R1#show ip ospf database nssa-external\nR4#show ip ospf database external\nR4#show ip route 192.168.100.0',
        sol: 'R1(config)#router ospf 1\nR1(config-router)#area 1 nssa\nR1(config)#interface Gi0/0\nR1(config-if)#ip ospf 1 area 1\nR1(config-if)#ip ospf network point-to-point\nR2(config)#route-map LO2 permit 10\nR2(config-route-map)#match interface Loopback2\nR2(config-route-map)#set tag 100\nR2(config)#router ospf 1\nR2(config-router)#router-id 10.255.0.2\nR2(config-router)#area 1 nssa\nR2(config-router)#redistribute connected subnets route-map LO2\nR2(config)#interface range Gi0/0 , Lo0 , Lo1\nR2(config-if-range)#ip ospf 1 area 1\nR2(config)#interface Gi0/0\nR2(config-if)#ip ospf network point-to-point\n! на R4: O E2 (N2 превратился в E2), ADV Router = R1 (транслятор 7→5)' },
      { t: 'Суммаризация на ABR', d: 'Добавь на R2 Loopback3 172.16.17.1/24 и Loopback4 172.16.23.1/24 в area 1. На R1 суммаризируй area 1 в 172.16.16.0/21. Сравни <code>show ip route 172.16.0.0 255.255.0.0 longer-prefixes</code> на R4 до и после. Какой маршрут появился на R1 и зачем (подсказка: Null0)?',
        check: 'R4#show ip route ospf | include 172.16\nR1#show ip route 172.16.16.0 255.255.248.0',
        sol: 'R1(config-router)#area 1 range 172.16.16.0 255.255.248.0\n! R1 автоматически ставит 172.16.16.0/21 → Null0 (discard route) — защита от петель (глава 3)' },
      { t: 'BFD и время сходимости', d: 'С R4 пингуй Lo0 R1 (<code>ping 10.255.0.1 source Lo0 repeat 100000 timeout 1</code>). Имитируй обрыв «посередине»: на R3 повесь на Gi0/1 ACL <code>deny ospf any any</code> + <code>permit ip any any</code> (интерфейс up, hello не проходят). Посчитай потерю. Затем включи BFD 100×3 на всех линках кольца с OSPF-регистрацией и повтори. Почему BFD тоже перестал проходить? (подсказка: BFD — это UDP 3784)',
        hint: 'Для честного опыта с BFD ACL должен блокировать и BFD: <code>deny udp any any eq 3784</code>. Тогда BFD обнаружит отказ за 300 мс.',
        check: 'R1#show bfd neighbors\nR1#show ip ospf interface Gi0/1 | include BFD',
        sol: 'R1(config)#interface range Gi0/1 - 2\nR1(config-if-range)#bfd interval 100 min_rx 100 multiplier 3\nR1(config)#router ospf 1\nR1(config-router)#bfd all-interfaces\n! на R3–R6 так же\nR3(config)#ip access-list extended CUT\nR3(config-ext-nacl)#deny ospf any any\nR3(config-ext-nacl)#deny udp any any eq 3784\nR3(config-ext-nacl)#permit ip any any\nR3(config)#interface Gi0/1\nR3(config-if)#ip access-group CUT in' },
      { t: 'Миграция на IS-IS без простоя', d: 'Подними на R1, R3–R6 IS-IS <code>CORE</code>: NET 49.0001.0000.0000.000N.00, level-2-only, metric-style wide, p2p, loopback passive, метрика 100 на линках (как в OSPF при reference 100G для 1G). Убедись, что в RIB всё ещё O (AD 110 &lt; 115). Затем на всех поставь в OSPF <code>distance 130</code> и проверь, что маршруты стали i L2, а traceroute не изменился. Наконец, выключи OSPF в area 0. Area 1 (СПб) оставь на OSPF: R1 станет точкой редистрибуции, и маршруты СПб нужно перенести в IS-IS.',
        hint: 'На R1: <code>router isis CORE</code> → <code>redistribute ospf 1 route-map SPB</code> (только 172.16.16.0/21 и 192.168.100.0/24) и <code>router ospf 1</code> → <code>default-information originate</code> в area 1 (или NSSA с <code>default-information-originate</code>).',
        check: 'R4#show isis neighbors\nR4#show isis database\nR4#show ip route isis\nR4#show isis topology\nR4#traceroute 10.255.0.1 source Lo0',
        sol: 'R3(config)#router isis CORE\nR3(config-router)#net 49.0001.0000.0000.0003.00\nR3(config-router)#is-type level-2-only\nR3(config-router)#metric-style wide\nR3(config-router)#passive-interface Loopback0\nR3(config)#interface range Gi0/1 - 2\nR3(config-if-range)#ip router isis CORE\nR3(config-if-range)#isis network point-to-point\nR3(config-if-range)#isis metric 100\n! после проверки на всех:\nR3(config)#router ospf 1\nR3(config-router)#distance 130\n! затем: no router ospf 1 (кроме R1, где area 1 остаётся)' },
      { t: 'Overload bit: выведи узел на работы', d: 'Убедись, что трафик R3 ↔ R6 (Lo0 ↔ Lo0) идёт через R4. Поставь на R4 <code>set-overload-bit</code>. Куда ушёл трафик? Доступен ли сам Lo0 R4? Посмотри флаг в <code>show isis database</code> (столбец OL). Сними overload.',
        check: 'R3#traceroute 10.255.0.6 source Lo0\nR3#show isis database\nR3#ping 10.255.0.4' }
    ],
    brk: [
      { t: 'Соседство R3–R4 висит в EXSTART/EXCHANGE', inj: 'R4(config)#interface Gi0/2\nR4(config-if)#ip mtu 1400', h: '<code>show ip ospf neighbor</code>, <code>debug ip ospf adj</code> (ищи слово MTU), <code>show ip interface Gi0/2 | include MTU</code> на обеих сторонах.', f: 'MTU mismatch: DBD с большим MTU отвергается. Выровняй MTU. (Обходной путь <code>ip ospf mtu-ignore</code> — только если понимаешь, что LSU могут не пролезть.)' },
      { t: 'R5 не видит соседа R6 вообще', inj: 'R6(config)#interface Gi0/1\nR6(config-if)#ip ospf hello-interval 5', h: '<code>show ip ospf interface Gi0/1</code> на R5 и R6 — сравни таймеры. <code>debug ip ospf hello</code>.', f: 'Hello/Dead не совпадают (5/20 против 10/40), hello соседа отбрасываются, в debug «Mismatched hello parameters». Выровняй таймеры.' },
      { t: 'В логах «Detected router with duplicate router ID», часть маршрутов скачет', inj: 'R6(config)#router ospf 1\nR6(config-router)#router-id 10.255.0.4\nR6#clear ip ospf process', h: '<code>show ip ospf</code> на всех: router-id. <code>show logging | include DUP</code>.', f: 'R6 и R4 с одним RID: их LSA 1 «перетирают» друг друга (одинаковый Link State ID), SPF строит ерунду. RID обязан быть уникальным. Поэтому его всегда задают явно = Lo0.' },
      { t: 'Соседство R1–R3 FULL, но маршрутов через этот линк нет, трафик в Кемерово идёт через кольцо', inj: 'R3(config)#interface Gi0/1\nR3(config-if)#no ip ospf network point-to-point', h: 'Сравни <code>show ip ospf interface Gi0/1</code> на R1 и R3 — Network Type. Посмотри <code>show ip ospf database router 10.255.0.3</code>: как описан линк к R1?', f: 'Несовпадение типов сети: R1 p2p, R3 broadcast. Соседство FULL (таймеры одинаковые), но LSA описывают линк по-разному, и в SPF двусторонняя проверка не проходит. Тип сети должен совпадать.' },
      { t: '(После миграции) R4 потерял соседство IS-IS с R3, OSPF уже удалён — Красноярск доступен только через Хабаровск', inj: 'R3(config)#router isis CORE\nR3(config-router)#metric-style narrow', h: '<code>show isis neighbors</code> — соседство есть? <code>show isis database detail</code> — какие TLV видит R4 от R3? <code>show isis topology</code>.', f: 'Соседство может остаться, но R3 перешёл на narrow-метрики, и маршрутизаторы с wide не используют его TLV (и наоборот): линки через R3 «пропадают» из SPF. Metric-style должен быть одинаковым на всём домене.' }
    ],
    extra: '<p><b>LFA на CSR1000v.</b> На vIOS LFA ограничен. Если хочешь увидеть его вживую, замени R1, R3 и R5 на CSR1000v и включи <code>fast-reroute per-prefix enable level-2 prefix-priority low</code> в IS-IS. Посмотри <code>show isis fast-reroute summary</code> и <code>show ip route repair-paths</code>: какие префиксы защищены в кольце, а какие нет и почему. Полное покрытие даст TI-LFA (глава 13).</p>'
  }
});
