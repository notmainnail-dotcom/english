COURSE.add({
  id: 'ch09',
  time: '≈ 8–10 часов',
  intro: `<p>Мультикаст — это технология, на которой у провайдера работает <b>IPTV</b>. 300 каналов по 5–15 Мбит/с, десятки тысяч абонентов: unicast-копия на каждого телевизор положила бы любую сеть. Мультикаст доставляет каждый канал по каждому линку <b>один раз</b>, а копирует там, где дерево ветвится. Глава построена вокруг трёх вопросов: как хост просит канал (IGMP), как сеть строит дерево (PIM, RPF) и как всё это устроено и ломается в провайдерской IPTV-сети.</p>`,
  goals: [
    'Объяснить адресацию мультикаста (224/4, SSM 232/8, отображение на MAC) и её подводные камни',
    'Описать работу IGMPv2/v3, querier, IGMP snooping, proxy и MVR на сети доступа',
    'Объяснить RPF-проверку и почему мультикаст «ломается», когда unicast-маршрутизация асимметрична',
    'Разобрать PIM-SM: RP, shared tree (*,G), регистрация, переход на SPT (S,G); PIM-SSM без RP',
    'Читать show ip mroute и находить проблему: нет RPF, нет RP, нет join, OIL пуст',
    'Понимать архитектуру IPTV у провайдера и типовые жалобы («картинка рассыпается», «долго переключается»)'
  ],
  why: `Если у провайдера есть IPTV, мультикаст идёт через всю сеть: от головной станции через ядро и агрегацию до абонентского порта. Заявки «канал не показывает», «рассыпается картинка», «долго переключается» решаются только при понимании IGMP, PIM и RPF. Это одна из тех тем, где у многих инженеров пробел, поэтому знающий человек ценится.`,
  refs: [
    { t: 'RFC 7761 — PIM Sparse Mode (rev.)', u: 'https://www.rfc-editor.org/rfc/rfc7761' },
    { t: 'RFC 3376 — IGMPv3; RFC 4607 — Source-Specific Multicast', u: 'https://www.rfc-editor.org/rfc/rfc4607' },
    { t: 'RFC 4541 — Considerations for IGMP and MLD Snooping Switches', u: 'https://www.rfc-editor.org/rfc/rfc4541' },
    { t: 'B. Williamson — Developing IP Multicast Networks', n: 'классика по мультикасту' },
    { t: 'Cisco: IP Multicast Technology Overview / Troubleshooting', u: 'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipmulti_pim/configuration/xe-16/imc-pim-xe-16-book/imc-tech-oview.html' },
    { t: 'linkmeup — СДСМ ч. 9. Мультикаст', u: 'https://linkmeup.ru/blog/129.html', n: 'одна из лучших статей цикла' }
  ],
  theory: [
    {
      id: 'why', h: 'Зачем: unicast, broadcast, multicast',
      html: `
<table><tr><th></th><th>Как доставляется</th><th>Проблема для ТВ</th></tr>
<tr><td>Unicast</td><td>отдельная копия на каждого получателя от самого источника</td><td>10 000 зрителей × 8 Мбит/с = 80 Гбит/с с одного сервера и по всем линкам</td></tr>
<tr><td>Broadcast</td><td>всем в сегменте</td><td>не выходит за VLAN, и всем, даже тем, кто не смотрит</td></tr>
<tr><td><b>Multicast</b></td><td>одна копия на линк, размножение в точках ветвления, только туда, где есть желающие</td><td>нужно строить и поддерживать дерево</td></tr></table>
<p>Модель: источник шлёт в <b>группу</b> (адрес 239.1.1.10 = «Первый канал»), не зная, кто смотрит. Получатели <b>подписываются</b> на группу. Сеть строит <b>дерево распространения</b> от источника к подписчикам.</p>
<h3>Адреса</h3>
<table><tr><th>Диапазон</th><th>Назначение</th></tr>
<tr><td>224.0.0.0/4</td><td>весь мультикаст (класс D)</td></tr>
<tr><td>224.0.0.0/24</td><td>link-local, не маршрутизируется, TTL=1: 224.0.0.1 все хосты, .2 все маршрутизаторы, .5/.6 OSPF, .13 PIM, .22 IGMPv3</td></tr>
<tr><td>232.0.0.0/8</td><td><b>SSM</b> — source-specific (подписка на пару источник+группа)</td></tr>
<tr><td>239.0.0.0/8</td><td>administratively scoped — «частные», для IPTV внутри провайдера</td></tr></table>
<h3>Отображение на MAC</h3>
<p>Мультикастовый MAC: <code>01:00:5E</code> + 0 + <b>младшие 23 бита</b> IP-адреса. 28 значащих бит группы, а в MAC помещается только 23, поэтому <b>32 IP-группы делят один MAC</b>: 224.1.1.1, 225.1.1.1, 239.129.1.1 — все дают 01:00:5E:01:01:01. Коммутатор без IGMP snooping и сетевые карты фильтруют по MAC и получат «лишнее». Хороший адресный план IPTV это учитывает.</p>
<div class="callout info"><b>Мультикаст — это UDP</b>Поток IPTV — UDP (MPEG-TS, обычно 7 TS-пакетов по 188 байт = 1316 байт в UDP). Повторных передач нет: потерянный пакет — артефакт на экране («рассыпание», «квадратики»). Поэтому для IPTV важны нулевые потери, а не скорость.</div>`
    },
    {
      id: 'igmp', h: 'IGMP: как хост просит канал',
      html: `
<p><b>IGMP</b> работает между хостом и <b>первым маршрутизатором</b> (или BRAS/L3-коммутатором) в его сегменте. Дальше по сети он не идёт: дальше работает PIM.</p>
<table><tr><th>Версия</th><th>Что умеет</th></tr>
<tr><td>IGMPv1</td><td>Report (join), выход по таймауту (минуты)</td></tr>
<tr><td>IGMPv2</td><td>+ <b>Leave</b> и group-specific query: быстрый выход. Выбор querier (меньший IP)</td></tr>
<tr><td>IGMPv3</td><td>+ подписка на <b>(S,G)</b>: «хочу группу G только от источника S» (INCLUDE/EXCLUDE). Нужен для SSM</td></tr></table>
<h3>Механика</h3>
<ol class="steps"><li>Хост включает канал и шлёт <b>Membership Report</b> на адрес группы (v2) или на 224.0.0.22 (v3).</li>
<li>Маршрутизатор (querier) запоминает: «на этом интерфейсе есть подписчик группы G» и через PIM тянет поток к себе.</li>
<li>Querier периодически (125 с) шлёт <b>General Query</b> на 224.0.0.1. Хосты подтверждают подписки (с задержкой, чтобы не все сразу).</li>
<li>Хост переключил канал — шлёт <b>Leave</b> (224.0.0.2). Маршрутизатор отправляет group-specific query: «кто ещё смотрит G?». Тишина — поток прекращается (last member query interval ≈ 1–2 с).</li></ol>
<p><b>Immediate leave / fast-leave</b>: если за портом один получатель (абонентский порт), поток останавливается сразу по Leave, без проверочного query. Это критично для времени переключения каналов: старый канал не висит в абонентском порту лишние секунды.</p>
<h3>IGMP snooping</h3>
<p>Коммутатор по умолчанию флудит мультикаст во все порты VLAN, как broadcast. <b>IGMP snooping</b> подслушивает IGMP-сообщения и отправляет поток группы только в порты, откуда пришёл Report, плюс в порт маршрутизатора (mrouter port). Без snooping один канал 8 Мбит/с забивает все порты VLAN.</p>
<div class="callout warn"><b>Snooping без querier</b>Если в VLAN нет маршрутизатора (некому слать Query), хосты перестают отправлять Reports, snooping через несколько минут удаляет записи, и картинка пропадает «сама собой» через ~260 с. Лечится <code>ip igmp snooping querier</code> на коммутаторе.</div>
<h3>Провайдерская сеть доступа</h3>
<ul><li><b>MVR</b> (Multicast VLAN Registration): все абоненты в своих VLAN (часто 1:1), а IPTV-потоки идут в отдельном <b>мультикаст-VLAN</b>. Коммутатор доступа копирует нужные группы из мультикаст-VLAN в абонентские порты по IGMP. Один поток на кольцо, а не по копии на каждый абонентский VLAN.</li>
<li><b>IGMP proxy</b>: коммутатор сам отвечает на query, агрегирует reports абонентов и шлёт наверх один report от себя. Снижает нагрузку на агрегацию.</li>
<li><b>Профили и фильтры</b>: абоненту разрешены группы по тарифу (пакеты каналов), максимум групп на порт (2–3 телевизора).</li></ul>`
    },
    {
      id: 'rpf', h: 'RPF — главное понятие мультикаст-маршрутизации',
      html: `
<p>Unicast-маршрутизация смотрит на адрес <b>назначения</b>. В мультикасте адрес назначения — группа, по ней путь не определишь. Поэтому мультикаст-маршрутизатор смотрит на адрес <b>источника</b> и делает <b>RPF-проверку</b> (Reverse Path Forwarding):</p>
<div class="callout info"><b>RPF-правило</b>Мультикаст-пакет от источника S принимается, только если пришёл на интерфейс, через который <b>unicast-маршрут к S</b> ведёт обратно (RPF-интерфейс). Пришёл с другого — отбрасывается. Так мультикаст не зацикливается: дерево всегда строится по кратчайшему пути <i>от источника</i>, а копии, пришедшие кружным путём, отсекаются.</div>
<pre class="cli">R3#show ip rpf 10.0.0.10
RPF information for ? (10.0.0.10)
  [[RPF interface: GigabitEthernet0/1]]
  RPF neighbor: ? (10.1.23.0)
  RPF route/mask: 10.0.0.0/24
  RPF type: unicast (ospf 1)</pre>
<h3>Следствия, которые ломают IPTV</h3>
<ul><li>Мультикаст следует за <b>unicast-маршрутизацией</b>. Поменял метрики IGP — поменялось мультикаст-дерево.</li>
<li>Если unicast к источнику идёт через интерфейс, где <b>PIM не включён</b>, RPF-интерфейс без PIM, и дерево не строится. Классика: PIM включили не на всех линках.</li>
<li>Асимметрия, ECMP, статика, туннели — всё может дать RPF failure. Счётчик <code>show ip mroute count</code> / <code>show ip traffic</code> «RPF failed».</li>
<li>Нужен другой путь для мультикаста, чем для unicast — <b>static mroute</b> (<code>ip mroute</code>) или MBGP (address-family ipv4 multicast): отдельная таблица для RPF.</li></ul>`
    },
    {
      id: 'pim', h: 'PIM: строим дерево',
      html: `
<p><b>PIM</b> (Protocol Independent Multicast) — «независимый», потому что не строит свою таблицу маршрутов, а использует для RPF любой unicast (OSPF, IS-IS, BGP, статику). Соседи PIM — через hello на 224.0.0.13.</p>
<h3>Dense mode — «залить и подрезать»</h3>
<p>Поток сначала флудится по всей сети, а маршрутизаторы без подписчиков шлют <b>Prune</b>. Каждые 3 минуты всё повторяется. Годится для сетей, где подписчики почти везде. В провайдерских сетях не используют.</p>
<h3>Sparse mode — по запросу, через RP</h3>
<ol class="steps">
<li><b>RP</b> (Rendezvous Point) — точка встречи, известная всем (статически, через Auto-RP или BSR).</li>
<li><b>Получатель</b> появился: его маршрутизатор (last-hop router, LHR) шлёт <b>(*,G) Join</b> по направлению к RP (по RPF к адресу RP). Строится <b>shared tree</b> (RPT) от RP к подписчикам.</li>
<li><b>Источник</b> начал вещать: его маршрутизатор (first-hop router, FHR) заворачивает пакеты в unicast <b>PIM Register</b> к RP. RP разворачивает их и пускает по shared tree, а сам шлёт (S,G) Join к источнику. Когда нативный поток дошёл до RP, RP шлёт FHR <b>Register-Stop</b>.</li>
<li><b>Переход на SPT</b>: LHR, получив первый пакет и узнав адрес источника S, шлёт <b>(S,G) Join</b> напрямую к источнику (по RPF к S) и строит <b>shortest path tree</b>. После прихода потока по SPT отсекает его от RP (prune (S,G,rpt)). На Cisco это происходит сразу (<code>spt-threshold 0</code>).</li></ol>
<pre class="cli">R3#show ip mroute 239.1.1.10
(*, 239.1.1.10), 00:05:12/00:02:51, RP 10.255.0.2, flags: SJC
  Incoming interface: GigabitEthernet0/1, RPF nbr 10.1.23.0
  Outgoing interface list:
    GigabitEthernet0/0, Forward/Sparse, 00:05:12/00:02:51
(10.0.0.10, 239.1.1.10), 00:04:58/00:02:59, flags: [[JT]]
  Incoming interface: [[GigabitEthernet0/2]], RPF nbr 10.1.34.1
  Outgoing interface list:
    GigabitEthernet0/0, Forward/Sparse, 00:04:58/00:02:51</pre>
<p>Как читать: <b>Incoming interface</b> — откуда ждём поток (должен совпадать с RPF). <b>OIL</b> (outgoing interface list) — куда копируем. Флаги: S — sparse, C — connected-получатель, J — join SPT, T — по SPT реально идёт трафик, P — pruned (OIL пуст), F — зарегистрированный источник (на FHR), R — RP-bit prune.</p>
<h3>Как маршрутизаторы узнают RP</h3>
<ul><li><b>Статически</b> (<code>ip pim rp-address</code>) — просто и надёжно, но меняется руками везде.</li>
<li><b>BSR</b> (стандарт): кандидаты в RP сообщают о себе bootstrap-маршрутизатору, тот рассылает RP-set всем.</li>
<li><b>Auto-RP</b> (Cisco): то же через группы 224.0.1.39/40.</li>
<li><b>Anycast RP</b>: несколько RP с <b>одинаковым</b> адресом (anycast loopback), каждый маршрутизатор идёт к ближайшему, а RP синхронизируют источники через <b>MSDP</b> (или PIM anycast RP, RFC 4610). Резервирование и балансировка RP.</li></ul>
<h3>SSM — без RP</h3>
<p>Если получатель заранее знает источник (а в IPTV провайдера он его знает: головная станция одна), RP не нужен. Хост шлёт IGMPv3 «(S,G)», LHR сразу строит SPT к источнику. Нет RP, нет регистрации, нет переключения деревьев: меньше состояний, быстрее, надёжнее. Диапазон 232/8 (или любой, если настроить <code>ip pim ssm range</code>). Для старых приставок с IGMPv2 есть <b>SSM mapping</b>: маршрутизатор сам подставляет источник по таблице «группа → источник».</p>
<div class="callout pro"><b>Что выбирают провайдеры для IPTV</b>Чаще всего <b>PIM-SSM</b> в ядре (или mLDP / P2MP-TE в MPLS-сети), SSM mapping на границе доступа для старых приставок, IGMP snooping/proxy/MVR на коммутаторах доступа и два источника (основная и резервная головная станция) с переключением на уровне сети (anycast-источник) или приставки.</div>`
    },
    {
      id: 'iptv', h: 'IPTV у провайдера: архитектура и типовые проблемы',
      html: `
<p>Цепочка: <b>головная станция</b> (приём спутника/оптики, кодирование, мультиплексирование) → мультикаст-потоки 239.x или 232.x в ядро → PIM (или mLDP) по ядру → агрегация (BRAS, L3-коммутатор или PE) → IGMP с абонентской стороны → коммутаторы доступа (snooping, MVR, proxy) → STB (приставка).</p>
<table><tr><th>Жалоба</th><th>Что смотреть</th></tr>
<tr><td>Канал не показывает (чёрный экран) у всех</td><td>есть ли поток на головной станции. <code>show ip mroute G</code> по пути от источника: на каком хопе (S,G) пропадает или incoming interface не совпадает с RPF, нет PIM-соседства</td></tr>
<tr><td>Канал не показывает у одного абонента</td><td>IGMP от приставки доходит? (<code>show ip igmp groups</code>, snooping-таблица на коммутаторе доступа), профиль/фильтр групп, лимит групп на порту</td></tr>
<tr><td>Картинка рассыпается, квадратики</td><td><b>потери пакетов</b>: перегрузка линка (output drops, микробёрсты), ошибки (CRC), QoS (IPTV в своём классе), дубли потоков при переключении деревьев. MDI-метрики (media delivery index)</td></tr>
<tr><td>Долгое переключение каналов</td><td>нет fast-leave (старый поток держится), долгий join (дерево строится от далёкого RP), GOP приставки (это уже кодер)</td></tr>
<tr><td>Пропадает через ~4 минуты после включения</td><td>нет IGMP querier в VLAN, и snooping удалил подписку</td></tr>
<tr><td>Все каналы флудят во все порты</td><td>выключен или сломан IGMP snooping</td></tr></table>
<div class="callout info"><b>Мультикаст в MPLS-сети (mVPN)</b>В сети с MPLS L3VPN мультикаст клиентов (и IPTV провайдера) переносят через ядро: <b>Rosen/draft</b> (GRE + PIM в ядре), <b>mLDP</b> (P2MP/MP2MP LSP, построенные LDP), <b>P2MP RSVP-TE</b>, а в будущем <b>BIER</b> (без состояний в ядре). Это следующий уровень после главы 11.</div>`
    }
  ],
  cmds: [
    { g: 'Включение' },
    { c: 'ip multicast-routing', d: 'Включить мультикаст-маршрутизацию (без этого ничего не работает)', hw: 'multicast routing-enable', jn: '— (включается протоколами)' },
    { c: 'interface X\n ip pim sparse-mode', d: 'PIM-SM на интерфейсе (+ IGMP на нём)', hw: 'pim sm', jn: 'set protocols pim interface X mode sparse' },
    { c: 'ip pim rp-address 10.255.0.2 [ACL]', d: 'Статический RP', hw: 'pim\n static-rp 10.255.0.2', jn: 'set protocols pim rp static address 10.255.0.2' },
    { c: 'ip pim bsr-candidate Lo0 / ip pim rp-candidate Lo0', d: 'BSR и кандидат в RP', hw: 'c-bsr LoopBack0 / c-rp LoopBack0', jn: 'rp bootstrap / local address' },
    { c: 'ip pim ssm default | range ACL', d: 'Включить SSM для 232/8 или диапазона', hw: 'ssm-policy 2000', jn: 'ssm-groups' },
    { c: 'ip igmp version 3', d: 'IGMPv3 на интерфейсе к получателям', hw: 'igmp version 3', jn: 'set protocols igmp interface X version 3' },
    { c: 'ip igmp ssm-map enable / ip igmp ssm-map static ACL SRC', d: 'SSM mapping для приставок с IGMPv2', hw: 'igmp ssm-mapping enable', jn: 'ssm-map' },
    { c: 'ip igmp join-group G [source S]', d: 'Маршрутизатор сам «подписывается» (для тестов)', hw: 'igmp static-group G', jn: 'static group G' },
    { c: 'ip mroute SRC MASK RPF-NBR', d: 'Статический маршрут для RPF', hw: 'ip rpf-route-static', jn: 'rib inet.2 static' },
    { g: 'Коммутатор' },
    { c: 'ip igmp snooping [vlan N]', d: 'IGMP snooping (обычно включён по умолчанию)', hw: 'igmp-snooping enable', jn: 'set protocols igmp-snooping vlan V' },
    { c: 'ip igmp snooping querier', d: 'Querier на коммутаторе (когда нет маршрутизатора)', hw: 'igmp-snooping querier enable', jn: '—' },
    { c: 'ip igmp snooping vlan N immediate-leave', d: 'Fast-leave на VLAN', hw: 'igmp-snooping prompt-leave', jn: 'immediate-leave' },
    { c: 'show ip igmp snooping groups', d: 'Какие группы в какие порты', hw: 'display igmp-snooping port-info', jn: 'show igmp snooping membership' },
    { g: 'Диагностика' },
    { c: 'show ip mroute [G] [S]', d: 'Таблица мультикаст-маршрутизации: (*,G), (S,G), IIF, OIL, флаги', hw: 'display multicast routing-table', jn: 'show multicast route extensive' },
    { c: 'show ip mroute count', d: 'Счётчики пакетов по группам, RPF failed', hw: 'display multicast forwarding-table statistics', jn: 'show multicast statistics' },
    { c: 'show ip rpf SRC', d: 'RPF-интерфейс и сосед к источнику', hw: 'display multicast rpf-info SRC', jn: 'show multicast rpf SRC' },
    { c: 'show ip pim neighbor / interface', d: 'PIM-соседи и интерфейсы', hw: 'display pim neighbor', jn: 'show pim neighbors' },
    { c: 'show ip pim rp mapping', d: 'Какой RP для каких групп (и откуда узнан)', hw: 'display pim rp-info', jn: 'show pim rps' },
    { c: 'show ip igmp groups [detail]', d: 'Подписки IGMP на интерфейсах', hw: 'display igmp group', jn: 'show igmp group' },
    { c: 'mtrace SRC DST G', d: 'Трассировка мультикаст-дерева', hw: 'mtrace', jn: 'mtrace' }
  ],
  cards: [
    ['Почему unicast не подходит для IPTV?', 'Копия на каждого зрителя от источника: 10 000 × 8 Мбит/с = 80 Гбит/с. Мультикаст — одна копия на линк, размножение в точках ветвления.'],
    ['Диапазоны 224.0.0.0/24, 232/8, 239/8?', '224.0.0.0/24 — link-local (не маршрутизируется). 232/8 — SSM. 239/8 — administratively scoped (частный мультикаст).'],
    ['Как IP-группа отображается в MAC и в чём подвох?', '01:00:5E + 0 + младшие 23 бита IP. 5 бит теряются, поэтому 32 группы делят один MAC.'],
    ['IGMPv2 vs IGMPv3?', 'v2: join/leave по группе, querier. v3: подписка на (S,G) — INCLUDE/EXCLUDE источников, нужна для SSM.'],
    ['Что делает IGMP querier и что будет без него?', 'Периодически шлёт General Query (224.0.0.1), хосты подтверждают подписки. Без querier подписки истекают, snooping удаляет записи, поток пропадает через несколько минут.'],
    ['Что такое IGMP snooping?', 'Коммутатор подслушивает IGMP и шлёт поток группы только в порты подписчиков и к маршрутизатору (mrouter port), а не во все порты VLAN.'],
    ['Что такое fast/immediate leave и зачем IPTV?', 'Остановить поток сразу по Leave без group-specific query. Ускоряет переключение каналов, но только если за портом один получатель.'],
    ['Что такое MVR?', 'Multicast VLAN Registration: IPTV-потоки в одном мультикаст-VLAN, коммутатор копирует нужные группы в абонентские порты/VLAN по IGMP. Один поток на кольцо вместо копии в каждый абонентский VLAN.'],
    ['Правило RPF?', 'Мультикаст-пакет от S принимается, только если пришёл на интерфейс, через который unicast-маршрут ведёт к S. Иначе drop. Защита от петель.'],
    ['Почему мультикаст «ломается» при асимметрии unicast?', 'RPF смотрит на unicast-маршрут к источнику. Если он через интерфейс без PIM или не тот, куда пришёл поток, получаем RPF failure, и дерево не строится или пакеты отбрасываются.'],
    ['Почему PIM «Protocol Independent»?', 'Не строит свою таблицу маршрутов: для RPF использует любую unicast-таблицу (OSPF, IS-IS, BGP, статика, MBGP).'],
    ['PIM-DM vs PIM-SM?', 'DM: залить всю сеть и подрезать (prune) лишнее, периодически повторять. SM: только по явному join, через RP. Провайдеры используют SM/SSM.'],
    ['Что такое RP и shared tree (*,G)?', 'Rendezvous Point — точка встречи источников и получателей. LHR шлёт (*,G) join к RP, дерево от RP к получателям — RPT.'],
    ['Как источник попадает в дерево в PIM-SM?', 'FHR заворачивает пакеты в unicast PIM Register к RP. RP разворачивает и шлёт (S,G) join к источнику. Когда пошёл нативный поток — Register-Stop.'],
    ['Что такое переход на SPT?', 'LHR, узнав источник, строит (S,G) shortest path tree прямо к нему и отсекает поток от RP. На Cisco сразу после первого пакета (spt-threshold 0).'],
    ['Что такое SSM и почему он удобен для IPTV?', 'Source-Specific Multicast: получатель подписывается на (S,G) по IGMPv3, сразу строится SPT, RP не нужен. Меньше состояний и точек отказа, источник известен заранее.'],
    ['Что такое SSM mapping?', 'Для приставок с IGMPv2: маршрутизатор подставляет источник по таблице «группа → источник» и строит (S,G) как для SSM.'],
    ['Anycast RP — как работает?', 'Несколько RP с одинаковым адресом, каждый маршрутизатор идёт к ближайшему. RP обмениваются информацией об источниках через MSDP (или PIM Anycast RP).'],
    ['Флаги в show ip mroute: C, J, T, P, F?', 'C — connected-получатель, J — join SPT, T — трафик идёт по SPT, P — pruned (OIL пуст), F — зарегистрированный локальный источник.'],
    ['«Картинка рассыпается» у абонентов IPTV — что это физически?', 'Потери UDP-пакетов MPEG-TS (нет повторов): перегрузка линка или микробёрсты, ошибки на линии, неправильный QoS, дубли при перестроении дерева.']
  ],
  quiz: [
    { q: 'Какие группы попадут на один MAC с 239.1.1.1?', o: ['Только 239.1.1.1', '224.1.1.1 и 239.129.1.1 (и ещё 29)', '239.1.1.2', 'Никакие'], a: 1, e: '23 младших бита совпадают: 1.1.1 и 129.1.1 (старший бит второго октета теряется), и разные первые октеты 224–239.' },
    { q: 'Канал у абонентов пропадает ровно через ~4 минуты после включения, а в VLAN нет маршрутизатора (L2-сегмент с snooping). Причина?', o: ['RPF', 'Нет IGMP querier: подписки истекают, snooping удаляет порты', 'Нет RP', 'MTU'], a: 1, e: 'Без query хосты не обновляют reports. Нужен ip igmp snooping querier.' },
    { q: 'Поток от источника 10.0.0.10 приходит на R3 через Gi0/2, а show ip rpf 10.0.0.10 показывает Gi0/1. Что будет?', o: ['Пакеты будут переданы', 'RPF failure — пакеты, пришедшие через Gi0/2, отброшены', 'R3 перестроит unicast', 'Пакеты уйдут к RP'], a: 1, e: 'Принимается только с RPF-интерфейса.' },
    { q: 'PIM включён на всех линках, кроме R2–R3. Unicast-путь к источнику от R3 идёт через R2. Что увидим на R3?', o: ['Всё работает через другой линк', 'RPF-интерфейс без PIM-соседа: (S,G) не строится или incoming = Null', 'R3 станет RP', 'Будет dense mode'], a: 1, e: 'Мультикаст следует unicast-маршруту к источнику. На RPF-интерфейсе обязателен PIM. Решения: PIM на линке или ip mroute.' },
    { q: 'Зачем LHR переходит с shared tree на SPT?', o: ['Чтобы найти RP', 'Чтобы получать поток кратчайшим путём от источника, а не через RP', 'Для IGMPv3', 'Чтобы уменьшить TTL'], a: 1, e: 'RP может быть далеко: SPT — оптимальный путь, разгружает RP.' },
    { q: 'Что делает FHR, когда локальный источник начал вещать в PIM-SM?', o: ['Шлёт IGMP report', 'Заворачивает пакеты в PIM Register и шлёт unicast на RP', 'Флудит во все интерфейсы', 'Шлёт (*,G) prune'], a: 1, e: 'Регистрация источника на RP. Потом Register-Stop, когда пойдёт нативный поток.' },
    { q: 'Почему для IPTV провайдеры любят SSM? (несколько)', o: ['Не нужен RP — нет единой точки отказа и регистрации', 'Сразу SPT, меньше состояний и быстрее join', 'Источник (головная станция) известен заранее', 'SSM не использует RPF'], a: [0, 1, 2], e: 'RPF работает и в SSM: дерево строится по unicast-маршруту к источнику.' },
    { q: 'В show ip mroute для (S,G) флаг P и пустой OIL. Что это значит?', o: ['Поток идёт всем', 'Дерево отрезано (pruned): нет нижестоящих получателей', 'Ошибка RPF', 'Нет RP'], a: 1, e: 'P — pruned. Нормально, если подписчиков нет.' },
    { q: 'У абонентов «рассыпается» картинка на всех каналах в часы пик. Что первое проверить?', o: ['IGMP version', 'Перегрузку и output drops на линках по пути (и QoS-класс IPTV)', 'RP', 'MAC-адреса групп'], a: 1, e: 'Потери UDP — артефакты. В часы пик это загрузка и дропы.' },
    { q: 'Старые приставки умеют только IGMPv2, а ядро — PIM-SSM. Что поможет?', o: ['Dense mode', 'SSM mapping на маршрутизаторе доступа', 'BSR', 'MSDP'], a: 1, e: 'Маршрутизатор подставит источник для группы и отправит (S,G) join.' },
    { q: 'Без IGMP snooping коммутатор получил мультикаст-поток 8 Мбит/с. Что с ним сделает?', o: ['Отбросит', 'Отправит во все порты VLAN', 'Только к маршрутизатору', 'Только подписчикам'], a: 1, e: 'Мультикаст без snooping флудится как broadcast.' },
    { q: 'Как называется механизм, где несколько RP имеют одинаковый адрес и синхронизируют источники?', o: ['BSR', 'Auto-RP', 'Anycast RP + MSDP', 'SSM'], a: 2, e: 'Anycast RP даёт резерв и балансировку, MSDP (или PIM Anycast RP) — обмен информацией об активных источниках.' }
  ],
  und: [
    { q: 'Объясни, что такое RPF, зачем он нужен и как из-за него ломается мультикаст при изменениях unicast-маршрутизации.', a: '<p>В мультикасте нет адреса назначения, по которому можно маршрутизировать, а копирование в несколько интерфейсов легко зацикливает трафик. RPF решает это: маршрутизатор принимает поток от S только с того интерфейса, через который сам отправил бы unicast к S. Так дерево строится по кратчайшим путям от источника и копии с других направлений отбрасываются. Ломается так: мультикаст полностью зависит от unicast-таблицы. Если поменять метрики, добавить статику, ECMP или туннель, RPF-интерфейс может оказаться без PIM или не тем, откуда реально идёт поток: RPF failure, дерево не строится или пакеты отбрасываются. Решения: PIM на всех интерфейсах, по которым может пойти unicast, или отдельная RPF-таблица (ip mroute, MBGP).</p>', k: ['адрес назначения — группа', 'проверка по пути к источнику', 'защита от петель', 'зависимость от unicast', 'mroute/MBGP'] },
    { q: 'Расскажи по шагам, что происходит в PIM-SM, когда абонент включает канал, а источник уже вещает.', a: '<p>Приставка шлёт IGMP Report. LHR создаёт (*,G) и шлёт (*,G) Join по RPF к RP: строится shared tree от RP. Источник уже зарегистрирован: FHR слал Register, RP построил (S,G) к источнику, поток идёт до RP нативно. RP пускает поток вниз по shared tree, первые пакеты доходят до LHR. LHR узнаёт S и отправляет (S,G) Join по RPF к источнику: строится SPT. Когда поток пошёл по SPT, LHR отправляет к RP prune (S,G,RPT), чтобы не получать дубли. Абонент смотрит канал по кратчайшему пути. В SSM всё короче: IGMPv3 (S,G) → сразу (S,G) Join к источнику.</p>', k: ['IGMP Report', '(*,G) Join к RP', 'регистрация источника на RP', 'SPT switchover', 'prune с RPT', 'SSM короче'] },
    { q: 'Ты дежурный, жалоба: «у всего района не показывает канал 239.1.1.10, остальные каналы работают». Твой план поиска.', a: '<p>1) Есть ли поток у источника (головная станция, FHR: <code>show ip mroute 239.1.1.10</code>, счётчики). 2) Идти от источника вниз или от агрегации района вверх: на каждом маршрутизаторе <code>show ip mroute S G</code> — есть ли (S,G), совпадает ли incoming interface с <code>show ip rpf S</code>, растут ли счётчики (<code>show ip mroute count</code>), есть ли нужный интерфейс в OIL. 3) Там, где поток пропадает: PIM-сосед на RPF-интерфейсе, RPF failure, ACL или фильтр групп (multicast boundary), для SM — RP-mapping для этой группы. 4) На агрегации: есть ли IGMP-подписки от района (<code>show ip igmp groups</code>), не стоит ли фильтр или профиль, исключающий канал. Раз другие каналы работают, проблема специфична для группы или источника: фильтр, RP для диапазона, другой источник (резервная станция).</p>', k: ['проверить источник', 'идти по дереву: (S,G), IIF vs RPF, счётчики, OIL', 'PIM-соседство и RPF', 'фильтры групп, RP mapping', 'IGMP на агрегации'] }
  ],
  lab: {
    title: 'Лаба 9. IPTV «Лифт ми Ап ТВ»: PIM-SM, SPT, SSM и RPF',
    time: '≈ 3 часа',
    goal: `<p>Головная станция (SRC) вещает каналы в группы 239.1.1.x. Ядро из четырёх маршрутизаторов с OSPF, RP на R2, два «района» с получателями (RCV1, RCV2 — маршрутизаторы в роли приставок). Построить дерево, увидеть RPT и SPT, поймать RPF failure, перейти на SSM.</p>`,
    topo: {
      w: 880, h: 420,
      nodes: [
        { id: 'SRC', t: 'router', x: 70, y: 210, label: 'SRC головная\n10.0.0.10', role: 'источник (vIOS: ping в группу)', color: '#b45309' },
        { id: 'R1', t: 'router', x: 230, y: 210, label: 'R1 (FHR)\nLo0 10.255.0.1', role: 'first-hop router' },
        { id: 'R2', t: 'router', x: 430, y: 90, label: 'R2 (RP)\nLo0 10.255.0.2', role: 'rendezvous point' },
        { id: 'R4', t: 'router', x: 430, y: 330, label: 'R4\nLo0 10.255.0.4', role: 'ядро' },
        { id: 'R3', t: 'router', x: 640, y: 210, label: 'R3 (LHR)\nLo0 10.255.0.3', role: 'агрегация района' },
        { id: 'RCV1', t: 'router', x: 820, y: 130, label: 'RCV1\n«приставка» 10.3.1.10', role: 'получатель (ip igmp join-group)', color: '#475569' },
        { id: 'RCV2', t: 'router', x: 820, y: 300, label: 'RCV2\n«приставка» 10.3.2.10', role: 'получатель', color: '#475569' }
      ],
      links: [['SRC', 'Gi0/0', 'R1', 'Gi0/0', '10.0.0.0/24'], ['R1', 'Gi0/1', 'R2', 'Gi0/1'], ['R1', 'Gi0/2', 'R4', 'Gi0/2'], ['R2', 'Gi0/2', 'R3', 'Gi0/2'], ['R4', 'Gi0/3', 'R3', 'Gi0/3'], ['R3', 'Gi0/0', 'RCV1', 'Gi0/0', '10.3.1.0/24'], ['R3', 'Gi0/1', 'RCV2', 'Gi0/0', '10.3.2.0/24']]
    },
    addr: [['Линки ядра', 'Rx–Ry', '10.1.xy.0/31'], ['SRC', 'Gi0/0', '10.0.0.10/24, gw .1'], ['RCV1 / RCV2', 'Gi0/0', '10.3.1.10 / 10.3.2.10, gw .1'], ['Каналы', 'группы', '239.1.1.1–5 (SM), 232.1.1.1 (SSM)']],
    init: (function () {
      const b = n => `hostname R${n}\nno ip domain-lookup\ninterface Loopback0\n ip address 10.255.0.${n} 255.255.255.255\n ip ospf 1 area 0\nrouter ospf 1\n router-id 10.255.0.${n}\nline con 0\n logging synchronous\n exec-timeout 0 0\n`;
      const i = (ifc, ip, m) => `interface ${ifc}\n ip address ${ip} ${m || '255.255.255.254'}\n ip ospf 1 area 0\n ip ospf network point-to-point\n no shutdown\n`;
      const lan = (ifc, ip) => `interface ${ifc}\n ip address ${ip} 255.255.255.0\n ip ospf 1 area 0\n no shutdown\n`;
      return {
        R1: b(1) + lan('Gi0/0', '10.0.0.1') + i('Gi0/1', '10.1.12.0') + i('Gi0/2', '10.1.14.0'),
        R2: b(2) + i('Gi0/1', '10.1.12.1') + i('Gi0/2', '10.1.23.0'),
        R3: b(3) + i('Gi0/2', '10.1.23.1') + i('Gi0/3', '10.1.34.1') + lan('Gi0/0', '10.3.1.1') + lan('Gi0/1', '10.3.2.1'),
        R4: b(4) + i('Gi0/2', '10.1.14.1') + i('Gi0/3', '10.1.34.0'),
        SRC: 'hostname SRC\nno ip domain-lookup\ninterface Gi0/0\n ip address 10.0.0.10 255.255.255.0\n no shutdown\nip route 0.0.0.0 0.0.0.0 10.0.0.1\nline con 0\n logging synchronous\n exec-timeout 0 0',
        RCV1: 'hostname RCV1\nno ip domain-lookup\nno ip routing\ninterface Gi0/0\n ip address 10.3.1.10 255.255.255.0\n no shutdown\nip default-gateway 10.3.1.1\nline con 0\n logging synchronous\n exec-timeout 0 0',
        RCV2: 'hostname RCV2\nno ip domain-lookup\nno ip routing\ninterface Gi0/0\n ip address 10.3.2.10 255.255.255.0\n no shutdown\nip default-gateway 10.3.2.1\nline con 0\n logging synchronous\n exec-timeout 0 0'
      };
    })(),
    pre: 'OSPF уже работает. SRC и RCV — маршрутизаторы vIOS в роли хостов (<code>no ip routing</code> на RCV). «Вещание» — это <code>ping 239.1.1.1 repeat 100000</code> с SRC: ответы от «приставок» покажут, что поток дошёл. Метрики OSPF равные, поэтому путь R1→R3 может идти через R2 или R4 (ECMP). Это пригодится для RPF.',
    tasks: [
      { t: 'Мультикаст-маршрутизация и PIM-SM', d: 'На R1–R4: <code>ip multicast-routing</code>, <code>ip pim sparse-mode</code> на всех интерфейсах (включая LAN и Lo0), статический RP = 10.255.0.2. Проверь PIM-соседей и RP mapping.',
        check: 'R3#show ip pim neighbor\nR3#show ip pim interface\nR3#show ip pim rp mapping',
        sol: 'R1(config)#ip multicast-routing\nR1(config)#ip pim rp-address 10.255.0.2\nR1(config)#interface range Gi0/0 - 2 , Lo0\nR1(config-if-range)#ip pim sparse-mode\n! на vIOS иногда: ip multicast-routing distributed не нужен; так же R2–R4' },
      { t: 'Подписка и shared tree', d: 'На RCV1: <code>interface Gi0/0</code> → <code>ip igmp join-group 239.1.1.1</code>. На R3 посмотри IGMP-группы и (*,G). На R2 (RP) посмотри (*,G): какой OIL? Есть ли что-то на R1 и R4?',
        check: 'R3#show ip igmp groups\nR3#show ip mroute 239.1.1.1\nR2#show ip mroute 239.1.1.1\nR1#show ip mroute 239.1.1.1' },
      { t: 'Источник, регистрация и SPT', d: 'С SRC: <code>ping 239.1.1.1 repeat 1000</code>. Отвечает RCV1? Посмотри на R1 (флаг F, Register), R2 и R3: какие (S,G) появились, по какому пути идёт поток после перехода на SPT (флаг T)? Совпадает ли путь SPT с unicast-путём R3 → 10.0.0.10?',
        check: 'R3#show ip mroute 239.1.1.1 10.0.0.10\nR3#show ip rpf 10.0.0.10\nR1#show ip mroute 239.1.1.1\nR2#show ip mroute 239.1.1.1\nR3#show ip mroute count' },
      { t: 'Второй район и ветвление', d: 'На RCV2 подпишись на ту же группу. Где теперь копируется поток (на каком маршрутизаторе OIL содержит два интерфейса)? Подпиши RCV2 на 239.1.1.2, а с SRC «вещай» в оба канала. Сколько (S,G) на R3?',
        check: 'R3#show ip mroute 239.1.1.1\nR3#show ip mroute summary' },
      { t: 'Поймай RPF failure', d: 'На R3 выключи PIM на интерфейсе, через который идёт unicast к 10.0.0.10 (по <code>show ip rpf</code>), но <b>оставь OSPF</b>. Что происходит с потоком и с записью (S,G)? Затем верни PIM и вместо этого заставь RPF идти другим путём статическим mroute: <code>ip mroute 10.0.0.0 255.255.255.0 10.1.34.0</code>. Объясни, что изменилось.',
        check: 'R3#show ip rpf 10.0.0.10\nR3#show ip mroute 239.1.1.1\nR3#show ip mroute count | include RPF' },
      { t: 'SSM для «Лифт ми Ап ТВ»', d: 'Включи <code>ip pim ssm default</code> на R1–R4 и IGMPv3 на LAN-интерфейсах R3. На RCV1 подпишись на (10.0.0.10, 232.1.1.1): <code>ip igmp join-group 232.1.1.1 source 10.0.0.10</code> (нужен <code>ip igmp version 3</code> на RCV1 Gi0/0). Вещай в 232.1.1.1. Сравни таблицу mroute с SM: есть ли (*,G)? Нужен ли RP?',
        check: 'R3#show ip igmp groups 232.1.1.1 detail\nR3#show ip mroute 232.1.1.1\nR2#show ip mroute 232.1.1.1',
        sol: 'R3(config)#ip pim ssm default\nR3(config)#interface range Gi0/0 - 1\nR3(config-if-range)#ip igmp version 3\nRCV1(config)#interface Gi0/0\nRCV1(config-if)#ip igmp version 3\nRCV1(config-if)#ip igmp join-group 232.1.1.1 source 10.0.0.10' },
      { t: 'SSM mapping для старой приставки', d: 'RCV2 умеет только IGMPv2 (<code>ip igmp version 2</code>, join 232.1.1.1 без source). Сделай на R3 SSM mapping: 232.1.1.0/24 → источник 10.0.0.10 (статически). Проверь, что RCV2 получает поток.',
        check: 'R3#show ip igmp ssm-mapping 232.1.1.1\nR3#show ip mroute 232.1.1.1',
        sol: 'R3(config)#ip igmp ssm-map enable\nR3(config)#no ip igmp ssm-map query dns\nR3(config)#access-list 32 permit 232.1.1.0 0.0.0.255\nR3(config)#ip igmp ssm-map static 32 10.0.0.10' }
    ],
    brk: [
      { t: 'Канал 239.1.1.1 не доходит ни до кого, PIM-соседи в порядке', inj: 'R3(config)#no ip pim rp-address 10.255.0.2\nR3(config)#ip pim rp-address 10.255.0.4', h: '<code>show ip pim rp mapping</code> на всех. Один ли RP у всех маршрутизаторов?', f: 'У R3 другой RP (R4), чем у остальных (R2): (*,G) join уходит на R4, а источник регистрируется на R2. Встречи нет. RP для группы должен быть одинаковым везде (или anycast RP с MSDP).' },
      { t: 'После «оптимизации метрик» поток идёт рывками, в счётчиках растёт RPF failed', inj: 'R3(config)#interface Gi0/3\nR3(config-if)#no ip pim sparse-mode\n! и на R3: ip ospf cost 1 на Gi0/3, ip ospf cost 100 на Gi0/2', h: '<code>show ip rpf 10.0.0.10</code> на R3: RPF-интерфейс? Есть ли на нём PIM? <code>show ip mroute count</code>.', f: 'Unicast к источнику пошёл через Gi0/3, где PIM выключен. RPF указывает на интерфейс без PIM, поток по-прежнему приходит через Gi0/2 и отбрасывается RPF-проверкой. PIM должен быть на всех интерфейсах, куда может пойти unicast (или ip mroute).' },
      { t: 'RCV2 не получает канал, RCV1 получает', inj: 'R3(config)#ip access-list standard ALLOW-TV\nR3(config-std-nacl)#permit 239.1.1.1\nR3(config)#interface Gi0/1\nR3(config-if)#ip igmp access-group ALLOW-TV', h: '<code>show ip igmp groups</code> на R3 — есть ли подписка от RCV2 на нужную группу? <code>show ip igmp interface Gi0/1</code>.', f: 'На интерфейсе к RCV2 висит IGMP-фильтр, разрешающий только 239.1.1.1. Подписки на другие группы отбрасываются. У провайдера так реализуются пакеты каналов: проверь, что фильтр соответствует тарифу.' }
    ],
    extra: '<p><b>Anycast RP + MSDP.</b> Сделай Loopback1 10.255.255.1/32 на R2 и R4 (одинаковый, в OSPF), RP = 10.255.255.1 везде, MSDP-пиринг R2 ↔ R4 по Lo0 (<code>ip msdp peer … connect-source Lo0</code>, <code>ip msdp originator-id Lo0</code>). Выключи R2 и посмотри, как дерево переезжает на R4 без перенастройки остальных маршрутизаторов.</p>'
  }
});
