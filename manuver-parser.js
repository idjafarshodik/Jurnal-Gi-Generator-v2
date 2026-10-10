window.ManuverParser = (function () {
  const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
  const TIME_RE = /^(\d{1,2})[.:](\d{2})(?!\d)/;
  const OPEN_WORDS = /^(lepas|keluar|buka|open)$/i;
  const CLOSE_WORDS = /^(masuk|tutup|close)$/i;

  function normalizeSavedTime(val) {
    if (!val) return "";

    const raw = String(val).trim();
    if (!raw) return "";

    let s = raw.toLowerCase().replace(/,/g, ".").trim();

    const ampmMatch = s.match(/(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)(?![a-z])/i);
    if (ampmMatch) {
      let hh = parseInt(ampmMatch[1], 10);
      let mm = parseInt(ampmMatch[2] || "0", 10);
      const ampm = ampmMatch[3].toLowerCase();
      if (ampm === "am" && hh === 12) hh = 0;
      if (ampm === "pm" && hh < 12) hh += 12;
      hh = Math.max(0, Math.min(23, isNaN(hh) ? 0 : hh));
      mm = Math.max(0, Math.min(59, isNaN(mm) ? 0 : mm));
      return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
    }

    let match = s.match(/(\d{1,2})[^\d]?(\d{2})/);
    if (!match) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length === 3) match = [, digits.slice(0, 1), digits.slice(1)];
      else if (digits.length === 4) match = [, digits.slice(0, 2), digits.slice(2)];
    }

    if (match) {
      let hh = parseInt(match[1], 10);
      let mm = parseInt(match[2], 10);
      if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return raw;
      return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
    }

    return raw;
  }

  function cleanText(s) {
    return String(s || "")
      .replace(/ /g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normEquipment(s) {
    return cleanText(s)
      .replace(/(\d+)\s*kv\b/gi, "$1KV")
      .toUpperCase();
  }

  function canonPeralatan(s) {
    let e = normEquipment(s)
      .replace(/\bINC(?:OMM?ING|\.)(?=\s|$)/g, "INC")
      .replace(/\s+/g, " ")
      .trim();
    if (/^PMS INC\b/.test(e)) e = e.replace(/^PMS INC/, "PMT INC");
    if (e === "PMT 20KV" || e === "PMT INC" || e === "PMT INC 20 KV") e = "PMT INC 20KV";
    return e;
  }

  const BAY_CODE_RE = /^\d{2}[A-Z]+\d+[A-Z]?$/i;

  function extractWaktuFromLine(line) {
    const s = cleanText(line);
    let m = s.match(/^(\d{1,2})[.:](\d{2})(?::\d{2})?\s*(am|pm)?(?![a-z\d])/i);
    if (m) return { waktu: normalizeSavedTime(m[0]), rest: s.slice(m[0].length).trim() };
    m = s.match(/^(\d{3,4})\b/);
    if (m) return { waktu: normalizeSavedTime(m[0]), rest: s.slice(m[0].length).trim() };
    return { waktu: "", rest: s };
  }

  function wordStatus(word) {
    const w = cleanText(word);
    if (/^draw\s*in$/i.test(w)) return "Draw In";
    if (/^draw\s*out$/i.test(w)) return "Draw Out";
    if (OPEN_WORDS.test(w)) return "#";
    if (CLOSE_WORDS.test(w)) return "//";
    return "";
  }

  function extractStatusFromLine(text) {
    let s = cleanText(text);
    let note = "";
    let status = "";

    const paren = s.match(/\(\s*([^()]*?)\s*\)\s*$/);
    if (paren) {
      note = paren[1];
      s = s.slice(0, paren.index).trim();
    }

    let m = s.match(/(\/\/|#)\s*$/);
    if (m) {
      status = m[1];
      s = s.slice(0, m.index).trim();
    }

    if (!status) {
      m = s.match(/\bdraw\s*(in|out)\s*$/i);
      if (m) {
        status = m[1].toLowerCase() === "in" ? "Draw In" : "Draw Out";
        s = s.slice(0, m.index).trim();
      }
    }

    if (!status) {
      m = s.match(/\b(lepas|keluar|buka|open|masuk|tutup|close)\s*$/i);
      if (m) {
        status = wordStatus(m[1]);
        s = s.slice(0, m.index).trim();
      }
    }

    if (!status && note) {
      status = wordStatus(note) || `(${cleanText(note).toUpperCase()})`;
    }

    return { status, rest: s };
  }

  function splitPeralatanBay(text) {
    const tokens = cleanText(text).split(" ").filter(Boolean);
    if (!tokens.length) return { peralatan: "", bay: "" };
    const bayIdx = tokens.findIndex((t) => /^bay$/i.test(t));
    if (bayIdx > 0 && bayIdx < tokens.length - 1) {
      return {
        peralatan: canonPeralatan(tokens.slice(0, bayIdx).join(" ")),
        bay: normEquipment(tokens.slice(bayIdx + 1).join(" ")),
      };
    }
    const last = tokens[tokens.length - 1];
    if (tokens.length > 1 && BAY_CODE_RE.test(last)) {
      return { peralatan: canonPeralatan(tokens.slice(0, -1).join(" ")), bay: normEquipment(last) };
    }
    return { peralatan: canonPeralatan(tokens.join(" ")), bay: "" };
  }

  function parseManuverLine(line) {
    const { waktu, rest: afterWaktu } = extractWaktuFromLine(line);
    const { status, rest: afterStatus } = extractStatusFromLine(afterWaktu);
    const { peralatan, bay } = splitPeralatanBay(afterStatus);
    return { waktu, peralatan, bay, status };
  }

  function isManuverLine(line) {
    return TIME_RE.test(cleanText(line));
  }

  function parseManuverText(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(cleanText)
      .filter(Boolean)
      .map(parseManuverLine)
      .filter((r) => r.peralatan || r.waktu);
  }

  function monthIndex(word) {
    const w = word.toLowerCase();
    let i = MONTHS.indexOf(w);
    if (i < 0 && w.length >= 3) i = MONTHS.findIndex((m) => m.startsWith(w) || (w === "agt" && m === "agustus"));
    return i;
  }

  function parseTanggal(s) {
    const m = s.match(/(\d{1,2})\s*[-\s]\s*([a-z]+)\.?\s*[-\s,]+\s*(\d{4})/i);
    if (!m) return "";
    const mi = monthIndex(m[2]);
    if (mi < 0) return "";
    const d = parseInt(m[1], 10);
    if (d < 1 || d > 31) return "";
    return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const PEOPLE = [
    ["dispatcher20kv", /^(piket\s+)?(dispatcher|dispa|dispat)\s*(up2d|apd|20\s*kv)$/i],
    ["operator20kv", /^operator\s*(20\s*kv|up2d|apd)$/i],
    ["dispatcher", /^(piket\s+)?(dispatcher|dispa|dispat)(\s*(up2b|apb|150\s*kv))?$/i],
    ["pengawasManuver", /^(pengawas\s+manuver|pm)$/i],
    ["pengawasPekerjaan", /^(pengawas\s+pekerjaan|pp)$/i],
    ["pengawasK3", /^(pengawas\s+k3|pk3)$/i],
    ["pelaksanaManuver", /^(pelaksana\s+manuver|pelaksana|pelm)$/i],
  ];

  const SEP_RE = /^[\s\-—–_=~.•*]{3,}$/;
  const PEMBEBASAN_RE = /^(?:manuver\s+)?(pembebasan|pelepasan|pemadaman)\b/i;
  const PENORMALAN_RE = /^(?:manuver\s+)?(penormalan|pemberian|pengembalian)\b/i;
  const KET_RE = /^(ket|keterangan|uraian(?:\s+pekerjaan)?|pekerjaan)\s*:\s*(.*)$/i;

  function parseJurnalText(text, giList) {
    const out = {
      giRaw: "",
      namaGi: "",
      tanggal: "",
      tanggalPenormalan: "",
      keterangan: "",
      pembebasan: [],
      penormalan: [],
      people: {},
      pesan: "",
      skipped: [],
      extraJurnal: false,
    };
    const titleLines = [];
    const ketParts = [];
    const sectionDate = { pembebasan: "", penormalan: "" };
    let headerDate = "";
    let section = null;
    let seenManuver = false;
    let seenHeader = false;
    let expectKet = false;

    const lines = String(text || "").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = cleanText(lines[i]);
      if (!raw) continue;
      if (SEP_RE.test(raw)) continue;
      const plain = cleanText(raw.replace(/[*_~]/g, ""));
      if (!plain) continue;

      if (expectKet) {
        const bullet = plain.match(/^[-•–]\s*(.+)$/);
        if (bullet) {
          ketParts.push(cleanText(bullet[1]));
          continue;
        }
        expectKet = false;
      }

      const header = plain.match(/^jurnal(?:\s+manuver)?\s+(?:gi|gitet|gistet|gis|gardu\s+induk)\b\s*(.*)$/i);
      if (header) {
        if (seenHeader || seenManuver) {
          out.extraJurnal = true;
          break;
        }
        seenHeader = true;
        out.giRaw = cleanText(header[1]);
        continue;
      }

      if (isManuverLine(plain)) {
        seenManuver = true;
        const row = parseManuverLine(plain);
        (section === "penormalan" ? out.penormalan : out.pembebasan).push(row);
        continue;
      }

      const secHit = PEMBEBASAN_RE.test(plain) ? "pembebasan" : PENORMALAN_RE.test(plain) ? "penormalan" : null;
      if (secHit) {
        section = secHit;
        const t = parseTanggal(plain);
        if (t && !sectionDate[secHit]) sectionDate[secHit] = t;
        continue;
      }

      const t = parseTanggal(plain);
      if (t && plain.replace(/[^a-z0-9]/gi, "").length <= 30) {
        if (section && !sectionDate[section]) sectionDate[section] = t;
        else if (!headerDate && !seenManuver) headerDate = t;
        else out.skipped.push(raw);
        continue;
      }

      const ket = plain.match(KET_RE);
      if (ket) {
        const v = cleanText(ket[2]);
        if (v) ketParts.push(v);
        expectKet = true;
        continue;
      }

      if (/^(alhamdulill?ah|bismillah|semoga|terima\s*kasih)/i.test(plain)) {
        if (!out.pesan) out.pesan = raw;
        else out.skipped.push(raw);
        continue;
      }

      const person = plain.match(/^([^:]{1,40}?)\s*:\s*(.+)$/);
      if (person) {
        const label = cleanText(person[1]);
        const hit = PEOPLE.find(([, re]) => re.test(label));
        if (hit && !out.people[hit[0]]) out.people[hit[0]] = cleanText(person[2]);
        else out.skipped.push(raw);
        continue;
      }

      if (!seenManuver && !section) titleLines.push(raw);
      else out.skipped.push(raw);
    }

    out.keterangan = ketParts.join("; ");
    if (!out.keterangan && titleLines.length) out.keterangan = titleLines.join(" ");
    else out.skipped.unshift(...titleLines);

    out.tanggal = sectionDate.pembebasan || headerDate || sectionDate.penormalan;
    if (out.penormalan.length) {
      const tn = sectionDate.penormalan || (headerDate && headerDate > out.tanggal ? headerDate : "");
      if (tn && tn !== out.tanggal) out.tanggalPenormalan = tn;
    }

    if (out.giRaw && Array.isArray(giList)) {
      const key = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const g = giList.find((name) => key(name) === key(out.giRaw));
      if (g) out.namaGi = g;
    }

    return out;
  }

  return {
    normalizeSavedTime,
    parseManuverLine,
    parseManuverText,
    parseJurnalText,
    isManuverLine,
    canonPeralatan,
    parseTanggal,
  };
})();
