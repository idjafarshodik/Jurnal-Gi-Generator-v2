const SUPABASE_URL = "https://fxxgmrknrtlgznqdugfh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LBhYtlxIJxAclfVJFgIx6w_vG3DzIal";
const AUTH_SHARED_EMAIL = "dev.ultgsampang@gmail.com";
const AUTH_ADMIN_EMAIL = "plnultgsampang@gmail.com";
const AUTH_NAME_KEY = "jurnalUserName";
const AUTH_ACTIVITY_KEY = "jurnalLastActivity";
const AUTH_EXPIRY_DAYS = 3;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

function jurnalGetStoredName() {
  return localStorage.getItem(AUTH_NAME_KEY) || "";
}

function jurnalSetStoredName(name) {
  localStorage.setItem(AUTH_NAME_KEY, name);
}

function jurnalMarkActivity() {
  localStorage.setItem(AUTH_ACTIVITY_KEY, Date.now().toString());
}

function jurnalIsInactiveExpired() {
  const last = parseInt(localStorage.getItem(AUTH_ACTIVITY_KEY) || "0", 10);
  if (!last) return false;
  const elapsedDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return elapsedDays > AUTH_EXPIRY_DAYS;
}

function jurnalShowAuthGate() {
  const overlay = document.getElementById("authGate");
  if (!overlay) return;
  overlay.classList.add("is-visible");
  document.body.classList.add("auth-locked");
  const nameInput = document.getElementById("authName");
  if (nameInput) nameInput.value = jurnalGetStoredName();
  const pwInput = document.getElementById("authPassword");
  if (pwInput) {
    pwInput.value = "";
    setTimeout(() => pwInput.focus(), 50);
  }
}

function jurnalHideAuthGate() {
  const overlay = document.getElementById("authGate");
  if (overlay) overlay.classList.remove("is-visible");
  document.body.classList.remove("auth-locked");
}

async function jurnalCheckSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    jurnalShowAuthGate();
    return;
  }
  if (jurnalIsInactiveExpired()) {
    await supabaseClient.auth.signOut();
    jurnalShowAuthGate();
    return;
  }
  jurnalHideAuthGate();
}

function jurnalGetCurrentUserName() {
  return jurnalGetStoredName();
}

async function jurnalRunAsAdmin(actionFn) {
  const { value: pw } = await Swal.fire({
    title: "Masukkan Password",
    text: "",
    input: "password",
    inputPlaceholder: "",
    showCancelButton: true,
    confirmButtonText: "Lanjut",
    cancelButtonText: "Batal",
    inputValidator: (value) => (!value ? "Password wajib diisi" : undefined),
  });

  if (!pw) return { cancelled: true };

  const adminClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error: signInError } = await adminClient.auth.signInWithPassword({
    email: AUTH_ADMIN_EMAIL,
    password: pw,
  });

  if (signInError) {
    return { error: "Password admin salah." };
  }

  try {
    const data = await actionFn(adminClient);
    return { data };
  } catch (e) {
    return { error: e.message || "Gagal menjalankan aksi admin." };
  } finally {
    await adminClient.auth.signOut();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  jurnalCheckSession();

  const logoutBtn = document.getElementById("authLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      jurnalShowAuthGate();
    });
  }

  const form = document.getElementById("authGateForm");
  const pwInput = document.getElementById("authPassword");
  const toggleBtn = document.getElementById("authTogglePw");
  const eyeIcon = document.getElementById("authEyeIcon");
  const errorEl = document.getElementById("authError");

  if (toggleBtn && pwInput && eyeIcon) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = pwInput.type === "password";
      pwInput.type = isHidden ? "text" : "password";
      eyeIcon.innerHTML = isHidden
        ? '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-6-10-8a17.9 17.9 0 0 1 4.22-5.06M9.9 4.24A10.4 10.4 0 0 1 12 4c6 0 10 6 10 8a17.8 17.8 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><path d="M1 1l22 22"></path>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle>';
      toggleBtn.setAttribute("aria-label", isHidden ? "Sembunyikan password" : "Tampilkan password");
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.textContent = "";

      const nameInput = document.getElementById("authName");
      const name = (nameInput?.value || "").trim();
      const password = pwInput?.value || "";

      if (!name) {
        if (errorEl) errorEl.textContent = "Isi nama dulu.";
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Memeriksa...";

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: AUTH_SHARED_EMAIL,
        password,
      });

      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;

      if (error) {
        if (errorEl) errorEl.textContent = "Password salah. Coba lagi.";
        return;
      }

      jurnalSetStoredName(name);
      jurnalMarkActivity();
      jurnalHideAuthGate();
    });
  }
});

window.JurnalAuth = {
  supabaseClient,
  getCurrentUserName: jurnalGetCurrentUserName,
  markActivity: jurnalMarkActivity,
  runAsAdmin: jurnalRunAsAdmin,
  logout: async () => {
    await supabaseClient.auth.signOut();
    jurnalShowAuthGate();
  },
};