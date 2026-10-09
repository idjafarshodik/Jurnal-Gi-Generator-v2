(function () {
  const JG = (window.JG = window.JG || {});

  const COLOR = { open: "var(--green)", closed: "var(--red)", none: "var(--line-strong)" };
  const WIRE = "var(--line-strong)";

  JG.STATUS_META = {
    "#": { state: "open", word: "lepas" },
    "//": { state: "closed", word: "masuk" },
    "Draw Out": { state: "open", word: "" },
    "Draw In": { state: "closed", word: "" },
  };

  JG.stateOf = function (status) {
    return (JG.STATUS_META[status] || {}).state || "unknown";
  };

  JG.statusPill = function (status) {
    const meta = JG.STATUS_META[status];
    if (!status) return `<span class="st st-none">status?</span>`;
    if (!meta) return `<span class="st st-other">${JG.esc(status)}</span>`;
    const cls = meta.state === "open" ? "st-open" : "st-closed";
    return meta.word
      ? `<span class="st ${cls}"><b>${JG.esc(status)}</b>${meta.word}</span>`
      : `<span class="st ${cls}"><b>${JG.esc(status)}</b></span>`;
  };

  JG.eqType = function (peralatan) {
    const s = String(peralatan || "").toUpperCase();
    if (/GROUND|\bGND\b|TANAH|\bPMS\s*G\b/.test(s)) return "gnd";
    if (/^PMT\b.*\bINC/.test(s)) return "inc";
    if (/^PMS\b.*\bBUS\s*A\b/.test(s)) return "busA";
    if (/^PMS\b.*\bBUS\s*B\b/.test(s)) return "busB";
    if (/^PMS\b.*\bLINE\b/.test(s)) return "line";
    if (/^PMT\b/.test(s)) return "pmt";
    if (/^PMS\b/.test(s)) return "pms";
    return "other";
  };

  JG.isKopel = (bay) => /KOPEL|COUPLER/i.test(bay || "");

  JG.sym = function (type, state, size = 24) {
    const st = state === "open" || state === "closed" ? state : null;
    const col = st ? COLOR[st] : "currentColor";
    const closed = st === "closed";
    const term = st ? WIRE : "currentColor";
    if (type === "pmt" || type === "inc") {
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 1v5M12 18v5" stroke="${term}" stroke-width="2"/><rect x="6" y="6" width="12" height="12" rx="1.5" fill="${closed ? col : "none"}" stroke="${col}" stroke-width="2.4"/></svg>`;
    }
    if (type === "other") {
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="5.5" fill="${closed ? col : "none"}" stroke="${col}" stroke-width="2.4"/></svg>`;
    }
    const blade = closed
      ? `<path d="M12 6v12" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/>`
      : `<path d="M12 18L5.5 7.5" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/>`;
    const top = `<path d="M12 1v5M9 6h6" stroke="${term}" stroke-width="2"/><circle cx="12" cy="18" r="1.8" fill="${col}"/>`;
    if (type === "gnd") {
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${top}${blade}<path d="M12 19.8v1.2M7.5 21h9M9.5 23h5" stroke="${col}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${top}${blade}<path d="M12 19.8V23" stroke="${term}" stroke-width="2"/></svg>`;
  };

  function finalStates(rows) {
    const bays = [];
    const map = new Map();
    rows.forEach((r) => {
      const bay = (r.bay || "").trim();
      if (!map.has(bay)) {
        map.set(bay, { name: bay, items: new Map() });
        bays.push(bay);
      }
      map.get(bay).items.set(r.peralatan, { peralatan: r.peralatan, status: r.status, type: JG.eqType(r.peralatan), state: JG.stateOf(r.status) });
    });
    return bays.map((b) => map.get(b));
  }

  function typeStates(bay) {
    const t = {};
    bay.items.forEach((it) => {
      t[it.type] = it.state;
    });
    return t;
  }

  const txt = (x, y, s, anchor = "middle", extra = "") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" class="mm-t" ${extra}>${JG.esc(s)}</text>`;

  function hDisc(cx, y, state) {
    const c = COLOR[state] || COLOR.none;
    const dash = state ? "" : ` stroke-dasharray="3 3"`;
    const blade =
      state === "closed"
        ? `<path d="M${cx - 14} ${y}H${cx + 14}" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`
        : state === "open"
        ? `<path d="M${cx - 14} ${y}L${cx + 10} ${y - 14}" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`
        : `<path d="M${cx - 14} ${y}H${cx + 14}" stroke="${c}" stroke-width="2.4"${dash}/>`;
    return `<circle cx="${cx - 14}" cy="${y}" r="3" fill="${c}"/>${blade}<circle cx="${cx + 14}" cy="${y}" r="3" fill="${c}"/>`;
  }

  function vDisc(cx, yTop, yPivot, state) {
    const c = COLOR[state] || COLOR.none;
    const dir = yPivot > yTop ? -1 : 1;
    const blade =
      state === "closed"
        ? `<path d="M${cx} ${yPivot}V${yTop}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`
        : state === "open"
        ? `<path d="M${cx} ${yPivot}L${cx - 11} ${yPivot + dir * 14}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`
        : `<path d="M${cx} ${yPivot}V${yTop}" stroke="${c}" stroke-width="2.2" stroke-dasharray="3 3"/>`;
    return `${blade}<circle cx="${cx}" cy="${yPivot}" r="2.6" fill="${c}"/>`;
  }

  function box(cx, cy, size, state) {
    const c = COLOR[state] || COLOR.none;
    const fill = state === "closed" ? c : "var(--plate)";
    const dash = state ? "" : ` stroke-dasharray="3 3"`;
    return `<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" rx="3" fill="${fill}" stroke="${c}" stroke-width="3"${dash}/>`;
  }

  function stateWord(state) {
    return state === "open" ? "lepas" : state === "closed" ? "masuk" : "tidak dimanuver";
  }

  function lineBaySvg(bay) {
    const t = typeStates(bay);
    const y = 40;
    const parts = [];
    const both = "busA" in t && "busB" in t;
    const busName = "busA" in t ? "Bus A" : "busB" in t ? "Bus B" : "Bus";
    const busState = t.busA || t.busB;
    let x0;
    if (both) {
      parts.push(`<rect x="8" y="8" width="6" height="24" rx="2" fill="var(--bus)"/>`, `<rect x="8" y="48" width="6" height="24" rx="2" fill="var(--bus)"/>`);
      parts.push(txt(20, 12, "A", "start", 'class="mm-t mm-bus"'), txt(20, 84, "B", "start", 'class="mm-t mm-bus"'));
      parts.push(`<path d="M14 20H36M64 20H96M14 60H36M64 60H96M96 20V60M96 ${y}H126" stroke="${WIRE}" stroke-width="2.4" fill="none"/>`);
      parts.push(hDisc(50, 20, t.busA), hDisc(50, 60, t.busB));
      x0 = 96;
    } else {
      parts.push(`<rect x="8" y="16" width="6" height="48" rx="2" fill="var(--bus)"/>`, txt(4, 80, busName, "start"));
      parts.push(`<path d="M14 ${y}H36M64 ${y}H126" stroke="${WIRE}" stroke-width="2.4"/>`);
      parts.push(hDisc(50, y, busState), txt(50, 64, "PMS bus"));
      x0 = 14;
    }
    parts.push(box(139, y, 26, t.pmt), txt(139, 70, "PMT"));
    parts.push(`<path d="M152 ${y}H190M218 ${y}H318" stroke="${WIRE}" stroke-width="2.4"/>`);
    parts.push(`<path d="M318 ${y - 7}l9 7-9 7" fill="none" stroke="${WIRE}" stroke-width="2.4" stroke-linejoin="round"/>`);
    parts.push(hDisc(204, y, t.line), txt(204, 64, "PMS line"));
    const gx = 266;
    const gc = COLOR[t.gnd] || COLOR.none;
    const gBlade =
      t.gnd === "closed"
        ? `<path d="M${gx} ${y}v26" stroke="${gc}" stroke-width="3.2" stroke-linecap="round"/>`
        : t.gnd === "open"
        ? `<path d="M${gx} ${y + 26}L${gx + 13} ${y + 10}" stroke="${gc}" stroke-width="3.2" stroke-linecap="round"/>`
        : `<path d="M${gx} ${y}v26" stroke="${gc}" stroke-width="2.2" stroke-dasharray="3 3"/>`;
    parts.push(gBlade, `<circle cx="${gx}" cy="${y + 26}" r="2.6" fill="${gc}"/>`);
    parts.push(`<path d="M${gx - 9} ${y + 31}h18M${gx - 5} ${y + 35}h10M${gx - 2} ${y + 39}h4" stroke="${gc}" stroke-width="2" stroke-linecap="round"/>`);
    parts.push(txt(gx + 16, y + 36, "Ground", "start"));

    const label = [
      both ? `PMS bus A ${stateWord(t.busA)}, PMS bus B ${stateWord(t.busB)}` : `PMS bus ${stateWord(busState)}`,
      `PMT ${stateWord(t.pmt)}`,
      `PMS line ${stateWord(t.line)}`,
      `PMS ground ${stateWord(t.gnd)}`,
    ].join(", ");
    return `<svg class="mimic" viewBox="0 0 340 ${both ? 92 : 88}" role="img" aria-label="Posisi akhir: ${JG.esc(label)}">${parts.join("")}</svg>`;
  }

  function shortLabel(name) {
    const words = String(name || "-").toUpperCase().split(/\s+/);
    const l1 = words[0].length > 9 ? words[0].slice(0, 8) + "." : words[0];
    const l2 = words.slice(1).join(" ");
    return [l1, l2.length > 9 ? l2.slice(0, 8) + "." : l2];
  }

  function busbarSvg(bays) {
    const colW = 66;
    const x0 = 34;
    const w = x0 + bays.length * colW + 8;
    const yA = 14;
    const yB = 76;
    const parts = [
      `<path d="M26 ${yA}H${w - 6}M26 ${yB}H${w - 6}" stroke="var(--bus)" stroke-width="5" stroke-linecap="round"/>`,
      txt(10, yA + 5, "A", "start", 'class="mm-t mm-bus"'),
      txt(10, yB + 5, "B", "start", 'class="mm-t mm-bus"'),
    ];
    const aria = [];
    bays.forEach((bay, i) => {
      const cx = x0 + i * colW + colW / 2;
      const t = typeStates(bay);
      if (JG.isKopel(bay.name)) {
        parts.push(`<path d="M${cx} ${yA}V${yA + 4}M${cx} 30V33M${cx} 57V60M${cx} ${yB - 4}V${yB}" stroke="${WIRE}" stroke-width="2.2"/>`);
        parts.push(vDisc(cx, yA + 4, 30, t.busA), box(cx, 45, 22, t.pmt), vDisc(cx, yB - 4, 60, t.busB));
        aria.push(`Kopel: PMS A ${stateWord(t.busA)}, PMT ${stateWord(t.pmt)}, PMS B ${stateWord(t.busB)}`);
      } else {
        parts.push(`<path d="M${cx} ${yA}V${yA + 4}M${cx} 34V52M${cx} ${yB - 4}V${yB}M${cx} 43H${cx + 16}" stroke="${WIRE}" stroke-width="2.2"/>`);
        parts.push(vDisc(cx, yA + 4, 34, t.busA), vDisc(cx, yB - 4, 52, t.busB));
        parts.push(`<circle cx="${cx}" cy="43" r="3.4" fill="var(--ink)"/>`);
        aria.push(`${bay.name}: PMS A ${stateWord(t.busA)}, PMS B ${stateWord(t.busB)}`);
      }
      const [l1, l2] = shortLabel(bay.name);
      parts.push(txt(cx, 94, l1), l2 ? txt(cx, 106, l2) : "");
    });
    return `<svg class="mimic mimic-bus" viewBox="0 0 ${w} 112" role="img" aria-label="${JG.esc(aria.join("; "))}">${parts.join("")}</svg>`;
  }

  function lampsHtml(bays, maxItems = 8) {
    let shown = 0;
    let hidden = 0;
    const multi = bays.length > 1;
    const groups = bays
      .map((bay) => {
        const items = [...bay.items.values()];
        const lis = items
          .map((it) => {
            if (shown >= maxItems) {
              hidden++;
              return "";
            }
            shown++;
            const cls = it.state === "open" ? "lamp-open" : it.state === "closed" ? "lamp-closed" : "lamp-none";
            const word = it.state === "open" ? "lepas" : it.state === "closed" ? "masuk" : (it.status || "").replace(/[()]/g, "").toLowerCase() || "?";
            return `<li><span class="lamp ${cls}"></span><span class="lamp-eq">${JG.esc(it.peralatan)}</span><span class="lamp-st">${JG.esc(word)}</span></li>`;
          })
          .join("");
        if (!lis) return "";
        const head = multi || bay.name ? `<div class="lamps-bay">${bay.name ? `Bay ${JG.esc(bay.name)}` : "Tanpa bay"}</div>` : "";
        return `${head}<ul class="lamps-list">${lis}</ul>`;
      })
      .join("");
    return `<div class="lamps">${groups}${hidden ? `<div class="lamps-more">${hidden} peralatan lain</div>` : ""}</div>`;
  }

  JG.bayVisualKind = function (rows) {
    if (!rows.length) return "none";
    const bays = finalStates(rows);
    const unknown = rows.some((r) => {
      const ty = JG.eqType(r.peralatan);
      return !r.bay || ty === "other" || ty === "inc" || ty === "pms" || JG.stateOf(r.status) === "unknown";
    });
    if (unknown) return "lamps";
    const lineTypes = new Set(["busA", "busB", "pmt", "line", "gnd"]);
    if (bays.length === 1 && !JG.isKopel(bays[0].name)) {
      return [...bays[0].items.values()].every((it) => lineTypes.has(it.type)) ? "line" : "lamps";
    }
    if (bays.length <= 7) {
      const ok = bays.every((b) =>
        [...b.items.values()].every((it) => it.type === "busA" || it.type === "busB" || (it.type === "pmt" && JG.isKopel(b.name)))
      );
      if (ok) return "busbar";
    }
    return "lamps";
  };

  JG.bayVisual = function (rows) {
    const kind = JG.bayVisualKind(rows);
    if (kind === "none") return "";
    const bays = finalStates(rows);
    if (kind === "line") return lineBaySvg(bays[0]);
    if (kind === "busbar") return busbarSvg(bays);
    return lampsHtml(bays);
  };
})();
