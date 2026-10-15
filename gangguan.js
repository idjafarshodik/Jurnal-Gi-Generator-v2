(function () {
  const JG = window.JG;
  const GP = window.GangguanParser;
  const STORE_KEY = "jurnalGiGangguan_v1";
  const $ = (id) => document.getElementById(id);

  JG.UNIT = { uit: "UIT JBM", upt: "UPT Gresik", ultg: "ULTG Sampang" };

  const LISTS = [
    ["kronologi", "gKronologi"],
    ["panel", "gPanel"],
    ["relay", "gRelay"],
    ["penyebab", "gPenyebab"],
    ["dampak", "gDampak"],
    ["tindak", "gTindak"],
    ["penormalan", "gPenormalan"],
    ["catatan", "gCatatan"],
  ];

  const PRESET = {
    status: ["Trip", "Reclose sukses", "Reclose gagal", "Lockout"],
    penyebab: ["Proses investigasi", "Pohon tumbang mengenai konduktor", "Sambaran petir", "Layang-layang mengenai konduktor"],
    dampak: ["Tidak ada beban konsumen padam"],
    tindak: (gi) => [
      `Dilakukan download dan event gangguan pada relai proteksi GI ${gi || "___"}`,
      "Dilakukan akses Vaisala",
      "Dilakukan penelusuran lapangan sesuai FL di sekitar T.__",
      "Dilakukan pengamanan pohon",
    ],
  };

  const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function loadStore() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return d && Array.isArray(d.items) ? d : { items: [] };
    } catch (e) {
      return { items: [] };
    }
  }

  function saveStore(d) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(d));
      return true;
    } catch (e) {
      return false;
    }
  }

  function newId() {
    return "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function giName(g) {
    return g.gi ? JG.giLabel(g.gi) : g.giRaw || "";
  }

  function tanggalLaporan(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return `${JG.hariFromDate(iso)}, ${String(d.getDate()).padStart(2, "0")} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
  }

  const dot = (t) => String(t || "").replace(":", ".");

  function counterLine(ph, v) {
    const [a, b] = v || ["", ""];
    const val = a && b ? `${a} -> ${b}` : a ? `${a} -> ` : b || "";
    return `- Phasa ${ph} : ${val}`;
  }

  function bullets(list, fallbackEmpty = true) {
    const items = (list || []).map((x) => String(x).trim()).filter(Boolean);
    if (!items.length) return fallbackEmpty ? ["- "] : [];
    return items.map((x) => `- ${x}`);
  }

  JG.buildGangguanText = function (g) {
    const L = [];
    const objek = (g.objek || "").trim() || "________";
    L.push(`Laporan Gangguan ${JG.UNIT.uit}`);
    L.push(`${JG.UNIT.upt} - ${JG.UNIT.ultg}`);
    L.push(objek);
    L.push(tanggalLaporan(g.tanggal) || "Hari, tanggal");
    L.push("");
    L.push("1. Kronologis Gangguan :");
    L.push(`Pukul ${g.jam ? dot(g.jam) : "__.__"} WIB ${objek} ${g.kejadian || "Trip"}`.replace(/\s+/g, " "));
    (g.kronologi || []).filter((x) => x.trim()).forEach((x) => L.push(x.trim()));
    L.push("");
    L.push("2. Indikasi dan Relai :");
    L.push(`GI 150kV ${giName(g) || "____"} Bay ${(g.bay || "").trim() || "____"}`);
    L.push(`Status peralatan : ${g.status || ""}`.trimEnd());
    L.push("");
    L.push("Indikasi Panel :");
    L.push(...bullets(g.panel));
    L.push("");
    L.push("Indikasi Relay :");
    L.push(...bullets(g.relay, false));
    L.push(`- FL : ${g.fl ? `${g.fl} km` : ""}`);
    L.push("");
    L.push("Counter PMT:");
    GP.PHASES.forEach((ph) => L.push(counterLine(ph, g.cPmt[ph])));
    L.push("");
    L.push("Counter LA:");
    GP.PHASES.forEach((ph) => L.push(counterLine(ph, g.cLa[ph])));
    L.push("");
    L.push(`Kondisi cuaca : ${g.cuaca || ""}`.trimEnd());
    L.push("");
    L.push("3. Penyebab Gangguan :");
    L.push(...bullets(g.penyebab));
    L.push("");
    L.push("4. Dampak Gangguan :");
    L.push(...bullets(g.dampak));
    L.push("");
    L.push("5. Tindak Lanjut Gangguan :");
    L.push(...bullets(g.tindak));
    const pn = [...(g.pmtMasuk ? [`PMT masuk jam ${dot(g.pmtMasuk)}`] : []), ...(g.penormalan || []).filter((x) => x.trim())];
    if (pn.length) {
      L.push("");
      L.push("6. Penormalan :");
      L.push(...bullets(pn));
    }
    const cat = (g.catatan || []).filter((x) => x.trim());
    if (cat.length) {
      L.push("");
      L.push("Catatan :");
      L.push(...bullets(cat));
    }
    L.push("");
    L.push("Demikian Kami Laporkan.");
    L.push("Semoga instalasi dan sistem senantiasa aman dan andal. Aamiin");
    return L.join("\n");
  };

  JG.gangguanMissing = function (g) {
    const miss = [];
    const filled = (c) => GP.PHASES.every((ph) => c[ph][1] !== "");
    if (!(g.objek || "").trim()) miss.push("objek");
    if (!(g.bay || "").trim()) miss.push("bay");
    if (!g.tanggal) miss.push("tanggal");
    if (!g.jam) miss.push("jam");
    else if (JG.isBadTime(g.jam)) miss.push("jam tidak valid");
    if (!g.panel.some((x) => x.trim())) miss.push("indikasi panel");
    if (!g.relay.some((x) => x.trim())) miss.push("indikasi relay");
    if (!g.fl) miss.push("FL");
    if (!filled(g.cPmt)) miss.push("counter PMT");
    if (!filled(g.cLa)) miss.push("counter LA");
    if (!g.cuaca) miss.push("cuaca");
    if (!g.penyebab.some((x) => x.trim())) miss.push("penyebab");
    if (!g.tindak.some((x) => x.trim())) miss.push("tindak lanjut");
    return miss;
  };

  function investigasi(g) {
    return g.penyebab.some((x) => /investigasi/i.test(x));
  }

  let g = GP.emptyLaporan();
  let activeId = null;
  let savedSnap = null;
  let inited = false;
  let parsed = null;

  function snapshot() {
    return JSON.stringify(g);
  }

  function isDirty() {
    return snapshot() !== savedSnap;
  }

  function freshLaporan() {
    const x = GP.emptyLaporan();
    x.gi = JG.getMine();
    x.tanggal = JG.todayIso();
    x.penyebab = ["Proses investigasi"];
    x.dampak = ["Tidak ada beban konsumen padam"];
    return x;
  }

  function normalize(x) {
    const base = GP.emptyLaporan();
    const out = { ...base, ...x };
    ["cPmt", "cLa"].forEach((k) => {
      out[k] = { ...GP.emptyCounter(), ...(x[k] || {}) };
    });
    LISTS.forEach(([k]) => {
      out[k] = Array.isArray(out[k]) ? out[k] : [];
    });
    return out;
  }

  function others() {
    return loadStore().items.filter((it) => it.id !== activeId);
  }

  function suggestFor(key) {
    const gi = g.gi || g.giRaw;
    const seen = new Set((g[key] || []).map((x) => x.trim().toLowerCase()));
    const out = [];
    others()
      .filter((it) => (it.data.gi || it.data.giRaw) === gi)
      .forEach((it) =>
        (it.data[key] || []).forEach((v) => {
          const k = v.trim().toLowerCase();
          if (k && !seen.has(k)) {
            seen.add(k);
            out.push(v.trim());
          }
        })
      );
    return out.slice(0, 12);
  }

  function lastCounter() {
    const gi = g.gi || g.giRaw;
    if (!gi || !g.bay) return null;
    const hit = others()
      .filter((it) => (it.data.gi || it.data.giRaw) === gi && JG.sameBay(it.data.bay, g.bay))
      .sort((a, b) => ((a.data.tanggal || "") + (a.data.jam || "") < (b.data.tanggal || "") + (b.data.jam || "") ? 1 : -1))[0];
    return hit ? hit.data : null;
  }

  function objekUsulan() {
    const gi = giName(g);
    const bay = (g.bay || "").trim();
    const num = (bay.match(/#?\s*(\d+)\s*$/) || [])[1];
    const bayName = bay.replace(/\s*#?\s*\d+\s*$/, "").trim();
    if (g.jenis === "SUTT") return bay ? `SUTT 150kV ${gi}-${bayName}${num ? ` #${num}` : ""}` : "";
    if (g.jenis === "Trafo") return `Trafo ${num || ""} GI 150kV ${gi}`.replace(/\s+/g, " ");
    if (g.jenis === "Kopel") return `Kopel 150kV GI ${gi}`;
    return `Shunt Capacitor ${bay} GI 150kV ${gi}`.replace(/\s+/g, " ");
  }

  function objekSuggestions() {
    const set = new Set();
    const list = [];
    const add = (v) => {
      const k = (v || "").trim();
      if (k && !set.has(k.toLowerCase())) {
        set.add(k.toLowerCase());
        list.push(k);
      }
    };
    add(objekUsulan());
    loadStore().items.forEach((it) => add(it.data.objek));
    return list;
  }

  function chipsHtml(list, key) {
    return list.map((v) => `<button type="button" class="sg-chip" data-key="${key}" data-val="${JG.esc(v)}">+ ${JG.esc(v)}</button>`).join("");
  }

  function setSeg(id, value) {
    document.querySelectorAll(`#${id} [data-v]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === value)));
  }

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight + 2, 46)}px`;
  }

  function renderFields() {
    $("gGi").value = g.gi;
    $("gBay").value = g.bay;
    $("gObjek").value = g.objek;
    $("gTanggal").value = g.tanggal;
    $("gJam").value = g.jam;
    $("gStatus").value = g.status;
    $("gFl").value = g.fl;
    $("gPmtMasuk").value = g.pmtMasuk;
    $("gKejadianLain").value = GP.KEJADIAN.includes(g.kejadian) ? "" : g.kejadian;
    LISTS.forEach(([k, id]) => {
      $(id).value = (g[k] || []).join("\n");
      autoGrow($(id));
    });
    ["cPmt", "cLa"].forEach((c) =>
      GP.PHASES.forEach((ph) => {
        $(`${c}${ph}0`).value = g[c][ph][0];
        $(`${c}${ph}1`).value = g[c][ph][1];
      })
    );
    $("gCatatanFold").open = g.catatan.length > 0;
    $("gPenormalanFold").open = !!(g.pmtMasuk || g.penormalan.length);
  }

  function renderDerived() {
    setSeg("gJenis", g.jenis);
    setSeg("gKejadian", GP.KEJADIAN.includes(g.kejadian) ? g.kejadian : "__lain");
    $("gKejadianLain").hidden = GP.KEJADIAN.includes(g.kejadian);
    setSeg("gCuaca", g.cuaca);
    $("gLokasi").textContent = `GI 150kV ${giName(g) || "____"} Bay ${(g.bay || "").trim() || "____"}`;
    $("gBay").placeholder = g.jenis === "SUTT" ? "Sampang 2" : g.jenis === "Trafo" ? "Trafo 1" : g.jenis === "Kopel" ? "Kopel" : "Capacitor 1";
    const us = objekUsulan();
    $("gObjekUsul").hidden = !us || us === g.objek;
    $("gObjekUsul").textContent = us ? `Pakai: ${us}` : "";
    $("dl-gobjek").innerHTML = objekSuggestions().map((v) => `<option value="${JG.esc(v)}"></option>`).join("");
    $("gBayList").innerHTML = [...new Set(loadStore().items.filter((it) => (it.data.gi || it.data.giRaw) === (g.gi || g.giRaw)).map((it) => it.data.bay).filter(Boolean))]
      .map((v) => `<option value="${JG.esc(v)}"></option>`)
      .join("");

    $("gStatusChips").innerHTML = PRESET.status.filter((v) => v !== g.status).map((v) => `<button type="button" class="sg-chip" data-set="status" data-val="${v}">${v}</button>`).join("");
    $("gPanelChips").innerHTML = chipsHtml(suggestFor("panel"), "panel");
    $("gRelayChips").innerHTML = chipsHtml(suggestFor("relay"), "relay");
    $("gPanelHint").hidden = !suggestFor("panel").length;
    $("gRelayHint").hidden = !suggestFor("relay").length;
    const head = (v) => v.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 3).join(" ");
    const notIn = (key, list) => list.filter((v) => !(g[key] || []).some((x) => x.trim() && head(x) === head(v)));
    $("gPenyebabChips").innerHTML = chipsHtml(notIn("penyebab", PRESET.penyebab), "penyebab");
    $("gDampakChips").innerHTML = chipsHtml(notIn("dampak", PRESET.dampak), "dampak");
    $("gTindakChips").innerHTML = chipsHtml(notIn("tindak", PRESET.tindak(giName(g))), "tindak");

    ["cPmt", "cLa"].forEach((c) =>
      GP.PHASES.forEach((ph) => {
        const [a, b] = g[c][ph];
        const d = a !== "" && b !== "" ? parseInt(b, 10) - parseInt(a, 10) : null;
        const el = $(`${c}${ph}d`);
        el.textContent = d ? (d > 0 ? `+${d}` : `${d}`) : "";
        el.className = `cn-delta${d > 0 ? " up" : d < 0 ? " bad" : ""}`;
      })
    );
    const last = lastCounter();
    const canFill = last && ["cPmt", "cLa"].some((c) => GP.PHASES.some((ph) => last[c][ph][1] && !g[c][ph][0]));
    $("gCounterFill").hidden = !canFill;
    if (canFill) $("gCounterFill").textContent = `Isi "sebelum" dari laporan ${tanggalLaporan(last.tanggal) || "terakhir"}`;

    const miss = JG.gangguanMissing(g);
    const box = $("gMissing");
    box.className = `g-miss${miss.length ? "" : " ok"}`;
    box.innerHTML = miss.length
      ? `<strong>Belum lengkap</strong><span>${miss.map((m) => `<em>${JG.esc(m)}</em>`).join("")}</span>`
      : `<strong>Lengkap</strong><span>${investigasi(g) ? "Penyebab masih proses investigasi" : "Semua bagian sudah terisi"}</span>`;

    $("gTitle").textContent = (g.objek || "").trim() || "Laporan gangguan baru";
    const st = $("gSaveStatus");
    const dirty = isDirty();
    st.dataset.state = activeId ? (dirty ? "dirty" : "saved") : "dirty";
    const item = activeId && loadStore().items.find((it) => it.id === activeId);
    $("gSaveStatusText").textContent = !activeId ? "Belum disimpan" : dirty ? "Ada perubahan belum disimpan" : `Tersimpan di HP ini ${JG.formatSavedAt(item && item.updatedAt)}`;
    $("gPreview").textContent = JG.buildGangguanText(g);
  }

  function onChange() {
    renderDerived();
  }

  function readList(id) {
    return $(id)
      .value.split("\n")
      .map((x) => x.replace(/^\s*[-•]\s*/, "").trimEnd());
  }

  function cleanLists(x) {
    const y = JSON.parse(JSON.stringify(x));
    LISTS.forEach(([k]) => {
      y[k] = (y[k] || []).map((s) => s.trim()).filter(Boolean);
    });
    return y;
  }

  function save(quiet, keepHash) {
    const st = loadStore();
    const now = new Date().toISOString();
    g = cleanLists(g);
    if (!activeId) {
      activeId = newId();
      st.items.unshift({ id: activeId, createdAt: now, updatedAt: now, data: g });
    } else {
      const it = st.items.find((x) => x.id === activeId);
      if (it) {
        it.data = g;
        it.updatedAt = now;
      } else st.items.unshift({ id: activeId, createdAt: now, updatedAt: now, data: g });
    }
    if (!saveStore(st)) {
      JG.toast("error", "Gagal menyimpan", "Penyimpanan HP penuh atau diblokir.", 2400);
      return false;
    }
    savedSnap = snapshot();
    if (!keepHash) history.replaceState(null, "", `#/gangguan/${activeId}`);
    renderFields();
    renderDerived();
    if (!quiet) JG.toast("success", "Tersimpan di HP ini");
    return true;
  }

  async function copyAndSave() {
    const text = JG.buildGangguanText(cleanLists(g));
    if (!(await JG.copyText(text))) {
      Swal.fire({ icon: "error", title: "Gagal menyalin", text: "Silakan salin manual dari preview." });
      return;
    }
    save(true);
    const miss = JG.gangguanMissing(g);
    JG.toast("success", "Tersalin & tersimpan", miss.length ? `Belum lengkap: ${miss.slice(0, 3).join(", ")}${miss.length > 3 ? ", …" : ""}` : "", 2200);
  }

  function fillCounter() {
    const last = lastCounter();
    if (!last) return;
    ["cPmt", "cLa"].forEach((c) =>
      GP.PHASES.forEach((ph) => {
        if (!g[c][ph][0] && last[c][ph][1]) g[c][ph][0] = last[c][ph][1];
      })
    );
    renderFields();
    renderDerived();
  }

  async function sisiLain() {
    const opts = {};
    JG.GI_LIST.filter(([v]) => v !== g.gi).forEach(([v, l]) => (opts[v] = l));
    const { value, isConfirmed } = await Swal.fire({
      title: "Laporan sisi GI lain",
      input: "select",
      inputOptions: opts,
      inputLabel: "Objek, tanggal, kejadian, penyebab, dampak, tindak lanjut, dan penormalan ikut disalin. Bay, jam, indikasi, dan counter dikosongkan.",
      showCancelButton: true,
      confirmButtonText: "Buat",
      cancelButtonText: "Batal",
      inputValidator: (v) => (!v ? "Pilih GI dulu" : undefined),
    });
    if (!isConfirmed) return;
    if (isDirty()) save(true);
    const src = cleanLists(g);
    const x = GP.emptyLaporan();
    Object.assign(x, {
      gi: value,
      jenis: src.jenis,
      objek: src.objek,
      tanggal: src.tanggal,
      kejadian: src.kejadian,
      status: src.status,
      cuaca: src.cuaca,
      penyebab: src.penyebab,
      dampak: src.dampak,
      tindak: src.tindak,
      penormalan: src.penormalan,
    });
    g = x;
    activeId = null;
    savedSnap = null;
    history.replaceState(null, "", "#/gangguan/baru");
    renderFields();
    renderDerived();
    JG.toast("success", `Laporan sisi ${JG.giLabel(value)}`, "Isi bay, jam, indikasi, dan counter.", 2200);
  }

  async function hapus() {
    if (!activeId) {
      location.hash = "#/gangguan";
      return;
    }
    const res = await Swal.fire({
      icon: "warning",
      title: "Hapus laporan ini?",
      text: "Laporan dihapus dari HP ini.",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
    });
    if (!res.isConfirmed) return;
    const st = loadStore();
    st.items = st.items.filter((it) => it.id !== activeId);
    saveStore(st);
    activeId = null;
    savedSnap = snapshot();
    location.hash = "#/gangguan";
  }

  function openImport() {
    parsed = null;
    $("gImportText").value = "";
    $("gImportSummary").innerHTML = "";
    $("gImportApply").disabled = true;
    bootstrap.Modal.getOrCreateInstance($("gImportModal")).show();
    setTimeout(() => $("gImportText").focus(), 250);
  }

  function renderImport() {
    const t = $("gImportText").value;
    parsed = t.trim() ? GP.parse(t, JG.GI_LIST.map(([v]) => v)) : null;
    $("gImportApply").disabled = !parsed || !(parsed.objek || parsed.jam || parsed.bay);
    if (!parsed) {
      $("gImportSummary").innerHTML = "";
      return;
    }
    const p = parsed;
    const item = (k, v) => `<div class="imp-item"><dt>${k}</dt><dd>${v}</dd></div>`;
    const empty = '<span class="muted">Kosong</span>';
    const list = (a) => (a.length ? a.map(JG.esc).join("<br>") : empty);
    const cnt = (c) => (GP.PHASES.some((ph) => c[ph][0] || c[ph][1]) ? GP.PHASES.map((ph) => `${ph} ${c[ph][0] || "?"} → ${c[ph][1] || "?"}`).join(", ") : empty);
    const giText = p.gi ? JG.giLabel(p.gi) : p.giRaw ? `<span class="warn">"${JG.esc(p.giRaw)}" belum ada di daftar GI</span>` : '<span class="warn">Tidak ditemukan</span>';
    $("gImportSummary").innerHTML = `
      <dl class="imp-sum">
        ${item("Objek", JG.esc(p.objek) || '<span class="warn">Tidak ditemukan</span>')}
        ${item("Jenis", JG.esc(p.jenis))}
        ${item("GI, bay", `${giText}${p.bay ? `, Bay ${JG.esc(p.bay)}` : ""}`)}
        ${item("Waktu", `${p.tanggal ? JG.esc(tanggalLaporan(p.tanggal)) : '<span class="warn">Tanggal tidak ditemukan</span>'}${p.jam ? `, ${p.jam}` : ""}`)}
        ${item("Kejadian", `${JG.esc(p.kejadian)}${p.status ? ` (status: ${JG.esc(p.status)})` : ""}`)}
        ${item("Indikasi panel", list(p.panel))}
        ${item("Indikasi relay", list(p.relay) + (p.fl ? `<br>FL ${JG.esc(p.fl)} km` : ""))}
        ${item("Counter PMT", cnt(p.cPmt))}
        ${item("Counter LA", cnt(p.cLa))}
        ${item("Cuaca", JG.esc(p.cuaca) || empty)}
        ${item("Penyebab", list(p.penyebab))}
        ${item("Dampak", list(p.dampak))}
        ${item("Tindak lanjut", list(p.tindak))}
        ${p.pmtMasuk || p.penormalan.length ? item("Penormalan", list([...(p.pmtMasuk ? [`PMT masuk ${p.pmtMasuk}`] : []), ...p.penormalan])) : ""}
      </dl>
      ${p.catatan.length ? `<div class="imp-skip"><div class="imp-label">Masuk ke catatan lain (${p.catatan.length} baris)</div><ul>${p.catatan.map((l) => `<li>${JG.esc(l)}</li>`).join("")}</ul></div>` : ""}`;
  }

  function applyImport() {
    if (!parsed) return;
    const p = parsed;
    delete p.giRawMatched;
    g = normalize(p);
    if (!g.gi && !g.giRaw) g.gi = JG.getMine();
    activeId = null;
    savedSnap = null;
    bootstrap.Modal.getOrCreateInstance($("gImportModal")).hide();
    history.replaceState(null, "", "#/gangguan/baru");
    renderFields();
    renderDerived();
    const miss = JG.gangguanMissing(g);
    JG.toast(miss.length ? "info" : "success", "Laporan terisi dari teks", miss.length ? `Tinggal lengkapi: ${miss.slice(0, 3).join(", ")}${miss.length > 3 ? ", …" : ""}` : "Cek lagi sebelum disalin.", 2600);
  }

  function hasContent() {
    return !!((g.objek || "").trim() || (g.bay || "").trim() || g.jam || g.panel.some((x) => x.trim()) || g.relay.some((x) => x.trim()));
  }

  function leave() {
    if (inited && isDirty() && hasContent()) {
      save(true, true);
      JG.toast("success", "Laporan disimpan otomatis", "Tersimpan di HP ini.", 1600);
    }
  }

  function init() {
    if (inited) return;
    inited = true;
    $("gGi").innerHTML = JG.giOptionsHtml("Pilih GI...");

    const bindText = (id, key, fn) =>
      $(id).addEventListener("input", (e) => {
        g[key] = fn ? fn(e.target.value) : e.target.value;
        onChange();
      });
    $("gGi").addEventListener("change", (e) => {
      g.gi = e.target.value;
      g.giRaw = "";
      onChange();
    });
    bindText("gBay", "bay");
    bindText("gObjek", "objek");
    bindText("gStatus", "status");
    bindText("gKejadianLain", "kejadian");
    $("gTanggal").addEventListener("change", (e) => {
      g.tanggal = e.target.value;
      onChange();
    });
    $("gFl").addEventListener("input", (e) => {
      const v = e.target.value.replace(/[^\d.,]/g, "").replace(".", ",");
      if (v !== e.target.value) e.target.value = v;
      g.fl = v;
      onChange();
    });

    ["gJam", "gPmtMasuk"].forEach((id) => {
      const key = id === "gJam" ? "jam" : "pmtMasuk";
      const el = $(id);
      el.addEventListener("input", (e) => {
        if (!(e.inputType && e.inputType.startsWith("delete"))) {
          const d = el.value.replace(/\D/g, "").slice(0, 4);
          el.value = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
        }
        g[key] = el.value;
        onChange();
      });
      el.addEventListener("blur", () => {
        if (el.value.trim()) el.value = JG.normalizeTime(el.value);
        g[key] = el.value;
        el.classList.toggle("is-invalid", JG.isBadTime(el.value));
        onChange();
      });
    });
    document.querySelectorAll("[data-now]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.now;
        $(id).value = JG.nowHHMM();
        $(id).dispatchEvent(new Event("input"));
      })
    );

    LISTS.forEach(([k, id]) =>
      $(id).addEventListener("input", (e) => {
        g[k] = readList(id);
        autoGrow(e.target);
        onChange();
      })
    );

    ["cPmt", "cLa"].forEach((c) =>
      GP.PHASES.forEach((ph) =>
        [0, 1].forEach((i) =>
          $(`${c}${ph}${i}`).addEventListener("input", (e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v !== e.target.value) e.target.value = v;
            g[c][ph][i] = v;
            onChange();
          })
        )
      )
    );

    const segBind = (id, fn) =>
      $(id).addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]");
        if (b) fn(b.dataset.v);
      });
    segBind("gJenis", (v) => {
      g.jenis = v;
      onChange();
    });
    segBind("gKejadian", (v) => {
      const prev = g.kejadian;
      g.kejadian = v === "__lain" ? "" : v;
      if (!g.status || g.status === prev) g.status = g.kejadian;
      renderFields();
      onChange();
      if (v === "__lain") $("gKejadianLain").focus();
    });
    segBind("gCuaca", (v) => {
      g.cuaca = g.cuaca === v ? "" : v;
      onChange();
    });

    $("gObjekUsul").addEventListener("click", () => {
      g.objek = objekUsulan();
      $("gObjek").value = g.objek;
      onChange();
    });

    $("view-gform").addEventListener("click", (e) => {
      const b = e.target.closest(".sg-chip");
      if (!b) return;
      if (b.dataset.set) {
        g[b.dataset.set] = b.dataset.val;
        renderFields();
        onChange();
        return;
      }
      const key = b.dataset.key;
      const list = (g[key] || []).filter((x) => x.trim());
      list.push(b.dataset.val);
      g[key] = list;
      const id = LISTS.find(([k]) => k === key)[1];
      $(id).value = list.join("\n");
      autoGrow($(id));
      onChange();
    });

    $("gCounterFill").addEventListener("click", fillCounter);
    $("gSaveBtn").addEventListener("click", () => save(false));
    $("gCopyBtn").addEventListener("click", copyAndSave);
    $("gCopyBtnSheet").addEventListener("click", copyAndSave);
    $("gImportText").addEventListener("input", renderImport);
    $("gImportApply").addEventListener("click", applyImport);
    $("gMenu").addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action;
      if (a === "impor") openImport();
      if (a === "sisi") sisiLain();
      if (a === "hapus") hapus();
    });
    window.addEventListener("beforeunload", (e) => {
      if (document.body.dataset.route === "gform" && isDirty() && activeId) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  async function openForm(id) {
    init();
    if (id === "baru" || id === "impor") {
      g = freshLaporan();
      activeId = null;
      savedSnap = snapshot();
      history.replaceState(null, "", "#/gangguan/baru");
    } else if (id) {
      const it = loadStore().items.find((x) => x.id === id);
      if (!it) {
        JG.toast("warning", "Laporan tidak ditemukan di HP ini");
        location.hash = "#/gangguan";
        return;
      }
      if (id !== activeId || !isDirty()) {
        g = normalize(it.data);
        activeId = id;
        savedSnap = snapshot();
      }
    }
    renderFields();
    renderDerived();
    if (id === "impor") openImport();
  }

  function renderList() {
    init();
    const items = loadStore().items.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    $("gCount").textContent = `${items.length ? `${items.length} laporan, ` : ""}uji coba: tersimpan di HP ini saja`;
    if (!items.length) {
      $("gList").innerHTML = `<div class="empty-box">Belum ada laporan gangguan. Tekan <b>+ Laporan</b> untuk mulai, atau <b>Tempel dari WA</b> untuk teks dasar dari SPV.</div>`;
      return;
    }
    $("gList").innerHTML = `<ul class="log">${items
      .map((it) => {
        const d = normalize(it.data);
        const miss = JG.gangguanMissing(d);
        return `
        <li class="log-row${miss.length ? " is-open" : ""}" data-gid="${it.id}" tabindex="0" role="button">
          <span class="log-no g-kind">${JG.esc(d.jenis === "Shunt Capacitor" ? "SC" : d.jenis.slice(0, 4))}</span>
          <div class="log-main">
            <div class="log-t1">${JG.esc((d.objek || "").replace(/^(SUTT|SUTET)\s*\d+\s*kV\s*/i, "") || "Objek belum diisi")}</div>
            <div class="log-t2">${miss.length ? `<span class="log-flag">Belum lengkap ${miss.length}</span> ` : ""}${JG.esc([giName(d), d.bay ? `Bay ${d.bay}` : ""].filter(Boolean).join(", "))}</div>
          </div>
          <div class="log-tm">${d.jam || "--:--"}<small>${JG.esc(d.tanggal ? JG.formatTanggalPendek(d.tanggal) : "")}</small></div>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function bindList() {
    const open = (e) => {
      const li = e.target.closest("[data-gid]");
      if (li) location.hash = `#/gangguan/${li.dataset.gid}`;
    };
    $("gList").addEventListener("click", open);
    $("gList").addEventListener("keydown", (e) => {
      if (e.key === "Enter") open(e);
    });
  }

  let listBound = false;

  JG.gangguan = {
    async open(id) {
      if (!listBound) {
        bindList();
        listBound = true;
      }
      if (id) await openForm(id);
      else renderList();
    },
    leave,
    isFormRoute: (parts) => parts[0] === "gangguan" && !!parts[1],
  };
})();
