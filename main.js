(function () {
  const JG = window.JG;
  const VIEWS = ["home", "editor", "riwayat", "template"];

  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return { parts, params: new URLSearchParams(qs || "") };
  }

  function show(view) {
    VIEWS.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.hidden = v !== view;
    });
    document.body.dataset.route = view;
    const navKey = view === "editor" ? "home" : view;
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const on = a.dataset.nav === navKey;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
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
  }

  document.addEventListener("DOMContentLoaded", async () => {
    let theme = "light";
    try {
      theme = localStorage.getItem(JG.THEME_KEY) || "light";
    } catch (e) {}
    JG.applyTheme(theme);

    document.getElementById("themeToggle").addEventListener("click", JG.toggleTheme);
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
