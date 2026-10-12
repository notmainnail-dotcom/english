COURSE.add({
  id: 'ch11',
  time: '≈ 12 часов',
  intro: `<p>MPLS L3VPN — главная услуга провайдера для бизнеса: «объединить офисы клиента в одну сеть» с гарантированной полосой и без интернета посередине. У сотни клиентов одинаковые адреса 10.0.0.0/8, и все они идут через одно ядро. Глава о том, как это работает: <b>VRF</b> разделяет таблицы, <b>RD</b> делает адреса уникальными, <b>RT</b> решает, кто кого видит, <b>MP-BGP</b> переносит маршруты, а <b>две метки</b> доставляют пакет в нужный VRF на нужном PE.</p>`,
  goals: [
    'Объяснить VRF, RD, RT и разницу между RD и RT так, чтобы не путать их никогда',
    'Пройти control plane: маршрут клиента от CE до удалённого CE через VPNv4 и RT',
    'Пройти data plane: стек из транспортной и VPN-метки, PHP, выбор VRF на egress PE',
    'Строить топологии VPN через RT: full mesh, hub-and-spoke, extranet (общие сервисы)',
    'Настраивать PE–CE: static, eBGP (as-override, allowas-in, SoO), OSPF в VRF',
    'Диагностировать «офис не видит офис» по цепочке из восьми проверок',
    'Понимать Inter-AS options A/B/C на уровне идеи'
  ],
  why: `L3VPN — это то, что продаётся корпоративным клиентам и что чаще всего ломается в заявках B2B: «филиал не видит центральный офис», «пропал маршрут к ЦОД», «новый офис подключили, но не видит половину сети». Без модели VRF/RD/RT/VPN label такие заявки решаются наугад.`,
  refs: [
    { t: 'RFC 4364 — BGP/MPLS IP Virtual Private Networks', u: 'https://www.rfc-editor.org/rfc/rfc4364', n: 'первоисточник L3VPN' },
    { t: 'RFC 4577 — OSPF as the PE/CE Protocol', u: 'https://www.rfc-editor.org/rfc/rfc4577' },
    { t: 'L. De Ghein — MPLS Fundamentals', n: 'гл. 7–8: MPLS VPN' },
    { t: 'I. Pepelnjak, J. Guichard — MPLS and VPN Architectures', n: 'классика Cisco Press по L3VPN' },
    { t: 'linkmeup — СДСМ ч. 11. MPLS L3VPN', u: 'https://linkmeup.ru/blog/204.html' }
  ],
  theory: [
    {
      id: 'vrf', h: 'VRF: несколько маршрутизаторов в одном',
      html: `
<p><b>VRF</b> (Virtual Routing and Forwarding) — отдельная таблица маршрутизации (и FIB) внутри маршрутизатора. Интерфейс принадлежит ровно одному VRF (или глобальной таблице). Пакет, пришедший в интерфейс VRF A, ищется только в таблице A. Поэтому у клиентов A и B могут быть <b>одинаковые адреса</b>, и они не пересекутся.</p>
<pre class="cli">PE1(config)#vrf definition A
PE1(config-vrf)#rd 64500:101
PE1(config-vrf)#address-family ipv4
PE1(config-vrf-af)#route-target both 64500:1
PE1(config)#interface Gi0/1
PE1(config-if)#vrf forwarding A            ! снимает IP-адрес! задавай адрес после
PE1(config-if)#ip address 172.30.1.1 255.255.255.252
PE1#show ip route vrf A
PE1#ping vrf A 172.30.1.2</pre>
<p><b>VRF-lite</b> — VRF без MPLS: разделение таблиц на одном устройстве или между устройствами через сабинтерфейсы (по VLAN на VRF на каждом линке). Работает, но каждый линк и каждое устройство настраивается для каждого клиента. Не масштабируется. MPLS L3VPN решает это: в ядре ничего про клиентов не знают.</p>
<div class="callout info"><b>Management VRF</b>Частое применение VRF-lite у провайдера: управление оборудованием в отдельном VRF Mgmt. Маршруты управления изолированы от клиентских и интернета, и ошибка в глобальной таблице не отрезает доступ к устройству.</div>`
    },
    {
      id: 'rdrt', h: 'RD и RT — не путать никогда',
      html: `
<p>Маршруты из VRF всех PE нужно передать по одной BGP-сессии. Но 10.1.1.0/24 клиента A и 10.1.1.0/24 клиента B для BGP — один и тот же префикс, и он выбрал бы один из них. Решение — два разных механизма:</p>
<div class="vs"><div><b>RD — Route Distinguisher</b><br>8 байт, которые приписываются к IPv4-префиксу, чтобы сделать его <b>уникальным</b>: получается VPNv4-префикс <code>64500:101:10.1.1.0/24</code>. <b>Только уникальность.</b> RD не решает, куда маршрут попадёт. Один RD на VRF на PE.</div>
<div><b>RT — Route Target</b><br>Extended community на маршруте: <b>политика импорта/экспорта</b>. Export RT — «пометить мои маршруты так». Import RT — «забрать в VRF маршруты с такими метками». <b>Именно RT решает, кто кого видит.</b> Их может быть несколько.</div></div>
<p>Мнемоника: <b>RD — «паспорт»</b> (чтобы не перепутать двух Ивановых), <b>RT — «пропуск»</b> (куда пускают).</p>
<h3>Схемы RD</h3>
<ul><li>Одинаковый RD для VRF на всех PE (<code>64500:1</code>) — просто, но если сайт клиента подключён к двум PE, RR увидит один и тот же VPNv4-префикс от двух PE и отразит только лучший. Второй путь потеряется (нет ECMP и быстрого резерва).</li>
<li><b>Уникальный RD на PE</b> (<code>10.255.0.1:1</code>, router-id:номер) — префиксы от разных PE разные, RR отражает оба. Рекомендуемая практика у провайдеров.</li></ul>`
    },
    {
      id: 'cp', h: 'Control plane: путь маршрута от офиса до офиса',
      html: `
<ol class="steps">
<li><b>CE1 → PE1</b>: клиент анонсирует 10.1.1.0/24 (eBGP, OSPF, RIP или PE знает его статически). Маршрут попадает в таблицу <b>VRF A</b> на PE1.</li>
<li><b>VRF → VPNv4</b>: PE1 экспортирует его в BGP-таблицу VPNv4: добавляет RD (64500:101), прикрепляет export RT (64500:1), выделяет <b>VPN-метку</b> (например, 24) и ставит next-hop = свой loopback.</li>
<li><b>MP-BGP</b>: VPNv4-маршрут уходит по iBGP (address-family vpnv4) на RR и с него на остальные PE. Extended communities передаются только с <code>send-community extended</code> (или both).</li>
<li><b>Импорт на PE2</b>: PE2 смотрит на RT. В VRF A у него <code>import 64500:1</code>, совпало, поэтому маршрут импортируется в таблицу VRF A на PE2 с next-hop PE1 и VPN-меткой 24. Если ни один VRF на PE2 не импортирует этот RT, маршрут <b>отбрасывается</b> (RT-фильтрация, экономия памяти).</li>
<li><b>PE2 → CE2</b>: маршрут анонсируется клиенту протоколом PE–CE.</li></ol>
<pre class="cli">PE2#show bgp vpnv4 unicast all
     Network          Next Hop            Metric LocPrf Weight Path
Route Distinguisher: 64500:101
 *>i 10.1.1.0/24      10.255.0.1               0    100      0 65001 i
Route Distinguisher: 64500:103 (default for vrf A)
 *>i 10.1.1.0/24      10.255.0.1               0    100      0 65001 i
 *>  10.1.2.0/24      172.30.2.2               0             0 65001 i
PE2#show bgp vpnv4 unicast vrf A 10.1.1.0/24
  65001
    10.255.0.1 (metric 20) from 10.255.0.1 (10.255.0.1)
      Origin IGP, metric 0, localpref 100, valid, internal, best
      [[Extended Community: RT:64500:1]]
      mpls labels in/out nolabel/[[24]]</pre>`
    },
    {
      id: 'dp', h: 'Data plane: две метки',
      html: `
<div class="pkt"><span class="l2" style="flex:5">Ethernet</span><span class="lb" style="flex:5">Транспортная<small>до PE2 (LDP/SR)</small></span><span class="tg" style="flex:5">VPN-метка<small>какой VRF/префикс (BGP)</small></span><span class="l3" style="flex:6">IP клиента</span></div>
<ol class="steps"><li>PE1 получает пакет от CE1 в VRF A, ищет 10.1.2.0/24 в таблице VRF A: next-hop PE2, VPN-метка 30.</li>
<li>PE1 навешивает <b>VPN-метку 30</b> (внутренняя, S=1) и сверху <b>транспортную</b> метку к loopback PE2 (из LDP).</li>
<li>P-маршрутизаторы видят только транспортную метку: swap, swap. Предпоследний делает PHP, снимает её.</li>
<li>PE2 получает пакет с VPN-меткой 30. По LFIB знает: «30 → VRF A, отправить в CE2» (или «посмотреть таблицу VRF A»). Снимает метку и отправляет IP клиенту.</li></ol>
<p>Зачем вторая метка? Если бы осталась только транспортная, после PHP PE2 получил бы голый IP-пакет 10.1.2.5 и не знал бы, клиенту A или B он предназначен: адреса пересекаются. VPN-метка — это и есть идентификатор «в какой VRF».</p>
<h3>Распределение VPN-меток</h3>
<ul><li><b>per-prefix</b> (по умолчанию на IOS): метка на каждый префикс. Egress может отправить пакет сразу, без IP-lookup. Много меток.</li>
<li><b>per-CE</b>: метка на next-hop CE.</li>
<li><b>per-VRF</b>: одна метка на VRF, egress делает IP-lookup в VRF. Экономно (масштаб), чаще всего у провайдеров.</li></ul>
<pre class="cli">PE2#show mpls forwarding-table vrf A
Local      Outgoing   Prefix           Bytes Label   Outgoing   Next Hop
Label      Label      or Tunnel Id     Switched      interface
30         No Label   10.1.2.0/24[V]   5320          Gi0/2      172.30.2.2
PE1#show ip cef vrf A 10.1.2.0 detail
  nexthop 10.1.12.1 Gi0/0 [[label 17-(local:22) 30]]      ! транспортная 17, VPN 30</pre>
<div class="callout warn"><b>«No Label» здесь норма</b>В <code>show mpls forwarding-table vrf</code> «No Label» для локального префикса клиента нормально: пакет уходит к CE без меток. Не путай с «No Label» для loopback PE в глобальной таблице (глава 10).</div>`
    },
    {
      id: 'topo', h: 'Топологии VPN через RT',
      html: `
<table><tr><th>Топология</th><th>Как через RT</th><th>Пример</th></tr>
<tr><td>Full mesh</td><td>у всех сайтов export X, import X</td><td>все офисы видят всех</td></tr>
<tr><td>Hub-and-spoke</td><td>споки: export SPOKE, import HUB. Хаб: export HUB, import SPOKE</td><td>филиалы ходят друг к другу только через центр (фаервол в ЦО)</td></tr>
<tr><td>Extranet / shared services</td><td>сервисный VRF экспортирует SVC, все клиенты импортируют SVC; сервис импортирует RT клиентов (только нужные маршруты через import map)</td><td>общий DNS, NTP, облако, IP-телефония провайдера, мониторинг</td></tr>
<tr><td>Management VPN</td><td>все CE экспортируют loopback с RT MGMT (через export map), VRF MGMT импортирует</td><td>провайдер управляет CE клиентов</td></tr></table>
<div class="callout warn"><b>Extranet и пересекающиеся адреса</b>Если клиенты A и B оба используют 10.1.1.0/24 и оба импортированы в сервисный VRF, в нём будет конфликт: два одинаковых префикса. Сервис не сможет ответить обоим. Решения: экспортировать в SVC только уникальные адреса (один /32 NAT-адрес на клиента), NAT на стороне сервиса, договариваться об адресах при подключении.</div>`
    },
    {
      id: 'pece', h: 'Протоколы PE–CE',
      html: `
<table><tr><th>Протокол</th><th>Плюсы</th><th>Нюансы</th></tr>
<tr><td>Static</td><td>просто, CE может быть чем угодно</td><td>нет реакции на отказ (нужен BFD/track), правки руками</td></tr>
<tr><td><b>eBGP</b></td><td>стандарт провайдеров: политики, community, явные фильтры, max-prefix, масштаб</td><td>одинаковая AS на всех сайтах клиента → loop prevention</td></tr>
<tr><td>OSPF</td><td>клиенту удобно (у него уже OSPF)</td><td>сложнее: domain-id, DN bit, sham link для backdoor-линков</td></tr>
<tr><td>IS-IS / RIP / EIGRP</td><td>для совместимости</td><td>редко</td></tr></table>
<h3>eBGP и одна AS на всех сайтах</h3>
<p>Клиент часто использует <b>одну приватную AS</b> (65001) на всех офисах. Маршрут из офиса 1 приходит в офис 2 с AS_PATH «64500 65001», CE2 видит свою AS в пути и <b>отбрасывает</b> (защита от петель). Решения:</p>
<ul><li><code>neighbor X as-override</code> на PE: заменить AS клиента в пути на AS провайдера («64500 64500»).</li>
<li><code>neighbor X allowas-in</code> на CE: разрешить свою AS в пути.</li>
<li><b>SoO</b> (Site of Origin, extended community): если сайт подключён к двум PE (или есть backdoor-линк), as-override убирает защиту от петли. SoO помечает маршруты сайта, чтобы не вернуть их в тот же сайт.</li></ul>
<h3>OSPF как PE–CE</h3>
<p>Ядро MPLS для OSPF клиента выглядит как <b>super backbone</b> (над area 0). Маршруты, прошедшие через ядро, приходят в другой сайт как <b>O IA</b> (межзоновые, LSA 3), если domain-id совпадает, иначе как E2. DN bit защищает от петель при двухсторонней редистрибуции. Если у клиента есть свой backdoor-линк между сайтами внутри area, путь через него (intra-area) всегда побеждает путь через провайдера (inter-area). Это лечит <b>sham link</b>: «виртуальный intra-area линк» через ядро.</p>`
    },
    {
      id: 'ts', h: 'Диагностика: «офис не видит офис»',
      html: `
<ol class="steps">
<li><b>Интерфейс в VRF?</b> <code>show ip vrf interfaces</code>. Пинг до CE из VRF: <code>ping vrf A 172.30.1.2</code>.</li>
<li><b>Маршрут клиента в VRF на локальном PE?</b> <code>show ip route vrf A</code> (PE–CE работает?).</li>
<li><b>Попал в VPNv4?</b> <code>show bgp vpnv4 unicast vrf A P</code>: RD, export RT, локальная VPN-метка. Если нет — нет redistribute (для static/OSPF) или address-family ipv4 vrf A не настроен.</li>
<li><b>Ушёл к RR/соседу?</b> <code>show bgp vpnv4 unicast all neighbors X advertised-routes</code>. Сессия vpnv4 поднята? <code>send-community extended</code>?</li>
<li><b>Пришёл на удалённый PE и импортирован?</b> <code>show bgp vpnv4 unicast all P</code> — есть ли и с каким RT; совпадает ли с import RT удалённого VRF.</li>
<li><b>В VRF удалённого PE и у удалённого CE?</b> <code>show ip route vrf A P</code>; PE–CE анонсирует ли (as-override?).</li>
<li><b>Data plane:</b> <code>show ip cef vrf A P detail</code> — две метки? Транспортный LSP до next-hop живой (глава 10)? <code>show mpls forwarding-table vrf A</code> на egress.</li>
<li><b>Обратное направление</b> — всё то же самое для маршрута второго офиса. И MTU (две метки +8 байт).</li></ol>
<div class="callout pro"><b>Из практики</b>Самые частые причины: опечатка в RT (import 64500:11 вместо 64500:1), не настроен redistribute connected/static в address-family VRF, нет send-community extended к RR, CE с одинаковой AS без as-override, транспортный LSP разорван после работ, MTU клиента 1500 и ядро 1500.</div>`
    },
    {
      id: 'interas', h: 'Inter-AS и CSC: когда VPN выходит за пределы одной AS',
      html: `
<p>Клиент с офисами в зоне двух разных провайдеров (или двух AS одного холдинга). Варианты стыка (RFC 4364, раздел 10):</p>
<table><tr><th>Option</th><th>Как</th><th>Плюсы / минусы</th></tr>
<tr><td><b>A</b> (back-to-back VRF)</td><td>ASBR двух сетей соединены как PE–CE: сабинтерфейс и сессия на каждый VRF</td><td>просто и безопасно (нет обмена метками), но не масштабируется: по сабинтерфейсу на каждого клиента</td></tr>
<tr><td><b>B</b></td><td>ASBR обмениваются VPNv4-маршрутами по eBGP с метками</td><td>масштабируется, но ASBR держат VPN-маршруты всех общих клиентов, нужна договорённость по RT</td></tr>
<tr><td><b>C</b></td><td>обмен loopback'ами PE с метками (BGP-LU), VPNv4 — multihop между RR</td><td>максимальный масштаб, но сети сильно доверяют друг другу. Обычно внутри одной компании</td></tr></table>
<p><b>CSC</b> (Carrier Supporting Carrier) — провайдер возит через свой L3VPN сеть другого провайдера (с его метками). На практике Option A — самый распространённый стык между разными компаниями.</p>`
    }
  ],
  cmds: [
    { g: 'VRF' },
    { c: 'vrf definition A\n rd 64500:101\n address-family ipv4\n  route-target export 64500:1\n  route-target import 64500:1', d: 'VRF с RD и RT', hw: 'ip vpn-instance A\n ipv4-family\n  route-distinguisher 64500:101\n  vpn-target 64500:1 both', jn: 'set routing-instances A instance-type vrf route-distinguisher 64500:101 vrf-target target:64500:1' },
    { c: 'interface X\n vrf forwarding A\n ip address …', d: 'Интерфейс в VRF (адрес снимается — задать заново)', hw: 'ip binding vpn-instance A', jn: 'set routing-instances A interface X' },
    { c: 'show ip vrf [detail] / show vrf', d: 'VRF, RD, RT, интерфейсы', hw: 'display ip vpn-instance verbose', jn: 'show route instance detail' },
    { c: 'show ip route vrf A / ping vrf A X', d: 'Таблица VRF / пинг из VRF', hw: 'display ip routing-table vpn-instance A / ping -vpn-instance A X', jn: 'show route table A.inet.0 / ping X routing-instance A' },
    { g: 'MP-BGP' },
    { c: 'router bgp 64500\n address-family vpnv4\n  neighbor X activate\n  neighbor X send-community extended', d: 'VPNv4 с PE/RR', hw: 'ipv4-family vpnv4\n peer X enable', jn: 'family inet-vpn unicast' },
    { c: ' address-family ipv4 vrf A\n  neighbor CE remote-as 65001\n  neighbor CE activate\n  redistribute connected | static', d: 'PE–CE и редистрибуция в VRF', hw: 'ipv4-family vpn-instance A\n peer CE as-number 65001', jn: 'routing-instances A protocols bgp' },
    { c: 'neighbor CE as-override', d: 'Заменить AS клиента своей (одна AS на всех сайтах)', hw: 'peer CE substitute-as', jn: 'as-override' },
    { c: 'neighbor X allowas-in [N]', d: 'Разрешить свою AS в пути (на CE)', hw: 'peer X allow-as-loop', jn: 'loops 2' },
    { c: 'neighbor CE soo 64500:11 / set extcommunity soo', d: 'Site of Origin', hw: 'peer CE soo 64500:11', jn: 'community SOO members origin:64500:11' },
    { c: 'show bgp vpnv4 unicast all [P]', d: 'VPNv4-таблица по RD', hw: 'display bgp vpnv4 all routing-table', jn: 'show route table bgp.l3vpn.0' },
    { c: 'show bgp vpnv4 unicast vrf A P', d: 'Маршрут в VRF: RT, next-hop, метки in/out', hw: 'display bgp vpnv4 vpn-instance A routing-table P', jn: 'show route table A.inet.0 P extensive' },
    { c: 'label mode per-vrf (address-family ipv4 vrf)', d: 'Одна VPN-метка на VRF', hw: 'apply-label per-instance', jn: 'vrf-table-label' },
    { g: 'Data plane' },
    { c: 'show ip cef vrf A P detail', d: 'Стек меток на ingress (транспорт + VPN)', hw: 'display fib vpn-instance A P', jn: 'show route forwarding-table vpn A destination P' },
    { c: 'show mpls forwarding-table vrf A', d: 'VPN-метки на egress', hw: 'display mpls lsp vpn-instance A', jn: 'show route table mpls.0' },
    { c: 'traceroute vrf A X', d: 'Трассировка из VRF', hw: 'tracert -vpn-instance A X', jn: 'traceroute X routing-instance A' },
    { g: 'OSPF в VRF' },
    { c: 'router ospf 10 vrf B\n redistribute bgp 64500 subnets\nrouter bgp 64500\n address-family ipv4 vrf B\n  redistribute ospf 10', d: 'OSPF PE–CE с двусторонней редистрибуцией', hw: 'ospf 10 vpn-instance B\n import-route bgp', jn: 'routing-instances B protocols ospf export' },
    { c: 'area 0 sham-link SRC DST cost 10', d: 'Sham link для backdoor', hw: 'sham-link SRC DST', jn: 'sham-link local X' }
  ],
  cards: [
    ['Что такое VRF?', 'Отдельная таблица маршрутизации и FIB внутри маршрутизатора. Интерфейс принадлежит одному VRF, адреса разных VRF могут пересекаться.'],
    ['RD — что делает и что не делает?', 'Делает IPv4-префикс уникальным в VPNv4 (RD:prefix). Не определяет, куда маршрут импортируется.'],
    ['RT — что делает?', 'Extended community — политика: export RT помечает маршруты, import RT решает, в какой VRF их забрать. Определяет топологию VPN.'],
    ['Мнемоника RD и RT?', 'RD — паспорт (уникальность), RT — пропуск (куда пускают).'],
    ['Зачем уникальный RD на каждом PE?', 'Сайт подключён к двум PE: с одинаковым RD RR видит один префикс и отражает только лучший путь. С разными RD отражаются оба (ECMP, быстрый резерв).'],
    ['Что такое VPNv4-маршрут?', 'RD (8 байт) + IPv4-префикс, с атрибутами: RT (ext community), next-hop = loopback PE, VPN-метка.'],
    ['Что нужно, чтобы RT дошли до соседа на Cisco?', 'neighbor X send-community extended (или both) в address-family vpnv4.'],
    ['Две метки в L3VPN — какие и зачем?', 'Внешняя — транспортная (LDP/SR) до loopback egress PE. Внутренняя — VPN-метка (из MP-BGP), определяет VRF/префикс на egress PE.'],
    ['Почему одной транспортной метки мало?', 'После PHP PE получил бы голый IP и не знал бы, какому VRF он принадлежит: адреса клиентов пересекаются.'],
    ['Per-prefix vs per-VRF метки?', 'Per-prefix: метка на префикс, egress шлёт без IP-lookup, много меток. Per-VRF: одна на VRF, egress делает lookup в VRF, экономно.'],
    ['Что делает PE, если пришёл VPNv4-маршрут с RT, который ни один его VRF не импортирует?', 'Отбрасывает (RT-фильтрация) — экономия памяти.'],
    ['Hub-and-spoke через RT?', 'Споки: export SPOKE, import HUB. Хаб: export HUB, import SPOKE. Споки общаются только через хаб.'],
    ['Extranet / shared services?', 'Сервисный VRF экспортирует RT SVC, клиенты импортируют SVC. Сервис импортирует RT клиентов (лучше только нужные префиксы). Проблема — пересекающиеся адреса клиентов.'],
    ['Почему CE с одной AS на всех сайтах не принимает маршруты других сайтов?', 'Видит свою AS в AS_PATH → loop prevention. Решения: as-override на PE или allowas-in на CE.'],
    ['Зачем SoO?', 'Site of Origin помечает маршруты сайта, чтобы не вернуть их в тот же сайт (сайт с двумя PE или backdoor), когда as-override убрал защиту AS_PATH.'],
    ['Как выглядят OSPF-маршруты клиента, прошедшие через MPLS-ядро?', 'O IA (LSA 3), если domain-id совпадает. Ядро — super backbone. Иначе E2.'],
    ['Зачем sham link?', 'Если у клиента есть backdoor-линк внутри area, intra-area путь через него всегда лучше inter-area через провайдера. Sham link делает путь через ядро intra-area.'],
    ['VRF-lite vs MPLS L3VPN?', 'VRF-lite — разделение без MPLS, на каждом линке и устройстве по VLAN на VRF. L3VPN — ядро ничего не знает о клиентах, всё на PE.'],
    ['Inter-AS Option A/B/C — суть?', 'A: back-to-back VRF (сабинтерфейс на VRF) — просто, не масштабируется. B: eBGP VPNv4 между ASBR. C: обмен loopback\'ами PE с метками, VPNv4 между RR — масштабно, но много доверия.'],
    ['Порядок проверки «офис не видит офис»?', 'Интерфейс в VRF → маршрут в VRF локально → VPNv4 (RD/RT/метка) → отдан соседу/RR → пришёл и импортирован (RT) → в VRF и у CE удалённо → метки/LSP → обратное направление и MTU.']
  ],
  quiz: [
    { q: 'У двух клиентов одинаковая сеть 10.1.1.0/24. Что позволяет BGP переносить оба префикса одновременно?', o: ['Разные RT', 'Разные RD — VPNv4-префиксы становятся уникальными', 'Разные VPN-метки', 'Разные next-hop'], a: 1, e: 'Уникальность префикса в BGP даёт RD. RT — политика импорта.' },
    { q: 'Маршрут офиса A1 есть в VPNv4 на PE2, но не попал в VRF A на PE2. Наиболее вероятная причина?', o: ['Разные RD', 'Import RT VRF A на PE2 не совпадает с export RT маршрута', 'Нет LDP', 'Нет as-override'], a: 1, e: 'Импорт решается только по RT. RD на импорт не влияет.' },
    { q: 'На PE1 и PE2 VPNv4-сессия Established, VRF настроены верно, но в VPNv4 на PE2 маршрутов PE1 нет. На PE1 в advertised-routes они есть. Чего не хватает?', o: ['as-override', 'send-community extended (RT не дошли, маршруты без RT отброшены)', 'RD', 'mpls ip'], a: 1, e: 'Без RT маршрут не импортируется ни в один VRF и отбрасывается RT-фильтрацией.' },
    { q: 'Что увидит PE2, получив пакет с одной VPN-меткой 30 (транспортная снята PHP)?', o: ['Будет делать IP-lookup в глобальной таблице', 'По LFIB: метка 30 → VRF A (и интерфейс CE или lookup в VRF)', 'Отбросит пакет', 'Вернёт PE1'], a: 1, e: 'VPN-метка выбирает VRF/префикс.' },
    { q: 'Клиент использует AS65001 во всех офисах. Офис 2 не получает маршруты офиса 1, хотя на PE2 они в VRF есть. Решение? (несколько)', o: ['neighbor CE2 as-override на PE2', 'neighbor PE2 allowas-in на CE2', 'Сменить RD', 'send-community extended'], a: [0, 1], e: 'CE отбрасывает маршрут со своей AS в пути. Подменить AS (PE) или разрешить её (CE).' },
    { q: 'Как сделать hub-and-spoke L3VPN?', o: ['Разные RD хабу и спокам', 'Споки export SPOKE / import HUB; хаб export HUB / import SPOKE', 'Только статические маршруты', 'Запретить LDP между споками'], a: 1, e: 'Топология VPN полностью задаётся RT.' },
    { q: 'Сервисный VRF (общий DNS) импортирует маршруты клиентов A и B, у обоих 10.1.1.0/24. Что произойдёт?', o: ['Всё работает', 'Конфликт: в VRF SVC один префикс от двух клиентов, выберется один, второй клиент не получит ответы', 'BGP упадёт', 'RD решит проблему'], a: 1, e: 'В одной таблице VRF уникальность RD уже не помогает. Нужны уникальные адреса (NAT, /32) для экспорта в сервис.' },
    { q: 'Сайт клиента подключён к PE1 и PE2, RD одинаковый на всех PE. Через RR удалённый PE3 видит только один путь. Почему и что сделать?', o: ['Так задумано', 'RR видит одинаковый VPNv4-префикс и отражает лучший; уникальный RD на PE даст оба пути', 'Нужен as-override', 'Нужен sham link'], a: 1, e: 'С уникальными RD это два разных префикса, RR отразит оба.' },
    { q: 'В show ip cef vrf A 10.1.2.0 detail на PE1: «label 17 30». Что это?', o: ['Две VPN-метки', '17 — транспортная до PE2 (LDP), 30 — VPN-метка префикса', '17 — VPN, 30 — транспорт', 'Ошибка'], a: 1, e: 'Сверху транспортная, снизу (bottom of stack) сервисная.' },
    { q: 'OSPF PE–CE. У клиента есть свой backdoor-линк между офисами в area 0. Трафик всегда идёт через backdoor, а не через провайдера. Почему и как изменить?', o: ['Метрика провайдера выше', 'Путь через backdoor intra-area, а через MPLS — inter-area (O IA); нужен sham link', 'Нужен as-override', 'Нужен другой RD'], a: 1, e: 'Intra-area всегда побеждает inter-area. Sham link делает путь через ядро intra-area.' },
    { q: 'Какой Inter-AS вариант чаще всего используется между разными компаниями?', o: ['Option A (back-to-back VRF)', 'Option C', 'CSC', 'Option D'], a: 0, e: 'Простой и безопасный (нет обмена метками и VPNv4), хотя и плохо масштабируется.' },
    { q: 'После «vrf forwarding A» на интерфейсе PE пропал линк с CE. Почему?', o: ['VRF блокирует трафик', 'Команда снимает IP-адрес с интерфейса — его нужно задать заново', 'Нужен RD', 'Нужен LDP'], a: 1, e: 'Классика при первичной настройке VRF.' }
  ],
  und: [
    { q: 'Объясни разницу между RD и RT на примере двух клиентов с одинаковыми адресами и общего сервиса (DNS провайдера).', a: '<p>У клиентов A и B одна и та же сеть 10.1.1.0/24. В BGP это был бы один префикс, поэтому каждому VRF дают свой RD: в VPNv4 получаются два разных префикса 64500:1:10.1.1.0/24 и 64500:2:10.1.1.0/24, и BGP переносит оба. RD — только уникальность. Куда маршрут попадёт, решает RT: маршруты A помечены RT 64500:1 и импортируются только в VRF A на других PE, маршруты B — RT 64500:2 и только в VRF B. DNS провайдера в VRF SVC экспортирует RT 64500:100, и оба клиента его импортируют: видят DNS, но не видят друг друга. Чтобы DNS отвечал обоим, VRF SVC должен импортировать маршруты клиентов, а у них пересечение адресов: в одной таблице SVC RD уже не поможет. Нужны уникальные адреса для сервиса (NAT или /32).</p>', k: ['RD → уникальность VPNv4', 'RT → импорт/экспорт, топология', 'пример с A, B, SVC', 'пересечение адресов в общем VRF'] },
    { q: 'Пройди путь маршрута и пакета в L3VPN: от анонса сети офиса 1 до того, как пакет из офиса 2 доходит до неё. Назови все метки.', a: '<p>Маршрут: CE1 анонсирует 10.1.1.0/24 в PE1 (eBGP) → таблица VRF A на PE1 → экспорт в VPNv4: RD, export RT, VPN-метка (например 24), next-hop PE1 → MP-BGP через RR на PE2 (с send-community extended) → PE2 импортирует по RT в VRF A, запоминает next-hop PE1 и метку 24 → анонс CE2. Пакет: CE2 → PE2 в VRF A, lookup: next-hop PE1, VPN-метка 24 → PE2 навешивает 24, сверху транспортную метку к loopback PE1 (LDP) → P делают swap по транспортной, предпоследний делает PHP → PE1 получает пакет с меткой 24, по LFIB: VRF A, к CE1 → снимает метку, отдаёт IP.</p>', k: ['VRF → VPNv4 (RD, RT, VPN label)', 'MP-BGP / RR', 'импорт по RT', 'push VPN + транспорт', 'swap и PHP', 'VPN-метка выбирает VRF'] },
    { q: 'Заявка: «новый офис клиента подключили, он видит центральный офис, но не видит остальные филиалы». Какие гипотезы и как проверишь?', a: '<p>Видит центр, значит базовый VPN работает (LSP, VPNv4, VRF на новом PE). Гипотезы: 1) топология hub-and-spoke по RT — так и задумано (споки импортируют только RT хаба), уточнить договор; 2) новый VRF импортирует не все RT (опечатка, у филиалов другой RT), проверить <code>show ip vrf detail</code> и RT маршрутов филиалов в <code>show bgp vpnv4 unicast all</code>; 3) у филиалов нет импорта RT нового офиса — проверить в обратную сторону; 4) одна AS у всех сайтов без as-override на новом PE (центр может быть с другой AS); 5) фильтры на CE или PE. Проверять в обе стороны по цепочке из восьми шагов.</p>', k: ['центр виден → транспорт ок', 'RT импорт/экспорт и топология', 'обратное направление', 'as-override / AS клиента', 'фильтры'] }
  ],
  lab: {
    title: 'Лаба 11. Два клиента с одинаковыми адресами и общий сервис',
    time: '≈ 4 часа',
    goal: `<p>Ядро провайдера (PE1–P1–PE2, IS-IS + LDP уже работают). Клиент A (два офиса, eBGP, одна AS 65001 на оба), клиент B (два офиса, static и OSPF) — <b>с одинаковой адресацией</b>. Плюс общий сервис SVC (DNS провайдера). Собрать L3VPN, разобраться с метками, as-override, OSPF в VRF, extranet и типовыми поломками.</p>`,
    topo: {
      w: 900, h: 470,
      zones: [{ x: 230, y: 120, w: 440, h: 200, label: 'Ядро AS64500 · IS-IS · LDP', c: '#7c3aed' }],
      nodes: [
        { id: 'A1', t: 'ce', x: 80, y: 90, label: 'A1 AS65001\nLAN 10.1.1.0/24', role: 'клиент A, офис 1' },
        { id: 'B1', t: 'ce', x: 80, y: 360, label: 'B1 (static)\nLAN 10.1.1.0/24', role: 'клиент B, офис 1', color: '#059669' },
        { id: 'PE1', t: 'pe', x: 290, y: 220, label: 'PE1\nLo0 10.255.0.1', role: 'PE' },
        { id: 'P1', t: 'p', x: 450, y: 220, label: 'P1\nLo0 10.255.0.2', role: 'P' },
        { id: 'PE2', t: 'pe', x: 610, y: 220, label: 'PE2\nLo0 10.255.0.3', role: 'PE' },
        { id: 'A2', t: 'ce', x: 820, y: 90, label: 'A2 AS65001\nLAN 10.1.2.0/24', role: 'клиент A, офис 2' },
        { id: 'B2', t: 'ce', x: 820, y: 360, label: 'B2 (OSPF)\nLAN 10.1.2.0/24', role: 'клиент B, офис 2', color: '#059669' },
        { id: 'SVC', t: 'router', x: 610, y: 420, label: 'SVC DNS провайдера\n172.31.100.1', role: 'общий сервис', color: '#b45309' }
      ],
      links: [['A1', 'Gi0/0', 'PE1', 'Gi0/1', '172.30.1.0/30'], ['B1', 'Gi0/0', 'PE1', 'Gi0/2', '172.30.1.0/30'], ['PE1', 'Gi0/0', 'P1', 'Gi0/0'], ['P1', 'Gi0/1', 'PE2', 'Gi0/0'], ['PE2', 'Gi0/1', 'A2', 'Gi0/0', '172.30.2.0/30'], ['PE2', 'Gi0/2', 'B2', 'Gi0/0', '172.30.2.0/30'], ['PE2', 'Gi0/3', 'SVC', 'Gi0/0', '172.31.0.0/30']]
    },
    addr: [['PE–CE', 'A1/B1 ↔ PE1', '172.30.1.0/30 у <b>обоих</b> клиентов: PE .1, CE .2'], ['PE–CE', 'A2/B2 ↔ PE2', '172.30.2.0/30 у обоих: PE .1, CE .2'], ['PE2–SVC', '172.31.0.0/30', 'PE2 .1, SVC .2'], ['Ядро', '10.1.12.0/31, 10.1.23.0/31', 'PE1–P1, P1–PE2'], ['RD / RT', 'A / B / SVC', 'RD <Lo0>:1/2/100 · RT 64500:1 / 64500:2 / 64500:100']],
    init: (function () {
      const core = (h, n) => `hostname ${h}\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.${n} 255.255.255.255\n ip router isis CORE\nmpls ldp router-id Loopback0 force\nrouter isis CORE\n net 49.0001.0000.0000.000${n}.00\n is-type level-2-only\n metric-style wide\n passive-interface Loopback0\n mpls ldp autoconfig\nline con 0\n logging synchronous\n exec-timeout 0 0\n`;
      const i = (ifc, ip) => `interface ${ifc}\n ip address ${ip} 255.255.255.254\n ip router isis CORE\n isis network point-to-point\n no shutdown\n`;
      const up = ifc => `interface ${ifc}\n no shutdown\n`;
      return {
        PE1: core('PE1', 1) + i('Gi0/0', '10.1.12.0') + up('Gi0/1') + up('Gi0/2'),
        P1: core('P1', 2) + i('Gi0/0', '10.1.12.1') + i('Gi0/1', '10.1.23.0'),
        PE2: core('PE2', 3) + i('Gi0/0', '10.1.23.1') + up('Gi0/1') + up('Gi0/2') + up('Gi0/3'),
        A1: 'hostname A1\nno ip domain-lookup\ninterface Loopback1\n ip address 10.1.1.1 255.255.255.0\ninterface Gi0/0\n ip address 172.30.1.2 255.255.255.252\n no shutdown\nrouter bgp 65001\n network 10.1.1.0 mask 255.255.255.0\n neighbor 172.30.1.1 remote-as 64500\nline con 0\n logging synchronous\n exec-timeout 0 0',
        A2: 'hostname A2\nno ip domain-lookup\ninterface Loopback1\n ip address 10.1.2.1 255.255.255.0\ninterface Gi0/0\n ip address 172.30.2.2 255.255.255.252\n no shutdown\nrouter bgp 65001\n network 10.1.2.0 mask 255.255.255.0\n neighbor 172.30.2.1 remote-as 64500\nline con 0\n logging synchronous\n exec-timeout 0 0',
        B1: 'hostname B1\nno ip domain-lookup\ninterface Loopback1\n ip address 10.1.1.1 255.255.255.0\ninterface Gi0/0\n ip address 172.30.1.2 255.255.255.252\n no shutdown\nip route 0.0.0.0 0.0.0.0 172.30.1.1\nline con 0\n logging synchronous\n exec-timeout 0 0',
        B2: 'hostname B2\nno ip domain-lookup\ninterface Loopback1\n ip address 10.1.2.1 255.255.255.0\n ip ospf network point-to-point\n ip ospf 1 area 0\ninterface Gi0/0\n ip address 172.30.2.2 255.255.255.252\n ip ospf 1 area 0\n no shutdown\nrouter ospf 1\n router-id 10.1.2.1\nline con 0\n logging synchronous\n exec-timeout 0 0',
        SVC: 'hostname SVC\nno ip domain-lookup\ninterface Loopback1\n ip address 172.31.100.1 255.255.255.0\ninterface Gi0/0\n ip address 172.31.0.2 255.255.255.252\n no shutdown\nrouter bgp 65100\n network 172.31.100.0 mask 255.255.255.0\n neighbor 172.31.0.1 remote-as 64500\nline con 0\n logging synchronous\n exec-timeout 0 0'
      };
    })(),
    pre: 'Ядро (IS-IS, LDP) уже работает: проверь <code>show mpls ldp neighbor</code> на P1. CE полностью настроены. Обрати внимание: у A и B <b>одинаковые</b> адреса PE–CE и LAN — без VRF это невозможно.',
    tasks: [
      { t: 'VRF и перекрытие адресов', d: 'На PE1 и PE2 создай VRF A (RD 10.255.0.N:1, RT 64500:1) и B (RD 10.255.0.N:2, RT 64500:2). Помести интерфейсы к CE в нужные VRF и назначь адреса 172.30.x.1/30. Убедись, что <code>ping vrf A 172.30.1.2</code> и <code>ping vrf B 172.30.1.2</code> отвечают разные маршрутизаторы. Попробуй обычный <code>ping 172.30.1.2</code> без VRF — почему не работает?',
        check: 'PE1#show vrf\nPE1#show ip vrf interfaces\nPE1#ping vrf A 172.30.1.2\nPE1#ping vrf B 172.30.1.2\nPE1#show ip route vrf A',
        sol: 'PE1(config)#vrf definition A\nPE1(config-vrf)#rd 10.255.0.1:1\nPE1(config-vrf)#address-family ipv4\nPE1(config-vrf-af)#route-target both 64500:1\nPE1(config)#vrf definition B\nPE1(config-vrf)#rd 10.255.0.1:2\nPE1(config-vrf)#address-family ipv4\nPE1(config-vrf-af)#route-target both 64500:2\nPE1(config)#interface Gi0/1\nPE1(config-if)#vrf forwarding A\nPE1(config-if)#ip address 172.30.1.1 255.255.255.252\nPE1(config)#interface Gi0/2\nPE1(config-if)#vrf forwarding B\nPE1(config-if)#ip address 172.30.1.1 255.255.255.252' },
      { t: 'MP-BGP VPNv4 между PE', d: 'iBGP PE1 ↔ PE2 по loopback только в address-family vpnv4 (в ipv4 unicast выключи: <code>no bgp default ipv4-unicast</code>), с <code>send-community extended</code>.',
        check: 'PE1#show bgp vpnv4 unicast all summary',
        sol: 'PE1(config)#router bgp 64500\nPE1(config-router)#bgp router-id 10.255.0.1\nPE1(config-router)#no bgp default ipv4-unicast\nPE1(config-router)#neighbor 10.255.0.3 remote-as 64500\nPE1(config-router)#neighbor 10.255.0.3 update-source Loopback0\nPE1(config-router)#address-family vpnv4\nPE1(config-router-af)#neighbor 10.255.0.3 activate\nPE1(config-router-af)#neighbor 10.255.0.3 send-community extended' },
      { t: 'Клиент A: eBGP и as-override', d: 'Подними eBGP с A1 и A2 в <code>address-family ipv4 vrf A</code>. Получил ли A2 маршрут 10.1.1.0/24? Посмотри на A2 <code>show ip bgp</code> и <code>debug ip bgp updates</code>, найди причину. Почини с помощью as-override на PE. Пингани A1 Lo1 ↔ A2 Lo1.',
        check: 'PE2#show bgp vpnv4 unicast vrf A\nA2#show ip bgp\nA1#ping 10.1.2.1 source Lo1\nA1#traceroute 10.1.2.1 source Lo1 numeric',
        sol: 'PE1(config-router)#address-family ipv4 vrf A\nPE1(config-router-af)#neighbor 172.30.1.2 remote-as 65001\nPE1(config-router-af)#neighbor 172.30.1.2 activate\nPE1(config-router-af)#neighbor 172.30.1.2 as-override\n! PE2 так же к 172.30.2.2' },
      { t: 'Клиент B: static на одной стороне, OSPF на другой', d: 'На PE1: статический маршрут в VRF B к 10.1.1.0/24 через B1 и <code>redistribute static</code> + <code>redistribute connected</code> в BGP VRF B. На PE2: OSPF 10 в VRF B с B2 и двусторонняя редистрибуция OSPF ↔ BGP. Каким кодом видит B2 сеть 10.1.1.0/24 (O E2? O IA?) и почему?',
        check: 'B2#show ip route ospf\nPE2#show ip route vrf B\nB2#ping 10.1.1.1 source Lo1',
        sol: 'PE1(config)#ip route vrf B 10.1.1.0 255.255.255.0 172.30.1.2\nPE1(config)#router bgp 64500\nPE1(config-router)#address-family ipv4 vrf B\nPE1(config-router-af)#redistribute static\nPE1(config-router-af)#redistribute connected\nPE2(config)#router ospf 10 vrf B\nPE2(config-router)#redistribute bgp 64500 subnets\nPE2(config)#interface Gi0/2\nPE2(config-if)#vrf forwarding B\nPE2(config-if)#ip address 172.30.2.1 255.255.255.252\nPE2(config-if)#ip ospf 10 area 0\nPE2(config)#router bgp 64500\nPE2(config-router)#address-family ipv4 vrf B\nPE2(config-router-af)#redistribute ospf 10\nPE2(config-router-af)#redistribute connected\n! статика с PE1 приходит в OSPF как E2 (внешняя изначально)' },
      { t: 'Метки своими глазами', d: 'Для пакета A1 → 10.1.2.1 найди: VPN-метку в <code>show bgp vpnv4 unicast vrf A 10.1.2.0</code> на PE1 (out label), транспортную метку в <code>show ip cef vrf A 10.1.2.1 detail</code>, что делает P1, что видит PE2 (<code>show mpls forwarding-table vrf A</code>). Сними захват PE1–P1 и найди стек из двух меток. Сравни с пакетом клиента B: какая метка отличается?',
        check: 'PE1#show bgp vpnv4 unicast vrf A 10.1.2.0\nPE1#show ip cef vrf A 10.1.2.1 detail\nP1#show mpls forwarding-table\nPE2#show mpls forwarding-table vrf A' },
      { t: 'Общий сервис (extranet)', d: 'На PE2 VRF SVC (RD 10.255.0.3:100, export 64500:100, import 64500:100). eBGP с SVC. Сделай так, чтобы A и B видели 172.31.100.0/24 (добавь import 64500:100 в VRF A и B на обоих PE), а SVC видел обоих клиентов (import 64500:1 и 64500:2). Что SVC видит для 10.1.1.0/24? Кому он сможет ответить?',
        hint: 'В VRF SVC придут два одинаковых префикса 10.1.1.0/24 (от A и от B с разными RD). Выберется один лучший. Это и есть проблема extranet с пересекающимися адресами. Правильное решение — экспортировать в SVC только уникальные адреса (export map, NAT).',
        check: 'PE2#show ip route vrf SVC\nPE2#show bgp vpnv4 unicast vrf SVC 10.1.1.0\nA1#ping 172.31.100.1 source Lo1\nB1#ping 172.31.100.1 source Lo1' },
      { t: 'Export map: аккуратный extranet', d: 'Исправь extranet: пусть клиенты экспортируют в SVC только по одному уникальному адресу. Добавь на A1 Loopback10 100.64.1.1/32, на B1 — 100.64.2.1/32 и анонсируй их (A1 — через BGP, B1 — статикой на PE1). На PE через <code>export map</code> помечай RT 64500:100 только эти /32, а VRF SVC импортируй только 64500:100 (без 64500:1 и 64500:2).',
        check: 'PE2#show ip route vrf SVC\nA1#ping 172.31.100.1 source Lo10\nB1#ping 172.31.100.1 source Lo10' }
    ],
    brk: [
      { t: 'A2 потерял маршрут к офису A1, на PE2 его нет в VRF A', inj: 'PE2(config)#vrf definition A\nPE2(config-vrf)#address-family ipv4\nPE2(config-vrf-af)#no route-target import 64500:1\nPE2(config-vrf-af)#route-target import 64500:11', h: '<code>show bgp vpnv4 unicast all 10.1.1.0</code> на PE2 — есть ли маршрут и с каким RT? <code>show vrf detail A</code> — import RT.', f: 'Опечатка в import RT (64500:11). Маршрут A1 приходит с RT 64500:1, VRF A на PE2 его не импортирует, и маршрут отбрасывается. Исправь import RT.' },
      { t: 'После «перенастройки соседства» на PE1 нет ни одного VPN-маршрута от PE2', inj: 'PE1(config)#router bgp 64500\nPE1(config-router)#address-family vpnv4\nPE1(config-router-af)#no neighbor 10.255.0.3 send-community extended\n! то же на PE2, затем clear bgp vpnv4 unicast * soft', h: 'Сессия Established? <code>show bgp vpnv4 unicast all neighbors 10.255.0.3 routes</code>. Видны ли RT в маршрутах?', f: 'Без extended community маршруты приходят без RT. Ни один VRF их не импортирует, все отброшены. Верни send-community extended (обе стороны).' },
      { t: 'B1 «отвалился»: PE1 не пингует его из VRF B', inj: 'PE1(config)#interface Gi0/2\nPE1(config-if)#no vrf forwarding B\nPE1(config-if)#vrf forwarding B', h: '<code>show ip interface brief</code> — какой адрес у Gi0/2? <code>show run interface Gi0/2</code>.', f: 'Повторное <code>vrf forwarding</code> снимает IP-адрес с интерфейса. Нужно заново задать 172.30.1.1/30. Типичная ловушка при переносе интерфейса между VRF.' },
      { t: 'Офисы клиента A пингуются маленькими пакетами, а файлы между ними не копируются', inj: 'P1(config)#interface Gi0/1\nP1(config-if)#mtu 1500\nP1(config-if)#mpls mtu 1500\n! и сымитируй на A1: ping 10.1.2.1 size 1500 df-bit', h: 'Пинг с DF разных размеров между A1 и A2. Сколько байт добавляют две метки? MTU на линках ядра?', f: 'Две метки (+8 байт) не помещаются в MTU 1500 на линке P1–PE2: полноразмерные пакеты клиента дропаются. MTU ядра должен быть больше MTU клиента со стеком меток (обычно 9000+). На vIOS поведение MTU может отличаться от реального железа, но принцип важен.' }
    ],
    extra: '<p><b>Hub-and-spoke.</b> Добавь третий офис клиента A за PE1 (A3) и переделай VPN A в hub-and-spoke: A1 — хаб (export HUB 64500:10, import SPOKE 64500:11), A2 и A3 — споки (export SPOKE, import HUB). Проверь traceroute A2 → A3: он должен идти через A1. Подумай, что нужно на хабе, чтобы трафик между споками действительно разворачивался (два интерфейса или двухсторонний VRF на PE хаба).</p>'
  }
});
