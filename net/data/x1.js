COURSE.add({
  id: 'x1',
  time: '≈ 4–5 часов',
  intro: `<p>Когда до цели несколько равноценных путей, трафик можно делить между ними: <b>ECMP</b> (equal-cost multipath). Так работают ядро провайдера, фабрики ЦОД и LAG. Но делится он не пакетами, а <b>потоками по хешу</b>, и из этого вытекает много неочевидного: поляризация, «слоны», перекосы, проблемы с MPLS и туннелями. Глава о том, как устроено хеширование и как не наступить на его грабли.</p>`,
  goals: [
    'Объяснить, почему балансировка идёт по потокам, а не по пакетам',
    'Знать поля хеша для IP, MPLS, туннелей и откуда брать энтропию (entropy label, flow label, UDP source port)',
    'Объяснить поляризацию и способы борьбы (seed, разные поля, resilient hashing)',
    'Понимать UCMP, BGP multipath и ограничения ECMP',
    'Диагностировать перекос нагрузки по линкам'
  ],
  why: `«Один из четырёх линков ядра загружен на 95%, остальные на 30%» — типичная задача. Ответ почти всегда в хешировании: «слон», поляризация или трафик, у которого нет энтропии (MPLS без меток энтропии, GRE, IPsec).`,
  refs: [
    { t: 'linkmeup — ECMP и балансировка в датацентрах', u: 'https://linkmeup.ru/blog/903/' },
    { t: 'RFC 2992 — Analysis of an Equal-Cost Multi-Path Algorithm', u: 'https://www.rfc-editor.org/rfc/rfc2992' },
    { t: 'RFC 6790 — The Use of Entropy Labels in MPLS Forwarding', u: 'https://www.rfc-editor.org/rfc/rfc6790' },
    { t: 'RFC 6438 — Using the IPv6 Flow Label for ECMP', u: 'https://www.rfc-editor.org/rfc/rfc6438' },
    { t: 'RFC 7938 — Use of BGP for Routing in Large-Scale Data Centers', u: 'https://www.rfc-editor.org/rfc/rfc7938', n: 'разделы о multipath' }
  ],
  theory: [
    {
      id: 'flow', h: 'Почему по потокам, а не по пакетам',
      html: `
<p>Если раскидывать пакеты одного TCP-соединения по разным путям с разной задержкой, они придут <b>не по порядку</b>. TCP воспримет это как потери (dup ACK), начнёт повторы и снизит скорость. Поэтому маршрутизатор вычисляет <b>хеш</b> от полей, одинаковых для всех пакетов потока, и по хешу выбирает путь. Все пакеты потока идут одним путём.</p>
<table><tr><th>Поля (5-tuple)</th><th>Что даёт</th></tr>
<tr><td>Src/Dst IP</td><td>базовая энтропия (2-tuple)</td></tr>
<tr><td>+ Protocol, Src/Dst port</td><td>разные TCP-сессии между одной парой хостов идут разными путями — лучше распределение</td></tr>
<tr><td>+ входной интерфейс, seed</td><td>разная функция на разных узлах (против поляризации)</td></tr></table>
<p>Следствия: один «слон» (большой поток, например репликация БД или бэкап) никогда не получит больше одного линка и может перегрузить его. Балансировка хороша, когда потоков много и они мелкие (интернет-трафик провайдера — идеальный случай).</p>`
    },
    {
      id: 'polar', h: 'Поляризация',
      html: `
<p>Узел A делит трафик на два пути по хешу H: «чётные» потоки влево, к узлу B, «нечётные» вправо, к C. У B тоже два пути, и он использует <b>ту же функцию и те же поля</b>. Но к нему пришли только «чётные» потоки, и все они снова дают «чётный» хеш и уходят в один и тот же линк. Второй линк B простаивает. Это <b>поляризация</b>.</p>
<p>Лечение: <b>разный seed</b> (уникальный идентификатор узла подмешивается в хеш, на Cisco это universal ID по умолчанию), разные поля или разные алгоритмы на разных уровнях, разное число путей на соседних уровнях.</p>
<pre class="cli">R1(config)#ip cef load-sharing algorithm universal 1A2B3C4D     ! seed
R1(config)#ip cef load-sharing algorithm include-ports source destination
R1#show ip cef exact-route 10.1.1.10 10.2.2.10
R1#show cef interface | include hash</pre>`
    },
    {
      id: 'entropy', h: 'Энтропия в MPLS и туннелях',
      html: `
<p>Для хеша нужны разные значения полей. Проблемные случаи:</p>
<ul><li><b>MPLS</b>: транзитный P видит стек меток. Варианты: хешировать по меткам (у всех потоков одного LSP одинаковые: плохо), «заглянуть» под стек в IP-заголовок (работает для L3VPN, но для L2VPN под меткой Ethernet-кадр, и его можно принять за IP — для этого control word, глава 12). Правильное решение — <b>Entropy Label</b> (RFC 6790): ingress PE считает хеш по полному заголовку клиента и кладёт результат в специальную метку. P хешируют по меткам, и энтропия есть. Для PW — <b>FAT label</b> (flow-aware transport).</li>
<li><b>GRE, IPsec</b>: у туннеля одинаковые внешние адреса и протокол, все потоки внутри туннеля — один «слон» для транзитных маршрутизаторов. IPsec ещё и шифрует порты. Решения: несколько туннелей, туннели поверх UDP с переменным source port.</li>
<li><b>VXLAN, GTP, QUIC</b>: используют <b>UDP source port</b> как хеш внутреннего потока, поэтому балансируются хорошо.</li>
<li><b>IPv6 flow label</b> (20 бит): источник ставит значение на поток, маршрутизаторы хешируют по нему (RFC 6438).</li></ul>`
    },
    {
      id: 'more', h: 'UCMP, BGP multipath, resilient hashing',
      html: `
<ul><li><b>ECMP</b> только для равных путей. <b>UCMP</b> (unequal-cost) — делить пропорционально весам (например, по полосе: 100G и 40G → 5:2). Есть в BGP (<code>dmzlink-bw</code>, link-bandwidth community), в некоторых IGP и в фабриках ЦОД.</li>
<li><b>BGP multipath</b>: по умолчанию BGP выбирает один путь. <code>maximum-paths N</code> разрешает ECMP по eBGP (и <code>maximum-paths ibgp N</code>). Требуется равенство атрибутов до шага IGP-метрики, а AS_PATH — одинаковый (или <code>bgp bestpath as-path multipath-relax</code> — одинаковой длины). Основа BGP-фабрик ЦОД.</li>
<li><b>Resilient hashing</b>: при падении одного из N путей обычный хеш (mod N → mod N−1) перераспределяет почти все потоки, и все TCP-сессии ловят переупорядочивание. Resilient (consistent) hashing переносит только потоки упавшего пути. Важно для балансировщиков и anycast-сервисов.</li>
<li><b>Ограничения</b>: число ECMP-путей в железе (8, 16, 64, 128…), размер таблиц групп ECMP.</li></ul>`
    }
  ],
  cmds: [
    { c: 'maximum-paths 4 (в OSPF / IS-IS / BGP)', d: 'Число ECMP-путей', hw: 'maximum load-balancing 4', jn: 'set policy-options policy-statement LB then load-balance per-packet (это per-flow!) + forwarding-table export' },
    { c: 'maximum-paths ibgp 4\nbgp bestpath as-path multipath-relax', d: 'BGP multipath (iBGP / разные AS одинаковой длины)', hw: 'maximum load-balancing ibgp 4 / load-balancing as-path-ignore', jn: 'multipath multiple-as' },
    { c: 'ip cef load-sharing algorithm include-ports source destination', d: 'Хешировать с учётом L4-портов', hw: 'load-balance hash-fields', jn: 'set forwarding-options hash-key family inet layer-4' },
    { c: 'ip cef load-sharing algorithm universal SEED', d: 'Seed против поляризации', hw: 'load-balance hash seed', jn: 'hash-parameters' },
    { c: 'show ip cef exact-route SRC DST [src-port X dest-port Y]', d: 'Какой путь выберет хеш', hw: 'display fib … ', jn: 'show route forwarding-table … extensive' },
    { c: 'show ip route X / show ip cef X detail', d: 'Все ECMP-пути и их доли (traffic share)', hw: 'display ip routing-table X verbose', jn: 'show route X extensive' },
    { c: 'mpls entropy-label / load-balance flow-label', d: 'Entropy label / FAT PW (платформенно)', hw: 'entropy-label', jn: 'entropy-label / flow-label-transmit' }
  ],
  cards: [
    ['Почему ECMP балансирует по потокам?', 'Пакеты одного потока по разным путям приходят не по порядку, и TCP считает это потерями. Хеш от полей потока держит поток на одном пути.'],
    ['Что такое «слон» и почему ECMP ему не помогает?', 'Большой одиночный поток (бэкап, репликация): всегда на одном пути, может перегрузить один линк.'],
    ['Что такое поляризация?', 'Узлы на разных уровнях используют одну функцию и поля: трафик, уже отсортированный выше, снова падает в один линк. Лечится seed и разными полями.'],
    ['Как получить энтропию для MPLS?', 'Entropy label (RFC 6790): ingress считает хеш и кладёт его в метку. Для PW — FAT label. Иначе транзит хеширует по одинаковым меткам.'],
    ['Почему GRE/IPsec плохо балансируются?', 'Внешние адреса и протокол туннеля одинаковы для всех потоков внутри, а IPsec шифрует порты. Весь туннель — один «слон».'],
    ['Как VXLAN даёт энтропию?', 'UDP source port внешнего заголовка = хеш внутреннего кадра.'],
    ['UCMP — что это?', 'Деление трафика пропорционально весам (полосе) между неравными путями.'],
    ['Что нужно для BGP multipath?', 'maximum-paths, равенство атрибутов до IGP-метрики, одинаковый AS_PATH (или multipath-relax — одинаковой длины).'],
    ['Resilient hashing?', 'При падении пути переносятся только его потоки, остальные остаются на месте (в отличие от mod N).']
  ],
  quiz: [
    { q: 'Четыре равных линка, один загружен на 95%, остальные на 30%. Через сеть идёт ночной бэкап одним TCP-соединением 8 Гбит/с. Причина?', o: ['Сломан ECMP', '«Слон»: один поток всегда на одном линке', 'Поляризация', 'MTU'], a: 1, e: 'Один поток нельзя разделить без переупорядочивания.' },
    { q: 'На двух уровнях сети одинаковые маршрутизаторы с одинаковыми настройками хеша, на втором уровне один из двух аплинков простаивает. Это…', o: ['Слон', 'Поляризация', 'UCMP', 'Asymmetric routing'], a: 1, e: 'Решение — seed или разные поля.' },
    { q: 'Почему P-маршрутизаторы плохо балансируют трафик L2VPN-псевдопроводов без дополнительных мер?', o: ['P не умеют ECMP', 'Нечего хешировать: метки одинаковы, а под ними Ethernet, а не IP. Нужен FAT/entropy label', 'MTU', 'Control word запрещает'], a: 1, e: 'FAT label — энтропия для PW.' },
    { q: 'Чтобы BGP поставил в FIB два пути через разные AS одинаковой длины, нужно…', o: ['Только maximum-paths', 'maximum-paths и bgp bestpath as-path multipath-relax', 'Weight', 'MED'], a: 1, e: 'По умолчанию multipath требует идентичный AS_PATH.' }
  ],
  und: [
    { q: 'Объясни, почему ECMP иногда даёт сильный перекос нагрузки, и перечисли причины и способы диагностики.', a: '<p>ECMP хеширует по потокам. Перекос возникает, если: 1) есть «слоны» — крупные одиночные потоки; 2) мало потоков (мало энтропии) — например, весь трафик в нескольких туннелях GRE/IPsec или в PW без FAT; 3) поляризация — одинаковые хеши на соседних уровнях; 4) хеш только по IP без портов, а трафик между небольшим числом пар адресов (два ЦОД, CGNAT); 5) неравное число путей на уровнях. Диагностика: загрузка интерфейсов группы, <code>show ip cef exact-route</code> для типичных потоков, анализ топ-потоков (NetFlow/sFlow), проверка настроек хеша (поля, seed) на всех уровнях, наличие entropy label для MPLS.</p>', k: ['по потокам', 'слоны', 'мало энтропии: туннели, PW, мало пар', 'поляризация', 'exact-route, NetFlow'] }
  ],
  lab: {
    title: 'Лаба Д1. ECMP и хеширование',
    time: '≈ 1,5 часа',
    nounl: 'Используй топологию лабы 14: у R1 два равных пути к R4.',
    goal: '<p>На топологии лабы 14 (два равных пути R1 → R4) посмотреть ECMP в OSPF и CEF, распределение потоков с хешем по IP и по портам, и BGP multipath.</p>',
    topo: {
      w: 600, h: 220,
      nodes: [{ id: 'R1', t: 'router', x: 80, y: 110, label: 'R1' }, { id: 'R2', t: 'router', x: 300, y: 40, label: 'R2' }, { id: 'R3', t: 'router', x: 300, y: 180, label: 'R3' }, { id: 'R4', t: 'router', x: 520, y: 110, label: 'R4' }],
      links: [['R1', 'Gi0/1', 'R2', 'Gi0/1'], ['R1', 'Gi0/2', 'R3', 'Gi0/2'], ['R2', 'Gi0/2', 'R4', 'Gi0/1'], ['R3', 'Gi0/1', 'R4', 'Gi0/2']]
    },
    tasks: [
      { t: 'ECMP в RIB и FIB', d: 'Убедись, что на R1 два пути к 10.2.2.0/24 (traffic share). Посмотри <code>show ip cef 10.2.2.0 internal</code>: как распределены «бакеты» хеша.', check: 'R1#show ip route 10.2.2.0\nR1#show ip cef 10.2.2.0 internal' },
      { t: 'Хеш по IP против хеша по портам', d: 'Для 10 разных пар адресов (подставь src из 10.1.1.10–19) посмотри <code>exact-route</code>. Затем включи учёт L4-портов и проверь одну пару с разными портами.', check: 'R1#show ip cef exact-route 10.1.1.10 10.2.2.10\nR1(config)#ip cef load-sharing algorithm include-ports source destination\nR1#show ip cef exact-route 10.1.1.10 10.2.2.10 src-port 1000 dest-port 80' },
      { t: 'BGP multipath', d: 'Подними eBGP R1 с R2 и R3 (R2 и R3 в разных AS), R4 анонсирует 10.2.2.0/24 обоим. На R1 добейся двух путей в RIB: maximum-paths 2 и multipath-relax (если AS разные).', check: 'R1#show ip bgp 10.2.2.0\nR1#show ip route 10.2.2.0' }
    ],
    brk: []
  }
});
