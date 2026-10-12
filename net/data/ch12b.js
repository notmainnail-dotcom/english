COURSE.add({
  id: 'ch12b',
  time: '≈ 10 часов',
  intro: `<p><b>EVPN</b> — современная замена VPLS и основа L2/L3-сервисов у провайдеров и в ЦОД. Главная идея одна: MAC-адреса (и IP) клиентов распространяются <b>через BGP</b>, а не учатся флудом. Отсюда всё остальное: active-active подключение клиента к двум PE, быстрая сходимость, ARP suppression, распределённый шлюз, единый подход к L2 и L3. Под EVPN может быть MPLS (у провайдера) или VXLAN (в ЦОД) — control plane одинаковый.</p>`,
  goals: [
    'Объяснить, какие проблемы VPLS решает EVPN и как',
    'Знать типы маршрутов EVPN 1–5 и для чего каждый',
    'Понимать EVI, RD/RT в EVPN, VLAN-based и VLAN-aware сервисы, EVPN-VPWS',
    'Объяснить MAC mobility, ARP suppression, обработку BUM (type 3)',
    'Понимать IRB: anycast gateway, symmetric и asymmetric, type-5',
    'Настроить EVPN-VXLAN на Arista vEOS и читать show bgp evpn'
  ],
  why: `Новые провайдерские L2/L3-сервисы (E-Line, E-LAN, ЦОД-интерконнект) строят на EVPN, и старые VPLS мигрируют туда же. В ЦОД (и в облаках самого провайдера) EVPN-VXLAN — стандарт фабрики. Через пару лет EVPN будет в каждой второй заявке.`,
  refs: [
    { t: 'RFC 7432 — BGP MPLS-Based Ethernet VPN', u: 'https://www.rfc-editor.org/rfc/rfc7432', n: 'первоисточник EVPN' },
    { t: 'RFC 8365 — Network Virtualization Overlay Solution Using EVPN (VXLAN)', u: 'https://www.rfc-editor.org/rfc/rfc8365' },
    { t: 'RFC 9135 — Integrated Routing and Bridging in EVPN; RFC 9136 — IP Prefix Advertisement (type 5)', u: 'https://www.rfc-editor.org/rfc/rfc9135' },
    { t: 'RFC 8214 — Virtual Private Wire Service Support in EVPN', u: 'https://www.rfc-editor.org/rfc/rfc8214' },
    { t: 'linkmeup — СДСМ 12.1. MPLS EVPN', u: 'https://linkmeup.ru/blog/1221/' },
    { t: 'Arista EVPN Deployment Guide / Juniper Day One: Data Center Fundamentals', n: 'практика EVPN-VXLAN' }
  ],
  theory: [
    {
      id: 'idea', h: 'Идея EVPN: MAC через BGP',
      html: `
<table><tr><th>Проблема VPLS</th><th>Как решает EVPN</th></tr>
<tr><td>MAC учатся флудом в data plane</td><td>PE, узнав MAC локального клиента, анонсирует его через <b>MP-BGP</b> (route type 2). Остальные PE заранее знают, за каким PE этот MAC. Unknown unicast почти исчезает</td></tr>
<tr><td>нет active-active multihoming</td><td><b>Ethernet Segment</b> (ESI): клиент подключён LAG-ом к двум и более PE, оба активны (глава 12.2)</td></tr>
<tr><td>медленная сходимость при отказе PE</td><td><b>mass withdraw</b>: один отзыв type 1 на весь сегмент вместо ожидания старения тысяч MAC</td></tr>
<tr><td>full mesh PW, ручные соседи</td><td>BGP с RR: PE находят друг друга сами, никаких PW между PE</td></tr>
<tr><td>ARP-флуд в большом L2</td><td>MAC+IP в type 2, поэтому PE сам отвечает на ARP (<b>ARP suppression / proxy</b>)</td></tr>
<tr><td>L2 и L3 — разные сервисы</td><td><b>IRB</b>: распределённый anycast-шлюз, маршрутизация между подсетями на ближайшем PE, type 5 для префиксов</td></tr></table>
<p>Термины: <b>EVI</b> (EVPN instance) — экземпляр сервиса (как VRF для L2). <b>MAC-VRF</b> — таблица MAC в EVI на PE. Для EVI есть <b>RD</b> (уникальность) и <b>RT</b> (кто импортирует), всё как в L3VPN (глава 11). Address family BGP — <b>l2vpn evpn</b> (AFI 25, SAFI 70).</p>`
    },
    {
      id: 'types', h: 'Типы маршрутов EVPN',
      html: `
<table><tr><th>Type</th><th>Название</th><th>Зачем</th></tr>
<tr><td><b>1</b></td><td>Ethernet Auto-Discovery (A-D)</td><td>multihoming: per-ES (mass withdraw, split horizon label) и per-EVI (aliasing — балансировка на все PE сегмента)</td></tr>
<tr><td><b>2</b></td><td>MAC/IP Advertisement</td><td>«MAC X (и IP Y) за мной, метка/VNI такая». Основной маршрут</td></tr>
<tr><td><b>3</b></td><td>Inclusive Multicast Ethernet Tag (IMET)</td><td>«я участвую в этом EVI/VNI, шлите мне BUM вот так» — строит список для ingress replication (flood list) или multicast-дерево</td></tr>
<tr><td><b>4</b></td><td>Ethernet Segment</td><td>PE на одном ES находят друг друга и выбирают <b>DF</b> (designated forwarder) для BUM</td></tr>
<tr><td><b>5</b></td><td>IP Prefix</td><td>анонс IP-подсетей (как L3VPN внутри EVPN): внешние сети, подсети без хостов, межЦОД-маршрутизация</td></tr></table>
<pre class="cli">LEAF1#show bgp evpn route-type mac-ip
 * >     RD: 10.255.1.2:10 mac-ip [[0050.7966.6802]]
                                 10.255.2.2            -       100     0       65000 65002 i
 * >     RD: 10.255.1.2:10 mac-ip 0050.7966.6802 [[10.10.0.12]]
                                 10.255.2.2            -       100     0       65000 65002 i
LEAF1#show bgp evpn route-type imet
 * >     RD: 10.255.1.2:10 imet [[10.255.2.2]]
LEAF1#show vxlan flood vtep
VLAN  Ip Address of Remote VTEP
10    10.255.2.2</pre>
<h3>Важные атрибуты</h3>
<ul><li><b>MAC Mobility</b> (extended community с sequence number): хост переехал (vMotion) к другому PE — новый анонс с seq+1 побеждает старый. Если MAC прыгает слишком часто, срабатывает <b>duplicate MAC detection</b>: MAC «замораживается» и пишется лог. Это защита от петель и дублей.</li>
<li><b>Router MAC</b> — для IRB (MAC шлюза удалённого PE).</li>
<li><b>ESI label</b> — split horizon при multihoming (MPLS).</li>
<li><b>Default gateway</b> — маркер MAC шлюза.</li></ul>`
    },
    {
      id: 'dp', h: 'Data plane: MPLS или VXLAN',
      html: `
<div class="vs"><div><b>EVPN-MPLS</b> (провайдер)<br>Как L3VPN: транспортная метка до PE + сервисная EVPN-метка (EVI/MAC). Защита и TE средствами MPLS.<div class="pkt"><span class="lb" style="flex:4">транспорт</span><span class="tg" style="flex:4">EVPN</span><span class="l2" style="flex:7">кадр</span></div></div>
<div><b>EVPN-VXLAN</b> (ЦОД)<br>Кадр клиента заворачивается в UDP/IP: VTEP (VXLAN tunnel endpoint) — loopback leaf. Underlay — обычная IP-фабрика (eBGP или IGP).<div class="pkt"><span class="l3" style="flex:4">IP VTEP→VTEP</span><span class="l4" style="flex:3">UDP 4789</span><span class="tg" style="flex:3">VXLAN<small>VNI 24 бит</small></span><span class="l2" style="flex:6">кадр</span></div></div></div>
<p><b>VXLAN</b>: VNI 24 бита (16 млн сегментов против 4094 VLAN), накладные 50 байт (underlay MTU 9000+ обязателен), UDP source port — хеш от внутреннего кадра (энтропия для ECMP в фабрике). Без EVPN VXLAN учится флудом (flood-and-learn через multicast underlay) — как VPLS. EVPN даёт ему control plane.</p>
<h3>Типы сервисов EVPN</h3>
<ul><li><b>VLAN-based</b>: один EVI = один VLAN (один бридж-домен). Самый простой и распространённый.</li>
<li><b>VLAN-aware bundle</b>: один EVI на много VLAN, каждый со своим бридж-доменом (Ethernet Tag ID в маршрутах). Экономит EVI/RT.</li>
<li><b>VLAN bundle</b>: много VLAN в один бридж-домен (как port-based).</li>
<li><b>EVPN-VPWS</b> (RFC 8214): точка-точка без MAC-обучения, только type 1 per-EVI. Замена Martini-PW с плюсами EVPN (multihoming, BGP вместо targeted LDP).</li></ul>`
    },
    {
      id: 'bum', h: 'BUM, ARP suppression и MAC mobility',
      html: `
<h3>BUM</h3>
<p>Broadcast и unknown unicast всё равно бывают (DHCP, первый ARP, multicast без snooping). PE отправляет BUM всем PE из своего flood list, собранного по <b>type 3</b>: ingress replication (копия каждому) или multicast-дерево underlay/P2MP LSP. При multihoming BUM к сегменту отправляет только <b>DF</b>, а split horizon не пускает BUM обратно в тот же сегмент.</p>
<h3>ARP suppression</h3>
<p>PE знает пары MAC+IP удалённых хостов из type 2. Когда локальный хост спрашивает «кто 10.10.0.12?», PE отвечает сам (proxy), и ARP-broadcast не летит через всё ядро. В большом L2 это убирает основную массу флуда.</p>
<h3>MAC mobility</h3>
<p>Хост (VM) переехал с LEAF1 на LEAF2. LEAF2 видит его MAC локально и анонсирует type 2 с <b>sequence+1</b>. Все PE выбирают новый анонс, LEAF1 отзывает свой. Если MAC «прыгает» N раз за M секунд (петля или дубль MAC), duplicate detection замораживает его и пишет предупреждение. Это сильно лучше VPLS, где такая ситуация давала флуд и MAC flapping.</p>`
    },
    {
      id: 'irb', h: 'IRB: маршрутизация в EVPN',
      html: `
<p>Хостам в разных подсетях (VLAN 10 и VLAN 20) нужен шлюз. В EVPN шлюз <b>распределённый</b>: на каждом leaf (PE) есть SVI с <b>одинаковым IP и одинаковым MAC</b> (anycast gateway). Хост всегда находит шлюз на своём leaf, маршрутизация происходит на первом хопе, без «тромбонов» через центральный маршрутизатор. При переезде VM шлюз не меняется.</p>
<div class="vs"><div><b>Asymmetric IRB</b><br>Входной leaf маршрутизирует в VLAN назначения и дальше шлёт в L2 VNI этого VLAN. Нужно, чтобы на каждом leaf были <b>все</b> VLAN/VNI (и все MAC). Плохо масштабируется.</div>
<div><b>Symmetric IRB</b><br>Маршрутизация и на входе, и на выходе, через общий <b>L3 VNI</b> (VNI на VRF). Leaf держит только свои VLAN, а маршруты к хостам (type 2 с IP) и подсетям (type 5) — в VRF. Стандартный выбор для больших фабрик.</div></div>
<p><b>Type 5</b>: анонс подсети целиком (без хостов) — внешние сети за бордер-leaf, подсети, где хосты не сидят прямо на leaf, межЦОД. Это фактически L3VPN поверх EVPN.</p>
<div class="callout pro"><b>Где это у провайдера</b>EVPN-MPLS — новые E-Line/E-LAN и L3-сервисы на PE (Juniper MX, Cisco ASR 9000/NCS, Nokia, Huawei NE). EVPN-VXLAN — собственные ЦОД провайдера (облако, хостинг) и DCI. EVPN-VPWS — замена старых Martini-PW. Мигрировать VPLS на EVPN — типичный проект ближайших лет.</div>`
    }
  ],
  cmds: [
    { g: 'Arista EOS (EVPN-VXLAN)' },
    { c: 'service routing protocols model multi-agent', d: 'Обязательно для EVPN на EOS (применяется после перезагрузки)', jn: '—' },
    { c: 'interface Vxlan1\n vxlan source-interface Loopback1\n vxlan vlan 10 vni 10010', d: 'VTEP и соответствие VLAN → VNI' },
    { c: 'router bgp 65001\n vlan 10\n  rd auto | 10.255.1.1:10\n  route-target both 10:10\n  redistribute learned', d: 'EVI (MAC-VRF) для VLAN 10' },
    { c: ' address-family evpn\n  neighbor EVPN activate', d: 'Включить EVPN-семейство с соседями' },
    { c: 'neighbor EVPN next-hop-unchanged (на spine)', d: 'Не менять next-hop (VTEP) при передаче EVPN-маршрутов по eBGP' },
    { c: 'ip virtual-router mac-address 00:1c:73:00:00:99\ninterface Vlan10\n ip address virtual 10.10.0.1/24', d: 'Anycast gateway (одинаковый IP и MAC на всех leaf)' },
    { c: 'vrf instance T1 / vxlan vrf T1 vni 50001 / router bgp … vrf T1', d: 'Symmetric IRB: L3 VNI для VRF' },
    { c: 'show bgp evpn [route-type mac-ip | imet | ip-prefix]', d: 'EVPN-маршруты по типам' },
    { c: 'show vxlan vtep / show vxlan flood vtep / show vxlan address-table', d: 'Удалённые VTEP, flood list, MAC за VXLAN' },
    { c: 'show interfaces vxlan 1', d: 'Состояние VTEP, VNI, source' },
    { c: 'show mac address-table', d: 'MAC локальные и удалённые (через Vx1)' },
    { g: 'Cisco IOS-XR / Junos (EVPN-MPLS, для справки)' },
    { c: 'evpn\n evi 100\n  bgp route-target …\nl2vpn bridge group BG bridge-domain BD100\n  interface …\n  evi 100', d: 'EVPN на IOS-XR', jn: 'set routing-instances E instance-type evpn vlan-id 100 protocols evpn' },
    { c: 'show bgp l2vpn evpn / show evpn evi detail', d: 'Проверка (IOS-XR)', jn: 'show evpn instance extensive / show route table bgp.evpn.0' }
  ],
  cards: [
    ['Главная идея EVPN?', 'MAC (и IP) клиентов распространяются через MP-BGP (control plane), а не учатся флудом в data plane.'],
    ['Типы маршрутов EVPN 1–5?', '1 — Ethernet A-D (multihoming: mass withdraw, aliasing). 2 — MAC/IP. 3 — IMET (участие в EVI, BUM flood list). 4 — Ethernet Segment (выбор DF). 5 — IP Prefix.'],
    ['Что такое EVI и MAC-VRF?', 'EVI — экземпляр EVPN-сервиса. MAC-VRF — таблица MAC этого EVI на PE, со своим RD и RT.'],
    ['AFI/SAFI EVPN?', 'l2vpn evpn: AFI 25, SAFI 70.'],
    ['Как EVPN обрабатывает BUM?', 'По type 3 строится список PE (flood list) для ingress replication или используется multicast-дерево. При multihoming BUM к сегменту шлёт только DF.'],
    ['Что такое ARP suppression?', 'PE знает MAC+IP удалённых хостов из type 2 и сам отвечает на ARP локальных хостов. Broadcast ARP не идёт через ядро.'],
    ['Как работает MAC mobility?', 'Новый анонс MAC с sequence+1 побеждает старый. Частые перемещения — duplicate MAC detection замораживает MAC.'],
    ['VXLAN: VNI, порт, накладные?', 'VNI 24 бита, UDP 4789, 50 байт накладных. Underlay MTU 9000+.'],
    ['VLAN-based vs VLAN-aware bundle?', 'VLAN-based: EVI = один VLAN. VLAN-aware: один EVI на много VLAN, каждый — свой бридж-домен (Ethernet Tag).'],
    ['Что такое EVPN-VPWS?', 'Точка-точка на EVPN (RFC 8214): без MAC-обучения, type 1 per-EVI, BGP вместо targeted LDP, поддержка multihoming.'],
    ['Anycast gateway?', 'Одинаковые IP и MAC шлюза VLAN на всех leaf/PE: хост маршрутизируется на ближайшем, VM переезжает без смены шлюза.'],
    ['Symmetric vs asymmetric IRB?', 'Asymmetric: маршрутизация только на входе, все VLAN нужны на всех leaf. Symmetric: на входе и выходе через L3 VNI VRF, leaf держит только свои VLAN.'],
    ['Зачем type 5?', 'Анонс IP-префиксов (подсетей) без хостов: внешние сети, межЦОД, подсети без хостов на leaf.'],
    ['Зачем next-hop-unchanged на spine в eBGP EVPN-фабрике?', 'eBGP по умолчанию меняет next-hop на себя, а для VXLAN next-hop должен остаться VTEP исходного leaf.']
  ],
  quiz: [
    { q: 'Какой тип маршрута EVPN сообщает «MAC 0050.7966.6802 с IP 10.10.0.12 находится за мной»?', o: ['Type 1', 'Type 2', 'Type 3', 'Type 5'], a: 1, e: 'MAC/IP Advertisement.' },
    { q: 'На LEAF1 пустой flood list для VLAN 10, и broadcast не доходит до LEAF2. Какие маршруты не пришли?', o: ['Type 2', 'Type 3 (IMET) от LEAF2', 'Type 4', 'Type 5'], a: 1, e: 'Flood list (ingress replication) строится по type 3.' },
    { q: 'Чем EVPN лучше VPLS? (несколько)', o: ['MAC через BGP вместо флуда', 'All-active multihoming', 'Быстрый mass withdraw', 'Не нужен MPLS или VXLAN'], a: [0, 1, 2], e: 'Data plane EVPN — MPLS, VXLAN или SRv6, его не отменить.' },
    { q: 'VM переехала с LEAF1 на LEAF2. Как остальные узнают, что новый анонс главнее?', o: ['По меньшему RD', 'По MAC Mobility sequence number (больше — новее)', 'По AS_PATH', 'По времени'], a: 1, e: 'Extended community MAC Mobility с sequence.' },
    { q: 'EVPN-VXLAN фабрика на eBGP: на leaf маршруты type 2 есть, но next-hop — адрес spine, и трафик не идёт. Что забыли?', o: ['send-community', 'next-hop-unchanged для EVPN на spine', 'ARP suppression', 'L3 VNI'], a: 1, e: 'Next-hop должен оставаться VTEP leaf.' },
    { q: 'Зачем anycast gateway?', o: ['Чтобы экономить IP', 'Шлюз на каждом leaf с одинаковым IP/MAC: маршрутизация на первом хопе, мобильность VM', 'Для BUM', 'Для DF'], a: 1, e: 'Распределённый шлюз убирает «тромбоны» и упрощает мобильность.' },
    { q: 'Какой underlay MTU нужен для EVPN-VXLAN, чтобы хосты работали с MTU 1500?', o: ['1500', 'Минимум 1550, на практике 9000+', '1504', '1508'], a: 1, e: 'VXLAN добавляет 50 байт.' },
    { q: 'Какая модель IRB масштабируется лучше и почему?', o: ['Asymmetric — проще', 'Symmetric — leaf держит только свои VLAN, межподсетевой трафик идёт через L3 VNI', 'Одинаково', 'Никакая'], a: 1, e: 'Asymmetric требует все VLAN и MAC на всех leaf.' }
  ],
  und: [
    { q: 'Объясни, как в EVPN хост на LEAF1 отправляет первый пакет хосту на LEAF2 в том же VLAN и чем это отличается от VPLS.', a: '<p>Когда хост на LEAF2 появился, LEAF2 изучил его MAC (и IP по ARP/DHCP) локально и анонсировал type 2 через BGP. LEAF1 заранее знает: MAC Y за VTEP LEAF2, VNI 10010. Хост 1 шлёт ARP «кто IP Y?», и LEAF1 отвечает сам (ARP suppression) или пересылает BUM только по flood list из type 3. Затем unicast-кадр к MAC Y LEAF1 инкапсулирует в VXLAN к VTEP LEAF2 (или в метки MPLS к PE2), без флуда. В VPLS первый кадр к неизвестному MAC флудился бы во все PW, а MAC изучались бы только по пришедшим кадрам.</p>', k: ['type 2 заранее от LEAF2', 'ARP suppression / type 3 для BUM', 'unicast сразу к нужному VTEP', 'VPLS: флуд и обучение в data plane'] }
  ],
  lab: {
    title: 'Лаба 12.1. EVPN-VXLAN фабрика на Arista vEOS',
    time: '≈ 3–4 часа',
    goal: `<p>Минимальная фабрика ЦОД: SPINE и два LEAF на vEOS, хосты в VLAN 10 и 20. Underlay — eBGP, overlay — EVPN через loopback'и. Растянуть VLAN 10 между leaf (L2 VNI), посмотреть type 2 и type 3, ARP suppression, затем распределённый anycast-шлюз с symmetric IRB (L3 VNI) и type 5.</p>`,
    topo: {
      w: 820, h: 420,
      nodes: [
        { id: 'SPINE', t: 'veos', x: 410, y: 80, label: 'SPINE AS65000\nLo0 10.255.0.1', role: 'spine (route server для EVPN)' },
        { id: 'LEAF1', t: 'veos', x: 230, y: 230, label: 'LEAF1 AS65001\nLo0 10.255.1.1 · VTEP 10.255.2.1', role: 'leaf' },
        { id: 'LEAF2', t: 'veos', x: 590, y: 230, label: 'LEAF2 AS65002\nLo0 10.255.1.2 · VTEP 10.255.2.2', role: 'leaf' },
        { id: 'H1', t: 'pc', x: 150, y: 370, label: 'H1 v10\n10.10.0.11', role: 'хост VLAN 10' },
        { id: 'H2', t: 'pc', x: 520, y: 370, label: 'H2 v10\n10.10.0.12', role: 'хост VLAN 10' },
        { id: 'H3', t: 'pc', x: 680, y: 370, label: 'H3 v20\n10.20.0.13', role: 'хост VLAN 20' }
      ],
      links: [['SPINE', 'Eth1', 'LEAF1', 'Eth1', '10.0.1.0/31'], ['SPINE', 'Eth2', 'LEAF2', 'Eth1', '10.0.2.0/31'], ['H1', 'eth0', 'LEAF1', 'Eth3'], ['H2', 'eth0', 'LEAF2', 'Eth3'], ['H3', 'eth0', 'LEAF2', 'Eth4']]
    },
    addr: [['SPINE–LEAF1', '10.0.1.0/31', 'SPINE .0, LEAF1 .1'], ['SPINE–LEAF2', '10.0.2.0/31', 'SPINE .0, LEAF2 .1'], ['VLAN 10 → VNI', '10010', 'шлюз 10.10.0.1 (anycast)'], ['VLAN 20 → VNI', '10020', 'шлюз 10.20.0.1 (anycast)'], ['VRF T1 → L3 VNI', '50001', '']],
    init: {
      SPINE: 'hostname SPINE\nservice routing protocols model multi-agent\nip routing\ninterface Ethernet1\n no switchport\n ip address 10.0.1.0/31\n mtu 9214\ninterface Ethernet2\n no switchport\n ip address 10.0.2.0/31\n mtu 9214\ninterface Loopback0\n ip address 10.255.0.1/32',
      LEAF1: 'hostname LEAF1\nservice routing protocols model multi-agent\nip routing\nvlan 10\nvlan 20\ninterface Ethernet1\n no switchport\n ip address 10.0.1.1/31\n mtu 9214\ninterface Ethernet3\n switchport access vlan 10\ninterface Loopback0\n ip address 10.255.1.1/32\ninterface Loopback1\n ip address 10.255.2.1/32',
      LEAF2: 'hostname LEAF2\nservice routing protocols model multi-agent\nip routing\nvlan 10\nvlan 20\ninterface Ethernet1\n no switchport\n ip address 10.0.2.1/31\n mtu 9214\ninterface Ethernet3\n switchport access vlan 10\ninterface Ethernet4\n switchport access vlan 20\ninterface Loopback0\n ip address 10.255.1.2/32\ninterface Loopback1\n ip address 10.255.2.2/32',
      H1: 'set pcname H1\nip 10.10.0.11/24 10.10.0.1', H2: 'set pcname H2\nip 10.10.0.12/24 10.10.0.1', H3: 'set pcname H3\nip 10.20.0.13/24 10.20.0.1'
    },
    pre: 'vEOS загружается 3–5 минут. Если при старте висит Zero Touch Provisioning — войди (admin без пароля) и выполни <code>zerotouch cancel</code> (перезагрузится). Если стартовый конфиг не применился, вставь его вручную из блока ниже, затем <code>write</code> и <code>reload</code>: модель multi-agent включается только после перезагрузки. Проверка: <code>show ip route summary</code> должен показывать «Multi-agent».',
    tasks: [
      { t: 'Underlay: eBGP spine–leaf', d: 'SPINE AS65000, LEAF1 AS65001, LEAF2 AS65002. eBGP по линкам /31, каждый анонсирует свои loopback\'и (redistribute connected или network). Проверь, что LEAF1 пингует VTEP LEAF2 (10.255.2.2) с source 10.255.2.1.',
        check: 'LEAF1#show ip bgp summary\nLEAF1#show ip route\nLEAF1#ping 10.255.2.2 source 10.255.2.1',
        sol: 'LEAF1(config)#router bgp 65001\nLEAF1(config-router-bgp)#router-id 10.255.1.1\nLEAF1(config-router-bgp)#neighbor 10.0.1.0 remote-as 65000\nLEAF1(config-router-bgp)#network 10.255.1.1/32\nLEAF1(config-router-bgp)#network 10.255.2.1/32\nSPINE(config)#router bgp 65000\nSPINE(config-router-bgp)#router-id 10.255.0.1\nSPINE(config-router-bgp)#neighbor 10.0.1.1 remote-as 65001\nSPINE(config-router-bgp)#neighbor 10.0.2.1 remote-as 65002\nSPINE(config-router-bgp)#network 10.255.0.1/32' },
      { t: 'Overlay: EVPN-сессии по loopback', d: 'EVPN-сессии leaf ↔ spine между Lo0 (ebgp-multihop 3, update-source Loopback0, send-community extended), только address-family evpn. На SPINE — <code>next-hop-unchanged</code> для EVPN-соседей.',
        check: 'LEAF1#show bgp evpn summary',
        sol: 'LEAF1(config-router-bgp)#neighbor 10.255.0.1 remote-as 65000\nLEAF1(config-router-bgp)#neighbor 10.255.0.1 update-source Loopback0\nLEAF1(config-router-bgp)#neighbor 10.255.0.1 ebgp-multihop 3\nLEAF1(config-router-bgp)#neighbor 10.255.0.1 send-community extended\nLEAF1(config-router-bgp)#address-family evpn\nLEAF1(config-router-bgp-af)#neighbor 10.255.0.1 activate\nLEAF1(config-router-bgp)#address-family ipv4\nLEAF1(config-router-bgp-af)#no neighbor 10.255.0.1 activate\nSPINE(config-router-bgp)#neighbor 10.255.1.1 next-hop-unchanged\n! + аналогичные EVPN-сессии на SPINE к 10.255.1.1 и 10.255.1.2' },
      { t: 'L2 VNI: растягиваем VLAN 10', d: 'На обоих leaf: interface Vxlan1 (source Loopback1, vlan 10 vni 10010) и EVI для VLAN 10 в BGP (rd auto, route-target both 10:10010, redistribute learned). Пингани H1 → H2. Найди type 3 и type 2 в <code>show bgp evpn</code>, flood list и удалённый MAC в <code>show vxlan address-table</code>.',
        check: 'LEAF1#show interfaces vxlan 1\nLEAF1#show bgp evpn route-type imet\nLEAF1#show bgp evpn route-type mac-ip\nLEAF1#show vxlan flood vtep\nLEAF1#show vxlan address-table\nH1> ping 10.10.0.12',
        sol: 'LEAF1(config)#interface Vxlan1\nLEAF1(config-if-Vx1)#vxlan source-interface Loopback1\nLEAF1(config-if-Vx1)#vxlan udp-port 4789\nLEAF1(config-if-Vx1)#vxlan vlan 10 vni 10010\nLEAF1(config)#router bgp 65001\nLEAF1(config-router-bgp)#vlan 10\nLEAF1(config-macvrf-10)#rd auto\nLEAF1(config-macvrf-10)#route-target both 10:10010\nLEAF1(config-macvrf-10)#redistribute learned' },
      { t: 'Захват VXLAN', d: 'Сними захват на SPINE Eth1 во время пинга H1 → H2. Найди внешний IP (VTEP → VTEP), UDP 4789, VXLAN-заголовок с VNI 10010 и внутренний кадр с MAC хостов. Сколько байт накладных?' },
      { t: 'Anycast gateway и symmetric IRB', d: 'Сделай VRF T1 с L3 VNI 50001 на обоих leaf. Anycast-шлюзы: Vlan10 10.10.0.1/24 и Vlan20 10.20.0.1/24 (<code>ip address virtual</code>), одинаковый virtual-router MAC. Растяни VLAN 20 тоже (VNI 10020) и добавь EVI. Пингани H1 → H3 (разные подсети, разные leaf). Посмотри type 2 с IP и VRF-маршруты.',
        hint: 'На EOS: <code>vrf instance T1</code>, <code>ip routing vrf T1</code>, в Vxlan1 — <code>vxlan vrf T1 vni 50001</code>, в BGP — <code>vrf T1</code> → <code>rd 10.255.1.1:1</code>, <code>route-target import evpn 1:50001</code>, <code>route-target export evpn 1:50001</code>, <code>redistribute connected</code>. Интерфейсы Vlan10/20 — <code>vrf T1</code>.',
        check: 'LEAF1#show ip route vrf T1\nLEAF1#show bgp evpn route-type mac-ip detail\nH1> ping 10.20.0.13\nH1> trace 10.20.0.13' },
      { t: 'MAC mobility', d: 'Перенеси H1 на LEAF2 (в EVE: переподключи линк к LEAF2 Eth5 в VLAN 10, предварительно остановив узлы) с тем же адресом. Посмотри в <code>show bgp evpn route-type mac-ip detail</code> поле MAC Mobility sequence number.',
        check: 'LEAF2#show bgp evpn route-type mac-ip 0050.7966.6800 detail' }
    ],
    brk: [
      { t: 'MAC H2 есть в EVPN на LEAF1, но трафик не идёт: next-hop странный', inj: 'SPINE(config)#router bgp 65000\nSPINE(config-router-bgp)#no neighbor 10.255.1.1 next-hop-unchanged\nSPINE(config-router-bgp)#no neighbor 10.255.1.2 next-hop-unchanged', h: '<code>show bgp evpn route-type mac-ip detail</code> на LEAF1 — next-hop? Это VTEP LEAF2?', f: 'Spine подменил next-hop на свой адрес. VXLAN-туннель строится к spine, который не VTEP. На spine для EVPN нужен next-hop-unchanged.' },
      { t: 'H1 и H2 не видят друг друга, EVPN-сессии up', inj: 'LEAF2(config)#router bgp 65002\nLEAF2(config-router-bgp)#vlan 10\nLEAF2(config-macvrf-10)#route-target both 10:10011', h: 'Сравни route-target EVI VLAN 10 на leaf. Есть ли на LEAF1 type 2/3 от LEAF2?', f: 'RT не совпадают: LEAF1 не импортирует маршруты EVI LEAF2 (и наоборот). Пустой flood list, нет удалённых MAC. RT как в L3VPN определяет членство.' }
    ]
  }
});
