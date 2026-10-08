(function () {
  const JG = window.JG;
  const $ = (id) => document.getElementById(id);

  function skeleton(n) {
    return Array.from({ length: n }, () => `<div class="j-card is-skeleton"><span></span><span></span><span></span></div>`).join("");
  }

  function emptyBox(text) {
    return `<div class="empty-box">${JG.esc(text)}</div>`;
  }

  function openTextModal(h) {
    $("textModalTitle").textContent = `#${h.id} · ${h.gi?.nama ? `GI ${h.gi.nama}` : "Jurnal"}${h.tanggal ? ` · ${JG.formatTanggalIndo(h.tanggal)}` : ""}`;
    $("textModalBody").textContent = h.teks_final || "";
    $("textModalOpen").dataset.id = h.id;
    bootstrap.Modal.getOrCreateInstance($("textModal")).show();
  }

  async function deleteJurnal(ids, label) {
    const res = await Swal.fire({
      title: `Hapus ${label}?`,
      text: "Terhapus permanen untuk semua pengguna. Butuh password admin.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Lanjut",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (!res.isConfirmed) return false;
    const result = await window.JurnalAuth.runAsAdmin(async (admin) => {
      const { error } = await admin.from("jurnal_manuver").delete().in("id", ids);
      if (error) throw error;
    });
    if (result.cancelled) return false;
    if (result.error) {
      JG.toast("error", result.error, "", 2000);
      return false;
    }
    JG.toast("success", "Jurnal dihapus", "", 1300);
    return true;
  }

  async function cardAction(btn, entries, refresh) {
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const h = entries.find((x) => String(x.id) === String(id));
    if (act === "open") location.hash = `#/jurnal/${id}`;
    else if (act === "penormalan") location.hash = `#/jurnal/${id}?tahap=penormalan`;
    else if (act === "dasar") location.hash = `#/jurnal?dasar=${id}`;
    else if (act === "view" && h) openTextModal(h);
    else if (act === "copy" && h) {
      const ok = await JG.copyText(h.teks_final || "");
      JG.toast(ok ? "success" : "error", ok ? "Tersalin ke clipboard" : "Gagal menyalin", "", 1400);
    } else if (act === "delete") {
      if (await deleteJurnal([id], `jurnal #${id}`)) refresh();
    }
  }

  function bindCards(container, getEntries, refresh) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (btn) cardAction(btn, getEntries(), refresh);
    });
  }

  const home = (function () {
    let openEntries = [];
    let doneEntries = [];
    let bound = false;

    function bind() {
      if (bound) return;
      bound = true;
      bindCards($("homeOpenList"), () => openEntries, render);
      bindCards($("homeDoneList"), () => doneEntries, render);
      $("homeNewBtn").addEventListener("click", newSheet.open);
    }

    function renderDraft() {
      const box = $("homeDraft");
      if (!JG.editor.hasLocalDraft()) {
        box.innerHTML = "";
        return;
      }
      const d = JG.editor.draftInfo();
      box.innerHTML = `
        <a class="draft-card" href="#/jurnal">
          <span class="draft-dot"></span>
          <span class="draft-text">
            <strong>${d.id != null ? `Jurnal #${d.id} · ada perubahan` : "Draft di device ini"}</strong>
            <span>${JG.esc([d.gi ? `GI ${d.gi}` : "", (d.keterangan || "").trim()].filter(Boolean).join(" · ") || "Belum disimpan ke riwayat")}</span>
          </span>
          <span class="draft-go">Lanjutkan →</span>
        </a>`;
    }

    async function render() {
      bind();
      const name = window.JurnalAuth.getCurrentUserName() || "";
      $("homeGreeting").textContent = `${name ? `Halo, ${name}` : "Halo"} · ${JG.hariFromDate(JG.todayIso())}, ${JG.formatTanggalIndo(JG.todayIso())}`;
      renderDraft();
      $("homeOpenList").innerHTML = skeleton(2);
      $("homeDoneList").innerHTML = skeleton(2);
      try {
        [openEntries, doneEntries] = await Promise.all([
          JG.api.listJurnal({ status: "pembebasan", limit: 30 }),
          JG.api.listJurnal({ status: "lengkap", limit: 6 }),
        ]);
      } catch (e) {
        console.warn(e);
        $("homeOpenList").innerHTML = emptyBox("Gagal memuat. Cek koneksi internet, lalu tarik ulang halaman.");
        $("homeDoneList").innerHTML = "";
        return;
      }
      $("homeOpenCount").textContent = openEntries.length ? openEntries.length : "";
      $("homeOpenList").innerHTML = openEntries.length
        ? openEntries.map((h) => JG.jurnalCardHtml(h, { primary: "penormalan" })).join("")
        : emptyBox("Tidak ada jurnal yang menunggu penormalan.");
      $("homeDoneList").innerHTML = doneEntries.length
        ? doneEntries.map((h) => JG.jurnalCardHtml(h)).join("")
        : emptyBox("Belum ada jurnal lengkap.");
    }

    return { render };
  })();

  const newSheet = (function () {
    let el;
    function open() {
      el = el || $("newSheet");
      const wide = window.matchMedia("(min-width: 992px)").matches;
      el.classList.toggle("offcanvas-bottom", !wide);
      el.classList.toggle("offcanvas-end", wide);
      const bs = bootstrap.Offcanvas.getOrCreateInstance(el);
      $("newSheetTemplates").innerHTML = `<div class="text-muted small">Memuat template...</div>`;
      bs.show();
      JG.api
        .listTemplates()
        .then((list) => {
          $("newSheetTemplates").innerHTML = list.length
            ? list
                .map((t) => {
                  const rows = t.template_manuver_rows || [];
                  const pb = rows.filter((r) => r.section === "pembebasan").length;
                  const pn = rows.filter((r) => r.section === "penormalan").length;
                  return `<a class="pick-item" href="#/jurnal?template=${t.id}" data-close-sheet>
                    <strong>${JG.esc(t.nama_template)}</strong>
                    <span>${pb} pembebasan · ${pn} penormalan</span></a>`;
                })
                .join("")
            : `<div class="text-muted small">Belum ada template.</div>`;
        })
        .catch(() => {
          $("newSheetTemplates").innerHTML = `<div class="text-danger small">Gagal memuat template.</div>`;
        });
    }
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-sheet]") && el) bootstrap.Offcanvas.getOrCreateInstance(el).hide();
    });
    return { open };
  })();

  const riwayat = (function () {
    let entries = [];
    let bound = false;
    let timer;

    function filters() {
      const st = document.querySelector('input[name="rwStatus"]:checked');
      return {
        status: st ? st.value : "",
        gi: $("rwGi").value,
        search: $("rwSearch").value.trim(),
      };
    }

    function bind() {
      if (bound) return;
      bound = true;
      $("rwGi").innerHTML = JG.giOptionsHtml("Semua GI");
      $("rwGi").addEventListener("change", render);
      document.querySelectorAll('input[name="rwStatus"]').forEach((r) => r.addEventListener("change", render));
      $("rwSearch").addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(render, 350);
      });
      bindCards($("rwList"), () => entries, render);
      $("rwClearBtn").addEventListener("click", async () => {
        if (!entries.length) {
          JG.toast("info", "Tidak ada jurnal yang tampil", "", 1400);
          return;
        }
        const f = filters();
        const filtered = f.status || f.gi || f.search;
        const label = filtered ? `${entries.length} jurnal sesuai filter` : `SEMUA ${entries.length} jurnal`;
        if (await deleteJurnal(entries.map((h) => h.id), label)) render();
      });
    }

    async function render() {
      bind();
      const f = filters();
      $("rwList").innerHTML = skeleton(3);
      try {
        entries = await JG.api.listJurnal({ ...f, limit: 200 });
      } catch (e) {
        console.warn(e);
        $("rwList").innerHTML = emptyBox("Gagal memuat riwayat. Cek koneksi internet.");
        return;
      }
      $("rwCount").textContent = `${entries.length} jurnal`;
      $("rwList").innerHTML = entries.length
        ? entries.map((h) => JG.jurnalCardHtml(h)).join("")
        : emptyBox(f.status || f.gi || f.search ? "Tidak ada jurnal yang cocok dengan filter." : "Belum ada riwayat jurnal.");
    }

    return { render };
  })();

  const template = (function () {
    let list = [];
    let bound = false;
    let form = null;

    function blankForm() {
      return { nama: "", bay: "", pembebasan: [], penormalan: [] };
    }

    function renderForm() {
      const wrap = $("tplForm");
      wrap.hidden = !form;
      $("tplNewBtn").hidden = !!form;
      if (!form) return;
      JG.renderRowList($("tplPembebasanList"), form.pembebasan, { withTime: false, bay: form.bay, emptyText: "Belum ada baris." });
      JG.renderRowList($("tplPenormalanList"), form.penormalan, { withTime: false, bay: form.bay, emptyText: "Belum ada baris." });
      $("tplAutoBtn").disabled = !form.pembebasan.length;
    }

    function cfg(section, index) {
      const rows = form[section];
      const isNew = index < 0;
      const prev = isNew ? rows[rows.length - 1] : rows[index - 1];
      return {
        title: `${isNew ? "Tambah baris" : "Ubah baris"} ${section} #${isNew ? rows.length + 1 : index + 1}`,
        row: isNew ? { peralatan: "", bay: "", status: prev ? prev.status : section === "pembebasan" ? "#" : "//" } : { ...rows[index] },
        isNew,
        withTime: false,
        defaultBay: form.bay,
        prevTime: "",
        index,
        count: rows.length,
        onSubmit(r, next) {
          if (!form.bay && r.bay) {
            form.bay = r.bay;
            $("tplBay").value = r.bay;
            r.bay = "";
          } else if (r.bay === form.bay) r.bay = "";
          if (isNew) rows.push(r);
          else rows[index] = r;
          renderForm();
          return next ? cfg(section, -1) : null;
        },
        onDelete() {
          rows.splice(index, 1);
          renderForm();
        },
        onMove(dir, current) {
          const j = index + dir;
          if (j < 0 || j >= rows.length) return null;
          rows[index] = current;
          [rows[index], rows[j]] = [rows[j], rows[index]];
          renderForm();
          return cfg(section, j);
        },
      };
    }

    function bind() {
      if (bound) return;
      bound = true;
      $("tplNewBtn").addEventListener("click", () => {
        form = blankForm();
        $("tplNama").value = "";
        $("tplBay").value = "";
        renderForm();
        $("tplNama").focus();
      });
      $("tplCancelBtn").addEventListener("click", () => {
        form = null;
        renderForm();
      });
      $("tplBay").addEventListener("input", (e) => {
        if (form) {
          form.bay = e.target.value.trim().toUpperCase();
          renderForm();
        }
      });
      document.querySelectorAll("[data-tpl-add]").forEach((b) =>
        b.addEventListener("click", () => JG.rowSheet.open(cfg(b.dataset.tplAdd, -1)))
      );
      [["tplPembebasanList", "pembebasan"], ["tplPenormalanList", "penormalan"]].forEach(([id, sec]) => {
        $(id).addEventListener("click", (e) => {
          const li = e.target.closest(".mv-item");
          if (li) JG.rowSheet.open(cfg(sec, parseInt(li.dataset.index, 10)));
        });
      });
      $("tplAutoBtn").addEventListener("click", () => {
        form.penormalan = JG.reverseRows(form.pembebasan);
        renderForm();
      });
      $("tplSaveBtn").addEventListener("click", save);
      $("tplList").addEventListener("click", onListClick);
    }

    async function save() {
      const nama = $("tplNama").value.trim();
      if (!nama) {
        JG.toast("warning", "Nama template belum diisi");
        $("tplNama").focus();
        return;
      }
      if (!form.pembebasan.length && !form.penormalan.length) {
        JG.toast("warning", "Belum ada baris manuver");
        return;
      }
      const eff = (rows) => rows.map((r) => ({ peralatan: r.peralatan, bay: r.bay || form.bay, status: r.status }));
      const btn = $("tplSaveBtn");
      btn.disabled = true;
      try {
        await JG.api.createTemplate(nama, eff(form.pembebasan), eff(form.penormalan));
        form = null;
        renderForm();
        JG.toast("success", "Template disimpan");
        render();
      } catch (e) {
        console.warn(e);
        JG.toast("error", "Gagal menyimpan template", "Cek koneksi internet.", 2200);
      } finally {
        btn.disabled = false;
      }
    }

    async function onListClick(e) {
      const b = e.target.closest("[data-tact]");
      if (!b) return;
      const id = b.dataset.id;
      const t = list.find((x) => String(x.id) === String(id));
      if (b.dataset.tact === "use") location.hash = `#/jurnal?template=${id}`;
      if (b.dataset.tact === "view" && t) {
        const rows = (t.template_manuver_rows || []).slice().sort((a, b2) => a.urutan - b2.urutan);
        const fmt = (r) => `${r.peralatan} ${r.bay ? `BAY ${r.bay}` : ""} ${r.status}`.replace(/\s+/g, " ").trim();
        const pb = rows.filter((r) => r.section === "pembebasan").map(fmt);
        const pn = rows.filter((r) => r.section === "penormalan").map(fmt);
        $("textModalTitle").textContent = t.nama_template;
        $("textModalBody").textContent = `Pembebasan:\n${pb.join("\n") || "-"}\n\nPenormalan:\n${pn.join("\n") || "-"}`;
        $("textModalOpen").dataset.id = "";
        $("textModalOpen").hidden = true;
        bootstrap.Modal.getOrCreateInstance($("textModal")).show();
      }
      if (b.dataset.tact === "delete") {
        const res = await Swal.fire({
          title: "Hapus template ini?",
          text: "Terhapus permanen. Butuh password admin.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Lanjut",
          cancelButtonText: "Batal",
        });
        if (!res.isConfirmed) return;
        const result = await window.JurnalAuth.runAsAdmin(async (admin) => {
          const { error } = await admin.from("template_manuver").delete().eq("id", id);
          if (error) throw error;
        });
        if (result.cancelled) return;
        if (result.error) {
          JG.toast("error", result.error, "", 2000);
          return;
        }
        JG.toast("success", "Template dihapus", "", 1200);
        render();
      }
    }

    async function render() {
      bind();
      renderForm();
      $("tplList").innerHTML = skeleton(2);
      try {
        list = await JG.api.listTemplates();
      } catch (e) {
        $("tplList").innerHTML = emptyBox("Gagal memuat template. Cek koneksi internet.");
        return;
      }
      $("tplList").innerHTML = list.length
        ? list
            .map((t) => {
              const rows = t.template_manuver_rows || [];
              const pb = rows.filter((r) => r.section === "pembebasan").length;
              const pn = rows.filter((r) => r.section === "penormalan").length;
              const bay = JG.inferBay(rows);
              return `
              <article class="j-card">
                <div class="j-desc">${JG.esc(t.nama_template)}</div>
                <div class="j-meta">${pb} pembebasan · ${pn} penormalan${bay ? ` · BAY ${JG.esc(bay)}` : ""}${t.dibuat_oleh ? ` · ${JG.esc(t.dibuat_oleh)}` : ""}</div>
                <div class="j-actions">
                  <button type="button" class="btn btn-sm btn-accent" data-tact="use" data-id="${t.id}">Pakai</button>
                  <div class="dropdown">
                    <button type="button" class="btn btn-sm btn-outline-secondary btn-more" data-bs-toggle="dropdown" aria-label="Aksi lain">⋯</button>
                    <ul class="dropdown-menu dropdown-menu-end">
                      <li><button type="button" class="dropdown-item" data-tact="view" data-id="${t.id}">Lihat isi</button></li>
                      <li><hr class="dropdown-divider"></li>
                      <li><button type="button" class="dropdown-item text-danger" data-tact="delete" data-id="${t.id}">Hapus</button></li>
                    </ul>
                  </div>
                </div>
              </article>`;
            })
            .join("")
        : emptyBox("Belum ada template. Buat dari sini, atau dari menu ⋯ di editor jurnal.");
    }

    return { render };
  })();

  document.addEventListener("DOMContentLoaded", () => {
    $("textModalCopy").addEventListener("click", async () => {
      const ok = await JG.copyText($("textModalBody").textContent || "");
      JG.toast(ok ? "success" : "error", ok ? "Tersalin ke clipboard" : "Gagal menyalin", "", 1400);
    });
    $("textModalOpen").addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id;
      bootstrap.Modal.getOrCreateInstance($("textModal")).hide();
      if (id) location.hash = `#/jurnal/${id}`;
    });
    $("textModal").addEventListener("hidden.bs.modal", () => {
      $("textModalOpen").hidden = false;
    });
  });

  JG.views = { home, riwayat, template, newSheet };
})();
