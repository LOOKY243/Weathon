(() => {
    'use strict';

    const el = document.getElementById('earthHorizonCanvas');
    if (!el) return;
    const ctx = el.getContext('2d');
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const LOOP_SEC = 28;
    const ROTATION_SPEED = 1;
    const loopSec = () => LOOP_SEC;
    const spinSpeed = () => ROTATION_SPEED * 0.06;

    let scene = null, last = -1, a = 0, raf = null;

    function weightsAt(p) {
        const seg = p * 4, i = Math.floor(seg) % 4, j = (i + 1) % 4;
        let f = seg - Math.floor(seg);
        f = f < 0.62 ? 0 : (f - 0.62) / 0.38;
        f = f * f * (3 - 2 * f);
        const w = [0, 0, 0, 0]; w[i] = 1 - f; w[j] = f;
        return w;
    }
    function mix(TAB, w) {
        return [0, 1, 2].map(k =>
            Math.round(TAB[0][k] * w[0] + TAB[1][k] * w[1] + TAB[2][k] * w[2] + TAB[3][k] * w[3])
        );
    }

    function initScene() {
        const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
        const continents = [];
        for (let i = 0; i < 9; i++) continents.push({
            lat: rnd(-0.15, 1.45), lon: rnd(0, Math.PI * 2),
            size: rnd(0.16, 0.34), jit: rnd(-0.10, 0.12), rough: rnd(0.7, 1.3),
        });
        const clouds = [];
        for (let i = 0; i < 7; i++) clouds.push({
            lat: rnd(-0.1, 1.4), lon: rnd(0, Math.PI * 2),
            size: rnd(0.18, 0.40), a: rnd(0.18, 0.4),
        });
        const stars = [];
        for (let i = 0; i < 110; i++) stars.push({
            x: Math.random(), y: Math.random() * 0.55,
            r: rnd(0.4, 1.5), ph: rnd(0, Math.PI * 2), sp: rnd(0.6, 1.8),
        });
        scene = { continents, clouds, stars };
        last = -1;
    }

    function frame(now) {
        if (!scene) initScene();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = el.clientWidth, H = el.clientHeight;
        if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) {
            el.width = Math.round(W * dpr); el.height = Math.round(H * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const t = now / 1000;
        const dt = last < 0 ? 0.016 : Math.min(0.05, t - last);
        last = t;
        a += spinSpeed() * dt;

        const LAND = [[104, 182, 92], [74, 148, 66], [201, 116, 52], [210, 217, 211]];
        const OCEAN = [[58, 128, 196], [38, 104, 180], [54, 96, 140], [46, 82, 124]];
        const SPACE = [[40, 70, 120], [34, 76, 140], [60, 66, 104], [44, 60, 108]];
        const HORIZ = [[156, 204, 238], [142, 198, 240], [224, 184, 150], [198, 216, 240]];
        const ATMO = [[150, 210, 255], [132, 200, 255], [255, 200, 150], [200, 226, 255]];
        const ICE = [0.9, 0.6, 1.05, 1.6];

        const w = weightsAt((t / loopSec()) % 1);
        const land = mix(LAND, w), ocean = mix(OCEAN, w);
        const space = mix(SPACE, w), horiz = mix(HORIZ, w), atmo = mix(ATMO, w);
        const iceScale = ICE[0] * w[0] + ICE[1] * w[1] + ICE[2] * w[2] + ICE[3] * w[3];
        const winter = w[3];
        const rgb = (c, alpha) => `rgba(${c[0]},${c[1]},${c[2]},${alpha == null ? 1 : alpha})`;

        const cx = W / 2, R = H * 0.78, peakY = H * 0.30, cy = peakY + R;
        const beta = 0.42, cb = Math.cos(beta), sb = Math.sin(beta);
        const proj = (lat, lon) => {
            const cl = Math.cos(lat);
            const x0 = cl * Math.sin(lon + a), y0 = Math.sin(lat), z0 = cl * Math.cos(lon + a);
            const y1 = y0 * cb - z0 * sb, z1 = y0 * sb + z0 * cb;
            return { sx: cx + x0 * R, sy: cy - y1 * R, z: z1 };
        };

        const sky = ctx.createLinearGradient(0, 0, 0, peakY + H * 0.10);
        sky.addColorStop(0, rgb(space));
        sky.addColorStop(0.62, rgb([(space[0] + horiz[0]) / 2, (space[1] + horiz[1]) / 2, (space[2] + horiz[2]) / 2]));
        sky.addColorStop(1, rgb(horiz));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

        for (const s of scene.stars) {
            const sy = s.y * H;
            const fade = sy > peakY * 0.7 ? Math.max(0, 1 - (sy - peakY * 0.7) / (peakY * 0.6)) : 1;
            if (fade <= 0) continue;
            const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * s.sp + s.ph));
            ctx.fillStyle = `rgba(255,255,255,${0.55 * tw * fade})`;
            ctx.beginPath(); ctx.arc(s.x * W, sy, s.r, 0, 6.2832); ctx.fill();
        }

        const halo = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.10);
        halo.addColorStop(0, rgb(atmo, 0));
        halo.addColorStop(0.55, rgb(atmo, 0.30));
        halo.addColorStop(1, rgb(atmo, 0));
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.10, 0, 6.2832); ctx.fill();

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();

        ctx.fillStyle = rgb(ocean); ctx.fillRect(0, 0, W, H);

        const drawBlob = (sx, sy, rx, ry, col, alpha) => {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, 6.2832); ctx.fill();
        };
        for (const c of scene.continents) {
            const p = proj(c.lat, c.lon);
            if (p.z <= 0.02) continue;
            const fade = Math.min(1, (p.z - 0.02) / 0.28);
            const sq = 0.35 + 0.65 * p.z;
            const baseR = c.size * R;
            const lc = [
                Math.max(0, Math.min(255, land[0] * (1 + c.jit))),
                Math.max(0, Math.min(255, land[1] * (1 + c.jit))),
                Math.max(0, Math.min(255, land[2] * (1 + c.jit))),
            ];
            drawBlob(p.sx, p.sy, baseR * sq, baseR * 0.82, rgb(lc), 0.92 * fade);
            drawBlob(p.sx - baseR * 0.3 * sq, p.sy + baseR * 0.18, baseR * 0.6 * sq * c.rough, baseR * 0.5, rgb(lc), 0.9 * fade);
            drawBlob(p.sx + baseR * 0.35 * sq, p.sy - baseR * 0.12, baseR * 0.5 * sq, baseR * 0.42 * c.rough, rgb(lc), 0.9 * fade);
        }

        const ip = proj(Math.PI / 2 - 0.05, 0);
        if (ip.z > 0) {
            const ir = R * 0.22 * iceScale;
            const ig = ctx.createRadialGradient(ip.sx, ip.sy, 0, ip.sx, ip.sy, ir);
            ig.addColorStop(0, 'rgba(248,251,255,0.95)');
            ig.addColorStop(0.6, 'rgba(236,244,252,0.7)');
            ig.addColorStop(1, 'rgba(236,244,252,0)');
            ctx.globalAlpha = 1; ctx.fillStyle = ig;
            ctx.beginPath(); ctx.ellipse(ip.sx, ip.sy, ir * 1.35, ir * 0.8, 0, 0, 6.2832); ctx.fill();
        }

        if (winter > 0.05) {
            ctx.globalAlpha = winter * 0.28;
            ctx.fillStyle = 'rgba(235,242,250,1)';
            ctx.fillRect(0, 0, W, H);
        }

        for (const c of scene.clouds) {
            const cl = Math.cos(c.lat);
            const lon = c.lon + a * 1.5 + t * 0.015;
            const x0 = cl * Math.sin(lon), y0 = Math.sin(c.lat), z0 = cl * Math.cos(lon);
            const y1 = y0 * cb - z0 * sb, z1 = y0 * sb + z0 * cb;
            if (z1 <= 0.04) continue;
            const sx = cx + x0 * R, sy = cy - y1 * R;
            const fade = Math.min(1, (z1 - 0.04) / 0.3);
            const sq = 0.4 + 0.6 * z1, rr = c.size * R;
            ctx.globalAlpha = c.a * fade;
            ctx.fillStyle = 'rgba(255,255,255,1)';
            ctx.beginPath(); ctx.ellipse(sx, sy, rr * sq, rr * 0.42, 0, 0, 6.2832); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sx + rr * 0.4 * sq, sy + rr * 0.1, rr * 0.55 * sq, rr * 0.3, 0, 0, 6.2832); ctx.fill();
        }

        ctx.globalAlpha = 1;
        const shade = ctx.createRadialGradient(cx - R * 0.18, cy - R * 0.78, R * 0.1, cx, cy, R * 1.02);
        shade.addColorStop(0, 'rgba(255,255,255,0.18)');
        shade.addColorStop(0.45, 'rgba(255,255,255,0)');
        shade.addColorStop(0.8, 'rgba(6,14,30,0.10)');
        shade.addColorStop(1, 'rgba(6,14,30,0.55)');
        ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);

        ctx.restore();

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = Math.max(2, H * 0.006);
        ctx.strokeStyle = rgb(atmo, 0.5);
        ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    if (REDUCED) {
        requestAnimationFrame(frame);
    } else {
        const tick = (now) => { frame(now); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
    }
})();
