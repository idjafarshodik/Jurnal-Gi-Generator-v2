window.ManuverParser = (function () {
  function normalizeSavedTime(val) {
    if (!val) return "";

    const raw = String(val).trim();
    if (!raw) return "";

    let s = raw.toLowerCase().replace(/,/g, ".").trim();

    const ampmMatch = s.match(/(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)/i);
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
      if (digits.length === 3) {
        match = [, digits.slice(0, 1), digits.slice(1)];
      } else if (digits.length === 4) {
        match = [, digits.slice(0, 2), digits.slice(2)];
      }
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

  function extractWaktuFromLine(line) {
    let s = line.trim();
    let m = s.match(/^(\d{1,2})[.:](\d{2})(?::\d{2})?\s*(am|pm)?(?![a-z])/i);
    if (m) {
      const waktu = normalizeSavedTime(m[0]);
      const rest = s.slice(m[0].length).trim();
      return { waktu, rest };
    }
    m = s.match(/^(\d{3,4})\b/);
    if (m) {
      const waktu = normalizeSavedTime(m[0]);
      const rest = s.slice(m[0].length).trim();
      return { waktu, rest };
    }
    return { waktu: "", rest: s };
  }

  function extractStatusFromLine(text) {
    const s = text.trim();
    let m = s.match(/(?:\/\/|#)?\s*\(\s*draw\s*in\s*\)\s*$/i);
    if (m) return { status: "Draw In", rest: s.slice(0, m.index).trim() };
    m = s.match(/(?:\/\/|#)?\s*\(\s*draw\s*out\s*\)\s*$/i);
    if (m) return { status: "Draw Out", rest: s.slice(0, m.index).trim() };
    m = s.match(/draw\s*in\s*$/i);
    if (m) return { status: "Draw In", rest: s.slice(0, m.index).trim() };
    m = s.match(/draw\s*out\s*$/i);
    if (m) return { status: "Draw Out", rest: s.slice(0, m.index).trim() };
    m = s.match(/\/\/\s*$/);
    if (m) return { status: "//", rest: s.slice(0, m.index).trim() };
    m = s.match(/#\s*$/);
    if (m) return { status: "#", rest: s.slice(0, m.index).trim() };
    return { status: "", rest: s };
  }

  function splitPeralatanBay(text) {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { peralatan: "", bay: "" };

    const bayIdx = tokens.findIndex((t) => /^bay$/i.test(t));
    if (bayIdx !== -1 && bayIdx < tokens.length - 1) {
      return {
        peralatan: tokens.slice(0, bayIdx).join(" "),
        bay: tokens.slice(bayIdx + 1).join(" "),
      };
    }

    return { peralatan: tokens.join(" "), bay: "" };
  }

  function parseManuverLine(line) {
    const { waktu, rest: afterWaktu } = extractWaktuFromLine(line);
    const { status, rest: afterStatus } = extractStatusFromLine(afterWaktu);
    const { peralatan, bay } = splitPeralatanBay(afterStatus);
    return { waktu, peralatan, bay, status: status || "#" };
  }

  function parseManuverText(text) {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseManuverLine);
  }

  return {
    normalizeSavedTime,
    parseManuverLine,
    parseManuverText,
  };
})();
