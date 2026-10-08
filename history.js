(function () {
  const THEME_KEY = "jurnalGiTheme_v1";

  const themeToggle = document.getElementById("themeToggleHist");
  const themeIcon = document.getElementById("themeIconHist");
  const themeHint = document.getElementById("themeHintHist");

  const templatesContainer = document.getElementById("templatesContainer");
  const historyList = document.getElementById("historyList");
  const giFilter = document.getElementById("giFilter");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  let currentEntries = [];
  const giNameToId = {};
  const ACTIVE_KEY = "jurnalGiActive_v1";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(icon, title, text, timer = 1600) {
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

  function getGeneratorState() {
    try {
      return JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  async function confirmReplaceDraft() {
    const st = getGeneratorState();
    if (!st || !st.dirty) return true;

    const res = await Swal.fire({
      icon: "warning",
      title: "Form generator belum disimpan",
      text:
        (st.id != null
          ? `Jurnal #${st.id} di generator punya perubahan yang belum disimpan.`
          : "Ada jurnal baru di generator yang belum disimpan.") +
        " Kalau lanjut, isian itu akan diganti.",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Buka generator",
      denyButtonText: "Tetap lanjut",
      cancelButtonText: "Batal",
    });

    if (res.isConfirmed) {
      window.location.href = "index.html";
      return false;
    }
    return res.isDenied;
  }

  async function goToGenerator(query) {
    if (!(await confirmReplaceDraft())) return;
    const st = getGeneratorState();
    if (st) {
      try {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify({ ...st, dirty: false }));
      } catch (e) {}
    }
    window.location.href = `index.html?${query}`;
  }

  async function copyText(text) {
    if (!text || !text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Tersalin ke clipboard", "", 1400);
    } catch (e) {
      toast("error", "Gagal menyalin, coba manual", "", 1800);
    }
  }

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    if (!themeIcon) return;
    if (theme === "dark") {
      themeIcon.textContent = "☀️";
      if (themeHint) themeHint.textContent = "Mode gelap aktif";
    } else {
      themeIcon.textContent = "🌙";
      if (themeHint) themeHint.textContent = "Mode terang aktif";
    }
  }

  function toggleTheme() {
    const current = document.body.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  const { parseManuverText } = window.ManuverParser;

  const templateFormModalEl = document.getElementById("templateFormModal");
  const templateImportModalEl = document.getElementById("templateImportModal");
  const templatePembebasanBody = document.getElementById("templatePembebasanBody");
  const templatePenormalanBody = document.getElementById("templatePenormalanBody");
  const templateNameInput = document.getElementById("templateNameInput");
  const openTemplateFormBtn = document.getElementById("openTemplateFormBtn");
  const saveTemplateBtn = document.getElementById("saveTemplateBtn");
  const addTemplatePembebasanRowBtn = document.getElementById("addTemplatePembebasanRow");
  const addTemplatePenormalanRowBtn = document.getElementById("addTemplatePenormalanRow");

  const bsTemplateFormModal = templateFormModalEl ? new bootstrap.Modal(templateFormModalEl) : null;
  const bsTemplateImportModal = templateImportModalEl ? new bootstrap.Modal(templateImportModalEl) : null;

  let currentTemplates = [];
  let templateImportTargetSection = "pembebasan";
  let templateImportParsedRows = [];

  const PERALATAN_OPTIONS = [
    "PMT 150KV",
    "PMS BUS A 150KV",
    "PMS BUS B 150KV",
    "PMS LINE 150KV",
    "PMS GROUND 150KV",
    "PMT INC 20KV",
  ];

  function createTemplateRow(section, data) {
    const tbody = section === "pembebasan" ? templatePembebasanBody : templatePenormalanBody;
    const tr = document.createElement("tr");

    const optionsHtml = PERALATAN_OPTIONS.map((o) => `<option value="${o}">${o}</option>`).join("");

    tr.innerHTML = `
      <td class="peralatan-cell" data-label="Peralatan">
        <div class="input-group input-group-sm peralatan-group">
          <select class="form-select form-select-sm peralatanInput peralatanSelect">
            <option value="">Pilih Peralatan...</option>
            ${optionsHtml}
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

    const bayInput = tr.querySelector(".bayInput");
    const statusInput = tr.querySelector(".statusInput");
    const peralatanGroup = tr.querySelector(".peralatan-group");
    const peralatanSelect = tr.querySelector(".peralatanSelect");
    let peralatanInput = tr.querySelector(".peralatanInput");

    function useSelectMode(value) {
      peralatanGroup.innerHTML = "";
      peralatanGroup.appendChild(peralatanSelect);
      peralatanSelect.value = value || "";
      peralatanInput = peralatanSelect;

      peralatanSelect.onchange = () => {
        if (peralatanSelect.value === "LAINNYA") {
          useCustomMode("");
        }
      };
    }

    function useCustomMode(initialValue) {
      peralatanGroup.innerHTML = "";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "form-control form-control-sm peralatanInput";
      input.placeholder = "Ketik nama peralatan...";
      input.value = initialValue || "";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-outline-secondary peralatan-cancel-btn";
      cancelBtn.title = "Kembali ke pilihan";
      cancelBtn.textContent = "×";
      cancelBtn.onclick = () => useSelectMode("");

      peralatanGroup.appendChild(input);
      peralatanGroup.appendChild(cancelBtn);
      peralatanInput = input;
      input.focus();
    }

    if (data && data.peralatan) {
      const known = PERALATAN_OPTIONS.includes(data.peralatan);
      if (known) {
        useSelectMode(data.peralatan);
      } else {
        useCustomMode(data.peralatan);
      }
    }

    if (data && data.bay) bayInput.value = data.bay;
    if (data && data.status) statusInput.value = data.status;

    tr.querySelector(".remove-row-btn").addEventListener("click", () => {
      tr.remove();
    });
  }

  function getTemplateRowsData(section) {
    const tbody = section === "pembebasan" ? templatePembebasanBody : templatePenormalanBody;
    return Array.from(tbody.querySelectorAll("tr"))
      .map((tr) => ({
        peralatan: tr.querySelector(".peralatanInput")?.value.trim() || "",
        bay: tr.querySelector(".bayInput")?.value.trim() || "",
        status: tr.querySelector(".statusInput")?.value || "#",
      }))
      .filter((r) => r.peralatan || r.bay);
  }

  function resetTemplateForm() {
    templateNameInput.value = "";
    templatePembebasanBody.innerHTML = "";
    templatePenormalanBody.innerHTML = "";
    createTemplateRow("pembebasan");
    createTemplateRow("penormalan");
  }

  if (openTemplateFormBtn) {
    openTemplateFormBtn.addEventListener("click", () => {
      resetTemplateForm();
      bsTemplateFormModal?.show();
    });
  }

  if (addTemplatePembebasanRowBtn) {
    addTemplatePembebasanRowBtn.addEventListener("click", () => createTemplateRow("pembebasan"));
  }

  if (addTemplatePenormalanRowBtn) {
    addTemplatePenormalanRowBtn.addEventListener("click", () => createTemplateRow("penormalan"));
  }

  document.querySelectorAll(".btn-template-import").forEach((btn) => {
    btn.addEventListener("click", () => {
      templateImportTargetSection = btn.dataset.targetSection || "pembebasan";
      const textarea = document.getElementById("templateImportTextArea");
      const previewWrap = document.getElementById("templateImportPreviewWrap");
      const applyBtn = document.getElementById("templateImportApplyBtn");
      textarea.value = "";
      templateImportParsedRows = [];
      previewWrap.classList.add("d-none");
      applyBtn.disabled = true;
      bsTemplateImportModal?.show();
      setTimeout(() => textarea.focus(), 200);
    });
  });

  const templateImportTextArea = document.getElementById("templateImportTextArea");
  if (templateImportTextArea) {
    templateImportTextArea.addEventListener("input", () => {
      const previewWrap = document.getElementById("templateImportPreviewWrap");
      const previewBody = document.getElementById("templateImportPreviewBody");
      const applyBtn = document.getElementById("templateImportApplyBtn");

      const text = templateImportTextArea.value;
      templateImportParsedRows = text.trim() ? parseManuverText(text) : [];

      if (!templateImportParsedRows.length) {
        previewWrap.classList.add("d-none");
        applyBtn.disabled = true;
        return;
      }

      previewBody.innerHTML = templateImportParsedRows
        .map(
          (r) => `
          <tr>
            <td>${r.peralatan || "-"}</td>
            <td>${r.bay || "-"}</td>
            <td>${r.status}</td>
          </tr>`
        )
        .join("");

      previewWrap.classList.remove("d-none");
      applyBtn.disabled = false;
    });
  }

  const templateImportApplyBtn = document.getElementById("templateImportApplyBtn");
  if (templateImportApplyBtn) {
    templateImportApplyBtn.addEventListener("click", () => {
      if (!templateImportParsedRows.length) return;

      const tbody = templateImportTargetSection === "pembebasan" ? templatePembebasanBody : templatePenormalanBody;
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const isEmpty = rows.every((tr) => {
        const peralatan = tr.querySelector(".peralatanInput")?.value.trim();
        const bay = tr.querySelector(".bayInput")?.value.trim();
        return !peralatan && !bay;
      });
      if (isEmpty) tbody.innerHTML = "";

      templateImportParsedRows.forEach((row) => createTemplateRow(templateImportTargetSection, row));
      bsTemplateImportModal?.hide();
    });
  }

  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener("click", async () => {
      const nama = templateNameInput.value.trim();
      if (!nama) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "warning",
          title: "Nama template belum diisi",
          showConfirmButton: false,
          timer: 1600,
          timerProgressBar: true
        });
        return;
      }

      const pembebasanRows = getTemplateRowsData("pembebasan");
      const penormalanRows = getTemplateRowsData("penormalan");

      if (!pembebasanRows.length && !penormalanRows.length) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "warning",
          title: "Belum ada baris manuver yang diisi",
          showConfirmButton: false,
          timer: 1600,
          timerProgressBar: true
        });
        return;
      }

      const originalLabel = saveTemplateBtn.textContent;
      saveTemplateBtn.disabled = true;
      saveTemplateBtn.textContent = "Menyimpan...";

      try {
        const sb = window.JurnalAuth.supabaseClient;

        const { data: inserted, error: insertError } = await sb
          .from("template_manuver")
          .insert({
            nama_template: nama,
            dibuat_oleh: window.JurnalAuth.getCurrentUserName() || "-",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        const rowsPayload = [
          ...pembebasanRows.map((r, i) => ({
            template_id: inserted.id,
            section: "pembebasan",
            urutan: i,
            peralatan: r.peralatan,
            bay: r.bay,
            status: r.status,
          })),
          ...penormalanRows.map((r, i) => ({
            template_id: inserted.id,
            section: "penormalan",
            urutan: i,
            peralatan: r.peralatan,
            bay: r.bay,
            status: r.status,
          })),
        ];

        const { error: rowsError } = await sb.from("template_manuver_rows").insert(rowsPayload);
        if (rowsError) throw rowsError;

        bsTemplateFormModal?.hide();
        await renderTemplateList();

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Template disimpan",
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        });
      } catch (e) {
        console.warn("Gagal menyimpan template:", e);
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "error",
          title: "Gagal menyimpan template",
          showConfirmButton: false,
          timer: 1800,
          timerProgressBar: true
        });
      } finally {
        saveTemplateBtn.disabled = false;
        saveTemplateBtn.textContent = originalLabel;
      }
    });
  }

  async function fetchTemplates() {
    const sb = window.JurnalAuth.supabaseClient;
    const { data, error } = await sb
      .from("template_manuver")
      .select("id, nama_template, dibuat_oleh, created_at, template_manuver_rows(id, section, urutan, peralatan, bay, status)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function renderTemplateList() {
    if (!templatesContainer) return;

    templatesContainer.innerHTML = `<div class="col-12 text-muted">Memuat template...</div>`;

    try {
      currentTemplates = await fetchTemplates();
    } catch (e) {
      console.warn("Gagal memuat template:", e);
      templatesContainer.innerHTML = `<div class="col-12 text-danger small">Gagal memuat template. Cek koneksi internet lalu coba lagi.</div>`;
      return;
    }

    if (!currentTemplates.length) {
      templatesContainer.innerHTML = `<div class="col-12 text-muted">Belum ada template. Klik "+ Baru" untuk mulai.</div>`;
      return;
    }

    templatesContainer.innerHTML = `<div class="col-12"><div id="templateList" class="list-group small"></div></div>`;
    const list = document.getElementById("templateList");

    currentTemplates.forEach((tpl) => {
      const rows = tpl.template_manuver_rows || [];
      const pCount = rows.filter((r) => r.section === "pembebasan").length;
      const nCount = rows.filter((r) => r.section === "penormalan").length;

      const item = document.createElement("div");
      item.className = "list-group-item mb-2 rounded-3 template-switching-card";
      item.innerHTML = `
        <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
          <div class="me-sm-3">
            <div class="fw-semibold">${escapeHtml(tpl.nama_template)}</div>
            <div class="small text-muted">
              ${pCount} pembebasan • ${nCount} penormalan${tpl.dibuat_oleh ? ` • oleh ${escapeHtml(tpl.dibuat_oleh)}` : ""}
            </div>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-accent btn-template-switching btn-use-template" data-id="${tpl.id}">
              Gunakan
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-delete-template" data-id="${tpl.id}">
              Hapus
            </button>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  async function loadGiNameMap() {
    try {
      const { data, error } = await window.JurnalAuth.supabaseClient
        .from("gi")
        .select("id, nama");
      if (error) throw error;
      (data || []).forEach((row) => {
        giNameToId[row.nama] = row.id;
      });
    } catch (e) {
      console.warn("Gagal memuat data GI:", e);
    }
  }

  function getStatusFilter() {
    const checked = document.querySelector('input[name="statusFilter"]:checked');
    return checked ? checked.value : "";
  }

  async function fetchHistory(filterGiName, statusFilter) {
    const sb = window.JurnalAuth.supabaseClient;
    let query = sb
      .from("jurnal_manuver")
      .select(
        "id, tanggal, hari, keterangan, teks_final, dibuat_oleh, diubah_oleh, tahap_penormalan, created_at, updated_at, gi(nama)"
      )
      .order("updated_at", { ascending: false });

    if (filterGiName && giNameToId[filterGiName]) {
      query = query.eq("gi_id", giNameToId[filterGiName]);
    }
    if (statusFilter) {
      query = query.eq("tahap_penormalan", statusFilter === "lengkap");
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  function formatTanggalIndo(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatSavedAt(iso) {
    if (!iso) return "";
    const d = new Date(String(iso).replace(/(\.\d{3})\d+/, "$1"));
    if (isNaN(d.getTime())) return "";
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (d.toDateString() === new Date().toDateString()) return `hari ini ${hhmm}`;
    const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][d.getMonth()];
    return `${d.getDate()} ${bln} ${hhmm}`;
  }

  function buildMeta(h) {
    const saved = formatSavedAt(h.updated_at || h.created_at);
    const pembuat = h.dibuat_oleh || "-";
    if (h.diubah_oleh && h.diubah_oleh !== h.dibuat_oleh) {
      return `dibuat ${escapeHtml(pembuat)} · diubah ${escapeHtml(h.diubah_oleh)} ${saved}`;
    }
    return `oleh ${escapeHtml(pembuat)} · disimpan ${saved}`;
  }

  async function renderHistory() {
    if (!historyList) return;

    historyList.innerHTML = `<div class="history-empty">Memuat riwayat...</div>`;

    const filterGi = giFilter ? giFilter.value : "";
    const statusFilter = getStatusFilter();

    try {
      currentEntries = await fetchHistory(filterGi, statusFilter);
    } catch (e) {
      console.warn("Gagal memuat riwayat:", e);
      historyList.innerHTML = `<div class="history-empty text-danger">Gagal memuat riwayat. Cek koneksi internet lalu coba lagi.</div>`;
      return;
    }

    if (!currentEntries.length) {
      const filtered = filterGi || statusFilter;
      historyList.innerHTML = `<div class="history-empty">${filtered ? "Tidak ada jurnal yang cocok dengan filter." : "Belum ada riwayat jurnal."}</div>`;
      return;
    }

    historyList.innerHTML = currentEntries
      .map((h) => {
        const lengkap = !!h.tahap_penormalan;
        const giLabel = h.gi?.nama ? `GI ${escapeHtml(h.gi.nama)}` : "GI -";
        const tanggal = h.tanggal ? formatTanggalIndo(h.tanggal) : "";
        const dateLine = [h.hari, tanggal].filter(Boolean).join(", ");
        const desc = (h.keterangan || "").trim();

        return `
          <article class="history-card ${lengkap ? "is-done" : "is-open"}">
            <div class="history-card-top">
              <span class="history-gi">${giLabel}</span>
              <span class="stage-badge ${lengkap ? "stage-done" : "stage-open"}">${lengkap ? "Lengkap" : "Pembebasan"}</span>
            </div>
            <div class="history-date">${escapeHtml(dateLine)} · #${h.id}</div>
            <div class="history-desc ${desc ? "" : "is-empty"}">${desc ? escapeHtml(desc) : "Tanpa uraian pekerjaan"}</div>
            <div class="history-meta">${buildMeta(h)}</div>
            <div class="history-actions">
              <button type="button" class="btn btn-sm btn-accent btn-continue-history" data-id="${h.id}">Lanjutkan</button>
              <div class="dropdown">
                <button type="button" class="btn btn-sm btn-outline-secondary btn-more" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Aksi lain">⋯</button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><button type="button" class="dropdown-item btn-view-history" data-id="${h.id}">Lihat teks</button></li>
                  <li><button type="button" class="dropdown-item btn-copy-history" data-id="${h.id}">Salin teks</button></li>
                  <li><button type="button" class="dropdown-item btn-base-history" data-id="${h.id}">Jadikan dasar jurnal baru</button></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><button type="button" class="dropdown-item text-danger btn-delete-history" data-id="${h.id}">Hapus</button></li>
                </ul>
              </div>
            </div>
          </article>`;
      })
      .join("");
  }

  function findEntry(id) {
    return currentEntries.find((h) => String(h.id) === String(id));
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("btn-use-template")) {
      goToGenerator(`useTemplateId=${encodeURIComponent(id)}`);
      return;
    }

    if (btn.classList.contains("btn-delete-template")) {
      Swal.fire({
        title: "Hapus template ini?",
        text: "Template ini akan terhapus permanen dari database. Butuh password admin.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Lanjut",
        cancelButtonText: "Batal",
      }).then(async (res) => {
        if (!res.isConfirmed) return;

        const result = await window.JurnalAuth.runAsAdmin(async (adminClient) => {
          const { error } = await adminClient.from("template_manuver").delete().eq("id", id);
          if (error) throw error;
        });

        if (result.cancelled) return;
        if (result.error) {
          toast("error", result.error, "", 2000);
          return;
        }

        await renderTemplateList();
        toast("success", "Template dihapus", "", 1200);
      });
      return;
    }

    if (btn.classList.contains("btn-continue-history")) {
      goToGenerator(`lanjutkan=${encodeURIComponent(id)}`);
      return;
    }

    if (btn.classList.contains("btn-base-history")) {
      goToGenerator(`useHistory=${encodeURIComponent(id)}`);
      return;
    }

    if (btn.classList.contains("btn-copy-history")) {
      const entry = findEntry(id);
      if (entry) copyText(entry.teks_final || "");
      return;
    }

    if (btn.classList.contains("btn-view-history")) {
      const entry = findEntry(id);
      if (!entry) return;

      const titleEl = document.getElementById("historyPreviewTitle");
      const textEl = document.getElementById("historyPreviewText");
      const continueBtn = document.getElementById("historyPreviewContinueBtn");
      titleEl.textContent = `#${entry.id} · ` + (entry.gi?.nama ? `GI ${entry.gi.nama}` : "Detail Jurnal") + (entry.tanggal ? ` · ${formatTanggalIndo(entry.tanggal)}` : "");
      textEl.textContent = entry.teks_final || "";
      if (continueBtn) continueBtn.dataset.id = entry.id;

      bootstrap.Modal.getOrCreateInstance(document.getElementById("historyPreviewModal")).show();
      return;
    }

    if (btn.id === "historyPreviewContinueBtn" && id) {
      goToGenerator(`lanjutkan=${encodeURIComponent(id)}`);
      return;
    }

    if (btn.classList.contains("btn-delete-history")) {
      Swal.fire({
        title: `Hapus jurnal #${id}?`,
        text: "Jurnal ini akan terhapus permanen. Butuh password admin.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Lanjut",
        cancelButtonText: "Batal",
      }).then(async (res) => {
        if (!res.isConfirmed) return;

        const result = await window.JurnalAuth.runAsAdmin(async (adminClient) => {
          const { error } = await adminClient.from("jurnal_manuver").delete().eq("id", id);
          if (error) throw error;
        });

        if (result.cancelled) return;
        if (result.error) {
          toast("error", result.error, "", 2000);
          return;
        }

        await renderHistory();
        toast("success", "Jurnal dihapus", "", 1200);
      });
      return;
    }
  });

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      if (!currentEntries.length) {
        toast("info", "Tidak ada riwayat yang tampil", "", 1400);
        return;
      }

      const filterGi = giFilter ? giFilter.value : "";
      const filtered = filterGi || getStatusFilter();
      const scopeText = filtered
        ? `${currentEntries.length} jurnal yang tampil sesuai filter sekarang akan terhapus permanen dari database, untuk semua orang yang pakai aplikasi ini.`
        : `SEMUA riwayat dari SEMUA GI (${currentEntries.length} jurnal) akan terhapus permanen dari database, untuk semua orang yang pakai aplikasi ini. Ini tidak bisa dibatalkan.`;

      Swal.fire({
        title: "Hapus riwayat ini?",
        text: scopeText + " Butuh password admin.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Lanjut",
        cancelButtonText: "Batal",
        confirmButtonColor: "#dc2626",
      }).then(async (res) => {
        if (!res.isConfirmed) return;

        const ids = currentEntries.map((h) => h.id);

        const result = await window.JurnalAuth.runAsAdmin(async (adminClient) => {
          const { error } = await adminClient.from("jurnal_manuver").delete().in("id", ids);
          if (error) throw error;
        });

        if (result.cancelled) return;

        if (result.error) {
          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "error",
            title: result.error,
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
          });
          return;
        }

        await renderHistory();
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Riwayat dihapus",
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        });
      });
    });
  }

  if (giFilter) {
    giFilter.addEventListener("change", renderHistory);
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  document.querySelectorAll('input[name="statusFilter"]').forEach((el) => {
    el.addEventListener("change", renderHistory);
  });

  const historyPreviewCopyBtn = document.getElementById("historyPreviewCopyBtn");
  if (historyPreviewCopyBtn) {
    historyPreviewCopyBtn.addEventListener("click", () => {
      copyText(document.getElementById("historyPreviewText").textContent || "");
    });
  }

  (async function init() {
    const savedTheme = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(savedTheme);

    await loadGiNameMap();
    await renderTemplateList();
    await renderHistory();
  })();
})();