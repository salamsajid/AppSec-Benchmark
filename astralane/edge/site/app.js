const app = document.querySelector('#app');

const FALLBACK_AIRPORTS = [
  ['JFK', 'New York'], ['LHR', 'London'], ['SFO', 'San Francisco'], ['NRT', 'Tokyo'],
  ['HND', 'Tokyo'], ['LAX', 'Los Angeles'], ['BOM', 'Mumbai'], ['DXB', 'Dubai'],
  ['DEL', 'Delhi'], ['SIN', 'Singapore'], ['CDG', 'Paris'], ['SYD', 'Sydney'],
  ['AKL', 'Auckland'], ['BLR', 'Bengaluru'], ['HNL', 'Honolulu'], ['MIA', 'Miami'],
  ['SEA', 'Seattle'], ['YYZ', 'Toronto'],
].map(([code, city]) => ({ code, city }));

const FALLBACK_DESTINATIONS = [
  { code: 'LHR', city: 'London', country: 'United Kingdom', priceFrom: 79900, accent: 'violet', note: 'Aurora season' },
  { code: 'NRT', city: 'Tokyo', country: 'Japan', priceFrom: 78900, accent: 'cyan', note: 'Neon nights' },
  { code: 'DXB', city: 'Dubai', country: 'UAE', priceFrom: 24900, accent: 'amber', note: 'Desert meridians' },
  { code: 'SIN', city: 'Singapore', country: 'Singapore', priceFrom: 26900, accent: 'emerald', note: 'Ocean glass' },
  { code: 'CDG', city: 'Paris', country: 'France', priceFrom: 65900, accent: 'rose', note: 'Left bank light' },
  { code: 'SYD', city: 'Sydney', country: 'Australia', priceFrom: 21900, accent: 'blue', note: 'Harbour dawn' },
];

const FALLBACK_EXPERIENCES = [
  { id: 'exp-aurora', title: 'Aurora flight over Iceland', city: 'Reykjavik', priceCents: 89000, duration: '6 hours', tag: 'Sky' },
  { id: 'exp-reef', title: 'Coral nursery dive', city: 'Singapore', priceCents: 34000, duration: '4 hours', tag: 'Ocean' },
  { id: 'exp-dune', title: 'Silent dune crossing', city: 'Dubai', priceCents: 42000, duration: '8 hours', tag: 'Desert' },
  { id: 'exp-train', title: 'Midnight express tasting menu', city: 'Tokyo', priceCents: 28000, duration: '3 hours', tag: 'Taste' },
];

const HOTEL_CITIES = ['New York', 'London', 'Tokyo', 'Dubai', 'Singapore', 'Zurich', 'Sydney', 'Paris'];

const TOP_DESTINATIONS = [
  {
    code: 'NRT',
    city: 'Tokyo',
    country: 'Japan',
    tag: 'Neon & Culture',
    gif: '/assets/destinations/tokyo.gif',
    cover: '/assets/destinations/tokyo.jpg',
    priceFrom: 78900,
    duration: '14h 10m Non-stop',
    accent: 'cyan',
    highlights: ['Shinjuku Neon Nights', 'Sakura Gardens', 'Ginza Dining'],
    flightBadge: 'Daily Non-Stop',
    directFrom: 'JFK · SFO · LAX',
  },
  {
    code: 'NAP',
    city: 'Amalfi Coast',
    country: 'Italy',
    tag: 'Romantic Riviera',
    gif: '/assets/destinations/amalfi.gif',
    cover: '/assets/destinations/amalfi.jpg',
    priceFrom: 84000,
    duration: '8h 25m Direct',
    accent: 'amber',
    highlights: ['Positano Cliffside', 'Capri Boat Tour', 'Limoncello Groves'],
    flightBadge: 'Bestseller 🔥',
    directFrom: 'JFK · LHR · CDG',
  },
  {
    code: 'JTR',
    city: 'Santorini',
    country: 'Greece',
    tag: 'Aegean Dream',
    gif: '/assets/destinations/santorini.gif',
    cover: '/assets/destinations/santorini.jpg',
    priceFrom: 79900,
    duration: '9h 15m Direct',
    accent: 'blue',
    highlights: ['Oia Caldera Sunset', 'Volcanic Vineyards', 'Private Cave Pools'],
    flightBadge: 'Couples Pick 💖',
    directFrom: 'LHR · CDG · JFK',
  },
  {
    code: 'CDG',
    city: 'Paris',
    country: 'France',
    tag: 'Iconic Romance',
    gif: '/assets/destinations/paris.gif',
    cover: '/assets/destinations/paris.jpg',
    priceFrom: 65900,
    duration: '7h 45m Non-stop',
    accent: 'rose',
    highlights: ['Eiffel Tower Sparkle', 'Saint-Germain Cafés', 'Louvre Night Pass'],
    flightBadge: 'Flash Deal ⚡',
    directFrom: 'JFK · BOM · DXB',
  },
  {
    code: 'ZRH',
    city: 'Swiss Alps',
    country: 'Switzerland',
    tag: 'Glacier & Peaks',
    gif: '/assets/destinations/alps.gif',
    cover: '/assets/destinations/alps.jpg',
    priceFrom: 82000,
    duration: '8h 10m Non-stop',
    accent: 'emerald',
    highlights: ['Matterhorn Views', 'Glacier Express Rail', 'Fondue Chalets'],
    flightBadge: 'Scenic Choice 🏔️',
    directFrom: 'JFK · LHR · SIN',
  },
  {
    code: 'DPS',
    city: 'Bali',
    country: 'Indonesia',
    tag: 'Tropical Sanctuary',
    gif: '/assets/destinations/bali.gif',
    cover: '/assets/destinations/bali.jpg',
    priceFrom: 69000,
    duration: 'Direct / 1 Stop',
    accent: 'emerald',
    highlights: ['Ubud Jungle Villas', 'Floating Breakfast', 'Tegallalang Terraces'],
    flightBadge: 'Wellness Haven 🌿',
    directFrom: 'SIN · DXB · SYD',
  },
  {
    code: 'DXB',
    city: 'Dubai',
    country: 'UAE',
    tag: 'Mirage & Skyline',
    gif: '/assets/destinations/dubai.gif',
    cover: '/assets/destinations/dubai.jpg',
    priceFrom: 24900,
    duration: '12h 30m Direct',
    accent: 'amber',
    highlights: ['Desert Dunes Safari', 'Burj Sky Decks', 'Palm Luxury Resorts'],
    flightBadge: 'Special Fare 🐪',
    directFrom: 'BOM · DEL · LHR · JFK',
  },
  {
    code: 'KEF',
    city: 'Reykjavik',
    country: 'Iceland',
    tag: 'Aurora Season',
    gif: '/assets/destinations/aurora.gif',
    cover: '/assets/destinations/aurora.jpg',
    priceFrom: 58000,
    duration: '5h 50m Direct',
    accent: 'violet',
    highlights: ['Dancing Northern Lights', 'Blue Lagoon Geothermal', 'Glacier Caves'],
    flightBadge: 'Aurora Peak 🌌',
    directFrom: 'JFK · LHR · CDG',
  },
  {
    code: 'LHR',
    city: 'London',
    country: 'United Kingdom',
    tag: 'Historic Elegance',
    gif: '/assets/destinations/london.gif',
    cover: '/assets/destinations/london.jpg',
    priceFrom: 79900,
    duration: '6h 55m Non-stop',
    accent: 'violet',
    highlights: ['Mayfair Dining', 'West End Theatres', 'Thames Golden Sunset'],
    flightBadge: 'Flagship Route 🇬🇧',
    directFrom: 'JFK · BOM · DEL · DXB',
  },
  {
    code: 'JFK',
    city: 'New York',
    country: 'United States',
    tag: 'Urban Pulse',
    gif: '/assets/destinations/newyork.gif',
    cover: '/assets/destinations/newyork.jpg',
    priceFrom: 42800,
    duration: 'Global Hub',
    accent: 'cyan',
    highlights: ['Broadway Nights', 'Central Park Stroll', 'SoHo Architecture'],
    flightBadge: 'Astra Hub 🗽',
    directFrom: 'Worldwide Connections',
  },
];

const FLIGHT_PACKAGES = [
  {
    id: 'pkg-amalfi',
    title: 'Amalfi Coast Dolce Vita & Cliffside Villa',
    destination: 'Amalfi Coast, Italy',
    airportCode: 'LHR',
    hotelId: 'HTL-ALP',
    durationDays: '6 Days / 5 Nights',
    cover: '/assets/hotels/amalfi_villa.jpg',
    gif: '/assets/destinations/amalfi.gif',
    tag: 'Trending 🔥',
    category: 'Romantic',
    rating: 4.95,
    reviewsCount: 128,
    priceCents: 128000,
    regularPriceCents: 165000,
    inclusions: [
      '✈️ Return Direct Flights with Cabin Baggage',
      '🏨 5 Nights in Luxury Positano Cliffside Villa',
      '⛵ Private Sunset Catamaran to Capri with Champagne',
      '🚗 Chauffeured Airport & Coastal Transfers',
      '🥐 Daily Organic Mediterranean Breakfast',
    ],
  },
  {
    id: 'pkg-tokyo',
    title: 'Tokyo Cyberpunk & Hakone Hot Spring Ryokan',
    destination: 'Tokyo & Hakone, Japan',
    airportCode: 'NRT',
    hotelId: 'HTL-NEO',
    durationDays: '7 Days / 6 Nights',
    cover: '/assets/destinations/tokyo.jpg',
    gif: '/assets/destinations/tokyo.gif',
    tag: 'Bestseller ⭐',
    category: 'Cultural',
    rating: 4.92,
    reviewsCount: 214,
    priceCents: 142000,
    regularPriceCents: 185000,
    inclusions: [
      '✈️ Return Non-Stop Flights to Tokyo (NRT)',
      '🏨 4 Nights Shinjuku Skyline Suite + 2 Nights Onsen Ryokan',
      '🚅 7-Day Unlimited Japan Rail Pass Included',
      '🍵 Private Tea Master Ceremony & Tsukiji Food Tour',
      '🍣 Daily Kaiseki Multi-Course Dinners at Ryokan',
    ],
  },
  {
    id: 'pkg-santorini',
    title: 'Santorini Aegean Romance & Cave Pool Suite',
    destination: 'Santorini, Greece',
    airportCode: 'CDG',
    hotelId: 'HTL-ORB',
    durationDays: '5 Days / 4 Nights',
    cover: '/assets/hotels/santorini_cave.jpg',
    gif: '/assets/destinations/santorini.gif',
    tag: 'Couples 💖',
    category: 'Romantic',
    rating: 4.98,
    reviewsCount: 96,
    priceCents: 115000,
    regularPriceCents: 149000,
    inclusions: [
      '✈️ Roundtrip Flights to Greece with Priority Check-in',
      '🏨 4 Nights in Whitewashed Caldera Cave Suite',
      '🍷 Sunset Volcanic Wine Tasting Tour (5 Vineyards)',
      '⛵ Semi-Private Sunset Catamaran Cruise + BBQ Dinner',
      '🍾 Welcome Bottle of Vintage Greek Wine & Fresh Fruits',
    ],
  },
  {
    id: 'pkg-alps',
    title: 'Swiss Alps Glacier & Scenic Rail Expedition',
    destination: 'Zermatt & Zurich, Switzerland',
    airportCode: 'LHR',
    hotelId: 'HTL-ALP',
    durationDays: '6 Days / 5 Nights',
    cover: '/assets/hotels/alpine_signal.jpg',
    gif: '/assets/destinations/alps.gif',
    tag: 'Scenic 🏔️',
    category: 'Alpine',
    rating: 4.88,
    reviewsCount: 84,
    priceCents: 139000,
    regularPriceCents: 178000,
    inclusions: [
      '✈️ Direct Roundtrip Flights to Zurich',
      '🏨 5 Nights Alpine Heritage Wood Chalet facing Matterhorn',
      '🚂 Glacier Express 1st-Class Panoramic Train Tickets',
      '🫕 Authentic Alpine Fondue & Wine Dinner for Two',
      '🎿 Complimentary Ski Equipment Locker & Shuttle',
    ],
  },
  {
    id: 'pkg-bali',
    title: 'Bali Tropical Haven & Ubud River Pool Villa',
    destination: 'Bali, Indonesia',
    airportCode: 'SIN',
    hotelId: 'HTL-SEA',
    durationDays: '7 Days / 6 Nights',
    cover: '/assets/hotels/bali_pool.jpg',
    gif: '/assets/destinations/bali.gif',
    tag: 'Wellness 🌿',
    category: 'Tropical',
    rating: 4.96,
    reviewsCount: 162,
    priceCents: 94000,
    regularPriceCents: 125000,
    inclusions: [
      '✈️ Return Flight with Checked Baggage',
      '🏨 6 Nights Private River Valley Pool Villa in Ubud',
      '🌺 Signature Floating Tropical Breakfast in Pool',
      '💆 2-Hour Balinese Herbal Aromatherapy Spa for Two',
      '🚗 Private Driver & Car for 3 Full Days of Exploring',
    ],
  },
  {
    id: 'pkg-dubai',
    title: 'Dubai Desert Mirage & Luxury Sky Living',
    destination: 'Dubai, UAE',
    airportCode: 'DXB',
    hotelId: 'HTL-DUN',
    durationDays: '5 Days / 4 Nights',
    cover: '/assets/hotels/dune_meridian.jpg',
    gif: '/assets/destinations/dubai.gif',
    tag: 'Luxury 👑',
    category: 'Luxury',
    rating: 4.89,
    reviewsCount: 140,
    priceCents: 89000,
    regularPriceCents: 119000,
    inclusions: [
      '✈️ Direct Roundtrip Flights to DXB with Astra Priority',
      '🏨 4 Nights 5-Star Sky View Suite overlooking Burj Khalifa',
      '🏜️ Private Vintage Land Rover Desert Safari & Starlit Dinner',
      '🚁 15-Minute Scenic Helicopter Tour of The Palm',
      '🍸 Sunset Cocktails at Sky Lounge 122',
    ],
  },
];

const PINTEREST_PINS = [
  {
    id: 'pin-1',
    hotelId: 'HTL-ALP',
    title: 'Villa Positano Bella',
    city: 'Amalfi Coast',
    country: 'Italy',
    image: '/assets/hotels/amalfi_villa.jpg',
    tags: ['#CalderaView', '#AestheticStays', '#ItalianRiviera'],
    priceCents: 48000,
    rating: 4.97,
    pinCount: '2.8k',
  },
  {
    id: 'pin-2',
    hotelId: 'HTL-ORB',
    title: 'Caldera Cave Haven',
    city: 'Santorini',
    country: 'Greece',
    image: '/assets/hotels/santorini_cave.jpg',
    tags: ['#CalderaView', '#CycladicChic', '#SunsetPlunge'],
    priceCents: 52000,
    rating: 4.99,
    pinCount: '3.4k',
  },
  {
    id: 'pin-3',
    hotelId: 'HTL-NEO',
    title: 'Neo Tokyo Capsule & Sky Loft',
    city: 'Tokyo',
    country: 'Japan',
    image: '/assets/hotels/neo_tokyo.jpg',
    tags: ['#CyberZen', '#Minimalist', '#NeonView'],
    priceCents: 17900,
    rating: 4.85,
    pinCount: '1.9k',
  },
  {
    id: 'pin-4',
    hotelId: 'HTL-SEA',
    title: 'Ubud River Bamboo Sanctuary',
    city: 'Bali',
    country: 'Indonesia',
    image: '/assets/hotels/bali_pool.jpg',
    tags: ['#Tropical', '#JungleVilla', '#FloatingBreakfast'],
    priceCents: 21000,
    rating: 4.96,
    pinCount: '2.1k',
  },
  {
    id: 'pin-5',
    hotelId: 'HTL-SKY',
    title: 'The Skyline Atrium Penthouse',
    city: 'New York',
    country: 'USA',
    image: '/assets/hotels/skyline.jpg',
    tags: ['#ArchitecturalDigest', '#Penthouse', '#ManhattanGlow'],
    priceCents: 42800,
    rating: 4.88,
    pinCount: '1.5k',
  },
  {
    id: 'pin-6',
    hotelId: 'HTL-ALP',
    title: 'Alpine Signal Chalet',
    city: 'Zurich',
    country: 'Switzerland',
    image: '/assets/hotels/alpine_signal.jpg',
    tags: ['#Alpine', '#CozyWood', '#MatterhornView'],
    priceCents: 35900,
    rating: 4.89,
    pinCount: '1.7k',
  },
  {
    id: 'pin-7',
    hotelId: 'HTL-DUN',
    title: 'Dune Meridian Starlit Retreat',
    city: 'Dubai',
    country: 'UAE',
    image: '/assets/hotels/dune_meridian.jpg',
    tags: ['#DesertOasis', '#Minimalist', '#StarGazing'],
    priceCents: 31900,
    rating: 4.84,
    pinCount: '1.4k',
  },
  {
    id: 'pin-8',
    hotelId: 'HTL-AUR',
    title: 'Aurora House Mayfair',
    city: 'London',
    country: 'UK',
    image: '/assets/hotels/aurora_house.jpg',
    tags: ['#HistoricBoutique', '#LondonVibe', '#QuietLuxury'],
    priceCents: 38900,
    rating: 4.91,
    pinCount: '1.3k',
  },
  {
    id: 'pin-9',
    hotelId: 'HTL-ORB',
    title: 'Orbit Suites Saint-Germain',
    city: 'Paris',
    country: 'France',
    image: '/assets/hotels/orbit_suites.jpg',
    tags: ['#Haussmannian', '#LeftBank', '#BalconyView'],
    priceCents: 33900,
    rating: 4.87,
    pinCount: '2.4k',
  },
  {
    id: 'pin-10',
    hotelId: 'HTL-SOL',
    title: 'Solaris Bay Horizon Villa',
    city: 'Sydney',
    country: 'Australia',
    image: '/assets/hotels/solaris_bay.jpg',
    tags: ['#HarbourVibe', '#CoastalModern', '#InfinityPool'],
    priceCents: 29900,
    rating: 4.86,
    pinCount: '1.1k',
  },
];

const PROMO_CODES = [
  { code: 'ASTRAFLY', title: 'Flat $120 OFF Flights', desc: 'Valid on direct international flights to London, Tokyo & Paris with zero date change fee.', tag: 'Flights' },
  { code: 'HOLIDAY25', title: '25% OFF Flight Bundles', desc: 'Book any handcrafted package and get an instant 25% member discount at checkout.', tag: 'Packages' },
  { code: 'ASTRAPOINTS', title: '3,500 Bonus Points', desc: 'Earn 3x points on Business & First Class bookings across all global routes.', tag: 'Rewards' },
  { code: 'QUIETSTAY', title: 'Complimentary Room Upgrade', desc: 'Free suite upgrade & 2pm late check-out on boutique stays in Zurich & Tokyo.', tag: 'Stays' },
];

const state = {
  token: localStorage.getItem('astra.token') || '',
  user: null,
  authMode: 'login',
  tripType: 'oneway',
  fareType: 'regular',
  savedPins: JSON.parse(localStorage.getItem('astra.savedPins') || '["pin-1", "pin-2", "pin-6"]'),
  catalog: { airports: FALLBACK_AIRPORTS, destinations: FALLBACK_DESTINATIONS, experiences: FALLBACK_EXPERIENCES },
  chat: [],
};

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plane: '<path d="M3.5 12.2l17-7.2-7.2 17-2.1-6.6-7.7-3.2z"/><path d="M11.2 15.4l4-4"/>',
  bed: '<path d="M3 19v-8m0 5h18m0 3v-3a3 3 0 0 0-3-3H9v6"/><path d="M6 11V8h5v3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5.2-5.2 2.2 2.2-5.2z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  spark: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
  wallet: '<rect x="3" y="7" width="18" height="12" rx="3"/><path d="M3 10h18M16 14h2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  logout: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9"/>',
  send: '<path d="M21 3L10 14M21 3l-6.5 18-4.5-7-7-4.5z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  heartFilled: '<path fill="#e60023" stroke="#e60023" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  luggage: '<rect x="6" y="8" width="12" height="13" rx="2"/><path d="M9 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3"/><line x1="10" y1="12" x2="10" y2="17"/><line x1="14" y1="12" x2="14" y2="17"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
};

function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
}

function logoMark(size = 32) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <circle cx="32" cy="32" r="20" stroke="#5eead4" stroke-opacity=".45" stroke-width="2"/>
    <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(-28 32 32)" stroke="#818cf8" stroke-opacity=".8" stroke-width="2"/>
    <circle cx="32" cy="32" r="4.5" fill="#eef4ff"/>
    <circle cx="49" cy="18.5" r="2.6" fill="#5eead4"/>
  </svg>`;
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat('en-US');
const timeUTC = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

const money = (cents) => moneyFormat.format((Number(cents) || 0) / 100);
const points = (value) => numberFormat.format(Number(value) || 0);
const isoDate = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const addDays = (dateString, amount) => new Date(Date.parse(`${dateString}T00:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
const shortDate = (dateString) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateString}T12:00:00Z`));
const weekday = (dateString) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${dateString}T12:00:00Z`));
const longDate = (dateString) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateString}T12:00:00Z`));
const dateOf = (iso) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

function initials(name) {
  return String(name || 'AL').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function duration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

function statusLabel(status) {
  return { pending: 'Pending', awaiting_partner: 'Awaiting partner', paid: 'Settled', confirmed: 'Confirmed' }[status] || status;
}

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const options = { method, credentials: 'same-origin', headers: { ...headers } };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }
  if (state.token) options.headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, options);
  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) data = await response.json().catch(() => null);
  else data = await response.text();
  if (!response.ok) {
    const error = new Error((data && data.error) || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function toast(message, type = 'info') {
  const host = document.querySelector('#toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  host.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 220);
  }, 4200);
}

async function loadCatalog() {
  try {
    const [airports, destinations, experiences] = await Promise.all([
      api('/api/airports'),
      api('/api/destinations'),
      api('/api/experiences'),
    ]);
    state.catalog = {
      airports: airports.airports || FALLBACK_AIRPORTS,
      destinations: destinations.destinations || FALLBACK_DESTINATIONS,
      experiences: experiences.experiences || FALLBACK_EXPERIENCES,
    };
  } catch {
    state.catalog = { airports: FALLBACK_AIRPORTS, destinations: FALLBACK_DESTINATIONS, experiences: FALLBACK_EXPERIENCES };
  }
}

async function loadUser() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
  } catch {
    if (state.token) {
      state.token = '';
      localStorage.removeItem('astra.token');
      try {
        const data = await api('/api/auth/me');
        state.user = data.user;
        return;
      } catch {
        state.user = null;
      }
    }
    state.user = null;
  }
}

function airportOptions(selected) {
  return state.catalog.airports
    .map((airport) => `<option value="${esc(airport.code)}" ${airport.code === selected ? 'selected' : ''}>${esc(airport.city)} · ${esc(airport.code)}</option>`)
    .join('');
}

function cityFor(code) {
  const airport = state.catalog.airports.find((item) => item.code === code);
  return airport ? airport.city : code;
}

function navLink(label, href, active, key) {
  return `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;
}

function shell(content, active = '') {
  const user = state.user;
  const savedCount = state.savedPins.length;
  return `
    <div class="top-ticker">
      <div class="wrap top-ticker-inner">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <span class="ticker-pill"><span class="badge-dot" style="background:#ff4757;box-shadow:0 0 8px #ff4757;"></span> FLASH SALE</span>
          <p class="ticker-text">Flat <strong>20% OFF</strong> International Flights with code <code>ASTRAFLY</code> · Zero cancellation penalty · Hold fares 24h</p>
        </div>
        <div class="ticker-links">
          <span class="ticker-help">${icon('phone', 13)} 24/7 Human Navigator: 1-800-ASTRA</span>
          <span class="ticker-currency">USD · EN</span>
        </div>
      </div>
    </div>
    <header class="site-header">
      <div class="wrap header-inner">
        <a class="brand" href="#/">${logoMark(34)} <span>Astra<em>Lane</em></span></a>
        <nav class="nav" id="primary-nav" aria-label="Primary">
          ${navLink('Flights', '#/', active, 'home')}
          ${navLink('Stays & Villas', '#/stays', active, 'stays')}
          ${navLink('Flight Packages', '#/packages', active, 'packages')}
          <a href="#/moodboard" class="${active === 'moodboard' ? 'active' : ''}">Moodboard <span class="nav-badge" id="nav-saved-count">${savedCount}</span></a>
          ${navLink('Experiences', '#/experiences', active, 'experiences')}
          ${navLink('Concierge', '#/concierge', active, 'concierge')}
          ${user?.role === 'admin' ? navLink('Operator', '#/admin', active, 'admin') : ''}
        </nav>
        <div class="header-actions">
          ${user
            ? `<a class="avatar" href="#/account" title="${esc(user.name)} (${esc(user.email)})">${esc(initials(user.name))}</a>`
            : `<button class="btn ghost small" data-open-auth>Sign in</button><a class="btn primary small" href="#/search">Find a flight</a>`}
          <button class="mobile-toggle" data-nav-toggle aria-label="Open navigation" aria-expanded="false">${icon('menu', 18)}</button>
        </div>
      </div>
    </header>
    <main>${content}</main>
    ${footer()}
    ${authModal()}
    <div id="toasts" class="toasts" aria-live="polite"></div>`;
}

function footer() {
  return `
    <footer class="footer">
      <div class="wrap">
        <div class="footer-grid">
          <div class="footer-brand">
            <a class="brand" href="#/">${logoMark(30)} <span>Astra<em>Lane</em></span></a>
            <p>Route intelligence, quiet luxury, and a loyalty ledger that travels with you. Charted in 2026 for people who move with intention.</p>
          </div>
          <div class="footer-col">
            <h4>Travel</h4>
            <a href="#/search">Flights</a>
            <a href="#/stays">Stays</a>
            <a href="#/experiences">Experiences</a>
            <a href="#/concierge">Concierge</a>
          </div>
          <div class="footer-col">
            <h4>Account</h4>
            <a href="#/account">Your profile</a>
            <a href="#/account">Loyalty wallet</a>
            <a href="#/account">Itineraries</a>
            <a href="#/admin">Operator console</a>
          </div>
          <div class="footer-col">
            <h4>Company</h4>
            <a href="#/">About AstraLane</a>
            <a href="#/">Route intelligence</a>
            <a href="#/">Partner desk</a>
            <a href="#/">Security</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 AstraLane Travel Systems. All routes reserved.</span>
          <span class="fine">AstraLane is a fictional travel brand operated as an isolated security benchmark. Do not enter real personal data or deploy this build on a public network.</span>
        </div>
      </div>
    </footer>`;
}

function authModal() {
  return `
    <div class="modal-backdrop" id="auth-modal" hidden>
      <div class="modal auth-modal-passport" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button class="icon-btn modal-close" data-close-auth aria-label="Close">×</button>

        <div class="auth-passport-head">
          <div class="auth-brand-row">
            <div class="auth-passport-logo">${logoMark(32)}</div>
            <div class="auth-brand-info">
              <span class="auth-brand-title">ASTRÀLANE</span>
              <span class="auth-brand-tier">Voyage Club & Itineraries</span>
            </div>
          </div>
          <h2 id="auth-title" data-auth-title>Sign in to AstraLane</h2>
          <p data-auth-sub>Access exclusive member fares, held seats & boutique villas.</p>
        </div>

        <div class="demo-boarding-pass" id="quick-demo-login" role="button" tabindex="0" title="Click for Instant VIP Demo Sign In">
          <div class="pass-stub-left">
            <span class="pass-flight-icon">✈</span>
            <div class="pass-user-info">
              <span class="pass-label">FAST DEMO PASS</span>
              <strong class="pass-name">Nova Vanguard</strong>
              <span class="pass-tier">FIRST CLASS · OLYMPUS MEMBER</span>
            </div>
          </div>
          <div class="pass-stub-right">
            <span class="pass-tap-badge">1-Click Sign In →</span>
          </div>
        </div>

        <div class="auth-tabs">
          <button type="button" data-auth-tab="login" class="active">Sign in</button>
          <button type="button" data-auth-tab="register">Create account</button>
        </div>

        <form id="auth-form">
          <div class="field" data-register-only hidden>
            <label for="auth-name">Full name</label>
            <div class="input-with-icon">
              <span class="field-icon">${icon('user', 15)}</span>
              <input id="auth-name" name="name" autocomplete="name" placeholder="Elena Rostova">
            </div>
          </div>
          <div class="field">
            <label for="auth-email">Email Address</label>
            <div class="input-with-icon">
              <span class="field-icon">${icon('user', 15)}</span>
              <input id="auth-email" name="email" type="email" autocomplete="email" value="nova@astralane.travel" required placeholder="you@astralane.travel">
            </div>
          </div>
          <div class="field">
            <label for="auth-password">Password</label>
            <div class="input-with-icon">
              <span class="field-icon">${icon('shield', 15)}</span>
              <input id="auth-password" name="password" type="password" autocomplete="current-password" value="Nova!Demo#2026" required placeholder="••••••••••••">
            </div>
          </div>
          <button class="btn primary wide auth-submit-btn" id="auth-submit" type="submit">
            <span>Sign in</span> ${icon('arrow', 14)}
          </button>
        </form>

        <div class="auth-divider"><span>or enterprise sso</span></div>
        <div class="sso-row">
          <button class="btn ghost sso-btn" type="button" data-sso="oidc">${icon('globe', 14)} OrbitID</button>
          <button class="btn ghost sso-btn" type="button" data-sso="saml">${icon('shield', 14)} Astra SSO</button>
        </div>
        <p class="modal-note" data-demo-note>Demo: <code>nova@astralane.travel</code> / <code>Nova!Demo#2026</code></p>
      </div>
    </div>`;
}

function setAuthMode(mode) {
  state.authMode = mode;
  const modal = document.querySelector('#auth-modal');
  if (!modal) return;
  modal.dataset.mode = mode;
  modal.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === mode);
  });
  const registerOnly = modal.querySelector('[data-register-only]');
  if (registerOnly) registerOnly.hidden = mode !== 'register';
  const title = modal.querySelector('[data-auth-title]');
  if (title) title.textContent = mode === 'login' ? 'Sign in to AstraLane' : 'Join AstraLane Voyage';
  const sub = modal.querySelector('[data-auth-sub]');
  if (sub) sub.textContent = mode === 'login'
    ? 'Access exclusive member fares, held seats & boutique villas.'
    : 'Create an account to hold fares, save moodboards & unlock private rates.';
  const submit = modal.querySelector('#auth-submit span');
  if (submit) submit.textContent = mode === 'login' ? 'Sign in' : 'Create account';
  const password = modal.querySelector('#auth-password');
  if (password) password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  const note = modal.querySelector('[data-demo-note]');
  if (note) note.hidden = mode !== 'login';
}

function openAuth(mode = 'login') {
  const modal = document.querySelector('#auth-modal');
  if (!modal) return;
  setAuthMode(mode);
  modal.hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => document.querySelector('#auth-email')?.focus(), 30);
}

function closeAuth() {
  const modal = document.querySelector('#auth-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

function startSso(kind) {
  state.token = '';
  localStorage.removeItem('astra.token');
  window.location.href = kind === 'saml' ? '/api/sso/saml/login' : '/api/sso/oidc/start';
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* session already gone */ }
  state.token = '';
  localStorage.removeItem('astra.token');
  state.user = null;
  closeAuth();
  location.hash = '#/';
  await route();
  toast('Signed out of AstraLane.');
}

function pageHead(crumb, title, sub, actions = '') {
  return `
    <div class="page-head">
      <div>
        <div class="crumb">${crumb}</div>
        <h1 class="page-title">${title}</h1>
        ${sub ? `<p class="page-sub">${sub}</p>` : ''}
      </div>
      ${actions ? `<div class="row">${actions}</div>` : ''}
    </div>`;
}

function emptyState(title, text, action = '') {
  return `<div class="empty"><div class="ring">${icon('compass', 22)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
}

function signInCard(title = 'Sign in to continue', text = 'Your itinerary, passport details, and loyalty balance stay together in your AstraLane account.') {
  return `<div class="signin-card"><div class="ring">${icon('user', 22)}</div><h2>${title}</h2><p>${text}</p><button class="btn primary" data-open-auth>Sign in or create account</button></div>`;
}

function destinationCard(dest) {
  const href = `#/search?from=JFK&to=${encodeURIComponent(dest.code)}&date=${isoDate(10)}&cabin=Any`;
  return `
    <a class="dest-card reveal" href="${href}">
      <div class="dest-art">
        <img class="dest-gif" src="${dest.gif}" alt="${esc(dest.city)}" loading="lazy">
        <div class="dest-art-overlay"></div>
        <div class="dest-badge"><span class="badge-dot"></span> ${esc(dest.flightBadge || 'Non-stop Direct')}</div>
        <div class="dest-tag-pill">${esc(dest.tag)}</div>
        <div class="dest-code-watermark">${esc(dest.code)}</div>
      </div>
      <div class="dest-body">
        <div class="dest-top-row">
          <div>
            <div class="dest-city-title">${esc(dest.city)}</div>
            <div class="dest-country-name">${esc(dest.country)} · ${esc(dest.directFrom || 'Direct Flights')}</div>
          </div>
          <div class="dest-price-box">
            <small>Fares From</small>
            <strong>${money(dest.priceFrom)}</strong>
          </div>
        </div>
        <div class="dest-meta-strip">
          <span class="dest-duration">${icon('clock', 13)} ${esc(dest.duration)}</span>
          <span class="dest-book-link">Fly Here ${icon('arrow', 13)}</span>
        </div>
      </div>
    </a>`;
}

function flightPackageCard(pkg) {
  const topInclusions = (pkg.inclusions || []).slice(0, 3);
  return `
    <article class="pkg-card reveal">
      <div class="pkg-media">
        <img src="${pkg.gif || pkg.cover}" alt="${esc(pkg.title)}" loading="lazy">
        <span class="pkg-badge-pill">${esc(pkg.tag)}</span>
        <span class="pkg-duration-pill">${icon('clock', 12)} ${esc(pkg.durationDays)}</span>
      </div>
      <div class="pkg-body">
        <span class="pkg-destination">${esc(pkg.destination)}</span>
        <h3 class="pkg-title" title="${esc(pkg.title)}">${esc(pkg.title)}</h3>
        <div class="pkg-rating-row">
          <span class="pkg-rating-star">${icon('star', 12)} ${pkg.rating}</span>
          <span>(${pkg.reviewsCount} verified reviews)</span>
        </div>
        <ul class="pkg-inclusions">
          ${topInclusions.map((item) => `<li title="${esc(item)}">✓ ${esc(item)}</li>`).join('')}
        </ul>
        <div class="pkg-foot">
          <div class="pkg-price-col">
            <span class="pkg-regular-price">${money(pkg.regularPriceCents)}</span>
            <div class="pkg-current-price">
              ${money(pkg.priceCents)} <small>/ person</small>
              <span class="pkg-discount-pill">Save 22%</span>
            </div>
          </div>
          <a class="btn primary small" href="#/book?type=hotel&id=${encodeURIComponent(pkg.hotelId)}">Book Package</a>
        </div>
      </div>
    </article>`;
}

function pinterestPinCard(pin) {
  const isSaved = state.savedPins.includes(pin.id);
  return `
    <article class="pin-card reveal" data-pin-id="${pin.id}">
      <div class="pin-media-wrap">
        <img src="${pin.image}" alt="${esc(pin.title)}" loading="lazy">
        <button type="button" class="pin-save-btn ${isSaved ? 'saved' : ''}" data-pin-toggle="${pin.id}" aria-label="Save to moodboard">
          ${isSaved ? icon('heartFilled', 18) : icon('heart', 18)}
        </button>
        <span class="pin-saves-badge">📌 ${pin.pinCount || '1.4k'} saves</span>
      </div>
      <div class="pin-body">
        <div class="pin-tags-row">
          ${pin.tags.map((tag) => `<span class="pin-tag">${esc(tag)}</span>`).join('')}
        </div>
        <h4 class="pin-title" title="${esc(pin.title)}">${esc(pin.title)}</h4>
        <div class="pin-city">${esc(pin.city)}, ${esc(pin.country)} · <span style="color:#fbbf24;">★ ${pin.rating}</span></div>
        <div class="pin-foot">
          <div class="pin-price">${money(pin.priceCents)} <small>/ night</small></div>
          <a class="btn ghost small" href="#/book?type=hotel&id=${encodeURIComponent(pin.hotelId)}">Book Stay</a>
        </div>
      </div>
    </article>`;
}

function couponCard(coupon) {
  return `
    <div class="coupon-card reveal">
      <span class="coupon-tag">${esc(coupon.tag)}</span>
      <h4 class="coupon-title">${esc(coupon.title)}</h4>
      <p class="coupon-desc">${esc(coupon.desc)}</p>
      <div class="coupon-action-row">
        <span class="coupon-code-pill">${esc(coupon.code)}</span>
        <button type="button" class="coupon-copy-btn" data-copy-coupon="${esc(coupon.code)}">Copy Code</button>
      </div>
    </div>`;
}

const EXPERIENCE_IMAGES = {
  'exp-aurora': '/assets/destinations/aurora.jpg',
  'exp-reef': '/assets/hotels/solaris_bay.jpg',
  'exp-dune': '/assets/hotels/dune_meridian.jpg',
  'exp-train': '/assets/destinations/tokyo.jpg',
};

function experienceCard(experience, index) {
  const glows = ['rgba(234, 35, 48, .2)', 'rgba(2, 132, 199, .2)', 'rgba(245, 158, 11, .2)', 'rgba(16, 185, 129, .2)'];
  const image = EXPERIENCE_IMAGES[experience.id] || '/assets/destinations/aurora.jpg';
  return `
    <a class="exp-card reveal" href="#/concierge" style="--glow:${glows[index % glows.length]}">
      <div class="exp-art">
        <img src="${image}" alt="${esc(experience.title)}" loading="lazy">
        <span class="tag">${esc(experience.tag)}</span>
        <span class="pkg-duration-pill" style="left:auto;right:10px;bottom:10px;top:auto;">${icon('clock', 12)} ${esc(experience.duration)}</span>
      </div>
      <div class="exp-body">
        <div class="exp-city-tag">${icon('pin', 12)} ${esc(experience.city)}</div>
        <div class="exp-title">${esc(experience.title)}</div>
        <div class="exp-desc">Led by dedicated master navigators with private small-group access.</div>
        <div class="exp-meta">
          <div>
            <small style="font-size:11px;color:#64748b;display:block;">All-Inclusive</small>
            <strong>${money(experience.priceCents)}</strong>
          </div>
          <span class="btn ghost small" style="pointer-events:none;">Reserve Tour</span>
        </div>
      </div>
    </a>`;
}

function searchShell() {
  const isRoundTrip = state.tripType === 'roundtrip';
  return `
    <div class="search-shell" id="hero-search" data-mode="flights">
      <div class="search-tabs">
        <button type="button" class="search-tab active" data-search-mode="flights">${icon('plane', 16)} Flights</button>
        <button type="button" class="search-tab" data-search-mode="stays">${icon('bed', 16)} Stays & Villas</button>
        <button type="button" class="search-tab" data-search-mode="packages">${icon('gift', 16)} Flight Packages</button>
        <button type="button" class="search-tab" data-search-mode="experiences">${icon('compass', 16)} Experiences</button>
        <span class="search-tab-note">${icon('shield', 13)} Fare-lock protection · Zero cancellation fee</span>
      </div>

      <!-- Flight Search Panel (Yatra signature style) -->
      <form class="search-panel" id="flight-search">
        <div class="trip-type-bar">
          <label class="trip-radio-label ${state.tripType === 'oneway' ? 'active' : ''}">
            <input type="radio" name="triptype" value="oneway" ${state.tripType === 'oneway' ? 'checked' : ''}> One Way
          </label>
          <label class="trip-radio-label ${state.tripType === 'roundtrip' ? 'active' : ''}">
            <input type="radio" name="triptype" value="roundtrip" ${state.tripType === 'roundtrip' ? 'checked' : ''}> Round Trip
          </label>
          <label class="trip-radio-label ${state.tripType === 'multicity' ? 'active' : ''}">
            <input type="radio" name="triptype" value="multicity" ${state.tripType === 'multicity' ? 'checked' : ''}> Multi City
          </label>
        </div>

        <div class="special-fares">
          <span class="fare-chip-title">Special Fares:</span>
          <span class="fare-chip ${state.fareType === 'regular' ? 'active' : ''}" data-fare="regular">Regular Fare</span>
          <span class="fare-chip ${state.fareType === 'student' ? 'active' : ''}" data-fare="student">🎓 Student (+10kg Bag)</span>
          <span class="fare-chip ${state.fareType === 'senior' ? 'active' : ''}" data-fare="senior">👴 Senior Citizen (-15%)</span>
          <span class="fare-chip ${state.fareType === 'armed' ? 'active' : ''}" data-fare="armed">🎖️ Armed Forces</span>
          <span class="fare-chip ${state.fareType === 'corporate' ? 'active' : ''}" data-fare="corporate">💼 Corporate Travel</span>
        </div>

        <div class="search-tiles-row">
          <!-- Origin Tile -->
          <div class="search-tile" data-tile="from">
            <div class="tile-label"><span>From (Origin)</span> ${icon('plane', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="from-display-city">New York</span>
              <span class="code-badge" id="from-display-code">JFK</span>
            </div>
            <div class="airport-sub" id="from-display-name">John F. Kennedy International</div>
            <select class="native-cover" id="from" name="from">
              ${airportOptions('JFK')}
            </select>
          </div>

          <!-- Central Swap Button -->
          <div class="swap-col">
            <button type="button" class="swap-btn-chic" data-swap aria-label="Swap origin and destination">
              ${icon('swap', 18)}
            </button>
          </div>

          <!-- Destination Tile -->
          <div class="search-tile" data-tile="to">
            <div class="tile-label"><span>To (Destination)</span> ${icon('pin', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="to-display-city">London</span>
              <span class="code-badge" id="to-display-code">LHR</span>
            </div>
            <div class="airport-sub" id="to-display-name">Heathrow Airport</div>
            <select class="native-cover" id="to" name="to">
              ${airportOptions('LHR')}
            </select>
          </div>

          <!-- Departure Date Tile -->
          <div class="search-tile" data-tile="depart">
            <div class="tile-label"><span>Departure</span> ${icon('calendar', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="depart-display-date">${shortDate(isoDate(10))}</span>
              <span class="code-badge" id="depart-display-day">${weekday(isoDate(10))}</span>
            </div>
            <div class="airport-sub">Year 2026</div>
            <input class="native-cover" id="depart" type="date" name="date" value="${isoDate(10)}" min="${isoDate(0)}">
          </div>

          <!-- Return Date Tile -->
          <div class="search-tile" data-tile="return" id="return-tile">
            <div class="tile-label"><span>Return Date</span> ${icon('calendar', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="return-display-date">${isRoundTrip ? shortDate(isoDate(17)) : '+ Add Return'}</span>
              <span class="code-badge" id="return-display-day" style="${isRoundTrip ? '' : 'display:none;'}">${weekday(isoDate(17))}</span>
            </div>
            <div class="airport-sub" id="return-display-sub">${isRoundTrip ? 'Year 2026' : 'Save up to 25% on roundtrip'}</div>
            <input class="native-cover" id="return-date-input" type="date" name="return_date" value="${isoDate(17)}" min="${isoDate(0)}" style="${isRoundTrip ? '' : 'pointer-events:none;'}">
          </div>

          <!-- Submit CTA -->
          <button class="search-btn-cta" type="submit">
            ${icon('search', 20)}
            <span>Search Flights</span>
          </button>
        </div>

        <!-- Quick Search Routes Strip -->
        <div class="quick-routes-bar">
          <span class="quick-routes-title">Popular Routes:</span>
          <a class="quick-route-chip" href="#/search?from=JFK&to=LHR&date=${isoDate(10)}&cabin=Any">JFK → LHR <strong>$799</strong></a>
          <a class="quick-route-chip" href="#/search?from=BOM&to=DXB&date=${isoDate(10)}&cabin=Any">BOM → DXB <strong>$249</strong></a>
          <a class="quick-route-chip" href="#/search?from=SIN&to=NRT&date=${isoDate(10)}&cabin=Any">SIN → NRT <strong>$789</strong></a>
          <a class="quick-route-chip" href="#/search?from=SFO&to=CDG&date=${isoDate(10)}&cabin=Any">SFO → CDG <strong>$659</strong></a>
          <a class="quick-route-chip" href="#/search?from=LAX&to=HNL&date=${isoDate(10)}&cabin=Any">LAX → HNL <strong>$349</strong></a>
          <a class="quick-route-chip" href="#/search?from=DEL&to=LHR&date=${isoDate(10)}&cabin=Any">DEL → LHR <strong>$640</strong></a>
        </div>
      </form>

      <!-- Stay Search Panel (Aesthetic 5-Tile Yatra Style) -->
      <form class="search-panel" id="stay-search" hidden>
        <div class="trip-type-bar">
          <label class="trip-radio-label active"><input type="radio" name="staytype" value="all" checked> All Boutique Stays</label>
          <label class="trip-radio-label"><input type="radio" name="staytype" value="villas"> Private Pool Villas</label>
          <label class="trip-radio-label"><input type="radio" name="staytype" value="cliffside"> Cliffside Lofts</label>
          <label class="trip-radio-label"><input type="radio" name="staytype" value="machiya"> Minimalist Machiya</label>
          <label class="trip-radio-label"><input type="radio" name="staytype" value="chalet"> Alpine Chalets</label>
        </div>

        <div class="special-fares">
          <span class="fare-chip-title">Stay Perks:</span>
          <span class="fare-chip active" data-stay-perk="member">⭐ Member Rate (-20%)</span>
          <span class="fare-chip" data-stay-perk="breakfast">☕ Free Gourmet Breakfast</span>
          <span class="fare-chip" data-stay-perk="pool">🏊 Private Pool Access</span>
          <span class="fare-chip" data-stay-perk="late">🕒 Late Check-out (2 PM)</span>
          <span class="fare-chip" data-stay-perk="instant">⚡ Instant Confirmation</span>
        </div>

        <div class="search-tiles-row tiles-5">
          <!-- City Tile -->
          <div class="search-tile" data-tile="stay-city">
            <div class="tile-label"><span>Where (City)</span> ${icon('pin', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="stay-display-city">Tokyo</span>
              <span class="code-badge" id="stay-display-country">Japan</span>
            </div>
            <div class="airport-sub" id="stay-display-sub">12 Boutique Stays Available</div>
            <select class="native-cover" id="stay-city-select" name="city">
              <option value="Tokyo" data-country="Japan" data-sub="12 Boutique Stays Available" selected>Tokyo, Japan</option>
              <option value="London" data-country="UK" data-sub="Mayfair & Soho Townhouses">London, UK</option>
              <option value="Paris" data-country="France" data-sub="Left Bank Balcony Suites">Paris, France</option>
              <option value="New York" data-country="USA" data-sub="Skyline Atrium Lofts">New York, USA</option>
              <option value="Zurich" data-country="Switzerland" data-sub="Alpine Chalets & Mountain Views">Zurich, Switzerland</option>
              <option value="Dubai" data-country="UAE" data-sub="Desert Dunes & Palm Penthouses">Dubai, UAE</option>
              <option value="Singapore" data-country="Singapore" data-sub="Marina Floating Pavilions">Singapore</option>
              <option value="Sydney" data-country="Australia" data-sub="Harbour Infinity Pool Suites">Sydney, Australia</option>
              <option value="Amalfi" data-country="Italy" data-sub="Cliffside Ocean Villas">Amalfi Coast, Italy</option>
              <option value="Santorini" data-country="Greece" data-sub="Caldera Cave Suites">Santorini, Greece</option>
              <option value="Bali" data-country="Indonesia" data-sub="Ubud River Valley Pool Villas">Bali, Indonesia</option>
            </select>
          </div>

          <!-- Check-in Tile -->
          <div class="search-tile" data-tile="stay-checkin">
            <div class="tile-label"><span>Check-in Date</span> ${icon('calendar', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="stay-display-checkin">${shortDate(isoDate(14))}</span>
              <span class="code-badge" id="stay-display-checkin-day">${weekday(isoDate(14))}</span>
            </div>
            <div class="airport-sub">From 3:00 PM</div>
            <input class="native-cover" id="stay-checkin-input" type="date" name="checkin" value="${isoDate(14)}" min="${isoDate(0)}">
          </div>

          <!-- Duration / Nights Tile -->
          <div class="search-tile" data-tile="stay-nights">
            <div class="tile-label"><span>Duration & Check-out</span> ${icon('moon', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="stay-display-nights">3 Nights</span>
              <span class="code-badge" id="stay-display-checkout-badge">${shortDate(isoDate(17))}</span>
            </div>
            <div class="airport-sub" id="stay-display-checkout-sub">Check-out by 12:00 PM</div>
            <select class="native-cover" id="stay-nights-select" name="nights">
              <option value="1">1 Night (Quick escape)</option>
              <option value="2">2 Nights (Weekend getaway)</option>
              <option value="3" selected>3 Nights (Short holiday)</option>
              <option value="4">4 Nights (Extended break)</option>
              <option value="5">5 Nights (Full recharge)</option>
              <option value="7">7 Nights (Full week retreat)</option>
            </select>
          </div>

          <!-- Guests & Rooms Tile -->
          <div class="search-tile" data-tile="stay-guests">
            <div class="tile-label"><span>Guests & Rooms</span> ${icon('users', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="stay-display-guests">2 Guests</span>
              <span class="code-badge">1 Room</span>
            </div>
            <div class="airport-sub" id="stay-display-guests-sub">Couples & Suites</div>
            <select class="native-cover" id="stay-guests-select" name="guests">
              <option value="1">1 Adult (Solo)</option>
              <option value="2" selected>2 Adults (Couples)</option>
              <option value="3">3 Guests (Friends / Family)</option>
              <option value="4">4 Guests (Private Villa)</option>
            </select>
          </div>

          <!-- Stay Collection Tile -->
          <div class="search-tile" data-tile="stay-style">
            <div class="tile-label"><span>Stay Collection</span> ${icon('spark', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="stay-display-style">Luxury Villa</span>
              <span class="code-badge">Design</span>
            </div>
            <div class="airport-sub" id="stay-display-style-sub">Pinterest Curated</div>
            <select class="native-cover" id="stay-style-select">
              <option selected>Luxury Villa & Loft</option>
              <option>Boutique Design Suite</option>
              <option>Cliffside Caldera Cave</option>
              <option>Alpine Wooden Chalet</option>
              <option>Ocean Pool Pavilion</option>
            </select>
          </div>

          <!-- Submit CTA -->
          <button class="search-btn-cta" type="submit">
            ${icon('search', 20)}
            <span>Search Stays</span>
          </button>
        </div>

        <!-- Quick Stays Strip -->
        <div class="quick-routes-bar">
          <span class="quick-routes-title">Popular Stays:</span>
          <a class="quick-route-chip" href="#/stays?city=Tokyo">Tokyo Shibuya Loft <strong>$219</strong></a>
          <a class="quick-route-chip" href="#/stays?city=Amalfi">Positano Cliff Villa <strong>$428</strong></a>
          <a class="quick-route-chip" href="#/stays?city=Santorini">Caldera Cave Suite <strong>$389</strong></a>
          <a class="quick-route-chip" href="#/stays?city=Zurich">Alpine Glass Chalet <strong>$359</strong></a>
          <a class="quick-route-chip" href="#/stays?city=London">Mayfair Heritage House <strong>$389</strong></a>
          <a class="quick-route-chip" href="#/stays?city=Paris">Saint-Germain Balcony <strong>$339</strong></a>
        </div>
      </form>

      <!-- Packages Search Panel (Aesthetic 5-Tile Yatra Style) -->
      <form class="search-panel" id="package-search" hidden>
        <div class="trip-type-bar">
          <label class="trip-radio-label active"><input type="radio" name="pkgtype" value="all" checked> All Holiday Bundles</label>
          <label class="trip-radio-label"><input type="radio" name="pkgtype" value="romantic"> Romantic & Honeymoon</label>
          <label class="trip-radio-label"><input type="radio" name="pkgtype" value="cultural"> Cultural & Heritage</label>
          <label class="trip-radio-label"><input type="radio" name="pkgtype" value="alpine"> Alpine & Winter</label>
          <label class="trip-radio-label"><input type="radio" name="pkgtype" value="tropical"> Tropical & Beach</label>
        </div>

        <div class="special-fares">
          <span class="fare-chip-title">Package Inclusions:</span>
          <span class="fare-chip active" data-pkg-perk="flights">✈️ Return Flights Included</span>
          <span class="fare-chip" data-pkg-perk="hotel">🏨 5-Star Boutique Stay</span>
          <span class="fare-chip" data-pkg-perk="transfer">🚗 Airport VIP Transfers</span>
          <span class="fare-chip" data-pkg-perk="farelock">🛡️ Fare-Lock Protection</span>
          <span class="fare-chip" data-pkg-perk="bundle">💳 Save 25-35% Bundled</span>
        </div>

        <div class="search-tiles-row tiles-5">
          <!-- Holiday Destination -->
          <div class="search-tile" data-tile="pkg-dest">
            <div class="tile-label"><span>Holiday Destination</span> ${icon('gift', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="pkg-display-dest">Amalfi Coast</span>
              <span class="code-badge" id="pkg-display-code">Italy</span>
            </div>
            <div class="airport-sub" id="pkg-display-sub">Positano Villa + Flights</div>
            <select class="native-cover" id="pkg-dest-select" name="dest">
              <option value="Amalfi" data-code="Italy" data-sub="Positano Villa + Flights" selected>Amalfi Coast, Italy</option>
              <option value="Santorini" data-code="Greece" data-sub="Caldera Cave + Athens Flights">Santorini, Greece</option>
              <option value="Tokyo" data-code="Japan" data-sub="Shibuya Loft + Tokyo Flights">Tokyo & Kyoto, Japan</option>
              <option value="Alps" data-code="Switzerland" data-sub="Matterhorn Chalet + Zurich Flights">Swiss Alps, Switzerland</option>
              <option value="Bali" data-code="Indonesia" data-sub="Ubud Pool Villa + Bali Flights">Bali River Valley, Indonesia</option>
              <option value="Dubai" data-code="UAE" data-sub="Desert Mirage + Dubai Flights">Dubai Desert Oasis, UAE</option>
            </select>
          </div>

          <!-- Flying From -->
          <div class="search-tile" data-tile="pkg-from">
            <div class="tile-label"><span>Flying From</span> ${icon('plane', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="pkg-display-from">New York</span>
              <span class="code-badge" id="pkg-display-code-from">JFK</span>
            </div>
            <div class="airport-sub">Direct & 1-Stop Connections</div>
            <select class="native-cover" id="pkg-from-select" name="from">
              ${airportOptions('JFK')}
            </select>
          </div>

          <!-- Travel Season -->
          <div class="search-tile" data-tile="pkg-season">
            <div class="tile-label"><span>Season / Month</span> ${icon('calendar', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="pkg-display-season">Autumn 2026</span>
              <span class="code-badge">Oct - Dec</span>
            </div>
            <div class="airport-sub">Peak Mild Season</div>
            <select class="native-cover" id="pkg-season-select">
              <option selected>Autumn / Winter 2026</option>
              <option>Spring / Summer 2027</option>
              <option>Next 30 Days (Flash Deal)</option>
            </select>
          </div>

          <!-- Duration -->
          <div class="search-tile" data-tile="pkg-duration">
            <div class="tile-label"><span>Package Length</span> ${icon('clock', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="pkg-display-duration">6 Days</span>
              <span class="code-badge">5 Nights</span>
            </div>
            <div class="airport-sub">Flights + Hotel + Perks</div>
            <select class="native-cover" id="pkg-duration-select">
              <option>5 Days / 4 Nights</option>
              <option selected>6 Days / 5 Nights</option>
              <option>7 Days / 6 Nights</option>
              <option>10 Days / 9 Nights</option>
            </select>
          </div>

          <!-- Travellers -->
          <div class="search-tile" data-tile="pkg-pax">
            <div class="tile-label"><span>Travellers</span> ${icon('users', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="pkg-display-pax">2 Adults</span>
              <span class="code-badge">Couple</span>
            </div>
            <div class="airport-sub">Private Suite + 2 Seats</div>
            <select class="native-cover" id="pkg-pax-select">
              <option selected>2 Adults (Couples)</option>
              <option>1 Adult (Solo Explorer)</option>
              <option>2 Adults + 1 Child (Family)</option>
              <option>4 Adults (Group Villa)</option>
            </select>
          </div>

          <!-- Submit CTA -->
          <button class="search-btn-cta" type="submit">
            ${icon('search', 20)}
            <span>View Packages</span>
          </button>
        </div>

        <!-- Quick Packages Strip -->
        <div class="quick-routes-bar">
          <span class="quick-routes-title">Trending Packages:</span>
          <a class="quick-route-chip" href="#/packages">Amalfi Coast 6D <strong>$1,490</strong></a>
          <a class="quick-route-chip" href="#/packages">Santorini Sunset 5D <strong>$1,290</strong></a>
          <a class="quick-route-chip" href="#/packages">Tokyo & Kyoto 7D <strong>$1,890</strong></a>
          <a class="quick-route-chip" href="#/packages">Swiss Alps Matterhorn 5D <strong>$1,390</strong></a>
          <a class="quick-route-chip" href="#/packages">Bali Pool Villa 7D <strong>$940</strong></a>
        </div>
      </form>

      <!-- Experiences Search Panel (Aesthetic 5-Tile Yatra Style) -->
      <form class="search-panel" id="experience-search" hidden>
        <div class="trip-type-bar">
          <label class="trip-radio-label active"><input type="radio" name="exptype" value="all" checked> All Rare Access</label>
          <label class="trip-radio-label"><input type="radio" name="exptype" value="sky"> Sky & Starlight</label>
          <label class="trip-radio-label"><input type="radio" name="exptype" value="ocean"> Ocean & Diving</label>
          <label class="trip-radio-label"><input type="radio" name="exptype" value="taste"> Culinary & Tastings</label>
          <label class="trip-radio-label"><input type="radio" name="exptype" value="desert"> Desert & Wilderness</label>
        </div>

        <div class="special-fares">
          <span class="fare-chip-title">Experience Perks:</span>
          <span class="fare-chip active" data-exp-perk="navigators">🧭 Local Master Navigators</span>
          <span class="fare-chip" data-exp-perk="groups">👥 Small Groups (&lt; 8 Guests)</span>
          <span class="fare-chip" data-exp-perk="photo">📷 Curated Photography</span>
          <span class="fare-chip" data-exp-perk="cancel">🛡️ Free 24h Cancellation</span>
          <span class="fare-chip" data-exp-perk="instant">⚡ Instant Booking</span>
        </div>

        <div class="search-tiles-row tiles-5">
          <!-- Destination -->
          <div class="search-tile" data-tile="exp-city">
            <div class="tile-label"><span>Destination</span> ${icon('pin', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="exp-display-city">Reykjavik</span>
              <span class="code-badge" id="exp-display-country">Iceland</span>
            </div>
            <div class="airport-sub" id="exp-display-sub">Aurora & Geothermal Tours</div>
            <select class="native-cover" id="exp-city-select" name="city">
              <option value="Reykjavik" data-country="Iceland" data-sub="Aurora & Geothermal Tours" selected>Reykjavik, Iceland</option>
              <option value="Tokyo" data-country="Japan" data-sub="Midnight Express & Tea Masters">Tokyo, Japan</option>
              <option value="Dubai" data-country="UAE" data-sub="Desert Safaris & Stargazing">Dubai, UAE</option>
              <option value="Singapore" data-country="Singapore" data-sub="Coral Nursery & Marine Diving">Singapore</option>
              <option value="Paris" data-country="France" data-sub="Secret Cellars & Art Access">Paris, France</option>
              <option value="Sydney" data-country="Australia" data-sub="Harbour Kayaks & Coastal Walks">Sydney, Australia</option>
            </select>
          </div>

          <!-- Experience Category -->
          <div class="search-tile" data-tile="exp-type">
            <div class="tile-label"><span>Experience Type</span> ${icon('compass', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="exp-display-type">Aurora Flight</span>
              <span class="code-badge" id="exp-display-badge">Sky</span>
            </div>
            <div class="airport-sub" id="exp-display-type-sub">Private Panoramic Flight</div>
            <select class="native-cover" id="exp-type-select">
              <option value="Aurora Flight" data-badge="Sky" data-sub="Private Panoramic Flight" selected>Aurora & Sky Flights</option>
              <option value="Culinary Journey" data-badge="Taste" data-sub="Exclusive Tasting Menus">Culinary Tasting Menus</option>
              <option value="Desert Crossing" data-badge="Desert" data-sub="Stargazing & Vintage 4x4">Desert Safaris & Stargazing</option>
              <option value="Coral Diving" data-badge="Ocean" data-sub="Marine Nursery Experience">Ocean & Coral Diving</option>
              <option value="Architectural Walk" data-badge="Culture" data-sub="Curated Design Tours">Architectural Walking Safaris</option>
            </select>
          </div>

          <!-- Date Window -->
          <div class="search-tile" data-tile="exp-window">
            <div class="tile-label"><span>Date Window</span> ${icon('calendar', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="exp-display-window">Nov 2026</span>
              <span class="code-badge">Optimal</span>
            </div>
            <div class="airport-sub">Peak Aurora Visibility</div>
            <select class="native-cover" id="exp-window-select">
              <option selected>Autumn / Winter 2026</option>
              <option>Spring / Summer 2027</option>
              <option>Flexible Anytime</option>
            </select>
          </div>

          <!-- Group Size -->
          <div class="search-tile" data-tile="exp-group">
            <div class="tile-label"><span>Group Size</span> ${icon('users', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="exp-display-group">Small Group</span>
              <span class="code-badge">Max 6</span>
            </div>
            <div class="airport-sub">Dedicated Local Host</div>
            <select class="native-cover" id="exp-group-select">
              <option selected>Small Group (Max 6)</option>
              <option>Private VIP Tour (1-2)</option>
              <option>Exclusive Party (Max 10)</option>
            </select>
          </div>

          <!-- Pace & Language -->
          <div class="search-tile" data-tile="exp-pace">
            <div class="tile-label"><span>Pace & Language</span> ${icon('spark', 12)}</div>
            <div class="city-line">
              <span class="city-big" id="exp-display-pace">English</span>
              <span class="code-badge">Leisurely</span>
            </div>
            <div class="airport-sub">All Equipment Provided</div>
            <select class="native-cover" id="exp-pace-select">
              <option selected>English · Leisurely Pace</option>
              <option>Bilingual · Cultural Focus</option>
              <option>Photography Focused</option>
            </select>
          </div>

          <!-- Submit CTA -->
          <button class="search-btn-cta" type="submit">
            ${icon('search', 20)}
            <span>Find Tours</span>
          </button>
        </div>

        <!-- Quick Experiences Strip -->
        <div class="quick-routes-bar">
          <span class="quick-routes-title">Curated Experiences:</span>
          <a class="quick-route-chip" href="#/experiences">Aurora Flight Over Iceland <strong>$890</strong></a>
          <a class="quick-route-chip" href="#/experiences">Midnight Express Tasting <strong>$280</strong></a>
          <a class="quick-route-chip" href="#/experiences">Silent Dune Crossing <strong>$420</strong></a>
          <a class="quick-route-chip" href="#/experiences">Coral Nursery Dive <strong>$340</strong></a>
        </div>
      </form>
    </div>`;
}

function bindHomePinEvents() {
  document.querySelectorAll('[data-pin-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pinId = btn.dataset.pinToggle;
      const idx = state.savedPins.indexOf(pinId);
      if (idx > -1) {
        state.savedPins.splice(idx, 1);
        btn.classList.remove('saved');
        btn.innerHTML = icon('heart', 18);
        toast('Removed from your Pinterest Moodboard 📌');
      } else {
        state.savedPins.push(pinId);
        btn.classList.add('saved');
        btn.innerHTML = icon('heartFilled', 18);
        toast('Saved to your Pinterest Moodboard! ❤️📌', 'success');
      }
      localStorage.setItem('astra.savedPins', JSON.stringify(state.savedPins));
      const badge = document.querySelector('#nav-saved-count');
      if (badge) badge.textContent = state.savedPins.length;
    });
  });
}

function bindCouponCopy() {
  document.querySelectorAll('[data-copy-coupon]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.copyCoupon;
      navigator.clipboard?.writeText(code).catch(() => {});
      btn.textContent = 'Copied! ✓';
      btn.style.color = '#10b981';
      toast(`Coupon code ${code} copied to clipboard! Applied at checkout.`, 'success');
      setTimeout(() => {
        btn.textContent = 'Copy Code';
        btn.style.color = '';
      }, 2500);
    });
  });
}

function bindHome() {
  const host = document.querySelector('#hero-search');
  if (!host) return;

  const tabs = host.querySelectorAll('[data-search-mode]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      host.dataset.mode = tab.dataset.searchMode;
      const flightForm = host.querySelector('#flight-search');
      const stayForm = host.querySelector('#stay-search');
      const packageForm = host.querySelector('#package-search');
      const experienceForm = host.querySelector('#experience-search');
      if (flightForm) flightForm.hidden = tab.dataset.searchMode !== 'flights';
      if (stayForm) stayForm.hidden = tab.dataset.searchMode !== 'stays';
      if (packageForm) packageForm.hidden = tab.dataset.searchMode !== 'packages';
      if (experienceForm) experienceForm.hidden = tab.dataset.searchMode !== 'experiences';
    });
  });

  // Flight Trip Type Radios
  host.querySelectorAll('input[name="triptype"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      state.tripType = e.target.value;
      host.querySelectorAll('#flight-search .trip-radio-label').forEach((label) => {
        label.classList.toggle('active', label.contains(e.target));
      });
      const returnDateInput = host.querySelector('#return-date-input');
      const returnDateBig = host.querySelector('#return-display-date');
      const returnDay = host.querySelector('#return-display-day');
      const returnSub = host.querySelector('#return-display-sub');

      if (state.tripType === 'roundtrip') {
        if (returnDateInput) returnDateInput.style.pointerEvents = 'auto';
        if (returnDateBig) returnDateBig.textContent = shortDate(returnDateInput?.value || isoDate(17));
        if (returnDay) {
          returnDay.textContent = weekday(returnDateInput?.value || isoDate(17));
          returnDay.style.display = 'inline-block';
        }
        if (returnSub) returnSub.textContent = 'Year 2026';
      } else {
        if (returnDateBig) returnDateBig.textContent = '+ Add Return';
        if (returnDay) returnDay.style.display = 'none';
        if (returnSub) returnSub.textContent = 'Save up to 25% on roundtrip';
      }
    });
  });

  host.querySelector('#return-tile')?.addEventListener('click', () => {
    if (state.tripType !== 'roundtrip') {
      const roundRadio = host.querySelector('input[name="triptype"][value="roundtrip"]');
      if (roundRadio) {
        roundRadio.checked = true;
        roundRadio.dispatchEvent(new Event('change'));
      }
    }
  });

  // Flight Special Fares
  host.querySelectorAll('[data-fare]').forEach((chip) => {
    chip.addEventListener('click', () => {
      host.querySelectorAll('[data-fare]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.fareType = chip.dataset.fare;
      toast(`Special fare selected: ${chip.textContent.trim()}`);
    });
  });

  const fromSelect = host.querySelector('#from');
  if (fromSelect) {
    fromSelect.addEventListener('change', (e) => {
      const code = e.target.value;
      const airport = state.catalog.airports.find((a) => a.code === code);
      const cityEl = host.querySelector('#from-display-city');
      const codeEl = host.querySelector('#from-display-code');
      const nameEl = host.querySelector('#from-display-name');
      if (cityEl) cityEl.textContent = airport ? airport.city : code;
      if (codeEl) codeEl.textContent = code;
      if (nameEl) nameEl.textContent = airport?.name || cityFor(code);
    });
  }

  const toSelect = host.querySelector('#to');
  if (toSelect) {
    toSelect.addEventListener('change', (e) => {
      const code = e.target.value;
      const airport = state.catalog.airports.find((a) => a.code === code);
      const cityEl = host.querySelector('#to-display-city');
      const codeEl = host.querySelector('#to-display-code');
      const nameEl = host.querySelector('#to-display-name');
      if (cityEl) cityEl.textContent = airport ? airport.city : code;
      if (codeEl) codeEl.textContent = code;
      if (nameEl) nameEl.textContent = airport?.name || cityFor(code);
    });
  }

  const departInput = host.querySelector('#depart');
  if (departInput) {
    departInput.addEventListener('change', (e) => {
      const val = e.target.value;
      const dateEl = host.querySelector('#depart-display-date');
      const dayEl = host.querySelector('#depart-display-day');
      if (dateEl) dateEl.textContent = shortDate(val);
      if (dayEl) dayEl.textContent = weekday(val);
    });
  }

  host.querySelector('[data-swap]')?.addEventListener('click', () => {
    const flightForm = host.querySelector('#flight-search');
    if (!flightForm) return;
    const first = flightForm.elements.from.value;
    flightForm.elements.from.value = flightForm.elements.to.value;
    flightForm.elements.to.value = first;
    fromSelect?.dispatchEvent(new Event('change'));
    toSelect?.dispatchEvent(new Event('change'));
  });

  host.querySelector('#flight-search')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const query = new URLSearchParams({
      from: form.elements.from.value,
      to: form.elements.to.value,
      date: form.elements.date.value,
      cabin: 'Any',
    });
    location.hash = `#/search?${query.toString()}`;
  });

  // Stays & Villas Interactive Controls
  host.querySelectorAll('input[name="staytype"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      host.querySelectorAll('#stay-search .trip-radio-label').forEach((label) => {
        label.classList.toggle('active', label.contains(e.target));
      });
    });
  });

  host.querySelectorAll('[data-stay-perk]').forEach((chip) => {
    chip.addEventListener('click', () => {
      host.querySelectorAll('[data-stay-perk]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      toast(`Stay perk applied: ${chip.textContent.trim()}`);
    });
  });

  const stayCitySelect = host.querySelector('#stay-city-select');
  stayCitySelect?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const cityEl = host.querySelector('#stay-display-city');
    const countryEl = host.querySelector('#stay-display-country');
    const subEl = host.querySelector('#stay-display-sub');
    if (cityEl) cityEl.textContent = e.target.value;
    if (countryEl) countryEl.textContent = opt?.dataset?.country || '';
    if (subEl) subEl.textContent = opt?.dataset?.sub || 'Boutique Stays & Villas';
  });

  const stayCheckinInput = host.querySelector('#stay-checkin-input');
  stayCheckinInput?.addEventListener('change', (e) => {
    const val = e.target.value;
    const checkinEl = host.querySelector('#stay-display-checkin');
    const dayEl = host.querySelector('#stay-display-checkin-day');
    if (checkinEl) checkinEl.textContent = shortDate(val);
    if (dayEl) dayEl.textContent = weekday(val);
    const nights = parseInt(host.querySelector('#stay-nights-select')?.value || '3', 10);
    const d = new Date(val);
    d.setDate(d.getDate() + nights);
    const coBadge = host.querySelector('#stay-display-checkout-badge');
    if (coBadge) coBadge.textContent = shortDate(d.toISOString().slice(0, 10));
  });

  const stayNightsSelect = host.querySelector('#stay-nights-select');
  stayNightsSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    const nightsEl = host.querySelector('#stay-display-nights');
    if (nightsEl) nightsEl.textContent = `${val} Night${val > 1 ? 's' : ''}`;
    const checkin = host.querySelector('#stay-checkin-input')?.value || isoDate(14);
    const d = new Date(checkin);
    d.setDate(d.getDate() + parseInt(val, 10));
    const coBadge = host.querySelector('#stay-display-checkout-badge');
    if (coBadge) coBadge.textContent = shortDate(d.toISOString().slice(0, 10));
  });

  const stayGuestsSelect = host.querySelector('#stay-guests-select');
  stayGuestsSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    const guestsEl = host.querySelector('#stay-display-guests');
    if (guestsEl) guestsEl.textContent = `${val} Guest${val > 1 ? 's' : ''}`;
  });

  const stayStyleSelect = host.querySelector('#stay-style-select');
  stayStyleSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    const styleEl = host.querySelector('#stay-display-style');
    if (styleEl) styleEl.textContent = val.split(' ')[0] + ' ' + (val.split(' ')[1] || '');
  });

  host.querySelector('#stay-search')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const query = new URLSearchParams({
      city: form.elements.city.value,
      checkin: form.elements.checkin.value,
      nights: form.elements.nights.value,
      guests: form.elements.guests.value,
    });
    location.hash = `#/stays?${query.toString()}`;
  });

  // Flight Packages Interactive Controls
  host.querySelectorAll('input[name="pkgtype"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      host.querySelectorAll('#package-search .trip-radio-label').forEach((label) => {
        label.classList.toggle('active', label.contains(e.target));
      });
    });
  });

  host.querySelectorAll('[data-pkg-perk]').forEach((chip) => {
    chip.addEventListener('click', () => {
      host.querySelectorAll('[data-pkg-perk]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      toast(`Package benefit active: ${chip.textContent.trim()}`);
    });
  });

  const pkgDestSelect = host.querySelector('#pkg-dest-select');
  pkgDestSelect?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const destEl = host.querySelector('#pkg-display-dest');
    const codeEl = host.querySelector('#pkg-display-code');
    const subEl = host.querySelector('#pkg-display-sub');
    if (destEl) destEl.textContent = opt ? opt.textContent.split(',')[0].trim() : e.target.value;
    if (codeEl) codeEl.textContent = opt?.dataset?.code || '';
    if (subEl) subEl.textContent = opt?.dataset?.sub || 'Flights + Hotel';
  });

  const pkgFromSelect = host.querySelector('#pkg-from-select');
  pkgFromSelect?.addEventListener('change', (e) => {
    const code = e.target.value;
    const airport = state.catalog.airports.find((a) => a.code === code);
    const fromEl = host.querySelector('#pkg-display-from');
    const codeEl = host.querySelector('#pkg-display-code-from');
    if (fromEl) fromEl.textContent = airport ? airport.city : code;
    if (codeEl) codeEl.textContent = code;
  });

  const pkgSeasonSelect = host.querySelector('#pkg-season-select');
  pkgSeasonSelect?.addEventListener('change', (e) => {
    const seasonEl = host.querySelector('#pkg-display-season');
    if (seasonEl) seasonEl.textContent = e.target.value.split('/')[0].trim();
  });

  const pkgDurationSelect = host.querySelector('#pkg-duration-select');
  pkgDurationSelect?.addEventListener('change', (e) => {
    const durationEl = host.querySelector('#pkg-display-duration');
    if (durationEl) durationEl.textContent = e.target.value.split('/')[0].trim();
  });

  const pkgPaxSelect = host.querySelector('#pkg-pax-select');
  pkgPaxSelect?.addEventListener('change', (e) => {
    const paxEl = host.querySelector('#pkg-display-pax');
    if (paxEl) paxEl.textContent = e.target.value.split('(')[0].trim();
  });

  host.querySelector('#package-search')?.addEventListener('submit', (event) => {
    event.preventDefault();
    location.hash = '#/packages';
  });

  // Experiences Interactive Controls
  host.querySelectorAll('input[name="exptype"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      host.querySelectorAll('#experience-search .trip-radio-label').forEach((label) => {
        label.classList.toggle('active', label.contains(e.target));
      });
    });
  });

  host.querySelectorAll('[data-exp-perk]').forEach((chip) => {
    chip.addEventListener('click', () => {
      host.querySelectorAll('[data-exp-perk]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      toast(`Experience feature active: ${chip.textContent.trim()}`);
    });
  });

  const expCitySelect = host.querySelector('#exp-city-select');
  expCitySelect?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const cityEl = host.querySelector('#exp-display-city');
    const countryEl = host.querySelector('#exp-display-country');
    const subEl = host.querySelector('#exp-display-sub');
    if (cityEl) cityEl.textContent = opt ? opt.textContent.split(',')[0].trim() : e.target.value;
    if (countryEl) countryEl.textContent = opt?.dataset?.country || '';
    if (subEl) subEl.textContent = opt?.dataset?.sub || 'Curated Tours';
  });

  const expTypeSelect = host.querySelector('#exp-type-select');
  expTypeSelect?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const typeEl = host.querySelector('#exp-display-type');
    const badgeEl = host.querySelector('#exp-display-badge');
    const subEl = host.querySelector('#exp-display-type-sub');
    if (typeEl) typeEl.textContent = e.target.value;
    if (badgeEl) badgeEl.textContent = opt?.dataset?.badge || 'Tour';
    if (subEl) subEl.textContent = opt?.dataset?.sub || 'Private Tour';
  });

  const expWindowSelect = host.querySelector('#exp-window-select');
  expWindowSelect?.addEventListener('change', (e) => {
    const windowEl = host.querySelector('#exp-display-window');
    if (windowEl) windowEl.textContent = e.target.value.split('/')[0].trim();
  });

  const expGroupSelect = host.querySelector('#exp-group-select');
  expGroupSelect?.addEventListener('change', (e) => {
    const groupEl = host.querySelector('#exp-display-group');
    if (groupEl) groupEl.textContent = e.target.value.split('(')[0].trim();
  });

  const expPaceSelect = host.querySelector('#exp-pace-select');
  expPaceSelect?.addEventListener('change', (e) => {
    const paceEl = host.querySelector('#exp-display-pace');
    if (paceEl) paceEl.textContent = e.target.value.split('·')[0].trim();
  });

  host.querySelector('#experience-search')?.addEventListener('submit', (event) => {
    event.preventDefault();
    location.hash = '#/experiences';
  });

  // Pinterest home tag filters
  document.querySelectorAll('[data-pin-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-pin-filter]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.pinFilter;
      const masonry = document.querySelector('#home-pin-masonry');
      if (!masonry) return;
      const filtered = filter === 'all'
        ? PINTEREST_PINS.slice(0, 8)
        : PINTEREST_PINS.filter((p) => p.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase())));
      masonry.innerHTML = filtered.map(pinterestPinCard).join('');
      bindHomePinEvents();
    });
  });

  bindHomePinEvents();
  bindCouponCopy();
}

function trustBadgesSection() {
  return `
    <section class="section">
      <div class="wrap">
        <div class="section-head reveal">
          <div>
            <div class="eyebrow-sm">The AstraLane Guarantee</div>
            <h2 class="section-title">Why travellers choose AstraLane.</h2>
            <p class="section-sub">Engineered like the world's finest airlines, curated with the discerning eye of an architectural magazine.</p>
          </div>
        </div>
        <div class="trust-grid">
          <div class="trust-card reveal">
            <div class="trust-icon">${icon('shield', 22)}</div>
            <h3>24-Hour Fare Lock</h3>
            <p>Hold any live flight price for 24 hours while you finalize plans. Price stays frozen, no seat surprises.</p>
          </div>
          <div class="trust-card reveal">
            <div class="trust-icon">${icon('check', 22)}</div>
            <h3>Zero Change Fee</h3>
            <p>Flexible travel made effortless. Reschedule flights up to 24 hours prior to departure without change penalties.</p>
          </div>
          <div class="trust-card reveal">
            <div class="trust-icon">${icon('spark', 22)}</div>
            <h3>Route Intelligence</h3>
            <p>Real-time quiet connections, aircraft model filtering, and optimal connection windows computed continuously.</p>
          </div>
          <div class="trust-card reveal">
            <div class="trust-icon">${icon('users', 22)}</div>
            <h3>24/7 Human Navigators</h3>
            <p>Live dedicated concierges on chat, WhatsApp, and phone to handle reroutes, luggage, and special requests.</p>
          </div>
        </div>
      </div>
    </section>`;
}

function homeView() {
  const experiences = state.catalog.experiences.slice(0, 4);
  const content = `
    <section class="hero">
      <div class="wrap hero-inner">
        <span class="eyebrow"><span class="live-dot"></span>Autumn & Winter 2026 · 142 Premier Routes</span>
        <h1 class="hero-title">The world,<br><span class="grad">in motion.</span></h1>
        <p class="hero-sub">Flights, boutique design stays, and handcrafted vacation packages — curated with Pinterest aesthetics and seamless booking.</p>
        <div class="hero-meta">
          <span>${icon('globe', 13)} 180+ global airports</span>
          <span>${icon('shield', 13)} Guaranteed Fare-Lock</span>
          <span>${icon('clock', 13)} 24/7 Human Navigator support</span>
        </div>
        ${searchShell()}
      </div>
    </section>

    <!-- Special Offers & Promo Codes (Yatra Style) -->
    <section class="section" style="padding-top:40px;padding-bottom:10px;">
      <div class="wrap">
        <div class="section-head reveal">
          <div>
            <div class="eyebrow-sm">Exclusive Member Savings</div>
            <h2 class="section-title">Flash Deals & Coupon Codes</h2>
            <p class="section-sub">Apply these codes at checkout or click to copy. Automatic member discount applied.</p>
          </div>
        </div>
        <div class="offers-grid">
          ${PROMO_CODES.map(couponCard).join('')}
        </div>
      </div>
    </section>

    <!-- Top Tourist Destinations to Fly with GIFs -->
    <section class="section">
      <div class="wrap">
        <div class="section-head reveal">
          <div>
            <div class="eyebrow-sm">Trending Destinations to Fly</div>
            <h2 class="section-title">Where the season takes you.</h2>
            <p class="section-sub">Experience top tourist destinations with live animated cinemagraphs and direct member fares.</p>
          </div>
          <a class="link-arrow" href="#/search">Explore all 142 routes ${icon('arrow', 15)}</a>
        </div>
        <div class="dest-grid">
          ${TOP_DESTINATIONS.map(destinationCard).join('')}
        </div>
      </div>
    </section>

    <!-- Handcrafted Flight Packages (Flight + Hotel) -->
    <section class="section">
      <div class="wrap">
        <div class="section-head reveal">
          <div>
            <div class="eyebrow-sm">All-In-One Vacations</div>
            <h2 class="section-title">Handcrafted Flight Packages</h2>
            <p class="section-sub">Return flights + Boutique design hotel stays + Curated perks bundled together at up to 35% savings.</p>
          </div>
          <a class="link-arrow" href="#/packages">All flight packages ${icon('arrow', 15)}</a>
        </div>
        <div class="pkg-grid">
          ${FLIGHT_PACKAGES.map(flightPackageCard).join('')}
        </div>
      </div>
    </section>

    <!-- Pinterest Moodboard Stays -->
    <section class="section">
      <div class="wrap">
        <div class="section-head reveal">
          <div>
            <div class="eyebrow-sm">Pinterest Moodboard & Stays 📌</div>
            <h2 class="section-title">Architectural hideaways & design lofts.</h2>
            <p class="section-sub">Curated by our community of design travellers. Click the heart to pin stays to your personal board.</p>
          </div>
          <a class="link-arrow" href="#/moodboard">View your moodboard ${icon('arrow', 15)}</a>
        </div>
        <div class="pin-filter-bar">
          <span class="pin-filter-chip active" data-pin-filter="all">All Stays</span>
          <span class="pin-filter-chip" data-pin-filter="Caldera">#CalderaViews</span>
          <span class="pin-filter-chip" data-pin-filter="Minimalist">#Minimalist</span>
          <span class="pin-filter-chip" data-pin-filter="WabiSabi">#WabiSabi</span>
          <span class="pin-filter-chip" data-pin-filter="Alpine">#AlpineChalets</span>
          <span class="pin-filter-chip" data-pin-filter="Tropical">#TropicalPools</span>
        </div>
        <div class="pin-masonry" id="home-pin-masonry">
          ${PINTEREST_PINS.slice(0, 8).map(pinterestPinCard).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head reveal">
          <div>
            <div class="eyebrow-sm">Beyond the Itinerary</div>
            <h2 class="section-title">Rare Experiences with a Point of View</h2>
            <p class="section-sub">Small groups, rare access, and a navigator who knows the way.</p>
          </div>
          <a class="link-arrow" href="#/experiences">All experiences ${icon('arrow', 15)}</a>
        </div>
        <div class="exp-grid">${experiences.map(experienceCard).join('')}</div>
      </div>
    </section>

    ${trustBadgesSection()}

    <section class="section">
      <div class="wrap">
        <div class="stats reveal">
          <div class="stat"><strong>1.2M</strong><span>Routes charted this year</span></div>
          <div class="stat"><strong>94%</strong><span>Members who rebook with us</span></div>
          <div class="stat"><strong>&lt; 90s</strong><span>Median time to a held fare</span></div>
        </div>
        <div class="cta-band reveal">
          <div>
            <h2>Your next journey is one search away.</h2>
            <p>Tell the concierge where you're going — or let the route engine find somewhere you haven't considered yet.</p>
          </div>
          <div class="cta-actions">
            <a class="btn primary" href="#/search">Find a flight</a>
            <a class="btn ghost" href="#/concierge">Ask the concierge</a>
          </div>
        </div>
      </div>
    </section>`;

  return { content, active: 'home', bind: bindHome };
}

async function searchView(params) {
  const from = (params.get('from') || 'JFK').toUpperCase();
  const to = (params.get('to') || 'LHR').toUpperCase();
  const date = params.get('date') || isoDate(10);
  const cabin = params.get('cabin') || 'Any';
  const sort = params.get('sort') || 'price';
  let flights = [];
  try {
    const query = new URLSearchParams({ from, to, date });
    if (cabin !== 'Any') query.set('cabin', cabin);
    const data = await api(`/api/flights?${query.toString()}`);
    flights = data.flights || [];
  } catch {
    flights = [];
  }

  const sorted = [...flights].sort((a, b) => {
    if (sort === 'depart') return new Date(a.departAt) - new Date(b.departAt);
    if (sort === 'duration') return (new Date(a.arriveAt) - new Date(a.departAt)) - (new Date(b.arriveAt) - new Date(b.departAt));
    return a.priceCents - b.priceCents;
  });

  const hrefFor = (next) => {
    const query = new URLSearchParams({ ...next, sort });
    return `#/search?${query.toString()}`;
  };

  const dateChips = [-3, -2, -1, 0, 1, 2, 3].map((offset) => {
    const value = addDays(date, offset);
    const dayPrice = offset === 0 ? '$799' : offset === -1 ? '$749' : offset === 1 ? '$820' : '$810';
    const isCheapest = offset === -1;
    return `
      <a class="fare-day-chip ${offset === 0 ? 'active' : ''}" href="${hrefFor({ from, to, date: value, cabin })}">
        <span class="fare-day-date">${weekday(value)}, ${shortDate(value)}</span>
        <span class="fare-day-price">${dayPrice}</span>
        ${isCheapest ? '<span class="fare-cheapest-pill">Lowest Fare</span>' : ''}
      </a>`;
  }).join('');

  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Flights</span>`,
        `${esc(from)} <span class="dim">→</span> ${esc(to)}`,
        `${esc(cityFor(from))} to ${esc(cityFor(to))} · ${longDate(date)} · ${sorted.length} nonstop fare${sorted.length === 1 ? '' : 's'} found`,
        `<a class="btn ghost" href="#/">Edit search</a>`,
      )}
      <div class="results-layout">
        <aside class="filters">
          <div class="filter-card">
            <h3>Cabin Class</h3>
            <div class="field">
              <select id="cabin-filter">${['Any', 'Economy', 'Premium', 'Business', 'First'].map((option) => `<option ${option === cabin ? 'selected' : ''}>${option}</option>`).join('')}</select>
            </div>
          </div>
          <div class="filter-card">
            <h3>Special Fare Applied</h3>
            <p class="filter-note"><strong>${state.fareType ? state.fareType.toUpperCase() : 'REGULAR'}</strong> fare selected. Instant ticket issuance and 24h fare-lock protection included.</p>
          </div>
          <div class="filter-card">
            <h3>Need a custom route?</h3>
            <p class="filter-note">Our navigators can pair this fare with a private car transfer, lounge access, or slower connection in <strong>${esc(cityFor(from))}</strong>.</p>
            <a class="btn ghost small mt-16" href="#/concierge">Ask a navigator</a>
          </div>
        </aside>
        <section class="results">
          <!-- 7-Day Fare Strip (Yatra style) -->
          <div class="fare-strip">${dateChips}</div>

          <div class="results-bar">
            <span><strong>${sorted.length}</strong> available flights · ${esc(cabin === 'Any' ? 'all cabins' : cabin)}</span>
            <select class="sort-select" id="sort-results" aria-label="Sort results">
              <option value="price" ${sort === 'price' ? 'selected' : ''}>Lowest price</option>
              <option value="depart" ${sort === 'depart' ? 'selected' : ''}>Earliest departure</option>
              <option value="duration" ${sort === 'duration' ? 'selected' : ''}>Shortest flight</option>
            </select>
          </div>
          ${sorted.length ? sorted.map(flightCard).join('') : emptyState('No direct fares on this date', 'Try a nearby date from the flexible-date strip above, or ask the concierge to chart a connection.', `<a class="btn primary" href="${hrefFor({ from, to, date: addDays(date, 1), cabin })}">Try ${shortDate(addDays(date, 1))}</a>`)}
        </section>
      </div>
    </div></section>`;

  return {
    content,
    active: 'home',
    bind: () => {
      document.querySelector('#sort-results')?.addEventListener('change', (event) => {
        location.hash = hrefFor({ from, to, date, cabin, sort: event.target.value });
      });
      document.querySelector('#cabin-filter')?.addEventListener('change', (event) => {
        location.hash = hrefFor({ from, to, date, cabin: event.target.value });
      });
    },
  };
}

function flightCard(flight) {
  const depart = new Date(flight.departAt);
  const arrive = new Date(flight.arriveAt);
  const length = (arrive - depart) / 60_000;
  return `
    <article class="result-card">
      <div class="airline-mark">${esc(initials(flight.airline))}</div>
      <div class="flight-line">
        <div class="flight-times">
          <strong>${timeUTC.format(depart)}</strong>
          <span>${esc(flight.origin)} · Term 1</span>
        </div>
        <div class="flight-path">
          <span class="nonstop-badge">Non-stop</span>
          <div class="line"></div>
          <span>${duration(length)} · ${esc(flight.cabin)}</span>
        </div>
        <div class="flight-times">
          <strong>${timeUTC.format(arrive)}</strong>
          <span>${esc(flight.destination)} · Term 4</span>
        </div>
      </div>
      <div class="flight-airline">
        <strong>${esc(flight.airline)}</strong><br>
        <span>${esc(flight.flightNo)} · Boeing 787-9</span><br>
        <div class="flight-amenities-row" style="margin-top:6px;display:flex;gap:10px;font-size:11px;color:var(--dim);">
          <span>${icon('wifi', 12)} WiFi</span>
          <span>${icon('luggage', 12)} 7kg + 25kg</span>
        </div>
      </div>
      <div class="price-block">
        <div>
          <small>Per Passenger</small>
          <strong>${money(flight.priceCents)}</strong>
        </div>
        <a class="btn primary small" href="#/book?type=flight&id=${encodeURIComponent(flight.id)}">Select Flight</a>
      </div>
    </article>`;
}

const HOTEL_IMAGES = {
  'HTL-SKY': '/assets/hotels/skyline.jpg',
  'HTL-AUR': '/assets/hotels/aurora_house.jpg',
  'HTL-NEO': '/assets/hotels/neo_tokyo.jpg',
  'HTL-DUN': '/assets/hotels/dune_meridian.jpg',
  'HTL-SEA': '/assets/hotels/sea_glass.jpg',
  'HTL-ALP': '/assets/hotels/alpine_signal.jpg',
  'HTL-SOL': '/assets/hotels/solaris_bay.jpg',
  'HTL-ORB': '/assets/hotels/orbit_suites.jpg',
};

async function staysView(params) {
  const city = params.get('city') || '';
  const checkin = params.get('checkin') || isoDate(14);
  const nights = params.get('nights') || '2';
  const guests = params.get('guests') || '2';
  let hotels = [];
  try {
    const data = await api(`/api/hotels${city ? `?city=${encodeURIComponent(city)}` : ''}`);
    hotels = data.hotels || [];
  } catch {
    hotels = [];
  }

  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Stays</span>`,
        'Design Stays & Boutique Villas',
        'Curated boutique architecture, quiet floors, and personalized hospitality.',
        `<span class="ticker-pill"><span class="badge-dot"></span> Pinterest Curated</span>`,
      )}
      <form class="stay-filter" id="stay-filter">
        <div class="field"><label>Where</label><select name="city"><option value="">All cities</option>${HOTEL_CITIES.map((option) => `<option ${option === city ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></div>
        <div class="field"><label>Check in</label><input type="date" name="checkin" value="${esc(checkin)}" min="${isoDate(0)}"></div>
        <div class="field"><label>Nights</label><select name="nights">${['2', '3', '4', '5'].map((value) => `<option ${value === nights ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
        <div class="field"><label>Guests</label><select name="guests">${['1', '2', '3', '4'].map((value) => `<option ${value === guests ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
        <button class="btn primary" type="submit">${icon('search', 15)} Search stays</button>
      </form>
      <div class="pin-filter-bar" style="margin-bottom:26px;">
        <a class="pin-filter-chip ${!city ? 'active' : ''}" href="#/stays">All Destinations (${hotels.length})</a>
        ${HOTEL_CITIES.map((c) => `<a class="pin-filter-chip ${c === city ? 'active' : ''}" href="#/stays?city=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}
      </div>
      ${hotels.length ? `<div class="stay-grid">${hotels.map((hotel, index) => stayCard(hotel, index, checkin, nights)).join('')}</div>` : emptyState('No stays in this collection yet', 'Try another city or clear the filter to see the full AstraLane collection.', `<a class="btn primary" href="#/stays">View all stays</a>`)}
    </div></section>`;

  return {
    content,
    active: 'stays',
    bind: () => {
      document.querySelector('#stay-filter')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const query = new URLSearchParams({
          city: form.elements.city.value, checkin: form.elements.checkin.value,
          nights: form.elements.nights.value, guests: form.elements.guests.value,
        });
        location.hash = `#/stays?${query.toString()}`;
      });
      bindHomePinEvents();
    },
  };
}

function stayCard(hotel, index, checkin, nights) {
  const image = HOTEL_IMAGES[hotel.id] || '/assets/hotels/skyline.jpg';
  const href = `#/book?type=hotel&id=${encodeURIComponent(hotel.id)}&checkin=${encodeURIComponent(checkin)}&nights=${encodeURIComponent(nights)}`;
  const isSaved = state.savedPins.includes(hotel.id);
  const perks = ['🏊 Pool & Lounge', '☕ Free Breakfast', '🕒 2 PM Checkout', '🍷 Welcome Wine'];
  return `
    <article class="stay-card reveal">
      <div class="stay-art">
        <img src="${image}" alt="${esc(hotel.name)}" loading="lazy">
        <button type="button" class="pin-save-btn ${isSaved ? 'saved' : ''}" data-pin-toggle="${hotel.id}" aria-label="Save stay">
          ${isSaved ? icon('heartFilled', 18) : icon('heart', 18)}
        </button>
        <span class="pkg-badge-pill">#AestheticStay</span>
        <span class="rating stay-rating-pill">${icon('star', 12)} ${Number(hotel.rating).toFixed(1)}</span>
      </div>
      <div class="stay-body">
        <div class="stay-top">
          <div class="stay-eyebrow">${esc(hotel.city)} · Premier Property</div>
          <h3 class="stay-title" title="${esc(hotel.name)}">${esc(hotel.name)}</h3>
          <p class="stay-subtitle">${nights}-night stay · Luxury Design Suite</p>
        </div>
        <p class="stay-blurb" title="${esc(hotel.blurb)}">${esc(hotel.blurb)}</p>
        <div class="stay-perks-row">
          <span class="stay-perk">${perks[index % perks.length]}</span>
          <span class="stay-perk promo">Member Fare</span>
        </div>
        <div class="stay-foot">
          <div class="stay-price">
            <small>Member Nightly Rate</small>
            <strong>${money(hotel.priceCents)} <small>/ night</small></strong>
          </div>
          <a class="btn primary small" href="${href}">Book Stay</a>
        </div>
      </div>
    </article>`;
}

function packagesView() {
  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Flight Packages</span>`,
        'Handcrafted Flight Packages',
        'Direct roundtrip flights, design-led stays, and curated perks bundled together at exclusive member rates.',
        `<span class="ticker-pill"><span class="badge-dot"></span> All-Inclusive Deals</span>`
      )}
      <div class="pin-filter-bar" style="margin-bottom:30px;">
        <span class="pin-filter-chip active" data-pkg-filter="all">All Packages</span>
        <span class="pin-filter-chip" data-pkg-filter="Romantic">Romantic & Honeymoon</span>
        <span class="pin-filter-chip" data-pkg-filter="Cultural">Cultural & Historic</span>
        <span class="pin-filter-chip" data-pkg-filter="Alpine">Alpine & Winter</span>
        <span class="pin-filter-chip" data-pkg-filter="Tropical">Tropical & Beach</span>
        <span class="pin-filter-chip" data-pkg-filter="Luxury">Luxury & Desert</span>
      </div>
      <div class="pkg-grid" id="packages-container">
        ${FLIGHT_PACKAGES.map(flightPackageCard).join('')}
      </div>
    </div></section>`;

  return {
    content,
    active: 'packages',
    bind: () => {
      document.querySelectorAll('[data-pkg-filter]').forEach((chip) => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('[data-pkg-filter]').forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          const filter = chip.dataset.pkgFilter;
          const container = document.querySelector('#packages-container');
          if (!container) return;
          const filtered = filter === 'all' ? FLIGHT_PACKAGES : FLIGHT_PACKAGES.filter((p) => p.category === filter);
          container.innerHTML = filtered.map(flightPackageCard).join('');
        });
      });
    },
  };
}

function moodboardView() {
  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Moodboards</span>`,
        'Pinterest Travel Moodboard 📌',
        'Explore aesthetic hideaways, cliffside suites, and architectural pins. Save your favorites to your personal board.',
        `<span class="nav-badge" style="font-size:12px;padding:4px 12px;" id="moodboard-badge">${state.savedPins.length} Pins Saved</span>`
      )}
      <div class="pin-filter-bar">
        <span class="pin-filter-chip active" data-moodboard-tab="all">All Aesthetic Pins</span>
        <span class="pin-filter-chip" data-moodboard-tab="saved">Saved by You (${state.savedPins.length})</span>
        <span class="pin-filter-chip" data-moodboard-tab="Caldera">#CalderaView</span>
        <span class="pin-filter-chip" data-moodboard-tab="Minimalist">#Minimalist</span>
        <span class="pin-filter-chip" data-moodboard-tab="Alpine">#AlpineChalets</span>
        <span class="pin-filter-chip" data-moodboard-tab="Tropical">#TropicalPools</span>
      </div>
      <div class="pin-masonry" id="moodboard-masonry">
        ${PINTEREST_PINS.map(pinterestPinCard).join('')}
      </div>
    </div></section>`;

  return {
    content,
    active: 'moodboard',
    bind: () => {
      document.querySelectorAll('[data-moodboard-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('[data-moodboard-tab]').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          const key = tab.dataset.moodboardTab;
          const masonry = document.querySelector('#moodboard-masonry');
          if (!masonry) return;
          let items = PINTEREST_PINS;
          if (key === 'saved') {
            items = PINTEREST_PINS.filter((p) => state.savedPins.includes(p.id));
          } else if (key !== 'all') {
            items = PINTEREST_PINS.filter((p) => p.tags.some((t) => t.toLowerCase().includes(key.toLowerCase())));
          }
          masonry.innerHTML = items.length ? items.map(pinterestPinCard).join('') : emptyState('No pins here yet', 'Save stays to your moodboard by clicking the heart button on any card.');
          bindHomePinEvents();
        });
      });
      bindHomePinEvents();
    },
  };
}

async function bookingView(params) {
  const type = params.get('type') === 'hotel' ? 'hotel' : 'flight';
  const id = params.get('id') || '';
  const checkin = params.get('checkin') || isoDate(14);
  const nights = params.get('nights') || '2';

  if (!id) {
    return {
      content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Reserve</span>', 'Nothing to reserve yet', 'Choose a fare or a stay to begin.')}${emptyState('Start with a search', 'Find a flight or a design stay, then return here to hold it.', '<a class="btn primary" href="#/search">Search flights</a>')}</div></section>`,
      active: 'flights',
    };
  }

  let item;
  try {
    const data = await api(`/api/${type === 'hotel' ? 'hotels' : 'flights'}/${encodeURIComponent(id)}`);
    item = type === 'hotel' ? data.hotel : data.flight;
  } catch {
    item = null;
  }

  if (!item) {
    return {
      content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Reserve</span>', 'This fare is no longer available', 'The route may have closed. Search again for the next available option.')}${emptyState('Fare not found', 'Availability changes quickly. The route engine can find the closest alternative.', '<a class="btn primary" href="#/search">Search again</a>')}</div></section>`,
      active: 'flights',
    };
  }

  const amount = type === 'hotel' ? item.priceCents * 2 : item.priceCents;
  const summary = bookingSummary(type, item, amount, checkin, nights);
  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / ${type === 'hotel' ? '<a href="#/stays">Stays</a>' : '<a href="#/search">Flights</a>'} / <span>Reserve</span>`,
        type === 'hotel' ? 'Hold your stay.' : 'Hold your fare.',
        'Review the details, add the passenger, and let AstraLane keep it steady.',
      )}
      <div class="booking-layout">
        <div id="booking-panel">
          ${state.user ? bookingForm(type, item, id) : signInCard('Sign in to reserve', 'Your itinerary, passport details, and loyalty balance stay together in your AstraLane account.')}
        </div>
        ${summary}
      </div>
    </div></section>`;

  const bind = () => {
    bindBooking(type, item, id);
  };

  return { content, active: type === 'hotel' ? 'stays' : 'flights', bind };
}

function bookingSummary(type, item, amount, checkin, nights) {
  const rows = type === 'flight'
    ? `
      <div class="summary-row"><span>Route</span><span>${esc(item.origin)} → ${esc(item.destination)}</span></div>
      <div class="summary-row"><span>Departure</span><span>${dateOf(item.departAt)} · ${timeUTC.format(new Date(item.departAt))}</span></div>
      <div class="summary-row"><span>Airline</span><span>${esc(item.airline)} · ${esc(item.flightNo)}</span></div>
      <div class="summary-row"><span>Cabin</span><span>${esc(item.cabin)}</span></div>`
    : `
      <div class="summary-row"><span>Stay</span><span>${esc(item.name)}</span></div>
      <div class="summary-row"><span>City</span><span>${esc(item.city)}</span></div>
      <div class="summary-row"><span>Check in</span><span>${dateOf(`${checkin}T12:00:00Z`)}</span></div>
      <div class="summary-row"><span>Nights</span><span>${esc(nights)} nights</span></div>`;
  return `
    <aside class="summary-card">
      <div class="summary-head"><span>${type === 'flight' ? 'Flight summary' : 'Stay summary'}</span><span class="status">Held for 24h</span></div>
      <div class="summary-body">
        <div class="summary-route"><div><strong>${type === 'flight' ? `${esc(item.origin)} → ${esc(item.destination)}` : esc(item.city)}</strong><span>${type === 'flight' ? esc(item.airline) : 'AstraLane collection'}</span></div>${icon(type === 'flight' ? 'plane' : 'bed', 22)}</div>
        <div class="summary-meta">${rows}</div>
        <div class="summary-total"><span>Total</span><strong>${money(amount)}</strong></div>
        <form class="promo-row" id="promo-form"><input name="code" placeholder="Promo code" aria-label="Promo code"><button class="btn subtle small" type="submit">Apply</button></form>
        <p class="promo-result" id="promo-result">AstraLane member fares include taxes and fees.</p>
      </div>
    </aside>`;
}

function bookingForm(type, item) {
  return `
    <div class="panel">
      <h2>${type === 'hotel' ? 'Guest details' : 'Passenger details'}</h2>
      <p class="panel-sub">Use the name exactly as it appears on the travel document.</p>
      <form id="booking-form">
        <div class="form-grid">
          <div class="field"><label for="passenger-name">Lead passenger</label><input id="passenger-name" name="passengerName" value="${esc(state.user.name)}" autocomplete="name" required></div>
          <div class="field"><label for="passport">Passport / ID</label><input id="passport" name="passportNo" value="${esc(state.user.passportNo || '')}" placeholder="P-XXXX-0000" required></div>
          <div class="field full"><label for="notes">Travel notes</label><textarea id="notes" name="notes" rows="3" placeholder="Seat preference, meal, accessibility, late arrival…"></textarea></div>
        </div>
        <div class="row mt-16"><button class="btn primary" type="submit">Reserve itinerary</button><span class="dim" style="font-size:11.5px">No charge until OrbitPay settles.</span></div>
      </form>
    </div>`;
}

function bindBooking(type, item, id) {
  const form = document.querySelector('#booking-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Holding itinerary…';
    try {
      const body = {
        type,
        itemId: id,
        passengerName: form.elements.passengerName.value,
        passportNo: form.elements.passportNo.value,
        notes: form.elements.notes.value,
      };
      const data = await api('/api/bookings', { method: 'POST', body });
      showBookingConfirmation(data.booking);
      toast('Itinerary held. Reference ' + data.booking.ref, 'success');
    } catch (error) {
      toast(error.message, 'error');
      submit.disabled = false;
      submit.textContent = 'Reserve itinerary';
    }
  });

  const promo = document.querySelector('#promo-form');
  promo?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = document.querySelector('#promo-result');
    const code = promo.elements.code.value.trim();
    if (!code) return;
    result.className = 'promo-result';
    result.textContent = 'Checking promotion…';
    try {
      const data = await api('/api/support/promo', { method: 'POST', body: { code } });
      if (data.valid) {
        result.className = 'promo-result ok';
        result.textContent = 'Promotion recognized. It will apply at settlement.';
      } else {
        result.className = 'promo-result bad';
        result.textContent = 'That promotion is not active for this fare.';
      }
    } catch (error) {
      result.className = 'promo-result bad';
      result.textContent = error.message;
    }
  });
}

function showBookingConfirmation(booking) {
  const panel = document.querySelector('#booking-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="panel">
      <div class="confirmation">
        <div class="check-ring">${icon('check', 26)}</div>
        <h2>Your itinerary is held.</h2>
        <p>We've reserved the ${booking.type === 'hotel' ? 'stay' : 'fare'} under this reference for the next 24 hours.</p>
        <div class="ref-pill">${icon('check', 13)} ${esc(booking.ref)}</div>
        <p class="dim" style="font-size:11px">Status · ${statusLabel(booking.status)}</p>
        <div class="row mt-24" style="justify-content:center"><button class="btn primary" id="pay-booking">Continue to payment</button><a class="btn ghost" href="#/account">View itinerary</a></div>
        <p id="payment-state" class="promo-result"></p>
      </div>
    </div>`;
  document.querySelector('#pay-booking')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Opening OrbitPay…';
    try {
      const data = await api(`/api/bookings/${encodeURIComponent(booking.ref)}/pay`, { method: 'POST' });
      document.querySelector('#payment-state').className = 'promo-result ok';
      document.querySelector('#payment-state').textContent = data.payment.message;
      button.textContent = 'Payment pending with OrbitPay';
    } catch (error) {
      toast(error.message, 'error');
      button.disabled = false;
      button.textContent = 'Continue to payment';
    }
  });
}

async function accountView() {
  if (!state.user) {
    return {
      content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Account</span>', 'Your travel, in one place.', 'Sign in to see held fares, loyalty points, and passport details.')}${signInCard('Sign in to your account', 'AstraLane keeps your itineraries, loyalty wallet, and identity connections together.')}</div></section>`,
      active: 'account',
      bind: () => { if (!state.user) openAuth('login'); },
    };
  }

  const [bookingResult, walletResult] = await Promise.allSettled([api('/api/bookings'), api('/api/wallet')]);
  const bookings = bookingResult.status === 'fulfilled' ? bookingResult.value.bookings || [] : [];
  const wallet = walletResult.status === 'fulfilled' ? walletResult.value : { balance: 0, tier: 'Silver', rewards: [] };

  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Account</span>`,
        `Welcome back, ${esc(state.user.name.split(' ')[0])}.`,
        'Your itineraries, loyalty ledger, and identity connections.',
        `<button class="btn ghost" data-logout>${icon('logout', 15)} Sign out</button>`,
      )}
      <div class="account-grid">
        <div class="account-side">
          <div class="profile-card">
            <div class="profile-top"><div class="avatar large">${esc(initials(state.user.name))}</div><div><h2>${esc(state.user.name)}</h2><p>${esc(state.user.email)}</p></div></div>
            <div class="profile-facts">
              <div class="fact"><small>Loyalty tier</small><span>${esc(state.user.loyaltyTier || wallet.tier)}</span></div>
              <div class="fact"><small>Member since</small><span>${state.user.createdAt ? dateOf(state.user.createdAt) : '2026'}</span></div>
              <div class="fact"><small>Passport / ID</small><span>${esc(state.user.passportNo || 'Not added')}</span></div>
              <div class="fact"><small>Phone</small><span>${esc(state.user.phone || 'Not added')}</span></div>
            </div>
          </div>

          <div class="wallet-card">
            <div class="wallet-top"><div><div class="wallet-label">Loyalty wallet</div><div class="balance">${points(wallet.balance)}<small>pts</small></div></div><span class="tier-pill">${esc(wallet.tier)}</span></div>
            <div class="rewards">
              ${(wallet.rewards || []).map((reward) => `<div class="reward"><strong>${esc(reward.label)}</strong><span>${points(reward.cost)} points</span><button class="btn ghost small" data-redeem="${esc(reward.id)}" ${reward.available ? '' : 'disabled'}>Redeem</button></div>`).join('')}
            </div>
            <form class="transfer-form" id="transfer-form">
              <div class="field"><label>Send points to</label><input name="toEmail" type="email" placeholder="kai@astralane.travel" required></div>
              <div class="field"><label>Points</label><input name="amount" type="number" min="1" step="1" placeholder="500" required></div>
              <button class="btn subtle" type="submit">Send</button>
            </form>
          </div>

          <div class="panel payout-card">
            <h2>Partner settlement</h2>
            <p class="panel-sub">Request an operator-reviewed payout to your loyalty wallet.</p>
            <form class="payout-form" id="payout-form"><input name="amount" type="number" min="1" max="25000" value="25000" aria-label="Payout amount"><button class="btn ghost" type="submit">Request payout</button></form>
            <p class="promo-result" id="payout-result"></p>
          </div>

          <div class="panel">
            <h2>Connected identity</h2>
            <p class="panel-sub">Link your OrbitID or Astra SSO to skip the password next time.</p>
            <div class="row mt-16"><button class="btn ghost" data-sso="oidc" type="button">${icon('globe', 15)} OrbitID</button><button class="btn ghost" data-sso="saml" type="button">${icon('lock', 15)} Astra SSO</button></div>
          </div>
        </div>

        <div class="panel">
          <div class="spread"><div><h2>Your itineraries</h2><p class="panel-sub">${bookings.length} reservation${bookings.length === 1 ? '' : 's'} on file.</p></div><a class="btn ghost small" href="#/search">New trip</a></div>
          ${bookings.length ? `<div class="booking-list">${bookings.map(bookingRow).join('')}</div>` : `<div class="mt-16">${emptyState('No itineraries yet', 'Search a route or a stay to create your first AstraLane reservation.', '<a class="btn primary" href="#/search">Find a flight</a>')}</div>`}
        </div>
      </div>
    </div></section>`;

  return {
    content,
    active: 'account',
    bind: () => bindAccount(bookings),
  };
}

function bookingRow(booking) {
  return `
    <div class="booking-item">
      <div class="booking-icon">${icon(booking.type === 'hotel' ? 'bed' : 'plane', 17)}</div>
      <div><h4>${esc(booking.ref)} · ${booking.type === 'hotel' ? 'Stay' : 'Flight'}</h4><p>${esc(booking.passengerName)} · ${dateOf(booking.createdAt)}</p></div>
      <div class="amount"><span class="status ${esc(booking.status)}">${statusLabel(booking.status)}</span><small>${money(booking.amountCents)}</small>${booking.status === 'pending' ? `<button class="btn subtle small" data-pay-ref="${esc(booking.ref)}">Pay</button>` : ''}</div>
    </div>`;
}

function bindAccount(bookings) {
  const transfer = document.querySelector('#transfer-form');
  transfer?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = transfer.querySelector('button');
    button.disabled = true;
    try {
      const data = await api('/api/wallet/transfer', {
        method: 'POST',
        body: { toEmail: transfer.elements.toEmail.value, amount: Number(transfer.elements.amount.value) },
      });
      toast(`Sent ${points(transfer.elements.amount.value)} points to ${data.recipient.name}.`, 'success');
      await route();
    } catch (error) {
      toast(error.message, 'error');
      button.disabled = false;
    }
  });

  document.querySelectorAll('[data-redeem]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const data = await api('/api/wallet/redeem', { method: 'POST', body: { reward: button.dataset.redeem } });
        toast(`${data.reward === 'black-card' ? 'Black Card unlocked' : 'Reward redeemed'}.`, 'success');
        await route();
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-pay-ref]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await api(`/api/bookings/${encodeURIComponent(button.dataset.payRef)}/pay`, { method: 'POST' });
        toast('OrbitPay has been notified. Settlement is pending.', 'success');
        await route();
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });

  const payout = document.querySelector('#payout-form');
  payout?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = document.querySelector('#payout-result');
    const button = payout.querySelector('button');
    button.disabled = true;
    result.className = 'promo-result';
    result.textContent = 'Requesting operator review…';
    try {
      const data = await api('/api/admin/payout', { method: 'POST', body: { amount: Number(payout.elements.amount.value) } });
      result.className = 'promo-result ok';
      result.textContent = `Payout credited. New balance: ${points(data.balance)} points.`;
      toast('Settlement payout credited.', 'success');
    } catch (error) {
      result.className = 'promo-result bad';
      result.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function adminView() {
  if (!state.user) {
    return {
      content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Operator</span>', 'Operator console', 'Restricted to AstraLane operations staff.')}<div class="restricted"><div class="icon-btn">${icon('lock', 24)}</div><h1>Operator authorization required</h1><p>This console exposes settlement reconciliation, passenger manifests, and privileged vault links. Sign in with an operator identity to continue.</p><button class="btn primary" data-open-auth>Sign in</button></div></div></section>`,
      active: 'admin',
    };
  }
  if (state.user.role !== 'admin') {
    return {
      content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Operator</span>', 'Operator console', 'Restricted to AstraLane operations staff.')}<div class="restricted"><div class="icon-btn">${icon('lock', 24)}</div><h1>Operator clearance not present</h1><p>Your AstraLane session is active, but this account does not carry the operator role. Settlement controls remain locked.</p><a class="btn ghost" href="#/account">Return to account</a></div></div></section>`,
      active: 'admin',
    };
  }

  let vault;
  try { vault = await api('/api/admin/vault'); } catch (error) {
    return { content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Operator</span>', 'Operator console', 'The vault could not be opened.')}${emptyState('Vault unavailable', esc(error.message), '<a class="btn primary" href="#/account">Return to account</a>')}</div></section>`, active: 'admin' };
  }

  const revenue = vault.bookings.reduce((sum, booking) => sum + Number(booking.amountCents || 0), 0);
  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Operator</span>`,
        'Operations vault.',
        'Settlement reconciliation, passenger manifests, and privileged links.',
        `<span class="status paid">Operator session</span>`,
      )}
      <div class="stat-cards">
        <div class="stat-card"><small>Gross bookings</small><strong>${money(revenue)}</strong></div>
        <div class="stat-card"><small>Passengers on file</small><strong>${vault.users.length}</strong></div>
        <div class="stat-card"><small>Open itineraries</small><strong>${vault.bookings.filter((booking) => booking.status !== 'paid' && booking.status !== 'confirmed').length}</strong></div>
      </div>
      <div class="admin-grid">
        <div class="vault-card">
          <h3>${icon('lock', 16)} Operator vault</h3>
          <p>Encrypted settlement credentials and privileged links.</p>
          <span class="flag-label">Admin vault</span>
          <code class="flag">${esc(vault.vault)}</code>
          <span class="flag-label">SAML-elevated vault</span>
          <code class="flag ${vault.samlVault ? '' : 'dim'}">${esc(vault.samlVault || 'Not present on this session')}</code>
        </div>
        <div class="panel">
          <h2>Audit trail</h2>
          <p class="panel-sub">Most recent privileged actions.</p>
          <div class="table-wrap mt-16">
            <table><thead><tr><th>Actor</th><th>Action</th><th>When</th></tr></thead><tbody>
              ${(vault.audit || []).slice(0, 8).map((entry) => `<tr><td>${esc(entry.actor)}</td><td class="mono">${esc(entry.action)}</td><td class="mono">${esc(entry.created_at ? new Date(entry.created_at).toISOString().slice(0, 16).replace('T', ' ') : '')}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </div>
      </div>

      <div class="panel mt-24">
        <h2>All itineraries</h2>
        <p class="panel-sub">Every booking, including concierge and partner channels.</p>
        <div class="table-wrap mt-16">
          <table><thead><tr><th>Ref</th><th>Passenger</th><th>Status</th><th>Amount</th><th>Notes</th></tr></thead><tbody>
            ${vault.bookings.map((booking) => `<tr><td class="mono">${esc(booking.ref)}</td><td>${esc(booking.passengerName)}</td><td><span class="status ${esc(booking.status)}">${statusLabel(booking.status)}</span></td><td>${money(booking.amountCents)}</td><td class="mono">${esc(booking.notes || '')}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <div class="panel mt-24">
        <h2>Member manifests</h2>
        <p class="panel-sub">Identity records attached to active accounts.</p>
        <div class="table-wrap mt-16">
          <table><thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Tier</th><th>Passport</th></tr></thead><tbody>
            ${vault.users.map((user) => `<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td>${esc(user.role)}</td><td>${esc(user.loyaltyTier)}</td><td class="mono">${esc(user.passportNo || '—')}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div></section>`;

  return { content, active: 'admin' };
}

async function conciergeView() {
  if (!state.user) {
    return {
      content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Concierge</span>', 'A navigator for the in-between.', 'Route design, partner fare checks, and quiet upgrades — for AstraLane members.')}${signInCard('Concierge is a member service', 'Sign in to compare partner fares, hold an itinerary, or ask a navigator to chart something custom.')}</div></section>`,
      active: 'concierge',
      bind: () => openAuth('login'),
    };
  }

  if (!state.chat.length) {
    state.chat.push({ role: 'assistant', text: 'Good evening. I can compare a partner fare, hold an itinerary, or chart a route with a quieter connection. Where are you headed?' });
  }

  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Concierge</span>`,
        'A quieter way to go far.',
        'Partner fare checks, route design, and a human when the map runs out.',
      )}
      <div class="concierge-layout">
        <div class="chat-card">
          <div class="chat-head"><div class="airline-mark">AL</div><div><h3>Astra Navigator</h3><p>Route desk · online now</p></div><span class="live-dot" style="margin-left:auto"></span></div>
          <div class="chat-log" id="chat-log">${state.chat.map(chatMessage).join('')}</div>
          <form class="chat-form" id="chat-form"><input name="message" placeholder="Where would you like to go?" autocomplete="off" required><button class="btn primary small" type="submit" aria-label="Send">${icon('send', 16)}</button></form>
        </div>

        <div class="compare-card">
          <h2>PriceGuard</h2>
          <p>Paste a partner fare feed URL and AstraLane will pull a live preview for comparison.</p>
          <form class="compare-form" id="compare-form">
            <div class="field"><label for="compare-url">Partner URL</label><input id="compare-url" name="url" type="url" placeholder="https://partner.example/fares" required></div>
            <button class="btn primary" type="submit">${icon('link', 15)} Compare fare</button>
          </form>
          <div id="compare-result"></div>
          <div class="compare-note">${icon('shield', 14)} PriceGuard reads public fare feeds only. Never share a document or payment credential with a partner URL.</div>
        </div>
      </div>
    </div></section>`;

  return {
    content,
    active: 'concierge',
    bind: bindConcierge,
  };
}

function chatMessage(message) {
  return `<div class="msg ${message.role === 'user' ? 'user' : 'assistant'}">${esc(message.text)}</div>`;
}

function bindConcierge() {
  const form = document.querySelector('#chat-form');
  const log = document.querySelector('#chat-log');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.elements.message;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    state.chat.push({ role: 'user', text });
    log.insertAdjacentHTML('beforeend', chatMessage({ role: 'user', text }));
    const typing = document.createElement('div');
    typing.className = 'msg assistant typing';
    typing.textContent = 'Navigator is checking the route…';
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    try {
      const data = await api('/api/concierge/chat', { method: 'POST', body: { message: text } });
      typing.remove();
      state.chat.push({ role: 'assistant', text: data.reply });
      log.insertAdjacentHTML('beforeend', chatMessage({ role: 'assistant', text: data.reply }));
    } catch (error) {
      typing.remove();
      toast(error.message, 'error');
    }
    log.scrollTop = log.scrollHeight;
  });

  const compare = document.querySelector('#compare-form');
  compare?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = compare.querySelector('button');
    const result = document.querySelector('#compare-result');
    button.disabled = true;
    button.textContent = 'Reading fare feed…';
    try {
      const data = await api('/api/concierge/compare', { method: 'POST', body: { url: compare.elements.url.value } });
      result.innerHTML = `<div class="preview-box"><div class="preview-head"><strong>${esc(data.provider)}</strong><span>HTTP ${esc(data.status)} · ${esc(data.contentType || 'unknown')}</span></div><pre>${esc(data.preview || '(empty response)')}</pre></div>`;
    } catch (error) {
      result.innerHTML = `<p class="promo-result bad">${esc(error.message)}</p>`;
    } finally {
      button.disabled = false;
      button.innerHTML = `${icon('link', 15)} Compare fare`;
    }
  });
}

function experiencesView() {
  const experiences = state.catalog.experiences;
  const content = `
    <section class="page"><div class="wrap">
      ${pageHead(
        `<a href="#/">Home</a> / <span>Experiences</span>`,
        'Rare Journeys & Story-Led Access',
        'Small groups, dedicated local navigators on the ground, and moments you cannot find in any guidebook.',
        `<span class="ticker-pill"><span class="badge-dot"></span> VIP Access Guaranteed</span>`
      )}
      <div class="pin-filter-bar" style="margin-bottom:30px;">
        <span class="pin-filter-chip active" data-exp-filter="all">All Experiences</span>
        <span class="pin-filter-chip" data-exp-filter="Sky">Sky & Starlight</span>
        <span class="pin-filter-chip" data-exp-filter="Ocean">Ocean & Coral</span>
        <span class="pin-filter-chip" data-exp-filter="Desert">Desert & Wilderness</span>
        <span class="pin-filter-chip" data-exp-filter="Taste">Culinary & Tastings</span>
      </div>
      <div class="exp-grid" id="exp-container">${experiences.map((experience, index) => experienceCard(experience, index)).join('')}</div>
      <div class="cta-band reveal" style="margin-top:48px;">
        <div>
          <h2>Build a bespoke journey around a feeling.</h2>
          <p>Tell our concierges where you want to go — or let our route engine chart rare experiences tailored to your dates.</p>
        </div>
        <div class="cta-actions">
          <a class="btn primary" href="#/concierge">Ask the Navigator</a>
          <a class="btn ghost" href="#/stays">Browse Boutique Stays</a>
        </div>
      </div>
    </div></section>`;
  return {
    content,
    active: 'experiences',
    bind: () => {
      document.querySelectorAll('[data-exp-filter]').forEach((chip) => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('[data-exp-filter]').forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          const filter = chip.dataset.expFilter;
          const container = document.querySelector('#exp-container');
          if (!container) return;
          const filtered = filter === 'all'
            ? experiences
            : experiences.filter((e) => e.tag === filter);
          container.innerHTML = filtered.map((e, idx) => experienceCard(e, idx)).join('');
        });
      });
    },
  };
}

function notFoundView() {
  return {
    content: `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Lost</span>', 'This route is off the map.', 'The page you followed does not exist — but the world is still out there.')}${emptyState('Nothing charted here', 'Check the address or let the route engine take you home.', '<a class="btn primary" href="#/">Return home</a>')}</div></section>`,
    active: '',
  };
}

function errorView(message) {
  return `<section class="page"><div class="wrap">${pageHead('<a href="#/">Home</a> / <span>Signal lost</span>', 'A route went quiet.', 'The service did not answer in time. Try again in a moment.')}${emptyState('Request could not be completed', esc(message || 'The route engine is temporarily unavailable.'), '<a class="btn primary" href="#/">Return home</a>')}</div></section>`;
}

function bindAuthForm() {
  const form = document.querySelector('#auth-form');
  const demoBtn = document.querySelector('#quick-demo-login');
  demoBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode('login');
    if (form) {
      form.elements.email.value = 'nova@astralane.travel';
      form.elements.password.value = 'Nova!Demo#2026';
      toast('VIP Demo Pass activated! Signing in as Nova Vanguard...', 'success');
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = document.querySelector('#auth-submit');
    const submitSpan = submit?.querySelector('span');
    const mode = state.authMode;
    if (submit) submit.disabled = true;
    if (submitSpan) submitSpan.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…';
    try {
      const payload = {
        email: form.elements.email.value,
        password: form.elements.password.value,
      };
      if (mode === 'register') payload.name = form.elements.name.value;
      const data = await api(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: payload });
      state.token = data.token;
      localStorage.setItem('astra.token', data.token);
      state.user = data.user;
      closeAuth();
      toast(mode === 'login' ? `Welcome back, ${data.user.name.split(' ')[0]}.` : 'Your AstraLane account is ready.', 'success');
      await route();
    } catch (error) {
      toast(error.message, 'error');
      if (submit) submit.disabled = false;
      if (submitSpan) submitSpan.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    }
  });
}

function observeReveals() {
  if (!('IntersectionObserver' in window)) return;
  if (!observeReveals.observer) {
    observeReveals.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observeReveals.observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
  }
  document.querySelectorAll('.reveal:not(.in)').forEach((node) => observeReveals.observer.observe(node));
}

async function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathName, queryString = ''] = raw.split('?');
  const path = pathName || 'home';
  const params = new URLSearchParams(queryString);

  if ((path === 'account' || path === 'admin' || path === 'concierge') && !state.user) {
    await loadUser();
  }

  closeAuth();
  document.querySelector('#primary-nav')?.classList.remove('open');
  document.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');

  let view;
  try {
    switch (path) {
      case 'home': view = homeView(); break;
      case 'signin':
      case 'login':
        view = homeView();
        setTimeout(() => openAuth('login'), 20);
        break;
      case 'packages': view = packagesView(); break;
      case 'moodboard': view = moodboardView(); break;
      case 'search': view = await searchView(params); break;
      case 'stays': view = await staysView(params); break;
      case 'book': view = await bookingView(params); break;
      case 'account': view = await accountView(); break;
      case 'admin': view = await adminView(); break;
      case 'concierge': view = await conciergeView(); break;
      case 'experiences': view = experiencesView(); break;
      default: view = notFoundView();
    }
  } catch (error) {
    console.error(error);
    view = { content: errorView(error.message), active: '' };
  }

  app.innerHTML = shell(view.content, view.active || '');
  bindAuthForm();
  setAuthMode(state.authMode);
  view.bind?.();
  observeReveals();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const open = target.closest('[data-open-auth]');
  if (open) {
    event.preventDefault();
    openAuth(open.dataset.openAuth || 'login');
    return;
  }

  if (target.closest('[data-close-auth]') || target.id === 'auth-modal') {
    closeAuth();
    return;
  }

  const tab = target.closest('[data-auth-tab]');
  if (tab) {
    event.preventDefault();
    setAuthMode(tab.dataset.authTab);
    return;
  }

  const sso = target.closest('[data-sso]');
  if (sso) {
    event.preventDefault();
    startSso(sso.dataset.sso);
    return;
  }

  if (target.closest('[data-logout]')) {
    event.preventDefault();
    void logout();
    return;
  }

  const navToggle = target.closest('[data-nav-toggle]');
  if (navToggle) {
    const nav = document.querySelector('#primary-nav');
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAuth();
    document.querySelector('#primary-nav')?.classList.remove('open');
    document.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
  }
});

async function boot() {
  await Promise.all([loadCatalog(), loadUser()]);
  window.addEventListener('hashchange', () => { void route(); });
  await route();
}

void boot();
