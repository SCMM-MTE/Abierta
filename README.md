# Petición Abierta

Aplicación web para extraer la lista de servicios disponibles de archivos
`.mht`, `.mhtml`, `.html`, `.htm`, `.eml` o `.txt`, previsualizarla y
descargarla como un PDF limpio.

Al descargar, el PDF se archiva también en `pdf-generados/` dentro de GitHub
con un nombre único como
`Equipos petición abierta - dd-mm-aaaa - hh-mm-ss.pdf`.

## Desarrollo

```bash
npm install
npm run dev
```

La carga de archivos se procesa íntegramente en el navegador.

## Archivo automático en GitHub

Configura en Vercel las variables descritas en `.env.example`. El token de
GitHub debe ser de granularidad fina, estar limitado al repositorio de archivo
y conceder solamente `Contents: Read and write`. Nunca debe exponerse en el
navegador ni añadirse al repositorio. La función solo admite solicitudes desde
los orígenes indicados en `ALLOWED_UPLOAD_ORIGINS`.

## Despliegue en Vercel

Importa el repositorio en Vercel. El framework y los comandos se detectan desde
`vercel.json` y `package.json`.
