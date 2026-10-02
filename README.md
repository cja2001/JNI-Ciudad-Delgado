# JNI Ciudad Delgado · Redes Cyan

Sistema para registrar las redes cyan del distrito Ciudad Delgado (San Salvador Centro), mapear sus actividades comunitarias y administrar los usuarios que entran al sistema.

| Página | Para qué sirve |
|---|---|
| `login.html` | Entrada con correo y contraseña, y recuperación de contraseña. |
| `inicio.html` | Menú principal con totales. |
| `index.html` | Registro de redes (logo, lema, comunidades, responsable y hasta 20 integrantes) con mapa y exportación a Excel. |
| `actividades.html` | Mapa de actividades (jornadas de limpieza, fiestas, bacheos, cine comunitario, reparaciones de parques) y documentos de seguimiento. |
| `mapa.html` | Mapa general (OpenLayers): 18 zonas, 19 centros de votación, redes y actividades. |
| `usuarios.html` | Solo administradores: crear cuentas, cambiar roles y contraseñas, desactivar. |

## Estructura
```
public/      Sitio que se publica (HTML, CSS, JS, mapa base)
supabase/    Script de la base de datos, función admin-usuarios y guía (LEEME.md)
scripts/     generar-env.mjs: escribe public/env.js con las variables de entorno
datos/       18 zonas (KML y GeoJSON), cantones y barrios, y los 19 centros de votación (sin datos personales)
```

## Credenciales
La URL y la clave pública de Supabase se toman de variables de entorno y nunca se guardan en el repositorio:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://su-proyecto.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave **anon** o **publishable** (Project Settings > API) |

La clave pública siempre llega al navegador, porque el navegador la necesita para hablar con Supabase; está hecha para eso y lo que protege los datos son los permisos (RLS) del script. La clave **service_role** nunca va en estas variables: solo la usa la función `admin-usuarios` dentro de Supabase. Si alguien la pone por error, la compilación se detiene.

## Desplegar en Vercel
1. Ejecute `supabase/redes_cyan_supabase.sql` y siga `supabase/LEEME.md` (función `admin-usuarios` y primer administrador).
2. En Vercel: **Add New > Project**, importe este repositorio y deje la configuración que trae `vercel.json`.
3. En **Settings > Environment Variables** agregue `SUPABASE_URL` y `SUPABASE_ANON_KEY` y despliegue.
4. En Supabase, **Authentication > URL Configuration**, ponga la dirección de Vercel en *Site URL* y en *Redirect URLs* (para el correo de recuperación).

## Probar en su computadora
```bash
cp .env.example .env    # y complete los datos
npm run dev             # abre http://localhost:3000/login.html
```
Sin variables, el sitio funciona en modo demostración y guarda los datos solo en el navegador.
