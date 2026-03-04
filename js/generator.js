// generator.js — NET Architecture random generation (pp. 210-212)

const Generator = (() => {
    // ---- Seeded PRNG (mulberry32) ----
    function mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function newSeed() {
        return (Math.random() * 0xFFFFFFFF) >>> 0;
    }

    // Module-level RNG function — set per generate() call
    let rng = Math.random;

    function rollDie(sides) {
        return Math.floor(rng() * sides) + 1;
    }

    function rollDice(count, sides) {
        const rolls = [];
        for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
        return rolls;
    }

    function sumDice(rolls) {
        return rolls.reduce((a, b) => a + b, 0);
    }

    // Build a string key for duplicate detection (Programs & Passwords only)
    function floorKey(content) {
        if (content.type === 'password') return `password_${content.dv}`;
        if (content.type === 'black_ice') {
            return 'ice_' + content.entries
                .map(e => `${e.name}x${e.count}`)
                .sort()
                .join('+');
        }
        return null; // files & control nodes exempt
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Check whether a content object is blocked by the active filters
    function isDisabled(content, disabledSet) {
        if (!disabledSet || disabledSet.size === 0) return false;
        if (content.type === 'black_ice') {
            return content.entries.some(e => disabledSet.has(e.name));
        }
        return disabledSet.has(content.type);
    }

    // Roll a lobby floor (1d6), re-rolling filtered or duplicate results
    function rollLobby(usedKeys, disabledSet) {
        for (let attempt = 0; attempt < 20; attempt++) {
            const roll = rollDie(6);
            const content = deepClone(TABLES.LOBBY[roll - 1]);
            if (isDisabled(content, disabledSet)) continue;
            const key = floorKey(content);
            if (!key || !usedKeys.has(key)) {
                if (key) usedKeys.add(key);
                return { content, roll, table: 'lobby' };
            }
        }
        // exhausted retries — accept whatever comes up
        const roll = rollDie(6);
        return { content: deepClone(TABLES.LOBBY[roll - 1]), roll, table: 'lobby' };
    }

    // Roll a body floor (3d6), re-rolling filtered or duplicate results
    // ~15% chance to produce an empty architectural floor instead
    function rollBody(difficulty, usedKeys, disabledSet) {
        // Check for empty floor (~15% chance)
        if (rng() < 0.15 && !(disabledSet && disabledSet.has('empty'))) {
            return { content: { type: 'empty' }, roll: null, dice: null, table: 'empty' };
        }

        for (let attempt = 0; attempt < 20; attempt++) {
            const dice = rollDice(3, 6);
            const total = sumDice(dice);
            const content = deepClone(TABLES.BODY[total][difficulty]);
            if (isDisabled(content, disabledSet)) continue;
            const key = floorKey(content);
            if (!key || !usedKeys.has(key)) {
                if (key) usedKeys.add(key);
                return { content, roll: total, dice, table: 'body' };
            }
        }
        const dice = rollDice(3, 6);
        const total = sumDice(dice);
        return { content: deepClone(TABLES.BODY[total][difficulty]), roll: total, dice, table: 'body' };
    }

    // ---- Structural Intelligence — post-generation rearrangement ----
    // Swaps floor content to follow tactical NET security design:
    //   - Password/ICE gates at entry points
    //   - Files/Control Nodes pushed deeper (protected)
    //   - Branch entries guarded by ICE or Passwords
    //   - Bottom floor is ICE when possible

    function isValuable(content) {
        return content.type === 'file' || content.type === 'control_node';
    }

    function swapContent(floors, i, j) {
        const tmp = floors[i].content;
        floors[i].content = floors[j].content;
        floors[j].content = tmp;
        const tmpRoll = floors[i].roll;
        floors[i].roll = floors[j].roll;
        floors[j].roll = tmpRoll;
    }

    function structureArch(branches, bottomBranchId) {
        // --- Main branch body floors (index 2+) ---
        const main = branches[0];
        if (main.floors.length <= 2) return; // only lobby, nothing to rearrange

        const bodyStart = 2;
        const bodyEnd = main.floors.length;

        // Rule 1: Gate floor (floor index 2) — first password moves here
        const pwIdx = main.floors.slice(bodyStart).findIndex(f => f.content.type === 'password');
        if (pwIdx > 0) {
            swapContent(main.floors, bodyStart, bodyStart + pwIdx);
        } else if (pwIdx === -1) {
            // No password anywhere — move first ICE to gate
            const iceIdx = main.floors.slice(bodyStart).findIndex(f => f.content.type === 'black_ice');
            if (iceIdx > 0) swapContent(main.floors, bodyStart, bodyStart + iceIdx);
        }

        // Rule 2: Push valuables deeper — swap shallow valuables with deep ICE
        const bodyLen = bodyEnd - bodyStart;
        const mid = bodyStart + Math.floor(bodyLen / 2);
        for (let i = bodyStart + 1; i < mid; i++) {
            if (isValuable(main.floors[i].content)) {
                // Find ICE in bottom half to swap with
                for (let j = bodyEnd - 1; j >= mid; j--) {
                    if (main.floors[j].content.type === 'black_ice') {
                        swapContent(main.floors, i, j);
                        break;
                    }
                }
            }
        }

        // Rule 3: Fork guards — ensure floor before each fork has ICE
        branches.forEach(b => {
            if (b.forkAfterFloor == null) return;
            const guardIdx = b.forkAfterFloor; // main floor index at fork
            if (guardIdx < bodyStart || guardIdx >= bodyEnd) return;
            if (main.floors[guardIdx].content.type !== 'black_ice') {
                // Find nearest ICE to swap in
                for (let j = bodyEnd - 1; j >= bodyStart; j--) {
                    if (j === guardIdx) continue;
                    if (main.floors[j].content.type === 'black_ice') {
                        swapContent(main.floors, guardIdx, j);
                        break;
                    }
                }
            }
        });

        // Restore main floor indices
        main.floors.forEach((f, i) => { f.index = i; });

        // --- Side branches: entry guard ---
        for (let bIdx = 1; bIdx < branches.length; bIdx++) {
            const branch = branches[bIdx];
            if (branch.floors.length < 2) continue;

            const entry = branch.floors[0].content;
            if (isValuable(entry) || entry.type === 'empty') {
                const guardIdx = branch.floors.findIndex(f =>
                    f.content.type === 'black_ice' || f.content.type === 'password'
                );
                if (guardIdx > 0) swapContent(branch.floors, 0, guardIdx);
            }
            branch.floors.forEach((f, i) => { f.index = i; });
        }

        // --- Bottom floor: should be ICE ---
        const bottomBranch = branches[bottomBranchId];
        const lastIdx = bottomBranch.floors.length - 1;
        // Skip lobby floors on main branch
        const searchStart = bottomBranch.isMain ? 2 : 0;
        if (lastIdx > searchStart && bottomBranch.floors[lastIdx].content.type !== 'black_ice') {
            for (let i = lastIdx - 1; i >= searchStart; i--) {
                if (bottomBranch.floors[i].content.type === 'black_ice') {
                    swapContent(bottomBranch.floors, i, lastIdx);
                    break;
                }
            }
            bottomBranch.floors.forEach((f, i) => { f.index = i; });
        }
    }

    // ---- Main generation entry point ----
    // opts.floorOverride — fixed floor count (3–18), or null for random 3d6
    // opts.branchOverride — fixed branch count (0–15), or null for random 1d10
    // opts.structured — tactical floor placement (default false)
    // opts.seed — 32-bit seed for reproducible generation, or null for random
    // opts.disabled — Set of disabled filter keys, or null for no filtering
    function generate(difficulty, opts) {
        opts = opts || {};

        // Set up seeded RNG
        const seed = (opts.seed != null) ? (opts.seed >>> 0) : newSeed();
        rng = mulberry32(seed);

        const disabledSet = opts.disabled || null;

        // Step 1a: total floors (3d6 or override)
        let floorDice, totalFloors;
        if (opts.floorOverride != null) {
            totalFloors = Math.max(3, Math.min(18, opts.floorOverride));
            floorDice = null; // no dice when overridden
        } else {
            floorDice = rollDice(3, 6);
            totalFloors = sumDice(floorDice);
        }

        // Step 1b: determine branches (override or 1d10, 7+ = branch)
        let branchRolls = [];
        let numBranches = 0;

        if (opts.branchOverride != null) {
            // Override: use the requested count, clamped to what's possible
            const maxPossible = Math.max(0, totalFloors - 3);
            numBranches = Math.max(0, Math.min(opts.branchOverride, maxPossible));
            branchRolls = null; // no dice when overridden
        } else {
            let bRoll = rollDie(10);
            branchRolls.push(bRoll);
            while (bRoll >= 7) {
                numBranches++;
                bRoll = rollDie(10);
                branchRolls.push(bRoll);
            }

            // Enforce minimums: main needs >=3, each branch >=1
            while (numBranches > 0 && totalFloors < 3 + numBranches) {
                numBranches--;
            }
        }

        // Step 1c: distribute floors among main + branches
        let mainCount, branchCounts;
        if (numBranches === 0) {
            mainCount = totalFloors;
            branchCounts = [];
        } else {
            mainCount = 3;
            branchCounts = new Array(numBranches).fill(1);
            let remaining = totalFloors - mainCount - numBranches;
            while (remaining > 0) {
                const target = rollDie(numBranches + 1) - 1;
                if (target === 0) mainCount++;
                else branchCounts[target - 1]++;
                remaining--;
            }
        }

        // Step 1d: determine fork points (after floor 2, at most mainCount-1)
        const forkPoints = [];
        for (let i = 0; i < numBranches; i++) {
            const min = 2;
            const max = mainCount - 1;
            forkPoints.push(min + rollDie(Math.max(1, max - min + 1)) - 1);
        }
        forkPoints.sort((a, b) => a - b);

        // Step 2: populate floors
        const usedKeys = new Set();
        const branches = [];

        // -- main branch --
        const mainBranch = {
            id: 0, name: 'Main', isMain: true,
            forkFrom: null, forkAfterFloor: null,
            floors: []
        };
        for (let i = 0; i < mainCount; i++) {
            const { content, roll } = i < 2
                ? rollLobby(usedKeys, disabledSet)
                : rollBody(difficulty, usedKeys, disabledSet);
            mainBranch.floors.push({
                index: i,
                isLobby: i < 2,
                content,
                roll
            });
        }
        branches.push(mainBranch);

        // -- side branches --
        for (let i = 0; i < numBranches; i++) {
            const branch = {
                id: i + 1,
                name: 'Branch ' + String.fromCharCode(65 + i),
                isMain: false,
                forkFrom: 0,
                forkAfterFloor: forkPoints[i],
                floors: []
            };
            for (let j = 0; j < branchCounts[i]; j++) {
                const { content, roll } = rollBody(difficulty, usedKeys, disabledSet);
                branch.floors.push({ index: j, isLobby: false, content, roll });
            }
            branches.push(branch);
        }

        // Determine "bottom" — the branch whose last floor is deepest
        let bottomId = 0;
        let maxDepth = mainCount;
        for (let i = 0; i < numBranches; i++) {
            const depth = forkPoints[i] + branchCounts[i];
            if (depth > maxDepth) {
                maxDepth = depth;
                bottomId = i + 1;
            }
        }

        // Step 3: structural rearrangement (if enabled)
        const structured = !!opts.structured;
        if (structured) {
            structureArch(branches, bottomId);
        }

        return {
            difficulty,
            totalFloors,
            floorDice,
            branchRolls,
            numBranches,
            bottomBranchId: bottomId,
            maxDepth,
            branches,
            seed,
            structured,
            disabledKeys: disabledSet ? Array.from(disabledSet) : []
        };
    }

    return { generate };
})();
