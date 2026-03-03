// firebase-config.js — Firebase Realtime Database initialization
// Uses compat SDK builds loaded via CDN (no bundler required)
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  SETUP INSTRUCTIONS                                            │
// │                                                                │
// │  1. Go to https://console.firebase.google.com                  │
// │  2. Create a new project (any name, e.g. "autodeck")           │
// │  3. In Project Settings → General, scroll to "Your apps"       │
// │  4. Click "Web" (</>) to register a web app                    │
// │  5. Copy the firebaseConfig values into the object below       │
// │  6. Go to Realtime Database → Create Database                  │
// │  7. Choose "Start in test mode" (open rules)                   │
// │  8. Copy the databaseURL into the config below                 │
// │                                                                │
// │  Security rules (Realtime Database → Rules):                   │
// │  {                                                             │
// │    "rules": {                                                  │
// │      ".read": true,                                            │
// │      ".write": true                                            │
// │    }                                                           │
// │  }                                                             │
// └─────────────────────────────────────────────────────────────────┘

const FirebaseConfig = (() => {
    const firebaseConfig = {
        apiKey: "AIzaSyAg8u3V5vtPJzek23caVfiPcJa_2h-TS98",
        authDomain: "autodeck-a206c.firebaseapp.com",
        databaseURL: "https://autodeck-a206c-default-rtdb.firebaseio.com",
        projectId: "autodeck-a206c",
        storageBucket: "autodeck-a206c.firebasestorage.app",
        messagingSenderId: "999936808769",
        appId: "1:999936808769:web:031e14ee8207a92aa173c0",
        measurementId: "G-77NHKW97N1"
    };

    let db = null;
    let ready = false;

    function init() {
        if (ready) return;
        try {
            if (typeof firebase === 'undefined') {
                console.warn('[AutoDeck] Firebase SDK not loaded — multiplayer disabled');
                return;
            }
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            ready = true;
            console.log('[AutoDeck] Firebase initialized');
        } catch (e) {
            console.warn('[AutoDeck] Firebase init failed:', e.message);
        }
    }

    function getDb() {
        if (!ready) init();
        return db;
    }

    function isReady() {
        return ready;
    }

    // Auto-init when script loads (if SDK is present)
    init();

    return { getDb, isReady };
})();
