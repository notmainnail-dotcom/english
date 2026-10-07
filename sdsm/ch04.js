COURSE.add({
  id: 'ch04',
  time: '≈ 6 часов',
  intro: `<p>Резервирование на L2 даёт петли, а петли кладут сеть за секунды (это ты видел в лабе 2). Глава о том, как с этим живут: STP и его быстрые версии, защита STP от абонентов и ошибок, агрегация каналов (LACP) и L2-безопасность доступа: DHCP snooping, Option 82, DAI. Цель — уметь <b>посчитать дерево руками</b> и <b>найти источник topology change</b> в живой сети.</p>`,
  goals: [
    'Вручную определить root bridge, root/designated/alternate порты в любой топологии и проверить себя выводом',
    'Объяснить, почему RSTP сходится за секунды (proposal/agreement, edge, alternate) и чем опасны topology change',
    'Настроить и обосновать защиту: PortFast/edge, BPDU Guard, Root Guard, Loop Guard, errdisable recovery',
    'Собрать LACP, понять хеширование и почему агрегат из 2×1G не даёт 2G одному потоку',
    'Объяснить DHCP snooping, Option 82, DAI и IP Source Guard и зачем они провайдеру'
  ],
  why: `Метро-Ethernet и сети доступа — это кольца и резервные аплинки. Шторм от абонента, «прыгающий» root или постоянный topology change, который флашит MAC-таблицы и вызывает флуд, — это реальные аварии. А LAG на аплинках стоит почти везде.`,
  refs: [
    { t: 'IEEE 802.1Q-2022', n: 'RSTP и MSTP теперь часть 802.1Q (бывшие 802.1w и 802.1s)' },
    { t: 'IEEE 802.1AX — Link Aggregation', n: 'LACP (бывший 802.3ad)' },
    { t: 'Cisco: Understanding Rapid Spanning Tree Protocol (802.1w)', u: 'https://www.cisco.com/c/en/us/support/docs/lan-switching/spanning-tree-protocol/24062-146.html' },
    { t: 'Cisco: Spanning Tree Protocol Enhancements using Loop Guard and BPDU Skew Detection', u: 'https://www.cisco.com/c/en/us/support/docs/lan-switching/spanning-tree-protocol/10596-84.html' },
    { t: 'R. Perlman — Interconnections (2nd ed.)', n: 'автор алгоритма STP о том, почему он устроен именно так' },
    { t: 'ITU-T G.8032 (ERPS)', n: 'кольцевая защита в метро-сетях провайдеров' }
  ],
  theory: [
    {
      id: 'algo', h: 'Алгоритм STP: посчитать дерево руками',
      html: `
<p>STP строит дерево без петель, выключая лишние порты. Всё решается сравнением <b>BPDU</b> по строгому порядку. Запомни четыре шага:</p>
<ol class="steps">
<li><b>Выборы root bridge.</b> Побеждает наименьший <b>Bridge ID</b> = priority (по умолчанию 32768) + <i>extended system ID</i> (номер VLAN) + MAC. Поэтому в VLAN 10 приоритет по умолчанию отображается как 32778. Priority задаётся шагами по 4096. При равных приоритетах побеждает наименьший MAC, то есть часто самый старый коммутатор. Поэтому root назначают руками.</li>
<li><b>Root port</b> на каждом некорневом коммутаторе — один порт с наименьшей <b>root path cost</b> (суммой стоимостей до root).</li>
<li><b>Designated port</b> — на каждом сегменте один порт, через который сегмент ближе всего к root. Все порты root bridge — designated.</li>
<li>Остальные порты — <b>blocking</b> (в RSTP — <i>alternate</i> или <i>backup</i>).</li></ol>
<p><b>Тай-брейки</b> при равенстве, строго по порядку: наименьшая root path cost → наименьший Bridge ID <i>отправителя</i> BPDU → наименьший Port ID <i>отправителя</i> (priority 128 + номер порта) → (редко) наименьший собственный Port ID.</p>
<table><tr><th>Скорость</th><th>Cost 802.1D-1998 (short)</th><th>Cost 802.1t (long)</th></tr>
<tr><td>10 Мбит/с</td><td>100</td><td>2 000 000</td></tr><tr><td>100 Мбит/с</td><td>19</td><td>200 000</td></tr>
<tr><td>1 Гбит/с</td><td>4</td><td>20 000</td></tr><tr><td>10 Гбит/с</td><td>2</td><td>2 000</td></tr><tr><td>100 Гбит/с</td><td>—</td><td>200</td></tr></table>
<p>Cisco по умолчанию использует short, Huawei и многие другие — long. При стыке разных вендоров ставь одинаковый метод: <code>spanning-tree pathcost method long</code>.</p>
<h3>Пример: треугольник</h3>
<p>SW1 (priority 4096) — root. SW2 и SW3 по 32768, MAC SW2 меньше. Все линки 1G (cost 4). SW2: root port к SW1 (cost 4). SW3: root port к SW1 (cost 4). Сегмент SW2–SW3: обе стороны имеют cost 4 до root, сравниваем Bridge ID отправителя. SW2 меньше, значит порт SW2 — designated, порт SW3 — <b>blocking (alternate)</b>.</p>
<pre class="cli">SW3#show spanning-tree vlan 10
VLAN0010
  Spanning tree enabled protocol rstp
  Root ID    Priority    4106
             Address     5000.0001.0000
             Cost        4
             Port        1 (GigabitEthernet0/1)
  Bridge ID  Priority    32778  (priority 32768 sys-id-ext 10)
             Address     5000.0003.0000
Interface           Role Sts Cost      Prio.Nbr Type
------------------- ---- --- --------- -------- ----------
Gi0/1               [[Root FWD]] 4         128.2    P2p
Gi0/2               [[Altn BLK]] 4         128.3    P2p
Gi1/0               Desg FWD 4         128.5    P2p Edge</pre>
<div class="callout pro"><b>Где ставить root</b>Root — коммутатор, через который должен идти трафик: ядро или агрегация, рядом со шлюзом (маршрутизатором или BRAS). Резервный root — второй коммутатор ядра. Иначе трафик пойдёт неоптимальным путём через доступ. В PVST можно балансировать: в одних VLAN root SW1, в других SW2.</div>`
    },
    {
      id: 'rstp', h: 'RSTP: почему секунды, а не 50 секунд',
      html: `
<p>Классический 802.1D переводит порт в forwarding по таймерам: max age 20 с + listening 15 с + learning 15 с — до 50 секунд простоя. RSTP (802.1w) работает <b>по соглашению</b>, а не по таймерам:</p>
<ul>
<li><b>Роли:</b> root, designated, <b>alternate</b> (готовый запасной путь к root — мгновенно становится root port при отказе основного), <b>backup</b> (запасной порт в тот же сегмент, редкость).</li>
<li><b>Состояния:</b> discarding, learning, forwarding.</li>
<li><b>Proposal/agreement:</b> на p2p-линке (full duplex) designated-порт предлагает себя, сосед синхронизирует свои порты (блокирует non-edge designated) и отвечает agreement. Порт сразу переходит в forwarding. Волна идёт от root к краям за доли секунды.</li>
<li><b>Edge-порт</b> (PortFast) — к конечному устройству: сразу forwarding. Если на него придёт BPDU, порт теряет статус edge.</li>
<li>BPDU шлёт <b>каждый</b> коммутатор каждые 2 с, и 3 пропущенных hello (6 с) означают, что соседа нет. В 802.1D только root генерировал BPDU.</li></ul>
<h3>Topology Change — скрытая боль</h3>
<p>Когда non-edge порт переходит в forwarding, RSTP рассылает <b>TC</b>. Все коммутаторы <b>флашат MAC-таблицы</b> на своих портах, кроме того, где пришло TC. Следующие кадры — unknown unicast, то есть <b>флуд</b>. Один TC — мелочь. Постоянные TC (флапающий порт без PortFast, «прыгающий» линк абонента) — это постоянный флуд и жалобы «сеть тормозит» по всему VLAN.</p>
<pre class="cli">SW1#show spanning-tree detail | include ieee|occurr|from|is exec
 VLAN0010 is executing the rstp compatible Spanning Tree protocol
  Number of topology changes [[1468]] last change occurred [[00:00:12]] ago
          from [[GigabitEthernet0/3]]</pre>
<p>Как найти источник: на коммутаторе смотришь, с какого порта пришёл последний TC, идёшь к соседу за этим портом и повторяешь. Последний коммутатор в цепочке покажет порт, который флапает. Обычно это абонентский порт без PortFast.</p>
<h3>Варианты STP</h3>
<table><tr><th></th><th>Деревьев</th><th>Где</th></tr>
<tr><td>STP / RSTP (802.1D / 802.1w)</td><td>одно на все VLAN (CST)</td><td>стандарт</td></tr>
<tr><td>PVST+ / Rapid-PVST+</td><td>по дереву на каждый VLAN</td><td>Cisco по умолчанию. 1000 VLAN = 1000 деревьев и много BPDU</td></tr>
<tr><td>MSTP (802.1s)</td><td>несколько инстансов, VLAN маппятся в инстансы</td><td>стандарт для больших сетей, по умолчанию у Huawei. Регион определяется <b>одинаковыми</b> name, revision и маппингом VLAN</td></tr></table>
<div class="callout warn"><b>MSTP: главная ошибка</b>Если у двух коммутаторов отличается хоть что-то из name, revision или таблицы VLAN→instance, это <b>разные регионы</b>. Между регионами работает только CIST, и балансировка по инстансам ломается. Конфигурацию MST меняют на всех коммутаторах региона одинаково, лучше шаблоном.</div>
<div class="callout pro"><b>Кольца у провайдера</b>В метро-кольцах вместо STP часто используют <b>ERPS (ITU-T G.8032)</b>: в кольце назначается RPL-порт (блокированный), переключение меньше 50 мс. У Huawei есть ещё RRPP и SEP, у Eltex и D-Link — ERPS. Принцип тот же: в кольце один блокированный порт, при обрыве он разблокируется.</div>`
    },
    {
      id: 'guard', h: 'Защита STP: что ставить и куда',
      html: `
<table><tr><th>Функция</th><th>Где</th><th>Что делает</th></tr>
<tr><td><b>PortFast / edge</b></td><td>порты к хостам и абонентам</td><td>сразу forwarding, при переходе не генерирует TC</td></tr>
<tr><td><b>BPDU Guard</b></td><td>все edge-порты</td><td>пришёл BPDU — порт в <b>err-disabled</b>. Абонент подключил свой коммутатор — порт гаснет, а не ломает дерево</td></tr>
<tr><td><b>BPDU Filter</b></td><td>почти никогда</td><td>не шлёт и не принимает BPDU. На порту с петлёй STP её <b>не увидит</b>. Опасно</td></tr>
<tr><td><b>Root Guard</b></td><td>designated-порты вниз, к доступу</td><td>если оттуда пришёл «лучший» BPDU (кто-то хочет стать root), порт уходит в <i>root-inconsistent</i> (блок), пока это не прекратится</td></tr>
<tr><td><b>Loop Guard</b></td><td>root и alternate порты (к ядру)</td><td>если BPDU перестали приходить (однонаправленный линк), порт не переходит в forwarding, а уходит в <i>loop-inconsistent</i></td></tr>
<tr><td><b>UDLD</b></td><td>оптические линки</td><td>обнаруживает однонаправленный линк (одно волокно не работает)</td></tr></table>
<pre class="cli">SW3(config)#spanning-tree portfast default              ! все access-порты — edge
SW3(config)#spanning-tree portfast bpduguard default     ! на всех edge — BPDU Guard
SW1(config)#interface Gi0/3
SW1(config-if)#spanning-tree guard root                 ! вниз, к доступу
SW1(config)#errdisable recovery cause bpduguard
SW1(config)#errdisable recovery interval 300
SW3#show interfaces status err-disabled
Port      Name    Status       Reason
Gi1/2             err-disabled [[bpduguard]]</pre>
<div class="callout info"><b>Почему однонаправленный линк — петля</b>Если на blocked-порт перестали приходить BPDU (одно волокно оборвано), STP решает, что соседа нет, и переводит порт в forwarding. А в другую сторону волокно работает, и петля готова. Loop Guard и UDLD закрывают именно эту дыру.</div>`
    },
    {
      id: 'lag', h: 'Агрегация: LACP, хеширование и его ограничения',
      html: `
<p>LAG (EtherChannel, Port-channel, Eth-Trunk у Huawei, ae у Juniper) объединяет несколько физических линков в один логический. STP видит его как <b>один</b> порт, поэтому не блокирует, а при отказе линка трафик переходит на оставшиеся без перестроения STP.</p>
<table><tr><th>Режим</th><th>Что это</th></tr>
<tr><td><code>mode active</code></td><td>LACP, сам инициирует</td></tr>
<tr><td><code>mode passive</code></td><td>LACP, только отвечает (passive+passive = агрегат не соберётся)</td></tr>
<tr><td><code>mode on</code></td><td>статика без протокола: опасно, при ошибке в кабелях будет петля или чёрная дыра</td></tr>
<tr><td><code>desirable/auto</code></td><td>PAgP, Cisco-only, в новых сетях не используется</td></tr></table>
<p>Все порты агрегата должны совпадать: скорость, дуплекс, режим (access/trunk), VLAN, native VLAN. Иначе порт будет <i>suspended</i>.</p>
<pre class="cli">SW1(config)#interface range Gi0/1 - 2
SW1(config-if-range)#channel-group 1 mode active
SW1(config)#interface Port-channel1
SW1(config-if)#switchport trunk encapsulation dot1q
SW1(config-if)#switchport mode trunk
SW1#show etherchannel summary
Flags:  D - down        P - bundled in port-channel
        I - stand-alone s - suspended
        S - Layer2      U - in use
Group  Port-channel  Protocol    Ports
------+-------------+-----------+---------------------------
1      Po1([[SU]])       LACP      Gi0/1([[P]])   Gi0/2([[P]])
SW1#show lacp neighbor</pre>
<h3>Хеширование: самая непонятая часть</h3>
<p>Трафик распределяется по линкам не покадрово, а <b>по потокам</b>: хеш от полей заголовка (MAC, IP, L4-порты) указывает линк. Все кадры одного потока идут по одному линку, иначе пакеты переупорядочились бы. Следствия:</p>
<ul><li>Один поток (одна TCP-сессия) никогда не получит больше скорости одного линка. 2×1G — это не «2G для одного скачивания».</li>
<li>Плохой выбор полей — перекос: при <code>src-mac</code> весь трафик от одного маршрутизатора уходит в один линк. Для L3-трафика нужен <code>src-dst-ip</code>, а лучше с L4-портами.</li>
<li><b>Поляризация</b>: если несколько уровней сети используют одинаковую хеш-функцию, трафик, уже отсортированный на первом уровне, на втором снова падает в один и тот же линк. Подробно — в главе Д1 (ECMP).</li></ul>
<pre class="cli">SW1(config)#port-channel load-balance src-dst-ip
SW1#show etherchannel load-balance
SW1#test etherchannel load-balance interface Po1 ip 10.0.0.1 10.0.0.2   ! какой линк выберется</pre>
<div class="callout pro"><b>LAG у провайдера</b>Аплинки доступа и агрегации — почти всегда LACP. Полезные настройки: <code>lacp rate fast</code> (LACPDU раз в секунду, отказ за 3 с), <b>min-links</b> (если в агрегате осталось меньше N линков, гасить весь агрегат, чтобы трафик ушёл по резервному пути, а не задохнулся). Агрегат на два разных коммутатора — это MLAG / vPC / стек / виртуальное шасси. Вариант для провайдерских PE — EVPN multihoming (глава 12.2).</div>`
    },
    {
      id: 'sec', h: 'L2-безопасность доступа: DHCP snooping, Option 82, DAI',
      html: `
<p>Абонентский сегмент враждебен по умолчанию: кто-то поднимет свой DHCP-сервер (часто случайно — роутер воткнули «не тем» портом), кто-то пропишет чужой IP, кто-то подделает ARP шлюза. Набор защит строится вокруг одной таблицы:</p>
<ol class="steps">
<li><b>DHCP snooping.</b> Порты делятся на <b>trusted</b> (аплинк к настоящему DHCP-серверу) и <b>untrusted</b> (абоненты). С untrusted отбрасываются серверные DHCP-сообщения (OFFER, ACK). Подставной DHCP-сервер обезврежен. Побочный продукт — <b>binding table</b>: MAC, IP, VLAN, порт, срок аренды каждого абонента.</li>
<li><b>Option 82</b> (DHCP Relay Agent Information). Коммутатор вставляет в DHCP-запрос, через какой коммутатор и порт пришёл запрос (Circuit ID, Remote ID). DHCP-сервер или BRAS по этому выдаёт адрес <b>конкретному порту</b> и привязывает договор к порту, а не к MAC. Основа IPoE-доступа у провайдеров.</li>
<li><b>DAI (Dynamic ARP Inspection).</b> ARP-пакеты с untrusted-портов сверяются с binding table: если «IP 10.0.0.1 — это мой MAC» шлёт не тот, кому выдан этот IP, пакет отбрасывается. Это защита от ARP-спуфинга (подмены шлюза, MITM).</li>
<li><b>IP Source Guard.</b> С порта пропускается только IP (и при желании MAC) из binding table. Хост со статически прописанным чужим IP не работает.</li></ol>
<pre class="cli">SW3(config)#ip dhcp snooping
SW3(config)#ip dhcp snooping vlan 10,20
SW3(config)#ip dhcp snooping information option          ! вставлять Option 82
SW3(config)#interface range Gi0/1 - 2
SW3(config-if-range)#ip dhcp snooping trust              ! аплинки к серверу
SW3(config)#interface Gi1/0
SW3(config-if)#ip dhcp snooping limit rate 10            ! защита от DHCP-флуда
SW3(config)#ip arp inspection vlan 10,20
SW3(config)#interface range Gi0/1 - 2
SW3(config-if-range)#ip arp inspection trust
SW3#show ip dhcp snooping binding
MacAddress          IpAddress     Lease(sec)  Type           VLAN  Interface
00:50:79:66:68:05   172.16.10.11  86210       dhcp-snooping   10   Gi1/0</pre>
<div class="callout warn"><b>Ловушка Option 82 на Cisco</b>Коммутатор с <code>information option</code> вставляет Option 82, но <b>giaddr = 0</b> (он не relay). Cisco IOS как DHCP-сервер такие пакеты по умолчанию отбрасывает. На сервере нужно <code>ip dhcp relay information trust-all</code> (или trust на интерфейсе), либо <code>no ip dhcp snooping information option</code> на коммутаторе. Встретишь в лабе.</div>
<h3>Port Security</h3>
<p>Ограничение числа MAC на порту (<code>maximum 2</code>), привязка (<code>sticky</code>), реакция на нарушение: <code>protect</code> (молча отбрасывать), <code>restrict</code> (отбрасывать и логировать), <code>shutdown</code> (err-disabled). У провайдера вместо этого часто используют лимит MAC на порту и в VLAN (защита от переполнения таблицы) и <b>port isolation</b>: абонентские порты не видят друг друга по L2, только аплинк.</p>`
    }
  ],
  cmds: [
    { g: 'STP' },
    { c: 'show spanning-tree [vlan N]', d: 'Root, свой Bridge ID, роли и состояния портов', hw: 'display stp brief', jn: 'show spanning-tree bridge / interface' },
    { c: 'show spanning-tree root', d: 'Кто root в каждом VLAN и через какой порт', hw: 'display stp root', jn: 'show spanning-tree bridge' },
    { c: 'show spanning-tree detail | include ieee|occurr|from', d: 'Счётчик topology change и откуда пришёл последний', hw: 'display stp tc-bpdu statistics', jn: 'show spanning-tree statistics' },
    { c: 'spanning-tree mode rapid-pvst | mst', d: 'Режим STP', hw: 'stp mode rstp | mstp', jn: 'set protocols rstp / mstp' },
    { c: 'spanning-tree vlan 10 root primary\nspanning-tree vlan 10 priority 4096', d: 'Назначить root (макрос или явный приоритет)', hw: 'stp root primary / stp priority 4096', jn: 'set protocols rstp bridge-priority 4k' },
    { c: 'spanning-tree vlan 10 cost 100 (на интерфейсе)', d: 'Изменить стоимость порта', hw: 'stp cost 100', jn: 'set protocols rstp interface X cost 100' },
    { c: 'spanning-tree pathcost method long', d: 'Длинные стоимости 802.1t (совместимость с другими вендорами)', hw: 'stp pathcost-standard dot1t' },
    { g: 'Защита' },
    { c: 'spanning-tree portfast [default]', d: 'Edge-порт', hw: 'stp edged-port enable', jn: 'edge' },
    { c: 'spanning-tree bpduguard enable\nspanning-tree portfast bpduguard default', d: 'BPDU Guard', hw: 'stp bpdu-protection (глобально)', jn: 'set protocols layer2-control bpdu-block interface X' },
    { c: 'spanning-tree guard root | loop', d: 'Root Guard / Loop Guard', hw: 'stp root-protection / stp loop-protection', jn: 'no-root-port / bpdu-timeout-action block' },
    { c: 'show interfaces status err-disabled', d: 'Порты в err-disabled и причина', hw: 'display error-down recovery' },
    { c: 'errdisable recovery cause bpduguard\nerrdisable recovery interval 300', d: 'Автоподъём через 5 минут', hw: 'error-down auto-recovery cause bpdu-protection interval 300' },
    { g: 'LACP' },
    { c: 'channel-group 1 mode active', d: 'Добавить порт в LACP-агрегат', hw: 'interface Eth-Trunk1 / mode lacp-static; eth-trunk 1 (на порту)', jn: 'set interfaces ge-0/0/1 gigether-options 802.3ad ae0' },
    { c: 'show etherchannel summary', d: 'Состояние агрегатов и портов (P, s, I, D)', hw: 'display eth-trunk 1', jn: 'show lacp interfaces' },
    { c: 'show lacp neighbor', d: 'LACP-партнёр: system ID, ключ, состояние', hw: 'display lacp statistics eth-trunk 1', jn: 'show lacp interfaces ae0 extensive' },
    { c: 'port-channel load-balance src-dst-ip', d: 'Поля для хеширования', hw: 'load-balance src-dst-ip', jn: 'set forwarding-options hash-key family inet layer-3 layer-4' },
    { c: 'lacp rate fast', d: 'LACPDU раз в секунду (отказ за 3 с)', hw: 'lacp timeout fast', jn: 'set interfaces ae0 aggregated-ether-options lacp periodic fast' },
    { g: 'L2-безопасность' },
    { c: 'ip dhcp snooping\nip dhcp snooping vlan 10\nip dhcp snooping trust', d: 'DHCP snooping и доверенный порт', hw: 'dhcp snooping enable / dhcp snooping trusted', jn: 'set vlans V forwarding-options dhcp-security' },
    { c: 'show ip dhcp snooping binding', d: 'Таблица привязок MAC-IP-порт', hw: 'display dhcp snooping user-bind all', jn: 'show dhcp-security binding' },
    { c: 'ip dhcp snooping information option', d: 'Вставлять Option 82', hw: 'dhcp option82 insert enable' },
    { c: 'ip arp inspection vlan 10', d: 'Dynamic ARP Inspection', hw: 'arp anti-attack check user-bind enable', jn: 'arp-inspection' },
    { c: 'ip verify source [port-security]', d: 'IP Source Guard', hw: 'ip source check user-bind enable', jn: 'ip-source-guard' },
    { c: 'switchport port-security maximum 2\nswitchport port-security violation restrict', d: 'Port Security', hw: 'port-security enable / port-security max-mac-num 2', jn: 'mac-limit 2' }
  ],
  cards: [
    ['Из чего состоит Bridge ID и как выбирается root?', 'Priority (по умолч. 32768, шаг 4096) + extended system ID (номер VLAN) + MAC. Root — наименьший Bridge ID.'],
    ['Почему в VLAN 10 приоритет показан как 32778?', 'Extended system ID: к priority 32768 прибавляется номер VLAN (10).'],
    ['Как выбирается root port?', 'Порт с наименьшей root path cost. При равенстве — наименьший Bridge ID отправителя, затем наименьший Port ID отправителя.'],
    ['Как выбирается designated port на сегменте?', 'Порт, через который сегмент ближе всего к root (наименьшая стоимость). Тай-брейк — Bridge ID, затем Port ID. Все порты root bridge — designated.'],
    ['Cost 1G и 10G в short и long методах?', 'Short: 1G = 4, 10G = 2. Long (802.1t): 1G = 20 000, 10G = 2 000.'],
    ['Почему классический STP сходится до 50 секунд?', 'Max age 20 с + listening 15 с + learning 15 с: переход по таймерам.'],
    ['Роли портов RSTP?', 'Root, Designated, Alternate (запасной путь к root), Backup (запасной порт в тот же сегмент). Disabled.'],
    ['Как RSTP переводит порт в forwarding быстро?', 'Proposal/agreement на p2p-линках: сосед синхронизирует порты и подтверждает, порт сразу forwarding. Edge-порты — сразу. Alternate мгновенно становится root port.'],
    ['Что происходит при Topology Change в RSTP?', 'TC рассылается по дереву, коммутаторы флашат MAC-таблицы на портах (кроме входного), начинается флуд unknown unicast до повторного обучения.'],
    ['Как найти источник частых TC?', '<code>show spanning-tree detail | include occurr|from</code> — порт, с которого пришёл TC → сосед → повторять до коммутатора, где TC генерирует локальный порт (обычно флапающий абонентский порт без PortFast).'],
    ['PVST+ vs MSTP?', 'PVST+: отдельное дерево на каждый VLAN (Cisco). MSTP: несколько инстансов, VLAN маппятся в инстансы, стандарт. Регион = одинаковые name + revision + маппинг.'],
    ['BPDU Guard vs BPDU Filter?', 'Guard: пришёл BPDU — порт в err-disabled (безопасно). Filter: BPDU не шлются и не принимаются, STP слеп к петле через порт (опасно).'],
    ['Root Guard: где и зачем?', 'На designated-портах вниз, к доступу. Если оттуда пришёл лучший BPDU (попытка стать root), порт уходит в root-inconsistent. Защищает выбранную топологию.'],
    ['Loop Guard: от чего защищает?', 'От однонаправленного линка: если на root/alternate-порт перестали приходить BPDU, порт не переходит в forwarding (loop-inconsistent).'],
    ['LACP active/passive/on — что соберётся?', 'active+active, active+passive — LACP соберётся. passive+passive — нет. on — статика без протокола, только с on на другой стороне.'],
    ['Почему один поток не получит 2 Гбит/с в LAG 2×1G?', 'Балансировка по потокам: хеш полей заголовка привязывает поток к одному линку, иначе нарушился бы порядок пакетов.'],
    ['Что должно совпадать на портах агрегата?', 'Скорость, дуплекс, режим (access/trunk), VLAN/allowed, native VLAN. Иначе порт suspended (флаг s).'],
    ['Что такое min-links в LAG и зачем?', 'Минимум активных линков: если меньше, агрегат гаснет целиком, и трафик уходит по резервному пути, а не задыхается в оставшемся линке.'],
    ['DHCP snooping: trusted и untrusted?', 'Trusted — к настоящему серверу, через них разрешены OFFER/ACK. Untrusted — абоненты: серверные DHCP-сообщения отбрасываются. Строится binding table.'],
    ['Что такое Option 82 и зачем провайдеру?', 'DHCP Relay Agent Information: коммутатор добавляет Circuit ID (порт, VLAN) и Remote ID (коммутатор). Сервер или BRAS выдаёт адрес и услугу по порту, а не по MAC.'],
    ['DAI — что проверяет?', 'ARP с untrusted-портов сверяется с DHCP snooping binding (IP ↔ MAC ↔ порт). Поддельный ARP (подмена шлюза) отбрасывается.'],
    ['Почему однонаправленный линк приводит к петле?', 'Blocked-порт перестаёт получать BPDU, считает соседа пропавшим и переходит в forwarding, а в другую сторону трафик идёт. Получается петля. Защита: Loop Guard, UDLD.'],
    ['Что такое ERPS (G.8032)?', 'Протокол защиты Ethernet-колец: один RPL-порт заблокирован, при обрыве разблокируется. Переключение < 50 мс. Применяется в метро-кольцах провайдеров вместо STP.']
  ],
  quiz: [
    { q: 'Три коммутатора, все priority 32768. MAC: SW1 …0003, SW2 …0001, SW3 …0002. Кто root?', o: ['SW1', 'SW2', 'SW3', 'Тот, что включили первым'], a: 1, e: 'Priority равны, побеждает наименьший MAC: SW2.' },
    { q: 'Что увидишь в show spanning-tree как приоритет коммутатора с priority 4096 в VLAN 20?', o: ['4096', '4116', '24576', '4097'], a: 1, e: '4096 + extended system ID 20 = 4116.' },
    { q: 'SW3 имеет два пути к root: через Gi0/1 (cost 4+4=8) и через Gi0/2 (cost 19). Какой порт root?', o: ['Gi0/2', 'Gi0/1', 'Оба', 'Решает MAC'], a: 1, e: 'Root port — наименьшая root path cost: 8 < 19.' },
    { q: 'В выводе show spanning-tree на порту «Altn BLK». Что это значит?', o: ['Порт выключен администратором', 'Запасной путь к root, заблокирован, мгновенно станет root port при отказе', 'Порт в err-disabled', 'Порт к хосту'], a: 1, e: 'Alternate в RSTP — готовая альтернатива root-порту.' },
    { q: 'Сеть «тормозит» во всём VLAN. В show spanning-tree detail: «Number of topology changes 1468, last change occurred 00:00:12 ago from Gi0/3». Что делать?', o: ['Перезагрузить коммутатор', 'Пойти к соседу за Gi0/3 и искать дальше источник TC (обычно флапающий порт без PortFast)', 'Выключить STP', 'Поставить BPDU Filter на Gi0/3'], a: 1, e: 'Частые TC флашат MAC-таблицы и вызывают флуд. Ищем источник по цепочке «from».' },
    { q: 'Абонент подключил свой коммутатор к порту с PortFast и BPDU Guard. Его коммутатор шлёт BPDU. Результат?', o: ['Порт станет root', 'Порт уйдёт в err-disabled', 'Порт станет alternate', 'Ничего'], a: 1, e: 'BPDU Guard гасит порт при приёме BPDU.' },
    { q: 'Где ставят Root Guard?', o: ['На портах к root', 'На designated-портах вниз, к коммутаторам доступа', 'На всех портах', 'Только на root bridge на root-портах'], a: 1, e: 'Root Guard не даёт устройству снизу стать root. На root-портах он сломал бы дерево.' },
    { q: 'Одно волокно в паре оборвалось, и на blocked-порт перестали приходить BPDU. Что спасёт от петли? (несколько)', o: ['Loop Guard', 'UDLD', 'PortFast', 'BPDU Filter'], a: [0, 1], e: 'Loop Guard не даст порту перейти в forwarding, UDLD обнаружит однонаправленность. PortFast и Filter сделают хуже.' },
    { q: 'Обе стороны агрегата настроены «channel-group 1 mode passive». Что будет?', o: ['LACP соберётся', 'Агрегат не соберётся: никто не инициирует LACP', 'Соберётся статически', 'Будет петля'], a: 1, e: 'Passive только отвечает. Нужен хотя бы один active.' },
    { q: 'LAG из 4×1G между коммутатором и маршрутизатором, балансировка src-mac. Весь трафик от маршрутизатора в один линк. Почему?', o: ['Сломан LACP', 'У всего трафика от маршрутизатора один src MAC, поэтому хеш одинаковый', 'Слишком много VLAN', 'Ошибка STP'], a: 1, e: 'Для маршрутизированного трафика хешируй по IP и L4: src-dst-ip или src-dst-mixed-ip-port.' },
    { q: 'В show etherchannel summary порт с флагом (s). Что проверить?', o: ['Кабель', 'Совпадение настроек порта с агрегатом: скорость, режим, VLAN', 'STP', 'DHCP snooping'], a: 1, e: 's — suspended: порт не совместим с агрегатом или LACP-партнёр другой.' },
    { q: 'В VLAN появился подставной DHCP-сервер, абоненты получают чужой шлюз. Что защитит?', o: ['DAI', 'DHCP snooping с trusted-аплинком', 'Port Security', 'BPDU Guard'], a: 1, e: 'Snooping отбрасывает DHCP OFFER/ACK с untrusted-портов.' },
    { q: 'Зачем провайдеру Option 82?', o: ['Шифровать DHCP', 'Сообщить серверу/BRAS коммутатор и порт абонента, чтобы выдать адрес и услугу по порту', 'Ускорить DHCP', 'Блокировать ARP'], a: 1, e: 'Circuit ID и Remote ID привязывают абонента к физическому порту (IPoE-авторизация).' },
    { q: 'Коммутатор с ip dhcp snooping information option, DHCP-сервер на Cisco IOS. Абоненты не получают адреса, в debug сервера «inconsistent relay information». Причина?', o: ['Нет маршрута', 'Option 82 с giaddr=0 отбрасывается сервером, нужен trust-all на сервере или выключить вставку Option 82', 'Неверный пул', 'DAI блокирует'], a: 1, e: 'Классическая ловушка: коммутатор не relay, но вставляет Option 82.' },
    { q: 'MSTP: на SW1 revision 1, на SW2 revision 2, имя и маппинг одинаковые. Что получится?', o: ['Один регион', 'Два разных региона, балансировка по инстансам между ними не работает', 'MSTP выключится', 'Петля'], a: 1, e: 'Регион определяется совпадением всех трёх параметров.' },
    { q: 'Почему PortFast нельзя включать на портах к другим коммутаторам? (несколько)', o: ['Порт сразу в forwarding и может создать временную петлю', 'Edge-порт не генерирует TC при переходе', 'Он отключает LACP', 'Он запрещает транк'], a: [0, 1], e: 'PortFast пропускает фазы проверки. С BPDU Guard он хотя бы погаснет при BPDU.' }
  ],
  und: [
    { q: 'Нарисуй (словами) треугольник SW1–SW2–SW3, где SW1 — root, все линки 1G, MAC SW2 < SW3. Определи роли всех шести портов и объясни каждый шаг выбора.', a: '<p>Root — SW1: все его порты designated (SW1→SW2, SW1→SW3). SW2: пути к root — прямой (cost 4) или через SW3 (8), root port — к SW1. SW3: аналогично root port к SW1. Сегмент SW2–SW3: стоимость до root у обоих 4, сравниваем Bridge ID отправителя, SW2 меньше. Порт SW2 в этом сегменте designated, порт SW3 — alternate (blocking). Итого 5 портов forwarding, 1 блокирован, петли нет.</p>', k: ['root — наименьший Bridge ID, все его порты designated', 'root port по наименьшей cost', 'designated на сегменте по cost, затем Bridge ID', 'один порт alternate/blocked'] },
    { q: 'Почему частые topology change вызывают «тормоза» по всему VLAN, и как ты найдёшь виновника?', a: '<p>Каждый TC заставляет коммутаторы сбросить изученные MAC-адреса. Пока таблицы не заполнятся заново, весь unicast к этим хостам флудится во все порты VLAN: нагрузка на линки и хосты, у абонентов «лаги». Поиск: <code>show spanning-tree detail</code> показывает число TC, когда был последний и с какого порта он пришёл. Идём к соседу за этим портом и повторяем, пока не найдём коммутатор, где источник — локальный порт (флапающий порт без PortFast, абонент с перезагружающимся роутером). Лечение: PortFast на абонентских портах (они не генерируют TC), исправить флапающий линк.</p>', k: ['TC → flush MAC → флуд', 'счётчик и порт «from»', 'идти по цепочке', 'PortFast на edge-портах'] },
    { q: 'Объясни, почему LAG 2×10G не даст абоненту скачать файл на 15 Гбит/с, и как правильно выбрать поля хеширования.', a: '<p>Балансировка идёт по потокам: хеш от полей заголовка выбирает один линк для всего потока, чтобы не перепутать порядок пакетов. Одна TCP-сессия всегда упирается в скорость одного линка (10G). Много потоков распределяются статистически. Поля выбирают так, чтобы у потоков было максимальное разнообразие: для маршрутизированного трафика MAC почти всегда одинаковы, поэтому нужны IP и порты L4 (src-dst-ip-port). На нескольких уровнях сети хеш желательно разный (seed), иначе поляризация.</p>', k: ['по потокам, не по пакетам', 'порядок пакетов', 'один поток = один линк', 'выбор полей: IP + L4', 'поляризация'] },
    { q: 'Расскажи, как DHCP snooping, Option 82 и DAI вместе защищают абонентскую сеть провайдера. Что каждый закрывает?', a: '<p>DHCP snooping закрывает подставные DHCP-серверы (серверные сообщения только с trusted-аплинка) и строит таблицу «кому какой IP выдан на каком порту». Option 82 сообщает серверу или BRAS, с какого коммутатора и порта пришёл запрос: адрес и тариф привязываются к порту (IPoE). Это и авторизация, и учёт. DAI проверяет ARP по таблице snooping, поэтому нельзя выдать себя за шлюз или за соседа (ARP-спуфинг, MITM). IP Source Guard дополнительно не пускает трафик с непрописанных IP. Всё держится на binding table.</p>', k: ['snooping: rogue DHCP + binding table', 'Option 82: порт → адрес и услуга', 'DAI: ARP-спуфинг', 'IPSG: чужие статические IP'] }
  ],
  lab: {
    title: 'Лаба 4. Дерево, агрегат и защита доступа',
    time: '≈ 2,5–3 часа',
    goal: `<p>Треугольник коммутаторов с двойным линком SW1–SW2, маршрутизатор R1 как шлюз и DHCP-сервер, абоненты и «абонентский коммутатор-нарушитель». Посчитать STP руками, перенести root, сравнить сходимость STP и RSTP, собрать LACP, включить всю защиту доступа и посмотреть, как она срабатывает.</p>`,
    topo: {
      w: 860, h: 470,
      nodes: [
        { id: 'R1', t: 'router', x: 120, y: 80, label: 'R1\nшлюз + DHCP', role: 'шлюз VLAN 10/20, DHCP-сервер' },
        { id: 'SW1', t: 'switch', x: 300, y: 130, label: 'SW1\n(ядро A)', role: 'ядро, root VLAN 10' },
        { id: 'SW2', t: 'switch', x: 640, y: 130, label: 'SW2\n(ядро B)', role: 'ядро, root VLAN 20' },
        { id: 'SW3', t: 'switch', x: 470, y: 300, label: 'SW3\n(доступ)', role: 'коммутатор доступа' },
        { id: 'PC1', t: 'pc', x: 330, y: 420, label: 'PC1 · v10\nDHCP', role: 'абонент VLAN 10' },
        { id: 'PC2', t: 'pc', x: 470, y: 420, label: 'PC2 · v20\nDHCP', role: 'абонент VLAN 20' },
        { id: 'SW4', t: 'switch', x: 660, y: 410, label: 'SW4\n«абонентский»', role: 'нарушитель: свой коммутатор абонента' }
      ],
      links: [
        ['R1', 'Gi0/0', 'SW1', 'Gi1/0', 'trunk'],
        ['SW1', 'Gi0/1', 'SW2', 'Gi0/1', 'Po1 (LACP)', { off: -12, k: 0.2 }], ['SW1', 'Gi0/2', 'SW2', 'Gi0/2', '', { off: 12, k: 0.2 }],
        ['SW1', 'Gi0/3', 'SW3', 'Gi0/1'], ['SW2', 'Gi0/3', 'SW3', 'Gi0/2'],
        ['PC1', 'eth0', 'SW3', 'Gi1/0'], ['PC2', 'eth0', 'SW3', 'Gi1/1'], ['SW4', 'Gi0/0', 'SW3', 'Gi1/2']
      ]
    },
    addr: [['R1', 'Gi0/0.10', '172.16.10.1/24 — DHCP пул 172.16.10.0/24'], ['R1', 'Gi0/0.20', '172.16.20.1/24 — DHCP пул 172.16.20.0/24'], ['PC1, PC2', 'eth0', 'по DHCP'], ['SW1/2/3', 'Vlan10', '172.16.10.251/.252/.253']],
    init: {
      R1: 'hostname R1\nno ip domain-lookup\ninterface Gi0/0\n no shutdown\ninterface Gi0/0.10\n encapsulation dot1Q 10\n ip address 172.16.10.1 255.255.255.0\ninterface Gi0/0.20\n encapsulation dot1Q 20\n ip address 172.16.20.1 255.255.255.0\nip dhcp excluded-address 172.16.10.1 172.16.10.10\nip dhcp excluded-address 172.16.10.250 172.16.10.254\nip dhcp excluded-address 172.16.20.1 172.16.20.10\nip dhcp pool V10\n network 172.16.10.0 255.255.255.0\n default-router 172.16.10.1\nip dhcp pool V20\n network 172.16.20.0 255.255.255.0\n default-router 172.16.20.1\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SW1: 'hostname SW1\nno ip domain-lookup\nvlan 10\nvlan 20\ninterface range Gi0/1 - 3\n switchport trunk encapsulation dot1q\n switchport mode trunk\ninterface Gi1/0\n switchport trunk encapsulation dot1q\n switchport mode trunk\ninterface Vlan10\n ip address 172.16.10.251 255.255.255.0\n no shutdown\nspanning-tree mode pvst\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SW2: 'hostname SW2\nno ip domain-lookup\nvlan 10\nvlan 20\ninterface range Gi0/1 - 3\n switchport trunk encapsulation dot1q\n switchport mode trunk\ninterface Vlan10\n ip address 172.16.10.252 255.255.255.0\n no shutdown\nspanning-tree mode pvst\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SW3: 'hostname SW3\nno ip domain-lookup\nvlan 10\nvlan 20\ninterface range Gi0/1 - 2\n switchport trunk encapsulation dot1q\n switchport mode trunk\ninterface Gi1/0\n switchport mode access\n switchport access vlan 10\ninterface Gi1/1\n switchport mode access\n switchport access vlan 20\ninterface Gi1/2\n switchport mode access\n switchport access vlan 10\ninterface Vlan10\n ip address 172.16.10.253 255.255.255.0\n no shutdown\nspanning-tree mode pvst\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SW4: 'hostname SW4\nno ip domain-lookup\nline con 0\n logging synchronous\n exec-timeout 0 0',
      PC1: 'set pcname PC1\nip dhcp', PC2: 'set pcname PC2\nip dhcp'
    },
    pre: 'VLAN, транки и DHCP уже настроены. STP в классическом режиме PVST (802.1D), приоритеты по умолчанию. Если PC не получили адрес при старте, выполни в VPCS <code>ip dhcp</code> вручную после того, как STP сойдётся (~30–50 с).',
    tasks: [
      { t: 'Предскажи дерево, потом проверь', d: 'Не глядя в STP, узнай MAC каждого коммутатора (<code>show spanning-tree | include Address</code> в части Bridge ID или <code>show version</code>). На бумаге определи root в VLAN 10 и роли <b>всех</b> портов (включая пару SW1–SW2). Потом сверь с <code>show spanning-tree vlan 10</code> на каждом коммутаторе.',
        hint: 'Между SW1 и SW2 два параллельных линка с одинаковой стоимостью: здесь решает Port ID отправителя (128.2 против 128.3).',
        check: 'SW1#show spanning-tree vlan 10\nSW2#show spanning-tree vlan 10\nSW3#show spanning-tree vlan 10\nSW3#show spanning-tree root' },
      { t: 'Назначь root осознанно и разнеси VLAN', d: 'SW1 — root для VLAN 10 и secondary для VLAN 20; SW2 — наоборот. Проверь, что трафик PC1 и PC2 теперь идёт разными аплинками SW3 (какой порт SW3 blocked в каждом VLAN?).',
        check: 'SW3#show spanning-tree vlan 10 | begin Interface\nSW3#show spanning-tree vlan 20 | begin Interface',
        sol: 'SW1(config)#spanning-tree vlan 10 root primary\nSW1(config)#spanning-tree vlan 20 root secondary\nSW2(config)#spanning-tree vlan 20 root primary\nSW2(config)#spanning-tree vlan 10 root secondary' },
      { t: 'Замерь сходимость STP против RSTP', d: 'С PC1 запусти <code>ping 172.16.10.1 -t</code>. На SW3 выключи текущий root port для VLAN 10. Посчитай потерянные пинги. Верни порт. Переведи все коммутаторы в <code>rapid-pvst</code> и повтори. Запиши обе цифры.',
        hint: 'В VPCS <code>ping IP -t</code> пингует бесконечно, остановка — Ctrl+C. Классический STP даст порядка 30–50 потерянных пингов, RSTP — 0–2.',
        check: 'SW3#show spanning-tree vlan 10 | include Root|Altn\nSW3(config)#interface Gi0/1\nSW3(config-if)#shutdown',
        sol: 'SW1(config)#spanning-tree mode rapid-pvst\nSW2(config)#spanning-tree mode rapid-pvst\nSW3(config)#spanning-tree mode rapid-pvst' },
      { t: 'Посмотри topology change', d: 'После перехода на RSTP пощёлкай <code>shutdown/no shutdown</code> на Gi1/0 (PC1) <b>без</b> PortFast. На SW1 найди, сколько было TC и откуда. Затем включи <code>spanning-tree portfast</code> на Gi1/0 и Gi1/1 и повтори: генерирует ли теперь порт TC?',
        check: 'SW1#show spanning-tree detail | include ieee|occurr|from\nSW3#show spanning-tree detail | include occurr|from' },
      { t: 'LACP между SW1 и SW2', d: 'Объедини Gi0/1–2 SW1↔SW2 в Port-channel1 по LACP (active с обеих сторон). Убедись, что STP видит один порт Po1, а при выключении одного линка ни один пинг не теряется. Поставь балансировку src-dst-ip.',
        check: 'SW1#show etherchannel summary\nSW1#show lacp neighbor\nSW1#show spanning-tree vlan 10 | include Po\nSW1#show etherchannel load-balance',
        sol: 'SW1(config)#interface range Gi0/1 - 2\nSW1(config-if-range)#channel-group 1 mode active\nSW1(config)#interface Port-channel1\nSW1(config-if)#switchport trunk encapsulation dot1q\nSW1(config-if)#switchport mode trunk\nSW1(config)#port-channel load-balance src-dst-ip\n! SW2 — то же самое' },
      { t: 'Защита доступа от абонентского коммутатора', d: 'На SW3: PortFast + BPDU Guard на всех access-портах (глобально через default), Root Guard на SW1 Gi0/3 и SW2 Gi0/3. Включи порт Gi0/0 на SW4 (это «абонент воткнул свой свитч»), а на SW4 поставь <code>spanning-tree vlan 1-100 priority 0</code>. Что произошло с Gi1/2 на SW3? Включи errdisable recovery на 60 секунд и понаблюдай.',
        check: 'SW3#show interfaces status err-disabled\nSW3#show logging | include BPDU\nSW3#show errdisable recovery',
        sol: 'SW3(config)#spanning-tree portfast default\nSW3(config)#spanning-tree portfast bpduguard default\nSW1(config)#interface Gi0/3\nSW1(config-if)#spanning-tree guard root\nSW2(config)#interface Gi0/3\nSW2(config-if)#spanning-tree guard root\nSW3(config)#errdisable recovery cause bpduguard\nSW3(config)#errdisable recovery interval 60' },
      { t: 'DHCP snooping и Option 82', d: 'На SW3 включи DHCP snooping для VLAN 10 и 20, аплинки trusted. Переполучи адреса на PC (<code>ip dhcp -r</code> в VPCS). Не получают? Разберись с Option 82 (см. ловушку в теории) и почини правильным способом. Посмотри binding table.',
        hint: 'Вариант 1: на R1 <code>ip dhcp relay information trust-all</code>. Вариант 2: на SW3 <code>no ip dhcp snooping information option</code>. Подумай, какой из них выбрал бы провайдер, которому нужен Option 82.',
        check: 'SW3#show ip dhcp snooping\nSW3#show ip dhcp snooping binding\nR1#show ip dhcp binding\nR1#debug ip dhcp server packet',
        sol: 'SW3(config)#ip dhcp snooping\nSW3(config)#ip dhcp snooping vlan 10,20\nSW3(config)#interface range Gi0/1 - 2\nSW3(config-if-range)#ip dhcp snooping trust\nR1(config)#ip dhcp relay information trust-all\nPC1> ip dhcp -r' },
      { t: 'DAI: защитись от подмены шлюза', d: 'Включи <code>ip arp inspection vlan 10,20</code> на SW3, аплинки trust. Проверь, что PC с DHCP-адресами работают. Затем на PC1 пропиши статикой чужой адрес <code>ip 172.16.10.1/24</code> (адрес шлюза!) и посмотри логи DAI.',
        check: 'SW3#show ip arp inspection statistics vlan 10\nSW3#show logging | include ARP',
        sol: 'SW3(config)#ip arp inspection vlan 10,20\nSW3(config)#interface range Gi0/1 - 2\nSW3(config-if-range)#ip arp inspection trust\n! после опыта верни PC1 на ip dhcp' }
    ],
    brk: [
      { t: 'Все PC в VLAN 10 потеряли связь секунд на 30 и стали ходить «странным» путём через SW2', inj: 'SW3(config)#spanning-tree vlan 10 priority 0', h: '<code>show spanning-tree root</code> на всех коммутаторах. Кто root в VLAN 10? Почему Root Guard не спас?', f: 'SW3 объявил себя root (priority 0) и стал root bridge, всё дерево перестроилось через доступ. Root Guard стоит на SW1 и SW2 Gi0/3 и должен был заблокировать эти порты (root-inconsistent): проверь <code>show spanning-tree inconsistentports</code>. Если Root Guard не настроен, root «уехал». Верни priority и включи Root Guard.' },
      { t: 'Port-channel1 поднят, но в нём работает только один линк', inj: 'SW2(config)#interface Gi0/2\nSW2(config-if)#switchport trunk allowed vlan 10', h: '<code>show etherchannel summary</code> — флаги портов. <code>show interfaces Gi0/2 switchport</code> на обеих сторонах.', f: 'На SW2 Gi0/2 конфиг отличается от Port-channel (allowed vlan), порт suspended (s). Порты агрегата должны быть идентичны. Настройки VLAN делаются на интерфейсе Port-channel, а не на членах.' },
      { t: 'PC1 перестал получать адрес по DHCP после «наведения порядка» на SW3', inj: 'SW3(config)#interface Gi0/1\nSW3(config-if)#no ip dhcp snooping trust', h: '<code>show ip dhcp snooping</code> — какие порты trusted? Через какой аплинк сейчас STP-путь к R1 в VLAN 10?', f: 'Аплинк, через который реально идёт DHCP (root port для VLAN 10), перестал быть trusted: DHCP OFFER от R1 отбрасывается. Trusted должны быть <b>все</b> аплинки, ведь путь может смениться при перестроении STP.' },
      { t: 'После «ускорения» на одном порту между SW1 и SW3 периодически шторм', inj: 'SW1(config)#interface Gi0/3\nSW1(config-if)#spanning-tree bpdufilter enable\nSW3(config)#interface Gi0/1\nSW3(config-if)#spanning-tree bpdufilter enable', h: 'Сравни роли портов на SW3 с ожидаемыми. Видит ли SW3 BPDU от SW1? Есть ли сейчас blocked-порт в треугольнике?', f: 'BPDU Filter на линке SW1–SW3: коммутаторы не видят BPDU друг друга, STP думает, что петли нет, и все порты forwarding. Получается петля. BPDU Filter на межкоммутаторных линках не ставят никогда.' }
    ],
    extra: '<p><b>MSTP.</b> Переведи все три коммутатора в <code>spanning-tree mode mst</code>: регион <code>LIFT</code>, revision 1, instance 1 — VLAN 10, instance 2 — VLAN 20. Root instance 1 — SW1, instance 2 — SW2. Затем на SW3 поменяй revision на 2 и посмотри <code>show spanning-tree mst</code>: что значит «Boundary»?</p>'
  }
});
