COURSE.add({
  id: 'ch10',
  time: '≈ 10–12 часов',
  intro: `<p>MPLS — фундамент провайдерской сети. На нём держатся L3VPN для корпоративных клиентов, L2VPN, EVPN, Traffic Engineering, быстрая защита и BGP-free core. В главе 8.1 ты видел, как транзитный маршрутизатор без BGP роняет трафик. MPLS решает эту проблему: P-маршрутизаторы коммутируют пакеты по <b>меткам</b>, не глядя на IP-адрес назначения. Здесь разбираем, что такое метка, как LDP раздаёт метки, что делает каждый маршрутизатор с пакетом (push/swap/pop) и как это диагностировать.</p>`,
  goals: [
    'Разобрать MPLS-заголовок по битам и объяснить, где он стоит в кадре',
    'Объяснить роли LER/LSR, операции push/swap/pop, FEC, LIB и LFIB',
    'Описать работу LDP: discovery, сессия, распространение меток, режимы',
    'Объяснить PHP и explicit null и когда нужен каждый',
    'Пройти пакет от CE до CE через BGP-free core: какие метки на каждом хопе',
    'Читать show mpls forwarding-table и ldp bindings, находить разрыв LSP («No Label», «Untagged»)',
    'Понимать TTL, traceroute и MTU в MPLS и иметь общее представление о Segment Routing'
  ],
  why: `Если ты работаешь у провайдера с MPLS (а это почти любой оператор уровня города и выше), то каждый день видишь метки в выводах, трассировках, захватах. Без понимания LSP не разобрать ни одну проблему с L3VPN или L2VPN клиента: «VPN не пингуется» почти всегда сводится к разорванному LSP между PE.`,
  refs: [
    { t: 'RFC 3031 — MPLS Architecture; RFC 3032 — MPLS Label Stack Encoding', u: 'https://www.rfc-editor.org/rfc/rfc3032' },
    { t: 'RFC 5036 — LDP Specification', u: 'https://www.rfc-editor.org/rfc/rfc5036' },
    { t: 'RFC 5443 — LDP IGP Synchronization', u: 'https://www.rfc-editor.org/rfc/rfc5443' },
    { t: 'L. De Ghein — MPLS Fundamentals (Cisco Press)', n: 'гл. 1–6: метки, LDP, LFIB, TTL, MTU' },
    { t: 'A. Sánchez-Monge, K. Szarkowicz — MPLS in the SDN Era (O\'Reilly)', n: 'провайдерская практика, Junos + IOS XR' },
    { t: 'linkmeup — СДСМ ч. 10. Базовый MPLS', u: 'https://linkmeup.ru/blog/154.html' }
  ],
  theory: [
    {
      id: 'why', h: 'Зачем MPLS провайдеру',
      html: `
<p>Исторически MPLS появился, чтобы быстрее коммутировать: поиск по точной метке проще, чем longest match. Сегодня ASIC делают longest match на скорости линии, и этот аргумент устарел. MPLS остался по другим причинам:</p>
<ol class="steps"><li><b>BGP-free core</b>: P-маршрутизаторам не нужна таблица интернета, достаточно IGP и меток до loopback'ов PE (проблема из главы 8.1).</li>
<li><b>Сервисы</b>: метки можно складывать в стек. Внешняя — транспорт «до какого PE», внутренняя — сервис «какой VRF / какой псевдопровод». Так работают L3VPN, L2VPN и EVPN: в одной сети тысячи изолированных клиентов.</li>
<li><b>Traffic Engineering</b>: путь LSP можно задать явно, а не по кратчайшему (глава 13).</li>
<li><b>Быстрая защита</b>: FRR, TI-LFA — переключение за 50 мс с заранее подготовленным обходом.</li>
<li><b>Независимость от протокола нагрузки</b>: под меткой может лежать IPv4, IPv6, Ethernet-кадр, что угодно («Multi-Protocol»).</li></ol>`
    },
    {
      id: 'label', h: 'Метка: формат и место в кадре',
      html: `
<div class="pkt"><span class="l2" style="flex:7">Ethernet<small>EtherType 0x8847</small></span><span class="lb" style="flex:9">MPLS label<small>Label 20 бит · TC 3 · S 1 · TTL 8</small></span><span class="l3" style="flex:6">IP</span><span class="l7" style="flex:6">данные</span></div>
<table><tr><th>Поле</th><th>Бит</th><th>Смысл</th></tr>
<tr><td>Label</td><td>20</td><td>значение метки 0–1 048 575 (0–15 зарезервированы)</td></tr>
<tr><td>TC (бывш. EXP)</td><td>3</td><td>класс трафика для QoS (глава 15)</td></tr>
<tr><td>S (bottom of stack)</td><td>1</td><td>1 — это последняя метка в стеке, под ней полезная нагрузка</td></tr>
<tr><td>TTL</td><td>8</td><td>как в IP: защита от петель, основа traceroute</td></tr></table>
<p>Заголовок 4 байта вставляется <b>между L2 и L3</b> («shim header»). Меток может быть несколько — <b>стек</b> (транспортная + сервисная, плюс TE, плюс FRR…). Каждая метка +4 байта, поэтому MTU ядра должен быть с запасом (1500 + 4×N, на практике 9000+).</p>
<h3>Зарезервированные метки</h3>
<table><tr><th>Метка</th><th>Смысл</th></tr>
<tr><td>0</td><td>IPv4 explicit null — «сними меня и смотри IPv4», сохраняет TC до последнего хопа</td></tr>
<tr><td>2</td><td>IPv6 explicit null</td></tr>
<tr><td>3</td><td>implicit null — в пакетах не встречается: это сигнал «сделай мне PHP» (см. ниже)</td></tr>
<tr><td>1, 13, 14</td><td>router alert, GAL (OAM), OAM alert</td></tr></table>`
    },
    {
      id: 'ops', h: 'FEC, LIB, LFIB и операции с метками',
      html: `
<ul><li><b>FEC</b> (Forwarding Equivalence Class) — группа пакетов, с которыми обращаются одинаково. В базовом MPLS FEC = префикс IGP (обычно loopback PE /32).</li>
<li><b>LSP</b> (Label Switched Path) — путь пакета по меткам от входа до выхода. Однонаправленный: обратно — свой LSP.</li>
<li>Роли: <b>Ingress LER (PE)</b> — навешивает метку (push). <b>Transit LSR (P)</b> — меняет метку (swap). <b>Egress LER (PE)</b> — снимает (pop) и обрабатывает пакет дальше.</li></ul>
<h3>Метки локальны!</h3>
<p>Каждый маршрутизатор сам выбирает свои метки для каждого FEC и сообщает их соседям: «чтобы отправить мне пакет для 10.255.0.4/32, ставь метку 17». Метка значима только на линке между двумя соседями. Поэтому на каждом хопе метка <b>меняется</b> (swap): «пришёл с меткой 17 (моя) → уходит с меткой 22 (которую просил следующий)».</p>
<table><tr><th>Таблица</th><th>Что в ней</th></tr>
<tr><td><b>LIB</b> (Label Information Base)</td><td>все метки: свои локальные и полученные от <b>всех</b> соседей для каждого FEC (control plane)</td></tr>
<tr><td><b>LFIB</b> (Label FIB)</td><td>выбранное для пересылки: входящая метка → исходящая метка и интерфейс. Выбирается метка того соседа, который является next-hop по IGP</td></tr>
<tr><td>FIB (CEF)</td><td>IP-префикс → next-hop + метка, которую нужно навесить (для ingress)</td></tr></table>
<pre class="cli">P1#show mpls forwarding-table
Local      Outgoing   Prefix           Bytes Label   Outgoing   Next Hop
Label      Label      or Tunnel Id     Switched      interface
16         [[Pop Label]]  10.255.0.1/32    0             Gi0/1      10.1.12.0
17         [[22]]         10.255.0.4/32    11250         Gi0/2      10.1.23.1
18         Pop Label  10.1.23.0/31     0             Gi0/2      10.1.23.1
P1#show mpls ldp bindings 10.255.0.4 32
  lib entry: 10.255.0.4/32, rev 12
        local binding:  label: 17
        remote binding: lsr: 10.255.0.3:0, label: 22
        remote binding: lsr: 10.255.0.1:0, label: 19</pre>
<p>Читаем: пакет для PE2 (10.255.0.4) приходит на P1 с меткой 17 (её P1 раздал соседям), уходит с меткой 22 через Gi0/2 к P2. Метку 19 от PE1 P1 хранит в LIB (liberal retention), но не использует: PE1 не next-hop к PE2. Если IGP перестроится — она понадобится сразу.</p>`
    },
    {
      id: 'ldp', h: 'LDP: как раздаются метки',
      html: `
<ol class="steps"><li><b>Discovery</b>: LDP Hello по UDP 646 на 224.0.0.2 с каждого интерфейса, где включён <code>mpls ip</code>. В hello — <b>transport address</b> (по умолчанию LDP router-id = обычно loopback).</li>
<li><b>Сессия</b>: TCP 646 между transport-адресами. Маршрутизатор с большим адресом — активная сторона. Значит, <b>до loopback соседа должен быть маршрут</b>, иначе hello видны, а сессии нет.</li>
<li><b>Распространение</b>: каждый LSR назначает локальную метку каждому префиксу из своей IGP-таблицы и рассылает её всем соседям (Label Mapping). Режим Cisco по умолчанию: <b>downstream unsolicited</b> (не дожидаясь запроса), <b>independent control</b> (не дожидаясь метки от downstream), <b>liberal retention</b> (хранить метки от всех соседей).</li>
<li>Для connected-префиксов и своих loopback'ов LSR анонсирует <b>implicit null (3)</b>: «я последний — сделайте мне PHP».</li></ol>
<div class="callout warn"><b>LDP router-id — частая беда</b>Если router-id LDP выбрался как адрес физического интерфейса (или loopback не в IGP), сосед не сможет до него построить TCP: hello есть, сессии нет. Решение: <code>mpls ldp router-id Loopback0 force</code> и loopback в IGP.</div>
<h3>Фильтрация меток</h3>
<p>По умолчанию LDP раздаёт метки для <b>всех</b> IGP-префиксов, включая p2p-линки. Нужны только loopback'и PE (next-hop'ы BGP). Провайдеры ограничивают: <code>mpls ldp label allocate global host-routes</code> (только /32) или prefix-list. Меньше состояний в LIB и LFIB.</p>
<h3>LDP-IGP synchronization и session protection</h3>
<p>Проблема: линк поднялся, IGP сразу начал гнать по нему трафик, а LDP-сессия на нём ещё не поднялась, меток нет. Пакеты уходят без метки к P без BGP → чёрная дыра на секунды. <b>LDP-IGP sync</b>: IGP ставит максимальную метрику на линк, пока LDP на нём не синхронизирован. <b>Session protection</b>: при падении линка LDP-сессия держится через обходной путь (targeted hello), и метки соседа не теряются, поэтому восстановление после возврата линка мгновенное.</p>`
    },
    {
      id: 'php', h: 'PHP и explicit null',
      html: `
<p>Egress PE получает пакет с меткой, которую сам раздал. Сначала он ищет метку в LFIB, узнаёт «это мой FEC — снять», потом делает IP-lookup. Два поиска на одном маршрутизаторе — лишняя работа. <b>Penultimate Hop Popping</b>: предпоследний хоп (P перед PE) снимает транспортную метку сам, потому что PE попросил об этом меткой implicit null (3). PE получает уже IP-пакет (или пакет с внутренней сервисной меткой) и делает один поиск.</p>
<table><tr><th></th><th>Implicit null (по умолчанию)</th><th>Explicit null (0)</th></tr>
<tr><td>Что делает P перед PE</td><td>pop — снимает метку</td><td>swap на метку 0</td></tr>
<tr><td>Что получает PE</td><td>IP (или внутреннюю метку)</td><td>метку 0, снимает её и смотрит IP</td></tr>
<tr><td>Плюс</td><td>одна операция на PE</td><td>TC (QoS-маркировка) сохраняется до PE, можно применять QoS на последнем линке по EXP</td></tr></table>
<pre class="cli">PE2(config)#mpls ldp explicit-null              ! просить у соседей метку 0 вместо 3</pre>
<div class="callout info"><b>«Pop Label» в выводе</b>В <code>show mpls forwarding-table</code> на P строка «Pop Label» для loopback соседнего PE — это PHP. Это нормально. «No Label» (или «Untagged») — <b>ненормально</b>: соседу next-hop LDP-метку не прислал, и пакет уйдёт голым IP. Для транзита интернет-трафика через BGP-free core это чёрная дыра.</div>`
    },
    {
      id: 'walk', h: 'Пакет через BGP-free core от начала до конца',
      html: `
<p>CE1 (за PE1) пингует 192.168.2.1 за CE2 (за PE2). PE1 и PE2 знают префиксы клиентов по iBGP (next-hop-self = loopback PE). P1 и P2 BGP не знают.</p>
<table><tr><th>Хоп</th><th>Что происходит</th><th>Что на проводе</th></tr>
<tr><td>CE1 → PE1</td><td>обычный IP</td><td>[IP 192.168.1.1 → 192.168.2.1]</td></tr>
<tr><td>PE1</td><td>FIB: 192.168.2.0/24 → BGP next-hop 10.255.0.4 (PE2) → рекурсия: к 10.255.0.4 IGP-next-hop P1, LDP-метка от P1 для 10.255.0.4 = 17 → <b>push 17</b></td><td>[17 | IP]</td></tr>
<tr><td>P1</td><td>LFIB: 17 → <b>swap 22</b>, к P2. IP-адрес не смотрит</td><td>[22 | IP]</td></tr>
<tr><td>P2</td><td>LFIB: 22 → PE2 попросил implicit null → <b>pop</b> (PHP)</td><td>[IP]</td></tr>
<tr><td>PE2</td><td>обычный IP-lookup: 192.168.2.0/24 → CE2 (eBGP)</td><td>[IP]</td></tr></table>
<p>P-маршрутизаторы не знали ни 192.168.1.0, ни 192.168.2.0, и всё дошло. Это и есть BGP-free core.</p>
<div class="callout warn"><b>А ответы ICMP от P?</b>При traceroute P1 получает пакет с истёкшим TTL и должен ответить ICMP Time Exceeded источнику 192.168.1.1. Но маршрута к нему у P1 нет! Cisco решает это так: P1 кладёт ICMP-ответ в тот же LSP <b>вперёд</b> (с исходным стеком меток), пакет доезжает до PE2, а PE2 (у которого маршрут есть) разворачивает его обратно. Поэтому в traceroute через MPLS у всех P-хопов почти одинаковая задержка — до конца LSP и обратно.</div>`
    },
    {
      id: 'ttl', h: 'TTL, traceroute, MTU и диагностика LSP',
      html: `
<h3>TTL propagation</h3>
<p>По умолчанию ingress PE копирует IP TTL в метку, и traceroute клиента показывает все P-хопы. Многие провайдеры это скрывают: <code>no mpls ip propagate-ttl forwarded</code> — для клиентского трафика метка получает TTL 255, и всё ядро выглядит одним хопом. Для трафика самого маршрутизатора (твой traceroute с PE) хопы остаются видны.</p>
<pre class="cli">CE1#traceroute 192.168.2.1 numeric
  1 10.0.1.1 2 msec
  2 10.1.12.1 [[MPLS: Label 17 Exp 0]] 6 msec
  3 10.1.23.1 [[MPLS: Label 22 Exp 0]] 5 msec
  4 10.0.2.2 6 msec</pre>
<h3>MTU</h3>
<p>Каждая метка +4 байта. Если MTU линков ядра 1500, клиентский пакет 1500 с двумя метками (L3VPN) не пролезает. Пакеты с DF дропаются (и ICMP frag-needed, как ты уже знаешь, может не дойти). Правило: <b>MTU ядра всегда больше MTU клиентов плюс максимальный стек меток</b>. Обычно ядро 9000+, клиентам 1500–9000. <code>mpls mtu</code> на интерфейсе задаёт MTU для помеченных пакетов.</p>
<h3>Диагностика LSP</h3>
<ul><li><code>show mpls ldp neighbor</code> — сессии (Oper, кол-во адресов).</li>
<li><code>show mpls ldp bindings P</code> — локальная метка и метки соседей для FEC.</li>
<li><code>show mpls forwarding-table P</code> — фактическая пересылка: «No Label» = разрыв.</li>
<li><code>show ip cef P detail</code> — какую метку навесит ingress.</li>
<li><code>ping mpls ipv4 10.255.0.4/32</code>, <code>traceroute mpls ipv4 10.255.0.4/32</code> — LSP ping/trace (RFC 8029): проверка именно LSP, а не IP-пути. Коды ответов: «!» success, «Q» не помечен, «.» таймаут.</li></ul>
<div class="callout pro"><b>Типичные причины разрыва LSP</b>1) Loopback PE анонсирован в IGP не как /32 (например /24), а LDP раздаёт метки для того, что в RIB — у ingress нет метки для /32 next-hop BGP. 2) <code>mpls ip</code> не включён на одном интерфейсе. 3) LDP router-id недостижим. 4) Фильтр меток отрезал нужный префикс. 5) MTU. 6) Разные IGP-пути и LDP-сессии после аварии (лечит LDP-IGP sync).</div>`
    },
    {
      id: 'sr', h: 'Segment Routing: куда движется индустрия',
      html: `
<p><b>SR-MPLS</b> убирает LDP: метки раздаёт сам IGP (IS-IS или OSPF с расширениями).</p>
<ul><li><b>SRGB</b> (Segment Routing Global Block) — диапазон меток, одинаковый на всех (например, 16000–23999).</li>
<li><b>Prefix-SID / Node-SID</b> — индекс loopback'а маршрутизатора (например, 4). Метка = SRGB base + индекс = 16004 <b>на всех маршрутизаторах</b>: метка глобальна, swap 16004 → 16004.</li>
<li><b>Adjacency-SID</b> — локальная метка «выйди через этот линк» для явных путей.</li>
<li>Стек SID задаёт путь: «до узла 7, потом линк 7→9, потом до узла 12» — <b>source routing</b> без состояний в ядре (в отличие от RSVP-TE).</li>
<li><b>TI-LFA</b> — защита для 100% топологий с переключением меньше 50 мс.</li>
<li><b>SRv6</b> — то же, но сегменты — IPv6-адреса в расширенном заголовке.</li></ul>
<p>Новые провайдерские сети строят на SR, но LDP ещё долго будет в эксплуатации. Нужно знать оба. Подробно — в главе 13.</p>`
    }
  ],
  cmds: [
    { g: 'Включение MPLS/LDP' },
    { c: 'mpls ip (на интерфейсе)', d: 'Включить MPLS и LDP на интерфейсе', hw: 'mpls\n mpls ldp (на интерфейсе)', jn: 'set interfaces X unit 0 family mpls; set protocols ldp interface X; set protocols mpls interface X' },
    { c: 'mpls ldp router-id Loopback0 force', d: 'LDP router-id = loopback (transport address)', hw: 'mpls lsr-id 10.255.0.1', jn: 'set routing-options router-id' },
    { c: 'mpls ldp autoconfig (в router ospf / isis)', d: 'Включить LDP на всех интерфейсах IGP', hw: '—', jn: 'set protocols ldp interface all' },
    { c: 'mpls ldp label\n allocate global host-routes', d: 'Метки только для /32', hw: 'lsp-trigger host', jn: 'по умолчанию только loopback (egress-policy)' },
    { c: 'mpls ldp sync (в IGP)', d: 'LDP-IGP synchronization', hw: 'ldp-sync enable', jn: 'ldp-synchronization' },
    { c: 'mpls ldp session protection', d: 'Защита LDP-сессии через targeted hello', hw: 'session protection', jn: 'session-protection' },
    { c: 'mpls ldp explicit-null', d: 'Просить explicit null (0) вместо implicit (3)', hw: 'label advertise explicit-null', jn: 'explicit-null' },
    { c: 'no mpls ip propagate-ttl forwarded', d: 'Скрыть ядро в traceroute клиентов', hw: 'undo ttl propagate public', jn: 'no-propagate-ttl' },
    { c: 'mpls mtu 1508', d: 'MTU для помеченных пакетов на интерфейсе', hw: 'mpls mtu 1508', jn: 'family mpls mtu' },
    { g: 'Диагностика' },
    { c: 'show mpls interfaces', d: 'Где включён MPLS/LDP', hw: 'display mpls interface', jn: 'show mpls interface' },
    { c: 'show mpls ldp discovery [detail]', d: 'Hello: кто виден, transport address', hw: 'display mpls ldp peer', jn: 'show ldp neighbor' },
    { c: 'show mpls ldp neighbor', d: 'LDP-сессии (TCP 646)', hw: 'display mpls ldp session', jn: 'show ldp session' },
    { c: 'show mpls ldp bindings [P len]', d: 'LIB: локальная и удалённые метки', hw: 'display mpls ldp lsp', jn: 'show ldp database' },
    { c: 'show mpls forwarding-table [P]', d: 'LFIB: вход → выход, Pop/No Label', hw: 'display mpls lsp', jn: 'show route table mpls.0' },
    { c: 'show ip cef P detail', d: 'Какая метка навешивается на ingress', hw: 'display fib P', jn: 'show route forwarding-table destination P' },
    { c: 'ping mpls ipv4 P/32 / traceroute mpls ipv4 P/32', d: 'LSP ping / trace (проверка именно LSP)', hw: 'ping lsp ip P 32 / tracert lsp ip P 32', jn: 'ping mpls ldp P / traceroute mpls ldp P' },
    { c: 'debug mpls ldp bindings', d: 'Отладка раздачи меток (лаба)', hw: 'debugging mpls ldp', jn: 'traceoptions' }
  ],
  cards: [
    ['Поля MPLS-заголовка и размер?', '4 байта: Label 20 бит, TC (EXP) 3 бита, S (bottom of stack) 1 бит, TTL 8 бит.'],
    ['Где стоит MPLS-заголовок и какой EtherType?', 'Между L2 и L3 (shim). EtherType 0x8847 (unicast).'],
    ['Что такое FEC?', 'Forwarding Equivalence Class — группа пакетов, пересылаемых одинаково. В базовом MPLS — IGP-префикс (loopback PE /32).'],
    ['Роли и операции LER/LSR?', 'Ingress LER (PE) — push. Transit LSR (P) — swap. Egress LER (PE) — pop. PHP: предпоследний хоп делает pop.'],
    ['Почему метка меняется на каждом хопе?', 'Метки локальны: каждый LSR сам выбирает метку для FEC и сообщает её соседям. Метка значима только на линке.'],
    ['LIB vs LFIB?', 'LIB — все метки (свои и от всех соседей). LFIB — выбранные для пересылки: метка next-hop-соседа по IGP.'],
    ['Как работает LDP discovery и сессия?', 'Hello UDP 646 на 224.0.0.2 с transport address. Сессия TCP 646 между transport-адресами (loopback), нужен маршрут до loopback соседа.'],
    ['Режимы LDP Cisco по умолчанию?', 'Downstream unsolicited, independent control, liberal retention.'],
    ['Что такое implicit null (3)?', 'Сигнал «сделай мне PHP»: предпоследний хоп снимает метку. В пакетах метка 3 не встречается.'],
    ['Зачем PHP?', 'Чтобы egress PE не делал два поиска (метка + IP). Предпоследний хоп снимает транспортную метку.'],
    ['Explicit null (0) — зачем?', 'Сохранить TC/EXP до egress PE (QoS на последнем линке). P делает swap на 0, PE снимает.'],
    ['«Pop Label» vs «No Label» в LFIB?', 'Pop Label — PHP, норма для соседнего PE. No Label/Untagged — нет метки от next-hop, LSP разорван, пакет уйдёт голым IP.'],
    ['Как P-маршрутизатор отвечает ICMP клиенту, если не знает маршрута к нему?', 'Кладёт ICMP Time Exceeded в тот же LSP вперёд до egress PE, а тот разворачивает его обратно к источнику.'],
    ['Как скрыть ядро MPLS в traceroute клиентов?', '<code>no mpls ip propagate-ttl forwarded</code>: метка получает TTL 255, всё ядро выглядит одним хопом.'],
    ['Правило MTU в MPLS-ядре?', 'MTU ядра ≥ MTU клиента + 4 байта × максимальный стек меток. Обычно ядро 9000+.'],
    ['Зачем LDP-IGP sync?', 'Чтобы IGP не пускал трафик по линку, пока на нём не поднялась LDP-сессия и нет меток (иначе голый IP в ядре без BGP).'],
    ['Зачем фильтровать LDP-метки до /32?', 'Нужны только loopback\'и PE (BGP next-hop). Меньше состояний в LIB/LFIB.'],
    ['Частая причина разрыва LSP с loopback PE?', 'Loopback анонсируется в IGP не /32, LDP router-id недостижим, mpls ip выключен на интерфейсе, фильтр меток, MTU.'],
    ['Что такое LSP ping?', 'ping mpls ipv4 P/32 — проверка LSP (RFC 8029): пакет идёт по меткам, egress проверяет, что он действительно конец LSP для FEC.'],
    ['SR-MPLS: что такое SRGB и Node-SID?', 'SRGB — общий диапазон меток (например 16000+). Node-SID — индекс loopback\'а. Метка = base + индекс, одинаковая на всех маршрутизаторах.'],
    ['Главное отличие SR от LDP и RSVP-TE?', 'Метки раздаёт IGP (без LDP). Путь задаётся стеком сегментов на входе (source routing) — без состояний на транзитных узлах.']
  ],
  quiz: [
    { q: 'Сколько байт занимает стек из двух меток и что будет с пакетом 1500 байт при MTU ядра 1500?', o: ['4 байта, пройдёт', '8 байт, пакет с DF будет отброшен (или фрагментирован без DF)', '8 байт, пройдёт', '16 байт, пройдёт'], a: 1, e: '2 × 4 = 8 байт. 1508 > 1500. MTU ядра должен быть с запасом.' },
    { q: 'P1 получил пакет с меткой 17. По LFIB: Local 17 → Outgoing 22, Gi0/2. Что он сделает?', o: ['Снимет метку и посмотрит IP', 'Заменит 17 на 22 и отправит в Gi0/2', 'Добавит метку 22 поверх 17', 'Отбросит'], a: 1, e: 'Swap. IP-заголовок P не смотрит.' },
    { q: 'В show mpls forwarding-table на PE1 для 10.255.0.4/32 (loopback PE2) Outgoing «No Label». Что это значит для интернет-трафика клиентов через BGP-free core?', o: ['Нормально, PHP', 'LSP разорван: пакеты уйдут голым IP, и P без BGP их отбросят', 'Нужен explicit null', 'Трафик пойдёт через RR'], a: 1, e: 'No Label = next-hop не прислал метку. Голый IP в ядре без BGP — чёрная дыра.' },
    { q: 'LDP hello видны (show mpls ldp discovery), а сессии с соседом нет. Наиболее вероятная причина?', o: ['MTU', 'Нет маршрута до transport address (LDP router-id) соседа или до своего', 'Не та метка', 'Нет BGP'], a: 1, e: 'Сессия строится по TCP 646 между transport-адресами. Обычно router-id выбрался не loopback или loopback не в IGP.' },
    { q: 'Зачем egress PE анонсирует implicit null для своего loopback?', o: ['Чтобы метки не заканчивались', 'Чтобы предпоследний хоп снял метку (PHP) и PE делал один поиск', 'Для QoS', 'Чтобы скрыть TTL'], a: 1, e: 'Implicit null = «сними сам».' },
    { q: 'Провайдер хочет применять QoS на последнем линке P→PE по EXP-битам. Что включить?', o: ['PHP', 'Explicit null на PE', 'propagate-ttl', 'label allocate host-routes'], a: 1, e: 'При implicit null метка (и её TC) снимается на P. С explicit null метка 0 с TC доезжает до PE.' },
    { q: 'В traceroute клиента через MPLS все P-хопы показывают почти одинаковую задержку, равную задержке до конца. Почему?', o: ['Ошибка измерения', 'ICMP-ответы P уходят вперёд по LSP до egress PE и только оттуда обратно', 'QoS', 'ECMP'], a: 1, e: 'P не знают маршрута к клиенту и отправляют ICMP по тому же LSP вперёд.' },
    { q: 'Что делает «mpls ldp sync» в IGP?', o: ['Синхронизирует часы', 'Ставит максимальную метрику на линк, пока LDP на нём не готов', 'Включает LDP везде', 'Ускоряет SPF'], a: 1, e: 'Защита от чёрной дыры в момент поднятия линка.' },
    { q: 'Почему P1 хранит в LIB метку от PE1 для префикса PE2, хотя PE1 не next-hop?', o: ['Ошибка', 'Liberal retention: при перестроении IGP метка понадобится сразу', 'Для PHP', 'Для TE'], a: 1, e: 'Liberal retention ускоряет сходимость: не нужно запрашивать метку заново.' },
    { q: 'Чем Segment Routing принципиально отличается от LDP? (несколько)', o: ['Метки распространяет IGP, LDP не нужен', 'Node-SID — глобальная метка, одинаковая на всех узлах (в пределах SRGB)', 'Путь можно задать стеком сегментов на входе без состояний в ядре', 'SR не использует MPLS-заголовок'], a: [0, 1, 2], e: 'SR-MPLS использует обычный MPLS-заголовок. Отличается способ распределения меток и их семантика.' },
    { q: 'Loopback PE2 настроен как 10.255.0.4/24 (по ошибке). Что может сломаться?', o: ['Ничего', 'В RIB и LDP будет /24 (или /32 — зависит от IGP), и BGP next-hop 10.255.0.4 может разрешиться не через ожидаемый FEC/метку; LSP до PE2 ломается', 'Сломается только OSPF', 'Сломается только BGP'], a: 1, e: 'Классика: loopback\'и PE всегда /32, иначе FEC в LDP и next-hop BGP не совпадают.' },
    { q: 'Какая команда проверяет именно LSP до PE2, а не IP-связность?', o: ['ping 10.255.0.4', 'ping mpls ipv4 10.255.0.4/32', 'traceroute 10.255.0.4', 'show ip route 10.255.0.4'], a: 1, e: 'LSP ping (RFC 8029) идёт по меткам и валидируется на egress.' }
  ],
  und: [
    { q: 'Объясни, как пакет клиента проходит через BGP-free core: что делает PE1, P1, P2, PE2 и почему P не нужен BGP.', a: '<p>PE1 по iBGP знает, что сеть клиента 192.168.2.0/24 за PE2 (next-hop = loopback PE2). Он рекурсивно находит путь к loopback PE2 по IGP (next-hop P1) и метку, которую P1 выдал для этого loopback (LDP). PE1 навешивает метку (push). P1 смотрит только на метку: по LFIB меняет её на метку следующего хопа (swap) и отправляет. P2 — предпоследний хоп, PE2 попросил implicit null, поэтому P2 снимает метку (PHP). PE2 получает IP-пакет и маршрутизирует к CE2. P-маршрутизаторы не смотрели IP-адрес назначения, им нужно было знать только метки до loopback PE (IGP + LDP). Поэтому BGP в ядре не нужен.</p>', k: ['BGP next-hop = loopback PE2', 'push метки к loopback', 'swap на P по LFIB', 'PHP', 'IP-lookup на PE2', 'P не смотрит IP'] },
    { q: 'Как LDP распространяет метки и почему метка на каждом хопе своя? Что значат LIB и LFIB?', a: '<p>Каждый LSR для каждого префикса IGP (или только /32) назначает свою локальную метку и рассылает её всем LDP-соседям: «для FEC X шли мне с меткой N». Метка — договорённость только между двумя соседями, поэтому значения на разных линках разные, и на каждом хопе swap. В LIB хранятся все метки: свои и полученные от всех соседей. В LFIB попадает только метка того соседа, который является next-hop по IGP к этому FEC: «вход: моя метка → выход: метка next-hop, интерфейс». Для своих connected и loopback LSR раздаёт implicit null, чтобы соседи делали PHP.</p>', k: ['локальные метки на FEC', 'рассылка всем соседям', 'LIB — все, LFIB — next-hop по IGP', 'implicit null для своих'] },
    { q: 'У клиента L3VPN «не пингуется второй офис». Ты подозреваешь транспорт MPLS. Опиши шаги проверки LSP между PE.', a: '<p>1) IGP: есть ли на PE1 маршрут к loopback PE2 (/32!), и наоборот. 2) LDP: сессии на всех линках пути (<code>show mpls ldp neighbor</code>), <code>mpls ip</code> на интерфейсах. 3) Метки: <code>show mpls forwarding-table 10.255.0.4 32</code> на PE1 и каждом P по пути — нигде нет «No Label». 4) <code>ping mpls ipv4 10.255.0.4/32</code> и <code>traceroute mpls ipv4</code> с PE1 — где рвётся. 5) MTU: пинг большим размером с DF. 6) В обратную сторону то же самое: LSP однонаправленный. Если транспорт в порядке — идти выше, в VPN-уровень (VPNv4-маршруты, RT, метки VPN — глава 11).</p>', k: ['IGP /32 до loopback', 'LDP-сессии и mpls ip', 'LFIB без No Label', 'LSP ping/trace', 'MTU', 'обе стороны'] }
  ],
  lab: {
    title: 'Лаба 10. BGP-free core на MPLS',
    time: '≈ 3 часа',
    goal: `<p>Сеть провайдера: два PE, три P, IS-IS уже настроен. Клиенты CE1 и CE2 (каждый в своей AS) подключены по eBGP. Сначала повторить «чёрную дыру» из главы 8.1, потом включить LDP и получить BGP-free core. Разобрать метки на каждом хопе, PHP, explicit null, TTL, MTU и LSP ping. Сломать LSP типовыми способами.</p>`,
    topo: {
      w: 900, h: 420,
      zones: [{ x: 150, y: 30, w: 600, h: 370, label: 'AS64500 · IS-IS L2 · MPLS/LDP', c: '#7c3aed' }],
      nodes: [
        { id: 'CE1', t: 'ce', x: 60, y: 200, label: 'CE1 AS65001\n192.168.1.1/24', role: 'клиент 1' },
        { id: 'PE1', t: 'pe', x: 240, y: 200, label: 'PE1\nLo0 10.255.0.1', role: 'PE' },
        { id: 'P1', t: 'p', x: 410, y: 100, label: 'P1\nLo0 10.255.0.2', role: 'P' },
        { id: 'P2', t: 'p', x: 590, y: 100, label: 'P2\nLo0 10.255.0.3', role: 'P' },
        { id: 'P3', t: 'p', x: 500, y: 320, label: 'P3\nLo0 10.255.0.5', role: 'P (обходной путь)' },
        { id: 'PE2', t: 'pe', x: 680, y: 200, label: 'PE2\nLo0 10.255.0.4', role: 'PE' },
        { id: 'CE2', t: 'ce', x: 850, y: 200, label: 'CE2 AS65002\n192.168.2.1/24', role: 'клиент 2' }
      ],
      links: [['CE1', 'Gi0/0', 'PE1', 'Gi0/0', '10.0.1.0/30'], ['PE1', 'Gi0/1', 'P1', 'Gi0/1'], ['P1', 'Gi0/2', 'P2', 'Gi0/2'], ['P2', 'Gi0/1', 'PE2', 'Gi0/1'], ['PE1', 'Gi0/2', 'P3', 'Gi0/2'], ['P3', 'Gi0/1', 'PE2', 'Gi0/2'], ['PE2', 'Gi0/0', 'CE2', 'Gi0/0', '10.0.2.0/30']]
    },
    addr: [['Линки ядра', '10.1.xy.0/31', 'x,y — номера по Lo0 (PE1=1, P1=2, P2=3, PE2=4, P3=5)'], ['IS-IS метрики', '', 'путь PE1–P1–P2–PE2: 10 на линк; через P3: 50 на линк'], ['CE1–PE1', '10.0.1.0/30', 'PE1 .1, CE1 .2'], ['CE2–PE2', '10.0.2.0/30', 'PE2 .1, CE2 .2']],
    init: (function () {
      const b = (h, n) => `hostname ${h}\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.${n} 255.255.255.255\n ip router isis CORE\nrouter isis CORE\n net 49.0001.0000.0000.000${n}.00\n is-type level-2-only\n metric-style wide\n passive-interface Loopback0\nline con 0\n logging synchronous\n exec-timeout 0 0\n`;
      const i = (ifc, ip, m) => `interface ${ifc}\n ip address ${ip} 255.255.255.254\n ip router isis CORE\n isis network point-to-point\n isis metric ${m}\n no shutdown\n`;
      return {
        PE1: b('PE1', 1) + 'interface Gi0/0\n ip address 10.0.1.1 255.255.255.252\n no shutdown\n' + i('Gi0/1', '10.1.12.0', 10) + i('Gi0/2', '10.1.15.0', 50),
        P1: b('P1', 2) + i('Gi0/1', '10.1.12.1', 10) + i('Gi0/2', '10.1.23.0', 10),
        P2: b('P2', 3) + i('Gi0/2', '10.1.23.1', 10) + i('Gi0/1', '10.1.34.0', 10),
        PE2: b('PE2', 4) + 'interface Gi0/0\n ip address 10.0.2.1 255.255.255.252\n no shutdown\n' + i('Gi0/1', '10.1.34.1', 10) + i('Gi0/2', '10.1.45.1', 50),
        P3: b('P3', 5) + i('Gi0/2', '10.1.15.1', 50) + i('Gi0/1', '10.1.45.0', 50),
        CE1: 'hostname CE1\nno ip domain-lookup\ninterface Loopback1\n ip address 192.168.1.1 255.255.255.0\ninterface Gi0/0\n ip address 10.0.1.2 255.255.255.252\n no shutdown\nrouter bgp 65001\n network 192.168.1.0\n neighbor 10.0.1.1 remote-as 64500\nline con 0\n logging synchronous\n exec-timeout 0 0',
        CE2: 'hostname CE2\nno ip domain-lookup\ninterface Loopback1\n ip address 192.168.2.1 255.255.255.0\ninterface Gi0/0\n ip address 10.0.2.2 255.255.255.252\n no shutdown\nrouter bgp 65002\n network 192.168.2.0\n neighbor 10.0.2.1 remote-as 64500\nline con 0\n logging synchronous\n exec-timeout 0 0'
      };
    })(),
    pre: 'IS-IS в ядре и BGP на CE уже работают. На PE пока нет BGP. Проверь <code>show isis neighbors</code> и что PE1 видит Lo0 PE2.',
    tasks: [
      { t: 'BGP на PE и чёрная дыра', d: 'На PE1 и PE2: eBGP к своему CE, iBGP PE1 ↔ PE2 по loopback с next-hop-self. Проверь, что CE1 видит 192.168.2.0/24. Пингани с CE1 <code>192.168.2.1 source Lo1</code>. Где теряется пакет? Подтверди на P1: <code>show ip route 192.168.2.1</code>.',
        check: 'PE1#show ip bgp summary\nCE1#show ip bgp\nCE1#ping 192.168.2.1 source Lo1\nCE1#traceroute 192.168.2.1 source Lo1 numeric\nP1#show ip route 192.168.2.1',
        sol: 'PE1(config)#router bgp 64500\nPE1(config-router)#bgp router-id 10.255.0.1\nPE1(config-router)#neighbor 10.0.1.2 remote-as 65001\nPE1(config-router)#neighbor 10.255.0.4 remote-as 64500\nPE1(config-router)#neighbor 10.255.0.4 update-source Loopback0\nPE1(config-router)#neighbor 10.255.0.4 next-hop-self\n! PE2 зеркально' },
      { t: 'Включи LDP — получи BGP-free core', d: 'На всех PE и P: <code>mpls ldp router-id Loopback0 force</code> и <code>mpls ip</code> на внутренних интерфейсах (или <code>mpls ldp autoconfig</code> в IS-IS). Проверь LDP-соседей, затем снова ping и traceroute CE1 → CE2. Что изменилось в traceroute?',
        check: 'P1#show mpls ldp neighbor\nP1#show mpls interfaces\nCE1#ping 192.168.2.1 source Lo1\nCE1#traceroute 192.168.2.1 source Lo1 numeric',
        sol: 'P1(config)#mpls ldp router-id Loopback0 force\nP1(config)#router isis CORE\nP1(config-router)#mpls ldp autoconfig\n! или interface range Gi0/1 - 2 / mpls ip\n! на PE: только на интерфейсах к ядру, НЕ к CE' },
      { t: 'Метки на каждом хопе — руками', d: 'Не запуская захват, по командам заполни таблицу для пакета CE1 → 192.168.2.1: какую метку навешивает PE1 (<code>show ip cef 192.168.2.1 detail</code>), что делает P1 и P2 (<code>show mpls forwarding-table 10.255.0.4 32</code>), что получает PE2. Потом сними захват на линках PE1–P1 и P2–PE2 и сверь.',
        check: 'PE1#show ip cef 192.168.2.1 detail\nP1#show mpls forwarding-table 10.255.0.4 32\nP2#show mpls forwarding-table 10.255.0.4 32\nP1#show mpls ldp bindings 10.255.0.4 32' },
      { t: 'Liberal retention и перестроение', d: 'На PE1 посмотри LIB для 10.255.0.4/32: метки от P1 и от P3. Какую использует LFIB? Выключи линк PE1–P1 и посмотри LFIB снова. Почему переключение на метку P3 мгновенное (метку не пришлось запрашивать)?',
        check: 'PE1#show mpls ldp bindings 10.255.0.4 32\nPE1#show mpls forwarding-table 10.255.0.4 32' },
      { t: 'Фильтр меток и explicit null', d: 'Сделай, чтобы LDP раздавал метки только для /32 (<code>mpls ldp label</code> → <code>allocate global host-routes</code>) на всех. Сравни размер LFIB до и после. Затем на PE2 включи <code>mpls ldp explicit-null</code>: что изменилось в LFIB на P2 для 10.255.0.4/32?',
        check: 'P1#show mpls forwarding-table | count Pop|[0-9]\nP2#show mpls forwarding-table 10.255.0.4 32' },
      { t: 'TTL: скрыть ядро', d: 'На PE1 и PE2: <code>no mpls ip propagate-ttl forwarded</code>. Сравни traceroute с CE1 (клиентский) и с PE1 (<code>traceroute 192.168.2.1 source Lo0</code>). Почему они разные?',
        check: 'CE1#traceroute 192.168.2.1 source Lo1 numeric\nPE1#traceroute 10.255.0.4 source Lo0 numeric' },
      { t: 'MTU в MPLS', d: 'С CE1 найди максимальный проходящий размер пинга с DF до 192.168.2.1. Затем поставь на линке P1–P2 <code>mtu 1500</code> и <code>mpls mtu 1500</code> (если отличаются) и пингани 1500 с DF. Объясни, где и почему пакет пропадает. Как это выглядело бы для клиента (браузер)?',
        check: 'CE1#ping 192.168.2.1 source Lo1 size 1500 df-bit\nCE1#ping 192.168.2.1 source Lo1 size 1496 df-bit\nP1#show interfaces Gi0/2 | include MTU\nP1#show mpls interfaces Gi0/2 detail | include MTU' },
      { t: 'LSP ping и LDP-IGP sync', d: 'С PE1 выполни <code>ping mpls ipv4 10.255.0.4/32</code> и <code>traceroute mpls ipv4 10.255.0.4/32</code>. Затем включи <code>mpls ldp sync</code> в IS-IS на всех. Выключи LDP на P1 Gi0/2 (<code>no mpls ip</code>) и посмотри: какую метрику IS-IS теперь показывает этот линк и куда ушёл трафик?',
        check: 'PE1#ping mpls ipv4 10.255.0.4/32\nPE1#traceroute mpls ipv4 10.255.0.4/32\nP1#show mpls ldp igp sync\nPE1#traceroute 10.255.0.4 source Lo0' }
    ],
    brk: [
      { t: 'CE1 → CE2 снова не работает, LDP-сессии на месте', inj: 'P2(config)#interface Gi0/1\nP2(config-if)#no mpls ip', h: '<code>show mpls forwarding-table 10.255.0.4 32</code> на P1 и P2 — где «No Label»? <code>traceroute mpls ipv4</code> с PE1.', f: 'На линке P2–PE2 выключен LDP: P2 не получает метку от PE2 для его loopback. Получается «No Label», и пакет уходит к PE2 голым IP. Это работает, если PE2 знает адрес назначения (он знает, это PE). Но если бы за PE2 был ещё один P без BGP, была бы чёрная дыра. LSP формально разорван. Включи <code>mpls ip</code> (и LDP-IGP sync, чтобы IGP не вёл трафик по линку без LDP).' },
      { t: 'LDP-сессия P1–P2 не поднимается, hello видны', inj: 'P2(config)#no mpls ldp router-id Loopback0 force\nP2(config)#interface Loopback9\nP2(config-if)#ip address 172.31.9.9 255.255.255.255\nP2(config)#mpls ldp router-id Loopback9 force', h: '<code>show mpls ldp discovery detail</code> на P1: какой transport address у P2? Есть ли к нему маршрут?', f: 'LDP router-id P2 = 172.31.9.9 (Loopback9 не в IS-IS). P1 видит hello, но не может открыть TCP 646 к transport address. Верни router-id на Lo0 или добавь Lo9 в IGP.' },
      { t: 'iBGP PE1–PE2 Established, маршрут на PE1 есть, но трафик CE1 → CE2 теряется сразу за PE1', inj: 'PE1(config)#interface Gi0/1\nPE1(config-if)#no mpls ip\n! и на PE1 сделай путь через P3 дороже: isis metric 500 на Gi0/2', h: '<code>show ip cef 192.168.2.1 detail</code> на PE1 — навешивается ли метка? <code>show mpls forwarding-table 10.255.0.4 32</code> на PE1. Что P1 делает с голым IP-пакетом на 192.168.2.1?', f: 'На линке PE1–P1 нет LDP: PE1 не получает от P1 метку для 10.255.0.4 и отправляет пакет голым IP. P1 (без BGP) не знает 192.168.2.0/24 и отбрасывает его. Классическая чёрная дыра BGP-free core. Включи <code>mpls ip</code>, а от повторения защищает LDP-IGP sync.' }
    ],
    extra: '<p><b>Segment Routing вместо LDP (CSR1000v).</b> Замени PE и P на CSR1000v (или только часть, если не хватает памяти) и включи <code>segment-routing mpls</code>, в IS-IS — <code>segment-routing mpls</code>, на Lo0 — <code>prefix-sid index N</code>. Выключи LDP. Посмотри <code>show isis segment-routing prefix-sid-map active-policy</code> и LFIB: метки 16000+N одинаковы на всех узлах.</p>'
  }
});
