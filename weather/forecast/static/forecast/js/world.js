(() => {
    'use strict';

    const COUNTRIES_URL = 'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';
    const CITIES_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson';

    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const DEFAULT_ACCENT = '#2f9be0';
    const ORBIT_POV = { lat: 22, lng: 8, altitude: 2.5 };

    const $globe = document.getElementById('globe');
    const $boot = document.getElementById('boot');
    const $clock = document.getElementById('clock');
    const $panel = document.getElementById('panel');
    const $reset = document.getElementById('reset');
    const $tFocus = document.getElementById('t-focus');
    const $tLat = document.getElementById('t-lat');
    const $tLon = document.getElementById('t-lon');

    let world = null;
    let countries = [];
    let cities = [];
    let hoveredCountry = null;
    let selectedCountry = null;
    let selectedCity = null;

    const TEMP_STOPS = [
        [-15, [80, 150, 230]],
        [0, [56, 168, 233]],
        [8, [30, 178, 188]],
        [16, [96, 188, 78]],
        [23, [243, 168, 28]],
        [31, [238, 120, 40]],
        [40, [223, 70, 55]],
    ];

    function tempColor(t) {
        if (t == null || Number.isNaN(t)) return DEFAULT_ACCENT;
        const s = TEMP_STOPS;
        if (t <= s[0][0]) return rgb(s[0][1]);
        if (t >= s[s.length - 1][0]) return rgb(s[s.length - 1][1]);
        for (let i = 0; i < s.length - 1; i++) {
            const [t0, c0] = s[i], [t1, c1] = s[i + 1];
            if (t >= t0 && t <= t1) {
                const f = (t - t0) / (t1 - t0);
                return rgb([
                    Math.round(c0[0] + (c1[0] - c0[0]) * f),
                    Math.round(c0[1] + (c1[1] - c0[1]) * f),
                    Math.round(c0[2] + (c1[2] - c0[2]) * f),
                ]);
            }
        }
        return DEFAULT_ACCENT;
    }
    const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

    function setAccent(color) {
        const root = document.documentElement;
        root.style.setProperty('--accent', color);
        const dim = color.startsWith('rgb(')
            ? color.replace('rgb(', 'rgba(').replace(')', ', 0.16)')
            : 'rgba(47, 155, 224, 0.16)';
        root.style.setProperty('--accent-dim', dim);
        if (world) world.atmosphereColor(color);
    }

    async function boot() {
        startClock();

        let countryData, cityData;
        try {
            [countryData, cityData] = await Promise.all([
                fetch(COUNTRIES_URL).then(r => r.json()),
                fetch(CITIES_URL).then(r => r.json()),
            ]);
        } catch (err) {
            failBoot('Could not load map data. Check your connection and reload.');
            return;
        }

        countries = (countryData.features || []).filter(f => f.properties.ISO_A2 !== 'AQ');
        countries.forEach(f => { f.__land = landColor(f); });
        cities = (cityData.features || []).map(f => ({
            name: f.properties.name,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            pop: f.properties.pop_max || f.properties.pop_min || 0,
            iso3: f.properties.adm0_a3,
            country: f.properties.adm0name,
            capital: f.properties.adm0cap === 1,
        }));

        buildGlobe();
        $boot.classList.add('hidden');
    }

    function failBoot(msg) {
        $boot.innerHTML = `<p class="boot-text" style="color:#ff7a6b">${msg}</p>`;
    }

    function oceanTexture() {
        const c = document.createElement('canvas');
        c.width = 8; c.height = 256;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0.00, '#0c3f86');
        g.addColorStop(0.30, '#1769c0');
        g.addColorStop(0.50, '#2e93dd');
        g.addColorStop(0.70, '#1769c0');
        g.addColorStop(1.00, '#0c3f86');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 8, 256);
        return c.toDataURL();
    }

    function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
    function landColor(feat) {
        const lat = Math.abs(bounds(feat).lat);
        let base;
        if (lat < 23) base = [44, 162, 78];
        else if (lat < 45) base = [74, 168, 82];
        else if (lat < 60) base = [108, 170, 96];
        else base = [150, 174, 132];
        const j = (hashStr(feat.properties.ADMIN || '') % 24) - 12;
        return base.map(v => clamp(v + j));
    }
    const clamp = v => Math.max(0, Math.min(255, v));
    const lighten = (c, n) => c.map(v => clamp(v + n));
    const rgbaArr = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

    function capColor(d) {
        const base = d.__land || [80, 160, 90];
        if (d === selectedCountry) return rgbaArr(lighten(base, 60), 0.97);
        if (d === hoveredCountry) return rgbaArr(lighten(base, 30), 0.97);
        return rgbaArr(base, 0.9);
    }
    function strokeColor(d) {
        if (d === selectedCountry || d === hoveredCountry) return 'rgba(255, 255, 255, 0.95)';
        return 'rgba(16, 72, 56, 0.5)';
    }

    function buildGlobe() {
        world = Globe()
            (document.getElementById('globe'))
            .backgroundColor('rgba(0,0,0,0)')
            .globeImageUrl(oceanTexture())
            .showAtmosphere(true)
            .atmosphereColor(DEFAULT_ACCENT)
            .atmosphereAltitude(0.2)
            .polygonsData(countries)
            .polygonCapColor(capColor)
            .polygonSideColor(() => 'rgba(28, 96, 64, 0.55)')
            .polygonStrokeColor(strokeColor)
            .polygonAltitude(d => (d === hoveredCountry || d === selectedCountry) ? 0.06 : 0.012)
            .polygonsTransitionDuration(REDUCED ? 0 : 300)
            .polygonLabel(d => `<span class="globe-tip">${d.properties.ADMIN}</span>`)
            .onPolygonHover(onCountryHover)
            .onPolygonClick(focusCountry)
            .pointsData([])
            .pointLat('lat').pointLng('lng')
            .pointColor(() => DEFAULT_ACCENT)
            .pointAltitude(0.012)
            .pointRadius(d => 0.18 + Math.min(0.6, (d.pop || 0) / 12_000_000))
            .pointLabel(d => `<span class="globe-tip">${d.name}</span>`)
            .pointsMerge(false)
            .pointsTransitionDuration(REDUCED ? 0 : 400)
            .onPointClick(selectCity);

        world.pointOfView(ORBIT_POV, 0);

        const controls = world.controls();
        controls.enableZoom = true;
        controls.autoRotate = !REDUCED;
        controls.autoRotateSpeed = 0.45;
        controls.minDistance = 130;

        controls.addEventListener('start', () => { controls.autoRotate = false; });

        sizeGlobe();
        window.addEventListener('resize', sizeGlobe);
        trackPOV();
    }

    function sizeGlobe() {
        if (!world) return;
        world.width(window.innerWidth).height(window.innerHeight);
    }

    function refreshPolygons() {
        world.polygonCapColor(capColor)
            .polygonStrokeColor(strokeColor)
            .polygonAltitude(d => (d === hoveredCountry || d === selectedCountry) ? 0.06 : 0.012);
    }

    function onCountryHover(d) {
        hoveredCountry = d;
        refreshPolygons();
        $globe.style.cursor = d ? 'pointer' : 'grab';
    }

    function trackPOV() {
        const tick = () => {
            if (world) {
                const pov = world.pointOfView();
                $tLat.textContent = fmtCoord(pov.lat, 'N', 'S');
                $tLon.textContent = fmtCoord(pov.lng, 'E', 'W');
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    function fmtCoord(v, pos, neg) {
        const hemi = v >= 0 ? pos : neg;
        return `${Math.abs(v).toFixed(2)}°${hemi}`;
    }

    function citiesForCountry(feat) {
        const iso = feat.properties.ADM0_A3;
        const name = feat.properties.ADMIN;
        let list = cities.filter(c => c.iso3 === iso);
        if (!list.length) list = cities.filter(c => c.country === name);
        return list.sort((a, b) => b.pop - a.pop);
    }

    function bounds(feat) {
        let latMin = 90, latMax = -90, lngMin = 180, lngMax = -180;
        const polys = feat.geometry.type === 'Polygon'
            ? [feat.geometry.coordinates] : feat.geometry.coordinates;
        polys.forEach(poly => poly[0].forEach(([x, y]) => {
            if (y < latMin) latMin = y;
            if (y > latMax) latMax = y;
            if (x < lngMin) lngMin = x;
            if (x > lngMax) lngMax = x;
        }));
        const lat = (latMin + latMax) / 2;
        const lng = (lngMin + lngMax) / 2;
        const span = Math.max(latMax - latMin, lngMax - lngMin);
        const altitude = Math.min(2.2, Math.max(0.55, span / 38 + 0.45));
        return { lat, lng, altitude };
    }

    function focusCountry(feat) {
        if (!feat) return;
        selectedCountry = feat;
        setAccent(DEFAULT_ACCENT);
        refreshPolygons();

        const list = citiesForCountry(feat);
        world.pointsData(list);

        const b = bounds(feat);
        world.pointOfView(b, REDUCED ? 0 : 1100);
        world.controls().autoRotate = false;

        $tFocus.textContent = 'APPROACH';
        renderCountryPanel(feat, list);
    }

    function selectCity(city) {
        if (!city) return;
        selectedCity = city;
        $tFocus.textContent = 'READING';
        world.pointOfView({ lat: city.lat, lng: city.lng, altitude: 0.7 }, REDUCED ? 0 : 900);
        renderReading(city, null);
        document.dispatchEvent(new CustomEvent('atmosphere:select', { detail: city }));
    }

    function openPanel(html) {
        $panel.innerHTML = `<button class="panel-close" aria-label="Close panel">✕</button>${html}`;
        $panel.hidden = false;
        requestAnimationFrame(() => $panel.classList.add('open'));
        $panel.querySelector('.panel-close').addEventListener('click', closeAll);
    }

    function renderCountryPanel(feat, list) {
        const name = feat.properties.ADMIN;
        const region = feat.properties.CONTINENT || '';
        const rows = list.length
            ? `<ul class="city-list">${list.map((c, i) => `
                <li data-i="${i}" tabindex="0" role="button">
                    <span class="c-name">${c.name}${c.capital ? '<span class="c-cap">CAPITAL</span>' : ''}</span>
                    <span class="c-pop">${c.pop ? fmtPop(c.pop) : '—'}</span>
                </li>`).join('')}</ul>`
            : `<p class="list-note">No populated places in this dataset for ${name}.</p>`;

        openPanel(`
            <p class="panel-eyebrow">APPROACH · ${region.toUpperCase()}</p>
            <h2 class="panel-title">${name}</h2>
            <p class="panel-sub">${list.length} location${list.length === 1 ? '' : 's'} · select one to read its weather</p>
            ${rows}
        `);

        $panel.querySelectorAll('.city-list li').forEach(li => {
            const c = list[+li.dataset.i];
            li.addEventListener('click', () => selectCity(c));
            li.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCity(c); }
            });
        });
    }

    function renderReading(city, weather) {
        const head = `
            <p class="panel-eyebrow">READING</p>
            <h2 class="panel-title">${city.name}</h2>
            <p class="panel-sub">${city.country || ''} · ${city.lat.toFixed(2)}, ${city.lng.toFixed(2)}</p>`;

        if (!weather || weather.tempC == null) {
            openPanel(head + `
                <div class="wx-standby">
                    <div class="standby-pulse"></div>
                    <p class="standby-title">READING…</p>
                    <p class="standby-note">Fetching the latest conditions for these coordinates.</p>
                    <div class="standby-coords">
                        <span>LAT ${city.lat.toFixed(4)}</span>
                        <span>LON ${city.lng.toFixed(4)}</span>
                    </div>
                </div>`);
            return;
        }

        const accent = tempColor(weather.tempC);
        setAccent(accent);
        if (world) world.pointColor(() => accent);

        let strip = '';
        if (Array.isArray(weather.hourly) && weather.hourly.length) {
            const temps = weather.hourly.slice(0, 24);
            const min = Math.min(...temps), max = Math.max(...temps);
            const range = max - min || 1;
            const bars = temps.map(v => {
                const h = 6 + ((v - min) / range) * 50;
                return `<div class="bar" style="height:${h}px" title="${Math.round(v)}°"></div>`;
            }).join('');
            strip = `
                <div class="wx-strip">
                    <p class="strip-title">NEXT ${temps.length} HOURS · °C</p>
                    <div class="spark">${bars}</div>
                    <div class="spark-axis"><span>NOW</span><span>MID</span><span>END</span></div>
                </div>`;
        }

        let icon = weather.icon || '';
        if (weather.isDay === 0) {
            if (icon === '☀️') icon = '🌙';
            else if (icon === '🌤️') icon = '🌙';
        }

        const cell = (k, v) => `<div class="wx-cell"><div class="k">${k}</div><div class="v">${v}</div></div>`;
        const cells = [];
        if (weather.humidity != null) cells.push(cell('HUMIDITY', weather.humidity + '%'));
        if (weather.wind != null) cells.push(cell('WIND', Math.round(weather.wind) + ' <span style="font-size:11px">km/h</span>'));
        if (weather.pressure != null) cells.push(cell('PRESSURE', Math.round(weather.pressure) + ' <span style="font-size:11px">hPa</span>'));
        if (weather.localTime) cells.push(cell('LOCAL TIME', weather.localTime));
        const grid = cells.length ? `<div class="wx-grid">${cells.join('')}</div>` : '';

        openPanel(head + `
            <div class="wx-now">
                <div class="wx-temp">${Math.round(weather.tempC)}<sup>°C</sup></div>
                <div class="wx-meta">
                    ${icon ? `<div class="wx-icon">${icon}</div>` : ''}
                    ${weather.condition ? `<div class="wx-cond">${weather.condition}</div>` : ''}
                    ${weather.feelsC != null ? `<div class="wx-feels">Feels ${Math.round(weather.feelsC)}°</div>` : ''}
                </div>
            </div>
            ${grid}
            ${strip}
        `);
    }

    function closeAll() {
        $panel.classList.remove('open');
        setTimeout(() => { $panel.hidden = true; }, 500);
    }

    function resetOrbit() {
        selectedCountry = null;
        selectedCity = null;
        hoveredCountry = null;
        setAccent(DEFAULT_ACCENT);
        refreshPolygons();
        world.pointsData([]);
        world.pointColor(() => DEFAULT_ACCENT);
        world.pointOfView(ORBIT_POV, REDUCED ? 0 : 1000);
        world.controls().autoRotate = !REDUCED;
        $tFocus.textContent = 'ORBIT';
        closeAll();
    }
    $reset.addEventListener('click', resetOrbit);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') resetOrbit(); });

    function startClock() {
        const update = () => {
            const d = new Date();
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            const ss = String(d.getUTCSeconds()).padStart(2, '0');
            $clock.textContent = `${hh}:${mm}:${ss} UTC`;
        };
        update();
        setInterval(update, 1000);
    }

    function fmtPop(n) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return Math.round(n / 1_000) + 'k';
        return String(n);
    }

    window.Atmosphere = {
        showReading: renderReading,
        select: selectCity,
        reset: resetOrbit,
        get selected() { return selectedCity; },
    };

    document.addEventListener('atmosphere:select', async (e) => {
        const city = e.detail;
        try {
            const res = await fetch(`/weather/?lat=${city.lat}&lng=${city.lng}`);
            if (!res.ok) return;
            const data = await res.json();
            if (selectedCity === city && data && data.tempC != null) {
                renderReading(city, data);
            }
        } catch (err) {
            console.error('weather fetch failed', err);
        }
    });

    boot();
})();
