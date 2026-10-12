COURSE.add({
  id: 'ch02',
  time: '≈ 5–6 часов',
  intro: `<p>Что такое VLAN, ты знаешь. Здесь коммутация разбирается как <b>инструмент диагностики</b>: как коммутатор принимает решение по каждому кадру, как по MAC-таблицам за минуту найти абонента в сети из сотни коммутаторов, как выглядят петля и MAC flapping в логах. Отдельно — провайдерская L2: QinQ, VLAN на абонента и на услугу, MTU.</p>
<p class="muted">По стартовой диагностике (L2 — 4/10, MAC/ARP — 5/10) это слабые места, поэтому глава подробнее остальных глав Части I.</p>`,
  goals: [
    'Пошагово объяснить, что коммутатор делает с кадром: learning, forwarding, flooding, filtering, aging',
    'Разобрать 802.1Q-тег по полям и объяснить поведение access, trunk и native VLAN, включая опасные случаи',
    'Найти устройство по IP: ARP на шлюзе → MAC → MAC-таблицы коммутатор за коммутатором → порт',
    'Распознать петлю и MAC flapping по логам и счётчикам, понять асимметричный unknown unicast flooding',
    'Объяснить QinQ (802.1ad), схемы VLAN на абонента и на услугу и почему в QinQ важен MTU'
  ],
  why: `Половина заявок в ШПД и метро-Ethernet — L2: «нет линка», «пропал интернет у дома», «петля у абонента положила кольцо». Инженер, который по MAC-таблице за минуту находит, где сидит абонент и через какой порт пришла петля, ценится выше того, кто знает наизусть все RFC.`,
  refs: [
    { t: 'IEEE 802.1Q-2022 — Bridges and Bridged Networks', u: 'https://standards.ieee.org/ieee/802.1Q/10323/', n: 'первоисточник: VLAN, тегирование, S-VLAN (бывший 802.1ad)' },
    { t: 'W. Odom — CCNA 200-301 OCG Vol. 1', n: 'гл. 5 (Ethernet LAN switching), гл. 8 (VLAN и trunk)' },
    { t: 'Cisco: Configuring VLANs / Trunks (Catalyst)', u: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3750x_3560x/software/release/15-2_2_e/vlan/configuration_guide/b_vlan_1522e_3750x_3560x_cg/b_vlan_1522e_3750x_3560x_cg_chapter_011.html' },
    { t: 'Cisco: Unknown Unicast Flooding in Switched Networks', u: 'https://www.cisco.com/c/en/us/support/docs/switches/catalyst-6000-series-switches/23563-143.html', n: 'асимметричная маршрутизация и флуд' },
    { t: 'xgu.ru — VLAN, Q-in-Q', u: 'http://xgu.ru/wiki/VLAN' }
  ],
  theory: [
    {
      id: 'decide', h: 'Как коммутатор решает судьбу каждого кадра',
      html: `
<p>У коммутатора одна таблица и пять действий. <b>MAC-таблица</b> (CAM) — это записи «MAC + VLAN → порт». Важно: ключ — <b>пара MAC и VLAN</b>. Один и тот же MAC в разных VLAN — это разные записи.</p>
<ol class="steps">
<li><b>Learning.</b> Пришёл кадр на порт P в VLAN V. Коммутатор смотрит на <b>Source MAC</b> и записывает: «этот MAC в VLAN V живёт за портом P». Учится только по источнику, никогда по получателю.</li>
<li><b>Forwarding.</b> Ищет <b>Destination MAC</b> в таблице для VLAN V. Нашёл — отправляет только в этот порт.</li>
<li><b>Filtering.</b> Если найденный порт — тот же, откуда кадр пришёл, кадр отбрасывается: получатель уже за этим портом.</li>
<li><b>Flooding.</b> Получатель неизвестен (<i>unknown unicast</i>), broadcast (FF:FF:FF:FF:FF:FF) или multicast без IGMP snooping — кадр копируется во все порты этого VLAN, кроме входного.</li>
<li><b>Aging.</b> Запись живёт 300 секунд с последнего кадра <i>от</i> этого MAC. Молчит хост пять минут — его забыли, и кадры к нему снова флудятся.</li></ol>
<pre class="cli">SW1#show mac address-table dynamic vlan 101
          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 101    0050.7966.6800    DYNAMIC     Gi0/1
 101    0050.7966.6802    DYNAMIC     [[Gi0/3]]
Total Mac Addresses for this criterion: 2
SW1#show mac address-table address 0050.7966.6802
SW1#show mac address-table count
SW1#show mac address-table aging-time</pre>
<div class="callout info"><b>Ключевая мысль для диагностики</b>MAC-таблица показывает, <b>откуда коммутатор последний раз видел кадр от этого MAC</b>. Это «след» хоста. Если след ведёт в транк, идёшь на соседний коммутатор и смотришь там. Так ты пройдёшь до access-порта, за которым стоит хост.</div>
<h3>Неочевидное: асимметричный unknown unicast flooding</h3>
<p>Таймер ARP на маршрутизаторах Cisco — <b>4 часа</b>, а MAC aging на коммутаторе — <b>5 минут</b>. Допустим, сервер только принимает трафик (бэкап, видеопоток) и сам почти ничего не шлёт, или ответы от него уходят другим путём (асимметрия, два шлюза). Тогда маршрутизатор помнит его MAC (ARP жив), а коммутатор уже забыл (aging). Каждый кадр к серверу становится unknown unicast и <b>флудится во все порты VLAN</b>. Внешне это выглядит как необъяснимая нагрузка на всех портах VLAN.</p>
<p>Лечение: выровнять таймеры (ARP timeout ≤ MAC aging), убрать асимметрию или увеличить aging-time в этом VLAN.</p>`
    },
    {
      id: 'dot1q', h: 'Кадр Ethernet и тег 802.1Q по полям',
      html: `
<p>Кадр Ethernet II без тега:</p>
<div class="pkt"><span class="l2" style="flex:6">Dst MAC<small>6 байт</small></span><span class="l2" style="flex:6">Src MAC<small>6</small></span><span class="l2" style="flex:2.5">EtherType<small>2</small></span><span class="l3" style="flex:18">Payload (IP-пакет)<small>46–1500</small></span><span class="fcs" style="flex:3">FCS<small>4</small></span></div>
<p>С тегом 802.1Q между Src MAC и EtherType вставляются 4 байта:</p>
<div class="pkt"><span class="l2" style="flex:6">Dst MAC<small>6</small></span><span class="l2" style="flex:6">Src MAC<small>6</small></span><span class="tg" style="flex:2.5">TPID<small>0x8100</small></span><span class="tg" style="flex:1.2">PCP<small>3 бит</small></span><span class="tg" style="flex:1">DEI<small>1</small></span><span class="tg" style="flex:2.5">VID<small>12 бит</small></span><span class="l2" style="flex:2.5">EtherType<small>0x0800</small></span><span class="l3" style="flex:14">Payload</span><span class="fcs" style="flex:3">FCS</span></div>
<table><tr><th>Поле</th><th>Смысл</th></tr>
<tr><td>TPID 0x8100</td><td>«дальше тег». Стоит на месте EtherType, поэтому старое устройство, не знающее VLAN, видит неизвестный протокол</td></tr>
<tr><td>PCP (3 бита)</td><td>приоритет 802.1p, 0–7. Используется в QoS на L2 (глава 15)</td></tr>
<tr><td>DEI (1 бит)</td><td>кадр можно отбросить первым при перегрузке</td></tr>
<tr><td>VID (12 бит)</td><td>номер VLAN: 0–4095, реально доступны <b>1–4094</b> (0 — «тега VLAN нет, только приоритет», 4095 зарезервирован)</td></tr></table>
<p>Тег добавляет 4 байта: максимальный кадр растёт с 1518 до 1522 байт. Полезная нагрузка (MTU для IP) остаётся 1500. Каждый следующий тег (QinQ, MPLS-метки) добавляет ещё 4 байта, и <b>MTU транспортных линков</b> у провайдера всегда ставят с запасом: 1600, 9000 и больше.</p>
<div class="callout warn"><b>FCS пересчитывается</b>Добавление или снятие тега меняет кадр, поэтому коммутатор пересчитывает контрольную сумму FCS. CRC-ошибки на порту — это ошибки при передаче по линии, тегирование их не вызывает.</div>`
    },
    {
      id: 'ports', h: 'Access, trunk, native VLAN и опасные места',
      html: `
<table><tr><th></th><th>Access</th><th>Trunk</th></tr>
<tr><td>Принимает</td><td>нетегированные кадры → относит их к access VLAN. Тегированные на большинстве Cisco отбрасывает, кроме тега своего VLAN или voice VLAN</td><td>тегированные кадры из allowed-списка + нетегированные → в native VLAN</td></tr>
<tr><td>Отправляет</td><td>без тега</td><td>с тегом, кроме native VLAN (тот без тега)</td></tr>
<tr><td>Для чего</td><td>конечные устройства, абоненты</td><td>коммутатор–коммутатор, коммутатор–маршрутизатор, сервер с виртуализацией</td></tr></table>
<h3>show interfaces trunk — три списка, и разница между ними важна</h3>
<pre class="cli">SW1#show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Gi0/1       on           802.1q         trunking      999
Port        Vlans allowed on trunk
Gi0/1       [[2,101-102]]
Port        Vlans allowed and active in management domain
Gi0/1       [[2,101]]
Port        Vlans in spanning tree forwarding state and not pruned
Gi0/1       [[2,101]]</pre>
<ul><li><b>allowed</b> — что разрешено командой <code>switchport trunk allowed vlan</code>.</li>
<li><b>allowed and active</b> — разрешённые VLAN, которые <b>созданы на этом коммутаторе</b>. VLAN 102 разрешён, но не создан (<code>vlan 102</code> не введён), поэтому трафика по нему не будет. Одна из самых частых причин «VLAN не проходит».</li>
<li><b>forwarding and not pruned</b> — те, что ещё и не заблокированы STP (глава 4).</li></ul>
<h3>Ловушки, которые реально случаются</h3>
<div class="callout bad"><b>Удаление всех VLAN с транка одной командой</b><code>switchport trunk allowed vlan 105</code> <b>заменяет</b> список, а не дополняет его. На транке, где было 2,101–104, останется только 105, и все абоненты на остальных VLAN пропадут. Правильно: <code>switchport trunk allowed vlan add 105</code>. Эта ошибка — классическая причина аварий у провайдеров.</div>
<div class="callout warn"><b>Native VLAN mismatch</b>На одной стороне native 1, на другой — 999. Нетегированный кадр из VLAN 1 левого коммутатора попадает в VLAN 999 правого: VLAN «склеиваются», трафик утекает в чужой сегмент. CDP сообщает об этом в логах (<code>%CDP-4-NATIVE_VLAN_MISMATCH</code>). Хорошая практика: native VLAN — неиспользуемый номер, одинаковый с обеих сторон, или <code>vlan dot1q tag native</code> (тегировать всё).</div>
<div class="callout warn"><b>VLAN hopping</b>Атакующий на access-порту в native VLAN транка шлёт кадр с двумя тегами: внешний — native, внутренний — VLAN жертвы. Первый коммутатор снимает внешний тег (native уходит без тега), второй видит внутренний тег и доставляет кадр в чужой VLAN. Защита: native VLAN не используется для абонентов.</div>
<h3>DTP и VTP: выключить</h3>
<p><b>DTP</b> (Dynamic Trunking Protocol) — Cisco-протокол автосогласования транка. Порт в режиме <code>dynamic auto/desirable</code> можно уговорить стать транком, подключив к нему свой коммутатор, и получить доступ ко всем VLAN. В проде режим всегда задают явно: <code>switchport mode access</code> или <code>switchport mode trunk</code> плюс <code>switchport nonegotiate</code>.</p>
<p><b>VTP</b> распространяет список VLAN между коммутаторами. Если подключить коммутатор с тем же доменом и большим revision number, он перезапишет базу VLAN всего домена, и сеть ляжет. У провайдеров VTP используют в режиме <code>transparent</code> или <code>off</code>, а VLAN создают системой автоматизации.</p>`
    },
    {
      id: 'find', h: 'Навык №1: найти устройство по IP за минуту',
      html: `
<p>Заявка: «у абонента 172.16.3.13 не работает интернет, где он подключён?» Документация, как всегда, устарела. Алгоритм:</p>
<ol class="steps">
<li><b>IP → MAC.</b> На шлюзе VLAN (маршрутизатор или L3-коммутатор): <code>show ip arp 172.16.3.13</code>. Получаешь MAC и интерфейс (VLAN).</li>
<li><b>MAC → порт.</b> На коммутаторе агрегации: <code>show mac address-table address &lt;MAC&gt;</code>. Если порт — транк к другому коммутатору, узнаёшь соседа: <code>show cdp neighbors Gi0/2</code> (или LLDP).</li>
<li><b>Повторяешь</b> на соседе, пока порт не окажется access-портом. Это и есть порт абонента.</li>
<li><b>Проверяешь порт:</b> <code>show interfaces Gi0/X</code> (линк, ошибки), <code>show interfaces Gi0/X switchport</code> (VLAN), <code>show mac address-table interface Gi0/X</code> (сколько MAC за портом — один ли там хост или «ещё один коммутатор»).</li></ol>
<pre class="cli">GW#show ip arp 172.16.3.13
Protocol  Address        Age (min)  Hardware Addr   Type   Interface
Internet  172.16.3.13          2   [[0050.7966.6802]]  ARPA   Vlan101
SW1#show mac address-table address 0050.7966.6802
 101    0050.7966.6802    DYNAMIC     [[Gi0/2]]
SW1#show cdp neighbors Gi0/2
Device ID   Local Intrfce   Holdtme   Capability  Platform  Port ID
[[SW3]]         Gi 0/2          155        R S I    Gigabit   Gi 0/0
SW3#show mac address-table address 0050.7966.6802
 101    0050.7966.6802    DYNAMIC     [[Gi0/1]]     ! access-порт — нашли</pre>
<div class="callout pro"><b>Если записи нет</b>Пусто в ARP — хост не отвечал или не в той сети. Есть ARP, но нет записи в MAC-таблице — хост молчал больше 5 минут: пингни его со шлюза, и запись появится. На провайдерском оборудовании есть ещё DHCP snooping binding table и Option 82 (глава 4): там сразу видно, какому порту выдан адрес.</div>
<h3>Что меняется в кадре на каждом хопе</h3>
<p>Внутри одного VLAN коммутаторы <b>не меняют</b> MAC-адреса: Src MAC — это MAC отправителя, Dst MAC — MAC получателя, на всём пути. Меняется только тег (добавляется на транке, снимается на access). MAC-адреса меняет <b>маршрутизатор</b>: при каждом L3-хопе он пересобирает кадр со своим Src MAC и MAC следующего хопа. IP-адреса при этом не меняются (без NAT). Это основа главы 3 и главы 14.</p>`
    },
    {
      id: 'loops', h: 'Петля, broadcast storm и MAC flapping: как их увидеть',
      html: `
<p>У Ethernet-кадра нет TTL. Если в L2 есть кольцо без STP (или STP выключен, сломан, отфильтрован), broadcast-кадр крутится бесконечно и размножается на каждом коммутаторе. Это <b>broadcast storm</b>.</p>
<h3>Симптомы петли</h3>
<ul><li>Нагрузка на портах резко вырастает до 100%, растёт счётчик broadcast/multicast (<code>show interfaces | include broadcast</code>).</li>
<li>CPU коммутаторов взлетает: процессор разбирает флуд, адресованный ему (ARP, BPDU), и управление начинает тормозить или отваливаться.</li>
<li><b>MAC flapping</b>: один и тот же MAC попеременно появляется то на одном порту, то на другом, потому что копии кадра приходят с разных сторон кольца.</li></ul>
<pre class="cli">%SW_MATM-4-MACFLAP_NOTIF: Host 0050.7966.6800 in vlan 101 is flapping between port [[Gi0/1]] and port [[Gi0/3]]</pre>
<h3>Как читать MAC flapping</h3>
<p>Два порта в сообщении — это два направления, откуда приходят кадры этого хоста. Петля лежит <b>за одним из них</b>, обычно за тем, за которым хоста быть не должно. Если в сообщении access-порт абонента и аплинк, почти наверняка абонент замкнул кольцо у себя: воткнул оба конца кабеля в свой неуправляемый свитч или поставил «умную» мыльницу с двумя линками.</p>
<div class="callout pro"><b>Алгоритм при шторме</b>1) Найти порты с аномальным входящим broadcast (<code>show interfaces counters</code>, rate). 2) По MAC flapping определить направление. 3) Идти к источнику и <b>гасить порт</b>: сначала восстановить сервис, потом разбираться. 4) После аварии: включить защиту — STP с BPDU Guard на абонентских портах, storm-control, loop detection (у Huawei/Eltex/D-Link это отдельная функция, Cisco делает то же через keepalive и BPDU guard). Подробно — глава 4.</div>
<pre class="cli">SW3(config)#interface range Gi0/1 - 3
SW3(config-if-range)#storm-control broadcast level 5.00     ! не больше 5% полосы на broadcast
SW3(config-if-range)#storm-control action shutdown          ! или trap
SW3#show storm-control broadcast</pre>`
    },
    {
      id: 'qinq', h: 'Провайдерская L2: VLAN на абонента, VLAN на услугу, QinQ',
      html: `
<p>4094 VLAN на большой город мало, а держать каждый абонентский VLAN на всех коммутаторах невозможно. Поэтому у провайдеров две модели:</p>
<div class="vs"><div><b>VLAN на услугу (N:1)</b><br>Все абоненты интернета в одном VLAN, IPTV — во втором, VoIP — в третьем. Просто, но абоненты в одном широковещательном домене. Изоляцию делают через <i>port isolation / private VLAN</i>, защиту — через DHCP snooping, DAI, Option 82.</div>
<div><b>VLAN на абонента (1:1)</b><br>У каждого абонента свой VLAN до BRAS: полная изоляция и простой учёт. Чтобы VLAN хватило, используют <b>QinQ</b>: внешний тег (S-VLAN) — дом или коммутатор, внутренний (C-VLAN) — порт абонента. 4094 × 4094 комбинаций.</div></div>
<h3>QinQ (802.1ad, «Q-in-Q», double tagging)</h3>
<div class="pkt"><span class="l2" style="flex:6">Dst MAC</span><span class="l2" style="flex:6">Src MAC</span><span class="tg" style="flex:4">S-tag<small>TPID 0x88A8 · S-VID</small></span><span class="tg" style="flex:4" >C-tag<small>TPID 0x8100 · C-VID</small></span><span class="l2" style="flex:2.5">EtherType</span><span class="l3" style="flex:10">Payload</span><span class="fcs" style="flex:2.5">FCS</span></div>
<p>Порт, смотрящий к клиенту, работает как <b>dot1q-tunnel</b>: что бы клиент ни прислал (с тегом или без), коммутатор добавляет сверху свой S-tag. Клиентские VLAN проходят через сеть провайдера прозрачно, а провайдер видит только S-VLAN. Так продают <b>L2-канал между офисами клиента</b> (до MPLS L2VPN — глава 12 — это делали именно так).</p>
<pre class="cli">PE-SW(config)#interface Gi0/1
PE-SW(config-if)#switchport access vlan 500          ! S-VLAN клиента
PE-SW(config-if)#switchport mode dot1q-tunnel
PE-SW(config-if)#l2protocol-tunnel stp               ! пропустить BPDU клиента насквозь
PE-SW(config)#system mtu 1504                         ! место под второй тег (зависит от платформы)</pre>
<ul><li>TPID внешнего тега по стандарту <b>0x88A8</b>, но многие платформы по умолчанию ставят 0x8100 для обоих тегов. При стыке разных вендоров TPID нужно согласовывать.</li>
<li><b>MTU</b>: +4 байта на каждый тег. Не увеличил MTU — большие пакеты клиента (1500) молча теряются, а пинги маленькими пакетами проходят. Классическая заявка «сайт открывается через раз, ping идёт».</li>
<li><b>L2PT</b> (Layer 2 Protocol Tunneling) — пропуск STP, CDP, LACP клиента через сеть провайдера. Без него BPDU клиента обрабатываются коммутаторами провайдера.</li></ul>
<div class="callout pro"><b>Как это выглядит на BRAS</b>BRAS принимает QinQ-трафик и по паре S-VID/C-VID понимает, какой это дом и какой порт. Внутри поднимается PPPoE- или IPoE-сессия абонента. Вопрос «какие у абонента теги» — первый вопрос в заявке на L2-проблему.</div>`
    }
  ],
  cmds: [
    { g: 'MAC-таблица' },
    { c: 'show mac address-table dynamic [vlan N]', d: 'Изученные MAC-адреса', hw: 'display mac-address dynamic [vlan N]', jn: 'show ethernet-switching table' },
    { c: 'show mac address-table address H.H.H', d: 'Где (за каким портом) этот MAC', hw: 'display mac-address H-H-H', jn: 'show ethernet-switching table | match MAC' },
    { c: 'show mac address-table interface Gi0/1', d: 'Сколько и какие MAC за портом', hw: 'display mac-address interface GE0/0/1' },
    { c: 'clear mac address-table dynamic [vlan N | interface X]', d: 'Очистить динамические записи', hw: 'undo mac-address dynamic', jn: 'clear ethernet-switching table' },
    { c: 'mac address-table aging-time 600 [vlan N]', d: 'Время жизни записи (по умолчанию 300 с)', hw: 'mac-address aging-time 600' },
    { c: 'show ip arp [IP]', d: 'IP → MAC на L3-устройстве', hw: 'display arp | include IP', jn: 'show arp hostname IP' },
    { g: 'VLAN и порты' },
    { c: 'vlan 101\n name PTO', d: 'Создать VLAN', hw: 'vlan 101\n description PTO', jn: 'set vlans PTO vlan-id 101' },
    { c: 'show vlan brief', d: 'VLAN и access-порты в них', hw: 'display vlan', jn: 'show vlans' },
    { c: 'switchport mode access\nswitchport access vlan 101', d: 'Access-порт в VLAN 101', hw: 'port link-type access\nport default vlan 101', jn: 'set interfaces ge-0/0/1 unit 0 family ethernet-switching vlan members PTO' },
    { c: 'switchport mode trunk\nswitchport trunk allowed vlan 2,101-104\nswitchport nonegotiate', d: 'Транк с явным списком, без DTP', hw: 'port link-type trunk\nport trunk allow-pass vlan 2 101 to 104', jn: 'interface-mode trunk; vlan members [ ... ]' },
    { c: 'switchport trunk allowed vlan add 105', d: '<b>Добавить</b> VLAN к списку. Без add — замена списка!', hw: 'port trunk allow-pass vlan 105 (добавляет)', jn: 'set … vlan members 105 (добавляет)' },
    { c: 'switchport trunk native vlan 999', d: 'Native VLAN транка', hw: 'port trunk pvid vlan 999', jn: 'native-vlan-id 999' },
    { c: 'show interfaces trunk', d: 'Транки: allowed / active / forwarding', hw: 'display port vlan', jn: 'show ethernet-switching interface' },
    { c: 'show interfaces Gi0/1 switchport', d: 'Режим, access/native VLAN, DTP на порту', hw: 'display port vlan GE0/0/1 verbose' },
    { c: 'interface Vlan2\n ip address 172.16.1.2 255.255.255.0', d: 'SVI — L3-интерфейс VLAN (управление)', hw: 'interface Vlanif2', jn: 'set interfaces irb unit 2 family inet address' },
    { g: 'Соседи и защита' },
    { c: 'show cdp neighbors [detail]', d: 'Кто подключён к портам (Cisco)', hw: 'display lldp neighbor brief', jn: 'show lldp neighbors' },
    { c: 'lldp run / show lldp neighbors', d: 'Стандартный протокол соседства (многовендорный)', hw: 'lldp enable', jn: 'set protocols lldp interface all' },
    { c: 'storm-control broadcast level 5.00\nstorm-control action shutdown', d: 'Ограничение broadcast на порту', hw: 'storm-suppression broadcast 5', jn: 'storm-control default' },
    { c: 'switchport mode dot1q-tunnel', d: 'QinQ: добавлять S-tag ко всему, что пришло от клиента', hw: 'port link-type dot1q-tunnel', jn: 'vlan-tagging + stacked-vlan-tagging' }
  ],
  cards: [
    ['По какому адресу коммутатор <b>учит</b> MAC-таблицу, а по какому <b>пересылает</b>?', 'Учит по <b>Source MAC</b> входящего кадра (записывает порт и VLAN). Пересылает по <b>Destination MAC</b>.'],
    ['Что такое unknown unicast и что с ним делает коммутатор?', 'Кадр unicast, чей Dst MAC отсутствует в MAC-таблице для этого VLAN. Коммутатор флудит его во все порты VLAN, кроме входного.'],
    ['Ключ записи MAC-таблицы?', 'Пара <b>VLAN + MAC</b> → порт. Один MAC в разных VLAN — разные записи.'],
    ['MAC aging time по умолчанию на Cisco? ARP timeout на маршрутизаторе Cisco?', 'MAC aging — 300 секунд. ARP — 4 часа (14400 с).'],
    ['Почему разница таймеров ARP и MAC aging вызывает флуд?', 'Если хост почти молчит или ответы идут другим путём, маршрутизатор помнит его MAC (ARP 4 ч), а коммутатор уже забыл (5 мин). Кадры к хосту становятся unknown unicast и флудятся во все порты VLAN.'],
    ['Поля тега 802.1Q и их размеры?', 'TPID 16 бит (0x8100), PCP 3 бита (приоритет 802.1p), DEI 1 бит, VID 12 бит. Всего 4 байта.'],
    ['Диапазон пригодных VLAN ID и почему?', '1–4094. VID 0 — «приоритетный кадр без VLAN», 4095 зарезервирован.'],
    ['Что такое native VLAN?', 'VLAN, кадры которого идут по транку <b>без тега</b>. Нетегированный кадр, пришедший в транк, относится к native VLAN. По умолчанию VLAN 1.'],
    ['Чем опасен native VLAN mismatch?', 'Нетегированные кадры из native VLAN одной стороны попадают в другой VLAN на другой стороне: VLAN склеиваются, трафик утекает. CDP пишет %CDP-4-NATIVE_VLAN_MISMATCH.'],
    ['Разница «allowed» и «allowed and active» в show interfaces trunk?', 'allowed — разрешено командой. allowed and active — разрешено <b>и создано</b> на этом коммутаторе. VLAN не создан → по транку не пойдёт, даже если разрешён.'],
    ['Чем опасна команда <code>switchport trunk allowed vlan 105</code> на рабочем транке?', 'Она <b>заменяет</b> весь список на 105, остальные VLAN пропадают. Добавлять нужно через <code>allowed vlan add 105</code>.'],
    ['Почему DTP выключают и как?', 'Порт в dynamic-режиме можно уговорить стать транком и получить доступ ко всем VLAN. В проде режим задают явно (access/trunk) и ставят <code>switchport nonegotiate</code>.'],
    ['Чем опасен VTP?', 'Коммутатор с тем же доменом и бо́льшим revision number перезапишет базу VLAN всего домена. Используют transparent/off.'],
    ['Как найти порт абонента по IP?', 'ARP на шлюзе (IP→MAC) → <code>show mac address-table address MAC</code> на агрегации → если транк, CDP/LLDP-сосед → повторять до access-порта.'],
    ['Меняет ли коммутатор MAC-адреса в кадре внутри VLAN?', 'Нет. Src/Dst MAC неизменны по всему L2-пути, меняется только тег (добавляется или снимается). MAC переписывает маршрутизатор на каждом L3-хопе.'],
    ['Что такое MAC flapping и о чём говорит?', 'Один MAC попеременно изучается на двух разных портах. Признак L2-петли (или неправильной агрегации/двухпортового хоста). Петля за одним из этих портов.'],
    ['Признаки broadcast storm?', 'Скачок утилизации портов, рост broadcast-счётчиков, высокий CPU коммутаторов, отваливается управление, MAC flapping в логах.'],
    ['Что делает storm-control?', 'Ограничивает долю broadcast/multicast/unknown unicast на порту. При превышении отбрасывает лишнее или гасит порт (action shutdown) / шлёт trap.'],
    ['QinQ: что такое S-tag и C-tag?', 'S-tag (service, внешний, TPID 0x88A8 по стандарту) — тег провайдера. C-tag (customer, внутренний, 0x8100) — тег клиента. Даёт 4094×4094 комбинаций.'],
    ['VLAN на услугу vs VLAN на абонента?', 'N:1 — все абоненты услуги в одном VLAN (нужна изоляция портов и L2-защита). 1:1 — свой VLAN (часто QinQ) на абонента до BRAS: изоляция и учёт.'],
    ['Почему в QinQ важен MTU?', 'Каждый тег +4 байта. Если MTU транспорта не увеличен, полноразмерные пакеты (1500) молча теряются, а маленькие (ping) проходят.'],
    ['Что такое L2PT?', 'Layer 2 Protocol Tunneling — прозрачный пропуск служебных протоколов клиента (STP, CDP, LACP) через сеть провайдера в QinQ-туннеле.']
  ],
  quiz: [
    { q: 'Коммутатор получил кадр на Gi0/1 в VLAN 10 с Dst MAC, которого нет в таблице. Что он сделает?', o: ['Отбросит кадр', 'Отправит во все порты VLAN 10, кроме Gi0/1', 'Отправит во все порты всех VLAN', 'Отправит ARP-запрос'], a: 1, e: 'Unknown unicast флудится в пределах своего VLAN, кроме входного порта. ARP — это L3-механизм хоста, коммутатор его не инициирует.' },
    { q: 'Как коммутатор узнаёт, за каким портом находится хост?', o: ['По Dst MAC приходящих кадров', 'По Src MAC приходящих кадров', 'Из ARP-таблицы', 'Из CDP'], a: 1, e: 'Learning идёт только по адресу источника: «кадр от MAC X пришёл с порта P, значит X за P».' },
    { q: 'По выводу ниже: почему PC в VLAN 102 за этим транком недоступны?', code: 'SW1#show interfaces trunk\nPort   Vlans allowed on trunk\nGi0/2  2,101-102\nPort   Vlans allowed and active in management domain\nGi0/2  2,101', o: ['VLAN 102 заблокирован STP', 'VLAN 102 не создан на SW1', 'Native VLAN mismatch', 'Порт в режиме access'], a: 1, e: 'Разрешён, но не активен — значит VLAN 102 не существует в базе VLAN этого коммутатора. Нужно создать: vlan 102.' },
    { q: 'На транке были VLAN 2,101–104. Инженер ввёл «switchport trunk allowed vlan 105». Результат?', o: ['Разрешены 2,101–105', 'Разрешён только 105', 'Ошибка синтаксиса', 'Разрешены все VLAN'], a: 1, e: 'Без add команда заменяет список целиком. Классическая авария.' },
    { q: 'Сколько байт добавляет один тег 802.1Q и каким становится максимальный размер кадра?', o: ['2 байта, 1520', '4 байта, 1522', '4 байта, 1504', '8 байт, 1526'], a: 1, e: 'Тег — 4 байта (TPID + TCI). Кадр 1518 → 1522. MTU IP остаётся 1500.' },
    { q: 'В логе: «Host 0050.7966.6800 in vlan 101 is flapping between port Gi0/1 and port Gi0/3». Gi0/1 — аплинк, Gi0/3 — порт абонента, где этот MAC не живёт. Вероятная причина?', o: ['Неисправный кабель на аплинке', 'Петля за портом Gi0/3 (у абонента)', 'Хост сменил IP', 'Слишком маленький aging-time'], a: 1, e: 'Кадры хоста возвращаются через Gi0/3, значит за этим портом кольцо. Типично: абонент замкнул свой коммутатор.' },
    { q: 'Какие симптомы характерны для broadcast storm? (несколько)', o: ['Высокий CPU коммутаторов', 'Рост broadcast-счётчиков и загрузки портов', 'MAC flapping в логах', 'Рост CRC'], a: [0, 1, 2], e: 'CRC — признак физических проблем, а не петли.' },
    { q: 'Native VLAN на SW1 — 1, на SW2 — 999. Что произойдёт?', o: ['Транк не поднимется', 'Нетегированный трафик VLAN 1 SW1 попадёт в VLAN 999 на SW2', 'Все VLAN перестанут работать', 'Ничего, native VLAN локален'], a: 1, e: 'Транк работает, но VLAN «склеиваются» через нетегированные кадры. CDP сообщит о mismatch.' },
    { q: 'Сервер только принимает поток бэкапа и почти ничего не отправляет. Через ~5 минут коммутатор начинает флудить этот поток во все порты VLAN. Почему?', o: ['Петля', 'MAC сервера устарел в MAC-таблице, а ARP на шлюзе ещё жив', 'Слишком большой MTU', 'Неверный native VLAN'], a: 1, e: 'Asymmetric/unknown unicast flooding: MAC aging 300 с меньше ARP-таймера 4 ч. Шлюз шлёт кадры на MAC, которого коммутатор уже не помнит.' },
    { q: 'Зачем на транках ставят switchport nonegotiate?', o: ['Ускоряет STP', 'Выключает DTP, чтобы режим порта нельзя было изменить извне', 'Включает тегирование native VLAN', 'Отключает CDP'], a: 1, e: 'DTP — вектор атаки и источник сюрпризов. Режим задаётся явно.' },
    { q: 'Клиент QinQ жалуется: ping до офиса проходит, а сайты и файловые шары открываются через раз или виснут. Первое, что проверишь?', o: ['ARP-таблицу', 'MTU на пути (место под дополнительные теги)', 'Native VLAN', 'Aging-time'], a: 1, e: 'Маленькие пакеты проходят, большие (1500 + теги) молча отбрасываются. Признак нехватки MTU.' },
    { q: 'IP 172.16.3.13 → ARP на шлюзе дал MAC → на SW1 этот MAC за Gi0/2, а Gi0/2 — транк к SW3. Следующий шаг?', o: ['Это и есть порт абонента', 'Посмотреть MAC-таблицу на SW3 и продолжить до access-порта', 'Очистить ARP', 'Поставить порт в shutdown'], a: 1, e: 'Транк значит «хост где-то за соседом». Идём по следу до access-порта.' },
    { q: 'Что верно про MAC-адреса в кадре, который проходит через 3 коммутатора внутри одного VLAN?', o: ['Каждый коммутатор ставит свой Src MAC', 'Src и Dst MAC не меняются', 'Меняется только Dst MAC', 'MAC меняется на транках'], a: 1, e: 'Коммутаторы прозрачны для MAC. Меняется только тег 802.1Q.' },
    { q: 'Какой TPID у внешнего тега по стандарту 802.1ad?', o: ['0x8100', '0x88A8', '0x9100', '0x0800'], a: 1, e: '0x88A8. На практике часть платформ по умолчанию использует 0x8100 или 0x9100, при стыке это нужно согласовывать.' },
    { q: 'Почему у провайдеров VTP переводят в transparent/off? (несколько)', o: ['Коммутатор с большим revision может перезаписать базу VLAN домена', 'VTP не поддерживает больше 1005 VLAN в версиях 1–2', 'VTP шифрует трафик', 'VLAN создаются автоматизацией централизованно'], a: [0, 1, 3], e: 'Шифрованием VTP не занимается. Главный риск — перезапись базы VLAN.' },
    { q: 'За access-портом абонента в MAC-таблице 47 разных MAC. О чём это говорит?', o: ['Нормально для одного ПК', 'За портом стоит коммутатор или роутер в режиме моста (а может, и петля)', 'Порт неисправен', 'Это multicast'], a: 1, e: 'Один хост — один MAC (плюс, может, пара виртуальных). Десятки MAC — коммутатор у абонента. Это нарушение договора или признак петли или моста.' }
  ],
  und: [
    { q: 'Объясни, как коммутатор доставит первый кадр от PC1 к PC3 (оба в VLAN 101, разные коммутаторы, MAC-таблицы пусты), и что изменится для второго кадра.', a: '<p>Первый кадр: PC1 сначала шлёт ARP-запрос (broadcast). SW2 учит MAC PC1 на access-порту и флудит broadcast во все порты VLAN 101, включая транк (с тегом 101). SW1 учит MAC PC1 за транком к SW2 и флудит дальше. SW3 учит MAC PC1 за аплинком, снимает тег и отдаёт кадр PC3. PC3 отвечает unicast: теперь все коммутаторы знают, куда слать к PC1, и по пути изучают MAC PC3. Следующие кадры идут точечно, без флуда, пока записи не устареют (300 с).</p>', k: ['learning по Src MAC на каждом коммутаторе', 'flooding broadcast/unknown unicast в пределах VLAN', 'тег на транке, снятие на access', 'ответ unicast заполняет таблицы, дальше точечная пересылка'] },
    { q: 'Опиши алгоритм поиска абонента по IP в сети из 50 коммутаторов. Какие команды и где?', a: '<p>1) На шлюзе VLAN: <code>show ip arp IP</code> → MAC. 2) На ядре или агрегации: <code>show mac address-table address MAC</code> → порт. 3) Если порт транковый — <code>show cdp/lldp neighbors порт</code> → следующий коммутатор. 4) Повторять, пока порт не станет access. 5) Проверить порт: линк, ошибки, VLAN, число MAC за ним. Если записи нет — пингнуть хост со шлюза, чтобы освежить таблицы.</p>', k: ['ARP: IP→MAC', 'MAC-таблица: MAC→порт', 'CDP/LLDP: порт→сосед', 'идти до access-порта', 'освежить таблицы пингом, если пусто'] },
    { q: 'Почему «allowed vlan» без add — одна из самых дорогих ошибок у провайдера, и как от неё защищаются?', a: '<p>Команда заменяет весь список VLAN на транке. На магистральном транке это мгновенно отрезает всех абонентов на остальных VLAN. Защита: всегда <code>add/remove</code>, проверка через <code>show interfaces trunk</code> до и после, изменения под таймером отката (глава 1), шаблоны и автоматизация вместо ручного ввода, ревью change-заявки.</p>', k: ['замена, а не добавление', 'массовая авария', 'add/remove + проверка до/после', 'страховка и автоматизация'] },
    { q: 'Что такое QinQ, зачем он провайдеру и какие у него подводные камни?', a: '<p>Двойное тегирование: провайдер добавляет свой внешний S-tag поверх клиентского трафика (с тегами или без). Зачем: (1) VLAN на абонента без ограничения 4094 — S-VLAN на дом, C-VLAN на порт; (2) прозрачный L2-канал для клиента: его VLAN проходят как есть. Подводные камни: MTU (+4 байта на тег, иначе молча теряются большие пакеты), TPID (0x88A8 и 0x8100 при стыке вендоров), BPDU клиента (нужен L2PT или фильтрация), MAC-адреса всех клиентов в одном S-VLAN учатся на коммутаторах провайдера.</p>', k: ['S-tag поверх C-tag', 'масштаб VLAN и прозрачность', 'MTU', 'TPID', 'L2PT/BPDU'] },
    { q: 'Ты видишь сообщения MAC flapping и рост CPU на коммутаторе агрегации. Что делаешь по шагам и почему в таком порядке?', a: '<p>1) Определить затронутый VLAN и порты: логи MACFLAP, счётчики broadcast по портам. 2) Понять направление: какой из двух портов «лишний» для этого MAC. 3) Пройти по следу до источника (тот же алгоритм с MAC-таблицами, но таблицы «прыгают», поэтому ориентироваться на порты с аномальным входящим broadcast). 4) Погасить порт источника, чтобы восстановить сервис для всех. 5) Только потом разбираться с абонентом и включать защиту: BPDU guard, storm-control, loop detection. Порядок такой, потому что шторм кладёт весь сегмент, и каждая минута — это сотни абонентов без связи.</p>', k: ['найти VLAN и порты', 'определить направление петли', 'изолировать источник (shutdown)', 'потом анализ и защита'] }
  ],
  lab: {
    title: 'Лаба 2. VLAN, транки и поиск абонента',
    time: '≈ 2 часа',
    goal: `<p>Собрать L2-сеть «Лифт ми Ап»: ядро SW1 и два коммутатора доступа, VLAN 101 (ПТО) и 102 (ФЭО), сеть управления VLAN 2. Затем найти абонента по IP, понаблюдать за MAC-таблицами и починить четыре типичные L2-аварии.</p>`,
    topo: {
      w: 820, h: 400,
      zones: [{ x: 40, y: 220, w: 330, h: 170, label: 'этаж 1 · SW2', c: '#0891b2' }, { x: 450, y: 220, w: 330, h: 170, label: 'этаж 2 · SW3', c: '#0891b2' }],
      nodes: [
        { id: 'SW1', t: 'switch', x: 410, y: 80, label: 'SW1 (ядро)\nVlan2 172.16.1.1', role: 'коммутатор ядра / распределения' },
        { id: 'SW2', t: 'switch', x: 205, y: 260, label: 'SW2\nVlan2 172.16.1.2', role: 'коммутатор доступа' },
        { id: 'SW3', t: 'switch', x: 615, y: 260, label: 'SW3\nVlan2 172.16.1.3', role: 'коммутатор доступа' },
        { id: 'PC1', t: 'pc', x: 120, y: 350, label: 'PC1 · v101\n172.16.3.11', role: 'ПТО' },
        { id: 'PC2', t: 'pc', x: 290, y: 350, label: 'PC2 · v102\n172.16.4.12', role: 'ФЭО' },
        { id: 'PC3', t: 'pc', x: 530, y: 350, label: 'PC3 · v101\n172.16.3.13', role: 'ПТО' },
        { id: 'PC4', t: 'pc', x: 700, y: 350, label: 'PC4 · v102\n172.16.4.14', role: 'ФЭО' }
      ],
      links: [['SW1', 'Gi0/1', 'SW2', 'Gi0/0', 'trunk 2,101,102'], ['SW1', 'Gi0/2', 'SW3', 'Gi0/0', 'trunk 2,101,102'], ['PC1', 'eth0', 'SW2', 'Gi0/1'], ['PC2', 'eth0', 'SW2', 'Gi0/2'], ['PC3', 'eth0', 'SW3', 'Gi0/1'], ['PC4', 'eth0', 'SW3', 'Gi0/2']]
    },
    addr: [['SW1', 'Vlan2', '172.16.1.1/24'], ['SW2', 'Vlan2', '172.16.1.2/24'], ['SW3', 'Vlan2', '172.16.1.3/24'], ['PC1', 'VLAN 101', '172.16.3.11/24'], ['PC2', 'VLAN 102', '172.16.4.12/24'], ['PC3', 'VLAN 101', '172.16.3.13/24'], ['PC4', 'VLAN 102', '172.16.4.14/24']],
    init: {
      SW1: 'hostname SW1\nno ip domain-lookup\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SW2: 'hostname SW2\nno ip domain-lookup\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SW3: 'hostname SW3\nno ip domain-lookup\nline con 0\n logging synchronous\n exec-timeout 0 0',
      PC1: 'set pcname PC1\nip 172.16.3.11/24 172.16.3.1',
      PC2: 'set pcname PC2\nip 172.16.4.12/24 172.16.4.1',
      PC3: 'set pcname PC3\nip 172.16.3.13/24 172.16.3.1',
      PC4: 'set pcname PC4\nip 172.16.4.14/24 172.16.4.1'
    },
    pre: 'Коммутаторы стартуют с hostname, адреса у PC уже заданы. Порты vIOS-L2 по умолчанию находятся в режиме <i>dynamic auto</i> и в VLAN 1. Сначала посмотри на это: <code>show interfaces Gi0/1 switchport</code>.',
    tasks: [
      { t: 'Посмотри на «заводское» состояние', d: 'Прежде чем настраивать, выясни: в каком режиме порты, какой administrative/operational mode, есть ли транки, что в <code>show vlan brief</code>. Пингует ли PC1 PC3 прямо сейчас и почему?',
        hint: 'Все порты в VLAN 1, между коммутаторами dynamic auto ↔ dynamic auto (это access), значит всё в одном VLAN 1. PC1 и PC3 в одной подсети, поэтому пинг, скорее всего, пройдёт. А вот PC1 ↔ PC2 нет: разные подсети.',
        check: 'SW1#show interfaces Gi0/1 switchport\nSW1#show interfaces trunk\nSW1#show vlan brief\nPC1> ping 172.16.3.13' },
      { t: 'VLAN и access-порты', d: 'На всех трёх коммутаторах создай VLAN 2 (MGMT), 101 (PTO), 102 (FEO), 999 (NATIVE-UNUSED). На SW2 и SW3 переведи порты к PC в access нужных VLAN, с description.',
        check: 'SW2#show vlan brief\nSW2#show interfaces Gi0/1 switchport | include Mode|Access',
        sol: 'SW2(config)#vlan 2\nSW2(config-vlan)#name MGMT\nSW2(config-vlan)#vlan 101\nSW2(config-vlan)#name PTO\nSW2(config-vlan)#vlan 102\nSW2(config-vlan)#name FEO\nSW2(config-vlan)#vlan 999\nSW2(config-vlan)#name NATIVE-UNUSED\nSW2(config)#interface Gi0/1\nSW2(config-if)#description PC1-PTO\nSW2(config-if)#switchport mode access\nSW2(config-if)#switchport access vlan 101\nSW2(config)#interface Gi0/2\nSW2(config-if)#description PC2-FEO\nSW2(config-if)#switchport mode access\nSW2(config-if)#switchport access vlan 102\n! SW3 аналогично, SW1 — только VLAN' },
      { t: 'Транки «как в проде»', d: 'Транки SW1–SW2 и SW1–SW3: encapsulation dot1q, mode trunk, nonegotiate, allowed 2,101,102, native 999. Проверь все три списка в <code>show interfaces trunk</code>.',
        hint: 'На vIOS-L2 перед <code>switchport mode trunk</code> нужно <code>switchport trunk encapsulation dot1q</code>: образ поддерживает и ISL.',
        check: 'SW1#show interfaces trunk\nPC1> ping 172.16.3.13\nPC2> ping 172.16.4.14\nPC1> ping 172.16.4.12   ! не должен: другой VLAN и нет маршрутизатора',
        sol: 'SW1(config)#interface range Gi0/1 - 2\nSW1(config-if-range)#switchport trunk encapsulation dot1q\nSW1(config-if-range)#switchport mode trunk\nSW1(config-if-range)#switchport nonegotiate\nSW1(config-if-range)#switchport trunk native vlan 999\nSW1(config-if-range)#switchport trunk allowed vlan 2,101,102\n! SW2 и SW3: то же на Gi0/0' },
      { t: 'Сеть управления', d: 'Подними SVI Vlan2 на всех коммутаторах (адреса по таблице). Убедись, что SW2 пингует SW3 через SW1. Подумай: какой VLAN несёт эти пинги по транку и с тегом ли?',
        check: 'SW2#show ip interface brief | include Vlan\nSW2#ping 172.16.1.3',
        sol: 'SW1(config)#interface Vlan2\nSW1(config-if)#ip address 172.16.1.1 255.255.255.0\nSW1(config-if)#no shutdown\n! SW2: 172.16.1.2, SW3: 172.16.1.3\n! VLAN 2 не native → идёт с тегом 2' },
      { t: 'Наблюдай learning, flooding и aging', d: 'Очисти MAC-таблицы на всех коммутаторах. С PC1 сделай <b>один</b> пинг на PC3. Посмотри таблицы на SW1, SW2, SW3: какие MAC и за какими портами? Объясни, почему на каждом коммутаторе MAC PC1 записан именно за этим портом. Посмотри aging-time.',
        check: 'SW1#clear mac address-table dynamic\nPC1> ping 172.16.3.13 -c 1\nSW1#show mac address-table dynamic\nSW2#show mac address-table dynamic\nSW3#show mac address-table dynamic\nSW1#show mac address-table aging-time',
        hint: 'MAC VPCS имеют вид 0050.7966.68xx. У каждого PC его MAC видно по команде <code>show ip</code> в VPCS.' },
      { t: 'Найди абонента по IP', d: 'Представь, что не знаешь, где подключён 172.16.4.14. Шлюза пока нет, поэтому IP→MAC получи так: подними на SW1 временный SVI <code>Vlan102 172.16.4.1</code>, пингани 172.16.4.14 и посмотри <code>show ip arp</code>. Затем пройди по MAC-таблицам до порта. Используй CDP, чтобы узнать соседа за транком.',
        check: 'SW1#show ip arp 172.16.4.14\nSW1#show mac address-table address <MAC>\nSW1#show cdp neighbors Gi0/2\nSW3#show mac address-table address <MAC>\nSW3#show interfaces Gi0/2 switchport',
        sol: 'SW1(config)#interface Vlan102\nSW1(config-if)#ip address 172.16.4.1 255.255.255.0\nSW1(config-if)#no shutdown\nSW1#ping 172.16.4.14\nSW1#show ip arp 172.16.4.14       ! MAC PC4\nSW1#show mac address-table address 0050.7966.68xx   ! → Gi0/2 (транк)\nSW1#show cdp neighbors Gi0/2       ! → SW3\nSW3#show mac address-table address 0050.7966.68xx   ! → Gi0/2 access v102 — нашли\n! потом удали временный SVI: no interface Vlan102' },
      { t: 'Захват 802.1Q в Wireshark', d: 'В EVE: ПКМ по SW1 → Capture → Gi0/1. Пингани PC1 → PC3 и SW2 → SW3 (Vlan2). Найди в кадрах поле 802.1Q: TPID 0x8100, VID 101 и VID 2. Есть ли кадры без тега? (подсказка: CDP, DTP, STP — какие из них в native?)',
        hint: 'Нужен EVE-NG Windows Client Pack и Wireshark. Если их нет, пропусти задание, но вернись к нему позже: увидеть тег глазами полезно.' },
      { t: 'Безопасный порт абонента', d: 'На SW2 Gi0/3 (свободный) собери «абонентский» шаблон: access VLAN 101, nonegotiate, <code>spanning-tree portfast</code>, <code>spanning-tree bpduguard enable</code>, storm-control broadcast 5% с action trap. Почему именно эти команды — объяснит глава 4, но шаблон запоминай уже сейчас.',
        sol: 'SW2(config)#interface Gi0/3\nSW2(config-if)#description SUBSCRIBER-TEMPLATE\nSW2(config-if)#switchport mode access\nSW2(config-if)#switchport access vlan 101\nSW2(config-if)#switchport nonegotiate\nSW2(config-if)#spanning-tree portfast\nSW2(config-if)#spanning-tree bpduguard enable\nSW2(config-if)#storm-control broadcast level 5.00\nSW2(config-if)#storm-control action trap' }
    ],
    brk: [
      { t: 'После «маленького изменения» PC2 и PC4 (VLAN 102) перестали видеть друг друга, VLAN 101 работает', inj: 'SW1(config)#interface Gi0/2\nSW1(config-if)#switchport trunk allowed vlan 2,101', h: '<code>show interfaces trunk</code> на SW1 и SW3: сравни списки allowed с обеих сторон.', f: 'На SW1 с транка к SW3 убран VLAN 102. Так бывает, когда кто-то хотел «добавить» VLAN без add. Решение: <code>switchport trunk allowed vlan add 102</code>.' },
      { t: 'PC1 не видит PC3, хотя транки в порядке и VLAN 101 разрешён везде', inj: 'SW1(config)#no vlan 101', h: '<code>show interfaces trunk</code> на SW1: что в строке «allowed and active»? <code>show vlan brief</code>.', f: 'На SW1 удалён VLAN 101. Разрешён, но не активен, поэтому транзит через SW1 не идёт. Решение: <code>vlan 101</code> / <code>name PTO</code>.' },
      { t: 'В логах SW2 сообщения про native VLAN, а у PC «странные» утечки', inj: 'SW2(config)#interface Gi0/0\nSW2(config-if)#switchport trunk native vlan 1', h: 'Логи: <code>show logging | include NATIVE</code>. Сравни native VLAN в <code>show interfaces trunk</code> на обеих сторонах.', f: 'Native VLAN mismatch: 1 на SW2 и 999 на SW1. CDP пишет %CDP-4-NATIVE_VLAN_MISMATCH. Решение: одинаковый native VLAN 999 с обеих сторон.' },
      { t: 'PC3 «пропал»: линк есть, но никого не пингует', inj: 'SW3(config)#interface Gi0/1\nSW3(config-if)#switchport access vlan 102', h: '<code>show interfaces Gi0/1 switchport</code>, <code>show vlan brief</code> на SW3. В какой VLAN смотрит порт и какой адрес у PC3?', f: 'Порт PC3 переведён в VLAN 102, а адрес у PC3 из подсети VLAN 101. Хост в чужом широковещательном домене: ARP никто не отвечает. Решение: вернуть access vlan 101. На проде так выглядит ошибка монтажника или заявки.' },
      { t: '★ Петля: подключи второй линк SW2–SW3 и выключи STP', inj: '! в EVE: остановить SW2 и SW3, добавить линк SW2 Gi0/3 ↔ SW3 Gi0/3, запустить\n! на обоих: interface Gi0/3 / switchport mode trunk / switchport trunk encapsulation dot1q\n! затем на ВСЕХ: no spanning-tree vlan 1-4094', h: 'Смотри <code>show interfaces | include broadcast|rate</code>, <code>show logging | include FLAP</code>, <code>show processes cpu sorted</code>. Через сколько секунд начался шторм после первого broadcast?', f: 'Кольцо SW1–SW2–SW3 без STP: broadcast крутится бесконечно, CPU растёт, MAC flapping между аплинком и Gi0/3. Сервис восстанавливается выключением Gi0/3 (разрыв кольца) или возвратом STP (<code>spanning-tree vlan 1-4094</code>). Это ровно то, от чего защищает глава 4. После опыта убери линк.' }
    ],
    extra: '<p><b>QinQ на vIOS-L2.</b> Добавь SW4 «клиента» за SW2 Gi0/3. На SW2 Gi0/3 сделай <code>switchport access vlan 500</code> + <code>switchport mode dot1q-tunnel</code>. Посмотри захватом на транке SW1–SW2 двойной тег. Не все сборки vIOS-L2 корректно форвардят dot1q-tunnel: если не работает, это ограничение образа, а не твоя ошибка. Полноценно QinQ проверим в главе 12 на CSR.</p>'
  }
});
