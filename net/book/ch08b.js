// Книжный текст главы 8.1 СДСМ (компьютер): iBGP и route reflector. Формат как у ch08/ch10/ch11/ch12, блоки .callout.lab ведут в лабу 8.1.
// Опирается на книгу 11 (раздел 2: сессия по loopback, next-hop, правило iBGP, идея RR), книгу 8 (атрибуты, выбор пути, community) и книгу 10 (BGP-free core).
// Все схемы — на топологии лабы 8.1: R2 бордер с аплинком UP (AS64510), R6 PE с клиентом CUST (AS64600), R3 и R4 — P, R1 — RR сбоку (IS-IS metric 1000).
// Факты: RFC 4271 (правило iBGP, next-hop), RFC 4456 (route reflection: правила отражения, ORIGINATOR_ID, CLUSTER_LIST), RFC 5065 (конфедерации),
// RFC 7911 (add-path), RFC 9107 (BGP optimal route reflection); Cisco IOS: iBGP TTL 255, update-source, peer-group, bgp cluster-id.
window.BOOK = window.BOOK || {};
BOOK.ch08b = {
title: 'iBGP и route reflector',
lead: `<p>В главе 8 ты настраивал BGP на стыке с другими сетями. Но у провайдера граница не одна: бордеры с аплинками и пирами, десятки PE с клиентами. Как маршрут, пришедший на один край сети, узнают все остальные? Это iBGP — BGP внутри своей AS. У него два правила, которые объясняют почти все его странности: «маршрут в BGP есть, а не работает» и «маршрут дошёл не до всех». Отсюда next-hop-self, route reflector и та самая чёрная дыра посередине, из-за которой провайдерам понадобился MPLS.</p>
<p>Многое ты уже видел в главах 10 и 11, поэтому книга короче обычной: восемь разделов. Все схемы — на топологии лабы 8.1.</p>`,
parts: [

{h:'Зачем BGP внутри своей сети', html:`
<h3>Один аплинк — а маршруты нужны всем</h3>
<p>Посмотри на схему лабы 8.1. На одном краю сети бордер R2: к нему подключён аплинк UP, от которого приходит интернет (в лабе это одна сеть 8.8.8.0/24, в жизни — миллион маршрутов). На другом краю PE R6, к нему подключён клиент CUST со своей AS и сетью 198.18.0.0/24. Посередине транзитные маршрутизаторы R3 и R4. Сбоку R1 — пока просто маршрутизатор, в разделе 6 он станет route reflector'ом.</p>
<p>R6 должен знать, что 8.8.8.0/24 — за R2, а R2 — что 198.18.0.0/24 за R6. Как им это передать?</p>
<ul><li><b>Влить BGP в IS-IS</b> (редистрибуция). Миллион маршрутов в IGP — и каждое изменение в интернете заставит все маршрутизаторы пересчитывать SPF. Так не делают никогда.</li>
<li><b>Default на ближайший бордер.</b> В простой сети сойдёт. Но при нескольких аплинках пропадают выбор лучшего выхода и вся политика из главы 8: local-pref, ярлыки, правило экспорта.</li>
<li><b>iBGP</b> — BGP-сессии между маршрутизаторами одной AS. Маршруты едут со всеми атрибутами, и политика работает по всей сети.</li></ul>
<figure class="dg"><svg viewBox="0 0 320 230" role="img" aria-label="Два слоя сети: IS-IS знает только линки и loopback'и, iBGP между R2 и R6 переносит внешние сети и сети клиентов">
<path class="ln" d="M42 110 L56 110 M88 122 L112 150 M144 162 L176 162 M208 150 L232 122 M264 110 L278 110 M140 48 L92 98 M180 48 L228 98"/>
<g><path class="lg" d="M88 122 L112 150 M144 162 L176 162 M208 150 L232 122 M140 48 L92 98 M180 48 L228 98" style="stroke-width:3"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.47;0.48;1"/></g>
<g opacity="0"><path d="M80 98 Q160 70 240 98" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-dasharray="5 4"/><text class="sm bt" x="160" y="76" text-anchor="middle">iBGP</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.48;0.49;1"/></g>
<rect class="bx" x="2" y="98" width="40" height="24" rx="6"/><text class="tx" x="22" y="114" text-anchor="middle">UP</text>
<rect class="bx" x="56" y="98" width="40" height="24" rx="6"/><text class="tx" x="76" y="114" text-anchor="middle">R2</text>
<rect class="bx" x="104" y="150" width="40" height="24" rx="6"/><text class="tx" x="124" y="166" text-anchor="middle">R3</text>
<rect class="bx" x="176" y="150" width="40" height="24" rx="6"/><text class="tx" x="196" y="166" text-anchor="middle">R4</text>
<rect class="bx" x="224" y="98" width="40" height="24" rx="6"/><text class="tx" x="244" y="114" text-anchor="middle">R6</text>
<rect class="bx" x="278" y="98" width="40" height="24" rx="6"/><text class="tx" x="298" y="114" text-anchor="middle">CUST</text>
<rect class="bx" x="140" y="30" width="40" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R1</text>
<text class="sm" x="22" y="138" text-anchor="middle">AS64510</text><text class="sm" x="298" y="138" text-anchor="middle">AS64600</text>
<text class="sm" x="160" y="192" text-anchor="middle">AS64500 — сеть провайдера</text>
<g opacity="0"><rect x="-31" y="-7" width="62" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="14s" repeatCount="indefinite" path="M22 90 L76 90 Q160 62 244 90" keyPoints="0;0;1;1" keyTimes="0;0.52;0.72;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.51;0.52;0.73;0.74;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">198.18.0.0/24</text><animateMotion dur="14s" repeatCount="indefinite" path="M298 90 L244 90 Q160 62 76 90" keyPoints="0;0;1;1" keyTimes="0;0.75;0.95;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.74;0.75;0.96;0.97;1"/></g>
<g><text class="sm" x="160" y="210" text-anchor="middle">IS-IS внутри AS: только loopback'и и линки —</text><text class="sm gn" x="160" y="224" text-anchor="middle">десятки сетей, сходится за доли секунды</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.47;0.48;1"/></g>
<g opacity="0"><text class="sm" x="160" y="210" text-anchor="middle">iBGP между R2 и R6: внешние сети и сети</text><text class="sm bt" x="160" y="224" text-anchor="middle">клиентов — со всеми атрибутами</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.48;0.49;1"/></g>
</svg><figcaption>Топология лабы 8.1. Сначала зелёным — IS-IS: он знает только свою инфраструктуру. Потом синяя дуга — iBGP-сессия R2 ↔ R6 между loopback'ами: по ней едут сеть аплинка к R6 и сеть клиента к R2.</figcaption></figure>
<div class="callout info"><b>Разделение труда</b>IGP знает только свою инфраструктуру: loopback'и и линки, десятки или сотни сетей, сходится быстро. iBGP знает внешний мир и клиентов: сотни тысяч сетей, работает медленнее, зато с политиками. И iBGP стоит на IGP: сессии идут между loopback'ами, которые знает IGP, а next-hop каждого BGP-маршрута ищется в IGP.</div>
<div class="callout deep"><b>Что ты уже знаешь</b><ul><li>Сессия между PE по loopback, update-source, рекурсивный поиск next-hop, правило iBGP и идея route reflector — <a href="#/c/ch11/book/1">книга 11, раздел 2</a>.</li><li>Атрибуты, выбор лучшего пути, ярлыки-community и правило экспорта — <a href="#/c/ch08/book/0">книга 8</a>.</li><li>Ядро без BGP на MPLS — <a href="#/c/ch10/book/0">книга 10, раздел 1</a>.</li></ul>Здесь — что из этого вырастает в большой сети и почему.</div>
<div class="callout lab"><b>В лабе</b>Задания 1 и 2: IS-IS внутри AS (линки к R1 дорогие, metric 1000, чтобы трафик через него не шёл) и eBGP на краях — R2 с аплинком UP, R6 с клиентом CUST. <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему маршруты интернета не вливают в IS-IS?</summary><p>Их миллион. IGP пришлось бы хранить их все и пересчитывать SPF на каждое изменение в интернете. IGP рассчитан на свою инфраструктуру — десятки и сотни сетей.</p></details>
<details class="chk"><summary>Проверь себя: что знает IGP, а что iBGP?</summary><p>IGP — loopback'и и линки своей сети. iBGP — внешние сети и сети клиентов с атрибутами и политиками.</p></details>
<details class="chk"><summary>Проверь себя: что нужно iBGP от IGP?</summary><p>Маршруты до loopback'ов соседей (по ним идут сессии) и до next-hop каждого BGP-маршрута.</p></details>`},

{h:'Сессии по loopback: update-source с обеих сторон', html:`
<p>Из главы 11 ты знаешь: iBGP строят от loopback до loopback, в строке neighbor пишут loopback соседа и добавляют <code>update-source Loopback0</code>. Разберём, зачем это и что ломается.</p>
<h3>Почему loopback</h3>
<p>Loopback не падает вместе с линком. Если между двумя маршрутизаторами есть хотя бы два пути, авария на одном не трогает сессию: IGP находит обход, а TCP между loopback'ами продолжает работать. Сессия на адресах физического линка умерла бы вместе с линком.</p>
<figure class="dg"><svg viewBox="0 0 320 230" role="img" aria-label="iBGP-сессия R2–R6 между loopback'ами идёт по пути IGP; при обрыве линка R3–R4 IGP находит обход через R1, и сессия не прерывается">
<path class="ln" d="M42 110 L56 110 M88 122 L112 150 M144 162 L176 162 M208 150 L232 122 M264 110 L278 110 M140 48 L92 98 M180 48 L228 98"/>
<g><path class="lg" d="M88 122 L112 150 M144 162 L176 162 M208 150 L232 122" style="stroke-width:3"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.47;0.48;1"/></g>
<g opacity="0"><path class="lg" d="M140 48 L92 98 M180 48 L228 98" style="stroke-width:3"/><path class="lr" d="M153 155 L167 169 M167 155 L153 169"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.48;0.49;1"/></g>
<path d="M80 98 Q160 70 240 98" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-dasharray="5 4"/>
<text class="sm bt" x="160" y="98" text-anchor="middle">iBGP Lo0 ↔ Lo0</text>
<text class="sm" x="110" y="64" text-anchor="end">1000</text><text class="sm" x="210" y="64">1000</text>
<rect class="bx" x="2" y="98" width="40" height="24" rx="6"/><text class="tx" x="22" y="114" text-anchor="middle">UP</text>
<rect class="bx" x="56" y="98" width="40" height="24" rx="6"/><text class="tx" x="76" y="114" text-anchor="middle">R2</text>
<rect class="bx" x="104" y="150" width="40" height="24" rx="6"/><text class="tx" x="124" y="166" text-anchor="middle">R3</text>
<rect class="bx" x="176" y="150" width="40" height="24" rx="6"/><text class="tx" x="196" y="166" text-anchor="middle">R4</text>
<rect class="bx" x="224" y="98" width="40" height="24" rx="6"/><text class="tx" x="244" y="114" text-anchor="middle">R6</text>
<rect class="bx" x="278" y="98" width="40" height="24" rx="6"/><text class="tx" x="298" y="114" text-anchor="middle">CUST</text>
<rect class="bx" x="140" y="30" width="40" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R1</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M84 120 L124 162 L196 162 L236 120" keyPoints="0;0;1;1" keyTimes="0;0.06;0.22;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.05;0.06;0.22;0.23;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M236 120 L196 162 L124 162 L84 120" keyPoints="0;0;1;1" keyTimes="0;0.26;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.25;0.26;0.42;0.43;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M84 100 L150 50 L170 50 L236 100" keyPoints="0;0;1;1" keyTimes="0;0.56;0.72;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.55;0.56;0.72;0.73;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M236 100 L170 50 L150 50 L84 100" keyPoints="0;0;1;1" keyTimes="0;0.76;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.75;0.76;0.92;0.93;1"/></g>
<g><text class="sm" x="160" y="210" text-anchor="middle">TCP-сессия R2 ↔ R6 идёт по пути IGP —</text><text class="sm" x="160" y="224" text-anchor="middle">через R3 и R4</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.47;0.48;1"/></g>
<g opacity="0"><text class="sm" x="160" y="210" text-anchor="middle">Линк R3–R4 упал: IGP нашёл обход через R1,</text><text class="sm gn" x="160" y="224" text-anchor="middle">а сессия между loopback'ами не заметила</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.48;0.49;1"/></g>
</svg><figcaption>Синяя дуга — логическая iBGP-сессия. Конверты — её TCP-пакеты, они идут по тому пути, который выбрал IS-IS. Оборвался линк R3–R4 — пакеты пошли через R1 (дорого, но работает), и сессия осталась Established.</figcaption></figure>
<h3>update-source: с какого адреса «звонить»</h3>
<p>TCP-соединение открывается с какого-то адреса. Без update-source маршрутизатор берёт адрес интерфейса, через который уходит пакет к соседу. А сосед в своей строке neighbor ждёт твой loopback. Пришёл «звонок» с незнакомого адреса — сосед его сбрасывает.</p>
<p>Поэтому update-source ставят с <b>обеих</b> сторон. Если на одной стороне указать update-source не тот интерфейс, сессия не поднимется вовсе: свои попытки маршрутизатор делает с чужого для соседа адреса, а встречные попытки соседа на свой loopback не принимает — они пришли не на тот адрес, что указан в update-source. Проверить, с каких адресов идёт сессия:</p>
<pre class="cli">R2#show ip bgp neighbors 10.255.0.1 | include BGP state|Local host|Foreign host
  BGP state = Established, up for 00:12:40
Local host: [[10.255.0.2]], Local port: 179
Foreign host: [[10.255.0.1]], Foreign port: 22457</pre>
<p>Local host и Foreign host — адреса двух концов TCP. Должны быть loopback'и с обеих сторон.</p>
<p>И ещё одно отличие от eBGP: iBGP-пакеты уходят с TTL 255, поэтому <code>ebgp-multihop</code> для сессии через несколько хопов не нужен.</p>
<div class="callout warn"><b>Loopback должен быть в IGP</b>Сессия по loopback'ам поднимется, только если до loopback соседа есть маршрут. Забыл добавить Loopback0 в IS-IS — сессия висит в Active, хотя пинг между адресами линков проходит.</div>
<div class="callout lab"><b>В лабе</b>Сессии по loopback'ам ты поднимешь в заданиях 3, 5 и 6. Поломка 2: у R2 update-source не на тот интерфейс — сессия R2–R1 висит в Active, хотя loopback'и пингуются. <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: зачем iBGP строят между loopback'ами?</summary><p>Loopback не падает вместе с линком. При аварии IGP находит обход, и TCP-сессия между loopback'ами продолжает работать.</p></details>
<details class="chk"><summary>Проверь себя: что будет, если на R2 забыть update-source?</summary><p>R2 будет открывать TCP с адреса интерфейса, а сосед ждёт его loopback и такие попытки сбросит. Надёжно сессия работает, только когда update-source стоит с обеих сторон.</p></details>
<details class="chk"><summary>Проверь себя: нужен ли ebgp-multihop для iBGP через несколько хопов?</summary><p>Нет. iBGP шлёт пакеты с TTL 255. Ограничение TTL 1 есть только у eBGP.</p></details>`},

{h:'Next-hop не меняется: «маршрут есть, а не работает»', html:`
<h3>Второе правило iBGP</h3>
<p>R2 получил 8.8.8.0/24 от аплинка, next-hop — адрес аплинка 10.24.0.2. Передавая маршрут по iBGP, R2 next-hop <b>не меняет</b>: на R6 маршрут приходит всё с тем же 10.24.0.2. А R6 ищет этот адрес в IS-IS — и не находит: линк к аплинку в IS-IS не включён. Путь непригоден.</p>
<pre class="cli">R6#show ip bgp 8.8.8.0/24
BGP routing table entry for 8.8.8.0/24, version 0
Paths: (1 available, [[no best path]])
  64510
    [[10.24.0.2 (inaccessible)]] from 10.255.0.2 (10.255.0.2)
      Origin IGP, metric 0, localpref 100, valid, internal</pre>
<p>Маршрут в BGP <b>есть</b>, но без «&gt;», в таблицу маршрутов он не попадёт, и соседям R6 его не отдаст. Это одна из самых частых жалоб в iBGP: «маршрут пришёл, а трафик не идёт».</p>
<figure class="dg"><svg viewBox="0 0 320 230" role="img" aria-label="Без next-hop-self маршрут приходит на R6 с next-hop аплинка, которого нет в IS-IS; с next-hop-self — с loopback R2, и путь рабочий">
<path class="ln" d="M42 110 L56 110 M88 122 L112 150 M144 162 L176 162 M208 150 L232 122 M264 110 L278 110 M140 48 L92 98 M180 48 L228 98"/>
<path d="M80 98 Q160 70 240 98" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-dasharray="5 4"/>
<rect class="bx" x="2" y="98" width="40" height="24" rx="6"/><text class="tx" x="22" y="114" text-anchor="middle">UP</text>
<rect class="bx" x="56" y="98" width="40" height="24" rx="6"/><text class="tx" x="76" y="114" text-anchor="middle">R2</text>
<rect class="bx" x="104" y="150" width="40" height="24" rx="6"/><text class="tx" x="124" y="166" text-anchor="middle">R3</text>
<rect class="bx" x="176" y="150" width="40" height="24" rx="6"/><text class="tx" x="196" y="166" text-anchor="middle">R4</text>
<rect class="bx" x="224" y="98" width="40" height="24" rx="6"/><text class="tx" x="244" y="114" text-anchor="middle">R6</text>
<rect class="bx" x="278" y="98" width="40" height="24" rx="6"/><text class="tx" x="298" y="114" text-anchor="middle">CUST</text>
<rect class="bx" x="140" y="30" width="40" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R1</text>
<text class="sm" x="22" y="138" text-anchor="middle">10.24.0.2</text>
<g opacity="0"><rect x="-62" y="-7" width="124" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24 via 10.24.0.2</text><animateMotion dur="14s" repeatCount="indefinite" path="M90 88 Q160 60 230 88" keyPoints="0;0;1;1" keyTimes="0;0.05;0.28;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.04;0.05;0.29;0.3;1"/></g>
<g opacity="0"><path class="lr" d="M238 80 L250 92 M250 80 L238 92"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.3;0.31;0.48;0.49;1"/></g>
<g opacity="0"><rect x="-65" y="-7" width="130" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24 via 10.255.0.2</text><animateMotion dur="14s" repeatCount="indefinite" path="M90 88 Q160 60 230 88" keyPoints="0;0;1;1" keyTimes="0;0.54;0.78;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.53;0.54;0.79;0.8;1"/></g>
<g opacity="0"><path class="lg" d="M236 86 L242 92 L252 80"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.8;0.81;0.97;1"/></g>
<g><text class="sm" x="160" y="200" text-anchor="middle">R2 передал 8.8.8.0/24 с next-hop 10.24.0.2.</text><text class="sm rd" x="160" y="214" text-anchor="middle">В IS-IS у R6 такого адреса нет — путь негоден</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><text class="sm" x="160" y="200" text-anchor="middle">С next-hop-self R2 ставит свой loopback</text><text class="sm gn" x="160" y="214" text-anchor="middle">10.255.0.2 — его IS-IS знает, путь рабочий</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.51;0.52;1"/></g>
</svg><figcaption>Оранжевая наклейка — маршрут без next-hop-self: адрес аплинка R6 не знает. Синяя — с next-hop-self: next-hop стал loopback'ом R2, а до него у R6 есть путь по IS-IS.</figcaption></figure>
<h3>Два решения</h3>
<ul><li><b>next-hop-self на бордере</b>: передавая внешние маршруты по iBGP, R2 подставляет свой адрес — loopback, который знает IGP. Это стандарт.
<pre class="cli">R2(config-router)#neighbor 10.255.0.6 next-hop-self</pre></li>
<li><b>Включить линк к аплинку в IGP</b> (как passive). Тоже работает, но в IGP попадают чужие адреса, а у провайдера с сотней стыков — сотни лишних сетей. И при падении стыка next-hop пропадает из IGP, что тоже нужно учитывать. Так делают редко.</li></ul>
<p>Зеркально и в обратную сторону: R6 ставит next-hop-self для маршрутов клиента, иначе у R2 next-hop 198.18.0.0/24 будет адресом клиента 10.66.0.2, которого IS-IS не знает.</p>
<div class="an"><b>Аналогия</b>Next-hop — это адрес в записке «посылки для Хабаровска сдавать на склад №7». R2 переслал записку коллеге в другой город, не исправив адрес склада. Коллега ищет склад №7 у себя на карте — его нет, это склад партнёра R2. С next-hop-self R2 пишет в записке свой адрес: «сдавать мне, дальше я сам».</div>
<div class="callout lab"><b>В лабе</b>Задание 3: поднимешь iBGP R2 ↔ R6 без next-hop-self, увидишь «inaccessible» и починишь. Поломка 3: next-hop-self на R2 пропал — у всех клиентов RR маршрут 8.8.8.0/24 снова «inaccessible». <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: R6 видит 8.8.8.0/24 с next-hop 10.24.0.2 (inaccessible). Что это значит?</summary><p>Маршрут пришёл по iBGP с адресом аплинка в next-hop, а до этого адреса у R6 нет маршрута в IGP. Путь непригоден: без «&gt;», в таблицу маршрутов не попадает.</p></details>
<details class="chk"><summary>Проверь себя: где ставят next-hop-self — на бордере или на приёмнике?</summary><p>На бордере, который передаёт внешние маршруты по iBGP: он подставляет свой loopback.</p></details>
<details class="chk"><summary>Проверь себя: почему next-hop-self лучше, чем включить линк к аплинку в IGP?</summary><p>IGP не засоряется чужими адресами стыков, и next-hop — стабильный loopback бордера, а не адрес чужого маршрутизатора.</p></details>`},

{h:'Чёрная дыра посередине: P без BGP', html:`
<p>Next-hop исправлен, у R2 и R6 все маршруты есть. Клиент пингует 8.8.8.8 — и тишина. Эту картину ты уже видел в главе 10, теперь — на схеме этой лабы.</p>
<p>R6 знает: 8.8.8.0/24 — за R2 (next-hop 10.255.0.2), а до R2 по IS-IS — через R4. Он отдаёт пакет R4. А R4 маршрутизирует по <b>адресу назначения</b> пакета — 8.8.8.8. BGP на R4 нет, маршрута к 8.8.8.8 нет, пакет выброшен. То, что R6 знал про next-hop, R4 не знает: next-hop не записывается в пакет.</p>
<figure class="dg"><svg viewBox="0 0 320 230" role="img" aria-label="Пакет клиента к 8.8.8.8 пропадает на R4 без BGP; с MPLS он идёт по метке до R2">
<path class="ln" d="M42 110 L56 110 M88 122 L112 150 M144 162 L176 162 M208 150 L232 122 M264 110 L278 110 M140 48 L92 98 M180 48 L228 98"/>
<rect class="bx" x="2" y="98" width="40" height="24" rx="6"/><text class="tx" x="22" y="114" text-anchor="middle">UP</text>
<rect class="bx" x="56" y="98" width="40" height="24" rx="6"/><text class="tx" x="76" y="114" text-anchor="middle">R2</text>
<rect class="bx" x="104" y="150" width="40" height="24" rx="6"/><text class="tx" x="124" y="166" text-anchor="middle">R3</text>
<rect class="bx" x="176" y="150" width="40" height="24" rx="6"/><text class="tx" x="196" y="166" text-anchor="middle">R4</text>
<rect class="bx" x="224" y="98" width="40" height="24" rx="6"/><text class="tx" x="244" y="114" text-anchor="middle">R6</text>
<rect class="bx" x="278" y="98" width="40" height="24" rx="6"/><text class="tx" x="298" y="114" text-anchor="middle">CUST</text>
<rect class="bx" x="140" y="30" width="40" height="24" rx="6"/><text class="tx" x="160" y="46" text-anchor="middle">R1</text>
<text class="sm" x="22" y="138" text-anchor="middle">8.8.8.0/24</text><text class="sm" x="76" y="138" text-anchor="middle">BGP</text><text class="sm" x="244" y="138" text-anchor="middle">BGP</text>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><animateMotion dur="14s" repeatCount="indefinite" path="M298 92 L244 92 L196 146" keyPoints="0;0;1;1" keyTimes="0;0.04;0.24;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.25;0.26;1"/></g>
<g opacity="0"><path class="lr" d="M220 154 L232 166 M232 154 L220 166"/><text class="sm rd" x="196" y="192" text-anchor="middle">8.8.8.8? маршрута нет</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.25;0.26;0.48;0.49;1"/></g>
<g opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="2" class="env"/><path d="M-9 -6 L0 1 L9 -6" class="envl"/><rect x="-14" y="-21" width="28" height="12" rx="3" class="pu"/><text class="wt2" x="0" y="-12" text-anchor="middle">к R2</text><animateMotion dur="14s" repeatCount="indefinite" path="M244 92 L196 146 L124 146 L76 92 L22 92" keyPoints="0;0;1;1" keyTimes="0;0.54;0.9;1" calcMode="linear"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.53;0.54;0.9;0.91;1"/></g>
<g><text class="sm" x="160" y="210" text-anchor="middle">R6 отдал пакет к R2 через R4, а R4 смотрит</text><text class="sm rd" x="160" y="224" text-anchor="middle">на адрес 8.8.8.8 — и маршрута не находит</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><text class="sm" x="160" y="210" text-anchor="middle">С MPLS (глава 10) пакет едет по метке «к R2»:</text><text class="sm gn" x="160" y="224" text-anchor="middle">R4 и R3 адрес назначения не смотрят</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.51;0.52;1"/></g>
</svg><figcaption>Сначала — лаба 8.1 как есть: пакет клиента умирает на R4, где нет BGP. Потом — то же ядро с MPLS из главы 10: фиолетовая метка «к R2» везёт пакет через R4 и R3, которым внешние маршруты не нужны.</figcaption></figure>
<p>Выходов два:</p>
<ol class="steps"><li><b>BGP на всех транзитных</b>: R3 и R4 тоже получают все внешние маршруты по iBGP. Работает, но у каждого P в памяти вся таблица интернета, и каждый P участвует в BGP. Это следующий раздел и задание 5.</li>
<li><b>MPLS</b>: R6 вешает на пакет метку «к R2», и P пересылают его по метке, не глядя на адрес назначения. Ядро без BGP — то, что ты разобрал в главе 10. Именно эта проблема и сделала MPLS стандартом у провайдеров.</li></ol>
<div class="callout pro"><b>Запомни формулу</b>«Next-hop достижим» не значит «каждый хоп по дороге знает адрес назначения». В IP-сети без меток рекурсивный поиск на PE не помогает транзитным маршрутизаторам: каждый решает сам, по адресу в пакете.</div>
<div class="callout lab"><b>В лабе</b>Задание 4: с CUST пингуешь 8.8.8.8, по traceroute и <code>show ip route 8.8.8.8</code> на R4 находишь, где пропадает пакет, и записываешь почему. <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: у R6 маршрут к 8.8.8.0/24 рабочий, next-hop R2 достижим. Почему пакет не доходит?</summary><p>Транзитный R4 маршрутизирует по адресу назначения 8.8.8.8, а BGP и маршрута к этой сети у него нет. Next-hop знает только R6, в пакет он не записывается.</p></details>
<details class="chk"><summary>Проверь себя: какие два выхода и чем плох первый?</summary><p>BGP со всеми внешними маршрутами на всех P — дорого: память, сходимость, всё ядро зависит от интернет-таблицы. Или MPLS — P пересылают по метке, и BGP им не нужен.</p></details>`},

{h:'Правило iBGP и полная сетка', html:`
<p>После задания 4 напрашивается простое решение: пусть R3 и R4 тоже знают внешние маршруты. Поднимаешь iBGP от R6 к R4 — и маршрута 8.8.8.0/24 у R4 всё равно нет. Срабатывает главное правило iBGP.</p>
<h3>Правило: от iBGP-соседа — не другим iBGP-соседям</h3>
<p>В eBGP петли ловит AS_PATH: увидел в пути свой номер — выбросил маршрут. Внутри одной AS номер к пути не добавляется, и петлю так не поймать. Поэтому правило жёсткое: <b>маршрут, полученный от iBGP-соседа, другим iBGP-соседям не передаётся</b>. R6 получил 8.8.8.0/24 от R2 по iBGP — и дальше, к R4, он его не отдаст.</p>
<p>Следствие: каждый, кому нужны маршруты R2, должен держать сессию с R2 напрямую. В общем виде — каждый маршрутизатор с BGP держит сессию с каждым. Это <b>полная сетка</b> (full mesh), и число сессий в ней растёт как N × (N − 1) / 2:</p>
<figure class="dg"><svg viewBox="0 0 320 192" role="img" aria-label="Полная сетка iBGP из четырёх маршрутизаторов — шесть сессий; для 10, 50 и 100 маршрутизаторов — 45, 1225 и 4950">
<rect class="bx" x="22" y="28" width="36" height="24" rx="6"/><text class="tx" x="40" y="44" text-anchor="middle">R2</text>
<rect class="bx" x="112" y="28" width="36" height="24" rx="6"/><text class="tx" x="130" y="44" text-anchor="middle">R6</text>
<rect class="bx" x="22" y="108" width="36" height="24" rx="6"/><text class="tx" x="40" y="124" text-anchor="middle">R3</text>
<rect class="bx" x="112" y="108" width="36" height="24" rx="6"/><text class="tx" x="130" y="124" text-anchor="middle">R4</text>
<g opacity="0"><path d="M58 40 L112 40" fill="none" stroke="#2563eb" stroke-width="1.8"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.05;0.06;1"/></g>
<g opacity="0"><path d="M40 52 L40 108" fill="none" stroke="#2563eb" stroke-width="1.8"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.1;0.11;1"/></g>
<g opacity="0"><path d="M58 50 L112 110" fill="none" stroke="#2563eb" stroke-width="1.8"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.15;0.16;1"/></g>
<g opacity="0"><path d="M112 50 L58 110" fill="none" stroke="#2563eb" stroke-width="1.8"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.2;0.21;1"/></g>
<g opacity="0"><path d="M130 52 L130 108" fill="none" stroke="#2563eb" stroke-width="1.8"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.25;0.26;1"/></g>
<g opacity="0"><path d="M58 120 L112 120" fill="none" stroke="#2563eb" stroke-width="1.8"/><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.3;0.31;1"/></g>
<g opacity="0"><text class="sm bt" x="85" y="156" text-anchor="middle" style="font-weight:700">сессий: 6</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.36;0.37;1"/></g>
<text class="sm" x="176" y="20" style="font-weight:700;fill:var(--tx)">маршрутизаторов — сессий</text>
<g opacity="0"><text class="sm" x="176" y="44">4 — 6</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.42;0.43;1"/></g>
<g opacity="0"><text class="sm" x="176" y="68">10 — 45</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.52;0.53;1"/></g>
<g opacity="0"><text class="sm og" x="176" y="92">50 — 1225</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.62;0.63;1"/></g>
<g opacity="0"><text class="sm rd" x="176" y="116" style="font-weight:700">100 — 4950</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.72;0.73;1"/></g>
<g opacity="0"><text class="sm" x="176" y="146">N × (N − 1) / 2</text><animate attributeName="opacity" dur="14s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.82;0.83;1"/></g>
<text class="sm" x="160" y="184" text-anchor="middle">Каждый новый маршрутизатор — сессии со всеми</text>
</svg><figcaption>Слева синие линии — iBGP-сессии полной сетки из четырёх маршрутизаторов лабы: их шесть. Справа — сколько сессий нужно сетям побольше.</figcaption></figure>
<p>Для четырёх маршрутизаторов — 6 сессий, терпимо. Для сотни — почти пять тысяч, и каждый новый маршрутизатор — это правка конфигурации на всех остальных. А ещё в полной сетке BGP стоит на всех P, и у каждого в памяти вся таблица интернета. От первой беды спасает route reflector (следующий раздел), от второй — MPLS (раздел 4 и глава 10).</p>
<div class="callout warn"><b>next-hop-self — к каждому новому соседу</b>Добавляя в сетку R3 и R4, не забудь next-hop-self на бордерах и в их сторону. Иначе у R3 и R4 тоже будет «inaccessible» (раздел 3).</div>
<div class="callout lab"><b>В лабе</b>Задание 5: полная сетка между R2, R3, R4 и R6 — посчитаешь сессии и проверишь, что пинг CUST → 8.8.8.8 пошёл. <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: почему iBGP не передаёт маршрут от одного iBGP-соседа другому?</summary><p>Внутри AS номер AS к пути не добавляется, и петлю по AS_PATH не поймать. Правило «не передавать дальше» заменяет эту защиту.</p></details>
<details class="chk"><summary>Проверь себя: сессии iBGP R2–R6 и R6–R4, а R2–R4 нет. Получит ли R4 маршрут аплинка от R2?</summary><p>Нет. R6 получил его от iBGP-соседа и другому iBGP-соседу не отдаст. Нужна сессия R2–R4 или route reflector.</p></details>
<details class="chk"><summary>Проверь себя: сколько сессий в полной сетке из 10 маршрутизаторов?</summary><p>10 × 9 / 2 = 45.</p></details>`},

{h:'Route reflector: кому разрешено нарушать правило', html:`
<p><b>Route reflector</b> (RR, «отражатель маршрутов») — маршрутизатор, которому разрешено нарушать правило iBGP ради своих <b>клиентов</b>. Клиенты держат сессию только с RR (в рабочей сети — с двумя RR), а RR передаёт маршруты между ними.</p>
<h3>Правила отражения</h3>
<table><tr><th>Маршрут получен от</th><th>RR передаёт его</th></tr>
<tr><td>клиента</td><td>всем: клиентам, обычным iBGP-соседям и по eBGP</td></tr>
<tr><td>обычного iBGP-соседа (не клиента)</td><td>только клиентам и по eBGP</td></tr>
<tr><td>eBGP-соседа</td><td>всем</td></tr></table>
<p>Обычные iBGP-соседи RR (не клиенты) — это, например, другие RR: между собой они связаны полной сеткой и получают всё напрямую, поэтому отражать им друг друга не нужно.</p>
<p>Клиент о том, что он клиент, не знает и ничего особого не настраивает: у него обычная iBGP-сессия к RR. Вся логика — на RR:</p>
<pre class="cli">R1(config)#router bgp 64500
R1(config-router)#bgp cluster-id 1.1.1.1
R1(config-router)#neighbor CLIENTS peer-group
R1(config-router)#neighbor CLIENTS remote-as 64500
R1(config-router)#neighbor CLIENTS update-source Loopback0
R1(config-router)#neighbor CLIENTS route-reflector-client
R1(config-router)#neighbor CLIENTS send-community both
R1(config-router)#neighbor 10.255.0.2 peer-group CLIENTS
R1(config-router)#neighbor 10.255.0.3 peer-group CLIENTS
R1(config-router)#neighbor 10.255.0.4 peer-group CLIENTS
R1(config-router)#neighbor 10.255.0.6 peer-group CLIENTS</pre>
<p><b>Peer-group</b> — шаблон: общие настройки пишутся один раз, а соседи просто включаются в группу. Для RR с десятками клиентов это обычная практика.</p>
<figure class="dg"><svg viewBox="0 0 320 230" role="img" aria-label="Route reflector R1: маршрут от клиента R2 отражается клиентам R3, R4 и R6, маршрут клиента CUST от R6 — остальным">
<path class="ln" d="M42 110 L56 110 M88 122 L112 150 M144 162 L176 162 M208 150 L232 122 M264 110 L278 110 M140 48 L92 98 M180 48 L228 98" style="opacity:.45"/>
<path d="M150 54 L86 98 M154 54 L128 150 M166 54 L192 150 M170 54 L234 98" fill="none" stroke="#7c3aed" stroke-width="1.6" stroke-dasharray="4 3"/>
<rect class="bx" x="2" y="98" width="40" height="24" rx="6"/><text class="tx" x="22" y="114" text-anchor="middle">UP</text>
<rect class="bx" x="56" y="98" width="40" height="24" rx="6"/><text class="tx" x="76" y="114" text-anchor="middle">R2</text>
<rect class="bx" x="104" y="150" width="40" height="24" rx="6"/><text class="tx" x="124" y="166" text-anchor="middle">R3</text>
<rect class="bx" x="176" y="150" width="40" height="24" rx="6"/><text class="tx" x="196" y="166" text-anchor="middle">R4</text>
<rect class="bx" x="224" y="98" width="40" height="24" rx="6"/><text class="tx" x="244" y="114" text-anchor="middle">R6</text>
<rect class="bx" x="278" y="98" width="40" height="24" rx="6"/><text class="tx" x="298" y="114" text-anchor="middle">CUST</text>
<rect class="bx" x="140" y="30" width="40" height="24" rx="6" style="stroke:#7c3aed"/><text class="tx" x="160" y="46" text-anchor="middle">R1</text>
<text class="sm" x="160" y="20" text-anchor="middle">route reflector</text>
<g opacity="0"><rect x="-31" y="-7" width="62" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M84 94 L152 58" keyPoints="0;0;1;1" keyTimes="0;0.04;0.2;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.03;0.04;0.21;0.22;1"/></g>
<g opacity="0"><rect x="-31" y="-7" width="62" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M156 62 L128 142" keyPoints="0;0;1;1" keyTimes="0;0.24;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.23;0.24;0.43;0.44;1"/></g>
<g opacity="0"><rect x="-31" y="-7" width="62" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M164 62 L192 142" keyPoints="0;0;1;1" keyTimes="0;0.24;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.23;0.24;0.43;0.44;1"/></g>
<g opacity="0"><rect x="-31" y="-7" width="62" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">8.8.8.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M168 58 L236 94" keyPoints="0;0;1;1" keyTimes="0;0.24;0.42;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.23;0.24;0.43;0.44;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">198.18.0.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M236 94 L168 58" keyPoints="0;0;1;1" keyTimes="0;0.54;0.7;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.53;0.54;0.71;0.72;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">198.18.0.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M152 58 L84 94" keyPoints="0;0;1;1" keyTimes="0;0.74;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.73;0.74;0.93;0.94;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">198.18.0.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M156 62 L128 142" keyPoints="0;0;1;1" keyTimes="0;0.74;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.73;0.74;0.93;0.94;1"/></g>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="g"/><text class="wt2" x="0" y="3" text-anchor="middle">198.18.0.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M164 62 L192 142" keyPoints="0;0;1;1" keyTimes="0;0.74;0.92;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.73;0.74;0.93;0.94;1"/></g>
<g><text class="sm" x="160" y="206" text-anchor="middle">R2 отдаёт свой внешний маршрут только RR,</text><text class="sm" x="160" y="220" text-anchor="middle">а RR отражает его всем клиентам</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.51;1"/></g>
<g opacity="0"><text class="sm" x="160" y="206" text-anchor="middle">Так же уходит сеть клиента от R6. У каждого</text><text class="sm" x="160" y="220" text-anchor="middle">одна сессия — с RR, а не со всеми</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.51;0.52;1"/></g>
</svg><figcaption>Фиолетовый пунктир — iBGP-сессии клиентов с RR (физически они идут по линкам через IS-IS). Синяя наклейка — сеть аплинка: R2 отдал её RR, RR отразил трём остальным клиентам. Зелёная — сеть клиента CUST: путь от R6 через RR ко всем.</figcaption></figure>
<h3>Как RR не устраивает петлю</h3>
<p>Нарушая правило, RR должен защититься от петель по-другому. Для этого он добавляет к маршруту два атрибута:</p>
<ul><li><b>ORIGINATOR_ID</b> — router-id того, кто ввёл маршрут в AS (здесь R2, 10.255.0.2). Получил маршрут со своим ORIGINATOR_ID — выбросил.</li>
<li><b>CLUSTER_LIST</b> — список кластеров RR, через которые прошёл маршрут. Кластер — это RR вместе с его клиентами, а номер кластера (cluster-id) по умолчанию равен router-id RR. RR увидел в списке свой cluster-id — выбросил.</li></ul>
<pre class="cli">R4#show ip bgp 8.8.8.0/24
BGP routing table entry for 8.8.8.0/24, version 7
Paths: (1 available, best #1, table default)
  64510
    10.255.0.2 (metric 20) from [[10.255.0.1]] (10.255.0.1)
      Origin IGP, metric 0, localpref 100, valid, internal, best
      [[Originator: 10.255.0.2, Cluster list: 1.1.1.1]]</pre>
<p>Читаем: next-hop — 10.255.0.2, loopback R2 (спасибо next-hop-self), до него по IS-IS метрика 20. Получено <b>from</b> 10.255.0.1 — от RR. Originator — R2, маршрут прошёл кластер 1.1.1.1.</p>
<div class="callout warn"><b>RR не меняет next-hop</b>Отражая маршрут, RR оставляет next-hop как был. Поэтому next-hop-self делают бордеры для своих внешних маршрутов, а не RR. Забыли на бордере — у всех клиентов RR «inaccessible».</div>
<div class="callout lab"><b>В лабе</b>Задание 6: соберёшь RR на R1, уберёшь полную сетку и найдёшь у R4 Originator и Cluster list. Поломка 1: у всех клиентов пропали чужие маршруты — R1 перестал быть отражателем. <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: на RR пришёл маршрут от обычного iBGP-соседа (не клиента). Кому RR его отдаст?</summary><p>Только своим клиентам и eBGP-соседям. Другим не-клиентам — нет: они связаны полной сеткой и получат его напрямую.</p></details>
<details class="chk"><summary>Проверь себя: что настраивают на клиенте RR?</summary><p>Ничего особого: обычная iBGP-сессия к RR по loopback. Вся логика отражения — на RR (route-reflector-client).</p></details>
<details class="chk"><summary>Проверь себя: зачем ORIGINATOR_ID и CLUSTER_LIST?</summary><p>Защита от петель при отражении: по ним маршрутизатор узнаёт свой же маршрут (ORIGINATOR_ID), а RR — маршрут, уже прошедший через его кластер (CLUSTER_LIST).</p></details>`},

{h:'RR в настоящей сети: два отражателя и чужая точка зрения', html:`
<h3>Двух RR — обязательно</h3>
<p>Один RR — единая точка отказа: упал он, и маршруты перестали ходить по всей сети. Поэтому каждый клиент держит сессии с двумя RR. Пару можно сделать одним кластером (одинаковый cluster-id) или двумя (разные). Одинаковый экономит память: каждый RR выбросит копию маршрута, уже прошедшую через «свой» кластер. Разные дают больше путей и лучше переживают сбои — так делают чаще. В очень больших сетях RR строят иерархией, а для разных услуг (интернет, VPNv4, EVPN) часто ставят отдельные RR.</p>
<h3>RR не обязан пересылать трафик</h3>
<p>RR занимается только маршрутами. Ему не нужно стоять на пути трафика — и обычно он стоит сбоку, как R1 в лабе (линки к нему дорогие, metric 1000). Часто это вообще отдельная машина или виртуалка, которая не пересылает ни одного пакета абонентов. Такой RR называют control-plane RR. Ему нужны память и процессор для маршрутов, а не скорость пересылки.</p>
<h3>Главный побочный эффект: RR выбирает за всех</h3>
<p>RR отдаёт клиентам только <b>свой</b> лучший путь. А выбирает он его со своей точки зрения: на шаге 8 лестницы (раздел 6 книги 8) побеждает ближайший к RR выход по IGP, а не ближайший к клиенту.</p>
<figure class="dg"><svg viewBox="0 0 320 214" role="img" aria-label="RR возле Москвы выбирает выход через московский бордер и отражает только его; R6 во Владивостоке гонит трафик через всю страну. С add-path R6 получает оба пути и выбирает ближний">
<path class="ln" d="M76 52 L244 52 M48 64 L76 120 M108 132 L212 132 M272 64 L248 120"/>
<rect class="bx" x="20" y="40" width="56" height="24" rx="6"/><text class="tx" x="48" y="56" text-anchor="middle">R2</text>
<rect class="bx" x="244" y="40" width="56" height="24" rx="6"/><text class="tx" x="272" y="56" text-anchor="middle">R7</text>
<rect class="bx" x="56" y="120" width="52" height="24" rx="6" style="stroke:#7c3aed"/><text class="tx" x="82" y="136" text-anchor="middle">RR</text>
<rect class="bx" x="212" y="120" width="52" height="24" rx="6"/><text class="tx" x="238" y="136" text-anchor="middle">R6</text>
<text class="sm" x="48" y="32" text-anchor="middle">Москва</text><text class="sm" x="272" y="32" text-anchor="middle">Владивосток</text>
<text class="sm" x="160" y="46" text-anchor="middle">200</text><text class="sm" x="54" y="96" text-anchor="end">10</text><text class="sm" x="160" y="146" text-anchor="middle">100</text><text class="sm" x="268" y="96">10</text>
<g opacity="0"><rect x="-24" y="-7" width="48" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">путь R2</text><animateMotion dur="16s" repeatCount="indefinite" path="M54 72 L76 114" keyPoints="0;0;1;1" keyTimes="0;0.03;0.13;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.14;0.15;1"/></g>
<g opacity="0"><rect x="-24" y="-7" width="48" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">путь R7</text><animateMotion dur="16s" repeatCount="indefinite" path="M262 72 L104 118" keyPoints="0;0;1;1" keyTimes="0;0.03;0.18;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.19;0.2;1"/></g>
<g opacity="0"><text class="sm gn" x="82" y="164" text-anchor="middle">лучший для RR: R2</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.19;0.2;0.49;0.5;1"/></g>
<g opacity="0"><rect x="-24" y="-7" width="48" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">путь R2</text><animateMotion dur="16s" repeatCount="indefinite" path="M112 124 L208 124" keyPoints="0;0;1;1" keyTimes="0;0.21;0.31;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.2;0.21;0.32;0.33;1"/></g>
<g opacity="0"><rect x="-6" y="-4" width="12" height="8" rx="2" class="rr"/><animateMotion dur="16s" repeatCount="indefinite" path="M212 132 L108 132 L76 120 L48 64" keyPoints="0;0;1;1" keyTimes="0;0.33;0.46;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.32;0.33;0.46;0.47;1"/></g>
<g opacity="0"><rect x="-6" y="-4" width="12" height="8" rx="2" class="rr"/><animateMotion dur="16s" repeatCount="indefinite" path="M212 132 L108 132 L76 120 L48 64" keyPoints="0;0;1;1" keyTimes="0;0.38;0.5;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.37;0.38;0.5;0.51;1"/></g>
<g opacity="0"><rect x="-24" y="-7" width="48" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">путь R2</text><animateMotion dur="16s" repeatCount="indefinite" path="M112 122 L208 122" keyPoints="0;0;1;1" keyTimes="0;0.55;0.65;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.66;0.67;1"/></g>
<g opacity="0"><rect x="-24" y="-7" width="48" height="14" rx="3" class="o"/><text class="wt2" x="0" y="3" text-anchor="middle">путь R7</text><animateMotion dur="16s" repeatCount="indefinite" path="M112 140 L208 140" keyPoints="0;0;1;1" keyTimes="0;0.55;0.65;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.54;0.55;0.66;0.67;1"/></g>
<g opacity="0"><text class="sm gn" x="238" y="164" text-anchor="middle">R6 выбрал R7: ближе</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.67;0.68;0.97;1"/></g>
<g opacity="0"><rect x="-6" y="-4" width="12" height="8" rx="2" class="g"/><animateMotion dur="16s" repeatCount="indefinite" path="M248 120 L272 64" keyPoints="0;0;1;1" keyTimes="0;0.7;0.8;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.69;0.7;0.8;0.81;1"/></g>
<g opacity="0"><rect x="-6" y="-4" width="12" height="8" rx="2" class="g"/><animateMotion dur="16s" repeatCount="indefinite" path="M248 120 L272 64" keyPoints="0;0;1;1" keyTimes="0;0.84;0.94;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.83;0.84;0.94;0.95;1"/></g>
<g><text class="sm" x="160" y="192" text-anchor="middle">RR выбрал лучший путь со своего места —</text><text class="sm rd" x="160" y="206" text-anchor="middle">через R2 — и отдал R6 только его</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.52;0.53;1"/></g>
<g opacity="0"><text class="sm" x="160" y="192" text-anchor="middle">add-path: RR отдаёт оба пути, и R6 сам</text><text class="sm gn" x="160" y="206" text-anchor="middle">выбирает ближайший выход — R7</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.53;0.54;1"/></g>
</svg><figcaption>Оба бордера, R2 в Москве и R7 во Владивостоке, получают 8.8.8.0/24 с одинаковыми атрибутами. Числа на линиях — метрики IGP. RR стоит у Москвы: для него ближе R2, и только этот путь он отражает. R6 во Владивостоке гонит трафик через всю страну, хотя рядом свой выход. С add-path R6 получает оба пути и выбирает сам.</figcaption></figure>
<p>Лечат это тремя способами:</p>
<ul><li><b>Ставить RR с умом</b> — например, свою пару RR в каждом регионе.</li>
<li><b>Add-path</b> (RFC 7911) — RR передаёт не один, а несколько путей к сети, и клиент выбирает сам. Заодно при отказе бордера у клиента уже есть запасной путь — переключение быстрее.</li>
<li><b>Optimal route reflection</b> (ORR, RFC 9107) — RR считает лучший путь с точки зрения клиента, а не своей.</li></ul>
<h3>Конфедерации и шаблоны</h3>
<p>Есть и другой способ уйти от полной сетки — <b>конфедерация</b>: AS делится на под-AS с частными номерами. Внутри под-AS — полная сетка, между ними — особый eBGP, при котором next-hop, local-pref и MED сохраняются как в iBGP, а номера под-AS пишутся в отдельную часть AS_PATH. Снаружи всё выглядит одной AS. Встречается при слиянии компаний с разными AS. В остальных случаях почти всегда выбирают RR.</p>
<p>Для десятков соседей с одинаковыми настройками есть шаблоны: <b>peer-group</b> (ты видел его на RR) и более гибкие <code>template peer-session</code> / <code>template peer-policy</code> с наследованием.</p>
<div class="callout lab"><b>В лабе</b>Задание «Со звёздочкой»: второй выход к UP через R6 и RR поближе к R2 — увидишь проблему лучшего пути RR своими глазами, а на CSR1000v попробуешь add-path. <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: зачем клиенту RR сессии с двумя RR?</summary><p>Один RR — единая точка отказа: упадёт, и маршруты перестанут ходить. Со вторым RR клиент продолжает получать маршруты.</p></details>
<details class="chk"><summary>Проверь себя: почему клиент RR может выходить через дальний бордер?</summary><p>RR отражает только свой лучший путь, а выбирает его по расстоянию IGP от себя, а не от клиента. Лечат расстановкой RR, add-path и ORR.</p></details>
<details class="chk"><summary>Проверь себя: что такое control-plane RR?</summary><p>RR, который стоит вне пути трафика и занимается только маршрутами — часто отдельная машина или виртуалка.</p></details>`},

{h:'Ярлыки внутри провайдера и поиск пропавшей сети', html:`
<p>В главе 8 ты помечал маршруты клиента ярлыком на входе, чтобы выпускать к пиру только их. В большой сети с RR это главный способ держать политику. Решение «откуда маршрут» принимают на входе — там, где это точно известно. А на выходе только читают ярлык.</p>
<table><tr><th>Ярлык</th><th>Смысл</th><th>Кто ставит</th></tr>
<tr><td>64500:100</td><td>маршрут клиента</td><td>PE на входе от клиента</td></tr>
<tr><td>64500:200</td><td>маршрут пира</td><td>бордер на входе от пира</td></tr>
<tr><td>64500:300</td><td>маршрут аплинка</td><td>бордер на входе от аплинка</td></tr>
<tr><td>64500:1001, :1002…</td><td>город входа: Москва, Петербург…</td><td>все граничные</td></tr>
<tr><td>64500:80, :666</td><td>команды от клиента: «сделай резервным», blackhole</td><td>клиент</td></tr></table>
<figure class="dg"><svg viewBox="0 0 320 196" role="img" aria-label="Сеть клиента получает ярлык 64500:100 на R6 и выходит к аплинку на R2; сеть пира получает ярлык :200 и к аплинку не проходит">
<path class="ln" d="M44 62 L64 62 M104 62 L124 62 M196 62 L216 62 M256 62 L276 62 M236 74 L236 118"/>
<rect class="bx" x="4" y="50" width="40" height="24" rx="6"/><text class="tx" x="24" y="66" text-anchor="middle">UP</text>
<rect class="bx" x="64" y="50" width="40" height="24" rx="6"/><text class="tx" x="84" y="66" text-anchor="middle">R2</text>
<rect class="bxd" x="124" y="46" width="72" height="32" rx="6"/><text class="sm" x="160" y="66" text-anchor="middle">ядро и RR</text>
<rect class="bx" x="216" y="50" width="40" height="24" rx="6"/><text class="tx" x="236" y="66" text-anchor="middle">R6</text>
<rect class="bx" x="276" y="50" width="40" height="24" rx="6"/><text class="tx" x="296" y="66" text-anchor="middle">CUST</text>
<rect class="bx" x="216" y="118" width="40" height="24" rx="6"/><text class="tx" x="236" y="134" text-anchor="middle">пир</text>
<text class="sm" x="24" y="90" text-anchor="middle">аплинк</text><text class="sm" x="296" y="90" text-anchor="middle">клиент</text>
<g opacity="0"><rect x="-38" y="-7" width="76" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">198.18.0.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M282 36 L236 36" keyPoints="0;0;1;1" keyTimes="0;0.03;0.11;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.02;0.03;0.11;0.115;1"/></g>
<g opacity="0"><rect x="-50" y="-7" width="100" height="14" rx="3" class="b"/><text class="wt2" x="0" y="3" text-anchor="middle">198.18.0.0/24 :100</text><animateMotion dur="16s" repeatCount="indefinite" path="M236 36 L60 36" keyPoints="0;0;1;1" keyTimes="0;0.115;0.34;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.11;0.115;0.4;0.41;1"/></g>
<g opacity="0"><rect x="-40" y="-7" width="80" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">203.0.113.0/24</text><animateMotion dur="16s" repeatCount="indefinite" path="M236 110 L236 96" keyPoints="0;0;1;1" keyTimes="0;0.45;0.52;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.44;0.45;0.52;0.525;1"/></g>
<g opacity="0"><rect x="-52" y="-7" width="104" height="14" rx="3" class="gr"/><text class="wt2" x="0" y="3" text-anchor="middle">203.0.113.0/24 :200</text><animateMotion dur="16s" repeatCount="indefinite" path="M236 96 L120 96" keyPoints="0;0;1;1" keyTimes="0;0.525;0.7;1" calcMode="linear"/><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;0.52;0.525;0.73;0.74;1"/></g>
<g opacity="0"><path class="lr" d="M48 56 L60 68 M60 56 L48 68"/><text class="sm rd" x="84" y="112" text-anchor="middle">к аплинку — нет</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.74;0.75;0.97;1"/></g>
<g><text class="sm" x="160" y="174" text-anchor="middle">Сеть клиента получает ярлык :100 на входе</text><text class="sm gn" x="160" y="188" text-anchor="middle">в R6 и по нему выходит к аплинку на R2</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.42;0.43;1"/></g>
<g opacity="0"><text class="sm" x="160" y="174" text-anchor="middle">Сеть пира получает :200 — на R2 экспорт</text><text class="sm rd" x="160" y="188" text-anchor="middle">к аплинку пропускает только :100</text><animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.43;0.44;1"/></g>
</svg><figcaption>Ярлык ставится один раз — на входе в сеть. Сеть клиента с :100 проходит через ядро и RR к бордеру R2 и уходит к аплинку. Сеть пира с :200 доходит до того же R2, но экспортный фильтр к аплинку её не выпускает. Пира в лабе нет — он здесь для примера.</figcaption></figure>
<p>Экспорт тогда — одна проверка: к пирам и аплинкам — только «:100» и свои агрегаты, клиентам — всё. Это правило экспорта из главы 8, записанное в конфигурации. Подключили нового клиента — его ярлык ставит PE, а на десятке бордеров ничего менять не нужно.</p>
<div class="callout warn"><b>Ярлык должен доехать</b>send-community нужен на каждом шаге: PE → RR → бордер. На RR — в peer-group (<code>send-community both</code>), на PE — к RR. Забыли на PE — бордер получит маршрут клиента без ярлыка и не выпустит его к аплинку. Для клиента это выглядит как «наш префикс пропал из интернета».</div>
<h3>Поиск пропавшей сети клиента</h3>
<p>Клиент пишет: «нашу сеть не видно из интернета». Иди по цепочке от входа к выходу:</p>
<ol class="steps"><li><b>Принята ли на PE.</b> <code>show ip bgp neighbors X routes</code> — прошла ли фильтры (prefix-list, RPKI).</li>
<li><b>Какой ярлык получила.</b> <code>show ip bgp СЕТЬ</code> на PE — строка Community.</li>
<li><b>Дошла ли до RR и бордера.</b> <code>show ip bgp СЕТЬ</code> на RR и на бордере: есть ли, с каким next-hop и ярлыком, есть ли «&gt;».</li>
<li><b>Пропускает ли экспорт.</b> <code>show ip bgp neighbors АПЛИНК advertised-routes</code> на бордере.</li>
<li><b>Видна ли снаружи.</b> Looking glass аплинка, RIPEstat, bgp.he.net.</li></ol>
<div class="callout lab"><b>В лабе</b>Задание 7: R6 метит сеть клиента 64500:100, R2 — сети аплинка 64500:300, а к аплинку R2 выпускает только :100. Проверишь, что UP видит сеть клиента, а клиент — 8.8.8.0/24. <a href="#/c/ch08b/lab">Открыть лабу →</a></div>

<details class="chk"><summary>Проверь себя: зачем ставить ярлыки на входе, а не перечислять сети клиентов на бордерах?</summary><p>Чтобы не править бордеры при каждом новом клиенте. Решение «откуда маршрут» принимают там, где это известно, — на входе, а бордеры только читают ярлык.</p></details>
<details class="chk"><summary>Проверь себя: сеть клиента есть на бордере, но аплинк её не видит. Что проверишь?</summary><p>Какой у неё ярлык на бордере (дошёл ли: send-community на PE и RR) и есть ли она в advertised-routes к аплинку.</p></details>
<details class="chk"><summary>Проверь себя: где ставят ярлык «маршрут клиента»?</summary><p>На PE, на входе от клиента — route-map на сессии с клиентом.</p></details>`}
],
end: `<h3>Что ты теперь знаешь</h3>
<p>Внутри своей сети маршруты внешнего мира и клиентов переносит iBGP, а IGP знает только инфраструктуру. Сессии iBGP идут между loopback'ами — с update-source с обеих сторон. У iBGP два правила, из которых следует всё остальное. Первое: next-hop не меняется, поэтому бордер делает next-hop-self, иначе маршрут «есть, но не работает». Второе: маршрут от iBGP-соседа другим iBGP-соседям не передаётся, отсюда полная сетка. Её заменяет route reflector: он отражает маршруты клиентам и ставит ORIGINATOR_ID и CLUSTER_LIST против петель, но отдаёт только свой лучший путь — это лечат add-path и расстановкой RR. А транзитные маршрутизаторы без BGP роняют трафик к внешним адресам: либо BGP на всех, либо MPLS. Политику по всей сети держат ярлыки, поставленные на входе.</p>
<div class="callout ok"><b>Посмотри у себя на работе</b><ol><li>Есть ли у вас route reflector'ы, сколько их и стоят ли они в пути трафика.</li><li>На любом PE — <code>show ip bgp summary</code>: с кем сессии? Только с RR — значит, у вас отражатели.</li><li>Найди любой внешний маршрут на PE и посмотри Originator и Cluster list: какой бордер его ввёл и через какой RR он пришёл.</li><li>Есть ли у вас документ со схемой ярлыков-community: что значит каждый и кто его ставит.</li></ol></div>
<p>Следующая по плану глава 11.1 — доступ в интернет для клиентов L3VPN. Дальше по этой главе: карточки, тест (кнопка «🤷 Не знаю» на месте), «Объясни своими словами» и лаба — семь заданий и три поломки.</p>`
};
