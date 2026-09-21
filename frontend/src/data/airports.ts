export interface SupportedAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

// A curated set of major airports used as candidates for nearest-airport
// detection. This is intentionally not exhaustive (the flight-search input
// itself accepts any IATA code) — it just needs enough global coverage that
// "find the nearest supported airport" returns something reasonable.
export const SUPPORTED_AIRPORTS: SupportedAirport[] = [
  { iata: "JFK", name: "John F. Kennedy International", city: "New York", country: "USA", lat: 40.6413, lon: -73.7781 },
  { iata: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "USA", lat: 33.9416, lon: -118.4085 },
  { iata: "ORD", name: "O'Hare International", city: "Chicago", country: "USA", lat: 41.9742, lon: -87.9073 },
  { iata: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", country: "USA", lat: 33.6407, lon: -84.4277 },
  { iata: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", country: "USA", lat: 32.8998, lon: -97.0403 },
  { iata: "DEN", name: "Denver International", city: "Denver", country: "USA", lat: 39.8561, lon: -104.6737 },
  { iata: "SFO", name: "San Francisco International", city: "San Francisco", country: "USA", lat: 37.6213, lon: -122.3790 },
  { iata: "SEA", name: "Seattle-Tacoma International", city: "Seattle", country: "USA", lat: 47.4502, lon: -122.3088 },
  { iata: "MIA", name: "Miami International", city: "Miami", country: "USA", lat: 25.7959, lon: -80.2870 },
  { iata: "BOS", name: "Logan International", city: "Boston", country: "USA", lat: 42.3656, lon: -71.0096 },
  { iata: "IAD", name: "Washington Dulles International", city: "Washington, D.C.", country: "USA", lat: 38.9531, lon: -77.4565 },
  { iata: "DCA", name: "Ronald Reagan Washington National", city: "Washington, D.C.", country: "USA", lat: 38.8512, lon: -77.0402 },
  { iata: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", country: "USA", lat: 33.4373, lon: -112.0078 },
  { iata: "LAS", name: "Harry Reid International", city: "Las Vegas", country: "USA", lat: 36.0840, lon: -115.1537 },
  { iata: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "USA", lat: 29.9902, lon: -95.3368 },
  { iata: "MSP", name: "Minneapolis-Saint Paul International", city: "Minneapolis", country: "USA", lat: 44.8848, lon: -93.2223 },
  { iata: "DTW", name: "Detroit Metropolitan", city: "Detroit", country: "USA", lat: 42.2124, lon: -83.3534 },
  { iata: "PHL", name: "Philadelphia International", city: "Philadelphia", country: "USA", lat: 39.8744, lon: -75.2424 },
  { iata: "CLT", name: "Charlotte Douglas International", city: "Charlotte", country: "USA", lat: 35.2144, lon: -80.9473 },
  { iata: "EWR", name: "Newark Liberty International", city: "Newark", country: "USA", lat: 40.6895, lon: -74.1745 },
  { iata: "MCO", name: "Orlando International", city: "Orlando", country: "USA", lat: 28.4312, lon: -81.3081 },
  { iata: "SLC", name: "Salt Lake City International", city: "Salt Lake City", country: "USA", lat: 40.7899, lon: -111.9791 },
  { iata: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", country: "USA", lat: 21.3245, lon: -157.9251 },
  { iata: "PDX", name: "Portland International", city: "Portland", country: "USA", lat: 45.5898, lon: -122.5951 },
  { iata: "AUS", name: "Austin-Bergstrom International", city: "Austin", country: "USA", lat: 30.1975, lon: -97.6664 },
  { iata: "YYZ", name: "Toronto Pearson International", city: "Toronto", country: "Canada", lat: 43.6777, lon: -79.6248 },
  { iata: "YVR", name: "Vancouver International", city: "Vancouver", country: "Canada", lat: 49.1967, lon: -123.1815 },
  { iata: "YUL", name: "Montréal-Trudeau International", city: "Montreal", country: "Canada", lat: 45.4706, lon: -73.7408 },
  { iata: "MEX", name: "Mexico City International", city: "Mexico City", country: "Mexico", lat: 19.4363, lon: -99.0721 },
  { iata: "GRU", name: "São Paulo–Guarulhos International", city: "São Paulo", country: "Brazil", lat: -23.4356, lon: -46.4731 },
  { iata: "GIG", name: "Rio de Janeiro–Galeão International", city: "Rio de Janeiro", country: "Brazil", lat: -22.8099, lon: -43.2506 },
  { iata: "EZE", name: "Ministro Pistarini International", city: "Buenos Aires", country: "Argentina", lat: -34.8222, lon: -58.5358 },
  { iata: "BOG", name: "El Dorado International", city: "Bogotá", country: "Colombia", lat: 4.7016, lon: -74.1469 },
  { iata: "SCL", name: "Arturo Merino Benítez International", city: "Santiago", country: "Chile", lat: -33.3930, lon: -70.7858 },
  { iata: "LIM", name: "Jorge Chávez International", city: "Lima", country: "Peru", lat: -12.0219, lon: -77.1143 },
  { iata: "LHR", name: "Heathrow Airport", city: "London", country: "United Kingdom", lat: 51.4700, lon: -0.4543 },
  { iata: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "France", lat: 49.0097, lon: 2.5479 },
  { iata: "AMS", name: "Amsterdam Schiphol Airport", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lon: 4.7683 },
  { iata: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany", lat: 50.0379, lon: 8.5622 },
  { iata: "MAD", name: "Adolfo Suárez Madrid–Barajas", city: "Madrid", country: "Spain", lat: 40.4983, lon: -3.5676 },
  { iata: "BCN", name: "Barcelona–El Prat Airport", city: "Barcelona", country: "Spain", lat: 41.2974, lon: 2.0833 },
  { iata: "FCO", name: "Leonardo da Vinci–Fiumicino Airport", city: "Rome", country: "Italy", lat: 41.8003, lon: 12.2389 },
  { iata: "MUC", name: "Munich Airport", city: "Munich", country: "Germany", lat: 48.3538, lon: 11.7861 },
  { iata: "ZRH", name: "Zurich Airport", city: "Zurich", country: "Switzerland", lat: 47.4647, lon: 8.5492 },
  { iata: "DUB", name: "Dublin Airport", city: "Dublin", country: "Ireland", lat: 53.4213, lon: -6.2701 },
  { iata: "CPH", name: "Copenhagen Airport", city: "Copenhagen", country: "Denmark", lat: 55.6180, lon: 12.6560 },
  { iata: "OSL", name: "Oslo Airport, Gardermoen", city: "Oslo", country: "Norway", lat: 60.1939, lon: 11.1004 },
  { iata: "ARN", name: "Stockholm Arlanda Airport", city: "Stockholm", country: "Sweden", lat: 59.6519, lon: 17.9186 },
  { iata: "VIE", name: "Vienna International Airport", city: "Vienna", country: "Austria", lat: 48.1103, lon: 16.5697 },
  { iata: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey", lat: 41.2753, lon: 28.7519 },
  { iata: "LIS", name: "Humberto Delgado Airport", city: "Lisbon", country: "Portugal", lat: 38.7813, lon: -9.1359 },
  { iata: "SVO", name: "Sheremetyevo International", city: "Moscow", country: "Russia", lat: 55.9736, lon: 37.4125 },
  { iata: "WAW", name: "Warsaw Chopin Airport", city: "Warsaw", country: "Poland", lat: 52.1657, lon: 20.9671 },
  { iata: "DXB", name: "Dubai International", city: "Dubai", country: "UAE", lat: 25.2532, lon: 55.3657 },
  { iata: "DOH", name: "Hamad International", city: "Doha", country: "Qatar", lat: 25.2609, lon: 51.6138 },
  { iata: "CAI", name: "Cairo International", city: "Cairo", country: "Egypt", lat: 30.1219, lon: 31.4056 },
  { iata: "JNB", name: "O. R. Tambo International", city: "Johannesburg", country: "South Africa", lat: -26.1392, lon: 28.2460 },
  { iata: "NBO", name: "Jomo Kenyatta International", city: "Nairobi", country: "Kenya", lat: -1.3192, lon: 36.9278 },
  { iata: "LOS", name: "Murtala Muhammed International", city: "Lagos", country: "Nigeria", lat: 6.5774, lon: 3.3212 },
  { iata: "TLV", name: "Ben Gurion Airport", city: "Tel Aviv", country: "Israel", lat: 32.0055, lon: 34.8854 },
  { iata: "HND", name: "Haneda Airport", city: "Tokyo", country: "Japan", lat: 35.5494, lon: 139.7798 },
  { iata: "NRT", name: "Narita International", city: "Tokyo", country: "Japan", lat: 35.7720, lon: 140.3929 },
  { iata: "ICN", name: "Incheon International", city: "Seoul", country: "South Korea", lat: 37.4602, lon: 126.4407 },
  { iata: "PEK", name: "Beijing Capital International", city: "Beijing", country: "China", lat: 40.0799, lon: 116.6031 },
  { iata: "PVG", name: "Shanghai Pudong International", city: "Shanghai", country: "China", lat: 31.1443, lon: 121.8083 },
  { iata: "HKG", name: "Hong Kong International", city: "Hong Kong", country: "Hong Kong", lat: 22.3080, lon: 113.9185 },
  { iata: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore", lat: 1.3644, lon: 103.9915 },
  { iata: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand", lat: 13.6900, lon: 100.7501 },
  { iata: "KUL", name: "Kuala Lumpur International", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lon: 101.7099 },
  { iata: "CGK", name: "Soekarno-Hatta International", city: "Jakarta", country: "Indonesia", lat: -6.1256, lon: 106.6559 },
  { iata: "MNL", name: "Ninoy Aquino International", city: "Manila", country: "Philippines", lat: 14.5086, lon: 121.0198 },
  { iata: "DEL", name: "Indira Gandhi International", city: "New Delhi", country: "India", lat: 28.5562, lon: 77.1000 },
  { iata: "BOM", name: "Chhatrapati Shivaji Maharaj International", city: "Mumbai", country: "India", lat: 19.0896, lon: 72.8656 },
  { iata: "SYD", name: "Sydney Kingsford Smith", city: "Sydney", country: "Australia", lat: -33.9399, lon: 151.1753 },
  { iata: "MEL", name: "Melbourne Airport", city: "Melbourne", country: "Australia", lat: -37.6733, lon: 144.8433 },
  { iata: "AKL", name: "Auckland Airport", city: "Auckland", country: "New Zealand", lat: -37.0082, lon: 174.7850 },
];

export function getAirportByIata(iata: string): SupportedAirport | undefined {
  const normalized = iata.trim().toUpperCase();
  return SUPPORTED_AIRPORTS.find((airport) => airport.iata === normalized);
}

// Metro areas served by multiple airports usually have only one entry in
// SUPPORTED_AIRPORTS (it's a curated list of nearest-airport candidates, not
// an exhaustive database — adding every secondary airport would also shift
// which one nearest-airport detection picks for that region, which is a
// separate concern from just knowing a city name). This fills in city names
// for the others so destination search by city can still find them.
const ADDITIONAL_CITIES_BY_IATA: Record<string, string> = {
  LGA: "New York",
};

export function getCityByIata(iata: string): string | undefined {
  const normalized = iata.trim().toUpperCase();
  return getAirportByIata(normalized)?.city ?? ADDITIONAL_CITIES_BY_IATA[normalized];
}
