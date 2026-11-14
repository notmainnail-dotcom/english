// Книжный текст главы 8 СДСМ (компьютер): BGP и IP SLA. Формат как у ch06/ch10/ch11/ch12, блоки .callout.lab ведут в лабу 8.
// Строится на книге 11 (разделы 2–3 «BGP с нуля»: TCP 179, iBGP/eBGP, next-hop, RR, атрибуты, community, семейства) — основы не повторяет.
// Все примеры и схемы — на топологии лабы 8: R1 «Лифт ми Ап» AS64500, R2 ISP1 AS64501 (настраивает ученик), R3 ISP2 AS64502, R4 «интернет» AS64510.
// Факты: RFC 4271 (BGP-4: сообщения, состояния, атрибуты), RFC 2918 (route refresh), RFC 1997 и 7999 (community, BLACKHOLE 65535:666),
// RFC 6811 (RPKI origin validation), RFC 6996 (частные ASN), RFC 7454 (BGP operations and security), RFC 5082 (GTSM), RFC 5880/5882 (BFD);
// Cisco IOS: выбор лучшего пути, weight 32768 у своих, keepalive 60/hold 180, AD eBGP 20/iBGP 200, community не передаются без send-community.
window.BOOK = window.BOOK || {};
BOOK.ch08 = {
title: 'BGP и IP SLA',
lead: `<p>В главах 10–12 ты видел BGP изнутри сети провайдера: между PE ходили маршруты клиентов. Теперь — BGP снаружи. Это протокол, на котором держится весь интернет: на нём работают стыки твоей сети с аплинками, пирами и клиентами со своей AS. Каждая жалоба «у клиента пропал префикс в интернете» или «трафик идёт не через тот канал» — это BGP.</p>
<p>Вся глава построена на одной схеме лабы: клиент «Лифт ми Ап» с двумя провайдерами и общий для них «интернет». Ты побываешь по обе стороны стыка: настроишь и клиента, и провайдера. Основы из книги 11 (сессия по TCP 179, next-hop, AS_PATH, community) здесь не повторяются, а только напоминаются по ходу. Глава большая — двенадцать разделов. Две недели на неё — нормальный темп.</p>`,
parts: [

{h:'Интернет глазами BGP: кто с кем связан и кто кому платит', html:`
<h3>Три вида стыков у твоего провайдера</h3>
<p>Посмотри на границу своей сети. Там есть стыки трёх видов. <b>Аплинки</b> — крупные операторы, которым твой провайдер платит за доступ ко всему интернету. <b>Пиринг</b> — другие сети, с которыми вы обмениваетесь трафиком бесплатно: напрямую или на точке обмена трафиком (IX, internet exchange), например MSK-IX. И <b>клиенты со своей AS</b> — банки, хостинги, небольшие провайдеры: они платят вам. На всех трёх стыках работает BGP, но правила на каждом разные. Эта глава — про эти правила.</p>
<h3>Автономная система: одна сеть — одна политика</h3>
<p>Из главы 11 ты знаешь: сеть одного хозяина в BGP называется <b>автономной системой</b> (AS, autonomous system), и у неё есть номер — <b>ASN</b>. Там мы брали частные номера вроде 65001. В интернете нужны публичные. Их выдаёт региональный регистратор (RIR) — для Европы и России это RIPE NCC — через своих членов, LIR. LIR — обычно провайдер; возможно, твоя компания тоже им является.</p>
<table><tr><th>Номера AS</th><th>Для чего</th></tr>
<tr><td>1 – 64495</td><td>публичные 16-битные: у сетей «со стажем»</td></tr>
<tr><td>64512 – 65534</td><td>частные, как серые адреса: внутри сети и у клиентов без своего номера</td></tr>
<tr><td>65536 – 4 294 967 295</td><td>32-битные: сейчас выдают в основном их. Частные среди них — от 4 200 000 000 до 4 294 967 294</td></tr></table>
<h3>Кто кому платит</h3>
<p>Интернет — это десятки тысяч AS, связанных деловыми договорами. Договоры бывают двух видов:</p>
<ul><li><b>Транзит</b> (transit): клиент платит провайдеру, а провайдер за это возит трафик клиента <b>куда угодно</b>. Он отдаёт клиенту маршруты всего интернета и сообщает всему миру о сетях клиента.</li>
<li><b>Пиринг</b> (peering): две сети договорились бесплатно возить друг другу трафик <b>своих</b> клиентов. Обеим выгодно: этот трафик не надо оплачивать аплинку.</li></ul>
<p>В лабе всё это есть в миниатюре:</p>
<figure class="dg"><svg viewBox="0 0 320 236" role="img" aria-label="Схема лабы: клиент платит двум провайдерам, провайдеры платят аплинку, между собой у провайдеров пиринг">
<path class="ln" d="M54 94 L136 48 M54 106 L136 152 M184 48 L266 94 M184 152 L266 106"/>
<path class="ln" d="M160 54 L160 146" style="stroke-dasharray:4 4"/>
<rect class="bx" x="6" y="88" width="48" height="24" rx="6"/><text class="tx" x="30" y="104" text-anchor="middle">R1</text>
<rect class="bx" x="136" y="30" width="48" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R2</text>
<rect class="bx" x="136" y="146" width="48" height="24" rx="6"/><text class="tx" x="160" y="162" text-anchor="middle">R3</text>
<rect class="bx" x="266" y="88" width="48" height="24" rx="6"/><text class="tx" x="290" y="104" text-anchor="middle">R4</text>
<text class="sm" x="30" y="128" text-anchor="middle">AS64500</text><text class="sm bt" x="30" y="141" text-anchor="middle">Лифт ми Ап</text>
<text class="sm" x="160" y="22" text-anchor="middle">ISP1 · AS64501</text>
<text class="sm" x="160" y="186" text-anchor="middle">ISP2 · AS64502</text>
<text class="sm" x="290" y="128" text-anchor="middle">AS64510</text><text class="sm" x="288" y="141" text-anchor="middle">«интернет»</text>
<text class="sm gn" x="173" y="96">пиринг:</text><text class="sm gn" x="173" y="109">бесплатно</text>
<g opacity="0"><circle r="7" class="o"/><text class="wt2" y="3" text-anchor="middle">₽</text><animateMotion dur="12s" repeatCount="indefinite" path="M58 92 L132 50" keyPoints="0;0;1;1" keyTimes="0;0.04;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.2;0.21;1"/></g>
<g opacity="0"><circle r="7" class="o"/><text class="wt2" y="3" text-anchor="middle">₽</text><animateMotion dur="12s" repeatCount="indefinite" path="M58 108 L132 150" keyPoints="0;0;1;1" keyTimes="0;0.04;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.2;0.21;1"/></g>
<g opacity="0"><circle r="7" class="o"/><text class="wt2" y="3" text-anchor="middle">₽</text><animateMotion dur="12s" repeatCount="indefinite" path="M188 50 L262 92" keyPoints="0;0;1;1" keyTimes="0;0.25;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.42;0.43;1"/></g>
<g opacity="0"><circle r="7" class="o"/><text class="wt2" y="3" text-anchor="middle">₽</text><animateMotion dur="12s" repeatCount="indefinite" path="M188 150 L262 108" keyPoints="0;0;1;1" keyTimes="0;0.25;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.25;0.42;0.43;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="12s" repeatCount="indefinite" path="M160 62 L160 138" keyPoints="0;0;1;1" keyTimes="0;0.55;0.68;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.68;0.69;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="12s" repeatCount="indefinite" path="M160 138 L160 62" keyPoints="0;0;1;1" keyTimes="0;0.71;0.84;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.7;0.71;0.84;0.85;1"/></g>
<g><text class="sm" x="160" y="212" text-anchor="middle">Клиент платит обоим провайдерам за транзит,</text><text class="sm" x="160" y="226" text-anchor="middle">а провайдеры — своему аплинку «интернет»</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="212" text-anchor="middle">ISP1 и ISP2 бесплатно обмениваются</text><text class="sm gn" x="160" y="226" text-anchor="middle">трафиком своих клиентов — это пиринг</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.51;0.52;1"/></g>
</svg><figcaption>R1 — клиент «Лифт ми Ап». R2 и R3 — два его провайдера. R4 — их общий аплинк, в лабе он играет весь интернет. Монеты показывают, кто кому платит. Пунктир между провайдерами — пиринг: бесплатный обмен трафиком своих клиентов.</figcaption></figure>
<h3>Главное правило: кому какие маршруты отдавать</h3>
<p>Из денег вытекает правило, которое знает каждый инженер провайдера. Его называют правилом Гао — Рексфорда (Gao-Rexford), по фамилиям исследователей, которые его описали:</p>
<table><tr><th>Откуда маршрут</th><th>Клиентам</th><th>Пирам</th><th>Аплинкам</th></tr>
<tr><td>свои сети</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>от клиента</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>от пира</td><td>✓</td><td>✗</td><td>✗</td></tr>
<tr><td>от аплинка</td><td>✓</td><td>✗</td><td>✗</td></tr></table>
<p>Почему так. За трафик клиентов тебе платят — значит, до клиентов должен уметь дойти весь мир, и их сети ты отдаёшь всем. А если отдать пиру маршруты своего аплинка, пир начнёт гнать через тебя свой трафик в интернет: ты повезёшь его бесплатно, да ещё заплатишь аплинку. Нарушение правила называется <b>утечкой маршрутов</b> (route leak). О ней — раздел 8.</p>
<div class="an"><b>Аналогия</b>Ты — транспортная компания. Клиенты платят тебе за доставку посылок куда угодно. С соседней компанией вы договорились бесплатно передавать друг другу посылки ваших клиентов: обоим выгодно. А крупному перевозчику ты сам платишь за доставку в дальние города. Если сосед начнёт сдавать тебе посылки в дальние города, ты повезёшь их даром и ещё заплатишь крупному перевозчику. Поэтому соседу ты обещаешь доставку только своим клиентам.</div>
<h3>Почему BGP, а не OSPF</h3>
<p>Полная таблица интернета (full view) — около миллиона IPv4-маршрутов и больше двухсот тысяч IPv6. OSPF, где каждый маршрутизатор знает карту всей сети, на таком объёме и между тысячами независимых хозяев не работает. BGP карту не строит. Он передаёт «сеть и список AS, через которые к ней идти» — AS_PATH. Этого хватает, чтобы не зациклиться (увидел свою AS в пути — выбросил маршрут) и чтобы принимать решения по договорам, а не по скорости линков.</p>
<div class="callout deep"><b>Что ты уже знаешь из главы 11</b><ul><li>BGP работает по TCP 179, соседей прописывают руками. iBGP — внутри AS, eBGP — между разными AS (<a href="#/c/ch11/book/1">книга 11, раздел 2</a>).</li><li>Next-hop и рекурсивный поиск, правило iBGP и route reflector (там же).</li><li>Маршрут — карточка с атрибутами: сеть, next-hop, AS_PATH, community; команда send-community (<a href="#/c/ch11/book/2">раздел 3</a>).</li><li>Защита от петель по AS_PATH (<a href="#/c/ch11/book/8">раздел 9</a>).</li></ul>Здесь это повторять не будем, только напоминать по ходу.</div>
<div class="callout lab"><b>В лабе</b>Вся глава — на одной схеме: R1 — клиент «Лифт ми Ап» (AS64500) с двумя провайдерами, R2 — ISP1 (AS64501), его настраиваешь ты как инженер провайдера, R3 — ISP2 (AS64502), уже настроен, R4 — «интернет» (AS64510). Открой схему лабы и найди на ней транзит и пиринг. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: чем транзит отличается от пиринга?</summary><p>Транзит — платная услуга: провайдер возит трафик клиента куда угодно и отдаёт ему маршруты всего интернета. Пиринг — бесплатный обмен трафиком только между клиентами двух сетей.</p></details>
<details class="chk"><summary>Проверь себя: маршрут пришёл от пира. Кому его можно отдать?</summary><p>Только своим клиентам. Пирам и аплинкам — нельзя, иначе ты бесплатно повезёшь чужой трафик (route leak).</p></details>
<details class="chk"><summary>Проверь себя: почему для обмена маршрутами между AS используют BGP, а не OSPF?</summary><p>Масштаб (миллион маршрутов, тысячи независимых сетей) и политики: решения принимаются по договорам. BGP не строит карту сети, а передаёт путь из AS, по которому видно петли.</p></details>`},

{h:'eBGP-сессия: как поднимается и почему не поднимается', html:`
<h3>Сессия с провайдером — по адресу стыка</h3>
<p>Между PE в главе 11 сессию строили от loopback до loopback. С другим оператором так обычно не делают: до чужого loopback у тебя нет маршрута, и пускать соседа вглубь своей сети незачем. eBGP-сессию строят по адресам самого стыка — двух концов линка /30:</p>
<pre class="cli">R1(config)#router bgp 64500
R1(config-router)#bgp router-id 100.0.0.1
R1(config-router)#neighbor 101.0.0.1 remote-as 64501
R1(config-router)#neighbor 101.0.0.1 description ISP1</pre>
<p>Строка <code>remote-as</code> — не просто номер для порядка. Это проверка: «я жду, что сосед представится номером 64501». Не совпало — сессии не будет.</p>
<p>У eBGP есть особенность: пакеты сессии уходят с TTL 1, то есть сосед обязан быть на этом же линке. Если eBGP нужно построить через несколько хопов (например, между loopback'ами, когда между маршрутизаторами два линка), добавляют <code>ebgp-multihop 2</code> и <code>update-source</code>. На обычном стыке с провайдером это не нужно.</p>
<h3>Пять видов сообщений</h3>
<table><tr><th>Сообщение</th><th>Что в нём</th></tr>
<tr><td>OPEN</td><td>«Я AS64500, мой router-id 100.0.0.1, hold time 180 с, умею вот это»</td></tr>
<tr><td>KEEPALIVE</td><td>«Я жив». Cisco шлёт раз в 60 с. Если от соседа ничего нет 180 с (hold time), сессия рвётся</td></tr>
<tr><td>UPDATE</td><td>маршруты: новые сети с атрибутами и отзыв пропавших</td></tr>
<tr><td>NOTIFICATION</td><td>«ошибка, закрываю сессию» — с кодом причины</td></tr>
<tr><td>ROUTE-REFRESH</td><td>«пришли мне все маршруты заново» — нужно, чтобы применить новый фильтр без разрыва сессии (раздел 4)</td></tr></table>
<p>Вот как поднимается сессия между R1 и ISP1:</p>
<figure class="dg"><svg viewBox="0 0 320 226" role="img" aria-label="Как поднимается BGP-сессия: TCP, OPEN, KEEPALIVE, UPDATE и смена состояний">
<rect class="bx" x="10" y="6" width="60" height="24" rx="6"/><text class="tx" x="40" y="22" text-anchor="middle">R1</text>
<rect class="bx" x="250" y="6" width="60" height="24" rx="6"/><text class="tx" x="280" y="22" text-anchor="middle">R2</text>
<text class="sm" x="40" y="44" text-anchor="middle">AS64500</text><text class="sm" x="280" y="44" text-anchor="middle">AS64501</text>
<path d="M40 50 L40 176 M280 50 L280 176" fill="none" stroke="var(--tx3)" stroke-width="1.2" stroke-dasharray="3 4"/>
<g opacity="0"><path class="ln" d="M44 68 L276 68" style="stroke-width:1.2"/><text class="sm" x="160" y="62" text-anchor="middle">TCP 179: SYN → SYN-ACK → ACK</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.04;0.05;0.95;1"/></g>
<g opacity="0"><path class="ln" d="M44 92 L276 92" style="stroke-width:1.2"/><text class="sm" x="160" y="86" text-anchor="middle">OPEN: я AS64500, id 100.0.0.1</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.2;0.21;0.95;1"/></g>
<g opacity="0"><path class="ln" d="M44 116 L276 116" style="stroke-width:1.2"/><text class="sm" x="160" y="110" text-anchor="middle">OPEN: я AS64501, id 10.255.2.2</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.2;0.21;0.95;1"/></g>
<g opacity="0"><path class="ln" d="M44 140 L276 140" style="stroke-width:1.2"/><text class="sm" x="160" y="134" text-anchor="middle">KEEPALIVE в обе стороны</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.32;0.33;0.95;1"/></g>
<g opacity="0"><path class="ln" d="M44 164 L276 164" style="stroke-width:1.2"/><text class="sm" x="160" y="158" text-anchor="middle">UPDATE: 8.8.8.0/24, 1.1.1.0/24 …</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.5;0.51;0.95;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M50 68 L270 68" keyPoints="0;0;1;1" keyTimes="0;0.05;0.11;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.11;0.115;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M270 68 L50 68" keyPoints="0;0;1;1" keyTimes="0;0.115;0.17;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.11;0.115;0.17;0.175;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M50 92 L270 92" keyPoints="0;0;1;1" keyTimes="0;0.21;0.3;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.2;0.21;0.3;0.305;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M270 116 L50 116" keyPoints="0;0;1;1" keyTimes="0;0.21;0.3;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.2;0.21;0.3;0.305;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M50 140 L270 140" keyPoints="0;0;1;1" keyTimes="0;0.33;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.32;0.33;0.42;0.425;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M270 140 L50 140" keyPoints="0;0;1;1" keyTimes="0;0.33;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.32;0.33;0.42;0.425;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="16s" repeatCount="indefinite" path="M270 164 L50 164" keyPoints="0;0;1;1" keyTimes="0;0.51;0.62;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.5;0.51;0.62;0.625;1"/></g>
<g><text class="sm" x="40" y="196" text-anchor="middle">Idle</text><text class="sm" x="280" y="196" text-anchor="middle">Idle</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.04;0.041;1"/></g>
<g opacity="0"><text class="sm" x="40" y="196" text-anchor="middle">Connect</text><text class="sm" x="280" y="196" text-anchor="middle">Connect</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.041;0.2;0.201;1"/></g>
<g opacity="0"><text class="sm" x="40" y="196" text-anchor="middle">OpenSent</text><text class="sm" x="280" y="196" text-anchor="middle">OpenSent</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.2;0.201;0.31;0.311;1"/></g>
<g opacity="0"><text class="sm" x="40" y="196" text-anchor="middle">OpenConfirm</text><text class="sm" x="280" y="196" text-anchor="middle">OpenConfirm</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.31;0.311;0.42;0.421;1"/></g>
<g opacity="0"><text class="sm gn" x="40" y="196" text-anchor="middle">Established</text><text class="sm gn" x="280" y="196" text-anchor="middle">Established</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.42;0.421;1"/></g>
<g><text class="sm" x="160" y="218" text-anchor="middle">Сначала обычное TCP-соединение на порт 179</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.19;0.191;1"/></g>
<g opacity="0"><text class="sm" x="160" y="218" text-anchor="middle">OPEN: номер AS должен совпасть с remote-as</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.19;0.191;0.31;0.311;1"/></g>
<g opacity="0"><text class="sm" x="160" y="218" text-anchor="middle">KEEPALIVE в ответ: «согласен, работаем»</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.31;0.311;0.45;0.451;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="218" text-anchor="middle">Established — по сессии идут маршруты (UPDATE)</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.45;0.451;1"/></g>
</svg><figcaption>Внизу — состояние сессии на каждой стороне. Сначала TCP, потом оба отправляют OPEN и проверяют номер AS соседа. KEEPALIVE в ответ значит «согласен», и сессия переходит в Established. Только после этого начинают ходить маршруты.</figcaption></figure>
<h3>Состояния: где застряло — там и ищи</h3>
<p>Названия состояний ты увидишь в <code>show ip bgp summary</code>, и по ним сразу понятно, где искать:</p>
<table><tr><th>Состояние</th><th>Что происходит</th><th>Если застряло здесь</th></tr>
<tr><td>Idle</td><td>ничего не делает</td><td>сессия выключена (<code>Idle (Admin)</code>), сработал лимит маршрутов (<code>Idle (PfxCt)</code>, раздел 9), нет маршрута до соседа</td></tr>
<tr><td>Connect</td><td>открывает TCP</td><td>обычно мелькает на секунду</td></tr>
<tr><td><b>Active</b></td><td>TCP не открылся, пробует снова</td><td>нет связи до адреса соседа, ACL режет TCP 179, у соседа не прописан твой адрес, не совпал пароль</td></tr>
<tr><td>OpenSent, OpenConfirm</td><td>обмен OPEN</td><td>сессия рвётся с NOTIFICATION: не тот номер AS, одинаковый router-id</td></tr>
<tr><td>Established</td><td>работает</td><td>в summary вместо слова — число полученных маршрутов</td></tr></table>
<pre class="cli">R1#show ip bgp summary
BGP router identifier 100.0.0.1, local AS number 64500
Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
101.0.0.1       4 64501      12      10        7    0    0 00:05:12        [[3]]
102.0.0.1       4 64520       0       0        1    0    0 00:00:31 [[Idle]]
R1#show logging | include NOTIFICATION
%BGP-3-NOTIFICATION: sent to neighbor 102.0.0.1 active 2/2 ([[peer in wrong AS]]) 2 bytes FBF6</pre>
<p>Первая строка — сессия с ISP1 работает, от него получено 3 маршрута. Вторая — с ISP2 беда, и лог объясняет почему: R1 ждёт AS64520, а сосед в OPEN назвал себя другим номером. Байты FBF6 в конце строки — номер, который прислал сосед, в шестнадцатеричном виде: 0xFBF6 = 64502. R1 ответил NOTIFICATION «peer in wrong AS» и закрыл сессию. Через несколько секунд он попробует снова — и так по кругу, пока не исправишь <code>remote-as</code>.</p>
<div class="callout warn"><b>«Active» — это плохо</b>Название обманчивое: Active значит не «работает», а «активно пытаюсь открыть TCP и не могу». Рабочее состояние одно — Established, и в summary оно выглядит как число.</div>
<h3>Сессия не поднимается: порядок проверки</h3>
<ol class="steps"><li><b>Связь.</b> <code>ping</code> до адреса соседа. Нет пинга — BGP ни при чём, ищи на L1–L3.</li>
<li><b>Состояние и лог.</b> Висит в Active — проблема с TCP: адрес, ACL на порт 179, пароль. Скачет Idle и Active, а в логе NOTIFICATION — читай причину в скобках.</li>
<li><b>Конфиг с обеих сторон.</b> Адрес соседа и remote-as у тебя и у него, пароль, если он есть.</li></ol>
<div class="callout pro"><b>Пароль на стыке</b>На стыках провайдера сессию почти всегда защищают паролем: <code>neighbor 101.0.0.1 password …</code> — каждый TCP-пакет сессии подписывается (MD5). Пароль не совпал — сессия висит в Active, а в логе <code>%TCP-6-BADAUTH: Invalid MD5 digest</code>. При подключении нового клиента это одна из самых частых причин «не поднимается».</div>
<div class="callout lab"><b>В лабе</b>Задание 1: поднимешь сессии R1 с обоими провайдерами и R2 со всеми соседями, а в <code>debug ip bgp</code> поймаешь смену состояний. Поломка 1: на R1 неверный remote-as — найдёшь её по NOTIFICATION в логе. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему eBGP-сессию с провайдером строят по адресу стыка, а не по loopback?</summary><p>До чужого loopback нет маршрута, а eBGP по умолчанию шлёт пакеты с TTL 1 — сосед должен быть на том же линке. Адрес стыка доступен сразу.</p></details>
<details class="chk"><summary>Проверь себя: у соседа в summary написано Active. Где искать?</summary><p>TCP не устанавливается: проверь пинг до адреса соседа, ACL на порт 179, адрес соседа и пароль с обеих сторон.</p></details>
<details class="chk"><summary>Проверь себя: в логе NOTIFICATION «peer in wrong AS». Что исправлять?</summary><p>remote-as: сосед представился в OPEN другим номером AS, чем прописан у тебя. Проверь номер его AS и строку neighbor … remote-as.</p></details>`},

{h:'Как своя сеть попадает в интернет', html:`
<h3>Свои адреса: PI и PA</h3>
<p>Чтобы мир видел сеть «Лифт ми Ап» через любого из двух провайдеров, клиенту нужны свои адреса. Бывают два вида:</p>
<ul><li><b>PA</b> (provider aggregatable) — адреса из блока провайдера. Ушёл к другому провайдеру — адреса отдаёшь. Через второго провайдера такие адреса обычно не анонсируют.</li>
<li><b>PI</b> (provider independent) — свои адреса, закреплённые за компанией. Их можно анонсировать со своей AS через любых провайдеров. IPv4 сейчас достаётся только покупкой на рынке.</li></ul>
<p>В лабе у клиента PI-блок 100.0.0.0/23: два офиса по /24 (Loopback1 и Loopback2 на R1). Наружу отдаём весь блок одним маршрутом.</p>
<h3>Команда network и ловушка с Null0</h3>
<p>Самый частый способ ввести свою сеть в BGP — команда <code>network</code>:</p>
<pre class="cli">router bgp 64500
 network 100.0.0.0 mask 255.255.254.0</pre>
<p>Важно понять, что она делает. Она не создаёт маршрут, а говорит: «если в таблице маршрутов есть <b>ровно такая</b> сеть — с такой же маской, — анонсируй её». У R1 в таблице две сети /24, а /23 нет. Значит, анонса не будет, и BGP даже не скажет почему.</p>
<p>Решение — статический маршрут на весь блок в интерфейс Null0, «в никуда»:</p>
<pre class="cli">ip route 100.0.0.0 255.255.254.0 Null0</pre>
<p>Трафику он не мешает: пакеты к 100.0.0.1 идут по более точному маршруту /24 в Loopback1 — longest match из главы 3. В Null0 попадёт только трафик к адресам блока, которых у тебя нет. И это даже полезно: без такого маршрута пакеты к пустой части блока ушли бы по default обратно провайдеру, а тот вернул бы их тебе — петля.</p>
<figure class="dg"><svg viewBox="0 0 320 184" role="img" aria-label="Команда network ищет в таблице маршрутов точную сеть /23: без статики в Null0 её нет, со статикой анонс уходит провайдерам">
<text class="sm" x="8" y="14">Таблица маршрутов R1</text>
<rect class="bx" x="8" y="22" width="196" height="20" rx="3"/><text class="sm" x="16" y="36">C  100.0.0.0/24 — Loopback1</text>
<rect class="bx" x="8" y="46" width="196" height="20" rx="3"/><text class="sm" x="16" y="60">C  100.0.1.0/24 — Loopback2</text>
<g opacity="0"><rect class="bx" x="8" y="70" width="196" height="20" rx="3" style="stroke:#16a34a"/><text class="sm gn" x="16" y="84">S  100.0.0.0/23 — Null0</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<rect class="bx" x="216" y="22" width="96" height="44" rx="6"/><text class="tx" x="264" y="40" text-anchor="middle">network</text><text class="sm" x="264" y="57" text-anchor="middle">100.0.0.0/23</text>
<g opacity="0"><rect x="8" y="0" width="196" height="20" rx="3" class="pp"/><animateMotion dur="12s" repeatCount="indefinite" path="M0 22 L0 70" keyPoints="0;0;0.5;1;1" keyTimes="0;0.06;0.16;0.26;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.05;0.06;0.46;0.47;1"/></g>
<g opacity="0"><text class="sm rd" x="106" y="84" text-anchor="middle">/23 не найдено</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.26;0.27;0.46;0.47;1"/></g>
<g opacity="0"><rect x="8" y="0" width="196" height="20" rx="3" style="fill:rgba(22,163,74,.16);stroke:#16a34a;stroke-width:1.5"/><animateMotion dur="12s" repeatCount="indefinite" path="M0 22 L0 70" keyPoints="0;0;0.5;1;1" keyTimes="0;0.53;0.6;0.67;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.52;0.53;0.97;1"/></g>
<rect class="bx" x="200" y="120" width="52" height="20" rx="5"/><text class="sm" x="226" y="134" text-anchor="middle">ISP1</text>
<rect class="bx" x="260" y="120" width="52" height="20" rx="5"/><text class="sm" x="286" y="134" text-anchor="middle">ISP2</text>
<g opacity="0"><rect x="-30" y="-7" width="60" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">100.0.0.0/23</text><animateMotion dur="12s" repeatCount="indefinite" path="M264 76 L226 108" keyPoints="0;0;1;1" keyTimes="0;0.7;0.82;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.69;0.7;0.9;0.91;1"/></g>
<g opacity="0"><rect x="-30" y="-7" width="60" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">100.0.0.0/23</text><animateMotion dur="12s" repeatCount="indefinite" path="M264 76 L290 108" keyPoints="0;0;1;1" keyTimes="0;0.7;0.82;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.69;0.7;0.9;0.91;1"/></g>
<g><text class="sm" x="160" y="162" text-anchor="middle">network ищет в RIB ровно 100.0.0.0/23.</text><text class="sm rd" x="160" y="176" text-anchor="middle">Её нет — анонса нет, и BGP молчит</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.48;0.49;1"/></g>
<g opacity="0"><text class="sm" x="160" y="162" text-anchor="middle">Статика в Null0 дала точную /23 —</text><text class="sm gn" x="160" y="176" text-anchor="middle">анонс ушёл обоим провайдерам</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Синяя рамка — network перебирает таблицу маршрутов в поисках точной /23. Двух /24 недостаточно. Зелёная строка — статика в Null0: с ней точная сеть есть, и анонс уходит.</figcaption></figure>
<h3>Как маршрут расходится по интернету</h3>
<p>R1 отдаёт /23 обоим провайдерам. Каждая AS, передавая маршрут дальше, дописывает в начало AS_PATH свой номер. Путь растёт, и «интернет» R4 получает два пути к сети клиента:</p>
<figure class="dg"><svg viewBox="0 0 320 196" role="img" aria-label="Маршрут клиента расходится к двум провайдерам и дальше к R4, AS_PATH растёт на каждом шаге">
<path class="ln" d="M54 94 L136 48 M54 106 L136 152 M184 48 L266 94 M184 152 L266 106"/>
<path class="ln" d="M160 54 L160 146" style="stroke-dasharray:4 4"/>
<rect class="bx" x="6" y="88" width="48" height="24" rx="6"/><text class="tx" x="30" y="104" text-anchor="middle">R1</text>
<rect class="bx" x="136" y="30" width="48" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R2</text>
<rect class="bx" x="136" y="146" width="48" height="24" rx="6"/><text class="tx" x="160" y="162" text-anchor="middle">R3</text>
<rect class="bx" x="266" y="88" width="48" height="24" rx="6"/><text class="tx" x="290" y="104" text-anchor="middle">R4</text>
<text class="sm" x="30" y="128" text-anchor="middle">AS64500</text><text class="sm" x="30" y="141" text-anchor="middle">путь: пусто</text>
<text class="sm" x="160" y="22" text-anchor="middle">ISP1 · AS64501</text>
<text class="sm" x="160" y="186" text-anchor="middle">ISP2 · AS64502</text>
<text class="sm" x="290" y="128" text-anchor="middle">AS64510</text>
<g opacity="0"><rect x="-18" y="-7" width="36" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">64500</text><animateMotion dur="12s" repeatCount="indefinite" path="M62 82 L128 44" keyPoints="0;0;1;1" keyTimes="0;0.05;0.24;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.26;0.27;1"/></g>
<g opacity="0"><rect x="-18" y="-7" width="36" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">64500</text><animateMotion dur="12s" repeatCount="indefinite" path="M62 118 L128 156" keyPoints="0;0;1;1" keyTimes="0;0.05;0.24;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.26;0.27;1"/></g>
<g opacity="0"><rect x="-32" y="-7" width="64" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">64501 64500</text><animateMotion dur="12s" repeatCount="indefinite" path="M192 38 L250 72" keyPoints="0;0;1;1" keyTimes="0;0.3;0.48;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.29;0.3;0.5;0.51;1"/></g>
<g opacity="0"><rect x="-32" y="-7" width="64" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">64502 64500</text><animateMotion dur="12s" repeatCount="indefinite" path="M192 166 L248 134" keyPoints="0;0;1;1" keyTimes="0;0.3;0.48;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.29;0.3;0.5;0.51;1"/></g>
<g opacity="0"><text class="sm" x="204" y="158">У R4 два пути к /23:</text><text class="sm bt" x="204" y="172">64501 64500</text><text class="sm bt" x="204" y="186">64502 64500</text><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.52;0.53;1"/></g>
</svg><figcaption>На R1 путь у своей сети пустой: она родилась здесь. Каждый провайдер дописывает свой номер в начало пути. Самый правый номер — AS, где сеть родилась.</figcaption></figure>
<p>Самый правый номер в AS_PATH называют <b>AS происхождения</b> (origin AS). По нему весь мир знает, чья это сеть, и по нему же работает защита RPKI (раздел 9).</p>
<h3>Другие способы</h3>
<ul><li><code>redistribute static</code> или <code>redistribute connected</code> переливает маршруты пачкой. Без фильтра это опасно: в интернет уедет всё подряд, в том числе серые адреса.</li>
<li><code>aggregate-address 100.0.0.0 255.255.254.0 summary-only</code> собирает агрегат из более точных маршрутов, которые уже есть в BGP, а сами точные прячет.</li></ul>
<div class="callout pro"><b>Не длиннее /24</b>По общей договорённости операторы не принимают из интернета IPv4-маршруты длиннее /24 и IPv6 длиннее /48. Сеть /25 клиента до мира не дойдёт: её выбросят фильтры. Поэтому самый маленький блок, который можно анонсировать самостоятельно, — /24.</div>
<div class="callout lab"><b>В лабе</b>Задание 2: введёшь network для /23 сначала без Null0 и убедишься, что анонса нет, потом с ним. На R4 найдёшь два пути к сети клиента. Поломка 2: кто-то удалил маршрут в Null0, и сеть клиента пропала из интернета. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему network 100.0.0.0 mask 255.255.254.0 ничего не анонсирует, если в таблице маршрутов только два /24?</summary><p>Network анонсирует сеть, только если в таблице маршрутов есть ровно такая — с той же маской. Двух /24 недостаточно, нужен маршрут /23.</p></details>
<details class="chk"><summary>Проверь себя: зачем маршрут в Null0 и почему он не ломает трафик к 100.0.0.1?</summary><p>Он даёт точную /23 для network. Трафик к 100.0.0.1 идёт по более точному /24 (longest match), а в Null0 попадает только трафик к несуществующим адресам блока — это ещё и защита от петли.</p></details>
<details class="chk"><summary>Проверь себя: у R4 путь «64501 64500». Где родилась сеть и через кого пришла?</summary><p>Родилась в AS64500 (самый правый номер), пришла от соседа AS64501 (самый левый).</p></details>`},

{h:'Читаем таблицу BGP', html:`
<h3>show ip bgp построчно</h3>
<p>Главная команда главы. Вот что видит R1, когда сессии с обоими провайдерами работают, а своя сеть уже анонсирована:</p>
<pre class="cli">R1#show ip bgp
BGP table version is 9, local router ID is 100.0.0.1
Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,
              r RIB-failure, S Stale, …
Origin codes: i - IGP, e - EGP, ? - incomplete
     Network          Next Hop            Metric LocPrf Weight Path
 *   1.1.1.0/24       102.0.0.1                              0 64502 64510 i
 *>                   101.0.0.1                              0 64501 64510 i
 *   8.8.8.0/24       102.0.0.1                              0 64502 64510 i
 *>                   101.0.0.1                              0 64501 64510 i
 *>  100.0.0.0/23     0.0.0.0                  0         32768 i
 *   203.0.113.0/24   102.0.0.1                              0 64502 64510 i
 *>                   101.0.0.1                              0 64501 64510 i</pre>
<p>Каждая строка — один <b>путь</b> (path) к сети. Если путей к сети несколько, сеть написана один раз, а пути идут строками подряд под ней. Разберём одну строку по полям:</p>
<figure class="dg"><svg viewBox="0 0 320 98" role="img" aria-label="Строка show ip bgp по полям: статус, сеть, next-hop, AS_PATH и origin">
<rect class="bx" x="4" y="8" width="26" height="22" rx="4"/><text class="sm" x="17" y="23" text-anchor="middle" style="font-weight:700;fill:var(--tx)">*&gt;</text>
<rect class="bx" x="34" y="8" width="74" height="22" rx="4"/><text class="sm" x="71" y="23" text-anchor="middle" style="font-weight:700;fill:var(--tx)">8.8.8.0/24</text>
<rect class="bx" x="112" y="8" width="70" height="22" rx="4"/><text class="sm" x="147" y="23" text-anchor="middle" style="font-weight:700;fill:var(--tx)">101.0.0.1</text>
<rect class="bx" x="186" y="8" width="82" height="22" rx="4"/><text class="sm" x="227" y="23" text-anchor="middle" style="font-weight:700;fill:var(--tx)">64501 64510</text>
<rect class="bx" x="272" y="8" width="20" height="22" rx="4"/><text class="sm" x="282" y="23" text-anchor="middle" style="font-weight:700;fill:var(--tx)">i</text>
<g><rect x="2" y="6" width="30" height="26" rx="5" style="fill:none;stroke:#d97706;stroke-width:2"/><text class="sm" x="4" y="52">*&gt; — путь годится (*) и он лучший (&gt;).</text><text class="sm" x="4" y="68">Без «&gt;» путь запасной: в таблицу маршрутов</text><text class="sm" x="4" y="84">он не попадает и соседям не отдаётся.</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.2;0.201;1"/></g>
<g opacity="0"><rect x="32" y="6" width="78" height="26" rx="5" style="fill:none;stroke:#d97706;stroke-width:2"/><text class="sm" x="4" y="52">Сеть, к которой ведёт путь. У второго пути</text><text class="sm" x="4" y="68">к той же сети это поле пустое: пути идут</text><text class="sm" x="4" y="84">строками подряд под одной сетью.</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.2;0.201;0.4;0.401;1"/></g>
<g opacity="0"><rect x="110" y="6" width="74" height="26" rx="5" style="fill:none;stroke:#d97706;stroke-width:2"/><text class="sm" x="4" y="52">Next-hop — куда слать: адрес соседа ISP1.</text><text class="sm" x="4" y="68">0.0.0.0 стоит у сетей, которые ты</text><text class="sm" x="4" y="84">анонсируешь сам.</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.4;0.401;0.6;0.601;1"/></g>
<g opacity="0"><rect x="184" y="6" width="86" height="26" rx="5" style="fill:none;stroke:#d97706;stroke-width:2"/><text class="sm" x="4" y="52">AS_PATH читай справа налево: сеть родилась</text><text class="sm" x="4" y="68">в 64510, к нам пришла от соседа 64501.</text><text class="sm" x="4" y="84">Чем короче путь, тем он лучше (раздел 6).</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.6;0.601;0.8;0.801;1"/></g>
<g opacity="0"><rect x="270" y="6" width="24" height="26" rx="5" style="fill:none;stroke:#d97706;stroke-width:2"/><text class="sm" x="4" y="52">Origin: i — сеть введена командой network,</text><text class="sm" x="4" y="68">? — через redistribute. На выбор пути</text><text class="sm" x="4" y="84">влияет редко.</text><animate attributeName="opacity" dur="15s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.8;0.801;1"/></g>
</svg><figcaption>Оранжевая рамка обходит поля строки по очереди, а под ней — что это поле значит.</figcaption></figure>
<p>Ещё три поля. <b>Metric</b> — это MED (раздел 5). <b>LocPrf</b> — local preference; пусто значит 100 по умолчанию. <b>Weight</b> — вес; у своих сетей он 32768. Буква <code>r</code> в начале строки (RIB-failure) значит: BGP путь выбрал, но в таблицу маршрутов не поставил — там уже есть та же сеть от источника с меньшей административной дистанцией, например статика. У eBGP дистанция 20, у iBGP — 200.</p>
<h3>Все пути к одной сети</h3>
<pre class="cli">R1#show ip bgp 8.8.8.0/24
BGP routing table entry for 8.8.8.0/24, version 5
Paths: (2 available, [[best #2]], table default)
  64502 64510
    102.0.0.1 from 102.0.0.1 (10.255.3.3)
      Origin IGP, localpref 100, valid, external
  64501 64510
    101.0.0.1 from 101.0.0.1 (10.255.2.2)
      Origin IGP, localpref 100, valid, external, [[best]]</pre>
<p>Здесь видно больше: localpref 100 (в общей таблице поле было пустым), router-id соседа в скобках, external — путь получен по eBGP, и слово <b>best</b> у выбранного пути. Почему выбран именно он — раздел 6.</p>
<h3>Три таблицы: что прислали, что принято, что отдано</h3>
<p>У BGP для каждого соседа есть «вход» и «выход», а между ними — общая таблица:</p>
<figure class="dg"><svg viewBox="0 0 320 206" role="img" aria-label="Путь маршрута внутри маршрутизатора: получено от соседа, входной фильтр, таблица BGP, затем таблица маршрутов и отдача другим соседям">
<path class="ln" d="M160 26 L160 42 M160 68 L160 80 M160 100 L160 112 M120 138 L78 166 M200 138 L242 166"/>
<rect class="bx" x="100" y="4" width="120" height="22" rx="6"/><text class="sm" x="160" y="19" text-anchor="middle" style="font-weight:700;fill:var(--tx)">сосед ISP1</text>
<rect class="bx" x="40" y="42" width="240" height="26" rx="6"/><text class="sm" x="160" y="59" text-anchor="middle">1. Что прислал — received-routes</text>
<rect class="bxd" x="40" y="80" width="240" height="20" rx="6"/><text class="sm og" x="160" y="94" text-anchor="middle">фильтр на входе (route-map in)</text>
<rect class="bx" x="40" y="112" width="240" height="26" rx="6"/><text class="sm" x="160" y="129" text-anchor="middle">2. Принято — show ip bgp, лучший «&gt;»</text>
<rect class="bx" x="8" y="166" width="140" height="26" rx="6"/><text class="sm" x="78" y="183" text-anchor="middle">3. RIB — show ip route</text>
<rect class="bx" x="172" y="166" width="140" height="26" rx="6"/><text class="sm" x="242" y="183" text-anchor="middle">4. advertised-routes</text>
<text class="sm og" x="236" y="156">фильтр out</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="12s" repeatCount="indefinite" path="M160 15 L160 55 L160 90 L160 125 L78 179" keyPoints="0;0;1;1" keyTimes="0;0.05;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.44;0.45;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="12s" repeatCount="indefinite" path="M160 125 L242 179" keyPoints="0;0;1;1" keyTimes="0;0.45;0.58;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.44;0.45;0.6;0.61;1"/></g>
<g opacity="0"><rect x="-29" y="-7" width="58" height="14" rx="3" class="rr"/><text class="wt2" x="0" y="3" text-anchor="middle">10.0.0.0/8</text><animateMotion dur="12s" repeatCount="indefinite" path="M160 15 L160 55 L160 88" keyPoints="0;0;1;1" keyTimes="0;0.66;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.65;0.66;0.9;0.91;1"/></g>
<g opacity="0"><path class="lr" d="M258 84 L270 96 M270 84 L258 96"/><animate attributeName="opacity" dur="12s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.8;0.81;0.9;0.91;1"/></g>
</svg><figcaption>Белый конверт — маршрут, который прошёл входной фильтр: он попадает в таблицу BGP, оттуда в таблицу маршрутов и, через выходной фильтр, другим соседям. Красный — маршрут, который входной фильтр не пропустил: received-routes его покажет, а show ip bgp — уже нет.</figcaption></figure>
<table><tr><th>Вопрос</th><th>Команда</th></tr>
<tr><td>Что прислал сосед (до моих фильтров)?</td><td><code>show ip bgp neighbors 101.0.0.1 received-routes</code> — работает, только если включено <code>neighbor 101.0.0.1 soft-reconfiguration inbound</code></td></tr>
<tr><td>Что от него принято (после фильтров)?</td><td><code>show ip bgp neighbors 101.0.0.1 routes</code></td></tr>
<tr><td>Что я ему отдаю?</td><td><code>show ip bgp neighbors 101.0.0.1 advertised-routes</code></td></tr></table>
<p>Эти три команды — главный инструмент дежурного. Клиент говорит: «анонсирую сеть, а у вас её нет». Смотришь received-routes и routes у себя и просишь клиента показать advertised-routes у него. Сразу видно, где маршрут потерялся: не отправлен, не дошёл или выброшен фильтром.</p>
<div class="callout warn"><b>Поменял фильтр — попроси маршруты заново</b>Новый фильтр не применяется к уже полученным маршрутам сам. Нужно <code>clear ip bgp 101.0.0.1 soft in</code>: маршрутизатор попросит соседа прислать всё заново (ROUTE-REFRESH) и пропустит через новый фильтр. Для исходящего — <code>soft out</code>. Без слова soft сессия рвётся целиком, а с full view это минуты перезагрузки миллиона маршрутов. В рабочей сети <code>clear ip bgp *</code> без soft не делают.</div>
<div class="callout lab"><b>В лабе</b>Задания 2 и 3: найдёшь свою сеть в show ip bgp, посмотришь advertised-routes к провайдерам, а для 8.8.8.0/24 разберёшь все пути и выбранный. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что значат * и &gt; в начале строки?</summary><p>* — путь годится (next-hop достижим, петли нет). &gt; — этот путь выбран лучшим: он идёт в таблицу маршрутов и отдаётся соседям.</p></details>
<details class="chk"><summary>Проверь себя: как прочитать путь «64502 64510 i»?</summary><p>Справа налево: сеть родилась в AS64510, к нам пришла от соседа AS64502. Буква i — origin IGP: сеть введена в BGP командой network.</p></details>
<details class="chk"><summary>Проверь себя: клиент говорит, что анонсирует 100.0.0.0/23, а у тебя её нет. Какие три команды и где посмотришь?</summary><p>У себя — received-routes (прислал ли он) и routes (прошла ли сеть фильтр). У клиента — advertised-routes (отдаёт ли он её тебе).</p></details>`},

{h:'Атрибуты: чем один путь отличается от другого', html:`
<p>У R1 два пути к 8.8.8.0/24 — через ISP1 и через ISP2. Какой лучше? BGP сравнивает их по <b>атрибутам</b> — полям маршрута. Четыре из них ты знаешь по главе 11: сеть, next-hop, AS_PATH, community. Для выбора пути важны ещё четыре.</p>
<h3>Weight — личное предпочтение маршрутизатора</h3>
<p>Есть только у Cisco. Живёт внутри одного маршрутизатора и никуда не передаётся. Больше — лучше. У полученных маршрутов weight 0, у своих — 32768. Применение: «на этом маршрутизаторе предпочитай вот этого соседа» — и больше нигде.</p>
<h3>LOCAL_PREF — правило для всей своей AS</h3>
<p>Local preference передаётся всем маршрутизаторам своей AS по iBGP, но <b>никогда</b> — в другую AS. Больше — лучше, по умолчанию 100. Это главный рычаг выбора выхода из сети: «весь трафик — через дешёвого провайдера» — и это правило знают все твои маршрутизаторы. Провайдеры через local-pref ставят приоритеты по деньгам: например, маршрутам клиентов 200, пиров 150, аплинков 100. Клиент платит — путь к нему важнее всего.</p>
<h3>AS_PATH — сколько сетей по дороге</h3>
<p>Ты его знаешь. Для выбора пути важно: короче — лучше. На этом построен главный способ попросить мир заходить к тебе через другого провайдера: <b>prepend</b> — дописать свой номер в путь несколько раз, чтобы он выглядел длиннее (раздел 10).</p>
<h3>ORIGIN — откуда маршрут взялся</h3>
<p>Буква в конце строки: <code>i</code> — введён командой network, <code>?</code> — через redistribute, <code>e</code> — от древнего протокола EGP, сегодня не встречается. Лучше i, потом e, потом ?. Решает редко.</p>
<h3>MED — подсказка соседу, где входить</h3>
<p>Multi-exit discriminator, в выводах — Metric. Ставишь его на свои анонсы соседней AS, и та учитывает его при выборе: меньше — лучше. Дальше соседа MED не уходит. По умолчанию Cisco сравнивает MED только между путями от <b>одной и той же</b> соседней AS. Применение: у тебя два стыка с одним провайдером в разных городах, и ты подсказываешь ему: «ко мне входи через Москву».</p>
<h3>Community — ярлыки</h3>
<p>Ярлыки ты знаешь по главе 11. Есть общепринятые: <code>no-export</code> — «не отдавать за пределы AS», <code>no-advertise</code> — «не отдавать никому», <code>65535:666</code> — «выбрасывать трафик к этой сети» (раздел 11). А ещё каждый крупный провайдер публикует свои ярлыки-команды для клиентов (раздел 10). Напомню: Cisco передаёт community, только если включено <code>send-community</code>.</p>
<figure class="dg"><svg viewBox="0 0 320 178" role="img" aria-label="Как далеко уходит каждый атрибут: weight — только маршрутизатор, local-pref — своя AS, MED — до соседней AS, AS_PATH и community — весь интернет">
<text class="sm" x="110" y="14" text-anchor="middle">роутер</text><text class="sm" x="170" y="14" text-anchor="middle">своя AS</text><text class="sm" x="230" y="14" text-anchor="middle">соседняя</text><text class="sm" x="290" y="14" text-anchor="middle">интернет</text>
<path d="M140 20 L140 142 M200 20 L200 142 M260 20 L260 142" fill="none" stroke="var(--tx3)" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>
<text class="sm" x="4" y="38">Weight</text><text class="sm" x="4" y="62">LOCAL_PREF</text><text class="sm" x="4" y="86">MED</text><text class="sm" x="4" y="110">AS_PATH</text><text class="sm" x="4" y="134">community</text>
<rect x="82" y="27" width="56" height="14" rx="3" class="gr"><animate attributeName="width" dur="12s" repeatCount="indefinite" values="0;0;56;56" keyTimes="0;0.05;0.15;1"/></rect>
<rect x="82" y="51" width="116" height="14" rx="3" class="pu"><animate attributeName="width" dur="12s" repeatCount="indefinite" values="0;0;116;116" keyTimes="0;0.2;0.32;1"/></rect>
<rect x="82" y="75" width="176" height="14" rx="3" class="o"><animate attributeName="width" dur="12s" repeatCount="indefinite" values="0;0;176;176" keyTimes="0;0.37;0.5;1"/></rect>
<rect x="82" y="99" width="236" height="14" rx="3" class="b"><animate attributeName="width" dur="12s" repeatCount="indefinite" values="0;0;236;236" keyTimes="0;0.55;0.7;1"/></rect>
<rect x="82" y="123" width="236" height="14" rx="3" class="g"><animate attributeName="width" dur="12s" repeatCount="indefinite" values="0;0;236;236" keyTimes="0;0.72;0.85;1"/></rect>
<text class="sm" x="160" y="160" text-anchor="middle">Weight и LOCAL_PREF решают за тебя,</text><text class="sm" x="160" y="174" text-anchor="middle">MED, AS_PATH и community — подсказки другим</text>
</svg><figcaption>Полоса показывает, как далеко уходит атрибут от маршрутизатора, где его поставили. Community доходит до интернета, только если на каждом шаге включено send-community и его никто не стёр.</figcaption></figure>
<table><tr><th>Атрибут</th><th>Лучше</th><th>Куда доходит</th><th>Чем управляет</th></tr>
<tr><td>Weight</td><td>больше</td><td>только этот маршрутизатор</td><td>выход с одного маршрутизатора</td></tr>
<tr><td>LOCAL_PREF</td><td>больше</td><td>вся своя AS</td><td>выход из всей AS — исходящий трафик</td></tr>
<tr><td>AS_PATH</td><td>короче</td><td>весь интернет</td><td>через prepend — входящий трафик</td></tr>
<tr><td>ORIGIN</td><td>i, потом e, потом ?</td><td>весь интернет</td><td>почти ничем</td></tr>
<tr><td>MED</td><td>меньше</td><td>соседняя AS</td><td>вход от одного соседа</td></tr>
<tr><td>community</td><td>—</td><td>куда пропустят</td><td>просьбы к провайдеру</td></tr></table>
<div class="an"><b>Аналогия</b>Выбор дороги в отпуск. Weight — твоё личное желание: «хочу на поезде». LOCAL_PREF — правило всей семьи, которое знает каждый: «летаем только этой авиакомпанией». AS_PATH — число пересадок: меньше — лучше. MED — совет гостиницы: «подъезжайте к северному входу, оттуда ближе к вашему корпусу».</div>
<div class="callout lab"><b>В лабе</b>Задание 3: найдёшь эти поля в <code>show ip bgp 8.8.8.0/24</code>. В заданиях 6 и 7 будешь сам менять local-pref, AS_PATH и community. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: чем LOCAL_PREF отличается от Weight?</summary><p>Weight живёт в одном маршрутизаторе и никуда не передаётся. LOCAL_PREF знают все маршрутизаторы своей AS. У обоих больше — лучше, оба управляют исходящим трафиком.</p></details>
<details class="chk"><summary>Проверь себя: ты поставил MED 50 на анонс для ISP1. Увидит ли этот MED R4, аплинк ISP1?</summary><p>Нет. MED уходит только в соседнюю AS и дальше не передаётся.</p></details>
<details class="chk"><summary>Проверь себя: какой атрибут меняют, чтобы мир реже заходил к тебе через одного из провайдеров?</summary><p>AS_PATH — через prepend путь через этого провайдера становится длиннее. Ещё можно повесить ярлык-community, если провайдер их поддерживает.</p></details>`},

{h:'Выбор лучшего пути по шагам', html:`
<p>Когда к одной сети несколько путей, BGP выбирает один лучший. Только он идёт в таблицу маршрутов, и только его BGP отдаёт соседям. Выбор — строгая лестница: пути сравнивают по первому признаку; если равны — по следующему, и так до первого различия.</p>
<h3>Сначала: путь вообще годится?</h3>
<p>До сравнения выбывают негодные пути: next-hop недостижим (нет маршрута до него — частая беда в iBGP, глава 8.1), в AS_PATH есть своя AS (петля), путь не прошёл входной фильтр.</p>
<h3>Лестница Cisco</h3>
<ol class="steps">
<li><b>Weight</b> — больше лучше.</li>
<li><b>LOCAL_PREF</b> — больше лучше.</li>
<li><b>Свой маршрут</b> — тот, что этот маршрутизатор сам ввёл в BGP (network, aggregate, redistribute), лучше полученного.</li>
<li><b>AS_PATH</b> — короче лучше.</li>
<li><b>ORIGIN</b> — i лучше e, e лучше ?.</li>
<li><b>MED</b> — меньше лучше, но только если оба пути от одной соседней AS.</li>
<li><b>eBGP лучше iBGP</b>.</li>
<li><b>Ближе до next-hop по IGP</b> — меньшая метрика OSPF или IS-IS до выхода. Это «горячая картошка»: отдать чужой трафик из своей сети побыстрее.</li>
<li><b>Самый старый путь</b> (для eBGP) — кто пришёл раньше, тот и остаётся: меньше переключений.</li>
<li><b>Меньший router-id</b> соседа, дальше ещё пара технических шагов — чтобы ничьей не было никогда.</li></ol>
<div class="an"><b>Как запомнить</b>Лестницу удобно делить на четыре этажа. Наверху — <b>решения людей</b>: weight, local-pref, свой маршрут. Ниже — <b>сам путь</b>: длина AS_PATH, ORIGIN, MED. Ещё ниже — <b>устройство своей сети</b>: eBGP или iBGP, расстояние по IGP. Внизу — <b>жребий ради стабильности</b>: самый старый, меньший router-id. Решения людей всегда важнее всего остального.</div>
<h3>Разбор на лабе: 8.8.8.0/24 у R1</h3>
<figure class="dg"><svg viewBox="0 0 320 270" role="img" aria-label="Лестница выбора пути для двух путей к 8.8.8.0/24: сначала решает самый старый путь, после local-pref 200 решает второй шаг">
<text class="sm" x="8" y="16" style="font-weight:700;fill:var(--tx)">шаг</text><text class="sm" x="180" y="16" text-anchor="middle" style="font-weight:700;fill:var(--tx)">ISP1</text><text class="sm" x="240" y="16" text-anchor="middle" style="font-weight:700;fill:var(--tx)">ISP2</text><text class="sm" x="296" y="16" text-anchor="middle" style="font-weight:700;fill:var(--tx)">итог</text>
<g opacity="0"><rect x="4" y="0" width="312" height="20" rx="4" class="pp"/><animateMotion dur="16s" repeatCount="indefinite" path="M0 24 L0 200" keyPoints="0;0;1;1" keyTimes="0;0.03;0.45;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.52;0.53;1"/></g>
<g opacity="0"><rect x="4" y="0" width="312" height="20" rx="4" class="pp"/><animateMotion dur="16s" repeatCount="indefinite" path="M0 24 L0 46" keyPoints="0;0;1;1" keyTimes="0;0.6;0.66;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.59;0.6;0.97;1"/></g>
<text class="sm" x="8" y="38">1  Weight</text><text class="sm" x="180" y="38" text-anchor="middle">0</text><text class="sm" x="240" y="38" text-anchor="middle">0</text>
<text class="sm" x="8" y="60">2  LOCAL_PREF</text><text class="sm" x="240" y="60" text-anchor="middle">100</text>
<g><text class="sm" x="180" y="60" text-anchor="middle">100</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.56;0.561;1"/></g>
<g opacity="0"><text class="sm gn" x="180" y="60" text-anchor="middle" style="font-weight:700">200</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.56;0.561;1"/></g>
<text class="sm" x="8" y="82">3  свой маршрут</text><text class="sm" x="180" y="82" text-anchor="middle">нет</text><text class="sm" x="240" y="82" text-anchor="middle">нет</text>
<text class="sm" x="8" y="104">4  длина AS_PATH</text><text class="sm" x="180" y="104" text-anchor="middle">2</text><text class="sm" x="240" y="104" text-anchor="middle">2</text>
<text class="sm" x="8" y="126">5  ORIGIN</text><text class="sm" x="180" y="126" text-anchor="middle">i</text><text class="sm" x="240" y="126" text-anchor="middle">i</text>
<text class="sm" x="8" y="148">6  MED</text><text class="sm" x="180" y="148" text-anchor="middle">—</text><text class="sm" x="240" y="148" text-anchor="middle">—</text>
<text class="sm" x="8" y="170">7  eBGP или iBGP</text><text class="sm" x="180" y="170" text-anchor="middle">eBGP</text><text class="sm" x="240" y="170" text-anchor="middle">eBGP</text>
<text class="sm" x="8" y="192">8  IGP до next-hop</text><text class="sm" x="180" y="192" text-anchor="middle">0</text><text class="sm" x="240" y="192" text-anchor="middle">0</text>
<text class="sm" x="8" y="214">9  самый старый</text><text class="sm" x="180" y="214" text-anchor="middle">раньше</text><text class="sm" x="240" y="214" text-anchor="middle">позже</text>
<g opacity="0"><text class="sm" x="296" y="38" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.035;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="60" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.0825;0.0875;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="82" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.135;0.14;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="104" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.1875;0.1925;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="126" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.245;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="148" text-anchor="middle">пропуск</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.2925;0.2975;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="170" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.345;0.35;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="192" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.3975;0.4025;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm gn" x="296" y="214" text-anchor="middle" style="font-weight:700">ISP1</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.45;0.455;0.53;0.531;1"/></g>
<g opacity="0"><text class="sm" x="296" y="38" text-anchor="middle">=</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.6;0.605;0.97;1"/></g>
<g opacity="0"><text class="sm gn" x="296" y="60" text-anchor="middle" style="font-weight:700">ISP1</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.66;0.665;0.97;1"/></g>
<g><text class="sm" x="160" y="244" text-anchor="middle">Всё равно до шага 9 — побеждает путь,</text><text class="sm" x="160" y="260" text-anchor="middle">который пришёл раньше</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.54;0.541;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="244" text-anchor="middle">LOCAL_PREF 200 у ISP1 — решено на шаге 2,</text><text class="sm gn" x="160" y="260" text-anchor="middle">до длины пути дело не дошло</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.55;0.551;1"/></g>
</svg><figcaption>Синяя полоса идёт по лестнице сверху вниз. Сначала пути равны до самого низа, и решает «кто раньше пришёл». Потом на маршруты от ISP1 поставили local-pref 200, и всё решилось на втором шаге.</figcaption></figure>
<p>Пройдём лестницу словами. Weight 0 у обоих, local-pref 100 у обоих, оба пути не свои, в AS_PATH по два номера, ORIGIN i. MED не сравнивается: пути от разных AS (64501 и 64502). Оба eBGP. До next-hop одинаково: соседи подключены напрямую. Дошли до шага 9: побеждает путь, который пришёл раньше, — от той сессии, что поднялась первой. В <code>show ip bgp</code> это словами не написано: «старый» путь просто стоит с отметкой best.</p>
<p>Теперь поставим на всё от ISP1 local-pref 200 (раздел 10). Решение примется уже на шаге 2, и до AS_PATH дело не дойдёт: решение людей важнее длины пути.</p>
<div class="callout warn"><b>Сначала — самая точная сеть</b>Лестница сравнивает только пути <b>к одной и той же</b> сети. Если от ISP1 пришёл только default 0.0.0.0/0, а от ISP2 — 8.8.8.0/24, никакой local-pref не поможет: пакет к 8.8.8.8 пойдёт по самому точному маршруту, /24, через ISP2. Longest match из главы 3 стоит над всеми атрибутами BGP. На этом построен самый сильный способ управлять входящим трафиком (раздел 10) — и на этом же легко споткнуться в задании 6 лабы.</div>
<div class="callout pro"><b>Балансировка: maximum-paths</b>По умолчанию в таблицу маршрутов идёт один лучший путь. Командой <code>maximum-paths 2</code> можно поставить два равных eBGP-пути и делить трафик между ними (ECMP). Но «равные» — строго: совпасть должны шаги до 8-го, а у Cisco по умолчанию ещё и весь AS_PATH. Пути через двух разных провайдеров так не сложатся без дополнительной команды <code>bgp bestpath as-path multipath-relax</code>.</div>
<div class="callout lab"><b>В лабе</b>Задание 3: сам пройдёшь лестницу для 8.8.8.0/24 на R1 и для 100.0.0.0/23 на R4 и письменно назовёшь шаг, на котором принято решение. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: путь через ISP1 — local-pref 100, AS_PATH из 2 номеров. Через ISP2 — local-pref 150, AS_PATH из 3. Какой лучше и на каком шаге?</summary><p>Через ISP2, на шаге 2: local-pref проверяется раньше длины пути.</p></details>
<details class="chk"><summary>Проверь себя: почему в лабе R1 выбирает между ISP1 и ISP2 по «самому старому» пути?</summary><p>Всё остальное у путей одинаково: weight, local-pref, длина пути, origin, оба eBGP, next-hop подключены напрямую, а MED между разными AS не сравнивается.</p></details>
<details class="chk"><summary>Проверь себя: от ISP1 пришёл только default с local-pref 200, от ISP2 — 8.8.8.0/24 с local-pref 100. Куда пойдёт пакет к 8.8.8.8?</summary><p>Через ISP2: сеть /24 точнее default, а longest match решает раньше BGP. Local-pref сравнивает только пути к одной и той же сети.</p></details>`},

{h:'Инструменты политики: prefix-list, as-path и route-map', html:`
<p><b>Политика</b> (policy) в BGP — это ответы на два вопроса для каждого соседа: какие маршруты <b>принять</b> или <b>отдать</b> и какие атрибуты у них <b>поменять</b>. Инструментов четыре. Ты будешь пользоваться ими во всех следующих разделах.</p>
<h3>Prefix-list — фильтр по сети и маске</h3>
<pre class="cli">ip prefix-list CUST seq 10 permit 100.0.0.0/23 le 24</pre>
<p>Читается так: «сети внутри 100.0.0.0/23 с маской от /23 до /24» — то есть сам блок и обе его половины. Без <code>le</code> и <code>ge</code> совпадает только сеть с точно такой маской. <code>le</code> (less or equal) — «маска не длиннее», <code>ge</code> (greater or equal) — «маска не короче».</p>
<table><tr><th>Строка</th><th>Что совпадёт</th></tr>
<tr><td><code>permit 100.0.0.0/23</code></td><td>только сам /23</td></tr>
<tr><td><code>permit 100.0.0.0/23 le 24</code></td><td>/23 и обе /24 внутри</td></tr>
<tr><td><code>permit 100.0.0.0/23 ge 24 le 24</code></td><td>только /24 внутри блока, без самого /23</td></tr>
<tr><td><code>permit 100.0.0.0/23 ge 32</code></td><td>отдельные адреса /32 из блока (пригодится в разделе 11)</td></tr>
<tr><td><code>permit 0.0.0.0/0</code></td><td>только default</td></tr>
<tr><td><code>permit 0.0.0.0/0 le 32</code></td><td>любая сеть</td></tr>
<tr><td><code>deny 0.0.0.0/0 ge 25</code></td><td>всё длиннее /24</td></tr></table>
<p>Строки проверяются по порядку номеров <code>seq</code>, первое совпадение решает, а в конце стоит невидимый «deny всё». Как в ACL из главы 5: строка deny выше permit закроет то, что permit должен был пропустить.</p>
<h3>AS-path список — фильтр по пути</h3>
<p>Путь проверяют регулярным выражением (regex) — шаблоном для текста. Хватает пяти значков: <code>^</code> — начало пути, <code>$</code> — конец, <code>_</code> — граница номера (пробел, начало или конец), <code>.</code> — любой символ, <code>*</code> — «повторить сколько угодно раз».</p>
<table><tr><th>Шаблон</th><th>Что совпадёт</th></tr>
<tr><td><code>^$</code></td><td>пустой путь — только <b>свои</b> сети</td></tr>
<tr><td><code>^64501_</code></td><td>пришло от соседа 64501 (он первый в пути)</td></tr>
<tr><td><code>_64510$</code></td><td>сеть родилась в 64510 (он последний)</td></tr>
<tr><td><code>_64510_</code></td><td>64510 где угодно в пути</td></tr>
<tr><td><code>^64500(_64500)*$</code></td><td>сети клиента 64500, в том числе с prepend «64500 64500 64500»</td></tr></table>
<pre class="cli">ip as-path access-list 1 permit ^$
router bgp 64500
 neighbor 101.0.0.1 filter-list 1 out</pre>
<p>Эта пара строк — «провайдеру отдавать только свои сети». Она тебе понадобится в разделе 8.</p>
<h3>Community-list — фильтр по ярлыкам</h3>
<pre class="cli">ip community-list standard LP80 permit 64502:80</pre>
<p>Совпадёт любой маршрут, на котором висит ярлык 64502:80.</p>
<h3>Route-map — «если …, то сделай …»</h3>
<p>Route-map состоит из секций с номерами. В каждой есть условия <code>match</code> («если») и действия <code>set</code> («то сделай»), а сама секция — <code>permit</code> (пропустить) или <code>deny</code> (выбросить). Правила такие:</p>
<ul><li>Секции проверяются по порядку номеров, срабатывает <b>первая</b> подходящая.</li>
<li>Несколько строк match в одной секции — это «и»: маршрут должен подойти под все.</li>
<li>Секция без match подходит <b>всем</b>.</li>
<li>Если не подошла ни одна секция — маршрут <b>выбрасывается</b>: в конце невидимый deny.</li></ul>
<pre class="cli">route-map FROM-ISP2 permit 10
 match ip address prefix-list ONLY8
 set local-preference 50
route-map FROM-ISP2 permit 20
router bgp 64500
 neighbor 102.0.0.1 route-map FROM-ISP2 in</pre>
<p>Секция 10 понижает local-pref одной сети. Секция 20 без match и без set пропускает всё остальное без изменений. Убери её — и случится вот что:</p>
<figure class="dg"><svg viewBox="0 0 320 210" role="img" aria-label="Route-map из одной секции выбрасывает всё, что не совпало; с пустой секцией permit 20 остальные маршруты проходят">
<text class="sm" x="44" y="14" text-anchor="middle">от ISP2:</text>
<text class="sm" x="172" y="14" text-anchor="middle" style="font-weight:700;fill:var(--tx)">route-map FROM-ISP2</text>
<text class="sm" x="278" y="14" text-anchor="middle">принято</text>
<rect class="bx" x="112" y="22" width="120" height="40" rx="6"/><text class="sm" x="172" y="38" text-anchor="middle" style="font-weight:700;fill:var(--tx)">permit 10</text><text class="sm" x="172" y="54" text-anchor="middle">match ONLY8 → LP 50</text>
<g opacity="0"><rect class="bx" x="112" y="72" width="120" height="30" rx="6" style="stroke:#16a34a"/><text class="sm gn" x="172" y="91" text-anchor="middle" style="font-weight:700">permit 20 (всё)</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
<rect class="bx" x="112" y="134" width="120" height="24" rx="6" style="stroke:#e11d48"/><text class="sm rd" x="172" y="150" text-anchor="middle">неявный deny</text>
<rect class="bx" x="240" y="22" width="76" height="80" rx="6"/>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M44 34 L172 42 L278 36" keyPoints="0;0;0.547;1;1" keyTimes="0;0.03;0.08;0.13;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.49;0.5;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">1.1.1.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M44 52 L172 42 L172 146" keyPoints="0;0;0.5525;1;1" keyTimes="0;0.17;0.22;0.28;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.16;0.17;0.29;0.3;1"/></g>
<g opacity="0"><path class="lr" d="M212 139 L226 153 M226 139 L212 153"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.29;0.3;0.34;0.35;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">203.0.113.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M44 70 L172 42 L172 146" keyPoints="0;0;0.5575;1;1" keyTimes="0;0.33;0.38;0.44;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.32;0.33;0.45;0.46;1"/></g>
<g opacity="0"><path class="lr" d="M212 139 L226 153 M226 139 L212 153"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.45;0.46;0.49;0.5;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M44 34 L172 42 L278 36" keyPoints="0;0;0.547;1;1" keyTimes="0;0.53;0.58;0.63;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.52;0.53;0.97;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">1.1.1.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M44 52 L172 42 L172 87 L278 58" keyPoints="0;0;0.4532;0.612;1;1" keyTimes="0;0.64;0.68;0.71;0.75;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.63;0.64;0.97;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">203.0.113.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M44 70 L172 42 L172 87 L278 80" keyPoints="0;0;0.4642;0.6236;1;1" keyTimes="0;0.77;0.81;0.84;0.88;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.76;0.77;0.97;1"/></g>
<g><text class="sm" x="160" y="184" text-anchor="middle">Совпала только 8.8.8.0/24 — ей LP 50.</text><text class="sm rd" x="160" y="200" text-anchor="middle">Остальные упали в невидимый deny в конце</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><text class="sm" x="160" y="184" text-anchor="middle">Добавили пустой permit 20 —</text><text class="sm gn" x="160" y="200" text-anchor="middle">остальные прошли без изменений</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.51;0.52;1"/></g>
</svg><figcaption>Слева — три маршрута от ISP2. Сначала в route-map одна секция: совпадает только 8.8.8.0/24, остальные проходят мимо всех секций и выбрасываются. Потом добавлена пустая секция permit 20, и они проходят без изменений.</figcaption></figure>
<div class="an"><b>Аналогия</b>Route-map — охранник на проходной со списком правил. Он читает правила сверху вниз и применяет первое подходящее: «сотрудникам — пропуск и синий бейдж», «гостям — пропуск и гостевой бейдж». Кто не подошёл ни под одно правило, того не пускают. Чтобы никого случайно не развернуть, в конце пишут правило «всем остальным — пропуск без бейджа».</div>
<div class="callout bad"><b>Классическая авария</b>Инженер хотел понизить предпочтение одной сети и написал route-map из одной секции с match. После soft in из миллиона маршрутов от аплинка осталась одна сеть: остальные съел невидимый deny. Правило: если route-map должен что-то <b>менять</b>, а не <b>фильтровать</b>, в конце нужна пустая секция permit.</div>
<p>Применяют инструменты к соседу так: route-map — <code>neighbor X route-map ИМЯ in</code> (на входе) или <code>out</code> (на выходе); prefix-list и as-path можно и напрямую — <code>neighbor X prefix-list ИМЯ in|out</code>, <code>neighbor X filter-list N in|out</code>. После изменения — <code>clear ip bgp X soft in</code> или <code>soft out</code> (раздел 4).</p>
<div class="callout lab"><b>В лабе</b>Поломка 4: route-map без последней секции — от ISP2 осталась одна сеть. Поломка 5: в prefix-list строка deny встала выше permit. А сами инструменты понадобятся в заданиях 4–8. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что совпадёт с permit 100.0.0.0/23 le 24?</summary><p>Сам блок /23 и обе его половины /24. Сети длиннее /24 (например, /25) — нет.</p></details>
<details class="chk"><summary>Проверь себя: что значит шаблон ^$ и зачем фильтровать по нему анонсы клиента к провайдеру?</summary><p>Пустой путь — сети, которые родились в своей AS. Фильтр ^$ на выходе к провайдеру выпускает только свои сети и не даёт стать транзитом.</p></details>
<details class="chk"><summary>Проверь себя: route-map из одной секции permit 10 с match. Что будет с маршрутами, которые не совпали?</summary><p>Они выбрасываются: в конце route-map невидимый deny. Чтобы пропустить их без изменений, нужна пустая секция permit в конце.</p></details>`},

{h:'Не стать транзитом: правило экспорта и утечки маршрутов', html:`
<h3>По умолчанию BGP раздаёт всё</h3>
<p>BGP не знает про деньги и договоры. Свой лучший путь к каждой сети он по умолчанию отдаёт <b>всем</b> eBGP-соседям. Что это значит для R1? Он получает интернет и от ISP1, и от ISP2. Допустим, лучший путь к 8.8.8.0/24 у него через ISP2. Тогда R1 честно сообщает ISP1: «8.8.8.0/24 — через меня, путь 64500 64502 64510». Клиент, сам того не желая, предложил себя как транзит между двумя провайдерами.</p>
<p>Опасно ли это? Путь через клиента длиннее, и при прочих равных провайдер его не выберет. Но у провайдеров прочие обычно не равны: маршрутам клиентов они ставят повышенный local-pref (раздел 5). А local-pref стоит на лестнице выше длины пути (раздел 6). Тогда провайдер погонит к 8.8.8.0/24 трафик своих абонентов через тонкий канал клиента:</p>
<figure class="dg"><svg viewBox="0 0 320 228" role="img" aria-label="Утечка: клиент без фильтра анонсирует ISP1 маршрут к 8.8.8.0/24 через себя, и трафик ISP1 идёт через канал клиента">
<path class="ln" d="M54 94 L136 48 M54 106 L136 152 M184 48 L266 94 M184 152 L266 106"/>
<path class="ln" d="M160 54 L160 146" style="stroke-dasharray:4 4"/>
<g opacity="0"><path class="lr" d="M54 94 L136 48 M54 106 L136 152 M184 152 L266 106" style="stroke-width:4"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.36;0.37;1"/></g>
<rect class="bx" x="6" y="88" width="48" height="24" rx="6"/><text class="tx" x="30" y="104" text-anchor="middle">R1</text>
<rect class="bx" x="136" y="30" width="48" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R2</text>
<rect class="bx" x="136" y="146" width="48" height="24" rx="6"/><text class="tx" x="160" y="162" text-anchor="middle">R3</text>
<rect class="bx" x="266" y="88" width="48" height="24" rx="6"/><text class="tx" x="290" y="104" text-anchor="middle">R4</text>
<text class="sm" x="30" y="128" text-anchor="middle">AS64500</text>
<text class="sm" x="160" y="22" text-anchor="middle">ISP1 · AS64501</text>
<text class="sm" x="160" y="186" text-anchor="middle">ISP2 · AS64502</text>
<text class="sm" x="290" y="128" text-anchor="middle">8.8.8.0/24</text>
<g opacity="0"><rect x="-56" y="-7" width="112" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24 через меня</text><animateMotion dur="14s" repeatCount="indefinite" path="M66 80 L118 50" keyPoints="0;0;1;1" keyTimes="0;0.05;0.28;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.31;0.32;1"/></g>
<g opacity="0"><rect x="-6" y="-4" width="12" height="8" rx="2" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M160 42 L30 100 L160 158 L290 100" keyPoints="0;0;1;1" keyTimes="0;0.38;0.68;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.37;0.38;0.68;0.69;1"/></g>
<g opacity="0"><rect x="-6" y="-4" width="12" height="8" rx="2" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M160 42 L30 100 L160 158 L290 100" keyPoints="0;0;1;1" keyTimes="0;0.5;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.49;0.5;0.8;0.81;1"/></g>
<g opacity="0"><rect x="-6" y="-4" width="12" height="8" rx="2" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M160 42 L30 100 L160 158 L290 100" keyPoints="0;0;1;1" keyTimes="0;0.62;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.61;0.62;0.92;0.93;1"/></g>
<g opacity="0"><text class="sm rd" x="4" y="154">канал клиента</text><text class="sm rd" x="4" y="167">забит</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.45;0.46;1"/></g>
<g><text class="sm" x="160" y="206" text-anchor="middle">Без фильтра R1 сообщает ISP1: «к 8.8.8.0/24 —</text><text class="sm" x="160" y="220" text-anchor="middle">через меня» (путь 64500 64502 64510)</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.35;0.36;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="206" text-anchor="middle">ISP1 любит маршруты клиентов (LP выше) —</text><text class="sm rd" x="160" y="220" text-anchor="middle">и шлёт трафик к 8.8.8.0/24 через клиента</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.36;0.37;1"/></g>
</svg><figcaption>Оранжевая наклейка — лишний анонс клиента. Красные пакеты — трафик ISP1 к 8.8.8.0/24, который пошёл через клиента: от ISP1 к R1, оттуда к ISP2 и дальше в интернет. Клиент платит за свой канал и везёт по нему чужой трафик.</figcaption></figure>
<h3>Утечка и угон: не путай</h3>
<ul><li><b>Утечка маршрутов</b> (route leak) — настоящие маршруты ушли туда, куда не положено по договорам. Как в примере выше. Громкий случай — 24 июня 2019 года: маршруты многих крупных сетей, в том числе Cloudflare, утекли через небольшую компанию — клиента американского Verizon, а Verizon разнёс их дальше. Часть интернета на несколько часов пошла через маленькую сеть и задохнулась.</li>
<li><b>Угон</b> (hijack) — кто-то анонсирует чужую сеть как свою. В 2008 году пакистанский оператор должен был заблокировать YouTube внутри страны и для этого анонсировал более точную сеть YouTube /24. Анонс вышел за пределы страны, и YouTube пропал почти для всего интернета примерно на два часа: более точная сеть побеждает везде, куда дошла.</li></ul>
<h3>Защита с двух сторон</h3>
<p>Правило экспорта из раздела 1 приходится соблюдать руками. И защищаться должны обе стороны — на случай, если одна ошибётся:</p>
<ul><li><b>Клиент</b> отдаёт провайдерам только свои сети: <code>filter-list</code> с шаблоном <code>^$</code> или prefix-list со своим блоком.</li>
<li><b>Провайдер</b> принимает от клиента только сети, которые за клиентом записаны (раздел 9). В лабе так уже делает ISP2: его prefix-list пропускает от R1 только 100.0.0.0/23 и обе /24. Поэтому у R3 транзитного пути через R1 не будет, даже если R1 его отдаёт.</li></ul>
<pre class="cli">R1(config)#ip as-path access-list 1 permit ^$
R1(config)#router bgp 64500
R1(config-router)#neighbor 101.0.0.1 filter-list 1 out
R1(config-router)#neighbor 102.0.0.1 filter-list 1 out
R1#clear ip bgp * soft out
R1#show ip bgp neighbors 101.0.0.1 advertised-routes
     Network          Next Hop            Metric LocPrf Weight Path
 *>  100.0.0.0/23     0.0.0.0                  0         32768 i

Total number of prefixes [[1]]</pre>
<div class="callout pro"><b>У провайдера то же правило</b>Твоя сеть живёт по тому же правилу: маршруты от аплинков и пиров — только клиентам. Удобный приём — на входе вешать ярлык-community, откуда пришёл маршрут: «от клиента», «от пира», «от аплинка». Тогда на выходе фильтр простой: пиру и аплинку — только свои сети и сети с ярлыком «от клиента». Так будет делать R2 в задании 5.</div>
<div class="callout lab"><b>В лабе</b>Задание 4: в advertised-routes R1 к обоим провайдерам найдёшь чужие сети, у R2 — путь через 64500, и закроешь утечку фильтром ^$. Заодно объяснишь, почему у R3 такого пути нет. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему клиент без фильтров становится транзитом?</summary><p>BGP по умолчанию отдаёт свой лучший путь к каждой сети всем eBGP-соседям. Маршруты интернета от одного провайдера уходят другому с путём через клиента.</p></details>
<details class="chk"><summary>Проверь себя: чем утечка маршрутов отличается от угона?</summary><p>При утечке маршруты настоящие, но ушли туда, куда не положено по договорам. При угоне кто-то анонсирует чужую сеть как свою.</p></details>
<details class="chk"><summary>Проверь себя: почему защищаться должны обе стороны?</summary><p>Каждая может ошибиться. Если клиент забыл фильтр, его спасёт фильтр провайдера, и наоборот. Утечка случается, когда ошиблись обе стороны.</p></details>`},

{h:'Ты — провайдер: как принять BGP-клиента', html:`
<p>Меняем сторону стыка. Ты — инженер ISP1, это R2. Клиент «Лифт ми Ап» подключается по BGP. Что ты от него примешь, что ему отдашь и как защитишь себя и весь интернет от его ошибок?</p>
<h3>Принимать только то, что за клиентом записано</h3>
<p>Сети, которые клиенту можно анонсировать, записаны в базах маршрутов (IRR, internet routing registry). Главная для нас — база RIPE: в ней есть объект <b>route</b> «сеть 100.0.0.0/23, origin AS64500». Провайдеры строят по этим записям prefix-list автоматически (утилитой bgpq4) и обновляют его каждый день. В лабе запишем руками:</p>
<pre class="cli">ip prefix-list CUST-64500 seq 10 permit 100.0.0.0/23 le 24
ip as-path access-list 10 permit ^64500(_64500)*$
route-map FROM-CUST-64500 permit 10
 match ip address prefix-list CUST-64500
 match as-path 10
 set community 64501:100
router bgp 64501
 neighbor 101.0.0.2 route-map FROM-CUST-64500 in
 neighbor 101.0.0.2 maximum-prefix 10 80</pre>
<p>Разберём по строкам. Prefix-list пускает блок клиента и его половины — и больше ничего: ни серые адреса, ни чужие сети, ни default. AS-path пускает только пути из номера клиента, в том числе повторённого: клиент имеет право на prepend. Две строки match в одной секции работают через «и»: маршрут должен пройти обе. Ярлык 64501:100 значит «это маршрут клиента», он пригодится на выходе.</p>
<figure class="dg"><svg viewBox="0 0 320 222" role="img" aria-label="Фильтры провайдера на входе от клиента: своя сеть клиента проходит и получает ярлык, серая и чужая сети отбрасываются, лимит считает принятые сети">
<path class="ln" d="M48 104 L262 104"/>
<rect class="bx" x="4" y="92" width="44" height="24" rx="6"/><text class="tx" x="26" y="108" text-anchor="middle">R1</text><text class="sm" x="26" y="132" text-anchor="middle">клиент</text>
<rect class="bx" x="262" y="86" width="54" height="36" rx="6"/><text class="tx" x="289" y="101" text-anchor="middle">R2</text><text class="sm" x="289" y="115" text-anchor="middle">таблица</text>
<rect x="89" y="56" width="6" height="96" rx="2" class="gr"/><rect x="139" y="56" width="6" height="96" rx="2" class="gr"/><rect x="189" y="56" width="6" height="96" rx="2" class="gr"/><rect x="239" y="56" width="6" height="96" rx="2" class="gr"/>
<text class="sm" x="92" y="48" text-anchor="middle">сети</text><text class="sm" x="142" y="48" text-anchor="middle">AS-path</text><text class="sm" x="192" y="48" text-anchor="middle">RPKI</text><text class="sm" x="242" y="48" text-anchor="middle">лимит</text>
<g opacity="0"><rect x="-35" y="-7" width="70" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">100.0.0.0/23</text><animateMotion dur="16s" repeatCount="indefinite" path="M40 104 L284 104" keyPoints="0;0;1;1" keyTimes="0;0.03;0.24;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.24;0.25;1"/></g>
<g opacity="0"><rect x="261" y="127" width="56" height="14" rx="3" class="o"/><text class="wt2" x="289" y="137" text-anchor="middle">64501:100</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.24;0.245;0.32;0.33;1"/></g>
<g opacity="0"><rect x="-31" y="-7" width="62" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">10.0.0.0/8</text><animateMotion dur="16s" repeatCount="indefinite" path="M34 104 L55 104" keyPoints="0;0;1;1" keyTimes="0;0.35;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.34;0.35;0.52;0.53;1"/></g>
<g opacity="0"><path class="lr" d="M84 96 L100 112 M100 96 L84 112"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.42;0.43;0.52;0.53;1"/></g>
<g opacity="0"><rect x="-31" y="-7" width="62" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M34 104 L55 104" keyPoints="0;0;1;1" keyTimes="0;0.56;0.63;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.55;0.56;0.73;0.74;1"/></g>
<g opacity="0"><path class="lr" d="M84 96 L100 112 M100 96 L84 112"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.63;0.64;0.73;0.74;1"/></g>
<g opacity="0"><text class="sm gn" x="242" y="172" text-anchor="middle">принято: 1 из 10</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.76;0.77;1"/></g>
<g><text class="sm" x="160" y="196" text-anchor="middle">Своя сеть клиента проходит все проверки</text><text class="sm gn" x="160" y="212" text-anchor="middle">и получает ярлык 64501:100 «от клиента»</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.33;0.331;1"/></g>
<g opacity="0"><text class="sm" x="160" y="196" text-anchor="middle">10.0.0.0/8 — серые адреса, их в списке</text><text class="sm rd" x="160" y="212" text-anchor="middle">клиента нет: стоп на первом фильтре</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.331;0.54;0.541;1"/></g>
<g opacity="0"><text class="sm" x="160" y="196" text-anchor="middle">8.8.8.0/24 через клиента — утечка чужой</text><text class="sm rd" x="160" y="212" text-anchor="middle">сети: её тоже нет в списке клиента</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.541;0.75;0.751;1"/></g>
<g opacity="0"><text class="sm" x="160" y="196" text-anchor="middle">Лимит считает принятые сети: пришлёт клиент</text><text class="sm" x="160" y="212" text-anchor="middle">больше 10 — сессия разорвётся сама</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.75;0.751;1"/></g>
</svg><figcaption>Серые столбики — проверки на входе от клиента. Сеть клиента проходит все и получает ярлык. Серые адреса и чужая сеть останавливаются на первой же проверке.</figcaption></figure>
<h3>Лимит маршрутов</h3>
<p><code>maximum-prefix 10 80</code> — защита от худшего случая: клиент по ошибке отдаст тебе всю таблицу интернета. При 8 маршрутах (80%) в логе появится предупреждение, а когда их станет больше 10, сессия разорвётся и останется в состоянии <code>Idle (PfxCt)</code>. Поднимать её — руками, <code>clear ip bgp 101.0.0.2</code>, или автоматически через N минут: <code>maximum-prefix 10 80 restart 15</code>. Лимит ставят с запасом: клиент добавил сеть — сессия не должна падать.</p>
<pre class="cli">%BGP-4-MAXPFX: No. of prefix received from 101.0.0.2 (afi 0) reaches 8, max 10
%BGP-3-MAXPFXEXCEED: No. of prefix received from 101.0.0.2 (afi 0): 11 exceed limit 10
R2#show ip bgp summary | include 101.0.0.2
101.0.0.2       4 64500      40      45        0    0    0 00:00:12 [[Idle (PfxCt)]]</pre>
<h3>RPKI: подпись владельца адресов</h3>
<p>Запись в IRR может создать почти кто угодно с доступом к базе, и проверяют такие записи не всегда. Надёжнее <b>RPKI</b> (resource public key infrastructure): владелец адресов в личном кабинете RIPE подписывает <b>ROA</b> (route origin authorization) — «сеть 100.0.0.0/23, маска до /24, анонсирует только AS64500». Маршрутизаторы получают проверенный список от программы-валидатора (Routinator, rpki-client) и помечают каждый маршрут:</p>
<ul><li><b>Valid</b> — сеть и AS совпали с ROA: принять.</li>
<li><b>Invalid</b> — ROA есть, но AS другая или маска длиннее разрешённой: <b>отбросить</b>. Это и защищает от угона.</li>
<li><b>NotFound</b> — ROA нет: принять. Многие сети ещё не подписаны.</li></ul>
<h3>Что отдать клиенту</h3>
<table><tr><th>Клиент заказал</th><th>Что получает</th><th>Кому подходит</th></tr>
<tr><td>default</td><td>только 0.0.0.0/0</td><td>простой сети с одним провайдером или с основным и резервным</td></tr>
<tr><td>full view</td><td>вся таблица — около миллиона IPv4</td><td>клиенту с несколькими провайдерами: он сам выбирает лучший выход к каждой сети</td></tr>
<tr><td>partial view</td><td>сети провайдера и его клиентов плюс default</td><td>середина: к «близким» сетям напрямую, к остальным по default</td></tr></table>
<pre class="cli">! клиенту — только default
ip prefix-list DEFAULT-ONLY seq 10 permit 0.0.0.0/0
router bgp 64501
 neighbor 101.0.0.2 default-originate
 neighbor 101.0.0.2 prefix-list DEFAULT-ONLY out</pre>
<p><code>default-originate</code> создаёт default специально для этого соседа, даже если у тебя самого default в таблице нет. А prefix-list не пускает к клиенту всё остальное.</p>
<h3>Что отдать пирам и аплинкам</h3>
<p>По правилу экспорта — только свои сети и сети клиентов. Ярлык 64501:100 делает фильтр простым:</p>
<pre class="cli">ip community-list standard CUSTOMERS permit 64501:100
ip as-path access-list 20 permit ^$
route-map TO-PEER permit 10
 match community CUSTOMERS
route-map TO-PEER permit 20
 match as-path 20
router bgp 64501
 neighbor 10.23.0.2 route-map TO-PEER out</pre>
<p>Секция 10 выпускает сети клиентов, секция 20 — свои сети (пустой путь). Всё остальное — маршруты от R4 и от пира — съест невидимый deny. Здесь он работает на тебя.</p>
<div class="callout warn"><b>Ярлык в цифрах</b>Без команды <code>ip bgp-community new-format</code> IOS показывает community одним большим числом: 64501:100 превращается в 4227137636. Работает так же, но читать неудобно. Включи new-format на всех своих маршрутизаторах.</div>
<div class="callout pro"><b>Чек-лист стыка с клиентом</b>Prefix-list из IRR · AS-path · RPKI: invalid отбрасывать · maximum-prefix с запасом · не принимать серые адреса, default и сети длиннее /24 · ярлык «маршрут клиента» · пароль на сессию и защита TTL (GTSM: <code>neighbor X ttl-security hops 1</code> — принимать пакеты сессии только от соседа на линке) · приём blackhole для его /32 (раздел 11). Это минимум из RFC 7454 и MANRS — договорённости операторов о безопасной маршрутизации.</div>
<div class="callout lab"><b>В лабе</b>Задание 5: настроишь всё это на R2 для клиента — prefix-list, AS-path, ярлык, лимит, только default клиенту и только клиентские сети пиру R3. Поломка 3: сработал лимит, сессия в Idle (PfxCt). <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: зачем провайдеру maximum-prefix на сессии с клиентом?</summary><p>Если клиент по ошибке отдаст всю таблицу интернета, сессия разорвётся, а не зальёт сеть провайдера миллионом маршрутов.</p></details>
<details class="chk"><summary>Проверь себя: ROA — 100.0.0.0/23, маска до /24, AS64500. Кто-то из AS64666 анонсирует 100.0.0.0/24. Какой статус?</summary><p>Invalid: ROA для этой сети есть, а AS другая. Такой маршрут отбрасывают — это и есть защита от угона.</p></details>
<details class="chk"><summary>Проверь себя: зачем помечать маршруты клиентов ярлыком на входе?</summary><p>Чтобы на выходе к пирам и аплинкам было просто выпустить только сети клиентов (и свои), а маршруты от других пиров и аплинков — не выпускать.</p></details>`},

{h:'Управляем трафиком: куда уходим и как к нам приходят', html:`
<p>Клиент с двумя провайдерами почти всегда хочет управлять трафиком: основной канал толстый, резервный тонкий, или один провайдер дешевле. Трафик идёт в две стороны, и управлять ими приходится по-разному.</p>
<div class="vs"><div><b>Исходящий</b> — куда шлём мы. Решаем сами: выбор делают наши маршрутизаторы, и атрибуты мы меняем у себя.</div><div><b>Входящий</b> — как к нам приходят. Решают <b>чужие</b> маршрутизаторы по всему интернету. Мы можем только повлиять на их выбор тем, что им сообщаем.</div></div>
<h3>Исходящий: LOCAL_PREF</h3>
<pre class="cli">route-map FROM-ISP1 permit 10
 set local-preference 200
router bgp 64500
 neighbor 101.0.0.1 route-map FROM-ISP1 in
R1#clear ip bgp 101.0.0.1 soft in</pre>
<p>Route-map без match меняет все маршруты от ISP1. Теперь на шаге 2 лестницы любой путь через ISP1 побеждает путь через ISP2. Если у клиента несколько маршрутизаторов, local-pref по iBGP узнают все, и выход у всей AS один. ISP2 остаётся резервом: пропадут маршруты от ISP1 — сработают его.</p>
<div class="callout warn"><b>Ловушка: default против полной таблицы</b>Local-pref сравнивает только пути к одной сети. Если ISP1 отдаёт тебе только default, а ISP2 — полную таблицу, трафик к каждой сети пойдёт через ISP2 по более точному маршруту, и local-pref 200 на default ничего не изменит. Чтобы выбирать провайдера атрибутами, получать от обоих нужно одинаковое: либо полную таблицу, либо только default.</div>
<h3>Входящий: четыре способа уговорить мир</h3>
<p><b>1. AS_PATH prepend.</b> Дописываешь свой номер в анонс одному провайдеру несколько раз:</p>
<pre class="cli">route-map TO-ISP2 permit 10
 set as-path prepend 64500 64500 64500
router bgp 64500
 neighbor 102.0.0.1 route-map TO-ISP2 out</pre>
<p>Теперь R4 видит через ISP2 путь «64502 64500 64500 64500 64500» — пять номеров против двух через ISP1 — и выбирает ISP1. Слабое место: prepend работает только там, где решает длина пути. Если у кого-то на пути есть свои правила local-pref, длину пути он даже не сравнит.</p>
<p><b>2. Ярлыки-команды провайдера.</b> Многие провайдеры публикуют community, которыми клиент управляет их сетью. В лабе ISP2 поддерживает <code>64502:80</code>: «поставь моему маршруту local-pref 80». Вешаешь ярлык на анонс к ISP2, включаешь send-community — и ISP2 внутри своей сети начинает предпочитать путь к тебе через пиринг с ISP1 (local-pref 100 больше 80). Это сильнее prepend: работает на шаге 2, а не на шаге 4.</p>
<pre class="cli">route-map TO-ISP2 permit 10
 set community 64502:80
router bgp 64500
 neighbor 102.0.0.1 send-community</pre>
<p><b>3. Более точные сети.</b> В ISP1 анонсируешь обе половины, 100.0.0.0/24 и 100.0.1.0/24, плюс /23, а в ISP2 — только /23. Весь мир получит /24 только через ISP1, а по longest match точная сеть побеждает любые атрибуты. Это самый сильный способ. Цена — два лишних маршрута в таблице у всего интернета, и мельче /24 делить нельзя (раздел 3).</p>
<p><b>4. MED.</b> Работает, только когда у тебя несколько стыков с <b>одним</b> провайдером: подсказываешь, через какой из них входить.</p>
<figure class="dg"><svg viewBox="0 0 320 228" role="img" aria-label="Как R4 выбирает путь к сети клиента: при равных путях — старейший, после prepend — через ISP1, при более точных сетях — через ISP1">
<path class="ln" d="M54 94 L136 48 M54 106 L136 152 M184 48 L266 94 M184 152 L266 106"/>
<path class="ln" d="M160 54 L160 146" style="stroke-dasharray:4 4"/>
<rect class="bx" x="6" y="88" width="48" height="24" rx="6"/><text class="tx" x="30" y="104" text-anchor="middle">R1</text>
<rect class="bx" x="136" y="30" width="48" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R2</text>
<rect class="bx" x="136" y="146" width="48" height="24" rx="6"/><text class="tx" x="160" y="162" text-anchor="middle">R3</text>
<rect class="bx" x="266" y="88" width="48" height="24" rx="6"/><text class="tx" x="290" y="104" text-anchor="middle">R4</text>
<text class="sm" x="30" y="128" text-anchor="middle">AS64500</text>
<text class="sm" x="160" y="22" text-anchor="middle">ISP1 · AS64501</text>
<text class="sm" x="160" y="186" text-anchor="middle">ISP2 · AS64502</text>
<text class="sm" x="290" y="128" text-anchor="middle">AS64510</text>
<g><rect x="194" y="64" width="62" height="14" rx="3" class="b"/><text class="wt2" x="225" y="74" text-anchor="middle">путь: 2 AS</text><rect x="194" y="122" width="62" height="14" rx="3" class="b"/><text class="wt2" x="225" y="132" text-anchor="middle">путь: 2 AS</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.33;0.331;1"/></g>
<g opacity="0"><rect x="194" y="64" width="62" height="14" rx="3" class="b"/><text class="wt2" x="225" y="74" text-anchor="middle">путь: 2 AS</text><rect x="194" y="122" width="62" height="14" rx="3" class="rr"/><text class="wt2" x="225" y="132" text-anchor="middle">путь: 5 AS</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.331;0.66;0.661;1"/></g>
<g opacity="0"><rect x="187" y="64" width="76" height="14" rx="3" class="g"/><text class="wt2" x="225" y="74" text-anchor="middle">/23 и две /24</text><rect x="194" y="122" width="62" height="14" rx="3" class="gr"/><text class="wt2" x="225" y="132" text-anchor="middle">только /23</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.661;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="18s" repeatCount="indefinite" path="M282 116 L160 168 L36 114" keyPoints="0;0;1;1" keyTimes="0;0.05;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.2;0.21;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="18s" repeatCount="indefinite" path="M282 116 L160 168 L36 114" keyPoints="0;0;1;1" keyTimes="0;0.15;0.3;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.14;0.15;0.3;0.31;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="18s" repeatCount="indefinite" path="M282 84 L160 28 L36 86" keyPoints="0;0;1;1" keyTimes="0;0.38;0.53;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.37;0.38;0.53;0.54;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="18s" repeatCount="indefinite" path="M282 84 L160 28 L36 86" keyPoints="0;0;1;1" keyTimes="0;0.48;0.63;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.47;0.48;0.63;0.64;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="18s" repeatCount="indefinite" path="M282 84 L160 28 L36 86" keyPoints="0;0;1;1" keyTimes="0;0.71;0.86;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.7;0.71;0.86;0.87;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="18s" repeatCount="indefinite" path="M282 84 L160 28 L36 86" keyPoints="0;0;1;1" keyTimes="0;0.81;0.96;1" calcMode="linear"/><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.8;0.81;0.96;0.97;1"/></g>
<g><text class="sm" x="160" y="206" text-anchor="middle">Пути равны — R4 берёт старейший:</text><text class="sm" x="160" y="220" text-anchor="middle">вход может оказаться и через ISP2</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.33;0.331;1"/></g>
<g opacity="0"><text class="sm" x="160" y="206" text-anchor="middle">Prepend ×3 к ISP2: путь через него 5 AS —</text><text class="sm gn" x="160" y="220" text-anchor="middle">R4 выбирает ISP1</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.331;0.66;0.661;1"/></g>
<g opacity="0"><text class="sm" x="160" y="206" text-anchor="middle">Две /24 только через ISP1: точная сеть</text><text class="sm gn" x="160" y="220" text-anchor="middle">сильнее любых атрибутов BGP</text><animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.66;0.661;1"/></g>
</svg><figcaption>Конверты — трафик из интернета к сети клиента. Сначала пути через провайдеров равны, и R4 выбирает старейший — это может оказаться ISP2. После prepend путь через ISP2 длиннее. В конце через ISP1 приходят ещё и точные /24, и вопрос решает уже longest match.</figcaption></figure>
<table><tr><th>Способ</th><th>Где действует</th><th>Сила</th><th>Минус</th></tr>
<tr><td>prepend</td><td>у всех, кто сравнивает длину пути</td><td>средняя</td><td>проигрывает любому local-pref</td></tr>
<tr><td>ярлык провайдера</td><td>внутри сети провайдера</td><td>сильная</td><td>только если провайдер его поддерживает</td></tr>
<tr><td>более точные сети</td><td>везде</td><td>сильнее всех</td><td>лишние маршруты у всего мира, мельче /24 нельзя</td></tr>
<tr><td>MED</td><td>у одного соседа</td><td>слабая</td><td>только для нескольких стыков с одним провайдером</td></tr></table>
<div class="callout pro"><b>Как это выглядит на работе</b>Клиент пишет: «сделайте канал через вас резервным». Ты отвечаешь: «повесьте на анонс нам community AS:80» — и дальше он управляет сам, не звоня тебе. Поэтому крупные операторы публикуют свои ярлыки в базе RIPE (в объекте aut-num) или на сайте. Посмотри, есть ли такой список у твоей сети и у ваших аплинков.</div>
<div class="callout lab"><b>В лабе</b>Задание 6: local-pref 200 на всё от ISP1 — и сначала разберёшься, почему трафик к 203.0.113.1 его не послушается. Задание 7: три способа для входящего по очереди, каждый раз смотришь выбор R4. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему local-pref не управляет входящим трафиком?</summary><p>Local-pref действует только внутри своей AS и не передаётся соседям. Как к тебе приходить, решают чужие маршрутизаторы по тому, что ты им анонсируешь.</p></details>
<details class="chk"><summary>Проверь себя: ты сделал prepend ×3 к ISP2, а ISP2 всё равно шлёт трафик к тебе напрямую. Почему так может быть?</summary><p>ISP2 ставит маршрутам клиентов повышенный local-pref, а он решает на шаге 2, раньше длины пути. Здесь поможет ярлык-команда ISP2 «понизить local-pref» или более точные сети через ISP1.</p></details>
<details class="chk"><summary>Проверь себя: какой способ управления входящим трафиком сильнее всех и почему?</summary><p>Более точные сети: longest match срабатывает раньше всех атрибутов BGP, на любом маршрутизаторе в мире.</p></details>`},

{h:'Blackhole: как спасти узел от DDoS', html:`
<h3>Ситуация, знакомая каждому дежурному</h3>
<p>На адрес клиента 100.0.0.66 летит DDoS — 50 Гбит/с мусора. Канал клиента — 1 Гбит/с, а на том же узле ещё десятки клиентов и общий аплинк. Забит аплинк — страдают все. Фильтровать на интерфейсе клиента бесполезно: к этому месту мусор уже прошёл через весь узел.</p>
<h3>Blackhole по сигналу (RTBH)</h3>
<p>Решение — выбрасывать трафик к жертве <b>на входе в сеть</b>, ещё до узкого места. Это называется remote triggered blackhole, и делается через BGP:</p>
<ol class="steps"><li>Клиент (или дежурный провайдера) анонсирует атакуемый адрес отдельным маршрутом /32 с ярлыком <b>BLACKHOLE</b> — community <code>65535:666</code> (RFC 7999) или ярлыком провайдера вида <code>AS:666</code>.</li>
<li>Провайдер на входе видит ярлык и меняет next-hop этого /32 на служебный адрес, например 192.0.2.1. На всех граничных маршрутизаторах маршрут к 192.0.2.1 смотрит в Null0.</li>
<li>Трафик к 100.0.0.66 на любой границе уходит в Null0. Если аплинк провайдера тоже поддерживает blackhole, провайдер передаёт сигнал ему, и мусор выбрасывается ещё раньше, у аплинка.</li></ol>
<figure class="dg"><svg viewBox="0 0 320 200" role="img" aria-label="DDoS забивает канал клиента и аплинк; после анонса /32 с ярлыком blackhole провайдер выбрасывает атаку на входе">
<path class="ln" d="M58 70 L78 70 M122 70 L146 70 M194 70 L246 70 M170 82 L170 128"/>
<g opacity="0"><path class="lr" d="M122 70 L146 70 M194 70 L246 70" style="stroke-width:5"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.12;0.13;0.48;0.49;1"/></g>
<rect class="bxd" x="4" y="58" width="54" height="24" rx="6"/><text class="sm" x="31" y="74" text-anchor="middle">ботнет</text>
<rect class="bx" x="78" y="58" width="44" height="24" rx="6"/><text class="tx" x="100" y="74" text-anchor="middle">R4</text>
<rect class="bx" x="146" y="58" width="48" height="24" rx="6"/><text class="tx" x="170" y="74" text-anchor="middle">R2</text>
<rect class="bx" x="246" y="58" width="48" height="24" rx="6"/><text class="tx" x="270" y="74" text-anchor="middle">R1</text>
<rect class="bx" x="146" y="128" width="48" height="24" rx="6"/><text class="sm" x="170" y="144" text-anchor="middle">сосед</text>
<text class="sm" x="100" y="50" text-anchor="middle">интернет</text><text class="sm" x="170" y="50" text-anchor="middle">ISP1</text><text class="sm" x="270" y="50" text-anchor="middle">клиент</text>
<text class="sm" x="270" y="98" text-anchor="middle">100.0.0.66</text>
<text class="sm" x="220" y="62" text-anchor="middle">1 Гбит/с</text>
<g opacity="0"><text class="sm rd" x="220" y="90" text-anchor="middle">забит</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.13;0.14;0.48;0.49;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L270 70" keyPoints="0;0;1;1" keyTimes="0;0.02;0.16;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.01;0.02;0.16;0.17;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L270 70" keyPoints="0;0;1;1" keyTimes="0;0.1;0.24;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.09;0.1;0.24;0.25;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L270 70" keyPoints="0;0;1;1" keyTimes="0;0.18;0.32;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.17;0.18;0.32;0.33;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L270 70" keyPoints="0;0;1;1" keyTimes="0;0.26;0.4;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.25;0.26;0.4;0.41;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L270 70" keyPoints="0;0;1;1" keyTimes="0;0.34;0.48;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.33;0.34;0.48;0.49;1"/></g>
<g opacity="0"><rect x="-44" y="-7" width="88" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">/32 + 65535:666</text><animateMotion dur="14s" repeatCount="indefinite" path="M270 30 L170 30" keyPoints="0;0;1;1" keyTimes="0;0.51;0.6;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.5;0.51;0.62;0.63;1"/></g>
<g opacity="0"><path class="lr" d="M128 63 L142 77 M142 63 L128 77"/><text class="sm rd" x="118" y="100">Null0</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.62;0.63;0.97;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L134 70" keyPoints="0;0;1;1" keyTimes="0;0.63;0.71;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.62;0.63;0.71;0.72;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L134 70" keyPoints="0;0;1;1" keyTimes="0;0.72;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.71;0.72;0.8;0.81;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="rr"/><animateMotion dur="14s" repeatCount="indefinite" path="M31 70 L134 70" keyPoints="0;0;1;1" keyTimes="0;0.81;0.89;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.8;0.81;0.89;0.9;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="g"/><animateMotion dur="14s" repeatCount="indefinite" path="M100 76 L270 76" keyPoints="0;0;1;1" keyTimes="0;0.66;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.65;0.66;0.8;0.81;1"/></g>
<g opacity="0"><rect x="-5" y="-4" width="10" height="7" rx="1" class="g"/><animateMotion dur="14s" repeatCount="indefinite" path="M100 76 L270 76" keyPoints="0;0;1;1" keyTimes="0;0.82;0.96;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.81;0.82;0.96;0.97;1"/></g>
<g><text class="sm" x="160" y="176" text-anchor="middle">50 Гбит/с атаки на 100.0.0.66: забит канал</text><text class="sm rd" x="160" y="190" text-anchor="middle">клиента и общий аплинк — страдают все</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.49;0.5;1"/></g>
<g opacity="0"><text class="sm" x="160" y="176" text-anchor="middle">/32 с ярлыком blackhole: ISP1 выбрасывает</text><text class="sm gn" x="160" y="190" text-anchor="middle">атаку на входе, остальное работает</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Красные пакеты — атака. Сначала она проходит через весь узел и забивает и аплинк, и канал клиента. Оранжевая наклейка — анонс /32 с ярлыком blackhole. После него R2 отправляет атаку в Null0 прямо на входе, а зелёные пакеты к другим адресам клиента идут как обычно.</figcaption></figure>
<p>Как это настраивает провайдер (R2):</p>
<pre class="cli">ip route 192.0.2.1 255.255.255.255 Null0
ip prefix-list CUST-64500-32 seq 10 permit 100.0.0.0/23 ge 32
ip community-list standard BLACKHOLE permit 65535:666
route-map FROM-CUST-64500 permit 5
 match community BLACKHOLE
 match ip address prefix-list CUST-64500-32
 set ip next-hop 192.0.2.1
 set community no-export additive</pre>
<p>Секция 5 стоит раньше обычной секции 10: обычный фильтр /32 не пропустил бы. Условий два — адрес из блока клиента <b>и</b> ярлык. Так чужой /32 «зачернить» не получится. <code>no-export</code> не даёт выпустить этот /32 к соседям: он нужен только внутри сети. А клиент со своей стороны анонсирует 100.0.0.66/32 (через статику в Null0 и network, как в разделе 3) с ярлыком 65535:666 и не забывает send-community.</p>
<h3>Почему это и спасение, и победа атакующего</h3>
<p>Атакуемый адрес становится недоступен полностью — и для мусора, и для настоящих пользователей. Цель атаки достигнута. Зато все остальные работают: сам клиент на других адресах, соседи по узлу, аплинк. Поэтому blackhole — крайняя мера на время атаки. Тоньше работают <b>FlowSpec</b> — BGP раздаёт правила вида «выбрасывать UDP на порт 123 к этому адресу», а остальное пропускать, — и центры очистки трафика (scrubbing), которые принимают весь поток, отсеивают мусор и возвращают чистый трафик.</p>
<div class="callout pro"><b>Узнай у себя</b>Есть ли у вашей сети blackhole-ярлык для клиентов и опубликован ли он? Как дежурный включает blackhole при атаке на клиента — руками на маршрутизаторе или через систему защиты от DDoS? Поддерживают ли blackhole ваши аплинки? На дежурстве эти ответы нужны за минуту, а не за час.</div>
<div class="callout lab"><b>В лабе</b>Задание 8: на R2 настроишь приём blackhole от клиента, на R1 анонсируешь 100.0.0.66/32 с ярлыком и с R4 проверишь: 100.0.0.66 не отвечает, а 100.0.0.1 работает. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему фильтровать DDoS на интерфейсе клиента уже поздно?</summary><p>К этому месту мусор прошёл через аплинк и весь узел провайдера и забил их. Выбрасывать нужно на входе в сеть, до узкого места.</p></details>
<details class="chk"><summary>Проверь себя: зачем в route-map провайдера два условия — блок клиента и community?</summary><p>Чтобы клиент мог «зачернить» только свои адреса. Без проверки блока он мог бы по ошибке или со зла отправить в Null0 чужой /32.</p></details>
<details class="chk"><summary>Проверь себя: почему blackhole называют победой атакующего?</summary><p>Атакуемый адрес становится недоступен целиком, в том числе для настоящих пользователей, — этого атакующий и добивался. Зато остальные сети и клиенты продолжают работать.</p></details>`},

{h:'IP SLA, track и BFD: путь умер, а маршрут остался', html:`
<h3>Линк жив, а интернета нет</h3>
<p>Не у каждого клиента есть BGP. Часто это два статических default: основной через ISP1 и резервный через ISP2 с AD 250 — плавающий статический маршрут из главы 3. Резерв включается, когда основной маршрут пропадает, а он пропадает, только если упал сам интерфейс. Но бывает иначе: линк до ISP1 жив, а у ISP1 упал аплинк. Статика на месте, трафик уходит в пустоту.</p>
<h3>IP SLA: маршрутизатор сам проверяет путь</h3>
<p><b>IP SLA</b> — встроенный в IOS тестер: раз в несколько секунд он пингует выбранную цель. <b>Track</b> превращает результат в состояние Up или Down, а статический маршрут привязывается к track: стал Down — маршрут убирается, включается резерв.</p>
<pre class="cli">ip sla 1
 icmp-echo 10.24.0.1 source-interface GigabitEthernet0/0
 frequency 5
ip sla schedule 1 life forever start-time now
track 1 ip sla 1 reachability
 delay down 10 up 20
ip route 10.24.0.1 255.255.255.255 101.0.0.1
ip route 0.0.0.0 0.0.0.0 101.0.0.1 track 1
ip route 0.0.0.0 0.0.0.0 102.0.0.1 250</pre>
<p>Разберём по строкам. Тест пингует 10.24.0.1 — адрес ISP1 в сторону его аплинка, а не адрес стыка с тобой: тот отвечал бы и при мёртвом аплинке. <code>delay down 10 up 20</code> — защита от «моргания»: track меняет состояние, только если новый результат держится 10 или 20 секунд, а не на каждой потере пакета. Маршрут /32 к цели теста отправляет тест только через ISP1 — зачем, ниже. Последние две строки — основной default с проверкой и резервный.</p>
<figure class="dg"><svg viewBox="0 0 320 228" role="img" aria-label="IP SLA: тест к адресу за ISP1 проходит, затем аплинк ISP1 падает, track уходит в Down, default переключается на ISP2, а тест продолжает идти через ISP1">
<path class="ln" d="M54 94 L136 48 M54 106 L136 152 M184 48 L266 94 M184 152 L266 106"/>
<g><path class="lg" d="M54 94 L136 48" style="stroke-width:4"/><text class="sm gn" x="100" y="58" text-anchor="end">default</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.65;0.651;1"/></g>
<g opacity="0"><path class="lg" d="M54 106 L136 152" style="stroke-width:4"/><text class="sm gn" x="112" y="128">default</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.65;0.651;1"/></g>
<rect class="bx" x="6" y="88" width="48" height="24" rx="6"/><text class="tx" x="30" y="104" text-anchor="middle">R1</text>
<rect class="bx" x="136" y="30" width="48" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R2</text>
<rect class="bx" x="136" y="146" width="48" height="24" rx="6"/><text class="tx" x="160" y="162" text-anchor="middle">R3</text>
<rect class="bx" x="266" y="88" width="48" height="24" rx="6"/><text class="tx" x="290" y="104" text-anchor="middle">R4</text>
<text class="sm" x="30" y="128" text-anchor="middle">AS64500</text>
<text class="sm" x="160" y="22" text-anchor="middle">ISP1 · AS64501</text>
<text class="sm" x="160" y="186" text-anchor="middle">ISP2 · AS64502</text>
<circle cx="196" cy="55" r="4" class="o"/><text class="sm og" x="206" y="48">10.24.0.1</text>
<g opacity="0"><path class="lr" d="M218 64 L232 78 M232 64 L218 78"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.35;0.351;1"/></g>
<g opacity="0"><circle r="4" class="g"/><animateMotion dur="16s" repeatCount="indefinite" path="M54 94 L136 48 L196 55" keyPoints="0;0;1;1" keyTimes="0;0.04;0.14;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.14;0.15;1"/></g>
<g opacity="0"><circle r="4" class="g"/><animateMotion dur="16s" repeatCount="indefinite" path="M54 94 L136 48 L196 55" keyPoints="0;0;1;1" keyTimes="0;0.18;0.28;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.17;0.18;0.28;0.29;1"/></g>
<g opacity="0"><circle r="4" class="rr"/><animateMotion dur="16s" repeatCount="indefinite" path="M54 94 L136 48 L196 55" keyPoints="0;0;1;1" keyTimes="0;0.4;0.5;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.39;0.4;0.5;0.51;1"/></g>
<g opacity="0"><circle r="4" class="rr"/><animateMotion dur="16s" repeatCount="indefinite" path="M54 94 L136 48 L196 55" keyPoints="0;0;1;1" keyTimes="0;0.54;0.64;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.53;0.54;0.64;0.65;1"/></g>
<g opacity="0"><circle r="4" class="rr"/><animateMotion dur="16s" repeatCount="indefinite" path="M54 94 L136 48 L196 55" keyPoints="0;0;1;1" keyTimes="0;0.74;0.84;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.73;0.74;0.84;0.85;1"/></g>
<g opacity="0"><path class="lr" d="M190 61 L202 73 M202 61 L190 73"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0;1;1;0;0;1;1;0;0" keyTimes="0;0.5;0.501;0.56;0.561;0.64;0.641;0.7;0.701;0.84;0.841;0.9;0.901;1"/></g>
<g><text class="sm gn" x="4" y="152">track: Up</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.6;0.601;1"/></g>
<g opacity="0"><text class="sm rd" x="4" y="152">track: Down</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.601;1"/></g>
<g><text class="sm" x="160" y="206" text-anchor="middle">Тест раз в 5 с пингует 10.24.0.1 за ISP1:</text><text class="sm gn" x="160" y="220" text-anchor="middle">ответ есть — track Up, default через ISP1</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.35;0.351;1"/></g>
<g opacity="0"><text class="sm" x="160" y="206" text-anchor="middle">Аплинк ISP1 упал: стык жив, но тест</text><text class="sm rd" x="160" y="220" text-anchor="middle">не проходит — через 10 с track Down</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.35;0.351;0.65;0.651;1"/></g>
<g opacity="0"><text class="sm" x="160" y="206" text-anchor="middle">Default переключился на ISP2, а тест</text><text class="sm" x="160" y="220" text-anchor="middle">по-прежнему идёт через ISP1 — по /32</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.65;0.651;1"/></g>
</svg><figcaption>Оранжевая точка — цель теста, адрес ISP1 в сторону его аплинка. Пока аплинк жив, тесты проходят и default идёт через ISP1. Аплинк упал — тесты пропадают, track уходит в Down, default переключается на ISP2. Тест продолжает ходить через ISP1, поэтому сам вернёт default, когда ISP1 оживёт.</figcaption></figure>
<div class="callout warn"><b>Главная ловушка: тест пошёл в обход</b>Без строки <code>ip route 10.24.0.1 … 101.0.0.1</code> после переключения тест пойдёт к цели по новому default — через ISP2. Оттуда цель доступна, тест проходит, track Up, основной default возвращается на мёртвый канал, тест снова падает — и так по кругу. Цель теста всегда привязывают к своему каналу: маршрутом /32 через основной next-hop и source-interface.</div>
<h3>BFD: быстро заметить смерть соседа в BGP</h3>
<p>У BGP своя проверка соседа: keepalive раз в 60 секунд и hold time 180. Значит, если провайдер «завис», а линк горит, BGP ждёт до трёх минут, прежде чем убрать его маршруты. Ускоряет это <b>BFD</b> (bidirectional forwarding detection) — ты знаешь его по главе 6. Короткие проверки каждые 300 мс, три потери подряд — сосед мёртв, BGP сразу рвёт сессию и убирает её маршруты. Трафик уходит через второго провайдера за секунду.</p>
<pre class="cli">interface GigabitEthernet0/0
 bfd interval 300 min_rx 300 multiplier 3
router bgp 64500
 neighbor 101.0.0.1 fall-over bfd</pre>
<div class="callout pro"><b>BFD нужен с обеих сторон</b>BFD-сессия поднимается, только если её включили оба соседа. Подключая клиента с BGP, договорись с ним заранее: нужен ли BFD и с какими таймерами. И помни: слишком короткие таймеры на нагруженном маршрутизаторе дают ложные срабатывания.</div>
<div class="callout lab"><b>В лабе</b>Задание 9: соберёшь на R1 статику с IP SLA, выключишь аплинк ISP1 (Gi0/1 на R2) и увидишь, как track уходит в Down и default переключается на ISP2, а после включения возвращается. <a href="#/c/ch08/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему целью теста берут адрес за провайдером, а не адрес стыка с ним?</summary><p>Адрес стыка отвечает, даже когда у провайдера умер аплинк. Тест должен проверять путь дальше — в интернет.</p></details>
<details class="chk"><summary>Проверь себя: зачем маршрут /32 к цели теста через ISP1?</summary><p>Чтобы после переключения тест не пошёл через ISP2. Иначе он пройдёт, track станет Up и вернёт default на мёртвый канал — получится карусель.</p></details>
<details class="chk"><summary>Проверь себя: чем BFD помогает BGP?</summary><p>BGP сам замечает смерть соседа только по hold time — до 180 секунд. BFD замечает за доли секунды и сразу рвёт сессию, маршруты уходят, трафик переключается.</p></details>`}
],
end: `<h3>Что ты теперь знаешь</h3>
<p>Интернет — это автономные системы, связанные договорами: клиенты платят провайдерам за транзит, пиры бесплатно обмениваются трафиком своих клиентов. Из денег вытекает правило экспорта: маршруты клиентов — всем, маршруты пиров и аплинков — только клиентам. С соседней AS BGP строит сессию по адресу стыка и проходит состояния до Established; по состоянию и логу видно, где сломалось. Свою сеть вводят командой network, а для неё нужна точная сеть в таблице маршрутов — отсюда статика в Null0. Из нескольких путей BGP выбирает лучший по лестнице: сначала решения людей (weight, local-pref), потом сам путь (AS_PATH, origin, MED), потом устройство своей сети. Но над всей лестницей стоит longest match. Исходящим трафиком управляют local-pref, входящим — prepend, ярлыки провайдера и более точные сети. Провайдер принимает от клиента только записанное за ним, ставит лимит, проверяет RPKI и помечает маршруты ярлыками. При DDoS спасает blackhole, а без BGP путь проверяют IP SLA и track.</p>
<div class="callout ok"><b>Посмотри у себя на работе</b><ol><li>На граничном маршрутизаторе — <code>show ip bgp summary</code>: сколько соседей, какие у них AS, сколько маршрутов от аплинков. Около миллиона — значит, full view.</li><li>Найди номер AS своей компании на bgp.he.net: аплинки, пиры, анонсируемые сети.</li><li>Посмотри все пути к 8.8.8.0/24 (<code>show ip bgp 8.8.8.0</code> или аналог на вашем оборудовании): сколько их, какой выбран и на каком шаге лестницы.</li><li>Узнай, как у вас фильтруют BGP-клиентов: prefix-list пишут руками или строят автоматически, есть ли RPKI и blackhole-ярлык.</li></ol></div>
<p>Следующая глава, 8.1, — BGP внутри сети провайдера: iBGP между многими маршрутизаторами, next-hop-self, route reflector. Многое из неё ты уже видел в главе 11. Дальше по этой главе: карточки, тест (кнопка «🤷 Не знаю» на месте), «Объясни своими словами» и лаба — девять заданий и пять поломок.</p>`
};
