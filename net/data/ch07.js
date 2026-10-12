COURSE.add({
  id: 'ch07',
  time: '≈ 6–7 часов',
  intro: `<p>Новые заводы в Новосибирске, Томске и Брно нужно связать с Москвой через интернет. Это туннели: GRE, IPsec и их комбинации, вплоть до DMVPN. Для инженера провайдера здесь две ценности. Первая — <b>понимание инкапсуляции</b>: туннель — это пакет в пакете. На этом построены MPLS, VXLAN, PPPoE, L2TP и вообще всё, что будет дальше. Вторая — <b>MTU и MSS</b>, самая частая причина заявок «пинг идёт, а сайт не открывается».</p>`,
  goals: [
    'Нарисовать заголовки пакета для GRE, IPsec tunnel/transport, GRE over IPsec и посчитать накладные расходы',
    'Объяснить проблему рекурсивной маршрутизации туннеля и как её избежать',
    'Объяснить IKE (фазы 1 и 2, SA, PFS), разницу crypto map и VTI и читать счётчики encaps/decaps',
    'Объяснить, как DMVPN (mGRE + NHRP + IPsec) строит туннели spoke-to-spoke по требованию',
    'Диагностировать проблемы MTU: PMTUD, black hole, MSS clamping, PPPoE 1492'
  ],
  why: `Корпоративные клиенты провайдера постоянно строят туннели поверх его сети, и заявки «VPN не поднимается» или «через VPN не открывается портал» приходят в поддержку. Сам провайдер использует GRE для доставки трафика (DDoS-очистка, стыки), а инкапсуляция и MTU — основа MPLS и всего оверлейного мира.`,
  refs: [
    { t: 'RFC 2784 — Generic Routing Encapsulation', u: 'https://www.rfc-editor.org/rfc/rfc2784' },
    { t: 'RFC 4301 — Security Architecture for IP; RFC 7296 — IKEv2', u: 'https://www.rfc-editor.org/rfc/rfc7296' },
    { t: 'RFC 1191 — Path MTU Discovery; RFC 4459 — MTU and Fragmentation Issues with In-the-Network Tunneling', u: 'https://www.rfc-editor.org/rfc/rfc4459' },
    { t: 'Cisco: Resolve IPv4 Fragmentation, MTU, MSS, and PMTUD Issues with GRE and IPsec', u: 'https://www.cisco.com/c/en/us/support/docs/ip/generic-routing-encapsulation-gre/25885-pmtud-ipfrag.html', n: 'лучший документ по MTU в туннелях' },
    { t: 'Cisco DMVPN Design Guide', u: 'https://www.cisco.com/c/en/us/td/docs/solutions/Enterprise/WAN_and_MAN/DMVPDG.html' },
    { t: 'linkmeup — СДСМ ч. 7', u: 'https://linkmeup.ru/blog/50.html', n: 'подробные примеры IPsec и DMVPN, задачи на troubleshooting' }
  ],
  theory: [
    {
      id: 'options', h: 'Как связать офисы: три пути и где тут провайдер',
      html: `
<table><tr><th>Способ</th><th>Что это</th><th>Плюсы / минусы</th></tr>
<tr><td>Свой физический канал</td><td>своя оптика, радиорелейка</td><td>полный контроль, дорого, далеко не дотянуть</td></tr>
<tr><td>Услуга провайдера</td><td>L2VPN (VLAN/QinQ, VPWS, VPLS) или L3VPN</td><td>гарантированная полоса, SLA, провайдер отвечает за связность. Это главы 11–12 — то, что ты будешь продавать и обслуживать</td></tr>
<tr><td>Туннель через интернет</td><td>GRE, IPsec, DMVPN, SSL VPN, WireGuard</td><td>дёшево (только интернет), но качество — best effort, полоса и задержки не гарантированы</td></tr></table>
<p>Туннель — это всегда <b>пакет в пакете</b>: исходный пакет с внутренними (часто частными) адресами упаковывается в новый внешний IP-заголовок с публичными адресами концов туннеля. Транзитные маршрутизаторы интернета видят только внешний заголовок.</p>`
    },
    {
      id: 'gre', h: 'GRE: простой туннель и его подводные камни',
      html: `
<div class="pkt"><span class="l3" style="flex:5">Внешний IP<small>20 · src/dst = концы туннеля</small></span><span class="lb" style="flex:1.7">GRE<small>4</small></span><span class="l3" style="flex:5">Внутренний IP<small>20 · частные адреса</small></span><span class="l7" style="flex:8">данные</span></div>
<p>GRE (IP-протокол 47) добавляет 24 байта: 20 внешнего IP + 4 GRE. Умеет носить что угодно: IPv4, IPv6, multicast (а значит OSPF), даже MPLS. Шифрования нет.</p>
<pre class="cli">R1(config)#interface Tunnel0
R1(config-if)#ip address 172.16.254.1 255.255.255.252
R1(config-if)#tunnel source Gi0/1                 ! или публичный адрес
R1(config-if)#tunnel destination 198.51.101.2
R1(config-if)#ip mtu 1476                         ! 1500 − 24
R1(config-if)#ip tcp adjust-mss 1436              ! 1476 − 40
R1(config-if)#keepalive 5 3                       ! туннель упадёт, если дальний конец мёртв
R1(config)#ip route 172.16.24.0 255.255.252.0 172.16.254.2
R1#show interfaces Tunnel0 | include protocol|Tunnel source|MTU</pre>
<h3>Рекурсивная маршрутизация — классика</h3>
<p>Туннель поднят, по нему пошёл OSPF. Он узнаёт <b>через туннель</b> маршрут к сети, где лежит tunnel destination, и этот маршрут лучше (или точнее) пути через интернет. Маршрутизатор пытается отправить инкапсулированный пакет к tunnel destination… через сам туннель. Получается бесконечная рекурсия. IOS это замечает: <code>%TUN-5-RECURDOWN: Tunnel0 temporarily disabled due to recursive routing</code>. Туннель флапает каждую минуту.</p>
<div class="callout ok"><b>Правило</b>Маршрут к tunnel destination должен всегда идти <b>вне</b> туннеля: через default или статику к провайдеру. Не анонсируй внешние (публичные) адреса в протокол маршрутизации, который работает внутри туннеля. Используй разные адресные пространства (или VRF для транспорта, front-door VRF).</div>
<h3>Состояние туннеля</h3>
<p>Без keepalive GRE-интерфейс в up/up, если есть маршрут к tunnel destination, даже если дальний конец мёртв. Значит, статика через туннель не уберётся. Решения: <code>keepalive</code> (GRE-keepalive, только point-to-point GRE), протокол маршрутизации внутри туннеля (его hello сами обнаружат отказ), BFD.</p>`
    },
    {
      id: 'mtu', h: 'MTU, фрагментация, PMTUD и MSS — главное в главе',
      html: `
<p>MTU интерфейса — максимальный размер IP-пакета (без L2-заголовка), обычно 1500. Каждая инкапсуляция съедает часть:</p>
<table><tr><th>Инкапсуляция</th><th>Накладные</th><th>Остаётся под внутренний IP</th></tr>
<tr><td>GRE</td><td>24</td><td>1476</td></tr>
<tr><td>IPsec ESP tunnel (AES + SHA)</td><td>~52–73 (зависит от выравнивания)</td><td>~1420–1440</td></tr>
<tr><td>GRE over IPsec transport</td><td>~56–80</td><td>~1400</td></tr>
<tr><td><b>PPPoE</b></td><td>8 (PPPoE 6 + PPP 2)</td><td><b>1492</b></td></tr>
<tr><td>802.1Q / QinQ</td><td>4 / 8 (на L2, MTU IP не меняет, если транспорт 1504/1508+)</td><td>1500</td></tr>
<tr><td>MPLS (на каждую метку)</td><td>4</td><td>зависит от MTU ядра</td></tr>
<tr><td>VXLAN</td><td>50</td><td>1450 при MTU underlay 1500</td></tr></table>
<h3>Что происходит с большим пакетом</h3>
<ol class="steps"><li>Если флаг <b>DF</b> (Don't Fragment) снят, маршрутизатор фрагментирует пакет. Это дорого: фрагментация и, особенно, сборка на конце туннеля нагружают CPU. Часть устройств и фаерволов фрагменты отбрасывает.</li>
<li>Если <b>DF</b> установлен (так делают почти все современные TCP-стеки, это основа PMTUD), маршрутизатор отбрасывает пакет и шлёт отправителю <b>ICMP type 3 code 4 «Fragmentation needed»</b> с MTU следующего хопа. Отправитель уменьшает размер. Это <b>Path MTU Discovery</b>.</li>
<li>Если этот ICMP где-то <b>фильтруется</b> («безопасник закрыл весь ICMP»), отправитель не узнаёт о проблеме и шлёт большие пакеты снова и снова. Это <b>PMTUD black hole</b>: TCP-handshake проходит (пакеты маленькие), ping проходит, а как только пошли полноразмерные данные — сессия виснет.</li></ol>
<h3>MSS clamping — лекарство, которое работает всегда</h3>
<p>TCP MSS (Maximum Segment Size) — сколько данных TCP положит в один сегмент. Его объявляют в SYN. Маршрутизатор на пути может <b>переписать MSS в проходящих SYN</b> на меньшее значение: тогда обе стороны с самого начала шлют сегменты, которые пролезают в туннель. Формула: <b>MSS = MTU туннеля − 40</b> (20 IP + 20 TCP).</p>
<pre class="cli">interface Tunnel0
 ip mtu 1400
 ip tcp adjust-mss 1360
! PPPoE (BRAS или абонентский роутер):
interface Dialer1
 ip mtu 1492
 ip tcp adjust-mss 1452
! проверка: найти максимальный пролезающий размер с DF
R1#ping 172.16.24.1 size 1476 df-bit
R1#ping 172.16.24.1 size 1477 df-bit       ! M.M.M — fragmentation needed
C:\>ping -f -l 1472 8.8.8.8                ! Windows: 1472 + 28 = 1500</pre>
<div class="callout pro"><b>Заявка, которую ты получишь сто раз</b>«Интернет есть, Google открывается, а сайт банка или корпоративный портал — нет, письма с вложениями не уходят». Абонент на PPPoE, или за туннелем, или у клиента свой VPN, и где-то режется ICMP. Проверка: <code>ping -f -l 1472</code> (Windows) и уменьшать, пока не пройдёт. Лечение: MSS clamping на BRAS или роутере, правильный MTU, не фильтровать ICMP type 3.</div>
<div class="callout info"><b>UDP и MSS</b>MSS clamping помогает только TCP. UDP-приложения (VPN поверх UDP, игры, QUIC) должны сами учитывать MTU, иначе нужна фрагментация. QUIC сам ограничивает размер пакетов примерно 1200–1350 байтами именно поэтому.</div>`
    },
    {
      id: 'ipsec', h: 'IPsec: что шифруется и как договариваются',
      html: `
<p>IPsec — набор протоколов: <b>ESP</b> (IP-протокол 50: шифрование + целостность), <b>AH</b> (протокол 51: только целостность, не проходит NAT, почти не используется) и <b>IKE</b> (UDP 500, а за NAT — UDP 4500: договориться о ключах и параметрах).</p>
<div class="vs"><div><b>Tunnel mode</b><br>Шифруется <b>весь</b> исходный IP-пакет, добавляется новый внешний IP. Для site-to-site, когда шифруют шлюзы.<div class="pkt"><span class="l3" style="flex:4">нов. IP</span><span class="lb" style="flex:2">ESP</span><span class="l7" style="flex:9">[IP + данные] шифр</span><span class="lb" style="flex:2">ESP trl/ICV</span></div></div>
<div><b>Transport mode</b><br>Шифруется только содержимое пакета, IP-заголовок остаётся. Используется, когда туннель уже есть: <b>GRE over IPsec</b> (шифруем GRE-пакет между теми же адресами).<div class="pkt"><span class="l3" style="flex:4">IP</span><span class="lb" style="flex:2">ESP</span><span class="l7" style="flex:9">[GRE+…] шифр</span><span class="lb" style="flex:2">ICV</span></div></div></div>
<h3>IKE: две фазы</h3>
<ol class="steps"><li><b>Фаза 1</b> (IKE SA): стороны аутентифицируют друг друга (pre-shared key или сертификаты), договариваются об алгоритмах (шифрование, хеш, группа Диффи-Хеллмана, время жизни) и строят защищённый управляющий канал. В IKEv1 это main mode (6 сообщений) или aggressive (3).</li>
<li><b>Фаза 2</b> (IPsec SA, «quick mode»): внутри защищённого канала договариваются о параметрах шифрования <b>данных</b>: transform set, какой трафик шифровать (proxy ID / crypto ACL), PFS. Получаются две однонаправленные SA (по одной в каждую сторону) со своими SPI.</li></ol>
<p><b>IKEv2</b> (RFC 7296) делает то же за 4 сообщения, надёжнее, встроенно поддерживает NAT-T, EAP и dead peer detection. В новых конфигурациях только IKEv2.</p>
<h3>Crypto map против VTI</h3>
<ul><li><b>Crypto map</b> — «шифровать то, что попало в ACL, при выходе через этот физический интерфейс». Policy-based: нет интерфейса туннеля, протоколы маршрутизации и multicast напрямую не ходят, отладка мучительна.</li>
<li><b>VTI</b> (<code>tunnel mode ipsec ipv4</code> + <code>tunnel protection</code>) — route-based: туннель — это интерфейс, маршрутизируешь в него что хочешь, OSPF и BGP работают. Современный стандарт.</li></ul>
<pre class="cli">crypto ikev2 proposal P1
 encryption aes-cbc-256
 integrity sha256
 group 14
crypto ikev2 policy POL
 proposal P1
crypto ikev2 keyring KR
 peer BR1
  address 198.51.101.2
  pre-shared-key Str0ngKey
crypto ikev2 profile PROF
 match identity remote address 198.51.101.2 255.255.255.255
 authentication remote pre-share
 authentication local pre-share
 keyring local KR
crypto ipsec transform-set TS esp-aes 256 esp-sha256-hmac
 mode tunnel
crypto ipsec profile VTI
 set transform-set TS
 set ikev2-profile PROF
interface Tunnel1
 ip address 172.16.253.1 255.255.255.252
 tunnel source Gi0/1
 tunnel destination 198.51.101.2
 tunnel mode ipsec ipv4
 tunnel protection ipsec profile VTI</pre>
<h3>Диагностика IPsec по счётчикам</h3>
<pre class="cli">R1#show crypto ikev2 sa              ! фаза 1: READY?
R1#show crypto ipsec sa | include peer|pkts|errors
    #pkts encaps: [[125]], #pkts encrypt: 125, #pkts digest: 125
    #pkts decaps: [[0]], #pkts decrypt: 0, #pkts verify: 0</pre>
<table><tr><th>Картина</th><th>Где искать</th></tr>
<tr><td>нет IKE SA</td><td>связность UDP 500/4500, ключ, proposal, identity, фаервол по пути</td></tr>
<tr><td>IKE есть, IPsec SA нет</td><td>transform set, proxy ID (crypto ACL зеркальны?), PFS</td></tr>
<tr><td><b>encaps растут, decaps — 0</b></td><td>мы шифруем и шлём, а обратно ничего не приходит: проблема на дальней стороне (её маршрутизация, её ACL) или ESP режется по пути (NAT без NAT-T)</td></tr>
<tr><td>ничего не растёт</td><td>трафик не попадает в туннель: маршрут или crypto ACL</td></tr>
<tr><td>растут errors / replay</td><td>несогласованность, QoS переупорядочивает пакеты (anti-replay window)</td></tr></table>
<div class="callout warn"><b>NAT и IPsec</b>ESP — не TCP и не UDP, у него нет портов, и PAT не может его транслировать. NAT-Traversal (автоматически в IKEv2, и в IKEv1 тоже, если обе стороны поддерживают) заворачивает ESP в UDP 4500. За CGNAT (глава 5) IPsec работает только с NAT-T, а инициатором может быть только сторона за NAT.</div>`
    },
    {
      id: 'dmvpn', h: 'DMVPN: туннели по требованию',
      html: `
<p>Хаб и 50 филиалов. Точка-точка GRE от каждого филиала к каждому — это 1225 туннелей. Только к хабу — 50, но тогда весь трафик филиал↔филиал идёт через Москву. DMVPN решает обе проблемы:</p>
<ul><li><b>mGRE</b> (<code>tunnel mode gre multipoint</code>) — один туннельный интерфейс на всех, без фиксированного destination.</li>
<li><b>NHRP</b> (Next Hop Resolution Protocol) — «ARP для туннеля»: соответствие «туннельный адрес → публичный адрес» (172.16.254.3 → 198.51.102.2). Споки регистрируются на хабе (NHS). Когда споку нужен другой спок, он спрашивает хаб.</li>
<li><b>IPsec</b> profile поверх (transport mode) — всё шифруется.</li></ul>
<h3>Фазы DMVPN</h3>
<table><tr><th>Фаза</th><th>Spoke↔spoke</th><th>Маршрутизация</th></tr>
<tr><td>1</td><td>нет, всё через хаб</td><td>споки могут получать только default/суммарный маршрут</td></tr>
<tr><td>2</td><td>да, прямой туннель</td><td>споки должны видеть маршруты друг друга с next-hop дальнего спока, без суммаризации на хабе (OSPF broadcast + DR на хабе, EIGRP <code>no next-hop-self</code>)</td></tr>
<tr><td>3</td><td>да, через NHRP redirect/shortcut</td><td>хаб может суммаризировать (хоть только default), хаб шлёт споку <b>redirect</b>, а спок ставит shortcut-маршрут. Масштабируемый вариант</td></tr></table>
<pre class="cli">! хаб (фаза 3)
interface Tunnel0
 ip address 172.16.254.1 255.255.255.0
 ip nhrp network-id 1
 ip nhrp map multicast dynamic
 ip nhrp redirect
 tunnel source Gi0/1
 tunnel mode gre multipoint
 tunnel protection ipsec profile DMVPN
! спок
interface Tunnel0
 ip address 172.16.254.2 255.255.255.0
 ip nhrp network-id 1
 ip nhrp nhs 172.16.254.1 nbma 198.51.100.2 multicast
 ip nhrp shortcut
 tunnel source Gi0/1
 tunnel mode gre multipoint
 tunnel protection ipsec profile DMVPN
R2#show dmvpn
R2#show ip nhrp</pre>
<div class="callout info"><b>Что дальше</b>DMVPN — классика корпоративного WAN. Сейчас на его месте часто SD-WAN (Cisco SD-WAN/Viptela, Fortinet, VMware VeloCloud): тот же принцип оверлея поверх любых каналов плюс централизованное управление и выбор канала по качеству. Провайдер в этой картине даёт underlay, то есть каналы интернета и L2/L3VPN.</div>`
    },
    {
      id: 'other', h: 'Другие туннели, которые встретятся у провайдера',
      html: `
<ul>
<li><b>PPPoE</b> — не туннель через интернет, а инкапсуляция PPP в Ethernet для абонентского доступа: сессия от роутера абонента до BRAS, авторизация по логину и паролю (RADIUS), MTU 1492. Отсюда половина проблем MTU в ШПД.</li>
<li><b>L2TP</b> (UDP 1701) — туннелирование PPP-сессий между LAC и LNS. Оптовый доступ: «чужие» абоненты через твою сеть доставляются на BRAS другого оператора. L2TPv3 — псевдопровод для L2-трафика поверх IP.</li>
<li><b>GRE у провайдера</b> — доставка очищенного трафика из центра DDoS-очистки обратно клиенту, туннели в ЦОД, временные обходы.</li>
<li><b>VXLAN</b> (UDP 4789) — L2 поверх IP, оверлей в ЦОД, с EVPN в качестве control plane (главы 12.1, Д2).</li>
<li><b>MPLS</b> — тоже «туннели», но на метках, без внешнего IP: главы 10–13.</li>
<li><b>WireGuard / OpenVPN / SSL VPN</b> — удалённый доступ сотрудников и личные VPN абонентов: просто UDP/TCP-трафик для сети провайдера (и снова MTU).</li></ul>`
    }
  ],
  cmds: [
    { g: 'GRE' },
    { c: 'interface Tunnel0\n tunnel source Gi0/1\n tunnel destination X\n ip address …', d: 'GRE-туннель точка-точка', hw: 'interface Tunnel0/0/0\n tunnel-protocol gre\n source …\n destination …', jn: 'set interfaces gr-0/0/0 unit 0 tunnel source … destination …' },
    { c: 'keepalive 5 3', d: 'GRE keepalive: туннель down при недоступности конца', hw: 'keepalive period 5 retry-times 3', jn: 'keepalive-time 5 hold-time 15 (OAM)' },
    { c: 'show interfaces Tunnel0', d: 'Состояние, source/destination, MTU туннеля', hw: 'display interface Tunnel0/0/0', jn: 'show interfaces gr-0/0/0' },
    { g: 'MTU / MSS' },
    { c: 'ip mtu 1400', d: 'IP MTU интерфейса (туннеля)', hw: 'mtu 1400', jn: 'family inet mtu 1400' },
    { c: 'ip tcp adjust-mss 1360', d: 'Переписывать MSS в TCP SYN (MTU − 40)', hw: 'tcp adjust-mss 1360', jn: 'set system internet-options tcp-mss 1360 / flow tcp-mss' },
    { c: 'ping X size 1476 df-bit', d: 'Поиск Path MTU с запретом фрагментации', hw: 'ping -f -s 1476 X', jn: 'ping X size 1448 do-not-fragment' },
    { c: 'show ip traffic | include frag', d: 'Счётчики фрагментации и сборки', hw: 'display ip statistics', jn: 'show system statistics ip' },
    { g: 'IPsec' },
    { c: 'show crypto ikev2 sa / show crypto isakmp sa', d: 'Фаза 1 (IKE SA)', hw: 'display ike sa', jn: 'show security ike security-associations' },
    { c: 'show crypto ipsec sa', d: 'Фаза 2: SPI, счётчики encaps/decaps, ошибки', hw: 'display ipsec sa', jn: 'show security ipsec security-associations [detail]' },
    { c: 'show crypto session [detail]', d: 'Краткое состояние всех сессий', hw: 'display ipsec statistics', jn: 'show security ipsec statistics' },
    { c: 'tunnel mode ipsec ipv4\ntunnel protection ipsec profile P', d: 'IPsec VTI', hw: 'tunnel-protocol ipsec\n ipsec profile P', jn: 'st0 interface + bind-interface' },
    { c: 'debug crypto ikev2 / debug crypto ipsec', d: 'Отладка согласования', hw: 'debugging ike all', jn: 'traceoptions flag all' },
    { g: 'DMVPN / NHRP' },
    { c: 'tunnel mode gre multipoint', d: 'mGRE-интерфейс', hw: 'tunnel-protocol gre p2mp' },
    { c: 'ip nhrp nhs X nbma Y multicast', d: 'Спок: адрес NHS (хаба) и его публичный адрес', hw: 'nhrp entry X Y register' },
    { c: 'ip nhrp redirect / ip nhrp shortcut', d: 'DMVPN фаза 3 (хаб / спок)', hw: 'nhrp redirect / nhrp shortcut' },
    { c: 'show dmvpn [detail]', d: 'Пиры DMVPN, состояние, тип записи (S/D)', hw: 'display dsvpn session' },
    { c: 'show ip nhrp', d: 'Кэш NHRP: туннельный адрес → NBMA', hw: 'display nhrp peer all' }
  ],
  cards: [
    ['Сколько байт добавляет GRE и какой IP-протокол?', '24 байта (20 внешний IP + 4 GRE). IP-протокол 47.'],
    ['Что такое рекурсивная маршрутизация туннеля?', 'Маршрут к tunnel destination начинает идти через сам туннель (узнан протоколом внутри туннеля). Получается бесконечная инкапсуляция. IOS гасит туннель: %TUN-5-RECURDOWN.'],
    ['Почему GRE-туннель может быть up/up при мёртвом дальнем конце?', 'Без keepalive состояние зависит только от наличия маршрута к destination. Решение: keepalive, протокол маршрутизации внутри или BFD.'],
    ['MTU после PPPoE?', '1492 (1500 − 6 PPPoE − 2 PPP). MSS = 1452.'],
    ['Формула MSS clamping?', 'MSS = MTU пути (туннеля) − 40 (20 байт IP + 20 TCP).'],
    ['Что такое PMTUD?', 'Отправитель ставит DF. Маршрутизатор с меньшим MTU отбрасывает пакет и шлёт ICMP type 3 code 4 (fragmentation needed) с MTU. Отправитель уменьшает размер.'],
    ['Что такое PMTUD black hole и симптомы?', 'ICMP «fragmentation needed» режется по пути. Симптомы: ping и handshake проходят, сайты и HTTPS виснут, большие письма не уходят. Лечение: MSS clamping, MTU, не фильтровать ICMP type 3.'],
    ['Как в Windows проверить Path MTU?', '<code>ping -f -l 1472 адрес</code> (1472 + 28 = 1500), уменьшать до прохождения.'],
    ['ESP vs AH?', 'ESP (IP 50): шифрование + целостность, проходит NAT с NAT-T. AH (IP 51): только целостность, ломается NAT. На практике используют ESP.'],
    ['Tunnel vs transport mode IPsec?', 'Tunnel: шифруется весь исходный пакет, новый внешний IP (site-to-site между шлюзами). Transport: шифруется содержимое, IP-заголовок остаётся (GRE over IPsec).'],
    ['Фазы IKE?', 'Фаза 1: взаимная аутентификация, IKE SA (защищённый управляющий канал). Фаза 2: IPsec SA для данных: transform set, proxy ID, PFS. Две однонаправленные SA.'],
    ['Порты IKE и NAT-T?', 'UDP 500 (IKE), UDP 4500 (NAT-T: ESP в UDP).'],
    ['Crypto map vs VTI?', 'Crypto map — policy-based: шифровать трафик из ACL на физическом интерфейсе, без туннельного интерфейса. VTI — route-based: туннель — это интерфейс, в него маршрутизируют, работают IGP/BGP/multicast.'],
    ['encaps растут, decaps = 0. Где проблема?', 'Мы шифруем и отправляем, но ничего не получаем: дальняя сторона (маршрутизация, ACL, её SA) или ESP теряется по пути (NAT без NAT-T, фаервол).'],
    ['Три компонента DMVPN?', 'mGRE (один многоточечный туннель), NHRP (туннельный адрес → публичный NBMA), IPsec profile.'],
    ['Фазы DMVPN 1/2/3?', '1 — только через хаб. 2 — прямые spoke-spoke, но споки должны знать точные маршруты с next-hop спока. 3 — хаб суммаризирует, NHRP redirect + shortcut строят прямые пути.'],
    ['Почему IPsec без NAT-T не проходит PAT?', 'У ESP нет портов, PAT не может различить и транслировать потоки.'],
    ['Что такое L2TP и где у провайдера?', 'Туннелирование PPP-сессий в UDP 1701 между LAC и LNS. Оптовый доступ: абоненты через чужую сеть доставляются на свой BRAS.'],
    ['Накладные VXLAN?', '50 байт (внешний Ethernet 14 + IP 20 + UDP 8 + VXLAN 8). Underlay обычно с MTU 9000+.']
  ],
  quiz: [
    { q: 'Через GRE-туннель ping проходит, а SSH-сессия зависает при выводе длинного show run. ICMP на пути частично фильтруется. Диагноз и лечение?', o: ['Проблема ACL на 22 порт', 'PMTUD black hole; MSS clamping (ip tcp adjust-mss) и корректный ip mtu на туннеле', 'Медленный канал', 'Ошибка IKE'], a: 1, e: 'Мелкие пакеты проходят, большие сегменты с DF дропаются без обратной связи. adjust-mss лечит TCP независимо от ICMP.' },
    { q: 'Через минуту после включения OSPF внутри туннеля он начал падать с %TUN-5-RECURDOWN. Причина?', o: ['MTU', 'Маршрут к tunnel destination стал идти через сам туннель', 'Не совпадает ключ', 'Нет keepalive'], a: 1, e: 'OSPF принёс через туннель маршрут к публичному адресу дальнего конца. Не анонсируй транспортные адреса внутрь туннеля.' },
    { q: 'Какой MSS ставить на туннеле с ip mtu 1400?', o: ['1400', '1360', '1380', '1460'], a: 1, e: '1400 − 20 (IP) − 20 (TCP) = 1360.' },
    { q: 'Абонент на PPPoE: часть сайтов не открывается. С его ПК «ping -f -l 1472 8.8.8.8» — «Packet needs to be fragmented», а «-l 1464» проходит. Что это значит и что делать?', o: ['DNS', 'Path MTU = 1492; нужен MSS clamping на BRAS/роутере (1452) или MTU 1492 на ПК', 'Сломан BRAS', 'Нужен IPv6'], a: 1, e: '1464 + 28 = 1492. Это MTU PPPoE. Проблема возникает, когда где-то теряется ICMP. Лечение — clamping.' },
    { q: 'show crypto ipsec sa: encaps 500, decaps 0. Что проверить в первую очередь?', o: ['Свою crypto ACL', 'Дальнюю сторону и путь: доходят ли ESP-пакеты и отвечает ли пир (его маршрут обратно, его ACL)', 'Ключ фазы 1', 'Transform set'], a: 1, e: 'IPsec SA уже есть (фаза 1 и 2 согласованы), значит ключи и transform set в порядке. Ответного шифрованного трафика нет.' },
    { q: 'Чем VTI удобнее crypto map? (несколько)', o: ['Туннель — интерфейс, в него можно маршрутизировать', 'Работают протоколы маршрутизации и multicast', 'Не нужен IKE', 'Проще диагностика (счётчики интерфейса, маршруты)'], a: [0, 1, 3], e: 'IKE нужен в обоих случаях.' },
    { q: 'Филиал за CGNAT провайдера. IPsec с ним не поднимается, пока не включили NAT-T. Почему?', o: ['IKE не работает за NAT', 'ESP без портов не транслируется PAT; NAT-T заворачивает ESP в UDP 4500', 'Нужен белый IP на обеих сторонах', 'CGNAT блокирует 500'], a: 1, e: 'NAT-T решает проблему для ESP. В IKEv2 он включается автоматически при обнаружении NAT.' },
    { q: 'DMVPN фаза 3. Как спок узнаёт, что можно построить прямой туннель к другому споку?', o: ['Из таблицы маршрутизации', 'Хаб отправляет NHRP redirect, спок делает resolution request и ставит shortcut', 'Спок пингует все публичные адреса', 'Через OSPF DR'], a: 1, e: 'Redirect + shortcut — суть фазы 3. Маршрутизация на хабе при этом может быть суммарной.' },
    { q: 'GRE-туннель, статический маршрут в него, keepalive не настроен. Дальний маршрутизатор выключили. Что с туннелем на нашей стороне?', o: ['down — маршрут удалится', 'up/up — статика останется, трафик уходит в никуда', 'administratively down', 'перезагрузится'], a: 1, e: 'Без keepalive состояние GRE определяется только наличием маршрута к destination.' },
    { q: 'Сколько IPsec SA создаётся между двумя пирами для одного потока данных?', o: ['Одна двунаправленная', 'Две однонаправленные (inbound и outbound)', 'Четыре', 'По одной на протокол'], a: 1, e: 'IPsec SA однонаправленные, каждая со своим SPI.' },
    { q: 'Почему QUIC (HTTP/3) почти не страдает от проблем MTU?', o: ['Он работает поверх TCP', 'Он сам держит размер пакетов около 1200–1350 байт и делает свой PMTUD', 'Ему не нужен IP', 'Он всегда фрагментирует'], a: 1, e: 'QUIC — UDP, к нему MSS clamping неприменим, поэтому протокол консервативен в размере пакета.' },
    { q: 'Какие инкапсуляции уменьшают доступный MTU для IP-пакета абонента при транспорте 1500? (несколько)', o: ['PPPoE', 'GRE', 'IPsec ESP', '802.1Q-тег на транке с MTU 1504+'], a: [0, 1, 2], e: 'Тег 802.1Q живёт на L2: если транспорт рассчитан на 1504+ (а так и должно быть), IP MTU 1500 сохраняется.' }
  ],
  und: [
    { q: 'Объясни полную картину проблемы «пинг идёт, сайты не открываются» за туннелем: что происходит с пакетами, почему ping проходит, и три способа лечения.', a: '<p>Туннель (GRE, IPsec, PPPoE) уменьшает MTU пути. TCP-стеки шлют полноразмерные сегменты (1500) с DF. На входе в туннель маршрутизатор не может их ни передать, ни фрагментировать (DF), отбрасывает и шлёт ICMP «fragmentation needed». Если ICMP режется по пути (фаервол, «закрыли ICMP»), отправитель не узнаёт и повторяет: сессия висит. Ping по умолчанию маленький (64 байта), handshake маленький — они проходят. Лечение: 1) MSS clamping на маршрутизаторе туннеля (adjust-mss = MTU − 40): TCP сразу шлёт сегменты, которые пролезут; 2) правильный ip mtu на туннеле и хостах; 3) не фильтровать ICMP type 3 code 4, чтобы PMTUD работал.</p>', k: ['инкапсуляция уменьшает MTU', 'DF + ICMP frag-needed', 'ICMP режется → black hole', 'маленькие пакеты проходят', 'MSS clamping, MTU, разрешить ICMP'] },
    { q: 'Как IPsec-пиры договариваются о шифровании? Опиши фазы, что в каждой согласуется и как по выводам понять, на какой фазе проблема.', a: '<p>Фаза 1 (IKE SA): аутентификация пиров (PSK/сертификаты) и параметры управляющего канала (шифр, хеш, DH-группа, lifetime). Проверка: <code>show crypto ikev2 sa</code> (READY) или isakmp sa (QM_IDLE). Нет — смотри UDP 500/4500, ключ, proposal, identity. Фаза 2 (IPsec SA): transform set, proxy ID (что шифруем), PFS, lifetime данных. Две однонаправленные SA. Проверка: <code>show crypto ipsec sa</code>: есть ли SPI и как растут encaps/decaps. Нет SA при живом IKE — transform set или proxy ID. Есть SA, но decaps 0 — проблема у пира или на пути.</p>', k: ['фаза 1: аутентификация + IKE SA', 'фаза 2: transform set, proxy ID, PFS', 'команды проверки', 'чтение счётчиков'] },
    { q: 'Зачем DMVPN и как в нём устанавливается прямой туннель spoke-to-spoke (фаза 3)?', a: '<p>Задача: много филиалов, туннели нужны и к хабу, и между филиалами, без ручной настройки N×N. mGRE даёт один многоточечный интерфейс, NHRP хранит «туннельный → публичный адрес», IPsec профиль шифрует. Споки при старте регистрируются на хабе (NHS). Первый пакет к другому споку идёт через хаб. Хаб видит, что пакет вошёл и вышел через тот же туннель, и шлёт источнику NHRP redirect. Спок отправляет resolution request, получает публичный адрес другого спока, поднимает к нему IPsec и прямой GRE и ставит NHRP shortcut-маршрут. Дальше трафик идёт напрямую. Неактивные shortcut-туннели со временем удаляются.</p>', k: ['mGRE + NHRP + IPsec', 'регистрация на NHS', 'redirect от хаба', 'resolution + shortcut', 'прямой трафик'] }
  ],
  lab: {
    title: 'Лаба 7. Москва, Новосибирск, Томск через «интернет»',
    time: '≈ 3 часа',
    goal: `<p>Хаб в Москве и два филиала соединены через маршрутизатор «Интернет». Построить GRE с OSPF внутри и поймать рекурсивную маршрутизацию, измерить MTU и вылечить black hole через MSS. Затем защитить канал IPsec VTI (IKEv2) и собрать DMVPN фазы 3 с прямым туннелем между филиалами.</p>`,
    topo: {
      w: 860, h: 420,
      nodes: [
        { id: 'INET', t: 'isp', x: 430, y: 200, label: 'INET\n«интернет»', role: 'маршрутизатор интернета (только публичные сети)' },
        { id: 'HQ', t: 'router', x: 160, y: 90, label: 'HQ Москва\n198.51.100.2\nLAN Lo1 172.16.0.1/24', role: 'хаб' },
        { id: 'NSK', t: 'router', x: 700, y: 90, label: 'NSK Новосибирск\n198.51.101.2\nLAN Lo1 172.16.32.1/24', role: 'спок 1' },
        { id: 'TMS', t: 'router', x: 700, y: 330, label: 'TMS Томск\n198.51.102.2\nLAN Lo1 172.16.40.1/24', role: 'спок 2' }
      ],
      links: [['HQ', 'Gi0/1', 'INET', 'Gi0/0', '198.51.100.0/30'], ['NSK', 'Gi0/1', 'INET', 'Gi0/1', '198.51.101.0/30'], ['TMS', 'Gi0/1', 'INET', 'Gi0/2', '198.51.102.0/30'],
        ['HQ', 'Tu', 'NSK', 'Tu', 'туннели', { dash: true, c: '#a855f7', virt: true }], ['HQ', '', 'TMS', '', '', { dash: true, c: '#a855f7', virt: true }]]
    },
    addr: [['HQ / NSK / TMS', 'Gi0/1', '198.51.10x.2/30, шлюз .1 (INET)'], ['INET', 'Gi0/0–2', '198.51.100.1, 101.1, 102.1'], ['Туннель GRE HQ–NSK', 'Tunnel0', '172.16.254.1/30 — .2'], ['VTI HQ–NSK', 'Tunnel1', '172.16.253.1/30 — .2'], ['DMVPN', 'Tunnel10', '172.16.250.0/24: HQ .1, NSK .2, TMS .3']],
    init: {
      INET: 'hostname INET\nno ip domain-lookup\ninterface Gi0/0\n ip address 198.51.100.1 255.255.255.252\n no shutdown\ninterface Gi0/1\n ip address 198.51.101.1 255.255.255.252\n no shutdown\ninterface Gi0/2\n ip address 198.51.102.1 255.255.255.252\n no shutdown\nline con 0\n logging synchronous\n exec-timeout 0 0',
      HQ: 'hostname HQ\nno ip domain-lookup\ninterface Loopback1\n ip address 172.16.0.1 255.255.255.0\ninterface Gi0/1\n ip address 198.51.100.2 255.255.255.252\n no shutdown\nip route 0.0.0.0 0.0.0.0 198.51.100.1\nline con 0\n logging synchronous\n exec-timeout 0 0',
      NSK: 'hostname NSK\nno ip domain-lookup\ninterface Loopback1\n ip address 172.16.32.1 255.255.255.0\ninterface Gi0/1\n ip address 198.51.101.2 255.255.255.252\n no shutdown\nip route 0.0.0.0 0.0.0.0 198.51.101.1\nline con 0\n logging synchronous\n exec-timeout 0 0',
      TMS: 'hostname TMS\nno ip domain-lookup\ninterface Loopback1\n ip address 172.16.40.1 255.255.255.0\ninterface Gi0/1\n ip address 198.51.102.2 255.255.255.252\n no shutdown\nip route 0.0.0.0 0.0.0.0 198.51.102.1\nline con 0\n logging synchronous\n exec-timeout 0 0'
    },
    pre: 'Публичная связность уже есть: все трое пингуют друг друга по адресам 198.51.x.2. Частные LAN (Lo1) INET не знает и знать не должен.',
    tasks: [
      { t: 'GRE HQ–NSK и статика', d: 'Подними Tunnel0 между HQ и NSK (172.16.254.0/30). Пропиши статику до LAN друг друга через туннель. Проверь <code>ping 172.16.32.1 source Lo1</code> с HQ и traceroute: сколько хопов видно? Почему INET не виден в трассировке?',
        check: 'HQ#show interfaces Tunnel0 | include protocol|source|destination|MTU\nHQ#ping 172.16.32.1 source Lo1\nHQ#traceroute 172.16.32.1 source Lo1',
        sol: 'HQ(config)#interface Tunnel0\nHQ(config-if)#ip address 172.16.254.1 255.255.255.252\nHQ(config-if)#tunnel source Gi0/1\nHQ(config-if)#tunnel destination 198.51.101.2\nHQ(config)#ip route 172.16.32.0 255.255.255.0 172.16.254.2\n! NSK зеркально' },
      { t: 'Захват: пакет в пакете', d: 'Сними захват на линке HQ–INET во время пинга по туннелю. Найди внешний IP (198.51…), заголовок GRE (протокол 47), внутренний IP (172.16…). Посчитай размер добавки.' },
      { t: 'OSPF в туннеле и рекурсия', d: 'Убери статику, включи OSPF area 0 на Tunnel0 и Lo1 с обеих сторон. Работает. Теперь «по ошибке» добавь в OSPF на NSK и интерфейс Gi0/1 (<code>ip ospf 1 area 0</code>). Подожди минуту. Что с туннелем на HQ? Найди в логах причину и почини.',
        check: 'HQ#show logging | include TUN\nHQ#show ip route 198.51.101.2',
        sol: '! HQ узнаёт 198.51.101.0/30 по OSPF через туннель (AD 110) — точнее, чем default (0/0)\n! → путь к tunnel destination через сам туннель → %TUN-5-RECURDOWN\nNSK(config)#interface Gi0/1\nNSK(config-if)#no ip ospf 1 area 0' },
      { t: 'Измерь MTU и вылечи MSS', d: 'С HQ найди максимальный размер пинга до 172.16.32.1 с <code>df-bit</code> (source Lo1). Совпадает с 1500 − 24? Выставь на туннеле <code>ip mtu 1476</code> и <code>ip tcp adjust-mss 1436</code>. Объясни, кому это поможет, а кому нет (UDP).',
        check: 'HQ#ping 172.16.32.1 source Lo1 size 1476 df-bit\nHQ#ping 172.16.32.1 source Lo1 size 1477 df-bit' },
      { t: 'IPsec VTI на IKEv2', d: 'Сделай второй туннель Tunnel1 HQ–NSK (172.16.253.0/30) как IPsec VTI с IKEv2 (AES-256, SHA-256, DH 14, PSK). Перенеси OSPF с Tunnel0 на Tunnel1, а Tunnel0 выключи. Проверь шифрование по счётчикам. Захватом убедись, что видны только ESP-пакеты.',
        check: 'HQ#show crypto ikev2 sa\nHQ#show crypto ipsec sa | include peer|encaps|decaps\nHQ#show crypto session',
        sol: 'HQ(config)#crypto ikev2 proposal P1\nHQ(config-ikev2-proposal)#encryption aes-cbc-256\nHQ(config-ikev2-proposal)#integrity sha256\nHQ(config-ikev2-proposal)#group 14\nHQ(config)#crypto ikev2 policy POL\nHQ(config-ikev2-policy)#proposal P1\nHQ(config)#crypto ikev2 keyring KR\nHQ(config-ikev2-keyring)#peer NSK\nHQ(config-ikev2-keyring-peer)#address 198.51.101.2\nHQ(config-ikev2-keyring-peer)#pre-shared-key Lab7Key!\nHQ(config)#crypto ikev2 profile PROF\nHQ(config-ikev2-profile)#match identity remote address 198.51.101.2 255.255.255.255\nHQ(config-ikev2-profile)#authentication remote pre-share\nHQ(config-ikev2-profile)#authentication local pre-share\nHQ(config-ikev2-profile)#keyring local KR\nHQ(config)#crypto ipsec transform-set TS esp-aes 256 esp-sha256-hmac\nHQ(config)#crypto ipsec profile VTI\nHQ(ipsec-profile)#set transform-set TS\nHQ(ipsec-profile)#set ikev2-profile PROF\nHQ(config)#interface Tunnel1\nHQ(config-if)#ip address 172.16.253.1 255.255.255.252\nHQ(config-if)#tunnel source Gi0/1\nHQ(config-if)#tunnel destination 198.51.101.2\nHQ(config-if)#tunnel mode ipsec ipv4\nHQ(config-if)#tunnel protection ipsec profile VTI\nHQ(config-if)#ip ospf 1 area 0\n! NSK зеркально (peer HQ 198.51.100.2)' },
      { t: 'DMVPN фаза 3 с OSPF', d: 'Удали туннели 0 и 1. Собери DMVPN на Tunnel10 (172.16.250.0/24): HQ — хаб, NSK и TMS — споки, NHRP network-id 10, IPsec profile (transport mode, PSK на «любой адрес» 0.0.0.0). Маршрутизация — OSPF (network broadcast, priority хаба 255, споков 0) или EIGRP. Добейся связности LAN всех со всеми.',
        hint: 'Для фазы 3 на хабе <code>ip nhrp redirect</code>, на споках <code>ip nhrp shortcut</code>. Для IKEv2 PSK с любым пиром: в keyring <code>peer ANY</code> → <code>address 0.0.0.0 0.0.0.0</code>, а в профиле <code>match identity remote address 0.0.0.0</code>. Можно использовать и IKEv1: <code>crypto isakmp key KEY address 0.0.0.0</code>.',
        check: 'HQ#show dmvpn\nNSK#show ip nhrp\nHQ#show ip ospf neighbor',
        sol: 'HQ(config)#interface Tunnel10\nHQ(config-if)#ip address 172.16.250.1 255.255.255.0\nHQ(config-if)#ip mtu 1400\nHQ(config-if)#ip tcp adjust-mss 1360\nHQ(config-if)#ip nhrp network-id 10\nHQ(config-if)#ip nhrp map multicast dynamic\nHQ(config-if)#ip nhrp redirect\nHQ(config-if)#ip ospf network broadcast\nHQ(config-if)#ip ospf priority 255\nHQ(config-if)#tunnel source Gi0/1\nHQ(config-if)#tunnel mode gre multipoint\nHQ(config-if)#tunnel protection ipsec profile DMVPN\nNSK(config)#interface Tunnel10\nNSK(config-if)#ip address 172.16.250.2 255.255.255.0\nNSK(config-if)#ip mtu 1400\nNSK(config-if)#ip tcp adjust-mss 1360\nNSK(config-if)#ip nhrp network-id 10\nNSK(config-if)#ip nhrp nhs 172.16.250.1 nbma 198.51.100.2 multicast\nNSK(config-if)#ip nhrp shortcut\nNSK(config-if)#ip ospf network broadcast\nNSK(config-if)#ip ospf priority 0\nNSK(config-if)#tunnel source Gi0/1\nNSK(config-if)#tunnel mode gre multipoint\nNSK(config-if)#tunnel protection ipsec profile DMVPN' },
      { t: 'Spoke-to-spoke своими глазами', d: 'С NSK: <code>traceroute 172.16.40.1 source Lo1</code> дважды подряд. Первый раз путь через хаб (172.16.250.1), второй — напрямую. Посмотри <code>show dmvpn</code> на NSK: появился динамический пир TMS (D). Сколько IPsec-сессий стало на NSK?',
        check: 'NSK#traceroute 172.16.40.1 source Lo1\nNSK#show dmvpn\nNSK#show crypto session' }
    ],
    brk: [
      { t: 'VTI не поднимается: show crypto ikev2 sa пусто', inj: 'NSK(config)#crypto ikev2 keyring KR\nNSK(config-ikev2-keyring)#peer HQ\nNSK(config-ikev2-keyring-peer)#pre-shared-key WrongKey', h: '<code>debug crypto ikev2</code> — на каком сообщении обрыв? Ищи AUTH.', f: 'Не совпадает pre-shared key: фаза 1 падает на этапе аутентификации (AUTH exchange). Исправь ключ.' },
      { t: 'IPsec SA есть, encaps растут на HQ, decaps на HQ = 0', inj: 'INET(config)#ip access-list extended NO-ESP\nINET(config-ext-nacl)#deny esp any any\nINET(config-ext-nacl)#permit ip any any\nINET(config)#interface Gi0/1\nINET(config-if)#ip access-group NO-ESP in', h: 'Счётчики на обеих сторонах. На NSK decaps тоже 0? Что между ними?', f: 'Провайдер (INET) режет ESP со стороны NSK: SA договорились (IKE по UDP 500 прошёл), а данные не доходят. Классика «фаервол пропустил IKE, но не ESP». Решение — разрешить ESP или включить NAT-T и пустить UDP 4500.' },
      { t: 'После «наведения порядка» спок TMS пропал из DMVPN', inj: 'TMS(config)#interface Tunnel10\nTMS(config-if)#no ip nhrp nhs 172.16.250.1\nTMS(config-if)#ip nhrp nhs 172.16.250.1 nbma 198.51.100.9 multicast', h: '<code>show dmvpn</code> и <code>show ip nhrp nhs detail</code> на TMS. На какой публичный адрес TMS пытается регистрироваться?', f: 'У TMS неверный NBMA-адрес хаба (198.51.100.9 вместо .2): регистрационные запросы NHRP уходят в никуда, IPsec к хабу не поднимается, TMS не появляется в <code>show dmvpn</code> на HQ. Исправь адрес NBMA.' },
      { t: 'NSK–TMS идут через хаб, прямой туннель не строится', inj: 'HQ(config)#interface Tunnel10\nHQ(config-if)#no ip nhrp redirect', h: '<code>show dmvpn</code> на споках — есть ли D-записи? <code>debug nhrp packet</code>, ищи redirect.', f: 'Без <code>ip nhrp redirect</code> на хабе споки не получают сигнал о существовании прямого пути. Фаза 3 требует redirect на хабе и shortcut на споках.' }
    ]
  }
});
