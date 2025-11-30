(function () {
  const STORAGE_KEY = "jurnalGiForm_v4";
  const THEME_KEY = "jurnalGiTheme_v1";
  const HISTORY_KEY = "jurnalGiHistory_v1";

  const SWITCHING_TEMPLATE_KEY = "jurnalGiSwitchingTemplate";    // untuk template pembebasan & penormalan
  const HISTORY_SELECTED_KEY = "jurnalGiHistorySelected";        // untuk load ulang dari riwayat

  const form = document.getElementById("jurnalForm");
  const previewBox = document.getElementById("previewBox");

  const pembebasanBody = document.getElementById("pembebasanBody");
  const penormalanBody = document.getElementById("penormalanBody");

  const addPembebasanRowBtn = document.getElementById("addPembebasanRow");
  const addPenormalanRowBtn = document.getElementById("addPenormalanRow");

  const generateBtn = document.getElementById("generateBtn");
  const copyBtn = document.getElementById("copyBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  const themeToggleBtn = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeLabel = document.getElementById("themeLabel");
  const themeHint = document.getElementById("themeHint");

  const tanggalInput = document.getElementById("tanggal");
  const hariInput = document.getElementById("hari");

  // ======================= THEME ==========================
  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    if (theme === "dark") {
      themeIcon.textContent = "☀️";
      themeLabel.textContent = "Light mode";
      if (themeHint) themeHint.textContent = "Mode gelap aktif";
    } else {
      themeIcon.textContent = "🌙";
      themeLabel.textContent = "Dark mode";
      if (themeHint) themeHint.textContent = "Mode terang aktif";
    }
  }

  function toggleTheme() {
    const current = document.body.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  // ======================= TANGGAL / HARI / WAKTU ==================
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
        // rapikan format saat picker ditutup
        const normalized = normalizeSavedTime(dateStr || inputEl.value);
        inputEl.value = normalized;
        updateAndSave();
      }
    });
  }

  function formatTime(raw) {
    return normalizeSavedTime(raw || "") || "__:__";
  }


  function normalizeSavedTime(val) {
  if (!val) return "";

  const raw = String(val).trim();
  if (!raw) return "";

  let s = raw.toLowerCase().replace(/,/g, ".").trim();

  // ---- format dengan AM/PM (contoh: "4:05 pm", "4 pm") ----
  const ampmMatch = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
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

  // ---- format biasa: "16:36", "16.36", "16 36" ----
  let match = s.match(/(\d{1,2})[^\d]?(\d{2})/);
  if (!match) {
    // fallback: ambil digit saja, misal "1636"
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

  // kalau gagal parse, jangan dihapus – pakai mentahnya saja
  return raw;
}


  // ======================= RIWAYAT (storage) ==================
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch (e) {
      console.warn("Gagal membaca riwayat:", e);
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Gagal menyimpan riwayat:", e);
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

      // sekaligus update value di form kalau beda
      if (waktuEl && waktu && waktu !== rawWaktu) {
        waktuEl.value = waktu;
      }

      if (waktu || peralatan || bay) {
        rows.push({ waktu, peralatan, bay, status });
      }
    });

    return rows;
  }


  function saveJournalToHistory(finalText) {
    if (!finalText || !finalText.trim()) return;

    const history = loadHistory();

    // Cek jurnal identik (berdasarkan text)
    if (history.some((item) => item.text === finalText)) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "info",
        title: "Jurnal identik sudah ada di riwayat",
        showConfirmButton: false,
        timer: 1700,
        timerProgressBar: true
      });
      return;
    }

    const namaGiVal = document.getElementById("namaGi").value || "";
    const tanggalVal = tanggalInput.value || "";
    const hariVal = hariInput.value || "";
    const keteranganVal = document.getElementById("keterangan").value || "";
    const dispatcherVal = document.getElementById("dispatcher").value || "";
    const pengawasManuverVal = document.getElementById("pengawasManuver").value || "";
    const pengawasPekerjaanVal = document.getElementById("pengawasPekerjaan").value || "";
    const pengawasK3Val = document.getElementById("pengawasK3").value || "";
    const pelaksanaManuverVal = document.getElementById("pelaksanaManuver").value || "";
    const pesanPenutupVal = document.getElementById("pesanPenutup").value || "";

    const pembebasanRows = getRowsData("pembebasan");
    const penormalanRows = getRowsData("penormalan");

    const entry = {
      id: Date.now(),
      gi: namaGiVal || "-",
      tanggal: tanggalVal,
      hari: hariVal,
      text: finalText,
      time: new Date().toISOString(),
      keterangan: keteranganVal,
      dispatcher: dispatcherVal,
      pengawasManuver: pengawasManuverVal,
      pengawasPekerjaan: pengawasPekerjaanVal,
      pengawasK3: pengawasK3Val,
      pelaksanaManuver: pelaksanaManuverVal,
      pesanPenutup: pesanPenutupVal,
      pembebasanRows,
      penormalanRows
    };

    history.push(entry);
    saveHistory(history);

    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Jurnal disimpan ke riwayat",
      showConfirmButton: false,
      timer: 1600,
      timerProgressBar: true
    });
  }

  // ======================= ROW DINAMIS ==================
function createRow(section, data) {
  const tbody = section === "pembebasan" ? pembebasanBody : penormalanBody;
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>
      <input type="text" class="form-control form-control-sm waktuInput" placeholder="00:00" />
    </td>
    <td class="peralatan-cell">
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
    <td>
      <input type="text" class="form-control form-control-sm bayInput" placeholder="Contoh: SAMPANG 2" />
    </td>
    <td>
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

  // peralatan (bisa select / input custom)
  const peralatanGroup = tr.querySelector(".peralatan-group");
  const peralatanSelect = tr.querySelector(".peralatanSelect");
  let peralatanInput = tr.querySelector(".peralatanInput"); // current (bisa select / input)

  initTimePicker(waktuInput);

  function attachCommonListeners(el) {
    el.addEventListener("input", updateAndSave);
    el.addEventListener("change", updateAndSave);
  }

  attachCommonListeners(waktuInput);
  attachCommonListeners(bayInput);
  attachCommonListeners(statusInput);

  // --- mode dropdown normal ---
  function useSelectMode(value) {
    peralatanGroup.innerHTML = "";
    peralatanGroup.appendChild(peralatanSelect);

    peralatanSelect.value = value || "";
    peralatanInput = peralatanSelect;

    attachCommonListeners(peralatanInput);
  }

  // --- mode input custom + tombol X ---
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
      // balik ke dropdown, reset pilihan
      useSelectMode("");
      updateAndSave();
    });

    input.focus();
  }

  // --- data awal dari riwayat / template ---
  if (data) {
    if (data.waktu) waktuInput.value = normalizeSavedTime(data.waktu);

    if (data.peralatan) {
      // kompatibilitas data lama
      let savedPeralatan = data.peralatan === "PMT 20KV" ? "PMT INC 20KV" : data.peralatan;

      const optionValues = Array.from(peralatanSelect.options).map((o) => o.value);

      // kalau nilai tidak ada di dropdown -> pakai input custom
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

  // --- perubahan dropdown peralatan ---
  peralatanSelect.addEventListener("change", (e) => {
    if (e.target.value === "LAINNYA") {
      // ganti ke textbox + tombol X
      useCustomMode("");
      updateAndSave();
    } else {
      peralatanInput = peralatanSelect;
      updateAndSave();
    }
  });

  // hapus baris
  const removeBtn = tr.querySelector(".remove-row-btn");
  removeBtn.addEventListener("click", () => {
    tr.remove();
    updateAndSave();
  });
}


  // ======================= SIMPAN & LOAD FORM ==================
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
      pesanPenutup: document.getElementById("pesanPenutup").value || "",
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
    document.getElementById("pesanPenutup").value = data.pesanPenutup || "";

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

  // ======================= GENERATE TEKS ==================
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
    const pesanPenutup = document.getElementById("pesanPenutup").value.trim();

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

    if (namaGi) {
      lines.push(`JURNAL GI ${namaGi.toUpperCase()}`);
    } else {
      lines.push("JURNAL GI _______");
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

    if (pembebasanRows.length) {
      lines.push("Pembebasan tegangan:");
      pembebasanRows.forEach((row) => {
        const waktu = formatTime(row.waktu);
        const peralatan = row.peralatan || "______";
        const bay = row.bay || "______";
        const status = row.status || "";
        lines.push(`${waktu} ${peralatan} ${bay} ${status}`.trim());
      });
      lines.push("");
    }

    if (penormalanRows.length) {
      lines.push("Penormalan tegangan:");
      penormalanRows.forEach((row) => {
        const waktu = formatTime(row.waktu);
        const peralatan = row.peralatan || "______";
        const bay = row.bay || "______";
        const status = row.status || "";
        lines.push(`${waktu} ${peralatan} ${bay} ${status}`.trim());
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
    return result;
  }

  function updateAndSave() {
    saveFormState();
    generateText();
  }

  // ======================= COPY & CLEAR ==================
  async function copyToClipboard() {
    const text = previewBox.textContent || "";
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Tersalin ke clipboard",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true
      });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Gagal menyalin",
        text: "Silakan copy manual.",
      });
    }
  }

  function clearAll() {
    Swal.fire({
      title: "Reset formulir?",
      text: "Semua isian form akan dikosongkan (riwayat tetap aman).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, reset",
      cancelButtonText: "Batal",
    }).then((result) => {
      if (!result.isConfirmed) return;

      localStorage.removeItem(STORAGE_KEY);
      form.reset();
      pembebasanBody.innerHTML = "";
      penormalanBody.innerHTML = "";
      createRow("pembebasan");
      createRow("penormalan");
      hariInput.value = "";
      previewBox.textContent =
        "Klik atau ubah form untuk melihat hasil di sini.";

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Formulir dikosongkan",
        showConfirmButton: false,
        timer: 1300,
        timerProgressBar: true
      });
    });
  }

  // ======================= EVENT LISTENER ==================
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
  document.getElementById("pesanPenutup").addEventListener("input", updateAndSave);

    // preset pesan penutup
  const presetSelect = document.getElementById("presetPesanPenutup");
    if (presetSelect) {
      const presetMap = {
        awal1: "Semoga pekerjaan diberikan keamanan dan kelancaran🙏",
        awal2: "Bismillah, Semoga pekerjaan lancar dan personil aman🙏🏻🙏🏻",
        awal3: "Bismillah semoga pekerjaan berjalan lancar personil aman 🤲",
        akhir1: "Alhamdulillah pekerjaan sudah selesai dengan dan lancar🙏",
        akhir2: "Alhamdulillah pekerjaan sudah selesai dengan aman dan lancar🙏",
        akhir3: "Alhamdulillah pekerjaan telah selesai dengan lancar, aman personil dan peralatan, terimakasih 🙏🏻",
      };

      presetSelect.addEventListener("change", () => {
        const key = presetSelect.value;
        if (!key || !presetMap[key]) return;

        const textarea = document.getElementById("pesanPenutup");
        if (!textarea) return;

        const pesan = presetMap[key];

        if (!textarea.value.trim()) {
          textarea.value = pesan;
        } else if (!textarea.value.includes(pesan)) {
          textarea.value = textarea.value.trimEnd() + "\n" + pesan;
        }

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

  generateBtn.addEventListener("click", () => {
    const result = generateText();
    saveFormState();

    const saveHistoryCheckbox = document.getElementById("saveToHistory");
    if (saveHistoryCheckbox && saveHistoryCheckbox.checked) {
      saveJournalToHistory(result);
    }

    if (!result.trim()) {
      previewBox.textContent = "Belum ada data yang diisi.";
    } else {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Jurnal digenerate",
        showConfirmButton: false,
        timer: 1100,
        timerProgressBar: true
      });
    }
  });

  copyBtn.addEventListener("click", copyToClipboard);
  clearAllBtn.addEventListener("click", clearAll);
  themeToggleBtn.addEventListener("click", toggleTheme);

  // ======================= INIT ==================
  (function init() {
    const savedTheme = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(savedTheme);

    // Load form terakhir
    loadFormState();

    // Jika ada JURNAL dari RIWAYAT yang dipilih (edit/ulang)
    const historyRaw = localStorage.getItem(HISTORY_SELECTED_KEY);
    if (historyRaw) {
      try {
        const h = JSON.parse(historyRaw);

        document.getElementById("namaGi").value = h.gi || "";
        tanggalInput.value = h.tanggal || "";
        hariInput.value = h.hari || getHariFromDate(h.tanggal || "");
        document.getElementById("keterangan").value = h.keterangan || "";
        document.getElementById("dispatcher").value = h.dispatcher || "";
        document.getElementById("pengawasManuver").value = h.pengawasManuver || "";
        document.getElementById("pengawasPekerjaan").value = h.pengawasPekerjaan || "";
        document.getElementById("pengawasK3").value = h.pengawasK3 || "";
        document.getElementById("pelaksanaManuver").value = h.pelaksanaManuver || "";
        document.getElementById("pesanPenutup").value = h.pesanPenutup || "";

        pembebasanBody.innerHTML = "";
        penormalanBody.innerHTML = "";

        if (Array.isArray(h.pembebasanRows) && h.pembebasanRows.length) {
          h.pembebasanRows.forEach((row) => createRow("pembebasan", row));
        } else {
          createRow("pembebasan");
        }

        if (Array.isArray(h.penormalanRows) && h.penormalanRows.length) {
          h.penormalanRows.forEach((row) => createRow("penormalan", row));
        } else {
          createRow("penormalan");
        }
      } catch (e) {
        console.warn("Gagal memuat jurnal dari riwayat:", e);
      }
      localStorage.removeItem(HISTORY_SELECTED_KEY);
    }

    // Jika ada TEMPLATE SWITCHING yang dipilih
    const tplSwitchRaw = localStorage.getItem(SWITCHING_TEMPLATE_KEY);
    if (tplSwitchRaw) {
      try {
        const tpl = JSON.parse(tplSwitchRaw);

        pembebasanBody.innerHTML = "";
        penormalanBody.innerHTML = "";

        if (Array.isArray(tpl.pembebasan) && tpl.pembebasan.length) {
          tpl.pembebasan.forEach((row) => createRow("pembebasan", row));
        } else {
          createRow("pembebasan");
        }

        if (Array.isArray(tpl.penormalan) && tpl.penormalan.length) {
          tpl.penormalan.forEach((row) => createRow("penormalan", row));
        } else {
          createRow("penormalan");
        }
      } catch (e) {
        console.warn("Gagal memuat template switching:", e);
      }
      localStorage.removeItem(SWITCHING_TEMPLATE_KEY);
    }

    // Generate awal
    generateText();
  })();
})();
