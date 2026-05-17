# 🎬 Addon Stremio – Mi Lista M3U

Addon personal para reproducir películas y series desde una lista M3U remota directamente en Stremio usando Render.

---

## 📋 Requisitos

- Cuenta en GitHub
- Cuenta en Render
- Stremio instalado
- Una lista M3U accesible mediante URL

---

## 🚀 Cómo funciona

El addon:

1. Descarga automáticamente tu lista M3U desde una URL remota
2. Detecta películas y series
3. Crea catálogos personalizados en Stremio
4. Reproduce los streams directamente desde tu M3U

---

# 📁 Archivos del proyecto

El proyecto debe contener:

```txt
addon.js
parse-m3u.js
package.json
README.md
```

---

# 🌐 Lista M3U remota

Tu lista M3U debe estar disponible mediante una URL pública.

Ejemplo:

```txt
https://github.com/usuario/repo/releases/download/iptv/lista.m3u
```

---

# 🚀 Deploy en Render

## 1. Subir el proyecto a GitHub

Sube estos archivos a tu repositorio:

- `addon.js`
- `parse-m3u.js`
- `package.json`
- `README.md`

NO subas:

- `node_modules`
- archivos locales `.m3u`
- ngrok

---

## 2. Crear Web Service en Render

Ve a:

- https://render.com

Luego:

1. Presiona **New +**
2. Selecciona **Web Service**
3. Conecta tu repositorio GitHub
4. Selecciona el repositorio del addon

---

## 3. Configuración Render

### Build Command

```bash
npm install
```

### Start Command

```bash
npm start
```

---

## 4. Variables de entorno

En Render agrega esta variable:

| KEY | VALUE |
|---|---|
| `M3U_URL` | `https://url/de/tu-lista/iptv/o-m3u/iptv/lista.m3u` |

---

# ▶ Instalar el addon en Stremio

Cuando Render termine el deploy, te dará una URL parecida a:

```txt
https://tu-addon.onrender.com
```

Tu manifest será:

```txt
https://tu-addon.onrender.com/manifest.json
```

---

## Instalar en Stremio

1. Abre Stremio
2. Ve a **Addons**
3. Selecciona **Install from URL**
4. Pega:

```txt
https://tu-addon.onrender.com/manifest.json
```

5. Presiona **Install**

---

# 📺 Catálogos

El addon crea:

- Mis Películas
- Mis Series

---

# 🎞 Formato compatible del M3U

## Películas

```txt
#EXTINF:-1 tvg-name="El Padrino" group-title="Películas",El Padrino
http://servidor.com/movie.m3u8
```

---

## Series

Las series deben contener formato:

```txt
S01E01
```

Ejemplo:

```txt
#EXTINF:-1 tvg-name="Breaking Bad S01E01" group-title="Series",Breaking Bad S01E01
http://servidor.com/episode1.m3u8
```

---

# ⚠ Importante

Actualmente el addon funciona como catálogo privado.

Eso significa que:

✅ Verás:
- Mis Películas
- Mis Series

❌ Pero NO aparecerá:
- en búsquedas globales de Stremio
- en películas oficiales del inicio
- en Cinemeta

Para eso sería necesario integrar IDs IMDb/TMDB.

---

# 🎯 Integración Global con Stremio (IMDb IDs)

Este addon soporta integración global con Stremio usando IDs reales de IMDb (`tt1234567`).

Gracias a esto:

* las películas aparecerán al buscarlas normalmente en Stremio
* los streams aparecerán dentro de películas/series oficiales
* mejora el matching automático
* funciona mejor con Cinemeta y otros addons

---

# 📥 Agregar IMDb IDs automáticamente a tu lista M3U

El proyecto incluye:

```txt id="lci4m3"
clean-m3u.js
```
    [clean-m3u.js](https://github.com/Esmequiinn/addon-m3u/releases/download/IMDBCD/clean-m3u.js)

Este script:

* limpia títulos automáticamente
* detecta películas y series
* busca metadata usando TMDB
* agrega IMDb IDs reales (`tvg-id="tt1234567"`)
* guarda progreso automáticamente
* permite continuar después sin perder avance

---

# 🔑 Crear API Key de TMDB

1. Crea cuenta en:

[TMDB](https://www.themoviedb.org/signup?utm_source=chatgpt.com)

2. Luego entra a:

[TMDB API Settings](https://www.themoviedb.org/settings/api?utm_source=chatgpt.com)

3. Copia tu API Key.

---

# 📦 Instalar dependencias

```bash id="lci4m4"
npm install axios
```

---

# ⚙️ Configurar el script

Abre:

```txt id="lci4m5"
clean-m3u.js
```

y reemplaza:

```js id="lci4m6"
const API_KEY = "PON_TU_TMDB_API_KEY";
```

por tu API real:

```js id="lci4m7"
const API_KEY = "TU_API_KEY";
```

---

# 📁 Archivos usados

| Archivo              | Descripción                        |
| -------------------- | ---------------------------------- |
| `lista.m3u`          | Lista original (nunca se modifica) |
| `lista-progress.m3u` | Lista procesada con IMDb IDs       |
| `lista-backup.m3u`   | Backup automático                  |

---

# ▶️ Ejecutar el script

Coloca tu lista M3U como:

```txt id="lci4m8"
lista.m3u
```

Luego ejecuta:

```bash id="lci4m9"
node clean-m3u.js
```

---

# 💾 Guardado automático

El script:

* guarda progreso automáticamente
* crea backups
* permite cerrar con `CTRL + C`
* continúa donde quedó la próxima vez

---

# 🧠 Compatibilidad de series

El script detecta automáticamente:

```txt id="lci4ma"
S01E01
S02E05
etc
```

y usa el IMDb ID correcto de toda la serie.

---

# ✅ Resultado esperado

Antes:

```txt id="lci4mb"
#EXTINF:-1 tvg-name="Breaking Bad S01E01",Breaking Bad S01E01
```

Después:

```txt id="lci4mc"
#EXTINF:-1 tvg-name="Breaking Bad" tvg-id="tt0903747",Breaking Bad
```

---

# 🚀 Usar la lista procesada en Render

Después de terminar:

1. Sube:

```txt id="lci4md"
lista-progress.m3u
```

a GitHub Releases o servidor directo.

2. Usa el link RAW/directo en Render:

```env id="lci4me"
M3U_URL=https://tu-link-directo.m3u
```

---

# 🔥 Resultado final

Con IMDb IDs reales:

* Stremio detecta películas/series automáticamente
* los streams aparecen dentro de resultados oficiales
* integración global funcional
* mejor compatibilidad con addons y metadata oficiales.


---

# 🔄 Actualizar la lista

Solo necesitas actualizar el archivo M3U remoto.

Render descargará automáticamente la lista al reiniciar el servicio.

Para reiniciar:

1. Ve a Render
2. Abre tu Web Service
3. Presiona:
   - Manual Deploy
   - Deploy latest commit

---

# ❓ Problemas comunes

| Problema | Solución |
|---|---|
| No aparecen películas | Verifica que la URL M3U funciona |
| Error cargando M3U | GitHub puede estar redireccionando |
| No reproduce streams | Verifica que los enlaces IPTV funcionan |
| Las series no se agrupan | El nombre debe contener `S01E01` |
| Render tarda en abrir | El plan gratuito entra en modo sleep |

---

# ⚠ Nota sobre Render Free

El plan gratuito de Render puede dormir el servidor después de inactividad.

El primer stream o apertura puede tardar algunos segundos.
