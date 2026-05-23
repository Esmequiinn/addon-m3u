# 🎬 Addon Stremio – Mi Lista M3U

Addon personal para reproducir películas y series desde una lista M3U remota directamente en Stremio usando Render.

---

## 📋 Requisitos

- Cuenta en GitHub
- Cuenta en Render
- Cuenta en [TMDB](https://www.themoviedb.org/) y una API Key gratuita
- Stremio instalado
- Una o varias listas M3U accesibles mediante URL

---

## 🚀 Cómo funciona

El addon:

- Descarga automáticamente una o varias listas M3U remotas
- Detecta películas y series
- Agrupa episodios automáticamente
- Detecta múltiples streams por película/capítulo
- Detecta idiomas automáticamente
- Crea catálogos personalizados en Stremio
- Reproduce streams directamente desde IPTV/M3U
- Soporta integración global con IMDb IDs reales
- Incluye fallback automático por nombre

---

Si una película tiene varios streams stremio mostrará varios resultados automáticamente.

---

## ✅ Fallback automático por nombre

Ahora el addon puede funcionar incluso si una lista NO tiene IMDb IDs.

Cuando Stremio pide:

```txt
tt0816692
```

(el IMDb de Interstellar)

el addon:

1. intenta encontrar ese IMDb en tu lista
2. si no existe:
   - busca automáticamente por nombre
   - compara títulos
   - devuelve streams compatibles

Gracias a esto:

✅ funcionan listas sin IMDb  
✅ funcionan listas nuevas  
✅ puedes mezclar listas  

---

## ✅ Integración global con Stremio

El addon soporta:

- IMDb IDs reales (`tt1234567`)
- Matching automático con Cinemeta
- Streams dentro de películas oficiales de Stremio

---

## ✅ Resolución automática de IDs IMDb al arrancar


El addon resuelve los IDs de IMDb directamente en Render sin necesidad de modificar tu lista M3U manualmente.
Al arrancar, lanza en segundo plano un proceso que recorre todas las películas y series y consulta TMDB para obtener su ID de IMDb real (tt...).
Este proceso usa un límite de ~3 consultas por segundo para no rebasar el límite gratuito de TMDB. Según el tamaño de tu lista puede tardar varios minutos. Durante ese tiempo el catálogo ya está disponible y funciona normalmente.
Si la pre-carga aún no ha llegado a un título concreto, el addon lo resuelve en el momento en que abres ese título directamente desde el catálogo "Mis Películas" o "Mis Series".

---

⚠️ Los títulos cuyo ID todavía no se ha resuelto no aparecerán como streams dentro de las fichas globales de Stremio hasta que sean abiertos al menos una vez desde el catálogo del addon, o hasta que la pre-carga llegue a ellos.

---

✅ Cache automático
El addon guarda en memoria todos los IDs que ya resolvió para no volver a consultarlos.
Ejemplo:

```json
{
  "interstellar": "tt0816692",
  "avatar": "tt0499549"
}
```

la primera búsqueda consulta TMDB
luego queda guardado en memoria
no vuelve a consultar la API

⚠️ Importante — Plan gratuito de Render

El cache vive en la memoria RAM del servidor, no en un archivo en disco.
En el plan gratuito de Render el servicio se apaga automáticamente tras 15 minutos de inactividad. Cuando vuelve a arrancar, el cache se borra y la pre-carga comienza de nuevo.
Si quieres que el cache persista entre reinicios necesitas un plan de pago en Render, o una base de datos externa como [Upstash Redis](https://upstash.com/) (tiene tier gratuito).

---

# 🔑 Configurar TMDB API para búsqueda automática

El addon soporta búsqueda automática de películas y series usando TMDB.

---

# Crear API Key de TMDB

1. Crear cuenta en:

```txt
https://www.themoviedb.org/
```

2. Ir a:

```txt
https://www.themoviedb.org/settings/api
```

3. Crear una API Key

4. Copiar tu API Key

---

# 🔑 Agregar la API Key en Render

Ir a:

```txt
Render → Web Service → Environment
```

Agregar:

```env
TMDB_API_KEY=TU_API_KEY
```

Ejemplo:

```env
TMDB_API_KEY=123abc456def789
```

⚠️ La variable debe llamarse exactamente TMDB_API_KEY con guiones bajos. Un nombre diferente como TMDB-KEY hace que el addon no encuentre la clave y nunca resuelva los IDs.

---

# ⚠ Importante

TMDB tiene límites de requests por minuto.

Por eso el addon:

- usa cache automático
- guarda coincidencias
- evita consultas repetidas
- solo busca cuando es necesario

Esto hace que el sistema sea mucho más rápido y estable.


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

# 🌐 Listas M3U remotas

Las listas deben estar disponibles mediante URL pública/directa.

Ejemplo:

```txt
https://github.com/usuario/repo/releases/download/iptv/lista.m3u
```

También puedes usar varias listas.

---

# Varias listas M3U

Puedes agregar múltiples listas IPTV en Render.

Ejemplo:

```env
M3U_URLS=https://lista1.m3u,https://lista2.m3u,https://lista3.m3u
```

El addon:

- descargará todas
- las combinará automáticamente
- agrupará películas y series
- mostrará todos los streams disponibles

---

# 🚀 Deploy en Render

## 1. Subir el proyecto a GitHub

Sube:

```txt
addon.js
parse-m3u.js
package.json
cache.json
README.md
```
---

## 2. Crear Web Service en Render

Ir a:

```txt
https://render.com
```

Luego:

- New +
- Web Service
- Conectar GitHub
- Seleccionar el repositorio

---

# ⚙ Configuración Render

## Build Command

```bash
npm install
```

## Start Command

```bash
npm start
```

---

# 🔑 Variables de entorno

## Una sola lista

| KEY | VALUE |
|---|---|
| `M3U_URL` | `https://url/de/tu-lista/iptv/o-m3u/iptv/lista.m3u` |

## Varias listas

| KEY | VALUE |
|---|---|
| `M3U_URLS` | `https://url/de/tu-lista/iptv/o-m3u/iptv/lista.m3u` |


---

# ▶ Instalar el addon en Stremio

Cuando Render termine el deploy:

```txt
https://tu-addon.onrender.com
```

Manifest:

```txt
https://tu-addon.onrender.com/manifest.json
```

---

## 📥 Instalar en Stremio

1. Abrir Stremio
2. Ir a Addons
3. Install from URL
4. Pegar:

```txt
https://tu-addon.onrender.com/manifest.json
```

5. Presionar Install

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

Las series deben contener:

```txt
S01E01
```

Ejemplo:

```txt
#EXTINF:-1 tvg-name="Breaking Bad S01E01" group-title="Series",Breaking Bad S01E01
http://servidor.com/episode1.m3u8
```

---

# 🎯 Integración global con IMDb IDs

El addon soporta:

```txt
tvg-id="tt1234567"
```

Gracias a esto:

✅ aparecen streams en resultados oficiales  
✅ funciona con Cinemeta  
✅ mejor matching automático  
✅ integración global con Stremio

---

# 🛠 Procesamiento manual con clean-m3u.js (Opcional)
Si prefieres tener los IDs resueltos desde el primer segundo sin esperar la pre-carga automática del addon, puedes usar el script ```clean-m3u.js```
para procesar tu lista manualmente antes de subirla.

[Descargar clean-m3u.js](https://github.com/Esmequiinn/addon-m3u/releases/download/IMDBCD/clean-m3u.js)

Este script:

* limpia títulos automáticamente
* detecta películas y series
* busca metadata usando TMDB
* agrega IMDb IDs reales (`tvg-id="tt1234567"`)
* guarda progreso automáticamente
* permite continuar después sin perder avance

# 🔑 Crear API Key de TMDB

1. Crea cuenta en:

[TMDB](https://www.themoviedb.org/signup?)

2. Luego entra a:

[TMDB API Settings](https://www.themoviedb.org/settings/api)

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

# 🌐 Usar tu lista M3U procesada en Render

Después de agregar los IMDb IDs a tu lista local usando `clean-m3u.js`, necesitarás subir el archivo `.m3u` a un servicio que permita acceso mediante enlace directo.

El addon descargará automáticamente la lista desde esa URL cada vez que Render inicie.

---

# ✅ Servicios recomendados

Puedes alojar tu lista M3U en:

- GitHub Releases
- Dropbox
- Google Drive
- Servidor VPS
- Hosting web
- CDN
- Servidores IPTV propios

---

# 🔗 Importante: la URL debe ser DIRECTA

El addon necesita una URL que descargue el archivo directamente.

Ejemplo correcto:

```txt
https://servidor.com/lista.m3u
```
Ejemplo incorrecto:
```txt
https://drive.google.com/file/d/xxxxx/view
```
Porque esa URL abre una página web y NO el archivo directamente.

# 📦 GitHub Releases (Recomendado)

La forma más estable y sencilla de alojar tu lista M3U es usando GitHub Releases.

## Pasos

1. Subir tu archivo:

```txt
lista-progress.m3u
```

a tu repositorio.

2. Ir a:

```txt
Releases → Create Release
```

3. Adjuntar el archivo `.m3u`

4. Publicar la release

5. Copiar el enlace directo del archivo

Ejemplo:

```txt
https://github.com/usuario/repo/releases/download/iptv/lista-progress.m3u
```

---

# ☁ Google Drive

Google Drive también funciona, pero debes convertir el enlace compartido en un enlace directo de descarga.

## Obtener enlace directo

Tu enlace normal se verá así:

```txt
https://drive.google.com/file/d/FILE_ID/view
```

Debes extraer el `FILE_ID` y convertirlo a:

```txt
https://drive.google.com/uc?export=download&id=FILE_ID
```

---

# ☁ Dropbox

En Dropbox:

1. Compartir archivo
2. Copiar enlace

El enlace normalmente termina en:

```txt
?dl=0
```

Debes cambiarlo por:

```txt
?dl=1
```

o:

```txt
?raw=1
```

para forzar descarga directa.

---

# 🛠 Modo desarrollador para obtener enlaces directos

En algunos servicios como Google Drive o Dropbox puedes usar el modo desarrollador del navegador para verificar si realmente estás obteniendo el archivo directo.

## Cómo hacerlo

1. Abrir el enlace
2. Presionar:

```txt
F12
```

o:

```txt
Ctrl + Shift + I
```

3. Ir a:

```txt
Network
```

4. Recargar la página

5. Buscar:

```txt
.m3u
download
usercontent
uc?export=download
```

Ahí podrás encontrar la URL real/directa del archivo.

---

---

# 🚀 Resultado final

Cuando Render inicie:

- descargará automáticamente la lista
- parseará películas y series
- detectará streams
- agrupará episodios
- cargará IMDb IDs
- integrará los streams directamente en Stremio

---


# 📁 Archivos usados por el script

| Archivo              | Descripción                        |
| -------------------- | ---------------------------------- |
| `lista.m3u`          | Lista original (nunca se modifica) |
| `lista-progress.m3u` | Lista procesada con IMDb IDs       |
| `lista-backup.m3u`   | Backup automático                  |



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
| No aparecen películas | Verifica la URL M3U |
| Error cargando M3U | Verifica redirecciones |
| No reproduce streams | Verifica IPTV |
| Las series no se agrupan | Deben contener S01E01 |
| Render tarda en abrir | El plan gratuito duerme |
| Streams duplicados | Varias listas contienen el mismo stream |

---

# ⚠ Nota sobre Render Free

El plan gratuito de Render puede dormir el servidor después de inactividad.

El primer stream o apertura puede tardar algunos segundos.

# 🔥 Resultado final

Con este sistema:

✅ múltiples listas M3U  
✅ múltiples streams  
✅ detección automática de idiomas  
✅ integración global con Stremio  
✅ soporte IMDb  
✅ fallback automático  
✅ compatibilidad con Cinemeta  
✅ cache automático  
✅ streams dentro de películas oficiales de Stremio

---

## Hacer tu propio addon con Fork

Si quieres usar este proyecto como base para crear tu propio addon personal, puedes hacerlo fácilmente con Fork en GitHub. 

---

# ¿Qué es un Fork?
Un Fork es una copia completa del repositorio en tu propia cuenta de GitHub. Obtienes todo el código listo para usar, y puedes modificarlo como quieras sin afectar el original.

---

Pasos para hacer Fork y tener tu propio addon
1. Hacer Fork del repositorio

  Ir a:

```txt
https://github.com/Esmequiinn/addon-m3u
```
2. Presionar el botón Fork (arriba a la derecha)
3. Seleccionar tu cuenta de GitHub
4. Presionar Create Fork

Ahora tienes una copia exacta del proyecto en tu cuenta.
---

2. Crear tu Web Service en Render

Ir a https://render.com
New + → Web Service
Conectar GitHub
Seleccionar tu fork (no el repositorio original)


3. Configurar tus propias variables de entorno
En tu Web Service de Render, ir a Environment y agregar:

| KEY                  | VALUE                              |
| -------------------- | ---------------------------------- |
| `TMDB_API_KEY`       | Tu propia API Key de TMDB          |
| `M3U_URLS`           | Tus propias URLs de listas M3U     |


4. Instalar en Stremio
Cuando Render termine el deploy, copiar tu URL y pegarla en Stremio
