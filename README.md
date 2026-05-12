# ⚽ Prode Mundial 2026 — Versión con PostgreSQL

## Stack
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Sesiones:** express-session + connect-pg-simple (guardadas en PostgreSQL)
- **Frontend:** HTML/CSS/JS vanilla (sin frameworks)

---

## Estructura del proyecto

```
prode2026/
├── public/
│   └── index.html          # Frontend (servido como estático)
├── src/
│   ├── server.js           # Servidor Express principal
│   ├── db.js               # Pool de conexiones a PostgreSQL
│   ├── db-init.js          # Script de inicialización de tablas (correr 1 vez)
│   └── matches.js          # Datos de partidos + lógica de puntos
├── .env.example            # Variables de entorno (copiá y completá)
├── .gitignore
└── package.json
```

---

## Instalación y primer arranque (local)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editá .env con tus datos de PostgreSQL

# 3. Crear tablas en la DB (solo la primera vez)
npm run db:init

# 4. Arrancar el servidor
npm start

# Para desarrollo con auto-restart:
npm run dev
```

Luego abrí http://localhost:3000

---

## Deploy en Render.com (recomendado — tiene free tier)

1. Creá un repo en GitHub con este proyecto
2. En Render, creá un **PostgreSQL** (free tier) y copiá el `DATABASE_URL`
3. Creá un **Web Service** apuntando al repo
   - Build command: `npm install`
   - Start command: `npm start`
4. En **Environment Variables**, agregá:
   - `DATABASE_URL` → el valor copiado de Render Postgres
   - `SESSION_SECRET` → una cadena larga y random (usá un generador)
   - `NODE_ENV` → `production`
   - `ADMIN_PASSWORD` → la clave que quieras para el admin
5. Después del primer deploy, abrí la **Shell** de Render y corré:
   ```bash
   node src/db-init.js
   ```
6. ¡Listo! La app está en la URL que te da Render.

---

## Deploy en Railway

1. Creá un proyecto nuevo, agregá un plugin **PostgreSQL**
2. Copiá la variable `DATABASE_URL` que genera Railway
3. Subí el código y configurá las variables de entorno igual que en Render
4. Corré `node src/db-init.js` desde la consola de Railway (o localmente apuntando a la DB remota)

---

## Variables de entorno

| Variable          | Descripción                                      | Requerida |
|-------------------|--------------------------------------------------|-----------|
| `DATABASE_URL`    | URL completa de conexión a PostgreSQL            | Sí        |
| `SESSION_SECRET`  | Clave secreta para firmar las cookies de sesión  | Sí        |
| `NODE_ENV`        | `production` en hosting, `development` en local  | Sí        |
| `PORT`            | Puerto del servidor (Render/Railway lo ponen auto)| No       |
| `ADMIN_PASSWORD`  | Clave del admin (solo para db-init.js)           | No        |

Si no usás `DATABASE_URL`, podés configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` por separado.

---

## Sistema de puntos

| Resultado                                        | Puntos |
|--------------------------------------------------|--------|
| Resultado exacto (ej: predijo 2-1, terminó 2-1)  | 3      |
| Ganador/empate correcto (ej: predijo 2-0, terminó 1-0) | 2 |
| Resultado incorrecto (pero hizo predicción)      | 1      |

---

## Diferencias respecto a la versión con db.json

- Los datos se guardan en PostgreSQL en lugar de un archivo local
- Las sesiones se manejan con cookies seguras (HttpOnly, no quedan en el navegador)
- La contraseña ya **no viaja** en cada request: se valida una vez en el login y después el servidor identifica al usuario por su cookie de sesión
- Si la sesión expira, el frontend avisa y vuelve al login automáticamente
- Al recargar la página, la sesión se restaura automáticamente si sigue vigente (7 días)
- El admin no puede ser eliminado por error desde el panel

---

## Acceso admin

- **Usuario:** `admin`
- **Clave:** la que hayas puesto en `ADMIN_PASSWORD` al correr `db-init.js` (por defecto: `admin2026`)

Para cambiarla después: entrá al panel de Postgres y corré:
```sql
UPDATE users SET password = 'nueva_clave' WHERE username = 'admin';
```
