// Usuarios del sistema. Con Supabase: lee "perfiles" y los cambios pasan por la función "admin-usuarios",
// que revisa en el servidor que quien la llama sea administrador. Sin Supabase: lista de prueba en este navegador.
(function () {
  const ROLES = [{ id: "admin", nombre: "Administrador" }, { id: "usuario", nombre: "Usuario" }];

  async function mensajeDeFuncion(error) {
    try { const j = await error.context.json(); if (j && j.error) return j.error; } catch {}
    // La función no está publicada en Supabase (o no hay conexión): el navegador ni siquiera llega a ella.
    if (error.name === "FunctionsFetchError" || /failed to send a request/i.test(error.message || ""))
      return "No se pudo conectar con la función \"admin-usuarios\". Revise que esté publicada en Supabase (Edge Functions) y que haya internet.";
    if (error.name === "FunctionsRelayError" || /not found|404/i.test(error.message || ""))
      return "La función \"admin-usuarios\" no está publicada en Supabase.";
    return error.message;
  }
  function supa(sb) {
    const llamar = async body => {
      const { data, error } = await sb.functions.invoke("admin-usuarios", { body });
      if (error) throw new Error(await mensajeDeFuncion(error));
      return data;
    };
    return {
      async lista() {
        const { data, error } = await sb.from("perfiles").select("id,nombre,correo,rol,activo,creado_en").order("nombre");
        if (error) throw error; return data || [];
      },
      crear: u => llamar({ accion: "crear", ...u }),
      actualizar: (id, cambios) => llamar({ accion: "actualizar", id, ...cambios }),
      clave: (id, clave) => llamar({ accion: "clave", id, clave })
    };
  }
  function demo() {
    const KEY = "redes-cyan:usuarios-demo:v1";
    const leer = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
    const escribir = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} };
    const base = () => leer() || [{ id: "demo-admin", nombre: "Administrador de prueba", correo: "admin@demo", rol: "admin", activo: true, creado_en: new Date().toISOString() }];
    const activosAdmin = l => l.filter(u => u.rol === "admin" && u.activo).length;
    return {
      async lista() { return base().sort((a, b) => a.nombre.localeCompare(b.nombre)); },
      async crear(u) {
        const l = base(), correo = u.correo.trim().toLowerCase();
        if (l.some(x => x.correo === correo)) throw new Error("Ya existe una cuenta con ese correo.");
        const id = "u" + Date.now().toString(36);
        l.push({ id, nombre: u.nombre, correo, rol: u.rol, activo: true, creado_en: new Date().toISOString() });
        escribir(l); return { id };
      },
      async actualizar(id, c) {
        const l = base(), u = l.find(x => x.id === id);
        const pierde = u.rol === "admin" && u.activo && (c.rol === "usuario" || c.activo === false);
        if (pierde && activosAdmin(l) <= 1) throw new Error("Debe quedar al menos un administrador activo.");
        Object.assign(u, c); escribir(l); return { id };
      },
      async clave() { return {}; }
    };
  }
  window.USUARIOS = {
    ROLES,
    init() { Object.assign(window.USUARIOS, window.RC && RC.sb ? supa(RC.sb) : demo()); return window.USUARIOS; }
  };
})();
