COURSE.add({
  id: 'ch01',
  time: '≈ 3–4 часа',
  intro: `<p>Базу ты знаешь, поэтому глава не про «что такое консоль», а про то, как <b>работают с железом в проде</b>. Правильно заходишь на устройство, не теряешь доступ при изменениях, читаешь состояние интерфейса за 10 секунд, оставляешь после себя чистую и безопасную конфигурацию. У провайдера в одной ошибке на VTY или в незакоммиченном изменении — потерянный узел в 300 км от тебя и выезд инженера.</p>`,
  goals: [
    'Объяснить, чем in-band отличается от out-of-band управления и почему у провайдера есть отдельная сеть управления',
    'Свободно двигаться по режимам IOS, фильтровать выводы (<code>| include / section / begin</code>) и работать без мыши',
    'Настроить SSHv2, локальных пользователей, AAA, уровни привилегий и защиту VTY по шаблону провайдера',
    'Безопасно вносить изменения: <code>reload in</code>, <code>archive</code> / <code>configure replace</code>, <code>commit confirmed</code> в Junos',
    'По <code>show interfaces</code> отличить проблему L1 от L2 и увидеть CRC, ошибки дуплекса и дропы',
    'Собрать базовую «гигиену» устройства: NTP, syslog, баннер, таймауты, логирование'
  ],
  why: `Первые 5 минут любого инцидента — это вход на устройство и чтение его состояния. Тот, кто быстро фильтрует вывод и читает счётчики интерфейса, находит проблему раньше всех. А тот, кто знает про <code>reload in</code> и <code>commit confirmed</code>, не кладёт удалённый узел своими руками.`,
  refs: [
    { t: 'Cisco IOS Configuration Fundamentals Configuration Guide', u: 'https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/fundamentals/configuration/15mt/fundamentals-15-mt-book.html', n: 'режимы CLI, файлы конфигурации, archive' },
    { t: 'Cisco Guide to Harden Cisco IOS Devices', u: 'https://www.cisco.com/c/en/us/support/docs/ip/access-lists/13608-21.html', n: 'эталонный документ по защите management plane' },
    { t: 'Wendell Odom, CCNA 200-301 Official Cert Guide, Vol. 1', n: 'гл. 4–6: CLI, базовая настройка, защита доступа' },
    { t: 'Juniper Day One: Exploring the Junos CLI', u: 'https://www.juniper.net/documentation/en_US/day-one-books/DO_ExploringJunosCLI_v2.pdf', n: 'бесплатная книга: candidate config, commit, rollback' },
    { t: 'RFC 4253 — SSH Transport Layer Protocol', u: 'https://www.rfc-editor.org/rfc/rfc4253' }
  ],
  theory: [
    {
      id: 'access', h: 'Как добираются до устройства: in-band и out-of-band',
      html: `
<p>Есть два принципиально разных пути к устройству:</p>
<div class="vs"><div><b>In-band</b><br>Управление идёт <i>через ту же сеть</i>, которую устройство обслуживает: SSH на loopback или на интерфейс. Удобно и дёшево. Но если сломалась маршрутизация или ты сам выключил не тот интерфейс, доступа нет.</div>
<div><b>Out-of-band (OOB)</b><br>Отдельный путь, не зависящий от рабочей сети: консольный порт через <b>терминальный сервер</b> (Opengear, Cisco 2900 с async-модулем), отдельный порт Mgmt0 в отдельную сеть управления, иногда LTE-модем. Это «спасательный круг» на случай, когда in-band умер.</div></div>
<div class="callout pro"><b>Как это устроено у провайдера</b>В ядре и на агрегации почти всегда есть OOB: консоли заведены в терминальный сервер на узле связи, а сам он доступен через отдельный канал. Инженер заходит на <b>jump host</b> (бастион), оттуда по SSH на оборудование, а аутентификацию проверяет сервер <b>TACACS+</b> (или RADIUS). Каждая команда пишется в аккаунтинг: кто, когда и что ввёл. Поэтому «зайти под общим admin» в нормальной сети нельзя.</div>
<h3>Консоль</h3>
<p>Консоль — это последовательный порт (RJ-45 или USB, на старом железе DB-9), обычные параметры <b>9600 8N1, без управления потоком</b>. На консоли работает всё, даже когда IP-стек не поднят: загрузка, ROMMON, восстановление пароля. В EVE-NG консоль каждого узла — это telnet на порт хоста EVE (32769 и дальше), клиент открывается кликом по узлу.</p>
<h3>VTY</h3>
<p><b>VTY</b> (virtual teletype) — виртуальные линии для удалённого входа по Telnet и SSH. На IOS обычно 5 линий (<code>line vty 0 4</code>), на многих платформах 16 (<code>0 15</code>). Каждая сессия занимает одну линию. Если все линии заняты зависшими сессиями, новых входов не будет. Поэтому ставят <code>exec-timeout</code>, а занятые линии смотрят и сбрасывают через <code>show users</code> и <code>clear line vty N</code>.</p>
<pre class="cli">R1#show users
    Line       User       Host(s)              Idle       Location
*  0 con 0                idle                 00:00:00
 [[866 vty 0     admin      idle                 01:12:40 10.0.0.5]]
R1#clear line vty 0
[confirm]
 [OK]</pre>`
    },
    {
      id: 'cli', h: 'CLI как инструмент: режимы, помощь, фильтры',
      html: `
<p>Режимы IOS ты знаешь: <code>&gt;</code> пользовательский, <code>#</code> привилегированный, <code>(config)#</code> глобальная конфигурация, ниже подрежимы <code>(config-if)</code>, <code>(config-line)</code>, <code>(config-router)</code>. Важнее другое: как быстро получить из устройства <b>ровно ту информацию, которая нужна</b>.</p>
<h3>Фильтры вывода — главный навык</h3>
<table><tr><th>Фильтр</th><th>Что делает</th><th>Пример</th></tr>
<tr><td><code>| include X</code></td><td>только строки, где есть X (регулярное выражение)</td><td><code>show ip int brief | include up</code></td></tr>
<tr><td><code>| exclude X</code></td><td>все строки, кроме строк с X</td><td><code>show ip int brief | exclude unassigned</code></td></tr>
<tr><td><code>| begin X</code></td><td>вывод с первой строки, где есть X</td><td><code>show run | begin line vty</code></td></tr>
<tr><td><code>| section X</code></td><td>целые блоки конфигурации, где есть X</td><td><code>show run | section router ospf</code></td></tr>
<tr><td><code>| count X</code></td><td>сколько строк совпало</td><td><code>show ip route | count ^O</code></td></tr></table>
<p>Регулярки делают фильтры сильнее: <code>include ^interface|ip address</code> покажет интерфейсы и их адреса, <code>include Gi0/[0-2] </code> — диапазон портов.</p>
<pre class="cli">R1#show running-config | include ^interface|ip address
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
interface GigabitEthernet0/1
 no ip address
R1#show interfaces | include line protocol|CRC
GigabitEthernet0/0 is up, line protocol is up
     0 input errors, [[0 CRC]], 0 frame, 0 overrun, 0 ignored
GigabitEthernet0/1 is administratively down, line protocol is down
     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored</pre>
<h3>Приёмы, которые экономят часы</h3>
<ul>
<li><code>terminal length 0</code> — убрать постраничный вывод (--More--). Нужно, когда копируешь вывод в тикет или работаешь скриптом.</li>
<li><code>do show ...</code> — show-команда, не выходя из режима конфигурации.</li>
<li><code>logging synchronous</code> на линии: сообщения syslog не разрывают набираемую команду.</li>
<li><code>no ip domain-lookup</code>: опечатка в команде не превращается в 30 секунд попыток найти хост через DNS. Остановить такую попытку можно через <span class="kbd">Ctrl+Shift+6</span>.</li>
<li><code>show history</code>, <span class="kbd">↑</span>, <span class="kbd">Ctrl+R</span> — повтор и поиск команд; <span class="kbd">Tab</span> и <span class="kbd">?</span> — дополнение и подсказка.</li>
<li><code>default interface Gi0/1</code> — вернуть интерфейсу заводскую конфигурацию одной командой.</li>
</ul>
<div class="callout info"><b>Три CLI, которые встретятся у провайдера</b>
<table><tr><th></th><th>Cisco IOS</th><th>Huawei VRP</th><th>Juniper Junos</th></tr>
<tr><td>Просмотр</td><td><code>show</code></td><td><code>display</code></td><td><code>show</code> (оперативный режим <code>&gt;</code>)</td></tr>
<tr><td>Войти в конфиг</td><td><code>configure terminal</code></td><td><code>system-view</code></td><td><code>configure</code> (режим <code>#</code>)</td></tr>
<tr><td>Когда применяется</td><td>сразу после Enter</td><td>сразу (на части платформ — по <code>commit</code>)</td><td>только после <code>commit</code></td></tr>
<tr><td>Сохранить</td><td><code>write memory</code></td><td><code>save</code></td><td>сохраняется при <code>commit</code></td></tr>
<tr><td>Откат</td><td><code>configure replace</code></td><td><code>rollback configuration</code></td><td><code>rollback N</code> + <code>commit</code></td></tr>
<tr><td>Фильтр</td><td><code>| include</code></td><td><code>| include</code></td><td><code>| match</code>, <code>| except</code></td></tr></table></div>`
    },
    {
      id: 'configs', h: 'Конфигурации и безопасные изменения',
      html: `
<p>В IOS две конфигурации: <b>running-config</b> живёт в RAM и действует прямо сейчас, <b>startup-config</b> лежит в NVRAM и читается при загрузке. Каждая команда сразу меняет running. Пока ты не сохранил, перезагрузка вернёт старое состояние. Отсюда опасность и спасение одновременно.</p>
<h3>Правило: удалённое изменение, которое может отрезать доступ, — только с таймером отката</h3>
<p>Ты меняешь ACL на VTY, маршрут по умолчанию или адрес интерфейса, через который сам подключён. Если ошибёшься, доступ пропадёт. Порядок такой:</p>
<ol class="steps">
<li><code>copy running-config flash:backup-0510.cfg</code> — снимок «как было».</li>
<li><code>reload in 10</code> — через 10 минут устройство перезагрузится в startup-config, то есть в последнее сохранённое состояние.</li>
<li>Вносишь изменение и проверяешь, что доступ есть и всё работает.</li>
<li><code>reload cancel</code>, затем <code>write memory</code>.</li></ol>
<p>Перезагрузка — грубый откат, на ядре сети её не используют. Современный вариант для IOS — <b>archive и configure replace</b>:</p>
<pre class="cli">R1(config)#archive
R1(config-archive)#path flash:arch
R1(config-archive)#write-memory          ! снимок при каждом write memory
R1(config-archive)#time-period 1440
R1#configure terminal revert timer 10      ! аналог commit confirmed: через 10 мин откатит
R1(config)#... изменения ...
R1#configure confirm                     ! всё хорошо, откат отменён
R1#configure replace flash:arch-1 list   ! вернуть конфиг из архива без перезагрузки</pre>
<p>В Junos это встроено: изменения копятся в <b>candidate config</b> и применяются только по <code>commit</code>. <code>commit confirmed 5</code> применит их, но откатит через 5 минут, если не подтвердить вторым <code>commit</code>. <code>show | compare</code> покажет diff до коммита, <code>rollback 1</code> вернёт предыдущую версию (их хранится 50).</p>
<div class="callout pro"><b>Регламент изменений</b>У провайдера изменения в проде идут по заявке (change request): что меняем, план проверки, план отката, окно работ (обычно ночью). Привычка «снимок → таймер отката → изменение → проверка → подтверждение» — признак хорошего инженера, его видно с первой смены.</div>
<h3>Где что лежит</h3>
<ul><li><code>show flash:</code> / <code>dir</code> — файловая система: образы IOS, бэкапы конфигов.</li>
<li><code>show version</code> — версия ПО, аптайм, причина последней перезагрузки (<i>System returned to ROM by…</i>), <b>config register</b>.</li>
<li><code>show inventory</code> — серийники, модули, трансиверы (нужны для заявки на замену).</li>
<li><code>show archive</code> — список снимков конфигурации.</li></ul>`
    },
    {
      id: 'sec', h: 'Защита доступа: пароли, AAA, SSH, VTY',
      html: `
<h3>Типы паролей в IOS — что реально защищено</h3>
<table><tr><th>Тип</th><th>Как получается</th><th>Стойкость</th></tr>
<tr><td>0</td><td>открытый текст (<code>password cisco</code>)</td><td>никакой</td></tr>
<tr><td>7</td><td><code>service password-encryption</code></td><td><b>обратимое шифрование</b>, расшифровывается за секунду; защищает только от взгляда через плечо</td></tr>
<tr><td>5</td><td><code>enable secret</code>, <code>username … secret</code> (MD5)</td><td>устарел</td></tr>
<tr><td>8 / 9</td><td><code>algorithm-type sha256 / scrypt</code></td><td>современный вариант</td></tr></table>
<pre class="cli">R1(config)#enable algorithm-type scrypt secret Str0ngEn@ble
R1(config)#username admin privilege 15 algorithm-type scrypt secret Adm1nP@ss
R1(config)#service password-encryption       ! прячет оставшиеся type 0 как type 7</pre>
<h3>AAA</h3>
<p><b>AAA</b> — Authentication (кто ты), Authorization (что тебе можно), Accounting (что ты делал). <code>aaa new-model</code> включает новую модель. С этого момента вход на линии идёт по спискам методов. Типичная провайдерская схема: сначала TACACS+, а если сервер недоступен — локальная база (аварийный вход).</p>
<pre class="cli">R1(config)#aaa new-model
R1(config)#aaa authentication login default group tacacs+ local
R1(config)#aaa authorization exec default group tacacs+ local if-authenticated
R1(config)#aaa accounting commands 15 default start-stop group tacacs+
! в лабе без сервера:
R1(config)#aaa authentication login default local</pre>
<div class="callout warn"><b>Ловушка aaa new-model</b>После <code>aaa new-model</code> без настроенных списков методов VTY требует логин из локальной базы. Если локального пользователя нет, ты не войдёшь. Сначала создай пользователя, потом включай AAA, и только со страховкой <code>reload in</code>.</div>
<h3>Уровни привилегий</h3>
<p>Их 16, от 0 до 15. По умолчанию используются 1 (<code>&gt;</code>) и 15 (<code>#</code>). Промежуточные позволяют дать, например, дежурному NOC только show-команды без доступа к конфигурации:</p>
<pre class="cli">R1(config)#privilege exec level 5 show running-config
R1(config)#privilege exec level 5 clear counters
R1(config)#username noc privilege 5 secret N0cN0c
R1#show privilege
Current privilege level is 15</pre>
<p>В реальной сети это делают через авторизацию команд на TACACS+, локальные уровни нужны для понимания механизма.</p>
<h3>SSH вместо Telnet</h3>
<p>Telnet передаёт всё, включая пароль, открытым текстом. SSHv2 шифрует сессию. Для SSH на IOS нужны hostname, domain-name (из них строится имя ключа) и пара RSA-ключей. Для SSHv2 ключ не короче 768 бит, на практике 2048.</p>
<pre class="cli">R1(config)#hostname R1
R1(config)#ip domain-name lab.local
R1(config)#crypto key generate rsa modulus 2048
R1(config)#ip ssh version 2
R1(config)#ip ssh time-out 60
R1(config)#ip ssh authentication-retries 3
R1(config)#line vty 0 4
R1(config-line)#transport input ssh
R1(config-line)#login local              ! без aaa new-model
R1(config-line)#exec-timeout 15 0
R1(config-line)#access-class MGMT in
R1#show ip ssh
SSH Enabled - version 2.0</pre>
<h3>Ограничение «откуда можно зайти»</h3>
<p><code>access-class</code> на VTY пускает на вход только адреса из стандартного ACL. Это обязательная мера: у провайдера на оборудование пускают только из сети управления и с jump-хостов. Ещё одна защита от перебора — <code>login block-for 120 attempts 5 within 60</code>.</p>
<div class="callout bad"><b>Классическая самоблокировка</b>Повесил <code>access-class</code> с ACL, в котором нет твоего адреса, и сессия умерла. Ещё вариант: ACL с таким именем вообще не существует. Поведение здесь зависит от платформы и версии, поэтому не полагайся на него. Правило из раздела 3: <code>reload in</code> или <code>configure terminal revert timer</code> перед любыми изменениями VTY.</div>`
    },
    {
      id: 'intf', h: 'Интерфейс: состояния и счётчики (читать за 10 секунд)',
      html: `
<p>Две части строки статуса — это два уровня модели:</p>
<pre class="cli">R1#show interfaces Gi0/0
GigabitEthernet0/0 is [[up]], line protocol is [[up]]
  Hardware is iGbE, address is 5000.0001.0000 (bia 5000.0001.0000)
  Internet address is 192.168.1.1/24
  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,
     reliability 255/255, txload 1/255, rxload 1/255
  Full-duplex, 1000Mb/s, media type is RJ45
  Last input 00:00:01, output 00:00:00, output hang never
  Last clearing of "show interface" counters never
  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0
  5 minute input rate 2000 bits/sec, 3 packets/sec
     1240 packets input, 98230 bytes, 0 no buffer
     Received 310 broadcasts (0 IP multicasts)
     0 runts, 0 giants, 0 throttles
     [[0 input errors, 0 CRC]], 0 frame, 0 overrun, 0 ignored
     1022 packets output, 87412 bytes, 0 underruns
     0 output errors, [[0 collisions]], 1 interface resets
     0 late collision, 0 deferred</pre>
<table><tr><th>Статус</th><th>Что значит</th><th>Куда смотреть</th></tr>
<tr><td>administratively down / down</td><td>порт выключен командой <code>shutdown</code></td><td>конфиг: <code>no shutdown</code></td></tr>
<tr><td>down / down</td><td>нет физического линка (L1)</td><td>кабель, трансивер, порт соседа, <code>show interfaces transceiver</code> (уровни света)</td></tr>
<tr><td>up / down</td><td>L1 есть, но L2 не согласован</td><td>инкапсуляция, keepalive, err-disabled на соседе, LACP, UDLD</td></tr>
<tr><td>up / up (looped)</td><td>видит свои же keepalive</td><td>петля на линке</td></tr>
<tr><td>down / down (err-disabled)</td><td>порт выключила защита (BPDU guard, port-security, UDLD)</td><td><code>show interfaces status err-disabled</code></td></tr></table>
<h3>Счётчики, по которым ищут проблему</h3>
<ul>
<li><b>CRC</b> растут — кадры приходят битыми: плохой кабель или патч-корд, грязная оптика, слабый сигнал, наводки. Ищи на <b>приёмной</b> стороне, причина на линии.</li>
<li><b>collisions / late collision</b> на full-duplex линке — почти всегда <b>duplex mismatch</b>: одна сторона в auto, другая жёстко в 100/full. Классический признак: на стороне half-duplex растут late collisions, на стороне full-duplex — CRC и runts.</li>
<li><b>runts</b> (кадры меньше 64 байт) и <b>giants</b> (больше MTU) — дуплекс, проблемы MTU, QinQ без увеличенного MTU.</li>
<li><b>input queue drops / overrun / no buffer</b> — устройство не успевает обрабатывать входящее.</li>
<li><b>Total output drops</b> — очередь на выход переполнена: канал забит (микробёрсты, перегрузка). Это тема QoS (глава 15).</li>
</ul>
<p>Счётчики накопительные. Правильный метод: <code>clear counters Gi0/0</code>, подождать, посмотреть снова. Растёт ли счётчик <b>сейчас</b>, важнее его абсолютного значения.</p>
<div class="callout pro"><b>Типичная заявка</b>«Клиент жалуется: интернет тормозит». Первым делом: <code>show interfaces</code> на абонентском порту. Растут CRC — физика, отправляешь монтажника. Нули, а нагрузка (txload) у потолка — клиент выбирает свою полосу. Растут output drops на аплинке — перегружен аплинк, проблема уже твоя.</div>`
    },
    {
      id: 'hyg', h: 'Гигиена устройства: время, логи, баннер',
      html: `
<p>Устройство без правильного времени и логов невозможно расследовать: «что упало в 03:12?» — а часы показывают 1993 год. Минимальный набор любого устройства в проде:</p>
<pre class="cli">service timestamps log datetime msec localtime show-timezone
service timestamps debug datetime msec localtime
clock timezone MSK 3 0
ntp server 10.0.0.100 prefer
logging buffered 64000 informational
logging host 10.0.0.200
logging source-interface Loopback0
banner motd ^
 Authorized access only. All actions are logged.
^
no ip http server
no ip http secure-server
no ip domain-lookup
line con 0
 logging synchronous
 exec-timeout 15 0
line vty 0 4
 logging synchronous
 exec-timeout 15 0
 transport input ssh</pre>
<h3>Уровни syslog: запомни порядок</h3>
<table><tr><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
<tr><td>emergencies</td><td>alerts</td><td>critical</td><td>errors</td><td>warnings</td><td>notifications</td><td>informational</td><td>debugging</td></tr></table>
<p>Мнемоника: <b>E</b>very <b>A</b>wesome <b>C</b>isco <b>E</b>ngineer <b>W</b>ill <b>N</b>eed <b>I</b>ce-cream <b>D</b>aily. Указанный уровень включает всё, что важнее его: <code>logging buffered informational</code> пишет уровни 0–6. Падения интерфейсов (<code>%LINK-3-UPDOWN</code>, <code>%LINEPROTO-5-UPDOWN</code>) — уровни 3 и 5. Цифра в сообщении и есть уровень.</p>
<h3>NTP</h3>
<p>NTP — иерархия <b>stratum</b>: 0 — эталон (GPS, атомные часы), 1 — сервер, подключённый к эталону, и так далее. Устройство с <code>ntp master 3</code> само становится источником времени stratum 3: так в лабе маршрутизатор раздаёт время остальным. Проверка: <code>show ntp status</code> (Clock is synchronized), <code>show ntp associations</code> (звёздочка у выбранного сервера).</p>
<div class="callout info"><b>Восстановление пароля (для справки)</b>Cisco: прервать загрузку (Break) → ROMMON → <code>confreg 0x2142</code> (не читать startup) → <code>reset</code> → <code>copy startup-config running-config</code> → поменять пароль → <code>config-register 0x2102</code> → <code>write</code>. Если забыть вернуть регистр, после следующей перезагрузки устройство снова загрузится «пустым». В EVE-NG на vIOS ROMMON недоступен, это делается только на железе.</div>`
    }
  ],
  cmds: [
    { g: 'Навигация и фильтры' },
    { c: 'show ip interface brief', d: 'Все интерфейсы: адрес, статус L1/L2 — первая команда на любом устройстве', hw: 'display ip interface brief', jn: 'show interfaces terse' },
    { c: 'show run | section X', d: 'Блоки конфигурации, содержащие X', hw: 'display current-configuration | include X', jn: 'show configuration | display set | match X' },
    { c: 'show run | begin line vty', d: 'Вывод, начиная с первой строки, где есть шаблон', jn: 'show configuration system services' },
    { c: 'terminal length 0', d: 'Без постраничного вывода', hw: 'screen-length 0 temporary', jn: 'set cli screen-length 0' },
    { c: 'do show ...', d: 'Show-команда из режима конфигурации', hw: 'display … (работает в system-view)', jn: 'run show …' },
    { g: 'Конфигурация и откат' },
    { c: 'copy running-config startup-config\nwrite memory', d: 'Сохранить конфигурацию', hw: 'save', jn: 'commit' },
    { c: 'reload in 10 / reload cancel', d: 'Перезагрузка по таймеру: страховка при удалённых изменениях', jn: 'commit confirmed 10' },
    { c: 'configure terminal revert timer 10\nconfigure confirm', d: 'Автооткат конфигурации через N минут без перезагрузки (нужен archive)', hw: 'commit trial 600 (на платформах с two-stage)', jn: 'commit confirmed 10 → commit' },
    { c: 'configure replace flash:file list', d: 'Заменить running-config файлом с показом отличий', jn: 'rollback 1 → commit' },
    { c: 'show archive', d: 'Снимки конфигурации', jn: 'show system commit' },
    { g: 'Доступ и безопасность' },
    { c: 'enable algorithm-type scrypt secret X', d: 'Пароль enable с хешем type 9', hw: 'super password cipher X', jn: 'set system root-authentication plain-text-password' },
    { c: 'username admin privilege 15 secret X', d: 'Локальный пользователь', hw: 'local-user admin password irreversible-cipher X', jn: 'set system login user admin class super-user authentication plain-text-password' },
    { c: 'aaa new-model\naaa authentication login default local', d: 'Включить AAA, вход по локальной базе', hw: 'aaa\n authentication-scheme default', jn: 'set system authentication-order [ tacplus password ]' },
    { c: 'crypto key generate rsa modulus 2048\nip ssh version 2', d: 'Ключи и SSHv2', hw: 'stelnet server enable\nrsa local-key-pair create', jn: 'set system services ssh' },
    { c: 'line vty 0 4\n transport input ssh\n access-class MGMT in\n exec-timeout 15 0', d: 'Только SSH, только из сети управления, таймаут 15 минут', hw: 'user-interface vty 0 4\n protocol inbound ssh\n acl 2000 inbound', jn: 'set system services ssh + firewall filter на lo0' },
    { c: 'show users / clear line vty N', d: 'Кто сейчас подключён / выбросить зависшую сессию', hw: 'display users / kill user-interface vty N', jn: 'show system users / request system logout user X' },
    { c: 'login block-for 120 attempts 5 within 60', d: 'Защита от перебора паролей' },
    { g: 'Состояние и диагностика' },
    { c: 'show interfaces Gi0/0', d: 'Статус L1/L2, скорость и дуплекс, нагрузка, CRC, дропы', hw: 'display interface GE0/0/0', jn: 'show interfaces ge-0/0/0 extensive' },
    { c: 'show interfaces status err-disabled', d: 'Порты, выключенные защитой (коммутатор)', hw: 'display error-down recovery', jn: '—' },
    { c: 'clear counters Gi0/0', d: 'Обнулить счётчики, чтобы видеть рост «сейчас»', hw: 'reset counters interface GE0/0/0', jn: 'clear interfaces statistics ge-0/0/0' },
    { c: 'show version', d: 'ПО, аптайм, причина перезагрузки, config-register', hw: 'display version', jn: 'show version / show system uptime' },
    { c: 'show logging', d: 'Буфер логов', hw: 'display logbuffer', jn: 'show log messages' },
    { c: 'show ntp status / associations', d: 'Синхронизация времени', hw: 'display ntp status', jn: 'show ntp status' },
    { c: 'show processes cpu sorted', d: 'Загрузка CPU по процессам', hw: 'display cpu-usage', jn: 'show chassis routing-engine' }
  ],
  cards: [
    ['Чем out-of-band управление отличается от in-band?', 'In-band — управление через ту же рабочую сеть (SSH на loopback или интерфейс), умирает вместе с ней. OOB — независимый путь: консоль через терминальный сервер, порт Mgmt в отдельной сети, LTE. Нужен, чтобы починить устройство, когда рабочая сеть сломана.'],
    ['Параметры консольного порта Cisco по умолчанию?', '9600 бод, 8 бит данных, без чётности, 1 стоп-бит (8N1), без управления потоком.'],
    ['Что даёт <code>| section</code> по сравнению с <code>| include</code>?', '<code>include</code> показывает только совпавшие строки. <code>section</code> показывает целые блоки конфигурации (заголовок и все вложенные строки), где есть совпадение. Например, весь <code>router ospf 1</code>.'],
    ['Зачем <code>terminal length 0</code>?', 'Отключает постраничный вывод (--More--), чтобы весь вывод шёл сразу: для копирования в тикет и для скриптов.'],
    ['running-config и startup-config — где лежат и что действует?', 'running — в RAM, действует сейчас и меняется каждой командой. startup — в NVRAM, читается при загрузке. Не сохранил — после перезагрузки вернётся startup.'],
    ['Как безопасно изменить ACL на VTY удалённого маршрутизатора (IOS)?', 'Бэкап (<code>copy run flash:</code>) → <code>reload in 10</code> или <code>configure terminal revert timer 10</code> → изменение → проверка, что новый вход работает → <code>reload cancel</code> / <code>configure confirm</code> → <code>write</code>.'],
    ['Что делает <code>commit confirmed 5</code> в Junos?', 'Применяет candidate-конфиг. Если в течение 5 минут не выполнить повторный <code>commit</code>, автоматически откатывает его на предыдущую версию. Страховка от потери доступа.'],
    ['Почему пароль type 7 — это не защита?', '<code>service password-encryption</code> использует обратимое шифрование (Vigenère-подобное), его расшифровывают за секунду. Защищает только от взгляда через плечо. Используй <code>secret</code> с type 8/9.'],
    ['Что такое AAA и что значат три буквы?', 'Authentication — кто ты; Authorization — что тебе можно (команды, уровень); Accounting — журнал действий. Обычно TACACS+ с запасным методом local.'],
    ['Какие условия нужны для SSH на IOS?', 'hostname (не дефолтный), <code>ip domain-name</code>, RSA-ключ (для SSHv2 ≥ 768 бит, на практике 2048), <code>ip ssh version 2</code>, на VTY — <code>transport input ssh</code> и способ аутентификации (<code>login local</code> или AAA).'],
    ['Что делает <code>access-class</code> на line vty?', 'Применяет стандартный ACL к входящим подключениям на VTY: решает, с каких адресов разрешён вход на само устройство. Это не фильтр транзитного трафика.'],
    ['Статус «up, line protocol is down» — какой уровень проблемы?', 'L1 есть (сигнал), но L2 не поднялся: несовпадение инкапсуляции, keepalive, проблемы LACP или UDLD, err-disable на соседе.'],
    ['Растут CRC на порту. О чём это говорит?', 'Приходят битые кадры: физика (кабель, патч-корд, грязная оптика, слабый сигнал) или duplex mismatch. Смотреть на приёмной стороне, проверять линию.'],
    ['Признак duplex mismatch?', 'На стороне half-duplex растут late collisions, на стороне full — CRC и runts. Скорость низкая, особенно под нагрузкой. Лечится одинаковыми настройками скорости и дуплекса с обеих сторон (обычно auto/auto).'],
    ['Что значит рост «Total output drops»?', 'Переполняется выходная очередь интерфейса: канал перегружен (в том числе микробёрстами). Это вопрос ёмкости канала или QoS.'],
    ['Уровни syslog от 0 до 7?', '0 emergencies, 1 alerts, 2 critical, 3 errors, 4 warnings, 5 notifications, 6 informational, 7 debugging. Указанный уровень включает все более важные.'],
    ['Зачем <code>logging synchronous</code> и <code>exec-timeout</code>?', 'logging synchronous не даёт сообщениям syslog разрывать набираемую команду. exec-timeout закрывает простаивающую сессию и освобождает VTY-линию.'],
    ['Что такое stratum в NTP?', 'Расстояние до эталонного источника времени: 0 — эталон (GPS), 1 — сервер с эталоном, и дальше по цепочке. Чем меньше, тем ближе к точному времени.'],
    ['Зачем config-register 0x2142 и почему важно вернуть 0x2102?', '0x2142 — загрузка без чтения startup-config (для сброса пароля). Если не вернуть 0x2102, после следующей перезагрузки устройство снова загрузится с пустым конфигом.'],
    ['Как посмотреть и сбросить зависшие VTY-сессии?', '<code>show users</code> — кто на каких линиях; <code>clear line vty N</code> — сбросить. Профилактика: <code>exec-timeout</code>.'],
    ['Что показывает <code>show version</code>, полезное при аварии?', 'Версию ПО, аптайм, <b>причину последней перезагрузки</b> (System returned to ROM by power-on / reload / crash), config register, объём памяти.'],
    ['Как в Junos посмотреть, что изменится, перед commit?', '<code>show | compare</code> в режиме конфигурации — diff candidate против активного конфига.']
  ],
  quiz: [
    { q: 'Ты удалённо меняешь ACL на line vty маршрутизатора в другом городе. Что сделать ПЕРЕД изменением?', o: ['Ничего, IOS не даст отрезать себе доступ', 'reload in 10 (или configure terminal revert timer 10)', 'write memory', 'Отключить aaa new-model'], a: 1, e: 'Таймер отката — страховка. Если доступ пропадёт, устройство само вернётся в рабочее состояние. write memory перед изменением ничего не страхует, а после ошибочного изменения сделает хуже.' },
    { q: 'Какой статус интерфейса указывает на проблему ФИЗИЧЕСКОГО уровня?', o: ['up / up', 'administratively down / down', 'down / down', 'up / down'], a: 2, e: 'down/down — нет сигнала (кабель, оптика, порт соседа). administratively down — порт выключен командой. up/down — физика есть, не поднялся L2.' },
    { q: 'На порту растут late collisions, при этом соседний порт на другой стороне показывает CRC и runts. Вероятная причина?', o: ['Перегрузка канала', 'Duplex mismatch', 'Петля L2', 'Неверный VLAN'], a: 1, e: 'Классическая картина несовпадения дуплекса: сторона в half видит late collisions, сторона в full — CRC и runts.' },
    { q: 'Что из этого НЕ нужно для работы SSH на IOS?', o: ['ip domain-name', 'RSA-ключ', 'enable password', 'Способ аутентификации на VTY'], a: 2, e: 'enable password для входа по SSH не нужен (хотя без enable secret ты не попадёшь в привилегированный режим, если пользователь не privilege 15). hostname, domain-name и ключ обязательны.' },
    { q: 'Чем опасен пароль, «зашифрованный» service password-encryption?', o: ['Ничем, это стойкий хеш', 'Это обратимое шифрование type 7, расшифровывается мгновенно', 'Он замедляет вход', 'Он не работает с SSH'], a: 1, e: 'Type 7 — обратимое шифрование, защита только от случайного взгляда. Для паролей используй secret (type 8/9).' },
    { q: 'Нужно посмотреть весь блок конфигурации OSPF целиком. Какой фильтр?', o: ['| include ospf', '| section router ospf', '| begin ospf', '| count ospf'], a: 1, e: 'section выводит целые блоки, в которых есть совпадение, включая вложенные строки. include показал бы только строки со словом ospf.' },
    { q: 'logging buffered warnings — какие уровни попадут в буфер?', o: ['Только 4', '4–7', '0–4', '0–7'], a: 2, e: 'Указанный уровень включает его самого и всё более важное: 0 (emergencies) — 4 (warnings).' },
    { q: 'Что делает access-class на line vty?', o: ['Фильтрует весь трафик через маршрутизатор', 'Ограничивает, с каких адресов разрешён вход на само устройство', 'Задаёт уровень привилегий', 'Включает SSH'], a: 1, e: 'access-class — фильтр входа на VTY. Для транзитного трафика есть access-group на интерфейсе.' },
    { q: 'Ты ввёл aaa new-model на маршрутизаторе, где нет ни одного локального пользователя и не настроены списки методов. Что будет при следующем входе по SSH?', o: ['Войдёшь как раньше по паролю line', 'Вход потребует логин из локальной базы, и ты не войдёшь', 'AAA не влияет на VTY', 'Устройство перезагрузится'], a: 1, e: 'После aaa new-model метод по умолчанию — локальная база. Пароль line больше не используется. Сначала создай пользователя.' },
    { q: 'Какой счётчик вырастет при перегрузке канала на выход (полоса упирается в потолок)?', o: ['CRC', 'runts', 'Total output drops', 'input errors'], a: 2, e: 'Переполнение выходной очереди — output drops. CRC и runts говорят о физике и дуплексе.' },
    { q: 'В Junos ты сделал изменения в конфигурации. Когда они начнут действовать?', o: ['Сразу после Enter', 'После commit', 'После save', 'После перезагрузки'], a: 1, e: 'Junos копит изменения в candidate config и применяет их атомарно по commit.' },
    { q: 'Что вернёт config-register 0x2142 после перезагрузки?', o: ['Загрузку в ROMMON', 'Загрузку без чтения startup-config', 'Сброс IOS', 'Загрузку с TFTP'], a: 1, e: '0x2142 говорит загрузчику игнорировать NVRAM. Так обходят забытый пароль. Обычное значение — 0x2102.' },
    { q: 'Какие команды помогают, когда все VTY заняты зависшими сессиями? (несколько)', o: ['show users', 'clear line vty N', 'exec-timeout на line vty', 'no ip domain-lookup'], a: [0, 1, 2], e: 'show users покажет линии, clear line освободит их, exec-timeout предотвратит повторение. domain-lookup к этому отношения не имеет.' },
    { q: 'Вывод: «GigabitEthernet0/1 is up, line protocol is down». Что проверишь первым?', code: 'R1#show interfaces Gi0/1\nGigabitEthernet0/1 is up, line protocol is down\n  Hardware is iGbE ...\n  Full-duplex, 1000Mb/s', o: ['Кабель — сигнала нет', 'Согласование L2: LACP/UDLD/инкапсуляцию и порт соседа (не err-disabled ли)', 'Таблицу маршрутизации', 'ACL на VTY'], a: 1, e: 'L1 есть (up), протокол канального уровня не поднялся. Ищем на L2 и на стороне соседа.' },
    { q: 'Зачем у провайдера аутентификация через TACACS+, а не общий локальный admin? (несколько)', o: ['Персональные учётки и быстрое отключение уволенных', 'Авторизация отдельных команд', 'Журнал «кто что ввёл» (accounting)', 'Это ускоряет маршрутизацию'], a: [0, 1, 2], e: 'Централизованная AAA даёт персональную ответственность, контроль команд и аудит. На скорость пересылки трафика не влияет.' },
    { q: 'Что показывает «*» в выводе show ntp associations?', o: ['Сервер недоступен', 'Сервер, выбранный для синхронизации', 'Сервер с наибольшим stratum', 'Сервер отключён администратором'], a: 1, e: '* — sys.peer, текущий источник синхронизации. Плюс к этому show ntp status должен сказать «Clock is synchronized».' }
  ],
  und: [
    { q: 'Объясни новичку, почему у провайдера нельзя ограничиться только SSH на loopback, и что такое OOB.', a: '<p>SSH на loopback — это in-band: доступ идёт через ту же сеть, которую обслуживает устройство. Если на нём сломалась маршрутизация, упал аплинк или ты сам ошибся в конфиге, до loopback не добраться. OOB — независимый путь: консоль через терминальный сервер, отдельная сеть управления, иногда LTE. Через него чинят устройство, когда рабочая сеть мертва. Поэтому в ядре и на важных узлах OOB есть обязательно.</p>', k: ['in-band зависит от рабочей сети', 'OOB независим: консоль/терминальный сервер/mgmt-сеть', 'нужен именно при авариях и ошибках конфигурации'] },
    { q: 'Опиши пошагово, как ты поменяешь ACL на VTY маршрутизатора в другом городе, чтобы не потерять доступ. Почему именно так?', a: '<p>1) Снимок конфигурации (<code>copy run flash:</code> или archive). 2) Таймер отката: <code>configure terminal revert timer 10</code> или <code>reload in 10</code>. 3) Изменение. 4) Проверка: открыть <b>новую</b> SSH-сессию, не закрывая старую (старая уже установлена, ACL её не рвёт, поэтому она ничего не доказывает). 5) Подтверждение (<code>configure confirm</code> / <code>reload cancel</code>) и <code>write</code>. Если ошибся, через 10 минут всё вернётся само.</p>', k: ['бэкап', 'таймер отката до изменения', 'проверка новой сессией', 'подтверждение и сохранение'] },
    { q: 'По каким признакам в show interfaces ты отличишь проблему кабеля, duplex mismatch и перегрузку канала?', a: '<p><b>Кабель/оптика:</b> растут CRC и input errors, иногда флапы (interface resets, сообщения UPDOWN). <b>Duplex mismatch:</b> на half-стороне late collisions, на full-стороне CRC и runts, скорость низкая под нагрузкой. <b>Перегрузка:</b> ошибок нет, но txload/rxload у 255/255 и растут output drops. Всё это проверяется в динамике: clear counters → подождать → посмотреть снова.</p>', k: ['CRC → физика', 'late collisions + CRC/runts на другой стороне → дуплекс', 'output drops + высокая нагрузка → перегрузка', 'смотреть прирост, а не абсолютные значения'] },
    { q: 'Зачем нужны NTP и syslog с точки зрения расследования аварии?', a: '<p>Авария — это цепочка событий на многих устройствах. Чтобы восстановить её («сначала упал линк на A в 03:12:05.120, через 40 мс перестроился OSPF на B…»), нужны логи с <b>синхронизированным точным временем</b> (NTP + timestamps msec), собранные в <b>одном месте</b> (syslog-сервер). Иначе локальный буфер перезапишется или очистится при перезагрузке, а время на устройствах будет разным.</p>', k: ['корреляция событий между устройствами', 'одинаковое точное время', 'централизованное хранение логов, которое переживает перезагрузку'] },
    { q: 'Чем принципиально отличается применение конфигурации в IOS и Junos и что из этого следует для безопасности изменений?', a: '<p>В IOS каждая команда применяется мгновенно, промежуточные состояния реальны: можно отрезать себя на середине изменения. В Junos изменения копятся в candidate и применяются атомарно по commit, есть <code>show | compare</code>, проверка синтаксиса (<code>commit check</code>), <code>commit confirmed</code> и 50 откатов. Поэтому в IOS особенно важны страховки (revert timer, reload in) и порядок команд.</p>', k: ['IOS: мгновенно, построчно', 'Junos: candidate → commit атомарно', 'commit confirmed / rollback', 'в IOS нужна ручная страховка'] }
  ],
  lab: {
    title: 'Лаба 1. Безопасный доступ и гигиена устройства',
    time: '≈ 1,5 часа',
    goal: `<p>Настроить с нуля два маршрутизатора и коммутатор так, как их сдают в эксплуатацию у провайдера: SSHv2, локальные пользователи и AAA, защищённые VTY, NTP, логи, сохранение и откат конфигурации. Потом сломать доступ и вернуть его.</p>`,
    topo: {
      w: 760, h: 330,
      nodes: [
        { id: 'R1', t: 'router', x: 160, y: 90, label: 'R1\n192.168.1.1', role: 'управляемый маршрутизатор, NTP master' },
        { id: 'R2', t: 'router', x: 600, y: 90, label: 'R2\n192.168.1.2', role: '«jump host»: отсюда заходим по SSH' },
        { id: 'SW1', t: 'switch', x: 380, y: 200, label: 'SW1\nVlan1 192.168.1.10', role: 'коммутатор доступа' },
        { id: 'PC1', t: 'pc', x: 380, y: 300, label: 'PC1 192.168.1.100', role: 'рабочая станция' }
      ],
      links: [['R1', 'Gi0/0', 'SW1', 'Gi0/0'], ['R2', 'Gi0/0', 'SW1', 'Gi0/1'], ['PC1', 'eth0', 'SW1', 'Gi0/2']]
    },
    addr: [['R1', 'Gi0/0', '192.168.1.1/24'], ['R2', 'Gi0/0', '192.168.1.2/24'], ['SW1', 'Vlan1', '192.168.1.10/24, шлюз .1'], ['PC1', 'eth0', '192.168.1.100/24, шлюз .1']],
    pre: 'Узлы стартуют с пустой конфигурацией. Запусти все, подожди 1–2 минуты загрузки vIOS и ответь «no» на диалог начальной настройки (<i>Would you like to enter the initial configuration dialog?</i>).',
    tasks: [
      { t: 'Базовая настройка и адресация', d: 'На R1, R2 и SW1 задай hostname, <code>no ip domain-lookup</code>, адреса по таблице. У SW1 адрес на <code>interface Vlan1</code> и <code>ip default-gateway</code>. На PC1: <code>ip 192.168.1.100/24 192.168.1.1</code>. Добейся пинга всех со всеми.',
        hint: 'На vIOS интерфейсы по умолчанию выключены — нужен <code>no shutdown</code>. На SW1 интерфейс Vlan1 тоже бывает в shutdown.',
        check: 'R1#show ip interface brief\nR1#ping 192.168.1.2\nR1#ping 192.168.1.10\nR1#ping 192.168.1.100\nPC1> ping 192.168.1.2',
        sol: 'R1(config)#hostname R1\nR1(config)#no ip domain-lookup\nR1(config)#interface Gi0/0\nR1(config-if)#ip address 192.168.1.1 255.255.255.0\nR1(config-if)#no shutdown\n! R2 аналогично с .2\nSW1(config)#hostname SW1\nSW1(config)#no ip domain-lookup\nSW1(config)#interface Vlan1\nSW1(config-if)#ip address 192.168.1.10 255.255.255.0\nSW1(config-if)#no shutdown\nSW1(config)#ip default-gateway 192.168.1.1\nPC1> ip 192.168.1.100/24 192.168.1.1\nPC1> save' },
      { t: 'Фильтры вывода', d: 'На R1 одной командой выведи только интерфейсы и их IP-адреса из running-config. Второй командой — только строки со статусом протокола и CRC из <code>show interfaces</code>. Третьей посчитай, сколько интерфейсов в состоянии up.',
        check: 'R1#show running-config | include ^interface|ip address\nR1#show interfaces | include line protocol|CRC\nR1#show ip interface brief | count up',
        sol: 'R1#show running-config | include ^interface|ip address\nR1#show interfaces | include line protocol|CRC\nR1#show ip interface brief | count up' },
      { t: 'Пароли и пользователи', d: 'На R1: enable secret с type 9 (scrypt), пользователь <code>admin</code> с privilege 15 и пользователь <code>noc</code> с privilege 5, которому разрешены <code>show running-config</code> и <code>clear counters</code>. Включи <code>service password-encryption</code>. Посмотри в конфиге, какие типы хешей получились.',
        hint: '<code>privilege exec level 5 show running-config</code>. Помни: уровень 5 видит в show running-config только то, что ему разрешено изменять, поэтому вывод будет почти пустым. Это нормально и само по себе урок.',
        check: 'R1#show running-config | include secret|username\n! ожидаем: secret 9 $9$...',
        sol: 'R1(config)#enable algorithm-type scrypt secret En@ble123\nR1(config)#username admin privilege 15 algorithm-type scrypt secret Adm1n123\nR1(config)#username noc privilege 5 algorithm-type scrypt secret N0c12345\nR1(config)#privilege exec level 5 show running-config\nR1(config)#privilege exec level 5 clear counters\nR1(config)#service password-encryption' },
      { t: 'SSHv2 с AAA и защитой VTY', d: 'На R1 включи SSHv2 (ключ 2048), <code>aaa new-model</code> со входом по локальной базе, на VTY только SSH, <code>exec-timeout 10 0</code>, <code>logging synchronous</code> и ACL <code>MGMT</code>, который пускает <b>только R2</b> (192.168.1.2). Защити консоль локальным логином. Делай это под страховкой <code>reload in 15</code>!',
        hint: 'Порядок: пользователь уже есть (задание 3) → домен и ключ → <code>aaa new-model</code> → ACL → line vty. Стандартный именованный ACL: <code>ip access-list standard MGMT</code>.',
        check: 'R1#show ip ssh\nR1#show run | section line vty\nR2#ssh -l admin 192.168.1.1     ! должно пустить\nSW1#ssh -l admin 192.168.1.1    ! должно отказать (Connection refused)\nR1#show users\nR1#show access-lists MGMT        ! счётчики совпадений',
        sol: 'R1#reload in 15\nR1(config)#ip domain-name lab.local\nR1(config)#crypto key generate rsa modulus 2048\nR1(config)#ip ssh version 2\nR1(config)#aaa new-model\nR1(config)#aaa authentication login default local\nR1(config)#aaa authorization exec default local\nR1(config)#ip access-list standard MGMT\nR1(config-std-nacl)#permit host 192.168.1.2\nR1(config-std-nacl)#deny any log\nR1(config)#line vty 0 4\nR1(config-line)#transport input ssh\nR1(config-line)#access-class MGMT in\nR1(config-line)#exec-timeout 10 0\nR1(config-line)#logging synchronous\nR1(config)#line con 0\nR1(config-line)#logging synchronous\n! после проверки с R2:\nR1#reload cancel\nR1#write memory' },
      { t: 'Проверь уровни привилегий', d: 'С R2 зайди на R1 под <code>noc</code>. Проверь <code>show privilege</code>, попробуй <code>configure terminal</code> и <code>show running-config</code>. Объясни себе, почему вывод show run почти пустой.',
        check: 'R2#ssh -l noc 192.168.1.1\nR1#show privilege\nR1#configure terminal   ! % Invalid input\nR1#show running-config',
        sol: '! show running-config на уровне ниже 15 показывает только те команды конфигурации,\n! которые этот уровень сам может вводить. Поэтому вывод почти пустой.' },
      { t: 'Гигиена: время, логи, баннер', d: 'R1 — источник времени (<code>ntp master 3</code>), R2 и SW1 синхронизируются с ним. На всех: timestamps с миллисекундами, часовой пояс MSK +3, <code>logging buffered 32000 informational</code>, баннер MOTD, выключенный HTTP-сервер. Затем выключи и включи Gi0/0 на R2 и найди эти события в <code>show logging</code> на R2 с точным временем.',
        hint: 'Синхронизация NTP занимает несколько минут. <code>show ntp associations</code> сначала покажет «~» без «*». Выключать Gi0/0 на R2 можно только с консоли: по SSH ты отрежешь сам себя.',
        check: 'R2#show ntp status\nR2#show ntp associations\nR2#show clock detail\nR2#show logging | include UPDOWN',
        sol: 'R1(config)#clock timezone MSK 3 0\nR1(config)#ntp master 3\nR1(config)#service timestamps log datetime msec localtime show-timezone\nR1(config)#logging buffered 32000 informational\nR1(config)#no ip http server\nR1(config)#banner motd ^ Authorized access only ^\n! R2 и SW1:\nR2(config)#clock timezone MSK 3 0\nR2(config)#ntp server 192.168.1.1\nR2(config)#service timestamps log datetime msec localtime show-timezone\nR2(config)#logging buffered 32000 informational' },
      { t: 'Архив и откат без перезагрузки', d: 'На R1 настрой archive в <code>flash:arch</code>. Сделай <code>write memory</code> (появится снимок). Запусти <code>configure terminal revert timer 5</code>, удали адрес с Gi0/0 и <b>не</b> подтверждай. Убедись, что через 5 минут конфигурация вернулась сама. Потом повтори с <code>configure confirm</code>.',
        hint: 'Если адрес снят, SSH-сессия пропадёт. Работай с консоли R1, чтобы наблюдать откат. <code>show archive</code> покажет снимки, <code>show archive config differences</code> — отличия.',
        check: 'R1#show archive\nR1#show archive config differences flash:arch-1 system:running-config',
        sol: 'R1(config)#archive\nR1(config-archive)#path flash:arch\nR1(config-archive)#write-memory\nR1#write memory\nR1#configure terminal revert timer 5\nR1(config)#interface Gi0/0\nR1(config-if)#no ip address\n! ждём 5 минут → «Rollback Confirmed Change: Rolling to:...»\nR1#show ip interface brief' },
      { t: 'Счётчики интерфейса', d: 'Обнули счётчики на R1 Gi0/0, запусти с R2 <code>ping 192.168.1.1 repeat 1000 size 1400</code>, сравни packets input/output и rate. Найди строки CRC, runts, giants, output drops и проговори вслух, что каждая означала бы при росте.',
        check: 'R1#clear counters Gi0/0\nR2#ping 192.168.1.1 repeat 1000 size 1400\nR1#show interfaces Gi0/0 | include packets|rate|CRC|drops' }
    ],
    brk: [
      { t: 'SSH внезапно перестал пускать вообще (с R2 — Connection refused)', inj: 'R1(config)#crypto key zeroize rsa\n! подтвердить yes', h: '<code>show ip ssh</code> — включён ли SSH? Без RSA-ключа SSH-сервер выключается.', f: 'Удалён RSA-ключ, поэтому SSH отключён (<code>SSH Disabled</code>). Решение: <code>crypto key generate rsa modulus 2048</code>, затем <code>ip ssh version 2</code>.' },
      { t: 'R2 пингует R1, но не пингует SW1 и PC1', inj: 'R2(config)#interface Gi0/0\nR2(config-if)#ip address 192.168.1.2 255.255.255.252', h: 'Сравни маску на R2 с остальными: <code>show ip interface brief</code> маску не покажет, нужен <code>show ip interface Gi0/0</code> или <code>show run int Gi0/0</code>. Посчитай, какие адреса попадают в 192.168.1.0/30.', f: 'На R2 маска /30, его сеть — 192.168.1.0–3. Адрес .1 в неё входит, а .10 и .100 нет: R2 считает их чужими и ищет маршрут, которого нет. Ошибка в маске ломает связь избирательно, поэтому её трудно заметить. Верни /24.' },
      { t: 'После входа по SSH «enable» не работает: % No password set', inj: 'R1(config)#no enable secret\nR1(config)#username user1 privilege 1 secret User12345', h: 'Под каким пользователем вошёл? Какой у него уровень? Задан ли enable secret?', f: 'Пользователь с privilege 1 попадает в <code>&gt;</code>, а для <code>enable</code> по VTY нужен заданный enable secret. Без него IOS отвечает «% No password set». Решение: <code>enable algorithm-type scrypt secret …</code> или пользователь с privilege 15.' },
      { t: 'С R2 по SSH не пускает, хотя ключ есть и SSH включён', inj: 'R1(config)#ip access-list standard MGMT\nR1(config-std-nacl)#no permit host 192.168.1.2\nR1(config-std-nacl)#1 permit host 192.168.1.20', h: '<code>show access-lists MGMT</code> — какие правила и счётчики? <code>show run | section line vty</code>. В логах ACL с <code>log</code> видно, откуда были отказы.', f: 'В ACL нет адреса R2: есть только .20 и deny any. Попытки R2 попадают в deny (счётчик растёт, в логе «list MGMT denied 192.168.1.2»). Исправь правило. На проде это делается с консоли или под revert timer.' }
    ],
    extra: '<p><b>Junos-разминка.</b> Если хочешь сразу пощупать провайдерский Junos, подними в EVE-NG vMX или vSRX (в папке у тебя есть junos-vmx 18.2) и повтори задания 4 и 7: <code>set system services ssh</code>, <code>set system login user admin class super-user</code>, затем <code>commit confirmed 3</code>, <code>show | compare</code>, <code>rollback 1</code>. Сравни ощущения с IOS.</p>'
  }
});
