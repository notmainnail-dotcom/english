// Каркас курса: части, порядок глав, метаданные.
// Содержимое глав лежит в data/chXX.js и регистрируется через COURSE.add({...}).
window.COURSE = {
  date: '2026-10-05',
  parts: [
    { id: 'p1', title: 'Часть I. Фундамент', sub: 'L1–L3, коммутация, статика, STP, ACL/NAT — быстро и глубоко, с упором на диагностику' },
    { id: 'p2', title: 'Часть II. Маршрутизация', sub: 'IGP (OSPF, IS-IS), туннели и VPN, BGP — ядро работы у провайдера' },
    { id: 'p3', title: 'Часть III. Провайдерские технологии', sub: 'Мультикаст, MPLS, L3VPN, L2VPN, EVPN, TE, путь пакета, QoS' },
    { id: 'p4', title: 'Часть IV. Дата-центры и железо', sub: 'ECMP, фабрики Clos, буферы и чипы' }
  ],
  // Порядок и метаданные. src — исходная статья цикла linkmeup.
  list: [
    { id: 'ch01', num: '1',   part: 'p1', title: 'Подключение к оборудованию', src: 'https://linkmeup.ru/blog/12.html' },
    { id: 'ch02', num: '2',   part: 'p1', title: 'Коммутация и VLAN', src: 'https://linkmeup.ru/blog/13.html' },
    { id: 'ch03', num: '3',   part: 'p1', title: 'Статическая маршрутизация', src: 'https://linkmeup.ru/blog/14.html' },
    { id: 'ch04', num: '4',   part: 'p1', title: 'L2, STP и агрегация', src: 'https://linkmeup.ru/blog/15.html' },
    { id: 'ch05', num: '5',   part: 'p1', title: 'ACL и NAT', src: 'https://linkmeup.ru/blog/16.html' },
    { id: 'ch06', num: '6',   part: 'p2', title: 'Динамическая маршрутизация: OSPF и IS-IS', src: 'https://linkmeup.ru/blog/33.html' },
    { id: 'ch07', num: '7',   part: 'p2', title: 'VPN: GRE, IPsec, DMVPN', src: 'https://linkmeup.ru/blog/50.html' },
    { id: 'ch08', num: '8',   part: 'p2', title: 'BGP и IP SLA', src: 'https://linkmeup.ru/blog/65.html' },
    { id: 'ch08b', num: '8.1', part: 'p2', title: 'iBGP: route reflector и масштаб', src: 'https://linkmeup.ru/blog/92.html' },
    { id: 'ch09', num: '9',   part: 'p3', title: 'Мультикаст', src: 'https://linkmeup.ru/blog/129.html' },
    { id: 'ch10', num: '10',  part: 'p3', title: 'Базовый MPLS', src: 'https://linkmeup.ru/blog/154.html' },
    { id: 'ch11', num: '11',  part: 'p3', title: 'MPLS L3VPN', src: 'https://linkmeup.ru/blog/204.html' },
    { id: 'ch11b', num: '11.1', part: 'p3', title: 'L3VPN и доступ в Интернет', src: 'https://linkmeup.ru/blog/248.html' },
    { id: 'ch12', num: '12',  part: 'p3', title: 'MPLS L2VPN: VPWS и VPLS', src: 'https://linkmeup.ru/blog/261.html' },
    { id: 'ch12b', num: '12.1', part: 'p3', title: 'EVPN', src: 'https://linkmeup.ru/blog/1221/' },
    { id: 'ch12c', num: '12.2', part: 'p3', title: 'EVPN Multihoming', src: 'https://linkmeup.ru/blog/1231/' },
    { id: 'ch13', num: '13',  part: 'p3', title: 'MPLS Traffic Engineering', src: 'https://linkmeup.ru/blog/302.html' },
    { id: 'ch14', num: '14',  part: 'p3', title: 'Путь пакета', src: 'https://linkmeup.ru/blog/312.html' },
    { id: 'ch15', num: '15',  part: 'p3', title: 'QoS', src: 'https://linkmeup.ru/blog/1244/' },
    { id: 'x1',   num: 'Д1',  part: 'p4', title: 'ECMP и балансировка', src: 'https://linkmeup.ru/blog/903/' },
    { id: 'x2',   num: 'Д2',  part: 'p4', title: 'Как построить Гугл: фабрики ЦОД', src: 'https://linkmeup.ru/blog/1262/' },
    { id: 'x3',   num: 'Д3',  part: 'p4', title: 'Где сохранить пакет: буферы и чипы', src: 'https://linkmeup.ru/blog/920/' }
  ],
  ch: {},
  add(c) { this.ch[c.id] = c; }
};
