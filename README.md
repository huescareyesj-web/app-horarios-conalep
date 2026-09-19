# Mi Horario

Página (HTML/CSS/JS) para que cada alumno suba su horario de clases y vea qué materia toca ahora y cuál sigue. Cada quien inicia sesión con su correo y su horario se guarda en una base de datos real (Supabase), así que lo ve igual desde el celular, la compu, etc.

## Base de datos (ya está creada)

Ya existe un proyecto de Supabase llamado **horario-escolar** con la tabla `classes` (una fila por clase, protegida con Row Level Security para que cada alumno solo vea las suyas). El `script.js` ya trae la URL del proyecto y su clave pública (`anon` / `publishable`) — es segura de exponer en el cliente, RLS es lo que realmente protege los datos.

**Paso obligatorio antes de usarla fuera de tu compu:** en el panel de Supabase → **Authentication → URL Configuration**, agrega la URL donde vayas a publicar la página (por ejemplo `https://tuusuario.github.io/horario-escolar/` o `http://localhost:5500`) tanto en **Site URL** como en **Redirect URLs**. Si no la agregas, el enlace de acceso por correo no va a regresar a tu página.

## Cómo abrirla en Visual Studio Code

1. Abre la carpeta `horario-escolar` en VS Code.
2. Instala la extensión **Live Server** (si no la tienes) y haz clic derecho en `index.html` → **Open with Live Server**.
   - Ábrela por **http (Live Server o un hosting)**, no con doble clic como archivo local — el inicio de sesión y la instalación como app necesitan que la página se sirva por http/https.
3. Al entrar, cada alumno escribe su correo, recibe un enlace y con eso queda con sesión iniciada. Su horario vive en Supabase, no en el navegador.

## Cómo cargar tu horario

**Opción A — a mano:** usa el formulario "Agregar clase" (materia, día, hora de entrada/salida y salón opcional).

**Opción B — CSV:** sube un archivo con este formato (una clase por línea):

```
Materia,Dia,HoraInicio,HoraFin,Salon
Artes,Lunes,13:00,14:00,A-101
Historia,Lunes,14:00,15:00,B-204
```

- `Dia` debe ser un día de la semana en español (con o sin acentos: "Miercoles" o "Miércoles" funcionan).
- Las horas van en formato 24h (`13:00`, no `1pm`).
- El botón "Descargar plantilla" genera un CSV de ejemplo con este formato.

**Opción C — foto:** en "Subir foto de tu horario" toma una foto (o sube una imagen) de tu horario impreso. La app lo lee sola con reconocimiento de texto (Tesseract.js) y te muestra una lista editable para que confirmes materia, día, horas y salón antes de guardar nada — la lectura automática de fotos nunca es 100% exacta, por eso siempre hay revisión antes de guardar.

## Funciona como app en cualquier dispositivo (PWA)

Este proyecto es una **Progressive Web App**: en PC (Chrome/Edge) puedes "instalarla" desde el ícono de instalación de la barra de direcciones; en Android, Chrome ofrece "Agregar a pantalla de inicio"; en iPhone, desde Safari usa el botón compartir → "Agregar a pantalla de inicio". Una vez instalada se abre a pantalla completa como una app normal, con su propio ícono.

Para que la instalación y el ícono funcionen, la página debe servirse por **http/https** (no abrirse con doble clic como archivo local) — usa Live Server en VS Code, o súbela a cualquier hosting estático (GitHub Pages, Netlify, Vercel).

## Avisos

El botón "Activar avisos" ahora hace dos cosas:
1. Programa avisos mientras la pestaña esté abierta (como antes).
2. **Se suscribe a avisos reales de servidor (Web Push)** — un reloj interno en la base de datos revisa cada minuto qué clases están por empezar y le manda el aviso directo al celular, **aunque la app esté cerrada**, mientras el teléfono tenga internet.

Cada alumno solo necesita tocar "Activar avisos" **una vez por dispositivo** (y aceptar el permiso de notificaciones). En iPhone, primero hay que agregar la app a la pantalla de inicio (Safari → compartir → "Agregar a pantalla de inicio") y activarlo desde ahí — Apple no permite avisos en segundo plano desde una pestaña normal de Safari.

No requiere que configures nada extra en Supabase para esto: las claves ya están integradas.

## Sobre "que la IA lea las fotos mejor"

Ahora mismo la foto se lee con Tesseract.js (OCR) directo en el navegador — gratis y sin backend, pero no siempre acierta con horarios en tabla. Para que un modelo de IA (como Claude) lea la foto de verdad, hace falta una Edge Function de Supabase que reciba la imagen y llame a la API de un proveedor de IA usando **tu propia clave**, guardada como secreto del proyecto (nunca en el código que llega al celular del alumno). También lo puedo dejar armado cuando me digas.
