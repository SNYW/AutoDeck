// main.js — Application initialization, event wiring, and multiplayer orchestration

(function () {
    let currentDifficulty = 'standard';
    let currentDisabled = new Set();
    let currentStructured = false;
    let appMode = 'solo';       // 'solo' | 'host' | 'player'
    let currentArch = null;     // current architecture data

    const diffSelect = document.getElementById('diff-select');
    const floorInput = document.getElementById('floor-override');
    const branchInput = document.getElementById('branch-override');
    const shareBtn = document.getElementById('share-btn');

    // ---- Sound toggle ----
    const sfxToggle = document.getElementById('sfx-toggle');
    function syncSfxToggle() {
        sfxToggle.classList.toggle('active', SFX.isEnabled());
        sfxToggle.classList.toggle('muted', !SFX.isEnabled());
    }
    sfxToggle.addEventListener('click', () => {
        SFX.toggle();
        syncSfxToggle();
        SFX.click(); // audible feedback if just enabled
    });
    syncSfxToggle();

    // ---- Filter key order (stable for bitmask URL encoding) ----
    const FILTER_KEYS = [
        'Asp', 'Giant', 'Hellhound', 'Kraken', 'Liche', 'Raven', 'Scorpion', 'Skunk', 'Wisp',
        'Dragon', 'Killer', 'Sabertooth',
        'password', 'file', 'control_node', 'empty'
    ];

    const GROUP_MAP = {
        ap:      ['Asp', 'Giant', 'Hellhound', 'Kraken', 'Liche', 'Raven', 'Scorpion', 'Skunk', 'Wisp'],
        prog:    ['Dragon', 'Killer', 'Sabertooth'],
        content: ['password', 'file', 'control_node', 'empty']
    };

    // ---- Filter bitmask encode/decode ----
    function encodeFilters(disabledSet) {
        if (!disabledSet || disabledSet.size === 0) return null;
        let mask = 0;
        for (let i = 0; i < FILTER_KEYS.length; i++) {
            if (!disabledSet.has(FILTER_KEYS[i])) {
                mask |= (1 << i);
            }
        }
        if (mask === (1 << FILTER_KEYS.length) - 1) return null; // all enabled
        return mask.toString(36);
    }

    function decodeFilters(paramValue) {
        if (paramValue == null) return null;
        const mask = parseInt(paramValue, 36);
        if (isNaN(mask)) return null;
        const disabled = new Set();
        for (let i = 0; i < FILTER_KEYS.length; i++) {
            if (!(mask & (1 << i))) {
                disabled.add(FILTER_KEYS[i]);
            }
        }
        return disabled.size > 0 ? disabled : null;
    }

    // ---- URL param helpers ----
    function readURL() {
        const p = new URLSearchParams(window.location.search);
        return {
            difficulty: p.get('d'),
            seed: p.get('s') != null ? parseInt(p.get('s'), 36) : null,
            floors: p.get('f') != null ? parseInt(p.get('f'), 10) : null,
            branches: p.get('b') != null ? parseInt(p.get('b'), 10) : null,
            disabled: decodeFilters(p.get('x')),
            structured: p.get('t') === '1',
            join: p.get('join')
        };
    }

    function writeURL(arch, floorOverride, branchOverride) {
        const p = new URLSearchParams();
        p.set('d', arch.difficulty);
        p.set('s', arch.seed.toString(36));
        if (floorOverride != null) p.set('f', floorOverride.toString());
        if (branchOverride != null) p.set('b', branchOverride.toString());
        const filterParam = encodeFilters(
            arch.disabledKeys && arch.disabledKeys.length > 0
                ? new Set(arch.disabledKeys) : null
        );
        if (filterParam != null) p.set('x', filterParam);
        if (arch.structured) p.set('t', '1');
        const url = window.location.pathname + '?' + p.toString();
        window.history.replaceState(null, '', url);
    }

    // ---- Generate & render ----
    function doGenerate(opts) {
        opts = opts || {};
        opts.disabled = currentDisabled.size > 0 ? currentDisabled : null;
        opts.structured = currentStructured;
        const arch = Generator.generate(currentDifficulty, opts);
        currentArch = arch;
        Renderer.render(arch, appMode);

        const floorOverride = (opts.floorOverride != null) ? opts.floorOverride : null;
        const branchOverride = (opts.branchOverride != null) ? opts.branchOverride : null;
        writeURL(arch, floorOverride, branchOverride);
        shareBtn.classList.remove('hidden');
    }

    // ---- Interface recommendation display ----
    function updateInterfaceRec() {
        const diff = TABLES.DIFFICULTIES[currentDifficulty];
        const el = document.getElementById('interface-rec');
        if (el && diff) el.textContent = `Min. Interface ${diff.interfaceRec}+`;
    }

    // ---- Difficulty dropdown ----
    diffSelect.addEventListener('change', () => {
        if (appMode === 'host') return; // locked during session
        currentDifficulty = diffSelect.value;
        updateInterfaceRec();
    });

    // ---- Generate button ----
    document.getElementById('generate-btn').addEventListener('click', () => {
        if (appMode === 'host') return; // locked during session
        const rawFloors = floorInput.value.trim();
        const floorOverride = rawFloors !== '' ? parseInt(rawFloors, 10) : null;
        const rawBranches = branchInput.value.trim();
        const branchOverride = rawBranches !== '' ? parseInt(rawBranches, 10) : null;
        SFX.connect();
        doGenerate({ floorOverride, branchOverride });
    });

    // ---- Share button ----
    shareBtn.addEventListener('click', () => {
        SFX.copy();
        navigator.clipboard.writeText(window.location.href).then(() => {
            shareBtn.textContent = 'COPIED';
            shareBtn.classList.add('copied');
            setTimeout(() => {
                shareBtn.textContent = 'SHARE';
                shareBtn.classList.remove('copied');
            }, 1500);
        });
    });

    // ---- Structured mode toggle ----
    const structToggle = document.getElementById('struct-toggle');
    structToggle.addEventListener('click', () => {
        currentStructured = !currentStructured;
        structToggle.classList.toggle('active', currentStructured);
        SFX.click();
    });

    // ---- Basic Options panel ----
    const basicToggle = document.getElementById('basic-toggle');
    const basicPanel = document.getElementById('basic-panel');
    basicToggle.addEventListener('click', () => {
        basicPanel.classList.toggle('collapsed');
        basicToggle.classList.toggle('open');
    });

    // ---- Advanced Options panel ----
    const advToggle = document.getElementById('adv-toggle');
    const advPanel = document.getElementById('adv-panel');
    const filterCheckboxes = document.querySelectorAll('#adv-panel input[data-filter]');

    advToggle.addEventListener('click', () => {
        advPanel.classList.toggle('collapsed');
        advToggle.classList.toggle('open');
    });

    // Individual checkbox events
    filterCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                currentDisabled.delete(cb.dataset.filter);
            } else {
                currentDisabled.add(cb.dataset.filter);
            }
            updateGroupToggleLabels();
        });
    });

    // Group ALL/NONE toggle buttons
    document.querySelectorAll('.adv-group-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const keys = GROUP_MAP[btn.dataset.group];
            const allEnabled = keys.every(k => !currentDisabled.has(k));
            keys.forEach(k => {
                if (allEnabled) currentDisabled.add(k);
                else currentDisabled.delete(k);
            });
            syncCheckboxes();
            updateGroupToggleLabels();
        });
    });

    function syncCheckboxes() {
        filterCheckboxes.forEach(cb => {
            cb.checked = !currentDisabled.has(cb.dataset.filter);
        });
    }

    function updateGroupToggleLabels() {
        document.querySelectorAll('.adv-group-toggle').forEach(btn => {
            const keys = GROUP_MAP[btn.dataset.group];
            const allEnabled = keys.every(k => !currentDisabled.has(k));
            btn.textContent = allEnabled ? 'NONE' : 'ALL';
        });
    }

    // ---- Compact card toggle ----
    const compactToggle = document.getElementById('compact-toggle');
    function syncCompactToggle() {
        compactToggle.classList.toggle('active', Renderer.isCompact());
        compactToggle.textContent = Renderer.isCompact() ? 'DETAILED' : 'COMPACT';
    }
    compactToggle.addEventListener('click', () => {
        Renderer.toggleCompact();
        syncCompactToggle();
        SFX.click();
        try { localStorage.setItem('autodeck-compact', Renderer.isCompact() ? '1' : '0'); } catch(e) {}
    });

    // ---- Close detail panel ----
    document.getElementById('detail-close').addEventListener('click', () => {
        Renderer.hideDetail();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Renderer.hideDetail();
            // Also close branch modal
            document.getElementById('branch-modal').classList.add('hidden');
        }
    });

    // ============================================================
    //  MULTIPLAYER — Session bar wiring
    // ============================================================

    const hostBtn = document.getElementById('host-btn');
    const sessionHostInfo = document.getElementById('session-host-info');
    const sessionPlayerInfo = document.getElementById('session-player-info');
    const sessionCodeEl = document.getElementById('session-code');
    const sessionStatusEl = document.getElementById('session-status');
    const sessionEndBtn = document.getElementById('session-end-btn');
    const sessionPlayerCode = document.getElementById('session-player-code');
    const sessionLeaveBtn = document.getElementById('session-leave-btn');
    const sessionBar = document.getElementById('session-bar');

    // ---- Mode switching ----
    function setMode(mode) {
        document.body.classList.remove('mode-solo', 'mode-host', 'mode-player');
        appMode = mode;
        document.body.classList.add('mode-' + mode);
        Renderer.setMode(mode);

        const playerBar = document.getElementById('player-bar');
        const actionLog = document.getElementById('action-log');

        if (mode === 'solo') {
            sessionBar.classList.add('hidden');
            sessionHostInfo.classList.add('hidden');
            sessionPlayerInfo.classList.add('hidden');
            playerBar.classList.add('hidden');
            actionLog.classList.add('hidden');
            hostBtn.style.display = '';
            document.getElementById('generate-btn').disabled = false;
        } else if (mode === 'host') {
            sessionBar.classList.remove('hidden');
            sessionHostInfo.classList.remove('hidden');
            sessionPlayerInfo.classList.add('hidden');
            playerBar.classList.add('hidden');
            actionLog.classList.remove('hidden');
            hostBtn.style.display = 'none';
            document.getElementById('generate-btn').disabled = true;
        } else if (mode === 'player') {
            sessionBar.classList.remove('hidden');
            sessionHostInfo.classList.add('hidden');
            sessionPlayerInfo.classList.remove('hidden');
            playerBar.classList.remove('hidden');
            actionLog.classList.remove('hidden');
            hostBtn.style.display = 'none';
        }
    }

    const sessionCopyLinkBtn = document.getElementById('session-copy-link');
    const sessionLinkText = document.getElementById('session-link-text');
    let currentJoinURL = '';

    // ---- Build join URL for a session code ----
    function buildJoinURL(code) {
        return window.location.origin + window.location.pathname + '?join=' + code;
    }

    // ---- HOST button ----
    hostBtn.addEventListener('click', async () => {
        if (!FirebaseConfig.isReady()) {
            alert('Firebase not configured. Please update js/firebase-config.js with your Firebase project settings.');
            return;
        }

        // Use the current architecture already on screen
        if (!currentArch) {
            alert('Generate an architecture first, then press HOST.');
            return;
        }
        const arch = currentArch;

        try {
            const code = await Session.create(arch);
            sessionCodeEl.textContent = code;
            SFX.connect();
            setMode('host');

            // Build and display join link
            currentJoinURL = buildJoinURL(code);
            sessionLinkText.textContent = currentJoinURL;

            // Auto-copy to clipboard
            navigator.clipboard.writeText(currentJoinURL).then(() => {
                sessionCopyLinkBtn.textContent = 'COPIED';
                sessionCopyLinkBtn.classList.add('copied');
                setTimeout(() => {
                    sessionCopyLinkBtn.textContent = 'COPY LINK';
                    sessionCopyLinkBtn.classList.remove('copied');
                }, 2000);
            }).catch(() => {});

            // Re-render in host mode (preserves the same architecture)
            Renderer.render(arch, 'host');

            // Listen for state changes (player position, etc.)
            GameState.init('host', arch);
            Session.onStateChange(state => {
                GameState.applyRemoteState(state);
                // Update connection status
                if (state.playerConnected) {
                    sessionStatusEl.classList.add('connected');
                    sessionStatusEl.querySelector('.status-text').textContent = 'Player connected';
                } else {
                    sessionStatusEl.classList.remove('connected');
                    sessionStatusEl.querySelector('.status-text').textContent = 'Waiting for player...';
                }
            });
            Session.onLogChange(log => {
                GameState.applyRemoteLog(log);
            });

            // Listen for architecture edits (from this host — echoed back)
            Session.onArchChange(archData => {
                if (!currentArch || !archData) return;
                // Check each floor for content changes
                archData.branches.forEach((branch, bIdx) => {
                    branch.floors.forEach((floor, fIdx) => {
                        const oldFloor = currentArch.branches[bIdx] && currentArch.branches[bIdx].floors[fIdx];
                        if (!oldFloor) return;
                        if (JSON.stringify(oldFloor.content) !== JSON.stringify(floor.content)) {
                            currentArch.branches[bIdx].floors[fIdx].content = floor.content;
                            Renderer.updateCardContent(bIdx, fIdx);
                        }
                    });
                });
            });

            // Register UI update callback
            GameState.onUpdate(state => {
                Renderer.updateFloorStates(state.revealed, state.playerPos);
            });
            GameState.onLogUpdate(entries => {
                renderActionLog(entries);
            });

            await Session.pushLog('Session created');

        } catch (e) {
            alert('Failed to create session: ' + e.message);
            console.error(e);
        }
    });

    // ---- COPY LINK button (host) ----
    sessionCopyLinkBtn.addEventListener('click', () => {
        if (!currentJoinURL) return;
        SFX.copy();
        navigator.clipboard.writeText(currentJoinURL).then(() => {
            sessionCopyLinkBtn.textContent = 'COPIED';
            sessionCopyLinkBtn.classList.add('copied');
            setTimeout(() => {
                sessionCopyLinkBtn.textContent = 'COPY LINK';
                sessionCopyLinkBtn.classList.remove('copied');
            }, 2000);
        });
    });

    // ---- Auto-join via URL (?join=CODE) ----
    async function doJoin(code) {
        code = code.trim().toUpperCase();
        if (code.length < 4) return;

        try {
            const arch = await Session.join(code);
            currentArch = arch;
            sessionPlayerCode.textContent = code;
            SFX.connect();
            setMode('player');

            // Render for player — all floors start hidden
            Renderer.render(arch, 'player');

            // Initialize game state
            GameState.init('player', arch);

            // Listen for state changes
            Session.onStateChange(state => {
                GameState.applyRemoteState(state);
            });
            Session.onLogChange(log => {
                GameState.applyRemoteLog(log);
            });

            // Listen for architecture edits (DM edited a floor)
            Session.onArchChange(archData => {
                if (!currentArch || !archData) return;
                archData.branches.forEach((branch, bIdx) => {
                    branch.floors.forEach((floor, fIdx) => {
                        const oldFloor = currentArch.branches[bIdx] && currentArch.branches[bIdx].floors[fIdx];
                        if (!oldFloor) return;
                        if (JSON.stringify(oldFloor.content) !== JSON.stringify(floor.content)) {
                            currentArch.branches[bIdx].floors[fIdx].content = floor.content;
                            Renderer.updateCardContent(bIdx, fIdx);
                        }
                    });
                });
            });

            // Register UI callbacks
            GameState.onUpdate(state => {
                Renderer.updateFloorStates(state.revealed, state.playerPos);
                updatePlayerBar(state);
            });
            GameState.onLogUpdate(entries => {
                renderActionLog(entries);
            });

            // Detect host disconnect
            Session.onSessionRemoved(() => {
                alert('Host ended the session.');
                endSession();
            });

            await Session.pushLog('Runner jacked in');

            // Clean join param from URL so refresh doesn't retry
            window.history.replaceState(null, '', window.location.pathname);

        } catch (e) {
            alert('Failed to join: ' + e.message);
            console.error(e);
            // Clean join param from URL so refresh doesn't retry
            window.history.replaceState(null, '', window.location.pathname);
        }
    }

    // ---- END session (host) ----
    sessionEndBtn.addEventListener('click', async () => {
        await Session.destroy();
        endSession();
    });

    // ---- LEAVE session (player) ----
    sessionLeaveBtn.addEventListener('click', async () => {
        await Session.leave();
        endSession();
    });

    function endSession() {
        GameState.clearCallbacks();
        setMode('solo');
        // Re-render in solo mode with current arch if available
        if (currentArch) {
            Renderer.render(currentArch, 'solo');
        }
        updateInterfaceRec();
    }

    // ============================================================
    //  PLAYER ACTION BAR
    // ============================================================

    const moveBtn = document.getElementById('move-btn');
    const jackoutBtn = document.getElementById('jackout-btn');
    const playerPosLabel = document.getElementById('player-pos-label');
    const branchModal = document.getElementById('branch-modal');
    const branchOptions = document.getElementById('branch-options');
    const branchCancelBtn = document.getElementById('branch-cancel-btn');

    // ---- Update player bar UI from state ----
    function updatePlayerBar(state) {
        if (appMode !== 'player') return;

        const pos = state.playerPos;
        const arch = currentArch;
        if (!arch || !pos) return;

        const branch = arch.branches[pos.branch];
        const label = branch.isMain
            ? 'Floor ' + (pos.floor + 1)
            : branch.name + ' Floor ' + (pos.floor + 1);

        playerPosLabel.textContent = label;

        // Check if jacked out
        if (state.jackedOut) {
            moveBtn.disabled = true;
            jackoutBtn.disabled = true;
            moveBtn.textContent = 'JACKED OUT';
            return;
        }

        // Check move availability — filter to only revealed adjacent floors
        const moves = GameState.getNextMoves();
        const available = moves.filter(m => GameState.isRevealed(m.branch, m.floor));

        if (available.length === 0) {
            moveBtn.disabled = true;
            moveBtn.textContent = 'WAITING...';
        } else {
            moveBtn.disabled = false;
            moveBtn.textContent = 'MOVE';
        }

        jackoutBtn.disabled = false;
    }

    // ---- MOVE button ----
    moveBtn.addEventListener('click', async () => {
        if (appMode !== 'player') return;

        const moves = GameState.getNextMoves();
        // Filter to only revealed floors
        const available = moves.filter(m => GameState.isRevealed(m.branch, m.floor));

        if (available.length === 0) return;

        if (available.length === 1) {
            // Single path — move directly
            const result = await GameState.movePlayer(available[0].branch, available[0].floor);
            if (result.success) {
                SFX.move();
            } else {
                SFX.error();
                flashMoveError(result.reason);
            }
        } else {
            // Multiple paths — show branch selection modal
            showBranchModal(available);
        }
    });

    // ---- Branch selection modal ----
    function showBranchModal(options) {
        branchOptions.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'branch-option-btn';
            btn.textContent = opt.label;
            btn.addEventListener('click', async () => {
                branchModal.classList.add('hidden');
                const result = await GameState.movePlayer(opt.branch, opt.floor);
                if (result.success) {
                    SFX.move();
                } else {
                    SFX.error();
                    flashMoveError(result.reason);
                }
            });
            branchOptions.appendChild(btn);
        });
        branchModal.classList.remove('hidden');
    }

    branchCancelBtn.addEventListener('click', () => {
        branchModal.classList.add('hidden');
    });

    function flashMoveError(reason) {
        const orig = moveBtn.textContent;
        moveBtn.textContent = reason || 'BLOCKED';
        moveBtn.disabled = true;
        setTimeout(() => {
            moveBtn.textContent = orig;
            moveBtn.disabled = false;
        }, 1500);
    }

    // ---- JACK OUT button ----
    jackoutBtn.addEventListener('click', async () => {
        if (appMode !== 'player') return;
        SFX.jackout();
        await GameState.jackOut();
    });

    // ============================================================
    //  ACTION LOG
    // ============================================================

    const logEntries = document.getElementById('log-entries');
    const logToggleBtn = document.getElementById('log-toggle-btn');
    const actionLogEl = document.getElementById('action-log');

    logToggleBtn.addEventListener('click', () => {
        actionLogEl.classList.toggle('collapsed');
        logToggleBtn.textContent = actionLogEl.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
    });

    function renderActionLog(entries) {
        logEntries.innerHTML = '';
        entries.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'log-entry';

            const time = entry.t ? new Date(entry.t) : null;
            const timeStr = time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

            // Classify message for styling (use log-* prefix to avoid
            // collisions with .player-action button styles)
            let msgClass = '';
            if (entry.msg.startsWith('DM')) msgClass = 'log-dm';
            else if (entry.msg.startsWith('Runner JACKED')) msgClass = 'log-jackout';
            else if (entry.msg.startsWith('Runner')) msgClass = 'log-player';

            div.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-msg ${msgClass}">${entry.msg}</span>`;
            logEntries.appendChild(div);
        });

        // Auto-scroll to bottom
        logEntries.scrollTop = logEntries.scrollHeight;
    }

    // ============================================================
    //  INITIAL LOAD
    // ============================================================

    const url = readURL();

    if (url.difficulty && TABLES.DIFFICULTIES[url.difficulty]) {
        currentDifficulty = url.difficulty;
        diffSelect.value = currentDifficulty;
    }
    if (url.floors != null) {
        floorInput.value = url.floors;
    }
    if (url.branches != null) {
        branchInput.value = url.branches;
    }
    if (url.structured) {
        currentStructured = true;
        structToggle.classList.add('active');
    }
    if (url.disabled) {
        currentDisabled = url.disabled;
        syncCheckboxes();
        updateGroupToggleLabels();
        // Auto-expand panel when filters are active from URL
        advPanel.classList.remove('collapsed');
        advToggle.classList.add('open');
    }

    // Restore compact mode preference
    try {
        if (localStorage.getItem('autodeck-compact') === '1') {
            Renderer.setCompact(true);
            syncCompactToggle();
        }
    } catch(e) {}

    updateInterfaceRec();
    doGenerate({
        seed: url.seed,
        floorOverride: url.floors,
        branchOverride: url.branches
    });

    // ---- Auto-join if ?join=CODE is in URL ----
    if (url.join) {
        // Small delay to ensure Firebase SDK is fully initialized
        setTimeout(() => {
            if (!FirebaseConfig.isReady()) {
                alert('Firebase not configured. Cannot auto-join session.');
                window.history.replaceState(null, '', window.location.pathname);
                return;
            }
            doJoin(url.join);
        }, 300);
    }
})();
