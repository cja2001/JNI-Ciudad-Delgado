# Base de datos Redes Cyan en Supabase

## Cómo crearla
1. Entre a su proyecto en supabase.com y abra **SQL Editor > New query**.
2. Pegue todo el contenido de `redes_cyan_supabase.sql` y presione **Run**.
3. Revise en **Table Editor** que existan las tablas `redes`, `personas`, `red_comunidades`, `zonas` (18), `cantones` (11), `ejes` (5), `actividades`, `actividad_documentos`, `tipos_actividad` (6), `perfiles` y `centros_votacion` (19).

El script se puede volver a ejecutar sin perder datos: solo crea lo que falta y actualiza los catálogos y los límites de zonas y cantones.

## Qué crea
| Objeto | Para qué sirve |
|---|---|
| `redes` | Una fila por red: nombre, lema, logo, centro de votación, eje, zona, cantón y ubicación. |
| `red_comunidades` | Comunidades que abarca cada red. |
| `personas` | Responsable (posición 0) e integrantes (1 a 20). Un DUI solo puede estar en una red. |
| `zonas`, `cantones`, `ejes` | Catálogos. Zonas y cantones traen sus límites (PostGIS). |
| `guardar_red(p_red)` | Guarda una red completa (datos, comunidades y personas) en un solo paso. |
| `v_redes` | Una fila por red con responsable, número de integrantes y comunidades. |
| `v_personas_export` | Una fila por persona con las columnas de la plantilla de Excel. |
| `v_resumen_zonas` | Redes y personas por zona. |
| `v_mapa_capas` | Zonas y cantones en GeoJSON para dibujarlos en un mapa. |
| Bucket `logos-redes` | Logos de las redes (PNG, JPG o WebP, máximo 1 MB). |
| `tipos_actividad` | Jornada de limpieza, fiesta infantil, fiesta navideña, bacheo, cine comunitario y reparación de estructuras de parques. |
| `actividades` | Una fila por actividad: tipo, título, fecha, hora, estado, red que la organiza, lugar, participantes, beneficiarios y ubicación. |
| `actividad_documentos` | Fotos, actas, listas de asistencia e informes de cada actividad. |
| `v_actividades`, `v_resumen_actividades` | Lista de actividades con su zona y cantón, y totales por tipo. |
| `centros_votacion` | Los 19 centros de votación: nombre y coordenadas. |
| `v_centros` | Centros con su zona y cantón (según la ubicación) y el número de redes y personas de cada uno. |
| `perfiles` | Nombre, rol (`admin` o `usuario`) y estado de cada cuenta. Se crea solo al crear la cuenta. |
| Bucket `documentos-actividades` | Privado. Fotos, PDF, Word y Excel hasta 20 MB. Se ven con enlaces temporales. |

## Reglas automáticas
- La **zona** y el **cantón/barrio** se calculan solos con la latitud y longitud. Si se envía una zona distinta a la del punto, se respeta y `v_redes.zona_difiere` lo marca.
- Nombres de personas en mayúsculas y espacios de más eliminados.
- Cada red queda enlazada a su centro de votación (`redes.centro_id`) cuando el nombre coincide con uno de los 19.
- Las zonas traen su punto de rótulo (`zonas.etiqueta`), en el mismo lugar que en el mapa oficial.
- Formatos: DUI `00000000-0`, teléfono `0000-0000` empezando con 2, 6 o 7.
- Máximo 20 integrantes por red y al menos una comunidad.
- `v_personas_export."DUI verificado"` indica si el dígito verificador del DUI cuadra.

## Seguridad
- Solo usuarios con sesión iniciada pueden ver y registrar datos. Sin sesión no se ve nada, porque hay DUI y teléfonos.
- Cualquier usuario con sesión puede crear y editar redes y actividades. Solo quien creó una red o actividad puede borrarla, y solo quien subió un documento puede borrarlo.
- Los usuarios los crea un administrador desde la página **Usuarios** del sistema. Un usuario normal no ve esa página ni puede usar la función que crea cuentas, porque el servidor revisa su rol.
- Nadie puede cambiarse su propio rol, y siempre debe quedar al menos un administrador activo.
- Una cuenta desactivada ya no puede iniciar sesión; sus registros se conservan.

## Ejemplo para guardar una red desde la app
```js
const { data: redId, error } = await supabase.rpc('guardar_red', { p_red: {
  nombre: 'Red Cyan Los Ángeles', lema: 'Juntos por nuestra colonia',
  logo_path: 'redes/los-angeles.webp', centro_votacion: 'Centro Escolar República de Chile',
  eje: 'TECNOLOGIA', latitud: 13.7301, longitud: -89.1712,
  comunidades: ['Colonia Los Ángeles', 'Barrio Paleca'],
  responsable: { nombre: 'Juan Pérez López', dui: '01234567-8', telefono: '7123-4567' },
  integrantes: [{ nombre: 'María López Ramos', dui: '04567891-2', telefono: '6123-4567' }]
}});
```
Para editar, envíe también `id` con el id de la red. Si no envía `zona`, se toma la del mapa.

## Usuarios y administradores
1. Publique la función que crea cuentas. Con la CLI de Supabase, desde la carpeta `redes-cyan`:
   `supabase functions deploy admin-usuarios --project-ref SU-PROYECTO`
   (o en el panel: **Edge Functions > Deploy a new function**, nombre `admin-usuarios`, y pegue `functions/admin-usuarios/index.ts`).
2. En **Authentication > Sign In / Providers**, desactive **Allow new users to sign up**, para que nadie se registre por su cuenta.
3. Cree su propia cuenta en **Authentication > Users > Add user** y conviértala en administrador en el SQL Editor:
   ```sql
   update public.perfiles set rol = 'admin', nombre = 'Su nombre' where correo = 'su-correo@ejemplo.com';
   ```
4. Desde ahí, el resto de cuentas se crean en la página **Usuarios**.

## Sitio web
| Página | Para qué sirve |
|---|---|
| `login.html` | Entrada con correo y contraseña, y recuperación de contraseña. |
| `inicio.html` | Menú principal con los totales de redes y actividades. |
| `index.html` | Registro de redes con mapa y exportación a Excel. |
| `actividades.html` | Mapa de actividades, registro y documentos de seguimiento. |
| `mapa.html` | Mapa general con OpenLayers: zonas, centros de votación, redes y actividades. |
| `usuarios.html` | Solo administradores: crear cuentas, cambiar roles, contraseñas y desactivar. |

Para conectarlo:
1. Ejecute `redes_cyan_supabase.sql` como se explica arriba.
2. Defina las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY` (clave pública, Project Settings > API) en el archivo `.env` o en **Vercel > Settings > Environment Variables**. Nunca use la clave `service_role`.
3. Despliegue en Vercel; el `README.md` del repositorio explica los pasos.
4. En Supabase, **Authentication > URL Configuration**, agregue la dirección del sitio para que funcione el correo de recuperación.

Mientras no estén esas variables, las páginas funcionan en modo demostración y guardan todo solo en ese navegador.
