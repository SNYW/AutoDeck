// game-state.js — Local game state management, bridge between Firebase and UI

const GameState = (() => {
    let mode = 'solo';       // 'solo' | 'host' | 'player'
    let arch = null;         // current architecture data
    let revealed = {};       // { "branchIdx-floorIdx": true }
    let playerPos = { branch: 0, floor: 0 };
    let playerConnected = false;
    let jackedOut = false;
    let updateCallbacks = [];
    let logCallbacks = [];

    // ---- Initialize ----
    function init(newMode, archData) {
        mode = newMode;
        arch = archData;
        revealed = {};
        playerPos = { branch: 0, floor: 0 };
        playerConnected = false;
        jackedOut = false;
    }

    // ---- Floor key helpers ----
    function floorKey(branchIdx, floorIdx) {
        return branchIdx + '-' + floorIdx;
    }

    // ---- Reveal a floor (host action) ----
    async function revealFloor(branchIdx, floorIdx) {
        if (mode !== 'host') return;
        const key = floorKey(branchIdx, floorIdx);

        // Update locally for immediate feedback
        revealed[key] = true;

        // Push to Firebase
        await Session.revealFloor(branchIdx, floorIdx);

        // Log the reveal
        const branch = arch.branches[branchIdx];
        const label = branch.isMain
            ? 'Floor ' + (floorIdx + 1)
            : branch.name + ' Floor ' + (floorIdx + 1);
        await Session.pushLog('DM revealed ' + label);
    }

    // ---- Edit a floor's content (host action) ----
    async function editFloor(branchIdx, floorIdx, newContent) {
        if (mode !== 'host') return;

        // Update local arch
        arch.branches[branchIdx].floors[floorIdx].content = newContent;

        // Push to Firebase
        await Session.pushFloorContent(branchIdx, floorIdx, newContent);

        // Log the edit
        const branch = arch.branches[branchIdx];
        const label = branch.isMain
            ? 'Floor ' + (floorIdx + 1)
            : branch.name + ' Floor ' + (floorIdx + 1);
        await Session.pushLog('DM edited ' + label);
    }

    // ---- Check if floor is revealed ----
    function isRevealed(branchIdx, floorIdx) {
        return !!revealed[floorKey(branchIdx, floorIdx)];
    }

    // ---- Get player position ----
    function getPlayerPos() {
        return { ...playerPos };
    }

    // ---- Move player (player action) ----
    // Returns { success, reason } — caller handles UI feedback
    async function movePlayer(targetBranch, targetFloor) {
        if (mode !== 'player') return { success: false, reason: 'Not in player mode' };
        if (jackedOut) return { success: false, reason: 'Already jacked out' };

        const key = floorKey(targetBranch, targetFloor);

        // Check target floor exists
        const branch = arch.branches[targetBranch];
        if (!branch || targetFloor >= branch.floors.length) {
            return { success: false, reason: 'No floor there' };
        }

        // Check target is revealed
        if (!revealed[key]) {
            return { success: false, reason: 'Floor not yet revealed by DM' };
        }

        // Validate target is a legal adjacent move (safety guard)
        const legalMoves = getNextMoves();
        const isLegal = legalMoves.some(m =>
            m.branch === targetBranch && m.floor === targetFloor
        );
        if (!isLegal) {
            console.warn('[GameState] Rejected illegal move from',
                playerPos, 'to', { branch: targetBranch, floor: targetFloor },
                'Legal moves:', legalMoves);
            return { success: false, reason: 'Not adjacent' };
        }

        // Update position
        playerPos = { branch: targetBranch, floor: targetFloor };

        // Push to Firebase
        await Session.pushState({ playerPos });

        // Log the move
        const label = branch.isMain
            ? 'Floor ' + (targetFloor + 1)
            : branch.name + ' Floor ' + (targetFloor + 1);
        await Session.pushLog('Runner moved to ' + label);

        return { success: true };
    }

    // ---- Compute the visual row for a given position ----
    // Main branch floors start at row 0. Side branch floors start
    // at row forkAfterFloor. This MUST match renderer.js computeLayout.
    function getRow(branchIdx, floorIdx) {
        const branch = arch.branches[branchIdx];
        const startRow = branch.forkAfterFloor || 0;
        return startRow + floorIdx;
    }

    // ---- Get adjacent move options from current position ----
    // Returns array of { branch, floor, label } the player can move to.
    // Movement is bidirectional: up, down, and across branch junctions.
    // Cross-branch moves are validated by matching visual rows.
    function getNextMoves() {
        if (!arch || jackedOut) return [];

        const moves = [];
        const curBranch = arch.branches[playerPos.branch];
        const curRow = getRow(playerPos.branch, playerPos.floor);

        // ---- Move DOWN (deeper) in current branch ----
        const nextFloor = playerPos.floor + 1;
        if (nextFloor < curBranch.floors.length) {
            const label = curBranch.isMain
                ? 'Floor ' + (nextFloor + 1)
                : curBranch.name + ' Floor ' + (nextFloor + 1);
            moves.push({ branch: playerPos.branch, floor: nextFloor, label });
        }

        // ---- Move UP (shallower) in current branch ----
        const prevFloor = playerPos.floor - 1;
        if (prevFloor >= 0) {
            const label = curBranch.isMain
                ? 'Floor ' + (prevFloor + 1)
                : curBranch.name + ' Floor ' + (prevFloor + 1);
            moves.push({ branch: playerPos.branch, floor: prevFloor, label });
        }

        // ---- Cross-branch movement (horizontal only — same row) ----
        if (playerPos.branch === 0) {
            // On main branch: can enter any side branch whose fork
            // connects at this exact row. The fork line joins
            // main floor at row forkAfterFloor to the branch's floor 0.
            arch.branches.forEach((b, bIdx) => {
                if (bIdx === 0) return;
                const forkRow = b.forkAfterFloor;
                // Player must be at the exact main floor where the fork connects
                if (forkRow === playerPos.floor) {
                    // Double-check: branch floor 0 must be at the same visual row
                    const targetRow = getRow(bIdx, 0);
                    if (targetRow === curRow) {
                        moves.push({
                            branch: bIdx,
                            floor: 0,
                            label: b.name + ' Floor 1'
                        });
                    }
                }
            });
        } else {
            // On a side branch floor 0: can move back to the main
            // branch at the fork point — only if same visual row.
            if (playerPos.floor === 0 && curBranch.forkAfterFloor != null) {
                const mainFloorIdx = curBranch.forkAfterFloor;
                const targetRow = getRow(0, mainFloorIdx);
                if (targetRow === curRow) {
                    const label = 'Main Floor ' + (mainFloorIdx + 1);
                    moves.push({ branch: 0, floor: mainFloorIdx, label });
                }
            }
        }

        return moves;
    }

    // ---- Check if at bottom ----
    function isAtBottom() {
        if (!arch) return false;
        const branch = arch.branches[playerPos.branch];
        const isBottomBranch = arch.bottomBranchId === playerPos.branch;
        const isLastFloor = playerPos.floor === branch.floors.length - 1;
        return isBottomBranch && isLastFloor;
    }

    // ---- Jack Out (player action) ----
    async function jackOut() {
        if (mode !== 'player') return;
        jackedOut = true;
        await Session.pushState({ jacked_out: true });
        await Session.pushLog('Runner JACKED OUT');
    }

    // ---- Handle incoming state from Firebase ----
    function applyRemoteState(state) {
        if (!state) return;
        revealed = state.revealed || {};
        playerPos = state.playerPos || { branch: 0, floor: 0 };
        playerConnected = !!state.playerConnected;
        jackedOut = !!state.jacked_out;

        // Notify UI
        for (const cb of updateCallbacks) {
            cb({
                revealed,
                playerPos: { ...playerPos },
                playerConnected,
                jackedOut,
                mode
            });
        }
    }

    // ---- Handle incoming log from Firebase ----
    function applyRemoteLog(logData) {
        // Convert Firebase push-key map to sorted array
        const entries = Object.entries(logData || {})
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (a.t || 0) - (b.t || 0));

        for (const cb of logCallbacks) {
            cb(entries);
        }
    }

    // ---- Register callbacks ----
    function onUpdate(callback) {
        updateCallbacks.push(callback);
    }

    function onLogUpdate(callback) {
        logCallbacks.push(callback);
    }

    // ---- Clear callbacks ----
    function clearCallbacks() {
        updateCallbacks = [];
        logCallbacks = [];
    }

    // ---- Getters ----
    function getMode()    { return mode; }
    function getArch()    { return arch; }
    function isJackedOut(){ return jackedOut; }
    function isPlayerConnected() { return playerConnected; }

    return {
        init, revealFloor, editFloor, isRevealed,
        getPlayerPos, movePlayer, getNextMoves, isAtBottom,
        jackOut,
        applyRemoteState, applyRemoteLog,
        onUpdate, onLogUpdate, clearCallbacks,
        getMode, getArch, isJackedOut, isPlayerConnected
    };
})();
