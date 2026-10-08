(function () {
  const STORAGE_KEY = "jurnalGiForm_v4";
  const THEME_KEY = "jurnalGiTheme_v1";

  const { normalizeSavedTime, parseManuverText } = window.ManuverParser;

  let lastVisiblePart = "";
  let lastHiddenPart = "";

  function buildReadMoreText(visiblePart, hiddenPart) {
    if (!hiddenPart) return visiblePart;
    const filler = "\u034F".repeat(3105);
    return visiblePart + filler + "\n" + hiddenPart;
  }

  const PRESET_AWAL = [
    { key: "awal1", label: "Semoga pekerjaan diberikan keamanan dan kelancaran🙏" },
    { key: "awal2", label: "Bismillah, Semoga pekerjaan lancar dan personil aman🙏🏻🙏🏻" },
    { key: "awal3", label: "Bismillah semoga pekerjaan berjalan lancar personil aman 🤲" },
  ];
  const PRESET_AKHIR = [
    { key: "akhir1", label: "Alhamdulillah pekerjaan sudah selesai dengan dan lancar🙏" },
    { key: "akhir2", label: "Alhamdulillah pekerjaan sudah selesai dengan aman dan lancar🙏" },
    { key: "akhir3", label: "Alhamdulillah pekerjaan telah selesai dengan lancar, aman personil dan peralatan, terimakasih 🙏🏻" },
  ];
  const PRESET_MAP = {};
  [...PRESET_AWAL, ...PRESET_AKHIR].forEach((p) => {
    PRESET_MAP[p.key] = p.label;
  });

  const form = document.getElementById("jurnalForm");
  const previewBox = document.getElementById("previewBox");

  const pembebasanBody = document.getElementById("pembebasanBody");
  const penormalanBody = document.getElementById("penormalanBody");

  const addPembebasanRowBtn = document.getElementById("addPembebasanRow");
  const addPenormalanRowBtn = document.getElementById("addPenormalanRow");

  const copyBtn = document.getElementById("copyBtn");
  const newJurnalBtn = document.getElementById("newJurnalBtn");

  const themeToggleBtn = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");

  const tanggalInput = document.getElementById("tanggal");
  const hariInput = document.getElementById("hari");

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    if (!themeIcon) return;
    if (theme === "dark") {
      themeIcon.textContent = "☀️";
    } else {
      themeIcon.textContent = "🌙";
    }
  }

  function toggleTheme() {
    const current = document.body.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  function getHariFromDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    const hari = d.getDay();
    const map = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    return map[hari] || "";
  }

  function updateHari() {
    const tgl = tanggalInput.value;
    const hari = getHariFromDate(tgl);
    hariInput.value = hari || "";
  }

  function initTimePicker(inputEl) {
    flatpickr(inputEl, {
      enableTime: true,
      noCalendar: true,
      time_24hr: true,
      enableSeconds: false,
      dateFormat: "H:i",
      allowInput: true,
      minuteIncrement: 1,
      onClose(selectedDates, dateStr) {
        const normalized = normalizeSavedTime(dateStr || inputEl.value);
        inputEl.value = normalized;
        updateAndSave();
      }
    });
  }

  function formatTime(raw) {
    return normalizeSavedTime(raw || "") || "__:__";
  }


  function sectionHasOnlyEmptyRows(section) {
    const tbody = section === "pembebasan" ? pembebasanBody : penormalanBody;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    return rows.every((tr) => {
      const waktu = tr.querySelector(".waktuInput")?.value.trim();
      const peralatan = tr.querySelector(".peralatanInput")?.value.trim();
      const bay = tr.querySelector(".bayInput")?.value.trim();
      return !waktu && !peralatan && !bay;
    });
  }

  function clearSectionRows(section) {
    const tbody = section === "pembebasan" ? pembebasanBody : penormalanBody;
    tbody.innerHTML = "";
  }


  const giCache = {};

  async function loadGiCache() {
    try {
      const { data, error } = await window.JurnalAuth.supabaseClient
        .from("gi")
        .select("id, nama");
      if (error) throw error;
      (data || []).forEach((row) => {
        giCache[row.nama] = row.id;
      });
    } catch (e) {
      console.warn("Gagal memuat data GI:", e);
    }
  }



  function getRowsData(section) {
    const tbody = section === "pembebasan" ? pembebasanBody : penormalanBody;
    const rows = [];

    tbody.querySelectorAll("tr").forEach((tr) => {
      const waktuEl = tr.querySelector(".waktuInput");
      const peralatan = tr.querySelector(".peralatanInput")?.value || "";
      const bay = tr.querySelector(".bayInput")?.value || "";
      const status = tr.querySelector(".statusInput")?.value || "";

      const rawWaktu = (waktuEl?.value || "").trim();
      const waktu = normalizeSavedTime(rawWaktu);

      if (waktuEl && waktu && waktu !== rawWaktu) {
        waktuEl.value = waktu;
      }

      if (waktu || peralatan || bay) {
        rows.push({ waktu, peralatan, bay, status });
      }
    });

    return rows;
  }


  const ACTIVE_KEY = "jurnalGiActive_v1";
  const EMPTY_ACTIVE = { id: null, updatedAt: null, savedSnapshot: null };

  const saveStatusEl = document.getElementById("saveStatus");
  const saveStatusText = document.getElementById("saveStatusText");
  const saveBtn = document.getElementById("saveBtn");
  const copyBtnSheet = document.getElementById("copyBtnSheet");

  let active = loadActive();
  let isSaving = false;

  function loadActive() {
    try {
      const a = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null");
      if (a && typeof a === "object") {
        return {
          id: a.id ?? null,
          updatedAt: a.updatedAt ?? null,
          savedSnapshot: a.savedSnapshot ?? null,
        };
      }
    } catch (e) {}
    return { ...EMPTY_ACTIVE };
  }

  function persistActive(dirty) {
    try {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify({ ...active, dirty: !!dirty }));
    } catch (e) {}
  }

  function fieldVal(id) {
    const el = document.getElementById(id);
    return el ? el.value || "" : "";
  }

  function getPesanPenutup(tahapPenormalan) {
    return (
      (tahapPenormalan ? fieldVal("pesanPenormalan") : fieldVal("pesanPembebasan")).trim() ||
      (tahapPenormalan ? PRESET_AKHIR[0]?.label : PRESET_AWAL[0]?.label) ||
      ""
    );
  }

  function collectFormData() {
    const tahapPenormalan = document.getElementById("tahapPenormalanToggle").checked;
    return {
      namaGi: fieldVal("namaGi"),
      tanggal: tanggalInput.value || "",
      hari: hariInput.value || "",
      keterangan: fieldVal("keterangan"),
      dispatcher: fieldVal("dispatcher"),
      pengawasManuver: fieldVal("pengawasManuver"),
      pengawasPekerjaan: fieldVal("pengawasPekerjaan"),
      pengawasK3: fieldVal("pengawasK3"),
      pelaksanaManuver: fieldVal("pelaksanaManuver"),
      tahapPenormalan,
      pesanPenutup: getPesanPenutup(tahapPenormalan),
      pembebasanRows: getRowsData("pembebasan"),
      penormalanRows: getRowsData("penormalan"),
    };
  }

  function hasContent(d) {
    return !!(
      d.namaGi ||
      d.tanggal ||
      d.keterangan.trim() ||
      d.dispatcher.trim() ||
      d.pengawasManuver.trim() ||
      d.pengawasPekerjaan.trim() ||
      d.pengawasK3.trim() ||
      d.pelaksanaManuver.trim() ||
      d.pembebasanRows.length ||
      d.penormalanRows.length
    );
  }

  function isDirty() {
    const d = collectFormData();
    if (active.id == null) return hasContent(d);
    return JSON.stringify(d) !== active.savedSnapshot;
  }

  function parseIso(iso) {
    if (!iso) return null;
    const d = new Date(String(iso).replace(/(\.\d{3})\d+/, "$1"));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatSavedAt(iso) {
    const d = parseIso(iso);
    if (!d) return "";
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return hhmm;
    const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][d.getMonth()];
    return `${d.getDate()} ${bln} ${hhmm}`;
  }

  function refreshSaveStatus() {
    const dirty = isDirty();
    persistActive(dirty);
    if (!saveStatusEl || !saveStatusText) return;

    let state;
    let text;
    if (isSaving) {
      state = "saving";
      text = "Menyimpan...";
    } else if (active.id == null) {
      state = dirty ? "dirty" : "empty";
      text = dirty ? "Jurnal baru · belum disimpan" : "Jurnal baru";
    } else if (dirty) {
      state = "dirty";
      text = `Jurnal #${active.id} · ada perubahan belum disimpan`;
    } else {
      state = "saved";
      text = `Jurnal #${active.id} · tersimpan ${formatSavedAt(active.updatedAt)}`;
    }

    saveStatusEl.dataset.state = state;
    saveStatusText.textContent = text;
  }

  function setBusy(busy) {
    [saveBtn, copyBtn, copyBtnSheet].forEach((b) => {
      if (b) b.disabled = busy;
    });
  }

  function toast(icon, title, text, timer = 1800) {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title,
      text,
      showConfirmButton: false,
      timer,
      timerProgressBar: true,
    });
  }

  function classifySaveError(e) {
    const msg = (e && (e.message || e.details || "")) || "";
    if (msg.includes("JURNAL_KONFLIK")) return "konflik";
    if (msg.includes("JURNAL_TIDAK_ADA")) return "hilang";
    return "error";
  }

  async function saveJurnal(opts = {}) {
    if (isSaving) return { ok: false, reason: "busy" };

    const data = collectFormData();
    if (!data.tanggal) {
      if (!opts.quiet) toast("warning", "Tanggal belum diisi", "Isi tanggal dulu supaya jurnal bisa disimpan.", 2200);
      return { ok: false, reason: "invalid" };
    }

    if (!Object.keys(giCache).length) await loadGiCache();

    const sb = window.JurnalAuth.supabaseClient;
    const teksFinal = generateText();
    const targetId = opts.asNew ? null : active.id;
    const expected = targetId == null || opts.force ? null : active.updatedAt;

    const header = {
      gi_id: giCache[data.namaGi] || null,
      tanggal: data.tanggal,
      hari: data.hari,
      keterangan: data.keterangan,
      dispatcher: data.dispatcher,
      pengawas_manuver: data.pengawasManuver,
      pengawas_pekerjaan: data.pengawasPekerjaan,
      pengawas_k3: data.pengawasK3,
      pelaksana_manuver: data.pelaksanaManuver,
      pesan_penutup: data.pesanPenutup,
      teks_final: teksFinal,
      tahap_penormalan: data.tahapPenormalan,
      user: window.JurnalAuth.getCurrentUserName() || "-",
    };

    const rows = [
      ...data.pembebasanRows.map((r, i) => ({ section: "pembebasan", urutan: i, ...r })),
      ...data.penormalanRows.map((r, i) => ({ section: "penormalan", urutan: i, ...r })),
    ];

    isSaving = true;
    setBusy(true);
    refreshSaveStatus();

    let outcome;
    try {
      const { data: res, error } = await sb.rpc("simpan_jurnal", {
        p_id: targetId,
        p_header: header,
        p_rows: rows,
        p_expected_updated_at: expected,
      });
      if (error) throw error;

      active = {
        id: res.id,
        updatedAt: res.updated_at,
        savedSnapshot: JSON.stringify(data),
      };
      window.JurnalAuth.markActivity();
      outcome = { ok: true, id: res.id, created: targetId == null };
    } catch (e) {
      console.warn("Gagal menyimpan jurnal:", e);
      outcome = { ok: false, reason: classifySaveError(e) };
    } finally {
      isSaving = false;
      setBusy(false);
      refreshSaveStatus();
    }

    if (outcome.reason === "konflik") return handleConflict(opts);
    if (outcome.reason === "hilang") return handleMissing(opts);
    return outcome;
  }

  async function handleConflict(opts) {
    let info = "";
    try {
      const { data } = await window.JurnalAuth.supabaseClient
        .from("jurnal_manuver")
        .select("updated_at, diubah_oleh")
        .eq("id", active.id)
        .single();
      if (data) {
        info = `Terakhir disimpan${data.diubah_oleh ? ` oleh ${data.diubah_oleh}` : ""} jam ${formatSavedAt(data.updated_at)}, setelah kamu membukanya.`;
      }
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
      await loadJurnalIntoForm(active.id, "lanjutkan");
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

  async function writeClipboard(text) {
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
  }

  async function onSaveClick() {
    if (active.id != null && !isDirty()) {
      toast("info", `Jurnal #${active.id} sudah tersimpan`, "", 1500);
      return;
    }
    const r = await saveJurnal();
    if (r.ok) {
      toast("success", r.created ? `Tersimpan sebagai Jurnal #${r.id}` : `Perubahan Jurnal #${r.id} disimpan`, "", 1700);
    } else if (r.reason === "error") {
      toast("error", "Gagal menyimpan", "Cek koneksi internet, lalu coba lagi.", 2400);
    }
  }

  async function copyAndSave() {
    const text = generateText();
    if (!text.trim()) return;

    const waReadMoreToggle = document.getElementById("waReadMoreToggle");
    const useReadMore = waReadMoreToggle && waReadMoreToggle.checked;
    const textToCopy = useReadMore ? buildReadMoreText(lastVisiblePart, lastHiddenPart) : text;

    const copied = await writeClipboard(textToCopy);
    if (!copied) {
      Swal.fire({ icon: "error", title: "Gagal menyalin", text: "Silakan salin manual dari preview." });
      return;
    }

    if (active.id != null && !isDirty()) {
      toast("success", "Tersalin", `Jurnal #${active.id} sudah tersimpan.`, 1600);
      return;
    }

    if (!tanggalInput.value) {
      toast("warning", "Tersalin, tapi belum disimpan", "Tanggal belum diisi.", 2400);
      return;
    }

    const r = await saveJurnal({ quiet: true });
    if (r.ok) {
      toast("success", "Tersalin & tersimpan", `Jurnal #${r.id}`, 1700);
    } else if (r.reason === "error") {
      toast("warning", "Tersalin, tapi gagal disimpan", "Cek koneksi, lalu tekan Simpan.", 2600);
    }
  }

  function resetFormToEmpty() {
    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    document.getElementById("pesanPembebasan").value = "";
    document.getElementById("pesanPenormalan").value = "";
    pembebasanBody.innerHTML = "";
    penormalanBody.innerHTML = "";
    createRow("pembebasan");
    createRow("penormalan");
    hariInput.value = "";
    updateStageUI();
    active = { ...EMPTY_ACTIVE };
    generateText();
    saveFormState();
    refreshSaveStatus();
  }

  async function startNewJurnal() {
    if (isDirty()) {
      const res = await Swal.fire({
        icon: "warning",
        title: "Ada perubahan yang belum disimpan",
        text:
          active.id != null
            ? `Perubahan di Jurnal #${active.id} belum tersimpan ke riwayat.`
            : "Jurnal ini belum pernah disimpan ke riwayat.",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Simpan dulu",
        denyButtonText: "Buang",
        cancelButtonText: "Batal",
      });
      if (res.isDismissed) return;
      if (res.isConfirmed) {
        const r = await saveJurnal();
        if (!r.ok) {
          if (r.reason === "error") toast("error", "Gagal menyimpan", "Cek koneksi internet, lalu coba lagi.", 2400);
          return;
        }
      }
    }

    resetFormToEmpty();
    toast("success", "Siap untuk jurnal baru", "", 1300);
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function loadJurnalIntoForm(id, mode) {
    const sb = window.JurnalAuth.supabaseClient;
    const { data: h, error } = await sb
      .from("jurnal_manuver")
      .select(
        "id, tanggal, hari, keterangan, dispatcher, pengawas_manuver, pengawas_pekerjaan, pengawas_k3, pelaksana_manuver, pesan_penutup, tahap_penormalan, updated_at, gi(nama), jurnal_manuver_rows(section, urutan, waktu, peralatan, bay, status)"
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    const asBase = mode === "dasar";
    const allRows = h.jurnal_manuver_rows || [];
    const pembebasanRows = allRows.filter((r) => r.section === "pembebasan").sort((a, b) => a.urutan - b.urutan);
    const penormalanRows = allRows.filter((r) => r.section === "penormalan").sort((a, b) => a.urutan - b.urutan);
    const tahapPenormalan = asBase ? false : h.tahap_penormalan ?? penormalanRows.length > 0;

    document.getElementById("namaGi").value = h.gi?.nama || "";
    tanggalInput.value = asBase ? todayIso() : h.tanggal || "";
    hariInput.value = asBase ? getHariFromDate(tanggalInput.value) : h.hari || getHariFromDate(h.tanggal || "");
    document.getElementById("keterangan").value = h.keterangan || "";
    document.getElementById("dispatcher").value = h.dispatcher || "";
    document.getElementById("pengawasManuver").value = h.pengawas_manuver || "";
    document.getElementById("pengawasPekerjaan").value = h.pengawas_pekerjaan || "";
    document.getElementById("pengawasK3").value = h.pengawas_k3 || "";
    document.getElementById("pelaksanaManuver").value = h.pelaksana_manuver || "";

    document.getElementById("pesanPembebasan").value = "";
    document.getElementById("pesanPenormalan").value = "";
    if (!asBase) {
      document.getElementById(tahapPenormalan ? "pesanPenormalan" : "pesanPembebasan").value = h.pesan_penutup || "";
    }
    document.getElementById("tahapPenormalanToggle").checked = tahapPenormalan;
    updateStageUI();

    pembebasanBody.innerHTML = "";
    penormalanBody.innerHTML = "";
    const prep = (r) => (asBase ? { ...r, waktu: "" } : r);

    if (pembebasanRows.length) pembebasanRows.forEach((r) => createRow("pembebasan", prep(r)));
    else createRow("pembebasan");

    if (penormalanRows.length) penormalanRows.forEach((r) => createRow("penormalan", prep(r)));
    else createRow("penormalan");

    generateText();
    saveFormState();

    active = asBase
      ? { ...EMPTY_ACTIVE }
      : { id: h.id, updatedAt: h.updated_at, savedSnapshot: JSON.stringify(collectFormData()) };

    refreshSaveStatus();
  }

function createRow(section, data) {
  const tbody = section === "pembebasan" ? pembebasanBody : penormalanBody;
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td data-label="Waktu">
      <input type="text" class="form-control form-control-sm waktuInput" placeholder="00:00" />
    </td>
    <td class="peralatan-cell" data-label="Peralatan">
      <div class="input-group input-group-sm peralatan-group">
        <select class="form-select form-select-sm peralatanInput peralatanSelect">
          <option value="">Pilih Peralatan...</option>
          <option value="PMT 150KV">PMT 150KV</option>
          <option value="PMS BUS A 150KV">PMS BUS A 150KV</option>
          <option value="PMS BUS B 150KV">PMS BUS B 150KV</option>
          <option value="PMS LINE 150KV">PMS LINE 150KV</option>
          <option value="PMS GROUND 150KV">PMS GROUND 150KV</option>
          <option value="PMT INC 20KV">PMT INC 20KV</option>
          <option value="LAINNYA">Lainnya...</option>
        </select>
      </div>
    </td>
    <td data-label="Nama Bay">
      <input type="text" class="form-control form-control-sm bayInput" placeholder="Contoh: SAMPANG 2" />
    </td>
    <td data-label="Status">
      <select class="form-select form-select-sm statusInput">
        <option value="#">#</option>
        <option value="//">//</option>
        <option value="Draw In">Draw In</option>
        <option value="Draw Out">Draw Out</option>
      </select>
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-sm btn-outline-danger remove-row-btn" title="Hapus baris">&times;</button>
    </td>
  `;

  tbody.appendChild(tr);

  const waktuInput = tr.querySelector(".waktuInput");
  const bayInput = tr.querySelector(".bayInput");
  const statusInput = tr.querySelector(".statusInput");

  const peralatanGroup = tr.querySelector(".peralatan-group");
  const peralatanSelect = tr.querySelector(".peralatanSelect");
  let peralatanInput = tr.querySelector(".peralatanInput");

  initTimePicker(waktuInput);

  function attachCommonListeners(el) {
    el.addEventListener("input", updateAndSave);
    el.addEventListener("change", updateAndSave);
  }

  waktuInput.addEventListener("blur", () => {
    const normalized = normalizeSavedTime(waktuInput.value);
    if (normalized && normalized !== waktuInput.value) {
      waktuInput.value = normalized;
      updateAndSave();
    }
  });

  attachCommonListeners(waktuInput);
  attachCommonListeners(bayInput);
  attachCommonListeners(statusInput);

  function useSelectMode(value) {
    peralatanGroup.innerHTML = "";
    peralatanGroup.appendChild(peralatanSelect);

    peralatanSelect.value = value || "";
    peralatanInput = peralatanSelect;

    attachCommonListeners(peralatanInput);
  }

  function useCustomMode(initialValue) {
    const wrapper = document.createElement("div");
    wrapper.className = "input-group input-group-sm";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control form-control-sm peralatanInput";
    input.placeholder = "Isi peralatan...";
    input.value = initialValue || "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-outline-secondary peralatan-cancel-btn";
    btn.innerHTML = "&times;";

    wrapper.appendChild(input);
    wrapper.appendChild(btn);

    peralatanGroup.innerHTML = "";
    peralatanGroup.appendChild(wrapper);

    peralatanInput = input;

    attachCommonListeners(peralatanInput);

    btn.addEventListener("click", () => {
      useSelectMode("");
      updateAndSave();
    });

    input.focus();
  }

  if (data) {
    if (data.waktu) {
      const normalizedWaktu = normalizeSavedTime(data.waktu);
      if (waktuInput._flatpickr) {
        waktuInput._flatpickr.setDate(normalizedWaktu, false);
      } else {
        waktuInput.value = normalizedWaktu;
      }
    }

    if (data.peralatan) {
      let savedPeralatan = data.peralatan === "PMT 20KV" ? "PMT INC 20KV" : data.peralatan;

      const optionValues = Array.from(peralatanSelect.options).map((o) => o.value);

      if (savedPeralatan && !optionValues.includes(savedPeralatan)) {
        useCustomMode(savedPeralatan);
      } else {
        useSelectMode(savedPeralatan);
      }
    } else {
      useSelectMode("");
    }

    if (data.bay) bayInput.value = data.bay;
    if (data.status) statusInput.value = data.status;
  } else {
    useSelectMode("");
  }

  peralatanSelect.addEventListener("change", (e) => {
    if (e.target.value === "LAINNYA") {
      useCustomMode("");
      updateAndSave();
    } else {
      peralatanInput = peralatanSelect;
      updateAndSave();
    }
  });

  const removeBtn = tr.querySelector(".remove-row-btn");
  removeBtn.addEventListener("click", () => {
    tr.remove();
    updateAndSave();
  });
}


  function saveFormState() {
    const data = {
      namaGi: document.getElementById("namaGi").value || "",
      tanggal: tanggalInput.value || "",
      hari: hariInput.value || "",
      keterangan: document.getElementById("keterangan").value || "",
      dispatcher: document.getElementById("dispatcher").value || "",
      pengawasManuver: document.getElementById("pengawasManuver").value || "",
      pengawasPekerjaan: document.getElementById("pengawasPekerjaan").value || "",
      pengawasK3: document.getElementById("pengawasK3").value || "",
      pelaksanaManuver: document.getElementById("pelaksanaManuver").value || "",
      tahapPenormalan: document.getElementById("tahapPenormalanToggle").checked,
      pesanPembebasan: document.getElementById("pesanPembebasan").value || "",
      pesanPenormalan: document.getElementById("pesanPenormalan").value || "",
      pembebasanRows: getRowsData("pembebasan"),
      penormalanRows: getRowsData("penormalan"),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Gagal menyimpan ke localStorage:", e);
    }
  }

  function loadFormState() {
    let data;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      data = null;
    }

    if (!data) {
      pembebasanBody.innerHTML = "";
      penormalanBody.innerHTML = "";
      createRow("pembebasan");
      createRow("penormalan");
      updateStageUI();
      return;
    }

    document.getElementById("namaGi").value = data.namaGi || "";
    tanggalInput.value = data.tanggal || "";
    document.getElementById("keterangan").value = data.keterangan || "";
    document.getElementById("dispatcher").value = data.dispatcher || "";
    document.getElementById("pengawasManuver").value = data.pengawasManuver || "";
    document.getElementById("pengawasPekerjaan").value = data.pengawasPekerjaan || "";
    document.getElementById("pengawasK3").value = data.pengawasK3 || "";
    document.getElementById("pelaksanaManuver").value = data.pelaksanaManuver || "";
    document.getElementById("tahapPenormalanToggle").checked = !!data.tahapPenormalan;
    document.getElementById("pesanPembebasan").value = data.pesanPembebasan || "";
    document.getElementById("pesanPenormalan").value = data.pesanPenormalan || "";
    updateStageUI();

    updateHari();

    pembebasanBody.innerHTML = "";
    penormalanBody.innerHTML = "";

    if (Array.isArray(data.pembebasanRows) && data.pembebasanRows.length) {
      data.pembebasanRows.forEach((row) => createRow("pembebasan", row));
    } else {
      createRow("pembebasan");
    }

    if (Array.isArray(data.penormalanRows) && data.penormalanRows.length) {
      data.penormalanRows.forEach((row) => createRow("penormalan", row));
    } else {
      createRow("penormalan");
    }
  }

  function generateText() {
    const namaGi = document.getElementById("namaGi").value.trim();
    const tanggal = tanggalInput.value;
    const hari = hariInput.value.trim();
    const keterangan = document.getElementById("keterangan").value.trim();
    const dispatcher = document.getElementById("dispatcher").value.trim();
    const pengawasManuver = document.getElementById("pengawasManuver").value.trim();
    const pengawasPekerjaan = document.getElementById("pengawasPekerjaan").value.trim();
    const pengawasK3 = document.getElementById("pengawasK3").value.trim();
    const pelaksanaManuver = document.getElementById("pelaksanaManuver").value.trim();
    const tahapPenormalan = document.getElementById("tahapPenormalanToggle").checked;
    const pesanPenutup =
      (tahapPenormalan
        ? document.getElementById("pesanPenormalan").value.trim()
        : document.getElementById("pesanPembebasan").value.trim()) ||
      (tahapPenormalan ? PRESET_AKHIR[0]?.label : PRESET_AWAL[0]?.label) ||
      "";

    const pembebasanRows = getRowsData("pembebasan");
    const penormalanRows = getRowsData("penormalan");

    function formatTanggalIndo(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return "";
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
      ];
      const tgl = d.getDate();
      const bln = months[d.getMonth()];
      const thn = d.getFullYear();
      return `${tgl} ${bln} ${thn}`;
    }

    let lines = [];
    let readMoreSplitIndex = 0;

    if (namaGi) {
      lines.push(`*JURNAL GI ${namaGi.toUpperCase()}*`);
    } else {
      lines.push("*JURNAL GI _______*");
    }

    if (hari || tanggal) {
      const tanggalFormatted = formatTanggalIndo(tanggal);
      const lineHariTanggal = [hari, tanggalFormatted].filter(Boolean).join(", ");
      if (lineHariTanggal) lines.push(lineHariTanggal);
    }

    lines.push("");

    if (keterangan) {
      lines.push(`Ket: ${keterangan}`);
      lines.push("");
    }

    readMoreSplitIndex = lines.length;

    function formatRowLine(row) {
      const waktu = formatTime(row.waktu);
      const peralatan = row.peralatan || "______";
      const status = row.status || "";
      const bayPart = row.bay ? `BAY ${row.bay.toUpperCase()}` : "";
      return `${waktu} ${peralatan} ${bayPart} ${status}`.replace(/\s+/g, " ").trim();
    }

    if (pembebasanRows.length) {
      lines.push("Pembebasan tegangan:");
      pembebasanRows.forEach((row) => {
        lines.push(formatRowLine(row));
      });
      lines.push("");
    }

    if (penormalanRows.length && tahapPenormalan) {
      lines.push("Penormalan tegangan:");
      penormalanRows.forEach((row) => {
        lines.push(formatRowLine(row));
      });
      lines.push("");
    }

    if (
      dispatcher || pengawasManuver ||
      pengawasPekerjaan || pengawasK3 || pelaksanaManuver
    ) {
      if (dispatcher) lines.push(`Dispatcher: ${dispatcher}`);
      if (pengawasManuver) lines.push(`Pengawas Manuver: ${pengawasManuver}`);
      if (pengawasPekerjaan) lines.push(`Pengawas Pekerjaan: ${pengawasPekerjaan}`);
      if (pengawasK3) lines.push(`Pengawas K3: ${pengawasK3}`);
      if (pelaksanaManuver) lines.push(`Pelaksana Manuver: ${pelaksanaManuver}`);
      lines.push("");
    }

    if (pesanPenutup) {
      lines.push(pesanPenutup);
    }

    const result = lines.join("\n");
    previewBox.textContent = result || "Belum ada data untuk ditampilkan.";
    lastVisiblePart = lines.slice(0, readMoreSplitIndex).join("\n");
    lastHiddenPart = lines.slice(readMoreSplitIndex).join("\n");
    return result;
  }

  function renderPresetOptions(tahapPenormalan) {
    const presetSelect = document.getElementById("presetPesanPenutup");
    const list = tahapPenormalan ? PRESET_AKHIR : PRESET_AWAL;
    const optionsHtml = list.map((p) => `<option value="${p.key}">${p.label}</option>`).join("");
    presetSelect.innerHTML = `<option value="">Pilih preset pesan (opsional)</option>${optionsHtml}`;
  }

  function ensureDefaultPesan() {
    const pesanPembebasanEl = document.getElementById("pesanPembebasan");
    const pesanPenormalanEl = document.getElementById("pesanPenormalan");
    if (!pesanPembebasanEl.value.trim() && PRESET_AWAL[0]) {
      pesanPembebasanEl.value = PRESET_AWAL[0].label;
    }
    if (!pesanPenormalanEl.value.trim() && PRESET_AKHIR[0]) {
      pesanPenormalanEl.value = PRESET_AKHIR[0].label;
    }
  }

  function updateStageUI() {
    const tahapPenormalan = document.getElementById("tahapPenormalanToggle").checked;
    const pesanPembebasanWrap = document.getElementById("pesanPembebasanWrap");
    const pesanPenormalanWrap = document.getElementById("pesanPenormalanWrap");
    const penormalanSection = document.getElementById("penormalanSection");

    penormalanSection.classList.toggle("stage-inactive", !tahapPenormalan);
    renderPresetOptions(tahapPenormalan);
    ensureDefaultPesan();

    if (tahapPenormalan) {
      pesanPembebasanWrap.classList.add("d-none");
      pesanPenormalanWrap.classList.remove("d-none");
    } else {
      pesanPembebasanWrap.classList.remove("d-none");
      pesanPenormalanWrap.classList.add("d-none");
    }
  }

  function updateAndSave() {
    saveFormState();
    generateText();
    refreshSaveStatus();
  }

  let importTargetSection = "pembebasan";
  let importParsedRows = [];
  const importModalEl = document.getElementById("importTextModal");
  const importTextArea = document.getElementById("importTextArea");
  const importPreviewWrap = document.getElementById("importPreviewWrap");
  const importPreviewBody = document.getElementById("importPreviewBody");
  const importApplyBtn = document.getElementById("importApplyBtn");
  const bsImportModal = importModalEl ? new bootstrap.Modal(importModalEl) : null;

  function renderImportPreview() {
    const text = importTextArea.value;
    importParsedRows = text.trim() ? parseManuverText(text) : [];

    if (!importParsedRows.length) {
      importPreviewWrap.classList.add("d-none");
      importApplyBtn.disabled = true;
      return;
    }

    importPreviewBody.innerHTML = importParsedRows
      .map(
        (r) => `
        <tr>
          <td>${r.waktu || "__:__"}</td>
          <td>${r.peralatan || "-"}</td>
          <td>${r.bay || "-"}</td>
          <td>${r.status}</td>
        </tr>`
      )
      .join("");

    importPreviewWrap.classList.remove("d-none");
    importApplyBtn.disabled = false;
  }

  document.querySelectorAll(".btn-import-text").forEach((btn) => {
    btn.addEventListener("click", () => {
      importTargetSection = btn.dataset.targetSection || "pembebasan";
      importTextArea.value = "";
      importParsedRows = [];
      importPreviewWrap.classList.add("d-none");
      importApplyBtn.disabled = true;
      bsImportModal?.show();
      setTimeout(() => importTextArea.focus(), 200);
    });
  });

  if (importTextArea) {
    importTextArea.addEventListener("input", renderImportPreview);
  }

  if (importApplyBtn) {
    importApplyBtn.addEventListener("click", () => {
      if (!importParsedRows.length) return;

      if (sectionHasOnlyEmptyRows(importTargetSection)) {
        clearSectionRows(importTargetSection);
      }

      importParsedRows.forEach((row) => createRow(importTargetSection, row));
      updateAndSave();
      bsImportModal?.hide();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `${importParsedRows.length} baris ditambahkan`,
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    });
  }

  document.getElementById("namaGi").addEventListener("change", updateAndSave);
  tanggalInput.addEventListener("change", () => {
    updateHari();
    updateAndSave();
  });
  document.getElementById("keterangan").addEventListener("input", updateAndSave);
  document.getElementById("dispatcher").addEventListener("input", updateAndSave);
  document.getElementById("pengawasManuver").addEventListener("input", updateAndSave);
  document.getElementById("pengawasPekerjaan").addEventListener("input", updateAndSave);
  document.getElementById("pengawasK3").addEventListener("input", updateAndSave);
  document.getElementById("pelaksanaManuver").addEventListener("input", updateAndSave);
  document.getElementById("pesanPembebasan").addEventListener("input", updateAndSave);
  document.getElementById("pesanPenormalan").addEventListener("input", updateAndSave);
  document.getElementById("tahapPenormalanToggle").addEventListener("change", () => {
    updateStageUI();
    updateAndSave();
  });

  const presetSelect = document.getElementById("presetPesanPenutup");
    if (presetSelect) {
      presetSelect.addEventListener("change", () => {
        const key = presetSelect.value;
        if (!key || !PRESET_MAP[key]) return;

        const tahapPenormalan = document.getElementById("tahapPenormalanToggle").checked;
        const textarea = document.getElementById(tahapPenormalan ? "pesanPenormalan" : "pesanPembebasan");
        if (!textarea) return;

        textarea.value = PRESET_MAP[key];

        presetSelect.value = "";

        updateAndSave();
      });

    }

  addPembebasanRowBtn.addEventListener("click", () => {
    createRow("pembebasan");
    updateAndSave();
  });

  addPenormalanRowBtn.addEventListener("click", () => {
    createRow("penormalan");
    updateAndSave();
  });

  pembebasanBody.addEventListener("click", (e) => {
    if (e.target.closest(".remove-row-btn")) {
      const tr = e.target.closest("tr");
      if (tr) tr.remove();
      updateAndSave();
    }
  });

  penormalanBody.addEventListener("click", (e) => {
    if (e.target.closest(".remove-row-btn")) {
      const tr = e.target.closest("tr");
      if (tr) tr.remove();
      updateAndSave();
    }
  });

  if (saveBtn) saveBtn.addEventListener("click", onSaveClick);
  if (copyBtn) copyBtn.addEventListener("click", copyAndSave);
  if (copyBtnSheet) copyBtnSheet.addEventListener("click", copyAndSave);
  if (newJurnalBtn) newJurnalBtn.addEventListener("click", startNewJurnal);
  if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);

  window.addEventListener("beforeunload", (e) => {
    if (isSaving || isDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === ACTIVE_KEY) active = loadActive();
  });

  (async function init() {
    const savedTheme = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(savedTheme);

    loadGiCache();
    loadFormState();

    const urlParams = new URLSearchParams(window.location.search);
    const lanjutkanId = urlParams.get("lanjutkan");
    const dasarId = urlParams.get("useHistory");
    const useTemplateId = urlParams.get("useTemplateId");

    if (lanjutkanId || dasarId) {
      try {
        await loadJurnalIntoForm(lanjutkanId || dasarId, lanjutkanId ? "lanjutkan" : "dasar");
        toast(
          "success",
          lanjutkanId ? `Melanjutkan Jurnal #${lanjutkanId}` : "Jurnal baru dari riwayat",
          lanjutkanId ? "" : "Tanggal diset hari ini, jam manuver dikosongkan.",
          1900
        );
      } catch (e) {
        console.error("Gagal memuat jurnal dari riwayat:", e);
        Swal.fire({
          icon: "error",
          title: "Gagal memuat riwayat",
          text: "Cek koneksi internet, lalu coba lagi dari halaman Riwayat.",
        });
      }
      window.history.replaceState({}, "", window.location.pathname);
    } else if (useTemplateId) {
      try {
        const sb = window.JurnalAuth.supabaseClient;
        const { data: rows, error } = await sb
          .from("template_manuver_rows")
          .select("section, urutan, peralatan, bay, status")
          .eq("template_id", useTemplateId)
          .order("urutan", { ascending: true });

        if (error) throw error;

        pembebasanBody.innerHTML = "";
        penormalanBody.innerHTML = "";

        const pembebasanRows = (rows || []).filter((r) => r.section === "pembebasan");
        const penormalanRows = (rows || []).filter((r) => r.section === "penormalan");

        if (pembebasanRows.length) pembebasanRows.forEach((row) => createRow("pembebasan", row));
        else createRow("pembebasan");

        if (penormalanRows.length) penormalanRows.forEach((row) => createRow("penormalan", row));
        else createRow("penormalan");

        document.getElementById("tahapPenormalanToggle").checked = false;
        updateStageUI();
        active = { ...EMPTY_ACTIVE };
        saveFormState();
      } catch (e) {
        console.error("Gagal memuat template:", e);
        Swal.fire({
          icon: "error",
          title: "Gagal memuat template",
          text: "Cek koneksi internet, lalu coba lagi dari halaman Riwayat.",
        });
      }
      window.history.replaceState({}, "", window.location.pathname);
    }

    generateText();
    refreshSaveStatus();
  })();
})();