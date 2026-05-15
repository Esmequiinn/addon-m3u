# 🎬 Addon Stremio – Mi Lista M3U

Addon personal para reproducir tus películas y series desde una lista M3U directamente en Stremio.

---

## 📋 Requisitos

- [Node.js](https://nodejs.org/) versión 14 o superior
- [Stremio](https://www.stremio.com/) instalado
- Tu lista M3U con las películas y series

---

## 🚀 Instalación paso a paso

### 1. Instala las dependencias

```bash
npm install
```

### 2. Agrega tu lista M3U

Copia tu archivo `.m3u` a la carpeta del proyecto y renómbralo a:
```
lista.m3u
```

O bien usa una ruta personalizada con la variable de entorno:
```bash
M3U_PATH=/ruta/a/tu/lista.m3u node addon.js
```

#### Formato requerido del M3U

El addon detecta **películas** y **series** automáticamente:

- **Series**: el título o nombre debe contener `S01E01` (temporada y episodio)
- **Películas**: cualquier entrada que no tenga formato de serie

Ejemplo:
```
#EXTM3U

#EXTINF:-1 tvg-name="Breaking Bad S01E01" tvg-logo="URL_POSTER" group-title="Series",Breaking Bad S01E01
http://tu-servidor.com/series/breaking_bad/s01e01.mkv

#EXTINF:-1 tvg-name="El Padrino" tvg-logo="URL_POSTER" group-title="Películas",El Padrino
http://tu-servidor.com/peliculas/el_padrino.mkv
```

### 3. Inicia el servidor del addon

```bash
npm start
```

Verás en la consola:
```
✅ Lista cargada: 50 películas, 10 series
🚀 Addon Stremio corriendo en: http://localhost:7000
📡 URL para instalar en Stremio: http://localhost:7000/manifest.json
```

### 4. Instala el addon en Stremio

1. Abre **Stremio**
2. Ve al ícono de **🔍 Addons** (esquina superior derecha)
3. Haz clic en **"Install from URL"** (o "Instalar desde URL")
4. Pega esta URL:
   ```
   http://localhost:7000/manifest.json
   ```
5. Haz clic en **Install**

✅ ¡Listo! Ahora verás tus catálogos **"🎬 Mis Películas"** y **"📺 Mis Series"** en Stremio.

---

## ⚙️ Variables de entorno

| Variable   | Default        | Descripción                        |
|------------|----------------|------------------------------------|
| `PORT`     | `7000`         | Puerto del servidor local          |
| `M3U_PATH` | `./lista.m3u`  | Ruta a tu archivo de lista M3U     |

Ejemplo con variables personalizadas:
```bash
PORT=8080 M3U_PATH=/home/usuario/mi_lista.m3u node addon.js
```

---

## 📁 Estructura del proyecto

```
stremio-m3u-addon/
├── addon.js          ← Servidor principal del addon
├── parse-m3u.js      ← Parser del archivo M3U
├── lista.m3u         ← Tu lista M3U (debes agregarla)
├── lista.m3u.ejemplo ← Ejemplo del formato M3U
├── package.json
└── README.md
```

---

## 🔄 Actualizar la lista

El addon lee el archivo M3U **al iniciar**. Si cambias tu lista:
1. Reemplaza el archivo `lista.m3u`
2. Reinicia el servidor: `npm start`

---

## 🌐 Uso desde otra red / dispositivo móvil

Si quieres acceder desde otro dispositivo en tu red local:
1. Encuentra la IP local de tu computadora (ej: `192.168.1.100`)
2. Usa la URL: `http://192.168.1.100:7000/manifest.json`

Para acceso desde internet necesitarías usar un túnel como [ngrok](https://ngrok.com/):
```bash
ngrok http 7000
```

---

## ❓ Problemas comunes

| Problema | Solución |
|----------|----------|
| No aparecen las películas | Verifica que `lista.m3u` existe en la carpeta |
| Las series no se agrupan | Asegúrate que el título tenga formato `S01E01` |
| No reproduce el video | Verifica que las URLs de tu M3U sean accesibles |
| Puerto en uso | Cambia el puerto: `PORT=7001 node addon.js` |
