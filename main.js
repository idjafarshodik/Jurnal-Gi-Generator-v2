(function () {
  const JG = window.JG;
  const VIEWS = ["home", "editor", "riwayat", "template"];
  let currentView = "home";

  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return { parts, params: new URLSearchParams(qs || "") };
  }

  function show(view) {
    currentView = view;
    VIEWS.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.hidden = v !== view;
    });
    document.body.dataset.route = view;
    const navKey = view === "editor" ? "home" : view;
    document.querySelectorAll("[data-nav]").forEach((a) => {
      if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  async function route() {
    const { parts, params } = parseHash();
    const name = parts[0] || "home";
    if (name === "jurnal") {
      show("editor");
      await JG.editor.open(parts[1] || null, params);
    } else if (name === "riwayat") {
      show("riwayat");
      JG.views.riwayat.render();
    } else if (name === "template") {
      show("template");
      JG.views.template.render();
    } else {
      show("home");
      JG.views.home.render();
    }
  }

  function renderProfile() {
    const name = window.JurnalAuth.getCurrentUserName() || "";
    document.getElementById("profileName").textContent = name || "Operator";
    document.getElementById("avatarInitial").textContent = (name.trim()[0] || "?").toUpperCase();
    const mine = JG.getMine();
    document.getElementById("mineLabel").textContent = mine ? JG.giLabel(mine) : "Semua GI";
  }

  async function pickMine() {
    const options = { "": "Semua GI" };
    JG.GI_LIST.forEach(([v, l]) => {
      options[v] = l;
    });
    const { value, isConfirmed } = await Swal.fire({
      title: "GI saya",
      input: "select",
      inputOptions: options,
      inputValue: JG.getMine(),
      inputLabel: "Beranda menampilkan GI ini lebih dulu, dan jurnal baru otomatis memakai GI ini. Pengaturan ini hanya berlaku di HP ini.",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    });
    if (!isConfirmed) return;
    JG.setMine(value || "");
    renderProfile();
    JG.toast("success", value ? `GI saya: ${JG.giLabel(value)}` : "Menampilkan semua GI", "", 1500);
    if (currentView === "home") JG.views.home.render();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    let theme = "light";
    try {
      theme = localStorage.getItem(JG.THEME_KEY) || "light";
    } catch (e) {}
    JG.applyTheme(theme);

    document.getElementById("themeToggle").addEventListener("click", JG.toggleTheme);
    document.getElementById("mineBtn").addEventListener("click", pickMine);
    window.addEventListener("hashchange", route);
    document.addEventListener("jurnal:login", () => {
      renderProfile();
      route();
    });

    await window.JurnalAuth.ready;
    renderProfile();
    route();

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  });
})();
