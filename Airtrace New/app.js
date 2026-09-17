
const MAP_CENTER = [14.5995, 120.9842]; //MANILA BABY
const MAP_ZOOM = 11;
const DATA_URL = "data.json";

function getAqiColor(aqi) {
  if (aqi <= 50) return "#00e400";    
  if (aqi <= 100) return "#ffff00";  
  if (aqi <= 150) return "#ff7e00";  
  if (aqi <= 200) return "#ff0000";  
  if (aqi <= 300) return "#8f3f97";  
  return "#7e0023";                  
}

function getAqiCategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

const TVOC_BREAKPOINTS = [ // mg/m³
  { cLow: 0,     cHigh: 0.3,  iLow: 0,   iHigh: 50 },
  { cLow: 0.301, cHigh: 0.5,  iLow: 51,  iHigh: 100 },
  { cLow: 0.501, cHigh: 1.0,  iLow: 101, iHigh: 150 },
  { cLow: 1.001, cHigh: 2.0,  iLow: 151, iHigh: 200 },
  { cLow: 2.001, cHigh: 4.0,  iLow: 201, iHigh: 300 },
  { cLow: 4.001, cHigh: 10.0, iLow: 301, iHigh: 500 },
];

function calculateAQI(tvoc) {
  if (tvoc === undefined || tvoc === null) return 0;

  const maxRow = TVOC_BREAKPOINTS[TVOC_BREAKPOINTS.length - 1];
  if (tvoc > maxRow.cHigh) return maxRow.iHigh;

  const range = TVOC_BREAKPOINTS.find(
    (r) => tvoc >= r.cLow && tvoc <= r.cHigh
  );
  if (!range) return 0;

  const { cLow, cHigh, iLow, iHigh } = range;
  return Math.round(
    ((iHigh - iLow) / (cHigh - cLow)) * (tvoc - cLow) + iLow
  );
}

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

const map = L.map("map").setView(MAP_CENTER, MAP_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);
const legendEl = document.getElementById("legend");
const legendToggleBtn = document.getElementById("legend-toggle");

legendToggleBtn.addEventListener("click", () => {
  legendEl.classList.toggle("open");
});
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
  const { name, lat, lng, co2, hcho, tvoc, lastUpdated, image, images } = station;
  const aqi = calculateAQI(tvoc);

  const icon = createAqiIcon(aqi);
  const marker = L.marker([lat, lng], { icon }).addTo(map);
  const imageList = images && images.length > 0 ? images : image ? [image] : [];

  const imagesHtml =
    imageList.length > 0
      ? `<div class="station-images">
          ${imageList
            .map((src) => `<img src="${src}" alt="${name}" class="station-image" />`)
            .join("")}
        </div>`
      : "";

  const popupHtml = `
    <div class="aqi-popup">
      ${imagesHtml}
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

  marker.bindPopup(popupHtml, { maxWidth: 280 });
}

loadStations();

let userMarker = null;
let userAccuracyCircle = null;
let hasCenteredOnUser = false;

const userLocationIcon = L.divIcon({
  className: "user-location-marker",
  html: `<div style="
    background:#4285f4;
    width:16px;
    height:16px;
    border-radius:50%;
    border:3px solid #fff;
    box-shadow:0 0 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function updateUserLocation(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const latlng = [latitude, longitude];

  if (!userMarker) {
    userMarker = L.marker(latlng, { icon: userLocationIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup("You are here");
    userAccuracyCircle = L.circle(latlng, {
      radius: accuracy,
      color: "#4285f4",
      fillColor: "#4285f4",
      fillOpacity: 0.1,
      weight: 1,
    }).addTo(map);
  } else {
    userMarker.setLatLng(latlng);
    userAccuracyCircle.setLatLng(latlng);
    userAccuracyCircle.setRadius(accuracy);
  }

  if (!hasCenteredOnUser) {
    map.setView(latlng, 14);
    hasCenteredOnUser = true;
  }
}

function handleLocationError(err) {
  console.warn("Geolocation error:", err.message);
}

function startTrackingUserLocation() {
  if (!("geolocation" in navigator)) {
    console.warn("Geolocation is not supported by this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(updateUserLocation, handleLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
  });

  
  navigator.geolocation.watchPosition(updateUserLocation, handleLocationError, {
    enableHighAccuracy: true,
    maximumAge: 10000,
  });
}

startTrackingUserLocation();

map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  console.log(`New station coords -> lat: ${lat.toFixed(5)}, lng: ${lng.toFixed(5)}`);
});


const AUTO_REFRESH_MS = 5 * 60 * 1000;
setInterval(() => {
  
  map.eachLayer((layer) => {
    if (
      layer instanceof L.Marker &&
      layer !== userMarker
    ) {
      map.removeLayer(layer);
    }
  });
  loadStations();
}, AUTO_REFRESH_MS);
