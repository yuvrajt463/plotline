import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DASHBOARD = path.join(ROOT, "apps", "web", "public", "data", "manual-research.json");
const FINAL = path.join(ROOT, "apps", "web", "public", "data", "final-market-research.json");

const services = [
  service("daphne-service-baldwin-cooling", "Baldwin Cooling, Heating, Plumbing & Electrical", "HVAC, plumbing, electrical, generators", "regional", "10554 County Road 64, Daphne, AL 36526", "https://baldwinhvac.com/locations/daphne/", "Official Daphne location page lists HVAC, plumbing, generator and air-conditioning services at 10554 County Road 64 in Daphne."),
  service("daphne-service-ac-solutions", "AC Solutions", "HVAC", "local", "8871 Rand Ave, Daphne, AL 36526", "https://www.theacsolutions.com/", "Official site says AC Solutions provides HVAC services in Daphne and Baldwin County and lists 8871 Rand Ave in Daphne."),
  service("daphne-service-air-solutions", "Air Solutions Heating & Cooling", "HVAC", "local", "Daphne, AL", "https://airsolutionspros.com/", "Official site says Air Solutions is locally owned, based in Daphne, and serves Daphne plus Baldwin County."),
  service("daphne-service-5-starr-heating", "5 Starr Heating and Air", "HVAC", "local", "Daphne, AL", "https://www.5starrheatingandair.com/about-us", "Official about page says 5 Starr Heating and Air was founded in Daphne, AL and provides HVAC contractor services."),
  service("daphne-service-5-starr-plumbing", "5 Starr Plumbing", "plumbing", "local", "Daphne, AL", "https://www.5starrplumbing.com/", "Official site says 5 Starr Plumbing is located in Daphne, Alabama and serves Baldwin County with plumbing repairs, remodels, drain cleaning and water heaters."),
  service("daphne-service-sasser-electrical", "Sasser Electrical Services, Inc.", "electrical", "regional", null, "https://www.sasserelectric.com/", "Official site says Sasser provides electrical services for Daphne, AL homes and businesses."),
  service("daphne-service-bayview-roof-works", "Bayview Roof Works", "roofing", "local", "1410 US-98 Suite E, Daphne, AL 36526", "https://bayviewroofworks.com/roofing-contractors-daphne-al/", "Official Daphne roofing page says Bayview Roof Works is based in Daphne and provides roof repair, replacement, metal roofing, commercial roofing and inspections."),
  service("daphne-service-advanced-pest", "Advanced Pest Control of Alabama", "pest control", "regional", null, "https://pestcontrolalabama.com/our-service-areas/pest-control-daphne-al", "Official Daphne page says Advanced Pest Control serves Daphne customers with pest and termite control."),
  service("daphne-service-arrow-exterminators", "Arrow Exterminators Eastern Shore Service Center", "pest control", "chain", "Daphne, AL service area", "https://www.arrowexterminators.com/alabama/eastern-shore-service-center", "Official Eastern Shore service-center page supports the Daphne-area pest-control footprint."),
  service("daphne-service-sexton-landscape", "Sexton Lawn & Landscape", "landscaping, lawn care, irrigation", "regional", "Daphne, AL service area", "https://www.sextonlandscapes.com/sexton-landscaping-service-areas/landscaping-company-company-daphne/", "Official Daphne service-area page says Sexton offers lawn maintenance, landscaping design, irrigation and installation services in Daphne."),
  service("daphne-service-bayside-plumbing", "Bayside Plumbing", "plumbing", "local", "Daphne, AL service area", "http://www.bayside-plumbing.com/", "Company site and Serp local result identify Bayside Plumbing as a Daphne-area plumbing contractor."),
  service("daphne-service-waynes-pest", "Waynes Pest Control", "pest control", "regional", "Daphne, AL service area", "https://callwaynes.com/alabama/daphne-pest-control/", "Official Daphne page lists pest-control service for Daphne, Alabama.")
];

const rentals = [
  rental("daphne-rental-grande-pointe", "Grande Pointe Apartment Homes", "apartment community", "Management source", "https://www.grandepointeapts.com/", "133 Lake Front Drive, Daphne, AL 36526", "https://www.grandepointeapts.com/", "Official site says Grande Pointe is an apartment community in Daphne and lists 133 Lake Front Drive."),
  rental("daphne-rental-palladian", "Palladian at Daphne Apartment Homes", "apartment community", "Management source", "https://www.palladianatdaphne.com/", "27821 AL-181, Daphne, AL 36526", "https://www.palladianatdaphne.com/", "Official site says Palladian at Daphne Apartment Homes is in Daphne and lists apartment floor plans and amenities."),
  rental("daphne-rental-windscape", "Windscape at Daphne", "apartment community", "Management source", "https://www.windscapeatdaphne.com/", "27670 US-98, Daphne, AL 36526", "https://www.windscapeatdaphne.com/", "Official site lists one- and two-bedroom apartments in Daphne and gives the 27670 US-98 address."),
  rental("daphne-rental-arbors-by-the-bay", "Arbors By The Bay", "apartment community", "SPM", "https://spm.net/", "27642 US Highway 98, Daphne, AL 36526", "https://spm.net/properties/arbors-by-the-bay/", "SPM property page lists Arbors By The Bay in Daphne with one-, two- and three-bedroom apartments."),
  rental("daphne-rental-colonnade-eastern-shore", "Colonnade at Eastern Shore", "apartment community", "Management source", "https://www.daphneapartments.com/", "830 Highway 98, Daphne, AL 36526", "https://www.daphneapartments.com/", "Official site lists Colonnade at Eastern Shore as pet-friendly one-, two- and three-bedroom apartments in Daphne."),
  rental("daphne-rental-park-whispering-pines", "The Park at Whispering Pines", "apartment community", "Management source", "https://www.whisperingpinesal.com/", "26920 Pollard Road, Daphne, AL 36526", "https://www.whisperingpinesal.com/", "Official site lists one-, two- and three-bedroom apartments at 26920 Pollard Road in Daphne."),
  rental("daphne-rental-belforest-villas", "Belforest Villas", "apartment community", "Management source", "https://www.belforestvillas.com/", "8964 Rand Ave, Daphne, AL 36526", "https://www.belforestvillas.com/", "Official site says Belforest Villas offers one-, two- and three-bedroom apartments for rent in Daphne and lists 8964 Rand Ave."),
  rental("daphne-rental-east-bay", "East Bay Apartments", "apartment community", "Management source", "https://eastbayapartmenthomes.com/", "2200 East Bay Drive, Daphne, AL 36526", "https://eastbayapartmenthomes.com/", "Official site lists East Bay Apartments at 2200 East Bay Drive in Daphne."),
  rental("daphne-rental-bay-breeze", "Bay Breeze Apartment Homes", "apartment community", "Management source", "https://www.apartments.com/bay-breeze-apartment-homes-daphne-al/g1b6mjz/", "29150 Lake Forest Blvd, Daphne, AL 36526", "https://www.apartments.com/bay-breeze-apartment-homes-daphne-al/g1b6mjz/", "Apartments.com verified listing places Bay Breeze Apartment Homes at 29150 Lake Forest Blvd in Daphne.")
];

async function main() {
  const dashboard = JSON.parse(await fs.readFile(DASHBOARD, "utf8"));
  dashboard.generatedAt = new Date().toISOString();
  dashboard.states.AL.Daphne.services = services;
  dashboard.states.AL.Daphne.rentals = rentals;
  await fs.writeFile(DASHBOARD, `${JSON.stringify(dashboard, null, 2)}\n`);

  try {
    const final = JSON.parse(await fs.readFile(FINAL, "utf8"));
    final.generatedAt = dashboard.generatedAt;
    final.states.AL.Daphne.dashboard.services = services;
    final.states.AL.Daphne.dashboard.rentals = rentals;
    final.states.AL.Daphne.manualDaphneCorrection = {
      generatedAt: dashboard.generatedAt,
      note: "Curated Daphne override after manual verification of official public pages.",
      services,
      rentals
    };
    await fs.writeFile(FINAL, `${JSON.stringify(final, null, 2)}\n`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  console.log(`Daphne fixed: ${services.length} services, ${rentals.length} for-rent housing records`);
}

function service(id, name, category, marketClass, address, sourceUrl, evidence) {
  return { id, name, category, serviceTags: inferServiceTags({ name, category, evidence, sourceUrl }), marketClass, address, sourceUrl, evidence, source: "Manual Daphne verification" };
}

function rental(id, name, category, managementCompany, managementCompanyUrl, address, sourceUrl, evidence) {
  return { id, name, category, managementCompany, managementCompanyUrl, locationUrl: sourceUrl, address, sourceUrl, evidence, source: "Manual Daphne verification" };
}

function inferServiceTags(service) {
  const text = [service.name, service.category, service.evidence, service.sourceUrl].filter(Boolean).join(" ").toLowerCase();
  const tags = [];
  if (/\b(hvac|heating|cooling|air conditioning|air-conditioning|a\/c|furnace|heat pump)\b/.test(text)) tags.push("HVAC");
  if (/\b(electric|electrical|electrician|lighting|generator|panel|ev charger)\b/.test(text)) tags.push("Electrical");
  if (/\b(plumb\w*|sewer|drain|water heater|septic)\b/.test(text)) tags.push("Plumbing");
  if (/\b(pest|termite|exterminat\w*|mosquito|rodent|wildlife|bed bug)\b/.test(text)) tags.push("Pest");
  return tags.length ? tags : ["Other"];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
