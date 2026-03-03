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

        // Note: password floors block progress in the tabletop rules,
        // but here the DM controls pacing by choosing when to reveal
        // the next floor. No code-level blocking needed.

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

    // ---- Get next move options from current position ----
    // Returns array of { branch, floor, label } the player can move to
    function getNextMoves() {
        if (!arch || jackedOut) return [];

        const moves = [];
        const curBranch = arch.branches[playerPos.branch];
        const nextFloor = playerPos.floor + 1;

        // Can move deeper in current branch?
        if (nextFloor < curBranch.floors.length) {
            const label = curBranch.isMain
                ? 'Floor ' + (nextFloor + 1)
                : curBranch.name + ' Floor ' + (nextFloor + 1);
            moves.push({
                branch: playerPos.branch,
                floor: nextFloor,
                label: label
            });
        }

        // Are we on the main branch at a fork point?
        if (playerPos.branch === 0) {
            arch.branches.forEach((b, bIdx) => {
                if (bIdx === 0) return; // skip main
                // Branch forks after this floor index
                if (b.forkAfterFloor === playerPos.floor + 1) {
                    moves.push({
                        branch: bIdx,
                        floor: 0,
                        label: b.name + ' Floor 1'
                    });
                }
            });
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
