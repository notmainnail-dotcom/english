COURSE.add({
  id: 'ch12c',
  time: '≈ 6 часов',
  intro: `<p>Клиент подключён к сети провайдера <b>двумя линками к двум разным PE</b>, и хочет, чтобы работали оба (больше полосы) и отказ любого PE был незаметен. В VPLS это невозможно без костылей (STP клиента, MC-LAG). <b>EVPN Multihoming</b> решает задачу стандартно: Ethernet Segment, выбор DF, aliasing, mass withdraw, split horizon. Это самая «умная» часть EVPN и частый вопрос на собеседованиях на уровень выше начального.</p>`,
  goals: [
    'Объяснить, что такое Ethernet Segment и ESI и как LAG клиента «видит» два PE как один коммутатор',
    'Разобрать проблемы multihoming (петли BUM, дубли, чёрные дыры) и механизм решения каждой',
    'Понимать DF election (type 4), split horizon (ESI label / local bias), aliasing и mass withdraw (type 1)',
    'Отличать all-active, single-active и port-active режимы',
    'Сравнивать EVPN MH с MC-LAG/MLAG и стеками'
  ],
  why: `Резервированное подключение бизнес-клиентов и ЦОД к двум PE — норма для SLA уровня 99,99%. Если ты понимаешь DF, aliasing и mass withdraw, ты разберёшься в любой проблеме «при отказе PE1 клиент терял связь на 30 секунд» или «у клиента дублируются broadcast».`,
  refs: [
    { t: 'RFC 7432, разделы 8 и 14 — Multihoming', u: 'https://www.rfc-editor.org/rfc/rfc7432#section-8' },
    { t: 'RFC 8584 — Framework for EVPN Designated Forwarder Election Extensibility', u: 'https://www.rfc-editor.org/rfc/rfc8584' },
    { t: 'linkmeup — СДСМ 12.2. EVPN Multihoming', u: 'https://linkmeup.ru/blog/1231/' },
    { t: 'Juniper: EVPN Multihoming Overview', u: 'https://www.juniper.net/documentation/us/en/software/junos/evpn/topics/concept/evpn-bgp-multihoming-overview.html' }
  ],
  theory: [
    {
      id: 'es', h: 'Ethernet Segment и ESI',
      html: `
<p><b>Ethernet Segment (ES)</b> — набор линков, которыми одно устройство клиента (CE) подключено к нескольким PE. Ему присваивается <b>ESI</b> — 10-байтный идентификатор, <b>одинаковый на всех PE</b> этого сегмента (например, <code>0000:0000:0000:0001:0001</code>). По ESI PE понимают: «этот клиент подключён и ко мне, и к соседу».</p>
<p>Со стороны клиента это обычный <b>LAG (LACP)</b> из двух линков. Чтобы клиент поверил, что на том конце один коммутатор, оба PE отвечают в LACP с <b>одинаковым system ID</b> (LACP system-mac), и агрегат собирается на двух PE как на одном.</p>
<table><tr><th>Режим</th><th>Как работает</th></tr>
<tr><td><b>All-active</b></td><td>оба PE пересылают unicast от и к клиенту, нагрузка делится (LAG у клиента)</td></tr>
<tr><td><b>Single-active</b></td><td>на VLAN активен один PE (DF), другой ждёт. Без LAG у клиента</td></tr>
<tr><td>Port-active</td><td>активен один PE на весь порт (интерфейс второго PE выключен LACP-ом). Простой вариант для совместимости</td></tr></table>`
    },
    {
      id: 'problems', h: 'Три проблемы multihoming и их решения',
      html: `
<table><tr><th>Проблема</th><th>Что было бы</th><th>Решение EVPN</th></tr>
<tr><td><b>1. Дубли BUM к клиенту</b></td><td>broadcast из ядра пришёл на PE1 и PE2, оба отдают его клиенту — у клиента две копии</td><td><b>DF election</b>: для каждого VLAN (EVI) на сегменте выбирается один Designated Forwarder. Только DF отдаёт BUM в сегмент. PE находят друг друга через <b>type 4</b>, по умолчанию выбор по модулю: (VLAN mod N) → упорядоченный список PE по IP</td></tr>
<tr><td><b>2. Петля BUM из клиента</b></td><td>клиент послал broadcast через PE1, PE1 разослал в ядро, PE2 получил и вернул клиенту через свой линк</td><td><b>Split horizon</b>: в MPLS — <b>ESI label</b> (из type 1 per-ES): PE1 добавляет метку сегмента, PE2 видит свою ES и в этот сегмент не отдаёт. В VXLAN — <b>local bias</b>: PE2 знает (по IP источника VTEP), что PE1 — сосед по ES, и не отдаёт</td></tr>
<tr><td><b>3. Нагрузка и сходимость</b></td><td>MAC клиента изучил только PE1 (кадр ушёл по одному линку LAG), удалённые PE шлют всё на PE1. При отказе PE1 тысячи MAC отзываются по одному</td><td><b>Aliasing</b>: type 1 per-EVI от обоих PE говорит «сегмент доступен и через меня», и удалённые PE балансируют на оба, даже если MAC объявил только один. <b>Mass withdraw</b>: при отказе линка PE1 отзывает один type 1 per-ES, и все удалённые PE сразу убирают PE1 из next-hop для всех MAC этого ES</td></tr></table>
<pre class="cli">PE3#show bgp evpn route-type auto-discovery
 * >  RD: 10.255.0.1:1 auto-discovery 0 [[0000:0000:0000:0001:0001]]   ! per-EVI от PE1
 * >  RD: 10.255.0.2:1 auto-discovery 0 0000:0000:0000:0001:0001   ! per-EVI от PE2
 * >  RD: 10.255.0.1:1 auto-discovery [[4294967295]] 0000:0000:0000:0001:0001  ! per-ES (mass withdraw)
PE1#show bgp evpn route-type ethernet-segment
 * >  RD: 10.255.0.1:1 ethernet-segment 0000:0000:0000:0001:0001 10.255.0.1
 * >  RD: 10.255.0.2:1 ethernet-segment 0000:0000:0000:0001:0001 10.255.0.2
PE1#show evpn ethernet-segment detail       ! DF, режим, список PE</pre>`
    },
    {
      id: 'df', h: 'DF election подробнее',
      html: `
<ol class="steps"><li>Каждый PE с ES анонсирует <b>type 4</b> (ES route) с RT, производным от ESI. Его импортируют только PE с тем же ESI.</li>
<li>Выждав таймер (3 с по умолчанию, чтобы услышать всех), PE упорядочивают список адресов PE сегмента.</li>
<li>Для каждого VLAN V: DF = PE с порядковым номером <b>V mod N</b>. При двух PE чётные VLAN у одного, нечётные у другого: балансировка BUM.</li>
<li>Не-DF блокирует BUM <b>в сторону клиента</b> для этого VLAN (unicast в all-active ходит через оба).</li></ol>
<p>Есть и другие алгоритмы (RFC 8584): <b>HRW</b> (highest random weight) — меньше перетасовок при добавлении PE, <b>preference-based</b> — явный выбор по приоритету.</p>
<div class="callout warn"><b>Типовая проблема</b>ESI настроен на PE1 и PE2 по-разному (опечатка). PE не видят друг друга по type 4, каждый считает себя DF, и клиент получает дубли broadcast, а в LACP может не собраться агрегат (разные system-mac). Первое, что проверять: одинаковы ли ESI и LACP system-id на всех PE сегмента.</div>`
    },
    {
      id: 'vs', h: 'EVPN MH против MC-LAG и стеков',
      html: `
<table><tr><th></th><th>Стек / VSS / виртуальное шасси</th><th>MC-LAG / MLAG / vPC</th><th>EVPN Multihoming</th></tr>
<tr><td>Control plane</td><td>одно устройство</td><td>проприетарный протокол между парой + peer-link</td><td>стандартный BGP между любыми PE</td></tr>
<tr><td>Сколько PE</td><td>в стеке</td><td>ровно 2</td><td>2 и больше</td></tr>
<tr><td>Мультивендор</td><td>нет</td><td>нет (пара одного вендора)</td><td>да (стандарт)</td></tr>
<tr><td>Риски</td><td>общая точка отказа (ПО стека)</td><td>split brain при потере peer-link</td><td>сложность настройки и отладки</td></tr></table>
<p>В ЦОД Arista исторически сильна MLAG (часто в паре с EVPN, где VTEP — anycast-адрес пары), но EVPN all-active (ESI) вытесняет MLAG как более стандартный и масштабируемый вариант. У провайдеров для подключения клиентов к двум PE — EVPN MH или, по старинке, MC-LAG.</p>`
    }
  ],
  cmds: [
    { g: 'Arista EOS' },
    { c: 'interface Port-Channel10\n evpn ethernet-segment\n  identifier 0000:0000:0000:0001:0001\n  route-target import 00:00:00:01:00:01\n lacp system-id 0000.0000.0101', d: 'ES на агрегате к клиенту (одинаково на обоих leaf)' },
    { c: 'show bgp evpn route-type ethernet-segment | auto-discovery', d: 'Type 4 и type 1' },
    { c: 'show bgp evpn instance', d: 'EVI, DF по VLAN' },
    { g: 'Junos / IOS-XR (справка)' },
    { c: 'esi 00:00:00:00:00:00:00:01:00:01;\nesi all-active;\naggregated-ether-options lacp system-id 00:00:00:01:01:01', d: 'Junos: ESI на ae-интерфейсе', jn: 'show evpn instance extensive / show evpn ethernet-segment' },
    { c: 'evpn\n interface Bundle-Ether10\n  ethernet-segment\n   identifier type 0 00.00.00.00.00.00.01.00.01', d: 'IOS-XR', jn: 'show evpn ethernet-segment detail' }
  ],
  cards: [
    ['Что такое Ethernet Segment и ESI?', 'ES — линки одного CE к нескольким PE. ESI — 10-байтный идентификатор ES, одинаковый на всех PE сегмента.'],
    ['Как CE видит два PE одним коммутатором?', 'Оба PE отвечают в LACP с одинаковым system ID: у клиента обычный LAG.'],
    ['All-active vs single-active?', 'All-active: оба PE пересылают unicast клиента (балансировка). Single-active: активен один PE (DF) на VLAN.'],
    ['Зачем DF и как выбирается?', 'Чтобы BUM в сегмент отдавал только один PE (без дублей). По type 4: упорядочить PE, DF для VLAN V = PE[V mod N].'],
    ['Как работает split horizon в EVPN-MPLS и EVPN-VXLAN?', 'MPLS: ESI label — PE с той же ES не отдаёт BUM обратно в сегмент. VXLAN: local bias — по IP VTEP источника PE понимает, что сосед по ES, и не отдаёт.'],
    ['Что такое aliasing?', 'Type 1 per-EVI от всех PE сегмента: удалённые PE балансируют трафик к MAC клиента на все PE ES, даже если MAC объявил только один.'],
    ['Что такое mass withdraw?', 'При отказе линка ES PE отзывает один type 1 per-ES, и удалённые PE сразу убирают его как next-hop для всех MAC сегмента.'],
    ['Типичная ошибка конфигурации ES?', 'Разные ESI или LACP system-id на PE: не видят друг друга по type 4, оба DF (дубли BUM), LAG не собирается.'],
    ['EVPN MH vs MC-LAG?', 'MC-LAG: проприетарно, ровно 2 устройства, peer-link, риск split brain. EVPN MH: стандарт BGP, 2+ PE, мультивендор.']
  ],
  quiz: [
    { q: 'Клиент в all-active ES к PE1 и PE2. Удалённый PE3 видит MAC клиента только от PE1, но шлёт трафик на оба PE. Какой механизм?', o: ['DF', 'Aliasing (type 1 per-EVI)', 'Mass withdraw', 'Split horizon'], a: 1, e: 'Type 1 per-EVI от PE2 сообщает, что ES доступен и через него.' },
    { q: 'Клиент получает каждый broadcast дважды. Что проверить в первую очередь?', o: ['RT EVI', 'Одинаковость ESI на PE и выбор DF (type 4)', 'Underlay MTU', 'ARP suppression'], a: 1, e: 'Если PE не нашли друг друга по ES, оба считают себя DF.' },
    { q: 'Линк PE1–CE упал. Как удалённые PE быстро перестанут слать трафик на PE1 для тысяч MAC клиента?', o: ['Дождутся устаревания MAC', 'PE1 отзовёт type 1 per-ES (mass withdraw)', 'PE2 пришлёт type 3', 'Через LACP'], a: 1, e: 'Один отзыв на сегмент вместо тысяч отзывов type 2.' },
    { q: 'Какой маршрут используется для выбора DF?', o: ['Type 1', 'Type 2', 'Type 4', 'Type 5'], a: 2, e: 'Ethernet Segment route.' },
    { q: 'Broadcast от клиента ушёл через PE1 в ядро. Почему PE2 не вернёт его клиенту по второму линку LAG (EVPN-MPLS)?', o: ['PE2 не DF', 'Split horizon: ESI label из сегмента клиента', 'TTL', 'LACP блокирует'], a: 1, e: 'PE2 видит ESI label своей ES и не отдаёт кадр в этот сегмент. Без этого была бы петля, даже если PE2 — DF.' }
  ],
  und: [
    { q: 'Опиши три проблемы, которые возникают, когда клиент подключён LAG-ом к двум PE в all-active, и механизм EVPN для каждой.', a: '<p>1) Дубли BUM к клиенту: оба PE получили broadcast из ядра. Решение: DF election по type 4 — только DF для этого VLAN отдаёт BUM в сегмент. 2) Петля BUM от клиента: PE1 отправил broadcast клиента в ядро, PE2 вернул бы его клиенту. Решение: split horizon — ESI label (MPLS) или local bias (VXLAN). 3) Балансировка и сходимость: MAC клиента изучен одним PE. Aliasing через type 1 per-EVI позволяет удалённым PE слать на оба PE. При отказе mass withdraw (отзыв type 1 per-ES) мгновенно убирает PE из next-hop для всех MAC сегмента.</p>', k: ['DF и type 4', 'split horizon: ESI label / local bias', 'aliasing type 1 per-EVI', 'mass withdraw type 1 per-ES'] }
  ],
  lab: {
    title: 'Лаба 12.2. All-active клиент к двум leaf',
    time: '≈ 2–3 часа',
    nounl: 'Расширь лабу 12.1: добавь коммутатор клиента CE (vIOS-L2) с двумя линками в LEAF1 Eth5 и LEAF2 Eth5 и хост H4 за ним. Port-Channel на CE в LACP active.',
    goal: `<p>На базе фабрики из лабы 12.1 подключить коммутатор клиента LAG-ом к LEAF1 и LEAF2 (all-active ES), посмотреть type 1 и type 4, выбор DF, aliasing и поведение при отказе.</p>`,
    topo: {
      w: 760, h: 380,
      nodes: [
        { id: 'SPINE', t: 'veos', x: 380, y: 60, label: 'SPINE', role: 'spine' },
        { id: 'LEAF1', t: 'veos', x: 220, y: 180, label: 'LEAF1', role: 'leaf, ES' },
        { id: 'LEAF2', t: 'veos', x: 540, y: 180, label: 'LEAF2', role: 'leaf, ES' },
        { id: 'CE', t: 'switch', x: 380, y: 300, label: 'CE клиента\nPo1 LACP', role: 'коммутатор клиента' },
        { id: 'H2', t: 'pc', x: 680, y: 300, label: 'H2 10.10.0.12', role: 'удалённый хост' }
      ],
      links: [['SPINE', 'Eth1', 'LEAF1', 'Eth1'], ['SPINE', 'Eth2', 'LEAF2', 'Eth1'], ['LEAF1', 'Eth5', 'CE', 'Gi0/0', 'ES 0001:0001', { c: '#a855f7' }], ['LEAF2', 'Eth5', 'CE', 'Gi0/1', '', { c: '#a855f7' }], ['H2', 'eth0', 'LEAF2', 'Eth3']]
    },
    pre: 'Поддержка EVPN all-active (ESI) на vEOS зависит от версии EOS: в старых образах (4.21) команды <code>evpn ethernet-segment</code> может не быть. Тогда выполни задания концептуально, по выводам и теории, а вживую то же самое можно сделать на Junos vMX (у тебя есть образ 18.2), или собери MLAG-вариант (<code>mlag configuration</code> + общий VTEP-адрес) и сравни подходы.',
    tasks: [
      { t: 'Ethernet Segment на обоих leaf', d: 'На LEAF1 и LEAF2: Port-Channel10 (Eth5, LACP active, trunk VLAN 10) с <code>evpn ethernet-segment identifier 0000:0000:0000:0001:0001</code> и одинаковым <code>lacp system-id</code>. На CE: Port-channel1 из Gi0/0–1, trunk VLAN 10, хост H4 в VLAN 10 (10.10.0.14).',
        check: 'CE#show etherchannel summary\nLEAF1#show port-channel 10\nLEAF1#show bgp evpn route-type ethernet-segment' },
      { t: 'DF и type 1', d: 'Определи DF для VLAN 10 (по таблице или выводу). Найди на SPINE/LEAF2 маршруты type 1 per-ES и per-EVI. С H2 пингани H4: через какой leaf идёт трафик (aliasing)?',
        check: 'LEAF1#show bgp evpn instance\nLEAF2#show bgp evpn route-type auto-discovery\nLEAF2#show vxlan address-table' },
      { t: 'Отказ и mass withdraw', d: 'Запусти <code>ping 10.10.0.14 -t</code> с H2 и выключи Eth5 на DF-leaf. Сколько пакетов потеряно? Какие маршруты отозваны? Кто стал DF?',
        check: 'LEAF2#show bgp evpn route-type auto-discovery\nLEAF2#show bgp evpn instance' }
    ],
    brk: [
      { t: 'У H4 дубли broadcast и периодические проблемы с ARP', inj: 'LEAF2(config)#interface Port-Channel10\nLEAF2(config-if-Po10)#evpn ethernet-segment\nLEAF2(config-evpn-es)#identifier 0000:0000:0000:0001:0002', h: '<code>show bgp evpn route-type ethernet-segment</code> на обоих — одинаковый ли ESI? Кто DF?', f: 'Разные ESI: leaf не считают себя соседями по сегменту, оба DF и оба отдают BUM клиенту (дубли), split horizon не работает. ESI должен совпадать.' }
    ]
  }
});
