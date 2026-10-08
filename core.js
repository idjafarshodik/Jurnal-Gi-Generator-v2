(function () {
  const JG = (window.JG = window.JG || {});
  const { normalizeSavedTime } = window.ManuverParser;

  JG.THEME_KEY = "jurnalGiTheme_v1";

  JG.PERALATAN = [
    "PMT 150KV",
    "PMS BUS A 150KV",
    "PMS BUS B 150KV",
    "PMS LINE 150KV",
    "PMS GROUND 150KV",
    "PMT INC 20KV",
  ];

  JG.STATUS = ["#", "//", "Draw In", "Draw Out"];

  JG.GI_LIST = [
    ["PAMEKASAN", "Pamekasan"],
    ["GILITIMUR", "Gilitimur"],
    ["BANGKALAN", "Bangkalan"],
    ["SAMPANG", "Sampang"],
    ["GULUK-GULUK", "Guluk-Guluk"],
    ["SUMENEP", "Sumenep"],
  ];

  JG.PRESET_AWAL = [
    "Semoga pekerjaan diberikan keamanan dan kelancaran🙏",
    "Bismillah, Semoga pekerjaan lancar dan personil aman🙏🏻🙏🏻",
    "Bismillah semoga pekerjaan berjalan lancar personil aman 🤲",
  ];

  JG.PRESET_AKHIR = [
    "Alhamdulillah pekerjaan sudah selesai dengan dan lancar🙏",
    "Alhamdulillah pekerjaan sudah selesai dengan aman dan lancar🙏",
    "Alhamdulillah pekerjaan telah selesai dengan lancar, aman personil dan peralatan, terimakasih 🙏🏻",
  ];

  JG.sb = () => window.JurnalAuth.supabaseClient;
  JG.normalizeTime = (v) => normalizeSavedTime(v || "");

  JG.esc = function (str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  JG.toast = function (icon, title, text, timer = 1700) {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title,
      text: text || undefined,
      showConfirmButton: false,
      timer,
      timerProgressBar: true,
    });
  };

  JG.giOptionsHtml = function (placeholder) {
    return (
      `<option value="">${placeholder}</option>` +
      JG.GI_LIST.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")
    );
  };

  JG.todayIso = function () {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  JG.hariFromDate = function (dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d.getDay()];
  };

  JG.formatTanggalIndo = function (dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  JG.parseIso = function (iso) {
    if (!iso) return null;
    const d = new Date(String(iso).replace(/(\.\d{3})\d+/, "$1"));
    return isNaN(d.getTime()) ? null : d;
  };

  JG.formatSavedAt = function (iso, withToday) {
    const d = JG.parseIso(iso);
    if (!d) return "";
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (d.toDateString() === new Date().toDateString()) return withToday ? `hari ini ${hhmm}` : hhmm;
    const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][d.getMonth()];
    return `${d.getDate()} ${bln} ${hhmm}`;
  };

  JG.addMinutes = function (hhmm, minutes) {
    const t = JG.normalizeTime(hhmm);
    const m = /^(\d{2}):(\d{2})$/.exec(t);
    if (!m) return "";
    let total = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + minutes) % 1440;
    if (total < 0) total += 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  JG.nowHHMM = function () {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  JG.flipStatus = function (s) {
    return { "#": "//", "//": "#", "Draw In": "Draw Out", "Draw Out": "Draw In" }[s] || s;
  };

  JG.statusClass = function (s) {
    return { "#": "s-open", "//": "s-close", "Draw In": "s-draw", "Draw Out": "s-draw" }[s] || "s-draw";
  };

  JG.buildReadMoreText = function (visiblePart, hiddenPart) {
    if (!hiddenPart) return visiblePart;
    return visiblePart + "͏".repeat(3105) + "\n" + hiddenPart;
  };

  JG.buildJurnalText = function (d) {
    const lines = [];
    const namaGi = (d.namaGi || "").trim();
    lines.push(namaGi ? `*JURNAL GI ${namaGi.toUpperCase()}*` : "*JURNAL GI _______*");

    const tanggalFormatted = JG.formatTanggalIndo(d.tanggal);
    const lineHariTanggal = [d.hari, d.tanggal ? tanggalFormatted : ""].filter(Boolean).join(", ");
    if (lineHariTanggal) lines.push(lineHariTanggal);

    lines.push("");

    const keterangan = (d.keterangan || "").trim();
    if (keterangan) {
      lines.push(`Ket: ${keterangan}`);
      lines.push("");
    }

    const split = lines.length;

    const fmt = (row) => {
      const waktu = JG.normalizeTime(row.waktu) || "__:__";
      const peralatan = row.peralatan || "______";
      const bayPart = row.bay ? `BAY ${row.bay.toUpperCase()}` : "";
      return `${waktu} ${peralatan} ${bayPart} ${row.status || ""}`.replace(/\s+/g, " ").trim();
    };

    if (d.pembebasanRows.length) {
      lines.push("Pembebasan tegangan:");
      d.pembebasanRows.forEach((r) => lines.push(fmt(r)));
      lines.push("");
    }

    if (d.penormalanRows.length && d.tahapPenormalan) {
      lines.push("Penormalan tegangan:");
      d.penormalanRows.forEach((r) => lines.push(fmt(r)));
      lines.push("");
    }

    const people = [
      ["Dispatcher", d.dispatcher],
      ["Pengawas Manuver", d.pengawasManuver],
      ["Pengawas Pekerjaan", d.pengawasPekerjaan],
      ["Pengawas K3", d.pengawasK3],
      ["Pelaksana Manuver", d.pelaksanaManuver],
    ].filter(([, v]) => (v || "").trim());

    if (people.length) {
      people.forEach(([k, v]) => lines.push(`${k}: ${v.trim()}`));
      lines.push("");
    }

    if (d.pesanPenutup) lines.push(d.pesanPenutup);

    return {
      text: lines.join("\n"),
      visible: lines.slice(0, split).join("\n"),
      hidden: lines.slice(split).join("\n"),
    };
  };

  JG.copyText = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (e2) {
        return false;
      }
    }
  };

  JG.applyTheme = function (theme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-bs-theme", theme);
    document.querySelectorAll("[data-theme-icon]").forEach((el) => {
      el.textContent = theme === "dark" ? "☀️" : "🌙";
    });
    document.querySelectorAll("[data-theme-label]").forEach((el) => {
      el.textContent = theme === "dark" ? "Mode terang" : "Mode gelap";
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#05080a" : "#eef4f2");
  };

  JG.toggleTheme = function () {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    JG.applyTheme(next);
    try {
      localStorage.setItem(JG.THEME_KEY, next);
    } catch (e) {}
  };

  JG.giCache = {};

  JG.loadGi = async function () {
    if (Object.keys(JG.giCache).length) return JG.giCache;
    try {
      const { data, error } = await JG.sb().from("gi").select("id, nama");
      if (error) throw error;
      (data || []).forEach((r) => {
        JG.giCache[r.nama] = r.id;
      });
    } catch (e) {
      console.warn("Gagal memuat data GI:", e);
    }
    return JG.giCache;
  };

  JG.api = {
    async listJurnal({ gi, status, search, limit } = {}) {
      await JG.loadGi();
      let q = JG.sb()
        .from("jurnal_manuver")
        .select(
          "id, tanggal, hari, keterangan, teks_final, dibuat_oleh, diubah_oleh, tahap_penormalan, created_at, updated_at, gi(nama), jurnal_manuver_rows(section, waktu)"
        )
        .order("updated_at", { ascending: false })
        .limit(limit || 200);
      if (gi && JG.giCache[gi]) q = q.eq("gi_id", JG.giCache[gi]);
      if (status) q = q.eq("tahap_penormalan", status === "lengkap");
      if (search) q = q.ilike("keterangan", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async getJurnal(id) {
      const { data, error } = await JG.sb()
        .from("jurnal_manuver")
        .select(
          "id, tanggal, hari, keterangan, dispatcher, pengawas_manuver, pengawas_pekerjaan, pengawas_k3, pelaksana_manuver, pesan_penutup, tahap_penormalan, updated_at, gi(nama), jurnal_manuver_rows(section, urutan, waktu, peralatan, bay, status)"
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },

    async listTemplates() {
      const { data, error } = await JG.sb()
        .from("template_manuver")
        .select("id, nama_template, dibuat_oleh, created_at, template_manuver_rows(section, urutan, peralatan, bay, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async getTemplateRows(id) {
      const { data, error } = await JG.sb()
        .from("template_manuver_rows")
        .select("section, urutan, peralatan, bay, status")
        .eq("template_id", id)
        .order("urutan", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async createTemplate(nama, pembebasanRows, penormalanRows) {
      const sb = JG.sb();
      const { data: inserted, error } = await sb
        .from("template_manuver")
        .insert({ nama_template: nama, dibuat_oleh: window.JurnalAuth.getCurrentUserName() || "-" })
        .select("id")
        .single();
      if (error) throw error;
      const rows = [
        ...pembebasanRows.map((r, i) => ({ template_id: inserted.id, section: "pembebasan", urutan: i, peralatan: r.peralatan, bay: r.bay, status: r.status })),
        ...penormalanRows.map((r, i) => ({ template_id: inserted.id, section: "penormalan", urutan: i, peralatan: r.peralatan, bay: r.bay, status: r.status })),
      ];
      if (rows.length) {
        const { error: rowsError } = await sb.from("template_manuver_rows").insert(rows);
        if (rowsError) throw rowsError;
      }
      return inserted.id;
    },

    async nameSuggestions() {
      const cols = ["dispatcher", "pengawas_manuver", "pengawas_pekerjaan", "pengawas_k3", "pelaksana_manuver"];
      const { data, error } = await JG.sb()
        .from("jurnal_manuver")
        .select(cols.join(", "))
        .order("updated_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const out = {};
      cols.forEach((c) => {
        const seen = new Set();
        out[c] = [];
        (data || []).forEach((r) => {
          const v = (r[c] || "").trim();
          if (v && !seen.has(v.toLowerCase())) {
            seen.add(v.toLowerCase());
            out[c].push(v);
          }
        });
      });
      return out;
    },
  };

  JG.inferBay = function (rows) {
    const count = {};
    rows.forEach((r) => {
      const b = (r.bay || "").trim();
      if (b) count[b] = (count[b] || 0) + 1;
    });
    let best = "";
    let max = 0;
    Object.entries(count).forEach(([b, n]) => {
      if (n > max) {
        best = b;
        max = n;
      }
    });
    return best;
  };

  JG.rowsFromDb = function (rows, bay, withTime) {
    return rows
      .slice()
      .sort((a, b) => a.urutan - b.urutan)
      .map((r) => ({
        waktu: withTime ? JG.normalizeTime(r.waktu) : "",
        peralatan: r.peralatan === "PMT 20KV" ? "PMT INC 20KV" : r.peralatan || "",
        bay: (r.bay || "").trim() === bay ? "" : (r.bay || "").trim(),
        status: r.status || "#",
      }));
  };

  JG.reverseRows = function (rows) {
    return rows
      .slice()
      .reverse()
      .map((r) => ({ waktu: "", peralatan: r.peralatan, bay: r.bay, status: JG.flipStatus(r.status) }));
  };

  JG.timeRange = function (rows) {
    const times = rows.map((r) => JG.normalizeTime(r.waktu)).filter((t) => /^\d{2}:\d{2}$/.test(t));
    if (!times.length) return "";
    return times.length === 1 ? times[0] : `${times[0]}–${times[times.length - 1]}`;
  };

  JG.renderRowList = function (listEl, rows, { withTime = true, bay = "", emptyText = "" } = {}) {
    if (!rows.length) {
      listEl.innerHTML = emptyText ? `<li class="mv-empty">${JG.esc(emptyText)}</li>` : "";
      return;
    }
    listEl.innerHTML = rows
      .map((r, i) => {
        const t = JG.normalizeTime(r.waktu);
        const ownBay = r.bay && r.bay !== bay;
        const bayLine = ownBay ? `<span class="mv-bay">BAY ${JG.esc(r.bay.toUpperCase())}</span>` : !bay && !r.bay ? `<span class="mv-bay mv-bay-missing">Bay belum diisi</span>` : "";
        return `
        <li class="mv-item" data-index="${i}" tabindex="0" role="button" aria-label="Ubah manuver ${i + 1}">
          ${withTime ? `<span class="mv-time ${t ? "" : "is-empty"}">${t || "--:--"}</span>` : `<span class="mv-no">${i + 1}</span>`}
          <span class="mv-main">
            <span class="mv-eq">${JG.esc(r.peralatan || "Peralatan?")}</span>
            ${bayLine}
          </span>
          <span class="mv-status ${JG.statusClass(r.status)}">${JG.esc(r.status)}</span>
        </li>`;
      })
      .join("");
  };

  JG.jurnalCardHtml = function (h, { primary } = {}) {
    const lengkap = !!h.tahap_penormalan;
    const gi = h.gi?.nama ? `GI ${JG.esc(h.gi.nama)}` : "GI -";
    const dateLine = [h.hari, h.tanggal ? JG.formatTanggalIndo(h.tanggal) : ""].filter(Boolean).join(", ");
    const desc = (h.keterangan || "").trim();
    const rows = h.jurnal_manuver_rows || [];
    const pb = rows.filter((r) => r.section === "pembebasan");
    const range = JG.timeRange(pb);
    const who = h.diubah_oleh && h.diubah_oleh !== h.dibuat_oleh ? `${h.dibuat_oleh || "-"} → ${h.diubah_oleh}` : h.dibuat_oleh || "-";
    const primaryLabel = primary === "penormalan" && !lengkap ? "Lanjutkan Penormalan" : lengkap ? "Buka" : "Lanjutkan";
    const primaryAct = primary === "penormalan" && !lengkap ? "penormalan" : "open";

    return `
      <article class="j-card ${lengkap ? "is-done" : "is-open"}" data-id="${h.id}">
        <div class="j-card-top">
          <span class="j-gi">${gi}</span>
          <span class="stage-badge ${lengkap ? "stage-done" : "stage-open"}">${lengkap ? "Lengkap" : "Pembebasan"}</span>
        </div>
        <div class="j-date">${JG.esc(dateLine)} · #${h.id}</div>
        <div class="j-desc ${desc ? "" : "is-empty"}">${desc ? JG.esc(desc) : "Tanpa uraian pekerjaan"}</div>
        <div class="j-meta">${pb.length} manuver${range ? ` · ${range}` : ""} · ${JG.esc(who)} · ${JG.formatSavedAt(h.updated_at || h.created_at, true)}</div>
        <div class="j-actions">
          <button type="button" class="btn btn-sm ${lengkap ? "btn-outline-accent" : "btn-accent"}" data-act="${primaryAct}" data-id="${h.id}">${primaryLabel}</button>
          <div class="dropdown">
            <button type="button" class="btn btn-sm btn-outline-secondary btn-more" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Aksi lain">⋯</button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><button type="button" class="dropdown-item" data-act="view" data-id="${h.id}">Lihat teks</button></li>
              <li><button type="button" class="dropdown-item" data-act="copy" data-id="${h.id}">Salin teks</button></li>
              <li><button type="button" class="dropdown-item" data-act="dasar" data-id="${h.id}">Jadikan dasar jurnal baru</button></li>
              <li><hr class="dropdown-divider"></li>
              <li><button type="button" class="dropdown-item text-danger" data-act="delete" data-id="${h.id}">Hapus</button></li>
            </ul>
          </div>
        </div>
      </article>`;
  };

  JG.rowSheet = (function () {
    let el;
    let bs;
    let cfg = null;
    let selectedPeralatan = "";
    let selectedStatus = "#";
    const $ = (id) => document.getElementById(id);

    function init() {
      if (el) return;
      el = $("rowSheet");
      bs = bootstrap.Offcanvas.getOrCreateInstance(el);

      $("rsPeralatan").innerHTML =
        JG.PERALATAN.map((p) => `<button type="button" class="chip-btn" data-value="${p}">${p.replace(" 150KV", "")}</button>`).join("") +
        `<button type="button" class="chip-btn" data-value="__custom">Lainnya…</button>`;

      $("rsStatus").innerHTML = JG.STATUS.map((s) => `<button type="button" class="seg-btn" data-value="${s}">${s}</button>`).join("");

      $("rsPeralatan").addEventListener("click", (e) => {
        const b = e.target.closest(".chip-btn");
        if (!b) return;
        if (b.dataset.value === "__custom") {
          setPeralatan("__custom");
          $("rsPeralatanCustom").focus();
        } else {
          setPeralatan(b.dataset.value);
        }
      });

      $("rsStatus").addEventListener("click", (e) => {
        const b = e.target.closest(".seg-btn");
        if (b) setStatus(b.dataset.value);
      });

      const waktu = $("rsWaktu");
      waktu.addEventListener("input", (e) => {
        if (e.inputType && e.inputType.startsWith("delete")) return;
        const digits = waktu.value.replace(/\D/g, "").slice(0, 4);
        waktu.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
        $("rsWaktuError").hidden = true;
      });
      waktu.addEventListener("blur", () => {
        if (waktu.value.trim()) waktu.value = JG.normalizeTime(waktu.value);
      });

      $("rsTimeChips").addEventListener("click", (e) => {
        const b = e.target.closest(".chip-btn");
        if (!b || b.disabled) return;
        const v = b.dataset.time;
        waktu.value = v === "now" ? JG.nowHHMM() : JG.addMinutes(cfg.prevTime, parseInt(v, 10));
        $("rsWaktuError").hidden = true;
      });

      $("rowSheetForm").addEventListener("submit", (e) => {
        e.preventDefault();
        submit(cfg && cfg.isNew);
      });
      $("rsSave").addEventListener("click", () => submit(false));
      $("rsSaveNext").addEventListener("click", () => submit(true));
      $("rsDelete").addEventListener("click", () => {
        if (!cfg || cfg.isNew) return;
        cfg.onDelete();
        bs.hide();
      });
      $("rsUp").addEventListener("click", () => move(-1));
      $("rsDown").addEventListener("click", () => move(1));

      el.addEventListener("hidden.bs.offcanvas", () => {
        cfg = null;
      });
    }

    function setPeralatan(v) {
      selectedPeralatan = v;
      const custom = v === "__custom";
      $("rsPeralatan").querySelectorAll(".chip-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.value === v));
      $("rsPeralatanCustom").hidden = !custom;
      $("rsPeralatanError").hidden = true;
    }

    function setStatus(v) {
      selectedStatus = v;
      $("rsStatus").querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.value === v));
    }

    function load(c) {
      cfg = c;
      const row = c.row || {};
      $("rowSheetTitle").textContent = c.title;
      $("rsTimeField").hidden = !c.withTime;
      $("rsWaktu").value = row.waktu || "";
      $("rsWaktuError").hidden = true;
      $("rsPeralatanError").hidden = true;

      const known = JG.PERALATAN.includes(row.peralatan);
      if (row.peralatan && !known) {
        setPeralatan("__custom");
        $("rsPeralatanCustom").value = row.peralatan;
      } else {
        setPeralatan(row.peralatan || "");
        $("rsPeralatanCustom").value = "";
      }
      setStatus(row.status || "#");

      $("rsBay").value = row.bay || "";
      $("rsBay").placeholder = c.defaultBay ? `Ikut bay jurnal: ${c.defaultBay}` : "Contoh: GULUKGULUK 2";
      $("rsBayHint").textContent = c.defaultBay ? "kosongkan kalau sama" : "";

      $("rsTimeChips").querySelectorAll("[data-time]").forEach((b) => {
        if (b.dataset.time !== "now") b.disabled = !JG.normalizeTime(c.prevTime);
      });

      $("rsDelete").hidden = c.isNew;
      $("rsUp").hidden = c.isNew;
      $("rsDown").hidden = c.isNew;
      $("rsUp").disabled = c.index <= 0;
      $("rsDown").disabled = c.index >= c.count - 1;
      $("rsSave").textContent = c.isNew ? "Tambah" : "Simpan";
      $("rsSaveNext").hidden = !c.isNew;
    }

    function readRow() {
      const peralatan = selectedPeralatan === "__custom" ? $("rsPeralatanCustom").value.trim().toUpperCase() : selectedPeralatan;
      let waktu = cfg.withTime ? $("rsWaktu").value.trim() : "";
      if (waktu) waktu = JG.normalizeTime(waktu);
      return { waktu, peralatan, bay: $("rsBay").value.trim().toUpperCase(), status: selectedStatus };
    }

    function submit(next) {
      if (!cfg) return;
      const row = readRow();
      let bad = false;
      if (!row.peralatan) {
        $("rsPeralatanError").hidden = false;
        bad = true;
      }
      if (row.waktu && !/^\d{2}:\d{2}$/.test(row.waktu)) {
        $("rsWaktuError").hidden = false;
        bad = true;
      }
      if (bad) return;
      const nextCfg = cfg.onSubmit(row, next);
      if (next && nextCfg) {
        load(nextCfg);
        if (nextCfg.withTime) $("rsWaktu").focus();
      } else {
        bs.hide();
      }
    }

    function move(dir) {
      if (!cfg || cfg.isNew) return;
      const nextCfg = cfg.onMove(dir, readRow());
      if (nextCfg) load(nextCfg);
    }

    function open(c) {
      init();
      const wide = window.matchMedia("(min-width: 992px)").matches;
      el.classList.toggle("offcanvas-bottom", !wide);
      el.classList.toggle("offcanvas-end", wide);
      load(c);
      bs.show();
    }

    return { open };
  })();
})();
