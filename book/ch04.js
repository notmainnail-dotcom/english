// Книжный текст главы 4 СДСМ (компьютер). Формат совместим с телефонным (../английский/app/book/), кроме блоков .callout.lab.
// Стиль: от работы; одно понятие за раз; термин объясняется при первом появлении; аналогии .an; .callout.pro; «Проверь себя».
// Факты: IEEE 802.1D/802.1Q (STP, RSTP, MSTP), IEEE 802.1AX (LACP), ITU-T G.8032 (ERPS), RFC 7513 / Cisco DHCP snooping, DAI.
window.BOOK = window.BOOK || {};
BOOK.ch04 = {
title: 'L2, STP и агрегация',
lead: `<p>В главе 2 ты видел, как одна петля у абонента может положить целый VLAN. А теперь вопрос посложнее: сеть провайдера специально строят с запасными кабелями — кольцами и двойными аплинками, чтобы обрыв одного кабеля не оставил без связи дом или район. Но запасной кабель — это и есть петля. Как сеть живёт с запасными путями и не устраивает шторм? Этому и посвящена глава: протокол <b>STP</b>, его быстрый вариант <b>RSTP</b>, защита от абонентских «сюрпризов», объединение кабелей <b>LACP</b> и охрана абонентской сети — DHCP snooping.</p>
<p>Темп прежний: раздел в день, «Проверь себя» в конце, анимации ставь на паузу и рассматривай. Лаба этой главы одна из самых интересных: ты своими руками поменяешь главный коммутатор, засечёшь секундомером переключение и поймаешь «чужой» коммутатор абонента.</p>`,
parts: [

{h:'Резерв и петля: почему нельзя просто протянуть второй кабель', html:`
<h3>Зачем провайдеру запасные кабели</h3>
<p>Представь домовой коммутатор, подключённый к агрегации одним кабелем. Экскаватор задел кабель — весь дом без интернета, пока не приедет бригада. Поэтому важные участки сети строят с запасом: дом подключают двумя кабелями к разным коммутаторам, коммутаторы района соединяют <b>в кольцо</b>, ядро — по нескольким путям сразу. Тогда при обрыве одного кабеля трафик пойдёт по другому.</p>
<h3>Но запасной кабель — это петля</h3>
<p>Вспомни главу 2. Broadcast-кадр коммутатор рассылает во все порты VLAN. Если коммутаторы соединены по кругу, broadcast уходит в обе стороны кольца, проходит его и возвращается. Каждый коммутатор снова рассылает его во все порты — и копии размножаются. У кадра нет счётчика жизни (TTL), как у IP-пакета, поэтому сам он никогда не умрёт. Через секунды кольцо забито копиями: это <b>broadcast storm</b>, широковещательный шторм.</p>
<figure class="dg"><svg viewBox="0 0 320 200" role="img" aria-label="Кольцо из трёх коммутаторов: broadcast крутится в обе стороны и размножается">
<path class="ln" d="M160 52 L68 140 L252 140 Z"/>
<rect class="bx" x="128" y="22" width="64" height="30" rx="8"/><text class="tx" x="160" y="42" text-anchor="middle">SW1</text>
<rect class="bx" x="36" y="138" width="64" height="30" rx="8"/><text class="tx" x="68" y="158" text-anchor="middle">SW2</text>
<rect class="bx" x="220" y="138" width="64" height="30" rx="8"/><text class="tx" x="252" y="158" text-anchor="middle">SW3</text>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="3s" repeatCount="indefinite" path="M160 58 L246 140 L74 140 Z" rotate="0"/></g>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="3s" repeatCount="indefinite" path="M160 58 L74 140 L246 140 Z"/></g>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="2.3s" repeatCount="indefinite" path="M246 140 L74 140 L160 58 Z"/><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.3;0.31;1"/></g>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="2.6s" repeatCount="indefinite" path="M74 140 L160 58 L246 140 Z"/><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.55;0.56;1"/></g>
<g><text class="sm og" x="160" y="104" text-anchor="middle">копий: 2</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.3;0.31;1"/></g>
<g opacity="0"><text class="sm og" x="160" y="104" text-anchor="middle">копий: 6</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.3;0.31;0.55;0.56;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="104" text-anchor="middle">копий: тысячи</text><text class="sm rd" x="160" y="118" text-anchor="middle">канал забит</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.55;0.56;1"/></g>
<text class="sm" x="160" y="192" text-anchor="middle">ни один кадр в кольце сам не умирает</text>
</svg><figcaption>В кольце из трёх коммутаторов один broadcast расходится в обе стороны, возвращается и снова рассылается. Копий становится всё больше, и через секунды кольцо забито. Это тот же шторм, что от петли у абонента в главе 2, только теперь петлю создали мы сами запасным кабелем.</figcaption></figure>
<p>Получается противоречие: запасной путь нужен для надёжности, но сам он ломает сеть. Нужен кто-то, кто будет держать запасной кабель <b>выключенным, пока основной жив</b>, и включать его, когда основной оборвался. Этим и занимается STP.</p>
<div class="an"><b>Аналогия</b>Между двумя районами два моста. Если пустить машины по обоим без правил, начнётся хаос и пробки по кругу. Поэтому на одном мосту ставят шлагбаум: ездим по основному. Рухнул основной — шлагбаум поднимают, и движение идёт по запасному.</div>

<details class="chk"><summary>Проверь себя: почему broadcast в кольце живёт вечно, а IP-пакет в петле маршрутизации — нет?</summary><p>У IP-пакета есть TTL, который уменьшается на каждом маршрутизаторе. У Ethernet-кадра такого счётчика нет.</p></details>
<details class="chk"><summary>Проверь себя: зачем провайдер вообще строит кольца, если они опасны?</summary><p>Для надёжности: при обрыве одного кабеля трафик пойдёт по другому пути. Опасность петли снимает STP (или кольцевые протоколы).</p></details>`},

{h:'Идея STP: оставить дерево, лишнее заблокировать', html:`
<p><b>STP</b> (Spanning Tree Protocol, протокол «остовного дерева») — протокол, который коммутаторы запускают между собой, чтобы найти петли и выключить лишние порты. Слово «дерево» здесь важно: дерево — это схема, где от корня к каждому листу ведёт ровно одна дорога, без колец.</p>
<p>Работает это так. Коммутаторы договариваются, кто из них будет <b>корнем</b> дерева, «главным» (root bridge). Потом каждый ищет свою лучшую дорогу к корню. Все порты, которые нужны для этих дорог, работают. Порты, через которые образовалось бы кольцо, переводятся в состояние <b>«заблокирован»</b> (blocking): кадры с данными через них не ходят. Физически кабель подключён, лампочка горит, но трафика по нему нет.</p>
<p>Договариваются коммутаторы с помощью служебных «записок» — <b>BPDU</b> (Bridge Protocol Data Unit). Каждые 2 секунды коммутаторы отправляют их друг другу: «я такой-то, главным считаю такого-то, до него мне столько-то». По BPDU каждый понимает, где корень и какая дорога к нему лучшая.</p>
<figure class="dg"><svg viewBox="0 0 320 210" role="img" aria-label="STP: корень SW1, порт SW3 к SW2 заблокирован, кольца нет">
<path class="ln" d="M150 52 L76 138 M170 52 L244 138"/>
<path d="M100 153 L220 153" class="lr" stroke-dasharray="6 5"/>
<rect class="bx" x="128" y="22" width="64" height="30" rx="8" style="stroke:#d97706;stroke-width:2.2"/><text class="tx" x="160" y="42" text-anchor="middle">SW1</text>
<text class="sm og" x="200" y="34">★ корень</text>
<rect class="bx" x="36" y="138" width="64" height="30" rx="8"/><text class="tx" x="68" y="158" text-anchor="middle">SW2</text>
<rect class="bx" x="220" y="138" width="64" height="30" rx="8"/><text class="tx" x="252" y="158" text-anchor="middle">SW3</text>
<text class="sm rd" x="198" y="147" text-anchor="end">блок</text>
<text class="sm" x="160" y="186" text-anchor="middle">кабель SW2–SW3 подключён, но трафика по нему нет:</text>
<text class="sm" x="160" y="200" text-anchor="middle">у каждого ровно одна дорога к корню</text>
<g><rect x="-11" y="-6" width="22" height="12" rx="3" class="o"/><text x="0" y="3" class="wt" text-anchor="middle">BPDU</text><animateMotion dur="2s" repeatCount="indefinite" path="M150 56 L80 136"/></g>
<g><rect x="-11" y="-6" width="22" height="12" rx="3" class="o"/><text x="0" y="3" class="wt" text-anchor="middle">BPDU</text><animateMotion dur="2s" repeatCount="indefinite" path="M170 56 L240 136"/></g>
</svg><figcaption>Корень (SW1) рассылает BPDU-записки каждые 2 секунды. SW2 и SW3 по ним понимают, что их лучшая дорога к корню — прямой кабель. Кабель SW2–SW3 образовал бы кольцо, поэтому один его конец (порт SW3) заблокирован. Если что-то оборвётся, STP пересчитает дерево и разблокирует запасной путь.</figcaption></figure>
<p>Важная деталь: заблокированный порт продолжает <b>слушать BPDU</b>. Именно так он узнаёт, что с основным путём что-то случилось и пора включаться.</p>

<details class="chk"><summary>Проверь себя: что значит «порт заблокирован STP»? Кабель отключён?</summary><p>Нет, кабель подключён и линк поднят. Но кадры с данными через порт не ходят, он только слушает BPDU.</p></details>
<details class="chk"><summary>Проверь себя: что такое BPDU?</summary><p>Служебные кадры STP, которыми коммутаторы обмениваются (по умолчанию каждые 2 секунды), чтобы договориться о корне и путях к нему.</p></details>`},

{h:'Как выбирают главного: root bridge', html:`
<h3>Самый маленький номер побеждает</h3>
<p>У каждого коммутатора в STP есть номер — <b>Bridge ID</b>. Он состоит из двух частей: <b>приоритета</b> (priority, по умолчанию 32768) и MAC-адреса коммутатора. Правило выборов простое: <b>корнем становится коммутатор с самым маленьким Bridge ID</b>. Сначала сравнивают приоритеты, а если они равны — MAC-адреса.</p>
<div class="an"><b>Аналогия</b>Выборы старосты по списку: побеждает тот, у кого меньше номер. Номер — это «приоритет и фамилия». Если приоритеты у всех одинаковые, решает фамилия по алфавиту.</div>
<figure class="dg"><svg viewBox="0 0 320 196" role="img" aria-label="Выборы корня: побеждает коммутатор с наименьшим приоритетом">
<rect class="bx" x="10" y="40" width="92" height="56" rx="8"/><text class="tx" x="56" y="60" text-anchor="middle">SW1</text><text class="sm" x="56" y="76" text-anchor="middle">приоритет 32768</text><text class="sm" x="56" y="89" text-anchor="middle">MAC …0003</text>
<rect class="bx" x="114" y="40" width="92" height="56" rx="8"/><text class="tx" x="160" y="60" text-anchor="middle">SW2</text><text class="sm" x="160" y="76" text-anchor="middle">приоритет 32768</text><text class="sm" x="160" y="89" text-anchor="middle">MAC …0001</text>
<rect class="bx" x="218" y="40" width="92" height="56" rx="8"/><text class="tx" x="264" y="60" text-anchor="middle">SW3</text><text class="sm" x="264" y="76" text-anchor="middle">приоритет 4096</text><text class="sm" x="264" y="89" text-anchor="middle">MAC …0005</text>
<g><text class="sm og" x="56" y="30" text-anchor="middle">«главный я!»</text><text class="sm og" x="160" y="30" text-anchor="middle">«главный я!»</text><text class="sm og" x="264" y="30" text-anchor="middle">«главный я!»</text><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.3;0.31;1"/></g>
<g opacity="0"><text class="tx og" x="264" y="28" text-anchor="middle">★ корень</text><rect x="216" y="38" width="96" height="60" rx="9" fill="none" stroke="#d97706" stroke-width="2.4"/><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.4;0.41;1"/></g>
<g opacity="0"><text class="sm" x="160" y="124" text-anchor="middle">у SW3 приоритет меньше всех (4096) — он корень.</text><text class="sm" x="160" y="140" text-anchor="middle">MAC даже не понадобился.</text><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.4;0.41;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="166" text-anchor="middle">Если бы у всех было 32768, победил бы SW2:</text><text class="sm rd" x="160" y="182" text-anchor="middle">его MAC самый маленький — часто это самый старый коммутатор.</text><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
</svg><figcaption>Сначала каждый коммутатор считает главным себя и рассылает об этом BPDU. Получив BPDU с меньшим Bridge ID, он соглашается с соседом. Через пару секунд все согласны: корень — SW3, у него приоритет меньше всех.</figcaption></figure>
<h3>Почему корень назначают руками</h3>
<p>Если ничего не настраивать, у всех приоритет 32768, и корнем станет коммутатор с наименьшим MAC. Производители раздают MAC по порядку, поэтому часто это <b>самый старый и слабый</b> коммутатор где-нибудь в подвале. Через него и потечёт весь трафик кольца. Поэтому корень всегда назначают сознательно: тот коммутатор, через который трафик и так должен идти — ядро или агрегацию, рядом с выходом наружу (BRAS, маршрутизатор).</p>
<pre class="cli">SW1(config)#spanning-tree vlan 10 root primary      ! сделать меня корнем VLAN 10
SW2(config)#spanning-tree vlan 10 root secondary    ! запасной корень
SW1#show spanning-tree vlan 10
  Root ID    Priority    4106
             Address     5000.0001.0000
             [[This bridge is the root]]</pre>
<p>Странное число 4106 вместо 4096 — не ошибка: Cisco прибавляет к приоритету номер VLAN (4096 + 10). Так у каждого VLAN может быть свой корень, и нагрузку можно делить: в одних VLAN корень SW1, в других SW2.</p>
<div class="callout lab"><b>В лабе</b>Задание 1: ты узнаешь MAC трёх коммутаторов и <b>до</b> команды show сам предскажешь, кто станет корнем. Задание 2: назначишь корни руками и разведёшь VLAN 10 и 20 по разным коммутаторам. А поломка 1 — «чужой» коммутатор с приоритетом 0, который захватывает корень. <a href="#/c/ch04/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: у SW-A приоритет 32768 и MAC …01, у SW-B приоритет 28672 и MAC …99. Кто корень?</summary><p>SW-B: сначала сравнивают приоритеты, 28672 меньше. До MAC дело не доходит.</p></details>
<details class="chk"><summary>Проверь себя: почему опасно оставлять выбор корня «на самотёк»?</summary><p>Корнем станет коммутатор с наименьшим MAC — часто самый старый и слабый, не там, где должен идти трафик.</p></details>`},

{h:'Роли портов: корневой, назначенный, заблокированный', html:`
<p>Корень выбран. Теперь каждый порт каждого коммутатора получает <b>роль</b>. Ролей три, и выбираются они в три шага.</p>
<h3>Шаг 1. Все порты корня — «назначенные»</h3>
<p>Корень — центр дерева, через его порты идут все дороги. Поэтому все его порты работают и называются <b>назначенными</b> (designated, обозначим <b>D</b>).</p>
<h3>Шаг 2. У каждого коммутатора — один «корневой» порт</h3>
<p>Каждый некорневой коммутатор выбирает свой <b>корневой порт</b> (root port, <b>R</b>) — тот, через который дорога до корня самая дешёвая. «Цена» дороги — это <b>стоимость</b> (cost): сумма стоимостей всех кабелей до корня. Чем быстрее кабель, тем он дешевле: по старой таблице Cisco 1 Гбит/с стоит 4, 100 Мбит/с — 19, 10 Гбит/с — 2.</p>
<div class="an"><b>Аналогия</b>Каждый житель района ищет самую быструю дорогу до центра города. По трассе быстрее, чем по проселку, даже если трасса длиннее. Стоимость — это время в пути: на скоростном кабеле оно меньше.</div>
<h3>Шаг 3. На каждом кабеле — один «назначенный» конец, остальное в блок</h3>
<p>На каждом кабеле между коммутаторами должен остаться ровно один «главный» конец — назначенный порт (D), тот, через который этот кабель ближе к корню. Если обе стороны одинаково близки, решает Bridge ID: побеждает коммутатор с меньшим номером. Порт, который не стал ни корневым, ни назначенным, <b>блокируется</b> (blocking, <b>B</b>). Так и рвётся кольцо.</p>
<figure class="dg"><svg viewBox="0 0 320 220" role="img" aria-label="Пошаговое назначение ролей портов в треугольнике">
<path class="ln" d="M150 52 L76 138 M170 52 L244 138"/>
<path d="M100 153 L220 153" class="ln"><animate attributeName="stroke-dasharray" dur="10s" repeatCount="indefinite" values="400 0;400 0;6 5;6 5" keyTimes="0;0.6;0.61;1"/></path>
<rect class="bx" x="128" y="22" width="64" height="30" rx="8" style="stroke:#d97706;stroke-width:2.2"/><text class="tx" x="160" y="42" text-anchor="middle">SW1 ★</text>
<rect class="bx" x="36" y="138" width="64" height="30" rx="8"/><text class="tx" x="68" y="158" text-anchor="middle">SW2</text>
<rect class="bx" x="220" y="138" width="64" height="30" rx="8"/><text class="tx" x="252" y="158" text-anchor="middle">SW3</text>
<text class="sm" x="96" y="96" text-anchor="end">cost 4</text><text class="sm" x="224" y="96">cost 4</text><text class="sm" x="160" y="146" text-anchor="middle">cost 4</text>
<text class="sm" x="160" y="176" text-anchor="middle">MAC SW2 &lt; MAC SW3</text>
<g opacity="0"><rect x="128" y="54" width="18" height="14" rx="3" class="b"/><text class="wt2" x="137" y="64.5" text-anchor="middle">D</text><rect x="174" y="54" width="18" height="14" rx="3" class="b"/><text class="wt2" x="183" y="64.5" text-anchor="middle">D</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.05;0.06;1"/></g>
<g opacity="0"><rect x="72" y="120" width="18" height="14" rx="3" class="g"/><text class="wt2" x="81" y="130.5" text-anchor="middle">R</text><rect x="230" y="120" width="18" height="14" rx="3" class="g"/><text class="wt2" x="239" y="130.5" text-anchor="middle">R</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.3;0.31;1"/></g>
<g opacity="0"><rect x="102" y="128" width="18" height="14" rx="3" class="b"/><text class="wt2" x="111" y="138.5" text-anchor="middle">D</text><rect x="200" y="128" width="18" height="14" rx="3" class="rr"/><text class="wt2" x="209" y="138.5" text-anchor="middle">B</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
<g><text class="sm og" x="160" y="200" text-anchor="middle">Шаг 1: все порты корня — назначенные (D)</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.3;0.31;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="200" text-anchor="middle">Шаг 2: у SW2 и SW3 дорога к корню дешевле напрямую (4) → R</text><text class="sm" x="160" y="214" text-anchor="middle">через соседа было бы 4 + 4 = 8</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.3;0.31;0.6;0.61;1"/></g>
<g opacity="0"><text class="sm rd" x="160" y="200" text-anchor="middle">Шаг 3: кабель SW2–SW3 — у SW2 MAC меньше → D,</text><text class="sm rd" x="160" y="214" text-anchor="middle">порт SW3 лишний → B, кольцо разорвано</text><animate attributeName="opacity" dur="10s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.6;0.61;1"/></g>
</svg><figcaption>Шаг за шагом: порты корня — D, у каждого коммутатора самый дешёвый путь к корню — R, на кабеле SW2–SW3 побеждает SW2 (у него меньше Bridge ID), а порт SW3 уходит в блок (B). Получилось дерево без колец.</figcaption></figure>
<p>Так это выглядит в выводе:</p>
<pre class="cli">SW3#show spanning-tree vlan 10
Interface           Role Sts Cost      Prio.Nbr Type
------------------- ---- --- --------- -------- ----
Gi0/1               [[Root FWD]] 4         128.2    P2p
Gi0/2               [[Altn BLK]] 4         128.3    P2p
Gi1/0               Desg FWD 4         128.5    P2p Edge</pre>
<p><b>Role</b> — роль (Root, Desg — назначенный, Altn — запасной, о нём следующий раздел), <b>Sts</b> — состояние (FWD — пересылает, BLK — заблокирован). Порт Gi1/0 — к компьютеру, его тип Edge, о нём в разделе 6.</p>
<div class="callout lab"><b>В лабе</b>Задание 1 целиком про этот раздел: на бумаге посчитай роли всех портов треугольника (с двойным кабелем между SW1 и SW2!) и только потом проверь себя выводом. Это лучший способ, чтобы роли перестали быть заучиванием. <a href="#/c/ch04/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: сколько корневых портов у корня?</summary><p>Ни одного: у корня все порты назначенные. Корневой порт есть только у некорневых коммутаторов, по одному.</p></details>
<details class="chk"><summary>Проверь себя: у SW3 два пути к корню — стоимостью 4 и 8. Какой порт станет корневым?</summary><p>Тот, что со стоимостью 4: корневой порт — самая дешёвая дорога к корню.</p></details>`},

{h:'Что происходит при обрыве: старый STP и быстрый RSTP', html:`
<h3>Старый STP — медленный</h3>
<p>Первая версия STP (стандарт 802.1D) была очень осторожной. Когда основной путь пропадал, заблокированный порт не включался сразу, а выжидал по таймерам: до 20 секунд, чтобы убедиться, что соседа действительно нет, потом 15 секунд «послушать», потом 15 секунд «поучить MAC-адреса». Итого <b>30–50 секунд</b> без связи. В 1990-х это было терпимо, сегодня это вечность: абоненты замечают, звонки рвутся.</p>
<h3>RSTP — быстрый</h3>
<p><b>RSTP</b> (Rapid STP, стандарт 802.1w, сейчас часть 802.1Q) делает то же самое, но за <b>секунду-другую</b>. Секрет в двух вещах.</p>
<p><b>Запасной путь готовится заранее.</b> Заблокированный порт, через который тоже можно дойти до корня, получает роль <b>alternate</b> («запасной», Altn в выводе). Коммутатор заранее знает: «если основной путь пропадёт, сразу переключусь сюда».</p>
<p><b>Соседи договариваются, а не ждут.</b> Вместо таймеров коммутаторы на прямых кабелях обмениваются быстрыми сообщениями «можно включаю?» — «можно» (по-английски proposal и agreement) и включают порт сразу.</p>
<figure class="dg"><svg viewBox="0 0 320 214" role="img" aria-label="RSTP: при обрыве кабеля SW3–SW1 запасной порт SW3 к SW2 сразу становится корневым">
<path class="ln" d="M150 52 L76 138"/>
<path d="M170 52 L244 138" class="ln"><animate attributeName="stroke" dur="9s" repeatCount="indefinite" values="#94a3b8;#94a3b8;#e11d48;#e11d48" keyTimes="0;0.3;0.31;1"/><animate attributeName="stroke-dasharray" dur="9s" repeatCount="indefinite" values="400 0;400 0;3 6;3 6" keyTimes="0;0.3;0.31;1"/></path>
<path d="M100 153 L220 153" class="ln" stroke-dasharray="6 5"><animate attributeName="stroke-dasharray" dur="9s" repeatCount="indefinite" values="6 5;6 5;400 0;400 0" keyTimes="0;0.42;0.43;1"/><animate attributeName="stroke" dur="9s" repeatCount="indefinite" values="#94a3b8;#94a3b8;#16a34a;#16a34a" keyTimes="0;0.42;0.43;1"/></path>
<rect class="bx" x="128" y="22" width="64" height="30" rx="8" style="stroke:#d97706;stroke-width:2.2"/><text class="tx" x="160" y="42" text-anchor="middle">SW1 ★</text>
<rect class="bx" x="36" y="138" width="64" height="30" rx="8"/><text class="tx" x="68" y="158" text-anchor="middle">SW2</text>
<rect class="bx" x="220" y="138" width="64" height="30" rx="8"/><text class="tx" x="252" y="158" text-anchor="middle">SW3</text>
<rect class="bx" x="222" y="186" width="60" height="24" rx="6"/><text class="tx" x="252" y="202" text-anchor="middle" style="font-size:11px">абонент</text>
<path class="ln" d="M252 168 L252 186"/>
<g opacity="0"><text class="rd" x="214" y="98" style="font:700 20px sans-serif">✕</text><text class="sm rd" x="234" y="82">обрыв</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.3;0.31;1"/></g>
<g><text class="sm" x="160" y="104" text-anchor="middle">порт SW3 → SW2: запасной (Altn)</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.42;0.43;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="104" text-anchor="middle">запасной сразу стал корневым:</text><text class="sm gn" x="160" y="118" text-anchor="middle">RSTP ~1 с · старый STP 30–50 с</text><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.43;0.44;1"/></g>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="9s" repeatCount="indefinite" path="M252 186 L252 154 L160 40" keyPoints="0;0.2;1;1" keyTimes="0;0.05;0.25;1" calcMode="linear"/><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.25;0.26;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="9s" repeatCount="indefinite" path="M252 186 L252 154 L68 154 L160 40" keyPoints="0;0;0.1;0.6;1;1" keyTimes="0;0.5;0.55;0.75;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="9s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.5;0.51;0.92;1"/></g>
</svg><figcaption>Сначала трафик абонента идёт от SW3 прямо к корню. Порт SW3 в сторону SW2 заблокирован, но помечен как запасной. Кабель SW3–SW1 оборвался, и запасной порт почти мгновенно становится корневым. Трафик идёт в обход через SW2.</figcaption></figure>
<h3>Скрытая цена любого переключения</h3>
<p>Когда порт меняет состояние, коммутатор рассылает по дереву уведомление «топология изменилась» (topology change). Получив его, все коммутаторы <b>стирают выученные MAC-адреса</b>, ведь пути поменялись. Следующие кадры — снова к неизвестным получателям, то есть рассылка во все порты (вспомни flooding из главы 2), пока таблицы не заполнятся заново. Одно такое событие незаметно. Но если какой-то порт «моргает» каждую минуту, сеть постоянно стирает таблицы и флудит, и абоненты во всём VLAN жалуются, что «интернет подтормаживает».</p>
<div class="callout pro"><b>Кольца у провайдера</b>В городских кольцах вместо STP часто работает специальный кольцевой протокол <b>ERPS</b> (стандарт ITU-T G.8032). Идея та же — в кольце один порт заблокирован, — но переключение быстрее 50 миллисекунд. У Huawei есть похожие свои протоколы (RRPP, SEP), у Eltex и SNR — ERPS. Если у вас «кольцо из домов» — спроси коллег, что на нём работает.</div>
<div class="callout lab"><b>В лабе</b>Задание 3: запустишь бесконечный пинг и выключишь основной кабель — сначала на старом STP, потом на RSTP. Посчитай потерянные пинги в обоих случаях. Задание 4: «поморгаешь» портом и найдёшь источник уведомлений о смене топологии по логам. <a href="#/c/ch04/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что делает RSTP быстрым? Назови две причины.</summary><p>Запасной путь (alternate) готов заранее, и соседи договариваются о включении порта сообщениями, а не ждут таймеров.</p></details>
<details class="chk"><summary>Проверь себя: почему частые переключения STP вызывают «тормоза» у всего VLAN?</summary><p>Каждое изменение топологии заставляет коммутаторы стереть MAC-таблицы, и кадры к неизвестным получателям рассылаются во все порты, пока таблицы не заполнятся снова.</p></details>`},

{h:'Защита: абонент со своим коммутатором', html:`
<h3>Порты к абонентам — особые</h3>
<p>STP придуман для связей между коммутаторами. За абонентским портом коммутатора быть не должно: там роутер или компьютер. Поэтому абонентский порт настраивают как <b>edge-порт</b> — «пограничный», к конечному устройству. В Cisco это называется <b>PortFast</b>. Такой порт включается сразу, без процедур STP, и его включение-выключение не вызывает уведомлений «топология изменилась» (помнишь, к чему они приводят?).</p>
<h3>А если абонент всё-таки подключил коммутатор</h3>
<p>Случается постоянно: абонент купил «умный» свитч, подключил его двумя кабелями или в нём включён STP. Свитч начинает присылать BPDU в наш порт. Это опасно: он может устроить петлю или даже объявить себя корнем всей сети, если у него приоритет поменьше.</p>
<p>От этого защищает <b>BPDU Guard</b>: если в edge-порт пришёл хоть один BPDU, порт немедленно выключается и переходит в состояние <b>err-disabled</b> («выключен из-за ошибки»). Абонент остаётся без связи, но вся остальная сеть цела.</p>
<figure class="dg"><svg viewBox="0 0 320 200" role="img" aria-label="Свитч абонента присылает BPDU, порт уходит в err-disabled">
<path class="ln" d="M160 56 L160 100"/>
<rect class="bx" x="100" y="26" width="120" height="30" rx="8"/><text class="tx" x="160" y="46" text-anchor="middle">домовой коммутатор</text>
<text class="sm" x="230" y="80">порт: PortFast + BPDU Guard</text>
<path d="M160 100 L160 140" class="ln"><animate attributeName="stroke" dur="7s" repeatCount="indefinite" values="#94a3b8;#94a3b8;#e11d48;#e11d48" keyTimes="0;0.45;0.46;1"/><animate attributeName="stroke-dasharray" dur="7s" repeatCount="indefinite" values="400 0;400 0;4 4;4 4" keyTimes="0;0.45;0.46;1"/></path>
<rect class="bx" x="104" y="140" width="112" height="30" rx="8"/><text class="tx" x="160" y="160" text-anchor="middle" style="font-size:11px">свитч абонента</text>
<g><rect x="-12" y="-6" width="24" height="12" rx="3" class="o"/><text x="0" y="3" class="wt" text-anchor="middle">BPDU</text><animateMotion dur="7s" repeatCount="indefinite" path="M160 138 L160 104" keyPoints="0;1;1" keyTimes="0;0.4;1" calcMode="linear"/><animate attributeName="opacity" dur="7s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.42;0.43;1"/></g>
<g opacity="0"><rect x="100" y="90" width="120" height="20" rx="5" class="rr"/><text class="wt2" x="160" y="104" text-anchor="middle">порт: err-disabled ✕</text><animate attributeName="opacity" dur="7s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.45;0.46;1"/></g>
<g opacity="0"><text class="sm gn" x="160" y="190" text-anchor="middle">порт выключен — остальная сеть в безопасности</text><animate attributeName="opacity" dur="7s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.51;1"/></g>
</svg><figcaption>Свитч абонента прислал BPDU в порт, настроенный как edge с BPDU Guard. Коммутатор сразу выключает порт (err-disabled). Петли и захвата корня не будет, пострадал только этот абонент.</figcaption></figure>
<pre class="cli">SW3(config)#spanning-tree portfast default              ! все access-порты — edge
SW3(config)#spanning-tree portfast bpduguard default     ! и на них BPDU Guard
SW3#show interfaces status err-disabled
Port      Status        Reason
Gi1/2     err-disabled  [[bpduguard]]
SW3(config)#errdisable recovery cause bpduguard          ! поднимать порт сам
SW3(config)#errdisable recovery interval 300             ! через 5 минут</pre>
<p>Если порт ушёл в err-disabled, сам он не поднимется. Его поднимают руками (<code>shutdown</code>, затем <code>no shutdown</code>) или настраивают автоподъём через заданное время, как в примере.</p>
<h3>Ещё три защиты</h3>
<p><b>Root Guard</b> ставят на порты агрегации, которые смотрят вниз, к домам: если оттуда придёт BPDU «я главнее», порт блокируется. Корень не «уедет» на какой-то домовой коммутатор.</p>
<p><b>Storm control</b> ограничивает долю broadcast на порту. Если абонент устроил шторм, лишнее отбрасывается или порт выключается.</p>
<p><b>Loop detection</b> есть у многих производителей, которых ставят провайдеры (Eltex, SNR, D-Link, Huawei). Коммутатор отправляет в порт специальный проверочный кадр: если тот вернулся — за портом петля, и порт выключается. Работает даже тогда, когда свитч абонента вообще не знает про STP.</p>
<div class="callout pro"><b>Типичная заявка</b>«Нет интернета, вчера купили новый роутер или свитч». Смотрим порт: если он в err-disabled с причиной bpduguard или loop-detect — абонент подключил что-то с BPDU или петлёй. Объясняем, как подключить правильно, и поднимаем порт.</div>
<div class="callout lab"><b>В лабе</b>Задание 6: включишь PortFast, BPDU Guard и Root Guard, подключишь «абонентский» коммутатор SW4 с приоритетом 0 и посмотришь, как порт уходит в err-disabled, а потом сам поднимается через errdisable recovery. Поломка 4 — что бывает, если вместо Guard поставить Filter. <a href="#/c/ch04/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: что делает BPDU Guard?</summary><p>Выключает порт (err-disabled), как только в него пришёл BPDU. Ставится на порты к абонентам и конечным устройствам.</p></details>
<details class="chk"><summary>Проверь себя: порт абонента в err-disabled с причиной bpduguard. Что случилось и что делать?</summary><p>Абонент подключил устройство, которое шлёт BPDU (коммутатор). Объяснить абоненту, убрать причину и поднять порт (shutdown / no shutdown) или дождаться автоподъёма.</p></details>`},

{h:'Два кабеля как один: агрегация каналов (LACP)', html:`
<h3>Зачем объединять кабели</h3>
<p>Между двумя коммутаторами проложили два кабеля, чтобы было быстрее и надёжнее. Но STP видит в двух параллельных кабелях обычное кольцо и один из них заблокирует: ни скорости, ни мгновенного резерва. Решение — объявить оба кабеля <b>одним логическим каналом</b>. Это <b>агрегация каналов</b> (link aggregation). У Cisco такой канал называется Port-channel или EtherChannel, у Huawei — Eth-Trunk, у Juniper — ae.</p>
<p>Для STP агрегат — это один порт, поэтому блокировать нечего. Трафик идёт по всем кабелям сразу, а если один оборвался, трафик за доли секунды уходит в оставшиеся, без всяких пересчётов дерева.</p>
<p>Чтобы обе стороны точно договорились, какие кабели в агрегате, используют протокол <b>LACP</b> (Link Aggregation Control Protocol, стандарт 802.3ad, сейчас 802.1AX). Коммутаторы по LACP проверяют, что на другом конце каждого кабеля тот же сосед и те же настройки. Если кто-то воткнул кабель не туда, LACP не возьмёт его в агрегат — и петли не будет.</p>
<pre class="cli">SW1(config)#interface range Gi0/1 - 2
SW1(config-if-range)#channel-group 1 mode active     ! LACP, инициирую сам
SW1#show etherchannel summary
Group  Port-channel  Protocol    Ports
1      Po1([[SU]])       LACP        Gi0/1([[P]])   Gi0/2([[P]])</pre>
<p>В выводе: <b>SU</b> — агрегат работает, <b>P</b> — кабель в агрегате. Если видишь <b>s</b> (suspended) — этот кабель отвергнут: обычно у него другие настройки (VLAN, скорость), чем у остальных.</p>
<h3>Как трафик делится между кабелями</h3>
<p>Важная деталь, которую почти все понимают неправильно. Агрегат из двух кабелей по 1 Гбит/с <b>не</b> даёт одному скачиванию 2 Гбит/с. Трафик делится не по пакетам, а по <b>потокам</b> (flow) — например, по паре «IP отправителя — IP получателя». Каждый поток целиком идёт по одному кабелю, иначе пакеты приходили бы не по порядку, и TCP считал бы это потерями.</p>
<figure class="dg"><svg viewBox="0 0 320 180" role="img" aria-label="Агрегат из двух кабелей: каждый поток целиком в своём кабеле">
<path class="tk" d="M74 70 L246 70 M74 104 L246 104"/>
<rect class="bx" x="10" y="54" width="64" height="66" rx="9"/><text class="tx" x="42" y="91" text-anchor="middle">SW1</text>
<rect class="bx" x="246" y="54" width="64" height="66" rx="9"/><text class="tx" x="278" y="91" text-anchor="middle">SW2</text>
<text class="sm" x="160" y="44" text-anchor="middle">Po1 = 2 кабеля, для STP — один порт</text>
<text class="sm" x="160" y="124" text-anchor="middle" style="font-size:10.5px">кабель 2</text><text class="sm" x="160" y="62" text-anchor="middle" style="font-size:10.5px">кабель 1</text>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="b"/><animateMotion dur="2.4s" repeatCount="indefinite" path="M80 70 L240 70"/></g>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="o"/><animateMotion dur="2.4s" begin="1.2s" repeatCount="indefinite" path="M80 70 L240 70"/></g>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="g"/><animateMotion dur="2.4s" begin="0.6s" repeatCount="indefinite" path="M80 104 L240 104"/></g>
<rect class="b" x="24" y="140" width="12" height="12" rx="3"/><text class="sm" x="40" y="150">поток А (бэкап сервера)</text>
<rect class="o" x="24" y="158" width="12" height="12" rx="3"/><text class="sm" x="40" y="168">поток Б</text>
<rect class="g" x="170" y="140" width="12" height="12" rx="3"/><text class="sm" x="186" y="150">поток В</text>
<text class="sm og" x="170" y="168">поток всегда в одном кабеле</text>
</svg><figcaption>Коммутатор по «хешу» от адресов назначает каждому потоку кабель. Потоки А и Б попали в кабель 1, поток В — в кабель 2. Один большой поток никогда не получит больше одного кабеля. Зато потоков у провайдера тысячи, и в среднем они делятся ровно.</figcaption></figure>
<div class="callout pro"><b>У провайдера</b>Аплинки домовых коммутаторов и агрегации почти всегда собраны в LACP-агрегаты. Полезные мелочи: быстрый LACP (lacp rate fast) замечает обрыв кабеля за 3 секунды, а настройка «минимум кабелей» (min-links) выключает агрегат целиком, если в нём осталось слишком мало кабелей, — тогда трафик уйдёт по другому пути, а не задохнётся в одном кабеле. Подробнее о делении трафика — в дополнительной главе «ECMP и балансировка».</div>
<div class="callout lab"><b>В лабе</b>Задание 5: соберёшь LACP из двух кабелей между SW1 и SW2 и проверишь, что при выключении одного кабеля не теряется ни один пинг. Поломка 2 — кабель в состоянии s: найди, чем его настройки отличаются от остальных. <a href="#/c/ch04/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему STP не блокирует кабели внутри агрегата?</summary><p>Для STP агрегат — один логический порт, кольца нет.</p></details>
<details class="chk"><summary>Проверь себя: агрегат 2 × 1 Гбит/с. Сколько получит один файл, который качают одним соединением?</summary><p>Не больше 1 Гбит/с: поток целиком идёт по одному кабелю.</p></details>`},

{h:'Охрана абонентской сети: DHCP snooping и DAI', html:`
<h3>Проблема: чужой DHCP-сервер</h3>
<p>Помнишь из главы 2, как абонент получает адрес по DHCP: кричит «есть свободный адрес?», и сервер отвечает. Но отвечать может <b>любой</b>, кто услышал вопрос. А теперь представь абонента, который воткнул свой домашний роутер в сеть провайдера «задом наперёд» — LAN-портом. Роутер начинает раздавать соседям свои адреса 192.168.0.x. Кто-то из соседей получает адрес от него, а не от провайдера, и остаётся без интернета. Такие заявки приходят пачками из одного дома.</p>
<h3>Решение: доверенные и недоверенные порты</h3>
<p><b>DHCP snooping</b> («подслушивание DHCP») делит порты коммутатора на два вида. <b>Доверенные</b> (trusted) — аплинки, со стороны которых находится настоящий DHCP-сервер провайдера. <b>Недоверенные</b> (untrusted) — все абонентские порты. Ответы DHCP-сервера (предложение адреса и подтверждение) разрешены <b>только с доверенных портов</b>. Если такой ответ пришёл с порта абонента — коммутатор его выбрасывает.</p>
<figure class="dg"><svg viewBox="0 0 320 214" role="img" aria-label="Ответ настоящего DHCP-сервера проходит с аплинка, ответ роутера абонента отбрасывается">
<path class="ln" d="M160 52 L160 92 M120 122 L62 162 M200 122 L258 162"/>
<rect class="bx" x="98" y="22" width="124" height="30" rx="8"/><text class="tx" x="160" y="42" text-anchor="middle">DHCP провайдера</text>
<text class="sm gn" x="168" y="76">аплинк: доверенный</text>
<rect class="bx" x="96" y="92" width="128" height="30" rx="8"/><text class="tx" x="160" y="112" text-anchor="middle">домовой коммутатор</text>
<rect class="bx" x="14" y="162" width="96" height="30" rx="8"/><text class="tx" x="62" y="182" text-anchor="middle" style="font-size:11px">абонент А</text>
<rect class="bx" x="210" y="162" width="96" height="30" rx="8"/><text class="tx" x="258" y="182" text-anchor="middle" style="font-size:10.5px">роутер «наоборот»</text>
<text class="sm rd" x="258" y="208" text-anchor="middle">недоверенный порт</text>
<g><text class="sm" x="62" y="152" text-anchor="middle">«дайте адрес!»</text><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.3;0.31;1"/></g>
<g><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="8s" repeatCount="indefinite" path="M62 162 L130 116 L160 56" keyPoints="0;1;1" keyTimes="0;0.25;1" calcMode="linear"/><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.26;0.27;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env" style="fill:#bbf7d0"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="8s" repeatCount="indefinite" path="M160 56 L130 116 L62 162" keyPoints="0;0;1;1" keyTimes="0;0.35;0.62;1" calcMode="linear"/><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.35;0.36;0.63;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env" style="fill:#fecaca"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="8s" repeatCount="indefinite" path="M258 162 L206 126" keyPoints="0;0;1;1" keyTimes="0;0.35;0.55;1" calcMode="linear"/><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.35;0.36;0.56;0.57;1"/></g>
<g opacity="0"><text class="rd" x="214" y="140" style="font:700 20px sans-serif">✕</text><text class="sm rd" x="236" y="138">выброшен</text><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.56;0.57;1"/></g>
<g opacity="0"><text class="sm gn" x="62" y="152" text-anchor="middle">адрес от провайдера ✓</text><animate attributeName="opacity" dur="8s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.63;0.64;1"/></g>
</svg><figcaption>Абонент А спрашивает адрес. Отвечают двое: настоящий сервер провайдера (зелёный конверт с доверенного аплинка) и чужой роутер (красный конверт с недоверенного порта). Коммутатор пропускает только ответ с доверенного порта, а чужой выбрасывает.</figcaption></figure>
<p>Побочный и очень полезный результат: коммутатор, подслушивая DHCP, записывает в таблицу, какой MAC на каком порту получил какой IP. Это та самая таблица <code>show ip dhcp snooping binding</code> из главы 2 — единственное место на коммутаторе, где видно IP абонента. Там же коммутатор может вписывать в запросы <b>Option 82</b> — пометку о порте абонента, по которой DHCP-сервер или BRAS понимает, кому выдавать адрес.</p>
<h3>Подмена шлюза и DAI</h3>
<p>Есть атака похитрее. Помнишь ARP из главы 3: «кто 10.20.3.1? — это я, мой MAC такой-то». Злоумышленник может сам рассылать соседям ARP-ответы «шлюз — это я», и их трафик потечёт через его компьютер. Защита — <b>DAI</b> (Dynamic ARP Inspection, динамическая проверка ARP). Коммутатор сверяет каждый ARP с порта абонента с таблицей DHCP snooping: если «я 10.20.3.1» кричит порт, которому этот адрес никто не выдавал, ARP выбрасывается.</p>
<div class="callout warn"><b>Не забудь доверенные порты</b>Самая частая ошибка: включили DHCP snooping, но доверенным пометили не все аплинки. Пока трафик идёт через «правильный» аплинк, всё работает. Перестроилось дерево STP, трафик пошёл через другой аплинк — и ответы DHCP-сервера внезапно выбрасываются: у абонентов не продлеваются адреса. Доверенными должны быть <b>все</b> аплинки.</div>
<div class="callout lab"><b>В лабе</b>Задание 7: включишь DHCP snooping и встретишься с ловушкой Option 82 (компьютеры перестанут получать адреса — разберёшься почему). Задание 8: включишь DAI и попробуешь выдать компьютер за шлюз. Поломка 3 — ровно та ошибка с недоверенным аплинком. <a href="#/c/ch04/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: какие порты должны быть доверенными в DHCP snooping?</summary><p>Все порты в сторону настоящего DHCP-сервера, то есть все аплинки. Абонентские порты — недоверенные.</p></details>
<details class="chk"><summary>Проверь себя: что проверяет DAI?</summary><p>ARP-сообщения с недоверенных портов: совпадают ли IP и MAC с тем, что записано в таблице DHCP snooping для этого порта. Поддельные ARP выбрасываются.</p></details>`}
],
end: `<h3>Что ты теперь знаешь</h3>
<p>Сеть провайдера строят с запасными путями, но запасной путь — это петля, а петля — это шторм. STP решает противоречие: коммутаторы выбирают корень (наименьший Bridge ID — поэтому корень назначают руками), каждый находит самый дешёвый путь к нему, а лишние порты блокирует. RSTP делает переключение быстрым благодаря заранее готовому запасному порту. Абонентские порты защищают: PortFast, BPDU Guard, loop detection, storm control. Параллельные кабели объединяют в LACP-агрегат, но один поток всегда идёт по одному кабелю. А DHCP snooping и DAI не дают абоненту раздавать соседям чужие адреса и выдавать себя за шлюз.</p>
<div class="callout ok"><b>Посмотри у себя на работе</b><ol><li>На агрегации: <code>show spanning-tree</code> (или аналог) — кто корень, какие порты заблокированы? Или у вас ERPS на кольце?</li><li>Найди порт в err-disabled и посмотри причину.</li><li>Посмотри, какие аплинки собраны в агрегаты и все ли кабели в них в состоянии P.</li><li>Узнай, включён ли у вас DHCP snooping и loop detection на домовых коммутаторах.</li></ol></div>
<p>Дальше по главе: карточки, тест, «Объясни своими словами» и лаба — треугольник коммутаторов, LACP, «абонентский» коммутатор-нарушитель и DHCP snooping.</p>`
};
