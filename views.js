(function () {
  const JG = window.JG;
  const $ = (id) => document.getElementById(id);

  function skeleton(n) {
    return Array.from({ length: n }, () => `<li class="log-row is-skeleton"><span></span><span></span></li>`).join("");
  }

  function emptyBox(text) {
    return `<div class="empty-box">${JG.esc(text)}</div>`;
  }

  function logGroupsHtml(entries, key, sub) {
    return JG.groupByDay(entries, key)
      .map((g) => {
        const head = sub
          ? `<div class="sec-sub"><h3>${JG.esc(JG.dayLabel(g.date))}</h3></div>`
          : `<div class="sec-head"><h2>${JG.esc(JG.dayLabel(g.date))}</h2></div>`;
        return `${head}<ul class="log">${g.items.map(JG.logRowHtml).join("")}</ul>`;
      })
      .join("");
  }

  let detailEntry = null;

  function openDetail(h) {
    detailEntry = h;
    const gi = h.gi?.nama ? JG.giLabel(h.gi.nama) : "GI belum dipilih";
    $("textModalTitle").textContent = `Jurnal #${h.id}`;
    $("textModalSub").textContent = `${gi}${h.tanggal ? `, ${JG.hariFromDate(h.tanggal)} ${JG.formatTanggalIndo(h.tanggal)}` : ""}`;
    $("textModalBody").textContent = h.teks_final || "";
    $("textModalOpen").textContent = h.tahap_penormalan ? "Buka di editor" : "Normalkan";
    $("textModalJurnalActions").hidden = false;
    bootstrap.Modal.getOrCreateInstance($("textModal")).show();
  }

  async function deleteJurnal(ids, label) {
    const res = await Swal.fire({
      title: `Hapus ${label}?`,
      text: "Terhapus permanen untuk semua pengguna. Butuh password admin.",
      showCancelButton: true,
      confirmButtonText: "Lanjut hapus",
      cancelButtonText: "Batal",
      customClass: { confirmButton: "swal2-danger" },
    });
    if (!res.isConfirmed) return false;
    const result = await window.JurnalAuth.runAsAdmin(async (admin) => {
      const { error } = await admin.from("jurnal_manuver").delete().in("id", ids);
      if (error) throw error;
    });
    if (result.cancelled) return false;
    if (result.error) {
      JG.toast("error", result.error, "", 2200);
      return false;
    }
    JG.toast("success", ids.length > 1 ? `${ids.length} jurnal dihapus` : "Jurnal dihapus", "", 1400);
    return true;
  }

  let refreshCurrent = () => {};

  function bindRows(container, getEntries) {
    const handler = (e) => {
      const el = e.target.closest("[data-act]");
      if (!el || !container.contains(el)) return;
      const id = el.dataset.id;
      const h = getEntries().find((x) => String(x.id) === String(id));
      if (el.dataset.act === "penormalan") location.hash = `#/jurnal/${id}?tahap=penormalan`;
      else if (el.dataset.act === "view" && h) openDetail(h);
    };
    container.addEventListener("click", handler);
    container.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".log-row")) {
        e.preventDefault();
        handler(e);
      }
    });
  }

  const home = (function () {
    let liveEntries = [];
    let doneEntries = [];
    let bound = false;

    function bind() {
      if (bound) return;
      bound = true;
      const all = () => [...liveEntries, ...doneEntries];
      bindRows($("homeLive"), all);
      bindRows($("homeLiveOther"), all);
      bindRows($("homeDone"), all);
      $("homeNewBtn").addEventListener("click", newSheet.open);
    }

    function renderDraft() {
      const box = $("homeDraft");
      if (!JG.editor.hasLocalDraft()) {
        box.innerHTML = "";
        return;
      }
      const d = JG.editor.draftInfo();
      const desc = [d.gi ? JG.giLabel(d.gi) : "", (d.keterangan || "").replace(/\*/g, "").trim()].filter(Boolean).join(", ");
      box.innerHTML = `
        <a class="draft" href="#/jurnal">
          <span class="draft-dot" aria-hidden="true"></span>
          <span class="draft-text">
            <strong>${d.id != null ? `Jurnal #${d.id} punya perubahan belum disimpan` : "Ada draft belum disimpan di HP ini"}</strong>
            <span>${JG.esc(desc || "Belum ada isian identitas")}</span>
          </span>
          <span class="draft-go">Lanjutkan</span>
        </a>`;
    }

    async function render() {
      bind();
      refreshCurrent = render;
      const mine = JG.getMine();
      renderDraft();
      $("homeLive").innerHTML = `<div class="live is-skeleton"></div>`;
      $("homeDone").innerHTML = `<ul class="log">${skeleton(3)}</ul>`;
      $("homeLiveOtherWrap").hidden = true;
      try {
        [liveEntries, doneEntries] = await Promise.all([
          JG.api.listJurnal({ status: "pembebasan", limit: 40 }),
          JG.api.listJurnal({ status: "lengkap", gi: mine, limit: 10 }),
        ]);
      } catch (e) {
        console.warn(e);
        $("homeLive").innerHTML = emptyBox("Gagal memuat data. Periksa koneksi internet, lalu buka ulang halaman ini.");
        $("homeDone").innerHTML = "";
        return;
      }

      const isMine = (h) => !mine || h.gi?.nama === mine;
      const own = liveEntries.filter(isMine);
      const other = liveEntries.filter((h) => !isMine(h));

      $("homeLiveTitle").textContent = mine ? `Sedang bebas tegangan di ${JG.giLabel(mine)}` : "Sedang bebas tegangan";
      $("homeLiveCount").textContent = own.length ? String(own.length) : "";
      $("homeLive").innerHTML = own.length
        ? own.map(JG.liveCardHtml).join("")
        : emptyBox(mine ? `Tidak ada bay yang sedang bebas tegangan di ${JG.giLabel(mine)}.` : "Tidak ada bay yang sedang bebas tegangan.");

      $("homeLiveOtherWrap").hidden = !other.length;
      $("homeLiveOtherCount").textContent = String(other.length);
      $("homeLiveOther").innerHTML = other.length ? `<ul class="log">${other.map(JG.logRowHtml).join("")}</ul>` : "";

      $("homeDoneTitle").textContent = mine ? `Selesai di ${JG.giLabel(mine)}` : "Baru selesai";
      $("homeDone").innerHTML = doneEntries.length ? logGroupsHtml(doneEntries, "updated", true) : emptyBox("Belum ada jurnal yang selesai.");
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
      $("newSheetTemplates").innerHTML = `<div class="muted small">Memuat template…</div>`;
      bootstrap.Offcanvas.getOrCreateInstance(el).show();
      JG.api
        .listTemplates()
        .then((list) => {
          $("newSheetTemplates").innerHTML = list.length
            ? list
                .map((t) => {
                  const rows = t.template_manuver_rows || [];
                  const pb = rows.filter((r) => r.section === "pembebasan").length;
                  const pn = rows.filter((r) => r.section === "penormalan").length;
                  return `<a class="pick" href="#/jurnal?template=${t.id}" data-close-sheet><strong>${JG.esc(t.nama_template)}</strong><span>${pb} manuver pembebasan, ${pn} penormalan</span></a>`;
                })
                .join("")
            : `<div class="muted small">Belum ada template. Template dibuat dari menu Template atau dari editor jurnal.</div>`;
        })
        .catch(() => {
          $("newSheetTemplates").innerHTML = `<div class="warn small">Gagal memuat template. Periksa koneksi internet.</div>`;
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
      return { status: st ? st.value : "", gi: $("rwGi").value, search: $("rwSearch").value.trim() };
    }

    function bind() {
      if (bound) return;
      bound = true;
      $("rwGi").innerHTML = JG.giOptionsHtml("Semua GI");
      $("rwGi").value = JG.getMine();
      $("rwGi").addEventListener("change", render);
      document.querySelectorAll('input[name="rwStatus"]').forEach((r) => r.addEventListener("change", render));
      $("rwSearch").addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(render, 350);
      });
      bindRows($("rwList"), () => entries);
      $("rwClearBtn").addEventListener("click", async () => {
        if (!entries.length) {
          JG.toast("info", "Tidak ada jurnal yang tampil", "", 1400);
          return;
        }
        const f = filters();
        const label = f.status || f.gi || f.search ? `${entries.length} jurnal sesuai filter` : `semua ${entries.length} jurnal`;
        if (await deleteJurnal(entries.map((h) => h.id), label)) render();
      });
    }

    async function render() {
      bind();
      refreshCurrent = render;
      const f = filters();
      $("rwList").innerHTML = `<ul class="log">${skeleton(5)}</ul>`;
      try {
        entries = await JG.api.listJurnal({ ...f, limit: 200 });
      } catch (e) {
        console.warn(e);
        $("rwList").innerHTML = emptyBox("Gagal memuat riwayat. Periksa koneksi internet.");
        return;
      }
      $("rwCount").textContent = entries.length ? `${entries.length} jurnal` : "";
      $("rwList").innerHTML = entries.length
        ? logGroupsHtml(entries, "tanggal")
        : emptyBox(f.status || f.gi || f.search ? "Tidak ada jurnal yang cocok dengan filter ini." : "Belum ada jurnal tersimpan.");
    }

    return { render };
  })();

  const template = (function () {
    let list = [];
    let bound = false;
    let form = null;

    function renderForm() {
      $("tplForm").hidden = !form;
      $("tplNewBtn").hidden = !!form;
      if (!form) return;
      JG.renderRowList($("tplPembebasanList"), form.pembebasan, { withTime: false, bay: form.bay, emptyText: "Belum ada manuver." });
      JG.renderRowList($("tplPenormalanList"), form.penormalan, { withTime: false, bay: form.bay, emptyText: "Belum ada manuver." });
      $("tplAutoBtn").disabled = !form.pembebasan.length;
    }

    function cfg(section, index) {
      const rows = form[section];
      const isNew = index < 0;
      const prev = isNew ? rows[rows.length - 1] : rows[index - 1];
      const label = section === "pembebasan" ? "Pembebasan" : "Penormalan";
      return {
        title: isNew ? `${label} #${rows.length + 1}` : `${label} #${index + 1}`,
        row: isNew
          ? { peralatan: JG.nextPeralatan(section, rows[rows.length - 1]), bay: "", status: prev ? prev.status : section === "pembebasan" ? "#" : "//" }
          : { ...rows[index] },
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
          rows[index] = { ...current, bay: current.bay === form.bay ? "" : current.bay };
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
        form = { bay: "", pembebasan: [], penormalan: [] };
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
        if (!form) return;
        form.bay = JG.normEquipment(e.target.value);
        renderForm();
      });
      document.querySelectorAll("[data-tpl-add]").forEach((b) => b.addEventListener("click", () => JG.rowSheet.open(cfg(b.dataset.tplAdd, -1))));
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
        JG.toast("warning", "Belum ada manuver di template");
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
        JG.toast("error", "Gagal menyimpan template", "Periksa koneksi internet.", 2200);
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
        const rows = (t.template_manuver_rows || []).slice().sort((a, c) => a.urutan - c.urutan);
        const fmt = (r) => `${r.peralatan} ${r.bay ? `BAY ${r.bay}` : ""} ${r.status}`.replace(/\s+/g, " ").trim();
        $("textModalTitle").textContent = t.nama_template;
        $("textModalSub").textContent = t.dibuat_oleh ? `Dibuat oleh ${t.dibuat_oleh}` : "Template manuver";
        $("textModalBody").textContent = `Pembebasan:\n${rows.filter((r) => r.section === "pembebasan").map(fmt).join("\n") || "-"}\n\nPenormalan:\n${rows.filter((r) => r.section === "penormalan").map(fmt).join("\n") || "-"}`;
        $("textModalJurnalActions").hidden = true;
        detailEntry = null;
        bootstrap.Modal.getOrCreateInstance($("textModal")).show();
      }
      if (b.dataset.tact === "delete") {
        const res = await Swal.fire({
          title: "Hapus template ini?",
          text: "Terhapus permanen untuk semua pengguna. Butuh password admin.",
          showCancelButton: true,
          confirmButtonText: "Lanjut hapus",
          cancelButtonText: "Batal",
          customClass: { confirmButton: "swal2-danger" },
        });
        if (!res.isConfirmed) return;
        const result = await window.JurnalAuth.runAsAdmin(async (admin) => {
          const { error } = await admin.from("template_manuver").delete().eq("id", id);
          if (error) throw error;
        });
        if (result.cancelled) return;
        if (result.error) {
          JG.toast("error", result.error, "", 2200);
          return;
        }
        JG.toast("success", "Template dihapus", "", 1300);
        render();
      }
    }

    async function render() {
      bind();
      refreshCurrent = render;
      renderForm();
      $("tplList").innerHTML = `<ul class="log">${skeleton(3)}</ul>`;
      try {
        list = await JG.api.listTemplates();
      } catch (e) {
        $("tplList").innerHTML = emptyBox("Gagal memuat template. Periksa koneksi internet.");
        return;
      }
      $("tplList").innerHTML = list.length
        ? `<ul class="log">${list
            .map((t) => {
              const rows = t.template_manuver_rows || [];
              const pb = rows.filter((r) => r.section === "pembebasan").length;
              const pn = rows.filter((r) => r.section === "penormalan").length;
              const bay = JG.bayLine(rows);
              return `
              <li class="log-row tpl-row">
                <div class="log-main">
                  <div class="log-t1">${JG.esc(t.nama_template)}</div>
                  <div class="log-t2">${pb} pembebasan, ${pn} penormalan${bay ? `. ${JG.esc(bay)}` : ""}</div>
                </div>
                <div class="tpl-actions">
                  <button type="button" class="btn btn-sm" data-tact="use" data-id="${t.id}">Pakai</button>
                  <div class="dropdown">
                    <button type="button" class="btn btn-sm icon-sq" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Aksi lain untuk ${JG.esc(t.nama_template)}">⋯</button>
                    <ul class="dropdown-menu dropdown-menu-end">
                      <li><button type="button" class="dropdown-item" data-tact="view" data-id="${t.id}">Lihat isi</button></li>
                      <li><hr class="dropdown-divider"></li>
                      <li><button type="button" class="dropdown-item is-danger" data-tact="delete" data-id="${t.id}">Hapus</button></li>
                    </ul>
                  </div>
                </div>
              </li>`;
            })
            .join("")}</ul>`
        : emptyBox("Belum ada template. Buat dari sini, atau dari menu di editor jurnal.");
    }

    return { render };
  })();

  document.addEventListener("DOMContentLoaded", () => {
    $("textModalCopy").addEventListener("click", async () => {
      const ok = await JG.copyText($("textModalBody").textContent || "");
      JG.toast(ok ? "success" : "error", ok ? "Teks disalin" : "Gagal menyalin", "", 1400);
    });
    const go = (hash) => {
      bootstrap.Modal.getOrCreateInstance($("textModal")).hide();
      location.hash = hash;
    };
    $("textModalOpen").addEventListener("click", () => {
      if (!detailEntry) return;
      go(detailEntry.tahap_penormalan ? `#/jurnal/${detailEntry.id}` : `#/jurnal/${detailEntry.id}?tahap=penormalan`);
    });
    $("textModalDasar").addEventListener("click", () => {
      if (detailEntry) go(`#/jurnal?dasar=${detailEntry.id}`);
    });
    $("textModalDelete").addEventListener("click", async () => {
      if (!detailEntry) return;
      const h = detailEntry;
      bootstrap.Modal.getOrCreateInstance($("textModal")).hide();
      if (await deleteJurnal([h.id], `jurnal #${h.id}`)) refreshCurrent();
    });
  });

  JG.views = { home, riwayat, template, newSheet };
})();
