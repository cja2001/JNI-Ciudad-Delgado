// Función "admin-usuarios": crear y administrar cuentas. Solo la puede usar un administrador activo.
// Publicar con:  supabase functions deploy admin-usuarios
// Supabase le entrega SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; la clave service_role nunca sale de aquí.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = ["admin", "usuario"];
const BLOQUEO = "876000h"; // ~100 años: la cuenta desactivada no puede iniciar sesión

const responder = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fallo = (status: number, error: string) => responder(status, { error });

const correoValido = (c: unknown): c is string => typeof c === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 254;
const claveValida = (c: unknown): c is string => typeof c === "string" && c.length >= 8 && c.length <= 72;
const limpiarNombre = (n: unknown) => String(n ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fallo(405, "Método no permitido.");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ¿Quién llama? Debe ser un administrador activo.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quien, error: errQuien } = await admin.auth.getUser(token);
  if (errQuien || !quien?.user) return fallo(401, "Su sesión venció. Vuelva a iniciar sesión.");
  const { data: yo } = await admin.from("perfiles").select("rol, activo").eq("id", quien.user.id).maybeSingle();
  if (!yo || yo.rol !== "admin" || !yo.activo) return fallo(403, "Solo un administrador puede administrar usuarios.");

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fallo(400, "Solicitud no válida."); }

  // ------------------------------------------------------------------ crear
  if (body.accion === "crear") {
    const correo = String(body.correo ?? "").trim().toLowerCase();
    const nombre = limpiarNombre(body.nombre);
    const rol = String(body.rol ?? "usuario");
    if (nombre.length < 3) return fallo(400, "Escriba el nombre completo.");
    if (!correoValido(correo)) return fallo(400, "El correo no es válido.");
    if (!claveValida(body.clave)) return fallo(400, "La contraseña debe tener al menos 8 caracteres.");
    if (!ROLES.includes(rol)) return fallo(400, "Rol no válido.");

    const { data, error } = await admin.auth.admin.createUser({
      email: correo, password: body.clave as string, email_confirm: true, user_metadata: { nombre },
    });
    if (error) {
      const yaExiste = /already|registered|exists/i.test(error.message);
      return fallo(yaExiste ? 409 : 400, yaExiste ? "Ya existe una cuenta con ese correo." : error.message);
    }
    const id = data.user.id;
    const { error: errPerfil } = await admin.from("perfiles")
      .upsert({ id, correo, nombre, rol, activo: true, creado_por: quien.user.id });
    if (errPerfil) {
      await admin.auth.admin.deleteUser(id);
      return fallo(500, "No se pudo guardar el perfil. La cuenta no se creó.");
    }
    return responder(200, { id });
  }

  // ------------------------------------------------------------- actualizar
  if (body.accion === "actualizar") {
    const id = String(body.id ?? "");
    const { data: actual } = await admin.from("perfiles").select("id, rol, activo").eq("id", id).maybeSingle();
    if (!actual) return fallo(404, "No existe ese usuario.");

    const cambios: Record<string, unknown> = {};
    if ("nombre" in body) {
      const nombre = limpiarNombre(body.nombre);
      if (nombre.length < 3) return fallo(400, "Escriba el nombre completo.");
      cambios.nombre = nombre;
    }
    if ("rol" in body) {
      if (!ROLES.includes(String(body.rol))) return fallo(400, "Rol no válido.");
      cambios.rol = body.rol;
    }
    if ("activo" in body) cambios.activo = body.activo === true;

    const pierdeAdmin = actual.rol === "admin" && actual.activo && (cambios.rol === "usuario" || cambios.activo === false);
    if (pierdeAdmin && id === quien.user.id) return fallo(400, "No puede quitarse a sí mismo el rol de administrador ni desactivar su propia cuenta.");
    if (pierdeAdmin) {
      const { count } = await admin.from("perfiles").select("id", { count: "exact", head: true }).eq("rol", "admin").eq("activo", true);
      if ((count ?? 0) <= 1) return fallo(400, "Debe quedar al menos un administrador activo.");
    }

    if ("activo" in cambios && cambios.activo !== actual.activo) {
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: cambios.activo ? "none" : BLOQUEO });
      if (error) return fallo(400, error.message);
    }
    if (Object.keys(cambios).length) {
      const { error } = await admin.from("perfiles").update(cambios).eq("id", id);
      if (error) return fallo(500, "No se pudieron guardar los cambios.");
    }
    return responder(200, { id });
  }

  // ------------------------------------------------------------ contraseña
  if (body.accion === "clave") {
    const id = String(body.id ?? "");
    if (!claveValida(body.clave)) return fallo(400, "La contraseña debe tener al menos 8 caracteres.");
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.clave as string });
    if (error) return fallo(400, error.message);
    return responder(200, { id });
  }

  return fallo(400, "Acción no válida.");
});
