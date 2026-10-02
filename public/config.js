// =============================================================================
// Configuración compartida de Redes Cyan
// La URL y la clave pública de Supabase NO se escriben aquí: vienen de las variables de entorno
// (archivo .env en su computadora o "Environment Variables" en Vercel). Al compilar, el script
// scripts/generar-env.mjs las escribe en env.js, que no se sube a GitHub.
// =============================================================================
const ENV = window.ENV || {};
const SUPABASE_URL = String(ENV.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(ENV.SUPABASE_ANON_KEY || "").trim();   // clave "anon" o "publishable", nunca la service_role

(function () {
  const configured = /^https:\/\/\S+$/.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;
  const sb = configured && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  const RC = {
    configured,
    sb,
    // Sin Supabase configurado, todo funciona en "modo demostración": los datos quedan solo en este navegador.
    demo: !sb,
    user: null,
    perfil: null,      // {nombre, rol: "admin" | "usuario", activo}
    esAdmin: false,

    async requireSession() {
      if (!sb) {
        // En modo demostración se puede ver el sistema como administrador o como usuario normal.
        let rol = "admin";
        try { rol = localStorage.getItem("redes-cyan:demo-rol") === "usuario" ? "usuario" : "admin"; } catch {}
        RC.user = { email: "Modo demostración" };
        RC.perfil = { nombre: "", rol, activo: true };
        RC.esAdmin = rol === "admin";
        return RC.user;
      }
      const { data } = await sb.auth.getSession();
      if (!data || !data.session) { location.replace("login.html"); return new Promise(() => {}); }
      RC.user = data.session.user;
      sb.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") location.replace("login.html"); });
      const { data: perfil } = await sb.from("perfiles").select("nombre, rol, activo").eq("id", RC.user.id).maybeSingle();
      RC.perfil = perfil || { nombre: "", rol: "usuario", activo: true };
      if (!RC.perfil.activo) { await sb.auth.signOut(); location.replace("login.html?inactivo=1"); return new Promise(() => {}); }
      RC.esAdmin = RC.perfil.rol === "admin";
      return RC.user;
    },

    // Para páginas solo de administradores: quien no lo es vuelve al inicio sin ver nada.
    async requireAdmin() {
      await RC.requireSession();
      if (!RC.esAdmin) { location.replace("inicio.html"); return new Promise(() => {}); }
      return RC.user;
    },

    async signOut() {
      if (sb) await sb.auth.signOut();
      location.replace(sb ? "login.html" : "inicio.html");
    },

    // Barra superior común: bandera, menú y usuario.
    header(active) {
      const bar = document.createElement("header");
      bar.className = "rc-bar";
      const link = (href, key, label) =>
        `<a href="${href}" class="${active === key ? "on" : ""}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
      bar.innerHTML = `
        <a class="rc-brand" href="inicio.html"><img src="logo.png" alt="" onerror="this.remove()"><span>Redes Cyan<small>Ciudad Delgado</small></span></a>
        <nav class="rc-nav" aria-label="Menú principal">${link("inicio.html", "inicio", "Inicio")}${link("index.html", "redes", "Redes")}${link("actividades.html", "actividades", "Actividades")}${RC.esAdmin ? link("usuarios.html", "usuarios", "Usuarios") : ""}</nav>
        <div class="rc-user"><span class="rc-mail"></span><button type="button" class="rc-out">Salir</button></div>`;
      bar.querySelector(".rc-mail").textContent = ((RC.perfil && RC.perfil.nombre) || (RC.user && RC.user.email) || "") + (RC.esAdmin ? " · Admin" : "");
      bar.querySelector(".rc-out").addEventListener("click", RC.signOut);
      document.body.prepend(bar);
      if (RC.demo) {
        const d = document.createElement("div");
        d.className = "rc-demo";
        d.innerHTML = `<span>Modo demostración: faltan las variables de Supabase (.env o Vercel). Lo que guardes queda solo en este navegador.</span>
          <label>Ver como <select aria-label="Ver como"><option value="admin">Administrador</option><option value="usuario">Usuario normal</option></select></label>`;
        const sel = d.querySelector("select");
        sel.value = RC.esAdmin ? "admin" : "usuario";
        sel.addEventListener("change", () => { try { localStorage.setItem("redes-cyan:demo-rol", sel.value); } catch {} location.reload(); });
        bar.after(d);
      }
      return bar;
    }
  };

  // Estilos de la barra (se inyectan para no repetirlos en cada página).
  const css = `
  .rc-bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:1000;display:flex;align-items:center;gap:12px 18px;flex-wrap:wrap;
    padding:10px 16px;background:linear-gradient(90deg,#00adef,#0084b8);color:#fff;font-family:"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif;
    box-shadow:0 2px 12px rgba(0,58,82,.25)}
  .rc-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none}
  .rc-brand img{height:30px;aspect-ratio:3/2;object-fit:cover;border-radius:4px;box-shadow:0 0 0 2px #fff}
  .rc-brand span{font:800 1rem/1 "Bricolage Grotesque","Arial Black",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.01em}
  .rc-brand small{display:block;font:600 .62rem "Plus Jakarta Sans",system-ui,sans-serif;letter-spacing:.16em;opacity:.9;margin-top:3px}
  .rc-nav{display:flex;gap:4px;flex:1;flex-wrap:wrap}
  .rc-nav a{color:#fff;text-decoration:none;font-weight:700;font-size:.9rem;padding:7px 12px;border-radius:999px}
  .rc-nav a:hover{background:rgba(255,255,255,.16)}
  .rc-nav a.on{background:#fff;color:#0084b8}
  .rc-user{display:flex;align-items:center;gap:10px;font-size:.8rem}
  .rc-mail{opacity:.9;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rc-out{font:700 .8rem "Plus Jakarta Sans",system-ui,sans-serif;color:#fff;background:rgba(7,31,46,.3);border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:6px 12px;cursor:pointer}
  .rc-bar a:focus-visible,.rc-out:focus-visible{outline:3px solid #c8f560;outline-offset:2px}
  .rc-demo{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:space-between;background:#fff7db;color:#6b4e00;border-bottom:1px solid #e0b400;padding:8px 16px;font:500 .82rem "Plus Jakarta Sans",system-ui,sans-serif}
  .rc-demo select{width:auto;font:600 .8rem "Plus Jakarta Sans",system-ui,sans-serif;margin-left:6px;padding:3px 6px;border-radius:8px;border:1px solid #e0b400;background:#fff;color:#6b4e00}
  @media (max-width:600px){.rc-mail{display:none}.rc-nav{order:3;flex-basis:100%}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  window.RC = RC;
})();
