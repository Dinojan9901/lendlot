/**
 * Sample data for local development, E2E tests and the demo deployment.
 * All people, emails and places are fictional; no brand names are used.
 */

export const DEMO_PASSWORD = "lendlot-demo";

export const users = [
  { key: "renter", name: "Alex Morgan", email: "renter@lendlot.test", role: "RENTER" },
  { key: "owner", name: "Maya Fernando", email: "owner@lendlot.test", role: "OWNER" },
  { key: "owner2", name: "Daniel Okafor", email: "daniel@lendlot.test", role: "OWNER" },
  { key: "owner3", name: "Priya Raman", email: "priya@lendlot.test", role: "OWNER" },
  { key: "admin", name: "Sam Admin", email: "admin@lendlot.test", role: "ADMIN" },
] as const;

export type UserKey = (typeof users)[number]["key"];

export const categories = [
  { slug: "tools", name: "Tools & DIY" },
  { slug: "outdoors", name: "Camping & Outdoors" },
  { slug: "photo", name: "Cameras & Video" },
  { slug: "events", name: "Party & Events" },
  { slug: "sports", name: "Sports & Fitness" },
  { slug: "music", name: "Music & Audio" },
] as const;

type SeedItem = {
  slug: string;
  title: string;
  category: (typeof categories)[number]["slug"];
  owner: UserKey;
  dailyPrice: number;
  location: string;
  description: string;
};

export const items: SeedItem[] = [
  // Tools & DIY
  {
    slug: "cordless-drill-driver-kit",
    title: "18V cordless drill & driver kit",
    category: "tools",
    owner: "owner",
    dailyPrice: 12,
    location: "Riverside",
    description:
      "Compact 18V drill/driver with two batteries, a fast charger and a 40-piece bit set. Ideal for flat-pack furniture, hanging shelves and small renovation jobs. Batteries are fully charged before every rental.",
  },
  {
    slug: "wet-tile-saw",
    title: "Wet tile saw with folding stand",
    category: "tools",
    owner: "owner2",
    dailyPrice: 35,
    location: "Old Town",
    description:
      "Seven-inch wet tile saw that cuts ceramic, porcelain and natural stone cleanly with almost no dust. Comes with a folding stand, a spare diamond blade and a water tray. Great for a weekend bathroom or kitchen backsplash project.",
  },
  {
    slug: "electric-pressure-washer",
    title: "Electric pressure washer (2000 PSI)",
    category: "tools",
    owner: "owner",
    dailyPrice: 28,
    location: "Riverside",
    description:
      "Quiet electric pressure washer with 25 ft hose and four quick-connect nozzles plus a soap tank. Brings patios, decks, fences and garden furniture back to life in an afternoon.",
  },
  {
    slug: "aluminium-extension-ladder",
    title: "24 ft aluminium extension ladder",
    category: "tools",
    owner: "owner3",
    dailyPrice: 18,
    location: "Hillcrest",
    description:
      "Lightweight two-section extension ladder that reaches gutters and second-floor windows. Rated to 300 lb with non-slip feet and a rope pulley. Fits on a standard roof rack.",
  },
  // Camping & Outdoors
  {
    slug: "four-person-dome-tent",
    title: "Four-person dome tent",
    category: "outdoors",
    owner: "owner2",
    dailyPrice: 22,
    location: "Old Town",
    description:
      "Freestanding three-season tent that sleeps four, with two doors, two vestibules and a full rain fly. Pitches in about ten minutes. Footprint and extra stakes included. Cleaned and dried after every trip.",
  },
  {
    slug: "two-burner-camping-stove",
    title: "Two-burner camping stove",
    category: "outdoors",
    owner: "owner",
    dailyPrice: 9,
    location: "Riverside",
    description:
      "Classic two-burner propane stove with wind guards and independent flame control. Enough power to boil water and fry breakfast at the same time. Propane canister not included.",
  },
  {
    slug: "inflatable-paddle-board",
    title: "Inflatable stand-up paddle board",
    category: "outdoors",
    owner: "owner3",
    dailyPrice: 30,
    location: "Lakeside",
    description:
      "Stable 10'6\" all-round paddle board that packs into a backpack. Includes an adjustable paddle, hand pump, ankle leash and a waterproof phone pouch. Suitable for beginners on calm water.",
  },
  {
    slug: "trekking-backpack-65l",
    title: "65 L trekking backpack",
    category: "outdoors",
    owner: "owner2",
    dailyPrice: 10,
    location: "Old Town",
    description:
      "Adjustable 65-litre pack with a ventilated back panel, hip-belt pockets and an integrated rain cover. Comfortable for multi-day hikes. Washed between rentals.",
  },
  // Cameras & Video
  {
    slug: "full-frame-mirrorless-camera",
    title: "Full-frame mirrorless camera body",
    category: "photo",
    owner: "owner3",
    dailyPrice: 55,
    location: "Hillcrest",
    description:
      "24 MP full-frame mirrorless body with in-body stabilisation and 4K video. Comes with two batteries, a charger and a 128 GB memory card. Lens sold separately — see the telephoto lens listing.",
  },
  {
    slug: "telephoto-zoom-lens-70-200",
    title: "70–200 mm f/2.8 telephoto lens",
    category: "photo",
    owner: "owner3",
    dailyPrice: 40,
    location: "Hillcrest",
    description:
      "Fast telephoto zoom for sports, wildlife and portraits, with image stabilisation and a tripod collar. Supplied with lens hood, caps and a padded case.",
  },
  {
    slug: "compact-4k-camera-drone",
    title: "Compact 4K camera drone",
    category: "photo",
    owner: "owner",
    dailyPrice: 45,
    location: "Riverside",
    description:
      "Foldable drone under 250 g with a 3-axis gimbal, 4K camera and about 30 minutes of flight per battery. Three batteries and a charging hub included. You are responsible for following local flight rules.",
  },
  {
    slug: "led-video-light-kit",
    title: "Two-light LED video kit with stands",
    category: "photo",
    owner: "owner2",
    dailyPrice: 25,
    location: "Old Town",
    description:
      "Two bi-colour LED panels with softboxes, light stands and a carry bag. Dimmable and adjustable from warm to daylight. Perfect for interviews, product shots and home studio setups.",
  },
  // Party & Events
  {
    slug: "outdoor-projector-and-screen",
    title: "Outdoor projector & 120\" screen",
    category: "events",
    owner: "owner",
    dailyPrice: 60,
    location: "Riverside",
    description:
      "Bright 1080p projector, a 120-inch inflatable screen with blower, and a Bluetooth speaker. Everything you need for a backyard movie night. HDMI and streaming-stick adapters included.",
  },
  {
    slug: "folding-banquet-tables",
    title: "Set of 4 folding banquet tables",
    category: "events",
    owner: "owner2",
    dailyPrice: 32,
    location: "Old Town",
    description:
      "Four 6 ft folding tables that seat six to eight people each. Sturdy, easy to wipe clean and fit in most estate cars. Ideal for birthdays, garden parties and community events.",
  },
  {
    slug: "festoon-string-lights",
    title: "50 ft festoon string lights",
    category: "events",
    owner: "owner3",
    dailyPrice: 12,
    location: "Lakeside",
    description:
      "Weatherproof warm-white festoon lights with shatterproof bulbs. Connectable up to three strands for bigger spaces. Includes hanging hooks and a timer plug.",
  },
  {
    slug: "retro-popcorn-machine",
    title: "Retro popcorn machine",
    category: "events",
    owner: "owner",
    dailyPrice: 28,
    location: "Riverside",
    description:
      "Cinema-style popcorn cart with an 8 oz kettle and a warming deck. Makes enough popcorn for a crowd and always gets a smile. Starter pack of kernels and bags included.",
  },
  // Sports & Fitness
  {
    slug: "carbon-road-bike-medium",
    title: "Carbon road bike (size M)",
    category: "sports",
    owner: "owner2",
    dailyPrice: 45,
    location: "Old Town",
    description:
      "Lightweight endurance road bike with 22 gears and hydraulic disc brakes, fitted for riders about 5'7\"–5'11\". Helmet, lock and flat or clip-in pedals available on request.",
  },
  {
    slug: "sit-on-top-kayak",
    title: "Sit-on-top kayak with paddle",
    category: "sports",
    owner: "owner3",
    dailyPrice: 38,
    location: "Lakeside",
    description:
      "Stable single sit-on-top kayak for lakes and calm coastal water, with a padded seat, dry hatch and paddle. Life jacket included. Roof-rack foam blocks and straps available.",
  },
  {
    slug: "touring-skis-with-skins",
    title: "Touring skis with climbing skins",
    category: "sports",
    owner: "owner",
    dailyPrice: 40,
    location: "Riverside",
    description:
      "All-mountain touring skis with adjustable bindings and fitted climbing skins. Poles included. Freshly waxed and edges tuned before each rental.",
  },
  {
    slug: "portable-volleyball-net-set",
    title: "Portable volleyball net set",
    category: "sports",
    owner: "owner2",
    dailyPrice: 14,
    location: "Old Town",
    description:
      "Height-adjustable volleyball net with poles, boundary lines, a ball and a pump. Sets up on grass or sand in about five minutes. Great for beach days and park meet-ups.",
  },
  // Music & Audio
  {
    slug: "two-channel-dj-controller",
    title: "Two-channel DJ controller",
    category: "music",
    owner: "owner3",
    dailyPrice: 30,
    location: "Hillcrest",
    description:
      "Plug-and-play two-deck controller with jog wheels, performance pads and a built-in sound card. Works with free DJ software on Mac and Windows. Headphones and cables included.",
  },
  {
    slug: "powered-pa-speaker-pair",
    title: "Pair of 12\" powered PA speakers",
    category: "music",
    owner: "owner",
    dailyPrice: 65,
    location: "Riverside",
    description:
      "Two 1000 W active speakers with stands and a small four-channel mixer. Loud and clear enough for a wedding reception, a band rehearsal or an outdoor event of up to about 150 people.",
  },
  {
    slug: "dreadnought-acoustic-guitar",
    title: "Dreadnought acoustic guitar",
    category: "music",
    owner: "owner2",
    dailyPrice: 15,
    location: "Old Town",
    description:
      "Solid-top dreadnought acoustic with a warm, full sound and fresh strings. Comes with a gig bag, tuner, capo and picks. A good way to try playing before you buy.",
  },
  {
    slug: "digital-piano-88-key",
    title: "88-key digital piano with stand",
    category: "music",
    owner: "owner3",
    dailyPrice: 35,
    location: "Hillcrest",
    description:
      "Weighted-key digital piano with sustain pedal, stand and bench. Headphone output for silent practice. Delivery within the city can be arranged with the owner.",
  },
];
