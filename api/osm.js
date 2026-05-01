const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
];

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const SERVICE_REGEX = "HVAC|Heating|Cooling|Air Conditioning|Plumb|Electric|Pest Control|Exterminat|Roof|Landscap|Cleaning|Restoration";
const RENTAL_REGEX = "Apartments|Apartment|Townhomes|Townhome|Villas|Village|Commons|Reserve|Landing|Lofts|Flats|Cottages";

async function geocode(city, state) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", `${city}, ${state}, USA`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: { "User-Agent": "plotline-growth-dashboard/0.1 (free discovery probe)" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.length) throw new Error(`Could not geocode ${city}, ${state}`);
  return { lat: Number(payload[0].lat), lon: Number(payload[0].lon), label: payload[0].display_name };
}

function queryFor(type, lat, lon, radius) {
  if (type === "rentals") {
    return `[out:json][timeout:6];(nwr["name"~"${RENTAL_REGEX}",i](around:${radius},${lat},${lon});nwr["building"="apartments"](around:${radius},${lat},${lon});nwr["residential"="apartments"](around:${radius},${lat},${lon}););out center tags 50;`;
  }

  return `[out:json][timeout:6];(nwr["craft"~"^(plumber|electrician|hvac)$"](around:${radius},${lat},${lon});nwr["shop"~"^(plumbing|heating|electrical|pest_control)$"](around:${radius},${lat},${lon});nwr["name"~"${SERVICE_REGEX}",i](around:${radius},${lat},${lon}););out center tags 50;`;
}

function normalize(el) {
  const tags = el.tags || {};
  const center = el.center || {};
  return {
    id: `${el.type}/${el.id}`,
    name: tags.name || tags.brand || tags.operator || "Unnamed",
    lat: el.lat ?? center.lat ?? null,
    lon: el.lon ?? center.lon ?? null,
    website: tags.website || tags["contact:website"] || null,
    phone: tags.phone || tags["contact:phone"] || null,
    operator: tags.operator || null,
    category: tags.craft || tags.shop || tags.building || tags.residential || null,
    tags,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const city = String(req.query.city || "");
  const state = String(req.query.stateName || req.query.state || "Alabama");
  const type = req.query.type === "rentals" ? "rentals" : "services";
  const radius = Math.min(Math.max(Number(req.query.radius || 8000), 1000), 15000);

  if (!city) {
    res.status(400).json({ error: "city is required" });
    return;
  }

  try {
    const origin = await geocode(city, state);
    const query = queryFor(type, origin.lat, origin.lon, radius);
    let lastError = "";

    for (const endpoint of OVERPASS_URLS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "plotline-growth-dashboard/0.1",
          },
          body: query,
          signal: AbortSignal.timeout(7000),
        });

        if (!response.ok) {
          lastError = `${endpoint} HTTP ${response.status}`;
          continue;
        }

        const payload = await response.json();
        const items = (payload.elements || []).map(normalize).filter((item) => item.name !== "Unnamed");
        res.status(200).json({
          city,
          state,
          type,
          radius,
          origin,
          sourceUrl: "https://wiki.openstreetmap.org/wiki/Overpass_API",
          warning:
            "OpenStreetMap is a free supplemental source and is expected to undercount service companies and apartment communities.",
          items,
          count: items.length,
        });
        return;
      } catch (error) {
        lastError = error.message || String(error);
      }
    }

    throw new Error(lastError || "Overpass unavailable");
  } catch (error) {
    res.status(502).json({ error: error.message || "Failed to fetch OSM data" });
  }
}
