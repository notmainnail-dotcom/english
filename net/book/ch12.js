// Книжный текст главы 12 СДСМ (компьютер): MPLS L2VPN — VPWS и VPLS. Формат как у ch06/ch10, блоки .callout.lab ведут в лабу 12.
// Ученик начинает L2VPN с нуля (диагностика: «L2VPN — не оценивалось»), BGP ещё не изучал — глава построена так, что BGP не нужен
// (псевдопровода на LDP). По ходу повторяются слабые места главы 10 (из трекера): выбор транспортной метки и PHP.
// Факты: RFC 4447/8077 (PW на LDP, FEC 128, VC ID, MTU, тип), RFC 4448 (Ethernet over MPLS, control word), RFC 4762 (VPLS на LDP,
// full mesh, split horizon), RFC 4761/6074 (VPLS на BGP — только упоминание), MEF 6 (E-Line, E-LAN), IEEE 802.1ag / Y.1731 (CFM).
window.BOOK = window.BOOK || {};
BOOK.ch12 = {
title: 'MPLS L2VPN: VPWS и VPLS',
lead: `<p>Корпоративный клиент говорит менеджеру: «Соедините нам два офиса, как будто между ними просто кабель. Адреса и маршрутизацию мы сделаем сами». Менеджер пишет в заявке «L2-канал» или «прозрачный VLAN», и задача приходит к вам. Эта глава о том, как провайдер такой «кабель через город» делает поверх MPLS и что с ним ломается.</p>
<p>Про L2VPN ты пока ничего не знаешь, и это нормально: глава начинается с нуля. Опираться будем на две вещи, которые ты уже прошёл: VLAN (глава 2) и метки MPLS (глава 10). BGP здесь не нужен — всё работает на LDP, который ты знаешь из главы 10.</p>
<p>Порядок прежний: раздел в день, анимации можно ставить на паузу, «Проверь себя» в конце раздела, зелёные блоки ведут в лабу. Все примеры — на топологии лабы 12: три PE, к которым подключены офисы клиента 1, 2 и 3, и P1 в центре ядра. Книгу можно слушать — кнопка «🔊 Слушать».</p>`,
parts: [

{h:'Что значит «L2-канал» и зачем здесь MPLS', html:`
<h3>Две разные услуги для одного клиента</h3>
<p>Клиенту с несколькими офисами провайдер может продать связь двумя способами.</p>
<ul><li><b>Услуга третьего уровня (L3).</b> Провайдер сам маршрутизирует трафик клиента: знает его IP-сети и решает, куда отправлять пакеты. Это L3VPN — следующая глава.</li>
<li><b>Услуга второго уровня (L2).</b> Провайдер ничего не знает про IP клиента. Он просто переносит кадры Ethernet из одного офиса в другой — как будто между офисами протянут длинный кабель или стоит общий коммутатор. Адресацию, маршрутизацию, OSPF между своими маршрутизаторами клиент делает сам. Это <b>L2VPN</b>.</li></ul>
<p>Почему клиенты выбирают L2? Им не нужно согласовывать с провайдером адреса и маршрутизацию, можно запускать любые протоколы, а сеть офисов выглядит как одна локальная сеть. Банки, торговые сети, госструктуры часто покупают именно L2-каналы.</p>
<div class="an"><b>Аналогия</b>L3-услуга — это служба доставки, которая сама читает адрес и выбирает маршрут. L2-услуга — это пневмопочта между двумя зданиями: что положили в трубу на одном конце, то и выпало на другом. Труба не читает, что внутри.</div>
<h3>Как это делали раньше: растянутый VLAN</h3>
<p>Самый простой способ сделать «кабель через город» ты наверняка видел на работе: выделить клиенту VLAN и протянуть его через все коммутаторы между офисами. Часто ещё с QinQ — когда VLAN клиента заворачивают во внешний VLAN провайдера. Работает, но у способа три больших проблемы:</p>
<ul><li><b>Все коммутаторы по пути учат MAC-адреса клиента.</b> Сто клиентов по сто компьютеров — и в таблице каждого коммутатора десятки тысяч чужих MAC-адресов.</li>
<li><b>STP растягивается на всю сеть.</b> Петля или шторм у клиента может уронить коммутаторы провайдера по всему кольцу.</li>
<li><b>VLAN всего 4094.</b> На большой сети номера кончаются.</li></ul>
<figure class="dg"><svg viewBox="0 0 320 236" role="img" aria-label="Растянутый VLAN: все коммутаторы учат MAC клиента; MPLS L2VPN: ядро видит только метки">
<text class="tx" x="160" y="18" text-anchor="middle">Раньше: VLAN клиента через все коммутаторы</text>
<path class="ln" d="M44 50 L68 50 M108 50 L132 50 M172 50 L196 50 M236 50 L260 50" style="stroke:#16a34a;stroke-width:3"/>
<rect class="bx" x="4" y="38" width="40" height="24" rx="6"/><text class="tx" x="24" y="54" text-anchor="middle">CE1</text>
<rect class="bx" x="68" y="38" width="40" height="24" rx="6"/><text class="tx" x="88" y="54" text-anchor="middle">SW</text>
<rect class="bx" x="132" y="38" width="40" height="24" rx="6"/><text class="tx" x="152" y="54" text-anchor="middle">SW</text>
<rect class="bx" x="196" y="38" width="40" height="24" rx="6"/><text class="tx" x="216" y="54" text-anchor="middle">SW</text>
<rect class="bx" x="260" y="38" width="40" height="24" rx="6"/><text class="tx" x="280" y="54" text-anchor="middle">CE2</text>
<g opacity="0"><rect x="-10" y="-6" width="20" height="12" rx="2" class="b"/><animateMotion dur="14s" repeatCount="indefinite" path="M24 30 L280 30" keyPoints="0;0;1;1" keyTimes="0;0.04;0.4;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.41;0.42;1"/></g>
<g opacity="0"><text class="sm og" x="88" y="78" text-anchor="middle">учит MAC</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.13;0.14;1"/></g>
<g opacity="0"><text class="sm og" x="152" y="78" text-anchor="middle">учит MAC</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.22;0.23;1"/></g>
<g opacity="0"><text class="sm og" x="216" y="78" text-anchor="middle">учит MAC</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.31;0.32;1"/></g>
<text class="sm rd" x="160" y="96" text-anchor="middle">чужие MAC везде · STP на всю сеть · максимум 4094 VLAN</text>
<text class="tx" x="160" y="128" text-anchor="middle">MPLS L2VPN: кадр едет внутри меток</text>
<path class="ln" d="M44 160 L68 160 M108 160 L132 160 M172 160 L196 160 M236 160 L260 160"/>
<rect class="bx" x="4" y="148" width="40" height="24" rx="6"/><text class="tx" x="24" y="164" text-anchor="middle">CE1</text>
<rect class="bx" x="68" y="148" width="40" height="24" rx="6"/><text class="tx" x="88" y="164" text-anchor="middle">PE1</text>
<rect class="bx" x="132" y="148" width="40" height="24" rx="6"/><text class="tx" x="152" y="164" text-anchor="middle">P</text>
<rect class="bx" x="196" y="148" width="40" height="24" rx="6"/><text class="tx" x="216" y="164" text-anchor="middle">PE2</text>
<rect class="bx" x="260" y="148" width="40" height="24" rx="6"/><text class="tx" x="280" y="164" text-anchor="middle">CE2</text>
<g opacity="0"><rect x="-10" y="-6" width="20" height="12" rx="2" class="b"/><animateMotion dur="14s" repeatCount="indefinite" path="M24 140 L280 140" keyPoints="0;0;1;1" keyTimes="0;0.5;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.49;0.5;0.93;0.94;1"/></g>
<g opacity="0"><rect x="-14" y="-21" width="28" height="12" rx="3" class="pu"/><text class="wt" x="0" y="-12" text-anchor="middle">метки</text><animateMotion dur="14s" repeatCount="indefinite" path="M88 140 L216 140" keyPoints="0;0;1;1" keyTimes="0;0.6;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.59;0.6;0.8;0.81;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="196" text-anchor="middle">ядро видит только метки, MAC клиента знают</text><text class="sm gn" x="160" y="210" text-anchor="middle">только PE · нет STP клиента в ядре · нет лимита 4094</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.82;0.83;1"/></g>
</svg><figcaption>Синий прямоугольник — кадр Ethernet клиента. Сверху: растянутый VLAN, каждый коммутатор по пути запоминает MAC клиента. Снизу: L2VPN поверх MPLS, кадр целиком упакован под метки, ядро смотрит только на метки, как в главе 10.</figcaption></figure>
<h3>Идея MPLS L2VPN</h3>
<p>MPLS решает все три проблемы одним приёмом: <b>кадр клиента целиком, вместе с его MAC-адресами и VLAN, упаковывается под метки</b> и едет через ядро как обычный груз. P-маршрутизаторы ядра видят только метки — так же, как в главе 10 они не видели IP-адреса клиентов. MAC-адреса клиента знают только PE, к которым подключены его офисы. STP клиента остаётся у клиента. А номеров меток — миллион.</p>
<div class="an"><b>Аналогия</b>Посылка в посылке. Клиент отдал на почту коробку со своим адресом и наклейками. Почта не переклеивает их, а кладёт всю коробку в свой мешок с биркой «до отделения в Новосибирске». В пути читают только бирку на мешке. В Новосибирске мешок открывают и отдают коробку получателю в том же виде, в каком её сдали.</div>
<h3>Слова, которые понадобятся</h3>
<ul><li><b>CE, PE, P</b> — как в главе 10: оборудование клиента, граничный и транзитный маршрутизаторы провайдера.</li>
<li><b>AC</b> (attachment circuit, «подключение клиента») — то, чем клиент подключён к PE: порт целиком или один VLAN на порту. Это вход и выход нашего «кабеля».</li>
<li><b>VPWS</b> (virtual private wire service) — L2-канал <b>точка-точка</b>: два офиса, как кабель. В продажах его называют <b>E-Line</b> (Ethernet Line).</li>
<li><b>VPLS</b> (virtual private LAN service) — L2-сеть <b>многоточка</b>: три офиса и больше в одной общей «локалке», как на одном коммутаторе. В продажах — <b>E-LAN</b>.</li></ul>
<table><tr><th>Клиент просит</th><th>Услуга</th><th>Технология</th></tr>
<tr><td>«Кабель» между двумя офисами</td><td>E-Line</td><td>VPWS (раздел 2–5)</td></tr>
<tr><td>Общая локальная сеть для нескольких офисов</td><td>E-LAN</td><td>VPLS (раздел 6–7)</td></tr>
<tr><td>Провайдер маршрутизирует сети клиента</td><td>L3VPN</td><td>глава 11</td></tr></table>

<details class="chk"><summary>Проверь себя: чем L2-услуга отличается от L3-услуги для клиента?</summary><p>В L2 провайдер переносит кадры Ethernet и не знает IP клиента — маршрутизацию клиент делает сам. В L3 провайдер знает сети клиента и маршрутизирует его трафик.</p></details>
<details class="chk"><summary>Проверь себя: назови три проблемы растянутого VLAN.</summary><p>Все коммутаторы по пути учат MAC клиента; STP и петли клиента растягиваются на сеть провайдера; VLAN всего 4094.</p></details>
<details class="chk"><summary>Проверь себя: что такое AC?</summary><p>Attachment circuit — подключение клиента к PE: порт целиком или VLAN на порту. Через него кадры клиента входят в L2VPN и выходят из него.</p></details>`},

{h:'Псевдопровод: кабель, которого нет', html:`
<h3>Что такое псевдопровод</h3>
<p>Основа любого L2VPN — <b>псевдопровод</b> (pseudowire, PW). Это виртуальный кабель между двумя PE через ядро MPLS. С одной стороны в него входит AC офиса 1, с другой выходит AC офиса 2. Всё, что клиент отправил в свой порт на PE1, вываливается из порта на PE2.</p>
<p>Устроен псевдопровод на знакомых тебе метках, только меток теперь <b>две</b>:</p>
<ul><li><b>Транспортная метка</b> (верхняя) — «довези до PE2». Ровно та метка из главы 10, которую раздаёт LDP для loopback PE2. Её видят и меняют P-маршрутизаторы.</li>
<li><b>Метка псевдопровода</b> (нижняя, VC label) — «это кадр для такого-то псевдопровода». Её выбрал сам PE2, и смотрит на неё только PE2: по ней он понимает, в какой порт и какой VLAN отдать кадр.</li></ul>
<figure class="dg"><svg viewBox="0 0 320 212" role="img" aria-label="Кадр клиента в псевдопроводе: PE1 вешает метку псевдопровода и транспортную, P1 снимает транспортную, PE2 по метке псевдопровода отдаёт кадр в порт клиента">
<rect x="94" y="62" width="132" height="16" rx="8" fill="rgba(217,119,6,.16)" stroke="#d97706" stroke-width="1.4" stroke-dasharray="4 3"/>
<path class="ln" d="M50 70 L72 70 M116 70 L138 70 M182 70 L204 70 M248 70 L270 70"/>
<rect class="bx" x="6" y="58" width="44" height="24" rx="6"/><text class="tx" x="28" y="74" text-anchor="middle">CE1</text>
<rect class="bx" x="72" y="58" width="44" height="24" rx="6"/><text class="tx" x="94" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="138" y="58" width="44" height="24" rx="6"/><text class="tx" x="160" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="204" y="58" width="44" height="24" rx="6"/><text class="tx" x="226" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="270" y="58" width="44" height="24" rx="6"/><text class="tx" x="292" y="74" text-anchor="middle">CE2</text>
<text class="sm og" x="160" y="96" text-anchor="middle">псевдопровод PE1 ↔ PE2</text>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="2" class="b"/><text class="wt" x="0" y="3" text-anchor="middle">кадр</text><animateMotion dur="14s" repeatCount="indefinite" path="M28 46 L292 46" keyPoints="0;0;0.25;0.25;0.5;0.5;0.75;0.75;1;1" keyTimes="0;0.03;0.13;0.17;0.32;0.36;0.51;0.55;0.65;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.67;0.68;1"/></g>
<g opacity="0"><rect x="-14" y="-21" width="28" height="12" rx="3" class="o"/><text class="wt2" x="0" y="-12" text-anchor="middle">PW 21</text><animateMotion dur="14s" repeatCount="indefinite" path="M94 46 L226 46" keyPoints="0;0;0.5;0.5;1;1" keyTimes="0;0.17;0.32;0.36;0.51;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.15;0.16;0.53;0.54;1"/></g>
<g opacity="0"><rect x="-14" y="-35" width="28" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-26" text-anchor="middle">18</text><animateMotion dur="14s" repeatCount="indefinite" path="M94 46 L160 46" keyPoints="0;0;1;1" keyTimes="0;0.17;0.32;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.15;0.16;0.335;0.34;1"/></g>
<g opacity="0"><text class="sm bt" x="94" y="114" text-anchor="middle">push PW 21</text><text class="sm bt" x="94" y="128" text-anchor="middle">push 18</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.15;0.16;1"/></g>
<g opacity="0"><text class="sm bt" x="160" y="114" text-anchor="middle">pop 18</text><text class="sm bt" x="160" y="128" text-anchor="middle">(PHP)</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.34;0.35;1"/></g>
<g opacity="0"><text class="sm bt" x="226" y="114" text-anchor="middle">PW 21 → порт</text><text class="sm bt" x="226" y="128" text-anchor="middle">клиента, снять</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.53;0.54;1"/></g>
<g opacity="0"><text class="sm" x="160" y="160" text-anchor="middle">Кадр клиента целиком: его MAC, VLAN, OSPF, ARP —</text><text class="sm" x="160" y="176" text-anchor="middle">ядро ничего этого не видит и не трогает</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.68;0.69;1"/></g>
</svg><figcaption>Оранжевая труба — псевдопровод. Синий прямоугольник — кадр клиента. PE1 кладёт на кадр две метки: оранжевую «псевдопровод 21» и сверху фиолетовую транспортную 18 «до PE2». P1 — предпоследний, он снимает транспортную метку (PHP). PE2 получает кадр с одной меткой 21 и по ней знает, в какой порт его отдать.</figcaption></figure>
<h3>Вспомни главу 10: откуда берутся обе метки</h3>
<p>В трекере записано, что в главе 10 тебе было трудно с выбором метки и с PHP. Посмотрим на них ещё раз — здесь они работают точно так же.</p>
<ul><li><b>Транспортная метка 18.</b> PE1 ищет в таблице маршрутов путь до loopback PE2 (10.255.0.2). IGP говорит: следующий хоп — P1. Значит, PE1 берёт из LIB метку, <b>которую прислал P1</b>, — 18. Из всех меток соседей в работу (LFIB) идёт метка того, через кого лучший путь IGP.</li>
<li><b>PHP.</b> PE2 объявил для своего loopback метку implicit null («мне без транспортной метки»). Поэтому P1, предпоследний на пути, снимает 18. До PE2 кадр доезжает только с меткой псевдопровода — и PE2 сразу понимает, чей это кадр, одним поиском.</li>
<li><b>Метка псевдопровода 21</b> — новое. Её выбрал PE2 и сообщил PE1. Как именно — следующий раздел.</li></ul>
<div class="an"><b>Аналогия</b>Две бирки на мешке. Верхняя «Новосибирск» нужна всем сортировочным центрам по дороге, её меняют на каждом шаге и снимают перед последним. Нижняя «ячейка 21» нужна только отделению в Новосибирске: по ней почтальон знает, в какой подъезд нести коробку.</div>
<div class="callout pro"><b>Что это значит для ядра</b>На P1 нет ни одной настройки для клиента. В LFIB у P1 только строки для loopback'ов PE. Сто клиентских каналов между PE1 и PE2 идут по одному транспортному LSP и отличаются только нижней меткой. Поэтому подключение нового клиента — это настройка только на двух PE, ядро не трогают.</div>
<div class="callout deep"><b>Control word</b>Между меткой псевдопровода и кадром часто добавляют ещё 4 байта — <b>control word</b>. Он помогает с порядком кадров и защищает от ошибки балансировки: некоторые маршрутизаторы, видя под метками байт, похожий на начало IP-пакета, пытаются раскладывать трафик по ECMP как IP и перемешивают кадры. В выводах ты увидишь строку «Control Word: On».</div>
<div class="callout lab"><b>В лабе</b>Задание 1: прежде чем делать сервисы, проверишь транспорт — LDP на P1, метки для loopback'ов всех PE и <code>ping mpls</code> между PE. Без живого транспортного LSP псевдопровод не поднимется. <a href="#/c/ch12/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: какие две метки на кадре внутри псевдопровода и кто на какую смотрит?</summary><p>Верхняя — транспортная «до PE2», её видят и меняют P. Нижняя — метка псевдопровода, на неё смотрит только PE2, чтобы понять, в какой порт отдать кадр.</p></details>
<details class="chk"><summary>Проверь себя: какую транспортную метку выберет PE1 и почему?</summary><p>Ту, что прислал сосед, через которого лучший путь IGP до loopback PE2. В лабе это P1 и его метка 18.</p></details>
<details class="chk"><summary>Проверь себя: с какой меткой кадр приходит на PE2 и почему?</summary><p>Только с меткой псевдопровода. Транспортную снял P1 (PHP), потому что PE2 объявил для своего loopback implicit null.</p></details>`},

{h:'Как PE договариваются о метке: targeted LDP', html:`
<h3>Соседи, которые не соседи</h3>
<p>Метку псевдопровода выбирает PE2 и должен сообщить её PE1. Но PE1 и PE2 не соединены напрямую: между ними P1, а в реальной сети — десяток P. Обычный LDP из главы 10 работает только между соседями по линку: Hello уходят на групповой адрес и дальше соседнего маршрутизатора не идут.</p>
<p>Поэтому для псевдопроводов PE открывают <b>targeted LDP</b> («адресный» LDP). Отличие одно: Hello отправляется не на групповой адрес, а прямо на loopback дальнего PE — обычным пакетом, через всё ядро. Дальше всё как в главе 10: TCP-сессия на порт 646 между loopback'ами, обмен метками.</p>
<div class="an"><b>Аналогия</b>Обычный LDP — разговор с соседом через стенку: слышно только тех, кто рядом. Targeted LDP — звонок по телефону другу в другом городе: между вами много станций, но говорите вы напрямую друг с другом.</div>
<figure class="dg"><svg viewBox="0 0 320 214" role="img" aria-label="PE1 и PE2 через ядро открывают targeted LDP и обмениваются метками для VC ID 100">
<path d="M60 52 Q160 -8 260 52" fill="none" stroke="#d97706" stroke-width="1.8" stroke-dasharray="5 4"/>
<text class="sm og" x="160" y="10" text-anchor="middle">targeted LDP: PE1 ↔ PE2 напрямую</text>
<path class="ln" d="M84 70 L136 70 M184 70 L236 70"/>
<text class="sm" x="110" y="92" text-anchor="middle">LDP</text><text class="sm" x="210" y="92" text-anchor="middle">LDP</text>
<rect class="bx" x="36" y="58" width="48" height="24" rx="6"/><text class="tx" x="60" y="74" text-anchor="middle">PE1</text>
<rect class="bx" x="136" y="58" width="48" height="24" rx="6"/><text class="tx" x="160" y="74" text-anchor="middle">P1</text>
<rect class="bx" x="236" y="58" width="48" height="24" rx="6"/><text class="tx" x="260" y="74" text-anchor="middle">PE2</text>
<g opacity="0"><rect x="-26" y="-7" width="52" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">VC 100 → 21</text><animateMotion dur="15s" repeatCount="indefinite" path="M260 52 Q160 -8 60 52" keyPoints="0;0;1;1" keyTimes="0;0.08;0.3;1" calcMode="linear"/><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.07;0.08;0.3;0.31;1"/></g>
<g opacity="0"><rect x="-26" y="-7" width="52" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">VC 100 → 17</text><animateMotion dur="15s" repeatCount="indefinite" path="M60 52 Q160 -8 260 52" keyPoints="0;0;1;1" keyTimes="0;0.38;0.6;1" calcMode="linear"/><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.37;0.38;0.6;0.61;1"/></g>
<g opacity="0"><text class="sm og" x="60" y="104" text-anchor="middle">мне — 17</text><text class="sm" x="60" y="118" text-anchor="middle">шлю ему — 21</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
<g opacity="0"><text class="sm og" x="260" y="104" text-anchor="middle">мне — 21</text><text class="sm" x="260" y="118" text-anchor="middle">шлю ему — 17</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
<g><text class="sm" x="160" y="160" text-anchor="middle">PE2: «кадры псевдопровода 100</text><text class="sm" x="160" y="176" text-anchor="middle">присылай мне с меткой 21»</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.35;0.36;1"/></g>
<g opacity="0"><text class="sm" x="160" y="160" text-anchor="middle">PE1: «а мне для псевдопровода 100 —</text><text class="sm" x="160" y="176" text-anchor="middle">с меткой 17»</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.35;0.36;0.65;0.66;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="160" text-anchor="middle">Обе стороны обменялись метками — PW up.</text><text class="sm rd" x="160" y="176" text-anchor="middle">VC ID, MTU и тип AC должны совпасть, иначе PW down</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></g>
</svg><figcaption>Сплошные линии — обычный LDP с соседом по линку (транспортные метки, глава 10). Оранжевая дуга — targeted LDP прямо между PE. По ней едут метки псевдопровода: каждый PE выбирает свою и сообщает другому. Псевдопровод в одну сторону использует 21, в обратную — 17.</figcaption></figure>
<h3>Что сообщает PE в метке псевдопровода</h3>
<p>Сообщение «для псевдопровода такого-то присылай мне с меткой N» содержит:</p>
<ul><li><b>VC ID</b> (virtual circuit identifier, номер псевдопровода) — число, которое инженер задаёт на обоих PE. По нему PE понимают, что речь об одном и том же канале. В лабе это 100. <b>Должен совпадать на обоих концах.</b></li>
<li><b>MTU AC</b> — какой максимальный кадр принимает порт клиента. <b>Должен совпадать</b>, иначе канал не поднимется: большие кадры с одной стороны не пролезли бы на другую.</li>
<li><b>Тип AC</b> — весь порт или VLAN на порту. Тоже должен совпадать.</li></ul>
<p>Если хоть что-то не совпало, PE не принимает метку соседа, и псевдопровод остаётся в состоянии <b>down</b>. Это первые подозреваемые, когда «канал не поднимается».</p>
<div class="callout pro"><b>VC ID — это номер в вашей системе учёта</b>У провайдеров VC ID обычно берут из номера услуги или заявки, чтобы по нему можно было найти клиента. Опечатка в одной цифре на одном PE — классическая причина «канал после работ не поднялся». В лабе это поломка 1.</div>
<div class="callout lab"><b>В лабе</b>Поломка 1: на PE2 поменяют VC ID со 100 на 101. Найдёшь её по <code>show mpls l2transport vc detail</code> на обоих PE: каждый ждёт метку для своего VC ID и не получает. <a href="#/c/ch12/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему для псевдопровода не хватает обычного LDP из главы 10?</summary><p>Обычный LDP работает только между соседями по линку, а PE1 и PE2 разделены ядром. Нужна сессия напрямую между PE — targeted LDP, Hello на loopback дальнего PE.</p></details>
<details class="chk"><summary>Проверь себя: что должно совпадать на двух концах псевдопровода?</summary><p>VC ID, MTU подключения клиента и тип подключения (порт или VLAN).</p></details>
<details class="chk"><summary>Проверь себя: PE2 объявил метку 21, PE1 — 17. С какой меткой псевдопровода PE1 отправляет кадры к PE2?</summary><p>С 21 — метку выбирает получатель. Обратно PE2 шлёт кадры с 17.</p></details>`},

{h:'VPWS на практике: настройка, VLAN и проверка', html:`
<h3>Три части настройки</h3>
<p>На каждом PE канал E-Line настраивается из трёх частей. Команды ниже — для IOS-XE (CSR1000v из лабы), но части одни и те же у любого производителя.</p>
<ol class="steps"><li><b>Подключение клиента (AC).</b> Говорим PE, какие кадры относятся к этой услуге: порт Gi3, VLAN 100.</li>
<li><b>Что делать с тегом VLAN.</b> Обычно тег клиента снимают на входе в псевдопровод и ставят обратно на выходе.</li>
<li><b>Псевдопровод.</b> Связываем AC с дальним PE и номером VC ID.</li></ol>
<pre class="cli">interface GigabitEthernet3
 service instance 100 ethernet                 ! 1. AC: кадры с VLAN 100 на этом порту
  encapsulation dot1q 100
  rewrite ingress tag pop 1 symmetric          ! 2. снять тег на входе, вернуть на выходе
l2vpn xconnect context PW100                   ! 3. связать AC с псевдопроводом
 member GigabitEthernet3 service-instance 100
 member 10.255.0.2 100 encapsulation mpls      ! дальний PE (его loopback) и VC ID 100</pre>
<p>На PE2 то же самое, только дальний PE — 10.255.0.1. Обрати внимание: в настройке псевдопровода указан <b>loopback</b> дальнего PE. До него должен быть маршрут в IGP и транспортная метка — то, что ты проверял в главе 10.</p>
<p>На старых IOS то же делается одной строкой на сабинтерфейсе: <code>xconnect 10.255.0.2 100 encapsulation mpls</code>. Её ты тоже встретишь на работе.</p>
<h3>Что происходит с VLAN</h3>
<p>Самое непривычное в L2VPN — работа с тегами. <b>Service instance</b> (у Cisco его ещё называют EFP, Ethernet flow point) работает как фильтр на входе: в услугу попадают только кадры с указанным VLAN. Команда <code>rewrite ingress tag pop 1 symmetric</code> снимает этот тег перед отправкой в псевдопровод, а на обратном пути (symmetric — «зеркально») ставит его снова.</p>
<p>Отсюда полезный эффект: <b>на разных концах канала VLAN могут быть разными</b>. Офис 1 подключён в VLAN 100, офис 2 — в VLAN 300. Каждый PE снимает и ставит свой тег, а клиенты об этом и не знают.</p>
<figure class="dg"><svg viewBox="0 0 320 178" role="img" aria-label="PE1 снимает VLAN 100, внутри псевдопровода кадр без тега, PE2 ставит VLAN 300">
<rect x="94" y="62" width="132" height="16" rx="8" fill="rgba(217,119,6,.16)" stroke="#d97706" stroke-width="1.4" stroke-dasharray="4 3"/>
<path class="ln" d="M50 70 L72 70 M248 70 L270 70"/>
<rect class="bx" x="6" y="58" width="44" height="24" rx="6"/><text class="tx" x="28" y="74" text-anchor="middle">CE1</text>
<rect class="bx" x="72" y="58" width="44" height="24" rx="6"/><text class="tx" x="94" y="74" text-anchor="middle">PE1</text>
<text class="sm" x="160" y="74" text-anchor="middle">ядро</text>
<rect class="bx" x="204" y="58" width="44" height="24" rx="6"/><text class="tx" x="226" y="74" text-anchor="middle">PE2</text>
<rect class="bx" x="270" y="58" width="44" height="24" rx="6"/><text class="tx" x="292" y="74" text-anchor="middle">CE2</text>
<g opacity="0"><rect x="-12" y="-6" width="24" height="12" rx="2" class="b"/><text class="wt" x="0" y="3" text-anchor="middle">кадр</text><animateMotion dur="12s" repeatCount="indefinite" path="M28 46 L292 46" keyPoints="0;0;0.25;0.25;0.75;0.75;1;1" keyTimes="0;0.04;0.18;0.24;0.6;0.66;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.82;0.83;1"/></g>
<g opacity="0"><rect x="-14" y="-21" width="28" height="12" rx="3" class="g"/><text class="wt2" x="0" y="-12" text-anchor="middle">100</text><animateMotion dur="12s" repeatCount="indefinite" path="M28 46 L94 46" keyPoints="0;0;1;1" keyTimes="0;0.04;0.18;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.21;0.22;1"/></g>
<g opacity="0"><rect x="-14" y="-21" width="28" height="12" rx="3" class="o"/><text class="wt2" x="0" y="-12" text-anchor="middle">PW</text><animateMotion dur="12s" repeatCount="indefinite" path="M94 46 L226 46" keyPoints="0;0;1;1" keyTimes="0;0.24;0.6;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.23;0.24;0.62;0.63;1"/></g>
<g opacity="0"><rect x="-14" y="-21" width="28" height="12" rx="3" class="g"/><text class="wt2" x="0" y="-12" text-anchor="middle">300</text><animateMotion dur="12s" repeatCount="indefinite" path="M226 46 L292 46" keyPoints="0;0;1;1" keyTimes="0;0.66;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.64;0.65;0.82;0.83;1"/></g>
<g opacity="0"><text class="sm bt" x="94" y="102" text-anchor="middle">снять 100</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.21;0.22;1"/></g>
<g opacity="0"><text class="sm bt" x="226" y="102" text-anchor="middle">поставить 300</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.63;0.64;1"/></g>
<g opacity="0"><text class="sm" x="160" y="140" text-anchor="middle">Офис 1 живёт в VLAN 100, офис 2 — в VLAN 300,</text><text class="sm gn" x="160" y="156" text-anchor="middle">а для клиента это один и тот же «кабель»</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.84;0.85;1"/></g>
</svg><figcaption>Зелёная наклейка — тег VLAN. PE1 снимает тег 100 и отправляет кадр в псевдопровод без него. PE2 на выходе ставит тег, который ждёт его клиент, — 300. В лабе с обеих сторон VLAN 100, но на работе разные номера на концах встречаются постоянно.</figcaption></figure>
<div class="callout pro"><b>Порт целиком или VLAN</b>Бывает два вида канала. <b>По VLAN</b> (EVPL): клиенту отдают один VLAN на общем порту, а на других VLAN того же порта — другие услуги. <b>Порт целиком</b> (EPL): всё, что пришло в порт, с любыми тегами и без, уходит в канал. Второй вариант честнее «кабель», но занимает порт PE под одного клиента.</div>
<h3>Как проверить канал</h3>
<pre class="cli">PE1#show mpls l2transport vc 100 detail
Local interface: Gi3 up, line protocol up, Eth VLAN 100 up
  Destination address: 10.255.0.2, VC ID: 100, VC status: [[up]]
    Output interface: Gi2, imposed label stack [[{18 21}]]
  Signaling protocol: LDP, peer 10.255.0.2:0 up
    Targeted Hello: 10.255.0.1(LDP Id) -> 10.255.0.2, LDP is UP
    MPLS VC labels: local 17, remote 21
    MTU: local 1500, remote 1500
  Control Word: On
  VC statistics:
    transit packet totals: receive 1520, send 1498</pre>
<p>Читаем сверху вниз — это и есть проверка канала:</p>
<ul><li><b>Local interface … up</b> — подключение клиента живо.</li>
<li><b>VC status: up</b> — псевдопровод поднят.</li>
<li><b>imposed label stack {18 21}</b> — та самая пара меток: 18 транспортная (от P1), 21 — метка псевдопровода от PE2.</li>
<li><b>Targeted Hello … LDP is UP</b> — сессия с дальним PE есть.</li>
<li><b>MPLS VC labels: local 17, remote 21</b> — обменялись метками.</li>
<li><b>MTU: local 1500, remote 1500</b> — совпадает.</li>
<li><b>VC statistics</b> — счётчики кадров. Если они растут в обе стороны, трафик клиента идёт.</li></ul>
<p>Самое удивительное — <b>прозрачность</b>. Если клиент запустит OSPF между CE1 и CE2, соседство поднимется, будто они соединены кабелем. А на PE маршрутов клиента не будет вовсе: PE их не видит, он возит кадры.</p>
<div class="callout lab"><b>В лабе</b>Задание 2: соберёшь E-Line VLAN 100 между PE1 и PE2 и прочитаешь этот вывод на своих метках. Задание 3: запустишь OSPF между CE1 и CE2 через канал, убедишься, что на PE маршрутов клиента нет, и в захвате найдёшь стек из двух меток, а под ним кадр с OSPF Hello. <a href="#/c/ch12/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: из каких трёх частей состоит настройка E-Line на PE?</summary><p>Подключение клиента (порт и VLAN), обработка тега VLAN (снять на входе, вернуть на выходе) и псевдопровод к дальнему PE с номером VC ID.</p></details>
<details class="chk"><summary>Проверь себя: на одном конце канала клиент в VLAN 100, на другом в VLAN 300. Это проблема?</summary><p>Нет. Каждый PE снимает свой тег на входе и ставит нужный на выходе. Внутри псевдопровода кадр едет без тега.</p></details>
<details class="chk"><summary>Проверь себя: что означает строка «imposed label stack {18 21}»?</summary><p>PE1 вешает на кадр две метки: сверху транспортную 18 (до PE2, от соседа P1), снизу метку псевдопровода 21 (её выбрал PE2).</p></details>`},

{h:'Канал не работает: диагностика по шагам', html:`
<h3>Канал — это цепочка</h3>
<p>Заявка «L2-канал не работает» — одна из самых частых у провайдера. Хорошая новость: L2-канал поднимается строго по шагам, и каждый следующий опирается на предыдущий. Найди первый шаг, который не прошёл, — там и поломка.</p>
<ol class="steps"><li><b>Транспорт.</b> Есть маршрут и транспортная метка до loopback дальнего PE (глава 10).</li>
<li><b>Targeted LDP.</b> Сессия между PE поднята.</li>
<li><b>Параметры.</b> VC ID, MTU и тип подключения совпадают — PE обменялись метками.</li>
<li><b>PW up.</b> Псевдопровод поднят.</li>
<li><b>Кадры клиента идут.</b> Порт клиента жив, клиент шлёт кадры с тем VLAN, который ждёт PE.</li></ol>
<figure class="dg"><svg viewBox="0 0 320 262" role="img" aria-label="Пять шагов работы L2-канала; три поломки останавливаются на разных шагах">
<g><text class="tx" x="160" y="20" text-anchor="middle">Поломка 1: на PE2 VC ID 101 вместо 100</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.32;0.33;1"/></g>
<g opacity="0"><text class="tx" x="160" y="20" text-anchor="middle">Поломка 2: PE2 ждёт VLAN 110, CE2 шлёт 100</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.65;0.66;1"/></g>
<g opacity="0"><text class="tx" x="160" y="20" text-anchor="middle">Поломка 3: в настройке чужой адрес PE</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></g>
<rect class="bx" x="8" y="36" width="104" height="24" rx="5"/><text class="tx" x="60" y="52" text-anchor="middle">транспорт</text><text class="sm" x="120" y="52">LSP и метка до PE2 (гл. 10)</text>
<rect class="bx" x="8" y="66" width="104" height="24" rx="5"/><text class="tx" x="60" y="82" text-anchor="middle">targeted LDP</text><text class="sm" x="120" y="82">сессия PE1 ↔ PE2</text>
<rect class="bx" x="8" y="96" width="104" height="24" rx="5"/><text class="tx" x="60" y="112" text-anchor="middle">параметры</text><text class="sm" x="120" y="112">VC ID, MTU, тип совпали</text>
<rect class="bx" x="8" y="126" width="104" height="24" rx="5"/><text class="tx gn" x="60" y="142" text-anchor="middle">PW up</text><text class="sm" x="120" y="142">метки обменяны</text>
<rect class="bx" x="8" y="156" width="104" height="24" rx="5"/><text class="tx" x="60" y="172" text-anchor="middle">кадры идут</text><text class="sm" x="120" y="172">порт up, VLAN совпадает</text>
<rect x="5" y="33" width="110" height="30" rx="7" fill="none" stroke="#2563eb" stroke-width="2.6"><animate attributeName="y" dur="18s" repeatCount="indefinite" values="33;33;63;93;93;33;33;63;93;123;153;153;33;33;63;63" keyTimes="0;0.04;0.08;0.12;0.329;0.33;0.37;0.41;0.45;0.49;0.53;0.659;0.66;0.7;0.74;1"/></rect>
<g opacity="0"><text class="sm rd" x="160" y="208" text-anchor="middle">PW down: каждый PE ждёт метку для своего</text><text class="sm rd" x="160" y="224" text-anchor="middle">VC ID и не получает. Сравни VC ID на обоих PE</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.13;0.14;0.32;0.33;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="208" text-anchor="middle">PW up, а пинга нет: кадры CE2 с VLAN 100</text><text class="sm rd" x="160" y="224" text-anchor="middle">не попадают в услугу. Сравни VLAN на AC</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.65;0.66;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="208" text-anchor="middle">Targeted LDP открывать некуда: проверь адрес</text><text class="sm rd" x="160" y="224" text-anchor="middle">соседа в настройке и маршрут до него</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.75;0.76;1"/></g>
<text class="sm" x="160" y="252" text-anchor="middle">Синяя рамка — до какого шага дошёл канал</text>
</svg><figcaption>Рамка поднимается по шагам, пока канал их проходит. Первая поломка останавливает его на параметрах. Вторая коварнее: псевдопровод up, а трафика нет — сигнализация в порядке, кадры клиента просто не попадают в услугу. Третья обрывается уже на targeted LDP.</figcaption></figure>
<h3>Порядок действий дежурного</h3>
<ol class="steps"><li><code>ping mpls ipv4 10.255.0.2/32</code> с PE1 — жив ли транспорт до дальнего PE.</li>
<li><code>show mpls l2transport vc 100 detail</code> <b>на обоих PE</b>. Смотри: VC status, «LDP is UP», есть ли remote label, MTU local и remote.</li>
<li>Нет LDP-сессии — <code>show mpls ldp neighbor 10.255.0.2</code>. Проверь адрес соседа в настройке, маршрут до него, нет ли ACL на UDP и TCP 646.</li>
<li>Сессия есть, а remote label нет — сравни VC ID, MTU и тип подключения в конфигах обоих PE.</li>
<li>PW up, а у клиента не работает — смотри подключение: порт up, какой VLAN ждёт service instance, какой шлёт клиент, растут ли счётчики VC statistics в обе стороны.</li></ol>
<div class="callout pro"><b>По счётчикам видно, чья сторона</b>Если на PE1 счётчик «send» растёт, а «receive» стоит, — кадры от офиса 1 уходят, а от офиса 2 не приходят. Иди смотреть PE2 и порт CE2. Это быстрее, чем гадать. А если упал порт клиента на PE2, PE2 сообщит об этом PE1, и в выводе на PE1 будет видно, что авария на удалённой стороне.</div>
<h3>Два разных MTU</h3>
<p>С MTU в L2VPN путаются чаще всего, потому что их здесь два.</p>
<ul><li><b>MTU подключения клиента.</b> Его PE сообщают друг другу при обмене метками. Должен <b>совпадать</b> на обоих концах, иначе псевдопровод не поднимется. Это задание 4 в лабе.</li>
<li><b>MTU линков ядра.</b> Должен быть <b>больше</b> всего, что едет внутри. А едет много:</li></ul>
<table><tr><th>Что</th><th>Байт</th></tr>
<tr><td>IP-пакет клиента</td><td>до 1500</td></tr>
<tr><td>Заголовок Ethernet клиента (MAC + тип)</td><td>14</td></tr>
<tr><td>Тег VLAN клиента, если канал «порт целиком»</td><td>4</td></tr>
<tr><td>Control word</td><td>4</td></tr>
<tr><td>Метка псевдопровода</td><td>4</td></tr>
<tr><td>Транспортная метка</td><td>4</td></tr>
<tr><td><b>Итого внутри кадра ядра</b></td><td><b>около 1530</b></td></tr></table>
<p>Если на каком-то линке ядра MTU 1500, псевдопровод будет up (сигнализация маленькая), пинги клиента пройдут, а полноразмерные пакеты молча пропадут. Клиент скажет «канал работает, но файлы не копируются». Поэтому в ядре MPLS — jumbo MTU, как в главе 10.</p>
<div class="callout lab"><b>В лабе</b>Задание 4: поставишь на PE2 MTU 1600 на порту клиента и найдёшь в выводе, почему упал псевдопровод. Поломка 2: VLAN 110 вместо 100 на PE2 — псевдопровод up, а пинга нет. <a href="#/c/ch12/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: псевдопровод up, а клиент говорит «не работает». Куда смотришь?</summary><p>На подключение клиента: порт up, какой VLAN ждёт service instance и какой шлёт клиент. И на счётчики VC statistics: в какую сторону кадры идут, а в какую нет.</p></details>
<details class="chk"><summary>Проверь себя: какой MTU должен совпадать, а какой должен быть больше?</summary><p>MTU подключения клиента должен совпадать на обоих PE. MTU линков ядра должен быть больше кадра с метками, около 1530 байт и выше, обычно jumbo.</p></details>
<details class="chk"><summary>Проверь себя: на PE1 нет remote label, но targeted LDP up. Что сравнишь?</summary><p>VC ID, MTU и тип подключения на обоих PE: если что-то не совпало, PE не принимает метку соседа.</p></details>`},

{h:'VPLS: общая локальная сеть для многих офисов', html:`
<h3>Когда офисов больше двух</h3>
<p>Клиент открыл третий офис и хочет, чтобы все три были в одной локальной сети: любой компьютер видит любой, ARP и широковещательные рассылки ходят между всеми офисами. Двумя «кабелями» тут не обойдёшься: нужен <b>коммутатор</b>, к которому подключены все три офиса. Это и есть <b>VPLS</b> — виртуальный коммутатор, размазанный по сети провайдера.</p>
<p>Как он устроен:</p>
<ul><li>На каждом PE, к которому подключён офис клиента, создаётся <b>экземпляр виртуального коммутатора</b> этого клиента. У Cisco он называется VFI (virtual forwarding instance), в стандарте — VSI. У каждого клиента свой, они друг друга не видят.</li>
<li>Порты этого виртуального коммутатора — подключения клиента (AC) на этом PE и <b>псевдопроводы ко всем остальным PE</b> этого клиента.</li>
<li>Работает он как обычный коммутатор из главы 2: учит MAC-адреса по адресу отправителя, а кадры с неизвестным адресом и широковещательные рассылает во все порты.</li></ul>
<div class="an"><b>Аналогия</b>Три коммутатора в трёх зданиях, соединённые кабелями каждый с каждым, — только коммутаторы виртуальные и живут внутри PE, а кабели — псевдопроводы через ядро. Для клиента это выглядит как один большой коммутатор.</div>
<figure class="dg"><svg viewBox="0 0 320 262" role="img" aria-label="VPLS на трёх PE: широковещательный ARP рассылается по всем псевдопроводам, ответ идёт по одному">
<path d="M106 60 L214 60 M95 72 L150 148 M225 72 L170 148" fill="none" stroke="#d97706" stroke-width="1.8" stroke-dasharray="5 4"/>
<path class="ln" d="M44 60 L62 60 M258 60 L276 60 M160 172 L160 202"/>
<rect class="bx" x="4" y="48" width="40" height="24" rx="6"/><text class="tx" x="24" y="64" text-anchor="middle">CE1</text>
<rect class="bx" x="62" y="48" width="44" height="24" rx="6"/><text class="tx" x="84" y="64" text-anchor="middle">PE1</text>
<rect class="bx" x="214" y="48" width="44" height="24" rx="6"/><text class="tx" x="236" y="64" text-anchor="middle">PE2</text>
<rect class="bx" x="276" y="48" width="40" height="24" rx="6"/><text class="tx" x="296" y="64" text-anchor="middle">CE2</text>
<rect class="bx" x="138" y="148" width="44" height="24" rx="6"/><text class="tx" x="160" y="164" text-anchor="middle">PE3</text>
<rect class="bx" x="140" y="202" width="40" height="24" rx="6"/><text class="tx" x="160" y="218" text-anchor="middle">CE3</text>
<text class="sm og" x="160" y="52" text-anchor="middle">PW</text><text class="sm og" x="104" y="116" text-anchor="end">PW</text><text class="sm og" x="216" y="116">PW</text>
<g opacity="0"><rect x="-13" y="-6" width="26" height="12" rx="2" class="b"/><text class="wt" x="0" y="3" text-anchor="middle">ARP</text><animateMotion dur="16s" repeatCount="indefinite" path="M24 36 L84 36" keyPoints="0;0;1;1" keyTimes="0;0.03;0.1;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.11;0.12;1"/></g>
<g opacity="0"><rect x="-13" y="-6" width="26" height="12" rx="2" class="b"/><text class="wt" x="0" y="3" text-anchor="middle">ARP</text><animateMotion dur="16s" repeatCount="indefinite" path="M84 36 L236 36 L296 36" keyPoints="0;0;0.717;0.717;1;1" keyTimes="0;0.12;0.3;0.32;0.4;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.11;0.12;0.41;0.42;1"/></g>
<g opacity="0"><rect x="-13" y="-6" width="26" height="12" rx="2" class="b"/><text class="wt" x="0" y="3" text-anchor="middle">ARP</text><animateMotion dur="16s" repeatCount="indefinite" path="M84 60 L160 160 L160 214" keyPoints="0;0;0.701;0.701;1;1" keyTimes="0;0.12;0.3;0.32;0.4;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.11;0.12;0.41;0.42;1"/></g>
<g opacity="0"><rect x="-15" y="-6" width="30" height="12" rx="2" class="g"/><text class="wt" x="0" y="3" text-anchor="middle">ответ</text><animateMotion dur="16s" repeatCount="indefinite" path="M160 214 L160 160 L84 60 L24 60" keyPoints="0;0;0.225;0.225;0.75;0.75;1;1" keyTimes="0;0.5;0.56;0.58;0.76;0.78;0.86;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.49;0.5;0.87;0.88;1"/></g>
<g><text class="sm" x="160" y="242" text-anchor="middle">ARP от CE1 — всем: PE1 рассылает его</text><text class="sm" x="160" y="256" text-anchor="middle">по всем псевдопроводам своего клиента</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.47;0.48;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="242" text-anchor="middle">PE3 уже знает: MAC CE1 — за PW к PE1.</text><text class="sm gn" x="160" y="256" text-anchor="middle">Ответ идёт только туда, а не всем</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.48;0.49;1"/></g>
<g opacity="0"><text class="sm og" x="288" y="92" text-anchor="middle">запомнил:</text><text class="sm og" x="288" y="106" text-anchor="middle">CE1 за PE1</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.3;0.31;1"/></g>
</svg><figcaption>Оранжевый пунктир — псевдопроводы, каждый PE связан с каждым. CE1 спрашивает ARP «кто 10.200.0.3?» — это широковещательный кадр, и PE1 рассылает его по обоим псевдопроводам. PE2 и PE3 по пути запоминают: MAC CE1 — за псевдопроводом к PE1. Ответ CE3 адресован одному CE1, и PE3 отправляет его только в один псевдопровод.</figcaption></figure>
<p>Таблица MAC-адресов у каждого PE своя для каждого клиента. В строке — либо подключение клиента на этом PE, либо псевдопровод к другому PE:</p>
<pre class="cli">PE1#show bridge-domain 200
Bridge-domain 200 (3 ports in all)
State: UP                    Mac learning: Enabled
    GigabitEthernet3 service instance 200
    vfi VPLS200 neighbor 10.255.0.2 200
    vfi VPLS200 neighbor 10.255.0.3 200
   MAC address    Policy  Tag       Age  Pseudoport
   [[5000.0005.0000]] forward dynamic   297  GigabitEthernet3.EFP200      ! CE1 — свой порт
   [[5000.0006.0000]] forward dynamic   295  VPLS200 10.255.0.2, 200      ! CE2 — за PW к PE2
   [[5000.0007.0000]] forward dynamic   290  VPLS200 10.255.0.3, 200      ! CE3 — за PW к PE3</pre>
<p>Настройка тоже из знакомых частей: виртуальный коммутатор с номером VPN и списком соседей-PE, а к нему подключение клиента.</p>
<pre class="cli">l2vpn vfi context VPLS200
 vpn id 200
 member 10.255.0.2 encapsulation mpls     ! псевдопровод к PE2
 member 10.255.0.3 encapsulation mpls     ! псевдопровод к PE3
bridge-domain 200
 member GigabitEthernet3 service-instance 200
 member vfi VPLS200</pre>
<div class="callout pro"><b>Чужие MAC-адреса теперь на PE</b>В VPLS провайдер учит MAC-адреса клиента — на PE, не на P. Если у клиента сотни компьютеров или петля, таблицы PE раздуваются. Поэтому на услугах E-LAN почти всегда ставят ограничение числа MAC-адресов на клиента и storm-control на порту клиента: широковещательный шторм у клиента не должен уходить во все его офисы и нагружать PE.</div>
<div class="callout lab"><b>В лабе</b>Задание 5: соберёшь E-LAN VLAN 200 на трёх PE и проверишь, что CE1, CE2 и CE3 видят друг друга в 10.200.0.0/24. Потом посмотришь MAC-таблицу на PE1: какие адреса выучены на своём порту, какие — за псевдопроводами. <a href="#/c/ch12/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: чем VPLS отличается от VPWS?</summary><p>VPWS — точка-точка, «кабель» между двумя офисами, MAC не учится. VPLS — многоточка, виртуальный коммутатор: учит MAC-адреса и рассылает неизвестные и широковещательные кадры по всем псевдопроводам клиента.</p></details>
<details class="chk"><summary>Проверь себя: что записано в MAC-таблице PE в VPLS?</summary><p>MAC-адрес и где он: на своём подключении клиента или за псевдопроводом к такому-то PE.</p></details>
<details class="chk"><summary>Проверь себя: как PE3 узнал, что CE1 находится за PE1?</summary><p>По адресу отправителя в ARP-запросе от CE1, который пришёл к нему из псевдопровода от PE1, — как обычный коммутатор учит MAC по входящим кадрам.</p></details>`},

{h:'Split horizon: почему каждый PE связан с каждым', html:`
<h3>Петля без STP</h3>
<p>В главе 4 ты видел, что коммутаторы, соединённые треугольником, устраивают широковещательный шторм, если нет STP. В VPLS псевдопроводы тоже соединяют PE треугольником. Почему тогда шторма нет?</p>
<p>Потому что у VPLS есть одно жёсткое правило — <b>split horizon</b> (расщеплённый горизонт): <b>кадр, пришедший из псевдопровода, никогда не отправляется в другой псевдопровод</b>. Только в подключения клиентов на этом PE.</p>
<p>Почему это работает? Каждый PE связан псевдопроводом с <b>каждым</b>. Значит, когда PE1 рассылает кадр, он сам отправляет его всем остальным PE напрямую. Пересылать его дальше никому не нужно — у всех он уже есть. А раз никто не пересылает, кадру негде ходить по кругу.</p>
<figure class="dg"><svg viewBox="0 0 320 262" role="img" aria-label="Split horizon: кадр из псевдопровода не уходит в другой псевдопровод; без одного псевдопровода офис становится недостижим">
<path d="M106 60 L214 60 M95 72 L150 148" fill="none" stroke="#d97706" stroke-width="1.8" stroke-dasharray="5 4"/>
<path d="M225 72 L170 148" fill="none" stroke="#d97706" stroke-width="1.8" stroke-dasharray="5 4"><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0.2;0.2" keyTimes="0;0.49;0.5;1"/></path>
<path class="ln" d="M44 60 L62 60 M258 60 L276 60 M160 172 L160 202"/>
<rect class="bx" x="4" y="48" width="40" height="24" rx="6"/><text class="tx" x="24" y="64" text-anchor="middle">CE1</text>
<rect class="bx" x="62" y="48" width="44" height="24" rx="6"/><text class="tx" x="84" y="64" text-anchor="middle">PE1</text>
<rect class="bx" x="214" y="48" width="44" height="24" rx="6"/><text class="tx" x="236" y="64" text-anchor="middle">PE2</text>
<rect class="bx" x="276" y="48" width="40" height="24" rx="6"/><text class="tx" x="296" y="64" text-anchor="middle">CE2</text>
<rect class="bx" x="138" y="148" width="44" height="24" rx="6"/><text class="tx" x="160" y="164" text-anchor="middle">PE3</text>
<rect class="bx" x="140" y="202" width="40" height="24" rx="6"/><text class="tx" x="160" y="218" text-anchor="middle">CE3</text>
<g opacity="0"><path class="lr" d="M191 103 L205 117 M205 103 L191 117"/><text class="sm rd" x="212" y="134">PW удалён</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><rect x="-13" y="-6" width="26" height="12" rx="2" class="b"/><animateMotion dur="16s" repeatCount="indefinite" path="M84 36 L236 36" keyPoints="0;0;1;1" keyTimes="0;0.04;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.21;0.22;1"/></g>
<g opacity="0"><rect x="-13" y="-6" width="26" height="12" rx="2" class="b"/><animateMotion dur="16s" repeatCount="indefinite" path="M84 60 L160 160" keyPoints="0;0;1;1" keyTimes="0;0.04;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.21;0.22;1"/></g>
<g opacity="0"><rect x="-13" y="-6" width="26" height="12" rx="2" class="b"/><animateMotion dur="16s" repeatCount="indefinite" path="M236 60 L200 108" keyPoints="0;0;1;1" keyTimes="0;0.24;0.34;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.23;0.24;0.36;0.37;1"/></g>
<g opacity="0"><path class="lr" d="M190 100 L204 114 M204 100 L190 114"/><text class="sm rd" x="212" y="100">из PW в PW —</text><text class="sm rd" x="212" y="114">нельзя</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.34;0.35;0.48;0.49;1"/></g>
<g opacity="0"><rect x="-13" y="-6" width="26" height="12" rx="2" class="g"/><animateMotion dur="16s" repeatCount="indefinite" path="M296 36 L236 36 L84 36" keyPoints="0;0;0.283;0.283;1;1" keyTimes="0;0.53;0.58;0.6;0.74;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.52;0.53;0.75;0.76;1"/></g>
<g opacity="0"><path class="lr" d="M108 98 L122 112 M122 98 L108 112"/><text class="sm rd" x="104" y="134" text-anchor="end">в PW к PE3 —</text><text class="sm rd" x="104" y="148" text-anchor="end">нельзя</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.76;0.77;1"/></g>
<g><text class="sm" x="160" y="242" text-anchor="middle">PE1 сам разослал кадр всем PE. PE2 получил его из PW</text><text class="sm" x="160" y="256" text-anchor="middle">и в другой PW не пересылает — петли нет</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.49;0.5;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="242" text-anchor="middle">Без PW PE2–PE3 кадр CE2 доходит до PE1,</text><text class="sm rd" x="160" y="256" text-anchor="middle">но дальше его не пускает то же правило: CE3 недостижим</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Сверху — как правило защищает от петли: PE2 не пересылает кадр из псевдопровода в псевдопровод. Снизу — обратная сторона: если убрать псевдопровод PE2–PE3, кадр от CE2 может попасть к PE3 только через PE1, а PE1 его туда не пустит. Поэтому полная сетка псевдопроводов обязательна.</figcaption></figure>
<h3>Обратная сторона правила</h3>
<p>Split horizon работает, только если сетка полная. Если псевдопровода между PE2 и PE3 нет, кадр от офиса 2 к офису 3 мог бы пойти через PE1, но PE1 не имеет права переслать его из псевдопровода в псевдопровод. Офисы 2 и 3 друг друга не увидят, хотя оба видят офис 1. На смене это выглядит странно: «с первым офисом всё работает, а второй с третьим не видят друг друга». Первое, что проверяешь, — все ли псевдопроводы VPLS на месте.</p>
<h3>Цена полной сетки</h3>
<p>Псевдопроводов нужно N×(N−1)/2: для 3 PE — 3, для 10 — 45, для 50 — 1225, и каждый добавляется руками на каждом PE. Для больших сетей придумали обходы:</p>
<ul><li><b>H-VPLS</b> (иерархический): маленькие PE доступа подключаются одним псевдопроводом к большому PE агрегации, а полная сетка — только между большими.</li>
<li><b>Автообнаружение через BGP</b>: PE сами находят друг друга, руками ничего не перечисляют. Это после главы 8.</li>
<li><b>EVPN</b> — современная замена VPLS, глава 12.1. О ней в последнем разделе.</li></ul>
<div class="callout lab"><b>В лабе</b>Задание 6: посмотришь, где PE1 выучил MAC-адреса CE2 и CE3, потом удалишь псевдопровод PE2–PE3 и убедишься, что CE2 перестал видеть CE3. И объяснишь через split horizon, почему так. <a href="#/c/ch12/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: сформулируй правило split horizon в VPLS.</summary><p>Кадр, пришедший из псевдопровода, не отправляется в другой псевдопровод — только в подключения клиентов на этом PE.</p></details>
<details class="chk"><summary>Проверь себя: почему в VPLS нет петель без STP?</summary><p>Каждый PE связан псевдопроводом с каждым и сам рассылает кадр всем. Split horizon запрещает пересылку между псевдопроводами, поэтому кадру негде ходить по кругу.</p></details>
<details class="chk"><summary>Проверь себя: офис 1 видит офисы 2 и 3, а 2 и 3 друг друга не видят. Что проверишь первым?</summary><p>Псевдопровод между PE2 и PE3: без него полная сетка нарушена, а через PE1 кадры не пройдут из-за split horizon.</p></details>`},

{h:'Глазами провайдера: заявки, петли и проверка канала', html:`
<h3>Типичные заявки по L2-каналам</h3>
<table><tr><th>Клиент говорит</th><th>Что обычно оказывается</th><th>Где смотреть</th></tr>
<tr><td>«Канал не поднимается после работ»</td><td>VC ID, MTU, адрес соседа или VLAN поменяли на одном конце</td><td>show mpls l2transport vc detail на обоих PE (раздел 5)</td></tr>
<tr><td>«Канал есть, а пинга нет»</td><td>VLAN на подключении не совпадает с тем, что шлёт клиент</td><td>service instance на PE и настройка CE</td></tr>
<tr><td>«Пинг идёт, файлы не копируются»</td><td>большие кадры не пролезают через ядро</td><td>MTU линков ядра, ping с df-bit большим размером</td></tr>
<tr><td>«Офис 1 видит всех, а 2 и 3 друг друга — нет»</td><td>в VPLS не хватает псевдопровода</td><td>список соседей VPLS на PE (раздел 7)</td></tr>
<tr><td>«Всё тормозит и мигает у всех офисов»</td><td>петля в сети клиента</td><td>счётчики широковещательных кадров, MAC-таблица прыгает</td></tr></table>
<h3>Петля у клиента — ваша проблема тоже</h3>
<p>Клиент на своей стороне может по ошибке соединить два порта своих коммутаторов, которые оба смотрят в E-LAN. Получится петля через вашу сеть: широковещательный кадр бесконечно ходит по кругу, через все офисы клиента и через PE. MAC-адреса клиента «прыгают» между портами в MAC-таблице PE, загрузка растёт.</p>
<p>STP клиента провайдер обычно просто перевозит, как любые другие кадры, поэтому если у клиента STP включён, он петлю разорвёт сам. Но рассчитывать на это нельзя. Поэтому на портах клиентов ставят защиту: <b>storm-control</b> (ограничение широковещательного трафика) и <b>лимит MAC-адресов</b> на услугу. Шторм одного клиента не должен влиять на остальных.</p>
<div class="callout pro"><b>Где граница ответственности</b>Провайдер отвечает за канал от своего порта до своего порта. Всё, что за портом клиента, — его. Поэтому при разборе заявки важно доказать, что канал работает до порта: псевдопровод up, счётчики растут в обе стороны, MAC клиента выучены. Для этого есть специальные средства проверки, о них ниже.</div>
<h3>Как проверить L2-канал «как клиент»: CFM</h3>
<p>Пинг по IP в L2-канале провайдер сделать не может: IP-адресов клиента у него нет. Для этого есть <b>Ethernet OAM</b> — проверка на уровне кадров. Главный инструмент — <b>CFM</b> (connectivity fault management, стандарт IEEE 802.1ag):</p>
<ul><li>На концах услуги (на PE) ставят точки контроля — <b>MEP</b> (maintenance end point).</li>
<li>MEP раз в секунду или чаще шлют друг другу <b>CCM</b> — короткие кадры-пульс «я жив». Пропали CCM — канал сломан, и PE сам поднимает аварию, даже если псевдопровод up.</li>
<li>Есть L2-пинг (<b>loopback</b>) и L2-трассировка (<b>linktrace</b>) — как ping и traceroute, только по MAC.</li>
<li>Дополнение <b>Y.1731</b> меряет задержку и потери кадров. По нему провайдер показывает клиенту, что SLA соблюдается.</li></ul>
<div class="an"><b>Аналогия</b>Две рации на концах кабеля, которые каждую секунду говорят друг другу «приём». Перестал слышать напарника — кабель порван, даже если оба конца выглядят подключёнными.</div>
<div class="callout lab"><b>В лабе</b>Раздел «Со звёздочкой»: настроишь CFM на E-Line между PE1 и PE2, посмотришь удалённую точку контроля и выключишь порт на PE2 — PE1 узнает об аварии по пропаже CCM. <a href="#/c/ch12/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему провайдер не может проверить L2-канал обычным ping?</summary><p>У провайдера нет IP-адресов клиента: канал переносит кадры. Проверяют средствами Ethernet OAM — CFM: CCM-пульс, L2-пинг и L2-трассировку между точками контроля на PE.</p></details>
<details class="chk"><summary>Проверь себя: зачем на порту клиента storm-control и лимит MAC?</summary><p>Чтобы петля или шторм в сети клиента не нагружали PE и не мешали другим клиентам.</p></details>`},

{h:'L2VPN или L3VPN — и что будет дальше', html:`
<h3>Сравним две услуги</h3>
<p>На следующей неделе у тебя L3VPN. Чтобы новая глава легла на готовое место, сравним, чем они отличаются.</p>
<table><tr><th></th><th>L2VPN (эта глава)</th><th>L3VPN (глава 11)</th></tr>
<tr><td>Что везёт провайдер</td><td>кадры Ethernet</td><td>IP-пакеты</td></tr>
<tr><td>Знает ли PE IP-сети клиента</td><td>нет</td><td>да, в отдельной таблице клиента (VRF)</td></tr>
<tr><td>Кто маршрутизирует между офисами</td><td>клиент сам</td><td>провайдер</td></tr>
<tr><td>Какие протоколы может гонять клиент</td><td>любые, даже не IP</td><td>IP</td></tr>
<tr><td>Широковещательный домен</td><td>общий на все офисы (в VPLS)</td><td>в каждом офисе свой</td></tr>
<tr><td>Как PE узнают друг о друге и метки</td><td>targeted LDP</td><td>BGP</td></tr>
<tr><td>Сколько меток на пакете</td><td>две: транспорт + псевдопровод</td><td>две: транспорт + метка клиента</td></tr></table>
<p>Обрати внимание на последнюю строку: <b>стек из двух меток устроен одинаково</b>. Верхняя везёт через ядро, нижняя говорит выходному PE, кому отдать. Разница только в том, кто раздаёт нижнюю метку: в L2VPN — targeted LDP, в L3VPN — BGP. Поэтому в книгу главы 11 я вставлю «BGP в объёме L3VPN»: ровно столько BGP, сколько нужно, чтобы понять, откуда берётся нижняя метка и маршруты клиента.</p>
<h3>EVPN: куда движутся L2-услуги</h3>
<p>У VPLS три больших недостатка: полная сетка псевдопроводов, MAC-адреса учатся только по проходящим кадрам (сначала всё рассылается всем), и клиента нельзя надёжно подключить к двум PE сразу так, чтобы оба работали. Современная замена — <b>EVPN</b>: MAC-адреса клиентов PE сообщают друг другу через BGP, как маршруты. Полная сетка не нужна, лишних рассылок меньше, клиента можно подключить к двум PE одновременно. Это глава 12.1 — после BGP.</p>
<div class="callout pro"><b>Что у тебя на работе</b>Узнай, как в вашей сети делают L2-каналы для бизнеса: растянутым VLAN/QinQ, псевдопроводами на MPLS или уже EVPN. От этого зависит, что ты будешь смотреть по заявке «канал не работает».</div>

<details class="chk"><summary>Проверь себя: что общего у стека меток в L2VPN и L3VPN?</summary><p>В обоих по две метки: верхняя — транспортная до выходного PE, нижняя говорит выходному PE, кому отдать пакет или кадр. Отличается, кто раздаёт нижнюю метку: targeted LDP в L2VPN, BGP в L3VPN.</p></details>
<details class="chk"><summary>Проверь себя: клиент хочет сам управлять маршрутизацией между офисами и гонять свой OSPF. Какую услугу ему предложить?</summary><p>L2VPN: E-Line для двух офисов или E-LAN для нескольких. Провайдер везёт кадры и в маршрутизацию клиента не вмешивается.</p></details>`}
],
end: `<h3>Что ты теперь знаешь</h3>
<p>L2-канал — это «кабель через город»: провайдер переносит кадры Ethernet клиента целиком и не знает его IP. Раньше для этого растягивали VLAN через все коммутаторы, сейчас кадр упаковывают под две метки MPLS. Верхняя — транспортная из главы 10: её выбирает PE по следующему хопу IGP, а предпоследний P снимает (PHP). Нижняя — метка псевдопровода: её выбирает дальний PE и сообщает по targeted LDP, прямой сессии между PE через ядро. Чтобы псевдопровод поднялся, на обоих концах должны совпасть VC ID, MTU подключения и его тип. Канал поднимается по шагам: транспорт → targeted LDP → параметры → PW up → кадры клиента; где застрял — там и ищешь. VPWS (E-Line) соединяет два офиса, VPLS (E-LAN) — несколько: это виртуальный коммутатор с полной сеткой псевдопроводов, а петли без STP не даёт правило split horizon.</p>
<div class="callout ok"><b>Посмотри у себя на работе</b><ol><li>Найди любую услугу «L2-канал» в вашей системе учёта и посмотри, как она сделана: VLAN/QinQ, псевдопровод или EVPN.</li><li>Если есть псевдопроводы — выполни на PE <code>show mpls l2transport vc</code> (или аналог у вашего производителя) и найди VC ID, состояние и метки.</li><li>Спроси, ставят ли у вас storm-control и лимит MAC на порты клиентов L2-услуг.</li></ol></div>
<p>Дальше по главе: карточки, тест (кнопка «🤷 Не знаю» на месте), «Объясни своими словами» и лаба — E-Line и E-LAN на трёх PE, MTU, split horizon и две поломки. А следующая глава — MPLS L3VPN, и начнётся она с BGP в нужном объёме.</p>`
};
