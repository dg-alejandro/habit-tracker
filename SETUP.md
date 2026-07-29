# Pasos manuales

Todo lo que **no puede hacer Claude Code** y tengo que hacer yo. Unos quince minutos en total, repartidos entre las fases 0, 2, 5 y 6.

Claude Code: cuando llegues a uno de estos puntos, **para, dime exactamente qué hacer y espera confirmación**. No sigas asumiendo que está hecho.

---

## 1. Repositorio en GitHub — Fase 0

Crear un repositorio **privado**, propiedad de mi **cuenta personal**.

> No puede pertenecer a una organización de GitHub: el plan Hobby de Vercel no permite conectar repos de organizaciones.

Claude Code hace el `git init`, los commits y el `push`. Yo solo creo el repositorio vacío y le paso la URL.

---

## 2. Proyecto en Supabase — Fase 2

1. supabase.com → New project.
2. Nombre: `habitos`. Región: Frankfurt o París.
3. Guardar la contraseña de la base de datos en el gestor de contraseñas.
4. Esperar a que termine de aprovisionarse (1–2 minutos).
5. **Project Settings → API**, copiar dos valores:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`
6. Pegarlos en el `.env` local, que Claude Code crea a partir de `.env.example`.
7. **Authentication → Providers → Email:** desactivar la confirmación por correo.
8. **Authentication → Users:** crear mi usuario a mano. Es un solo usuario, no hace falta pantalla de registro.

> Este es el **segundo y último** proyecto que permite el plan gratuito. Si algún día necesito un tercero, tendré que pausar uno.

---

## 3. Ejecutar el SQL — Fase 2

1. En Supabase, abrir **SQL Editor**.
2. Pegar `supabase/schema.sql` y ejecutar.
3. Pegar `supabase/policies.sql` y ejecutar.
4. Comprobar en **Table Editor** que las tablas existen y que RLS aparece activado.

---

## 4. Vercel — Fases 0 y 2

**Fase 0:**
1. vercel.com → Add New → Project → importar el repositorio.
2. Framework: Vite, se detecta solo. Resto por defecto.
3. Deploy. Guardar la URL.

**Fase 2:** en **Settings → Environment Variables**, añadir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores del `.env`. Volver a desplegar.

> Cada push a la rama principal despliega solo. El plan Hobby da 100 minutos de build al mes, compartidos con mi otro proyecto.

---

## 5. Instalar la PWA en el iPhone — Fase 5

> **Si ya la añadiste antes de la Fase 5, BÓRRALA primero y vuelve a añadirla.** iOS no vuelve a leer el manifest de un acceso directo que ya existe: conservaría el icono y el nombre viejos, y no se abriría a pantalla completa.

1. Abrir la URL de Vercel **en Safari** (Chrome no vale).
2. Compartir → **Añadir a pantalla de inicio**.
3. Abrirla desde el icono, no desde el navegador. Debe salir **sin barra de direcciones**, con el fondo negro llegando hasta abajo y el check blanco como icono.

> Ya no hace falta cerrarla desde el multitarea tras cada despliegue: la app comprueba sola si hay versión nueva (al abrirla, al volver a ella y cada hora) y avisa con una banda al pie. **Nada se recarga solo** — se actualiza cuando tú pulsas.

---

## 6. Claves VAPID — Fase 6 (opcional)

1. Claude Code genera el par de claves con `web-push` y me las muestra.
2. Yo las añado como variables de entorno en Vercel.
3. La privada **nunca** se sube al repositorio.
4. Aceptar el permiso de notificaciones en el iPhone, con la PWA ya instalada.

---

## Mantenimiento

- **Exportar el JSON de respaldo al menos una vez al mes.** El plan gratuito de Supabase no hace copias de seguridad. Guardarlo en iCloud.
- Si paso más de una semana sin abrir la app, Supabase pausará el proyecto. Se reactiva con un clic y no se pierde nada.
