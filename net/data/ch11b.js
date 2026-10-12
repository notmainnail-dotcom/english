COURSE.add({
  id: 'ch11b',
  time: '≈ 5–6 часов',
  intro: `<p>Клиенту L3VPN почти всегда нужен ещё и <b>интернет</b>. А сам провайдер всё чаще держит интернет не в глобальной таблице, а в отдельном VRF «Internet». Глава о том, как соединить VRF и интернет: route leaking между VRF и глобальной таблицей, общий выход через NAT/CGNAT, интернет как отдельный VRF, «белые» адреса клиента в VPN. Плюс главная провайдерская мысль: <b>изоляция</b> — что видит клиент и что видит интернет.</p>`,
  goals: [
    'Перечислить способы дать клиенту VPN доступ в интернет и выбрать подходящий',
    'Настроить route leaking: статика в VRF с next-hop в глобальной таблице и обратно',
    'Объяснить «Internet in VRF» и почему крупные провайдеры так строят сеть',
    'Организовать централизованный NAT/CGNAT для VRF и понимать проблему пересекающихся адресов',
    'Понимать риски: утечки маршрутов между VRF, full view в VRF, безопасность'
  ],
  why: `«Дайте нашим филиалам интернет через центральный фаервол» или «выход в интернет из VPN через ваш NAT» — частые заказы корпоративных клиентов. А архитектура «Internet в VRF» встречается у многих операторов: без понимания leaking ты не разберёшься, почему у клиента «пропал интернет, а VPN работает».`,
  refs: [
    { t: 'RFC 4364, раздел 11 — Accessing the Internet from a VPN', u: 'https://www.rfc-editor.org/rfc/rfc4364#section-11' },
    { t: 'Cisco: MPLS VPN — Internet Access (configuration guide)', u: 'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/mp_l3_vpns/configuration/xe-16/mp-l3-vpns-xe-16-book.html' },
    { t: 'linkmeup — СДСМ 11.1. L3VPN и доступ в Интернет', u: 'https://linkmeup.ru/blog/248.html' },
    { t: 'A. Sánchez-Monge, K. Szarkowicz — MPLS in the SDN Era', n: 'гл. о Internet-in-VRF и route leaking' }
  ],
  theory: [
    {
      id: 'ways', h: 'Способы: от самого простого к правильному',
      html: `
<table><tr><th>Способ</th><th>Как</th><th>Плюсы / минусы</th></tr>
<tr><td>1. Отдельный канал</td><td>второй интерфейс (сабинтерфейс) CE в глобальную таблицу (или Internet-VRF) провайдера</td><td>чистая изоляция, клиент сам делает NAT/фаервол. Два стыка на сайт</td></tr>
<tr><td>2. Через центральный сайт клиента</td><td>в VPN анонсируется default от ЦО клиента, весь интернет идёт через его фаервол</td><td>единая политика безопасности клиента, но трафик крюком через центр</td></tr>
<tr><td>3. Route leaking на PE</td><td>в VRF статический default с next-hop в глобальной таблице (<code>global</code>), в глобальной таблице маршрут к публичным адресам клиента в VRF</td><td>просто, нужны белые адреса у клиента или NAT на PE. Риск ошибок изоляции</td></tr>
<tr><td>4. Shared NAT / CGNAT</td><td>VRF клиентов импортируют default из сервисного VRF с NAT-устройством (VRF-aware NAT)</td><td>серые адреса клиентов, один NAT на многих, но пересечение адресов клиентов требует VRF-aware NAT</td></tr>
<tr><td>5. Internet как VRF</td><td>интернет живёт в VRF «INET», клиенты импортируют default или full из него через RT</td><td>единообразие: все сервисы — VRF, глобальная таблица только для инфраструктуры. Так строят многие крупные сети</td></tr></table>`
    },
    {
      id: 'leak', h: 'Route leaking между VRF и глобальной таблицей',
      html: `
<p>VRF изолирован полностью. Чтобы пакет из VRF ушёл в глобальную таблицу (где интернет), нужен маршрут, который «перепрыгивает» границу:</p>
<pre class="cli">! из VRF A — в интернет через глобальную таблицу
ip route vrf A 0.0.0.0 0.0.0.0 198.51.100.1 global          ! next-hop ищется в global
! обратно: из интернета к белой сети клиента 203.0.113.0/28 в VRF A
ip route 203.0.113.0 255.255.255.240 Gi0/1 172.30.1.2        ! интерфейс в VRF A + next-hop
router bgp 64500
 address-family ipv4
  network 203.0.113.0 mask 255.255.255.240                  ! анонс в интернет
 address-family ipv4 vrf A
  network 0.0.0.0                                           ! раздать default всем офисам VPN</pre>
<p>Альтернатива на новых IOS-XE: <b>BGP route leaking</b> через import/export между VRF и глобальной таблицей (<code>import ipv4 unicast map</code> / <code>export ipv4 unicast map</code> в VRF). Это управляемее, чем статика.</p>
<div class="callout warn"><b>Асимметрия и uRPF</b>Трафик из VRF ушёл в интернет с белого адреса клиента. Ответ возвращается на PE в глобальную таблицу, и нужен маршрут к белому адресу клиента, ведущий в VRF. Забыли — ответы теряются. Включён uRPF strict на интерфейсе клиента — проверь, что обратный путь согласован.</div>`
    },
    {
      id: 'nat', h: 'NAT для VPN-клиентов и пересекающиеся адреса',
      html: `
<p>У большинства клиентов серые адреса (10.x), у разных клиентов одинаковые. Чтобы выпустить их в интернет:</p>
<ul><li><b>NAT на CE</b> клиента (у клиента белый адрес на стыке) — проще всего для провайдера.</li>
<li><b>VRF-aware NAT на PE / выделенном NAT-шлюзе</b>: трансляция учитывает VRF, поэтому 10.1.1.5 клиента A и 10.1.1.5 клиента B — разные записи.
<pre class="cli">ip nat inside source list CLIENT-A pool POOL-A vrf A overload
ip nat inside source list CLIENT-B pool POOL-B vrf B overload
interface Gi0/1.10
 vrf forwarding A
 ip nat inside
interface Gi0/0
 ip nat outside                                     ! в глобальной таблице / VRF INET</pre></li>
<li><b>Централизованный CGNAT</b> (глава 5) с VRF-aware логированием: в логе должно быть не только «10.1.1.5:40000 → 198.51.100.7:1025», но и <b>какой VRF</b> (клиент).</li></ul>
<div class="callout info"><b>Почему NAT обычно не на PE</b>NAT — stateful и ресурсоёмкий (таблица трансляций, логи), а PE — устройство масштабной пересылки. Поэтому у провайдеров NAT выносят на выделенные устройства (CGNAT-кластеры, сервисные модули) и подводят к ним трафик из VRF через импорт default из «NAT-VRF».</div>`
    },
    {
      id: 'inetvrf', h: 'Internet в VRF: архитектура провайдера',
      html: `
<p>Многие операторы держат <b>глобальную таблицу только для инфраструктуры</b> (loopback'и, линки, BGP-сессии управления), а интернет — в отдельном VRF «INET». Все сервисы единообразны: интернет — такой же L3VPN, как корпоративные клиенты.</p>
<ul><li><b>Плюсы</b>: изоляция инфраструктуры от интернета (маршруты к loopback'ам не видны извне), простой multi-tenancy (несколько интернет-VRF: «бизнес», «ШПД», «транзит»), одинаковые инструменты RT для всех услуг. Клиент «интернет + VPN» получает оба VRF, а нужные маршруты между ними протекают по RT.</li>
<li><b>Минусы</b>: full view в VRF — память на всех PE, которые этот VRF держат (per-VRF label allocation обязательна). Больше сложности в конфиге и траблшутинге, нужен опыт.</li></ul>
<pre class="cli">vrf definition INET
 rd 10.255.0.1:666
 address-family ipv4
  route-target export 64500:666
  route-target import 64500:666
! клиент «интернет + VPN»: получить из INET только default
vrf definition A
 address-family ipv4
  route-target import 64500:1
  route-target export 64500:1
  import map ONLY-DEFAULT
  route-target import 64500:666
route-map ONLY-DEFAULT permit 10
 match ip address prefix-list DEFAULT
route-map ONLY-DEFAULT permit 20
 match extcommunity RT-CLIENT-A</pre>
<div class="callout bad"><b>Классическая авария</b>Ошибка в RT или import map — и full view из INET (миллион маршрутов) протекает в VRF клиента: у него на CE BGP со max-prefix рвётся, а у PE заканчивается память. Или наоборот, серые маршруты клиента протекают в INET и анонсируются в интернет. Защита: явные import/export map, max-prefix на VRF (<code>maximum routes N warn</code>), фильтры на бордерах.</div>`
    }
  ],
  cmds: [
    { g: 'Leaking' },
    { c: 'ip route vrf A 0.0.0.0 0.0.0.0 X global', d: 'Default из VRF с next-hop в глобальной таблице', hw: 'ip route-static vpn-instance A 0.0.0.0 0 X public', jn: 'routing-instances A routing-options static route 0/0 next-table inet.0' },
    { c: 'ip route NET MASK IFACE-in-VRF NEXTHOP', d: 'Из глобальной таблицы в сеть клиента в VRF', hw: 'ip route-static NET MASK vpn-instance A NH', jn: 'rib-groups / next-table A.inet.0' },
    { c: 'vrf definition A\n address-family ipv4\n  import ipv4 unicast map RM\n  export ipv4 unicast map RM', d: 'BGP-leaking между VRF и глобальной (IOS-XE)', hw: 'import-route / vpn-target', jn: 'rib-groups, instance-import' },
    { c: 'import map RM / export map RM (в VRF)', d: 'Тонкий контроль импорта/экспорта по route-map', hw: 'import route-policy / export route-policy', jn: 'vrf-import / vrf-export policy' },
    { c: 'maximum routes 1000 80 (в VRF)', d: 'Лимит маршрутов в VRF (защита от протечки full view)', hw: 'routing-table limit 1000 80', jn: 'maximum-prefixes 1000 threshold 80' },
    { g: 'NAT в VRF' },
    { c: 'ip nat inside source list ACL pool P vrf A overload', d: 'VRF-aware NAT', hw: 'nat outbound … (в VPN-instance)', jn: 'services nat / SRX routing-instance' },
    { c: 'show ip nat translations vrf A', d: 'Трансляции конкретного VRF', hw: 'display nat session vpn-instance A' },
    { g: 'Проверка' },
    { c: 'show ip route vrf A 0.0.0.0', d: 'Default в VRF и его next-hop (global?)', hw: 'display ip routing-table vpn-instance A 0.0.0.0', jn: 'show route table A.inet.0 0/0' },
    { c: 'show ip cef vrf A 8.8.8.8 detail', d: 'Как пакет из VRF уходит в интернет', hw: 'display fib vpn-instance A 8.8.8.8' }
  ],
  cards: [
    ['Пять способов дать VPN-клиенту интернет?', '1) Отдельный стык в интернет. 2) Через центральный сайт клиента (его default в VPN). 3) Route leaking на PE. 4) Общий VRF-aware NAT/CGNAT. 5) Internet как VRF + импорт по RT.'],
    ['Что делает ключевое слово global в ip route vrf … global?', 'Next-hop ищется в глобальной таблице, а не в VRF: пакет «перепрыгивает» из VRF в глобальную таблицу.'],
    ['Что обязательно для обратного трафика при leaking?', 'Маршрут в глобальной таблице к адресам клиента, ведущий в интерфейс VRF (или leaking обратно). Иначе ответы из интернета теряются.'],
    ['Что такое VRF-aware NAT?', 'NAT, учитывающий VRF: одинаковые серые адреса разных клиентов — разные трансляции.'],
    ['Internet в VRF — суть и плюсы?', 'Интернет живёт в VRF INET, глобальная таблица только для инфраструктуры. Плюсы: изоляция инфраструктуры, единые инструменты RT для всех услуг, multi-tenancy.'],
    ['Главный риск Internet-in-VRF и leaking?', 'Протечка full view в клиентский VRF (память PE, разрыв CE по max-prefix) или протечка серых маршрутов клиента в интернет. Защита: import/export map, maximum routes, фильтры.'],
    ['Зачем maximum routes в VRF?', 'Лимит числа маршрутов в VRF — защита PE от протечки огромных таблиц.'],
    ['Почему NAT для клиентов обычно выносят с PE?', 'NAT stateful и ресурсоёмкий (сессии, логи), а PE заточен под пересылку. CGNAT — отдельные устройства, к ним ведёт default из NAT-VRF.']
  ],
  quiz: [
    { q: 'В VRF A есть «ip route vrf A 0.0.0.0 0.0.0.0 198.51.100.1 global». Клиент пингует 8.8.8.8 со своего белого адреса 203.0.113.5 — запросы уходят, ответов нет. Что забыли?', o: ['send-community', 'Маршрут в глобальной таблице к 203.0.113.0/28 через интерфейс VRF A', 'as-override', 'LDP'], a: 1, e: 'Ответ приходит в глобальную таблицу и должен «перепрыгнуть» обратно в VRF.' },
    { q: 'Почему у клиентов VPN с серыми адресами нельзя просто выпустить трафик в интернет через leaking?', o: ['Leaking не работает с серыми', 'Серые адреса не маршрутизируются в интернете: нужен NAT (у клиента или VRF-aware на стороне провайдера)', 'Нужна MPLS-метка', 'Нужен RD'], a: 1, e: 'Без трансляции ответы не найдут дорогу.' },
    { q: 'Клиенты A и B оба используют 10.1.1.0/24 и выходят в интернет через один NAT-шлюз провайдера. Что обязательно?', o: ['Разные RD', 'VRF-aware NAT (трансляции привязаны к VRF)', 'Static NAT', 'Отдельный BGP'], a: 1, e: 'Иначе одинаковые внутренние адреса смешаются в одной таблице трансляций.' },
    { q: 'Что из этого — преимущества Internet-in-VRF? (несколько)', o: ['Глобальная таблица только для инфраструктуры — она не видна из интернета', 'Все услуги однотипны (RT)', 'Меньше памяти на PE', 'Легко дать клиенту «интернет + VPN» импортом RT'], a: [0, 1, 3], e: 'Память как раз растёт: full view в VRF на PE.' },
    { q: 'После изменения import map у клиента на CE разорвалась BGP-сессия с PE, а у PE выросла память. Вероятная причина?', o: ['MTU', 'В VRF клиента протёк full view из INET; CE сработал по max-prefix', 'RD совпал', 'LDP упал'], a: 1, e: 'Классическая авария leaking. Защита — import map на default, maximum routes.' }
  ],
  und: [
    { q: 'Сравни три способа дать интернет клиенту L3VPN: через его центральный сайт, route leaking на PE и Internet-in-VRF. Когда что выбрать?', a: '<p>Через центральный сайт: в VPN анонсируется default от ЦО клиента, весь интернет идёт через его фаервол. Это хорошо для безопасности клиента (одна точка контроля), но трафик идёт крюком и нагружает канал ЦО. Route leaking на PE: default в VRF с next-hop в global плюс обратный маршрут к белым адресам клиента. Просто для малого числа клиентов с белыми адресами (или с NAT на CE), но статика и ручная изоляция дают риск ошибок. Internet-in-VRF: интернет — сервисный VRF, клиенты получают default или full из него по RT. Масштабируемо, единообразно, инфраструктура изолирована, но требует дисциплины (import map, лимиты) и памяти. Выбор: по требованию безопасности клиента, наличию белых адресов, масштабу провайдера.</p>', k: ['центральный сайт: безопасность vs крюк', 'leaking: просто vs ручная изоляция', 'Internet-VRF: масштаб и единообразие vs сложность и память', 'критерии выбора'] }
  ],
  lab: {
    title: 'Лаба 11.1. Интернет для VPN-клиентов',
    time: '≈ 2–3 часа',
    nounl: 'Это расширение лабы 11: открой её в EVE-NG и добавь узел INET (vIOS) с линком к PE1 Gi0/3.',
    goal: `<p>Продолжение лабы 11. На PE1 появляется аплинк в интернет (INET, глобальная таблица). Дать клиенту A интернет через route leaking с белой сетью, клиенту B — через VRF-aware NAT на PE1, а затем перестроить всё в схему Internet-in-VRF.</p>`,
    topo: {
      w: 860, h: 400,
      nodes: [
        { id: 'INET', t: 'isp', x: 120, y: 80, label: 'INET (аплинк)\n8.8.8.8', role: 'интернет' },
        { id: 'PE1', t: 'pe', x: 330, y: 200, label: 'PE1\nLo0 10.255.0.1', role: 'PE + бордер' },
        { id: 'PE2', t: 'pe', x: 620, y: 200, label: 'PE2\nLo0 10.255.0.3', role: 'PE' },
        { id: 'A1', t: 'ce', x: 160, y: 320, label: 'A1\nбелая 203.0.113.0/28', role: 'клиент A (белые адреса)' },
        { id: 'B2', t: 'ce', x: 790, y: 320, label: 'B2\nсерая 10.1.2.0/24', role: 'клиент B (серые)', color: '#059669' }
      ],
      links: [['INET', 'Gi0/0', 'PE1', 'Gi0/3', '198.51.100.0/30'], ['PE1', '', 'PE2', '', 'ядро (через P1)', { dash: true, virt: true }], ['A1', 'Gi0/0', 'PE1', 'Gi0/1', '172.30.1.0/30'], ['B2', 'Gi0/0', 'PE2', 'Gi0/2', '172.30.2.0/30']]
    },
    addr: [['INET–PE1', '198.51.100.0/30', 'PE1 .2, INET .1'], ['NAT-пул клиента B', '—', '198.51.100.128/29 (провайдер маршрутизирует на PE1)'], ['A1', 'Lo2', '203.0.113.1/28 (белая сеть клиента A)']],
    pre: 'Используй топологию лабы 11 (P1 и остальные CE тоже на месте). Добавь в неё узел INET (vIOS) с Loopback 8.8.8.8/32 и линк к PE1 Gi0/3. На INET пропиши статику к 203.0.113.0/28 и 198.51.100.128/29 через PE1. В этом сценарии .unl не прилагается: это расширение лабы 11.',
    tasks: [
      { t: 'Аплинк в глобальной таблице', d: 'Подними линк PE1–INET в глобальной таблице, default на PE1 → INET. Проверь <code>ping 8.8.8.8</code> с PE1. Убедись, что из VRF A интернета нет: <code>ping vrf A 8.8.8.8</code>.',
        check: 'PE1#ping 8.8.8.8\nPE1#ping vrf A 8.8.8.8' },
      { t: 'Клиент A: leaking с белой сетью', d: 'Добавь на A1 Loopback2 203.0.113.1/28 и анонсируй его в BGP. На PE1: в VRF A default с next-hop в global, в global — маршрут к 203.0.113.0/28 через интерфейс VRF A. Раздай default всем офисам A (<code>network 0.0.0.0</code> в af ipv4 vrf A, или <code>default-information originate</code>). Пингани 8.8.8.8 с A1 и с A2 (source — белый адрес!).',
        check: 'PE1#show ip route vrf A 0.0.0.0\nPE1#show ip route 203.0.113.0\nA1#ping 8.8.8.8 source Lo2\nA2#show ip route 0.0.0.0',
        sol: 'PE1(config)#ip route vrf A 0.0.0.0 0.0.0.0 198.51.100.1 global\nPE1(config)#ip route 203.0.113.0 255.255.255.240 Gi0/1 172.30.1.2\nPE1(config)#router bgp 64500\nPE1(config-router)#address-family ipv4 vrf A\nPE1(config-router-af)#network 0.0.0.0' },
      { t: 'Клиент B: VRF-aware NAT', d: 'У B серые адреса (как у A!). Сделай на PE1 NAT overload клиента B в пул 198.51.100.129–134: интерфейс к P1 — inside (для VRF B это сложно) или проще — вход в NAT через отдельный VRF-интерфейс. Для простоты лабы: подключи B1 (офис 1 клиента B) к PE1 и сделай NAT на его интерфейсе с <code>vrf B</code>.',
        hint: 'ip nat inside source list B-LAN pool POOL-B vrf B overload; на Gi0/2 (VRF B к B1) — ip nat inside; на Gi0/3 (к INET) — ip nat outside. В VRF B нужен default с next-hop global. Офисы B за PE2 тоже выйдут: их трафик придёт в VRF B на PE1 по MPLS, но NAT inside тогда должен срабатывать и на этом пути — проверь, что происходит, и объясни.',
        check: 'PE1#show ip nat translations vrf B\nB1#ping 8.8.8.8 source Lo1' },
      { t: 'Internet в VRF', d: 'Перенеси аплинк INET в VRF INET (RD 10.255.0.1:666, RT 64500:666). Клиенту A дай доступ, импортировав в VRF A <b>только default</b> из INET (import map), а в INET экспортируй из A только 203.0.113.0/28 (export map). Убедись, что в VRF A не появилось лишних маршрутов, а в INET не появились серые сети клиентов.',
        check: 'PE1#show ip route vrf INET\nPE1#show ip route vrf A\nA1#ping 8.8.8.8 source Lo2' }
    ],
    brk: [
      { t: 'Клиент A: исходящий трафик в интернет уходит, ответы не возвращаются', inj: 'PE1(config)#no ip route 203.0.113.0 255.255.255.240 Gi0/1 172.30.1.2', h: '<code>show ip route 203.0.113.5</code> в глобальной таблице PE1. Куда PE1 отправит ответ от INET?', f: 'Нет обратного маршрута из глобальной таблицы в VRF A: ответы на белые адреса клиента PE1 отправляет по default обратно в INET или отбрасывает. Leaking нужен в обе стороны.' }
    ]
  }
});
