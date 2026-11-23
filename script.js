const globeEl = document.getElementById("globe");
const rotateBtn = document.getElementById("rotateBtn");
const panel = {
  name: document.getElementById("placeName"),
  coords: document.getElementById("coords"),
};

const globe = Globe()(globeEl)
  .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
  .backgroundColor("rgba(0,0,0,0)")
  .atmosphereColor("#6fb7ff")
  .atmosphereAltitude(0.16)
  .ringsData([])
  .ringColor(() => t => `rgba(255,184,107,${1 - t})`)
  .ringMaxRadius(4)
  .ringPropagationSpeed(2)
  .ringRepeatPeriod(900)
  .onGlobeClick(({ lat, lng }) => selectPlace(lat, lng));

// 360° auto rotation
const controls = globe.controls();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;
controls.enableDamping = true;
controls.minDistance = 120;
controls.maxDistance = 500;

// keep canvas sized to its container
const resize = () => globe.width(globeEl.clientWidth).height(globeEl.clientHeight);
new ResizeObserver(resize).observe(globeEl);
resize();
globe.pointOfView({ lat: 22, lng: 78, altitude: 2.4 }); // start over India

// smooth on phones: cap pixel ratio, pause when tab is hidden
const isMobile = matchMedia("(max-width: 900px)").matches;
globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
document.addEventListener("visibilitychange", () =>
  document.hidden ? globe.pauseAnimation() : globe.resumeAnimation());

// realistic drifting clouds (skipped silently if the library fails to load)
try {
  new THREE.TextureLoader().load(
    "https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/fair_clouds_4k.png",
    (tex) => {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(globe.getGlobeRadius() * 1.006, isMobile ? 40 : 64, isMobile ? 40 : 64),
        new THREE.MeshPhongMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false })
      );
      globe.scene().add(clouds);
      (function drift() { clouds.rotation.y -= 0.0002; requestAnimationFrame(drift); })();
    }
  );
} catch (e) {}

function setRotation(on) {
  controls.autoRotate = on;
  rotateBtn.textContent = on ? "Pause rotation" : "Resume rotation";
}
rotateBtn.addEventListener("click", () => setRotation(!controls.autoRotate));

function selectPlace(lat, lng, name) {
  setRotation(false);
  globe.ringsData([{ lat, lng }]);
  globe.pointOfView({ lat, lng, altitude: 1.3 }, 1000);
  panel.name.textContent = name || "Selected location";
  panel.coords.textContent = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
  const btn = document.getElementById("detailsBtn");
  btn.href = `details.html?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}` + (name ? `&name=${encodeURIComponent(name)}` : "");
  btn.classList.remove("disabled");
  btn.removeAttribute("aria-disabled");
  if (matchMedia("(max-width: 900px)").matches)
    document.getElementById("panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// city search (Open-Meteo geocoding, no key needed)
document.getElementById("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if (!q) return;
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`);
    const data = await res.json();
    if (!data.results) { panel.name.textContent = "City not found"; panel.coords.textContent = "Check the spelling and try again."; return; }
    const c = data.results[0];
    selectPlace(c.latitude, c.longitude, `${c.name}, ${c.country || ""}`);
  } catch {
    panel.name.textContent = "Search failed";
    panel.coords.textContent = "Check your internet connection.";
  }
});

// °C / °F toggle (used when weather data is added)
const unitBtn = document.getElementById("unitBtn");
unitBtn.addEventListener("click", () => {
  unitBtn.textContent = unitBtn.textContent === "°C" ? "°F" : "°C";
  try { localStorage.setItem("unit", unitBtn.textContent === "°C" ? "C" : "F"); } catch (e) {}
});

try { if (localStorage.getItem("unit") === "F") unitBtn.textContent = "°F"; } catch (e) {}
