const q = new URLSearchParams(location.search);
const lat = parseFloat(q.get("lat")), lng = parseFloat(q.get("lng"));
let unit = "C";
try { unit = localStorage.getItem("unit") || "C"; } catch (e) {}
let W = null, charts = {};
const $ = (id) => document.getElementById(id);
const T = (c) => Math.round(unit === "C" ? c : c * 9 / 5 + 32);
const CODES = { 0:"Clear sky",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",81:"Rain showers",82:"Violent showers",95:"Thunderstorm",96:"Thunderstorm, hail",99:"Thunderstorm, hail" };
const code = (c) => CODES[c] || "Unknown";

function showError(msg) {
  $("place").textContent = "Could not load details";
  $("notice").hidden = false; $("notice").textContent = msg;
}

async function load() {
  if (isNaN(lat) || isNaN(lng)) return showError("No location selected. Go back to the globe and click a place.");
  $("place").classList.add("skeleton");
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&forecast_days=7`
    + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation`
    + `&hourly=temperature_2m,precipitation_probability,wind_speed_10m`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max`;
  try {
    const [res, name] = await Promise.all([fetch(url), placeName()]);
    if (!res.ok) throw new Error();
    W = await res.json();
    $("place").textContent = name;
    $("place").classList.remove("skeleton");
    render();
  } catch (e) {
    showError("Check your internet connection and try again.");
  }
}

async function placeName() {
  const given = q.get("name");
  if (given) return given;
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    const d = await r.json();
    const n = [d.city || d.locality, d.principalSubdivision, d.countryName].filter(Boolean);
    return n.length ? [...new Set(n)].join(", ") : "Open ocean or remote area";
  } catch (e) { return "Selected location"; }
}

function render() {
  const c = W.current, h = W.hourly, d = W.daily;
  $("meta").textContent = `${lat.toFixed(2)}°, ${lng.toFixed(2)}° · ${W.timezone_abbreviation} · ${c.time.replace("T", " ")}`;
  $("cond").textContent = `${code(c.weather_code)}. Feels like ${T(c.apparent_temperature)}°${unit}`;
  $("bigTemp").textContent = `${T(c.temperature_2m)}°${unit}`;
  const tiles = [
    ["Humidity", `${c.relative_humidity_2m}%`], ["Wind", `${c.wind_speed_10m} km/h`],
    ["Pressure", `${Math.round(c.pressure_msl)} hPa`], ["UV index", d.uv_index_max[0]],
    ["Cloud cover", `${c.cloud_cover}%`], ["Rain now", `${c.precipitation} mm`],
    ["Sunrise", d.sunrise[0].slice(11)], ["Sunset", d.sunset[0].slice(11)],
  ];
  $("tiles").innerHTML = tiles.map(([k, v]) => `<div class="tile"><span>${k}</span><b>${v}</b></div>`).join("");

  const day = (t) => new Date(t + "T00:00").toLocaleDateString("en", { weekday: "short" });
  $("days").innerHTML = d.time.map((t, i) =>
    `<div class="day"><p>${i ? day(t) : "Today"}</p><strong>${T(d.temperature_2m_max[i])}° / ${T(d.temperature_2m_min[i])}°</strong><small>${code(d.weather_code[i])}</small></div>`).join("");

  const i0 = Math.max(0, h.time.findIndex((t) => t >= c.time.slice(0, 13) + ":00"));
  const sl = (a) => a.slice(i0, i0 + 24);
  const labels = sl(h.time).map((t) => t.slice(11, 16));
  draw("cTemp", "line", labels, [{ label: `°${unit}`, data: sl(h.temperature_2m).map(T), borderColor: "#5ee7ff", backgroundColor: "rgba(94,231,255,.15)", fill: true }]);
  draw("cRain", "bar", labels, [{ label: "%", data: sl(h.precipitation_probability), backgroundColor: "rgba(111,183,255,.6)", borderRadius: 4 }], 100);
  draw("cWind", "line", labels, [{ label: "km/h", data: sl(h.wind_speed_10m), borderColor: "#ffb86b", backgroundColor: "rgba(255,184,107,.12)", fill: true }]);
  draw("cWeek", "line", d.time.map(day), [
    { label: "High", data: d.temperature_2m_max.map(T), borderColor: "#ffb86b", pointRadius: 3 },
    { label: "Low", data: d.temperature_2m_min.map(T), borderColor: "#5ee7ff", pointRadius: 3 }]);
}

function draw(id, type, labels, datasets, max) {
  datasets.forEach((s) => Object.assign(s, { tension: .35, borderWidth: 2, pointRadius: s.pointRadius ?? 0 }));
  if (charts[id]) { charts[id].data.labels = labels; charts[id].data.datasets = datasets; return charts[id].update("none"); }
  charts[id] = new Chart($(id), {
    type, data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: datasets.length > 1, labels: { color: "#9db2d6", boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: "#9db2d6", maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } },
        y: { max, ticks: { color: "#9db2d6", maxTicksLimit: 5 }, grid: { color: "rgba(255,255,255,.08)" } },
      },
    },
  });
}

$("unitBtn").textContent = `°${unit}`;
$("unitBtn").addEventListener("click", () => {
  unit = unit === "C" ? "F" : "C";
  $("unitBtn").textContent = `°${unit}`;
  try { localStorage.setItem("unit", unit); } catch (e) {}
  if (W) render();
});
load();
