// Книжный текст главы 6 СДСМ (компьютер): OSPF и IS-IS. Формат как у ch02–ch05, блоки .callout.lab ведут в лабу «Сибирское кольцо».
// Стиль: от работы (кольцо, аварии, «сосед не поднимается»); одно понятие за раз; аналогии; «Проверь себя»; SPF считаем руками.
// Факты: RFC 2328 (OSPFv2: состояния, LSA, SPF, DR), RFC 3101 (NSSA), ISO/IEC 10589 + RFC 1195 (IS-IS), RFC 5305 (wide metrics),
// RFC 5880/5881 (BFD, UDP 3784), RFC 5286 (LFA); Cisco IOS: AD OSPF 110, IS-IS 115; Doyle, Routing TCP/IP Vol. I.
window.BOOK = window.BOOK || {};
BOOK.ch06 = {
title: 'Динамическая маршрутизация: OSPF и IS-IS',
lead: `<p>В главе 3 ты прописывал маршруты руками: «сеть такая-то — через соседа такого-то». В маленьком офисе так и живут. Но ядро провайдера — это десятки и сотни маршрутизаторов, кольца между городами и аварии каждую неделю. Руками за этим не успеть. Здесь работают протоколы динамической маршрутизации: маршрутизаторы сами рассказывают друг другу о сети и сами пересчитывают пути, когда что-то рвётся.</p>
<p>Эта глава про два таких протокола: <b>OSPF</b> и <b>IS-IS</b>. Они устроены по одному принципу, и разберём мы его на одной сети — «Сибирском кольце» из лабы: Москва, Кемерово, Красноярск, Хабаровск, Владивосток. Главное в главе — не команды, а умение ответить на вопрос, который тебе зададут на смене: <b>«почему сосед не поднимается и куда делся трафик»</b>.</p>
<p>Порядок прежний: раздел в день, анимации можно ставить на паузу, «Проверь себя» в конце раздела, зелёные блоки ведут в лабу. Новое в этой главе — вкладка <b>«🚨 Дежурство»</b>: десять аварий в той же сети, которые ты разбираешь командами show без EVE-NG, прямо с телефона.</p>`,
parts: [

{h:'Зачем маршрутизаторам договариваться', html:`
<h3>Кольцо, которое не спасает само по себе</h3>
<p>Провайдеры строят магистраль кольцами, чтобы один обрыв оптики не отрезал город. Возьмём кольцо из лабы: Москва — Кемерово — Красноярск — Хабаровск — Владивосток — снова Москва. До Красноярска из Москвы два пути: короткий через Кемерово и длинный через Владивосток и Хабаровск.</p>
<p>Но кольцо — это только провода. Чтобы пакет пошёл в обход, маршрутизаторы должны <b>узнать</b> об обрыве и <b>поменять</b> свои таблицы маршрутов. Статический маршрут из главы 3 этого не умеет: он делает ровно то, что в нём написано. Запасной путь пришлось бы прописать руками на каждом узле, а если обрыв случился за транспортным оборудованием и порт остался «поднятым», статика продолжит слать трафик в пустоту.</p>
<figure class="dg"><svg viewBox="0 0 320 242" role="img" aria-label="Кольцо из пяти городов: при обрыве статика теряет пакет, а OSPF уводит его в обход">
<path class="ln" d="M62 104 L98 52"/><path class="ln" d="M142 46 L248 46"/><path class="ln" d="M270 58 L270 162"/><path class="ln" d="M248 174 L142 174"/><path class="ln" d="M98 168 L62 116"/>
<path class="lg" d="M62 116 L98 168 M142 174 L248 174 M270 162 L270 58" opacity="0"><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></path>
<path d="M142 46 L248 46" stroke="#e11d48" stroke-width="2.4" stroke-dasharray="5 4" fill="none" opacity="0"><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.33;0.34;1"/></path>
<g opacity="0"><path class="lr" d="M188 37 L202 55 M202 37 L188 55"/><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.33;0.34;1"/></g>
<rect class="bx" x="18" y="98" width="44" height="24" rx="6"/><text class="tx" x="40" y="114" text-anchor="middle">R1</text><text class="sm" x="40" y="138" text-anchor="middle">Москва</text>
<rect class="bx" x="98" y="34" width="44" height="24" rx="6"/><text class="tx" x="120" y="50" text-anchor="middle">R3</text><text class="sm" x="120" y="26" text-anchor="middle">Кемерово</text>
<rect class="bx" x="248" y="34" width="44" height="24" rx="6"/><text class="tx" x="270" y="50" text-anchor="middle">R4</text><text class="sm" x="270" y="26" text-anchor="middle">Красноярск</text>
<rect class="bx" x="98" y="162" width="44" height="24" rx="6"/><text class="tx" x="120" y="178" text-anchor="middle">R5</text><text class="sm" x="120" y="200" text-anchor="middle">Владивосток</text>
<rect class="bx" x="248" y="162" width="44" height="24" rx="6"/><text class="tx" x="270" y="178" text-anchor="middle">R6</text><text class="sm" x="270" y="200" text-anchor="middle">Хабаровск</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="15s" repeatCount="indefinite" path="M40 110 L120 46 L270 46" keyPoints="0;0;1;1" keyTimes="0;0.04;0.24;1" calcMode="linear"/><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.26;0.27;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="15s" repeatCount="indefinite" path="M40 110 L120 46 L182 46" keyPoints="0;0;1;1" keyTimes="0;0.37;0.52;1" calcMode="linear"/><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.36;0.37;0.56;0.57;1"/></g>
<g opacity="0"><text class="sm rd" x="195" y="72" text-anchor="middle">пакет потерян</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.53;0.54;0.64;0.65;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="15s" repeatCount="indefinite" path="M40 110 L120 174 L270 174 L270 46" keyPoints="0;0;1;1" keyTimes="0;0.70;0.95;1" calcMode="linear"/><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.69;0.7;0.97;1"/></g>
<g><text class="sm" x="160" y="222" text-anchor="middle">Всё цело: Москва → Красноярск</text><text class="sm" x="160" y="236" text-anchor="middle">через Кемерово, коротким путём</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.32;0.33;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="222" text-anchor="middle">Обрыв Кемерово — Красноярск. Статика:</text><text class="sm rd" x="160" y="236" text-anchor="middle">обход никто не прописал, пакет потерян</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.65;0.66;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="222" text-anchor="middle">OSPF: соседи заметили обрыв, все пересчитали</text><text class="sm gn" x="160" y="236" text-anchor="middle">пути, пакет идёт через Владивосток</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></g>
</svg><figcaption>Кольцо из лабы (Питер пока не рисуем). Пока всё цело, трафик идёт коротким путём. При обрыве статический маршрут ничего не знает об обходе. Протокол маршрутизации сам находит длинный путь через Владивосток и Хабаровск.</figcaption></figure>
<h3>Что делает протокол маршрутизации</h3>
<p>Любой протокол маршрутизации делает три вещи, и делает их всё время:</p>
<ol class="steps"><li><b>Находит соседей</b> — маршрутизаторы на другом конце своих линков.</li>
<li><b>Обменивается с ними сведениями о сети</b> — какие есть линки, сети и пути.</li>
<li><b>Считает лучшие маршруты</b> и кладёт их в таблицу маршрутизации (RIB, routing information base). Что-то изменилось — пересчитывает.</li></ol>
<p>Время от аварии до момента, когда все маршрутизаторы снова согласны между собой и трафик идёт по новым путям, называется <b>сходимостью</b> (convergence). Для провайдера это главная характеристика: пока сеть сходится, абоненты в этой части сети без связи. В конце главы разберём, как сократить сходимость с десятков секунд до долей секунды.</p>
<h3>Две философии: слухи и карта</h3>
<p><b>Дистанционно-векторные</b> протоколы (distance-vector, например старый RIP) работают на слухах. Сосед говорит: «до Красноярска два прыжка через меня», и маршрутизатор верит ему на слово, не видя сеть целиком. Просто, но медленно сходится и может зациклить трафик, пока слух идёт по сети.</p>
<p><b>Протоколы состояния каналов</b> (link-state) — это OSPF и IS-IS. Каждый маршрутизатор описывает только себя: «вот мои линки, вот их стоимость». Эти описания рассылаются всем, и у каждого собирается <b>одна и та же карта сети</b>. Пути каждый считает сам по этой карте.</p>
<div class="an"><b>Аналогия</b>Дистанционно-векторный протокол — это дорожные указатели: «Красноярск — 300 км, направо». Ты не знаешь, что за поворотом, просто веришь знаку. Link-state — навигатор с полной картой: у каждого водителя одна и та же карта, и маршрут он прокладывает сам от своей точки. Если где-то закрыли мост, это отмечают на карте у всех, и каждый навигатор сам перестраивает маршрут.</div>
<h3>IGP и место OSPF/IS-IS в сети провайдера</h3>
<p>OSPF и IS-IS — <b>внутренние</b> протоколы (IGP, interior gateway protocol): они работают внутри одной сети, у которой один хозяин. Между сетями разных компаний работает внешний протокол BGP — ему посвящена глава 8.</p>
<div class="callout pro"><b>Что на самом деле лежит в IGP провайдера</b>Не маршруты абонентов и не интернет. В IGP ядра — только адреса самих маршрутизаторов: их loopback'и и линки между ними. Это сотни или тысячи маршрутов, а не миллион. Задача IGP — быстро и надёжно дать связность «каждый маршрутизатор с каждым». Поверх этого работают BGP (глава 8) и MPLS (глава 9). Поэтому, когда ломается IGP, ломается всё сразу: и интернет абонентов, и VPN корпоративных клиентов.</div>
<p>Из главы 3 помни: если один и тот же префикс известен из нескольких источников, побеждает источник с меньшим <b>административным расстоянием</b> (AD): connected 0, static 1, OSPF 110, IS-IS 115. Это пригодится в конце главы, когда будем переезжать с OSPF на IS-IS без простоя.</p>

<details class="chk"><summary>Проверь себя: что такое сходимость и почему провайдеру важно, чтобы она была короткой?</summary><p>Время от аварии до момента, когда все маршрутизаторы пересчитали пути и трафик снова ходит. Всё это время часть абонентов без связи.</p></details>
<details class="chk"><summary>Проверь себя: в чём главное отличие link-state от distance-vector?</summary><p>В link-state у каждого маршрутизатора полная одинаковая карта сети, и пути он считает сам. В distance-vector маршрутизатор знает только то, что ему сказали соседи («до сети X столько-то через меня»).</p></details>
<details class="chk"><summary>Проверь себя: почему в IGP провайдера нет маршрутов абонентов и интернета?</summary><p>IGP отвечает только за связность между маршрутизаторами (loopback'и и линки). Маршруты абонентов и интернета живут в BGP, который опирается на IGP. Так IGP остаётся маленьким и быстро сходится.</p></details>`},

{h:'Link-state: у каждого одна и та же карта', html:`
<h3>Визитка маршрутизатора: LSA</h3>
<p>В OSPF каждый маршрутизатор составляет о себе описание — <b>LSA</b> (link-state advertisement, объявление о состоянии каналов). В нём написано: кто я, какие у меня линки, кто на другом конце каждого линка и сколько стоит линк, какие сети подключены ко мне (например, loopback).</p>
<p>«Кто я» — это <b>Router ID</b> (RID): 32-битный номер, записанный как IP-адрес. По нему маршрутизатор узнают все остальные. RID обязан быть уникальным в сети, поэтому провайдеры всегда задают его явно и делают равным адресу Loopback0 (у Красноярска это 10.255.0.4). Loopback выбирают потому, что он никогда не падает: это виртуальный интерфейс, не привязанный к порту.</p>
<h3>Лавинная рассылка</h3>
<p>Свою LSA маршрутизатор отправляет всем соседям. Каждый сосед кладёт её к себе и пересылает дальше, всем своим соседям, кроме того, от кого получил. Так LSA за доли секунды расходится по всей сети. Это называется <b>лавинной рассылкой</b> (flooding). Чтобы копии не ходили по кругу вечно, у каждой LSA есть номер версии (sequence number): если такая же версия у тебя уже есть, дальше её не шлют.</p>
<figure class="dg"><svg viewBox="0 0 320 246" role="img" aria-label="LSA Красноярска расходится по кольцу, у всех маршрутизаторов собирается одинаковая база">
<path class="ln" d="M62 104 L98 52"/><path class="ln" d="M142 46 L248 46"/><path class="ln" d="M270 58 L270 162"/><path class="ln" d="M248 174 L142 174"/><path class="ln" d="M98 168 L62 116"/>
<rect class="bx" x="18" y="98" width="44" height="24" rx="6"/><text class="tx" x="40" y="114" text-anchor="middle">R1</text><text class="sm" x="40" y="138" text-anchor="middle">Москва</text>
<rect class="bx" x="98" y="34" width="44" height="24" rx="6"/><text class="tx" x="120" y="50" text-anchor="middle">R3</text><text class="sm" x="120" y="26" text-anchor="middle">Кемерово</text>
<rect class="bx" x="248" y="34" width="44" height="24" rx="6"/><text class="tx" x="270" y="50" text-anchor="middle">R4</text><text class="sm" x="270" y="26" text-anchor="middle">Красноярск</text>
<rect class="bx" x="98" y="162" width="44" height="24" rx="6"/><text class="tx" x="120" y="178" text-anchor="middle">R5</text><text class="sm" x="120" y="200" text-anchor="middle">Владивосток</text>
<rect class="bx" x="248" y="162" width="44" height="24" rx="6"/><text class="tx" x="270" y="178" text-anchor="middle">R6</text><text class="sm" x="270" y="200" text-anchor="middle">Хабаровск</text>
<rect x="245" y="31" width="50" height="30" rx="8" fill="none" stroke="#16a34a" stroke-width="2.4" opacity="0"><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.01;0.12;0.13;1"/></rect>
<g opacity="0"><rect x="-13" y="-7" width="26" height="14" rx="3" class="g"/><text class="wt" x="0" y="3" text-anchor="middle">LSA</text><animateMotion dur="12s" repeatCount="indefinite" path="M270 46 L120 46" keyPoints="0;0;1;1" keyTimes="0;0.12;0.32;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.11;0.12;0.32;0.33;1"/></g>
<g opacity="0"><rect x="-13" y="-7" width="26" height="14" rx="3" class="g"/><text class="wt" x="0" y="3" text-anchor="middle">LSA</text><animateMotion dur="12s" repeatCount="indefinite" path="M270 46 L270 174" keyPoints="0;0;1;1" keyTimes="0;0.12;0.32;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.11;0.12;0.32;0.33;1"/></g>
<g opacity="0"><rect x="-13" y="-7" width="26" height="14" rx="3" class="g"/><text class="wt" x="0" y="3" text-anchor="middle">LSA</text><animateMotion dur="12s" repeatCount="indefinite" path="M120 46 L40 110" keyPoints="0;0;1;1" keyTimes="0;0.34;0.52;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.52;0.53;1"/></g>
<g opacity="0"><rect x="-13" y="-7" width="26" height="14" rx="3" class="g"/><text class="wt" x="0" y="3" text-anchor="middle">LSA</text><animateMotion dur="12s" repeatCount="indefinite" path="M270 174 L120 174" keyPoints="0;0;1;1" keyTimes="0;0.34;0.52;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.52;0.53;1"/></g>
<g opacity="0"><rect x="-13" y="-7" width="26" height="14" rx="3" class="gr"/><text class="wt" x="0" y="3" text-anchor="middle">LSA</text><animateMotion dur="12s" repeatCount="indefinite" path="M40 110 L120 174" keyPoints="0;0;1;1" keyTimes="0;0.55;0.72;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.72;0.73;1"/></g>
<g opacity="0"><rect x="-13" y="-7" width="26" height="14" rx="3" class="gr"/><text class="wt" x="0" y="3" text-anchor="middle">LSA</text><animateMotion dur="12s" repeatCount="indefinite" path="M120 174 L40 110" keyPoints="0;0;1;1" keyTimes="0;0.55;0.72;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.72;0.73;1"/></g>
<g opacity="0"><circle cx="146" cy="34" r="6" class="g"/><circle cx="296" cy="162" r="6" class="g"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.32;0.33;1"/></g>
<g opacity="0"><circle cx="66" cy="98" r="6" class="g"/><circle cx="146" cy="162" r="6" class="g"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.52;0.53;1"/></g>
<g><text class="sm" x="160" y="226" text-anchor="middle">Красноярск описал себя в LSA</text><text class="sm" x="160" y="240" text-anchor="middle">и отправил обоим соседям</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.33;0.34;1"/></g>
<g opacity="0"><text class="sm" x="160" y="226" text-anchor="middle">Соседи кладут копию к себе</text><text class="sm" x="160" y="240" text-anchor="middle">и пересылают дальше</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.54;0.55;1"/></g>
<g opacity="0"><text class="sm" x="160" y="226" text-anchor="middle">Москва и Владивосток шлют друг другу копию,</text><text class="sm" x="160" y="240" text-anchor="middle">но она уже есть — дальше её не шлют</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.75;0.76;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="226" text-anchor="middle">Готово: у всех пяти одна и та же</text><text class="sm gn" x="160" y="240" text-anchor="middle">база LSA — одинаковая карта сети</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.76;0.77;1"/></g>
</svg><figcaption>В LSA Красноярска написано примерно так: «Я 10.255.0.4. Сосед Кемерово — линк стоит 100. Сосед Хабаровск — линк стоит 100. Ко мне подключена сеть 10.255.0.4/32». Зелёная точка — маршрутизатор получил LSA. Серые копии уже никому не нужны и дальше не идут.</figcaption></figure>
<h3>LSDB — карта, одинаковая у всех</h3>
<p>Все LSA, которые маршрутизатор получил, плюс его собственная, складываются в <b>LSDB</b> (link-state database, база состояния каналов). Это и есть карта. Главное свойство: <b>внутри одной области у всех маршрутизаторов LSDB одинаковая</b>. Отличаются только таблицы маршрутов, потому что каждый считает пути от себя.</p>
<div class="an"><b>Аналогия</b>Атлас дорог. Диспетчер каждого города присылает всем одну страницу: «мои дороги и их длина». У каждого диспетчера собирается одинаковая папка из пяти страниц. А маршрут каждый прокладывает сам, от своего города. Если в Кемерово закрыли дорогу, кемеровский диспетчер присылает всем новую версию своей страницы, и все меняют её в папке.</div>
<p>Из одинаковости LSDB следует полезная вещь для дежурного: чтобы узнать, что объявляет Красноярск, не нужно заходить на Красноярск. Его LSA лежит на любом маршрутизаторе области.</p>
<pre class="cli">R1#show ip ospf database
            OSPF Router with ID (10.255.0.1) (Process ID 1)
                Router Link States (Area 0)
Link ID         ADV Router      Age         Seq#       Checksum Link count
10.255.0.1      10.255.0.1      412         0x80000007 0x00A1B2 6
10.255.0.3      10.255.0.3      380         0x80000005 0x00C3D4 5
[[10.255.0.4      10.255.0.4      377         0x80000005 0x0051E0 5]]
10.255.0.5      10.255.0.5      405         0x80000004 0x0077F1 5
10.255.0.6      10.255.0.6      390         0x80000004 0x00E2C9 5</pre>
<p>Здесь пять строк — пять «страниц атласа», по одной от каждого маршрутизатора. <b>ADV Router</b> — кто составил LSA, <b>Seq#</b> — номер версии, <b>Age</b> — возраст в секундах. Каждые 30 минут маршрутизатор переиздаёт свою LSA, даже если ничего не менялось, а LSA, которую не обновляли 60 минут, считается мёртвой и удаляется.</p>
<div class="callout pro"><b>Мигающий линк виден по номеру версии</b>Если линк «моргает» (оптика грязная, порт то поднимается, то падает), его хозяин при каждом изменении выпускает новую версию LSA. Seq# этой LSA растёт на глазах, и каждая новая версия заставляет <b>все</b> маршрутизаторы пересчитывать пути. Один плохой порт во Владивостоке нагружает процессоры по всей стране. Поэтому большие сети делят на области (раздел 7) и ставят защиту от слишком частых пересчётов (раздел 9).</div>
<div class="callout lab"><b>В лабе</b>Задание 1: поднимешь OSPF на кольце, увидишь всех соседей в состоянии FULL и все loopback'и в таблице маршрутов. Потом сравни <code>show ip ospf database</code> на Москве и на Хабаровске: список LSA должен совпасть строка в строку. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что лежит в LSA маршрутизатора?</summary><p>Его Router ID, его линки (кто сосед и сколько стоит линк) и подключённые к нему сети, например loopback.</p></details>
<details class="chk"><summary>Проверь себя: почему Router ID задают явно и равным Loopback0?</summary><p>RID должен быть уникальным и не должен меняться. Loopback — виртуальный интерфейс, он не падает вместе с портом, а адреса Lo0 в сети провайдера и так уникальны.</p></details>
<details class="chk"><summary>Проверь себя: у Москвы и Хабаровска одинаковые таблицы маршрутов?</summary><p>Нет. Одинаковые у них LSDB (карта). Таблицы маршрутов разные: каждый считает пути от себя.</p></details>`},

{h:'Метрика и SPF: считаем путь сами', html:`
<h3>Стоимость линка</h3>
<p>У каждого линка в OSPF есть <b>стоимость</b> (cost) — целое число. Стоимость пути — это сумма стоимостей всех линков по дороге. Из всех путей выбирается самый дешёвый. Важная деталь: стоимость задаётся на интерфейсе и считается <b>на выходе</b>. Пакет из Москвы в Кемерово платит стоимость московского интерфейса, а пакет обратно — стоимость кемеровского.</p>
<p>По умолчанию стоимость считается так: <b>опорная скорость / скорость интерфейса</b>. Опорная скорость (reference bandwidth) по умолчанию 100 Мбит/с, и тут подвох: порты 1, 10 и 100 Гбит/с получают одинаковую стоимость 1, ведь меньше единицы она не бывает. Для OSPF такие линки равны, хотя различаются в сто раз.</p>
<p>Поэтому на всех маршрутизаторах ставят <code>auto-cost reference-bandwidth 100000</code> (100 Гбит/с). Тогда 1G = 100, 10G = 10, 100G = 1. Ставить надо <b>везде одинаково</b>, иначе маршрутизаторы будут считать стоимость по разным правилам. Многие провайдеры вообще задают стоимость руками (<code>ip ospf cost</code>), например по длине трассы, чтобы трафик шёл по короткой оптике.</p>
<h3>Алгоритм SPF человеческими словами</h3>
<p>По карте (LSDB) каждый маршрутизатор строит дерево кратчайших путей от себя до всех остальных. Алгоритм называется <b>SPF</b> (shortest path first), его придумал Дейкстра. Он простой, его можно выполнить на бумажке:</p>
<ol class="steps"><li>Себе ставишь 0. Всех своих соседей записываешь в список кандидатов со стоимостью линка до них.</li>
<li>Из кандидатов берёшь <b>самого дешёвого</b>. Его путь окончательный: дешевле уже не будет, ведь все остальные пути и так дороже.</li>
<li>Смотришь его соседей: путь до них = путь до него + стоимость его линка. Если так дешевле, чем записано у кандидата, — исправляешь.</li>
<li>Повторяешь с шага 2, пока кандидаты не кончатся.</li></ol>
<p>Посчитаем на кольце из лабы. Все линки по 100, но кто-то поставил на московском порту в сторону Кемерово стоимость 500. Так делают на время работ, чтобы увести трафик с линка. Как теперь Москва пойдёт в Кемерово?</p>
<figure class="dg"><svg viewBox="0 0 320 304" role="img" aria-label="Пошаговый расчёт SPF от Москвы при стоимости 500 на линке Москва — Кемерово">
<path class="ln" d="M62 104 L98 52"/><path class="ln" d="M142 46 L248 46"/><path class="ln" d="M270 58 L270 162"/><path class="ln" d="M248 174 L142 174"/><path class="ln" d="M98 168 L62 116"/>
<path class="lg" d="M62 116 L98 168" opacity="0" style="stroke-width:4"><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.22;0.23;1"/></path>
<path class="lg" d="M142 174 L248 174" opacity="0" style="stroke-width:4"><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.39;0.4;1"/></path>
<path class="lg" d="M270 162 L270 58" opacity="0" style="stroke-width:4"><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.56;0.57;1"/></path>
<path class="lg" d="M248 46 L142 46" opacity="0" style="stroke-width:4"><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.73;0.74;1"/></path>
<text class="tx rd" x="74" y="76" text-anchor="end">500</text><text class="sm" x="195" y="40" text-anchor="middle">100</text><text class="sm" x="278" y="114">100</text><text class="sm" x="195" y="168" text-anchor="middle">100</text><text class="sm" x="74" y="160" text-anchor="end">100</text>
<rect class="bx" x="18" y="98" width="44" height="24" rx="6"/><text class="tx" x="40" y="114" text-anchor="middle">R1</text><text class="sm" x="40" y="138" text-anchor="middle">Москва</text>
<rect class="bx" x="98" y="34" width="44" height="24" rx="6"/><text class="tx" x="120" y="50" text-anchor="middle">R3</text><text class="sm" x="120" y="26" text-anchor="middle">Кемерово</text>
<rect class="bx" x="248" y="34" width="44" height="24" rx="6"/><text class="tx" x="270" y="50" text-anchor="middle">R4</text><text class="sm" x="270" y="26" text-anchor="middle">Красноярск</text>
<rect class="bx" x="98" y="162" width="44" height="24" rx="6"/><text class="tx" x="120" y="178" text-anchor="middle">R5</text><text class="sm" x="120" y="200" text-anchor="middle">Владивосток</text>
<rect class="bx" x="248" y="162" width="44" height="24" rx="6"/><text class="tx" x="270" y="178" text-anchor="middle">R6</text><text class="sm" x="270" y="200" text-anchor="middle">Хабаровск</text>
<g opacity="0"><circle cx="18" cy="98" r="6" class="g"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.05;0.06;1"/></g>
<g opacity="0"><circle cx="98" cy="162" r="6" class="g"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.22;0.23;1"/></g>
<g opacity="0"><circle cx="292" cy="162" r="6" class="g"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.39;0.4;1"/></g>
<g opacity="0"><circle cx="292" cy="34" r="6" class="g"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.56;0.57;1"/></g>
<g opacity="0"><circle cx="98" cy="34" r="6" class="g"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.73;0.74;1"/></g>
<g opacity="0"><text class="sm og" x="148" y="72">кандидат: 500</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.05;0.06;0.56;0.57;1"/></g>
<g opacity="0"><text class="sm gn" x="148" y="72">400 — дешевле!</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.56;0.57;1"/></g>
<g opacity="0"><text class="sm" x="8" y="222">1. R1 = 0. Кандидаты: R5 = 100, R3 = 500</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.05;0.06;1"/></g>
<g opacity="0"><text class="sm" x="8" y="236">2. Дешевле всех R5 (100). Через него R6 = 200</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.22;0.23;1"/></g>
<g opacity="0"><text class="sm" x="8" y="250">3. Дешевле всех R6 (200). Через него R4 = 300</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.39;0.4;1"/></g>
<g opacity="0"><text class="sm" x="8" y="264">4. Дешевле всех R4 (300). Через него R3 = 400 &lt; 500</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.56;0.57;1"/></g>
<g opacity="0"><text class="sm" x="8" y="278">5. Остался R3 (400). Кандидатов больше нет</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.73;0.74;1"/></g>
<g opacity="0"><text class="tx gn" x="160" y="298" text-anchor="middle">Итог: в соседнее Кемерово — через Владивосток</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.84;0.85;1"/></g>
</svg><figcaption>Зелёный кружок — путь до маршрутизатора окончательный. Зелёные линии — дерево кратчайших путей Москвы. Прямой линк в Кемерово стоит 500, а обход через Владивосток, Хабаровск и Красноярск — 400, поэтому Москва ходит в Кемерово вокруг всего кольца.</figcaption></figure>
<p>Обрати внимание: Кемерово — прямой сосед Москвы, соседство с ним в состоянии FULL, а трафик туда идёт через три других города. Для OSPF это не ошибка, а честная арифметика.</p>
<h3>Туда и обратно — разными путями</h3>
<p>Стоимость 500 стоит только на московском порту. На кемеровском конце того же линка по-прежнему 100. Значит, Кемерово отвечает Москве напрямую. Пути туда и обратно разные, это называется <b>асимметричной маршрутизацией</b>.</p>
<pre class="cli">R1#traceroute 10.255.0.3
  1 10.1.15.1 1 msec 1 msec 1 msec      ! Владивосток
  2 10.1.56.0 2 msec 1 msec 2 msec      ! Хабаровск
  3 10.1.46.0 2 msec 2 msec 2 msec      ! Красноярск
  4 [[10.255.0.3]] 3 msec 2 msec 3 msec     ! Кемерово
R3#traceroute 10.255.0.1
  1 [[10.255.0.1]] 1 msec 1 msec 1 msec     ! сразу Москва</pre>
<div class="callout pro"><b>Забытая стоимость</b>Поднять стоимость линка — обычный способ мягко увести с него трафик перед работами. Забыть её вернуть — частая причина заявок «трафик идёт странно, задержка выросла». Соседство при этом зелёное, ошибок в логах нет. Видно только в <code>show ip ospf interface brief</code> (столбец Cost) и по traceroute. Асимметрия тоже путает дежурных: потери «в одну сторону», а traceroute от абонента и к абоненту показывает разные узлы. Такой случай есть во вкладке «Дежурство».</div>
<p>Если два пути стоят одинаково, OSPF ставит в таблицу оба и делит трафик между ними. Это называется <b>ECMP</b> (equal-cost multi-path), подробно — в дополнительной главе про ECMP.</p>
<div class="callout lab"><b>В лабе</b>Задание 3 — ровно этот расчёт. Сначала по <code>show ip ospf database router</code> посчитаешь на бумаге путь из Москвы в Красноярск, потом сверишься с таблицей маршрутов и traceroute. Затем поставишь стоимость 500 и предскажешь новый путь до проверки. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: стоимость 500 убрали, все линки по 100, но линк Кемерово — Красноярск подняли до 250. Как Москва пойдёт в Красноярск?</summary><p>Через Кемерово: 100 + 250 = 350. Через Владивосток и Хабаровск: 100 + 100 + 100 = 300. Победит обход через Владивосток, хотя он длиннее по числу городов.</p></details>
<details class="chk"><summary>Проверь себя: почему без reference-bandwidth порты 1G и 10G получают одинаковую стоимость?</summary><p>Опорная скорость по умолчанию 100 Мбит/с. 100/1000 и 100/10000 меньше единицы, а стоимость не бывает меньше 1. Оба порта получают 1.</p></details>
<details class="chk"><summary>Проверь себя: на кемеровском порту стоимость 100, на московском — 500. Почему трафик туда и обратно идёт по-разному?</summary><p>Стоимость считается на выходе. Москва выходит через свой порт за 500 и находит обход дешевле. Кемерово выходит через свой порт за 100, и прямой путь для него самый дешёвый.</p></details>`},

{h:'Соседи: как маршрутизаторы знакомятся', html:`
<h3>Hello: «я здесь, и я слышу тебя»</h3>
<p>Прежде чем обмениваться картами, маршрутизаторы должны стать <b>соседями</b>. Для этого каждый маршрутизатор на каждом интерфейсе с OSPF раз в 10 секунд рассылает пакет <b>Hello</b>. OSPF работает прямо поверх IP (номер протокола 89), а Hello уходит на групповой адрес <b>224.0.0.5</b> — «всем OSPF-маршрутизаторам на этом линке».</p>
<p>Если от соседа 40 секунд не было ни одного Hello (это <b>dead interval</b>), сосед считается умершим. Запомни эти 40 секунд: в разделе про сходимость мы будем с ними бороться.</p>
<p>В Hello написано: мой Router ID, номер области (area), мои таймеры hello и dead, флаги области, аутентификация и — главное — <b>список соседей, которых я уже слышу</b>.</p>
<div class="an"><b>Аналогия</b>Связь по рации. Кемерово: «Приём, это Кемерово, слышу: никого». Красноярск: «Это Красноярск, слышу: Кемерово». Кемерово понимает: меня слышат, связь в обе стороны. Отвечает: «Это Кемерово, слышу: Красноярск». Теперь и Красноярск знает, что его слышат. Пока ты не услышал своё имя в ответе, ты не знаешь, доходят ли твои слова.</div>
<h3>Состояния соседства по шагам</h3>
<figure class="dg"><svg viewBox="0 0 320 292" role="img" aria-label="Обмен пакетами при рождении соседства OSPF и состояния на каждом шаге">
<defs><marker id="m6n" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="am"/></marker></defs>
<rect class="bx" x="48" y="6" width="48" height="24" rx="6"/><text class="tx" x="72" y="22" text-anchor="middle">R3</text>
<rect class="bx" x="224" y="6" width="48" height="24" rx="6"/><text class="tx" x="248" y="22" text-anchor="middle">R4</text>
<path class="ln" d="M72 30 L72 288" style="stroke-dasharray:4 4;stroke-width:1.2"/><path class="ln" d="M248 30 L248 288" style="stroke-dasharray:4 4;stroke-width:1.2"/>
<g opacity="0"><path class="ln" d="M74 60 L246 60" marker-end="url(#m6n)"/><text class="sm" x="160" y="54" text-anchor="middle">Hello: я .0.3, слышу: никого</text><text class="sm bt" x="254" y="64">INIT</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.04;0.05;1"/></g>
<g opacity="0"><path class="ln" d="M246 90 L74 90" marker-end="url(#m6n)"/><text class="sm" x="160" y="84" text-anchor="middle">Hello: я .0.4, слышу: .0.3</text><text class="sm bt" x="66" y="94" text-anchor="end">2-WAY</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.14;0.15;1"/></g>
<g opacity="0"><path class="ln" d="M74 120 L246 120" marker-end="url(#m6n)"/><text class="sm" x="160" y="114" text-anchor="middle">Hello: я .0.3, слышу: .0.4</text><text class="sm bt" x="254" y="124">2-WAY</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.24;0.25;1"/></g>
<g opacity="0"><path class="ln" d="M74 150 L246 150" marker-start="url(#m6n)" marker-end="url(#m6n)"/><text class="sm" x="160" y="144" text-anchor="middle">DBD: кто ведёт обмен?</text><text class="sm bt" x="66" y="154" text-anchor="end">EXSTART</text><text class="sm bt" x="254" y="154">EXSTART</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.34;0.35;1"/></g>
<g opacity="0"><path class="ln" d="M74 180 L246 180" marker-start="url(#m6n)" marker-end="url(#m6n)"/><text class="sm" x="160" y="174" text-anchor="middle">DBD: оглавление своей базы</text><text class="sm bt" x="66" y="184" text-anchor="end">EXCHANGE</text><text class="sm bt" x="254" y="184">EXCHANGE</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.44;0.45;1"/></g>
<g opacity="0"><path class="ln" d="M74 210 L246 210" marker-end="url(#m6n)"/><text class="sm" x="160" y="204" text-anchor="middle">LSR: пришли LSA Хабаровска</text><text class="sm bt" x="66" y="214" text-anchor="end">LOADING</text><text class="sm gn" x="254" y="214">FULL</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.54;0.55;1"/></g>
<g opacity="0"><path class="ln" d="M246 240 L74 240" marker-end="url(#m6n)"/><text class="sm" x="160" y="234" text-anchor="middle">LSU: вот она</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.64;0.65;1"/></g>
<g opacity="0"><path class="ln" d="M74 270 L246 270" marker-end="url(#m6n)"/><text class="sm" x="160" y="264" text-anchor="middle">LSAck: получил</text><text class="tx gn" x="66" y="274" text-anchor="end">FULL</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.74;0.75;1"/></g>
</svg><figcaption>Линк Кемерово — Красноярск только что поднялся. Синие слова — в каком состоянии маршрутизатор видит соседа. У Красноярска (R4) и так были все LSA, поэтому после обмена оглавлениями он сразу переходит в FULL. Кемерово (R3) не хватает одной LSA, он её запрашивает (LSR), получает (LSU) и подтверждает (LSAck).</figcaption></figure>
<p>Разберём состояния по порядку. Их стоит знать наизусть, потому что по ним ставится диагноз (следующий раздел).</p>
<ul><li><b>DOWN</b> — от соседа нет Hello.</li>
<li><b>INIT</b> — я получаю Hello соседа, но <b>моего RID в нём нет</b>. Я его слышу, а он меня — нет (или ещё не успел услышать).</li>
<li><b>2-WAY</b> — каждый видит себя в Hello другого. Связь в обе стороны подтверждена.</li>
<li><b>EXSTART</b> — договариваются, кто будет вести обмен базами. Ведущим (master) становится маршрутизатор с большим RID.</li>
<li><b>EXCHANGE</b> — обмениваются пакетами <b>DBD</b> (database description). В них не сами LSA, а только их заголовки: оглавление базы.</li>
<li><b>LOADING</b> — сверив оглавления, каждый запрашивает недостающие или устаревшие LSA пакетом <b>LSR</b> (link-state request) и получает их в <b>LSU</b> (link-state update). Получение подтверждается пакетом <b>LSAck</b>.</li>
<li><b>FULL</b> — базы одинаковые. Только теперь линк попадает в LSA обоих маршрутизаторов и участвует в SPF.</li></ul>
<div class="an"><b>Аналогия</b>Два диспетчера встретились, чтобы сверить атласы. Сначала решают, кто зачитывает (EXSTART). Потом зачитывают друг другу оглавление: «страница Хабаровска, версия 5» (EXCHANGE). Видят, что у одного страница старая, и он просит свежую (LOADING). Когда папки совпали — FULL.</div>
<h3>Что должно совпадать</h3>
<p>Hello принимается, только если у соседей совпадают ключевые параметры. Иначе маршрутизатор молча выбрасывает чужой Hello, и соседства нет.</p>
<table><tr><th>Параметр</th><th>Где проверяется</th><th>Если не совпадает</th></tr>
<tr><td>Номер области (area)</td><td>Hello</td><td>соседа нет, в логе «mismatched area ID»</td></tr>
<tr><td>Таймеры hello и dead</td><td>Hello</td><td>соседа нет</td></tr>
<tr><td>Флаги области (stub, NSSA)</td><td>Hello</td><td>соседа нет</td></tr>
<tr><td>Аутентификация</td><td>Hello</td><td>соседа нет</td></tr>
<tr><td>Подсеть и маска (на broadcast-сети)</td><td>Hello</td><td>соседа нет</td></tr>
<tr><td>MTU интерфейса</td><td>DBD, а не Hello!</td><td>застревают в EXSTART/EXCHANGE</td></tr>
<tr><td>Router ID должен <b>различаться</b></td><td>везде</td><td>соседства нет или LSA «воюют» между собой</td></tr></table>
<p>Здоровый сосед выглядит так:</p>
<pre class="cli">R3#show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
10.255.0.1        0   [[FULL/  -]]        00:00:34    10.1.13.0       GigabitEthernet0/1
10.255.0.4        0   [[FULL/  -]]        00:00:37    10.1.34.1       GigabitEthernet0/2</pre>
<p><b>Neighbor ID</b> — RID соседа, <b>State</b> — состояние (прочерк после косой черты значит, что на линке нет выборов DR, об этом в разделе 6), <b>Dead Time</b> — сколько осталось до объявления соседа мёртвым. Каждый Hello снова ставит его на 40 секунд, поэтому в норме это число бегает между 30 и 40.</p>
<div class="callout lab"><b>В лабе</b>Задание 2: включишь на Кемерово <code>debug ip ospf adj</code>, положишь и поднимешь линк в Красноярск и прочитаешь в выводе все переходы состояний: кто стал master и почему, где DBD, где LSR и LSU. Этот вывод полезно увидеть своими глазами хотя бы раз. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: сосед в состоянии INIT. Что это значит?</summary><p>Я получаю его Hello, но в них нет моего RID: мои Hello до него не доходят (или он их выбрасывает). Связь в одну сторону.</p></details>
<details class="chk"><summary>Проверь себя: что передают в DBD и зачем, если потом всё равно шлют LSU?</summary><p>В DBD только заголовки LSA — оглавление. По нему каждый понимает, каких LSA у него нет или какие устарели, и запрашивает только их. Так не гоняют всю базу целиком.</p></details>
<details class="chk"><summary>Проверь себя: какой параметр проверяется не в Hello, а позже, и в каком состоянии из-за него застревают?</summary><p>MTU. Он передаётся в DBD, поэтому при несовпадении Hello проходят, а соседи застревают в EXSTART/EXCHANGE.</p></details>`},

{h:'Диагноз по состоянию: где застряли — там и ищи', html:`
<h3>Главное умение дежурного</h3>
<p>Самая частая заявка по OSPF звучит так: «сосед не поднимается». Новичок начинает перебирать всё подряд. Опытный инженер сначала смотрит, <b>в каком состоянии</b> сосед. Состояние показывает последний шаг, который прошёл успешно. Значит, поломка — в следующем шаге, и искать надо только там.</p>
<figure class="dg"><svg viewBox="0 0 320 276" role="img" aria-label="Лестница состояний OSPF: на какой ступени застряли, такую причину и ищем">
<g opacity="1"><text class="tx" x="160" y="20" text-anchor="middle">Сценарий 1: в Красноярске поставили MTU 9216</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.32;0.33;1"/></g>
<g opacity="0"><text class="tx" x="160" y="20" text-anchor="middle">Сценарий 2: в Кемерово ACL режет OSPF</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.65;0.66;1"/></g>
<g opacity="0"><text class="tx" x="160" y="20" text-anchor="middle">Сценарий 3: hello 5 с с одной стороны</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></g>
<rect class="bx" x="8" y="36" width="104" height="24" rx="5"/><text class="tx" x="60" y="52" text-anchor="middle">нет соседа</text><text class="sm" x="120" y="52">area, таймеры, passive, ACL</text>
<rect class="bx" x="8" y="66" width="104" height="24" rx="5"/><text class="tx" x="60" y="82" text-anchor="middle">INIT</text><text class="sm" x="120" y="82">мои Hello не доходят до соседа</text>
<rect class="bx" x="8" y="96" width="104" height="24" rx="5"/><text class="tx" x="60" y="112" text-anchor="middle">2-WAY</text><text class="sm" x="120" y="112">у DROTHER на broadcast — норма</text>
<rect class="bx" x="8" y="126" width="104" height="24" rx="5"/><text class="tx" x="60" y="142" text-anchor="middle">EXSTART</text><text class="sm" x="120" y="142">(и EXCHANGE): MTU, дубль RID</text>
<rect class="bx" x="8" y="156" width="104" height="24" rx="5"/><text class="tx" x="60" y="172" text-anchor="middle">LOADING</text><text class="sm" x="120" y="172">битые или огромные LSA — редко</text>
<rect class="bx" x="8" y="186" width="104" height="24" rx="5"/><text class="tx gn" x="60" y="202" text-anchor="middle">FULL</text><text class="sm" x="120" y="202">базы одинаковые</text>
<rect class="bx" x="8" y="216" width="104" height="24" rx="5"/><text class="tx" x="60" y="232" text-anchor="middle">FULL, но…</text><text class="sm" x="120" y="232">маршрутов нет: тип сети, cost</text>
<rect x="5" y="33" width="110" height="30" rx="7" fill="none" stroke="#2563eb" stroke-width="2.6"><animate attributeName="y" dur="18s" repeatCount="indefinite" values="33;33;63;93;123;123;33;33;63;63;33;33" keyTimes="0;0.06;0.1;0.14;0.18;0.329;0.33;0.39;0.43;0.659;0.66;1"/></rect>
<g opacity="0"><text class="sm rd" x="160" y="258" text-anchor="middle">Застряли в EXSTART/EXCHANGE: Hello проходят,</text><text class="sm rd" x="160" y="272" text-anchor="middle">а DBD отвергают. Сравни MTU на обоих концах</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.19;0.2;0.32;0.33;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="258" text-anchor="middle">Красноярск видит Кемерово в INIT, Кемерово не видит</text><text class="sm rd" x="160" y="272" text-anchor="middle">никого: его вход режет Hello. Ищи ACL на входе</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.44;0.45;0.65;0.66;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="258" text-anchor="middle">Соседа нет вообще: Hello выбрасываются сразу.</text><text class="sm rd" x="160" y="272" text-anchor="middle">Сравни таймеры: show ip ospf interface</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.7;0.71;1"/></g>
</svg><figcaption>Синяя рамка поднимается по ступеням, пока соседство проходит шаги. Где она остановилась, там и поломка. Справа — что обычно мешает пройти именно эту ступень.</figcaption></figure>
<h3>Порядок действий</h3>
<ol class="steps"><li><b>Посмотри с обеих сторон.</b> <code>show ip ospf neighbor</code> на обоих маршрутизаторах. Если один видит соседа в INIT, а другой не видит никого, это уже половина диагноза: связь работает в одну сторону.</li>
<li><b>Соседа нет совсем.</b> Жив ли линк: <code>ping</code> адреса соседа. Включён ли OSPF на интерфейсе и в той ли области: <code>show ip ospf interface brief</code>. Таймеры, тип сети, passive: <code>show ip ospf interface Gi0/2</code>. Строка «No Hellos (Passive interface)» означает, что Hello на этом порту не отправляются вообще.</li>
<li><b>INIT.</b> Мои Hello не доходят до соседа: входной ACL у соседа, линк работает в одну сторону, проблемы с групповой рассылкой на транспорте.</li>
<li><b>EXSTART или EXCHANGE.</b> Сравни MTU с обеих сторон и проверь, что RID разные.</li>
<li><b>FULL, а маршрутов через линк нет.</b> Сравни тип сети на обоих концах, посмотри стоимость и LSA соседа (<code>show ip ospf database router 10.255.0.4</code>).</li>
<li><b>Не понятно — спроси сам OSPF.</b> <code>debug ip ospf adj</code> и <code>debug ip ospf hello</code> прямо пишут причину. На рабочей сети включай их ненадолго и сразу выключай: <code>undebug all</code>.</li></ol>
<h3>Три поломки, которые ты встретишь</h3>
<p><b>MTU.</b> В Красноярске заменили маршрутизатор, и на новом порту по шаблону стоит MTU 9216, а в Кемерово — 1500. Hello маленькие, они проходят. А в DBD каждый пишет свой MTU, и Кемерово отвергает DBD соседа с MTU больше своего. Оба застревают:</p>
<pre class="cli">R3#show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
10.255.0.4        0   [[EXSTART/  -]]     00:00:36    10.1.34.1       GigabitEthernet0/2
R3#debug ip ospf adj
OSPF-1 ADJ   Gi0/2: Nbr 10.255.0.4 has [[larger interface MTU]]</pre>
<p><b>ACL.</b> После работ на кемеровский порт повесили новый входной ACL: пинг и SSH разрешили, а OSPF забыли. Кемерово выбрасывает Hello Красноярска и не видит его вовсе. Красноярск Hello Кемерово получает, но своего RID в них не находит, поэтому держит его в INIT. Самое коварное: <b>пинг между ними работает</b>, ведь ICMP в ACL разрешён.</p>
<pre class="cli">R4#show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
10.255.0.3        0   [[INIT/  -]]        00:00:33    10.1.34.0       GigabitEthernet0/2
R3#show ip ospf neighbor
Neighbor ID     Pri   State           Dead Time   Address         Interface
10.255.0.1        0   FULL/  -        00:00:35    10.1.13.0       GigabitEthernet0/1</pre>
<p><b>Таймеры.</b> Кто-то «для ускорения» поставил на одном конце hello 5 секунд. Dead автоматически стал 20. Hello с чужими таймерами выбрасываются сразу, соседа нет ни у кого. Debug называет причину прямо: R — что пришло от соседа (received), C — что настроено у меня (configured).</p>
<pre class="cli">R6#debug ip ospf hello
OSPF-1 HELLO Gi0/1: Rcv hello from 10.255.0.5 area 0 10.1.56.1
OSPF-1 HELLO Gi0/1: [[Mismatched hello parameters]] from 10.1.56.1
OSPF-1 HELLO Gi0/1: Dead R 20 C 40, Hello R 5 C 10</pre>
<p>Отдельно про <b>дубль Router ID</b>. Если одинаковый RID у двух соседей, соседство не встанет, а в логе будет DUP_RTRID. Если у двух далёких маршрутизаторов (например, конфиг Владивостока скопировали с Кемерово вместе с router-id), они начинают «воевать»: каждый видит в сети LSA со своим RID, которую он не создавал, и переиздаёт свою. В логах сообщения FLOOD_WAR, маршруты то появляются, то пропадают.</p>
<div class="callout pro"><b>Откуда это берётся на работе</b>MTU — замена оборудования, у которого другие значения по умолчанию, или арендованный у другого оператора канал с MTU меньше нашего. Passive — новый линк, где по шаблону стоит <code>passive-interface default</code>, а порт забыли открыть. ACL — плановое обновление защиты маршрутизатора. Таймеры и дубль RID — ручная правка или копирование конфига. Почти всегда поломка появляется после чьих-то работ, поэтому первый вопрос на смене: «что менялось?»</div>
<div class="callout lab"><b>В лабе</b>Поломки 1, 2 и 3 — это MTU в EXSTART, разные hello и дубль RID. Внеси их по очереди и найди только по выводам show и debug, не подглядывая в команду поломки. А во вкладке <a href="#/c/ch06/sim">«🚨 Дежурство»</a> те же и другие аварии можно разобрать без EVE-NG. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: R4 видит R3 в INIT, а R3 не видит R4 вообще. На чьей стороне искать?</summary><p>Hello от R4 не доходят до R3 (R3 их не видит), поэтому R4 не попадает в Hello от R3. Ищи на входе R3: ACL, фильтры. Или линк работает только в одну сторону.</p></details>
<details class="chk"><summary>Проверь себя: соседи застряли в EXSTART. Что сравнишь первым делом?</summary><p>MTU интерфейсов на обоих концах. Вторым — что Router ID разные.</p></details>
<details class="chk"><summary>Проверь себя: пинг до соседа проходит. Значит ли это, что OSPF-пакеты тоже проходят?</summary><p>Нет. ICMP и OSPF — разные протоколы (OSPF — протокол 89, Hello на групповой адрес 224.0.0.5). ACL может пропускать пинг и резать OSPF.</p></details>`},

{h:'Типы сетей: выборы DR и почему у провайдера point-to-point', html:`
<h3>Много маршрутизаторов в одном сегменте</h3>
<p>Представь Ethernet-сегмент, где через один коммутатор соединены не два, а много маршрутизаторов. Если каждый установит полное соседство с каждым, соседств будет очень много: у 10 маршрутизаторов — 45, и каждое изменение будет рассылаться по всем этим соседствам. Поэтому на таких сетях OSPF выбирает главного: <b>DR</b> (designated router, назначенный маршрутизатор) и его запасного <b>BDR</b> (backup DR).</p>
<figure class="dg"><svg viewBox="0 0 320 236" role="img" aria-label="Четыре маршрутизатора в одном сегменте: соседство каждый с каждым и звезда вокруг DR">
<path class="ln" d="M72 48 L130 98 M248 48 L190 98 M72 172 L130 122 M248 172 L190 122" style="stroke-width:1.4"/>
<g opacity="1"><path d="M72 36 L248 36 M72 184 L248 184 M50 48 L50 172 M270 48 L270 172 M72 48 L248 172 M248 48 L72 172" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-dasharray="5 4"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.45;0.46;1"/></g>
<g opacity="0"><path d="M72 36 L248 36 M248 48 L72 172 M270 48 L270 172" fill="none" stroke="#16a34a" stroke-width="2.4"/><path d="M50 48 L50 172 M72 48 L248 172" fill="none" stroke="#16a34a" stroke-width="1.6" stroke-dasharray="5 4"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<rect class="bx2" x="118" y="96" width="84" height="28" rx="6" style="stroke:var(--tx3);stroke-width:1.5"/><text class="sm" x="160" y="114" text-anchor="middle">коммутатор</text>
<rect class="bx" x="28" y="24" width="44" height="24" rx="6"/><text class="tx" x="50" y="40" text-anchor="middle">R1</text>
<rect class="bx" x="248" y="24" width="44" height="24" rx="6"/><text class="tx" x="270" y="40" text-anchor="middle">R4</text>
<rect class="bx" x="28" y="172" width="44" height="24" rx="6"/><text class="tx" x="50" y="188" text-anchor="middle">R2</text>
<rect class="bx" x="248" y="172" width="44" height="24" rx="6"/><text class="tx" x="270" y="188" text-anchor="middle">R3</text>
<g opacity="0"><rect x="256" y="4" width="28" height="15" rx="4" class="b"/><text class="wt2" x="270" y="15" text-anchor="middle">DR</text><rect x="32" y="4" width="36" height="15" rx="4" class="o"/><text class="wt2" x="50" y="15" text-anchor="middle">BDR</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<g><text class="sm rd" x="160" y="216" text-anchor="middle">Каждый с каждым: 6 соседств.</text><text class="sm rd" x="160" y="230" text-anchor="middle">У 10 маршрутизаторов было бы 45</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.45;0.46;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="216" text-anchor="middle">FULL — только с DR (R4) и BDR (R1).</text><text class="sm gn" x="160" y="230" text-anchor="middle">R2 и R3 между собой остаются в 2-WAY</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Серые линии — провода через коммутатор. Красный пунктир — полные соседства, если бы каждый дружил с каждым. Зелёные линии — как на самом деле: все обмениваются базами только с DR (сплошные) и BDR (пунктир). R4 стал DR, потому что у него наибольший RID.</figcaption></figure>
<p>Все маршрутизаторы сегмента устанавливают FULL только с DR и BDR. Между остальными (их называют DROTHER) соседство останавливается на 2-WAY — и <b>это норма</b>, а не авария. DR ещё и создаёт специальную LSA (тип 2), которая описывает весь сегмент.</p>
<p>Выборы простые: побеждает наибольший приоритет интерфейса (<code>ip ospf priority</code>, по умолчанию 1, а 0 — «никогда не выбирать меня»), при равенстве — наибольший RID. Выборы <b>не вытесняющие</b>: если DR уже выбран, новый маршрутизатор с приоритетом 255 не отнимет у него роль, пока DR жив.</p>
<h3>Линк ядра — это не сегмент</h3>
<p>Тип сети OSPF на Ethernet по умолчанию — <b>broadcast</b>, с выборами DR. Даже если на линке всего два маршрутизатора, а в ядре провайдера так всегда: линк между городами — это один провод между двумя портами. Выборы там только мешают:</p>
<ul><li>при поднятии линка маршрутизатор ждёт до 40 секунд (wait-таймер), прежде чем выбрать DR;</li>
<li>появляется лишняя LSA типа 2 и лишний «узел-сегмент» в расчёте SPF.</li></ul>
<p>Поэтому на всех линках ядра ставят <code>ip ospf network point-to-point</code>. Выборов нет, соседство поднимается за секунды, в <code>show ip ospf neighbor</code> состояние выглядит как <b>FULL/&nbsp;&nbsp;-</b> (прочерк вместо роли DR/BDR). Ровно это ты видел в предыдущих разделах.</p>
<pre class="cli">R3#show ip ospf interface brief
Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C
Lo0          1     0               10.255.0.3/32      1     LOOP  0/0
Gi0/2        1     0               10.1.34.0/31       100   [[P2P]]   1/1
Gi0/1        1     0               10.1.13.1/31       100   [[P2P]]   1/1</pre>
<h3>Коварная поломка: разные типы на концах</h3>
<p>Если на одном конце линка point-to-point, а на другом broadcast (например, после замены оборудования новый конфиг залили без этой строки), таймеры у обоих одинаковые — 10 и 40. Поэтому соседство проходит все ступени и встаёт в FULL. Но в своих LSA маршрутизаторы описывают этот линк по-разному: один как прямой линк к соседу, другой как сегмент с DR. При расчёте SPF линк считается настоящим, только если его подтверждают <b>оба</b> конца. Здесь подтверждения не сходятся, и SPF линк не использует.</p>
<div class="callout warn"><b>Зелёное соседство, а трафик в обход</b>Соседство FULL, ошибок в логах нет, а маршрутов через линк нет, и трафик идёт вокруг кольца. Проверка: <code>show ip ospf interface brief</code> на обоих концах. На одном State будет P2P, на другом DR или BDR.</div>
<div class="callout lab"><b>В лабе</b>Во второй половине задания 2 ты временно уберёшь point-to-point с обоих концов линка и увидишь выборы DR и ожидание около 40 секунд. Поломка 4 — разные типы сети на концах: соседство FULL, а маршрутов нет. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: на сегменте пять маршрутизаторов, два из них видят друг друга в 2-WAY. Это авария?</summary><p>Нет, если оба — DROTHER: между ними так и должно быть. FULL у них только с DR и BDR.</p></details>
<details class="chk"><summary>Проверь себя: зачем на линке между двумя маршрутизаторами ставят point-to-point?</summary><p>Выборы DR между двумя маршрутизаторами бесполезны: они добавляют ожидание до 40 секунд при поднятии линка, лишнюю LSA типа 2 и лишний узел в SPF.</p></details>
<details class="chk"><summary>Проверь себя: соседство FULL, а маршрутов через линк нет. Что сравнишь?</summary><p>Тип сети на обоих концах (show ip ospf interface brief, столбец State). Ещё стоит проверить стоимость линка.</p></details>`},

{h:'Области: зачем делить сеть и какие бывают LSA', html:`
<h3>Почему одна большая карта — это плохо</h3>
<p>Пока в сети пять маршрутизаторов, одна общая карта — это удобно. Но представь сеть на тысячу узлов: LSDB огромная, а каждый моргнувший линк во Владивостоке заставляет пересчитывать SPF маршрутизаторы в Калининграде. Поэтому OSPF умеет делить сеть на <b>области</b> (areas).</p>
<p>Внутри области всё как раньше: полная карта, честный SPF. А за её пределы уходит только <b>сводка</b>: «сеть такая-то есть, она за мной, стоит столько-то». Подробности чужой области никто не видит, и изменения внутри неё почти не тревожат остальных.</p>
<div class="an"><b>Аналогия</b>Атлас области и карта страны. Диспетчер в Новосибирске знает каждую улицу своей области. А про Москву ему достаточно знать: «Москва — по трассе через Омск, 3300 км». Ремонт московской улицы его не касается.</div>
<h3>Правила областей</h3>
<ul><li>Есть главная область — <b>area 0</b>, магистраль (backbone).</li>
<li>Все остальные области подключаются к area 0. Трафик между двумя обычными областями всегда идёт через area 0.</li>
<li><b>ABR</b> (area border router) — маршрутизатор, у которого интерфейсы в area 0 и в другой области. Он и делает сводки. В лабе это Москва (R1).</li>
<li><b>ASBR</b> (autonomous system boundary router) — маршрутизатор, который приносит в OSPF чужие, внешние маршруты, например статику или маршруты из другого протокола. Это называется <b>редистрибуцией</b> (redistribution). В лабе это Питер (R2) с сетью партнёра.</li></ul>
<h3>Как LSA меняются на границе</h3>
<figure class="dg"><svg viewBox="0 0 320 232" role="img" aria-label="ABR превращает LSA 1 в LSA 3, а LSA 7 в LSA 5">
<rect x="6" y="28" width="148" height="160" rx="10" fill="none" stroke="#059669" stroke-width="1.6" stroke-dasharray="6 4"/><text class="sm gn" x="60" y="44" text-anchor="middle">area 1 (NSSA)</text>
<rect x="150" y="28" width="164" height="160" rx="10" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6 4"/><text class="sm bt" x="250" y="44" text-anchor="middle">area 0</text>
<path class="ln" d="M82 100 L128 100"/><path class="ln" d="M172 100 L248 100" style="stroke-dasharray:6 4"/><text class="sm" x="210" y="92" text-anchor="middle">кольцо</text>
<rect class="bx" x="38" y="88" width="44" height="24" rx="6"/><text class="tx" x="60" y="104" text-anchor="middle">R2</text><text class="sm" x="60" y="78" text-anchor="middle">LAN 172.16.16.0/24</text>
<rect class="bx" x="128" y="88" width="44" height="24" rx="6"/><text class="tx" x="150" y="104" text-anchor="middle">R1</text><text class="sm" x="150" y="128" text-anchor="middle">ABR</text>
<rect class="bx" x="248" y="88" width="44" height="24" rx="6"/><text class="tx" x="270" y="104" text-anchor="middle">R4</text><text class="sm" x="270" y="78" text-anchor="middle">Красноярск</text>
<text class="sm" x="60" y="150" text-anchor="middle">сеть партнёра</text><text class="sm" x="60" y="164" text-anchor="middle">192.168.100.0/24</text>
<g opacity="0"><rect x="-16" y="-8" width="32" height="16" rx="3" class="g"/><text class="wt2" x="0" y="3.5" text-anchor="middle">LSA 1</text><animateMotion dur="16s" repeatCount="indefinite" path="M60 100 L150 100" keyPoints="0;0;1;1" keyTimes="0;0.05;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.21;0.22;1"/></g>
<g opacity="0"><rect x="-16" y="-8" width="32" height="16" rx="3" class="b"/><text class="wt2" x="0" y="3.5" text-anchor="middle">LSA 3</text><animateMotion dur="16s" repeatCount="indefinite" path="M150 100 L270 100" keyPoints="0;0;1;1" keyTimes="0;0.22;0.38;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.21;0.22;0.39;0.4;1"/></g>
<g opacity="0"><text class="sm bt" x="236" y="146" text-anchor="middle">O IA 172.16.16.0/24</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.38;0.39;1"/></g>
<g opacity="0"><rect x="-16" y="-8" width="32" height="16" rx="3" class="o"/><text class="wt2" x="0" y="3.5" text-anchor="middle">LSA 7</text><animateMotion dur="16s" repeatCount="indefinite" path="M60 100 L150 100" keyPoints="0;0;1;1" keyTimes="0;0.52;0.67;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.51;0.52;0.68;0.69;1"/></g>
<g opacity="0"><rect x="-16" y="-8" width="32" height="16" rx="3" class="rr"/><text class="wt2" x="0" y="3.5" text-anchor="middle">LSA 5</text><animateMotion dur="16s" repeatCount="indefinite" path="M150 100 L270 100" keyPoints="0;0;1;1" keyTimes="0;0.69;0.85;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.68;0.69;0.86;0.87;1"/></g>
<g opacity="0"><text class="sm rd" x="236" y="164" text-anchor="middle">O E2 192.168.100.0/24</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.85;0.86;1"/></g>
<g><text class="sm" x="160" y="210" text-anchor="middle">Сеть Питера: внутри area 1 — LSA 1 (подробно),</text><text class="sm" x="160" y="224" text-anchor="middle">ABR пересказывает её в area 0 как LSA 3 (сводка)</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.49;0.5;1"/></g>
<g opacity="0"><text class="sm" x="160" y="210" text-anchor="middle">Сеть партнёра — внешняя: в NSSA её несёт LSA 7,</text><text class="sm" x="160" y="224" text-anchor="middle">ABR превращает её в LSA 5 для остальной сети</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Это схема из лабы. Питер — отдельная область, Москва — граница. В Красноярске маршрут до LAN Питера виден как O IA (из другой области), а до сети партнёра — как O E2 (внешний).</figcaption></figure>
<p>Типов LSA несколько, но для работы хватает шести:</p>
<table><tr><th>Тип</th><th>Кто создаёт</th><th>Что описывает</th><th>Код маршрута</th></tr>
<tr><td>1 Router</td><td>каждый маршрутизатор</td><td>свои линки и сети внутри области</td><td>O</td></tr>
<tr><td>2 Network</td><td>DR</td><td>сегмент с DR (раздел 6)</td><td>O</td></tr>
<tr><td>3 Summary</td><td>ABR</td><td>сети другой области: «есть, за мной, стоит N»</td><td>O IA</td></tr>
<tr><td>4 ASBR Summary</td><td>ABR</td><td>как добраться до ASBR из другой области</td><td>—</td></tr>
<tr><td>5 External</td><td>ASBR</td><td>внешние сети, по всему домену</td><td>O E1 / O E2</td></tr>
<tr><td>7 NSSA External</td><td>ASBR в NSSA</td><td>внешние сети внутри NSSA, на ABR превращается в тип 5</td><td>O N1 / O N2</td></tr></table>
<p>Если к одной сети ведут маршруты разных видов, OSPF выбирает в таком порядке: O (своя область) лучше O IA (чужая область), а та лучше внешних. У внешних по умолчанию тип E2: метрика остаётся той, что назначил ASBR, и не растёт по дороге. Тип E1 добавляет к ней путь до ASBR.</p>
<h3>Особые области: stub и NSSA</h3>
<p>Маленькой области на краю сети не нужны сотни внешних маршрутов: всё равно весь трафик наружу идёт через ABR. Поэтому область можно сделать «тупиковой»:</p>
<ul><li><b>stub</b> — внутрь не пускаются внешние LSA 5, вместо них ABR даёт маршрут по умолчанию;</li>
<li><b>totally stubby</b> — не пускаются ещё и сводки LSA 3, внутри только свои сети и маршрут по умолчанию;</li>
<li><b>NSSA</b> (not-so-stubby area) — как stub, но в ней самой может быть ASBR со своими внешними сетями. Их несёт LSA 7, а ABR превращает её в LSA 5. Это наш Питер: филиал с сетью партнёра.</li></ul>
<p>Тип области входит в Hello. Если на одном конце линка <code>area 1 nssa</code>, а на другом нет, соседства не будет.</p>
<h3>Суммаризация на ABR</h3>
<p>ABR умеет отдавать вместо многих сетей одну общую: например, вместо 172.16.16.0/24, 172.16.17.0/24 и 172.16.23.0/24 — одну 172.16.16.0/21 (<code>area 1 range</code>). Таблицы меньше, а если моргнёт одна /24 внутри, остальная сеть об этом даже не узнает: сводка остаётся на месте. Для защиты от петель ABR сам себе ставит маршрут на эту сводку в <b>Null0</b> — «выбросить». Пакет в несуществующую подсеть внутри /21 умрёт на ABR, а не будет гулять по сети.</p>
<div class="callout pro"><b>Как делают провайдеры</b>Современное ядро на сотни маршрутизаторов спокойно живёт в одной area 0 (или в одном уровне IS-IS): процессоры давно справляются. Области вводят, когда узлов тысячи, или чтобы отгородить от ядра неспокойные сегменты: кольца агрегации в регионах, где линки моргают чаще. И помни: в IGP только loopback'и и линки. Сети абонентов в OSPF не редистрибутируют: для них есть BGP. А если по ошибке редистрибутировать в OSPF полную таблицу BGP, в сеть хлынет около миллиона LSA 5. Их будут хранить, рассылать и пересчитывать все маршрутизаторы домена — память и процессоры кончатся, и ляжет весь IGP вместе с BGP и MPLS, которые на нём стоят. Такие аварии у провайдеров случались по-настоящему.</div>
<div class="callout lab"><b>В лабе</b>Задание 4: сделаешь Питер NSSA, принесёшь сеть партнёра редистрибуцией и найдёшь её LSA 7 в Питере и LSA 5 в Красноярске (кто её автор?). Задание 5: суммаризация на Москве, маршрут в Null0 и сравнение таблиц до и после. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: в Красноярске маршрут O IA. Откуда он взялся?</summary><p>Из LSA 3: это сеть другой области, о которой рассказал ABR. Подробностей той области Красноярск не видит.</p></details>
<details class="chk"><summary>Проверь себя: чем NSSA отличается от stub?</summary><p>В обеих не пускают внешние LSA 5. Но в NSSA может быть свой ASBR: его внешние сети идут как LSA 7, а ABR превращает их в LSA 5 для остальной сети.</p></details>
<details class="chk"><summary>Проверь себя: почему нельзя редистрибутировать полную таблицу BGP в OSPF?</summary><p>Это около миллиона LSA 5 на всех маршрутизаторах домена: не хватит памяти и процессора на хранение, рассылку и SPF, и упадёт весь IGP, а с ним всё, что на нём работает.</p></details>
<details class="chk"><summary>Проверь себя: зачем ABR при суммаризации ставит маршрут в Null0?</summary><p>Чтобы пакет в несуществующую подсеть внутри сводки выбросился на ABR, а не ушёл по маршруту по умолчанию и не начал ходить по кругу.</p></details>`},

{h:'IS-IS: протокол, который любят провайдеры', html:`
<h3>Тот же принцип, другая родословная</h3>
<p><b>IS-IS</b> (intermediate system to intermediate system) — тоже протокол состояния каналов. Всё, что ты узнал выше, работает и здесь: соседство через Hello, описания маршрутизаторов рассылаются всем, у всех одинаковая база, каждый считает SPF. Его создали для другого стека протоколов (OSI), а потом научили переносить IP-сети (RFC 1195). Поэтому у него свои слова для тех же вещей.</p>
<table><tr><th>OSPF</th><th>IS-IS</th></tr>
<tr><td>LSA</td><td>LSP (link-state PDU)</td></tr>
<tr><td>Router ID</td><td>System ID (часть адреса NET)</td></tr>
<tr><td>area 0, магистраль</td><td>Level 2 (L2)</td></tr>
<tr><td>обычная область</td><td>Level 1 (L1)</td></tr>
<tr><td>ABR</td><td>маршрутизатор L1/L2</td></tr>
<tr><td>DR</td><td>DIS (выбирается, но без запасного)</td></tr>
<tr><td>Hello 10 с / dead 40 с</td><td>Hello 10 с / hold 30 с</td></tr>
<tr><td>AD 110</td><td>AD 115</td></tr></table>
<h3>Почему провайдеры его выбирают</h3>
<ul><li><b>Он не живёт внутри IP.</b> Пакеты IS-IS идут прямо в кадрах Ethernet, а не в IP-пакетах. Атаковать его IP-пакетом из интернета нельзя, и он не зависит от IP-адресации: один и тот же процесс несёт и IPv4, и IPv6.</li>
<li><b>Его легко расширять.</b> Всё содержимое LSP — это блоки TLV (type-length-value: тип, длина, значение). Новая возможность — просто новый тип блока. Так в IS-IS добавили управление трафиком (TE) и сегментную маршрутизацию, о них — в главах про MPLS.</li>
<li><b>Он проще в большом размере.</b> Одна LSP на маршрутизатор, одна плоская магистраль L2 на сотни узлов без деления на области.</li></ul>
<p>Многие крупные операторы держат ядро на IS-IS, а OSPF чаще встречается в корпоративных сетях и у небольших провайдеров. Оба протокола хороши. Важно понимать принцип, тогда переход с одного на другой — вопрос словаря.</p>
<h3>Адрес NET</h3>
<p>Вместо Router ID у маршрутизатора IS-IS есть адрес <b>NET</b> (network entity title). Он выглядит непривычно, но читается просто:</p>
<figure class="dg"><svg viewBox="0 0 320 150" role="img" aria-label="Разбор адреса NET: AFI 49, область, System ID и NSEL">
<text x="160" y="46" text-anchor="middle" style="font:700 17px Consolas,monospace"><tspan class="pu">49</tspan><tspan style="fill:var(--tx)">.</tspan><tspan class="b">0001</tspan><tspan style="fill:var(--tx)">.</tspan><tspan class="g">0000.0000.0004</tspan><tspan style="fill:var(--tx)">.</tspan><tspan class="o">00</tspan></text>
<rect x="20" y="70" width="12" height="12" rx="2" class="pu"/><text class="sm" x="38" y="80">49 — частный адрес (как 10.x.x.x в IP)</text>
<rect x="20" y="90" width="12" height="12" rx="2" class="b"/><text class="sm" x="38" y="100">0001 — номер области</text>
<rect x="20" y="110" width="12" height="12" rx="2" class="g"/><text class="sm" x="38" y="120">0000.0000.0004 — System ID, уникален у каждого</text>
<rect x="20" y="130" width="12" height="12" rx="2" class="o"/><text class="sm" x="38" y="140">00 — у маршрутизатора всегда 00</text>
</svg><figcaption>NET Красноярска в лабе. System ID — шесть байт, его роль та же, что у Router ID в OSPF: уникальное имя узла. На работе его часто собирают из адреса Loopback0: 10.255.0.4 → 010.255.000.004 → 0102.5500.0004. Тогда по System ID сразу видно, чей это маршрутизатор.</figcaption></figure>
<h3>Уровни вместо областей</h3>
<p>В IS-IS у маршрутизатора есть уровень: <b>L1</b> работает внутри своей области, <b>L2</b> — магистраль между областями, <b>L1/L2</b> — и то и другое, как ABR. Главное отличие от OSPF: маршрутизатор целиком находится в одной области, а граница областей проходит <b>по линку</b> между маршрутизаторами, а не через маршрутизатор.</p>
<p>У Cisco по умолчанию любой маршрутизатор L1/L2, и он поднимает два соседства на каждом линке — для каждого уровня. Провайдеры обычно делают проще: всё ядро — одна плоская магистраль, на всех <code>is-type level-2-only</code>. Так сделано и в лабе.</p>
<h3>Метрика: narrow и wide</h3>
<p>Здесь две ловушки. Первая: по умолчанию у IS-IS стоимость любого интерфейса <b>10</b>, независимо от скорости. 1G и 100G для него равны, поэтому метрики на провайдерских сетях задают руками.</p>
<p>Вторая: исторически метрика линка в IS-IS была 6-битной, максимум 63 (<b>narrow</b>). Этого мало, поэтому сделали новые блоки TLV с метрикой до 16 миллионов (<b>wide</b>, RFC 5305). Включаются они командой <code>metric-style wide</code>, и она должна быть <b>одинаковой на всех маршрутизаторах</b>. Маршрутизатор с narrow пишет свои линки в старых блоках, а маршрутизатор с wide читает только новые. Соседство при этом Up, но линки «чужого» стиля исчезают из SPF, и трафик уходит в обход.</p>
<h3>Overload bit: «не вези через меня»</h3>
<p>В LSP есть флаг <b>overload</b> (OL). Маршрутизатор с этим флагом говорит: «я есть, мои сети доступны, но транзит через меня не стройте». Остальные пересчитывают пути в обход него. Это удобный способ мягко вывести узел из работы перед обслуживанием: сначала ставишь overload, ждёшь, пока трафик уйдёт, потом работаешь.</p>
<h3>Опасные минуты после перезагрузки</h3>
<p>Второе применение overload — защита при старте. На граничных маршрутизаторах провайдера работает BGP с <b>полной таблицей интернета</b> (full view): около миллиона маршрутов, подробно — в главе 8. После перезагрузки такого узла всё поднимается с разной скоростью:</p>
<ul><li><b>IGP</b> — за десятки секунд. Соседи снова видят узел, SPF опять ведёт через него транзитный трафик.</li>
<li><b>BGP</b> — минуты: столько времени нужно, чтобы получить миллион маршрутов. Пока таблицы нет, узел не знает, куда отправлять пакеты в интернет.</li></ul>
<p>Получается окно в несколько минут: трафик к узлу уже идёт, а маршрутов для него ещё нет. Пакеты выбрасываются — чёрная дыра, хотя все соседства «зелёные».</p>
<figure class="dg"><svg viewBox="0 0 320 150" role="img" aria-label="После перезагрузки IGP готов через 30 секунд, BGP через 3 минуты; без защиты между ними трафик теряется">
<text class="sm" x="8" y="16">Без защиты:</text>
<rect x="20" y="22" width="40" height="18" rx="3" class="gr"/><text class="wt2" x="40" y="34" text-anchor="middle">старт</text>
<rect x="62" y="22" width="216" height="18" rx="3" class="rr"/><text class="wt2" x="170" y="34" text-anchor="middle">транзит пришёл, маршрутов нет — потери</text>
<rect x="280" y="22" width="32" height="18" rx="3" class="g"/><text class="wt2" x="296" y="34" text-anchor="middle">ок</text>
<text class="sm" x="8" y="62">С overload on-startup wait-for-bgp:</text>
<rect x="20" y="68" width="40" height="18" rx="3" class="gr"/><text class="wt2" x="40" y="80" text-anchor="middle">старт</text>
<rect x="62" y="68" width="216" height="18" rx="3" class="o"/><text class="wt2" x="170" y="80" text-anchor="middle">транзит идёт в обход, узел ждёт BGP</text>
<rect x="280" y="68" width="32" height="18" rx="3" class="g"/><text class="wt2" x="296" y="80" text-anchor="middle">ок</text>
<path class="ln" d="M20 104 L312 104" style="stroke-width:1"/>
<text class="sm" x="20" y="120">0</text><text class="sm" x="62" y="120" text-anchor="middle">30 с: IGP</text><text class="sm" x="280" y="120" text-anchor="middle">3 мин: BGP</text>
<line x1="20" y1="18" x2="20" y2="108" stroke="#2563eb" stroke-width="2"><animate attributeName="x1" dur="10s" repeatCount="indefinite" values="20;312;312" keyTimes="0;0.9;1"/><animate attributeName="x2" dur="10s" repeatCount="indefinite" values="20;312;312" keyTimes="0;0.9;1"/></line>
<text class="sm" x="160" y="142" text-anchor="middle">Синяя линия — время после перезагрузки</text>
</svg><figcaption>Сверху — без защиты: с 30-й секунды до 3-й минуты соседи шлют через узел транзит, а он ещё не знает маршрутов BGP. Снизу — с overload на старте: эти минуты транзит обходит узел, флаг снимается сам, когда BGP получил таблицу.</figcaption></figure>
<p>Лекарство — объявить себя «не транзитом» на время старта. В IS-IS это <code>set-overload-bit on-startup wait-for-bgp</code>. В OSPF флага overload нет, зато есть <code>max-metric router-lsa on-startup wait-for-bgp</code>: узел объявляет все свои линки с максимальной стоимостью, и SPF у соседей сам выбирает обход. Когда BGP получил таблицу, флаг или максимальная стоимость снимаются автоматически. Сам узел и его сети всё это время доступны — в обход идёт только транзит.</p>
<pre class="cli">R3#show isis database
Tag CORE:
IS-IS Level-2 Link State Database:
LSPID                 LSP Seq Num  LSP Checksum  LSP Holdtime/Rcvd      ATT/P/OL
R1.00-00              0x0000001C   0x7A3B                1042/1199      0/0/0
R3.00-00            * 0x00000021   0x1D2E                 987/*         0/0/0
R4.00-00              0x0000001F   0x5C11                1100/1199      0/0/[[1]]
R5.00-00              0x0000001A   0x3E07                 905/1199      0/0/0
R6.00-00              0x0000001D   0x9B42                1013/1199      0/0/0</pre>
<p>У R4 флаг OL равен 1: Красноярск на обслуживании, транзит через него не идёт. Звёздочка помечает собственную LSP маршрутизатора.</p>
<div class="callout warn"><b>Забытый overload</b>Поставили overload перед ночными работами и забыли снять. Утром всё «работает», только трафик между соседями Красноярска идёт через полстраны. Соседства Up, ошибок нет. Видно только в <code>show isis database</code> (столбец OL) и по traceroute. Есть во вкладке «Дежурство».</div>
<div class="callout lab"><b>В лабе</b>Задание 8: поставишь overload на Красноярск и посмотришь, куда уйдёт трафик Кемерово — Хабаровск и остался ли доступен сам Красноярск. Поломка 5: после миграции на одном маршрутизаторе narrow-метрики, соседство есть, а маршрутов через него нет. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: назови две причины, по которым провайдеры любят IS-IS.</summary><p>Он ходит прямо в кадрах Ethernet, а не в IP: его не атакуешь из интернета, и один процесс несёт IPv4 и IPv6. Он легко расширяется блоками TLV (TE, сегментная маршрутизация). И он проще в большой плоской сети.</p></details>
<details class="chk"><summary>Проверь себя: что значит NET 49.0001.0102.5500.0004.00?</summary><p>49 — частный адрес, 0001 — область, 0102.5500.0004 — System ID (собран из 10.255.0.4), 00 — маршрутизатор.</p></details>
<details class="chk"><summary>Проверь себя: на маршрутизаторе стоит overload. Можно ли пропинговать его loopback?</summary><p>Да. Overload запрещает только транзит через узел, его собственные сети остаются доступны.</p></details>
<details class="chk"><summary>Проверь себя: узел с полной таблицей BGP перезагрузился. IGP поднялся за 30 секунд, BGP получает таблицу 3 минуты. Что будет без overload (или max-metric) на старте?</summary><p>С 30-й секунды соседи снова поведут через узел транзит, а маршрутов BGP у него ещё нет — почти 3 минуты чёрной дыры. Защита: set-overload-bit on-startup wait-for-bgp в IS-IS или max-metric router-lsa on-startup wait-for-bgp в OSPF.</p></details>`},

{h:'Быстрая сходимость: не ждать 40 секунд', html:`
<h3>Из чего складывается время сходимости</h3>
<p>Когда рвётся линк, проходит четыре этапа: маршрутизатор <b>замечает</b> аварию, <b>рассылает</b> новую LSA, все <b>пересчитывают</b> SPF, новые маршруты <b>записываются</b> в таблицу и в «железо» маршрутизатора. Рассылка, расчёт и запись в небольшой сети занимают десятки и сотни миллисекунд. Дольше всего обычно идёт первый этап — заметить.</p>
<h3>Когда порт не падает</h3>
<p>Если оптика оборвалась прямо у порта маршрутизатора, порт падает сразу (пропал свет), и OSPF мгновенно убирает соседа. Но у провайдера между маршрутизаторами часто стоит транспорт: DWDM, медиаконвертеры, арендованный канал другого оператора. Оптика рвётся где-то посередине, а наш порт смотрит в транспортное оборудование, которое живо. Порт остаётся <b>up</b>. OSPF узнаёт об аварии только тогда, когда истечёт dead interval: <b>40 секунд</b> трафик уходит в пустоту.</p>
<figure class="dg"><svg viewBox="0 0 320 236" role="img" aria-label="Обрыв за транспортом: порты остаются up, OSPF ждёт 40 секунд, BFD замечает за 0,3 секунды">
<text class="sm" x="160" y="14" text-anchor="middle">Оптика оборвалась между транспортными узлами</text>
<path class="ln" d="M52 42 L84 42 M236 42 L268 42"/><path class="ln" d="M128 42 L192 42"/>
<rect class="bx" x="8" y="30" width="44" height="24" rx="6"/><text class="tx" x="30" y="46" text-anchor="middle">R3</text>
<rect class="bxd" x="84" y="30" width="44" height="24" rx="6"/><text class="sm" x="106" y="46" text-anchor="middle">ТР</text>
<rect class="bxd" x="192" y="30" width="44" height="24" rx="6"/><text class="sm" x="214" y="46" text-anchor="middle">ТР</text>
<rect class="bx" x="268" y="30" width="44" height="24" rx="6"/><text class="tx" x="290" y="46" text-anchor="middle">R4</text>
<path class="lr" d="M153 34 L167 50 M167 34 L153 50"/><text class="sm rd" x="160" y="68" text-anchor="middle">обрыв</text>
<text class="sm gn" x="30" y="68" text-anchor="middle">порт up</text><text class="sm gn" x="290" y="68" text-anchor="middle">порт up</text>
<text class="sm" x="8" y="98">Порт упал сам (обрыв у порта): миллисекунды</text>
<rect x="8" y="104" width="0" height="10" rx="2" class="g"><animate attributeName="width" dur="10s" repeatCount="indefinite" values="0;0;3;3" keyTimes="0;0.05;0.06;1"/></rect>
<text class="sm" x="8" y="136">Порт up, OSPF ждёт dead interval: 40 секунд</text>
<rect x="8" y="142" width="0" height="10" rx="2" class="rr"><animate attributeName="width" dur="10s" repeatCount="indefinite" values="0;0;300;300" keyTimes="0;0.05;0.85;1"/></rect>
<text class="sm" x="8" y="174">BFD, 3 пропуска по 100 мс: 0,3 секунды</text>
<rect x="8" y="180" width="0" height="10" rx="2" class="g"><animate attributeName="width" dur="10s" repeatCount="indefinite" values="0;0;3;3" keyTimes="0;0.05;0.07;1"/></rect>
<path class="ln" d="M8 202 L308 202" style="stroke-width:1"/><text class="sm" x="8" y="216">0 с</text><text class="sm" x="158" y="216" text-anchor="middle">20 с</text><text class="sm" x="308" y="216" text-anchor="end">40 с</text>
<g opacity="0"><text class="sm rd" x="160" y="232" text-anchor="middle">всё это время трафик Красноярска теряется</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.85;0.86;1"/></g>
</svg><figcaption>Транспорт (ТР) между маршрутизаторами жив, поэтому порты Кемерово и Красноярска остаются up. Без BFD соседство падает только по таймеру dead. В масштабе 40 секунд полоска BFD почти не видна — в этом и смысл.</figcaption></figure>
<h3>BFD — быстрый пульс</h3>
<p>Можно уменьшить таймеры hello и dead, но частые Hello нагружают процессор маршрутизатора, а их обработка медленная. Правильное решение — <b>BFD</b> (bidirectional forwarding detection). Это отдельный маленький протокол: соседи шлют друг другу крошечные пакеты (UDP, порт 3784) каждые 50–300 мс, часто прямо из «железа» сетевой карты. Пропало три подряд — BFD объявляет соседа мёртвым и сразу сообщает об этом OSPF или IS-IS. Те не ждут dead interval и сразу пересчитывают пути.</p>
<pre class="cli">interface GigabitEthernet0/2
 bfd interval 100 min_rx 100 multiplier 3   ! пакет каждые 100 мс, мёртв после 3 пропусков
 ip ospf bfd                                ! сообщать OSPF о падении
R3#show bfd neighbors
IPv4 Sessions
NeighAddr           LD/RD         RH/RS     State     Int
10.1.34.1            1/1          Up        [[Up]]        Gi0/2</pre>
<p>BFD настраивают на обоих концах линка. И помни, что это обычные UDP-пакеты: входной ACL, который их не пропускает, сломает BFD так же, как OSPF.</p>
<h3>Не пересчитывать слишком часто</h3>
<p>Когда линк моргает, новые LSA летят одна за другой. Если считать SPF на каждую, процессор будет занят только этим. Поэтому у SPF есть защитные таймеры (throttling): первый пересчёт — почти сразу (например, через 50 мс), а если изменения продолжаются, пауза между пересчётами растёт до нескольких секунд. Одиночная авария обрабатывается быстро, а моргающий линк не кладёт процессоры.</p>
<h3>Запасной путь заранее: LFA</h3>
<p>Самый быстрый способ — вообще не ждать пересчёта. Маршрутизатор заранее вычисляет запасного соседа для каждой сети и кладёт его в «железо» рядом с основным. При аварии он переключается сам, за десятки миллисекунд, а SPF доделает работу потом. Это <b>LFA</b> (loop-free alternate, RFC 5286).</p>
<p>Запасной сосед годится, только если его собственный путь к цели не идёт обратно через нас, иначе получится петля. Проверим на кольце. Москва ходит в Красноярск через Кемерово. Запасной сосед — Владивосток: его путь в Красноярск идёт через Хабаровск, не через Москву. Годится. А в Кемерово Москва ходит напрямую, и путь Владивостока в Кемерово идёт как раз через Москву (200 против 300 через Хабаровск). Не годится: для Кемерово запасного LFA нет.</p>
<div class="callout pro"><b>Кольца и LFA</b>Кольца — самая неудобная для LFA топология: часть направлений остаётся без защиты. Поэтому провайдеры используют remote LFA и TI-LFA: они защищают любое направление, но требуют MPLS или сегментной маршрутизации. Это темы глав 9–12. А заявки «при аварии на магистрали пропало ТВ на 40 секунд» — почти всегда про отсутствие BFD на линке через транспорт.</div>
<div class="callout lab"><b>В лабе</b>Задание 6: с Красноярска пустишь долгий пинг, на Кемерово повесишь ACL, который режет OSPF, но оставляет порт up, и посчитаешь потери. Потом включишь BFD и повторишь. И поймёшь, почему BFD тоже перестал работать после ACL. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему при обрыве за транспортным оборудованием OSPF замечает аварию только через 40 секунд?</summary><p>Порт маршрутизатора остаётся up: он смотрит в живое транспортное оборудование. OSPF узнаёт об аварии только по таймеру dead, когда 40 секунд не было Hello.</p></details>
<details class="chk"><summary>Проверь себя: что делает BFD и как он связан с OSPF?</summary><p>Шлёт соседу маленькие пакеты каждые 50–300 мс. Пропало три подряд — сообщает OSPF, что сосед мёртв, и OSPF сразу пересчитывает пути, не дожидаясь dead.</p></details>
<details class="chk"><summary>Проверь себя: когда сосед не годится как запасной путь LFA?</summary><p>Когда его собственный лучший путь к цели идёт обратно через нас: тогда пакет вернётся к нам, и получится петля.</p></details>`},

{h:'Переезд с OSPF на IS-IS без простоя', html:`
<h3>Два протокола одновременно</h3>
<p>Ты уже знаешь всё, чтобы понять, как провайдеры меняют IGP на живой сети ночью без единого потерянного пакета. Два протокола маршрутизации могут работать на одних и тех же маршрутизаторах одновременно и ничего не знать друг о друге. Каждый строит свои маршруты. А какой из них попадёт в таблицу, решает административное расстояние (AD): OSPF — 110, IS-IS — 115. Меньше — значит, лучше.</p>
<figure class="dg"><svg viewBox="0 0 320 176" role="img" aria-label="Три шага миграции: IS-IS рядом с OSPF, distance 130, выключение OSPF">
<text class="tx" x="160" y="18" text-anchor="middle">R1 выбирает маршрут до 10.255.0.4/32</text>
<rect class="bx" x="20" y="36" width="280" height="30" rx="6"/><text class="tx" x="34" y="56">O   OSPF</text>
<g><text class="tx" x="286" y="56" text-anchor="end">AD 110</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.33;0.34;1"/></g>
<g opacity="0"><text class="tx og" x="286" y="56" text-anchor="end">AD 130</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.66;0.67;1"/></g>
<g opacity="0"><rect x="20" y="36" width="280" height="30" rx="6" style="fill:var(--card)" opacity="0.7"/><path class="lr" d="M28 51 L292 51"/><text class="sm rd" x="160" y="32" text-anchor="middle">OSPF выключен</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></g>
<rect class="bx" x="20" y="78" width="280" height="30" rx="6"/><text class="tx" x="34" y="98">i L2   IS-IS</text><text class="tx" x="286" y="98" text-anchor="end">AD 115</text>
<rect x="16" y="32" width="288" height="38" rx="8" fill="none" stroke="#16a34a" stroke-width="2.6"><animate attributeName="y" dur="15s" repeatCount="indefinite" values="32;32;74;74" keyTimes="0;0.33;0.34;1"/></rect>
<g><text class="sm" x="160" y="136" text-anchor="middle">Шаг 1. IS-IS поднят рядом, но в таблице OSPF:</text><text class="sm" x="160" y="152" text-anchor="middle">110 меньше 115, трафик идёт как раньше</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.33;0.34;1"/></g>
<g opacity="0"><text class="sm" x="160" y="136" text-anchor="middle">Шаг 2. В OSPF distance 130 — теперь лучше IS-IS.</text><text class="sm" x="160" y="152" text-anchor="middle">Пути те же, потому что метрики одинаковые</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.66;0.67;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="136" text-anchor="middle">Шаг 3. OSPF выключают. В таблице ничего</text><text class="sm gn" x="160" y="152" text-anchor="middle">не меняется: маршруты уже из IS-IS</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.67;1"/></g>
</svg><figcaption>Зелёная рамка — маршрут, который попал в таблицу. Хитрость шага 2 в том, что мы не трогаем IS-IS, а делаем OSPF «хуже» (130 больше 115). Откатиться на любом шаге просто: убрать distance 130.</figcaption></figure>
<h3>План по шагам</h3>
<ol class="steps"><li><b>Поднять IS-IS везде рядом с OSPF</b> с такими же метриками (в лабе 100 на линках, как у OSPF). Проверить соседства (<code>show isis neighbors</code>) и базу. В таблице маршрутов всё ещё O.</li>
<li><b>На всех маршрутизаторах поставить в OSPF <code>distance 130</code>.</b> Маршруты становятся «i L2». Проверить traceroute: путь не должен измениться. Если изменился — метрики не совпали, откатить и разобраться.</li>
<li><b>Выключить OSPF</b> на линках. Таблица не меняется.</li></ol>
<div class="callout pro"><b>На что смотрят в реальной миграции</b>Метрики должны совпадать, иначе на шаге 2 трафик поменяет пути, а пока одни узлы уже на IS-IS, а другие ещё на OSPF, возможны короткие петли. Поэтому шаг 2 делают в одно окно работ на всех узлах. И помни, что на IGP опираются BGP и MPLS: после каждого шага проверяют не только loopback'и, но и соседства BGP и метки. Так провайдеры и переезжают: без простоя, по одному маленькому шагу с проверкой.</div>
<div class="callout lab"><b>В лабе</b>Задание 7 — эта миграция целиком: IS-IS рядом с OSPF, distance 130, выключение OSPF в area 0. Питер останется на OSPF, и Москва станет точкой редистрибуции между протоколами. <a href="#/c/ch06/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: IS-IS подняли рядом с OSPF. Почему в таблице всё ещё маршруты O?</summary><p>У OSPF административное расстояние 110, у IS-IS 115. Из двух источников побеждает меньшее.</p></details>
<details class="chk"><summary>Проверь себя: после distance 130 traceroute показал другой путь. Что это значит?</summary><p>Метрики IS-IS не совпадают с метриками OSPF, и IS-IS считает другие пути. Откатить (убрать distance 130), выровнять метрики и повторить.</p></details>`}
],
end: `<h3>Что ты теперь знаешь</h3>
<p>Протокол маршрутизации находит соседей, обменивается с ними сведениями и сам пересчитывает пути при авариях. OSPF и IS-IS — протоколы состояния каналов: каждый описывает себя (LSA, LSP), описания расходятся по всей сети, у всех одинаковая карта, и каждый считает дерево кратчайших путей от себя. Стоимость считается на выходе, поэтому пути туда и обратно могут различаться. Соседство проходит ступени от INIT до FULL, и по ступени, на которой оно застряло, ставится диагноз: нет соседа — Hello не доходят или выбрасываются, INIT — меня не слышат, EXSTART — MTU, FULL без маршрутов — тип сети или стоимость. Области и уровни ограничивают карту, BFD сокращает обнаружение аварии с 40 секунд до долей секунды, а два протокола могут работать рядом, и это позволяет переезжать с одного на другой без простоя.</p>
<div class="callout ok"><b>Посмотри у себя на работе</b><ol><li>Узнай, какой IGP в ядре вашей сети — OSPF или IS-IS — и одна ли там область.</li><li>Найди на любом маршрутизаторе ядра <code>show ip ospf neighbor</code> (или <code>show isis neighbors</code>): все ли соседи FULL/Up и какой тип сети на линках.</li><li>Спроси коллег, стоит ли BFD на магистральных линках и как у вас уводят трафик перед работами: стоимостью или overload.</li></ol></div>
<p>Дальше по главе: карточки, тест, «Объясни своими словами» и <b>🚨 Дежурство</b> — десять аварий в этой же сети, которые разбираются командами show прямо в браузере. Начни с них, если EVE-NG сейчас нет под рукой. А потом лаба: в ней ты сам построишь кольцо и сломаешь его теми же способами.</p>`
};
