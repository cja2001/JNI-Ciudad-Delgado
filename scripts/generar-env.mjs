// Escribe public/env.js con la URL y la clave pública de Supabase tomadas de las variables de entorno.
// En Vercel se ejecuta solo al desplegar (npm run build). En su computadora lee el archivo .env.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));

// Carga .env si existe (sin pisar variables que ya vengan del sistema o de Vercel).
const archivoEnv = raiz + ".env";
if (existsSync(archivoEnv)) {
  for (const linea of readFileSync(archivoEnv, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
    if (!m || linea.trim().startsWith("#")) continue;
    const valor = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}

const url = (process.env.SUPABASE_URL || "").trim();
const clave = (process.env.SUPABASE_ANON_KEY || "").trim();

// Nunca publicar la clave secreta: daría acceso total a la base de datos desde el navegador.
function esSecreta(k) {
  if (/^sb_secret_/.test(k)) return true;
  const partes = k.split(".");
  if (partes.length !== 3) return false;
  try { return JSON.parse(Buffer.from(partes[1], "base64url").toString()).role === "service_role"; }
  catch { return false; }
}
if (clave && esSecreta(clave)) {
  console.error("ERROR: SUPABASE_ANON_KEY tiene la clave service_role (secreta). Use la clave anon o publishable.");
  process.exit(1);
}
if (url && !/^https:\/\/\S+$/.test(url)) {
  console.error("ERROR: SUPABASE_URL debe empezar con https:// (ej. https://abcd1234.supabase.co).");
  process.exit(1);
}

const env = url && clave ? { SUPABASE_URL: url, SUPABASE_ANON_KEY: clave } : {};
writeFileSync(raiz + "public/env.js",
  "// Generado por scripts/generar-env.mjs. No editar ni subir a GitHub.\nwindow.ENV = " + JSON.stringify(env) + ";\n");
console.log(url && clave
  ? `env.js listo para ${url}`
  : "Aviso: faltan SUPABASE_URL o SUPABASE_ANON_KEY. El sitio funcionará en modo demostración.");
