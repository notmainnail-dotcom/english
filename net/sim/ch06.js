// Тренажёр дежурного, глава 6: та же сеть, что в лабе («Сибирское кольцо», area 0 / IS-IS L2, Питер не показан).
// Модель: линки, состояния соседств, стоимости → выводы show, таблица маршрутов (SPF), ping и traceroute.
// Случай = поломка (опции build) + доп. выводы (логи, debug) + вопросы «что сломано» и «как починить».
window.SIM = window.SIM || {};
(function () {
'use strict';
const NODES = ['R1', 'R3', 'R4', 'R5', 'R6'];
const CITY = { R1: 'Москва', R3: 'Кемерово', R4: 'Красноярск', R5: 'Владивосток', R6: 'Хабаровск' };
const LAT = { R1: 'Moscow', R3: 'Kemerovo', R4: 'Krasnoyarsk', R5: 'Vladivostok', R6: 'Khabarovsk' };
// [A, интерфейс A, адрес A, B, интерфейс B, адрес B]
const LINKS = [
  ['R1', 'Gi0/1', '10.1.13.0', 'R3', 'Gi0/1', '10.1.13.1'],
  ['R1', 'Gi0/2', '10.1.15.0', 'R5', 'Gi0/2', '10.1.15.1'],
  ['R3', 'Gi0/2', '10.1.34.0', 'R4', 'Gi0/2', '10.1.34.1'],
  ['R4', 'Gi0/3', '10.1.46.0', 'R6', 'Gi0/3', '10.1.46.1'],
  ['R6', 'Gi0/1', '10.1.56.0', 'R5', 'Gi0/1', '10.1.56.1']];
const lo = r => '10.255.0.' + r.slice(1);
const full = i => i.replace(/^Gi/, 'GigabitEthernet').replace(/^Lo/, 'Loopback');
const ipn = ip => ip.split('.').reduce((a, x) => a * 256 + +x, 0);
const IFS = {}; NODES.forEach(r => IFS[r] = []);
LINKS.forEach(([a, ia, pa, b, ib, pb]) => {
  const net = pa.replace(/\d+$/, x => String(+x & ~1));
  IFS[a].push({ r: a, i: ia, ip: pa, net, peer: b, pi: ib, pip: pb });
  IFS[b].push({ r: b, i: ib, ip: pb, net, peer: a, pi: ia, pip: pa });
});
const OWN = {}; NODES.forEach(r => { OWN[lo(r)] = r; IFS[r].forEach(f => OWN[f.ip] = r); });
const IFNAMES = ['Gi0/0', 'Gi0/1', 'Gi0/2', 'Gi0/3'];

// Опции поломки:
// proto 'ospf'|'isis'; cost {'R1 Gi0/1':500}; adj {'R3 Gi0/2':'EXSTART'|'INIT'|'none'} — как R3 видит соседа на Gi0/2;
// nouse ['R1-R3'] — соседство есть, а в SPF линк не идёт; passive ['R6 Gi0/3']; pdef ['R6'] — passive-interface default;
// hello {'R5 Gi0/1':[5,20]}; mtu {'R4 Gi0/2':9216}; acl {'R3 Gi0/2':'INFRA-IN'}; bcast {'R3 Gi0/1':{me:'DR',nbr:'BDR'}};
// ol ['R4']; mute ['R3'] — его LSP никто не понимает (narrow), и он никого; narrow ['R3']; rid {'R5':'10.255.0.3'};
// hide {R1:['10.255.0.3/32']}; bfd true; age '00:41:07'; spf {R3:['00:00:03.412',214]}; lsa {R1:'текст'}.
function build(o) {
  o = o || {};
  const isis = o.proto === 'isis';
  const key = (r, i) => r + ' ' + i;
  const cost = (r, i) => (o.cost && o.cost[key(r, i)]) || 100;
  const st = (r, i) => (o.adj && o.adj[key(r, i)]) || 'FULL';
  const pas = (r, i) => (o.passive || []).includes(key(r, i));
  const mute = r => (o.mute || []).includes(r);
  const nouse = (a, b) => mute(a) || mute(b) || (o.nouse || []).some(x => x === a + '-' + b || x === b + '-' + a);
  const usable = f => st(f.r, f.i) === 'FULL' && st(f.peer, f.pi) === 'FULL' && !pas(f.r, f.i) && !pas(f.peer, f.pi) && !nouse(f.r, f.peer);
  const ol = r => (o.ol || []).includes(r);
  const rid = r => (o.rid && o.rid[r]) || lo(r);
  const mtu = (r, i) => (o.mtu && o.mtu[key(r, i)]) || 1500;
  const age = o.age || '00:41:07';
  const LOC = isis ? 10 : 1, AD = isis ? 115 : 110, CODE = isis ? 'i L2' : 'O';

  function spf(src) {
    const D = {}, H = {}; NODES.forEach(n => { D[n] = Infinity; H[n] = []; });
    D[src] = 0; const done = new Set();
    for (;;) {
      let u = null; NODES.forEach(n => { if (!done.has(n) && D[n] < Infinity && (u === null || D[n] < D[u])) u = n; });
      if (u === null) break; done.add(u);
      if (u !== src && ol(u)) continue;           // overload: через него транзита нет
      IFS[u].forEach(f => {
        if (!usable(f)) return;
        const v = f.peer, d = D[u] + cost(u, f.i), hop = u === src ? [{ nh: f.pip, i: f.i }] : H[u];
        if (d < D[v]) { D[v] = d; H[v] = hop.slice(); }
        else if (d === D[v]) hop.forEach(h => { if (!H[v].some(x => x.nh === h.nh)) H[v].push(h); });
      });
    }
    return { D, H };
  }
  // маршруты протокола на src: [{p:'10.255.0.4/32', a, m, h:[{nh,i}]}]
  const RT = {};
  function routes(src) {
    if (RT[src]) return RT[src];
    const out = [];
    if (!mute(src)) {
      const { D, H } = spf(src);
      NODES.forEach(n => { if (n !== src && D[n] < Infinity && !mute(n)) out.push({ p: lo(n) + '/32', a: lo(n), m: D[n] + LOC, h: H[n] }); });
      const seen = {};
      LINKS.forEach(([a, ia, , b, ib]) => {
        const f = IFS[a].find(z => z.i === ia); if (a === src || b === src || seen[f.net]) return; seen[f.net] = 1;
        let best = null;
        [[a, ia], [b, ib]].forEach(([n, i]) => {
          if (D[n] === Infinity || mute(n)) return;
          const m = D[n] + cost(n, i);
          if (!best || m < best.m) best = { p: f.net + '/31', a: f.net, m, h: H[n].slice() };
          else if (m === best.m) H[n].forEach(h => { if (!best.h.some(x => x.nh === h.nh)) best.h.push(h); });
        });
        if (best) out.push(best);
      });
    }
    const hide = (o.hide && o.hide[src]) || [];
    RT[src] = out.filter(x => !hide.includes(x.p)).sort((x, y) => ipn(x.a) - ipn(y.a));
    return RT[src];
  }
  // поиск маршрута для адреса: connected или протокол
  function lookup(src, ip) {
    if (OWN[ip] === src) return { self: true };
    for (const f of IFS[src]) if (f.pip === ip || f.ip === ip) return { conn: f };
    const r = routes(src).find(x => x.a === ip || (x.p.endsWith('/31') && (ipn(ip) & ~1) === ipn(x.a)));
    return r ? { r } : null;
  }
  const srcIp = (src, l) => l.conn ? l.conn.ip : l.r ? IFS[src].find(f => f.i === l.r.h[0].i).ip : lo(src);
  function reach(src, ip) {
    const l = lookup(src, ip); if (!l) return false; if (l.self) return true;
    const dst = OWN[ip]; if (!dst) return false;
    if (l.conn) return true;
    return !!lookup(dst, srcIp(src, l));   // обратный путь
  }

  // ---------- выводы ----------
  function routeLine(x) {
    const pre = (CODE + ' '.repeat(9)).slice(0, 9) + x.p + ' ';
    return x.h.map((h, k) => (k ? ' '.repeat(pre.length) : pre) + `[${AD}/${x.m}] via ${h.nh}, ${age}, ${full(h.i)}`).join('\n');
  }
  const HEAD = 'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n       O - OSPF, IA - OSPF inter area, E1 - OSPF external type 1, E2 - OSPF external type 2\n       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2\n\nGateway of last resort is not set\n\n';
  function conn(r) {
    const L = [{ a: lo(r), b: 32, t: `C        ${lo(r)}/32 is directly connected, Loopback0` }];
    IFS[r].forEach(f => { L.push({ a: f.net, b: 31, t: `C        ${f.net}/31 is directly connected, ${full(f.i)}` }); L.push({ a: f.ip, b: 32, t: `L        ${f.ip}/32 is directly connected, ${full(f.i)}` }); });
    return L;
  }
  function showRoute(r, onlyProto) {
    const P = routes(r).map(x => ({ a: x.a, b: +x.p.split('/')[1], t: routeLine(x) }));
    const C = conn(r), n = P.length + C.length;
    const L = (onlyProto ? P : P.concat(C)).sort((x, y) => ipn(x.a) - ipn(y.a) || x.b - y.b);
    return HEAD + `      10.0.0.0/8 is variably subnetted, ${n} subnets, 2 masks\n` + L.map(x => x.t).join('\n');
  }
  function routeEntry(r, ip) {
    const l = lookup(r, ip);
    if (!l) return '% Network not in table';
    if (l.self || l.conn) {
      const f = l.conn || null;
      const p = f ? (f.ip === ip ? ip + '/32' : f.net + '/31') : ip + '/32';
      return `Routing entry for ${p}\n  Known via "connected", distance 0, metric 0 (connected, via interface)\n  Routing Descriptor Blocks:\n  * directly connected, via ${f ? full(f.i) : 'Loopback0'}\n      Route metric is 0, traffic share count is 1`;
    }
    const x = l.r, from = x.p.endsWith('/32') ? x.a : rid(OWN[x.h[0].nh] || 'R1');
    return `Routing entry for ${x.p}\n  Known via "${isis ? 'isis' : 'ospf 1'}", distance ${AD}, metric ${x.m}, type ${isis ? 'level-2' : 'intra area'}\n  Last update from ${x.h[0].nh} on ${full(x.h[0].i)}, ${age} ago\n  Routing Descriptor Blocks:\n` +
      x.h.map((h, k) => `  ${k ? ' ' : '*'} ${h.nh}, from ${isis ? h.nh : from}, ${age} ago, via ${full(h.i)}\n      Route metric is ${x.m}, traffic share count is 1`).join('\n');
  }
  function ping(r, ip) {
    if (!OWN[ip] && !lookup(r, ip)) return `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`;
    const ok = reach(r, ip);
    return `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n${ok ? '!!!!!' : '.....'}\nSuccess rate is ${ok ? '100 percent (5/5), round-trip min/avg/max = 1/2/' + (3 + (ipn(ip) % 4)) + ' ms' : '0 percent (0/5)'}`;
  }
  function trace(r, ip) {
    let s = `Type escape sequence to abort.\nTracing the route to ${ip}\nVRF info: (vrf in name/id, vrf out name/id)\n`;
    const l0 = lookup(r, ip);
    if (l0 && l0.self) return s + `  1 ${ip} 0 msec 0 msec 0 msec`;
    const sip = l0 ? srcIp(r, l0) : lo(r);
    let cur = r;
    for (let n = 1; n <= 8; n++) {
      const l = lookup(cur, ip);
      if (!l || l.self) { for (let k = n; k < n + 3; k++) s += `  ${k}  *  *  *\n`; return s + '  …'; }
      const nh = l.conn ? l.conn.pip : l.r.h[0].nh, nx = OWN[nh], fin = OWN[ip] === nx;
      s += lookup(nx, sip) ? `  ${n} ${fin ? ip : nh} ${n} msec ${n + 1} msec ${n} msec\n` : `  ${n}  *  *  *\n`;
      if (fin) break;
      cur = nx;
    }
    return s.trimEnd();
  }
  function nbrOspf(r) {
    let s = 'Neighbor ID     Pri   State           Dead Time   Address         Interface\n';
    IFS[r].forEach(f => {
      const x = st(r, f.i); if (x === 'none' || pas(r, f.i)) return;
      const bc = o.bcast && o.bcast[key(r, f.i)];
      const dead = '00:00:' + (31 + (ipn(f.pip) * 7 + r.charCodeAt(1)) % 9);
      s += rid(f.peer).padEnd(16) + String(bc ? 1 : 0).padStart(3) + '   ' + (x + '/' + (bc ? bc.nbr : '  -')).padEnd(16) + dead.padEnd(12) + f.pip.padEnd(16) + full(f.i) + '\n';
    });
    return s.trimEnd();
  }
  function ospfBrief(r) {
    let s = 'Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C\n';
    s += 'Lo0'.padEnd(13) + '1'.padEnd(6) + '0'.padEnd(16) + (lo(r) + '/32').padEnd(19) + '1'.padEnd(6) + 'LOOP'.padEnd(6) + '0/0\n';
    IFS[r].slice().reverse().forEach(f => {
      const bc = o.bcast && o.bcast[key(r, f.i)], x = st(r, f.i), p = pas(r, f.i);
      const fc = p || x === 'none' ? '0/0' : x === 'FULL' ? '1/1' : '0/1';
      s += f.i.padEnd(13) + '1'.padEnd(6) + '0'.padEnd(16) + (f.ip + '/31').padEnd(19) + String(cost(r, f.i)).padEnd(6) + (bc ? bc.me : 'P2P').padEnd(6) + fc + '\n';
    });
    return s.trimEnd();
  }
  function ospfIf(r, f) {
    const bc = o.bcast && o.bcast[key(r, f.i)], [h, d] = (o.hello && o.hello[key(r, f.i)]) || [10, 40];
    const x = st(r, f.i), p = pas(r, f.i), c = cost(r, f.i);
    let s = `${full(f.i)} is up, line protocol is up \n  Internet Address ${f.ip}/31, Area 0, Attached via Interface Enable\n  Process ID 1, Router ID ${rid(r)}, Network Type ${bc ? 'BROADCAST' : 'POINT_TO_POINT'}, Cost: ${c}\n  Topology-MTID    Cost    Disabled    Shutdown      Topology Name\n        0           ${String(c).padEnd(8)}no          no            Base\n  Enabled by interface config, including secondary ip addresses\n  Transmit Delay is 1 sec, State ${bc ? bc.me + ', Priority 1' : 'POINT_TO_POINT'}\n`;
    if (bc) s += `  Designated Router (ID) ${rid(r)}, Interface address ${f.ip}\n  Backup Designated router (ID) ${rid(f.peer)}, Interface address ${f.pip}\n`;
    s += `  Timer intervals configured, Hello ${h}, Dead ${d}, Wait ${d}, Retransmit 5\n    oob-resync timeout ${d}\n`;
    s += p ? '    No Hellos (Passive interface)\n' : `    Hello due in 00:00:0${(ipn(f.ip) % (h - 1)) + 1}\n`;
    s += '  Supports Link-local Signaling (LLS)\n  Cisco NSF helper support enabled\n  IETF NSF helper support enabled\n  Index 1/1/1, flood queue length 0\n';
    const cnt = p || x === 'none' ? 0 : 1, adj = !p && x === 'FULL' ? 1 : 0;
    s += `  Neighbor Count is ${cnt}, Adjacent neighbor count is ${adj} \n`;
    if (adj) s += `    Adjacent with neighbor ${rid(f.peer)}${bc ? '  (Backup Designated Router)' : ''}\n`;
    return s + '  Suppress hello for 0 neighbor(s)';
  }
  function ipBrief(r) {
    let s = 'Interface                  IP-Address      OK? Method Status                Protocol\n';
    IFNAMES.forEach(i => {
      const f = IFS[r].find(z => z.i === i);
      s += full(i).padEnd(27) + (f ? f.ip : 'unassigned').padEnd(16) + 'YES ' + (f ? 'manual' : 'unset').padEnd(7) + (f ? 'up' : 'administratively down').padEnd(22) + (f ? 'up' : 'down') + '\n';
    });
    return s + 'Loopback0'.padEnd(27) + lo(r).padEnd(16) + 'YES manual up                    up';
  }
  function ifDetail(r, f) {
    const mac = '5000.000' + r.slice(1) + '.000' + f.i.slice(-1);
    return `${full(f.i)} is up, line protocol is up \n  Hardware is iGbE, address is ${mac} (bia ${mac})\n  Description: to ${f.peer} ${LAT[f.peer]}\n  Internet address is ${f.ip}/31\n  MTU ${mtu(r, f.i)} bytes, BW 1000000 Kbit/sec, DLY 10 usec, \n     reliability 255/255, txload 1/255, rxload 1/255\n  Encapsulation ARPA, loopback not set\n  Full Duplex, 1Gbps, media type is LX\n  Last input 00:00:00, output 00:00:00, output hang never\n  Last clearing of "show interface" counters never\n  5 minute input rate 6000 bits/sec, 9 packets/sec\n  5 minute output rate 6000 bits/sec, 9 packets/sec\n     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored\n     0 output errors, 0 collisions, 0 interface resets`;
  }
  function ipIf(r, f) {
    const acl = o.acl && o.acl[key(r, f.i)];
    return `${full(f.i)} is up, line protocol is up\n  Internet address is ${f.ip}/31\n  Broadcast address is 255.255.255.255\n  MTU is ${mtu(r, f.i)} bytes\n  Helper address is not set\n  Directed broadcast forwarding is disabled\n${isis ? '' : '  Multicast reserved groups joined: 224.0.0.5\n'}  Outgoing Common access list is not set \n  Outgoing access list is not set\n  Inbound Common access list is not set \n  Inbound  access list is ${acl || 'not set'}\n  Proxy ARP is enabled\n  ICMP redirects are always sent\n  ICMP unreachables are always sent`;
  }
  function runIf(r, f) {
    const k = key(r, f.i), L = [`interface ${full(f.i)}`, ` description to ${f.peer} ${LAT[f.peer]}`];
    if (o.mtu && o.mtu[k]) L.push(` mtu ${o.mtu[k]}`);
    L.push(` ip address ${f.ip} 255.255.255.254`);
    if (o.acl && o.acl[k]) L.push(` ip access-group ${o.acl[k]} in`);
    if (!isis) {
      if (!(o.bcast && o.bcast[k])) L.push(' ip ospf network point-to-point');
      if (o.hello && o.hello[k]) L.push(` ip ospf hello-interval ${o.hello[k][0]}`);
      if (o.cost && o.cost[k]) L.push(` ip ospf cost ${o.cost[k]}`);
      L.push(' ip ospf 1 area 0');
      if (o.bfd) L.push(' ip ospf bfd');
    } else {
      L.push(' ip router isis CORE');
      if ((o.narrow || []).includes(r)) L.push(' isis network point-to-point');
      else L.push(' isis network point-to-point', ' isis metric 100');
    }
    if (o.bfd) L.push(' bfd interval 100 min_rx 100 multiplier 3');
    const t = L.join('\n');
    return `Building configuration...\n\nCurrent configuration : ${t.length + 6} bytes\n!\n${t}\nend`;
  }
  function runOspf(r) {
    const L = ['router ospf 1', ` router-id ${rid(r)}`, ' auto-cost reference-bandwidth 100000'];
    if ((o.pdef || []).includes(r)) { L.push(' passive-interface default'); IFS[r].forEach(f => { if (!pas(r, f.i)) L.push(` no passive-interface ${full(f.i)}`); }); }
    else L.push(' passive-interface Loopback0');
    return L.join('\n');
  }
  function runIsis(r) {
    const L = ['router isis CORE', ` net 49.0001.0000.0000.000${r.slice(1)}.00`, ' is-type level-2-only'];
    if (!(o.narrow || []).includes(r)) L.push(' metric-style wide');
    if (ol(r)) L.push(' set-overload-bit');
    L.push(' passive-interface Loopback0');
    return L.join('\n');
  }
  function ospfProc(r) {
    const [last, n] = (o.spf && o.spf[r]) || ['00:41:05.118', 9];
    return ` Routing Process "ospf 1" with ID ${rid(r)}\n Start time: 00:00:41.112, Time elapsed: 3d02h\n Supports only single TOS(TOS0) routes\n Supports opaque LSA\n Supports Link-local Signaling (LLS)\n Router is not originating router-LSAs with maximum metric\n Initial SPF schedule delay 5000 msecs\n Minimum hold time between two consecutive SPFs 10000 msecs\n Maximum wait time between two consecutive SPFs 10000 msecs\n Number of external LSA 0. Checksum Sum 0x000000\n Number of areas in this router is 1. 1 normal 0 stub 0 nssa\n Reference bandwidth unit is 100000 mbps\n    Area BACKBONE(0)\n        Number of interfaces in this area is 3 (1 loopback)\n        Area has no authentication\n        SPF algorithm last executed ${last} ago\n        SPF algorithm executed ${n} times\n        Number of LSA 5. Checksum Sum 0x02A1F3`;
  }
  function ospfDb(r) {
    if (o.lsa && o.lsa[r]) return o.lsa[r];
    let s = `\n            OSPF Router with ID (${rid(r)}) (Process ID 1)\n\n                Router Link States (Area 0)\n\nLink ID         ADV Router      Age         Seq#       Checksum Link count\n`;
    NODES.forEach((n, k) => s += lo(n).padEnd(16) + lo(n).padEnd(16) + String(377 + k * 13).padEnd(12) + ('0x8000000' + (4 + k % 3)).padEnd(11) + ('0x00' + (0xA1B2 + k * 4777).toString(16).toUpperCase().slice(-4)).padEnd(9) + '5\n');
    return s.trimEnd();
  }
  function isisNbr(r) {
    let s = '\nTag CORE:\nSystem Id       Type Interface     IP Address      State Holdtime Circuit Id\n';
    IFS[r].forEach(f => {
      const x = st(r, f.i); if (x === 'none') return;
      s += f.peer.padEnd(16) + 'L2   ' + f.i.padEnd(14) + f.pip.padEnd(16) + (x === 'FULL' ? 'UP' : x).padEnd(6) + String(22 + ipn(f.pip) % 8).padEnd(9) + '00\n';
    });
    return s.trimEnd();
  }
  function lspHead(r, me, k) {
    return (r + '.00-00').padEnd(20) + (r === me ? '* ' : '  ') + ('0x000000' + (0x1C + k * 3).toString(16).toUpperCase()).padEnd(13) + ('0x' + (0x7A3B + k * 9157).toString(16).toUpperCase().slice(-4)).padEnd(14) + (String(905 + k * 47) + '/' + (r === me ? '*' : '1199')).padStart(16) + '      0/0/' + (ol(r) ? 1 : 0);
  }
  function isisDb(r, detail) {
    let s = '\nTag CORE:\nIS-IS Level-2 Link State Database:\nLSPID                 LSP Seq Num  LSP Checksum  LSP Holdtime/Rcvd      ATT/P/OL\n';
    NODES.forEach((n, k) => {
      s += lspHead(n, r, k) + '\n';
      if (!detail) return;
      const nar = (o.narrow || []).includes(n);
      s += `  Area Address: 49.0001\n  NLPID:        0xCC \n  Hostname: ${n}\n  IP Address:   ${lo(n)}\n`;
      IFS[n].forEach(f => s += nar ? `  Metric: 10         IS ${f.peer}.00\n` : `  Metric: ${String(cost(n, f.i)).padEnd(11)}IS-Extended ${f.peer}.00\n`);
      s += nar ? `  Metric: 10         IP ${lo(n)} 255.255.255.255\n` : `  Metric: 10         IP ${lo(n)}/32\n`;
      IFS[n].forEach(f => s += nar ? `  Metric: 10         IP ${f.net} 255.255.255.254\n` : `  Metric: ${String(cost(n, f.i)).padEnd(11)}IP ${f.net}/31\n`);
    });
    return s.trimEnd();
  }
  function bfdNbr(r) {
    if (!o.bfd) return '';
    let s = '\nIPv4 Sessions\nNeighAddr                              LD/RD         RH/RS     State     Int\n';
    IFS[r].forEach((f, k) => s += f.pip.padEnd(39) + `${k + 1}/${k + 1}`.padEnd(14) + 'Up        Up        ' + f.i + '\n');
    return s.trimEnd();
  }
  function logs(r) {
    return 'Syslog logging: enabled (0 messages dropped, 3 messages rate-limited, 0 flushes, 0 overruns, xml disabled, filtering disabled)\n    Console logging: level debugging, 61 messages logged, xml disabled,\n    Buffer logging:  level debugging, 61 messages logged, xml disabled,\n\nLog Buffer (8192 bytes):\n' +
      (o.log && o.log[r] ? o.log[r] : `*Oct 25 19:02:11.304: %SYS-5-CONFIG_I: Configured from console by noc on vty0 (10.200.0.15)\n*Oct 25 19:02:40.118: %SYS-5-CONFIG_I: Configured from console by noc on vty0 (10.200.0.15)`);
  }
  // устройства: команды (точное имя → текст) и обработчики с адресом
  const dev = {};
  NODES.forEach(r => {
    const c = {};
    c['show ip interface brief'] = ipBrief(r);
    c['show ip route'] = showRoute(r, false);
    c['show logging'] = logs(r);
    if (isis) {
      c['show ip route isis'] = showRoute(r, true);
      c['show isis neighbors'] = isisNbr(r);
      c['show isis database'] = isisDb(r, false);
      c['show isis database detail'] = isisDb(r, true);
      c['show running-config | section router isis'] = runIsis(r);
    } else {
      c['show ip route ospf'] = showRoute(r, true);
      c['show ip ospf neighbor'] = nbrOspf(r);
      c['show ip ospf interface brief'] = ospfBrief(r);
      c['show ip ospf'] = ospfProc(r);
      c['show ip ospf database'] = ospfDb(r);
      c['show running-config | section router ospf'] = runOspf(r);
      c['debug ip ospf adj'] = '(за 30 секунд событий соседства нет — все соседи стабильны)';
      c['debug ip ospf hello'] = IFS[r].map(f => pas(r, f.i) ? '' : `OSPF-1 HELLO ${f.i}: Send hello to 224.0.0.5 area 0 from ${f.ip}\nOSPF-1 HELLO ${f.i}: Rcv hello from ${rid(f.peer)} area 0 ${f.pip}`).filter(Boolean).join('\n');
    }
    c['show bfd neighbors'] = bfdNbr(r);
    c['show access-lists'] = '';
    if (isis) { c['show running-config | section isis'] = c['show running-config | section router isis']; c['show clns neighbors'] = c['show isis neighbors']; }
    else c['show running-config | section ospf'] = c['show running-config | section router ospf'];
    IFS[r].forEach(f => {
      c['show interfaces ' + f.i] = ifDetail(r, f);
      c['show ip interface ' + f.i] = ipIf(r, f);
      c['show running-config interface ' + f.i] = runIf(r, f);
      if (!isis) c['show ip ospf interface ' + f.i] = ospfIf(r, f);
    });
    if (!isis) c['show ip ospf interface'] = IFS[r].map(f => ospfIf(r, f)).join('\n');
    c['show running-config'] = `Building configuration...\n\nCurrent configuration : 2214 bytes\n!\nhostname ${r}\n!\ninterface Loopback0\n ip address ${lo(r)} 255.255.255.255\n${isis ? ' ip router isis CORE' : ' ip ospf 1 area 0'}\n!\n` +
      IFS[r].map(f => runIf(r, f).split('!\n')[1].replace(/\nend$/, '')).join('\n!\n') + '\n!\n' + (isis ? runIsis(r) : runOspf(r)) + '\n!\nend';
    dev[r] = { name: r, city: CITY[r], cmds: c, fn: { ping: ip => ping(r, ip), traceroute: ip => trace(r, ip), route: ip => routeEntry(r, ip) } };
  });
  return dev;
}

// схема кольца для шапки случая (подсветка подозреваемого не даётся — это подсказка)
const TOPO = `<svg viewBox="0 0 320 214" role="img" aria-label="Схема кольца: R1 Москва, R3 Кемерово, R4 Красноярск, R6 Хабаровск, R5 Владивосток">
<path class="ln" d="M62 104 L98 52"/><path class="ln" d="M142 46 L248 46"/><path class="ln" d="M270 58 L270 162"/><path class="ln" d="M248 174 L142 174"/><path class="ln" d="M98 168 L62 116"/>
<rect class="bx" x="18" y="98" width="44" height="24" rx="6"/><text class="tx" x="40" y="114" text-anchor="middle">R1</text><text class="sm" x="40" y="138" text-anchor="middle">Москва</text>
<rect class="bx" x="98" y="34" width="44" height="24" rx="6"/><text class="tx" x="120" y="50" text-anchor="middle">R3</text><text class="sm" x="120" y="26" text-anchor="middle">Кемерово</text>
<rect class="bx" x="248" y="34" width="44" height="24" rx="6"/><text class="tx" x="270" y="50" text-anchor="middle">R4</text><text class="sm" x="270" y="26" text-anchor="middle">Красноярск</text>
<rect class="bx" x="98" y="162" width="44" height="24" rx="6"/><text class="tx" x="120" y="178" text-anchor="middle">R5</text><text class="sm" x="120" y="200" text-anchor="middle">Владивосток</text>
<rect class="bx" x="248" y="162" width="44" height="24" rx="6"/><text class="tx" x="270" y="178" text-anchor="middle">R6</text><text class="sm" x="270" y="200" text-anchor="middle">Хабаровск</text>
</svg>`;

SIM.ch06 = {
  intro: `<p>Та же сеть, что в лабе: кольцо Москва — Кемерово — Красноярск — Хабаровск — Владивосток (Питер здесь не показан). Loopback'и 10.255.0.N, линки 10.1.xy.0/31, OSPF area 0 с point-to-point на линках, стоимость линков 100. В последних двух случаях сеть уже переехала на IS-IS.</p>`,
  topo: TOPO,
  links: 'R1 Gi0/1 — R3 Gi0/1 · R3 Gi0/2 — R4 Gi0/2 · R4 Gi0/3 — R6 Gi0/3 · R6 Gi0/1 — R5 Gi0/1 · R5 Gi0/2 — R1 Gi0/2',
  addr: 'R1 Москва 10.255.0.1 · R3 Кемерово 10.255.0.3 · R4 Красноярск 10.255.0.4 · R5 Владивосток 10.255.0.5 · R6 Хабаровск 10.255.0.6',
  build,
  cases: []
};
})();

// ---------- случаи ----------
// best — путь опытного дежурного (для разбора), book — номер раздела книги (с нуля), lab — что в лабе.
(function () {
const T = (d, t, m) => `*Oct ${d} ${t}: ${m}`;
const ADJ = (nbr, i, from, to, why) => `%OSPF-5-ADJCHG: Process 1, Nbr ${nbr} on GigabitEthernet${i} from ${from} to ${to}, ${why}`;
const CFG = (who, ip) => `%SYS-5-CONFIG_I: Configured from console by ${who} on vty0 (${ip})`;
SIM.ch06.cases = [
{
  id: 'passive', lvl: 1, t: 'Новый линк Красноярск — Хабаровск не взлетел', start: 'R6',
  ticket: `<b>10:20, заявка от линейной службы.</b> Ночью в Хабаровске заменили маршрутизатор R6, конфиг залили по новому шаблону. Линк Хабаровск — Красноярск физически поднят, пинг между портами идёт. Но мониторинг показывает, что трафик Хабаровск → Красноярск ходит через Владивосток, Москву и Кемерово, задержка выросла втрое.`,
  net: { pdef: ['R6'], passive: ['R6 Gi0/3'], adj: { 'R6 Gi0/3': 'none', 'R4 Gi0/3': 'none' }, age: '05:49:12',
    log: { R4: [T(26, '02:10:33.517', '%LINK-3-UPDOWN: Interface GigabitEthernet0/3, changed state to down'), T(26, '02:10:33.521', ADJ('10.255.0.6', '0/3', 'FULL', 'DOWN', 'Neighbor Down: Interface down or detached')), T(26, '04:31:08.002', '%LINK-3-UPDOWN: Interface GigabitEthernet0/3, changed state to up'), T(26, '04:31:09.004', '%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/3, changed state to up')].join('\n'),
      R6: [T(26, '04:30:51.118', '%SYS-5-RESTART: System restarted --'), T(26, '04:31:08.940', '%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/3, changed state to up'), T(26, '04:31:15.371', ADJ('10.255.0.5', '0/1', 'LOADING', 'FULL', 'Loading Done'))].join('\n') } },
  diag: { q: 'Почему нет соседства R6 — R4?', a: 1, o: [
    ['Разные таймеры hello на концах линка', 'Таймеры одинаковые: show ip ospf interface Gi0/3 — Hello 10, Dead 40 на обоих концах. И даже при разных таймерах Hello всё равно отправлялись бы.'],
    ['На R6 порт Gi0/3 пассивный: Hello через него не отправляются', 'Верно. show ip ospf interface Gi0/3 на R6: «No Hellos (Passive interface)». В конфиге OSPF стоит passive-interface default, а для Gi0/3 нет строки no passive-interface.'],
    ['Линк не работает на физическом уровне', 'Порты up/up с обеих сторон, пинг 10.1.46.0 ↔ 10.1.46.1 проходит. Физика в порядке.'],
    ['Gi0/3 на R6 попал в другую область', 'show ip ospf interface brief на R6: Gi0/3 в area 0, как и у R4. Дело не в области.']] },
  fix: { q: 'Что сделаешь на R6?', a: 0, o: [
    ['router ospf 1 → no passive-interface GigabitEthernet0/3', 'Верно: открыть для Hello только этот порт, как уже открыт Gi0/1.'],
    ['interface Gi0/3 → shutdown, потом no shutdown', 'Порт поднимется таким же пассивным. Перезагрузка интерфейса ничего не меняет.'],
    ['router ospf 1 → no passive-interface default', 'Сработает, но откроет Hello на всех портах, включая будущие клиентские. Шаблон сделан ровно для того, чтобы так не было. Правильнее открыть один порт.'],
    ['interface Gi0/3 → ip ospf cost 50', 'Соседства нет вовсе, поэтому линк не участвует в SPF при любой стоимости.']],
    cfg: 'R6(config)#router ospf 1\nR6(config-router)#no passive-interface GigabitEthernet0/3', after: { pdef: ['R6'] },
    log: T(26, '10:31:07.512', ADJ('10.255.0.4', '0/3', 'LOADING', 'FULL', 'Loading Done')) },
  verify: 'R6: show ip ospf neighbor',
  best: ['R6: show ip ospf neighbor', 'R6: show ip ospf interface Gi0/3'],
  why: `<p>На R6 нет соседа R4, и на R4 нет соседа R6: ни один не принимает Hello другого. Значит, ищем, почему Hello не уходят или выбрасываются, — <code>show ip ospf interface Gi0/3</code>, и там прямо написано «No Hellos (Passive interface)».</p><p><code>passive-interface default</code> — хорошая практика: OSPF не болтает в клиентские порты. Но каждый новый магистральный порт надо явно открыть. Проверка после замены оборудования: все ли соседи на месте (<code>show ip ospf neighbor</code>), а не только «порты up».</p>`,
  book: 4, lab: null
},
{
  id: 'hello', lvl: 1, t: 'Хабаровск — Владивосток: соседа нет после «ускорения»', start: 'R6',
  ticket: `<b>15:05, сообщение в чате инженеров.</b> Коллега днём «ускорял сходимость» на линке Хабаровск — Владивосток и что-то поменял во Владивостоке. С 14:52 соседства R5 — R6 нет, трафик Владивосток — Хабаровск идёт через Москву, Кемерово и Красноярск. Коллега уже уехал домой.`,
  net: { hello: { 'R5 Gi0/1': [5, 20] }, adj: { 'R5 Gi0/1': 'none', 'R6 Gi0/1': 'none' }, age: '00:12:40',
    log: { R5: [T(26, '14:51:58.210', CFG('petrov', '10.200.0.22')), T(26, '14:52:18.904', ADJ('10.255.0.6', '0/1', 'FULL', 'DOWN', 'Neighbor Down: Dead timer expired'))].join('\n'),
      R6: T(26, '14:52:35.117', ADJ('10.255.0.5', '0/1', 'FULL', 'DOWN', 'Neighbor Down: Dead timer expired')) } },
  extra: {
    R6: { 'debug ip ospf hello': 'OSPF-1 HELLO Gi0/3: Send hello to 224.0.0.5 area 0 from 10.1.46.1\nOSPF-1 HELLO Gi0/3: Rcv hello from 10.255.0.4 area 0 10.1.46.0\nOSPF-1 HELLO Gi0/1: Send hello to 224.0.0.5 area 0 from 10.1.56.0\nOSPF-1 HELLO Gi0/1: Rcv hello from 10.255.0.5 area 0 10.1.56.1\nOSPF-1 HELLO Gi0/1: Mismatched hello parameters from 10.1.56.1\nOSPF-1 HELLO Gi0/1: Dead R 20 C 40, Hello R 5 C 10' },
    R5: { 'debug ip ospf hello': 'OSPF-1 HELLO Gi0/1: Send hello to 224.0.0.5 area 0 from 10.1.56.1\nOSPF-1 HELLO Gi0/1: Rcv hello from 10.255.0.6 area 0 10.1.56.0\nOSPF-1 HELLO Gi0/1: Mismatched hello parameters from 10.1.56.0\nOSPF-1 HELLO Gi0/1: Dead R 40 C 20, Hello R 10 C 5\nOSPF-1 HELLO Gi0/2: Send hello to 224.0.0.5 area 0 from 10.1.15.1\nOSPF-1 HELLO Gi0/2: Rcv hello from 10.255.0.1 area 0 10.1.15.0' } },
  diag: { q: 'Почему нет соседства R5 — R6?', a: 0, o: [
    ['Таймеры не совпадают: во Владивостоке hello 5 / dead 20, в Хабаровске 10 / 40', 'Верно. show ip ospf interface Gi0/1 на обоих концах: Hello 5, Dead 20 против Hello 10, Dead 40. Hello с чужими таймерами выбрасываются сразу, debug пишет «Mismatched hello parameters».'],
    ['Не совпадает MTU', 'При разном MTU соседи застряли бы в EXSTART/EXCHANGE. Здесь соседа нет вовсе: Hello не принимаются.'],
    ['На R5 сделали Gi0/1 пассивным', 'Тогда в show ip ospf interface Gi0/1 было бы «No Hellos (Passive interface)». А Hello от R5 идут: debug на R6 их видит.'],
    ['Коллега поменял router-id на R5', 'show ip ospf на R5: ID 10.255.0.5, как и был. Дубль RID проявился бы иначе.']] },
  fix: { q: 'Как починить?', a: 0, o: [
    ['R5: interface Gi0/1 → no ip ospf hello-interval', 'Верно: вернуть стандартные 10/40, как на всей сети. Dead вернётся сам: по умолчанию он равен четырём hello.'],
    ['R6: interface Gi0/1 → ip ospf hello-interval 5', 'Соседство поднимется, но на одном линке останутся нестандартные таймеры, которых нет в шаблоне, — следующий инженер наступит на те же грабли. Ускорять обнаружение правильно через BFD.'],
    ['R5: interface Gi0/1 → ip ospf dead-interval 40', 'Hello останется 5, а он тоже должен совпадать. Соседства не будет.'],
    ['clear ip ospf process на обоих', 'Перезапуск не меняет таймеры: соседство не встанет, а остальные соседи R5 и R6 на минуту упадут зря.']],
    cfg: 'R5(config)#interface GigabitEthernet0/1\nR5(config-if)#no ip ospf hello-interval',
    log: T(26, '15:14:22.630', ADJ('10.255.0.6', '0/1', 'LOADING', 'FULL', 'Loading Done')) },
  verify: 'R5: show ip ospf neighbor',
  best: ['R6: show ip ospf neighbor', 'R6: show ip ospf interface Gi0/1', 'R5: show ip ospf interface Gi0/1'],
  why: `<p>Соседа нет ни с одной стороны — значит, Hello выбрасываются. Первым делом сравнивают то, что должно совпадать в Hello: <code>show ip ospf interface Gi0/1</code> на обоих концах, строка «Timer intervals». Debug подтверждает: R — что пришло от соседа, C — что настроено у себя.</p><p>Ускорять сходимость таймерами hello — плохая идея: частые Hello грузят процессор, и легко забыть второй конец. Для быстрого обнаружения аварий есть BFD (раздел 9 книги).</p>`,
  book: 4, lab: 'Поломка 2'
},
{
  id: 'acl', lvl: 2, t: 'Кемерово — Красноярск: пинг есть, соседа нет', start: 'R3',
  ticket: `<b>23:40, ночные работы.</b> Группа безопасности по плану обновила защитный ACL на магистральных портах Кемерово. Через минуту после окончания работ мониторинг сообщил: соседство OSPF Кемерово — Красноярск упало. Пинг между портами проходит, порты up. Трафик Москва — Красноярск ушёл в обход через Владивосток.`,
  net: { acl: { 'R3 Gi0/2': 'INFRA-IN' }, adj: { 'R3 Gi0/2': 'none', 'R4 Gi0/2': 'INIT' }, age: '00:08:51',
    log: { R3: [T(26, '23:31:02.448', CFG('secops', '10.200.0.31')), T(26, '23:31:38.712', ADJ('10.255.0.4', '0/2', 'FULL', 'DOWN', 'Neighbor Down: Dead timer expired')), T(26, '23:32:05.090', '%SEC-6-IPACCESSLOGNP: list INFRA-IN denied 89 10.1.34.1 -> 224.0.0.5, 7 packets'), T(26, '23:37:05.112', '%SEC-6-IPACCESSLOGNP: list INFRA-IN denied 89 10.1.34.1 -> 224.0.0.5, 30 packets')].join('\n'),
      R4: T(26, '23:31:41.203', ADJ('10.255.0.3', '0/2', 'FULL', 'INIT', '1-Way')) } },
  extra: { R3: { 'show access-lists': 'Extended IP access list INFRA-IN\n    10 permit icmp any any (1342 matches)\n    20 permit tcp 10.200.0.0 0.0.0.255 any eq 22 (58 matches)\n    30 permit udp 10.200.0.0 0.0.0.255 any eq snmp (904 matches)\n    40 deny ip any any log (71 matches)' } },
  diag: { q: 'Что сломано?', a: 0, o: [
    ['Входной ACL на R3 Gi0/2 не пропускает OSPF: Hello Красноярска выбрасываются', 'Верно. R3 не видит R4 вообще, а R4 видит R3 в INIT: Hello Кемерово до Красноярска доходят, обратно — нет. show ip interface Gi0/2 на R3: Inbound access list is INFRA-IN, счётчик строки deny растёт, в логе «denied 89» — 89 это номер протокола OSPF.'],
    ['Разные таймеры hello', 'При разных таймерах соседа не было бы ни у кого, а R4 держит R3 в INIT — значит, Hello от R3 он принимает.'],
    ['Линк работает только в одну сторону', 'Пинг между 10.1.34.0 и 10.1.34.1 проходит, значит, кадры идут в обе стороны. Режется только OSPF.'],
    ['Не совпадает MTU', 'Из-за MTU застревают в EXSTART/EXCHANGE. Здесь соседство не дошло даже до 2-WAY.']] },
  fix: { q: 'Как починить, не ослабив защиту?', a: 0, o: [
    ['R3: в INFRA-IN добавить строку 35 permit ospf any any', 'Верно: разрешить OSPF до финального deny. Если на линке включат BFD, ему тоже понадобится строка (UDP 3784).'],
    ['R3: снять ACL с порта (no ip access-group INFRA-IN in)', 'Соседство поднимется, но порт останется без защиты, которую ставили по плану. Правильнее дополнить ACL.'],
    ['R3: добавить строку 50 permit ospf any any', 'Строка 50 окажется после deny ip any any (строка 40) и никогда не сработает: ACL читается сверху вниз до первого совпадения (глава 5).'],
    ['R4: ip ospf network broadcast на Gi0/2', 'Тип сети ни при чём: Hello от R4 выбрасываются на входе R3 при любом типе.']],
    cfg: 'R3(config)#ip access-list extended INFRA-IN\nR3(config-ext-nacl)#35 permit ospf any any',
    after: { acl: { 'R3 Gi0/2': 'INFRA-IN' } },
    extra: { R3: { 'show access-lists': 'Extended IP access list INFRA-IN\n    10 permit icmp any any (1349 matches)\n    20 permit tcp 10.200.0.0 0.0.0.255 any eq 22 (61 matches)\n    30 permit udp 10.200.0.0 0.0.0.255 any eq snmp (917 matches)\n    35 permit ospf any any (14 matches)\n    40 deny ip any any log (99 matches)' } },
    log: T(26, '23:44:16.375', ADJ('10.255.0.4', '0/2', 'LOADING', 'FULL', 'Loading Done')) },
  verify: 'R3: show access-lists',
  best: ['R3: show ip ospf neighbor', 'R4: show ip ospf neighbor', 'R3: show ip interface Gi0/2', 'R3: show access-lists'],
  why: `<p>Ключ — разная картина с двух сторон: R4 видит R3 в INIT, R3 не видит R4 вообще. Значит, Hello идут только от R3 к R4. Ищем, кто выбрасывает Hello на входе R3, и вспоминаем, что меняли: ACL. Пинг здесь сбивает с толку: ICMP разрешён отдельной строкой.</p><p>После исправления в <code>show access-lists</code> у новой строки 35 должны расти совпадения: Hello приходят каждые 10 секунд.</p>`,
  book: 4, lab: 'Задание 6 (там ACL режет OSPF намеренно)'
},
{
  id: 'mtu', lvl: 2, t: 'Красноярск после замены: соседство висит в EXSTART', start: 'R3',
  ticket: `<b>06:15, после ночной замены.</b> В Красноярске заменили маршрутизатор R4 на новую модель, конфиг перенесли и дополнили по новому шаблону. С Хабаровском соседство поднялось, а с Кемерово — нет. Порты up, пинг между ними проходит.`,
  net: { mtu: { 'R4 Gi0/2': 9216, 'R4 Gi0/3': 9216, 'R6 Gi0/3': 9216 }, adj: { 'R3 Gi0/2': 'EXSTART', 'R4 Gi0/2': 'EXCHANGE' }, age: '01:31:20',
    log: { R3: [T(26, '04:41:19.880', '%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/2, changed state to up')].join('\n'),
      R4: [T(26, '04:40:58.300', '%SYS-5-RESTART: System restarted --'), T(26, '04:41:31.602', ADJ('10.255.0.6', '0/3', 'LOADING', 'FULL', 'Loading Done')), T(26, '04:43:46.011', ADJ('10.255.0.3', '0/2', 'EXCHANGE', 'DOWN', 'Neighbor Down: Too many retransmissions')), T(26, '05:58:12.004', ADJ('10.255.0.3', '0/2', 'EXCHANGE', 'DOWN', 'Neighbor Down: Too many retransmissions'))].join('\n') } },
  extra: {
    R3: { 'debug ip ospf adj': 'OSPF-1 ADJ   Gi0/2: Rcv DBD from 10.255.0.4 seq 0x1A3F opt 0x52 flag 0x2 len 52  mtu 9216 state EXSTART\nOSPF-1 ADJ   Gi0/2: Nbr 10.255.0.4 has larger interface MTU\nOSPF-1 ADJ   Gi0/2: Send DBD to 10.255.0.4 seq 0x7C11 opt 0x52 flag 0x7 len 32\nOSPF-1 ADJ   Gi0/2: Rcv DBD from 10.255.0.4 seq 0x1A3F opt 0x52 flag 0x2 len 52  mtu 9216 state EXSTART\nOSPF-1 ADJ   Gi0/2: Nbr 10.255.0.4 has larger interface MTU' },
    R4: { 'debug ip ospf adj': 'OSPF-1 ADJ   Gi0/2: Send DBD to 10.255.0.3 seq 0x1A3F opt 0x52 flag 0x2 len 52\nOSPF-1 ADJ   Gi0/2: Retransmitting DBD to 10.255.0.3 [11]\nOSPF-1 ADJ   Gi0/2: Send DBD to 10.255.0.3 seq 0x1A3F opt 0x52 flag 0x2 len 52\nOSPF-1 ADJ   Gi0/2: Retransmitting DBD to 10.255.0.3 [12]' } },
  diag: { q: 'Почему соседи застряли?', a: 0, o: [
    ['MTU на концах разный: у R4 9216, у R3 1500, и R3 отвергает DBD соседа', 'Верно. show interfaces Gi0/2: MTU 9216 на R4 и 1500 на R3. Hello маленькие и проходят, а DBD с MTU больше своего R3 отвергает (debug: «has larger interface MTU»). R4 тем временем повторяет DBD и иногда сбрасывает соседа: «Too many retransmissions».'],
    ['Дубль Router ID у R3 и R4', 'show ip ospf на обоих: 10.255.0.3 и 10.255.0.4, разные. При дубле в логах было бы DUP_RTRID.'],
    ['Разные таймеры hello', 'При разных таймерах не было бы даже INIT. Здесь Hello проходят, соседи дошли до обмена DBD.'],
    ['Не совпадает тип сети', 'Тип сети не мешает пройти EXSTART: из-за него бывает FULL без маршрутов. И оба конца P2P.']] },
  fix: { q: 'Как починить правильно?', a: 0, o: [
    ['Выровнять MTU на линке: на R4 Gi0/2 вернуть 1500 (или поднять R3, если канал пропустит jumbo)', 'Верно. MTU на концах линка должен совпадать, а выбирают его по тому, что пропустит канал между ними.'],
    ['R3: ip ospf mtu-ignore на Gi0/2', 'Соседство поднимется, но это обход, а не лечение: большие пакеты от R4 не пролезут в порт R3 с MTU 1500, и крупные LSU или трафик начнут теряться.'],
    ['R3: clear ip ospf process', 'После перезапуска соседи снова застрянут: MTU от этого не изменится.'],
    ['R4: сменить router-id', 'Router ID ни при чём, а его смена перезапустит все соседства R4 зря.']],
    cfg: 'R4(config)#interface GigabitEthernet0/2\nR4(config-if)#no mtu',
    log: T(26, '06:24:40.913', ADJ('10.255.0.3', '0/2', 'LOADING', 'FULL', 'Loading Done')),
    after: { mtu: { 'R4 Gi0/3': 9216, 'R6 Gi0/3': 9216 } } },
  verify: 'R3: show ip ospf neighbor',
  best: ['R3: show ip ospf neighbor', 'R3: show interfaces Gi0/2', 'R4: show interfaces Gi0/2'],
  why: `<p>EXSTART или EXCHANGE — это почти всегда MTU. Hello маленькие и проходят, поэтому соседи видят друг друга, а на обмене описаниями баз (DBD, в них указан MTU) спотыкаются. Типичная картина: один конец в EXSTART, другой в EXCHANGE.</p><p>Новое оборудование часто приходит с jumbo MTU по умолчанию или по новому шаблону. После каждой замены сравнивай MTU с обеих сторон линка.</p>`,
  book: 4, lab: 'Поломка 1'
},
{
  id: 'cost', lvl: 2, t: 'Москва — Кемерово: задержка выросла, соседство в порядке', start: 'R1',
  ticket: `<b>11:30, заявка от корпоративного клиента в Кемерово.</b> С сегодняшнего утра задержка до московского дата-центра выросла с 40 до 95 мс. Вчера вечером на линке Москва — Кемерово были плановые работы: подрядчик менял оптический кросс, работы закрыты в 01:20 без замечаний.`,
  net: { cost: { 'R1 Gi0/1': 500 }, age: '10:17:02',
    log: { R1: [T(25, '22:45:10.331', CFG('ivanov', '10.200.0.17')), T(25, '22:47:03.200', '%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down'), T(25, '22:47:03.204', ADJ('10.255.0.3', '0/1', 'FULL', 'DOWN', 'Neighbor Down: Interface down or detached')), T(26, '01:12:44.918', '%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up'), T(26, '01:12:52.660', ADJ('10.255.0.3', '0/1', 'LOADING', 'FULL', 'Loading Done'))].join('\n'),
      R3: [T(25, '22:47:03.215', ADJ('10.255.0.1', '0/1', 'FULL', 'DOWN', 'Neighbor Down: Interface down or detached')), T(26, '01:12:52.671', ADJ('10.255.0.1', '0/1', 'LOADING', 'FULL', 'Loading Done'))].join('\n') } },
  diag: { q: 'Почему трафик Москва → Кемерово идёт в обход?', a: 0, o: [
    ['На R1 Gi0/1 осталась стоимость 500, поставленная перед работами', 'Верно. show ip ospf interface brief на R1: Cost 500 на Gi0/1. Путь через Владивосток стоит 400 (4 × 100) — дешевле прямого. Обратно Кемерово ходит напрямую (у него 100): маршрутизация асимметричная.'],
    ['Соседство R1 — R3 не поднялось после работ', 'Соседство FULL с обеих сторон, в логе Loading Done в 01:12.'],
    ['Разные типы сети на концах линка', 'Оба конца P2P. И трафик из Кемерово в Москву идёт напрямую — значит, линк в SPF участвует.'],
    ['Оптику подключили не в тот порт', 'Тогда поменялись бы соседи на интерфейсах. А сосед 10.255.0.3 по-прежнему на Gi0/1.']] },
  fix: { q: 'Как починить?', a: 0, o: [
    ['R1: interface Gi0/1 → no ip ospf cost', 'Верно: вернуть стоимость по умолчанию (100 при reference 100000), как на всех линках.'],
    ['R3: interface Gi0/1 → ip ospf cost 500', 'Станет симметрично, но в обход пойдут оба направления: задержка вырастет и в обратную сторону.'],
    ['R1: clear ip ospf process', 'Стоимость в конфиге останется, после перезапуска всё повторится, а все соседи Москвы на минуту упадут.'],
    ['R1: ip route 10.255.0.3 255.255.255.255 10.1.13.1', 'Статика (AD 1) перебьёт OSPF, но это заплатка: при обрыве за транспортом трафик в Кемерово уйдёт в пустоту, а про статику через год никто не вспомнит.']],
    cfg: 'R1(config)#interface GigabitEthernet0/1\nR1(config-if)#no ip ospf cost',
    log: '(соседство не перезапускается: поменялась только стоимость, SPF пересчитан)' },
  verify: 'R1: traceroute 10.255.0.3',
  best: ['R1: traceroute 10.255.0.3', 'R1: show ip ospf interface brief'],
  why: `<p>Когда соседство в порядке, а трафик идёт странно, смотрят traceroute (куда идёт) и стоимости (почему). Сравни traceroute из Москвы в Кемерово и обратно — они разные: стоимость считается на выходе, и 500 стоит только на московском конце.</p><p>Стоимость поднимают перед работами, чтобы мягко увести трафик, и забывают вернуть. Хорошая привычка: в плане работ пункт «вернуть cost», а после работ — traceroute в обе стороны.</p>`,
  book: 2, lab: 'Задание 3'
},
{
  id: 'nettype', lvl: 3, t: 'Кемерово: соседство FULL, а трафик в обход', start: 'R1',
  ticket: `<b>09:10, заявка из NOC.</b> После ночной замены маршрутизатора в Кемерово (R3) трафик между Москвой и Кемерово в обе стороны идёт через Владивосток, Хабаровск и Красноярск. Соседство R1 — R3 зелёное, ошибок в логах нет. Стоимости проверили — везде 100.`,
  net: { bcast: { 'R3 Gi0/1': { me: 'DR', nbr: 'BDR' } }, nouse: ['R1-R3'], age: '04:02:37',
    lsa: { R1: '\n            OSPF Router with ID (10.255.0.1) (Process ID 1)\n\n                Router Link States (Area 0)\n\nLink ID         ADV Router      Age         Seq#       Checksum Link count\n10.255.0.1      10.255.0.1      1210        0x80000009 0x00A1B2 5\n10.255.0.3      10.255.0.3      1192        0x80000002 0x00C3D4 4\n10.255.0.4      10.255.0.4      1488        0x80000005 0x0051E0 5\n10.255.0.5      10.255.0.5      1502        0x80000004 0x0077F1 5\n10.255.0.6      10.255.0.6      1495        0x80000004 0x00E2C9 5\n\n                Net Link States (Area 0)\n\nLink ID         ADV Router      Age         Seq#       Checksum\n10.1.13.1       10.255.0.3      1192        0x80000001 0x0083F1' },
    log: { R1: [T(26, '05:07:44.250', '%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up'), T(26, '05:08:31.519', ADJ('10.255.0.3', '0/1', 'LOADING', 'FULL', 'Loading Done'))].join('\n'),
      R3: [T(26, '05:06:59.004', '%SYS-5-RESTART: System restarted --'), T(26, '05:08:31.508', ADJ('10.255.0.1', '0/1', 'LOADING', 'FULL', 'Loading Done')), T(26, '05:08:33.877', ADJ('10.255.0.4', '0/2', 'LOADING', 'FULL', 'Loading Done'))].join('\n') } },
  diag: { q: 'Почему линк Москва — Кемерово не используется?', a: 0, o: [
    ['Типы сети на концах разные: у R1 point-to-point, у R3 broadcast', 'Верно. show ip ospf interface brief: на R1 State P2P, на R3 — DR. R1 видит R3 как FULL/-, а R3 видит R1 как FULL/BDR. В базе появилась LSA типа 2 от R3, которой в сети из p2p-линков быть не должно. Линк описан по-разному, и двусторонняя проверка в SPF не проходит.'],
    ['На R1 Gi0/1 стоит стоимость 500', 'show ip ospf interface brief: Cost 100 с обеих сторон. И стоимость на одном конце не объяснила бы обход в обе стороны.'],
    ['Не совпадает MTU', 'Из-за MTU соседи не дошли бы до FULL. Здесь FULL.'],
    ['На R3 порт Gi0/1 пассивный', 'При passive не было бы соседства, а здесь FULL.']] },
  fix: { q: 'Что исправить?', a: 0, o: [
    ['R3: interface Gi0/1 → ip ospf network point-to-point', 'Верно: привести R3 к шаблону ядра. Соседство перезапустится один раз и встанет как FULL/- без выборов DR.'],
    ['R1: interface Gi0/1 → no ip ospf network point-to-point', 'Типы совпадут, и маршруты появятся, но линк ядра станет broadcast с выборами DR, ожиданием до 40 секунд при поднятии и лишней LSA 2. Чинить надо тот конец, что отступил от шаблона, — R3.'],
    ['R3: ip ospf priority 0 на Gi0/1', 'R3 перестанет быть DR, но тип сети останется broadcast: описание линка всё равно не совпадёт.'],
    ['clear ip ospf process на R1 и R3', 'После перезапуска картина повторится: типы сети в конфиге не изменились.']],
    cfg: 'R3(config)#interface GigabitEthernet0/1\nR3(config-if)#ip ospf network point-to-point',
    log: [T(26, '09:21:05.330', ADJ('10.255.0.1', '0/1', 'FULL', 'DOWN', 'Neighbor Down: Interface down or detached')), T(26, '09:21:05.842', ADJ('10.255.0.1', '0/1', 'LOADING', 'FULL', 'Loading Done'))].join('\n') },
  verify: 'R1: traceroute 10.255.0.3',
  best: ['R1: traceroute 10.255.0.3', 'R1: show ip ospf interface brief', 'R3: show ip ospf interface brief'],
  why: `<p>Самая коварная поломка главы: все признаки «зелёные». Подсказки — FULL/BDR вместо FULL/- у одного из соседей и LSA типа 2 в базе, которой в сети из point-to-point линков быть не должно.</p><p>Правило: соседство FULL, а маршрутов через линк нет — сравни тип сети на обоих концах (<code>show ip ospf interface brief</code>, столбец State), потом стоимость.</p>`,
  book: 5, lab: 'Поломка 4'
},
{
  id: 'duprid', lvl: 3, t: 'Кемерово и Владивосток то есть, то нет', start: 'R1',
  ticket: `<b>14:20, звонки абонентов и тревоги мониторинга.</b> С 13:58 мониторинг каждые несколько секунд то теряет, то находит Кемерово и Владивосток. Порты и линки не падали. Во Владивостоке днём закончили перенастройку R5: конфиг собрали по образцу других узлов.`,
  net: { rid: { R5: '10.255.0.3' }, hide: { R1: ['10.255.0.3/32', '10.255.0.5/32'], R4: ['10.255.0.5/32'], R6: ['10.255.0.3/32'] }, age: '00:00:04',
    spf: { R1: ['00:00:02.904', 688], R3: ['00:00:01.118', 702], R4: ['00:00:03.512', 690], R5: ['00:00:00.876', 705], R6: ['00:00:02.240', 689] },
    lsa: { R1: '\n            OSPF Router with ID (10.255.0.1) (Process ID 1)\n\n                Router Link States (Area 0)\n\nLink ID         ADV Router      Age         Seq#       Checksum Link count\n10.255.0.1      10.255.0.1      912         0x80000007 0x00A1B2 5\n10.255.0.3      10.255.0.3      1           0x800002B4 0x00F31C 5\n10.255.0.4      10.255.0.4      905         0x80000005 0x0051E0 5\n10.255.0.6      10.255.0.6      899         0x80000004 0x00E2C9 5' },
    log: { R3: [T(26, '14:19:52.113', '%OSPF-4-FLOOD_WAR: Process 1 re-originates LSA ID 10.255.0.3 type-1 adv-rtr 10.255.0.3 in area 0'), T(26, '14:20:01.457', '%OSPF-4-FLOOD_WAR: Process 1 flushes LSA ID 10.255.0.3 type-1 adv-rtr 10.255.0.3 in area 0'), T(26, '14:20:09.330', '%OSPF-4-FLOOD_WAR: Process 1 re-originates LSA ID 10.255.0.3 type-1 adv-rtr 10.255.0.3 in area 0')].join('\n'),
      R5: [T(26, '13:57:40.006', CFG('kozlov', '10.200.0.24')), T(26, '13:58:02.771', '%OSPF-5-ADJCHG: Process 1, Nbr 10.255.0.1 on GigabitEthernet0/2 from LOADING to FULL, Loading Done'), T(26, '14:19:55.918', '%OSPF-4-FLOOD_WAR: Process 1 re-originates LSA ID 10.255.0.3 type-1 adv-rtr 10.255.0.3 in area 0'), T(26, '14:20:04.207', '%OSPF-4-FLOOD_WAR: Process 1 flushes LSA ID 10.255.0.3 type-1 adv-rtr 10.255.0.3 in area 0')].join('\n') } },
  diag: { q: 'Что происходит?', a: 0, o: [
    ['У R5 тот же Router ID, что у R3 (10.255.0.3): их LSA перетирают друг друга', 'Верно. show ip ospf на R5: ID 10.255.0.3. У R1 два соседа с одним ID, в базе одна LSA 10.255.0.3 с огромным Seq# и возрастом 1 секунда, в логах R3 и R5 — FLOOD_WAR. SPF пересчитывается сотни раз.'],
    ['Моргает линк Владивосток — Хабаровск', 'Тогда в логах были бы падения порта и соседства, а их нет: все соседи FULL.'],
    ['Не совпадает MTU на линке R1 — R5', 'Соседство R1 — R5 в FULL, MTU тут ни при чём.'],
    ['Перегружен процессор R1', 'Процессор занят следствием: SPF считается сотни раз из-за постоянно новых версий LSA. Причина — в конфиге R5.']] },
  fix: { q: 'Как починить?', a: 0, o: [
    ['R5: router-id 10.255.0.5 и перезапуск OSPF на R5 (clear ip ospf process)', 'Верно. Новый Router ID вступает в силу только после перезапуска процесса OSPF на R5, его соседства на минуту перезапустятся.'],
    ['R3: router-id 10.255.0.5', 'R3 был прав: его RID равен его Loopback0. Чинят того, кто отступил от правила «RID = Lo0», иначе в сети будет путаница с адресами.'],
    ['R1: clear ip ospf process', 'Москва тут только наблюдатель. Война LSA между R3 и R5 продолжится.'],
    ['R5: поставить на Loopback0 адрес 10.255.0.3', 'Тогда в сети будут два одинаковых loopback — ещё одна авария вдобавок.']],
    cfg: 'R5(config)#router ospf 1\nR5(config-router)#router-id 10.255.0.5\n% OSPF: Reload or use "clear ip ospf process" command, for this to take effect\nR5(config-router)#end\nR5#clear ip ospf process\nReset ALL OSPF processes? [no]: yes',
    log: [T(26, '14:31:12.004', ADJ('10.255.0.1', '0/2', 'FULL', 'DOWN', 'Neighbor Down: Interface down or detached')), T(26, '14:31:12.006', ADJ('10.255.0.6', '0/1', 'FULL', 'DOWN', 'Neighbor Down: Interface down or detached')), T(26, '14:31:20.514', ADJ('10.255.0.1', '0/2', 'LOADING', 'FULL', 'Loading Done')), T(26, '14:31:21.033', ADJ('10.255.0.6', '0/1', 'LOADING', 'FULL', 'Loading Done'))].join('\n') },
  verify: 'R1: show ip ospf neighbor',
  best: ['R1: show ip ospf neighbor', 'R5: show ip ospf'],
  why: `<p>Когда маршруты «мигают», а порты и соседства стабильны, смотри на базу и логи: чья LSA постоянно меняется (Seq# растёт, Age около нуля), есть ли FLOOD_WAR. Два соседа с одинаковым Neighbor ID у R1 — прямое указание на дубль.</p><p>Правило: router-id задаётся явно и равен Loopback0, а конфиг «по образцу» проверяется на чужие адреса и идентификаторы.</p>`,
  book: 4, lab: 'Поломка 3'
},
{
  id: 'bfd', lvl: 2, t: 'Обрыв на магистрали — 38 секунд тишины', start: 'R3',
  ticket: `<b>09:00, разбор ночной аварии.</b> В 03:12:42 подрядчик повредил оптику между Кемерово и Красноярском, за транспортным оборудованием. Мониторинг: Красноярск был недоступен из Москвы 38 секунд, потом заработал через Хабаровск. Оптику восстановили в 05:40. Руководитель спрашивает: «Почему 38 секунд, если у нас кольцо?» Сейчас всё работает.`,
  net: { age: '03:19:48',
    log: { R3: [T(26, '03:13:19.630', ADJ('10.255.0.4', '0/2', 'FULL', 'DOWN', 'Neighbor Down: Dead timer expired')), T(26, '05:40:12.218', ADJ('10.255.0.4', '0/2', 'LOADING', 'FULL', 'Loading Done'))].join('\n'),
      R4: [T(26, '03:13:20.411', ADJ('10.255.0.3', '0/2', 'FULL', 'DOWN', 'Neighbor Down: Dead timer expired')), T(26, '05:40:12.226', ADJ('10.255.0.3', '0/2', 'LOADING', 'FULL', 'Loading Done'))].join('\n') } },
  diag: { q: 'Почему трафик стоял почти 40 секунд?', a: 0, o: [
    ['Порты не упали, и OSPF узнал об обрыве только по таймеру dead (40 с): BFD на линке нет', 'Верно. В логах нет LINK/LINEPROTO down — порты оставались up. Соседство упало по «Dead timer expired» через 37 секунд после обрыва. show bfd neighbors пуст, в конфиге интерфейсов нет bfd.'],
    ['OSPF долго считал SPF', 'SPF в такой сети считается за миллисекунды. Все 38 секунд ушли на то, чтобы заметить аварию.'],
    ['На кольце нет обходного пути', 'Обход есть и заработал сам — через Хабаровск. Вопрос в том, почему так поздно.'],
    ['Транспорт переключался 38 секунд', 'Обрыв был на участке без резерва, транспорт не переключался. Маршрутизаторы просто ждали таймер.']] },
  fix: { q: 'Что предложишь, чтобы в следующий раз было меньше секунды?', a: 0, o: [
    ['Включить BFD на магистральных линках (100 мс × 3) с регистрацией в OSPF, на обоих концах', 'Верно. BFD заметит обрыв за 0,3 секунды и сразу сообщит OSPF, даже если порт не упал.'],
    ['Поставить hello 1 и dead 3 на всех линках', 'Сработает, но частые Hello грузят процессор и обрабатываются медленно — это вчерашний способ. BFD делает то же легче и быстрее.'],
    ['Поднять стоимость линка Кемерово — Красноярск', 'Тогда трафик всегда будет ходить в обход, а медленное обнаружение обрывов на других линках останется.'],
    ['Прописать статический маршрут в обход', 'Статика не знает об обрыве за транспортом: она тоже будет слать в мёртвый линк, пока порт up.']],
    cfg: 'R3(config)#interface GigabitEthernet0/2\nR3(config-if)#bfd interval 100 min_rx 100 multiplier 3\nR3(config-if)#ip ospf bfd\n! то же на R4 Gi0/2 и на остальных линках кольца',
    log: '(сессии BFD поднялись на всех линках — проверь show bfd neighbors)', after: { bfd: true } },
  verify: 'R3: show bfd neighbors',
  best: ['R3: show logging', 'R3: show bfd neighbors'],
  why: `<p>Главный признак — «Dead timer expired» без строк LINK/LINEPROTO рядом: порт жив, сосед умер по таймеру. Время от обрыва (03:12:42) до падения соседства (03:13:19) — почти весь dead interval.</p><p>На линках через транспорт или арендованные каналы без BFD каждый такой обрыв стоит 40 секунд простоя. С BFD — доли секунды.</p>`,
  book: 8, lab: 'Задание 6'
},
{
  id: 'overload', lvl: 2, t: 'IS-IS: после работ в Красноярске трафик ушёл через Москву', start: 'R3',
  ticket: `<b>08:40, заявка из NOC.</b> Сеть уже на IS-IS. Ночью в Красноярске меняли блок питания на R4, работы закрыты в 04:30. Утром заметили: трафик Кемерово — Хабаровск идёт через Москву и Владивосток, задержка выросла. Сам Красноярск доступен отовсюду, соседства IS-IS у R4 все Up.`,
  net: { proto: 'isis', ol: ['R4'], age: '05:38:15',
    log: { R4: [T(26, '03:02:11.045', CFG('sidorov', '10.200.0.19')), T(26, '03:20:47.300', '%SYS-5-RELOAD: Reload requested by sidorov on vty0 (10.200.0.19). Reload Reason: Reload Command.'), T(26, '04:28:40.882', CFG('sidorov', '10.200.0.19'))].join('\n') } },
  diag: { q: 'Почему транзит обходит Красноярск?', a: 0, o: [
    ['На R4 остался overload bit: транзит через Красноярск запрещён', 'Верно. show isis database: у R4.00-00 в столбце OL стоит 1, в конфиге set-overload-bit. Сам R4 доступен, а пути через него никто не строит.'],
    ['Соседство IS-IS R3 — R4 не поднялось', 'show isis neighbors на R3 и R4: все UP.'],
    ['На R4 поменялись метрики линков', 'В show isis database detail у R4 метрики 100, как у всех.'],
    ['На R3 metric-style narrow', 'Тогда пропали бы маршруты через R3, а R3 ходит в Москву напрямую. Его LSP с IS-Extended — это wide.']] },
  fix: { q: 'Как починить?', a: 0, o: [
    ['R4: router isis CORE → no set-overload-bit', 'Верно. Через несколько секунд все пересчитают SPF, и транзит вернётся.'],
    ['R4: clear isis *', 'Перезапуск соседств не снимет флаг из конфига: overload останется, а R4 на время потеряет соседей.'],
    ['R3 и R6: поднять метрику обходного пути', 'Заплатка поверх причины: через R4 всё равно никто не пойдёт, пока стоит флаг.'],
    ['R4: set-overload-bit on-startup', 'Это другая настройка (флаг только на время после перезагрузки). Постоянный флаг всё равно надо снять.']],
    cfg: 'R4(config)#router isis CORE\nR4(config-router)#no set-overload-bit',
    log: '(R4 выпустил новую LSP без флага OL, все пересчитали SPF)' },
  verify: 'R3: traceroute 10.255.0.6',
  best: ['R3: traceroute 10.255.0.6', 'R3: show isis database'],
  why: `<p>Overload — правильный способ вывести узел перед работами, но в плане работ должен быть пункт «снять overload». Признак: узел доступен, соседства Up, а транзит его обходит. Проверка — столбец OL в <code>show isis database</code>, видно с любого маршрутизатора.</p>`,
  book: 7, lab: 'Задание 8'
},
{
  id: 'narrow', lvl: 3, t: 'IS-IS: Кемерово пропал, хотя соседства Up', start: 'R1',
  ticket: `<b>22:30, авария после работ.</b> В Кемерово заменили R3 и восстановили конфиг из архива, сделанного ещё до перехода на IS-IS, потом вручную дописали IS-IS. Сразу после этого Кемерово недоступен по loopback ни из Москвы, ни из Красноярска, а трафик Москва — Красноярск ушёл через Владивосток. Соседства IS-IS у R3 с R1 и R4 — UP.`,
  net: { proto: 'isis', narrow: ['R3'], mute: ['R3'], age: '00:19:33',
    log: { R3: [T(26, '22:05:13.442', '%SYS-5-RESTART: System restarted --'), T(26, '22:10:51.007', CFG('orlov', '10.200.0.27')), T(26, '22:11:02.335', '%CLNS-5-ADJCHANGE: ISIS: Adjacency to R1 (GigabitEthernet0/1) Up, new adjacency'), T(26, '22:11:03.120', '%CLNS-5-ADJCHANGE: ISIS: Adjacency to R4 (GigabitEthernet0/2) Up, new adjacency')].join('\n') } },
  diag: { q: 'Почему R3 выпал из маршрутизации?', a: 0, o: [
    ['На R3 нет metric-style wide: он пишет LSP в старом формате (narrow), а остальные понимают только wide', 'Верно. В show isis database detail у R3 «IS R1.00» и «IP … 255.255.255.255» (narrow), у остальных — «IS-Extended» и префиксы с /. В конфиге R3 нет строки metric-style wide. Соседство есть, а линки R3 в SPF не попадают, и сам R3 не понимает чужие LSP.'],
    ['Соседство R1 — R3 не установилось', 'show isis neighbors: R1 и R4 видят R3 в состоянии UP.'],
    ['На R3 другая область в NET', 'NET R3 49.0001…, как у всех. Да и на level-2-only номер области соседству не мешает.'],
    ['На R3 стоит overload bit', 'В show isis database у R3.00-00 OL = 0. И при overload сам R3 оставался бы доступен.']] },
  fix: { q: 'Как починить?', a: 0, o: [
    ['R3: metric-style wide в router isis и isis metric 100 на линках', 'Верно. Стиль метрик должен быть одинаковым во всём домене, а метрики линков — как на остальных, иначе пути изменятся.'],
    ['Остальные: metric-style narrow', 'Всё кольцо перейдёт на старый формат с максимумом 63 на линк, метрика 100 станет невозможна. Авария на всей сети ради одного узла.'],
    ['R3: clear isis *', 'Соседства перезапустятся и встанут снова, а формат LSP останется narrow.'],
    ['R1 и R4: metric-style transition', 'Переходный режим понимает оба формата и бывает нужен во время миграции, но здесь правильнее привести один R3 к стандарту сети.']],
    cfg: 'R3(config)#router isis CORE\nR3(config-router)#metric-style wide\nR3(config-router)#exit\nR3(config)#interface range GigabitEthernet0/1 - 2\nR3(config-if-range)#isis metric 100',
    log: '(R3 выпустил LSP в формате wide, все пересчитали SPF)' },
  verify: 'R1: show ip route isis',
  best: ['R1: show isis neighbors', 'R1: show isis database detail'],
  why: `<p>Соседство UP, а маршрутов к узлу и через него нет — значит, проблема не в Hello, а в содержимом LSP. Смотри <code>show isis database detail</code>: narrow и wide — два разных «языка» TLV, и маршрутизатор, настроенный на один, не читает другой.</p><p>Конфиг из старого архива — частый источник таких аварий: в нём нет того, что добавили в шаблон позже.</p>`,
  book: 7, lab: 'Поломка 5'
}
];
})();
