COURSE.add({
  id: 'ch14',
  time: '≈ 6 часов',
  intro: `<p>До сих пор мы смотрели на маршрутизатор снаружи: протоколы, таблицы, команды. Эта глава — <b>внутрь коробки</b>. Что происходит с пакетом от момента, когда свет попал в трансивер, до момента, когда он ушёл в другой порт? Где принимается решение, почему одни пакеты идут «на скорости линии», а другие попадают в медленный CPU, почему «упал BGP при DDoS», что такое TCAM и почему таблица интернета может «не влезть». Эти знания отличают инженера, который понимает железо, от того, кто знает только CLI.</p>`,
  goals: [
    'Описать путь пакета через маршрутизатор: PHY → MAC → обработка → фабрика → очередь → выход',
    'Различать control, data и management plane и понимать, что выполняет ASIC, а что CPU',
    'Объяснить RIB → FIB → adjacency, CEF и почему FIB, а не RIB определяет пересылку',
    'Понимать TCAM, longest prefix match в железе и лимиты FIB',
    'Знать, какие пакеты уходят в CPU (punt) и как это защищают',
    'Использовать show ip cef / adjacency / exact-route для проверки решения железа'
  ],
  why: `«Маршрут в таблице есть, а трафик не идёт», «CPU 100% и BGP флапает», «после full view железо пишет FIB exception», «на линке нет загрузки, но есть дропы» — это вопросы о пути пакета внутри устройства. Без понимания железа такие проблемы решаются звонком вендору и ожиданием.`,
  refs: [
    { t: 'linkmeup — СДСМ ч. 14. Путь пакета', u: 'https://linkmeup.ru/blog/312.html', n: 'подробнейшая русская статья про устройство маршрутизатора' },
    { t: 'Cisco: How to Choose the Best Router Switching Path / CEF Overview', u: 'https://www.cisco.com/c/en/us/support/docs/ip/express-forwarding-cef/13706-20.html' },
    { t: 'G. Varghese — Network Algorithmics', n: 'алгоритмы поиска в маршрутизаторах: trie, TCAM, хеши' },
    { t: 'Juniper: Trio Chipset / Cisco Silicon One / Broadcom Jericho — white papers', n: 'архитектуры современных чипов' }
  ],
  theory: [
    {
      id: 'planes', h: 'Три плоскости и два мира: CPU и ASIC',
      html: `
<table><tr><th>Плоскость</th><th>Что</th><th>Где выполняется</th></tr>
<tr><td><b>Data plane</b> (forwarding)</td><td>пересылка транзитных пакетов абонентов</td><td>ASIC / NPU на линейных картах: десятки и сотни миллионов пакетов в секунду на порт</td></tr>
<tr><td><b>Control plane</b></td><td>протоколы: OSPF, IS-IS, BGP, LDP, RSVP, BFD, ARP. Построение таблиц</td><td>CPU (route processor / routing engine). Тысячи–сотни тысяч пакетов в секунду</td></tr>
<tr><td><b>Management plane</b></td><td>SSH, SNMP, NETCONF, telemetry, syslog</td><td>CPU</td></tr></table>
<p>Ключевая мысль: CPU строит таблицы и загружает их в железо (<b>программирует FIB</b>), а пересылкой занимается железо. Мощность CPU и ASIC отличается на порядки. Поэтому всё, что попадает в CPU, — узкое место и требует защиты (CoPP, глава 5).</p>
<h3>Архитектуры</h3>
<ul><li><b>Централизованная</b> (маленькие маршрутизаторы, vIOS, CPE): пересылку делает один процессор или ASIC.</li>
<li><b>Распределённая</b> (шасси): каждая линейная карта со своим NPU и копией FIB, карты связаны <b>коммутационной фабрикой</b>. Route processor отдельно, часто дублирован (NSR, ISSU).</li>
<li><b>Single-chip / fixed</b>: один мощный чип на 32–36 портов по 100–400G (Broadcom Tomahawk/Jericho, Cisco Silicon One). Основа ЦОД и всё чаще провайдерских PE/P.</li></ul>`
    },
    {
      id: 'walk', h: 'Путь пакета через шасси',
      html: `
<ol class="steps">
<li><b>PHY / оптика</b>: свет → электрические сигналы → биты. Здесь возникают CRC и ошибки (FEC на 100G+ исправляет часть).</li>
<li><b>MAC</b>: границы кадра, проверка FCS (битый кадр отбрасывается: счётчик CRC), Dst MAC — нам ли кадр.</li>
<li><b>Ingress-обработка в NPU</b>: разбор заголовков (parser), классификация (ACL, QoS, полисинг), поиск: L2 — MAC-таблица, L3 — <b>FIB (longest prefix match)</b>, MPLS — LFIB (exact match по метке). Результат — выходной интерфейс, новая инкапсуляция (adjacency), класс QoS.</li>
<li><b>Буфер и очередь на входе (VOQ)</b>: пакет ждёт в виртуальной выходной очереди, пока фабрика не даст «разрешение» отправить к выходной карте. Это предотвращает head-of-line blocking.</li>
<li><b>Фабрика</b>: пакет нарезается на ячейки (cells) и переносится к выходной карте.</li>
<li><b>Egress-обработка</b>: перезапись L2 (MAC из adjacency), выходные ACL и QoS, <b>очереди и шедулер</b> (LLQ, WRR, shaping). Здесь при перегрузке возникают output drops.</li>
<li><b>MAC/PHY на выходе</b>: FCS, сериализация, свет.</li></ol>
<div class="callout info"><b>Store-and-forward и cut-through</b>Маршрутизатор принимает пакет целиком (чтобы проверить FCS), потом отправляет. Некоторые коммутаторы ЦОД начинают отправку, прочитав только заголовок (cut-through): меньше задержка, но битые кадры уходят дальше.</div>`
    },
    {
      id: 'fib', h: 'RIB, FIB, adjacency и CEF',
      html: `
<ul><li><b>RIB</b> (show ip route) — таблица control plane: все лучшие маршруты от всех протоколов, с рекурсивными next-hop (BGP через IGP).</li>
<li><b>FIB</b> (show ip cef) — то, что реально загружено в железо: уже разрешённая рекурсия, конкретный выходной интерфейс и <b>указатель на adjacency</b>. Структура, оптимизированная для быстрого поиска.</li>
<li><b>Adjacency</b> (show adjacency) — готовый L2-заголовок для next-hop: MAC назначения из ARP, MAC источника, тег, метки. Пакету остаётся «приклеить» заголовок.</li></ul>
<pre class="cli">R1#show ip cef 192.168.2.1 detail
192.168.2.0/24, epoch 2, flags [rib defined all labels]
  recursive via 10.255.0.4 label 30
    nexthop 10.1.12.1 GigabitEthernet0/1 label 17-(local:22)
R1#show adjacency Gi0/1 detail
Protocol Interface                 Address
IP       GigabitEthernet0/1        10.1.12.1(17)
                                   Encap length 14
                                   [[50000002000150000001000108000]]   ! готовый Ethernet-заголовок
R1#show ip cef exact-route 10.0.0.5 192.168.2.1        ! какой из ECMP-путей выберет хеш</pre>
<h3>Специальные adjacency</h3>
<table><tr><th>Тип</th><th>Что делает с пакетом</th></tr>
<tr><td><b>glean</b></td><td>сеть connected, но ARP для этого хоста ещё нет → пакет в CPU, запуск ARP (первый ping «.» — это оно)</td></tr>
<tr><td>incomplete</td><td>ARP отправлен, ответа нет → drop</td></tr>
<tr><td><b>punt / receive</b></td><td>адрес самого маршрутизатора или нужен CPU → в control plane</td></tr>
<tr><td><b>drop / null</b></td><td>маршрут в Null0 → отбросить в железе (дёшево)</td></tr>
<tr><td>discard</td><td>отбросить (например, при ошибке)</td></tr></table>
<div class="callout warn"><b>Расхождение RIB и FIB</b>Маршрут есть в <code>show ip route</code>, но в железо не загружен: FIB переполнен (TCAM exception), ошибка программирования, баг. Трафик идёт не туда или в CPU. На реальном железе проверка: <code>show ip cef inconsistency</code>, <code>show platform hardware … fib</code>, сообщения %FIB-… в логах.</div>`
    },
    {
      id: 'tcam', h: 'TCAM и поиск в железе',
      html: `
<p>Longest prefix match для миллиона префиксов за наносекунды — серьёзная задача. Два основных подхода:</p>
<ul><li><b>TCAM</b> (ternary content-addressable memory): память, которая сравнивает ключ <b>со всеми записями одновременно</b> за один такт. Каждый бит записи — 0, 1 или «неважно» (X), отсюда «ternary». Префикс /24 — 24 значащих бита и 8 «X». Записи упорядочены по длине маски, и первое совпадение — самое длинное. Так же работают ACL в железе. Минусы: дорогая, горячая, ограниченного размера.</li>
<li><b>Алгоритмический поиск</b> в SRAM/DRAM/HBM: деревья (trie), хеши, сжатые структуры. Больше ёмкость (миллионы маршрутов), меньше энергопотребление, но сложнее. Современные провайдерские чипы (Jericho, Silicon One, Trio) комбинируют оба подхода.</li></ul>
<div class="callout pro"><b>«Не влезла таблица»</b>Full view IPv4 — больше 1 млн префиксов, IPv6 — ~200 тыс. и растёт. Старые коммутаторы и роутеры с TCAM на 256–512 тыс. маршрутов переполняются. Классическая история — август 2014 («512K day»): таблица превысила 512 тыс. маршрутов, и у многих сетей по миру начались аварии. Решения: перераспределить TCAM (профили SDM), брать default + partial, железо с алгоритмическим FIB. Знай лимиты FIB своего оборудования.</div>
<h3>ACL и QoS в TCAM</h3>
<p>Каждое правило ACL — одна или несколько записей TCAM (диапазоны портов размножаются в несколько записей!). Большие ACL и object-group могут не влезть в TCAM, и тогда устройство либо отказывается их применять, либо обрабатывает трафик программно (в CPU). Оптимизируй ACL: объединяй, избегай range.</p>`
    },
    {
      id: 'punt', h: 'Что попадает в CPU (punt) и как это защищают',
      html: `
<table><tr><th>Причина</th><th>Пример</th></tr>
<tr><td>Пакет адресован устройству</td><td>OSPF, BGP, LDP, BFD, SSH, SNMP, ping на адрес маршрутизатора</td></tr>
<tr><td>TTL истёк</td><td>генерация ICMP Time Exceeded (traceroute, петли)</td></tr>
<tr><td>Нет ARP (glean)</td><td>первый пакет к хосту в connected-сети, сканирование сети</td></tr>
<tr><td>Нет маршрута / ICMP unreachable</td><td>генерация ICMP</td></tr>
<tr><td>IP options, фрагменты к устройству</td><td>Router Alert, Record Route</td></tr>
<tr><td>Функции, не поддержанные в железе</td><td>некоторые NAT/ALG, логирование ACL (<code>log</code>!), некоторые туннели</td></tr>
<tr><td>Ошибки MTU с DF</td><td>генерация ICMP fragmentation needed</td></tr></table>
<p>Защита: <b>CoPP / LPTS</b> (у Cisco XR) / lo0 filter (Juniper) — лимиты на классы трафика к CPU; <b>rate-limit генерации ICMP</b> (unreachables, TTL exceeded); <b>ARP/glean throttling</b>; iACL на границе; осторожность с <code>log</code> в ACL на загруженных интерфейсах.</p>
<pre class="cli">R1#show ip cef switching statistics          ! счётчики причин punt/drop (IOS)
R1#show interfaces Gi0/1 stats
GigabitEthernet0/1
          Switching path    Pkts In   Chars In   Pkts Out  Chars Out
               Processor       [[1204]]      98123        512      45120
         Route cache       0          0          0          0
   Distributed cache     [[982341]]  71234567     971234   69876543
R1#show policy-map control-plane
R1#show processes cpu sorted | exclude 0.00</pre>
<div class="callout bad"><b>Классика: ACL с log на высоконагруженном интерфейсе</b>Каждый пакет, совпавший со строкой <code>log</code>, обрабатывается CPU для записи в лог. На DDoS это мгновенно поднимает CPU до 100%, и падают протоколы маршрутизации. Логируй выборочно и с rate-limit.</div>`
    }
  ],
  cmds: [
    { g: 'FIB и adjacency' },
    { c: 'show ip cef [P] [detail]', d: 'FIB: что реально использует пересылка (рекурсия разрешена, метки)', hw: 'display fib P verbose', jn: 'show route forwarding-table destination P' },
    { c: 'show ip cef exact-route SRC DST', d: 'Какой из ECMP-путей выберет хеш для пары адресов', hw: 'display fib … (load-balance)', jn: 'show route forwarding-table destination … extensive' },
    { c: 'show adjacency [IFACE] [detail]', d: 'Готовые L2-заголовки next-hop, glean/incomplete', hw: 'display adjacent-table', jn: 'show route forwarding-table … (nh index)' },
    { c: 'show ip cef switching statistics', d: 'Причины punt и drop', hw: 'display cpu-defend statistics', jn: 'show pfe statistics traffic' },
    { c: 'show interfaces X stats', d: 'Сколько пакетов прошло программно (Processor) и в железе', hw: '—', jn: 'show interfaces X extensive' },
    { c: 'show ip cef inconsistency', d: 'Расхождения RIB/FIB', hw: 'display fib statistics', jn: '—' },
    { g: 'CPU и защита' },
    { c: 'show processes cpu sorted [5sec]', d: 'Какие процессы грузят CPU', hw: 'display cpu-usage', jn: 'show system processes extensive' },
    { c: 'show policy-map control-plane', d: 'CoPP: счётчики по классам', hw: 'display cpu-defend statistics all', jn: 'show ddos-protection protocols statistics' },
    { c: 'ip icmp rate-limit unreachable 500', d: 'Ограничить генерацию ICMP unreachable', hw: 'icmp rate-limit', jn: 'set system internet-options icmpv4-rate-limit' },
    { c: 'show platform hardware … / show hardware capacity (железо)', d: 'Ресурсы TCAM, FIB (зависит от платформы)', hw: 'display resource', jn: 'show pfe route summary' },
    { c: 'sdm prefer … (Catalyst)', d: 'Перераспределение TCAM под маршруты/ACL', hw: 'assign resource-mode', jn: '—' }
  ],
  cards: [
    ['Что выполняет ASIC, а что CPU?', 'ASIC/NPU — пересылка транзита (data plane). CPU — протоколы (control plane), управление, исключения (punt).'],
    ['Этапы пути пакета через шасси?', 'PHY → MAC (FCS) → ingress NPU (parser, ACL/QoS, lookup FIB/LFIB) → VOQ → фабрика → egress (перезапись L2, QoS, очереди) → PHY.'],
    ['RIB vs FIB?', 'RIB — лучшие маршруты control plane (с рекурсией). FIB — загруженное в железо: разрешённый next-hop, интерфейс, adjacency, метки.'],
    ['Что такое adjacency?', 'Готовый L2-заголовок для next-hop (MAC из ARP, теги, метки), который пересылка «приклеивает» к пакету.'],
    ['Glean adjacency?', 'Хост в connected-сети без ARP-записи: пакет в CPU, запуск ARP. Отсюда первый потерянный ping.'],
    ['Что такое TCAM?', 'Ternary CAM: сравнивает ключ со всеми записями за такт, биты 0/1/X. Используется для LPM и ACL. Дорогой и ограниченный по размеру.'],
    ['Что случилось в «512K day»?', 'Август 2014: таблица интернета превысила 512 тыс. префиксов, у многих устройств переполнился TCAM, начались массовые аварии.'],
    ['Почему диапазоны портов в ACL опасны для TCAM?', 'Range раскладывается на несколько записей TCAM, большие ACL могут не влезть.'],
    ['Какие пакеты уходят в CPU? (5+)', 'К адресам устройства (протоколы, SSH), TTL expired, glean ARP, ICMP unreachable, IP options, логируемые ACL, функции без поддержки железа, MTU+DF.'],
    ['Почему ACL с log опасен?', 'Каждое совпадение обрабатывается CPU для лога. На большом трафике (DDoS) CPU 100% и падают протоколы.'],
    ['Что такое VOQ?', 'Virtual Output Queue: на входной карте отдельная очередь под каждый выход. Пакет ждёт «разрешения» фабрики. Против head-of-line blocking.'],
    ['Как проверить, какой из ECMP-путей выберет железо?', '<code>show ip cef exact-route SRC DST</code>.']
  ],
  quiz: [
    { q: 'Маршрут есть в show ip route, но трафик идёт не туда. Что проверить следующим?', o: ['show ip bgp', 'show ip cef P detail — что загружено в FIB и какая adjacency', 'show running-config', 'show version'], a: 1, e: 'Пересылку определяет FIB. Расхождение RIB/FIB — частая причина «необъяснимого».' },
    { q: 'Первый ping к новому хосту в connected-сети теряется, остальные проходят. Почему?', o: ['Петля', 'Glean: первый пакет ушёл в CPU и запустил ARP, сам пакет потерян', 'MTU', 'ACL'], a: 1, e: 'Классика: «.!!!!».' },
    { q: 'Во время DDoS на клиента упал OSPF на маршрутизаторе, хотя полоса не забита. Возможные причины? (несколько)', o: ['Атака генерирует много punt (TTL expired, unreachables, glean), CPU перегружен', 'Нет CoPP', 'ACL с log на атакуемом трафике', 'TCAM перегрет'], a: [0, 1, 2], e: 'Всё, что бьёт по CPU, бьёт по control plane.' },
    { q: 'Что делает TCAM лучше алгоритмического поиска?', o: ['Больше ёмкость', 'Поиск по всем записям за один такт с маскируемыми битами', 'Меньше энергопотребление', 'Дешевле'], a: 1, e: 'Скорость и простота LPM/ACL. Остальное как раз минусы TCAM.' },
    { q: 'Старый коммутатор агрегации получил full view и начал пересылать часть трафика программно с CPU 100%. Причина?', o: ['BGP-баг', 'FIB/TCAM переполнен, маршруты не влезли в железо', 'MTU', 'STP'], a: 1, e: 'Решение: default/partial view, профиль TCAM, другое железо.' },
    { q: 'Где в шасси обычно возникают output drops при перегрузке выходного порта?', o: ['В PHY', 'В egress-очередях (или VOQ на входе для этого выхода)', 'В TCAM', 'В CPU'], a: 1, e: 'Очереди и буферы — тема Д3 и QoS.' },
    { q: 'show interfaces stats показывает растущее «Processor» для транзитного трафика. О чём это?', o: ['Всё нормально', 'Транзит обрабатывается программно (punt) — проверить причину: функция без поддержки в железе, log, glean, options', 'Канал перегружен', 'CRC'], a: 1, e: 'Транзит должен идти в железе (distributed cache / CEF).' }
  ],
  und: [
    { q: 'Расскажи путь транзитного пакета через провайдерский маршрутизатор-шасси и назови места, где пакет может быть потерян, с причинами.', a: '<p>PHY: оптика, ошибки на линии (CRC, FEC). MAC: проверка FCS, битые кадры отбрасываются. Ingress NPU: парсинг, входные ACL (deny), полисер QoS (drop по превышению), lookup FIB (нет маршрута → drop/ICMP через CPU; Null0 → drop), uRPF. VOQ: ждёт разрешения фабрики, при перегрузке выхода дропы здесь. Фабрика: при неисправности — потери на ячейках. Egress: перезапись L2 по adjacency (glean → CPU, incomplete → drop), выходные ACL, очереди и шедулер (output drops при перегрузке, WRED). PHY на выходе. Отдельная ветка: punt в CPU (TTL, options, к устройству), где лимиты CoPP могут отбросить.</p>', k: ['PHY/MAC: CRC', 'ingress: ACL, полисер, lookup, uRPF', 'VOQ/фабрика', 'egress: adjacency, очереди', 'punt и CoPP'] }
  ],
  lab: {
    title: 'Лаба 14. Заглянуть внутрь: CEF, adjacency и punt',
    time: '≈ 1,5–2 часа',
    goal: `<p>На простой топологии из трёх маршрутизаторов и двух хостов посмотреть, как RIB превращается в FIB и adjacency, поймать glean, увидеть разницу между программной и аппаратной (CEF) пересылкой и найти, что нагружает CPU.</p>`,
    topo: {
      w: 760, h: 300,
      nodes: [
        { id: 'PC1', t: 'pc', x: 60, y: 150, label: 'PC1 10.1.1.10', role: 'хост' },
        { id: 'R1', t: 'router', x: 230, y: 150, label: 'R1', role: 'маршрутизатор' },
        { id: 'R2', t: 'router', x: 420, y: 80, label: 'R2', role: 'маршрутизатор' },
        { id: 'R3', t: 'router', x: 420, y: 230, label: 'R3', role: 'маршрутизатор' },
        { id: 'PC2', t: 'pc', x: 650, y: 150, label: 'PC2 10.2.2.10', role: 'хост' },
        { id: 'R4', t: 'router', x: 560, y: 150, label: 'R4', role: 'маршрутизатор' }
      ],
      links: [['PC1', 'eth0', 'R1', 'Gi0/0', '10.1.1.0/24'], ['R1', 'Gi0/1', 'R2', 'Gi0/1'], ['R1', 'Gi0/2', 'R3', 'Gi0/2'], ['R2', 'Gi0/2', 'R4', 'Gi0/1'], ['R3', 'Gi0/1', 'R4', 'Gi0/2'], ['R4', 'Gi0/0', 'PC2', 'eth0', '10.2.2.0/24']]
    },
    addr: [['Линки', 'Rx–Ry', '10.0.xy.0/31'], ['LAN', 'R1 / R4', '10.1.1.1/24 / 10.2.2.1/24']],
    init: (function () {
      const b = n => `hostname R${n}\nno ip domain-lookup\nrouter ospf 1\n router-id 10.255.0.${n}\nline con 0\n logging synchronous\n exec-timeout 0 0\n`;
      const i = (ifc, a, c) => { const x = Math.min(a, c), y = Math.max(a, c); return `interface ${ifc}\n ip address 10.0.${x}${y}.${a === x ? 0 : 1} 255.255.255.254\n ip ospf 1 area 0\n ip ospf network point-to-point\n no shutdown\n`; };
      return {
        R1: b(1) + 'interface Gi0/0\n ip address 10.1.1.1 255.255.255.0\n ip ospf 1 area 0\n no shutdown\n' + i('Gi0/1', 1, 2) + i('Gi0/2', 1, 3),
        R2: b(2) + i('Gi0/1', 2, 1) + i('Gi0/2', 2, 4),
        R3: b(3) + i('Gi0/2', 3, 1) + i('Gi0/1', 3, 4),
        R4: b(4) + 'interface Gi0/0\n ip address 10.2.2.1 255.255.255.0\n ip ospf 1 area 0\n no shutdown\n' + i('Gi0/1', 4, 2) + i('Gi0/2', 4, 3),
        PC1: 'set pcname PC1\nip 10.1.1.10/24 10.1.1.1', PC2: 'set pcname PC2\nip 10.2.2.10/24 10.2.2.1'
      };
    })(),
    tasks: [
      { t: 'RIB против FIB', d: 'На R1 сравни <code>show ip route 10.2.2.0</code> и <code>show ip cef 10.2.2.0 detail</code>. Сколько путей (ECMP)? Какие adjacency используются? Покажи готовые L2-заголовки в <code>show adjacency detail</code> и найди в них MAC соседей.',
        check: 'R1#show ip route 10.2.2.0\nR1#show ip cef 10.2.2.0 detail\nR1#show adjacency detail' },
      { t: 'Какой путь выберет хеш', d: 'На R1: <code>show ip cef exact-route 10.1.1.10 10.2.2.10</code> и для нескольких других пар адресов (10.1.1.11, .12 … — придумай). Распределяются ли пары по двум путям? Что будет, если включить <code>ip cef load-sharing algorithm include-ports source destination</code>?',
        check: 'R1#show ip cef exact-route 10.1.1.10 10.2.2.10\nR1#show ip cef exact-route 10.1.1.11 10.2.2.10' },
      { t: 'Поймай glean', d: 'Очисти ARP на R4 (<code>clear ip arp</code>). С PC1 пингани PC2 одним пакетом. Посмотри на R4 <code>show adjacency Gi0/0</code> до и после и счётчики punt. Повтори для несуществующего адреса 10.2.2.99: что в adjacency (incomplete)?',
        check: 'R4#show adjacency Gi0/0 detail\nR4#show ip cef 10.2.2.99\nR4#show ip arp' },
      { t: 'Что грузит CPU', d: 'С PC1 запусти серию traceroute к PC2 и несуществующим адресам 10.9.9.x, и ping с большим TTL на адрес R2. На R2: <code>show ip traffic</code> (сколько ICMP time exceeded и unreachable сгенерировано), <code>show processes cpu sorted</code>. Включи <code>ip icmp rate-limit unreachable 1000</code> и сравни счётчики.',
        check: 'R2#show ip traffic | include ICMP|unreach|time exceeded\nR2#show processes cpu sorted 5sec' },
      { t: 'ACL с log', d: 'На R2 Gi0/1 повесь ACL <code>permit ip any any log</code> (in). Пингани с PC1 PC2 потоком (<code>ping 10.2.2.10 -t</code>). Посмотри <code>show interfaces Gi0/1 stats</code> (Processor) и CPU. Сними log. Сделай вывод для прода.',
        check: 'R2#show interfaces Gi0/1 stats\nR2#show processes cpu sorted 5sec | include IP Input|CPU' }
    ],
    brk: []
  }
});
