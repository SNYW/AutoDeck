// session.js — Firebase session lifecycle (create, join, destroy, listeners)

const Session = (() => {
    // Unambiguous charset (no 0/O/1/I/l)
    const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const CODE_LEN = 6;

    let currentCode = null;
    let currentRole = null;   // 'host' | 'player' | null
    let listeners = [];       // active Firebase listeners for cleanup
    let disconnectRefs = [];  // onDisconnect refs for cleanup

    function generateCode() {
        let code = '';
        for (let i = 0; i < CODE_LEN; i++) {
            code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
        }
        return code;
    }

    function sessionRef(code) {
        const db = FirebaseConfig.getDb();
        if (!db) return null;
        return db.ref('sessions/' + code);
    }

    // ---- Create a session (Host) ----
    // Returns a Promise that resolves with the session code
    async function create(archData) {
        if (!FirebaseConfig.isReady()) {
            throw new Error('Firebase not configured');
        }

        // Generate unique code (check for collisions)
        let code, ref;
        for (let attempt = 0; attempt < 10; attempt++) {
            code = generateCode();
            ref = sessionRef(code);
            const snap = await ref.once('value');
            if (!snap.exists()) break;
            if (attempt === 9) throw new Error('Could not generate unique session code');
        }

        // Write initial session data
        const sessionData = {
            arch: archData,
            state: {
                revealed: {},
                playerPos: { branch: 0, floor: 0 },
                playerConnected: false,
                jacked_out: false
            },
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await ref.set(sessionData);

        // Auto-cleanup on host disconnect
        const discRef = ref.onDisconnect();
        discRef.remove();
        disconnectRefs.push(discRef);

        currentCode = code;
        currentRole = 'host';

        console.log('[Session] Created:', code);
        return code;
    }

    // ---- Join a session (Player) ----
    // Returns a Promise that resolves with the architecture data
    async function join(code) {
        if (!FirebaseConfig.isReady()) {
            throw new Error('Firebase not configured');
        }

        code = code.toUpperCase().trim();
        const ref = sessionRef(code);
        if (!ref) throw new Error('Firebase not ready');

        const snap = await ref.once('value');
        if (!snap.exists()) {
            throw new Error('Session not found: ' + code);
        }

        const data = snap.val();

        // Mark player as connected
        await ref.child('state/playerConnected').set(true);

        // Auto-cleanup on player disconnect
        const discRef = ref.child('state/playerConnected').onDisconnect();
        discRef.set(false);
        disconnectRefs.push(discRef);

        currentCode = code;
        currentRole = 'player';

        console.log('[Session] Joined:', code);
        return data.arch;
    }

    // ---- Destroy session (Host) ----
    async function destroy() {
        if (!currentCode) return;

        const ref = sessionRef(currentCode);
        if (ref) {
            // Cancel onDisconnect handlers before manual remove
            for (const d of disconnectRefs) {
                try { d.cancel(); } catch (e) {}
            }
            await ref.remove();
        }

        cleanup();
        console.log('[Session] Destroyed');
    }

    // ---- Leave session (Player) ----
    async function leave() {
        if (!currentCode) return;

        const ref = sessionRef(currentCode);
        if (ref) {
            await ref.child('state/playerConnected').set(false);
        }

        // Cancel onDisconnect handlers
        for (const d of disconnectRefs) {
            try { d.cancel(); } catch (e) {}
        }

        cleanup();
        console.log('[Session] Left');
    }

    // ---- Listen to state changes ----
    function onStateChange(callback) {
        if (!currentCode) return;
        const ref = sessionRef(currentCode);
        if (!ref) return;

        const stateRef = ref.child('state');
        const handler = stateRef.on('value', snap => {
            if (snap.exists()) callback(snap.val());
        });
        listeners.push({ ref: stateRef, event: 'value', handler });
    }

    // ---- Listen to log changes ----
    function onLogChange(callback) {
        if (!currentCode) return;
        const ref = sessionRef(currentCode);
        if (!ref) return;

        const logRef = ref.child('log');
        const handler = logRef.on('value', snap => {
            callback(snap.val() || {});
        });
        listeners.push({ ref: logRef, event: 'value', handler });
    }

    // ---- Listen for session removal (player detects host disconnect) ----
    function onSessionRemoved(callback) {
        if (!currentCode) return;
        const ref = sessionRef(currentCode);
        if (!ref) return;

        const handler = ref.on('value', snap => {
            if (!snap.exists()) callback();
        });
        listeners.push({ ref, event: 'value', handler });
    }

    // ---- Update state fields ----
    async function pushState(partial) {
        if (!currentCode) return;
        const ref = sessionRef(currentCode);
        if (!ref) return;
        await ref.child('state').update(partial);
    }

    // ---- Reveal a floor ----
    async function revealFloor(branchIdx, floorIdx) {
        if (!currentCode) return;
        const key = branchIdx + '-' + floorIdx;
        const ref = sessionRef(currentCode);
        if (!ref) return;
        await ref.child('state/revealed/' + key).set(true);
    }

    // ---- Update a floor's content (host editing) ----
    async function pushFloorContent(branchIdx, floorIdx, content) {
        if (!currentCode) return;
        const ref = sessionRef(currentCode);
        if (!ref) return;
        await ref.child('arch/branches/' + branchIdx + '/floors/' + floorIdx + '/content').set(content);
    }

    // ---- Listen to architecture changes ----
    function onArchChange(callback) {
        if (!currentCode) return;
        const ref = sessionRef(currentCode);
        if (!ref) return;

        const archRef = ref.child('arch');
        const handler = archRef.on('value', snap => {
            if (snap.exists()) callback(snap.val());
        });
        listeners.push({ ref: archRef, event: 'value', handler });
    }

    // ---- Push a log message ----
    async function pushLog(msg) {
        if (!currentCode) return;
        const ref = sessionRef(currentCode);
        if (!ref) return;
        await ref.child('log').push({
            t: firebase.database.ServerValue.TIMESTAMP,
            msg: msg
        });
    }

    // ---- Cleanup all listeners ----
    function cleanup() {
        for (const l of listeners) {
            l.ref.off(l.event, l.handler);
        }
        listeners = [];
        disconnectRefs = [];
        currentCode = null;
        currentRole = null;
    }

    // ---- Getters ----
    function getCode()  { return currentCode; }
    function getRole()  { return currentRole; }
    function isActive() { return currentCode != null; }

    return {
        create, join, destroy, leave,
        onStateChange, onLogChange, onSessionRemoved,
        pushState, revealFloor, pushFloorContent, pushLog,
        onArchChange,
        getCode, getRole, isActive
    };
})();
