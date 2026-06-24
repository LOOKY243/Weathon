(() => {
    'use strict';

    const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
    const FORECAST_URL = '/forecast/';

    const $form = document.getElementById('search');
    const $q = document.getElementById('q');
    const $suggest = document.getElementById('suggest');
    const $status = document.getElementById('status');
    const $result = document.getElementById('result');

    let matches = [];

    const TEMP_STOPS = [
        [-15, [155, 208, 255]], [0, [126, 200, 255]], [8, [94, 224, 208]],
        [16, [139, 232, 106]], [23, [255, 194, 75]], [31, [255, 140, 66]], [40, [255, 90, 60]],
    ];
    function tempColor(t) {
        if (t == null || Number.isNaN(t)) return '#5eb3ff';
        const s = TEMP_STOPS;
        if (t <= s[0][0]) return rgb(s[0][1]);
        if (t >= s[s.length - 1][0]) return rgb(s[s.length - 1][1]);
        for (let i = 0; i < s.length - 1; i++) {
            const [t0, c0] = s[i], [t1, c1] = s[i + 1];
            if (t >= t0 && t <= t1) {
                const f = (t - t0) / (t1 - t0);
                return rgb([0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * f)));
            }
        }
        return '#5eb3ff';
    }
    const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

    let timer = null;
    $q.addEventListener('input', () => {
        clearTimeout(timer);
        const q = $q.value.trim();
        if (q.length < 2) { hideSuggest(); return; }
        timer = setTimeout(() => geocode(q), 250);
    });

    async function geocode(q) {
        try {
            const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
            const data = await fetch(url).then(r => r.json());
            matches = data.results || [];
            if (!matches.length) { hideSuggest(); return; }
            $suggest.innerHTML = matches.map((r, i) => `
                <li role="option" data-i="${i}">
                    <div class="s-name">${r.name}</div>
                    <div class="s-meta">${[r.admin1, r.country].filter(Boolean).join(' · ')}</div>
                </li>`).join('');
            showSuggest();
            $suggest.querySelectorAll('li').forEach(li => {
                li.addEventListener('click', () => choose(matches[+li.dataset.i]));
            });
        } catch (err) {
            hideSuggest();
        }
    }

    function showSuggest() { $suggest.hidden = false; $q.setAttribute('aria-expanded', 'true'); }
    function hideSuggest() { $suggest.hidden = true; $q.setAttribute('aria-expanded', 'false'); }
    document.addEventListener('click', e => { if (!$form.contains(e.target)) hideSuggest(); });

    $form.addEventListener('submit', async e => {
        e.preventDefault();
        const q = $q.value.trim();
        if (!q) return;
        if (matches.length) { choose(matches[0]); return; }
        setStatus('Searching…');
        try {
            const data = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=1&format=json`).then(r => r.json());
            if (data.results && data.results.length) choose(data.results[0]);
            else setStatus(`No place found for “${q}”.`, true);
        } catch (err) {
            setStatus('Search is unavailable right now.', true);
        }
    });

    function choose(place) {
        hideSuggest();
        $q.value = place.name;
        matches = [];
        loadForecast(place);
    }

    async function loadForecast(place) {
        setStatus(`Reading the forecast for ${place.name}…`);
        $result.hidden = true;
        try {
            const res = await fetch(`${FORECAST_URL}?lat=${place.latitude}&lng=${place.longitude}`);
            if (!res.ok) throw new Error('bad response');
            const data = await res.json();
            if (!data.forecast || !data.forecast.length) throw new Error('no data');
            render(place, data);
            setStatus('');
        } catch (err) {
            setStatus('Could not load the forecast. Try again.', true);
        }
    }

    function render(place, data) {
        const days = data.forecast;
        const hourly = data.hourly || [];
        const today = days[0];
        const rest = days.slice(1, 7);

        const todayCard = `
            <div class="today">
                <div class="today-left">
                    <div class="today-icon">${today.icon}</div>
                    <div>
                        <div class="today-day">TODAY · ${weekday(today.day)}</div>
                        <div class="today-cond">${today.condition}</div>
                        <div class="today-feels">Feels ${Math.round(today.feels_high)}° / ${Math.round(today.feels_low)}°</div>
                    </div>
                </div>
                <div class="today-temp">
                    <div class="today-high" style="color:${tempColor(today.high)}">${Math.round(today.high)}°</div>
                    <div class="today-low">Low ${Math.round(today.low)}°</div>
                    <div class="today-chips">
                        <span class="chip">UV <b>${Math.round(today.uv_index)}</b></span>
                        <span class="chip">RAIN <b>${today.precip_prob}%</b></span>
                    </div>
                </div>
            </div>`;

        const timeline = hourly.length ? `
            <div class="timeline-wrap">
                <p class="section-label">Today · hour by hour</p>
                <div class="timeline">
                    ${hourly.map(h => `
                        <div class="hour">
                            <div class="h-time">${fmtHour(h.time)}</div>
                            <div class="h-icon" title="${h.condition || ''}">${h.icon || ''}</div>
                            <div class="h-temp" style="color:${tempColor(h.temp)}">${Math.round(h.temp)}°</div>
                        </div>`).join('')}
                </div>
            </div>` : '';

        const week = `
            <div class="week">
                ${rest.map(d => `
                    <div class="day-card">
                        <div class="d-name">${weekday(d.day)}</div>
                        <div class="d-icon">${d.icon}</div>
                        <div class="d-high" style="color:${tempColor(d.high)}">${Math.round(d.high)}°</div>
                        <div class="d-low">${Math.round(d.low)}°</div>
                        <div class="d-precip">💧 ${d.precip_prob}%</div>
                    </div>`).join('')}
            </div>`;

        $result.innerHTML = `
            <div class="place">
                <h3>${place.name}</h3>
                <span class="p-meta">${[place.admin1, place.country].filter(Boolean).join(' · ')}
                    · ${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}</span>
            </div>
            ${todayCard}
            ${timeline}
            ${week}`;
        $result.hidden = false;
    }

    function weekday(isoDate) {
        const d = new Date(isoDate + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    }

    function fmtHour(iso) {
        return (iso || '').slice(11, 16) || iso;
    }

    function setStatus(msg, isError) {
        $status.textContent = msg;
        $status.classList.toggle('error', !!isError);
    }
})();
