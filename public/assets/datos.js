// Acceso a datos de Redes Cyan.
// Con Supabase configurado usa la base de datos; si no, guarda en este navegador (modo demostración).
(function () {
  const TIPOS = [
    { id: 1, nombre: "Jornada de limpieza", color: "#16a34a",
      icon: '<path d="M15 3l-4.5 9"/><path d="M6.5 21l2.5-9h7l2.5 9"/><path d="M9.5 21v-3M12.5 21v-4M15.5 21v-3"/>' },
    { id: 2, nombre: "Fiesta infantil", color: "#db2777",
      icon: '<ellipse cx="12" cy="9" rx="5" ry="6"/><path d="M12 15l-1.2 2h2.4z"/><path d="M12 17c0 2-2 2-2 4"/>' },
    { id: 3, nombre: "Fiesta navideña", color: "#dc2626",
      icon: '<path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><path d="M12 16v5"/>' },
    { id: 4, nombre: "Bacheo", color: "#d97706",
      icon: '<path d="M10 4h4l4 14H6z"/><path d="M8.6 9.5h6.8M7.4 14h9.2"/><path d="M4 20h16"/>' },
    { id: 5, nombre: "Cine comunitario", color: "#7c3aed",
      icon: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9l2-5h14l-2 5"/><path d="M9 4l-2 5M14 4l-2 5"/>' },
    { id: 6, nombre: "Reparación de estructuras de parques", color: "#0d9488",
      icon: '<path d="M4 20V7M20 20V7"/><path d="M3 7l9-3 9 3"/><path d="M9 7v8M15 7v8"/><path d="M7.5 15h3M13.5 15h3"/>' }
  ];
  const CATEGORIAS = [
    { id: "fotografia", nombre: "Fotografía" },
    { id: "acta", nombre: "Acta" },
    { id: "asistencia", nombre: "Lista de asistencia" },
    { id: "informe", nombre: "Informe" },
    { id: "otro", nombre: "Otro" }
  ];
  const ESTADOS = [
    { id: "programada", nombre: "Programada" },
    { id: "realizada", nombre: "Realizada" },
    { id: "cancelada", nombre: "Cancelada" }
  ];
  const BUCKET = "documentos-actividades";
  const MAX_MB = 20;

  const tipoPorId = id => TIPOS.find(t => t.id === +id);
  const tipoPorNombre = n => TIPOS.find(t => t.nombre === n);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const nombreSeguro = n => String(n).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-80);
  const ubicar = (lat, lng) => (window.MAPA ? MAPA.locate(lat, lng) : { zona: null, canton: null });

  // ---------------------------------------------------------------- Supabase
  function supa(sb) {
    const fail = e => { if (e) throw e; };
    return {
      async redes() {
        const { data, error } = await sb.from("v_redes").select("id,nombre,zona,integrantes,latitud,longitud,centro_votacion,lema").order("nombre");
        fail(error); return data || [];
      },
      async centros() {
        const { data, error } = await sb.from("v_centros").select("*").order("id");
        fail(error); return data || [];
      },
      async actividades() {
        const { data, error } = await sb.from("v_actividades").select("*").order("fecha", { ascending: false });
        fail(error); return data || [];
      },
      async guardarActividad(a) {
        const fila = {
          tipo_id: a.tipo_id, titulo: a.titulo, fecha: a.fecha, hora: a.hora || null, estado: a.estado,
          red_id: a.red_id || null, lugar: a.lugar || null, descripcion: a.descripcion || null,
          participantes: a.participantes ?? null, beneficiarios: a.beneficiarios ?? null,
          latitud: a.latitud, longitud: a.longitud
        };
        if (a.id) {
          const { error } = await sb.from("actividades").update(fila).eq("id", a.id); fail(error); return a.id;
        }
        const { data, error } = await sb.from("actividades").insert(fila).select("id").single();
        fail(error); return data.id;
      },
      async borrarActividad(id) {
        const docs = await this.documentos(id);
        if (docs.length) await sb.storage.from(BUCKET).remove(docs.map(d => d.archivo_path));
        const { error } = await sb.from("actividades").delete().eq("id", id); fail(error);
      },
      async documentos(actId) {
        const { data, error } = await sb.from("actividad_documentos").select("*").eq("actividad_id", actId).order("subido_en");
        fail(error); return data || [];
      },
      async subirDocumento(actId, file, meta) {
        const path = `${actId}/${uid()}-${nombreSeguro(file.name)}`;
        const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
        fail(up.error);
        const { error } = await sb.from("actividad_documentos").insert({
          actividad_id: actId, categoria: meta.categoria, descripcion: meta.descripcion || null,
          archivo_path: path, nombre_archivo: file.name, tipo_mime: file.type || null, tamano_bytes: file.size
        });
        if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
      },
      async urlDocumento(doc) {
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(doc.archivo_path, 3600);
        fail(error); return data.signedUrl;
      },
      async borrarDocumento(doc) {
        const { error } = await sb.from("actividad_documentos").delete().eq("id", doc.id); fail(error);
        await sb.storage.from(BUCKET).remove([doc.archivo_path]);
      }
    };
  }

  // ---------------------------------------------------- Modo demostración
  function demo() {
    const KEY = "redes-cyan:actividades:v1";
    const leer = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
    const escribir = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { throw new Error("No hay espacio en este navegador."); } };
    let dbp = null;
    const idb = () => dbp || (dbp = new Promise((ok, ko) => {
      const r = indexedDB.open("redes-cyan-docs", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    }));
    const tx = async (mode, fn) => {
      const db = await idb();
      return new Promise((ok, ko) => {
        const t = db.transaction("files", mode), s = t.objectStore("files"), req = fn(s);
        t.oncomplete = () => ok(req && req.result); t.onerror = () => ko(t.error);
      });
    };
    const vista = a => {
      const t = tipoPorId(a.tipo_id) || {};
      const red = demoRedes().find(r => r.id === a.red_id);
      const loc = ubicar(a.latitud, a.longitud);
      return { ...a, tipo: t.nombre, red: red ? red.nombre : null, zona: loc.zona, canton: loc.canton, documentos: (a.docs || []).length };
    };
    function demoRedes() {
      try {
        return JSON.parse(localStorage.getItem("redes-cyan:v1") || "[]")
          .map(r => ({ id: r.id, nombre: r.red || r.nombre, zona: r.zona, integrantes: (r.integrantes || []).length,
            latitud: +r.lat, longitud: +r.lng, centro_votacion: r.centro || "", lema: r.lema || "" }));
      } catch { return []; }
    }
    return {
      async redes() { return demoRedes().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))); },
      async centros() {
        const redes = demoRedes(), norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
        return (window.CENTROS || []).map(c => {
          const loc = ubicar(c.lat, c.lng), rs = redes.filter(r => norm(r.centro_votacion) === norm(c.nombre));
          return { id: c.id, nombre: c.nombre, latitud: c.lat, longitud: c.lng, zona: loc.zona, canton: loc.canton,
            redes: rs.length, personas: rs.reduce((s, r) => s + r.integrantes + 1, 0) };
        });
      },
      async actividades() { return leer().map(vista).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))); },
      async guardarActividad(a) {
        const l = leer(), now = new Date().toISOString();
        if (a.id) { const i = l.findIndex(x => x.id === a.id); l[i] = { ...l[i], ...a, actualizado_en: now }; }
        else { a = { ...a, id: uid(), docs: [], creado_en: now, actualizado_en: now }; l.push(a); }
        escribir(l); return a.id;
      },
      async borrarActividad(id) {
        const l = leer(), a = l.find(x => x.id === id);
        for (const d of (a && a.docs) || []) await tx("readwrite", s => s.delete(d.archivo_path));
        escribir(l.filter(x => x.id !== id));
      },
      async documentos(actId) { const a = leer().find(x => x.id === actId); return (a && a.docs) || []; },
      async subirDocumento(actId, file, meta) {
        const path = `${actId}/${uid()}-${nombreSeguro(file.name)}`;
        await tx("readwrite", s => s.put(file, path));
        const l = leer(), a = l.find(x => x.id === actId);
        a.docs = a.docs || [];
        a.docs.push({ id: uid(), actividad_id: actId, categoria: meta.categoria, descripcion: meta.descripcion || null,
          archivo_path: path, nombre_archivo: file.name, tipo_mime: file.type || null, tamano_bytes: file.size, subido_en: new Date().toISOString() });
        escribir(l);
      },
      async urlDocumento(doc) {
        const blob = await tx("readonly", s => s.get(doc.archivo_path));
        if (!blob) throw new Error("El archivo ya no está en este navegador.");
        return URL.createObjectURL(blob);
      },
      async borrarDocumento(doc) {
        await tx("readwrite", s => s.delete(doc.archivo_path));
        const l = leer(), a = l.find(x => x.id === doc.actividad_id);
        a.docs = (a.docs || []).filter(d => d.id !== doc.id); escribir(l);
      }
    };
  }

  window.DATOS = {
    TIPOS, CATEGORIAS, ESTADOS, MAX_MB, tipoPorId, tipoPorNombre,
    init() { const api = window.RC && RC.sb ? supa(RC.sb) : demo(); Object.assign(window.DATOS, api); return window.DATOS; },
    // Mensaje claro para errores de Supabase o del navegador.
    errorText(e) {
      const m = String((e && (e.message || e.error_description)) || e || "");
      if (/payload too large|exceeded the maximum allowed size|file size/i.test(m)) return `El archivo pasa de ${MAX_MB} MB.`;
      if (/mime type|invalid.*type/i.test(m)) return "Ese tipo de archivo no se permite. Use fotos, PDF, Word o Excel.";
      if (/row-level security|permission denied|not authorized/i.test(m)) return "No tiene permiso para hacer esto.";
      if (/failed to fetch|network/i.test(m)) return "Sin conexión con el servidor. Intente de nuevo.";
      if (/JWT|session/i.test(m)) return "Su sesión venció. Vuelva a iniciar sesión.";
      return m || "No se pudo completar. Intente de nuevo.";
    }
  };
})();
