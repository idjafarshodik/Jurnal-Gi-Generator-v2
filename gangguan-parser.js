window.GangguanParser = (function () {
  const PHASES = ["R", "S", "T"];
  const JENIS = ["SUTT", "Trafo", "Kopel", "Shunt Capacitor"];
  const KEJADIAN = ["Trip", "Reclose sukses", "Reclose gagal"];
  const CUACA = ["Cerah", "Berawan", "Mendung", "Hujan", "Hujan petir"];

  function emptyCounter() {
    return { R: ["", ""], S: ["", ""], T: ["", ""] };
  }

  function emptyLaporan() {
    return {
      gi: "",
      giRaw: "",
      bay: "",
      jenis: "SUTT",
      objek: "",
      tanggal: "",
      jam: "",
      kejadian: "Trip",
      kronologi: [],
      status: "Trip",
      panel: [],
      relay: [],
      fl: "",
      cPmt: emptyCounter(),
      cLa: emptyCounter(),
      cuaca: "",
      penyebab: [],
      dampak: [],
      tindak: [],
      pmtMasuk: "",
      penormalan: [],
      catatan: [],
    };
  }

  function clean(s) {
    return String(s || "")
      .replace(/[\u200b-\u200f\u034f\ufeff]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function plainOf(s) {
    return clean(String(s).replace(/[*_~]/g, ""));
  }

  function arrows(s) {
    return s.replace(/\u27a1\ufe0f?|\u2192|=>|-->|\u2014>|\u2013>/g, "->");
  }

  function unbullet(s) {
    const m = s.match(/^(?:[-\u2022\u00b7*\u2013\u25aa\u25cf\u25e6]|\d+\))\s*(.*)$/);
    return m ? { bullet: true, text: clean(m[1]) } : { bullet: false, text: s };
  }

  function stripNumber(s) {
    return s.replace(/^(?:\d{1,2}|[IVX]{1,4})\s*[.)]\s*/i, "");
  }

  function hhmm(h, m) {
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return `${h}.${m}`;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function cap(s) {
    const t = clean(s);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
  }

  function detectJenis(text) {
    const s = String(text || "").toUpperCase();
    if (/\b(CAPACITOR|KAPASITOR|CAP\.?\s*BANK|SHUNT)\b/.test(s)) return "Shunt Capacitor";
    if (/\bKOPEL|COUPLER\b/.test(s)) return "Kopel";
    if (/\b(TRAFO|IBT|TRF)\b/.test(s)) return "Trafo";
    if (/\b(SUTT|SUTET|SKTT|TL|LINE)\b/.test(s)) return "SUTT";
    return "";
  }

  function detectKejadian(text) {
    const s = plainOf(text);
    let m = s.match(/reclose\s+(sukses|berhasil|success)/i);
    if (m) return "Reclose sukses";
    m = s.match(/reclose\s+(gagal|failed?)/i);
    if (m) return "Reclose gagal";
    if (/\btrip\b/i.test(s)) return "Trip";
    return "";
  }

  function sectionOf(t) {
    const s = stripNumber(t).toLowerCase();
    if (/^kronolog/.test(s)) return "kronologi";
    if (/^indikasi\s+(dan|&)\s+rel/.test(s)) return "indikasi";
    if (/^penyebab/.test(s)) return "penyebab";
    if (/^dampak/.test(s)) return "dampak";
    if (/^tindak\s*lanjut/.test(s)) return "tindak";
    if (/^penormalan/.test(s)) return "penormalan";
    if (/^lain[-\s]?lain/.test(s)) return "lain";
    return null;
  }

  function subOf(t) {
    const s = t.toLowerCase();
    if (/^(indikasi\s+)?(panel|annun|announ|anoun|anunc)/.test(s)) return "panel";
    if (/^(indikasi\s+)?(relay|relai)\b/.test(s)) return "relay";
    if (/^counter\s+pmt/.test(s)) return "cPmt";
    if (/^counter\s+la\b/.test(s)) return "cLa";
    return null;
  }

  function afterColon(t) {
    const i = t.indexOf(":");
    return i >= 0 ? clean(t.slice(i + 1)) : "";
  }

  function parseCounter(t) {
    const m = arrows(t).match(/^(?:phasa|fasa|phase)?\s*([RST])\s*[:=]\s*(\d*)\s*(?:->\s*(\d*))?\s*$/i);
    if (!m) return null;
    const a = m[2] || "";
    const b = m[3];
    return { ph: m[1].toUpperCase(), val: b === undefined ? (a ? ["", a] : ["", ""]) : [a, b || ""] };
  }

  function parseFl(t) {
    const m = t.match(/^FL\b\s*[:=]?\s*([\d]+(?:[.,]\d+)?)\s*(km)?/i);
    return m ? m[1].replace(".", ",") : null;
  }

  function parseLokasi(t) {
    const m = t.match(/^GI(?:TET|STET)?\s+(?:\d+\s*kV\s+)?(.+?)\s+(?:bay|tl|line|penghantar)\s+(.+)$/i);
    if (!m) return null;
    return { gi: clean(m[1]), bay: clean(m[2]) };
  }

  function parse(text, giList) {
    const out = emptyLaporan();
    out.status = "";
    out.kejadian = "";
    const seen = { kejadian: false };
    let section = null;
    let sub = null;
    let started = false;
    let closed = false;

    const lines = String(text || "").split(/\r?\n/);
    for (const rawLine of lines) {
      if (closed) break;
      const raw = clean(rawLine);
      if (!raw) continue;
      const plain = plainOf(raw);
      if (!plain || /^[-\u2013\u2014_=.]{2,}$/.test(plain)) continue;

      if (/^demikian\b/i.test(plain)) {
        closed = true;
        continue;
      }

      const sec = sectionOf(plain);
      if (sec) {
        started = true;
        section = sec;
        sub = null;
        const rest = afterColon(stripNumber(plain));
        const ub = unbullet(rest);
        if (ub.text && ub.text !== "-") handleLine(ub.text, true);
        continue;
      }

      if (!started) {
        if (/^laporan\s+gangguan/i.test(plain)) continue;
        if (/\b(UIT|UPT|ULTG)\b/.test(plain) && !/\b(SUTT|SUTET|TRAFO|KOPEL|CAPACITOR)\b/i.test(plain)) continue;
        if (/^[IVX]{1,4}\s*[.)]/.test(plain) || /^-?\s*nihil\s*-?$/i.test(plain)) continue;
        const tg = window.ManuverParser.parseTanggal(plain.replace(/^hari\s*:\s*/i, ""));
        if (tg && !out.tanggal) {
          out.tanggal = tg;
          continue;
        }
        if (!out.objek && detectJenis(plain)) {
          out.objek = plain;
          continue;
        }
        out.catatan.push(plain);
        continue;
      }

      const ub = unbullet(plain);
      handleLine(ub.text, ub.bullet);
    }

    function handleLine(t, isBullet) {
      if (!t || t === "-") return;
      if (/^[IVX]{1,4}\s*[.)]/.test(t)) {
        section = null;
        return;
      }
      if (/^-?\s*nihil\s*-?$/i.test(t)) return;

      const cu = t.match(/^(?:kondisi\s+)?cuaca\s*:?\s*(.+)$/i);
      if (cu) {
        if (!out.cuaca) out.cuaca = cap(cu[1]);
        return;
      }

      const st = t.match(/^status\s+peralatan\s*:?\s*(.*)$/i);
      if (st) {
        out.status = cap(st[1]);
        return;
      }

      const sb = subOf(t);
      if (sb && (section === "indikasi" || !isBullet)) {
        section = section || "indikasi";
        sub = sb;
        const rest = afterColon(t);
        if (rest && rest !== "-") handleLine(rest, true);
        return;
      }

      if (section === "kronologi") {
        const m = t.match(/^pukul\s+(\d{1,2})[.:](\d{2})\s*(?:wib|wita|wit)?\s*(.*)$/i);
        if (m && !out.jam) {
          out.jam = hhmm(m[1], m[2]);
          const rest = clean(m[3]);
          const kj = detectKejadian(rest);
          if (kj) {
            out.kejadian = kj;
            seen.kejadian = true;
          }
          const obj = clean(rest.replace(/\b(reclose\s+(sukses|berhasil|success|gagal|failed?)|trip)\b\s*$/i, ""));
          if (!out.objek && obj) out.objek = obj;
          return;
        }
        out.kronologi.push(t);
        return;
      }

      if (section === "indikasi") {
        const lok = parseLokasi(t);
        if (lok && !out.bay) {
          out.giRaw = lok.gi;
          out.bay = lok.bay;
          return;
        }
        if (sub === "cPmt" || sub === "cLa") {
          const c = parseCounter(t);
          if (c) {
            out[sub][c.ph] = c.val;
            return;
          }
        }
        const fl = parseFl(t);
        if (fl !== null) {
          out.fl = fl;
          return;
        }
        if (sub === "panel" || sub === "relay") {
          out[sub].push(t);
          return;
        }
        out.catatan.push(t);
        return;
      }

      if (section === "penormalan") {
        const m = t.match(/PMT\s+masuk\s+(?:jam|pukul)?\s*(\d{1,2})[.:](\d{2})/i);
        if (m && !out.pmtMasuk) {
          out.pmtMasuk = hhmm(m[1], m[2]);
          return;
        }
        out.penormalan.push(t);
        return;
      }

      if (section === "penyebab" || section === "dampak" || section === "tindak") {
        out[section].push(t);
        return;
      }

      out.catatan.push(t);
    }

    if (out.giRaw && Array.isArray(giList)) {
      const key = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
      const g = giList.find((name) => key(name) === key(out.giRaw));
      if (g) out.gi = g;
    }
    out.jenis = detectJenis(out.objek) || detectJenis(out.bay) || "SUTT";
    if (!out.kejadian) out.kejadian = detectKejadian(out.status) || "Trip";
    if (!out.status) out.status = out.kejadian;
    out.tindak = out.tindak.filter((x) => x && x !== "-");
    return out;
  }

  return { parse, emptyLaporan, emptyCounter, PHASES, JENIS, KEJADIAN, CUACA, detectJenis };
})();
