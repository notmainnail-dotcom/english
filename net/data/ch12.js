COURSE.add({
  id: 'ch12',
  time: '≈ 8–10 часов',
  intro: `<p>Некоторым клиентам не нужен L3VPN: они хотят «просто длинный провод» между офисами, чтобы их VLAN, их IP-план, их OSPF и даже их STP шли насквозь, а провайдер ни во что не вмешивался. Это <b>L2VPN</b>. В главе 2 мы делали это через QinQ, здесь — через MPLS: <b>псевдопровод</b> точка-точка (VPWS, E-Line) и виртуальный коммутатор на много точек (VPLS, E-LAN). Плюс эксплуатация: почему PW не поднимается (MTU!), как устроена флудилка VPLS и почему всё это ведёт к EVPN.</p>`,
  goals: [
    'Объяснить, когда клиенту нужен L2VPN, а когда L3VPN, и чем MPLS L2VPN лучше QinQ',
    'Описать псевдопровод: attachment circuit, PW label, control word, targeted LDP (Martini)',
    'Настроить VPWS (port, VLAN, VLAN rewrite) и найти причину down по выводу show',
    'Объяснить VPLS: обучение MAC на PE, full mesh PW, split horizon, BUM-флуд, H-VPLS',
    'Понимать ограничения VPLS, которые решает EVPN, и основы Ethernet OAM (CFM, Y.1731)'
  ],
  why: `E-Line и E-LAN — массовые услуги для бизнеса, операторов связи и ЦОД. «Канал между офисами не поднимается», «по каналу не проходят большие пакеты», «в VPLS у клиента петля и флуд» — типовые заявки. Ты будешь собирать такие сервисы руками и чинить их по выводам show mpls l2transport vc.`,
  refs: [
    { t: 'RFC 4447 / 8077 — Pseudowire Setup and Maintenance Using LDP (Martini)', u: 'https://www.rfc-editor.org/rfc/rfc8077' },
    { t: 'RFC 4448 — Encapsulation Methods for Transport of Ethernet over MPLS', u: 'https://www.rfc-editor.org/rfc/rfc4448' },
    { t: 'RFC 4762 — VPLS Using LDP Signaling; RFC 4761 — VPLS Using BGP', u: 'https://www.rfc-editor.org/rfc/rfc4762' },
    { t: 'MEF 6.x — Ethernet Services Definitions (E-Line, E-LAN, E-Tree)', u: 'https://www.mef.net/' },
    { t: 'ITU-T Y.1731 / IEEE 802.1ag (CFM)', n: 'Ethernet OAM: проверка и измерение L2-сервисов' },
    { t: 'linkmeup — СДСМ ч. 12. MPLS L2VPN', u: 'https://linkmeup.ru/blog/261.html' }
  ],
  theory: [
    {
      id: 'why', h: 'Когда клиенту нужен L2, а не L3',
      html: `
<table><tr><th></th><th>L3VPN</th><th>L2VPN</th></tr>
<tr><td>Что видит провайдер</td><td>IP-маршруты клиента, участвует в маршрутизации (PE–CE)</td><td>кадры Ethernet, в IP клиента не вникает</td></tr>
<tr><td>Что может клиент</td><td>любой IP-план (через VRF), но маршрутизация согласуется с провайдером</td><td>свои VLAN, свои протоколы (IS-IS, multicast, не-IP), свой STP — что угодно поверх Ethernet</td></tr>
<tr><td>Кому подходит</td><td>офисы предприятия, «мне просто нужна сеть»</td><td>операторы (аренда каналов), ЦОД (растянуть L2), клиенты со своим ядром и своими маршрутизаторами</td></tr>
<tr><td>Риски</td><td>—</td><td>широковещательный домен клиента растянут через город: петли, флуд, MAC-таблицы на PE</td></tr></table>
<h3>MPLS L2VPN против QinQ</h3>
<p>QinQ (глава 2) тоже даёт L2-канал, но S-VLAN «протянут» через все коммутаторы провайдера, на каждом нужно его создать. MAC-адреса клиентов учатся на всех коммутаторах пути, а резервирование держится на STP или ERPS. В MPLS L2VPN ядро ничего не знает о сервисе: только PE на концах. Защита — средствами MPLS (FRR, IGP). Количество сервисов ограничено не 4094 VLAN, а метками. Поэтому у операторов магистральные L2-каналы — это MPLS, а QinQ остаётся в сети доступа.</p>`
    },
    {
      id: 'pw', h: 'Псевдопровод: из чего состоит',
      html: `
<ul><li><b>AC (attachment circuit)</b> — то, что смотрит в клиента: весь порт, VLAN на порту, пара QinQ-тегов.</li>
<li><b>PW (pseudowire)</b> — эмуляция провода между двумя PE через MPLS. Каждый PW идентифицируется <b>VC ID</b> (PW ID), одинаковым на двух концах.</li>
<li><b>Сигнализация</b>: <b>Martini</b> — targeted LDP-сессия между PE (не соседями!, обычно loopback ↔ loopback): обмен PW-метками для VC ID. <b>Kompella</b> — то же через BGP (address-family l2vpn).</li></ul>
<div class="pkt"><span class="l2" style="flex:5">Eth (ядро)</span><span class="lb" style="flex:5">Транспорт<small>до PE2</small></span><span class="tg" style="flex:5">PW-метка<small>какой PW</small></span><span class="fcs" style="flex:3">CW<small>опц. 4 Б</small></span><span class="l2" style="flex:8">Кадр клиента<small>без FCS, с тегами или без</small></span></div>
<p>Очень похоже на L3VPN: транспортная метка (LDP/SR) до удалённого PE + сервисная метка, только сервисная определяет не VRF, а <b>PW</b>, а под ней лежит Ethernet-кадр.</p>
<h3>Control word</h3>
<p>4 байта между PW-меткой и кадром. Зачем: транзитные LSR иногда «заглядывают» под стек меток, чтобы сделать ECMP-хеш. Если первый ниббл кадра похож на «4» (как в IPv4), его можно ошибочно принять за IP-пакет, и разные пакеты одного PW разлетятся по разным путям (переупорядочивание). CW начинается с 0000, это гарантирует, что за IP его не примут. Плюс поле sequence. Обе стороны должны договориться: если одна с CW, а другая без, PW не поднимется (или поднимется без CW, зависит от реализации).</p>
<h3>Типы PW для Ethernet</h3>
<ul><li><b>Type 5 (Ethernet / raw)</b> — кадр передаётся без «служебного» тега (сервисный тег снят на входе).</li>
<li><b>Type 4 (Ethernet VLAN / tagged)</b> — с тегом. На концах должно совпадать, иначе PW не встанет.</li></ul>`
    },
    {
      id: 'vpws', h: 'VPWS (E-Line): настройка и диагностика',
      html: `
<pre class="cli">! классический синтаксис (IOS, работает и на IOS-XE)
PE1(config)#interface Gi0/1.100
PE1(config-subif)#encapsulation dot1Q 100
PE1(config-subif)#xconnect 10.255.0.3 100 encapsulation mpls
! новый синтаксис IOS-XE: EFP + l2vpn xconnect context
PE1(config)#interface GigabitEthernet3
PE1(config-if)#service instance 100 ethernet
PE1(config-if-srv)#encapsulation dot1q 100
PE1(config-if-srv)#rewrite ingress tag pop 1 symmetric
PE1(config)#l2vpn xconnect context PW100
PE1(config-xconnect)#member GigabitEthernet3 service-instance 100
PE1(config-xconnect)#member 10.255.0.3 100 encapsulation mpls
PE1#show mpls l2transport vc 100 detail
Local interface: Gi3 up, line protocol up, Eth VLAN 100 up
  Destination address: 10.255.0.3, VC ID: 100, VC status: [[up]]
    Output interface: Gi2, imposed label stack {[[17 22]]}      ! транспорт 17, PW 22
  Signaling protocol: LDP, peer 10.255.0.3:0 up
    MPLS VC labels: local 23, remote 22
    MTU: local 1500, remote 1500
    Sequencing: receive disabled, send disabled</pre>
<h3>Почему PW не поднимается — проверяй по порядку</h3>
<table><tr><th>Признак в show mpls l2transport vc detail</th><th>Причина</th></tr>
<tr><td>VC status down, Signaling: LDP peer down / no targeted session</td><td>нет маршрута до loopback удалённого PE, LDP router-id, ACL на 646</td></tr>
<tr><td><b>MTU mismatch</b> (local 1500, remote 1504)</td><td><b>самая частая причина</b>: MTU AC с двух сторон должен совпадать. Ставится одинаковым на интерфейсах или <code>mtu</code> в pseudowire class</td></tr>
<tr><td>VC ID нет у соседа / remote label unassigned</td><td>не совпадает VC ID или адрес соседа (направлено не на тот loopback)</td></tr>
<tr><td>PW type mismatch (Ethernet vs Ethernet VLAN)</td><td>разный тип AC/инкапсуляции на концах</td></tr>
<tr><td>AC down</td><td>интерфейс к клиенту лежит, и PW сигнализирует «AC fault» удалённой стороне</td></tr>
<tr><td>VC up, но трафик не идёт</td><td>LSP до соседа разорван (глава 10), несовпадение тегов (клиент шлёт 101, а AC ждёт 100), MTU ядра</td></tr></table>
<div class="callout pro"><b>Виды стыков у провайдера</b><b>Port-based</b>: всё, что пришло в порт, в PW (клиент сам тегирует, QinQ-like). <b>VLAN-based</b>: только VLAN N в PW, другие VLAN порта — другие сервисы. <b>VLAN rewrite</b>: у клиента в одном офисе VLAN 100, в другом 200 — PE переписывает тег (<code>rewrite ingress tag translate</code>).</div>`
    },
    {
      id: 'vpls', h: 'VPLS (E-LAN): виртуальный коммутатор',
      html: `
<p>VPLS — много точек в одном L2-домене. Каждый PE, участвующий в VPLS-инстансе (<b>VFI</b>, virtual forwarding instance), ведёт себя как коммутатор:</p>
<ul><li><b>Учит MAC</b>: на AC (от клиента) и на PW (от других PE). «MAC X за PW к PE3».</li>
<li><b>Full mesh PW</b> между всеми PE инстанса.</li>
<li><b>Split horizon</b>: кадр, пришедший из PW, <b>не отправляется в другие PW</b> (только в AC). Full mesh гарантирует, что все PE получили кадр напрямую от входного. Петель в ядре нет, STP внутри VPLS не нужен.</li>
<li><b>BUM</b> (broadcast, unknown unicast, multicast) входной PE копирует в каждый PW — <b>ingress replication</b>. При 50 PE каждый broadcast — 49 копий.</li></ul>
<pre class="cli">PE1(config)#l2vpn vfi context VPLS200
PE1(config-vfi)#vpn id 200
PE1(config-vfi)#member 10.255.0.2 encapsulation mpls
PE1(config-vfi)#member 10.255.0.3 encapsulation mpls
PE1(config)#bridge-domain 200
PE1(config-bdomain)#member GigabitEthernet3 service-instance 200
PE1(config-bdomain)#member vfi VPLS200
PE1#show l2vpn vfi name VPLS200
PE1#show bridge-domain 200
PE1#show mac address-table bridge-domain 200</pre>
<h3>Масштаб: H-VPLS и BGP-AD</h3>
<ul><li>Full mesh из N PE — N(N−1)/2 PW, плюс ручное прописывание соседей. <b>BGP auto-discovery</b> (RFC 6074): PE находят друг друга через BGP (l2vpn vpls), PW сигнализируется LDP. Добавил PE — остальные узнали сами.</li>
<li><b>H-VPLS</b>: иерархия — u-PE (доступ) подключён одним PW (spoke) к n-PE, а full mesh только между n-PE.</li></ul>
<h3>Ограничения VPLS (почему пришёл EVPN)</h3>
<ul><li>MAC учатся <b>в data plane</b> через флуд: unknown unicast флудится по всем PW, при большом числе MAC — много флуда.</li>
<li><b>Нет active-active multihoming</b>: клиент, подключённый к двум PE, может использовать только один (иначе петля), резервирование через STP клиента или MC-LAG.</li>
<li>Сходимость: при отказе PE нужно ждать устаревания MAC или делать MAC flush (LDP MAC withdraw).</li>
<li>Нет оптимальной маршрутизации между L2 и L3 (anycast gateway).</li></ul>
<p>EVPN (глава 12.1) решает это: MAC-адреса распространяются <b>через BGP</b> (control plane), есть all-active multihoming, ARP suppression, интеграция L2 и L3.</p>`
    },
    {
      id: 'oam', h: 'Ethernet OAM: как проверить L2-сервис',
      html: `
<p>IP-пинг внутри L2-сервиса клиента провайдер сделать не может: у него нет адресов в этой сети. Для этого есть <b>Ethernet OAM</b>:</p>
<ul><li><b>CFM (IEEE 802.1ag)</b>: maintenance domain (уровень 0–7: клиент, провайдер, оператор), MEP — конечные точки (на PE у AC), MIP — промежуточные. <b>CCM</b> (continuity check) — периодические «я жив» между MEP. Пропало 3 CCM — авария сервиса, сигнал в мониторинг. <b>Loopback</b> (L2-пинг по MAC) и <b>linktrace</b> (L2-трассировка).</li>
<li><b>Y.1731</b>: измерения SLA — задержка (DMM), джиттер, потери (LMM/SLM). Именно так провайдер доказывает клиенту, что «канал соответствует договору».</li>
<li><b>PW-уровень</b>: <code>ping mpls pseudowire 10.255.0.3 100</code> (VCCV) — проверка самого PW через MPLS.</li></ul>
<div class="callout pro"><b>У провайдера</b>На каждом коммерческом E-Line настраивают MEP по CFM на обоих концах (часто на клиентских NID — демаркационных устройствах у клиента), CCM — в систему мониторинга, Y.1731 — в отчёты по SLA. «Клиент говорит, что канал потерял пакеты в 14:05» — смотришь статистику SLM за этот период.</div>`
    }
  ],
  cmds: [
    { g: 'VPWS' },
    { c: 'xconnect PEER VCID encapsulation mpls', d: 'Псевдопровод на (саб)интерфейсе — классика', hw: 'mpls l2vc PEER VCID', jn: 'set protocols l2circuit neighbor PEER interface X virtual-circuit-id VCID' },
    { c: 'l2vpn xconnect context NAME\n member IFACE service-instance N\n member PEER VCID encapsulation mpls', d: 'Новый синтаксис IOS-XE', hw: 'mpls l2vc', jn: 'l2circuit' },
    { c: 'service instance N ethernet\n encapsulation dot1q N\n rewrite ingress tag pop 1 symmetric', d: 'EFP: выбор VLAN и обработка тега', hw: 'interface GE0/0/1.100 mode l2\n encapsulation dot1q vid 100', jn: 'unit 100 encapsulation vlan-ccc vlan-id 100' },
    { c: 'pseudowire-class PWC\n encapsulation mpls\n control-word', d: 'Параметры PW (CW, интерфейс, MTU)', hw: 'mpls l2vpn pw-template', jn: 'control-word' },
    { c: 'show mpls l2transport vc [VCID] [detail]', d: 'Состояние PW, метки, MTU, причина down', hw: 'display mpls l2vc [VCID]', jn: 'show l2circuit connections [extensive]' },
    { c: 'show l2vpn atom vc', d: 'То же в новом синтаксисе', hw: 'display mpls l2vc brief' },
    { c: 'show mpls ldp neighbor PEER detail', d: 'Targeted LDP-сессия к удалённому PE', hw: 'display mpls ldp remote-peer', jn: 'show ldp neighbor extensive' },
    { c: 'ping mpls pseudowire PEER VCID', d: 'VCCV: проверка PW', hw: 'ping vc mpls PEER VCID', jn: 'ping mpls l2circuit interface X' },
    { g: 'VPLS' },
    { c: 'l2vpn vfi context NAME\n vpn id N\n member PEER encapsulation mpls', d: 'VPLS-инстанс (VFI) и PW к соседям', hw: 'vsi NAME static\n pwsignal ldp\n  vsi-id N\n  peer PEER', jn: 'set routing-instances V instance-type vpls protocols vpls' },
    { c: 'bridge-domain N\n member IFACE service-instance N\n member vfi NAME', d: 'Связать AC и VFI в один бридж-домен', hw: 'interface X\n l2 binding vsi NAME', jn: 'routing-instances V interface X' },
    { c: 'show l2vpn vfi [name NAME]', d: 'PW VPLS и их состояние', hw: 'display vsi verbose', jn: 'show vpls connections' },
    { c: 'show bridge-domain N / show mac address-table bridge-domain N', d: 'Порты и изученные MAC (на AC и на PW)', hw: 'display mac-address vsi NAME', jn: 'show vpls mac-table' },
    { g: 'OAM' },
    { c: 'ethernet cfm domain D level 5 / service … evc / mep', d: 'CFM: домен, MEP, CCM', hw: 'cfm md / cfm ma / mep', jn: 'protocols oam ethernet connectivity-fault-management' },
    { c: 'show ethernet cfm maintenance-points remote', d: 'Удалённые MEP и их состояние', hw: 'display cfm remote-mep', jn: 'show oam ethernet connectivity-fault-management mep-database' },
    { c: 'ip sla … ethernet y1731 delay / loss', d: 'Y.1731: задержка и потери', hw: 'nqa … y1731', jn: 'performance-monitoring' }
  ],
  cards: [
    ['Когда клиенту нужен L2VPN, а не L3VPN?', 'Когда он хочет свои VLAN, IP-план и протоколы (свой OSPF/IS-IS, multicast, STP) насквозь, а провайдер не участвует в его маршрутизации: операторы, ЦОД, клиенты со своим ядром.'],
    ['Чем MPLS L2VPN лучше QinQ для магистрали?', 'Ядро не знает о сервисе (только PE на концах), защита средствами MPLS/IGP, нет ограничения 4094, MAC клиентов не учатся на транзите.'],
    ['Что такое AC и PW?', 'AC (attachment circuit) — сторона к клиенту (порт, VLAN). PW (pseudowire) — эмуляция провода через MPLS между PE, идентифицируется VC ID.'],
    ['Martini vs Kompella?', 'Martini — сигнализация PW через targeted LDP между PE. Kompella — через BGP (l2vpn).'],
    ['Стек меток в VPWS?', 'Транспортная (до удалённого PE) + PW-метка (какой PW) [+ control word] + кадр клиента.'],
    ['Зачем control word?', 'Чтобы транзитные LSR не приняли Ethernet-кадр за IP при ECMP-хешировании (первый ниббл 0000) и для sequence. Должен совпадать на обоих концах.'],
    ['Самая частая причина «PW не поднимается»?', 'MTU mismatch между AC двух PE. Также: нет targeted LDP (маршрут/router-id), неверный VC ID или peer, PW type mismatch.'],
    ['Type 4 vs Type 5 PW?', 'Type 4 — Ethernet VLAN (кадр с тегом). Type 5 — Ethernet raw (служебный тег снят). Должны совпадать.'],
    ['Как VPLS-PE учит MAC?', 'Как коммутатор, в data plane: по Src MAC на AC и на PW (MAC X за PW к PE3).'],
    ['Что такое split horizon в VPLS?', 'Кадр, пришедший из PW, не отправляется в другие PW (только в AC). Full mesh гарантирует доставку, петель в ядре нет.'],
    ['Что такое ingress replication BUM в VPLS?', 'Входной PE сам копирует broadcast/unknown/multicast в каждый PW. 50 PE — 49 копий.'],
    ['H-VPLS и BGP-AD — зачем?', 'Масштаб: H-VPLS — иерархия (spoke PW от доступа до n-PE, full mesh только между n-PE). BGP-AD — автообнаружение PE инстанса через BGP.'],
    ['Ограничения VPLS, которые решает EVPN?', 'MAC-обучение флудом, нет active-active multihoming, медленная сходимость (MAC flush), нет интеграции L2/L3.'],
    ['Что такое CFM CCM?', 'Continuity Check Message между MEP сервиса: периодический «я жив». Потеря 3 подряд — авария сервиса.'],
    ['Зачем Y.1731?', 'Измерение SLA L2-сервиса: задержка, джиттер, потери (DMM, SLM/LMM).']
  ],
  quiz: [
    { q: 'show mpls l2transport vc detail: «VC status: down, MTU: local 1500, remote 1504». Что делать?', o: ['Перезапустить LDP', 'Выровнять MTU AC на двух PE', 'Сменить VC ID', 'Включить control word'], a: 1, e: 'MTU mismatch — классическая причина down PW.' },
    { q: 'Клиенту нужно соединить два офиса так, чтобы его OSPF и VLAN шли насквозь без участия провайдера. Какая услуга?', o: ['L3VPN', 'VPWS (E-Line)', 'Интернет', 'NAT'], a: 1, e: 'Точка-точка L2 — VPWS.' },
    { q: 'Почему в VPLS не нужен STP внутри ядра?', o: ['STP не работает с MPLS', 'Full mesh PW + split horizon: кадр из PW не уходит в другие PW', 'MAC не учатся', 'BUM запрещён'], a: 1, e: 'Петли исключены конструкцией.' },
    { q: 'Targeted LDP-сессия для PW устанавливается между…', o: ['Соседними P', 'Loopback\'ами двух PE (могут быть через много хопов)', 'PE и CE', 'RR и PE'], a: 1, e: 'PE обмениваются PW-метками напрямую.' },
    { q: 'PW up, но трафик клиента не проходит. Клиент шлёт кадры с VLAN 101, а AC настроен на encapsulation dot1q 100. Что происходит?', o: ['Кадры пройдут', 'Кадры с VLAN 101 не попадают в этот AC/PW', 'PW упадёт', 'Тег перепишется'], a: 1, e: 'AC VLAN-based: в PW попадают только кадры нужного VLAN.' },
    { q: 'В VPLS из 30 PE клиент шлёт ARP broadcast. Сколько копий создаст входной PE в ядро?', o: ['1', '29', '30', '435'], a: 1, e: 'Ingress replication: по копии в каждый PW, 29 соседей.' },
    { q: 'Клиент VPLS подключён к двум PE (для резерва) двумя линками в свой коммутатор, оба активны. Что случится?', o: ['Балансировка', 'Петля: VPLS не поддерживает active-active multihoming', 'Ничего', 'PW упадут'], a: 1, e: 'Без EVPN MH один из линков должен быть заблокирован (STP клиента, MC-LAG).' },
    { q: 'Чем провайдер докажет клиенту качество E-Line (задержка, потери) за период?', o: ['ping с PE', 'Y.1731 (DMM, SLM) между MEP сервиса', 'traceroute', 'show interfaces'], a: 1, e: 'Y.1731 — стандартный механизм измерения SLA L2.' },
    { q: 'Зачем control word, если без него PW работает?', o: ['Шифрование', 'Защита от неверного ECMP-хеширования «как IP» на транзите и нумерация', 'Сжатие', 'QoS'], a: 1, e: 'Без CW Ethernet-кадр с первым нибблом 4 могут принять за IPv4 и разбросать по путям.' }
  ],
  und: [
    { q: 'Объясни, как устроен VPWS: что такое AC, PW, какие метки и как PE договариваются о них. Почему PW так часто не поднимается из-за MTU?', a: '<p>AC — интерфейс или VLAN к клиенту. PW — эмуляция провода между двумя PE через MPLS, с VC ID на обоих концах. PE устанавливают targeted LDP-сессию между loopback\'ами и обмениваются PW-метками для VC ID (Martini). Пакет: кадр клиента + (CW) + PW-метка удалённого PE + транспортная метка до удалённого PE. P видят только транспортную. Удалённый PE по PW-метке понимает, в какой AC отдать кадр. В сигнализации LDP передаётся MTU AC, и PE сверяют его. Если не совпадает, PW не поднимается: иначе большие кадры клиента молча терялись бы на одном конце. Поэтому MTU AC с обеих сторон должен быть одинаковым.</p>', k: ['AC и PW, VC ID', 'targeted LDP, PW-метки', 'стек: транспорт + PW + кадр', 'MTU сверяется в сигнализации'] },
    { q: 'Чем VPLS отличается от VPWS и какие у него проблемы, ставшие причиной появления EVPN?', a: '<p>VPWS — точка-точка, кадры просто перекладываются из AC в PW. VPLS — многоточечный виртуальный коммутатор: каждый PE учит MAC (на AC и на PW), держит full mesh PW со всеми PE инстанса, применяет split horizon (из PW в PW не пересылает) и флудит BUM копиями во все PW. Проблемы: обучение MAC через флуд (data plane), лишняя нагрузка; нет active-active подключения клиента к двум PE (петля), резерв только через блокировку; медленная сходимость при отказе (ждать или MAC withdraw); масштаб full mesh. EVPN переносит MAC через BGP (control plane), даёт all-active multihoming с ESI, быстрый mass withdraw, ARP suppression и интеграцию L2/L3.</p>', k: ['VPWS p2p, VPLS многоточка', 'MAC-обучение, full mesh, split horizon, BUM', 'нет A/A multihoming', 'флуд и сходимость', 'EVPN: BGP control plane'] }
  ],
  lab: {
    title: 'Лаба 12. E-Line и E-LAN на CSR1000v',
    time: '≈ 3 часа',
    goal: `<p>Три PE на CSR1000v (IOS-XE) и один P на vIOS. Ядро (IS-IS + LDP) уже работает. Клиент «Лифт ми Ап» хочет: VLAN 100 — точка-точка между офисами 1 и 2 (E-Line), VLAN 200 — общая L2-сеть трёх офисов (E-LAN). Собрать, проверить, сломать MTU и VC ID и посмотреть на split horizon.</p>`,
    topo: {
      w: 880, h: 440,
      zones: [{ x: 180, y: 40, w: 520, h: 360, label: 'Ядро AS64500 · IS-IS · LDP', c: '#7c3aed' }],
      nodes: [
        { id: 'PE1', t: 'csr', x: 260, y: 120, label: 'PE1 (CSR)\nLo0 10.255.0.1', role: 'PE, IOS-XE' },
        { id: 'PE2', t: 'csr', x: 620, y: 120, label: 'PE2 (CSR)\nLo0 10.255.0.2', role: 'PE, IOS-XE' },
        { id: 'PE3', t: 'csr', x: 440, y: 340, label: 'PE3 (CSR)\nLo0 10.255.0.3', role: 'PE, IOS-XE' },
        { id: 'P1', t: 'p', x: 440, y: 200, label: 'P1\nLo0 10.255.0.10', role: 'P (vIOS)' },
        { id: 'CE1', t: 'ce', x: 80, y: 120, label: 'CE1 офис 1\n.100: 10.100.0.1\n.200: 10.200.0.1', role: 'клиент' },
        { id: 'CE2', t: 'ce', x: 800, y: 120, label: 'CE2 офис 2\n.100: 10.100.0.2\n.200: 10.200.0.2', role: 'клиент' },
        { id: 'CE3', t: 'ce', x: 440, y: 420, label: 'CE3 офис 3 · .200: 10.200.0.3', role: 'клиент' }
      ],
      links: [['PE1', 'Gi2', 'P1', 'Gi0/0'], ['PE2', 'Gi2', 'P1', 'Gi0/1'], ['PE3', 'Gi2', 'P1', 'Gi0/2'], ['CE1', 'Gi0/0', 'PE1', 'Gi3'], ['CE2', 'Gi0/0', 'PE2', 'Gi3'], ['CE3', 'Gi0/0', 'PE3', 'Gi3']]
    },
    addr: [['Ядро', 'PEn Gi2 ↔ P1', '10.1.N.0/31 (PE .0... см. конфиги)'], ['E-Line VLAN 100', 'CE1/CE2 Gi0/0.100', '10.100.0.1/24 и .2/24'], ['E-LAN VLAN 200', 'CE1/2/3 Gi0/0.200', '10.200.0.1–3/24'], ['VC ID / VPN ID', '', 'E-Line 100, VPLS 200']],
    init: (function () {
      const pe = n => `hostname PE${n}\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.${n} 255.255.255.255\n ip router isis CORE\ninterface GigabitEthernet2\n ip address 10.1.${n}.0 255.255.255.254\n ip router isis CORE\n isis network point-to-point\n mpls ip\n no shutdown\ninterface GigabitEthernet3\n no shutdown\nmpls ldp router-id Loopback0 force\nrouter isis CORE\n net 49.0001.0000.0000.000${n}.00\n is-type level-2-only\n metric-style wide\n passive-interface Loopback0\nline con 0\n logging synchronous\n exec-timeout 0 0`;
      const ce = (n, two) => `hostname CE${n}\nno ip domain-lookup\ninterface Gi0/0\n no shutdown\n` + (two ? `interface Gi0/0.100\n encapsulation dot1Q 100\n ip address 10.100.0.${n} 255.255.255.0\n` : '') + `interface Gi0/0.200\n encapsulation dot1Q 200\n ip address 10.200.0.${n} 255.255.255.0\nline con 0\n logging synchronous\n exec-timeout 0 0`;
      return {
        PE1: pe(1), PE2: pe(2), PE3: pe(3),
        P1: 'hostname P1\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.10 255.255.255.255\n ip router isis CORE\ninterface Gi0/0\n ip address 10.1.1.1 255.255.255.254\n ip router isis CORE\n isis network point-to-point\n mpls ip\n no shutdown\ninterface Gi0/1\n ip address 10.1.2.1 255.255.255.254\n ip router isis CORE\n isis network point-to-point\n mpls ip\n no shutdown\ninterface Gi0/2\n ip address 10.1.3.1 255.255.255.254\n ip router isis CORE\n isis network point-to-point\n mpls ip\n no shutdown\nmpls ldp router-id Loopback0 force\nrouter isis CORE\n net 49.0001.0000.0000.0010.00\n is-type level-2-only\n metric-style wide\n passive-interface Loopback0\nline con 0\n logging synchronous\n exec-timeout 0 0',
        CE1: ce(1, true), CE2: ce(2, true), CE3: ce(3, false)
      };
    })(),
    pre: 'CSR1000v грузится 3–5 минут и требует ~3 ГБ RAM каждый. Без лицензии пропускная способность ограничена, но для пингов хватит. Если памяти мало, VPWS (задания 1–4) можно сделать на vIOS вместо CSR: классический <code>xconnect</code> там работает, а VPLS — нет.',
    tasks: [
      { t: 'Проверь транспорт', d: 'Перед сервисами убедись, что LSP между PE живы: LDP-соседи на P1, метки для loopback\'ов всех PE на каждом PE, <code>ping mpls ipv4</code> между PE.',
        check: 'P1#show mpls ldp neighbor\nPE1#show mpls forwarding-table 10.255.0.2 32\nPE1#ping mpls ipv4 10.255.0.2/32' },
      { t: 'E-Line VLAN 100: PE1 ↔ PE2', d: 'На PE1 и PE2: EFP (service instance 100) на Gi3 с encapsulation dot1q 100 и rewrite pop 1 symmetric, затем l2vpn xconnect context с PW к соседу, VC ID 100. Проверь <code>show mpls l2transport vc 100 detail</code> (метки, MTU) и пинг CE1 → 10.100.0.2.',
        check: 'PE1#show mpls l2transport vc 100 detail\nPE1#show mpls ldp neighbor 10.255.0.2\nCE1#ping 10.100.0.2',
        sol: 'PE1(config)#interface GigabitEthernet3\nPE1(config-if)#service instance 100 ethernet\nPE1(config-if-srv)#encapsulation dot1q 100\nPE1(config-if-srv)#rewrite ingress tag pop 1 symmetric\nPE1(config)#l2vpn xconnect context PW100\nPE1(config-xconnect)#member GigabitEthernet3 service-instance 100\nPE1(config-xconnect)#member 10.255.0.2 100 encapsulation mpls\n! PE2 зеркально, member 10.255.0.1 100' },
      { t: 'Прозрачность: клиентский OSPF через E-Line', d: 'Запусти OSPF между CE1 и CE2 на сабинтерфейсах .100. Поднимется ли соседство? Что видят PE о маршрутах клиента? Сними захват на линке PE1–P1: найди стек меток (транспорт + PW) и под ним Ethernet-кадр с OSPF hello.',
        check: 'CE1#show ip ospf neighbor\nPE1#show ip route | include 10.100' },
      { t: 'MTU mismatch', d: 'На PE2 поставь <code>mtu 1600</code> на Gi3 (или в service instance). Что с PW? Найди причину в выводе и почини.',
        check: 'PE1#show mpls l2transport vc 100 detail | include MTU|status' },
      { t: 'E-LAN VLAN 200 на трёх PE', d: 'На всех трёх PE: VFI VPLS200 (vpn id 200) с PW к двум другим PE, bridge-domain 200 с service instance 200 на Gi3 и членом vfi. Проверь, что CE1, CE2 и CE3 пингуют друг друга в 10.200.0.0/24.',
        check: 'PE1#show l2vpn vfi name VPLS200\nPE1#show bridge-domain 200\nCE3#ping 10.200.0.1\nCE3#ping 10.200.0.2',
        sol: 'PE1(config)#l2vpn vfi context VPLS200\nPE1(config-vfi)#vpn id 200\nPE1(config-vfi)#member 10.255.0.2 encapsulation mpls\nPE1(config-vfi)#member 10.255.0.3 encapsulation mpls\nPE1(config)#interface GigabitEthernet3\nPE1(config-if)#service instance 200 ethernet\nPE1(config-if-srv)#encapsulation dot1q 200\nPE1(config-if-srv)#rewrite ingress tag pop 1 symmetric\nPE1(config)#bridge-domain 200\nPE1(config-bdomain)#member GigabitEthernet3 service-instance 200\nPE1(config-bdomain)#member vfi VPLS200' },
      { t: 'MAC-обучение и split horizon', d: 'Посмотри MAC-таблицу bridge-domain 200 на PE1: где учатся MAC CE2 и CE3 (на каком PW)? Удали PW PE2 ↔ PE3 (оставь PE1 как «центр»). Видит ли CE2 CE3? Объясни через split horizon, почему full mesh обязателен.',
        check: 'PE1#show mac address-table bridge-domain 200\nCE2#ping 10.200.0.3' }
    ],
    brk: [
      { t: 'PW 100 down после «наведения порядка»', inj: 'PE2(config)#l2vpn xconnect context PW100\nPE2(config-xconnect)#no member 10.255.0.1 100 encapsulation mpls\nPE2(config-xconnect)#member 10.255.0.1 101 encapsulation mpls', h: '<code>show mpls l2transport vc detail</code> на обоих PE — VC ID и remote label.', f: 'Разные VC ID (100 и 101): каждый PE ждёт метку для своего VC ID и не получает. VC ID должен совпадать на обоих концах.' },
      { t: 'PW up, но CE1 не пингует CE2 по VLAN 100', inj: 'PE2(config)#interface GigabitEthernet3\nPE2(config-if)#service instance 100 ethernet\nPE2(config-if-srv)#no encapsulation dot1q 100\nPE2(config-if-srv)#encapsulation dot1q 110', h: 'Сравни encapsulation в service instance на обоих PE и тег, который шлёт CE2.', f: 'На PE2 AC ждёт VLAN 110, а CE2 шлёт 100: кадры CE2 не попадают в сервис. PW при этом up (сигнализация в порядке). Проверяй и сигнализацию, и классификацию трафика на AC.' }
    ],
    extra: '<p><b>CFM на E-Line.</b> Настрой CFM-домен уровня 5 на PE1 и PE2 с MEP на service instance 100 (down MEP в сторону клиента или up MEP в сторону PW). Посмотри <code>show ethernet cfm maintenance-points remote</code>, затем выключи Gi3 на PE2 и посмотри, как PE1 узнаёт об аварии по пропаже CCM.</p>'
  }
});
