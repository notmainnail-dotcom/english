// Книжный текст главы 10 СДСМ (компьютер): базовый MPLS. Формат как у ch02–ch06, блоки .callout.lab ведут в лабу «BGP-free core».
// Стиль: от работы (ядро без BGP, «чёрная дыра», трафик клиента через P); одно понятие за раз; аналогии; «Проверь себя».
// Ученик уже читал историю MPLS и устройство метки (свой конспект MPLS.docx), поэтому упор на LDP, LIB/LFIB, PHP, TTL/MTU и диагностику.
// Факты: RFC 3031 (архитектура), RFC 3032 (метка, TTL, ICMP в LSP), RFC 5036 (LDP: UDP/TCP 646, 224.0.0.2), RFC 3443 (TTL),
// RFC 5443 (LDP-IGP sync), RFC 8029 (LSP ping), RFC 8402/8667 (Segment Routing, IS-IS); Cisco IOS: метки с 16, SRGB 16000–23999.
window.BOOK = window.BOOK || {};
BOOK.ch10 = {
title: 'Базовый MPLS',
lead: `<p>Через ядро твоего провайдера каждую секунду идут пакеты абонентов, корпоративных клиентов и интернета. При этом большинство маршрутизаторов ядра не знает ни одного маршрута абонентов и ни одного маршрута интернета. Как они тогда пересылают пакеты? Ответ — <b>MPLS</b>: пакет получает на входе в ядро метку, и дальше маршрутизаторы смотрят только на неё.</p>
<p>Историю MPLS и устройство метки по битам ты уже разбирал в своём конспекте, поэтому здесь они кратко. Главное в этой главе другое: как маршрутизаторы договариваются о метках (LDP), какую метку берёт каждый узел и почему, что происходит на последнем шаге, как ведут себя traceroute и MTU и, самое важное для смены, — <b>как найти, где порвался путь по меткам</b>.</p>
<p>Порядок прежний: раздел в день, анимации на паузу, «Проверь себя» в конце раздела, зелёные блоки ведут в лабу. Все примеры — на топологии лабы 10: клиент CE1 — PE1 — P1 — P2 — PE2 — клиент CE2, и обходной путь через P3. Книгу можно слушать: кнопка «🔊 Слушать».</p>`,
parts: [

{h:'Чёрная дыра: зачем ядру метки', html:`
<h3>Кто что знает в сети провайдера</h3>
<p>У провайдера два вида маршрутизаторов. <b>PE</b> (provider edge, граничный) стоит на краю сети: к нему подключены клиенты. <b>P</b> (provider, транзитный) стоит внутри ядра и соединяет только другие маршрутизаторы провайдера.</p>
<p>Маршруты у них тоже разные. Все знают адреса друг друга: loopback'и и линки ядра. Их разносит IGP — OSPF или IS-IS из главы 6. А сети клиентов и маршруты интернета разносит BGP (глава 8), и живут они только на PE. В интернете сейчас около миллиона маршрутов. Держать их на каждом P — значит покупать дорогие маршрутизаторы с огромной памятью и настраивать BGP на сотнях узлов.</p>
<p>Для этой главы из BGP нужна одна вещь. PE2 сообщает PE1: «сеть клиента 192.168.2.0/24 — у меня, шли на мой адрес 10.255.0.4». Этот адрес называется <b>next-hop</b>. Как дойти до 10.255.0.4, PE1 узнаёт уже из IGP: через P1. Поиск в два шага (сначала сеть клиента → next-hop, потом next-hop → сосед) называется <b>рекурсивным</b>.</p>
<h3>Что будет без MPLS</h3>
<p>PE1 всё правильно посчитал и отправил пакет клиента на 192.168.2.1 соседу P1. P1 смотрит в свою таблицу маршрутов: сети 192.168.2.0/24 там нет, ведь BGP на P1 не настроен. Пакет выброшен. Это называется <b>чёрной дырой</b> (black hole): BGP-сессия между PE в порядке, маршрут у PE1 есть, а трафик пропадает посередине.</p>
<figure class="dg"><svg viewBox="0 0 320 214" role="img" aria-label="Без MPLS пакет клиента пропадает на P1, с MPLS проходит по метке до PE2">
<path class="ln" d="M41 70 L59 70 M97 70 L115 70 M153 70 L171 70 M209 70 L227 70 M265 70 L281 70"/>
<path class="ln" d="M78 82 L146 128 M178 128 L246 82" style="stroke-dasharray:4 4"/>
<rect class="bx" x="3" y="58" width="38" height="24" rx="6"/><text class="tx" x="22" y="74" text-anchor="middle">CE1</text>
<rect class="bx" x="59" y="58" width="38" height="24" rx="6"/><text class="tx" x="78" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="115" y="58" width="38" height="24" rx="6"/><text class="tx" x="134" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="171" y="58" width="38" height="24" rx="6"/><text class="tx" x="190" y="74" text-anchor="middle">P2</text>
<rect class="bx" x="227" y="58" width="38" height="24" rx="6"/><text class="tx" x="246" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="281" y="58" width="38" height="24" rx="6"/><text class="tx" x="300" y="74" text-anchor="middle">CE2</text>
<rect class="bx" x="143" y="128" width="38" height="24" rx="6"/><text class="tx" x="162" y="144" text-anchor="middle">P3</text>
<text class="sm" x="60" y="100" text-anchor="middle">BGP+IGP</text><text class="sm" x="264" y="100" text-anchor="middle">BGP+IGP</text>
<text class="sm" x="162" y="100" text-anchor="middle">только IGP</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M22 46 L78 46 L134 46" keyPoints="0;0;1;1" keyTimes="0;0.03;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.26;0.27;1"/></g>
<g opacity="0"><path class="lr" d="M127 39 L141 53 M141 39 L127 53"/><text class="sm rd" x="134" y="30" text-anchor="middle">нет маршрута — выброшен</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.21;0.22;0.46;0.47;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M22 46 L78 46 L134 46 L190 46 L246 46 L300 46" keyPoints="0;0;1;1" keyTimes="0;0.52;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.51;0.52;0.95;1"/></g>
<g opacity="0"><rect x="-16" y="-20" width="32" height="12" rx="3" class="pu"/><text class="wt" x="0" y="-11" text-anchor="middle">к PE2</text><animateMotion dur="16s" repeatCount="indefinite" path="M78 46 L134 46 L190 46 L246 46" keyPoints="0;0;1;1" keyTimes="0;0.59;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.58;0.59;0.8;0.81;1"/></g>
<g><text class="sm" x="160" y="182" text-anchor="middle">Без MPLS: PE1 шлёт пакет на 192.168.2.1 в P1,</text><text class="sm rd" x="160" y="196" text-anchor="middle">а P1 о сетях клиентов ничего не знает</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.49;0.5;1"/></g>
<g opacity="0"><text class="sm" x="160" y="182" text-anchor="middle">С MPLS: PE1 вешает метку «к PE2», P1 и P2</text><text class="sm gn" x="160" y="196" text-anchor="middle">читают только её, адрес клиента им не нужен</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Топология лабы 10. На PE есть и BGP (сети клиентов), и IGP (адреса ядра). На P — только IGP. Фиолетовая наклейка — метка: она означает «довези до PE2», и для этого P1 и P2 достаточно знать дорогу до loopback PE2.</figcaption></figure>
<h3>Идея MPLS</h3>
<p>Выход простой: PE1 перед отправкой в ядро наклеивает на пакет <b>метку</b> (label), которая означает «довезти до PE2». Маршрутизаторы ядра смотрят только на метку и пересылают пакет туда, где лежит PE2. Дорогу до PE2 они знают: это loopback из IGP. А что внутри пакета, им неважно. На PE2 метка снимается, и PE2 сам решает, какому клиенту отдать пакет. Ядро, в котором P работают без BGP, называется <b>BGP-free core</b>.</p>
<div class="an"><b>Аналогия</b>Почта. Письмо в Хабаровск в Москве кладут в мешок с биркой «Хабаровск». Все сортировочные центры по дороге читают только бирку на мешке, а не адрес на каждом конверте. Улицу и дом смотрят уже в Хабаровске, когда мешок открыли. Бирка — это метка, мешок — путь через ядро, Хабаровск — PE2.</div>
<div class="callout pro"><b>Скорость — уже не главное</b>В твоём конспекте MPLS придумали, чтобы ускорить пересылку: найти метку в таблице проще, чем самый длинный подходящий префикс. В 1990-х так и было. Сегодня микросхемы маршрутизаторов ищут IP-префиксы так же быстро, и MPLS ценят за другое: ядро без BGP, VPN для корпоративных клиентов (главы 11–12), управление путями трафика (глава 13) и быстрый обход аварий. На собеседовании ответ «MPLS быстрее IP» сейчас считается устаревшим.</div>
<div class="callout lab"><b>В лабе</b>Задание 1: сначала соберёшь BGP между PE без MPLS и своими глазами увидишь чёрную дыру: маршрут у CE1 есть, а пинг до CE2 умирает на P1. На P1 убедишься, что маршрута к 192.168.2.1 нет. <a href="#/c/ch10/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что знает P, а что — PE?</summary><p>P знает только маршруты ядра из IGP: loopback'и и линки. PE знает их же плюс сети клиентов и интернета из BGP.</p></details>
<details class="chk"><summary>Проверь себя: почему без MPLS пакет клиента пропадает на P1, хотя у PE1 маршрут есть?</summary><p>PE1 пересылает пакет с адресом клиента соседу P1. У P1 нет BGP и нет маршрута к сети клиента, поэтому пакет выбрасывается.</p></details>
<details class="chk"><summary>Проверь себя: что такое next-hop в BGP и как PE1 находит до него дорогу?</summary><p>Next-hop — адрес PE, за которым находится сеть (здесь loopback PE2, 10.255.0.4). Дорогу до него PE1 находит в таблице IGP: через P1.</p></details>`},

{h:'Метка: короткое напоминание', html:`
<h3>Что такое метка</h3>
<p>Метка MPLS — это 4 байта (32 бита), которые вставляются между заголовком Ethernet и заголовком IP. Поэтому MPLS иногда называют «уровнем 2,5». В заголовке Ethernet при этом меняется поле типа: вместо 0x0800 (IPv4) там 0x8847 (MPLS), чтобы получатель знал, что дальше идёт метка, а не IP.</p>
<figure class="dg"><svg viewBox="0 0 320 196" role="img" aria-label="Метка MPLS между Ethernet и IP, её поля и стек из двух меток">
<rect x="6" y="26" width="70" height="30" rx="4" class="gr"/><text class="wt2" x="41" y="45" text-anchor="middle">Ethernet</text>
<rect x="78" y="26" width="58" height="30" rx="4" class="pu"/><text class="wt2" x="107" y="45" text-anchor="middle">метка</text>
<rect x="138" y="26" width="58" height="30" rx="4" class="b"/><text class="wt2" x="167" y="45" text-anchor="middle">IP</text>
<rect x="198" y="26" width="116" height="30" rx="4" class="bx"/><text class="sm" x="256" y="45" text-anchor="middle">данные</text>
<text class="sm" x="41" y="18" text-anchor="middle">тип 0x8847</text>
<path class="ln" d="M78 60 L6 84 M136 60 L314 84" style="stroke-width:1.2"/>
<rect x="6" y="86" width="190" height="26" rx="3" class="pu" opacity="0.85"/><text class="wt2" x="101" y="103" text-anchor="middle">Label — 20 бит</text>
<rect x="198" y="86" width="40" height="26" rx="3" class="o"/><text class="wt2" x="218" y="103" text-anchor="middle">TC 3</text>
<rect x="240" y="86" width="20" height="26" rx="3" class="g"/><text class="wt2" x="250" y="103" text-anchor="middle">S</text>
<rect x="262" y="86" width="52" height="26" rx="3" class="gr"/><text class="wt2" x="288" y="103" text-anchor="middle">TTL 8</text>
<text class="sm" x="8" y="128">Label — номер метки (0–1 048 575)</text>
<text class="sm" x="8" y="142">TC — класс трафика для QoS (раньше EXP)</text>
<text class="sm" x="8" y="156">S — «последняя в стопке»: 1 у нижней метки</text>
<text class="sm" x="8" y="170">TTL — счётчик прыжков, как в IP</text>
<g opacity="0"><text class="sm og" x="8" y="190">Меток может быть несколько — это стек; у нижней S = 1</text><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.4;0.41;1"/></g>
</svg><figcaption>Метка стоит между Ethernet и IP. Внизу — четыре поля метки. Стек меток понадобится для VPN: в главе 11 их будет две.</figcaption></figure>
<p>Меток на пакете может быть несколько, одна над другой. Это <b>стек меток</b> (label stack). Маршрутизатор всегда работает только с верхней меткой. Бит S показывает, что метка последняя в стеке и под ней уже IP. Зачем стек, станет понятно в последнем разделе: одна метка везёт пакет через ядро, другая говорит PE2, какому клиенту его отдать.</p>
<p>Несколько номеров меток зарезервированы (0–15). Запомни два:</p>
<ul><li><b>3 — implicit null</b> («неявный ноль»). Такую метку никогда не увидишь на проводе: это сигнал соседу «перед отправкой мне сними метку». Подробно — в разделе 6.</li>
<li><b>0 — explicit null</b> («явный ноль»): метка доходит до последнего маршрутизатора, но ничего не значит, кроме «под ней IPv4». Нужна, чтобы довезти поле TC для QoS.</li></ul>
<p>У Cisco обычные метки начинаются с 16, поэтому в выводах ты будешь видеть числа вроде 16, 18, 22, 24.</p>

<details class="chk"><summary>Проверь себя: где в кадре стоит метка и что меняется в заголовке Ethernet?</summary><p>Между заголовком Ethernet и заголовком IP. Тип в Ethernet меняется с 0x0800 на 0x8847.</p></details>
<details class="chk"><summary>Проверь себя: зачем бит S?</summary><p>Он показывает, что метка последняя в стеке и под ней начинается IP-пакет (или другой полезный груз).</p></details>
<details class="chk"><summary>Проверь себя: можно ли увидеть метку 3 в захвате трафика?</summary><p>Нет. Метка 3 (implicit null) — только сигнал в LDP «сними метку перед отправкой мне». На провод она не попадает.</p></details>`},

{h:'Три действия с меткой и путь LSP', html:`
<h3>Push, swap, pop</h3>
<p>С меткой маршрутизатор делает одно из трёх действий:</p>
<ul><li><b>push</b> — наклеить метку. Это делает входной PE, когда пакет заходит в ядро.</li>
<li><b>swap</b> — заменить метку на другую. Это делает каждый P по дороге.</li>
<li><b>pop</b> — снять метку. Её снимает последний или предпоследний маршрутизатор пути.</li></ul>
<p>Почему метка меняется на каждом шаге? Потому что метка — это договорённость только между двумя соседями. Метку выбирает тот, кто будет её <b>получать</b>: P1 говорит соседям «пакеты для PE2 присылайте мне с меткой 18». У P2 своя нумерация, и он попросил метку 22. Поэтому P1, получив 18, отправляет дальше уже с 22.</p>
<figure class="dg"><svg viewBox="0 0 320 168" role="img" aria-label="Пакет CE1 → CE2: PE1 вешает метку 18, P1 меняет на 22, P2 снимает, PE2 ищет IP">
<path class="ln" d="M41 70 L59 70 M97 70 L115 70 M153 70 L171 70 M209 70 L227 70 M265 70 L281 70"/>
<rect class="bx" x="3" y="58" width="38" height="24" rx="6"/><text class="tx" x="22" y="74" text-anchor="middle">CE1</text>
<rect class="bx" x="59" y="58" width="38" height="24" rx="6"/><text class="tx" x="78" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="115" y="58" width="38" height="24" rx="6"/><text class="tx" x="134" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="171" y="58" width="38" height="24" rx="6"/><text class="tx" x="190" y="74" text-anchor="middle">P2</text>
<rect class="bx" x="227" y="58" width="38" height="24" rx="6"/><text class="tx" x="246" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="281" y="58" width="38" height="24" rx="6"/><text class="tx" x="300" y="74" text-anchor="middle">CE2</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M22 46 L300 46" keyPoints="0;0;0.2014;0.2014;0.4029;0.4029;0.6043;0.6043;0.8058;0.8058;1;1" keyTimes="0;0.03;0.12;0.15;0.27;0.3;0.42;0.45;0.57;0.6;0.7;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.72;0.73;1"/></g>
<g opacity="0"><rect x="-12" y="-21" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-12" text-anchor="middle">18</text><animateMotion dur="14s" repeatCount="indefinite" path="M78 46 L134 46" keyPoints="0;0;1;1" keyTimes="0;0.15;0.27;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.13;0.14;0.285;0.29;1"/></g>
<g opacity="0"><rect x="-12" y="-21" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-12" text-anchor="middle">22</text><animateMotion dur="14s" repeatCount="indefinite" path="M134 46 L190 46" keyPoints="0;0;1;1" keyTimes="0;0.3;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.285;0.29;0.435;0.44;1"/></g>
<g opacity="0"><text class="sm bt" x="78" y="100" text-anchor="middle">push 18</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.13;0.14;1"/></g>
<g opacity="0"><text class="sm bt" x="134" y="100" text-anchor="middle">swap 18→22</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.28;0.29;1"/></g>
<g opacity="0"><text class="sm bt" x="190" y="100" text-anchor="middle">pop</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.43;0.44;1"/></g>
<g opacity="0"><text class="sm bt" x="246" y="100" text-anchor="middle">поиск по IP</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.58;0.59;1"/></g>
<g opacity="0"><text class="sm" x="160" y="134" text-anchor="middle">LSP «до PE2»: PE1 → P1 → P2 → PE2.</text><text class="sm" x="160" y="150" text-anchor="middle">Обратно пакеты идут по другому LSP — «до PE1»</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.74;0.75;1"/></g>
</svg><figcaption>Фиолетовая наклейка — метка. PE1 наклеивает 18 (её попросил P1), P1 меняет на 22 (её попросил P2), P2 метку снимает (почему не PE2 — раздел 6), PE2 смотрит IP-адрес и отдаёт пакет клиенту.</figcaption></figure>
<div class="an"><b>Аналогия</b>В каждом сортировочном центре своя нумерация ячеек. Центр в Новосибирске сказал Москве: «мешки для Хабаровска кладите мне в ячейку 18». Новосибирск, получив мешок из ячейки 18, перекладывает его в ячейку 22, потому что так попросил следующий центр, Красноярск. Номер ячейки имеет смысл только для пары соседних центров.</div>
<h3>Роли и путь</h3>
<ul><li><b>LSR</b> (label switching router) — любой маршрутизатор, который умеет работать с метками. Транзитные P — это LSR.</li>
<li><b>LER</b> (label edge router) — граничный: наклеивает метку на входе или снимает на выходе. Это PE.</li>
<li><b>LSP</b> (label switched path) — путь пакета по меткам от входного PE до выходного. Важно: <b>LSP работает в одну сторону</b>. Для ответов от CE2 к CE1 строится свой LSP — «до PE1», со своими метками.</li>
<li><b>FEC</b> (forwarding equivalence class) — группа пакетов, которые пересылаются одинаково. В базовом MPLS это просто адрес назначения в ядре: все пакеты «до PE2» — один FEC, и у них одна метка, какой бы клиент их ни отправил.</li></ul>
<div class="callout pro"><b>Что видит инженер на P</b>На P-маршрутизаторе таблица маршрутов маленькая: loopback'и и линки ядра. Зато в таблице меток (LFIB) — по строке на каждый loopback PE. Если тебе на P говорят «не видно маршрута к клиенту» — это нормально, его там и не должно быть. Проверять надо метки до PE, за которым клиент.</div>

<details class="chk"><summary>Проверь себя: какое действие с меткой делает входной PE, а какое — транзитный P?</summary><p>Входной PE наклеивает метку (push). Транзитный P меняет её на метку следующего соседа (swap).</p></details>
<details class="chk"><summary>Проверь себя: почему метка меняется на каждом шаге?</summary><p>Метку назначает получатель, и она действует только между двумя соседями. У каждого маршрутизатора своя нумерация.</p></details>
<details class="chk"><summary>Проверь себя: CE2 отвечает CE1. По какому LSP идёт ответ?</summary><p>По другому LSP — «до PE1», со своими метками. LSP однонаправленный.</p></details>`},

{h:'LDP: как маршрутизаторы договариваются о метках', html:`
<h3>Метки раздаёт отдельный протокол</h3>
<p>OSPF и IS-IS находят пути, но меток не раздают. Для этого есть <b>LDP</b> (label distribution protocol, протокол распределения меток). Он ничего не считает и путей не выбирает. Его работа: для каждого маршрута, который уже есть в IGP, выбрать свою метку и сообщить её соседям.</p>
<h3>Соседство LDP</h3>
<p>Как и в OSPF, сначала надо найти соседей:</p>
<ol class="steps"><li><b>Hello</b>. На каждом интерфейсе с MPLS маршрутизатор раз в 5 секунд шлёт LDP Hello: UDP, порт 646, на групповой адрес 224.0.0.2 («все маршрутизаторы на линке»). Если 15 секунд Hello нет, сосед считается пропавшим.</li>
<li><b>Сессия TCP</b>. Найдя соседа, маршрутизаторы открывают между собой соединение TCP на порт 646. Открывает его не адрес интерфейса, а <b>transport address</b> — обычно loopback, равный LDP router-id. Значит, <b>до loopback соседа должен быть маршрут в IGP</b>, иначе Hello видно, а сессии нет.</li>
<li><b>Обмен метками</b>. Когда сессия поднялась, соседи рассылают друг другу свои метки.</li></ol>
<pre class="cli">P1#show mpls ldp neighbor
    Peer LDP Ident: 10.255.0.3:0; Local LDP Ident 10.255.0.2:0
        TCP connection: 10.255.0.3.646 - 10.255.0.2.38719
        State: [[Oper]]; Msgs sent/rcvd: 52/51; Downstream
        Up time: 00:35:12
        LDP discovery sources:
          GigabitEthernet0/2, Src IP addr: 10.1.23.1</pre>
<p><b>Peer LDP Ident</b> — router-id соседа, <b>State: Oper</b> — сессия работает, <b>TCP connection</b> — между какими адресами открыт TCP. Если в выводе <code>show mpls ldp discovery</code> сосед есть, а в <code>show mpls ldp neighbor</code> его нет, — проблема на шаге 2: нет маршрута до transport address или TCP 646 режет ACL.</p>
<h3>Метки идут навстречу трафику</h3>
<p>Возьмём FEC «loopback PE2, 10.255.0.4/32». PE2 — его хозяин, поэтому он говорит соседям: «для 10.255.0.4 присылайте мне пакеты <b>без метки</b>» (метка 3, implicit null). P2 выбирает свою метку 22 и рассылает её <b>всем</b> своим LDP-соседям: «для 10.255.0.4 — мне с меткой 22». P1 выбирает 18 и тоже рассылает всем. P3 выбирает 24. Метки расходятся от PE2 к PE1 — навстречу трафику, который потом поедет от PE1 к PE2.</p>
<figure class="dg"><svg viewBox="0 0 320 214" role="img" aria-label="LDP: метки для loopback PE2 расходятся от PE2 к PE1 навстречу трафику">
<path class="ln" d="M97 70 L115 70 M153 70 L171 70 M209 70 L227 70"/>
<path class="ln" d="M78 82 L146 128 M178 128 L246 82"/>
<rect class="bx" x="59" y="58" width="38" height="24" rx="6"/><text class="tx" x="78" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="115" y="58" width="38" height="24" rx="6"/><text class="tx" x="134" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="171" y="58" width="38" height="24" rx="6"/><text class="tx" x="190" y="74" text-anchor="middle">P2</text>
<rect class="bx" x="227" y="58" width="38" height="24" rx="6"/><text class="tx" x="246" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="143" y="128" width="38" height="24" rx="6"/><text class="tx" x="162" y="144" text-anchor="middle">P3</text>
<text class="sm" x="246" y="44" text-anchor="middle">10.255.0.4</text>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="3" text-anchor="middle">3</text><animateMotion dur="14s" repeatCount="indefinite" path="M246 50 L190 50" keyPoints="0;0;1;1" keyTimes="0;0.05;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.2;0.21;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="3" text-anchor="middle">3</text><animateMotion dur="14s" repeatCount="indefinite" path="M236 96 L178 118" keyPoints="0;0;1;1" keyTimes="0;0.05;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.2;0.21;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="3" text-anchor="middle">22</text><animateMotion dur="14s" repeatCount="indefinite" path="M190 50 L134 50" keyPoints="0;0;1;1" keyTimes="0;0.25;0.4;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.4;0.41;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">22</text><animateMotion dur="14s" repeatCount="indefinite" path="M190 50 L246 50" keyPoints="0;0;1;1" keyTimes="0;0.25;0.4;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.4;0.41;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="3" text-anchor="middle">18</text><animateMotion dur="14s" repeatCount="indefinite" path="M134 50 L78 50" keyPoints="0;0;1;1" keyTimes="0;0.45;0.6;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.44;0.45;0.6;0.61;1"/></g>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="3" text-anchor="middle">24</text><animateMotion dur="14s" repeatCount="indefinite" path="M146 118 L88 96" keyPoints="0;0;1;1" keyTimes="0;0.45;0.6;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.44;0.45;0.6;0.61;1"/></g>
<g opacity="0"><text class="sm og" x="268" y="104" text-anchor="middle">«мне без метки»</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.04;0.05;1"/></g>
<g opacity="0"><text class="sm og" x="190" y="100" text-anchor="middle">моя 22</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.21;0.22;1"/></g>
<g opacity="0"><text class="sm og" x="200" y="146">моя 24</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.21;0.22;1"/></g>
<g opacity="0"><text class="sm og" x="134" y="100" text-anchor="middle">моя 18</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.41;0.42;1"/></g>
<g opacity="0"><text class="sm" x="160" y="178" text-anchor="middle">Метки для 10.255.0.4 разошлись от PE2 к PE1.</text><text class="sm gn" x="160" y="194" text-anchor="middle">Трафик поедет обратно: PE1 → PE2</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.64;0.65;1"/></g>
</svg><figcaption>Каждый выбирает свою метку для loopback PE2 и рассылает её всем LDP-соседям, в том числе «назад» (серая 22 от P2 к PE2 никому не пригодится, но рассылается). PE1 получил сразу две метки: 18 от P1 и 24 от P3. Какую он возьмёт — следующий раздел.</figcaption></figure>
<p>Обрати внимание: метка рассылается всем соседям, а не только тем, кто стоит «до» на пути. Маршрутизатор не знает заранее, кто будет слать ему трафик, поэтому сообщает всем. У Cisco метки по умолчанию раздаются для всех маршрутов IGP; провайдеры часто ограничивают их только адресами /32 — loopback'ами PE, потому что трафик едет только к ним.</p>
<div class="callout pro"><b>LDP router-id = Loopback0</b>Как и в OSPF, router-id LDP задают явно: <code>mpls ldp router-id Loopback0 force</code>. Если он случайно станет адресом, которого нет в IGP (например, служебного loopback), соседи увидят Hello, но TCP-сессия не откроется. Это поломка 2 в лабе.</div>
<div class="callout lab"><b>В лабе</b>Задание 2: включишь LDP на всех P и PE (на PE — только в сторону ядра, не к клиенту!), увидишь соседей в состоянии Oper, и пинг CE1 → CE2 заработает. Поломка 2: LDP router-id не анонсирован в IGP — найди её по <code>show mpls ldp discovery detail</code>. <a href="#/c/ch10/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: LDP выбирает путь до PE2?</summary><p>Нет. Путь выбирает IGP. LDP только раздаёт метки для маршрутов, которые уже есть в IGP.</p></details>
<details class="chk"><summary>Проверь себя: Hello LDP от соседа видно, а сессии нет. Где искать?</summary><p>TCP 646 открывается между transport address (обычно loopback). Проверь, есть ли маршрут до loopback соседа в IGP и не режет ли TCP 646 ACL.</p></details>
<details class="chk"><summary>Проверь себя: в какую сторону идут метки и в какую — трафик?</summary><p>Метки для FEC «до PE2» расходятся от PE2 к остальным. Трафик потом идёт в обратную сторону — к PE2.</p></details>`},

{h:'LIB и LFIB: какую метку взять', html:`
<h3>Две таблицы меток</h3>
<p>PE1 получил для loopback PE2 две метки: 18 от P1 и 24 от P3. Обе он хранит в <b>LIB</b> (label information base, база меток) — это все метки, которые ему прислали соседи, плюс его собственные. Хранить всё, даже ненужное сейчас, называется <b>liberal retention</b> («щедрое хранение»).</p>
<p>А для пересылки нужна одна метка. Её выбирают просто: <b>метку того соседа, через которого идёт лучший путь по IGP</b>. Путь через P1 стоит 30, через P3 — 100, значит, работает метка 18 от P1. Она попадает в <b>LFIB</b> (label forwarding information base) — рабочую таблицу пересылки по меткам. LIB — это все варианты, LFIB — выбранные.</p>
<pre class="cli">PE1#show mpls ldp bindings 10.255.0.4 32
  lib entry: 10.255.0.4/32, rev 14
        local binding:  label: 20
        remote binding: lsr: [[10.255.0.2:0, label: 18]]        ! от P1
        remote binding: lsr: 10.255.0.5:0, label: 24        ! от P3
PE1#show mpls forwarding-table 10.255.0.4 32
Local      Outgoing   Prefix           Bytes Label   Outgoing   Next Hop
Label      Label      or Tunnel Id     Switched      interface
20         [[18]]         10.255.0.4/32    0             Gi0/1      10.1.12.1</pre>
<p>В LFIB три главных столбца. <b>Local Label</b> — метка, которую этот маршрутизатор сам назначил (с ней пакеты для PE2 приходят к нему от других). <b>Outgoing Label</b> — что он ставит при отправке. <b>Next Hop</b> — кому отправляет. Вместо числа в Outgoing Label бывают слова:</p>
<ul><li><b>Pop Label</b> — снять метку и отправить (так делает предпоследний маршрутизатор, раздел 6);</li>
<li><b>No Label</b> (на старых версиях «Untagged») — соседа с меткой нет, пакет уходит без метки, обычным IP. В ядре без BGP это почти всегда авария.</li></ul>
<h3>Почему переключение мгновенное</h3>
<figure class="dg"><svg viewBox="0 0 320 222" role="img" aria-label="При обрыве линка PE1–P1 PE1 сразу берёт из LIB метку 24 от P3">
<path class="ln" d="M153 70 L171 70 M209 70 L227 70"/><path class="ln" d="M78 82 L146 128 M178 128 L246 82"/>
<path class="ln" d="M97 70 L115 70"><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0.25;0.25" keyTimes="0;0.47;0.48;1"/></path>
<g opacity="0"><path class="lr" d="M99 63 L113 77 M113 63 L99 77"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.47;0.48;1"/></g>
<rect class="bx" x="59" y="58" width="38" height="24" rx="6"/><text class="tx" x="78" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="115" y="58" width="38" height="24" rx="6"/><text class="tx" x="134" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="171" y="58" width="38" height="24" rx="6"/><text class="tx" x="190" y="74" text-anchor="middle">P2</text>
<rect class="bx" x="227" y="58" width="38" height="24" rx="6"/><text class="tx" x="246" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="143" y="128" width="38" height="24" rx="6"/><text class="tx" x="162" y="144" text-anchor="middle">P3</text>
<text class="sm" x="162" y="40" text-anchor="middle">путь 10+10+10 = 30</text><text class="sm" x="212" y="166">путь 50+50 = 100</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><rect x="-12" y="-21" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-12" text-anchor="middle">18</text><animateMotion dur="14s" repeatCount="indefinite" path="M78 46 L134 46" keyPoints="0;0;1;1" keyTimes="0;0.05;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.2;0.21;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><rect x="-12" y="-21" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-12" text-anchor="middle">24</text><animateMotion dur="14s" repeatCount="indefinite" path="M84 98 L148 118 L176 118 L240 98" keyPoints="0;0;1;1" keyTimes="0;0.55;0.88;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.88;0.89;1"/></g>
<text class="sm" x="8" y="186">LIB PE1 для 10.255.0.4/32:</text>
<text class="sm gn" x="8" y="200">от P1 — 18 → в LFIB<animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.47;0.48;1"/></text>
<g opacity="0"><text class="sm rd" x="8" y="200">от P1 — 18 → сосед пропал, метка удалена</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.47;0.48;1"/></g>
<text class="sm" x="8" y="214">от P3 — 24, хранится в запасе<animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.51;1"/></text>
<g opacity="0"><text class="sm gn" x="8" y="214">от P3 — 24 → в LFIB, сразу, без запросов</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Пока всё цело, работает метка от P1. Линк PE1–P1 оборвался: IGP пересчитал путь через P3, а метка 24 от P3 уже лежит в LIB. PE1 просто начинает её использовать.</figcaption></figure>
<p>Когда рвётся линк PE1–P1, IGP пересчитывает путь: теперь лучший сосед — P3. Метку от P3 не нужно запрашивать, она уже лежит в LIB благодаря щедрому хранению. LFIB обновляется сразу после IGP. Поэтому LDP почти не добавляет времени к сходимости.</p>
<div class="callout lab"><b>В лабе</b>Задание 4: найдёшь в LIB на PE1 обе метки для loopback PE2, выключишь линк PE1–P1 и увидишь, как LFIB переключается на метку P3. <a href="#/c/ch10/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: чем LIB отличается от LFIB?</summary><p>В LIB лежат все метки: свои и от всех соседей. В LFIB — только те, что реально используются для пересылки: метка соседа, через которого лучший путь IGP.</p></details>
<details class="chk"><summary>Проверь себя: в LFIB на PE1 для loopback PE2 написано «No Label». Что будет с пакетами клиентов?</summary><p>PE1 отправит их без метки, обычным IP. P1 не знает сетей клиентов и выбросит их — чёрная дыра.</p></details>
<details class="chk"><summary>Проверь себя: почему при обрыве линка PE1 не ждёт новых меток?</summary><p>Метка от запасного соседа уже лежит в LIB (liberal retention). Как только IGP выбрал новый путь, PE1 берёт её.</p></details>`},

{h:'PHP: почему метку снимает предпоследний', html:`
<h3>Лишняя работа на последнем шаге</h3>
<p>Представь, что метку снимает сам PE2. Пакет приходит к нему с меткой, PE2 ищет её в LFIB и видит «метка моя, снять». Сняв, он смотрит IP-адрес и ищет его в таблице маршрутов. Два поиска на один пакет, и так на каждом пакете, который выходит из ядра.</p>
<p>Поэтому придумали <b>PHP</b> (penultimate hop popping, «снятие на предпоследнем шаге»). PE2 объявляет для своего loopback метку 3 (implicit null): «присылайте мне без метки». P2, предпоследний на пути, снимает метку сам, и PE2 получает обычный IP-пакет. У PE2 остаётся один поиск — по IP.</p>
<pre class="cli">P2#show mpls forwarding-table 10.255.0.4 32
Local      Outgoing   Prefix           Bytes Label   Outgoing   Next Hop
Label      Label      or Tunnel Id     Switched      interface
22         [[Pop Label]]  10.255.0.4/32    1480          Gi0/1      10.1.34.1</pre>
<h3>Explicit null: когда метку нужно довезти</h3>
<p>У PHP есть минус: вместе с меткой исчезает поле TC — класс трафика для QoS. Если провайдер строит качество обслуживания на метках (глава 15), последнему маршрутизатору оно тоже нужно. Тогда PE2 объявляет не 3, а <b>0 — explicit null</b>. P2 ставит метку 0, PE2 видит в ней TC, снимает и смотрит IP. Это немного дороже, зато QoS не теряется.</p>
<figure class="dg"><svg viewBox="0 0 320 160" role="img" aria-label="PHP: P2 снимает метку; explicit null: до PE2 доходит метка 0">
<text class="sm" x="8" y="18">PHP (метка 3, по умолчанию)</text>
<path class="ln" d="M124 46 L196 46"/>
<rect class="bx" x="80" y="34" width="44" height="24" rx="6"/><text class="tx" x="102" y="50" text-anchor="middle">P2</text>
<rect class="bx" x="196" y="34" width="44" height="24" rx="6"/><text class="tx" x="218" y="50" text-anchor="middle">PE2</text>
<text class="sm" x="248" y="44">1 поиск:</text><text class="sm" x="248" y="58">по IP</text>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="6s" repeatCount="indefinite" path="M102 28 L218 28" keyPoints="0;0;1;1" keyTimes="0;0.1;0.6;1" calcMode="linear"/></g>
<text class="sm" x="8" y="96">Explicit null (метка 0)</text>
<path class="ln" d="M124 124 L196 124"/>
<rect class="bx" x="80" y="112" width="44" height="24" rx="6"/><text class="tx" x="102" y="128" text-anchor="middle">P2</text>
<rect class="bx" x="196" y="112" width="44" height="24" rx="6"/><text class="tx" x="218" y="128" text-anchor="middle">PE2</text>
<text class="sm" x="248" y="116">TC виден,</text><text class="sm" x="248" y="130">снять и по IP</text>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><rect x="-10" y="-21" width="20" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-12" text-anchor="middle">0</text><animateMotion dur="6s" repeatCount="indefinite" path="M102 106 L218 106" keyPoints="0;0;1;1" keyTimes="0;0.1;0.6;1" calcMode="linear"/></g>
</svg><figcaption>Сверху — обычный случай: P2 снимает метку, PE2 получает чистый IP. Снизу — explicit null: до PE2 доезжает метка 0 с полем TC.</figcaption></figure>
<div class="callout deep"><b>Забегая в главу 11</b>В VPN на пакете две метки: верхняя «до PE2» и нижняя «какому клиенту». PHP снимает только верхнюю. PE2 получает пакет с одной меткой — клиентской — и по ней сразу понимает, в какую таблицу клиента смотреть.</div>
<div class="callout lab"><b>В лабе</b>Задание 5: сначала ограничишь метки только адресами /32 и сравнишь размер LFIB, потом включишь на PE2 explicit null и увидишь, как у P2 в LFIB «Pop Label» сменится на метку 0. <a href="#/c/ch10/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: зачем нужен PHP?</summary><p>Чтобы выходному PE не делать два поиска (по метке, потом по IP). Метку снимает предпоследний маршрутизатор, и PE получает обычный IP-пакет.</p></details>
<details class="chk"><summary>Проверь себя: что в LFIB у предпоследнего маршрутизатора при PHP?</summary><p>«Pop Label»: он снимает метку и отправляет пакет дальше без неё.</p></details>
<details class="chk"><summary>Проверь себя: когда вместо implicit null используют explicit null?</summary><p>Когда последнему маршрутизатору нужно поле TC из метки для QoS. С меткой 0 оно доезжает до PE.</p></details>`},

{h:'Путь пакета целиком', html:`
<h3>От CE1 до CE2 по шагам</h3>
<p>Соберём всё вместе. CE1 отправляет пакет на 192.168.2.1. Вот что делает каждый маршрутизатор и на какую таблицу смотрит:</p>
<table><tr><th>Кто</th><th>Что видит</th><th>Куда смотрит</th><th>Что делает</th></tr>
<tr><td>PE1</td><td>IP 192.168.2.1</td><td>таблица маршрутов: сеть клиента за 10.255.0.4 (BGP), до 10.255.0.4 — через P1, метка 18 (IGP + LDP)</td><td>push 18, отправить в P1</td></tr>
<tr><td>P1</td><td>метка 18</td><td>LFIB: 18 → 22, к P2</td><td>swap 18 → 22</td></tr>
<tr><td>P2</td><td>метка 22</td><td>LFIB: 22 → Pop Label, к PE2</td><td>pop (PHP)</td></tr>
<tr><td>PE2</td><td>IP 192.168.2.1</td><td>таблица маршрутов: сеть клиента через CE2 (BGP)</td><td>отправить CE2</td></tr></table>
<p>Обрати внимание на PE1: он делает рекурсивный поиск из раздела 1 и сразу получает метку. Всё это уже собрано в одну запись таблицы пересылки (CEF):</p>
<pre class="cli">PE1#show ip cef 192.168.2.1 detail
192.168.2.0/24, epoch 2, flags [rib only nolabel, rib defined all labels]
  recursive via [[10.255.0.4]]
    nexthop 10.1.12.1 GigabitEthernet0/1 [[label 18]]
P1#show mpls forwarding-table 10.255.0.4 32
Local      Outgoing   Prefix           Bytes Label   Outgoing   Next Hop
Label      Label      or Tunnel Id     Switched      interface
18         [[22]]         10.255.0.4/32    1520          Gi0/2      10.1.23.1
P1#show ip route 192.168.2.1
% Network not in table</pre>
<p>Последняя строка — самая важная. У P1 нет маршрута к клиенту, и это <b>нормально</b>: P1 пересылает пакет по метке 18, а метка означает «до PE2». Метка выбрана по адресу <b>PE2</b>, а не по адресу клиента. Поэтому сколько бы клиентов ни было за PE2, в ядре для них всех одна метка.</p>
<div class="an"><b>Аналогия</b>Мешок «Хабаровск» один, сколько бы писем в нём ни лежало. Сортировочным центрам всё равно, кому письма, — им важно, куда мешок.</div>
<div class="callout pro"><b>Ответы идут своим путём</b>Ответ CE2 → CE1 едет по LSP «до PE1» (10.255.0.1) со своими метками. Если ответ не доходит, проверять надо именно этот LSP — от PE2 к PE1, а не тот, по которому шёл запрос. Типичная ошибка дежурного — проверить метки в одну сторону и успокоиться.</div>
<div class="callout lab"><b>В лабе</b>Задание 3: заполнишь эту таблицу сам — по <code>show ip cef</code> на PE1 и LFIB на P1 и P2, ещё до захвата трафика. Потом снимешь захват на линках и сверишь номера меток. <a href="#/c/ch10/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: на P1 нет маршрута к 192.168.2.1. Это авария?</summary><p>Нет. P1 пересылает пакет по метке «до PE2» и о сетях клиентов знать не должен.</p></details>
<details class="chk"><summary>Проверь себя: за PE2 сто клиентских сетей. Сколько меток для них нужно в ядре?</summary><p>Одна — для loopback PE2. Все пакеты к этим сетям едут по одному LSP «до PE2».</p></details>
<details class="chk"><summary>Проверь себя: какие две таблицы использует PE1, чтобы выбрать метку для пакета клиента?</summary><p>BGP говорит, что сеть клиента за 10.255.0.4. IGP говорит, что до 10.255.0.4 — через P1, а LDP даёт метку P1 для этого адреса (18). Всё вместе собрано в CEF.</p></details>`},

{h:'TTL, traceroute и MTU', html:`
<h3>TTL в метке</h3>
<p>У метки есть своё поле TTL, как у IP. Входной PE копирует в него TTL из IP-заголовка, каждый P уменьшает его на 1, а при снятии метки значение возвращается в IP. Поэтому петля в MPLS тоже не будет крутиться вечно, а traceroute клиента видит маршрутизаторы ядра:</p>
<pre class="cli">CE1#traceroute 192.168.2.1 source Lo1 numeric
  1 10.0.1.1 1 msec 1 msec 1 msec
  2 10.1.12.1 [[[MPLS: Label 18 Exp 0]]] 4 msec 3 msec 4 msec
  3 10.1.23.1 [[[MPLS: Label 22 Exp 0]]] 3 msec 4 msec 3 msec
  4 10.1.34.1 3 msec 3 msec 3 msec
  5 192.168.2.1 4 msec 4 msec 4 msec</pre>
<p>Здесь есть загадка. Когда TTL истекает на P1, P1 должен отправить клиенту сообщение ICMP «время жизни истекло». Но у P1 нет маршрута к сети CE1! Как ответ доходит? P1 поступает хитро: создаёт ICMP-сообщение и отправляет его <b>дальше по тому же LSP</b>, с той же меткой. Сообщение доезжает до PE2, а PE2 знает сеть CE1 из BGP и отправляет ответ обратно. Поэтому задержки на хопах ядра в traceroute обычно одинаковые: ответ каждый раз проходит через конец пути.</p>
<h3>Спрятать ядро от клиентов</h3>
<p>Многие провайдеры не хотят показывать абонентам свои маршрутизаторы ядра. Для этого на PE отключают копирование TTL для транзитного трафика: <code>no mpls ip propagate-ttl forwarded</code>. Метка получает TTL 255, и для клиента всё ядро выглядит как один прыжок: PE1 → PE2. Собственный traceroute инженера с PE при этом по-прежнему видит все хопы.</p>
<h3>MTU: каждая метка — плюс 4 байта</h3>
<p>Клиент отправляет пакеты по 1500 байт — стандартный размер Ethernet. Метка добавляет 4 байта, и пакет становится 1504. В VPN меток две — 1508. Если на каком-то линке ядра MTU 1500, такой пакет не пролезет.</p>
<figure class="dg"><svg viewBox="0 0 320 170" role="img" aria-label="Пакет 1500 байт с метками больше MTU 1500; на jumbo MTU помещается">
<text class="sm" x="8" y="18">Линк ядра с MTU 1500:</text>
<rect x="8" y="26" width="240" height="26" rx="4" fill="none" stroke="var(--tx3)" stroke-width="1.6" stroke-dasharray="5 4"/>
<rect x="8" y="26" width="240" height="26" rx="4" class="b"/><text class="wt2" x="128" y="43" text-anchor="middle">IP-пакет клиента 1500</text>
<g opacity="0"><rect x="250" y="26" width="18" height="26" rx="3" class="pu"/><text class="wt2" x="259" y="43" text-anchor="middle">4</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.2;0.21;1"/></g>
<g opacity="0"><rect x="270" y="26" width="18" height="26" rx="3" class="o"/><text class="wt2" x="279" y="43" text-anchor="middle">4</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.35;0.36;1"/></g>
<g opacity="0"><text class="sm rd" x="8" y="70">1504 или 1508 больше 1500 — пакет с DF выброшен</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.45;0.46;1"/></g>
<text class="sm" x="8" y="100">Линк ядра с jumbo MTU (9000 и больше):</text>
<rect x="8" y="108" width="304" height="26" rx="4" fill="none" stroke="#16a34a" stroke-width="1.6" stroke-dasharray="5 4"/>
<rect x="10" y="110" width="104" height="22" rx="3" class="b"/><text class="wt2" x="62" y="125" text-anchor="middle">1500</text>
<rect x="116" y="110" width="12" height="22" rx="2" class="pu"/><rect x="130" y="110" width="12" height="22" rx="2" class="o"/>
<g opacity="0"><text class="sm gn" x="8" y="152">запас огромный — метки помещаются</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
</svg><figcaption>Синий блок — пакет клиента, фиолетовая и оранжевая — метки по 4 байта. На линке с MTU 1500 полный пакет клиента с метками не помещается. Поэтому в ядре MPLS ставят большой MTU.</figcaption></figure>
<p>Коварство в том, что маленькие пакеты проходят. Пинг работает, сайты начинают открываться, а большие загрузки, VPN клиента или почта с вложениями зависают. Абонент пишет «интернет работает, но не всё». Правило провайдера: <b>MTU на линках ядра с запасом под метки</b>, обычно jumbo 9000+, и на всех линках одинаково.</p>
<div class="callout pro"><b>Как проверить MTU пути</b>Пинг с запретом фрагментации и большим размером: <code>ping 192.168.2.1 size 1500 df-bit</code>. Проходит 1496, а 1500 нет — где-то линк, на котором метка не помещается. Дальше ищешь его по <code>show interfaces</code> и <code>show mpls interfaces detail</code> вдоль пути.</div>
<div class="callout lab"><b>В лабе</b>Задание 6: отключишь копирование TTL и сравнишь traceroute с CE1 и с PE1. Задание 7: найдёшь максимальный размер пинга, поставишь на линке P1–P2 MTU 1500 и разберёшься, где и почему пропадает пакет 1500. <a href="#/c/ch10/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: у P1 нет маршрута к клиенту. Как его ответ ICMP в traceroute доходит до CE1?</summary><p>P1 отправляет ICMP-сообщение дальше по тому же LSP. Оно доезжает до PE2, а PE2 знает сеть CE1 из BGP и отправляет ответ обратно.</p></details>
<details class="chk"><summary>Проверь себя: что делает no mpls ip propagate-ttl forwarded?</summary><p>PE перестаёт копировать TTL клиентского пакета в метку. Ядро для клиента выглядит как один прыжок, его traceroute не видит P.</p></details>
<details class="chk"><summary>Проверь себя: абонент жалуется, что пинг идёт, а большие файлы не скачиваются. Что проверишь в ядре MPLS?</summary><p>MTU на линках по пути: пакет 1500 с одной или двумя метками (1504–1508) не должен упираться в MTU 1500. Проверка — ping с df-bit и большим размером.</p></details>`},

{h:'Когда LSP порван: диагностика', html:`
<h3>Самая коварная авария MPLS</h3>
<p>В IP-сети авария обычно видна: пропал маршрут, упал сосед. В MPLS бывает иначе. IGP в порядке, BGP между PE в порядке, все маршруты на месте, а трафик клиентов пропадает. Причина — <b>на одном из шагов пропала метка</b>. Пакет дальше идёт голым IP, и первый же P без BGP его выбрасывает.</p>
<figure class="dg"><svg viewBox="0 0 320 190" role="img" aria-label="На линке PE1–P1 выключен LDP: PE1 шлёт пакет без метки, P1 его выбрасывает">
<path class="ln" d="M41 70 L59 70 M153 70 L171 70 M209 70 L227 70 M265 70 L281 70"/>
<path d="M97 70 L115 70" stroke="#e11d48" stroke-width="2.4" stroke-dasharray="4 3" fill="none"/>
<rect class="bx" x="3" y="58" width="38" height="24" rx="6"/><text class="tx" x="22" y="74" text-anchor="middle">CE1</text>
<rect class="bx" x="59" y="58" width="38" height="24" rx="6"/><text class="tx" x="78" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="115" y="58" width="38" height="24" rx="6"/><text class="tx" x="134" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="171" y="58" width="38" height="24" rx="6"/><text class="tx" x="190" y="74" text-anchor="middle">P2</text>
<rect class="bx" x="227" y="58" width="38" height="24" rx="6"/><text class="tx" x="246" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="281" y="58" width="38" height="24" rx="6"/><text class="tx" x="300" y="74" text-anchor="middle">CE2</text>
<text class="sm rd" x="106" y="100" text-anchor="middle">LDP выключен</text>
<text class="sm" x="78" y="118" text-anchor="middle">LFIB PE1:</text><text class="sm rd" x="78" y="132" text-anchor="middle">No Label</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="10s" repeatCount="indefinite" path="M22 46 L78 46 L134 46" keyPoints="0;0;0.5;0.5;1;1" keyTimes="0;0.05;0.25;0.3;0.5;1" calcMode="linear"/><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.56;0.57;1"/></g>
<g opacity="0"><path class="lr" d="M127 39 L141 53 M141 39 L127 53"/><text class="sm rd" x="134" y="28" text-anchor="middle">192.168.2.1? маршрута нет</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.52;0.53;1"/></g>
<g opacity="0"><text class="sm" x="160" y="160" text-anchor="middle">IGP и BGP в порядке, LDP-сессия P1–P2 в порядке,</text><text class="sm rd" x="160" y="176" text-anchor="middle">но без метки пакет клиента умирает на первом P</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
</svg><figcaption>Поломка 3 из лабы. На линке PE1–P1 нет LDP, поэтому PE1 не получил от P1 метку для loopback PE2. В LFIB «No Label»: пакет уходит обычным IP, а P1 не знает сетей клиентов.</figcaption></figure>
<h3>Откуда берутся «дырки» в LSP</h3>
<ul><li><b>LDP не включён на интерфейсе.</b> Новый линк добавили в IGP, а <code>mpls ip</code> забыли. Маршрут через новый линк лучше, и трафик идёт туда — без метки.</li>
<li><b>LDP-сессия не поднимается.</b> Router-id LDP не анонсирован в IGP или ACL режет TCP 646.</li>
<li><b>IGP поднялся быстрее LDP.</b> После перезагрузки или восстановления линка IGP уже ведёт трафик через этот линк, а метки ещё не получены — несколько секунд или минут чёрной дыры. Лечится <b>LDP-IGP sync</b> (<code>mpls ldp sync</code> в IGP): пока LDP не готов, IGP объявляет линк с максимальной стоимостью, и трафик его обходит.</li>
<li><b>Loopback PE не /32.</b> Если loopback PE2 по ошибке /24, в IGP и LDP появится 10.255.0.0/24, а BGP ждёт next-hop 10.255.0.4. Метка может не найтись. Loopback'и PE всегда /32.</li></ul>
<h3>Порядок действий дежурного</h3>
<ol class="steps"><li><b>IGP.</b> Есть ли на PE1 маршрут к loopback PE2 и именно /32? И наоборот, с PE2 к PE1 (ответы!).</li>
<li><b>LDP-соседи.</b> <code>show mpls ldp neighbor</code> вдоль всего пути, <code>show mpls interfaces</code> — включён ли MPLS на нужных интерфейсах.</li>
<li><b>Метки по шагам.</b> <code>show mpls forwarding-table 10.255.0.4 32</code> на PE1 и на каждом P пути. Нигде не должно быть «No Label».</li>
<li><b>Проверка самого LSP.</b> <code>ping mpls ipv4 10.255.0.4/32</code> и <code>traceroute mpls ipv4 10.255.0.4/32</code>. Это не обычный пинг: он идёт именно по меткам, и PE2 проверяет, что пакет пришёл к нему по правильному пути. Traceroute MPLS показывает, на каком шаге путь рвётся.</li></ol>
<pre class="cli">PE1#traceroute mpls ipv4 10.255.0.4/32
Tracing MPLS Label Switched Path to 10.255.0.4/32, timeout is 2 seconds
  0 10.1.12.0 MRU 1500 [Labels: 18 Exp: 0]
L 1 10.1.12.1 MRU 1500 [Labels: 22 Exp: 0] 3 ms
L 2 10.1.23.1 MRU 1504 [Labels: implicit-null Exp: 0] 2 ms
! 3 10.1.34.1 3 ms</pre>
<p>Буква в начале строки — что ответил хоп: <b>L</b> — переслал по метке, <b>!</b> — путь дошёл до цели. Если путь порван, ты увидишь, после какого хопа ответы стали другими.</p>
<div class="callout pro"><b>Обычный ping обманывает</b>Обычный <code>ping 10.255.0.4</code> с PE1 проходит даже при порванном LSP: адрес PE2 есть в IGP, и P1 перешлёт такой пакет и без метки. Чёрная дыра бывает только для адресов, которых нет в ядре, — клиентских. Поэтому транспорт MPLS проверяют <code>ping mpls</code> или пингом между клиентскими адресами (например, из VRF), а не пингом loopback'а.</div>
<div class="callout lab"><b>В лабе</b>Поломки 1, 2 и 3: LDP выключен на одном линке, LDP router-id не в IGP, метки нет на выходе из PE1. Задание 8: <code>ping mpls</code>, <code>traceroute mpls</code> и LDP-IGP sync — выключишь LDP на линке и посмотришь, как IGP сам уведёт с него трафик. <a href="#/c/ch10/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: BGP между PE Established, пинг loopback PE2 с PE1 идёт, а клиенты друг друга не видят. Что подозреваешь?</summary><p>Порванный LSP: на каком-то шаге «No Label». Loopback PE2 пингуется и без метки (он есть в IGP), а клиентский трафик без метки P выбрасывает.</p></details>
<details class="chk"><summary>Проверь себя: зачем нужен LDP-IGP sync?</summary><p>Чтобы IGP не вёл трафик через линк, на котором LDP ещё не поднялся. Пока меток нет, IGP объявляет линк с максимальной стоимостью.</p></details>
<details class="chk"><summary>Проверь себя: чем ping mpls лучше обычного ping для проверки транспорта?</summary><p>Он идёт по меткам и проверяется на выходном PE. Обычный ping до loopback может пройти и без меток.</p></details>`},

{h:'Что дальше: стек меток и Segment Routing', html:`
<h3>Зачем стек</h3>
<p>Всё, что мы разобрали, — одна метка: «довезти до PE2». Но к PE2 может быть подключено много клиентов, и у каждого свои сети, иногда с одинаковыми серыми адресами. Как PE2 поймёт, кому отдать пакет? Нужна вторая метка — нижняя: «клиенту A». Верхняя метка везёт пакет через ядро и меняется на каждом шаге. Нижняя едет нетронутой, P её даже не видят. PE2 после PHP получает пакет с одной клиентской меткой и сразу знает, в чью таблицу смотреть.</p>
<figure class="dg"><svg viewBox="0 0 320 168" role="img" aria-label="Две метки: верхняя меняется в ядре, нижняя клиентская доезжает до PE2">
<path class="ln" d="M41 70 L59 70 M97 70 L115 70 M153 70 L171 70 M209 70 L227 70 M265 70 L281 70"/>
<rect class="bx" x="3" y="58" width="38" height="24" rx="6"/><text class="tx" x="22" y="74" text-anchor="middle">A1</text>
<rect class="bx" x="59" y="58" width="38" height="24" rx="6"/><text class="tx" x="78" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="115" y="58" width="38" height="24" rx="6"/><text class="tx" x="134" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="171" y="58" width="38" height="24" rx="6"/><text class="tx" x="190" y="74" text-anchor="middle">P2</text>
<rect class="bx" x="227" y="58" width="38" height="24" rx="6"/><text class="tx" x="246" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="281" y="58" width="38" height="24" rx="6"/><text class="tx" x="300" y="74" text-anchor="middle">A2</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M22 46 L300 46" keyPoints="0;0;0.2014;0.2014;0.4029;0.4029;0.6043;0.6043;0.8058;0.8058;1;1" keyTimes="0;0.03;0.12;0.15;0.27;0.3;0.42;0.45;0.57;0.6;0.7;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.72;0.73;1"/></g>
<g opacity="0"><rect x="-14" y="-21" width="28" height="12" rx="3" class="o"/><text class="wt2" x="0" y="-12" text-anchor="middle">A:30</text><animateMotion dur="14s" repeatCount="indefinite" path="M78 46 L246 46" keyPoints="0;0;0.3333;0.3333;0.6667;0.6667;1;1" keyTimes="0;0.15;0.27;0.3;0.42;0.45;0.57;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.13;0.14;0.58;0.59;1"/></g>
<g opacity="0"><rect x="-12" y="-35" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-26" text-anchor="middle">18</text><animateMotion dur="14s" repeatCount="indefinite" path="M78 46 L134 46" keyPoints="0;0;1;1" keyTimes="0;0.15;0.27;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.13;0.14;0.285;0.29;1"/></g>
<g opacity="0"><rect x="-12" y="-35" width="24" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-26" text-anchor="middle">22</text><animateMotion dur="14s" repeatCount="indefinite" path="M134 46 L190 46" keyPoints="0;0;1;1" keyTimes="0;0.3;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.285;0.29;0.435;0.44;1"/></g>
<g opacity="0"><text class="sm og" x="246" y="100" text-anchor="middle">30 → клиент A</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.58;0.59;1"/></g>
<g opacity="0"><text class="sm" x="160" y="134" text-anchor="middle">Фиолетовая — «до PE2», меняется в ядре.</text><text class="sm og" x="160" y="150" text-anchor="middle">Оранжевая — «клиенту A», едет нетронутой</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.74;0.75;1"/></g>
</svg><figcaption>Офисы клиента A подключены к PE1 и PE2. Ядро работает так же, как в этой главе: P видят только верхнюю метку. Нижнюю PE2 выдал заранее через BGP. Как именно — глава 11, MPLS L3VPN.</figcaption></figure>
<p>На этом стоят все провайдерские услуги следующих глав: L3VPN (глава 11), L2VPN и EVPN (глава 12), управление путями трафика (глава 13). Ядро для них одно и то же — то, что ты разобрал здесь.</p>
<h3>Segment Routing: метки без LDP</h3>
<p>Последние годы провайдеры переходят на <b>Segment Routing</b> (SR). Идея: раз IGP и так знает всю карту сети, пусть он сам и раздаёт метки. LDP становится не нужен. Каждому loopback назначают номер — <b>SID</b> (segment identifier), а метка считается из общего диапазона: у Cisco по умолчанию это 16000 + номер. У PE2 с номером 4 метка 16004 на <b>всех</b> маршрутизаторах сети, а не своя на каждом шаге, как в LDP.</p>
<ul><li>Меньше протоколов: нет LDP-сессий, нет проблемы «IGP поднялся быстрее LDP».</li>
<li>Метки одинаковы везде — проще читать выводы и искать аварии.</li>
<li>Входной PE может задать путь стеком меток («сначала через P3, потом к PE2»), и ядру не нужно ничего об этом помнить.</li>
<li>Быстрый обход аварий TI-LFA (раздел 9 главы 6) работает для любой топологии, включая кольца.</li></ul>
<div class="callout pro"><b>Что у тебя на работе</b>В большинстве действующих сетей до сих пор LDP, а SR вводят постепенно, и они долго живут вместе. Поэтому LDP знать обязательно, а SR — следующий шаг. В лабе в разделе «Со звёздочкой» можно попробовать SR на CSR1000v.</div>

<details class="chk"><summary>Проверь себя: зачем на пакете две метки в VPN?</summary><p>Верхняя довозит пакет через ядро до нужного PE и меняется на каждом шаге. Нижняя говорит PE, какому клиенту отдать пакет, и в ядре не трогается.</p></details>
<details class="chk"><summary>Проверь себя: чем метка в Segment Routing отличается от метки LDP?</summary><p>В SR метка для loopback одинакова на всех маршрутизаторах (диапазон + номер SID), и раздаёт её IGP. В LDP каждый маршрутизатор выбирает свою метку и раздаёт её отдельным протоколом.</p></details>`}
],
end: `<h3>Что ты теперь знаешь</h3>
<p>MPLS нужен ядру провайдера, чтобы P-маршрутизаторы пересылали трафик клиентов и интернета, ничего о нём не зная: PE наклеивает метку «до выходного PE», P меняют её по своим таблицам, предпоследний снимает. Метки раздаёт LDP: каждый выбирает свою для каждого маршрута IGP и рассылает соседям, метки идут навстречу трафику. В LIB лежат все метки, в LFIB — метка соседа с лучшим путём IGP, поэтому при аварии переключение мгновенное. TTL копируется в метку, ICMP с P доезжает до конца LSP и возвращается оттуда. Каждая метка — плюс 4 байта к MTU. Самая коварная авария — «No Label» на одном шаге: IGP и BGP в порядке, а трафик клиентов умирает на первом P. Её ищут по меткам вдоль пути и ping/traceroute mpls.</p>
<div class="callout ok"><b>Посмотри у себя на работе</b><ol><li>Зайди на любой P и посмотри <code>show mpls forwarding-table</code>: сколько строк и на что они указывают (loopback'и PE?).</li><li>Проверь <code>show mpls ldp neighbor</code>: с кем есть сессии и какой router-id у LDP.</li><li>Узнай у коллег, какой MTU на линках ядра и стоит ли LDP-IGP sync. Есть ли у вас уже Segment Routing?</li></ol></div>
<p>Дальше по главе: карточки, тест, «Объясни своими словами» и лаба — ядро без BGP на пяти маршрутизаторах, метки на каждом шаге руками и три поломки LSP. А следующая глава — MPLS L3VPN: та самая вторая метка и VPN для корпоративных клиентов.</p>`
};
