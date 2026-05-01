import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_FILES = [
  "apps/web/public/data/manual-research.json",
  "apps/web/public/data/final-market-research.json"
];

const MANAGER_URLS = [
  ["1 south property", "https://1southpropertymanagement.managebuilding.com/Resident/public/rentals"],
  ["advenir azora", "https://www.advenirliving.com/"],
  ["alabama rental managers", "https://www.alabamarentalmanagers.com/"],
  ["arbours management", "https://www.arboursmanagement.com/"],
  ["belong", "https://belonghome.com/"],
  ["blakely property management", "https://www.blakelypm.com/"],
  ["coastal properties", "https://www.coastalpropertyal.com/"],
  ["continental properties", "https://www.cproperties.com/"],
  ["cumming home property", "https://www.cumminghomepm.com/"],
  ["fairway management", "https://fairwaymanagement.com/"],
  ["firstkey homes", "https://www.firstkeyhomes.com/"],
  ["foshee residential", "https://www.fosheeresidential.com/"],
  ["gateway management", "https://www.gatewaymanagementcompany.com/"],
  ["grand welcome", "https://www.grandwelcome.com/"],
  ["greystar", "https://www.greystar.com/"],
  ["hemlane", "https://www.hemlane.com/"],
  ["kaliber management", "https://www.kalibermanagement.com/"],
  ["landmark realty", "https://landmarkperry.com/"],
  ["legacy property management", "https://legacypmd.com/"],
  ["level property management", "https://levelpmg.com/"],
  ["maa", "https://www.maac.com/"],
  ["main street renewal", "https://www.msrenewal.com/"],
  ["olympia management", "https://olympiamanagement.net/"],
  ["peak living", "https://www.peakliving.com/"],
  ["prickett properties", "https://www.prickettproperties.com/"],
  ["real property management azalea", "https://www.realpropertymobile.com/"],
  ["realty executives bay group", "https://www.realtyexecutivesbaygroup.com/"],
  ["redstone realty", "https://redstonerealtysolutions.com/"],
  ["shamrock", "https://www.shamrockrentals.com/"],
  ["spm", "https://spm.net/"],
  ["trion living", "https://trionliving.com/"],
  ["vision realty", "https://www.atlantaproperty.management/"],
  ["wilhoit", "https://www.wilhoitproperties.com/"]
];

const MANAGER_DOMAINS = new Map([
  ["advenirliving.com", ["Advenir Azora Living", "https://www.advenirliving.com/"]],
  ["affordablehousingonline.com", ["Management source", null]],
  ["apartments.com", ["Management source", null]],
  ["apartmentfinder.com", ["Management source", null]],
  ["apartmenthomeliving.com", ["Management source", null]],
  ["apartmentlist.com", ["Management source", null]],
  ["arboursmanagement.com", ["Arbours Management, LLC", "https://www.arboursmanagement.com/"]],
  ["arnoldgrounds.com", ["Arnold Grounds", "https://arnoldgrounds.com/"]],
  ["cahecmanagement.com", ["CAHEC Management", "https://cahecmanagement.com/"]],
  ["equityapartments.com", ["Equity Residential", "https://www.equityapartments.com/"]],
  ["fairwaymanagement.com", ["Fairway Management", "https://fairwaymanagement.com/"]],
  ["firstkeyhomes.com", ["FirstKey Homes", "https://www.firstkeyhomes.com/"]],
  ["flynnmanagement.com", ["Flynn Management", "https://flynnmanagement.com/"]],
  ["greystar.com", ["Greystar", "https://www.greystar.com/"]],
  ["harborgroupmanagement.com", ["Harbor Group Management", "https://www.harborgroupmanagement.com/"]],
  ["hotpads.com", ["Management source", null]],
  ["kalibermanagement.com", ["Kaliber Management", "https://www.kalibermanagement.com/"]],
  ["maac.com", ["MAA", "https://www.maac.com/"]],
  ["meganmanagement.com", ["Megan Management", "https://meganmanagement.com/"]],
  ["morrowapartments.net", ["Morrow Realty Company", "https://morrowapartments.net/"]],
  ["msrenewal.com", ["Main Street Renewal", "https://www.msrenewal.com/"]],
  ["olympiamanagement.net", ["Olympia Management", "https://olympiamanagement.net/"]],
  ["padmapper.com", ["Management source", null]],
  ["peakliving.com", ["Peak Living", "https://www.peakliving.com/"]],
  ["preservationmanagement.com", ["Preservation Management", "https://www.preservationmanagement.com/"]],
  ["rentcafe.com", ["Management source", null]],
  ["rjamesproperties.com", ["R. James Properties", "https://rjamesproperties.com/"]],
  ["spm.net", ["SPM", "https://spm.net/"]],
  ["wilhoitproperties.com", ["Wilhoit Properties Inc.", "https://www.wilhoitproperties.com/"]],
  ["willowbridgepc.com", ["Willow Bridge Property Company", "https://www.willowbridgepc.com/"]],
  ["zillow.com", ["Management source", null]]
]);

let totalBefore = 0;
let totalAfter = 0;

for (const relativePath of DATA_FILES) {
  const filePath = path.join(ROOT, relativePath);
  const payload = JSON.parse(await fs.readFile(filePath, "utf8"));
  const counts = { before: 0, after: 0 };
  visit(payload, counts);
  totalBefore += counts.before;
  totalAfter += counts.after;
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`${relativePath}: rentals ${counts.before} -> ${counts.after}`);
}

console.log(`Total rentals ${totalBefore} -> ${totalAfter}`);

function visit(node, counts) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, counts);
    return;
  }

  if (Array.isArray(node.rentals)) {
    counts.before += node.rentals.length;
    node.rentals = dedupeRentals(node.rentals.filter(isForRentHousing).map(normalizeRental));
    counts.after += node.rentals.length;
  }

  for (const value of Object.values(node)) visit(value, counts);
}

function normalizeRental(item) {
  const locationUrl = publicUrl(item.locationUrl || item.sourceUrl || item.website);
  const manager = inferManagement(item, locationUrl);
  return {
    ...item,
    id: item.id || `rental-${slug(item.name)}`,
    category: normalizeCategory(item.category || "for-rent housing"),
    locationUrl,
    sourceUrl: locationUrl,
    managementCompany: manager.name,
    managementCompanyUrl: manager.url || locationUrl
  };
}

function isForRentHousing(item) {
  const rawName = String(item.name || "").replace(/\s+/g, " ").trim();
  const name = String(item.name || "").toLowerCase();
  const category = String(item.category || "").toLowerCase();
  const sourceUrl = String(item.sourceUrl || item.locationUrl || "").toLowerCase();
  const text = `${name} ${category}`;

  if (!item?.name || !publicUrl(item.sourceUrl || item.locationUrl || item.website)) return false;
  if (/^(manager|alabama|georgia|[a-z\s]+,\s*(al|ga))$/i.test(rawName)) return false;
  if (/^(apartments in|apartment communities in|communities\s*-|property listings\b)/i.test(rawName)) return false;
  if (/\bin\s+pendergrass\b/i.test(rawName)) return false;
  if (isGenericRentalSearch(`${text} ${sourceUrl}`)) return false;

  const propertyNameSignal = /(apartment|apartments|townhome|townhomes|condo|condos|cottage|cottages|villas|commons|manor|landing|pointe|point|place|park|ridge|run|cove|woods|gardens|village|square|trail|presbyterian|quail|arbours|arbors|springs|reserve|heights|foundry|lofts|crossing|creek|court|estates|farm|farms|knoll|pines|towers|terrace|brook|brooke|stream|wharf|valley|mill|millery)/i.test(name);
  const categorySignal = /(apartment community|townhome community|apartment and townhome|single-family|single family|home rental|house rental|rental home|rental-home|senior apartment|55\+ apartment|rental community|cottage-style rental|manufactured-home|vacation condo rentals)/i.test(category);
  const managerOnly = /(property manager|property management|management directory|management company count signal|rental count signal|association management|hoa)/i.test(category);
  const businessOnlyName = /(management|property management|association|realty company|realty\b|properties\b|enterprises\b|property listings|communities\s*-|apartments in\b|apartment communities in\b)/i.test(name);
  const businessOnlyCategory = /(vacation rental property manager|condo rentals and sales)/i.test(category);

  if (managerOnly && !propertyNameSignal) return false;
  if ((businessOnlyName || businessOnlyCategory) && !propertyNameSignal) return false;
  if (categorySignal && !propertyNameSignal && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(rawName)) return false;
  if (categorySignal && !propertyNameSignal && /\b(management|realty|association|company|grounds)\b/i.test(rawName)) return false;
  return propertyNameSignal || categorySignal;
}

function inferManagement(item, locationUrl) {
  const existingName = normalizeManagerName(item.managementCompany);
  if (existingName) {
    return {
      name: existingName,
      url: item.managementCompanyUrl || managerUrlForName(existingName) || domainManager(locationUrl)?.[1] || locationUrl
    };
  }

  const domainMatch = domainManager(locationUrl);
  if (domainMatch) {
    const [name, url] = domainMatch;
    return { name, url: url || locationUrl };
  }

  return { name: "Management source", url: locationUrl };
}

function domainManager(value) {
  const host = hostname(value);
  if (!host) return null;
  for (const [domain, manager] of MANAGER_DOMAINS.entries()) {
    if (host === domain || host.endsWith(`.${domain}`)) return manager;
  }
  return null;
}

function managerUrlForName(name) {
  const normalized = name.toLowerCase();
  const match = MANAGER_URLS.find(([key]) => normalized.includes(key));
  return match?.[1] || null;
}

function normalizeManagerName(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.toLowerCase() === "not visible") return "";
  return text;
}

function isGenericRentalSearch(text) {
  return /(for rent by private owner|\d+\s+rentals?\s+in|apartments?\s+for\s+rent|homes?\s+for\s+rent|houses?\s+for\s+rent|daily updates|best\s+\d+\s+apartments|near me|search results|top\s+.+property management companies|property management near|community association|hoa property|our locations|rental count signal|property management company count signal|property management directory|apartment association|action community management|all-in-one community management|professional property management|^manager$|^home$|^alabama$|^georgia$)/i.test(text);
}

function dedupeRentals(records) {
  const seen = new Set();
  return records.filter((item) => {
    const key = slug(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function canonicalUrl(value) {
  return publicUrl(value).replace(/\/$/, "").toLowerCase();
}

function hostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeCategory(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}
