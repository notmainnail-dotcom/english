COURSE.add({
  id: 'ch05',
  time: '≈ 5–6 часов',
  intro: `<p>«Лифт ми Ап» выходит в интернет. Нужно разрешить нужное, запретить лишнее и как-то уместить офис в несколько публичных адресов. Как это делается в офисе, ты в целом знаешь. Здесь акцент на провайдерскую сторону: как ACL обрабатываются на самом деле, как защищают <b>само</b> оборудование (iACL, CoPP), как фильтруют подделку адресов (uRPF, BCP38) и как работает <b>CGNAT</b>, через который сегодня выходят в сеть миллионы абонентов.</p>`,
  goals: [
    'Безошибочно писать wildcard-маски и предсказывать результат ACL: порядок, неявный deny, in/out, счётчики',
    'Защищать устройство и инфраструктуру: ACL на VTY, infrastructure ACL, основы CoPP',
    'Объяснить uRPF strict/loose и BCP38 и решить, где их включать',
    'Настроить static NAT, PAT и проброс портов и разобрать порядок операций NAT и маршрутизации',
    'Объяснить CGNAT (100.64.0.0/10, NAT444), port block allocation и требования к логированию',
    'Понимать, что ломает NAT (ALG, IPsec, входящие соединения, hairpin) и как это диагностировать'
  ],
  why: `Через ACL у провайдера проходит всё: фильтры на стыках с клиентами и пирами, защита control plane, политики маршрутизации (BGP prefix-list и route-map работают по той же логике сопоставления). CGNAT — повседневная реальность ШПД: из-за него «не работает проброс портов», «забанили в игре весь подъезд» и приходят запросы правоохранителей «кто был за адресом в 14:03:12».`,
  refs: [
    { t: 'W. Odom — CCNA 200-301 OCG Vol. 2', n: 'гл. 1–3 (ACL), гл. 10 (NAT). Книга у тебя в папке «английский»' },
    { t: 'RFC 2827 / BCP 38 — Network Ingress Filtering', u: 'https://www.rfc-editor.org/rfc/rfc2827' },
    { t: 'RFC 3704 / BCP 84 — Ingress Filtering for Multihomed Networks (uRPF)', u: 'https://www.rfc-editor.org/rfc/rfc3704' },
    { t: 'RFC 6598 — 100.64.0.0/10 Shared Address Space', u: 'https://www.rfc-editor.org/rfc/rfc6598' },
    { t: 'RFC 6888 — Common Requirements for Carrier-Grade NATs', u: 'https://www.rfc-editor.org/rfc/rfc6888' },
    { t: 'Cisco: NAT Order of Operation', u: 'https://www.cisco.com/c/en/us/support/docs/ip/network-address-translation-nat/6209-5.html' },
    { t: 'Cisco: Control Plane Policing Implementation Best Practices', u: 'https://www.cisco.com/c/en/us/about/security-center/copp-best-practices.html' }
  ],
  theory: [
    {
      id: 'acl', h: 'ACL: как они проверяются на самом деле',
      html: `
<ul><li>Правила проверяются <b>сверху вниз до первого совпадения</b>. Дальше не смотрят.</li>
<li>В конце каждого ACL есть невидимое <code>deny any</code> (<code>deny ip any any</code>). ACL из одних deny запрещает <b>всё</b>.</li>
<li>На интерфейс — один ACL на направление (in/out) на протокол. <b>in</b> — до решения маршрутизации, <b>out</b> — после.</li>
<li>ACL с <code>out</code> <b>не фильтрует</b> трафик, который сгенерировал сам маршрутизатор (его ping, OSPF hello, SNMP).</li>
<li>Пустой (несуществующий) ACL, применённый к интерфейсу, на IOS пропускает всё. На других платформах бывает наоборот, не полагайся на это.</li></ul>
<h3>Wildcard: «0 — проверять, 1 — всё равно»</h3>
<table><tr><th>Что нужно</th><th>Запись</th></tr>
<tr><td>один хост</td><td><code>host 172.16.6.66</code> = <code>172.16.6.66 0.0.0.0</code></td></tr>
<tr><td>сеть /24</td><td><code>172.16.5.0 0.0.0.255</code></td></tr>
<tr><td>сеть /21</td><td><code>172.16.16.0 0.0.7.255</code> (wildcard = 255.255.255.255 − маска)</td></tr>
<tr><td>все чётные адреса в 10.0.0.0/24</td><td><code>10.0.0.0 0.0.0.254</code> (последний бит должен быть 0)</td></tr>
<tr><td>третий октет 1–3 во всех /16 — не сеть, а «узор»</td><td>wildcard необязательно непрерывный: такое умеют только wildcard, не маски</td></tr></table>
<h3>Стандартные и расширенные</h3>
<p><b>Standard</b> (1–99, 1300–1999 или именованные) проверяют только источник. <b>Extended</b> (100–199, 2000–2699) — протокол, источник, назначение, порты, флаги (<code>established</code>), DSCP, фрагменты. Правило размещения: extended ближе к источнику (лишний трафик отрезается сразу), standard ближе к получателю (иначе отрежешь источник от всего остального).</p>
<pre class="cli">ip access-list extended SERVERS-OUT
 10 permit tcp any host 172.16.0.2 eq www
 20 permit tcp host 172.16.4.123 host 172.16.0.2 eq telnet
 30 permit icmp any 172.16.0.0 0.0.0.255 echo
 40 permit icmp any 172.16.0.0 0.0.0.255 echo-reply
 50 deny ip any any log
interface Gi0/0.3
 ip access-group SERVERS-OUT out
R1#show access-lists SERVERS-OUT
Extended IP access list SERVERS-OUT
    10 permit tcp any host 172.16.0.2 eq www [[(124 matches)]]
    20 permit tcp host 172.16.4.123 host 172.16.0.2 eq telnet (8 matches)
R1(config)#ip access-list extended SERVERS-OUT
R1(config-ext-nacl)#15 permit tcp host 172.16.4.123 host 172.16.0.2 eq 22   ! вставка между 10 и 20
R1(config-ext-nacl)#no 30                                                  ! удалить строку
R1(config)#ip access-list resequence SERVERS-OUT 10 10</pre>
<div class="callout warn"><b>Stateless</b>ACL на маршрутизаторе не помнит соединения. Если разрешил клиенту ходить на сервер, <b>ответы</b> сервера тоже должны пройти ACL в обратном направлении. Решения: <code>established</code> (пропускает TCP с ACK/RST, то есть «не начало сессии»), reflexive ACL или полноценный stateful-фаервол (ZBF, ASA). Для UDP и ICMP <code>established</code> не работает.</div>
<h3>Object-group: когда правил сотни</h3>
<pre class="cli">object-group network ADMINS
 host 172.16.4.123
 host 172.16.16.222
object-group service MGMT-PORTS
 tcp eq 22
 tcp eq 443
ip access-list extended TO-SERVERS
 permit object-group MGMT-PORTS object-group ADMINS host 172.16.0.2</pre>
<div class="callout info"><b>Та же логика в маршрутизации</b><code>prefix-list</code> и <code>route-map</code> в BGP (глава 8) работают так же: проверка сверху вниз, первое совпадение, неявный deny в конце. Кто хорошо понял ACL, наполовину понял политики BGP.</div>`
    },
    {
      id: 'infra', h: 'Защита самого устройства: iACL и CoPP',
      html: `
<p>Трафик делится на три плоскости:</p>
<ul><li><b>Data plane</b> — транзит: пакеты абонентов, которые устройство просто пересылает. Обрабатываются аппаратно.</li>
<li><b>Control plane</b> — протоколы самого устройства: OSPF, BGP, LDP, BFD, ARP. Обрабатываются CPU.</li>
<li><b>Management plane</b> — SSH, SNMP, NTP, syslog к устройству.</li></ul>
<p>CPU маршрутизатора слабее его ASIC в сотни раз. Флуд пакетов, адресованных <b>самому</b> маршрутизатору (на его интерфейсы или loopback), может положить CPU, а вместе с ним упадут BGP и OSPF. Это авария на весь узел.</p>
<h3>Infrastructure ACL (iACL)</h3>
<p>На внешних стыках (клиенты, пиры, транзит) ставится ACL на вход: «к адресам моей инфраструктуры (loopback, p2p-линки) пропускать только то, что нужно, и только от тех, от кого нужно». Например: BGP только от IP пира, ICMP с ограничением, остальное к инфраструктуре — deny. Транзитный трафик абонентов при этом не трогаем.</p>
<pre class="cli">ip access-list extended IACL-FROM-CUSTOMER
 permit tcp host 203.0.113.1 host 203.0.113.2 eq bgp        ! BGP только от пира
 permit tcp host 203.0.113.1 eq bgp host 203.0.113.2
 permit icmp any 10.255.0.0 0.0.255.255 echo
 deny   ip any 10.255.0.0 0.0.255.255                       ! остальное к loopback'ам — нет
 deny   ip any 10.254.0.0 0.0.255.255                       ! и к p2p ядра
 permit ip any any                                          ! транзит абонентов — да</pre>
<h3>CoPP — Control Plane Policing</h3>
<p>Политика QoS (глава 15), применённая к самому control plane: трафик к CPU делится на классы (маршрутизационные протоколы, управление, ICMP, прочее), и каждому классу задаётся лимит скорости. BGP-сессии продолжают жить, даже если кто-то льёт миллион пингов в loopback.</p>
<pre class="cli">class-map match-all COPP-ICMP
 match access-group name ACL-ICMP
policy-map COPP
 class COPP-ICMP
  police 64000 conform-action transmit exceed-action drop
control-plane
 service-policy input COPP</pre>
<div class="callout pro"><b>У провайдера</b>На PE- и BNG-устройствах CoPP (у Juniper — lo0 filter + policer, у Huawei — cpu-defend policy) обязателен. «Сломался BGP с пиром во время DDoS на клиента» — классическая история узла без CoPP: флуд долетел до CPU через ARP или ICMP Unreachable.</div>`
    },
    {
      id: 'urpf', h: 'Анти-спуфинг: uRPF и BCP38',
      html: `
<p>Абонент может слать пакеты с <b>чужим</b> адресом источника. Это основа reflection/amplification DDoS: запрос к открытому DNS или NTP с адресом жертвы в source, и ответ в 50 раз больше улетает жертве. <b>BCP38</b> (RFC 2827) — договорённость: провайдер на стыке с клиентом принимает только пакеты с адресами источника, принадлежащими этому клиенту.</p>
<h3>uRPF (unicast Reverse Path Forwarding)</h3>
<p>Маршрутизатор проверяет адрес <b>источника</b> входящего пакета по своей таблице маршрутизации:</p>
<table><tr><th>Режим</th><th>Проверка</th><th>Где</th></tr>
<tr><td><b>strict</b></td><td>маршрут к Src IP есть <b>и</b> указывает на тот же интерфейс, откуда пришёл пакет</td><td>стыки с клиентами с одним подключением (single-homed): абонентские интерфейсы, BNG</td></tr>
<tr><td><b>loose</b></td><td>маршрут к Src IP просто есть (через любой интерфейс, кроме Null0)</td><td>стыки с асимметрией (multihomed, пиры, транзит): отсекает только мусор вроде bogon и неанонсированных адресов</td></tr></table>
<pre class="cli">interface Gi0/1.100
 description CUSTOMER-A
 ip verify unicast source reachable-via rx              ! strict
interface Gi0/2
 description UPSTREAM
 ip verify unicast source reachable-via any             ! loose
R1#show ip interface Gi0/1.100 | include verify|drops
  IP verify source reachable-via RX
   [[1205 verification drops]]</pre>
<div class="callout warn"><b>strict + асимметрия = потеря трафика</b>Клиент подключён к тебе двумя линками (или анонсирует часть сетей через другого провайдера). Тогда обратный маршрут к его адресам может указывать не на тот интерфейс, откуда пришёл пакет, и strict uRPF отбросит легитимный трафик. Там ставят loose или ACL по списку сетей клиента.</div>
<p>uRPF loose вместе с маршрутом в Null0 даёт <b>RTBH по источнику</b> (remote triggered black hole): маршрут «адрес атакующего → Null0», и все его пакеты отбрасываются на границе. Подробнее в главе 8.</p>`
    },
    {
      id: 'nat', h: 'NAT: виды, порядок операций, диагностика',
      html: `
<p>Термины Cisco — их путают все:</p>
<table><tr><th>Термин</th><th>Что это</th><th>Пример</th></tr>
<tr><td>inside local</td><td>адрес внутреннего хоста, как его видят внутри</td><td>172.16.3.11</td></tr>
<tr><td>inside global</td><td>адрес внутреннего хоста, как его видят снаружи</td><td>198.51.100.2</td></tr>
<tr><td>outside global</td><td>адрес внешнего хоста, как его видят снаружи (настоящий)</td><td>192.0.2.2</td></tr>
<tr><td>outside local</td><td>адрес внешнего хоста, как его видят внутри (обычно = global)</td><td>192.0.2.2</td></tr></table>
<h3>Виды</h3>
<ul><li><b>Static NAT 1:1</b> — <code>ip nat inside source static 172.16.0.2 198.51.100.3</code>. Работает в обе стороны: сервер доступен снаружи.</li>
<li><b>Dynamic NAT</b> — пул публичных адресов, адрес выдаётся на время. Пул кончился — следующий хост не выйдет.</li>
<li><b>PAT / NAT overload</b> — много внутренних адресов за одним публичным, различаются по портам. Это то, что стоит дома и в офисах: <code>ip nat inside source list NAT-INET interface Gi0/1 overload</code>.</li>
<li><b>Static PAT (проброс порта)</b> — <code>ip nat inside source static tcp 172.16.0.2 80 198.51.100.2 80</code>.</li></ul>
<h3>Порядок операций (Cisco IOS)</h3>
<div class="vs"><div><b>inside → outside</b><br>1. ACL in<br>2. <b>маршрутизация</b><br>3. <b>NAT</b> (inside→global)<br>4. ACL out (видит уже <b>глобальный</b> адрес)</div>
<div><b>outside → inside</b><br>1. ACL in (видит <b>глобальный</b> адрес)<br>2. <b>NAT</b> (global→inside)<br>3. <b>маршрутизация</b> (по уже локальному адресу)<br>4. ACL out</div></div>
<p>Отсюда два правила: ACL на outside-интерфейсе пишутся под <b>глобальные</b> адреса. Маршрут для входящего трафика ищется уже <b>после</b> трансляции, по внутреннему адресу.</p>
<pre class="cli">R1#show ip nat translations
Pro Inside global         Inside local         Outside local      Outside global
tcp [[198.51.100.2:1024]]    172.16.3.11:49152    192.0.2.2:80       192.0.2.2:80
tcp 198.51.100.2:80       172.16.0.2:80        ---                ---
icmp 198.51.100.2:3       172.16.4.123:3       8.8.8.8:3          8.8.8.8:3
R1#show ip nat statistics
Total active translations: 3 (1 static, 2 dynamic; 2 extended)
Outside interfaces: GigabitEthernet0/1
Inside interfaces: GigabitEthernet0/0.101, GigabitEthernet0/0.102
Hits: 120  Misses: 4
R1#debug ip nat detailed       ! в лабе
R1#clear ip nat translation *</pre>
<div class="callout bad"><b>Типовые проблемы NAT</b>
<ul><li>Забыли <code>ip nat inside/outside</code> на интерфейсе: трансляций нет, <code>Misses</code> не растёт.</li>
<li>ACL для NAT не включает сеть: из неё выхода нет. Ответ на домашнее задание статьи — так филиалы и остаются без интернета.</li>
<li>Нет маршрута у провайдера к твоему публичному пулу, если пул не из сети стыка.</li>
<li>Протоколы с адресами внутри данных (FTP active, SIP, H.323): нужен ALG, и он сам бывает источником проблем (SIP ALG ломает VoIP).</li>
<li><b>Hairpin</b>: внутренний клиент идёт на публичный адрес своего же сервера. Без NAT hairpinning (NVI на IOS) не работает.</li></ul></div>`
    },
    {
      id: 'cgnat', h: 'CGNAT: NAT у провайдера',
      html: `
<p>IPv4 кончился. Провайдер даёт абонентам «серые» адреса и транслирует их в немногие белые на <b>CGNAT</b> (Carrier-Grade NAT, NAT44 у провайдера). У абонента дома свой NAT, так что получается <b>NAT444</b>: дом (192.168.x) → провайдер (100.64.x) → интернет.</p>
<ul><li><b>100.64.0.0/10</b> (RFC 6598, shared address space) — специальный диапазон для сети между абонентом и CGNAT. Не RFC1918, чтобы не пересечься с домашними сетями абонентов. На практике многие провайдеры всё равно используют 10.0.0.0/8.</li>
<li><b>Port Block Allocation (PBA)</b> — абоненту выдаётся не порт на каждую сессию, а <b>блок портов</b> (например, 512 портов на 198.51.100.7). Логировать нужно только выдачу блока, а не миллиарды сессий. Это решает проблему объёма логов.</li>
<li><b>Логирование и СОРМ.</b> По закону провайдер обязан ответить, какой абонент стоял за публичным IP:портом в конкретный момент. Без логов CGNAT ответить невозможно. Время на всех системах должно быть синхронизировано (NTP, глава 1).</li>
<li><b>EIM/EIF</b> (endpoint-independent mapping/filtering) — один и тот же внешний порт абонента для всех получателей. Нужно для игр, P2P, WebRTC (NAT traversal). RFC 6888 требует именно такое поведение.</li>
<li><b>Ограничения</b> на абонента: максимум сессий и портов, чтобы один заражённый компьютер не съел весь пул.</li></ul>
<div class="callout pro"><b>Что приходит в поддержку</b>«Не работает проброс портов на роутере» — у абонента серый адрес за CGNAT, снаружи к нему не попасть, нужна услуга «белый IP». «Забанили в игре или на форуме» — сотни абонентов за одним публичным адресом, бан по IP задевает всех. «Не открывается сайт X» — сайт заблокировал наш публичный IP за спам от кого-то из соседей. Помогает IPv6 (без NAT) и аккуратный размер пулов.</div>
<h3>PBR — когда маршрутизировать не по адресу назначения</h3>
<p>Policy-Based Routing: route-map на входящем интерфейсе выбирает next-hop по источнику, протоколу и т. п. Пример: трафик бухгалтерии (клиент-банк) — через надёжный канал, остальное — через дешёвый. PBR обходит таблицу маршрутизации, поэтому его трудно диагностировать: всегда отмечай его в документации.</p>
<pre class="cli">ip access-list extended BUH
 permit ip 172.16.5.0 0.0.0.255 any
route-map PBR-BUH permit 10
 match ip address BUH
 set ip next-hop 203.0.113.1
interface Gi0/0.103
 ip policy route-map PBR-BUH
R1#show route-map PBR-BUH        ! счётчики совпадений</pre>`
    }
  ],
  cmds: [
    { g: 'ACL' },
    { c: 'ip access-list extended NAME\n seq permit|deny proto SRC WC DST WC [eq port]', d: 'Именованный расширенный ACL', hw: 'acl number 3000\n rule 5 permit tcp source … destination … destination-port eq 80', jn: 'set firewall family inet filter NAME term T from … then accept' },
    { c: 'ip access-group NAME in|out', d: 'Применить к интерфейсу', hw: 'traffic-filter inbound acl 3000', jn: 'set interfaces X unit 0 family inet filter input NAME' },
    { c: 'show access-lists [NAME]', d: 'Правила со счётчиками совпадений', hw: 'display acl 3000', jn: 'show firewall filter NAME' },
    { c: 'clear access-list counters', d: 'Обнулить счётчики', hw: 'reset acl counter all', jn: 'clear firewall all' },
    { c: 'ip access-list resequence NAME 10 10', d: 'Перенумеровать строки', hw: 'step 10' },
    { c: 'object-group network | service', d: 'Группы адресов и сервисов', hw: 'ip address-set / ip service-set', jn: 'prefix-list в filter' },
    { c: 'access-class NAME in (line vty)', d: 'Кто может зайти на устройство', hw: 'acl 2000 inbound (user-interface)', jn: 'lo0 filter' },
    { g: 'Защита и анти-спуфинг' },
    { c: 'ip verify unicast source reachable-via rx | any', d: 'uRPF strict / loose', hw: 'urpf strict | loose', jn: 'family inet rpf-check [mode loose]' },
    { c: 'control-plane\n service-policy input COPP', d: 'CoPP: лимиты трафика к CPU', hw: 'cpu-defend policy', jn: 'lo0 input filter + policer' },
    { c: 'show policy-map control-plane', d: 'Счётчики CoPP по классам', hw: 'display cpu-defend statistics', jn: 'show ddos-protection protocols' },
    { g: 'NAT' },
    { c: 'ip nat inside / ip nat outside', d: 'Роль интерфейса в NAT', hw: 'nat outbound (на внешнем интерфейсе)', jn: 'set security nat source rule-set … (SRX)' },
    { c: 'ip nat inside source list ACL interface Gi0/1 overload', d: 'PAT на адрес интерфейса', hw: 'nat outbound 3000', jn: 'source nat … then source-nat interface' },
    { c: 'ip nat pool P 198.51.100.2 198.51.100.14 netmask 255.255.255.240\nip nat inside source list ACL pool P overload', d: 'PAT на пул', hw: 'nat address-group 1 … / nat outbound 3000 address-group 1' },
    { c: 'ip nat inside source static 172.16.0.2 198.51.100.3', d: 'Static NAT 1:1', hw: 'nat static global … inside …', jn: 'static-nat' },
    { c: 'ip nat inside source static tcp 172.16.0.2 80 198.51.100.2 80', d: 'Проброс порта', hw: 'nat server protocol tcp global … www inside … www', jn: 'destination-nat' },
    { c: 'show ip nat translations [verbose]', d: 'Таблица трансляций', hw: 'display nat session all', jn: 'show security nat source summary' },
    { c: 'show ip nat statistics', d: 'Счётчики, inside/outside, hits/misses', hw: 'display nat statistics' },
    { c: 'clear ip nat translation *', d: 'Очистить динамические трансляции', hw: 'reset nat session all' },
    { g: 'PBR' },
    { c: 'route-map NAME permit 10\n match ip address ACL\n set ip next-hop X\ninterface …\n ip policy route-map NAME', d: 'Маршрутизация по политике', hw: 'traffic policy + redirect ip-nexthop', jn: 'filter-based forwarding (routing-instance)' }
  ],
  cards: [
    ['Как проверяется ACL?', 'Сверху вниз до первого совпадения. В конце неявный deny any.'],
    ['Wildcard для сети 172.16.16.0/21?', '0.0.7.255 (255.255.255.255 − 255.255.248.0).'],
    ['Wildcard «все чётные адреса в 10.0.0.0/24»?', '10.0.0.0 0.0.0.254 — последний бит должен быть 0, остальные биты последнего октета любые.'],
    ['Фильтрует ли ACL out трафик, сгенерированный самим маршрутизатором?', 'Нет. Исходящий ACL применяется к транзитному трафику. Пакеты, рождённые самим устройством (ping, протоколы маршрутизации), он не проверяет.'],
    ['Где размещать standard и extended ACL?', 'Extended — ближе к источнику (рано отсекать лишний трафик). Standard — ближе к получателю (он проверяет только источник, иначе отрежешь источник от всего).'],
    ['Почему ACL «stateless» и что из этого следует?', 'Он не помнит сессии: ответы тоже должны быть разрешены в обратном направлении. Помогают established (TCP), reflexive ACL или stateful-фаервол.'],
    ['Три плоскости устройства?', 'Data plane — транзит (ASIC). Control plane — протоколы (OSPF, BGP, ARP; CPU). Management plane — SSH, SNMP, NTP.'],
    ['Что такое iACL?', 'Infrastructure ACL на внешних стыках: к адресам своей инфраструктуры (loopback, p2p) пропускать только нужные протоколы от нужных источников, транзит не трогать.'],
    ['Что такое CoPP?', 'Control Plane Policing: политика QoS на трафик к CPU, по классам с лимитами. Защищает BGP/OSPF от флуда, адресованного самому устройству.'],
    ['BCP38 — суть?', 'Провайдер на стыке с клиентом принимает только пакеты с адресами источника, принадлежащими клиенту. Против спуфинга и reflection DDoS.'],
    ['uRPF strict vs loose?', 'Strict: маршрут к Src IP через тот же интерфейс, откуда пришёл пакет (single-homed стыки). Loose: маршрут к Src IP просто существует (multihomed, пиры).'],
    ['Почему strict uRPF опасен для multihomed клиента?', 'При асимметрии обратный маршрут к его адресам указывает на другой интерфейс, и легитимные пакеты отбрасываются.'],
    ['inside local / inside global / outside global?', 'Inside local — адрес хоста внутри. Inside global — он же, как его видят снаружи (после NAT). Outside global — реальный адрес внешнего хоста.'],
    ['Порядок NAT и маршрутизации на Cisco для inside→outside?', 'ACL in → маршрутизация → NAT → ACL out (видит уже глобальный адрес).'],
    ['Порядок для outside→inside?', 'ACL in (по глобальному адресу) → NAT (в локальный) → маршрутизация (по локальному адресу) → ACL out.'],
    ['Чем PAT отличается от dynamic NAT?', 'Dynamic NAT — 1 публичный адрес на 1 внутренний на время сессии (пул быстро кончается). PAT — много внутренних за одним публичным, различаются портами.'],
    ['Что такое 100.64.0.0/10?', 'Shared Address Space (RFC 6598) для сети между абонентом и CGNAT провайдера. Не пересекается с RFC1918 домашних сетей.'],
    ['Что такое NAT444?', 'Двойной NAT: дом (RFC1918) → CGNAT провайдера (100.64/10) → публичный IPv4.'],
    ['Что такое Port Block Allocation в CGNAT?', 'Абоненту выдаётся блок портов на публичном IP (например, 512). Логируется только выдача блока, а не каждая сессия, поэтому объём логов падает в тысячи раз.'],
    ['Зачем CGNAT нужны логи и синхронное время?', 'Чтобы по запросу (СОРМ, правоохранители) определить абонента за публичным IP:портом в момент времени. Без NTP время в логах не совпадёт с временем запроса.'],
    ['Почему у абонента за CGNAT «не работает проброс портов»?', 'У него серый адрес. Входящее соединение на публичный адрес CGNAT не знает, какому абоненту его отдать. Нужен белый IP (или IPv6).'],
    ['Что такое NAT hairpinning?', 'Внутренний клиент обращается к публичному адресу своего же сервера за NAT. Нужна трансляция «туда и обратно» на одном маршрутизаторе, по умолчанию классический IOS NAT это не умеет (нужен NVI).'],
    ['Что такое PBR и чем он опасен?', 'Policy-Based Routing: выбор next-hop не по назначению, а по политике (источник, протокол). Обходит таблицу маршрутизации, поэтому трудно диагностировать, если не задокументирован.']
  ],
  quiz: [
    { q: 'ACL: 10 deny ip host 10.0.0.5 any; 20 deny ip 10.0.0.0 0.0.0.255 any. Применён in. Что с пакетом от 10.0.1.7?', o: ['Пропущен', 'Отброшен строкой 20', 'Отброшен неявным deny', 'Отброшен строкой 10'], a: 2, e: '10.0.1.7 не совпадает ни с одной строкой, срабатывает неявный deny any в конце. ACL из одних deny запрещает всё.' },
    { q: 'Какой wildcard соответствует 10.1.32.0/19?', o: ['0.0.31.255', '0.0.63.255', '0.0.32.255', '255.255.224.0'], a: 0, e: '/19 = 255.255.224.0. Wildcard = 0.0.31.255.' },
    { q: 'ACL с deny icmp any any применён OUT на Gi0/1. Ты пингуешь с самого маршрутизатора адрес за Gi0/1. Что будет?', o: ['Ping не уйдёт', 'Ping уйдёт: ACL out не фильтрует трафик, сгенерированный самим маршрутизатором', 'Маршрутизатор перезагрузится', 'ACL не применится'], a: 1, e: 'Исходящие ACL не проверяют локально сгенерированные пакеты. Классическая ловушка при проверке ACL с самого маршрутизатора.' },
    { q: 'Разрешил «permit tcp 172.16.3.0 0.0.0.255 host 192.0.2.2 eq 80» на входе LAN-интерфейса. На outside-интерфейсе висит ACL in «permit tcp host 192.0.2.2 eq 80 any» + неявный deny. Будет ли работать веб (с NAT на outside)?', o: ['Нет: ACL in на outside видит адреса после NAT', 'Да, если правило на outside пропускает ответы сервера к глобальному адресу', 'Нет, ACL нельзя совмещать с NAT', 'Да, всегда'], a: 1, e: 'Ответы сервера приходят с src 192.0.2.2:80 на глобальный адрес. Правило «host 192.0.2.2 eq 80 any» их пропускает. ACL in на outside видит пакет до трансляции, то есть с глобальным адресом назначения.' },
    { q: 'Клиент подключён к тебе двумя линками, ответный трафик может приходить по любому. Какой uRPF на его интерфейсах?', o: ['Strict', 'Loose или ACL по его сетям', 'Никакой, uRPF несовместим с BGP', 'Strict на одном, loose на другом'], a: 1, e: 'Strict при асимметрии отбросит легитимные пакеты. Loose (или ACL по списку префиксов клиента — так точнее) безопасен.' },
    { q: 'Во время DDoS на клиента у тебя упала BGP-сессия с пиром на том же маршрутизаторе. Чего вероятнее всего не хватало?', o: ['uRPF', 'CoPP / защиты control plane', 'NAT', 'PBR'], a: 1, e: 'Флуд долетел до CPU (ICMP unreachable, ARP, TTL expired), и BGP keepalive не успели обработаться. CoPP ограничивает классы трафика к CPU.' },
    { q: 'В show ip nat statistics: Hits не растут, Misses не растут, translations пусто. Пользователи не выходят в интернет. Первое, что проверить?', o: ['Пул адресов', 'Что на интерфейсах стоят ip nat inside / ip nat outside', 'Маршрут по умолчанию у провайдера', 'DNS'], a: 1, e: 'Без ролей интерфейсов NAT даже не пытается транслировать: нет ни попаданий, ни промахов.' },
    { q: 'PAT настроен ACL «permit ip 172.16.3.0 0.0.0.255 any». Филиал 172.16.16.0/21 приходит в Москву и хочет в интернет через неё. Почему не выходит?', o: ['Нет маршрута', 'Сеть филиала не входит в ACL для NAT', 'PAT не работает с филиалами', 'Нужен static NAT'], a: 1, e: 'Ответ на домашнее задание статьи: ACL NAT определяет, кого транслировать. Плюс филиалу нужен default в Москву, а Москве — маршрут обратно.' },
    { q: 'Ты провайдер. Пришёл запрос: «кто выходил с 198.51.100.7:40123 в 14:03:12». Что нужно, чтобы ответить? (несколько)', o: ['Логи CGNAT (выдача блоков портов или сессии) с привязкой к абоненту', 'Точная синхронизация времени (NTP) на CGNAT и системе логов', 'Связь серого адреса с абонентом (RADIUS-аккаунтинг, DHCP-логи)', 'Таблица MAC-адресов'], a: [0, 1, 2], e: 'Цепочка: публичный IP:порт+время → блок портов → серый адрес → сессия абонента. MAC-таблица тут не поможет.' },
    { q: 'Зачем отдельный диапазон 100.64.0.0/10 для CGNAT, если есть 10.0.0.0/8?', o: ['Он быстрее', 'Чтобы не пересекаться с RFC1918-сетями внутри домашних сетей абонентов', 'Он публичный', 'Так требует IPv6'], a: 1, e: 'Если у абонента дома 10.0.0.0/24, а провайдер выдал ему WAN из 10.0.0.0/8, будет конфликт маршрутизации. Shared Address Space этого избегает.' },
    { q: 'Сервер за NAT доступен снаружи по 198.51.100.2:80, а сотрудники изнутри по этому же адресу не могут открыть сайт. Что это?', o: ['Проблема DNS', 'Отсутствие NAT hairpinning', 'uRPF', 'Порт закрыт ACL'], a: 1, e: 'Внутренний клиент → публичный адрес → нужен разворот на том же маршрутизаторе. Решение: NVI (ip nat enable), split DNS (внутри имя резолвится в частный адрес) или доступ по внутреннему адресу.' },
    { q: 'Что делает «permit tcp any any established»?', o: ['Пропускает все TCP', 'Пропускает TCP-сегменты с флагами ACK или RST, то есть не начало сессии', 'Пропускает только SYN', 'Создаёт сессию'], a: 1, e: 'Это эвристика «ответный трафик». Начать сессию снаружи (SYN без ACK) не даст, но это всё равно не stateful.' },
    { q: 'Как вставить правило между строками 10 и 20 именованного ACL?', o: ['Удалить и создать ACL заново', 'Задать правилу номер 15', 'Это невозможно', 'ip access-list insert'], a: 1, e: 'Именованные (и нумерованные в режиме ip access-list) ACL поддерживают номера последовательности. resequence перенумерует.' },
    { q: 'Какие проблемы типичны для абонентов за CGNAT? (несколько)', o: ['Не работают входящие подключения (проброс портов)', 'Бан по IP задевает соседей', 'Ограничение числа сессий', 'Нельзя пользоваться DNS'], a: [0, 1, 2], e: 'DNS работает нормально. Остальное — реальные заявки.' }
  ],
  und: [
    { q: 'Объясни порядок операций NAT на Cisco в обе стороны и как он влияет на написание ACL на outside-интерфейсе и на маршрутизацию входящих пакетов.', a: '<p>Inside→outside: ACL in, маршрутизация, NAT, ACL out. Поэтому ACL out на внешнем интерфейсе видит уже глобальный адрес. Outside→inside: ACL in (пакет ещё с глобальным адресом назначения), NAT (меняет на локальный), маршрутизация (уже по локальному адресу), ACL out. Следствия: ACL на outside-интерфейсе пишутся в глобальных адресах. Маршрут к внутренней сети нужен для входящих пакетов, и ищется он после трансляции.</p>', k: ['in→out: route → NAT', 'out→in: NAT → route', 'ACL на outside — глобальные адреса', 'маршрут ищется по внутреннему адресу'] },
    { q: 'Ты отвечаешь за стык с корпоративным клиентом (один линк) и с вышестоящим провайдером. Какую защиту ты поставишь на каждом и почему?', a: '<p>Клиент: uRPF strict или ACL по его префиксам (BCP38: принимать только его адреса источника), iACL (к моим loopback/p2p только нужное, например BGP от его адреса), лимиты (policer по договору). Вышестоящий: uRPF loose (отсекает bogon и неанонсируемое, асимметрия здесь норма), iACL на вход (к инфраструктуре только BGP от пира и ICMP с лимитом), фильтры bogon-префиксов. На всём устройстве: CoPP, чтобы флуд к CPU не валил BGP/IGP, и ACL на VTY/SNMP.</p>', k: ['клиент: strict/ACL по префиксам', 'аплинк: loose', 'iACL везде', 'CoPP на устройстве'] },
    { q: 'Как устроен CGNAT, зачем Port Block Allocation и почему без NTP провайдер может нарушить закон?', a: '<p>Абоненты получают серые адреса (100.64/10), CGNAT транслирует их в публичные с выдачей портов. PBA выдаёт абоненту блок портов на публичном IP и логирует только выдачу блока: объём логов на порядки меньше, чем при логировании каждой сессии. По запросу «кто был на IP:порт в момент T» провайдер находит блок, по нему серый адрес, по нему абонента (RADIUS/DHCP). Если время на CGNAT или логах сбито, ответ будет неверным: можно указать на невиновного или не найти виновного. Это нарушение обязанностей оператора.</p>', k: ['серые адреса → публичный IP:порты', 'PBA уменьшает логи', 'цепочка поиска абонента', 'точное время'] },
    { q: 'Почему CPU маршрутизатора нужно защищать отдельно и что именно туда попадает?', a: '<p>ASIC пересылает транзит на скорости линии, а CPU в сотни раз слабее. К CPU попадают: пакеты на адреса самого устройства (ping, SSH, SNMP, BGP, OSPF, LDP, BFD), ARP, пакеты с истёкшим TTL (генерация ICMP Time Exceeded), пакеты без маршрута (ICMP unreachable), пакеты с IP-опциями, фрагменты к устройству. Флуд любого из этих типов может забить CPU, и умрут протоколы маршрутизации: сеть рушится не из-за транзита, а из-за потери control plane. Защита: iACL на стыках, CoPP с лимитами по классам, rate-limit генерации ICMP, uRPF.</p>', k: ['ASIC vs CPU', 'что punt-ится в CPU', 'потеря control plane = авария', 'iACL + CoPP + rate-limit'] }
  ],
  lab: {
    title: 'Лаба 5. Выход в интернет: ACL, NAT, проброс и защита стыка',
    time: '≈ 2,5 часа',
    goal: `<p>Офис «Лифт ми Ап» за маршрутизатором GW выходит к провайдеру ISP. Разграничить доступ (как в статье), настроить PAT и проброс веб-сервера, проверить порядок операций NAT. Потом встать на сторону провайдера: защитить стык через uRPF и iACL и устроить сеанс спуфинга.</p>`,
    topo: {
      w: 880, h: 420,
      zones: [{ x: 20, y: 20, w: 520, h: 380, label: '«Лифт ми Ап»' }, { x: 580, y: 20, w: 280, h: 380, label: 'Провайдер / Интернет', c: '#64748b' }],
      nodes: [
        { id: 'GW', t: 'router', x: 420, y: 110, label: 'GW\n198.51.100.2', role: 'граница офиса: ACL, NAT' },
        { id: 'SW1', t: 'switch', x: 260, y: 220, label: 'SW1', role: 'коммутатор офиса' },
        { id: 'PC1', t: 'pc', x: 90, y: 340, label: 'PC1 · ПТО v101\n172.16.3.11', role: 'сотрудник ПТО' },
        { id: 'PC2', t: 'pc', x: 260, y: 340, label: 'PC2 · админ v102\n172.16.4.123', role: 'админ / финдиректор' },
        { id: 'SRV', t: 'router', x: 430, y: 330, label: 'SRV · v3\n172.16.0.2 (web, telnet)', role: 'сервер (vIOS с ip http server)', color: '#b45309' },
        { id: 'ISP', t: 'isp', x: 720, y: 110, label: 'ISP\nLo0 8.8.8.8\nLo1 192.0.2.2 («linkmeup»)', role: 'провайдер и «интернет»' }
      ],
      links: [['GW', 'Gi0/1', 'ISP', 'Gi0/0', '198.51.100.0/28'], ['GW', 'Gi0/0', 'SW1', 'Gi0/0', 'trunk 3,101,102'], ['PC1', 'eth0', 'SW1', 'Gi0/1'], ['PC2', 'eth0', 'SW1', 'Gi0/2'], ['SRV', 'Gi0/0', 'SW1', 'Gi0/3']]
    },
    addr: [['GW', 'Gi0/0.3 / .101 / .102', '172.16.0.1 / 172.16.3.1 / 172.16.4.1'], ['GW', 'Gi0/1', '198.51.100.2/28'], ['ISP', 'Gi0/0', '198.51.100.1/28'], ['SRV', 'Gi0/0', '172.16.0.2/24, gw .1'], ['Публичный пул', '—', '198.51.100.2–14']],
    init: {
      GW: 'hostname GW\nno ip domain-lookup\ninterface Gi0/0\n no shutdown\ninterface Gi0/0.3\n description SERVERS\n encapsulation dot1Q 3\n ip address 172.16.0.1 255.255.255.0\ninterface Gi0/0.101\n description PTO\n encapsulation dot1Q 101\n ip address 172.16.3.1 255.255.255.0\ninterface Gi0/0.102\n description ADMIN\n encapsulation dot1Q 102\n ip address 172.16.4.1 255.255.255.0\ninterface Gi0/1\n description ISP\n ip address 198.51.100.2 255.255.255.240\n no shutdown\nline con 0\n logging synchronous\n exec-timeout 0 0',
      ISP: 'hostname ISP\nno ip domain-lookup\ninterface Loopback0\n ip address 8.8.8.8 255.255.255.255\ninterface Loopback1\n ip address 192.0.2.2 255.255.255.255\ninterface Gi0/0\n ip address 198.51.100.1 255.255.255.240\n no shutdown\nip http server\nline vty 0 4\n password cisco\n login\n transport input telnet\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SW1: 'hostname SW1\nno ip domain-lookup\nvlan 3\nvlan 101\nvlan 102\ninterface Gi0/0\n switchport trunk encapsulation dot1q\n switchport mode trunk\ninterface Gi0/1\n switchport mode access\n switchport access vlan 101\ninterface Gi0/2\n switchport mode access\n switchport access vlan 102\ninterface Gi0/3\n switchport mode access\n switchport access vlan 3\nline con 0\n logging synchronous\n exec-timeout 0 0',
      SRV: 'hostname SRV\nno ip domain-lookup\ninterface Gi0/0\n ip address 172.16.0.2 255.255.255.0\n no shutdown\nip route 0.0.0.0 0.0.0.0 172.16.0.1\nip http server\nline vty 0 4\n password cisco\n login\n transport input telnet\nline con 0\n logging synchronous\n exec-timeout 0 0',
      PC1: 'set pcname PC1\nip 172.16.3.11/24 172.16.3.1', PC2: 'set pcname PC2\nip 172.16.4.123/24 172.16.4.1'
    },
    pre: 'Адресация и VLAN готовы. SRV — это vIOS в роли сервера: на нём поднят HTTP (порт 80) и telnet. «Зайти на веб» из VPCS нельзя, поэтому проверяем с маршрутизаторов командой <code>telnet IP 80</code>: если соединение открылось (Open), порт доступен.',
    tasks: [
      { t: 'Маршрутизация и «до NAT»', d: 'Дай GW default на ISP. С PC1 пингани 8.8.8.8. Не работает? Объясни точно, где теряется пакет: доходит ли он до ISP и почему не возвращается (подсказка: <code>debug ip icmp</code> на ISP).',
        check: 'GW(config)#ip route 0.0.0.0 0.0.0.0 198.51.100.1\nPC1> ping 8.8.8.8\nISP#debug ip icmp\nISP#show ip route 172.16.3.0',
        hint: 'ISP получает пакет с источником 172.16.3.11 и пытается ответить, но маршрута к частной сети у него нет (и не должно быть).' },
      { t: 'PAT для офиса по правилам статьи', d: 'Настрой NAT overload на адрес Gi0/1 с ACL <code>NAT-INET</code>: ПТО (172.16.3.0/24) — только веб на 192.0.2.2 (tcp 80); админ 172.16.4.123 — всё. Проверь: PC2 пингует 8.8.8.8, PC1 не пингует. Посмотри трансляции.',
        hint: 'Проверить веб из VPCS нельзя. Временно проверь ПТО с SRV: <code>telnet 192.0.2.2 80 /source-interface …</code> не подойдёт, SRV в другом VLAN. Достаточно, что ICMP с PC1 не транслируется, а строка ACL для tcp 80 есть. Счётчики покажут.',
        check: 'GW#show ip nat translations\nGW#show ip nat statistics\nGW#show access-lists NAT-INET',
        sol: 'GW(config)#ip access-list extended NAT-INET\nGW(config-ext-nacl)#permit tcp 172.16.3.0 0.0.0.255 host 192.0.2.2 eq www\nGW(config-ext-nacl)#permit ip host 172.16.4.123 any\nGW(config)#ip nat inside source list NAT-INET interface Gi0/1 overload\nGW(config)#interface range Gi0/0.101 , Gi0/0.102\nGW(config-if-range)#ip nat inside\nGW(config)#interface Gi0/1\nGW(config-if)#ip nat outside' },
      { t: 'ACL к серверам', d: 'На Gi0/0.3 (out) пропусти к SRV: веб (80) от всех, telnet только от админа 172.16.4.123, ICMP echo/echo-reply от всех, остальное deny с log. Проверь с PC2 (<code>ping</code>), а telnet — с ISP после проброса (следующее задание). Подумай: нужен ли SRV выход в интернет для ответа клиентам?',
        check: 'GW#show access-lists SERVERS-OUT\nGW#show logging | include SERVERS-OUT',
        sol: 'GW(config)#ip access-list extended SERVERS-OUT\nGW(config-ext-nacl)#permit tcp any host 172.16.0.2 eq www\nGW(config-ext-nacl)#permit tcp host 172.16.4.123 host 172.16.0.2 eq telnet\nGW(config-ext-nacl)#permit icmp any host 172.16.0.2 echo\nGW(config-ext-nacl)#permit icmp any host 172.16.0.2 echo-reply\nGW(config-ext-nacl)#deny ip any any log\nGW(config)#interface Gi0/0.3\nGW(config-subif)#ip access-group SERVERS-OUT out\nGW(config-subif)#ip nat inside' },
      { t: 'Проброс веб-сервера наружу', d: 'Сделай static PAT: 198.51.100.3:80 → 172.16.0.2:80. С ISP проверь <code>telnet 198.51.100.3 80</code> (должно открыться). Посмотри трансляции во время соединения. Объясни, какие адреса видит ACL SERVERS-OUT для этого соединения и почему оно проходит.',
        check: 'ISP#telnet 198.51.100.3 80\nGW#show ip nat translations\nGW#show access-lists SERVERS-OUT',
        sol: 'GW(config)#ip nat inside source static tcp 172.16.0.2 80 198.51.100.3 80\n! ISP знает 198.51.100.3 как connected-сеть /28 → ARP → GW отвечает за адрес (NAT alias)\n! ACL out на Gi0/0.3 видит уже src=198.51.100.1 dst=172.16.0.2:80 — правило 10' },
      { t: 'Порядок операций своими глазами', d: 'Включи <code>debug ip nat</code> на GW и <code>debug ip packet</code> с ACL на один хост (обязательно с ACL!). Сделай с ISP <code>telnet 198.51.100.3 80</code>. Найди в выводе момент трансляции и сопоставь с порядком «outside→inside: NAT, потом маршрутизация».',
        check: 'GW(config)#access-list 199 permit tcp any any eq www\nGW#debug ip packet 199 detail\nGW#debug ip nat\nGW#undebug all' },
      { t: 'Защита самого GW', d: 'На line vty GW разреши SSH или telnet только с 172.16.4.123. Повесь на Gi0/1 iACL на вход: к 198.51.100.2 (адрес самого GW) разрешить только ICMP echo-reply и ответы на исходящие сессии (established), а транзит к пробросам пропустить. Проверь, что проброс жив, а <code>telnet 198.51.100.2</code> с ISP — нет.',
        hint: 'Осторожно: PAT использует адрес 198.51.100.2 (интерфейса). Ответы интернета для пользователей тоже идут на него! ACL in на outside видит глобальные адреса. Как отличить ответы от новых соединений? Подсказка: established для TCP, echo-reply для ICMP, а что с UDP (DNS)?',
        sol: 'GW(config)#ip access-list extended IACL-IN\nGW(config-ext-nacl)#permit tcp any host 198.51.100.3 eq www\nGW(config-ext-nacl)#permit tcp any host 198.51.100.2 established\nGW(config-ext-nacl)#permit icmp any host 198.51.100.2 echo-reply\nGW(config-ext-nacl)#permit icmp any host 198.51.100.2 time-exceeded\nGW(config-ext-nacl)#permit icmp any host 198.51.100.2 unreachable\nGW(config-ext-nacl)#permit udp any eq domain host 198.51.100.2\nGW(config-ext-nacl)#deny ip any any log\nGW(config)#interface Gi0/1\nGW(config-if)#ip access-group IACL-IN in\n! для полноценного stateful нужен ZBF или ip inspect — это уже тема фаерволов' },
      { t: 'На стороне провайдера: uRPF и спуфинг', d: 'Ты — провайдер. GW — твой клиент с сетью 198.51.100.0/28. На ISP Gi0/0 включи uRPF strict. С GW отправь пинг с поддельным источником: <code>ping 8.8.8.8 source Loopback99</code>, где Loopback99 = 203.0.113.66/32 (не твой адрес). Посмотри счётчики verification drops на ISP. Затем пингани с нормального адреса.',
        check: 'GW(config)#interface Loopback99\nGW(config-if)#ip address 203.0.113.66 255.255.255.255\nGW#ping 8.8.8.8 source Loopback99\nISP#show ip interface Gi0/0 | include verif|drops\nISP#show ip traffic | include RPF',
        sol: 'ISP(config)#interface Gi0/0\nISP(config-if)#ip verify unicast source reachable-via rx\n! пакет с src 203.0.113.66: маршрута к нему через Gi0/0 у ISP нет → drop (BCP38 в действии)' }
    ],
    brk: [
      { t: 'После изменений админ (PC2) потерял интернет, а ПТО (по 80-му порту) работает', inj: 'GW(config)#ip access-list extended NAT-INET\nGW(config-ext-nacl)#no permit ip host 172.16.4.123 any\nGW(config-ext-nacl)#permit ip host 172.16.4.132 any', h: '<code>show access-lists NAT-INET</code> — счётчики и адреса. <code>show ip nat translations</code> при пинге с PC2.', f: 'В ACL NAT опечатка в адресе админа (132 вместо 123): трафик PC2 не транслируется и уходит провайдеру с частным адресом. Исправь адрес. Мораль: проверяй счётчики совпадений после любого изменения ACL.' },
      { t: 'Проброс сервера перестал работать, а пинг до SRV изнутри идёт', inj: 'GW(config)#interface Gi0/0.3\nGW(config-subif)#no ip nat inside', h: '<code>show ip nat statistics</code> — какие интерфейсы inside? <code>debug ip nat</code> при попытке с ISP.', f: 'С интерфейса серверов снята роль <code>ip nat inside</code>: обратная трансляция ответов сервера не выполняется, ответы уходят с частным адресом. Для static NAT роли интерфейсов обязательны с обеих сторон.' },
      { t: 'Никто не может выйти в интернет, но NAT-трансляции создаются', inj: 'GW(config)#no ip route 0.0.0.0 0.0.0.0 198.51.100.1\nGW(config)#ip route 0.0.0.0 0.0.0.0 198.51.100.14', h: '<code>show ip route 0.0.0.0</code>, <code>show ip arp 198.51.100.14</code>. Кто такой .14?', f: 'Default указывает на несуществующий next-hop 198.51.100.14 в connected-сети: маршрут есть, ARP неполный (Incomplete), пакеты дропаются. Трансляции создаются, ведь NAT идёт после маршрутизации и до ARP. Верни next-hop .1.' },
      { t: 'Сервер видят снаружи, но админ с PC2 больше не может зайти на SRV по telnet', inj: 'GW(config)#ip access-list extended SERVERS-OUT\nGW(config-ext-nacl)#5 deny tcp any any eq telnet', h: '<code>show access-lists SERVERS-OUT</code>: какая строка первой ловит telnet от админа? Смотри порядковые номера.', f: 'Вставлена строка 5 deny telnet раньше разрешающей строки 20 для админа. Первое совпадение — deny. Порядок решает всё: удали строку 5 или поставь permit для админа раньше.' }
    ],
    extra: '<p><b>CGNAT в миниатюре.</b> Добавь между GW и ISP маршрутизатор CGN. Сделай линк GW–CGN в 100.64.0.0/30, GW делает PAT в 100.64.0.2, а CGN — второй PAT в 198.51.100.x. Получишь NAT444. Посмотри трансляции на обоих и подумай, как бы ты отвечал на запрос «кто был за 198.51.100.x:порт в момент T».</p>'
  }
});
