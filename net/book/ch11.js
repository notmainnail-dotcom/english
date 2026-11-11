// Книжный текст главы 11 СДСМ (компьютер): MPLS L3VPN. Формат как у ch06/ch10/ch12, блоки .callout.lab ведут в лабу 11.
// Ученик идёт по плану L2VPN (12) → L3VPN (11) → BGP (8): BGP пока 1/10, поэтому разделы 2–3 — «BGP в объёме L3VPN»
// (договорённость 11.11.2026): сессия по loopback, next-hop и рекурсия, iBGP и идея RR, семейства адресов, community и extended community.
// Факты: RFC 4364 (BGP/MPLS IP VPN: VRF, RD, RT, VPNv4, метки), RFC 4271 (BGP-4: TCP 179, состояния, AS_PATH), RFC 4760 (MP-BGP, AFI/SAFI),
// RFC 4360 (extended community), RFC 4456 (route reflector), RFC 6996 (частные AS 64512–65534), RFC 8277 (метки в BGP); Cisco IOS: AD eBGP 20, iBGP 200.
window.BOOK = window.BOOK || {};
BOOK.ch11 = {
title: 'MPLS L3VPN',
lead: `<p>На прошлой неделе ты разобрал L2-канал: провайдер возит кадры клиента и не знает его IP. Сегодня вторая главная услуга для бизнеса — <b>L3VPN</b>. Здесь провайдер сам маршрутизирует трафик клиента между офисами: знает его сети, держит их в отдельной таблице и сам решает, куда отправить пакет. Это самая массовая корпоративная услуга у провайдеров: банки, торговые сети, заводы с десятками филиалов.</p>
<p>L3VPN стоит на BGP, а BGP ты ещё не проходил. Поэтому разделы 2 и 3 — <b>BGP с нуля, ровно в том объёме, который нужен для L3VPN</b>. Полностью BGP будет в главе 8, и после этой главы он пойдёт легче: ты уже будешь видеть его в работе.</p>
<p>Порядок прежний: раздел в день, анимации на паузу, «Проверь себя» в конце раздела, зелёные блоки ведут в лабу. Все примеры — на топологии лабы 11: PE1 — P1 — PE2, два клиента A и B <b>с одинаковыми адресами</b> и общий сервис провайдера (DNS). Книгу можно слушать — кнопка «🔊 Слушать».</p>`,
parts: [

{h:'Что такое L3VPN и в чём главная трудность', html:`
<h3>Провайдер как маршрутизатор клиента</h3>
<p>В L2-канале провайдер был «трубой»: что вошло, то вышло. В L3VPN провайдер — это <b>общий маршрутизатор всех офисов клиента</b>. Маршрутизатор офиса (CE) рассказывает PE: «за мной сеть 10.1.1.0/24». PE передаёт это всем остальным PE, к которым подключены офисы этого клиента. Пакет из офиса 1 в офис 2 приходит на PE1, PE1 смотрит в таблицу маршрутов клиента и отправляет его к PE2.</p>
<p>Для клиента это удобно: не нужно строить свою маршрутизацию между офисами, провайдер сам знает, где какая сеть. Добавил офис — PE сам разнёс его сеть всем остальным.</p>
<h3>Главная трудность: одинаковые адреса</h3>
<p>Почти все компании используют серые адреса (глава 5): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. Поэтому у двух разных клиентов на одном PE легко окажутся <b>одинаковые сети</b>. В лабе так и есть: и у клиента A, и у клиента B офис 1 — это 10.1.1.0/24.</p>
<p>В одной таблице маршрутов два одинаковых маршрута в разные места жить не могут. Если PE1 будет хранить всё в одной таблице, пакеты клиента A попадут к клиенту B. Это авария и утечка данных одновременно.</p>
<figure class="dg"><svg viewBox="0 0 320 220" role="img" aria-label="Два клиента с одинаковой сетью: в одной таблице конфликт, в двух VRF порядок">
<text class="tx" x="80" y="18" text-anchor="middle">Одна таблица</text><text class="tx" x="240" y="18" text-anchor="middle">Две таблицы (VRF)</text>
<path class="ln" d="M160 26 L160 210" style="stroke-width:1;stroke-dasharray:3 3"/>
<rect class="bx" x="10" y="30" width="140" height="74" rx="6"/>
<text class="sm" x="18" y="48">10.1.1.0/24 → клиент A</text>
<text class="sm" x="18" y="66">10.1.1.0/24 → клиент B</text>
<g opacity="0"><text class="sm rd" x="80" y="92" text-anchor="middle">конфликт! какой выбрать?</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.15;0.16;1"/></g>
<rect class="bx" x="170" y="30" width="140" height="34" rx="6" style="stroke:#2563eb"/><text class="sm bt" x="178" y="44">VRF A</text><text class="sm" x="178" y="58">10.1.1.0/24 → клиент A</text>
<rect class="bx" x="170" y="70" width="140" height="34" rx="6" style="stroke:#16a34a"/><text class="sm gn" x="178" y="84">VRF B</text><text class="sm" x="178" y="98">10.1.1.0/24 → клиент B</text>
<rect class="bx" x="40" y="146" width="80" height="24" rx="6"/><text class="tx" x="80" y="162" text-anchor="middle">PE1</text>
<rect class="bx" x="200" y="146" width="80" height="24" rx="6"/><text class="tx" x="240" y="162" text-anchor="middle">PE1</text>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="2" class="b"/><text class="wt" x="0" y="3" text-anchor="middle">от A</text><animateMotion dur="10s" repeatCount="indefinite" path="M80 200 L80 158 L80 66" keyPoints="0;0;1;1" keyTimes="0;0.2;0.5;1" calcMode="linear"/><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.19;0.2;0.5;0.51;1"/></g>
<g opacity="0"><text class="sm rd" x="80" y="124" text-anchor="middle">ушёл к клиенту B</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="2" class="b"/><text class="wt" x="0" y="3" text-anchor="middle">от A</text><animateMotion dur="10s" repeatCount="indefinite" path="M240 200 L240 158 L240 50" keyPoints="0;0;1;1" keyTimes="0;0.55;0.85;1" calcMode="linear"/><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.85;0.86;1"/></g>
<g opacity="0"><text class="sm gn" x="240" y="124" text-anchor="middle">ищется только в VRF A</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.85;0.86;1"/></g>
<text class="sm" x="80" y="196" text-anchor="middle">пакет из офиса A</text><text class="sm" x="240" y="196" text-anchor="middle">пакет из офиса A</text>
</svg><figcaption>Слева PE хранит маршруты всех клиентов в одной таблице: два одинаковых маршрута конфликтуют, и пакет клиента A может уйти к клиенту B. Справа у каждого клиента своя таблица (VRF): пакет от клиента A ищется только в таблице A.</figcaption></figure>
<h3>Три вопроса, на которые отвечает L3VPN</h3>
<p>Вся технология — это ответы на три вопроса. Запомни их: по ним построена глава.</p>
<ol class="steps"><li><b>Как разделить клиентов на одном PE?</b> Отдельная таблица маршрутов на каждого клиента — <b>VRF</b> (раздел 4).</li>
<li><b>Как передать маршруты клиентов между PE и не перепутать?</b> Через <b>BGP</b>, с пометками <b>RD</b> и <b>RT</b> (разделы 2, 3, 5, 6, 7).</li>
<li><b>Как довезти пакет через ядро в нужный VRF на дальнем PE?</b> Двумя метками — как псевдопровод в главе 12 (раздел 8).</li></ol>
<div class="an"><b>Аналогия</b>Бизнес-центр, где сидят две компании, и в обеих есть «кабинет 101». Почтальон не может ориентироваться только по номеру кабинета: ему нужно знать, какой компании письмо. VRF — это отдельный журнал адресов для каждой компании, RD и RT — пометки на конверте «для компании А», а метки MPLS — мешок, в котором письмо едет между зданиями.</div>
<div class="callout pro"><b>Как это продают</b>У провайдеров L3VPN называют «IP VPN», «MPLS VPN», «корпоративная сеть», «L3-VPN». В заявке будут офисы клиента, их сети и способ подключения CE к PE: статика, OSPF или BGP. Всё это ты разберёшь в этой главе.</div>

<details class="chk"><summary>Проверь себя: чем L3VPN отличается от L2-канала для провайдера?</summary><p>В L3VPN провайдер знает сети клиента и сам маршрутизирует его трафик. В L2-канале он возит кадры и IP клиента не знает.</p></details>
<details class="chk"><summary>Проверь себя: почему PE не может держать маршруты всех клиентов в одной таблице?</summary><p>У разных клиентов бывают одинаковые серые сети. Одинаковые маршруты в разные места в одной таблице конфликтуют — пакет одного клиента уйдёт к другому.</p></details>
<details class="chk"><summary>Проверь себя: назови три вопроса, на которые отвечает L3VPN.</summary><p>Как разделить клиентов на PE (VRF), как передать их маршруты между PE и не перепутать (BGP с RD и RT), как довезти пакет в нужный VRF на дальнем PE (две метки MPLS).</p></details>`},

{h:'BGP с нуля (1): сессия между PE, next-hop, iBGP', html:`
<h3>Зачем здесь BGP</h3>
<p>Маршруты клиентов нужно передавать между PE. OSPF или IS-IS для этого не годятся: они рассчитаны на сотни маршрутов ядра, а у провайдера могут быть сотни клиентов по сотне сетей, и у каждого — своя таблица. Для переноса больших объёмов маршрутов с пометками и правилами придуман <b>BGP</b> (border gateway protocol). Это тот самый протокол, на котором держится весь интернет. Здесь нам нужна его малая часть.</p>
<p>BGP устроен иначе, чем OSPF:</p>
<ul><li><b>Соседей не ищет сам.</b> В OSPF маршрутизаторы находят друг друга по Hello. В BGP каждого соседа инженер прописывает руками: адрес и номер его сети.</li>
<li><b>Работает поверх TCP</b>, порт 179. Сначала открывается TCP-соединение, по нему идут сообщения BGP.</li>
<li><b>Карты сети не строит.</b> Он не считает SPF, а просто передаёт сообщения: «у меня есть сеть X, вот её свойства, слать через такой-то адрес».</li></ul>
<div class="an"><b>Аналогия</b>OSPF — это общий чат, где все сами видят друг друга и делятся картой. BGP — деловая переписка: договор заключают с каждым партнёром отдельно, а дальше отправляют друг другу письма «у нас есть такие-то сети, условия такие-то».</div>
<h3>AS, iBGP и eBGP</h3>
<p>Сеть одного хозяина в BGP называется <b>автономной системой</b> (AS) и имеет номер. В лабе сеть провайдера — AS 64500, клиент A — AS 65001. Номера от 64512 до 65534 — частные, как серые адреса: их используют внутри и у клиентов.</p>
<ul><li><b>iBGP</b> (internal) — соседство внутри одной AS. Между PE1 и PE2 — iBGP: оба в AS 64500.</li>
<li><b>eBGP</b> (external) — соседство между разными AS. Между PE1 и маршрутизатором клиента A1 — eBGP: 64500 и 65001.</li></ul>
<h3>Сессия между PE — по loopback</h3>
<p>Между PE1 и PE2 BGP-сессию строят от loopback до loopback: <code>neighbor 10.255.0.3 remote-as 64500</code> и <code>update-source Loopback0</code>. Почему не по адресу интерфейса? Loopback не падает вместе с линком. Если между PE несколько путей и один оборвался, IGP найдёт обход, а TCP-сессия между loopback'ами даже не заметит аварии. Условие одно: до loopback соседа должен быть маршрут в IGP — то, что ты проверял в главах 6 и 10.</p>
<figure class="dg"><svg viewBox="0 0 320 206" role="img" aria-label="iBGP между PE1 и PE2 по loopback через ядро и eBGP с маршрутизаторами клиента; PE2 сообщает PE1 о сети офиса 2">
<path d="M94 50 Q160 -6 226 50" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-dasharray="5 4"/>
<text class="sm bt" x="160" y="12" text-anchor="middle">iBGP, TCP 179, Lo0 ↔ Lo0</text>
<path class="ln" d="M116 70 L138 70 M182 70 L204 70"/>
<path d="M50 70 L72 70 M248 70 L270 70" stroke="#16a34a" stroke-width="2.4" fill="none"/>
<text class="sm gn" x="61" y="98" text-anchor="middle">eBGP</text><text class="sm gn" x="259" y="98" text-anchor="middle">eBGP</text>
<rect class="bx" x="6" y="58" width="44" height="24" rx="6"/><text class="tx" x="28" y="74" text-anchor="middle">A1</text>
<rect class="bx" x="72" y="58" width="44" height="24" rx="6"/><text class="tx" x="94" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="138" y="58" width="44" height="24" rx="6"/><text class="tx" x="160" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="204" y="58" width="44" height="24" rx="6"/><text class="tx" x="226" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="270" y="58" width="44" height="24" rx="6"/><text class="tx" x="292" y="74" text-anchor="middle">A2</text>
<text class="sm" x="28" y="114" text-anchor="middle">AS 65001</text><text class="sm" x="160" y="114" text-anchor="middle">AS 64500</text><text class="sm" x="292" y="114" text-anchor="middle">AS 65001</text>
<g opacity="0"><rect x="-26" y="-7" width="52" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">10.1.2.0/24</text><animateMotion dur="14s" repeatCount="indefinite" path="M292 46 L226 46" keyPoints="0;0;1;1" keyTimes="0;0.05;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.2;0.21;1"/></g>
<g opacity="0"><rect x="-32" y="-7" width="64" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">10.1.2.0/24 via .0.3</text><animateMotion dur="14s" repeatCount="indefinite" path="M226 50 Q160 -6 94 50" keyPoints="0;0;1;1" keyTimes="0;0.24;0.5;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.23;0.24;0.5;0.51;1"/></g>
<g><text class="sm" x="160" y="150" text-anchor="middle">A2 сообщает своему PE по eBGP:</text><text class="sm" x="160" y="166" text-anchor="middle">«за мной сеть 10.1.2.0/24»</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.22;0.23;1"/></g>
<g opacity="0"><text class="sm" x="160" y="150" text-anchor="middle">PE2 передаёт PE1 по iBGP: «10.1.2.0/24,</text><text class="sm" x="160" y="166" text-anchor="middle">next-hop 10.255.0.3 — это я»</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.23;0.24;0.55;0.56;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="150" text-anchor="middle">PE1 ищет путь до next-hop 10.255.0.3 в IGP:</text><text class="sm gn" x="160" y="166" text-anchor="middle">через P1, метка LDP — всё как в главе 10</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.56;0.57;1"/></g>
<text class="sm" x="160" y="196" text-anchor="middle">P1 в BGP не участвует — ядро без BGP (глава 10)</text>
</svg><figcaption>Зелёные линии — eBGP между PE и маршрутизаторами клиента. Синяя дуга — iBGP между PE: TCP-сессия от loopback до loopback прямо через ядро. По ней PE2 сообщает PE1 о сети офиса 2 и указывает себя как next-hop.</figcaption></figure>
<h3>Next-hop: «куда слать»</h3>
<p>В каждом маршруте BGP есть поле <b>next-hop</b> — адрес, куда отправлять трафик для этой сети. Когда PE2 передаёт PE1 маршрут офиса 2, next-hop в нём — loopback PE2, 10.255.0.3. Дальше PE1 делает знакомый тебе рекурсивный поиск: «до 10.255.0.3 — через P1, метка такая-то». Если до next-hop нет маршрута в IGP, BGP-маршрут считается непригодным и не используется. Это частая причина «маршрут пришёл, а не работает».</p>
<h3>Правило iBGP и route reflector</h3>
<p>У iBGP есть одно важное правило: <b>маршрут, полученный от iBGP-соседа, другому iBGP-соседу не передаётся</b>. Так BGP защищается от петель внутри одной AS. Следствие: каждый PE должен иметь iBGP-сессию с каждым другим PE — полная сетка, как в VPLS из главы 12. При сотне PE это почти пять тысяч сессий.</p>
<p>Поэтому в реальных сетях ставят <b>route reflector</b> (RR) — «отражатель маршрутов». Это маршрутизатор, которому разрешено нарушать правило: он принимает маршруты от всех PE и раздаёт их всем остальным. Каждый PE держит сессию только с двумя RR (второй — для надёжности). В лабе два PE, поэтому хватает одной прямой сессии.</p>
<h3>Состояние сессии: как понять, что она работает</h3>
<p>Сессия BGP поднимается по шагам: Idle → Connect → Active → OpenSent → OpenConfirm → <b>Established</b>. Рабочее состояние одно — Established. Смотрят его так:</p>
<pre class="cli">PE1#show bgp vpnv4 unicast all summary
Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
10.255.0.3      4 64500      58      61       21    0    0 00:41:07        [[3]]</pre>
<p>Главный столбец — последний, <b>State/PfxRcd</b>. Если там <b>число</b> — сессия Established, и это число полученных от соседа маршрутов. Если <b>слово</b> (Idle, Active) — сессии нет. «Active» сбивает с толку: оно значит не «активна», а «активно пытаюсь подключиться и не могу». Обычные причины: нет маршрута до loopback соседа, забыт update-source, ACL режет TCP 179, не совпал номер AS.</p>
<div class="callout lab"><b>В лабе</b>Задание 2: поднимешь iBGP PE1 ↔ PE2 по loopback'ам и проверишь его через <code>show bgp vpnv4 unicast all summary</code>. Пока маршрутов будет 0 — их появление ты увидишь в следующих заданиях. <a href="#/c/ch11/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: чем BGP отличается от OSPF в поиске соседей?</summary><p>OSPF находит соседей сам по Hello. В BGP каждого соседа прописывают руками: адрес и номер AS, а сессия идёт по TCP 179.</p></details>
<details class="chk"><summary>Проверь себя: почему iBGP между PE строят от loopback до loopback?</summary><p>Loopback не падает вместе с линком: при аварии IGP найдёт обход, и сессия не прервётся. Нужно только, чтобы до loopback соседа был маршрут в IGP и был указан update-source.</p></details>
<details class="chk"><summary>Проверь себя: в show bgp summary у соседа написано Active. Сессия работает?</summary><p>Нет. Active значит «пытаюсь подключиться и не могу». Рабочая сессия показывает в последнем столбце число полученных маршрутов.</p></details>
<details class="chk"><summary>Проверь себя: зачем route reflector?</summary><p>iBGP не передаёт маршрут, полученный от одного iBGP-соседа, другому. Без RR нужна полная сетка сессий между всеми PE. RR принимает маршруты от всех и раздаёт всем, и каждому PE хватает сессий с двумя RR.</p></details>`},

{h:'BGP с нуля (2): маршрут, семейства адресов и community', html:`
<h3>Из чего состоит маршрут BGP</h3>
<p>Маршрут в BGP — это не просто «сеть и куда». Это карточка с несколькими полями, их называют <b>атрибутами</b>. Для L3VPN нужны четыре:</p>
<ul><li><b>Сеть</b> (prefix) — например, 10.1.2.0/24.</li>
<li><b>Next-hop</b> — куда слать (раздел 2).</li>
<li><b>AS_PATH</b> — список AS, через которые прошёл маршрут. Например, «64500 65001»: маршрут родился в AS 65001 и прошёл через AS 64500. Главное применение — защита от петель: если маршрутизатор видит в AS_PATH свой номер AS, он такой маршрут отбрасывает. Это понадобится в разделе 9.</li>
<li><b>Community</b> — метки-ярлыки на маршруте, о них ниже.</li></ul>
<p>Остальные атрибуты (local-pref, MED и другие) нужны, чтобы выбирать лучший путь из нескольких. Это глава 8.</p>
<figure class="dg"><svg viewBox="0 0 320 196" role="img" aria-label="Маршрут BGP как карточка с полями и ярлыками-community">
<rect class="bx" x="40" y="14" width="240" height="126" rx="8"/>
<text class="tx" x="56" y="36">Маршрут BGP</text>
<text class="sm" x="56" y="58">сеть:</text><text class="sm bt" x="130" y="58">10.1.2.0/24</text>
<text class="sm" x="56" y="76">next-hop:</text><text class="sm bt" x="130" y="76">10.255.0.3</text>
<text class="sm" x="56" y="94">AS_PATH:</text><text class="sm bt" x="130" y="94">64500 65001</text>
<text class="sm" x="56" y="112">community:</text>
<g opacity="0"><rect x="130" y="102" width="64" height="14" rx="3" class="o"/><text class="wt2" x="162" y="112" text-anchor="middle">RT:64500:1</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.3;0.31;1"/></g>
<g opacity="0"><rect x="198" y="102" width="70" height="14" rx="3" class="gr"/><text class="wt2" x="233" y="112" text-anchor="middle">64500:777</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<text class="sm" x="56" y="130">метка VPN:</text><text class="sm bt" x="130" y="130">24</text>
<g opacity="0"><text class="sm og" x="160" y="164" text-anchor="middle">Оранжевая — extended community «route target»:</text><text class="sm og" x="160" y="180" text-anchor="middle">по ней PE решают, в какой VRF взять маршрут</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
</svg><figcaption>Маршрут BGP — карточка с полями. Для L3VPN в ней ещё едет метка VPN (раздел 8) и ярлыки-community. Серый ярлык — обычный community, провайдеры ставят такие для своих правил. Оранжевый — extended community с route target, главный для L3VPN.</figcaption></figure>
<h3>Community — ярлыки на маршрутах</h3>
<p><b>Community</b> — это число-ярлык, которое можно повесить на маршрут: «маршрут клиента», «не анонсировать наружу», «из Москвы». BGP сам их не понимает — их смысл придумывают инженеры, а маршрутизаторы по ярлыкам применяют правила. Обычный community — 4 байта, его записывают как «64500:777».</p>
<p>Для L3VPN придумали <b>extended community</b> — расширенный ярлык на 8 байт, у которого есть тип. Самый важный тип — <b>route target</b> (RT): «этот маршрут принадлежит такому-то VPN». Именно по RT дальний PE решает, в таблицу какого клиента положить маршрут (раздел 6).</p>
<div class="callout warn"><b>Ярлыки передаются, только если попросить</b>По умолчанию маршрутизатор Cisco соседу community не отправляет. Для L3VPN нужна команда <code>neighbor 10.255.0.3 send-community extended</code>. На многих версиях IOS она добавляется сама при включении соседа в VPNv4, но её можно случайно удалить. Тогда маршруты приходят без RT, ни один VRF их не принимает, и VPN пропадает целиком. Это поломка 2 в лабе.</div>
<h3>Семейства адресов: один BGP — много видов маршрутов</h3>
<p>BGP изначально возил только обычные IPv4-маршруты интернета. Потом его научили возить и другие: IPv6, маршруты VPN, MAC-адреса для EVPN. Каждый вид называется <b>address family</b> (семейство адресов). По одной TCP-сессии можно передавать несколько семейств, но каждое включают отдельно.</p>
<ul><li><b>IPv4 unicast</b> — обычные маршруты интернета.</li>
<li><b>VPNv4</b> — маршруты клиентов L3VPN. Вот это нам и нужно.</li>
<li><b>L2VPN EVPN</b> — MAC-адреса для EVPN (глава 12.1).</li></ul>
<pre class="cli">router bgp 64500
 no bgp default ipv4-unicast               ! не включать IPv4 по умолчанию для каждого соседа
 neighbor 10.255.0.3 remote-as 64500
 neighbor 10.255.0.3 update-source Loopback0
 address-family vpnv4                      ! семейство маршрутов VPN
  neighbor 10.255.0.3 activate
  neighbor 10.255.0.3 send-community extended</pre>
<p>Слово <code>activate</code> включает соседа в этом семействе. Строка <code>no bgp default ipv4-unicast</code> убирает старую привычку Cisco сразу включать каждому соседу обычный IPv4: между PE в L3VPN он не нужен.</p>
<div class="an"><b>Аналогия</b>Одна TCP-сессия — железнодорожный путь между двумя станциями. Семейства адресов — разные составы: пассажирский (IPv4), почтовый (VPNv4), грузовой (EVPN). Путь один, а какие составы по нему ходят, решаешь ты, включая каждый отдельно.</div>

<details class="chk"><summary>Проверь себя: какие четыре атрибута маршрута BGP нужны для L3VPN?</summary><p>Сеть, next-hop, AS_PATH и community (в том числе extended community с route target).</p></details>
<details class="chk"><summary>Проверь себя: что такое extended community route target и зачем он?</summary><p>Ярлык на 8 байт, который говорит, к какому VPN относится маршрут. По нему дальний PE решает, в таблицу какого клиента положить маршрут.</p></details>
<details class="chk"><summary>Проверь себя: что значит address family VPNv4 и зачем activate?</summary><p>VPNv4 — семейство маршрутов клиентов L3VPN. По одной сессии BGP может ходить несколько семейств, каждое включают отдельно командой activate.</p></details>`},

{h:'VRF: отдельный маршрутизатор для каждого клиента', html:`
<h3>Что такое VRF</h3>
<p><b>VRF</b> (virtual routing and forwarding) — это отдельная таблица маршрутов внутри одного физического маршрутизатора. У каждого клиента на PE свой VRF, и у каждого VRF свои:</p>
<ul><li><b>таблица маршрутов</b> — только сети этого клиента;</li>
<li><b>интерфейсы</b> — порты и сабинтерфейсы, к которым подключены его офисы. Интерфейс принадлежит ровно одному VRF;</li>
<li><b>таблица пересылки</b> — по ней идут пакеты.</li></ul>
<p>Кроме клиентских VRF, на PE остаётся обычная, <b>глобальная таблица</b>. В ней живёт всё, что ты изучал раньше: IGP ядра, loopback'и, LDP. Клиентские таблицы с ней не смешиваются.</p>
<div class="an"><b>Аналогия</b>Один маршрутизатор, разрезанный на несколько виртуальных. Как жилой дом: у каждой квартиры свой замок и свой почтовый ящик, а лестница и лифт (ядро) общие. Жильцы разных квартир могут даже носить одинаковые фамилии — путаницы не будет, потому что у каждой квартиры свой номер на двери.</div>
<figure class="dg"><svg viewBox="0 0 320 226" role="img" aria-label="PE1 с VRF A, VRF B и глобальной таблицей; пакет из порта клиента B ищется только в VRF B">
<rect x="70" y="20" width="180" height="170" rx="10" class="bx"/><text class="tx" x="160" y="38" text-anchor="middle">PE1</text>
<rect x="82" y="48" width="156" height="40" rx="6" fill="rgba(37,99,235,.12)" stroke="#2563eb" stroke-width="1.4"/><text class="sm bt" x="90" y="62">VRF A</text><text class="sm" x="90" y="78">10.1.1.0/24 → A1 (Gi0/1)</text>
<rect x="82" y="94" width="156" height="40" rx="6" fill="rgba(22,163,74,.12)" stroke="#16a34a" stroke-width="1.4"/><text class="sm gn" x="90" y="108">VRF B</text><text class="sm" x="90" y="124">10.1.1.0/24 → B1 (Gi0/2)</text>
<rect x="82" y="140" width="156" height="40" rx="6" fill="rgba(100,116,139,.12)" stroke="#64748b" stroke-width="1.4"/><text class="sm" x="90" y="154">глобальная таблица</text><text class="sm" x="90" y="170">IGP ядра, loopback'и, LDP</text>
<path class="ln" d="M30 68 L82 68" style="stroke:#2563eb"/><path class="ln" d="M30 114 L82 114" style="stroke:#16a34a"/><path class="ln" d="M238 160 L290 160"/>
<rect class="bx" x="2" y="56" width="28" height="24" rx="5"/><text class="tx" x="16" y="72" text-anchor="middle">A1</text>
<rect class="bx" x="2" y="102" width="28" height="24" rx="5"/><text class="tx" x="16" y="118" text-anchor="middle">B1</text>
<rect class="bx" x="290" y="148" width="28" height="24" rx="5"/><text class="tx" x="304" y="164" text-anchor="middle">P1</text>
<text class="sm" x="44" y="62">Gi0/1</text><text class="sm" x="44" y="108">Gi0/2</text><text class="sm" x="250" y="154">Gi0/0</text>
<g opacity="0"><rect x="-10" y="-6" width="20" height="12" rx="2" class="b"/><animateMotion dur="10s" repeatCount="indefinite" path="M16 114 L84 114 L230 114" keyPoints="0;0;0.32;0.32;1;1" keyTimes="0;0.05;0.25;0.3;0.6;1" calcMode="linear"/><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.62;0.63;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="210" text-anchor="middle">пакет с порта Gi0/2 ищется только в VRF B</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.3;0.31;1"/></g>
</svg><figcaption>Внутри PE1 три таблицы. Порт к A1 привязан к VRF A, порт к B1 — к VRF B, порт к ядру остаётся в глобальной таблице. Пакет, пришедший с порта клиента B, ищется только в таблице B, поэтому одинаковые сети клиентов не мешают друг другу.</figcaption></figure>
<h3>Как создать VRF</h3>
<pre class="cli">vrf definition A
 rd 10.255.0.1:1                        ! раздел 5
 address-family ipv4
  route-target both 64500:1             ! раздел 6
interface GigabitEthernet0/1
 vrf forwarding A                       ! порт к офису клиента A — в VRF A
 ip address 172.30.1.1 255.255.255.252</pre>
<p>В лабе у клиентов A и B одинаковые даже адреса линков до PE: 172.30.1.0/30 у обоих. На одном PE это работает, потому что адреса лежат в разных VRF.</p>
<div class="callout warn"><b>Ловушка: vrf forwarding стирает адрес</b>Когда интерфейс переносят в VRF (или заново выполняют <code>vrf forwarding</code>), IOS удаляет с него IP-адрес и пишет об этом одну строку в консоль. Её легко не заметить. После переноса порта в VRF всегда задавай адрес заново и проверяй <code>show ip interface brief</code>. Это поломка 3 в лабе.</div>
<h3>Ping и traceroute — только с vrf</h3>
<p>Любые проверки в сети клиента с PE делаются с указанием VRF: <code>ping vrf A 172.30.1.2</code>, <code>traceroute vrf A 10.1.2.1</code>, <code>show ip route vrf A</code>. Обычный <code>ping 172.30.1.2</code> ищет адрес в глобальной таблице, где сетей клиентов нет, и не проходит.</p>
<div class="callout pro"><b>Классическая ошибка дежурного</b>Пинг с PE до маршрутизатора клиента не прошёл — «клиент лежит». А пинговали без vrf. Прежде чем писать в заявку «нет связи с CE», проверь, что команда была с vrf, и что выбран VRF именно этого клиента.</div>
<div class="callout lab"><b>В лабе</b>Задание 1: создашь VRF A и B, разложишь порты клиентов и убедишься, что <code>ping vrf A 172.30.1.2</code> и <code>ping vrf B 172.30.1.2</code> отвечают разные маршрутизаторы, а пинг без vrf не работает. Поломка 3 — исчезнувший после vrf forwarding адрес. <a href="#/c/ch11/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что входит в VRF?</summary><p>Отдельная таблица маршрутов, таблица пересылки и набор интерфейсов, которые к нему привязаны. Интерфейс принадлежит одному VRF.</p></details>
<details class="chk"><summary>Проверь себя: что лежит в глобальной таблице PE?</summary><p>Маршруты ядра: IGP, loopback'и, линки. Сети клиентов лежат в их VRF.</p></details>
<details class="chk"><summary>Проверь себя: ping с PE до CE клиента не проходит. Что проверишь первым делом?</summary><p>Что пинг выполнен с указанием vrf этого клиента. Без vrf адрес ищется в глобальной таблице, где сетей клиента нет.</p></details>`},

{h:'RD: как сделать одинаковые сети разными для BGP', html:`
<h3>Проблема внутри BGP</h3>
<p>Маршруты из VRF нужно передать на другие PE через BGP. Но BGP устроен так: для каждой сети он хранит и передаёт <b>один лучший маршрут</b>. Если в BGP одновременно окажутся 10.1.1.0/24 клиента A и 10.1.1.0/24 клиента B, для BGP это одна и та же сеть. Он выберет один маршрут из двух, а второй потеряется.</p>
<h3>Решение: приставка к адресу</h3>
<p>Перед отправкой в BGP PE приписывает к сети клиента 8-байтовую приставку — <b>RD</b> (route distinguisher, «различитель маршрутов»). Получается новый, более длинный адрес — <b>VPNv4</b>:</p>
<table><tr><th>Клиент</th><th>Сеть в VRF</th><th>RD</th><th>Адрес VPNv4 в BGP</th></tr>
<tr><td>A</td><td>10.1.1.0/24</td><td>10.255.0.1:1</td><td>10.255.0.1:1:10.1.1.0/24</td></tr>
<tr><td>B</td><td>10.1.1.0/24</td><td>10.255.0.1:2</td><td>10.255.0.1:2:10.1.1.0/24</td></tr></table>
<p>Для BGP это теперь две разные сети, и он передаёт обе.</p>
<figure class="dg"><svg viewBox="0 0 320 196" role="img" aria-label="Без RD два одинаковых маршрута сливаются в один; с RD становятся разными адресами VPNv4">
<g><text class="tx" x="160" y="18" text-anchor="middle">Без RD</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.45;0.46;1"/></g>
<g opacity="0"><text class="tx" x="160" y="18" text-anchor="middle">С RD</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.46;0.47;1"/></g>
<rect x="10" y="34" width="96" height="22" rx="4" fill="rgba(37,99,235,.14)" stroke="#2563eb"/><text class="sm" x="58" y="49" text-anchor="middle">A: 10.1.1.0/24</text>
<rect x="10" y="66" width="96" height="22" rx="4" fill="rgba(22,163,74,.14)" stroke="#16a34a"/><text class="sm" x="58" y="81" text-anchor="middle">B: 10.1.1.0/24</text>
<path class="ln" d="M106 45 L150 60 M106 77 L150 64" marker-end=""/>
<rect class="bx" x="150" y="44" width="60" height="36" rx="6"/><text class="tx" x="180" y="66" text-anchor="middle">BGP</text>
<g><rect x="222" y="50" width="92" height="24" rx="4" fill="rgba(225,29,72,.12)" stroke="#e11d48"/><text class="sm rd" x="268" y="66" text-anchor="middle">10.1.1.0/24 — один</text><text class="sm rd" x="160" y="126" text-anchor="middle">второй маршрут потерян</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.15;0.16;0.45;0.46;1"/></g>
<g opacity="0"><rect x="216" y="30" width="100" height="22" rx="4" fill="rgba(37,99,235,.14)" stroke="#2563eb"/><text class="sm" x="266" y="45" text-anchor="middle">…0.1:1:10.1.1.0/24</text>
<rect x="216" y="72" width="100" height="22" rx="4" fill="rgba(22,163,74,.14)" stroke="#16a34a"/><text class="sm" x="266" y="87" text-anchor="middle">…0.1:2:10.1.1.0/24</text>
<text class="sm gn" x="160" y="126" text-anchor="middle">два разных адреса VPNv4 — оба передаются</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
<g opacity="0"><rect x="112" y="24" width="46" height="14" rx="3" class="pu"/><text class="wt2" x="135" y="34" text-anchor="middle">RD …:1</text><rect x="112" y="92" width="46" height="14" rx="3" class="pu"/><text class="wt2" x="135" y="102" text-anchor="middle">RD …:2</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<text class="sm" x="160" y="150" text-anchor="middle">RD = «10.255.0.1:1» — loopback PE и номер VRF.</text>
<text class="sm" x="160" y="166" text-anchor="middle">Его задача одна — сделать адрес уникальным.</text>
</svg><figcaption>Сверху одинаковые сети клиентов A и B попадают в BGP как есть, и BGP оставляет только одну. С RD к каждой приписывается своя приставка, и для BGP это уже разные адреса.</figcaption></figure>
<h3>Чего RD не делает</h3>
<p>Это главная путаница в L3VPN. RD <b>не решает</b>, в какой VRF на дальнем PE попадёт маршрут. Он нужен только для того, чтобы адрес в BGP был уникальным. Решает другое — route target, следующий раздел.</p>
<p>Записывают RD как «номер AS:число» или «IP-адрес:число». Провайдеры чаще берут <b>loopback PE и номер VRF</b>: 10.255.0.1:1 на PE1, 10.255.0.3:1 на PE2. Так RD уникален не только для клиента, но и для каждого PE — это пригодится, когда офис клиента подключат к двум PE сразу.</p>
<div class="an"><b>Аналогия</b>В почтовом адресе мало «кабинет 101»: в одном бизнес-центре такой кабинет есть у двух компаний. Дописываем «ООО А, кабинет 101» и «ООО Б, кабинет 101» — адреса стали разными. Но приписка не говорит почтальону, в какой ящик класть письмо, она только убирает путаницу.</div>

<details class="chk"><summary>Проверь себя: зачем нужен RD?</summary><p>Чтобы одинаковые сети разных клиентов стали в BGP разными адресами VPNv4 и BGP не оставил только одну из них.</p></details>
<details class="chk"><summary>Проверь себя: решает ли RD, в какой VRF на дальнем PE попадёт маршрут?</summary><p>Нет. Это решает route target. RD только делает адрес уникальным.</p></details>
<details class="chk"><summary>Проверь себя: из чего состоит адрес VPNv4?</summary><p>Из RD (8 байт) и обычной сети IPv4: например, 10.255.0.1:1:10.1.1.0/24.</p></details>`},

{h:'RT: в какой VRF положить маршрут', html:`
<h3>Экспорт и импорт</h3>
<p><b>RT</b> (route target) — тот самый ярлык extended community из раздела 3. У каждого VRF есть два списка RT:</p>
<ul><li><b>export</b> — какие RT повесить на маршруты этого VRF, когда они уходят в BGP;</li>
<li><b>import</b> — маршруты с какими RT принимать в этот VRF.</li></ul>
<p>Когда на PE2 приходит маршрут VPNv4, PE2 смотрит на его RT и кладёт маршрут во <b>все</b> VRF, у которых этот RT есть в списке import. Если ни у одного VRF такого RT нет, маршрут отбрасывается.</p>
<p>Для обычного VPN одного клиента всё просто: export и import одинаковые на всех PE. Клиент A — 64500:1, клиент B — 64500:2. Команда <code>route-target both 64500:1</code> задаёт оба списка сразу.</p>
<figure class="dg"><svg viewBox="0 0 320 214" role="img" aria-label="На PE2 маршрут с RT 64500:1 попадает в VRF A, а в VRF B не попадает; маршрут с RT 64500:2 — наоборот">
<rect class="bx" x="186" y="20" width="128" height="150" rx="10"/><text class="tx" x="250" y="38" text-anchor="middle">PE2</text>
<rect x="196" y="50" width="108" height="44" rx="6" fill="rgba(37,99,235,.12)" stroke="#2563eb" stroke-width="1.4"/><text class="sm bt" x="204" y="66">VRF A</text><text class="sm" x="204" y="82">import 64500:1</text>
<rect x="196" y="110" width="108" height="44" rx="6" fill="rgba(22,163,74,.12)" stroke="#16a34a" stroke-width="1.4"/><text class="sm gn" x="204" y="126">VRF B</text><text class="sm" x="204" y="142">import 64500:2</text>
<text class="sm" x="80" y="38" text-anchor="middle">от PE1 по BGP:</text>
<g opacity="0"><rect x="-36" y="-8" width="72" height="16" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">RT 64500:1</text><animateMotion dur="14s" repeatCount="indefinite" path="M80 72 L196 72" keyPoints="0;0;1;1" keyTimes="0;0.05;0.22;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.3;0.31;1"/></g>
<g opacity="0"><text class="sm gn" x="80" y="96" text-anchor="middle">✓ в VRF A</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.22;0.23;0.45;0.46;1"/></g>
<g opacity="0"><rect x="-36" y="-8" width="72" height="16" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">RT 64500:1</text><animateMotion dur="14s" repeatCount="indefinite" path="M80 132 L190 132 L150 132" keyPoints="0;0;0.733;1;1" keyTimes="0;0.05;0.22;0.3;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.3;0.31;1"/></g>
<g opacity="0"><text class="sm rd" x="80" y="158" text-anchor="middle">✕ в VRF B не берут</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.45;0.46;1"/></g>
<g opacity="0"><rect x="-36" y="-8" width="72" height="16" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">RT 64500:2</text><animateMotion dur="14s" repeatCount="indefinite" path="M80 132 L196 132" keyPoints="0;0;1;1" keyTimes="0;0.52;0.7;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.51;0.52;0.8;0.81;1"/></g>
<g opacity="0"><text class="sm gn" x="80" y="158" text-anchor="middle">✓ в VRF B</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.7;0.71;1"/></g>
<text class="sm" x="160" y="192" text-anchor="middle">Маршрут попадает в те VRF, где его RT есть в import</text>
</svg><figcaption>Маршрут клиента A приходит с ярлыком RT 64500:1: VRF A его импортирует, VRF B — нет. Маршрут клиента B с RT 64500:2 попадает только в VRF B. Так одинаковые сети двух клиентов расходятся по своим таблицам.</figcaption></figure>
<h3>RD и RT — не путать</h3>
<table><tr><th></th><th>RD</th><th>RT</th></tr>
<tr><td>Зачем</td><td>сделать адрес уникальным в BGP</td><td>решить, в какой VRF положить маршрут</td></tr>
<tr><td>Где живёт</td><td>приставка к адресу VPNv4</td><td>ярлык extended community на маршруте</td></tr>
<tr><td>Сколько у маршрута</td><td>ровно один</td><td>один или несколько</td></tr>
<tr><td>Если ошибся</td><td>обычно ничего заметного</td><td>маршруты не туда или никуда</td></tr></table>
<p>Подсказка для запоминания: <b>RD — чтобы Различать, RT — чтобы Раздавать</b>.</p>
<p>Возможность повесить несколько RT и импортировать несколько — это сила L3VPN. Так строят общий сервис для многих клиентов, схемы «центр — филиалы» и другие топологии. Это раздел 11.</p>
<div class="callout pro"><b>Опечатка в RT — тихая авария</b>Если в import на одном PE ошиблись в одной цифре (64500:11 вместо 64500:1), BGP-сессия в порядке, маршрут приходит, а в VRF не попадает. Никаких ошибок в логах. Видно только в <code>show bgp vpnv4 unicast all</code> — маршрут есть с RT 64500:1 — и в настройке VRF — import другой. Это поломка 1 в лабе.</div>

<details class="chk"><summary>Проверь себя: что значат export RT и import RT?</summary><p>Export — какие ярлыки повесить на маршруты VRF при отправке в BGP. Import — маршруты с какими ярлыками принимать в VRF.</p></details>
<details class="chk"><summary>Проверь себя: маршрут пришёл на PE2 с RT 64500:1. У VRF A import 64500:1, у VRF B — 64500:2. Куда он попадёт?</summary><p>Только в VRF A.</p></details>
<details class="chk"><summary>Проверь себя: чем отличаются RD и RT?</summary><p>RD делает адрес уникальным в BGP и не влияет на импорт. RT — ярлык, по которому PE решает, в какой VRF положить маршрут.</p></details>`},

{h:'Путь маршрута: от офиса 2 до офиса 1', html:`
<h3>Собираем всё вместе</h3>
<p>Ты знаешь все детали: VRF, BGP, RD, RT. Теперь проследим, как сеть офиса 2 клиента A (10.1.2.0/24) становится известна офису 1. Это <b>control plane</b> — «плоскость управления»: как маршрутизаторы узнают маршруты. Как ходят сами пакеты, разберём в следующем разделе.</p>
<figure class="dg"><svg viewBox="0 0 320 236" role="img" aria-label="Маршрут 10.1.2.0/24 идёт от A2 к PE2, превращается в VPNv4 с RD, RT и меткой, по iBGP попадает на PE1 в VRF A и к A1">
<path d="M94 86 Q160 26 226 86" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="5 4"/>
<path class="ln" d="M116 100 L138 100 M182 100 L204 100"/><path d="M50 100 L72 100 M248 100 L270 100" stroke="#16a34a" stroke-width="2.4" fill="none"/>
<rect class="bx" x="6" y="88" width="44" height="24" rx="6"/><text class="tx" x="28" y="104" text-anchor="middle">A1</text>
<rect class="bx" x="72" y="88" width="44" height="24" rx="6"/><text class="tx" x="94" y="104" text-anchor="middle">PE1</text>
<rect class="bx" x="138" y="88" width="44" height="24" rx="6"/><text class="tx" x="160" y="104" text-anchor="middle">P1</text>
<rect class="bx" x="204" y="88" width="44" height="24" rx="6"/><text class="tx" x="226" y="104" text-anchor="middle">PE2</text>
<rect class="bx" x="270" y="88" width="44" height="24" rx="6"/><text class="tx" x="292" y="104" text-anchor="middle">A2</text>
<g opacity="0"><rect x="-26" y="-7" width="52" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">10.1.2.0/24</text><animateMotion dur="18s" repeatCount="indefinite" path="M292 76 L226 76" keyPoints="0;0;1;1" keyTimes="0;0.03;0.14;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.22;0.23;1"/></g>
<g opacity="0"><rect x="-30" y="-39" width="60" height="14" rx="3" class="pu"/><text class="wt2" x="0" y="-29" text-anchor="middle">RD 10.255.0.3:1</text><rect x="-30" y="-23" width="60" height="14" rx="3" class="o"/><text class="wt2" x="0" y="-13" text-anchor="middle">RT 64500:1</text><rect x="-30" y="-7" width="60" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">метка VPN 24</text><animateMotion dur="18s" repeatCount="indefinite" path="M226 62 Q160 22 94 62" keyPoints="0;0;1;1" keyTimes="0;0.3;0.52;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.55;0.56;1"/></g>
<g opacity="0"><rect x="-26" y="-7" width="52" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">10.1.2.0/24</text><animateMotion dur="18s" repeatCount="indefinite" path="M94 76 L28 76" keyPoints="0;0;1;1" keyTimes="0;0.7;0.82;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.69;0.7;0.9;0.91;1"/></g>
<g><text class="sm" x="160" y="150" text-anchor="middle">1. A2 сообщает PE2 по eBGP: «за мной 10.1.2.0/24».</text><text class="sm" x="160" y="166" text-anchor="middle">PE2 кладёт маршрут в VRF A</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.23;0.24;1"/></g>
<g opacity="0"><text class="sm" x="160" y="150" text-anchor="middle">2. PE2 делает из него VPNv4: приписывает RD,</text><text class="sm" x="160" y="166" text-anchor="middle">вешает RT, выбирает метку VPN, next-hop — себя</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.52;0.53;1"/></g>
<g opacity="0"><text class="sm" x="160" y="150" text-anchor="middle">3. PE1 получил маршрут по iBGP, видит RT 64500:1</text><text class="sm" x="160" y="166" text-anchor="middle">и кладёт его в VRF A: «10.1.2.0/24 через PE2, метка 24»</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.53;0.54;0.69;0.7;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="150" text-anchor="middle">4. PE1 сообщает A1 по eBGP: «10.1.2.0/24 — через меня».</text><text class="sm gn" x="160" y="166" text-anchor="middle">Офис 1 знает про офис 2</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.7;0.71;1"/></g>
<text class="sm" x="160" y="206" text-anchor="middle">P1 в этом не участвует: маршрут едет по iBGP-сессии</text>
<text class="sm" x="160" y="222" text-anchor="middle">между loopback'ами PE как обычный TCP-трафик</text>
</svg><figcaption>Зелёная наклейка — обычный маршрут клиента, как его видят CE. Между PE он едет по iBGP уже как маршрут VPNv4: с приставкой RD, ярлыком RT и меткой VPN, которую выбрал PE2.</figcaption></figure>
<ol class="steps"><li><b>CE → PE.</b> A2 сообщает PE2 по eBGP, что за ним 10.1.2.0/24. На PE2 эта сессия живёт внутри VRF A, поэтому маршрут сразу попадает в таблицу клиента A.</li>
<li><b>VRF → VPNv4.</b> PE2 превращает маршрут в VPNv4: приписывает RD 10.255.0.3:1, вешает export RT 64500:1, выбирает <b>метку VPN</b> (здесь 24) — по ней он потом узнает пакеты для этой сети — и ставит next-hop = свой loopback.</li>
<li><b>PE → PE.</b> Маршрут уходит по iBGP в семействе VPNv4. RT едет как extended community, поэтому нужен send-community extended.</li>
<li><b>VPNv4 → VRF.</b> PE1 проверяет, что до next-hop 10.255.0.3 есть путь и транспортная метка. Смотрит RT, находит VRF с таким import — VRF A — и кладёт маршрут туда, запомнив метку 24.</li>
<li><b>PE → CE.</b> PE1 сообщает A1 о сети офиса 2.</li></ol>
<p>Если клиент подключён не по BGP, а статикой или OSPF, есть ещё один шаг: маршрут из VRF надо <b>явно передать в BGP</b> командой <code>redistribute static</code> или <code>redistribute ospf</code> внутри <code>address-family ipv4 vrf B</code>. Забыть это — частая причина «маршрута нет на другом PE».</p>
<h3>Как это выглядит в выводах</h3>
<pre class="cli">PE1#show bgp vpnv4 unicast vrf A 10.1.2.0/24
BGP routing table entry for 10.255.0.1:1:10.1.2.0/24, version 14
  65001
    [[10.255.0.3]] (metric 20) from 10.255.0.3 (10.255.0.3)
      Origin IGP, metric 0, localpref 100, valid, internal, best
      Extended Community: [[RT:64500:1]]
      mpls labels in/out nolabel/[[24]]
PE1#show ip route vrf A
B        10.1.2.0/24 [200/0] via 10.255.0.3, 00:12:31</pre>
<p>Здесь видно всё из этого раздела: next-hop — PE2 (10.255.0.3), ярлык RT:64500:1, метка VPN 24 (out — та, что ставить при отправке). В таблице VRF A маршрут помечен <b>B</b> (BGP) с административным расстоянием 200 — так Cisco помечает маршруты iBGP.</p>
<div class="callout pro"><b>Где маршрут потерялся</b>Если в VRF на дальнем PE маршрута нет, иди по этим шагам с начала: есть ли маршрут в VRF на своём PE (шаг 1), есть ли он в <code>show bgp vpnv4 unicast vrf</code> (шаг 2 — для статики и OSPF нужна редистрибуция), пришёл ли он на дальний PE (<code>show bgp vpnv4 unicast all</code>, шаг 3), с каким RT и импортирован ли (шаг 4). Подробный порядок — в разделе 10.</div>
<div class="callout lab"><b>В лабе</b>Задание 3: подними eBGP с офисами клиента A и проследи маршрут 10.1.1.0/24 по этим шагам: на PE1, в VPNv4, на PE2. Задание 4: клиент B подключён статикой и OSPF — без редистрибуции его маршруты в BGP не попадут. <a href="#/c/ch11/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что PE2 добавляет к маршруту клиента, превращая его в VPNv4?</summary><p>RD (уникальность), export RT (принадлежность VPN), метку VPN (по ней PE2 узнает пакеты) и next-hop — свой loopback.</p></details>
<details class="chk"><summary>Проверь себя: клиент B подключён к PE1 статикой. Что нужно, чтобы его сеть появилась на PE2?</summary><p>Передать статический маршрут из VRF B в BGP: redistribute static в address-family ipv4 vrf B на PE1.</p></details>
<details class="chk"><summary>Проверь себя: что означает «mpls labels in/out nolabel/24» на PE1?</summary><p>Для этой сети PE1 при отправке ставит метку VPN 24 — её выбрал PE2. Своей входящей метки у PE1 для неё нет: сеть не его.</p></details>`},

{h:'Путь пакета: две метки, как в псевдопроводе', html:`
<h3>Метки ты уже знаешь</h3>
<p>Теперь <b>data plane</b> — как идёт сам пакет. Хорошая новость: ты это уже видел в главе 12. На пакете клиента две метки, верхняя везёт через ядро, нижняя говорит выходному PE, кому отдать пакет. Разница одна: нижняя метка здесь — <b>метка VPN</b>, и раздал её не targeted LDP, а BGP.</p>
<figure class="dg"><svg viewBox="0 0 320 212" role="img" aria-label="Пакет A1 → A2: PE1 вешает метку VPN 24 и транспортную 18, P1 снимает 18, PE2 по метке 24 отдаёт пакет в VRF A к A2">
<path class="ln" d="M50 70 L72 70 M116 70 L138 70 M182 70 L204 70 M248 70 L270 70"/>
<rect class="bx" x="6" y="58" width="44" height="24" rx="6"/><text class="tx" x="28" y="74" text-anchor="middle">A1</text>
<rect class="bx" x="72" y="58" width="44" height="24" rx="6"/><text class="tx" x="94" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="138" y="58" width="44" height="24" rx="6"/><text class="tx" x="160" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="204" y="58" width="44" height="24" rx="6"/><text class="tx" x="226" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="270" y="58" width="44" height="24" rx="6"/><text class="tx" x="292" y="74" text-anchor="middle">A2</text>
<g opacity="0"><rect x="-10" y="-6" width="20" height="12" rx="2" class="env"/><path d="M-10 -6 L0 1 L10 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M28 46 L292 46" keyPoints="0;0;0.25;0.25;0.5;0.5;0.75;0.75;1;1" keyTimes="0;0.03;0.13;0.17;0.32;0.36;0.51;0.55;0.65;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.67;0.68;1"/></g>
<g opacity="0"><rect x="-16" y="-21" width="32" height="12" rx="3" class="o"/><text class="wt2" x="0" y="-12" text-anchor="middle">VPN 24</text><animateMotion dur="14s" repeatCount="indefinite" path="M94 46 L226 46" keyPoints="0;0;0.5;0.5;1;1" keyTimes="0;0.17;0.32;0.36;0.51;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.15;0.16;0.53;0.54;1"/></g>
<g opacity="0"><rect x="-14" y="-35" width="28" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-26" text-anchor="middle">18</text><animateMotion dur="14s" repeatCount="indefinite" path="M94 46 L160 46" keyPoints="0;0;1;1" keyTimes="0;0.17;0.32;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.15;0.16;0.335;0.34;1"/></g>
<g opacity="0"><text class="sm bt" x="94" y="102" text-anchor="middle">VRF A: push 24,</text><text class="sm bt" x="94" y="116" text-anchor="middle">push 18</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.15;0.16;1"/></g>
<g opacity="0"><text class="sm bt" x="160" y="102" text-anchor="middle">pop 18</text><text class="sm bt" x="160" y="116" text-anchor="middle">(PHP)</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.34;0.35;1"/></g>
<g opacity="0"><text class="sm bt" x="226" y="102" text-anchor="middle">24 → VRF A,</text><text class="sm bt" x="226" y="116" text-anchor="middle">к A2</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.53;0.54;1"/></g>
<g opacity="0"><text class="sm" x="160" y="156" text-anchor="middle">Пакет клиента B на тот же адрес 10.1.2.1 получил бы</text><text class="sm og" x="160" y="172" text-anchor="middle">другую метку VPN — 25, и PE2 отдал бы его в VRF B</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.68;0.69;1"/></g>
</svg><figcaption>PE1 ищет адрес в VRF A и находит: «через PE2, метка VPN 24». Сверху добавляет транспортную метку 18 до PE2 — её дал P1 по LDP. P1 — предпоследний, он снимает 18 (PHP). PE2 по метке 24 сразу знает: это пакет для VRF A, отдать A2.</figcaption></figure>
<table><tr><th>Кто</th><th>Что видит</th><th>Что делает</th></tr>
<tr><td>PE1</td><td>IP-пакет на 10.1.2.1 с порта клиента A</td><td>ищет в VRF A: через 10.255.0.3, метка VPN 24; до 10.255.0.3 — через P1, метка 18. Ставит 24, сверху 18</td></tr>
<tr><td>P1</td><td>метка 18</td><td>снимает (PHP). О VRF и клиентах ничего не знает</td></tr>
<tr><td>PE2</td><td>метка 24</td><td>по метке находит VRF A и отправляет пакет к A2</td></tr></table>
<pre class="cli">PE1#show ip cef vrf A 10.1.2.1 detail
10.1.2.0/24, epoch 0
  recursive via 10.255.0.3 [[label 24]]
    nexthop 10.1.12.1 GigabitEthernet0/0 [[label 18]]
PE2#show mpls forwarding-table vrf A
Local      Outgoing   Prefix           Bytes Label   Outgoing   Next Hop
Label      Label      or Tunnel Id     Switched      interface
[[24]]         No Label   10.1.2.0/24[V]   1520          Gi0/1      172.30.2.2</pre>
<p>В первом выводе обе метки в одной записи: метка VPN 24 («recursive via 10.255.0.3 label 24») и транспортная 18 («nexthop … label 18»). Во втором — что PE2 делает с меткой 24: отправляет в сторону A2 без метки. Буква <b>[V]</b> значит «VRF».</p>
<div class="callout warn"><b>«No Label» здесь — норма</b>В главе 10 «No Label» на пути через ядро был аварией. На выходном PE в сторону клиента — всё правильно: клиенту пакет и должен уйти без меток, обычным IP. Смотри, где стоит «No Label»: в ядре — плохо, на выходе к CE — нормально.</div>
<div class="callout pro"><b>MTU снова</b>Две метки — плюс 8 байт к пакету клиента. Полный пакет 1500 байт превращается в 1508, и на линке ядра с MTU 1500 он не пролезет: маленькие пинги проходят, а файлы между офисами не копируются. Поэтому в ядре MPLS — jumbo MTU (главы 10 и 12). Это поломка 4 в лабе.</div>
<div class="callout lab"><b>В лабе</b>Задание 5: найдёшь метку VPN и транспортную метку для пакета A1 → 10.1.2.1, посмотришь, что делает P1 и PE2, снимешь захват на линке PE1–P1 и найдёшь стек из двух меток. Потом сравнишь с пакетом клиента B: какая из двух меток у него другая? <a href="#/c/ch11/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: откуда PE1 берёт метку VPN, а откуда — транспортную?</summary><p>Метку VPN выбрал PE2 и прислал по BGP вместе с маршрутом. Транспортную PE1 берёт по LDP от соседа на пути к loopback PE2 — от P1.</p></details>
<details class="chk"><summary>Проверь себя: пакеты клиентов A и B идут на одинаковый адрес 10.1.2.1. Какая метка у них разная?</summary><p>Метка VPN: у A — 24, у B — 25. Транспортная одинаковая — обе едут до PE2.</p></details>
<details class="chk"><summary>Проверь себя: в LFIB PE2 для 10.1.2.0/24 в VRF A стоит «No Label». Это авария?</summary><p>Нет. PE2 отдаёт пакет клиенту, и тот должен получить обычный IP без меток.</p></details>`},

{h:'Как подключить офис: статика, OSPF или BGP', html:`
<h3>Три способа</h3>
<p>Между CE и PE тоже нужна маршрутизация: PE должен узнать сети офиса, а офис — сети других офисов. Для этого используют один из трёх способов, и все три есть в лабе.</p>
<table><tr><th>Способ</th><th>Когда</th><th>Что настраивается на PE</th></tr>
<tr><td>Статика</td><td>маленький офис, один канал</td><td>статический маршрут в VRF к сети офиса + redistribute static в BGP. На CE — маршрут по умолчанию на PE</td></tr>
<tr><td>OSPF</td><td>у клиента уже работает OSPF</td><td>процесс OSPF внутри VRF + взаимная редистрибуция OSPF ↔ BGP</td></tr>
<tr><td>eBGP</td><td>крупный клиент, много офисов, резервные каналы</td><td>BGP-сосед внутри address-family ipv4 vrf</td></tr></table>
<pre class="cli">! статика (клиент B, офис 1)
ip route vrf B 10.1.1.0 255.255.255.0 172.30.1.2
router bgp 64500
 address-family ipv4 vrf B
  redistribute static
  redistribute connected
! eBGP (клиент A, офис 1)
 address-family ipv4 vrf A
  neighbor 172.30.1.2 remote-as 65001
  neighbor 172.30.1.2 activate</pre>
<p>С OSPF интересная деталь. Сеть, которая у клиента была внутренней OSPF, на другом офисе появится как <b>O IA</b> — как будто ядро провайдера стало над всеми офисами общей «магистралью». А статика, переданная через BGP в OSPF, придёт как внешняя — <b>O E2</b>. В лабе ты это увидишь на B2.</p>
<h3>Ловушка eBGP: один номер AS на все офисы</h3>
<p>Клиенты часто дают всем своим офисам один номер AS — в лабе у обоих офисов клиента A это 65001. И тут срабатывает защита BGP от петель из раздела 3: маршрутизатор отбрасывает маршрут, в AS_PATH которого есть его собственный номер AS.</p>
<p>Маршрут офиса 1 уходит от A1 с AS_PATH «65001», через PE приходит к A2 уже как «64500 65001». A2 видит свою 65001 и решает: «это моя же сеть вернулась петлёй». Маршрут отброшен, офисы друг друга не видят.</p>
<figure class="dg"><svg viewBox="0 0 320 196" role="img" aria-label="Без as-override A2 отбрасывает маршрут со своей AS в пути; с as-override PE заменяет AS клиента своей">
<rect class="bx" x="204" y="80" width="44" height="24" rx="6"/><text class="tx" x="226" y="96" text-anchor="middle">PE2</text>
<rect class="bx" x="270" y="80" width="44" height="24" rx="6"/><text class="tx" x="292" y="96" text-anchor="middle">A2</text>
<path d="M248 92 L270 92" stroke="#16a34a" stroke-width="2.4" fill="none"/>
<text class="sm" x="292" y="124" text-anchor="middle">AS 65001</text>
<g><rect x="10" y="36" width="170" height="24" rx="4" class="bx"/><text class="sm" x="18" y="52">10.1.1.0/24, AS_PATH 64500 65001</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.45;0.46;1"/></g>
<g opacity="0"><rect x="10" y="36" width="170" height="24" rx="4" class="bx"/><text class="sm" x="18" y="52">10.1.1.0/24, AS_PATH 64500 <tspan class="gn">64500</tspan></text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="2" class="g"/><animateMotion dur="12s" repeatCount="indefinite" path="M226 70 L292 70" keyPoints="0;0;1;1" keyTimes="0;0.08;0.22;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.07;0.08;0.24;0.25;1"/></g>
<g opacity="0"><path class="lr" d="M285 63 L299 77 M299 63 L285 77"/><text class="sm rd" x="160" y="150" text-anchor="middle">A2: «в пути моя AS 65001 — петля, отбросить»</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.45;0.46;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="2" class="g"/><animateMotion dur="12s" repeatCount="indefinite" path="M226 70 L292 70" keyPoints="0;0;1;1" keyTimes="0;0.58;0.72;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.57;0.58;0.74;0.75;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="150" text-anchor="middle">as-override на PE2: 65001 заменена на 64500 —</text><text class="sm gn" x="160" y="166" text-anchor="middle">A2 принимает маршрут</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.74;0.75;1"/></g>
<text class="sm" x="95" y="28" text-anchor="middle">PE2 отправляет A2:</text>
</svg><figcaption>Сверху PE2 отдаёт маршрут офиса 1 с AS_PATH «64500 65001». A2 сам в AS 65001, видит свой номер и отбрасывает маршрут как петлю. Снизу на PE2 включён as-override: номер AS клиента в пути заменён на номер провайдера, и защита от петель не срабатывает.</figcaption></figure>
<p>Решения два:</p>
<ul><li><b>as-override</b> на PE (<code>neighbor 172.30.2.2 as-override</code>) — PE заменяет номер AS клиента в AS_PATH своим. Делается на стороне провайдера, клиенту ничего настраивать не нужно. Используют чаще всего.</li>
<li><b>allowas-in</b> на CE — CE разрешает принимать маршруты со своей AS в пути. Настраивает клиент.</li></ul>
<div class="callout lab"><b>В лабе</b>Задание 3: поднимешь eBGP с A1 и A2 и увидишь, что маршрут до A2 не доходит. Найдёшь причину в <code>show ip bgp</code> на A2 и починишь as-override. Задание 4: клиент B — статика на одном офисе и OSPF на другом; посмотришь, каким кодом B2 видит сеть первого офиса. <a href="#/c/ch11/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: офис подключён к PE статикой. Что ещё нужно, кроме статического маршрута в VRF?</summary><p>Редистрибуция статики (и connected) в BGP в address-family ipv4 vrf, иначе сеть офиса не попадёт к другим PE. На CE — маршрут по умолчанию на PE.</p></details>
<details class="chk"><summary>Проверь себя: у всех офисов клиента AS 65001, офисы не видят друг друга. Почему и как починить?</summary><p>CE отбрасывают маршруты, в AS_PATH которых есть их же AS 65001 (защита от петель). На PE включают as-override (или на CE — allowas-in).</p></details>`},

{h:'«Офис не видит офис»: диагностика по шагам', html:`
<h3>Самая частая заявка по L3VPN</h3>
<p>Клиент пишет: «из офиса 1 не видно офис 2». Как и в L2-канале, путь маршрута — цепочка шагов из раздела 7, и пакет идёт только тогда, когда все шаги пройдены. Найди первый непройденный.</p>
<figure class="dg"><svg viewBox="0 0 320 250" role="img" aria-label="Шесть шагов L3VPN; разные поломки останавливаются на разных шагах">
<g><text class="tx" x="160" y="20" text-anchor="middle">Поломка 1: на PE2 import RT 64500:11</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.32;0.33;1"/></g>
<g opacity="0"><text class="tx" x="160" y="20" text-anchor="middle">Поломка 2: статику забыли передать в BGP</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.65;0.66;1"/></g>
<g opacity="0"><text class="tx" x="160" y="20" text-anchor="middle">Поломка 3: у офисов одна AS, нет as-override</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></g>
<rect class="bx" x="8" y="36" width="96" height="24" rx="5"/><text class="tx" x="56" y="52" text-anchor="middle">CE → PE</text><text class="sm" x="112" y="52">сосед up, маршрут в VRF</text>
<rect class="bx" x="8" y="64" width="96" height="24" rx="5"/><text class="tx" x="56" y="80" text-anchor="middle">в BGP</text><text class="sm" x="112" y="80">есть в VPNv4 (редистрибуция)</text>
<rect class="bx" x="8" y="92" width="96" height="24" rx="5"/><text class="tx" x="56" y="108" text-anchor="middle">PE ↔ PE</text><text class="sm" x="112" y="108">iBGP Established, RT едет</text>
<rect class="bx" x="8" y="120" width="96" height="24" rx="5"/><text class="tx" x="56" y="136" text-anchor="middle">импорт</text><text class="sm" x="112" y="136">RT совпал — маршрут в VRF</text>
<rect class="bx" x="8" y="148" width="96" height="24" rx="5"/><text class="tx" x="56" y="164" text-anchor="middle">PE → CE</text><text class="sm" x="112" y="164">дальний CE принял маршрут</text>
<rect class="bx" x="8" y="176" width="96" height="24" rx="5"/><text class="tx" x="56" y="192" text-anchor="middle">пакеты</text><text class="sm" x="112" y="192">LSP до PE, MTU, обратный путь</text>
<rect x="5" y="33" width="102" height="30" rx="7" fill="none" stroke="#2563eb" stroke-width="2.6"><animate attributeName="y" dur="18s" repeatCount="indefinite" values="33;33;61;89;117;117;33;33;61;61;33;33;61;89;117;145;145" keyTimes="0;0.04;0.07;0.1;0.13;0.329;0.33;0.37;0.4;0.659;0.66;0.7;0.73;0.76;0.79;0.82;1"/></rect>
<g opacity="0"><text class="sm rd" x="160" y="222" text-anchor="middle">Маршрут пришёл на PE2 с RT 64500:1, но в VRF A</text><text class="sm rd" x="160" y="238" text-anchor="middle">его не взяли: import другой. Сравни RT</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.14;0.15;0.32;0.33;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="222" text-anchor="middle">Маршрут есть в VRF B на PE1, но в BGP его нет:</text><text class="sm rd" x="160" y="238" text-anchor="middle">нужен redistribute static в ipv4 vrf B</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.41;0.42;0.65;0.66;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="222" text-anchor="middle">PE2 отдал маршрут, а A2 отбросил его: своя AS</text><text class="sm rd" x="160" y="238" text-anchor="middle">в AS_PATH. Нужен as-override (раздел 9)</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.83;0.84;1"/></g>
</svg><figcaption>Синяя рамка поднимается по шагам пути маршрута. Каждая поломка останавливает её на своём шаге: опечатка в RT — на импорте, забытая редистрибуция — ещё до BGP, одинаковая AS у офисов — на последнем шаге перед CE.</figcaption></figure>
<h3>Порядок действий</h3>
<ol class="steps"><li><b>На своём PE.</b> <code>show ip route vrf A</code> — есть ли сеть своего офиса? Если клиент на BGP или OSPF — поднят ли сосед в VRF (<code>show bgp vpnv4 unicast vrf A summary</code>, <code>show ip ospf neighbor</code>).</li>
<li><b>Попала ли сеть в BGP.</b> <code>show bgp vpnv4 unicast vrf A</code> на своём PE. Для статики и OSPF нет строки — значит, нет редистрибуции.</li>
<li><b>Сессия между PE.</b> <code>show bgp vpnv4 unicast all summary</code>: число в последнем столбце, а не Idle/Active.</li>
<li><b>Пришло ли на дальний PE.</b> <code>show bgp vpnv4 unicast all 10.1.1.0</code> на PE2: есть ли маршрут и какой у него RT. Нет RT вовсе — пропал send-community extended. RT есть, а в VRF маршрута нет — сравни с import в <code>show vrf detail A</code>.</li>
<li><b>Дошло ли до дальнего CE.</b> <code>show ip bgp</code> или <code>show ip route</code> на CE (или спроси клиента). eBGP с одной AS у офисов — as-override.</li>
<li><b>Пакеты.</b> Транспорт до next-hop (<code>ping mpls ipv4</code>, глава 10), MTU с двумя метками, и <b>обратный путь</b>: всё то же самое в другую сторону.</li></ol>
<div class="callout pro"><b>Проверяй обе стороны</b>«Офис 1 не видит офис 2» часто значит, что маршрут офиса 2 доходит до офиса 1, а маршрут офиса 1 до офиса 2 — нет. Пакет туда уходит, ответ вернуться не может. Поэтому шаги 1–5 проходят для сетей <b>обоих</b> офисов. А пингуют с PE так: <code>ping vrf A 10.1.2.1 source 172.30.1.1</code> — с адреса из VRF клиента.</div>
<div class="callout lab"><b>В лабе</b>Поломка 1: опечатка в import RT. Поломка 2: пропал send-community extended — сессия жива, а маршрутов VPN нет. Поломка 4: MTU 1500 в ядре — маленькие пинги ходят, большие пакеты нет. Каждую находи по этим шагам, не глядя в команду поломки. <a href="#/c/ch11/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: на PE2 маршрут 10.1.1.0 есть в show bgp vpnv4 unicast all, но в VRF A его нет. Что проверишь?</summary><p>RT маршрута и import RT VRF A на PE2. Если они не совпадают, маршрут не импортируется.</p></details>
<details class="chk"><summary>Проверь себя: iBGP между PE Established, а маршрутов VPN на PE1 нет ни одного. Что подозреваешь?</summary><p>Маршруты приходят без RT: не передаётся extended community (нет send-community extended). Ни один VRF их не принимает.</p></details>
<details class="chk"><summary>Проверь себя: почему при заявке «офис не видит офис» нужно проверить обе стороны?</summary><p>Пакету нужен путь туда и обратно. Если маршрут дошёл только в одну сторону, запрос уходит, а ответ не возвращается.</p></details>`},

{h:'Общий сервис и другие схемы через RT', html:`
<h3>Один сервис для многих клиентов</h3>
<p>Провайдер хочет дать всем корпоративным клиентам свой DNS-сервер, систему мониторинга или выход в облако. Сервис стоит в своём VRF SVC. Нужно, чтобы клиенты видели сервис, сервис видел клиентов, а клиенты друг друга — нет. Делается это одними RT:</p>
<ul><li>VRF SVC экспортирует RT 64500:100. VRF A и VRF B его <b>импортируют</b> — видят сервис.</li>
<li>VRF SVC импортирует 64500:1 и 64500:2 — видит обоих клиентов.</li>
<li>VRF A не импортирует 64500:2, а VRF B — 64500:1. Клиенты друг друга не видят.</li></ul>
<p>Такая схема называется <b>extranet</b>, а схема в целом — «общий сервис» (shared services).</p>
<figure class="dg"><svg viewBox="0 0 320 222" role="img" aria-label="VRF SVC импортирует RT клиентов, клиенты импортируют RT сервиса; одинаковые сети клиентов конфликтуют в VRF SVC">
<rect x="10" y="24" width="110" height="52" rx="6" fill="rgba(37,99,235,.12)" stroke="#2563eb" stroke-width="1.4"/><text class="sm bt" x="18" y="40">VRF A</text><text class="sm" x="18" y="54">export 64500:1</text><text class="sm" x="18" y="68">import 1, 100</text>
<rect x="10" y="118" width="110" height="52" rx="6" fill="rgba(22,163,74,.12)" stroke="#16a34a" stroke-width="1.4"/><text class="sm gn" x="18" y="134">VRF B</text><text class="sm" x="18" y="148">export 64500:2</text><text class="sm" x="18" y="162">import 2, 100</text>
<rect x="200" y="70" width="112" height="52" rx="6" fill="rgba(217,119,6,.12)" stroke="#d97706" stroke-width="1.4"/><text class="sm og" x="208" y="86">VRF SVC (DNS)</text><text class="sm" x="208" y="100">export 64500:100</text><text class="sm" x="208" y="114">import 1, 2, 100</text>
<path class="ln" d="M120 50 L200 90 M120 144 L200 104"/>
<g opacity="0"><rect x="-28" y="-7" width="56" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">RT 100</text><animateMotion dur="14s" repeatCount="indefinite" path="M200 90 L120 50" keyPoints="0;0;1;1" keyTimes="0;0.05;0.22;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.24;0.25;1"/></g>
<g opacity="0"><rect x="-28" y="-7" width="56" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">RT 100</text><animateMotion dur="14s" repeatCount="indefinite" path="M200 104 L120 144" keyPoints="0;0;1;1" keyTimes="0;0.05;0.22;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.24;0.25;1"/></g>
<g opacity="0"><rect x="-30" y="-7" width="60" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">A: 10.1.1.0</text><animateMotion dur="14s" repeatCount="indefinite" path="M120 50 L200 90" keyPoints="0;0;1;1" keyTimes="0;0.3;0.47;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.29;0.3;0.48;0.49;1"/></g>
<g opacity="0"><rect x="-30" y="-7" width="60" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">B: 10.1.1.0</text><animateMotion dur="14s" repeatCount="indefinite" path="M120 144 L200 104" keyPoints="0;0;1;1" keyTimes="0;0.3;0.47;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.29;0.3;0.48;0.49;1"/></g>
<g><text class="sm" x="160" y="196" text-anchor="middle">Клиенты получают маршрут к сервису, сервис —</text><text class="sm" x="160" y="212" text-anchor="middle">маршруты клиентов. A и B друг друга не видят</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.52;0.53;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="196" text-anchor="middle">Но у A и B одинаковая 10.1.1.0/24: в VRF SVC</text><text class="sm rd" x="160" y="212" text-anchor="middle">попадёт одна из двух — ответ получит только один клиент</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.53;0.54;1"/></g>
</svg><figcaption>Оранжевая наклейка — маршрут сервиса с RT 64500:100, его импортируют оба клиента. Синяя и зелёная — сети клиентов, их импортирует VRF SVC. В конце видна главная проблема общего сервиса: одинаковые сети разных клиентов в одной таблице сервиса снова конфликтуют.</figcaption></figure>
<h3>Ловушка: одинаковые адреса возвращаются</h3>
<p>В VRF SVC сходятся маршруты всех клиентов, и здесь снова встречаются две одинаковые сети 10.1.1.0/24 от A и от B. В BGP они разные (разные RD), а в таблице VRF SVC сеть может быть только одна. Сервис будет отвечать только одному из клиентов.</p>
<p>Правильное решение: клиенты отдают в общий сервис не все свои сети, а только <b>уникальные адреса</b>, которые провайдер выдал им специально для сервиса (или прячут за NAT). На PE это делается с помощью <b>export map</b>: ярлык 64500:100 вешается только на эти адреса. Это задание 7 в лабе.</p>
<h3>Другие схемы</h3>
<ul><li><b>Центр — филиалы</b> (hub-and-spoke). Филиалы видят только центральный офис, а друг с другом общаются через него (например, через межсетевой экран в центре). Делается двумя RT: центр экспортирует «HUB», филиалы — «SPOKE», каждый импортирует чужой. Это задание «Со звёздочкой» в лабе.</li>
<li><b>Доступ в интернет из VPN</b> — следующая глава 11.1.</li></ul>
<div class="callout pro"><b>RT — это политика</b>Через RT провайдер решает, кто кого видит. Поэтому в нормальной сети RT не придумывают на ходу, а ведут их таблицу: какой RT у какого клиента и сервиса. Ошибка в одном RT может соединить двух клиентов между собой, а это уже не просто авария, а утечка данных.</div>
<div class="callout lab"><b>В лабе</b>Задание 6: соберёшь общий сервис DNS для A и B и увидишь проблему одинаковых адресов в VRF SVC. Задание 7: исправишь её с помощью export map и уникальных адресов. <a href="#/c/ch11/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: как сделать, чтобы клиенты A и B видели общий сервис, но не видели друг друга?</summary><p>Сервис экспортирует свой RT, A и B его импортируют. Сервис импортирует RT обоих клиентов. При этом A не импортирует RT клиента B, и наоборот.</p></details>
<details class="chk"><summary>Проверь себя: почему одинаковые сети клиентов мешают общему сервису?</summary><p>В VRF сервиса обе сети попадают в одну таблицу, и там остаётся только одна. Сервис ответит только одному клиенту. Решение — отдавать в сервис уникальные адреса (export map, NAT).</p></details>`}
],
end: `<h3>Что ты теперь знаешь</h3>
<p>L3VPN — это провайдер в роли общего маршрутизатора офисов клиента. Каждого клиента на PE держат в отдельной таблице — VRF, поэтому одинаковые серые сети разных клиентов не мешают друг другу. Маршруты между PE передаёт iBGP по loopback'ам в семействе VPNv4: к сети приписывается RD, чтобы адрес стал уникальным, и вешается ярлык RT, по которому дальний PE решает, в какой VRF его положить. Вместе с маршрутом PE раздаёт метку VPN. Пакет едет через ядро с двумя метками, как в псевдопроводе: верхняя транспортная до PE, нижняя — метка VPN, по которой выходной PE находит VRF. Офис подключают статикой, OSPF или eBGP, а при одной AS на все офисы нужен as-override.</p>
<h3>Что из BGP ты уже знаешь</h3>
<table><tr><th>Понятие</th><th>Где было</th></tr>
<tr><td>Сессия по TCP 179, соседи вручную, iBGP и eBGP</td><td>раздел 2</td></tr>
<tr><td>Сессия между PE по loopback, update-source</td><td>раздел 2</td></tr>
<tr><td>Next-hop и рекурсивный поиск</td><td>разделы 2, 7</td></tr>
<tr><td>Правило iBGP и route reflector</td><td>раздел 2</td></tr>
<tr><td>Атрибуты: сеть, next-hop, AS_PATH, community</td><td>раздел 3</td></tr>
<tr><td>Семейства адресов, VPNv4, activate</td><td>раздел 3</td></tr>
<tr><td>Extended community и send-community</td><td>разделы 3, 6</td></tr>
<tr><td>Защита от петель по AS_PATH, as-override</td><td>раздел 9</td></tr></table>
<p>В главе 8 к этому добавятся выбор лучшего пути из нескольких (local-pref, AS_PATH, MED), BGP с другими операторами и интернет, фильтры и политики. Основа у тебя уже есть.</p>
<div class="callout ok"><b>Посмотри у себя на работе</b><ol><li>Найди на любом PE <code>show vrf</code>: сколько VRF и как они названы.</li><li>Выбери один VRF и посмотри <code>show ip route vrf ИМЯ</code> и <code>show vrf detail ИМЯ</code>: какие RD и RT.</li><li>Узнай, есть ли у вас route reflector и сколько их.</li></ol></div>
<p>Дальше по главе: карточки, тест (кнопка «🤷 Не знаю» на месте), «Объясни своими словами» и лаба — два клиента с одинаковыми адресами, общий сервис и четыре поломки.</p>`
};
