// Топология лабы: рисование схемы (SVG) и сборка файла лабы EVE-NG (.unl).
window.EVE = (function () {
  // Шаблоны EVE-NG для типов узлов. image подставляется из настроек (имена папок в /opt/unetlab/addons/qemu).
  const TPL = {
    router: { type: 'qemu', template: 'vios', img: 'vios', ram: 512, cpu: 1, icon: 'Router.png', min: 4,
      qopt: '-machine type=pc,accel=kvm -serial mon:stdio -nographic -no-user-config -nodefaults -display none -vga std -rtc base=utc' },
    switch: { type: 'qemu', template: 'viosl2', img: 'viosl2', ram: 768, cpu: 1, icon: 'Switch.png', min: 8,
      qopt: '-machine type=pc,accel=kvm -serial mon:stdio -nographic -no-user-config -nodefaults -display none -vga std -rtc base=utc' },
    csr: { type: 'qemu', template: 'csr1000vng', img: 'csr', ram: 3072, cpu: 1, icon: 'CSRv1000.png', min: 4,
      qopt: '-machine type=pc,accel=kvm -serial mon:stdio -nographic -no-user-config -nodefaults -display none -vga std -rtc base=utc -cpu host' },
    veos: { type: 'qemu', template: 'veos', img: 'veos', ram: 2048, cpu: 1, icon: 'Switch L3.png', min: 4,
      qopt: '-machine type=pc,accel=kvm -serial mon:stdio -nographic -display none -no-user-config -rtc base=utc -boot order=d' },
    pc: { type: 'vpcs', template: 'vpcs', img: null, icon: 'Desktop.png', min: 1 }
  };
  TPL.l3 = TPL.switch; TPL.server = TPL.pc; TPL.isp = TPL.router; TPL.ce = TPL.router; TPL.pe = TPL.router; TPL.p = TPL.router;

  const COLORS = { veos: '#0d9488', router: '#2563eb', isp: '#64748b', pe: '#7c3aed', p: '#0f766e', ce: '#2563eb', csr: '#9333ea', switch: '#0891b2', l3: '#059669', pc: '#475569', server: '#b45309', cloud: '#64748b' };

  function ifIndex(t, name) {
    const tp = TPL[t] || TPL.router;
    if (tp.type === 'vpcs') return 0;
    let m;
    if (tp.template === 'viosl2' && (m = /(\d+)\/(\d+)$/.exec(name))) return (+m[1]) * 4 + (+m[2]);
    if (tp.template === 'csr1000vng' && (m = /(\d+)$/.exec(name))) return (+m[1]) - 1;
    if (tp.template === 'veos') { if (/^Ma/i.test(name)) return 0; if ((m = /(\d+)$/.exec(name))) return +m[1]; } // e0 = Management1, e1 = Ethernet1
    if ((m = /\/(\d+)$/.exec(name))) return +m[1];
    return 0;
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function icon(n) {
    const c = n.color || COLORS[n.t] || '#2563eb';
    const x = n.x, y = n.y;
    switch (n.t) {
      case 'switch': case 'l3': case 'veos':
        return `<rect x="${x - 30}" y="${y - 17}" width="60" height="34" rx="7" fill="${c}"/>
          <path d="M${x - 18} ${y - 6}h22m-5 -4l5 4-5 4M${x + 18} ${y + 6}h-22m5 -4l-5 4 5 4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          ${n.t === 'l3' || n.t === 'veos' ? `<text x="${x + 22}" y="${y - 7}" font-size="9" fill="#fff" font-weight="700">L3</text>` : ''}`;
      case 'pc':
        return `<rect x="${x - 20}" y="${y - 18}" width="40" height="27" rx="3" fill="${c}"/><rect x="${x - 16}" y="${y - 14}" width="32" height="19" fill="#cbd5e1"/>
          <path d="M${x - 6} ${y + 9}h12l3 8h-18z" fill="${c}"/>`;
      case 'server':
        return `<rect x="${x - 15}" y="${y - 22}" width="30" height="44" rx="4" fill="${c}"/><path d="M${x - 9} ${y - 12}h18M${x - 9} ${y - 2}h18M${x - 9} ${y + 8}h18" stroke="#fff" stroke-width="2"/>`;
      case 'cloud':
        return `<path d="M${x - 34} ${y + 14}a14 14 0 0 1 4-27a20 20 0 0 1 36-6a15 15 0 0 1 27 12a12 12 0 0 1-3 21z" fill="${c}" opacity=".85"/>`;
      default: // маршрутизатор
        return `<ellipse cx="${x}" cy="${y + 6}" rx="27" ry="9" fill="${c}" opacity=".55"/><rect x="${x - 27}" y="${y - 10}" width="54" height="16" fill="${c}"/>
          <ellipse cx="${x}" cy="${y - 10}" rx="27" ry="9" fill="${c}" stroke="#fff" stroke-opacity=".35"/>
          <path d="M${x - 12} ${y - 14}l6 4M${x + 12} ${y - 6}l-6-4M${x + 12} ${y - 14}l-6 4M${x - 12} ${y - 6}l6-4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
    }
  }

  function svg(topo) {
    const N = {}; topo.nodes.forEach(n => N[n.id] = n);
    const W = topo.w || 900, H = topo.h || 420;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, sans-serif">`;
    (topo.zones || []).forEach(z => {
      s += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="16" fill="${z.c || '#3b82f6'}" fill-opacity=".07" stroke="${z.c || '#3b82f6'}" stroke-opacity=".45" stroke-dasharray="6 5"/>
        <text x="${z.x + 12}" y="${z.y + 20}" font-size="13" font-weight="700" fill="${z.c || '#3b82f6'}">${esc(z.label)}</text>`;
    });
    // смещение параллельных линков: {off: px} сдвигает линию перпендикулярно
    const ends = l => {
      let a = N[l[0]], b = N[l[2]]; const o = l[5] || {};
      if (!a || !b || !o.off) return [a, b];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * o.off, ny = dx / len * o.off;
      return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }];
    };
    (topo.links || []).forEach(l => {
      const [a, b] = ends(l); if (!a || !b) return;
      const o = l[5] || {};
      s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${o.c || 'var(--tx3)'}" stroke-width="${o.w || 2.2}" ${o.dash ? 'stroke-dasharray="7 5"' : ''}/>`;
    });
    (topo.links || []).forEach(l => {
      const [a, b] = ends(l); if (!a || !b) return;
      const lab = (n, other, txt, k) => {
        if (!txt) return '';
        const x = n.x + (other.x - n.x) * k, y = n.y + (other.y - n.y) * k;
        const w = txt.length * 6.4 + 8;
        return `<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="17" rx="4" fill="var(--card)" stroke="var(--line)"/><text x="${x}" y="${y + 4}" font-size="11" text-anchor="middle" fill="var(--tx2)" font-family="Consolas,monospace">${esc(txt)}</text>`;
      };
      const k = (l[5] && l[5].k) || 0.27;
      s += lab(a, b, l[1], k) + lab(b, a, l[3], k);
      if (l[4]) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const parts = String(l[4]).split('\n');
        parts.forEach((p, i) => s += `<text x="${mx}" y="${my - 8 - (parts.length - 1 - i) * 13}" font-size="11.5" text-anchor="middle" fill="var(--acc2)" font-weight="600" paint-order="stroke" stroke="var(--card)" stroke-width="4">${esc(p)}</text>`);
      }
    });
    topo.nodes.forEach(n => {
      s += icon(n);
      const lines = String(n.label || n.id).split('\n');
      const dy = n.t === 'pc' ? 34 : n.t === 'server' ? 38 : n.t === 'cloud' ? 30 : 32;
      lines.forEach((t, i) => s += `<text x="${n.x}" y="${n.y + dy + i * 14}" font-size="${i ? 11 : 13}" text-anchor="middle" fill="${i ? 'var(--tx2)' : 'var(--tx)'}" font-weight="${i ? 400 : 700}" paint-order="stroke" stroke="var(--card)" stroke-width="3">${esc(t)}</text>`);
    });
    return s + '</svg>';
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) { } }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }

  // Сборка .unl. imgs — {vios, viosl2, csr} из настроек.
  function unl(lab, name, imgs) {
    const topo = lab.topo;
    const nodes = topo.nodes.filter(n => n.t !== 'cloud' && !n.virtual);
    const idOf = {}; nodes.forEach((n, i) => idOf[n.id] = i + 1);
    const ifs = {}; nodes.forEach(n => ifs[n.id] = []);
    const nets = [];
    (topo.links || []).forEach((l, i) => {
      if (!(l[0] in idOf) || !(l[2] in idOf) || (l[5] && l[5].virt)) return; // туннели и логические связи не кабели
      const nid = nets.length + 1;
      const A = topo.nodes.find(n => n.id === l[0]), B = topo.nodes.find(n => n.id === l[2]);
      nets.push({ id: nid, name: `Net-${l[0]}-${l[2]}`, x: Math.round((A.x + B.x) / 2), y: Math.round((A.y + B.y) / 2) });
      ifs[l[0]].push({ idx: ifIndex(A.t, l[1]), name: l[1], net: nid });
      ifs[l[2]].push({ idx: ifIndex(B.t, l[3]), name: l[3], net: nid });
    });
    const sc = 1.4;
    let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<lab name="${esc(name)}" id="${uuid()}" version="1" scripttimeout="300" lock="0" author="SDSM course">\n`;
    x += `  <description>${esc(lab.title || name)}</description>\n  <topology>\n    <nodes>\n`;
    const cfgs = [];
    nodes.forEach(n => {
      const tp = TPL[n.t] || TPL.router;
      const id = idOf[n.id];
      const maxIdx = Math.max(-1, ...ifs[n.id].map(i => i.idx));
      let eth = Math.max(tp.min, maxIdx + 1);
      if (tp.template === 'viosl2') eth = Math.ceil(eth / 4) * 4;
      const cfg = (lab.init && lab.init[n.id]) || '';
      if (cfg) cfgs.push({ id, text: cfg, pc: tp.type === 'vpcs' });
      const L = Math.round(n.x * sc + 40), T = Math.round(n.y * sc + 40);
      if (tp.type === 'vpcs') {
        x += `      <node id="${id}" name="${esc(n.id)}" type="vpcs" template="vpcs" image="" ethernet="1" delay="0" icon="${tp.icon}" config="${cfg ? 1 : 0}" left="${L}" top="${T}">\n`;
      } else {
        const image = (imgs && imgs[tp.img]) || '';
        x += `      <node id="${id}" name="${esc(n.id)}" type="qemu" template="${tp.template}" image="${esc(image)}" console="telnet" cpu="${tp.cpu}" cpulimit="0" ram="${n.ram || tp.ram}" ethernet="${eth}" uuid="${uuid()}" qemu_options="${tp.qopt}" qemu_version="" qemu_arch="x86_64" delay="0" icon="${tp.icon}" config="${cfg ? 1 : 0}" left="${L}" top="${T}">\n`;
      }
      ifs[n.id].sort((a, b) => a.idx - b.idx).forEach(i => {
        x += `        <interface id="${i.idx}" name="${esc(i.name)}" type="ethernet" network_id="${i.net}"/>\n`;
      });
      x += `      </node>\n`;
    });
    x += `    </nodes>\n    <networks>\n`;
    nets.forEach(nw => x += `      <network id="${nw.id}" type="bridge" name="${esc(nw.name)}" left="${Math.round(nw.x * sc + 40)}" top="${Math.round(nw.y * sc + 40)}" visibility="0"/>\n`);
    x += `    </networks>\n  </topology>\n`;
    if (cfgs.length) {
      x += `  <objects>\n    <configs>\n`;
      cfgs.forEach(c => x += `      <config id="${c.id}">${b64(c.pc ? c.text.replace(/\n/g, '\r\n') + '\r\n' : c.text.replace(/\n/g, '\r\n') + '\r\nend\r\n')}</config>\n`);
      x += `    </configs>\n  </objects>\n`;
    }
    return x + `</lab>\n`;
  }

  return { svg, unl, TPL };
})();
