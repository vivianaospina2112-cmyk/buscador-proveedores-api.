# Buscador de Proveedores — API de búsqueda en internet

Endpoint serverless que recibe el nombre (y opcionalmente NIT/municipio) de un
proveedor y devuelve, buscando en internet vía [Serper.dev](https://serper.dev)
(resultados de Google): dirección, teléfono, sitio web, redes sociales y un
link "ver más información". Es la pieza que complementa al Excel interno de
proveedores, que no tiene esos campos.

Lo consume el archivo HTML autocontenido `BuscadorProveedores/template_buscador_proveedores.html`
(botón "Buscar en internet" en la ficha de cada proveedor).

> ⚠️ **Nota importante:** este código se escribió sin poder ejecutarlo
> localmente, porque el equipo donde se generó no tiene Node.js instalado ni
> permisos para descargarlo (política de red de la organización). Antes de
> darlo por terminado, sigue los pasos de abajo en un equipo con Node.js para
> instalar dependencias y probar el endpoint con un par de proveedores reales.

## Requisitos previos

- Node.js 20 o superior (LTS recomendado) y npm.
- Una API key gratuita de Serper.dev: entra a https://serper.dev, crea una
  cuenta (no pide tarjeta) y copia la key del dashboard. El plan gratis trae
  2.500 búsquedas.

## Puesta en marcha (local)

```bash
npm install
cp .env.local.example .env.local
# Edita .env.local:
#   SERPER_API_KEY=la key que copiaste de serper.dev
#   SEARCH_SHARED_SECRET=inventa cualquier cadena secreta (ej. un uuid)

npm run dev
```

Prueba el endpoint:

```bash
curl -X POST http://localhost:3000/api/buscar-proveedor \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: LA_MISMA_CADENA_DE_SEARCH_SHARED_SECRET" \
  -d '{"nombre":"Éxito", "municipio":"Medellín"}'
```

Debe responder un JSON con `direccion`, `telefono`, `sitioWeb`,
`redesSociales` y `linkMasInformacion`. Prueba también con un proveedor
pequeño/poco conocido para confirmar que el caso "sin resultados suficientes"
(`encontrado: false`) se maneja bien en el HTML sin inventar datos.

## Despliegue en Vercel

```bash
npm i -g vercel   # si no lo tienes
vercel
```

Luego, en el dashboard de Vercel del proyecto (Settings → Environment
Variables), agrega `SERPER_API_KEY` y `SEARCH_SHARED_SECRET` con los mismos
valores que usaste en `.env.local`, y vuelve a desplegar (`vercel --prod`).

Copia la URL que te da Vercel (algo como
`https://buscador-proveedores-api.vercel.app`) y pégala, junto con el mismo
`SEARCH_SHARED_SECRET`, en las constantes `BUSCADOR_API_URL` y
`BUSCADOR_API_KEY` al inicio del `<script>` de
`BuscadorProveedores/template_buscador_proveedores.html` (o del HTML ya
generado a partir de esa plantilla).

## Decisiones de alcance (conscientes, no descuidos)

- **Sin autenticación real.** Solo un header `X-Api-Key` compartido, para
  evitar que cualquiera en internet consuma tu cuota de Serper y te genere
  costos — no protege datos sensibles (la respuesta es información pública
  de internet). Mismo nivel de protección que se usó en `app-revision-contratos`.
- **Sin base de datos ni caché en el servidor.** El HTML cachea resultados en
  `localStorage` del navegador (30 días) para no repetir búsquedas; el
  servidor es puramente stateless.
- **Nunca inventa datos.** Si Serper no devuelve dirección/teléfono/sitio
  web/redes, el endpoint responde `encontrado:false` y el HTML lo muestra
  como "sin resultados suficientes", en vez de rellenar con inferencias.
