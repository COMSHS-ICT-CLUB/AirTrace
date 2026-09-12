// ---------------------------------------------
// CONFIG
// ---------------------------------------------
const MAP_CENTER = [14.5995, 120.9842]; // default center (Manila) — change to your area
const MAP_ZOOM = 11;
const DATA_URL = "data.json";

// ---------------------------------------------
// AQI COLOR SCALE (standard EPA bands)
// ---------------------------------------------
function getAqiColor(aqi) {
  if (aqi <= 50) return "#00e400";   // Good
  if (aqi <= 100) return "#ffff00";  // Moderate
  if (aqi <= 150) return "#ff7e00";  // Unhealthy for Sensitive Groups
  if (aqi <= 200) return "#ff0000";  // Unhealthy
  if (aqi <= 300) return "#8f3f97";  // Very Unhealthy
  return "#7e0023";                  // Hazardous
}

function getAqiCategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

// ---------------------------------------------
// CUSTOM MARKER ICON (colored circle by AQI)
// ---------------------------------------------
function createAqiIcon(aqi) {
  const color = getAqiColor(aqi);
  return L.divIcon({
    className: "aqi-marker",
    html: `<div style="
      background:${color};
      width:22px;
      height:22px;
      border-radius:50%;
      border:2px solid #fff;
      box-shadow:0 0 4px rgba(0,0,0,0.5);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:10px;
      font-weight:bold;
      color:#000;
    ">${aqi}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

// ---------------------------------------------
// INIT MAP
// ---------------------------------------------
const map = L.map("map").setView(MAP_CENTER, MAP_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// ---------------------------------------------
// LOAD STATIONS FROM data.json AND ADD MARKERS
// ---------------------------------------------
async function loadStations() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL}: ${res.status}`);
    const stations = await res.json();

    stations.forEach((station) => addStationMarker(station));
  } catch (err) {
    console.error("Error loading station data:", err);
  }
}

function addStationMarker(station) {
  const { name, lat, lng, aqi, co2, hcho, tvoc, lastUpdated } = station;

  const icon = createAqiIcon(aqi);
  const marker = L.marker([lat, lng], { icon }).addTo(map);

  const popupHtml = `
    <div class="aqi-popup">
      <h4>${name}</h4>
      <div class="aqi-value" style="color:${getAqiColor(aqi)}">
        AQI ${aqi} — ${getAqiCategory(aqi)}
      </div>
      <table>
        ${co2 !== undefined ? `<tr><td>CO2</td><td>${co2} ppm</td></tr>` : ""}
        ${hcho !== undefined ? `<tr><td>HCHO</td><td>${hcho} mg/m³</td></tr>` : ""}
        ${tvoc !== undefined ? `<tr><td>TVOC</td><td>${tvoc} mg/m³</td></tr>` : ""}
        ${lastUpdated ? `<tr><td>Updated</td><td>${lastUpdated}</td></tr>` : ""}
      </table>
    </div>
  `;

  marker.bindPopup(popupHtml);
}

loadStations();

// ---------------------------------------------
// CLICK-TO-LOG: click anywhere on the map to log
// lat/lng to the console, so you can copy it into
// data.json when adding a new station.
// ---------------------------------------------
map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  console.log(`New station coords -> lat: ${lat.toFixed(5)}, lng: ${lng.toFixed(5)}`);
});

// ---------------------------------------------
// OPTIONAL: auto-refresh data every 5 minutes
// (useful if you're editing data.json while the
// app is open in the browser)
// ---------------------------------------------
const AUTO_REFRESH_MS = 5 * 60 * 1000;
setInterval(() => {
  // Clear existing markers and reload
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker) map.removeLayer(layer);
  });
  loadStations();
}, AUTO_REFRESH_MS);
