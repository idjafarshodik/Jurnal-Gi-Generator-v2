(function () {
  const JG = window.JG;
  const DRAFT_KEY = "jurnalGiDraft_v3";
  const EMPTY_ACTIVE = { id: null, updatedAt: null, savedSnapshot: null };
  const $ = (id) => document.getElementById(id);

  let state = newState();
  let active = { ...EMPTY_ACTIVE };
  let isSaving = false;
  let inited = false;
  let showPembebasanList = false;

  function newState() {
    return {
      namaGi: "",
      tanggal: "",
      keterangan: "",
      bay: "",
      dispatcher: "",
      pengawasManuver: "",
      pengawasPekerjaan: "",
      pengawasK3: "",
      pelaksanaManuver: "",
      stage: "pembebasan",
      pesanPembebasan: JG.PRESET_AWAL[0],
      pesanPenormalan: JG.PRESET_AKHIR[0],
      pembebasan: [],
      penormalan: [],
    };
  }

  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d && d.state) {
        state = { ...newState(), ...d.state };
        active = { ...EMPTY_ACTIVE, ...(d.active || {}) };
      }
    } catch (e) {}
  }

  function persist() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, active }));
    } catch (e) {}
  }

  const PEOPLE = [
    ["dispatcher", "fDispatcher", "dispatcher"],
    ["pengawasManuver", "fPengawasManuver", "pengawas_manuver"],
    ["pengawasPekerjaan", "fPengawasPekerjaan", "pengawas_pekerjaan"],
    ["pengawasK3", "fPengawasK3", "pengawas_k3"],
    ["pelaksanaManuver", "fPelaksanaManuver", "pelaksana_manuver"],
  ];

  function effective(rows, withTime = true) {
    return rows.map((r) => ({
      waktu: withTime ? JG.normalizeTime(r.waktu) : "",
      peralatan: r.peralatan,
      bay: (r.bay || state.bay || "").trim(),
      status: r.status,
    }));
  }

  function collect() {
    const penormalan = state.stage === "penormalan";
    const pesan = (penormalan ? state.pesanPenormalan : state.pesanPembebasan).trim();
    return {
      namaGi: state.namaGi,
      tanggal: state.tanggal,
      hari: JG.hariFromDate(state.tanggal),
      keterangan: state.keterangan,
      dispatcher: state.dispatcher,
      pengawasManuver: state.pengawasManuver,
      pengawasPekerjaan: state.pengawasPekerjaan,
      pengawasK3: state.pengawasK3,
      pelaksanaManuver: state.pelaksanaManuver,
      tahapPenormalan: penormalan,
      pesanPenutup: pesan || (penormalan ? JG.PRESET_AKHIR[0] : JG.PRESET_AWAL[0]),
      pembebasanRows: effective(state.pembebasan),
      penormalanRows: effective(state.penormalan),
    };
  }

  function hasContent() {
    return !!(
      state.namaGi ||
      state.tanggal ||
      state.keterangan.trim() ||
      PEOPLE.some(([k]) => (state[k] || "").trim()) ||
      state.pembebasan.length ||
      state.penormalan.length
    );
  }

  function isDirty() {
    if (active.id == null) return hasContent();
    return JSON.stringify(collect()) !== active.savedSnapshot;
  }

  function markSaved(id, updatedAt) {
    active = { id, updatedAt, savedSnapshot: JSON.stringify(collect()) };
    persist();
  }

  function onChange() {
    persist();
    renderPreview();
    renderStatus();
    renderSummaries();
  }

  function renderStatus() {
    const el = $("saveStatus");
    const txt = $("saveStatusText");
    const title = $("editorTitle");
    if (!el) return;
    const dirty = isDirty();
    let s;
    let t;
    if (isSaving) {
      s = "saving";
      t = "Menyimpan...";
    } else if (active.id == null) {
      s = dirty ? "dirty" : "empty";
      t = dirty ? "Belum disimpan" : "Kosong";
    } else if (dirty) {
      s = "dirty";
      t = "Ada perubahan belum disimpan";
    } else {
      s = "saved";
      t = `Tersimpan ${JG.formatSavedAt(active.updatedAt)}`;
    }
    el.dataset.state = s;
    txt.textContent = t;
    title.textContent = active.id != null ? `Jurnal #${active.id}` : "Jurnal baru";
  }

  function renderPreview() {
    const r = JG.buildJurnalText(collect());
    $("previewBox").textContent = r.text;
    return r;
  }

  function stageMsgKey() {
    return state.stage === "penormalan" ? "pesanPenormalan" : "pesanPembebasan";
  }

  function renderSummaries() {
    const names = PEOPLE.map(([k]) => (state[k] || "").trim()).filter(Boolean);
    $("pengawasSummary").textContent = names.length ? names.join(" · ") : "Belum diisi";
    $("pengawasSummary").classList.toggle("is-empty", !names.length);
    const msg = (state[stageMsgKey()] || "").trim();
    $("pesanSummary").textContent = msg || "Pakai pesan default";
    $("hariLabel").textContent = state.tanggal ? `· ${JG.hariFromDate(state.tanggal)}` : "";
    $("bayChipText").textContent = state.bay || "Atur bay";
    $("bayChip").classList.toggle("is-empty", !state.bay);

    const pb = state.pembebasan;
    const range = JG.timeRange(pb);
    $("pembebasanSummaryText").textContent = pb.length ? `${pb.length} manuver${range ? ` · ${range}` : ""}` : "Belum ada manuver";
  }

  function renderLists() {
    JG.renderRowList($("pembebasanList"), state.pembebasan, {
      bay: state.bay,
      emptyText: "Belum ada manuver. Tekan + Tambah atau Import teks.",
    });
    JG.renderRowList($("penormalanList"), state.penormalan, { bay: state.bay });
    const empty = !state.penormalan.length;
    $("autoPenormalanCard").hidden = !empty;
    $("autoPenormalanCard").querySelector("button").disabled = !state.pembebasan.length;
    $("penormalanActions").hidden = empty;
  }

  function renderStage() {
    const pen = state.stage === "penormalan";
    document.querySelectorAll("#stageSwitch .stage-btn").forEach((b) => {
      const on = b.dataset.stage === state.stage;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("penormalanBlock").hidden = !pen;
    $("pembebasanSummary").hidden = !pen;
    const showList = !pen || showPembebasanList;
    $("pembebasanBody").hidden = !showList;
    $("pembebasanToggleBtn").textContent = showPembebasanList ? "Tutup" : "Ubah";
    $("pesanPresets").innerHTML = (pen ? JG.PRESET_AKHIR : JG.PRESET_AWAL)
      .map((p, i) => `<button type="button" class="chip-btn" data-preset="${i}">${JG.esc(p)}</button>`)
      .join("");
    $("fPesan").value = state[stageMsgKey()];
    $("pesanLabel").textContent = pen ? "Pesan penormalan" : "Pesan pembebasan";
  }

  function renderFields() {
    $("fNamaGi").value = state.namaGi;
    $("fTanggal").value = state.tanggal;
    $("fKeterangan").value = state.keterangan;
    PEOPLE.forEach(([k, id]) => {
      $(id).value = state[k] || "";
    });
  }

  function renderAll() {
    renderFields();
    renderStage();
    renderLists();
    renderSummaries();
    renderPreview();
    renderStatus();
  }

  function sectionRows(section) {
    return section === "pembebasan" ? state.pembebasan : state.penormalan;
  }

  function defaultPeralatan(section, prev) {
    if (!prev) return section === "pembebasan" ? JG.PERALATAN[0] : "";
    const i = JG.PERALATAN.indexOf(prev.peralatan);
    if (i < 0 || i > 4) return "";
    const j = section === "pembebasan" ? i + 1 : i - 1;
    return j >= 0 && j <= 4 ? JG.PERALATAN[j] : "";
  }

  function sheetCfg(section, index) {
    const rows = sectionRows(section);
    const isNew = index < 0;
    const label = section === "pembebasan" ? "Pembebasan" : "Penormalan";
    const prev = isNew ? rows[rows.length - 1] : rows[index - 1];
    const row = isNew
      ? {
          waktu: "",
          peralatan: defaultPeralatan(section, rows[rows.length - 1]),
          bay: "",
          status: prev ? prev.status : section === "pembebasan" ? "#" : "//",
        }
      : { ...rows[index] };

    return {
      title: isNew ? `Tambah manuver ${label.toLowerCase()} #${rows.length + 1}` : `${label} #${index + 1}`,
      row,
      isNew,
      withTime: true,
      defaultBay: state.bay,
      prevTime: prev ? prev.waktu : "",
      index,
      count: rows.length,
      onSubmit(r, next) {
        if (!state.bay && r.bay) {
          state.bay = r.bay;
          r.bay = "";
        } else if (r.bay === state.bay) {
          r.bay = "";
        }
        if (isNew) rows.push(r);
        else rows[index] = r;
        renderLists();
        onChange();
        return next ? sheetCfg(section, -1) : null;
      },
      onDelete() {
        rows.splice(index, 1);
        renderLists();
        onChange();
      },
      onMove(dir, current) {
        const j = index + dir;
        if (j < 0 || j >= rows.length) return null;
        rows[index] = { ...current, bay: current.bay === state.bay ? "" : current.bay };
        [rows[index], rows[j]] = [rows[j], rows[index]];
        renderLists();
        onChange();
        return sheetCfg(section, j);
      },
    };
  }

  async function confirmDiscard() {
    if (!isDirty()) return true;
    const res = await Swal.fire({
      icon: "warning",
      title: "Ada perubahan yang belum disimpan",
      text: active.id != null ? `Perubahan di Jurnal #${active.id} belum tersimpan ke riwayat.` : "Jurnal di editor belum pernah disimpan ke riwayat.",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Simpan dulu",
      denyButtonText: "Buang",
      cancelButtonText: "Batal",
    });
    if (res.isDismissed) return false;
    if (res.isConfirmed) {
      const r = await saveJurnal();
      if (!r.ok && r.reason === "error") JG.toast("error", "Gagal menyimpan", "Cek koneksi internet, lalu coba lagi.", 2400);
      return r.ok;
    }
    return true;
  }

  function classify(e) {
    const msg = (e && (e.message || e.details || "")) || "";
    if (msg.includes("JURNAL_KONFLIK")) return "konflik";
    if (msg.includes("JURNAL_TIDAK_ADA")) return "hilang";
    return "error";
  }

  function setBusy(b) {
    ["saveBtn", "copyBtn", "copyBtnSheet"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = b;
    });
  }

  async function saveJurnal(opts = {}) {
    if (isSaving) return { ok: false, reason: "busy" };
    const data = collect();
    if (!data.tanggal) {
      if (!opts.quiet) JG.toast("warning", "Tanggal belum diisi", "Isi tanggal dulu supaya jurnal bisa disimpan.", 2200);
      return { ok: false, reason: "invalid" };
    }

    await JG.loadGi();
    const targetId = opts.asNew ? null : active.id;
    const expected = targetId == null || opts.force ? null : active.updatedAt;
    const header = {
      gi_id: JG.giCache[data.namaGi] || null,
      tanggal: data.tanggal,
      hari: data.hari,
      keterangan: data.keterangan,
      dispatcher: data.dispatcher,
      pengawas_manuver: data.pengawasManuver,
      pengawas_pekerjaan: data.pengawasPekerjaan,
      pengawas_k3: data.pengawasK3,
      pelaksana_manuver: data.pelaksanaManuver,
      pesan_penutup: data.pesanPenutup,
      teks_final: JG.buildJurnalText(data).text,
      tahap_penormalan: data.tahapPenormalan,
      user: window.JurnalAuth.getCurrentUserName() || "-",
    };
    const rows = [
      ...data.pembebasanRows.map((r, i) => ({ section: "pembebasan", urutan: i, ...r })),
      ...data.penormalanRows.map((r, i) => ({ section: "penormalan", urutan: i, ...r })),
    ];
    const snapshot = JSON.stringify(data);

    isSaving = true;
    setBusy(true);
    renderStatus();

    let outcome;
    try {
      const { data: res, error } = await JG.sb().rpc("simpan_jurnal", {
        p_id: targetId,
        p_header: header,
        p_rows: rows,
        p_expected_updated_at: expected,
      });
      if (error) throw error;
      active = { id: res.id, updatedAt: res.updated_at, savedSnapshot: snapshot };
      persist();
      window.JurnalAuth.markActivity();
      if (location.hash.startsWith("#/jurnal")) history.replaceState(null, "", `#/jurnal/${res.id}`);
      outcome = { ok: true, id: res.id, created: targetId == null };
    } catch (e) {
      console.warn("Gagal menyimpan jurnal:", e);
      outcome = { ok: false, reason: classify(e) };
    } finally {
      isSaving = false;
      setBusy(false);
      renderStatus();
    }

    if (outcome.reason === "konflik") return handleConflict(opts);
    if (outcome.reason === "hilang") return handleMissing(opts);
    return outcome;
  }

  async function handleConflict(opts) {
    let info = "";
    try {
      const { data } = await JG.sb().from("jurnal_manuver").select("updated_at, diubah_oleh").eq("id", active.id).single();
      if (data) info = `Terakhir disimpan${data.diubah_oleh ? ` oleh ${data.diubah_oleh}` : ""} jam ${JG.formatSavedAt(data.updated_at)}, setelah kamu membukanya.`;
    } catch (e) {}

    const res = await Swal.fire({
      icon: "warning",
      title: `Jurnal #${active.id} sudah diubah dari device lain`,
      text: `${info} Pilih versi mana yang mau dipakai.`.trim(),
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Muat versi terbaru",
      denyButtonText: "Timpa dengan versi saya",
      cancelButtonText: "Batal",
    });
    if (res.isDenied) return saveJurnal({ ...opts, force: true });
    if (res.isConfirmed) {
      await loadFromDb(active.id, "lanjutkan");
      renderAll();
      return { ok: false, reason: "reloaded" };
    }
    return { ok: false, reason: "cancelled" };
  }

  async function handleMissing(opts) {
    const res = await Swal.fire({
      icon: "warning",
      title: `Jurnal #${active.id} sudah tidak ada`,
      text: "Kemungkinan sudah dihapus admin. Simpan isian ini sebagai jurnal baru?",
      showCancelButton: true,
      confirmButtonText: "Simpan sebagai baru",
      cancelButtonText: "Batal",
    });
    if (res.isConfirmed) return saveJurnal({ ...opts, asNew: true });
    return { ok: false, reason: "cancelled" };
  }

  async function onSaveClick() {
    if (active.id != null && !isDirty()) {
      JG.toast("info", `Jurnal #${active.id} sudah tersimpan`, "", 1500);
      return;
    }
    const r = await saveJurnal();
    if (r.ok) JG.toast("success", r.created ? `Tersimpan sebagai Jurnal #${r.id}` : `Perubahan Jurnal #${r.id} disimpan`);
    else if (r.reason === "error") JG.toast("error", "Gagal menyimpan", "Cek koneksi internet, lalu coba lagi.", 2400);
  }

  async function copyAndSave() {
    const r = renderPreview();
    const text = $("waReadMoreToggle").checked ? JG.buildReadMoreText(r.visible, r.hidden) : r.text;
    if (!(await JG.copyText(text))) {
      Swal.fire({ icon: "error", title: "Gagal menyalin", text: "Silakan salin manual dari preview." });
      return;
    }
    if (active.id != null && !isDirty()) {
      JG.toast("success", "Tersalin", `Jurnal #${active.id} sudah tersimpan.`, 1600);
      return;
    }
    if (!state.tanggal) {
      JG.toast("warning", "Tersalin, tapi belum disimpan", "Tanggal belum diisi.", 2400);
      return;
    }
    const s = await saveJurnal({ quiet: true });
    if (s.ok) JG.toast("success", "Tersalin & tersimpan", `Jurnal #${s.id}`);
    else if (s.reason === "error") JG.toast("warning", "Tersalin, tapi gagal disimpan", "Cek koneksi, lalu tekan Simpan.", 2600);
  }

  async function loadFromDb(id, mode) {
    const h = await JG.api.getJurnal(id);
    const asBase = mode === "dasar";
    const all = h.jurnal_manuver_rows || [];
    const pbRaw = all.filter((r) => r.section === "pembebasan");
    const pnRaw = all.filter((r) => r.section === "penormalan");
    const bay = JG.inferBay(all);
    const tahap = asBase ? false : h.tahap_penormalan ?? pnRaw.length > 0;

    state = {
      ...newState(),
      namaGi: h.gi?.nama || "",
      tanggal: asBase ? JG.todayIso() : h.tanggal || "",
      keterangan: h.keterangan || "",
      bay,
      dispatcher: h.dispatcher || "",
      pengawasManuver: h.pengawas_manuver || "",
      pengawasPekerjaan: h.pengawas_pekerjaan || "",
      pengawasK3: h.pengawas_k3 || "",
      pelaksanaManuver: h.pelaksana_manuver || "",
      stage: tahap ? "penormalan" : "pembebasan",
      pembebasan: JG.rowsFromDb(pbRaw, bay, !asBase),
      penormalan: JG.rowsFromDb(pnRaw, bay, !asBase),
    };
    if (!asBase && h.pesan_penutup) state[tahap ? "pesanPenormalan" : "pesanPembebasan"] = h.pesan_penutup;

    showPembebasanList = false;
    if (asBase) {
      active = { ...EMPTY_ACTIVE };
      persist();
    } else {
      markSaved(h.id, h.updated_at);
    }
  }

  async function loadTemplate(id) {
    const rows = await JG.api.getTemplateRows(id);
    const bay = JG.inferBay(rows);
    state = {
      ...newState(),
      tanggal: JG.todayIso(),
      bay,
      pembebasan: JG.rowsFromDb(rows.filter((r) => r.section === "pembebasan"), bay, false),
      penormalan: JG.rowsFromDb(rows.filter((r) => r.section === "penormalan"), bay, false),
    };
    active = { ...EMPTY_ACTIVE };
    showPembebasanList = false;
    persist();
  }

  function resetToNew() {
    state = newState();
    active = { ...EMPTY_ACTIVE };
    showPembebasanList = false;
    persist();
  }

  function setStage(stage) {
    if (state.stage === stage) return;
    state.stage = stage;
    showPembebasanList = false;
    renderStage();
    renderLists();
    onChange();
  }

  function autoPenormalan() {
    const run = () => {
      state.penormalan = JG.reverseRows(state.pembebasan);
      renderLists();
      onChange();
      JG.toast("success", "Penormalan disusun otomatis", "Tinggal isi jamnya.", 1800);
    };
    if (!state.penormalan.length) return run();
    Swal.fire({
      icon: "question",
      title: "Susun ulang penormalan?",
      text: "Daftar penormalan sekarang akan diganti dengan kebalikan pembebasan.",
      showCancelButton: true,
      confirmButtonText: "Ganti",
      cancelButtonText: "Batal",
    }).then((r) => r.isConfirmed && run());
  }

  async function editBay() {
    const { value, isConfirmed } = await Swal.fire({
      title: "Bay untuk jurnal ini",
      input: "text",
      inputValue: state.bay,
      inputPlaceholder: "Contoh: GULUKGULUK 2",
      inputLabel: "Dipakai semua baris yang bay-nya tidak diisi sendiri.",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    });
    if (!isConfirmed) return;
    const nb = (value || "").trim().toUpperCase();
    [state.pembebasan, state.penormalan].forEach((rows) =>
      rows.forEach((r) => {
        if (r.bay === nb) r.bay = "";
      })
    );
    state.bay = nb;
    renderLists();
    onChange();
  }

  let importSection = "pembebasan";
  let importParsed = [];

  function openImport(section) {
    importSection = section;
    importParsed = [];
    $("importTextArea").value = "";
    $("importPreviewWrap").hidden = true;
    $("importApplyBtn").disabled = true;
    $("importTitle").textContent = `Import ${section === "pembebasan" ? "pembebasan" : "penormalan"} dari teks`;
    bootstrap.Modal.getOrCreateInstance($("importModal")).show();
    setTimeout(() => $("importTextArea").focus(), 250);
  }

  function renderImportPreview() {
    const text = $("importTextArea").value;
    importParsed = text.trim() ? window.ManuverParser.parseManuverText(text) : [];
    $("importPreviewWrap").hidden = !importParsed.length;
    $("importApplyBtn").disabled = !importParsed.length;
    $("importPreviewBody").innerHTML = importParsed
      .map((r) => `<tr><td>${r.waktu || "__:__"}</td><td>${JG.esc(r.peralatan || "-")}</td><td>${JG.esc(r.bay || "-")}</td><td>${JG.esc(r.status)}</td></tr>`)
      .join("");
  }

  function applyImport() {
    if (!importParsed.length) return;
    const rows = sectionRows(importSection);
    const parsedBay = JG.inferBay(importParsed);
    if (!state.bay && parsedBay) state.bay = parsedBay.toUpperCase();
    importParsed.forEach((r) => {
      const bay = (r.bay || "").toUpperCase();
      rows.push({
        waktu: JG.normalizeTime(r.waktu),
        peralatan: (r.peralatan || "").toUpperCase(),
        bay: bay === state.bay ? "" : bay,
        status: r.status || "#",
      });
    });
    bootstrap.Modal.getOrCreateInstance($("importModal")).hide();
    renderLists();
    onChange();
    JG.toast("success", `${importParsed.length} baris ditambahkan`);
  }

  async function saveAsTemplate() {
    const d = collect();
    if (!d.pembebasanRows.length && !d.penormalanRows.length) {
      JG.toast("warning", "Belum ada manuver untuk dijadikan template");
      return;
    }
    const { value, isConfirmed } = await Swal.fire({
      title: "Simpan sebagai template",
      input: "text",
      inputValue: state.keterangan.replace(/\*/g, "").slice(0, 80),
      inputPlaceholder: "Nama template",
      inputLabel: "Jam tidak ikut disimpan.",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
      inputValidator: (v) => (!v || !v.trim() ? "Nama template wajib diisi" : undefined),
    });
    if (!isConfirmed) return;
    try {
      await JG.api.createTemplate(value.trim(), effective(state.pembebasan, false), effective(state.penormalan, false));
      JG.toast("success", "Template disimpan");
    } catch (e) {
      console.warn(e);
      JG.toast("error", "Gagal menyimpan template", "Cek koneksi internet.", 2200);
    }
  }

  async function loadNameSuggestions() {
    try {
      const s = await JG.api.nameSuggestions();
      PEOPLE.forEach(([, , col]) => {
        const dl = $(`dl-${col}`);
        if (dl) dl.innerHTML = (s[col] || []).map((v) => `<option value="${JG.esc(v)}"></option>`).join("");
      });
    } catch (e) {}
  }

  function bindList(listId, section) {
    const list = $(listId);
    const open = (e) => {
      const li = e.target.closest(".mv-item");
      if (!li) return;
      JG.rowSheet.open(sheetCfg(section, parseInt(li.dataset.index, 10)));
    };
    list.addEventListener("click", open);
    list.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(e);
      }
    });
  }

  function init() {
    if (inited) return;
    inited = true;
    loadDraft();

    $("fNamaGi").innerHTML = JG.giOptionsHtml("Pilih GI...");

    $("fNamaGi").addEventListener("change", (e) => {
      state.namaGi = e.target.value;
      onChange();
    });
    $("fTanggal").addEventListener("change", (e) => {
      state.tanggal = e.target.value;
      onChange();
    });
    $("fKeterangan").addEventListener("input", (e) => {
      state.keterangan = e.target.value;
      onChange();
    });
    PEOPLE.forEach(([k, id]) => {
      $(id).addEventListener("input", (e) => {
        state[k] = e.target.value;
        onChange();
      });
    });
    $("fPesan").addEventListener("input", (e) => {
      state[stageMsgKey()] = e.target.value;
      onChange();
    });
    $("pesanPresets").addEventListener("click", (e) => {
      const b = e.target.closest("[data-preset]");
      if (!b) return;
      const list = state.stage === "penormalan" ? JG.PRESET_AKHIR : JG.PRESET_AWAL;
      state[stageMsgKey()] = list[parseInt(b.dataset.preset, 10)];
      $("fPesan").value = state[stageMsgKey()];
      onChange();
    });

    $("stageSwitch").addEventListener("click", (e) => {
      const b = e.target.closest(".stage-btn");
      if (b) setStage(b.dataset.stage);
    });

    $("pembebasanToggleBtn").addEventListener("click", () => {
      showPembebasanList = !showPembebasanList;
      renderStage();
    });

    bindList("pembebasanList", "pembebasan");
    bindList("penormalanList", "penormalan");

    document.querySelectorAll("[data-add-row]").forEach((b) =>
      b.addEventListener("click", () => JG.rowSheet.open(sheetCfg(b.dataset.addRow, -1)))
    );
    document.querySelectorAll("[data-import]").forEach((b) => b.addEventListener("click", () => openImport(b.dataset.import)));

    $("autoPenormalanBtn").addEventListener("click", autoPenormalan);
    $("autoPenormalanAgainBtn").addEventListener("click", autoPenormalan);
    $("bayChip").addEventListener("click", editBay);

    $("importTextArea").addEventListener("input", renderImportPreview);
    $("importApplyBtn").addEventListener("click", applyImport);

    $("saveBtn").addEventListener("click", onSaveClick);
    $("copyBtn").addEventListener("click", copyAndSave);
    $("copyBtnSheet").addEventListener("click", copyAndSave);

    $("editorMenu").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action;
      if (a === "import") openImport(state.stage);
      if (a === "template") saveAsTemplate();
      if (a === "dasar") {
        if (active.id == null) {
          JG.toast("info", "Simpan dulu jurnal ini", "Menu ini untuk jurnal yang sudah ada di riwayat.", 2000);
          return;
        }
        location.hash = `#/jurnal?dasar=${active.id}`;
      }
      if (a === "new") location.hash = "#/jurnal?baru=1";
    });

    window.addEventListener("beforeunload", (e) => {
      if (isSaving) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    loadNameSuggestions();
  }

  async function open(id, params) {
    init();
    const dasar = params.get("dasar");
    const tpl = params.get("template");
    const baru = params.get("baru");
    const tahap = params.get("tahap");

    try {
      if (dasar || tpl || baru) {
        if (!(await confirmDiscard())) {
          history.replaceState(null, "", active.id != null ? `#/jurnal/${active.id}` : "#/jurnal");
          renderAll();
          return;
        }
        if (baru) resetToNew();
        else if (dasar) {
          await loadFromDb(dasar, "dasar");
          JG.toast("success", "Jurnal baru dari riwayat", "Tanggal hari ini, jam manuver dikosongkan.", 2000);
        } else {
          await loadTemplate(tpl);
          JG.toast("success", "Template dipakai", "Tanggal hari ini. Tinggal isi jam & identitas.", 2000);
        }
        history.replaceState(null, "", "#/jurnal");
      } else if (id) {
        const same = String(active.id) === String(id);
        if (!(same && isDirty())) {
          if (!same && !(await confirmDiscard())) {
            history.replaceState(null, "", active.id != null ? `#/jurnal/${active.id}` : "#/jurnal");
            renderAll();
            return;
          }
          await loadFromDb(id, "lanjutkan");
        }
        if (tahap === "penormalan") state.stage = "penormalan";
        persist();
        history.replaceState(null, "", `#/jurnal/${id}`);
      }
    } catch (e) {
      console.error("Gagal memuat jurnal:", e);
      Swal.fire({ icon: "error", title: "Gagal memuat jurnal", text: "Cek koneksi internet, lalu coba lagi." });
    }

    const pengawasPanel = $("pengawasPanel");
    pengawasPanel.open = !PEOPLE.some(([k]) => (state[k] || "").trim());
    renderAll();
  }

  JG.editor = {
    open,
    hasLocalDraft() {
      init();
      return hasContent() && (active.id == null || isDirty());
    },
    draftInfo() {
      return { gi: state.namaGi, keterangan: state.keterangan, id: active.id, rows: state.pembebasan.length };
    },
  };
})();
