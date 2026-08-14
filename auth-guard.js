/* ------------------------------------------------------------
   AUTH GUARD
   Include this on every protected page AFTER supabase-config.js.
   It blocks the page until a session is confirmed, then reveals
   it, and wires up the Sign Out button (id="signOutBtn").
------------------------------------------------------------- */

(async function guard() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (error || !session) {
    window.location.replace("login.html");
    return;
  }

  document.documentElement.classList.add("auth-ready");

  const userEmailEl = document.getElementById("userEmail");
  if (userEmailEl) userEmailEl.textContent = session.user.email;

  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.replace("login.html");
    });
  }

  // Re-check on auth state changes (e.g. token expiry / sign out in another tab)
  supabaseClient.auth.onAuthStateChange((event, newSession) => {
    if (event === "SIGNED_OUT" || !newSession) {
      window.location.replace("login.html");
    }
  });

  window.dispatchEvent(new CustomEvent("auth-ready", { detail: { session } }));
})();
