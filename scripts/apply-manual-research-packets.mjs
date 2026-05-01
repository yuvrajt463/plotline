import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const UPDATES = path.join(ROOT, "data", "manual-research-updates.json");

const packets = {
  AL: {
    Calera: {
      services: [
        {
          id: "calera-al-svc-active-air",
          name: "Active Air",
          category: "HVAC",
          marketClass: "local",
          address: "Calera, AL",
          sourceUrl: "https://activeairal.com/",
          evidence: "Official site describes Active Air as a Calera-area heating and cooling contractor."
        },
        {
          id: "calera-al-svc-covenant-heating-cooling",
          name: "Covenant Heating & Cooling",
          category: "HVAC",
          marketClass: "regional",
          address: "Shelby County, AL",
          sourceUrl: "https://www.covenantheatingandcooling.com/service-area/calera-al/",
          evidence: "Official Calera service-area page lists HVAC repair, replacement, maintenance, and indoor air services."
        },
        {
          id: "calera-al-svc-kalos-hvac",
          name: "Kalos HVAC",
          category: "HVAC",
          marketClass: "regional",
          address: "Greater Birmingham area",
          sourceUrl: "https://kalos-hvac.com/service-areas/calera-al/",
          evidence: "Official service-area page says Kalos HVAC serves Calera with heating and air conditioning services."
        },
        {
          id: "calera-al-svc-the-plumbers",
          name: "The Plumbers LLC",
          category: "plumbing",
          marketClass: "regional",
          address: "Calera, AL service area",
          sourceUrl: "https://theplumbersllc.com/plumbing-company-calera-al/",
          evidence: "Official Calera plumbing page lists water heaters, drains, leaks, sewer, and emergency plumbing."
        },
        {
          id: "calera-al-svc-paramount-plumbing",
          name: "Paramount Plumbing",
          category: "plumbing",
          marketClass: "regional",
          address: "Shelby County, AL",
          sourceUrl: "https://paramountplumbing.com/plumber-calera-al/",
          evidence: "Official Calera page says Paramount Plumbing provides residential and commercial plumbing services."
        },
        {
          id: "calera-al-svc-total-home-electric",
          name: "Total Home Electric",
          category: "electrical",
          marketClass: "regional",
          address: "Calera, AL service area",
          sourceUrl: "https://totalhomeelectric.com/electrician-calera-al/",
          evidence: "Official Calera electrician page lists panel upgrades, lighting, generators, and electrical repairs."
        },
        {
          id: "calera-al-svc-advanced-electrical",
          name: "Advanced Electrical Company",
          category: "electrical",
          marketClass: "regional",
          address: "Central Alabama",
          sourceUrl: "https://advancedelectrical.com/",
          evidence: "Official site lists residential, commercial, and industrial electrical services for Central Alabama."
        },
        {
          id: "calera-al-svc-farmers-pest",
          name: "Farmer's Pest Control",
          category: "pest control",
          marketClass: "regional",
          address: "Calera, AL service area",
          sourceUrl: "https://www.farmerspestcontrol.com/pest-control-calera-al/",
          evidence: "Official Calera service page lists pest, termite, mosquito, and wildlife control services."
        },
        {
          id: "calera-al-svc-hosey-roofing",
          name: "Hosey Roofing",
          category: "roofing",
          marketClass: "local",
          address: "Calera, AL service area",
          sourceUrl: "https://hoseyroofing.com/",
          evidence: "Official site lists roof repair, roof replacement, storm damage, and inspections in the Calera region."
        },
        {
          id: "calera-al-svc-deep-green-lawn-care",
          name: "Deep Green Lawn Care",
          category: "landscaping",
          marketClass: "regional",
          address: "Shelby County, AL",
          sourceUrl: "https://deepgreenlawncare.com/lawn-care-calera-al/",
          evidence: "Official Calera page lists lawn care, weed control, fertilization, and mosquito control."
        }
      ],
      rentals: [
        {
          id: "calera-al-rent-lancaster-place",
          name: "Lancaster Place",
          category: "apartment community",
          managementCompany: null,
          address: "11748 Highway 25, Calera, AL 35040",
          sourceUrl: "https://www.apartments.com/lancaster-place-calera-al/b8yldm8/",
          evidence: "Apartments.com lists Lancaster Place as a Calera apartment community with floor plans and rental details."
        },
        {
          id: "calera-al-rent-south-pointe",
          name: "South Pointe",
          category: "apartment community",
          managementCompany: null,
          address: "Calera, AL",
          sourceUrl: "https://www.apartments.com/south-pointe-calera-al/0k4fl8m/",
          evidence: "Apartments.com lists South Pointe in Calera with apartment community details."
        },
        {
          id: "calera-al-rent-seth-davis-gardens",
          name: "Seth Davis Gardens",
          category: "apartment community",
          managementCompany: null,
          address: "Calera, AL",
          sourceUrl: "https://www.apartments.com/seth-davis-gardens-calera-al/dmyb3qk/",
          evidence: "Apartments.com identifies Seth Davis Gardens as an apartment community in Calera."
        },
        {
          id: "calera-al-rent-hill-brook-manor",
          name: "Hill Brook Manor",
          category: "apartment community",
          managementCompany: null,
          address: "Calera, AL",
          sourceUrl: "https://www.apartments.com/hill-brook-manor-calera-al/y2cmmpx/",
          evidence: "Apartments.com lists Hill Brook Manor as a Calera rental community."
        },
        {
          id: "calera-al-rent-progress-residential",
          name: "Progress Residential Calera Homes",
          category: "single-family rentals",
          managementCompany: "Progress Residential",
          address: "Calera, AL",
          sourceUrl: "https://rentprogress.com/houses-for-rent/calera-al",
          evidence: "Progress Residential has a Calera search page for available single-family rental homes."
        },
        {
          id: "calera-al-rent-firstkey",
          name: "FirstKey Homes Calera",
          category: "single-family rentals",
          managementCompany: "FirstKey Homes",
          address: "Calera, AL",
          sourceUrl: "https://www.firstkeyhomes.com/homes-for-rent/calera-al",
          evidence: "FirstKey Homes has a Calera homes-for-rent page with available rental inventory."
        },
        {
          id: "calera-al-rent-alabama-rental-managers",
          name: "Alabama Rental Managers",
          category: "property manager",
          managementCompany: "Alabama Rental Managers",
          address: "Calera, AL service area",
          sourceUrl: "https://www.alabamarentalmanagers.com/houses-for-rent",
          evidence: "Property manager rental page lists houses for rent in the Birmingham/Shelby County market including Calera-area inventory."
        }
      ]
    },
    Foley: {
      services: [
        {
          id: "foley-al-svc-pride-hvac",
          name: "PRIDE Heating and Air",
          category: "HVAC",
          marketClass: "local",
          address: "Foley, AL",
          sourceUrl: "https://prideheatingandair.com/",
          evidence: "Official site identifies PRIDE Heating and Air as a Foley-area HVAC company."
        },
        {
          id: "foley-al-svc-gulf-coast-hvac",
          name: "Gulf Coast HVAC",
          category: "HVAC",
          marketClass: "local",
          address: "Foley, AL service area",
          sourceUrl: "https://gulfcoast-hvac.com/",
          evidence: "Official site lists heating, cooling, maintenance, and installation services on the Alabama Gulf Coast."
        },
        {
          id: "foley-al-svc-ez-flow",
          name: "EZ-Flow Plumbing & Drain",
          category: "plumbing",
          marketClass: "local",
          address: "Foley, AL",
          sourceUrl: "https://ezflowplumbingal.com/",
          evidence: "Official site lists Foley plumbing, drain cleaning, water heaters, and emergency plumbing services."
        },
        {
          id: "foley-al-svc-se-tradesmen",
          name: "SE Tradesmen",
          category: "plumbing, electrical, HVAC",
          marketClass: "regional",
          address: "Foley, AL service area",
          sourceUrl: "https://www.setradesmen.com/",
          evidence: "Official site lists trade services including plumbing, electrical, HVAC, and home services for the Gulf Coast."
        },
        {
          id: "foley-al-svc-taurus-electrical",
          name: "Taurus Electrical",
          category: "electrical",
          marketClass: "local",
          address: "Foley, AL",
          sourceUrl: "https://tauruselectrical.com/",
          evidence: "Official site describes residential and commercial electrical services in Foley and nearby communities."
        },
        {
          id: "foley-al-svc-south-baldwin-electric",
          name: "South Baldwin Electric",
          category: "electrical",
          marketClass: "local",
          address: "Foley, AL",
          sourceUrl: "https://southbaldwinelectric.com/",
          evidence: "Official site lists electrical services for Foley and South Baldwin County."
        },
        {
          id: "foley-al-svc-rogue-pest",
          name: "Rogue Pest Solutions",
          category: "pest control",
          marketClass: "regional",
          address: "Foley, AL service area",
          sourceUrl: "https://roguepestsolutions.com/pest-control-foley-al/",
          evidence: "Official Foley pest-control page lists residential pest, termite, mosquito, and rodent control."
        },
        {
          id: "foley-al-svc-arrow-exterminators",
          name: "Arrow Exterminators",
          category: "pest control",
          marketClass: "chain",
          address: "Foley, AL service area",
          sourceUrl: "https://www.arrowexterminators.com/alabama/foley-service-center",
          evidence: "Official service-center page lists Arrow Exterminators' Foley-area pest and termite services."
        },
        {
          id: "foley-al-svc-high-tide-roofing",
          name: "High Tide Roofing",
          category: "roofing",
          marketClass: "local",
          address: "Foley, AL service area",
          sourceUrl: "https://hightideroofing.com/",
          evidence: "Official site lists roof replacement, repair, and storm-damage services on the Gulf Coast."
        },
        {
          id: "foley-al-svc-wolff-lawn",
          name: "Wolff Lawn & Landscape",
          category: "landscaping",
          marketClass: "local",
          address: "Foley, AL service area",
          sourceUrl: "https://wolfflawnandlandscape.com/",
          evidence: "Official site lists lawn maintenance, landscaping, irrigation, and hardscape services near Foley."
        }
      ],
      rentals: [
        {
          id: "foley-al-rent-outpost-orchard",
          name: "Outpost Orchard",
          category: "apartment community",
          managementCompany: null,
          address: "Foley, AL",
          sourceUrl: "https://www.outpostorchard.com/",
          evidence: "Official property site presents Outpost Orchard as a Foley apartment community with floor plans and leasing."
        },
        {
          id: "foley-al-rent-allier",
          name: "Allier Foley",
          category: "apartment community",
          managementCompany: null,
          address: "Foley, AL",
          sourceUrl: "https://www.allierfoley.com/",
          evidence: "Official site lists Allier Foley apartments with floor plans, amenities, and leasing calls to action."
        },
        {
          id: "foley-al-rent-village-hickory",
          name: "Village at Hickory Street",
          category: "apartment community",
          managementCompany: null,
          address: "Foley, AL",
          sourceUrl: "https://www.apartments.com/village-at-hickory-street-foley-al/6lgnfww/",
          evidence: "Apartments.com lists Village at Hickory Street as a Foley apartment community."
        },
        {
          id: "foley-al-rent-reserve-of-foley",
          name: "Reserve of Foley",
          category: "apartment community",
          managementCompany: null,
          address: "Foley, AL",
          sourceUrl: "https://www.apartments.com/reserve-of-foley-foley-al/vq4b8yb/",
          evidence: "Apartments.com lists Reserve of Foley with apartment community details and rental context."
        },
        {
          id: "foley-al-rent-edison-shores",
          name: "Edison at the Shores",
          category: "apartment community",
          managementCompany: null,
          address: "Foley, AL",
          sourceUrl: "https://www.edisonattheshores.com/",
          evidence: "Official site lists Edison at the Shores as a Foley-area apartment community with floor plans and leasing."
        },
        {
          id: "foley-al-rent-las-colinas",
          name: "Las Colinas",
          category: "apartment community",
          managementCompany: null,
          address: "Foley, AL",
          sourceUrl: "https://www.apartments.com/las-colinas-foley-al/vj20gm0/",
          evidence: "Apartments.com identifies Las Colinas as a Foley apartment community."
        },
        {
          id: "foley-al-rent-cottages-foley-farms",
          name: "Cottages at Foley Farms",
          category: "rental-home community",
          managementCompany: null,
          address: "Foley, AL",
          sourceUrl: "https://www.cottagesatfoleyfarms.com/",
          evidence: "Official site presents Cottages at Foley Farms as a Foley rental-home community with leasing information."
        }
      ]
    },
    Tallassee: {
      services: [
        {
          id: "tallassee-al-svc-halls-heating",
          name: "Hall's Heating & Cooling",
          category: "HVAC",
          marketClass: "local",
          address: "Tallassee, AL",
          sourceUrl: "https://www.hallsheatingandair.com/",
          evidence: "Official site lists HVAC repair, replacement, maintenance, and indoor air services around Tallassee."
        },
        {
          id: "tallassee-al-svc-aes-mechanical",
          name: "AES Mechanical",
          category: "HVAC",
          marketClass: "regional",
          address: "Tallassee, AL service area",
          sourceUrl: "https://www.aesmechanical.com/",
          evidence: "Official site lists commercial and residential mechanical/HVAC services in Central Alabama."
        },
        {
          id: "tallassee-al-svc-cole-plumbing",
          name: "Cole Plumbing",
          category: "plumbing",
          marketClass: "regional",
          address: "Tallassee, AL service area",
          sourceUrl: "https://coleplumbing.com/plumber-tallassee-al/",
          evidence: "Official Tallassee page lists plumbing repair, water heaters, drain cleaning, and sewer services."
        },
        {
          id: "tallassee-al-svc-whitworth-electric",
          name: "Whitworth Electric",
          category: "electrical",
          marketClass: "local",
          address: "Tallassee, AL service area",
          sourceUrl: "https://www.whitworthelectric.com/",
          evidence: "Official site lists residential, commercial, and industrial electrical services in Central Alabama."
        },
        {
          id: "tallassee-al-svc-ce-electric",
          name: "C&E Electric",
          category: "electrical",
          marketClass: "regional",
          address: "Tallassee, AL service area",
          sourceUrl: "https://www.ceelectric.net/",
          evidence: "Official site lists electrical contracting and service work for Central Alabama customers."
        },
        {
          id: "tallassee-al-svc-riverside-pest",
          name: "Riverside Pest Control",
          category: "pest control",
          marketClass: "local",
          address: "Tallassee, AL",
          sourceUrl: "https://riversidepestcontrol.com/",
          evidence: "Official site describes pest and termite control service for Tallassee and nearby communities."
        },
        {
          id: "tallassee-al-svc-river-region-roofing",
          name: "River Region Roofing",
          category: "roofing",
          marketClass: "regional",
          address: "Tallassee, AL service area",
          sourceUrl: "https://riverregionroofing.com/",
          evidence: "Official site lists roofing repair, replacement, storm damage, and inspection services in the River Region."
        },
        {
          id: "tallassee-al-svc-envirogreen",
          name: "Envirogreen Lawn & Landscape",
          category: "landscaping",
          marketClass: "regional",
          address: "Tallassee, AL service area",
          sourceUrl: "https://envirogreenalabama.com/",
          evidence: "Official site lists lawn care, landscape, irrigation, and outdoor maintenance services in Central Alabama."
        }
      ],
      rentals: [
        {
          id: "tallassee-al-rent-villas",
          name: "Tallassee Villas LTD",
          category: "apartment community",
          managementCompany: null,
          address: "Tallassee, AL",
          sourceUrl: "https://www.apartments.com/tallassee-villas-tallassee-al/0wyk2m9/",
          evidence: "Apartments.com identifies Tallassee Villas as an apartment community in Tallassee."
        },
        {
          id: "tallassee-al-rent-5370-hwy-229",
          name: "5370 State Highway 229",
          category: "single-family rental",
          managementCompany: null,
          address: "5370 State Highway 229, Tallassee, AL",
          sourceUrl: "https://www.zillow.com/tallassee-al/rent-houses/",
          evidence: "Zillow Tallassee rental results include a house for rent at 5370 State Highway 229."
        },
        {
          id: "tallassee-al-rent-55-martin-ridge",
          name: "55 Martin Ridge Trce",
          category: "single-family rental",
          managementCompany: null,
          address: "55 Martin Ridge Trce, Tallassee, AL",
          sourceUrl: "https://www.zillow.com/tallassee-al/rent-houses/",
          evidence: "Zillow Tallassee rental results include a house for rent at 55 Martin Ridge Trce."
        },
        {
          id: "tallassee-al-rent-213-central",
          name: "213 Central Blvd",
          category: "single-family rental",
          managementCompany: null,
          address: "213 Central Blvd, Tallassee, AL",
          sourceUrl: "https://www.realtor.com/apartments/Tallassee_AL",
          evidence: "Realtor.com Tallassee rental results list 213 Central Blvd as a rental property."
        },
        {
          id: "tallassee-al-rent-312-king-c",
          name: "312 King St #C",
          category: "apartment rental",
          managementCompany: null,
          address: "312 King St #C, Tallassee, AL",
          sourceUrl: "https://www.apartments.com/tallassee-al/",
          evidence: "Apartments.com Tallassee results include 312 King St #C as a rental listing."
        },
        {
          id: "tallassee-al-rent-quail-run",
          name: "Quail Run Apartments",
          category: "apartment community",
          managementCompany: null,
          address: "Tallassee, AL",
          sourceUrl: "https://www.apartments.com/quail-run-apartments-tallassee-al/2h7z4hm/",
          evidence: "Apartments.com identifies Quail Run Apartments as a Tallassee apartment community."
        },
        {
          id: "tallassee-al-rent-garden-apartments",
          name: "Tallassee Garden Apartments",
          category: "apartment community",
          managementCompany: null,
          address: "Tallassee, AL",
          sourceUrl: "https://www.apartments.com/tallassee-garden-apartments-tallassee-al/g6dvr3w/",
          evidence: "Apartments.com identifies Tallassee Garden Apartments as a Tallassee rental community."
        }
      ]
    }
  },
  GA: {
    Lovejoy: {
      services: [
        {
          id: "lovejoy-ga-svc-trinity-air",
          name: "Trinity Air Heating & Air Conditioning",
          category: "HVAC",
          marketClass: "regional",
          address: "Lovejoy, GA service area",
          sourceUrl: "https://www.trinityair.com/lovejoy-ga-heating-air-conditioning/",
          evidence: "Official Lovejoy page lists heating and air conditioning services for Lovejoy homeowners."
        },
        {
          id: "lovejoy-ga-svc-rooter-rooter",
          name: "Rooter Rooter",
          category: "plumbing",
          marketClass: "regional",
          address: "Lovejoy, GA service area",
          sourceUrl: "https://rooterrooter.com/plumber-lovejoy-ga/",
          evidence: "Official Lovejoy plumbing page lists drain cleaning, sewer, water heater, and emergency plumbing."
        },
        {
          id: "lovejoy-ga-svc-daps",
          name: "DAPS Services",
          category: "electrical, plumbing, HVAC",
          marketClass: "regional",
          address: "Lovejoy, GA service area",
          sourceUrl: "https://dapsservices.com/",
          evidence: "Official site lists HVAC, plumbing, and electrical services in the south Atlanta market."
        },
        {
          id: "lovejoy-ga-svc-maddox",
          name: "Maddox Comfort Systems",
          category: "HVAC",
          marketClass: "regional",
          address: "South Metro Atlanta",
          sourceUrl: "https://www.maddoxcomfort.com/",
          evidence: "Official site lists heating, cooling, and indoor air services for the south metro Atlanta area."
        },
        {
          id: "lovejoy-ga-svc-boom-boom-electric",
          name: "Boom Boom Electric",
          category: "electrical",
          marketClass: "local",
          address: "Lovejoy, GA service area",
          sourceUrl: "https://www.houzz.com/professionals/electricians/boom-boom-electric-pfvwus-pf~1888543147",
          evidence: "Houzz profile identifies Boom Boom Electric as an electrical professional serving the area."
        },
        {
          id: "lovejoy-ga-svc-atlanta-roofers",
          name: "Atlanta Roofers Professionals",
          category: "roofing",
          marketClass: "regional",
          address: "Lovejoy, GA service area",
          sourceUrl: "https://atlantarooferspros.com/roofing-lovejoy-ga/",
          evidence: "Service-area page lists roofing services in Lovejoy."
        },
        {
          id: "lovejoy-ga-svc-benson-lawns",
          name: "Benson Lawns",
          category: "landscaping",
          marketClass: "local",
          address: "Lovejoy, GA service area",
          sourceUrl: "https://bensonlawns.com/",
          evidence: "Official site lists lawn care and landscaping services in the south metro Atlanta area."
        },
        {
          id: "lovejoy-ga-svc-duncans-green-team",
          name: "Duncan's Green Team",
          category: "landscaping",
          marketClass: "local",
          address: "Lovejoy, GA service area",
          sourceUrl: "https://duncansgreenteam.com/",
          evidence: "Official site lists lawn maintenance and landscape services in the Lovejoy/south metro market."
        }
      ],
      rentals: [
        {
          id: "lovejoy-ga-rent-lakeside-villas",
          name: "Lakeside Villas",
          category: "apartment community",
          managementCompany: null,
          address: "Lovejoy, GA",
          sourceUrl: "https://www.apartments.com/lakeside-villas-lovejoy-ga/h1cg3fx/",
          evidence: "Apartments.com lists Lakeside Villas as a Lovejoy apartment community."
        },
        {
          id: "lovejoy-ga-rent-walden-landing",
          name: "Walden Landing",
          category: "apartment community",
          managementCompany: null,
          address: "Lovejoy, GA",
          sourceUrl: "https://www.waldenlanding.com/",
          evidence: "Official site lists Walden Landing apartments with floor plans, amenities, and leasing."
        },
        {
          id: "lovejoy-ga-rent-quinn-pates-creek",
          name: "Quinn Residences at Pates Creek",
          category: "rental-home community",
          managementCompany: "Quinn Residences",
          address: "Hampton/Lovejoy area",
          sourceUrl: "https://www.quinnresidences.com/apartments/ga/hampton/quinn-residences-at-pates-creek/",
          evidence: "Official Quinn Residences page lists rental homes near Lovejoy in the Hampton/Pates Creek market."
        },
        {
          id: "lovejoy-ga-rent-madison-heights",
          name: "Madison Heights",
          category: "apartment community",
          managementCompany: null,
          address: "Lovejoy, GA area",
          sourceUrl: "https://www.apartments.com/madison-heights-lovejoy-ga/72vepw4/",
          evidence: "Apartments.com lists Madison Heights in the Lovejoy rental market."
        },
        {
          id: "lovejoy-ga-rent-villas-hampton",
          name: "Villas at Hampton",
          category: "rental-home community",
          managementCompany: null,
          address: "Hampton/Lovejoy area",
          sourceUrl: "https://www.villasathampton.com/",
          evidence: "Official site presents Villas at Hampton as a rental-home community near Lovejoy."
        }
      ]
    },
    Jonesboro: {
      services: [
        {
          id: "jonesboro-ga-svc-apex",
          name: "Apex Residential Solutions",
          category: "HVAC, plumbing, electrical",
          marketClass: "regional",
          address: "Jonesboro, GA service area",
          sourceUrl: "https://apexresidentialsolutions.com/jonesboro-ga/",
          evidence: "Official Jonesboro page lists HVAC, plumbing, and electrical services."
        },
        {
          id: "jonesboro-ga-svc-champion",
          name: "Champion HVAC & Plumbing",
          category: "HVAC, plumbing",
          marketClass: "regional",
          address: "Jonesboro, GA service area",
          sourceUrl: "https://www.championhvacplumbing.com/service-area/jonesboro-ga/",
          evidence: "Official service-area page says Champion provides HVAC and plumbing services in Jonesboro."
        },
        {
          id: "jonesboro-ga-svc-brads-plumbing",
          name: "Brad's Plumbing",
          category: "plumbing",
          marketClass: "local",
          address: "Jonesboro, GA service area",
          sourceUrl: "https://www.bradsplumbing.com/plumber-jonesboro-ga/",
          evidence: "Official Jonesboro page lists residential and commercial plumbing services."
        },
        {
          id: "jonesboro-ga-svc-morton-electric",
          name: "Charles R Morton Electric",
          category: "electrical",
          marketClass: "local",
          address: "Jonesboro, GA",
          sourceUrl: "https://www.mortonelectricinc.com/",
          evidence: "Official site identifies the company as an electrical contractor serving Jonesboro and metro Atlanta."
        },
        {
          id: "jonesboro-ga-svc-massey",
          name: "Massey Services",
          category: "pest control",
          marketClass: "chain",
          address: "Jonesboro, GA service area",
          sourceUrl: "https://www.masseyservices.com/jonesboro/pest-control/",
          evidence: "Official Jonesboro page lists pest prevention, termite protection, mosquito, and lawn services."
        },
        {
          id: "jonesboro-ga-svc-lamars-landscaping",
          name: "Lamar's Landscaping",
          category: "landscaping",
          marketClass: "local",
          address: "Jonesboro, GA service area",
          sourceUrl: "https://lamarslandscaping.com/",
          evidence: "Official site lists landscaping, lawn maintenance, and outdoor services near Jonesboro."
        },
        {
          id: "jonesboro-ga-svc-bw-roofing",
          name: "B & W Roofing/Gutters",
          category: "roofing",
          marketClass: "local",
          address: "Jonesboro, GA service area",
          sourceUrl: "https://www.bandwroofinggutters.com/",
          evidence: "Official site lists roofing and gutter services in the south metro Atlanta area."
        }
      ],
      rentals: [
        {
          id: "jonesboro-ga-rent-hearthside",
          name: "HearthSide Jonesboro",
          category: "senior apartment community",
          managementCompany: "OneStreet Residential",
          address: "Jonesboro, GA",
          sourceUrl: "https://www.onestreetres.com/apartments/ga/jonesboro/hearthside-jonesboro/",
          evidence: "Official OneStreet page lists HearthSide Jonesboro apartments with leasing and community details."
        },
        {
          id: "jonesboro-ga-rent-vida-cottages",
          name: "Vida at Cottages",
          category: "rental-home community",
          managementCompany: null,
          address: "Jonesboro, GA",
          sourceUrl: "https://www.vidaatcottages.com/",
          evidence: "Official site presents Vida at Cottages as a Jonesboro rental community."
        },
        {
          id: "jonesboro-ga-rent-carrington-park",
          name: "Carrington Park",
          category: "apartment community",
          managementCompany: null,
          address: "Jonesboro, GA",
          sourceUrl: "https://www.apartments.com/carrington-park-jonesboro-ga/lwws8bn/",
          evidence: "Apartments.com lists Carrington Park as a Jonesboro apartment community."
        },
        {
          id: "jonesboro-ga-rent-flint-river",
          name: "Flint River Apartments",
          category: "apartment community",
          managementCompany: null,
          address: "Jonesboro, GA",
          sourceUrl: "https://www.apartments.com/flint-river-apartments-jonesboro-ga/m1w0em2/",
          evidence: "Apartments.com lists Flint River Apartments in Jonesboro."
        },
        {
          id: "jonesboro-ga-rent-fieldstone",
          name: "Fieldstone by Trion Living",
          category: "apartment community",
          managementCompany: "Trion Living",
          address: "Jonesboro, GA",
          sourceUrl: "https://www.trionliving.com/apartments/ga/jonesboro/fieldstone/",
          evidence: "Official Trion Living page lists Fieldstone apartments in Jonesboro with leasing information."
        },
        {
          id: "jonesboro-ga-rent-pointe-south",
          name: "Pointe South Townhomes",
          category: "townhome community",
          managementCompany: null,
          address: "Jonesboro, GA",
          sourceUrl: "https://www.apartments.com/pointe-south-townhomes-jonesboro-ga/wms72xb/",
          evidence: "Apartments.com identifies Pointe South Townhomes as a Jonesboro rental community."
        }
      ]
    },
    Jefferson: {
      services: [
        {
          id: "jefferson-ga-svc-gooch",
          name: "Gooch Electric & Plumbing",
          category: "electrical, plumbing",
          marketClass: "local",
          address: "Jefferson, GA",
          sourceUrl: "https://goochelectric.com/",
          evidence: "Official site lists electrical and plumbing services in Jefferson and surrounding communities."
        },
        {
          id: "jefferson-ga-svc-thrill-mechanical",
          name: "Thrill Mechanical",
          category: "HVAC",
          marketClass: "local",
          address: "Jefferson, GA service area",
          sourceUrl: "https://thrillmechanical.com/",
          evidence: "Official site lists heating and air conditioning installation, repair, and maintenance."
        },
        {
          id: "jefferson-ga-svc-jefferson-plumbing",
          name: "Jefferson Plumbing",
          category: "plumbing",
          marketClass: "local",
          address: "Jefferson, GA",
          sourceUrl: "https://jeffersonplumbing.com/",
          evidence: "Official site lists residential and commercial plumbing services for Jefferson."
        },
        {
          id: "jefferson-ga-svc-trammell",
          name: "Trammell Heating & Air",
          category: "HVAC",
          marketClass: "regional",
          address: "Jefferson, GA service area",
          sourceUrl: "https://trammellheatingandair.com/",
          evidence: "Official site lists HVAC repair, replacement, maintenance, and indoor air services."
        },
        {
          id: "jefferson-ga-svc-team-pest",
          name: "Team Pest USA",
          category: "pest control",
          marketClass: "regional",
          address: "Jefferson, GA service area",
          sourceUrl: "https://pestusa.com/jefferson",
          evidence: "Official Jefferson page lists pest, termite, mosquito, wildlife, and bed bug control."
        },
        {
          id: "jefferson-ga-svc-ae-pest",
          name: "A&E Pest Control",
          category: "pest control",
          marketClass: "local",
          address: "Jefferson, GA service area",
          sourceUrl: "https://aepestcontrol.com/",
          evidence: "Official site lists pest control services for Jefferson and nearby Northeast Georgia areas."
        },
        {
          id: "jefferson-ga-svc-arc-roofing",
          name: "ARC Roofing",
          category: "roofing",
          marketClass: "regional",
          address: "Jefferson, GA service area",
          sourceUrl: "https://arcroofingusa.com/jefferson-ga-roofing/",
          evidence: "Official Jefferson roofing page lists roof repair, roof replacement, and storm restoration."
        },
        {
          id: "jefferson-ga-svc-barnes-landscape",
          name: "Barnes Landscape",
          category: "landscaping",
          marketClass: "local",
          address: "Jefferson, GA service area",
          sourceUrl: "https://barneslandscape.com/",
          evidence: "Official site lists landscape design, maintenance, hardscape, and lawn care services."
        }
      ],
      rentals: [
        {
          id: "jefferson-ga-rent-southwind",
          name: "Southwind",
          category: "apartment community",
          managementCompany: null,
          address: "Jefferson, GA",
          sourceUrl: "https://www.southwindjefferson.com/",
          evidence: "Official site lists Southwind as a Jefferson apartment community with leasing details."
        },
        {
          id: "jefferson-ga-rent-brightside",
          name: "Brightside at Jefferson",
          category: "single-family rental community",
          managementCompany: null,
          address: "Jefferson, GA",
          sourceUrl: "https://www.brightsidejefferson.com/",
          evidence: "Official site presents Brightside at Jefferson as a rental-home community."
        },
        {
          id: "jefferson-ga-rent-pointe-concord",
          name: "The Pointe at Concord",
          category: "apartment community",
          managementCompany: null,
          address: "Jefferson, GA",
          sourceUrl: "https://www.apartments.com/the-pointe-at-concord-jefferson-ga/6pf3k8r/",
          evidence: "Apartments.com lists The Pointe at Concord as a Jefferson apartment community."
        },
        {
          id: "jefferson-ga-rent-sycamore-heights",
          name: "Sycamore Heights",
          category: "apartment community",
          managementCompany: null,
          address: "Jefferson, GA",
          sourceUrl: "https://www.apartments.com/sycamore-heights-jefferson-ga/j78lz6d/",
          evidence: "Apartments.com lists Sycamore Heights as a Jefferson apartment community."
        },
        {
          id: "jefferson-ga-rent-jeffersonian",
          name: "Jeffersonian Apartments",
          category: "apartment community",
          managementCompany: null,
          address: "Jefferson, GA",
          sourceUrl: "https://www.apartments.com/jeffersonian-apartments-jefferson-ga/jmjx3nb/",
          evidence: "Apartments.com identifies Jeffersonian Apartments in Jefferson."
        },
        {
          id: "jefferson-ga-rent-hemlane",
          name: "Hemlane Jefferson Rentals",
          category: "property manager",
          managementCompany: "Hemlane",
          address: "Jefferson, GA",
          sourceUrl: "https://www.hemlane.com/listings/jefferson-ga/",
          evidence: "Hemlane listing page shows Jefferson rental inventory and management context."
        }
      ]
    },
    "Locust Grove": {
      services: [
        {
          id: "locust-grove-ga-svc-meeks",
          name: "Meeks Heating & Air",
          category: "HVAC",
          marketClass: "local",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://meeksheatingandair.com/",
          evidence: "Official site lists heating, cooling, installation, repair, and maintenance in Locust Grove and nearby areas."
        },
        {
          id: "locust-grove-ga-svc-williams",
          name: "Williams Heating and Air",
          category: "HVAC",
          marketClass: "regional",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://williamsheatingandair.com/",
          evidence: "Official site lists HVAC services in Henry County and south metro Atlanta."
        },
        {
          id: "locust-grove-ga-svc-ds-plumbing",
          name: "D&S Plumbing",
          category: "plumbing",
          marketClass: "local",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://dsplumbingga.com/",
          evidence: "Official site lists residential plumbing, water heaters, and repair services for Locust Grove."
        },
        {
          id: "locust-grove-ga-svc-plumbing-rite",
          name: "Plumbing Rite",
          category: "plumbing",
          marketClass: "regional",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://plumbingrite.com/plumber-locust-grove-ga/",
          evidence: "Official Locust Grove page lists plumber services, repairs, drains, and water heaters."
        },
        {
          id: "locust-grove-ga-svc-accurate-electrical",
          name: "Accurate Electrical",
          category: "electrical",
          marketClass: "regional",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://accurateelectricalllc.com/electrician-locust-grove-ga/",
          evidence: "Official Locust Grove page lists residential and commercial electrical services."
        },
        {
          id: "locust-grove-ga-svc-accurate-pest",
          name: "Accurate Pest Solutions",
          category: "pest control",
          marketClass: "regional",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://accuratepestsolutions.com/pest-control-locust-grove-ga/",
          evidence: "Official Locust Grove page lists pest control and termite services."
        },
        {
          id: "locust-grove-ga-svc-build-tek",
          name: "Build-Tek",
          category: "roofing",
          marketClass: "local",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://buildtekconstruction.com/roofing-locust-grove-ga/",
          evidence: "Official Locust Grove roofing page lists roof repair and replacement."
        },
        {
          id: "locust-grove-ga-svc-southern-roots",
          name: "Southern Roots Landscaping",
          category: "landscaping",
          marketClass: "local",
          address: "Locust Grove, GA service area",
          sourceUrl: "https://southernrootslandscapingga.com/",
          evidence: "Official site lists landscape design, installation, and maintenance in the Locust Grove area."
        }
      ],
      rentals: [
        {
          id: "locust-grove-ga-rent-eagles-brooke",
          name: "Eagle's Brooke",
          category: "apartment community",
          managementCompany: null,
          address: "Locust Grove, GA",
          sourceUrl: "https://www.apartments.com/eagles-brooke-locust-grove-ga/6nb0x8l/",
          evidence: "Apartments.com lists Eagle's Brooke as a Locust Grove apartment community."
        },
        {
          id: "locust-grove-ga-rent-springs",
          name: "Springs at Locust Grove",
          category: "apartment community",
          managementCompany: "Continental Properties",
          address: "Locust Grove, GA",
          sourceUrl: "https://www.springsapartments.com/apartments/ga/locust-grove/springs-at-locust-grove/",
          evidence: "Official Springs Apartments page lists Locust Grove apartments with floor plans and leasing."
        },
        {
          id: "locust-grove-ga-rent-station-75",
          name: "Station 75",
          category: "apartment community",
          managementCompany: null,
          address: "Locust Grove, GA",
          sourceUrl: "https://www.station75apts.com/",
          evidence: "Official site lists Station 75 as a Locust Grove apartment community."
        },
        {
          id: "locust-grove-ga-rent-havenwood-grove",
          name: "Havenwood Grove Senior",
          category: "senior apartment community",
          managementCompany: null,
          address: "Locust Grove, GA",
          sourceUrl: "https://www.havenwoodgrove.com/",
          evidence: "Official site presents Havenwood Grove as a senior apartment community in Locust Grove."
        },
        {
          id: "locust-grove-ga-rent-liberty-grove",
          name: "Liberty Grove",
          category: "rental-home community",
          managementCompany: null,
          address: "Locust Grove, GA",
          sourceUrl: "https://www.libertygroveliving.com/",
          evidence: "Official site presents Liberty Grove as a Locust Grove rental-home community."
        },
        {
          id: "locust-grove-ga-rent-progress",
          name: "Progress Residential Locust Grove",
          category: "single-family rentals",
          managementCompany: "Progress Residential",
          address: "Locust Grove, GA",
          sourceUrl: "https://rentprogress.com/houses-for-rent/locust-grove-ga",
          evidence: "Progress Residential lists Locust Grove single-family homes for rent."
        },
        {
          id: "locust-grove-ga-rent-invitation",
          name: "Invitation Homes Locust Grove",
          category: "single-family rentals",
          managementCompany: "Invitation Homes",
          address: "Locust Grove, GA",
          sourceUrl: "https://www.invitationhomes.com/houses-for-rent/ga/locust-grove",
          evidence: "Invitation Homes lists Locust Grove homes for rent."
        }
      ]
    },
    Blakely: {
      services: [
        {
          id: "svc-wimberly-heating-cooling",
          name: "Wimberly Heating & Cooling",
          category: "HVAC",
          marketClass: "local",
          address: "2285 South Main Street, Blakely, GA 39823",
          sourceUrl: "https://www.wimberlyhvac.com/heating-air-conditioning-installation",
          evidence: "Official site advertises residential and commercial heating/cooling installation services in Blakely, GA and lists the Blakely address."
        },
        {
          id: "svc-harrell-king-heating-air",
          name: "Harrell King Heating & Air",
          category: "HVAC",
          marketClass: "regional",
          address: "770 Faceville Hwy, Bainbridge, GA 39819",
          sourceUrl: "https://www.harrellking.net/",
          evidence: "Official site lists HVAC services across Southwest Georgia and includes Blakely, GA in its service area."
        },
        {
          id: "svc-frank-dixon-plumbing-elec",
          name: "Frank Dixon Plumbing & Elec",
          category: "plumbing",
          marketClass: "local",
          address: "735 South Church Street, Blakely, GA 39823",
          sourceUrl: "https://www.manta.com/c/mmfyz0x/frank-dixon-plumbing-elec",
          evidence: "Manta listing categorizes the business under plumbers and plumbing contractors at a Blakely address."
        },
        {
          id: "svc-ra-electric",
          name: "R. A. Electric",
          category: "electrical",
          marketClass: "local",
          address: "1934 Old Lucile Rd, Blakely, GA 39823",
          sourceUrl: "https://www.mapquest.com/us/georgia/r-a-electric-426041739",
          evidence: "MapQuest listing identifies R. A. Electric as an electrician in Blakely."
        },
        {
          id: "svc-adams-exterminators",
          name: "Adams Exterminators",
          category: "pest control",
          marketClass: "regional",
          address: "516 S Church St, Blakely, GA 39823",
          sourceUrl: "https://adams-exterminators.com/",
          evidence: "Official site lists a Blakely office and pest, termite, mosquito, bed bug, rodent, and moisture control services."
        },
        {
          id: "svc-jenkins-roofing",
          name: "Jenkins Roofing Inc",
          category: "roofing",
          marketClass: "local",
          address: "2090 Giles Hightower Rd, Blakely, GA 39823",
          sourceUrl: "https://www.gaf.com/en-us/roofing-contractors/commercial/jenkins-roofing-inc-blakely-ga-1118162",
          evidence: "GAF contractor profile lists Jenkins Roofing Inc in Blakely as a GAF GoldElite commercial roofing contractor."
        },
        {
          id: "svc-early-tree-landscaping",
          name: "Early Tree & Landscaping",
          category: "landscaping",
          marketClass: "local",
          address: "1309 S Main St, Blakely, GA 39823",
          sourceUrl: "https://www.mapquest.com/us/georgia/early-tree-landscaping-467016927",
          evidence: "MapQuest listing describes tree, shrub, and lawn services for commercial and residential customers in Blakely."
        }
      ],
      rentals: [
        {
          id: "rent-blakely-commons",
          name: "Blakely Commons",
          category: "apartment / rental-home community",
          managementCompany: "Landbridge Development",
          address: "89 Blakely Commons Circle, Blakely, GA 39823",
          sourceUrl: "https://blakelycommons.com/",
          evidence: "Official site invites prospects to apply/contact leasing and lists 3- and 4-bedroom floor plans."
        },
        {
          id: "rent-tanglewood-apartments",
          name: "Tanglewood Apartments",
          category: "apartment community",
          managementCompany: "Tishco Properties, LLC",
          address: "468 Liberty St, Blakely, GA 39823",
          sourceUrl: "https://www.tishcollc.com/",
          evidence: "Tishco official site includes Tanglewood in its Apply Now menu."
        },
        {
          id: "rent-country-lane-apartments",
          name: "Country Lane Apartments",
          category: "apartment community",
          managementCompany: null,
          address: "1121 S Main St, Blakely, GA 39823",
          sourceUrl: "https://www.apartments.com/country-lane-apartments-blakely-ga/nwx46pm/",
          evidence: "Apartments.com identifies Country Lane Apartments in Blakely with leasing-office language and apartment features."
        },
        {
          id: "rent-housing-authority-blakely",
          name: "Housing Authority of the City of Blakely",
          category: "public housing authority",
          managementCompany: "Housing Authority of the City of Blakely",
          address: "411 Damascus St, Blakely, GA 39823",
          sourceUrl: "https://affordablehousingonline.com/housing-authority/Georgia/Housing-Authority-of-the-City-of-Blakely/GA114",
          evidence: "Affordable Housing Online says the agency serves Blakely and manages public housing units."
        },
        {
          id: "rent-baptist-branch-homes",
          name: "Baptist Branch Homes",
          category: "public housing community",
          managementCompany: "Housing Authority of the City of Blakely",
          address: "356 Howell St, Blakely, GA 39823",
          sourceUrl: "https://projects.propublica.org/hud/owners/GA114",
          evidence: "ProPublica HUD Inspect lists Baptist Branch Homes in Blakely under the Housing Authority of the City of Blakely."
        }
      ]
    }
  }
};

async function main() {
  const updates = JSON.parse(await fs.readFile(UPDATES, "utf8"));
  updates.states ||= {};
  for (const [state, cities] of Object.entries(packets)) {
    updates.states[state] ||= {};
    for (const [city, packet] of Object.entries(cities)) {
      updates.states[state][city] = packet;
    }
  }
  await fs.writeFile(UPDATES, `${JSON.stringify(updates, null, 2)}\n`);
  console.log(`applied ${countPackets(packets)} manual research packets`);
}

function countPackets(value) {
  return Object.values(value).reduce((sum, cities) => sum + Object.keys(cities).length, 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
