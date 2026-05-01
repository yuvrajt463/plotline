import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DASHBOARD_DATA = path.join(ROOT, "apps", "web", "public", "data", "manual-research.json");
const FINAL_PUBLIC = path.join(ROOT, "apps", "web", "public", "data", "final-market-research.json");
const SERP_COMPILED = path.join(ROOT, "data", "serp-compiled-results.json");
const SERP_STATUS = path.join(ROOT, "data", "serp-run-status.json");

const MAX_SERVICES_PER_CITY = 36;
const MAX_RENTALS_PER_CITY = 24;

const manualCrosschecks = [
  record("AL", "Daphne", "rental", "Grande Pointe Apartment Homes", "apartment community", "not visible", "133 Lake Front Drive, Daphne, AL 36526", "https://www.grandepointeapts.com/", "Official site says Grande Pointe Apartment Homes is conveniently located in Daphne, Alabama."),
  record("AL", "Semmes", "rental", "Azalea Landing", "senior apartment community", "not visible", "1961 Schillinger Road North, Semmes, AL 36575", "https://www.apartments.com/azalea-landing-semmes-al/l7x3w1e/", "Apartments.com places Azalea Landing at a Semmes, AL address and describes it as an apartment community in Mobile County."),
  record("AL", "Robertsdale", "service", "Express Land & Nursery Services LLC", "landscaping and nursery", "local", "20941 Co Rd 48, Robertsdale, AL 36567", "https://expresslandandnurseryservices.com/", "Official site says Express Land & Nursery Services is a landscaping service based in Robertsdale, AL."),
  record("AL", "Robertsdale", "service", "Absolute Electric, LLC", "electrical", "regional", null, "https://www.absolute-electric-llc.com/", "Official site says Absolute Electric serves Foley, Gulf Shores, Orange Beach, Elberta, Robertsdale and Lillian, Alabama."),
  record("AL", "Robertsdale", "service", "Mitchell Landscape and Concrete", "landscaping, concrete and site prep", "local", null, "https://www.mitchelllandscapeconcrete.com/site-prep", "Official site says Mitchell Landscape and Concrete offers site preparation services in Robertsdale, Alabama."),
  record("AL", "Orange Beach", "rental", "Perdido Isle Apartment Homes", "apartment community", "not visible", "25624 W Perdido Ave, Orange Beach, AL 36561", "https://www.perdidoisle-al.com/Contact.aspx", "Official site says Perdido Isle Apartment Homes is in the heart of Orange Beach, Alabama."),
  record("AL", "Orange Beach", "rental", "Orange Beach Host / Grand Welcome Orange Beach & Perdido Key", "vacation rental property manager", "Grand Welcome Orange Beach & Perdido Key", null, "https://www.orangebeachhost.com/", "Official site says the company provides full-service vacation rental property management from Orange Beach, AL to Perdido Key, FL."),
  record("AL", "Orange Beach", "rental", "Coastal Properties", "condo rentals and sales", "Coastal Properties", "25300 Perdido Beach Blvd., Suite #103, Orange Beach, AL 36561", "https://www.coastalpropertyal.com/", "Official site lists Coastal Properties at an Orange Beach, Alabama address and specializes in beach condominium rentals."),
  record("AL", "Orange Beach", "service", "Alder Plumbing, Heating, & Air", "plumbing and HVAC", "regional", null, "https://www.alderplumbingco.com/", "Official site says Alder provides plumbing, heating, air conditioning and emergency services in Orange Beach, Alabama."),
  record("AL", "Foley", "rental", "The Reserve of Foley", "apartment and townhome community", "not visible", "21450 County Road 12 South, Foley, AL 36535", "https://www.reserveoffoleyapartments.com/", "Official site lists The Reserve of Foley at a Foley, AL address and offers apartments and townhomes."),
  record("AL", "Foley", "rental", "The Rivi Apartments", "apartment community", "not visible", "458 E Riviera Blvd, Foley, AL 36535", "https://www.theriviapartments.com/", "Official site says The Rivi offers luxury apartments for rent in Foley, AL."),
  record("AL", "Foley", "rental", "Cottages at Foley Farms", "cottage-style rental homes", "not visible", null, "https://www.cottagesfoley.com/", "Official site describes Cottages at Foley Farms as cottage-style homes in Foley, AL."),
  record("AL", "Foley", "rental", "Villages at Arbor Walk", "apartment community", "not visible", null, "https://www.villagesatarborwalk.com/", "Official site says Villages at Arbor Walk offers 3- and 4-bedroom apartments in Foley, Alabama."),
  record("AL", "Foley", "rental", "Las Colinas", "apartment community", "not visible", null, "https://www.liveatlascolinas.com/", "Official site says Las Colinas offers 2- and 3-bedroom apartments in Foley, Alabama."),
  record("AL", "Foley", "service", "Taurus Electrical, LLC", "electrical", "local", "Foley, AL 36535", "https://www.taurus-electrical.com/", "Official site says Taurus Electrical provides residential and commercial electrical services in the Foley and Fairhope, AL areas."),
  record("AL", "Foley", "service", "Wolff Lawn & Landscaping, LLC", "landscaping and lawn care", "local", null, "https://wolfflawncare.com/", "Official site says Wolff Lawn & Landscaping serves Foley, Alabama with lawn and landscaping services."),
  record("AL", "Foley", "service", "Kent's Landscaping", "landscaping", "local", "7261 Rodney Styron Ln, Foley, AL 36535", "https://www.kentslandscaping.com/", "Official site lists Kent's Landscaping at a Foley, Alabama address."),
  record("AL", "Foley", "service", "Back Bay Roofers LLC", "roofing", "regional", "307 S McKenzie St, Ste 212, Foley, AL 36535", "https://backbayroofers.com/", "Official site lists Back Bay Roofers in Foley and describes roofing services in Foley, AL."),
  record("AL", "Foley", "service", "Cardinal Roofing", "roofing", "regional", "2205 N McKenzie St, Foley, AL 36535", "https://www.northpointroofingsystems.com/cardinal-roofing-foley-alabama/", "Company page identifies Cardinal Roofing as a roofing company in Foley, AL."),
  record("AL", "Satsuma", "service", "Infinity Solutions and Services", "electrical, mechanical and fire protection", "regional", null, "https://www.infinitysolutions365.com/industrial-mechanical-service-provider", "Official site says Infinity Solutions and Services is based in Satsuma, Alabama."),
  record("AL", "Satsuma", "rental", "207 Maple Ave E", "single-family house rental", "not visible", "207 Maple Ave E, Satsuma, AL 36572", "https://www.zillow.com/satsuma-al/rentals/", "Zillow lists 207 Maple Ave E as a house for rent in Satsuma, AL."),
  record("AL", "Satsuma", "rental", "121 Orange Ave E", "single-family house rental", "not visible", "121 Orange Ave E, Satsuma, AL 36572", "https://www.zillow.com/satsuma-al/rentals/", "Zillow lists 121 Orange Ave E as a house for rent in Satsuma, AL."),
  record("AL", "Satsuma", "rental", "613 Vaughn Dr N", "single-family house rental", "Ole Bay Management Inc", "613 Vaughn Dr N, Satsuma, AL 36572", "https://www.redfin.com/city/17515/AL/Satsuma/rentals", "Redfin lists 613 Vaughn Dr N in Satsuma, AL and states Ole Bay Management Inc residents are enrolled in its resident benefits package."),
  record("AL", "Meridianville", "rental", "LEO at Flint Crossing", "single-family rental community", "Advenir Azora Living", "141 Patterson Lane, Meridianville, AL 35759", "https://www.advenirliving.com/leoatflintcrossing/", "The official property page lists LEO at Flint Crossing at 141 Patterson Lane, Meridianville, AL 35759."),
  record("AL", "Margaret", "rental", "1055 Clover Ave", "single-family home rental", "Main Street Renewal LLC", "1055 Clover Ave, Margaret, AL 35120", "https://www.apartmentlist.com/al/margaret/1055-clover-ave", "Apartment List shows 1055 Clover Ave at 1055 Clover Avenue, Margaret, AL 35120."),
  record("AL", "Margaret", "rental", "324 Black Crk Trl", "single-family home rental", null, "324 Black Crk Trl, Margaret, AL 35120", "https://www.apartmentfinder.com/Alabama/Margaret-Apartments/324-Black-Crk-Trl-Apartments-eh2bf3n", "Apartment Finder lists 324 Black Crk Trl as a rental at 324 Black Crk Trl, Margaret, AL 35120."),
  record("AL", "Calera", "rental", "Lancaster Place Apartment Homes", "apartment community", null, "10 Kensington Manor D, Calera, AL 35040", "https://www.lancasterplaceapts.com/amenities", "The official Lancaster Place page describes apartment living in Calera, Alabama and lists the address."),
  record("GA", "Lovejoy", "service", "Bowman's HVAC", "HVAC", "regional", null, "https://bowmanshvacinc.com/service-area/lovejoy-georgia/", "Official service-area page says Bowman's HVAC provides HVAC services in Lovejoy, GA."),
  record("GA", "Lovejoy", "service", "DAPS Services", "pest control", "regional", null, "https://dapspest.com/pest-control-lovejoy-ga/", "Official page says Lovejoy, GA residents and businesses turn to DAPS Services for pest extermination services."),
  record("GA", "Jonesboro", "service", "Prime Pest Solutions", "pest control", "regional", null, "https://primepest.net/pest-control-jonesboro-ga.html", "Official page is titled Pest Control Jonesboro, GA and says Prime Pest Solutions provides pest control in Jonesboro."),
  record("GA", "Jonesboro", "service", "Premier Heating and Air", "HVAC", "regional", null, "https://www.premierishere.com/service-areas/jonesboro-ga-hvac", "Official service-area page says Premier Heating and Air delivers HVAC services throughout Jonesboro, Georgia."),
  record("GA", "Jonesboro", "rental", "HearthSide Jonesboro", "55+ apartment community", null, "109 North Ave, Jonesboro, GA 30236", "https://www.hearthsidejonesboro.com/", "Official site identifies HearthSide Jonesboro as 1 and 2 bedroom apartments for rent in Jonesboro, GA."),
  record("GA", "Jonesboro", "rental", "Pine Knoll Apartments", "apartment community", null, "7393 Tara Rd, Jonesboro, GA 30236", "https://www.pineknollapartments.net/", "Official site describes Pine Knoll Apartments as living in Jonesboro, GA and lists a Jonesboro address."),
  record("GA", "Jonesboro", "rental", "Oak Run", "apartment community", "Peak Living", "7878 North Main St, Jonesboro, GA 30236", "https://www.oakrunpeakliving.com/", "Official community page says Oak Run offers apartments in Jonesboro, GA and is managed by Peak Living."),
  record("GA", "Mableton", "service", "Ruppert Landscape", "commercial landscaping", "regional", null, "https://www.ruppertlandscape.com/locations/commercial-landscaping-mableton/", "Official location page says Ruppert Landscape provides commercial landscaping services in the Atlanta metro including Mableton."),
  record("GA", "Mableton", "rental", "Series at Riverview Landing", "apartment community", null, "6025 Riverview Rd SE, Mableton, GA 30126", "https://seriesrvl.com/", "Official site calls Series at Riverview Landing Mableton's distinctive apartment community and lists a Mableton address."),
  record("GA", "Locust Grove", "service", "D&S Plumbing", "plumbing", "local", "83 Pine Grove Rd, Locust Grove, GA 30248", "https://www.dsplumbingrepair.com/", "Official site lists D&S Plumbing at 83 Pine Grove Rd in Locust Grove, Georgia and describes plumbing services."),
  record("GA", "Locust Grove", "service", "T & J Exteriors Inc.", "roofing, siding, gutters, windows", "regional", null, "https://tandjextinc.com/", "Official site says T & J Exteriors provides professional roofing in Locust Grove, GA and beyond."),
  record("GA", "Locust Grove", "rental", "Shoal Creek Manor Senior", "55+ apartment community", null, "120 L G Griffin Road, Locust Grove, GA 30248", "https://www.shoalcreekmanorga.com/", "Official site says Shoal Creek Manor Senior is in Locust Grove, Georgia and lists a Locust Grove address."),
  record("GA", "Locust Grove", "rental", "Havenwood Grove Senior", "55+ apartment community", "Fairway Management", "550 Indian Creek Road, Locust Grove, GA 30248", "https://fairwaymanagement.com/HavenwoodGrove", "Fairway Management page identifies Havenwood Grove Senior as a 55+ senior living community in Locust Grove, Georgia."),
  record("GA", "Cumming", "service", "C2 Electrical Contractors, Inc.", "electrical", "regional", null, "https://www.c2electrical.net/", "Official site says C2 Electrical Contractors serves North Georgia from Cumming, GA and provides electrical services."),
  record("GA", "Cumming", "service", "Will Spurlock Electric", "electrical", "regional", null, "https://willspurlock.com/about-us/service-area/cumming/", "Official service-area page says Will Spurlock Electric provides electrical installations, repairs and inspections in Cumming, Georgia."),
  record("GA", "Cumming", "rental", "The Foundry at Mashburn Village Apartments", "apartment community", "Greystar", "98 Buford Dam Rd, Cumming, GA 30040", "https://www.greystar.com/the-foundry-at-mashburn-village-apartments-cumming-ga/p_19508", "Greystar property page lists The Foundry at Mashburn Village Apartments at 98 Buford Dam Rd in Cumming, GA."),
  record("GA", "Jefferson", "service", "Yancey Power Systems - Jefferson", "generator repair, sales, and rentals", "regional dealer", "2623 Bill Wright Rd, Jefferson, GA 30549", "https://www.yanceybros.com/stores/yancey-power-systems-jefferson-ga/", "The official Yancey page lists a Jefferson, GA store and says it offers generator repair, sales, and rentals in Jefferson.")
];

async function main() {
  const dashboard = JSON.parse(await fs.readFile(DASHBOARD_DATA, "utf8"));
  const serp = JSON.parse(await fs.readFile(SERP_COMPILED, "utf8"));
  const status = JSON.parse(await fs.readFile(SERP_STATUS, "utf8"));

  const final = {
    generatedAt: new Date().toISOString(),
    method: "Manual public-web research, regional subagent cross-checks, and 200 total SerpAPI calls. Raw SerpAPI JSON is stored under data/raw/serpapi and is not modified by this compiler.",
    run: {
      serpFullPlanCalls: 200,
      serpPlannedCallsExecuted: 198,
      serpSmokeCallsExecuted: 2,
      successfulPlannedCalls: Object.values(status.calls).filter((call) => call.status === "ok" || call.status === "cached").length,
      failedPlannedCalls: Object.values(status.calls).filter((call) => call.status === "error").length,
      compiledSerpTotals: serp.totals,
      dashboardLimits: {
        servicesPerCity: MAX_SERVICES_PER_CITY,
        rentalsPerCity: MAX_RENTALS_PER_CITY
      }
    },
    states: {}
  };

  dashboard.generatedAt = final.generatedAt;
  dashboard.method = final.method;

  for (const [state, cities] of Object.entries(dashboard.states || {})) {
    final.states[state] ||= {};
    for (const [city, payload] of Object.entries(cities)) {
      const manualServices = sanitizeRecords(payload.services || [], "service");
      const manualRentals = sanitizeRecords(payload.rentals || [], "rental");
      const crossServices = manualCrosschecks.filter((item) => item.state === state && item.city === city && item.type === "service").map(toDashboardService);
      const crossRentals = manualCrosschecks.filter((item) => item.state === state && item.city === city && item.type === "rental").map(toDashboardRental);
      const serpServices = sanitizeRecords(serp.states?.[state]?.[city]?.services || [], "service").filter((item) => item.confidence !== "low");
      const serpRentals = sanitizeRecords(serp.states?.[state]?.[city]?.rentals || [], "rental").filter((item) => item.confidence !== "low" || looksOfficial(item.sourceUrl));

      const services = limitWithCategoryBalance(dedupeRecords([...manualServices, ...crossServices, ...serpServices]), MAX_SERVICES_PER_CITY);
      const rentals = limitWithCategoryBalance(dedupeRecords([...manualRentals, ...crossRentals, ...serpRentals]), MAX_RENTALS_PER_CITY);

      dashboard.states[state][city].services = services;
      dashboard.states[state][city].rentals = rentals;
      final.states[state][city] = {
        dashboard: { services, rentals },
        serpCandidates: {
          services: serp.states?.[state]?.[city]?.services || [],
          rentals: serp.states?.[state]?.[city]?.rentals || []
        },
        manualCrosschecks: manualCrosschecks.filter((item) => item.state === state && item.city === city)
      };
    }
  }

  await fs.writeFile(DASHBOARD_DATA, `${JSON.stringify(dashboard, null, 2)}\n`);
  await fs.writeFile(FINAL_PUBLIC, `${JSON.stringify(final, null, 2)}\n`);

  console.log(`updated ${path.relative(ROOT, DASHBOARD_DATA)}`);
  console.log(`wrote ${path.relative(ROOT, FINAL_PUBLIC)}`);
  console.log(JSON.stringify(summarizeDashboard(dashboard), null, 2));
}

function record(state, city, type, name, category, marketClassOrManager, address, sourceUrl, evidence) {
  return { state, city, type, name, category, marketClassOrManager, address, sourceUrl, evidence };
}

function toDashboardService(item) {
  return {
    id: `manual-crosscheck-${slug(item.state)}-${slug(item.city)}-${slug(item.name)}`,
    name: item.name,
    category: item.category,
    serviceTags: inferServiceTags(item),
    marketClass: normalizeMarketClass(item.marketClassOrManager),
    address: item.address,
    sourceUrl: item.sourceUrl,
    evidence: item.evidence,
    source: "Manual cross-check"
  };
}

function toDashboardRental(item) {
  const manager = normalizeRentalManager(item.marketClassOrManager, item.sourceUrl);
  return {
    id: `manual-crosscheck-${slug(item.state)}-${slug(item.city)}-${slug(item.name)}`,
    name: item.name,
    category: item.category,
    managementCompany: manager.name,
    managementCompanyUrl: manager.url,
    locationUrl: item.sourceUrl,
    address: item.address,
    sourceUrl: item.sourceUrl,
    evidence: item.evidence,
    source: "Manual cross-check"
  };
}

function sanitizeRecords(records, kind) {
  return records
    .filter((item) => item?.name && isPublicUrl(item.sourceUrl))
    .filter((item) => (kind === "service" ? isCoreService(item) : isHousingRental(item)))
    .map((item) => ({
      ...item,
      id: item.id || `${kind}-${slug(item.name)}`,
      category: normalizeCategory(item.category || (kind === "service" ? "home services" : "rental housing")),
      ...(kind === "service" ? { serviceTags: inferServiceTags(item) } : {}),
      ...(kind === "rental" ? normalizeRentalFields(item) : {}),
      marketClass: kind === "service" ? normalizeMarketClass(item.marketClass) : item.marketClass,
      source: item.source || "Verified web"
    }));
}

function isCoreService(item) {
  const text = `${item.name || ""} ${item.category || ""}`.toLowerCase();
  return /(hvac|heating|cooling|air conditioning|plumb|electric|pest|termite|roof|landscap|lawn|irrigation|septic|generator|mechanical|fire protection)/.test(text) &&
    !/(near me|self-storage|storage unit|equipment rental|truck rental|dumpster|porta potty|portable toilet|municipal facility|event center|agricultural equipment)/.test(text);
}

function isHousingRental(item) {
  const rawName = String(item.name || "").replace(/\s+/g, " ").trim();
  const name = rawName.toLowerCase();
  const category = String(item.category || "").toLowerCase();
  const text = `${name} ${category} ${item.sourceUrl || ""}`;
  if (/^(manager|alabama|georgia|[a-z\s]+,\s*(al|ga))$/i.test(rawName)) return false;
  if (/^(apartments in|apartment communities in|communities\s*-|property listings\b)/i.test(rawName)) return false;
  if (/\bin\s+pendergrass\b/i.test(rawName)) return false;
  if (isGenericRentalSearch(item)) return false;

  const propertyNameSignal = /(apartment|apartments|townhome|townhomes|condo|condos|cottage|cottages|villas|commons|manor|landing|pointe|point|place|park|ridge|run|cove|woods|gardens|village|square|trail|presbyterian|quail|arbours|arbors|springs|reserve|heights|foundry|lofts|crossing|creek|court|estates|farm|farms|knoll|pines|towers|terrace|brook|brooke|stream|wharf|valley|mill|millery)/i.test(name);
  const categorySignal = /(apartment community|townhome community|apartment and townhome|single-family|single family|home rental|house rental|rental home|rental-home|senior apartment|55\+ apartment|rental community|cottage-style rental|manufactured-home|vacation condo rentals)/i.test(category);
  const managerOnly = /(property manager|property management|management directory|management company count signal|rental count signal|association management|hoa)/i.test(category);
  const businessOnlyName = /(management|property management|association|realty company|realty\b|properties\b|enterprises\b|property listings|communities\s*-|apartments in\b|apartment communities in\b)/i.test(name);
  const businessOnlyCategory = /(vacation rental property manager|condo rentals and sales)/i.test(category);

  return !/(self-storage|storage unit|equipment rental|truck rental|dumpster|porta potty|portable toilet|facility rental|field rental|event center)/.test(text) &&
    !(managerOnly && !propertyNameSignal) &&
    !((businessOnlyName || businessOnlyCategory) && !propertyNameSignal) &&
    !(categorySignal && !propertyNameSignal && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(rawName)) &&
    !(categorySignal && !propertyNameSignal && /\b(management|realty|association|company|grounds)\b/i.test(rawName)) &&
    (propertyNameSignal || categorySignal);
}

function isGenericRentalSearch(item) {
  const text = `${item.name || ""} ${item.sourceUrl || ""}`.toLowerCase();
  return /(for rent by private owner|\d+\s+rentals?\s+in|apartments for rent|homes for rent|houses for rent|daily updates|best 10 apartments|near me|search results|top\s+.+property management companies|property management near|community association|hoa property|our locations|rental count signal|property management company count signal|property management directory|apartment association|action community management|all-in-one community management|professional property management)/.test(text);
}

function normalizeCategory(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeMarketClass(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("chain") || text.includes("national")) return "chain";
  if (text.includes("regional")) return "regional";
  if (text.includes("local")) return "local";
  return "regional";
}

function normalizeRentalFields(item) {
  const locationUrl = canonicalUrl(item.sourceUrl || item.locationUrl || item.website) || item.sourceUrl;
  const manager = normalizeRentalManager(item.managementCompany, locationUrl);
  return {
    locationUrl,
    managementCompany: manager.name,
    managementCompanyUrl: manager.url
  };
}

function normalizeRentalManager(name, sourceUrl) {
  const existing = String(name || "").replace(/\s+/g, " ").trim();
  const domain = managerFromUrl(sourceUrl);
  const label = existing && existing.toLowerCase() !== "not visible" ? existing : domain.name || "Management source";
  return {
    name: label,
    url: managerUrlForName(label) || domain.url || sourceUrl
  };
}

function managerFromUrl(value) {
  let host = "";
  try {
    host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return {};
  }
  const domains = [
    ["advenirliving.com", "Advenir Azora Living", "https://www.advenirliving.com/"],
    ["cahecmanagement.com", "CAHEC Management", "https://cahecmanagement.com/"],
    ["equityapartments.com", "Equity Residential", "https://www.equityapartments.com/"],
    ["fairwaymanagement.com", "Fairway Management", "https://fairwaymanagement.com/"],
    ["greystar.com", "Greystar", "https://www.greystar.com/"],
    ["maac.com", "MAA", "https://www.maac.com/"],
    ["olympiamanagement.net", "Olympia Management", "https://olympiamanagement.net/"],
    ["peakliving.com", "Peak Living", "https://www.peakliving.com/"],
    ["spm.net", "SPM", "https://spm.net/"],
    ["wilhoitproperties.com", "Wilhoit Properties Inc.", "https://www.wilhoitproperties.com/"]
  ];
  const match = domains.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  return match ? { name: match[1], url: match[2] } : {};
}

function managerUrlForName(name) {
  const text = String(name || "").toLowerCase();
  const urls = [
    ["advenir azora", "https://www.advenirliving.com/"],
    ["fairway management", "https://fairwaymanagement.com/"],
    ["firstkey homes", "https://www.firstkeyhomes.com/"],
    ["greystar", "https://www.greystar.com/"],
    ["maa", "https://www.maac.com/"],
    ["main street renewal", "https://www.msrenewal.com/"],
    ["olympia management", "https://olympiamanagement.net/"],
    ["peak living", "https://www.peakliving.com/"],
    ["spm", "https://spm.net/"],
    ["wilhoit", "https://www.wilhoitproperties.com/"]
  ];
  return urls.find(([key]) => text.includes(key))?.[1] || "";
}

function limitWithCategoryBalance(records, max) {
  const scored = records.map((item, index) => ({
    item,
    index,
    score: scoreRecord(item)
  })).sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  const categoryCounts = new Map();
  for (const { item } of scored) {
    const key = primaryCategory(item.category);
    const count = categoryCounts.get(key) || 0;
    if (selected.length < Math.ceil(max * 0.7) || count < 6) {
      selected.push(item);
      categoryCounts.set(key, count + 1);
    }
    if (selected.length >= max) break;
  }

  return selected;
}

function scoreRecord(item) {
  let score = 0;
  if (item.source === "Manual cross-check") score += 30;
  if (String(item.source || "").includes("SerpAPI")) score += 12;
  if (item.confidence === "high") score += 12;
  if (item.confidence === "medium") score += 6;
  if (item.address) score += 4;
  if (looksOfficial(item.sourceUrl)) score += 6;
  if (item.managementCompany) score += 5;
  if (/chain|national/i.test(item.marketClass || "")) score += 2;
  return score;
}

function primaryCategory(category) {
  const text = String(category || "").toLowerCase();
  if (text.includes("hvac") || text.includes("heating") || text.includes("cooling")) return "hvac";
  if (text.includes("plumb")) return "plumbing";
  if (text.includes("electric")) return "electrical";
  if (text.includes("pest") || text.includes("termite")) return "pest";
  if (text.includes("roof")) return "roofing";
  if (text.includes("landscap") || text.includes("lawn")) return "landscaping";
  if (text.includes("property")) return "property-manager";
  if (text.includes("single") || text.includes("house")) return "single-family";
  if (text.includes("senior")) return "senior";
  return "apartment";
}

function inferServiceTags(item) {
  const text = [item.name, item.category, item.evidence, item.evidenceNote, item.sourceUrl].filter(Boolean).join(" ").toLowerCase();
  const tags = [];
  if (/\b(hvac|h\.?v\.?a\.?c\.?|heating|cooling|air conditioning|air-conditioning|a\/c|ac repair|furnace|heat pump|refrigeration)\b/i.test(text)) tags.push("HVAC");
  if (/\b(electric|electrical|electrician|lighting|generator|panel|ev charger)\b/i.test(text)) tags.push("Electrical");
  if (/\b(plumb\w*|sewer|drain|water heater|septic)\b/i.test(text)) tags.push("Plumbing");
  if (/\b(pest|termite|exterminat\w*|mosquito|rodent|wildlife|bed bug|bug control|ant control)\b/i.test(text)) tags.push("Pest");
  return tags.length ? tags : ["Other"];
}

function dedupeRecords(records) {
  const seen = new Set();
  return records.filter((item) => {
    const key = recordKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recordKey(item) {
  const name = String(item.name || "").toLowerCase().replace(/\b(llc|inc|co|company|services|service)\b/g, "").replace(/[^a-z0-9]/g, "");
  const url = canonicalUrl(item.sourceUrl);
  return `${name}|${url}`;
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function isPublicUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return Boolean(host) && !host.includes("serpapi.com");
  } catch {
    return false;
  }
}

function looksOfficial(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return !/(apartments.com|zillow.com|realtor.com|trulia.com|homes.com|redfin.com|yelp.com|apartmentfinder.com|apartmentguide.com|rent.com|manta.com|yellowpages.com|mapquest.com|chamberofcommerce.com)/.test(host);
  } catch {
    return false;
  }
}

function summarizeDashboard(dashboard) {
  const summary = {};
  for (const [state, cities] of Object.entries(dashboard.states || {})) {
    summary[state] = {};
    for (const [city, payload] of Object.entries(cities)) {
      summary[state][city] = {
        services: payload.services?.length || 0,
        rentals: payload.rentals?.length || 0
      };
    }
  }
  return summary;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
