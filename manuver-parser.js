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
      if (isNaN(hh) || isNaN(mm)) return raw;
      hh = Math.max(0, Math.min(23, hh));
      mm = Math.max(0, Math.min(59, mm));
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
        peralatan: normEquipment(tokens.slice(0, bayIdx).join(" ")),
        bay: normEquipment(tokens.slice(bayIdx + 1).join(" ")),
      };
    }
    return { peralatan: normEquipment(tokens.join(" ")), bay: "" };
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

  function parseTanggal(s) {
    const m = s.match(/(\d{1,2})\s*[-\s]\s*([a-z]+)\s*[-\s,]+\s*(\d{4})/i);
    if (!m) return "";
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi < 0) return "";
    const d = parseInt(m[1], 10);
    if (d < 1 || d > 31) return "";
    return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const PEOPLE = [
    ["dispatcher", /^(piket\s+)?(dispatcher|dispa|dispat)$/i],
    ["pengawasManuver", /^(pengawas\s+manuver|pm)$/i],
    ["pengawasPekerjaan", /^(pengawas\s+pekerjaan|pp)$/i],
    ["pengawasK3", /^(pengawas\s+k3|pk3)$/i],
    ["pelaksanaManuver", /^(pelaksana\s+manuver|pelaksana|pelm)$/i],
  ];

  function parseJurnalText(text, giList) {
    const out = {
      giRaw: "",
      namaGi: "",
      tanggal: "",
      keterangan: "",
      pembebasan: [],
      penormalan: [],
      people: {},
      pesan: "",
      skipped: [],
      extraJurnal: false,
    };
    const titleLines = [];
    let section = null;
    let seenManuver = false;
    let seenHeader = false;

    const lines = String(text || "").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = cleanText(lines[i]);
      if (!raw) continue;
      const plain = cleanText(raw.replace(/[*_~]/g, ""));
      if (!plain) continue;

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

      if (/^(pembebasan|pelepasan|pemadaman)\b/i.test(plain)) {
        section = "pembebasan";
        continue;
      }
      if (/^(penormalan|pemberian|pengembalian|penormalan)\b/i.test(plain)) {
        section = "penormalan";
        continue;
      }

      const ket = raw.match(/^\**\s*ket(?:erangan)?\s*\**\s*:\s*(.+)$/i);
      if (ket) {
        out.keterangan = cleanText(ket[1]);
        continue;
      }

      if (!out.tanggal && !seenManuver) {
        const t = parseTanggal(plain);
        if (t) {
          out.tanggal = t;
          continue;
        }
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

    if (!out.keterangan && titleLines.length) out.keterangan = titleLines.join(" ");
    else out.skipped.unshift(...titleLines);

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
  };
})();
