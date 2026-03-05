// sfx.js — Web Audio API synthesized cyberpunk sound effects

const SFX = (() => {
    let ctx = null;
    let enabled = true;
    let masterVolume = 0.15; // low default

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function gain(val) {
        const ac = getCtx();
        const g = ac.createGain();
        g.gain.value = val * masterVolume;
        g.connect(ac.destination);
        return g;
    }

    // ---- Sound: Generate — descending digital sweep with noise burst ----
    function generate() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        // Descending sweep
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
        const g1 = gain(0.5);
        g1.gain.setValueAtTime(0.5 * masterVolume, now);
        g1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(g1);
        osc.start(now);
        osc.stop(now + 0.3);

        // Short noise burst
        const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const noise = ac.createBufferSource();
        noise.buffer = buf;
        const g2 = gain(0.3);
        g2.gain.setValueAtTime(0.3 * masterVolume, now);
        g2.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        // Bandpass filter for digital texture
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 3000;
        bp.Q.value = 2;
        noise.connect(bp);
        bp.connect(g2);
        noise.start(now);
        noise.stop(now + 0.08);
    }

    // ---- Sound: Reveal — short data-burst chirp ----
    function reveal() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        // Rising chirp
        const osc = ac.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        const g1 = gain(0.25);
        g1.gain.setValueAtTime(0.25 * masterVolume, now);
        g1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(g1);
        osc.start(now);
        osc.stop(now + 0.18);

        // Tiny noise tail
        const buf = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
        const noise = ac.createBufferSource();
        noise.buffer = buf;
        const hp = ac.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 4000;
        noise.connect(hp);
        hp.connect(gain(0.2));
        noise.start(now + 0.04);
        noise.stop(now + 0.08);
    }

    // ---- Sound: Player move — low digital pulse ----
    function move() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
        const g1 = gain(0.4);
        g1.gain.setValueAtTime(0.4 * masterVolume, now);
        g1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(g1);
        osc.start(now);
        osc.stop(now + 0.15);

        // Second harmonic tick
        const osc2 = ac.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.exponentialRampToValueAtTime(300, now + 0.06);
        const g2 = gain(0.15);
        g2.gain.setValueAtTime(0.15 * masterVolume, now);
        g2.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc2.connect(g2);
        osc2.start(now);
        osc2.stop(now + 0.08);
    }

    // ---- Sound: Jack out — harsh static crunch ----
    function jackout() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        // Harsh noise
        const buf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
        const noise = ac.createBufferSource();
        noise.buffer = buf;
        const g1 = gain(0.5);
        g1.gain.setValueAtTime(0.5 * masterVolume, now);
        g1.gain.setValueAtTime(0.6 * masterVolume, now + 0.05);
        g1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        // Lowpass sweep down for "crunch"
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(8000, now);
        lp.frequency.exponentialRampToValueAtTime(200, now + 0.25);
        lp.Q.value = 3;
        noise.connect(lp);
        lp.connect(g1);
        noise.start(now);
        noise.stop(now + 0.3);

        // Sub-bass thud
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
        const g2 = gain(0.4);
        g2.gain.setValueAtTime(0.4 * masterVolume, now);
        g2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(g2);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    // ---- Sound: UI click — tiny tick ----
    function click() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        const osc = ac.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);
        const g1 = gain(0.15);
        g1.gain.setValueAtTime(0.15 * masterVolume, now);
        g1.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.connect(g1);
        osc.start(now);
        osc.stop(now + 0.04);
    }

    // ---- Sound: Error / blocked — short buzz ----
    function error() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        const g1 = gain(0.3);
        g1.gain.setValueAtTime(0.3 * masterVolume, now);
        g1.gain.setValueAtTime(0.3 * masterVolume, now + 0.08);
        g1.gain.setValueAtTime(0.01, now + 0.09);
        g1.gain.setValueAtTime(0.3 * masterVolume, now + 0.12);
        g1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(g1);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    // ---- Sound: Host session start — ascending connection tone ----
    function connect() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        // Three ascending tones
        [400, 600, 900].forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const g1 = gain(0.25);
            g1.gain.setValueAtTime(0.25 * masterVolume, now + i * 0.08);
            g1.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.1);
            osc.connect(g1);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.1);
        });
    }

    // ---- Sound: Copy / share — quick positive blip ----
    function copy() {
        if (!enabled) return;
        const ac = getCtx();
        const now = ac.currentTime;

        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1200, now + 0.05);
        const g1 = gain(0.2);
        g1.gain.setValueAtTime(0.2 * masterVolume, now);
        g1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(g1);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    // ---- Toggle & state ----
    function toggle() {
        enabled = !enabled;
        // Persist preference
        try { localStorage.setItem('autodeck-sfx', enabled ? '1' : '0'); } catch (e) {}
        return enabled;
    }

    function isEnabled() {
        return enabled;
    }

    // Restore from localStorage
    function init() {
        try {
            const stored = localStorage.getItem('autodeck-sfx');
            if (stored === '0') enabled = false;
        } catch (e) {}
    }

    init();

    return {
        generate, reveal, move, jackout, click, error, connect, copy,
        toggle, isEnabled
    };
})();
