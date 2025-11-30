(function () {
  const THEME_KEY = "jurnalGiTheme_v1";
  const HISTORY_KEY = "jurnalGiHistory_v1";
  const SWITCHING_TEMPLATE_KEY = "jurnalGiSwitchingTemplate";
  const HISTORY_SELECTED_KEY = "jurnalGiHistorySelected";

  const themeToggle = document.getElementById("themeToggleHist");
  const themeIcon = document.getElementById("themeIconHist");
  const themeLabel = document.getElementById("themeLabelHist");
  const themeHint = document.getElementById("themeHintHist");

  const templatesContainer = document.getElementById("templatesContainer");
  const historyList = document.getElementById("historyList");
  const giFilter = document.getElementById("giFilter");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  // =============== THEME ===============
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

  // =============== TEMPLATE SWITCHING SAJA ===============
  const switchingTemplates = [
    {
      name: "Template 1 - Pemeliharaan 2 Tahunan Bay Line",
      pembebasan: [
        { waktu: "07:00", peralatan: "PMT 150KV",        bay: "SAMPANG 2", status: "#"  },
        { waktu: "07:00", peralatan: "PMS BUS A 150KV",  bay: "SAMPANG 2", status: "#"  },
        { waktu: "07:00", peralatan: "PMS LINE 150KV",   bay: "SAMPANG 2", status: "#"  },
        { waktu: "07:00", peralatan: "PMS GROUND 150KV", bay: "SAMPANG 2", status: "//" }
      ],
      penormalan: [
        { waktu: "14:00", peralatan: "PMS GROUND 150KV", bay: "SAMPANG 2", status: "#"  },
        { waktu: "14:00", peralatan: "PMS LINE 150KV",   bay: "SAMPANG 2", status: "//" },
        { waktu: "14:00", peralatan: "PMS BUS A 150KV",  bay: "SAMPANG 2", status: "//" },
        { waktu: "14:00", peralatan: "PMT 150KV",        bay: "SAMPANG 2", status: "//" }
      ]
    },
    {
      name: "Template 2 - Pemeliharaan 2 Tahunan Bay Trafo",
      pembebasan: [
        { waktu: "07:00", peralatan: "PMT INC 20KV",     bay: "TRAFO 1", status: "#"        },
        { waktu: "07:00", peralatan: "PMT 150KV",        bay: "TRAFO 1", status: "#"        },
        { waktu: "07:00", peralatan: "PMS BUS A 150KV",  bay: "TRAFO 1", status: "#"        },
        { waktu: "07:00", peralatan: "PMT INC 20KV",     bay: "TRAFO 1", status: "Draw Out" }
      ],
      penormalan: [
        { waktu: "11:00", peralatan: "PMT INC 20KV",     bay: "TRAFO 1", status: "Draw In"  },
        { waktu: "11:00", peralatan: "PMS BUS A 150KV",  bay: "TRAFO 1", status: "//"       },
        { waktu: "11:00", peralatan: "PMT 150KV",        bay: "TRAFO 1", status: "//"       },
        { waktu: "11:00", peralatan: "PMT INC 20KV",     bay: "TRAFO 1", status: "//"       }
      ]
    },

    {
      name: "Template 3 - Pemeliharaan SC",
      pembebasan: [
        { waktu: "07:00", peralatan: "PMT 150KV",        bay: "SC 1", status: "#" },
        { waktu: "07:00", peralatan: "PMS BUS A 150KV",  bay: "SC 1", status: "#" },
        { waktu: "07:00", peralatan: "PMS GROUND 150KV", bay: "SC 1", status: "#" }
      ],
      penormalan: [
        { waktu: "08:00", peralatan: "PMS GROUND 150KV", bay: "SC 1", status: "//" },
        { waktu: "08:00", peralatan: "PMS BUS A 150KV",  bay: "SC 1", status: "//" },
        { waktu: "08:00", peralatan: "PMT 150KV",        bay: "SC 1", status: "//" }
      ]
    }
  ];

  // =============== HISTORY STORAGE ===============
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch (e) {
      console.warn("Gagal baca HISTORY:", e);
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Gagal simpan HISTORY:", e);
    }
  }

  // =============== RENDER TEMPLATE (SWITCHING ONLY) ===============
  function renderTemplates() {
    if (!templatesContainer) return;

    templatesContainer.innerHTML = `
      <div class="col-12">
        <div class="mb-2 fw-semibold small text-uppercase text-muted">
          Template Switching (Pembebasan & Penormalan)
        </div>
        <div id="switchingTemplateList" class="list-group small"></div>
      </div>
    `;

    const switchingList = document.getElementById("switchingTemplateList");

    switchingTemplates.forEach((tpl, idx) => {
      const item = document.createElement("div");
        item.className = "list-group-item mb-2 rounded-3 template-switching-card";

        item.innerHTML = `
          <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
            <div class="me-sm-3">
              <div class="fw-semibold">${tpl.name}</div>
              <div class="small text-muted">
                ${tpl.pembebasan.length} pembebasan • ${tpl.penormalan.length} penormalan
              </div>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-accent btn-template-switching btn-use-switching"
              data-switch-index="${idx}">
              Gunakan Template
            </button>
          </div>
        `;

      switchingList.appendChild(item);
    });
  }

  // =============== RENDER RIWAYAT ===============
  function formatTanggalIndo(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    const tgl = d.getDate();
    const bln = months[d.getMonth()];
    const thn = d.getFullYear();
    return `${tgl} ${bln} ${thn}`;
  }

  function renderHistory() {
    if (!historyList) return;

    const all = loadHistory();
    const filterGi = giFilter ? giFilter.value : "";

    const data = filterGi
      ? all.filter((h) => (h.gi || "").toUpperCase() === filterGi.toUpperCase())
      : all;

    historyList.innerHTML = "";

    if (!data.length) {
      const msg = document.createElement("div");
      msg.className = "text-muted";
      msg.textContent = "Belum ada riwayat jurnal.";
      historyList.appendChild(msg);
      return;
    }

    data
      .slice()
      .sort((a, b) => b.id - a.id)
      .forEach((h) => {
        const item = document.createElement("div");
        item.className = "list-group-item mb-2 rounded-3";

        const giLabel = h.gi || "-";
        const tglLabel = h.tanggal ? formatTanggalIndo(h.tanggal) : (h.hari || "");
        const snippet = (h.text || "").split("\n").slice(0, 5).join("\n");

        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
              <div>
                <span class="badge badge-soft me-1">${giLabel}</span>
                <span class="small text-muted">${tglLabel}</span>
              </div>
              <div class="d-flex gap-1">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-accent btn-view-history"
                  data-id="${h.id}">
                  Lihat
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary btn-use-history"
                  data-id="${h.id}">
                  Gunakan
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger btn-delete-history"
                  data-id="${h.id}">
                  Hapus
                </button>
              </div>
            </div>
            <pre class="small mb-0" style="max-height: 8rem; overflow:auto; white-space: pre-wrap;">${snippet}</pre>
          `;

        historyList.appendChild(item);
      });
  }

  // =============== HANDLER CLICK (delegasi) ===============
  document.addEventListener("click", (e) => {
    const target = e.target;

    // Klik template switching
    if (target.classList.contains("btn-use-switching")) {
      const idx = target.dataset.switchIndex;
      const tpl = switchingTemplates[idx];

      localStorage.setItem(SWITCHING_TEMPLATE_KEY, JSON.stringify(tpl));

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Template switching dikirim ke Generator",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });

      setTimeout(() => {
        window.location.href = "index.html";
      }, 600);
      return;
    }

        // Klik LIHAT dari RIWAYAT
    if (target.classList.contains("btn-view-history")) {
      const id = Number(target.dataset.id);
      const all = loadHistory();
      const entry = all.find((h) => h.id === id);
      if (!entry) return;

      // escape sederhana biar aman di HTML
      const escapeHtml = (str) =>
        (str || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      Swal.fire({
        title: (entry.gi || "Detail Jurnal") + (entry.tanggal ? ` - ${formatTanggalIndo(entry.tanggal)}` : ""),
        html: `<pre style="text-align:left; white-space:pre-wrap; max-height:60vh; overflow:auto;">${escapeHtml(entry.text)}</pre>`,
        width: "90%",
        confirmButtonText: "Tutup"
      });

      return;
    }


    // Klik gunakan dari RIWAYAT
    if (target.classList.contains("btn-use-history")) {
      const id = Number(target.dataset.id);
      const all = loadHistory();
      const entry = all.find((h) => h.id === id);
      if (!entry) return;

      localStorage.setItem(HISTORY_SELECTED_KEY, JSON.stringify(entry));

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Jurnal riwayat dikirim ke Generator",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });

      setTimeout(() => {
        window.location.href = "index.html";
      }, 600);
      return;
    }

    // Klik hapus satu riwayat
    if (target.classList.contains("btn-delete-history")) {
      const id = Number(target.dataset.id);
      Swal.fire({
        title: "Hapus jurnal ini?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, hapus",
        cancelButtonText: "Batal",
      }).then((res) => {
        if (!res.isConfirmed) return;
        const all = loadHistory();
        const filtered = all.filter((h) => h.id !== id);
        saveHistory(filtered);
        renderHistory();
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Riwayat dihapus",
          showConfirmButton: false,
          timer: 1200,
          timerProgressBar: true
        });
      });
      return;
    }
  });

  // =============== CLEAR HISTORY ALL ===============
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      const all = loadHistory();
      if (!all.length) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "info",
          title: "Riwayat sudah kosong",
          showConfirmButton: false,
          timer: 1400,
          timerProgressBar: true
        });
        return;
      }

      Swal.fire({
        title: "Hapus semua riwayat?",
        text: "Semua jurnal tersimpan akan hilang dari perangkat ini.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, hapus semua",
        cancelButtonText: "Batal",
      }).then((res) => {
        if (!res.isConfirmed) return;
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Semua riwayat dihapus",
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        });
      });
    });
  }

  // =============== FILTER GI ===============
  if (giFilter) {
    giFilter.addEventListener("change", renderHistory);
  }

  // =============== THEME BUTTON ===============
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // =============== INIT ===============
  (function init() {
    const savedTheme = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(savedTheme);

    renderTemplates();
    renderHistory();
  })();
})();
