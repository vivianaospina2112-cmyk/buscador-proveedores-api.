import { NextRequest, NextResponse } from "next/server";

// El HTML del Buscador de Proveedores se abre como archivo local (file://) o
// desde distintos lugares (SharePoint, un servidor interno, etc.), así que
// no hay un único origen fijo que permitir — se abre a cualquiera. La única
// protección real contra abuso es el header X-Api-Key (ver más abajo).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Este endpoint es la única pieza "nueva" del Buscador de Proveedores: el
 * Excel interno (ver /BuscadorProveedores en el repo) no tiene dirección,
 * redes sociales ni sitio web, así que esos tres campos solo pueden venir
 * de una búsqueda real en internet. Se usa Serper.dev (resultados de Google)
 * porque tiene una capa gratuita sin tarjeta y responde con un
 * "knowledgeGraph" ya estructurado cuando el negocio tiene ficha de Google.
 */

const DOMINIOS_REDES_SOCIALES: { dominio: string; red: string }[] = [
  { dominio: "facebook.com", red: "Facebook" },
  { dominio: "instagram.com", red: "Instagram" },
  { dominio: "wa.me", red: "WhatsApp" },
  { dominio: "whatsapp.com", red: "WhatsApp" },
  { dominio: "linkedin.com", red: "LinkedIn" },
  { dominio: "tiktok.com", red: "TikTok" },
  { dominio: "twitter.com", red: "X (Twitter)" },
  { dominio: "x.com", red: "X (Twitter)" },
  { dominio: "youtube.com", red: "YouTube" },
];

function redSocialParaUrl(url: string): { red: string; url: string } | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const match = DOMINIOS_REDES_SOCIALES.find(
      (s) => host === s.dominio || host.endsWith("." + s.dominio)
    );
    return match ? { red: match.red, url } : null;
  } catch {
    return null;
  }
}

interface SerperOrganicResult {
  link?: string;
  title?: string;
  snippet?: string;
}

interface SerperResponse {
  knowledgeGraph?: {
    address?: string;
    phoneNumber?: string;
    website?: string;
  };
  organic?: SerperOrganicResult[];
}

export async function POST(req: NextRequest) {
  const sharedSecret = process.env.SEARCH_SHARED_SECRET;
  if (sharedSecret) {
    const provided = req.headers.get("x-api-key");
    if (provided !== sharedSecret) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401, headers: CORS_HEADERS });
    }
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar SERPER_API_KEY en el servidor." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  let body: { nombre?: string; nit?: string; municipio?: string; region?: string; categoria?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de la petición inválido, se esperaba JSON con al menos "nombre".' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const nombre = (body.nombre || "").trim();
  if (!nombre) {
    return NextResponse.json({ error: 'Falta el campo "nombre".' }, { status: 400, headers: CORS_HEADERS });
  }

  // "nombre" puede ser el nombre exacto de un proveedor (se busca entre
  // comillas, como frase exacta) o una descripción genérica armada a partir
  // de los filtros activos en el buscador (ej. "Proveedores de Alimentación"
  // cuando no se escribió ningún texto libre) — en ese caso no tiene sentido
  // forzarlo como frase exacta.
  const nombreEsGenerico = /^proveedores(\s|$)/i.test(nombre);
  const nombreParaQuery = nombreEsGenerico ? nombre : `"${nombre}"`;

  const query = [nombreParaQuery, body.categoria?.trim(), body.municipio?.trim(), body.region?.trim(), "Colombia"]
    .filter(Boolean)
    .join(" ");

  let serperData: SerperResponse;
  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "co", hl: "es", num: 10 }),
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `El servicio de búsqueda respondió con estado ${resp.status}.` },
        { status: 502, headers: CORS_HEADERS }
      );
    }
    serperData = (await resp.json()) as SerperResponse;
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar el servicio de búsqueda en internet." },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const kg = serperData.knowledgeGraph;
  const organic = Array.isArray(serperData.organic) ? serperData.organic : [];

  const direccion = kg?.address || null;
  const telefono = kg?.phoneNumber || null;
  const sitioWebCandidato = kg?.website || null;

  const linksParaRevisar = [
    ...(sitioWebCandidato ? [sitioWebCandidato] : []),
    ...organic.map((r) => r.link).filter((l): l is string => Boolean(l)),
  ];

  const redesSocialesMap = new Map<string, string>();
  for (const link of linksParaRevisar) {
    const red = redSocialParaUrl(link);
    if (red && !redesSocialesMap.has(red.red)) redesSocialesMap.set(red.red, red.url);
  }
  const redesSociales = Array.from(redesSocialesMap, ([red, url]) => ({ red, url }));

  // El sitio web del knowledgeGraph a veces es en realidad una página de red
  // social (p. ej. Google indexa el Facebook como "sitio oficial") — en ese
  // caso no lo mostramos como "sitio web" aparte, ya está en redesSociales.
  const sitioWeb =
    sitioWebCandidato && !redSocialParaUrl(sitioWebCandidato) ? sitioWebCandidato : null;

  const primerResultadoUtil = organic.find((r) => r.link && !redSocialParaUrl(r.link));
  const linkMasInformacion = sitioWeb || primerResultadoUtil?.link || organic[0]?.link || null;

  const encontrado = Boolean(
    direccion || telefono || sitioWeb || redesSociales.length || linkMasInformacion
  );

  return NextResponse.json(
    {
      encontrado,
      direccion,
      telefono,
      sitioWeb,
      redesSociales,
      linkMasInformacion,
    },
    { headers: CORS_HEADERS }
  );
}
