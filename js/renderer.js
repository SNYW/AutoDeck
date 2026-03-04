// renderer.js — Visual rendering of NET Architecture diagrams

const Renderer = (() => {
    // Layout constants
    const CARD_W = 280;
    const CARD_H = 68;
    const ROW_GAP = 28;
    const COL_GAP = 64;
    const ROW_H = CARD_H + ROW_GAP;
    const PAD = 24;

    let selectedCard = null;
    let cardMap = {};         // "branchIdx-floorIdx" → DOM element
    let currentMode = 'solo'; // 'solo' | 'host' | 'player'
    let currentArch = null;

    // ---- Label helpers ----
    function floorLabel(content) {
        switch (content.type) {
            case 'file':         return `File DV${content.dv}`;
            case 'password':     return `Password DV${content.dv}`;
            case 'control_node': return `Control Node DV${content.dv}`;
            case 'black_ice':
                return content.entries
                    .map(e => e.count > 1 ? `${e.name} \u00d7${e.count}` : e.name)
                    .join(', ');
            case 'empty':        return 'Empty';
        }
    }

    function floorSubLabel(content) {
        if (content.type === 'file')         return 'Data File';
        if (content.type === 'password')     return 'Password Gate';
        if (content.type === 'control_node') return 'Control Node';
        if (content.type === 'empty')        return 'No Content';
        if (content.type === 'black_ice') {
            const cats = new Set(content.entries.map(e => TABLES.ICE_CATEGORY[e.name]));
            if (cats.has('anti_personnel') && cats.has('anti_program')) return 'Mixed Black ICE';
            if (cats.has('anti_program')) return 'Anti-Program ICE';
            return 'Anti-Personnel ICE';
        }
    }

    function typeClass(content) {
        if (content.type === 'file')         return 'type-file';
        if (content.type === 'password')     return 'type-password';
        if (content.type === 'control_node') return 'type-control';
        if (content.type === 'empty')        return 'type-empty';
        if (content.type === 'black_ice') {
            const cats = new Set(content.entries.map(e => TABLES.ICE_CATEGORY[e.name]));
            if (cats.has('anti_program') && !cats.has('anti_personnel')) return 'type-ice-prog';
            return 'type-ice-ap';
        }
    }

    function typeIcon(content) {
        if (content.type === 'file')         return '\u2b26'; // ⬦
        if (content.type === 'password')     return '\u26bf'; // ⚿
        if (content.type === 'control_node') return '\u2b23'; // ⬣
        if (content.type === 'empty')        return '\u25c7'; // ◇
        if (content.type === 'black_ice') {
            const cats = new Set(content.entries.map(e => TABLES.ICE_CATEGORY[e.name]));
            if (cats.has('anti_program')) return '\u2620'; // ☠
            return '\u26a0'; // ⚠
        }
    }

    // ---- Compute card positions ----
    function computeLayout(arch) {
        const cards = [];
        arch.branches.forEach((branch, bIdx) => {
            const startRow = branch.forkAfterFloor || 0;
            branch.floors.forEach((floor, fIdx) => {
                const row = startRow + fIdx;
                cards.push({
                    branchIdx: bIdx,
                    floorIdx: fIdx,
                    row,
                    x: PAD + bIdx * (CARD_W + COL_GAP),
                    y: PAD + row * ROW_H,
                    floor,
                    branch
                });
            });
        });
        return cards;
    }

    // ---- SVG connection lines ----
    // Each SVG element gets data-conn-from / data-conn-to attributes
    // so updateFloorStates can hide connectors to unrevealed floors.
    function buildSVG(arch, cards, width, height) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';

        function line(x1, y1, x2, y2, cls, fromKey, toKey) {
            const el = document.createElementNS(ns, 'line');
            el.setAttribute('x1', x1); el.setAttribute('y1', y1);
            el.setAttribute('x2', x2); el.setAttribute('y2', y2);
            el.setAttribute('class', cls || 'conn-line');
            if (fromKey) el.setAttribute('data-conn-from', fromKey);
            if (toKey)   el.setAttribute('data-conn-to', toKey);
            svg.appendChild(el);
        }

        function path(d, cls, fromKey, toKey) {
            const el = document.createElementNS(ns, 'path');
            el.setAttribute('d', d);
            el.setAttribute('fill', 'none');
            el.setAttribute('class', cls || 'conn-line');
            if (fromKey) el.setAttribute('data-conn-from', fromKey);
            if (toKey)   el.setAttribute('data-conn-to', toKey);
            svg.appendChild(el);
        }

        // Vertical connectors within each branch
        arch.branches.forEach((branch, bIdx) => {
            const branchCards = cards.filter(c => c.branchIdx === bIdx);
            for (let i = 0; i < branchCards.length - 1; i++) {
                const a = branchCards[i], b = branchCards[i + 1];
                const cx = a.x + CARD_W / 2;
                const fromKey = a.branchIdx + '-' + a.floorIdx;
                const toKey = b.branchIdx + '-' + b.floorIdx;
                line(cx, a.y + CARD_H, cx, b.y, 'conn-line', fromKey, toKey);
            }
        });

        // Fork connectors — group by fork floor, draw bus-style
        const forksByFloor = {};
        arch.branches.forEach(branch => {
            if (branch.forkAfterFloor == null) return;
            const key = branch.forkAfterFloor;
            if (!forksByFloor[key]) forksByFloor[key] = [];
            forksByFloor[key].push(branch);
        });

        Object.entries(forksByFloor).forEach(([floorKey, branches]) => {
            const forkRow = parseInt(floorKey);
            const mainCard = cards.find(c => c.branchIdx === 0 && c.row === forkRow);
            if (!mainCard) return;

            const sorted = branches.sort((a, b) => a.id - b.id);
            const branchCards = sorted.map(b =>
                cards.find(c => c.branchIdx === b.id && c.floorIdx === 0)
            ).filter(Boolean);
            if (branchCards.length === 0) return;

            const y = mainCard.y + CARD_H / 2;
            const xStart = mainCard.x + CARD_W;
            const xEnd = branchCards[branchCards.length - 1].x;
            const mainKey = mainCard.branchIdx + '-' + mainCard.floorIdx;

            // Horizontal bus from main card to last branch
            const lastBranchKey = branchCards[branchCards.length - 1].branchIdx + '-0';
            path(`M ${xStart},${y} L ${xEnd},${y}`, 'conn-fork', mainKey, lastBranchKey);

            // Vertical drop to each branch's first card
            branchCards.forEach(bc => {
                const by = bc.y + CARD_H / 2;
                const bcKey = bc.branchIdx + '-0';
                if (Math.abs(by - y) > 1) {
                    path(`M ${bc.x},${y} L ${bc.x},${by}`, 'conn-fork', mainKey, bcKey);
                }
            });
        });

        return svg;
    }

    // ---- Build a floor card DOM element ----
    function createCard(cardData, arch) {
        const { floor, branch, floorIdx, branchIdx } = cardData;
        const content = floor.content;
        const isBottom =
            arch.bottomBranchId === branchIdx &&
            floorIdx === branch.floors.length - 1;

        const el = document.createElement('div');
        el.className = `floor-card ${typeClass(content)}${currentMode === 'player' ? ' floor-hidden' : ''}`;
        if (isBottom) el.classList.add('is-bottom');
        if (floor.isLobby) el.classList.add('is-lobby');

        // Store identity for card map
        el.dataset.branch = branchIdx;
        el.dataset.floor = floorIdx;

        el.style.position = 'absolute';
        el.style.left = cardData.x + 'px';
        el.style.top = cardData.y + 'px';
        el.style.width = CARD_W + 'px';
        el.style.height = CARD_H + 'px';
        el.style.animationDelay = (cardData.row * 0.06) + 's';

        const numLabel = branch.isMain
            ? String(floorIdx + 1).padStart(2, '0')
            : branch.name.split(' ')[1] + (floorIdx + 1);

        el.innerHTML = `
            <span class="card-num">${numLabel}</span>
            <span class="card-icon">${typeIcon(content)}</span>
            <div class="card-text">
                <span class="card-label">${floorLabel(content)}</span>
                <span class="card-sub">${floorSubLabel(content)}</span>
            </div>
            ${isBottom ? '<span class="card-bottom" title="Bottom — Virus deployment point">BOTTOM</span>' : ''}
            ${floor.isLobby ? '<span class="card-lobby" title="Lobby Floor">L</span>' : ''}
            <span class="card-mystery">? ? ?</span>
            <span class="card-revealed-badge"><span class="badge-icon">👁</span> VISIBLE</span>
        `;

        el.addEventListener('click', () => {
            if (currentMode === 'host') {
                // Host: click unrevealed floors to reveal AND show detail
                if (el.classList.contains('floor-hidden')) {
                    GameState.revealFloor(branchIdx, floorIdx);
                }
                // Show detail panel (with edit controls)
                if (selectedCard) selectedCard.classList.remove('selected');
                selectedCard = el;
                el.classList.add('selected');
                showDetail(floor, branch, floorIdx, isBottom, branchIdx);
                return;
            }

            if (currentMode === 'player') {
                // Player: click only shows detail on revealed floors
                if (el.classList.contains('floor-hidden')) return;
                if (selectedCard) selectedCard.classList.remove('selected');
                selectedCard = el;
                el.classList.add('selected');
                showDetail(floor, branch, floorIdx, isBottom, branchIdx);
                return;
            }

            // Solo mode — click shows detail
            if (selectedCard) selectedCard.classList.remove('selected');
            selectedCard = el;
            el.classList.add('selected');
            showDetail(floor, branch, floorIdx, isBottom, branchIdx);
        });

        return el;
    }

    // ---- Trigger cyberpunk reveal animation on an element ----
    function triggerReveal(el, className) {
        el.classList.add(className);
        el.addEventListener('animationend', function handler() {
            el.classList.remove(className);
            el.removeEventListener('animationend', handler);
        }, { once: true });
    }

    // ---- Update floor visibility & player position from Firebase state ----
    function updateFloorStates(revealedMap, playerPos) {
        if (!currentArch) return;

        // Update hidden/revealed state for each card
        Object.keys(cardMap).forEach(key => {
            const el = cardMap[key];
            if (!el) return;

            if (currentMode === 'player') {
                // Player: floors are hidden unless in revealedMap
                if (revealedMap && revealedMap[key]) {
                    const isNewReveal = el.classList.contains('floor-hidden');
                    el.classList.remove('floor-hidden');
                    if (isNewReveal) triggerReveal(el, 'floor-revealing');
                } else {
                    el.classList.add('floor-hidden');
                }
            } else if (currentMode === 'host') {
                // Host: DM mode CSS makes all floors visible anyway,
                // but we still remove floor-hidden on revealed floors so
                // the click handler can distinguish revealed vs unrevealed.
                // Also toggle floor-revealed for the eye badge indicator.
                if (revealedMap && revealedMap[key]) {
                    const isNewReveal = el.classList.contains('floor-hidden');
                    el.classList.remove('floor-hidden');
                    el.classList.add('floor-revealed');
                    if (isNewReveal) triggerReveal(el, 'floor-revealing');
                } else {
                    el.classList.remove('floor-revealed');
                }
            }
            // Solo: not affected by this function
        });

        // Update SVG connector visibility for player mode
        if (currentMode === 'player') {
            const container = document.getElementById('arch-container');
            const svgEls = container.querySelectorAll('[data-conn-from]');
            svgEls.forEach(el => {
                const from = el.getAttribute('data-conn-from');
                const to = el.getAttribute('data-conn-to');
                const bothRevealed = revealedMap &&
                    revealedMap[from] && revealedMap[to];
                if (bothRevealed) {
                    const isNewReveal = el.classList.contains('conn-hidden');
                    el.classList.remove('conn-hidden');
                    if (isNewReveal) triggerReveal(el, 'conn-revealing');
                } else {
                    el.classList.add('conn-hidden');
                }
            });
        }

        // Update player position marker
        Object.keys(cardMap).forEach(key => {
            cardMap[key].classList.remove('player-here');
        });
        if (playerPos) {
            const posKey = playerPos.branch + '-' + playerPos.floor;
            const posEl = cardMap[posKey];
            if (posEl) {
                posEl.classList.add('player-here');
                // Auto-scroll to player position
                if (currentMode === 'player') {
                    posEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    // ---- Inline interface recommendation label ----
    function renderSummary(arch) {
        const diff = TABLES.DIFFICULTIES[arch.difficulty];
        const el = document.getElementById('interface-rec');
        if (el) el.textContent = `Min. Interface ${diff.interfaceRec}+`;
    }

    // ---- Edit section builder (host mode) ----
    function buildEditSection(content, branchIdx, floorIdx, branch, isBottom) {
        const iceNames = Object.keys(TABLES.ICE_STATS);

        const section = document.createElement('div');
        section.className = 'det-edit';

        const title = document.createElement('div');
        title.className = 'det-edit-title';
        title.textContent = 'EDIT FLOOR';
        section.appendChild(title);

        // Type selector
        const typeRow = document.createElement('div');
        typeRow.className = 'det-edit-row';
        const typeLabel = document.createElement('label');
        typeLabel.className = 'det-edit-label';
        typeLabel.textContent = 'Type';
        const typeSelect = document.createElement('select');
        typeSelect.className = 'det-select';
        [
            { value: 'password', text: 'Password' },
            { value: 'file', text: 'File' },
            { value: 'control_node', text: 'Control Node' },
            { value: 'black_ice', text: 'Black ICE' },
            { value: 'empty', text: 'Empty' }
        ].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.text;
            if (content.type === opt.value) o.selected = true;
            typeSelect.appendChild(o);
        });
        typeRow.appendChild(typeLabel);
        typeRow.appendChild(typeSelect);
        section.appendChild(typeRow);

        // Dynamic sub-section
        const subSection = document.createElement('div');
        subSection.className = 'det-edit-sub';
        section.appendChild(subSection);

        function addIceEntry(container, name, count) {
            const row = document.createElement('div');
            row.className = 'det-ice-entry';

            const nameSelect = document.createElement('select');
            nameSelect.className = 'det-select det-ice-name-select';
            iceNames.forEach(iceName => {
                const o = document.createElement('option');
                o.value = iceName;
                o.textContent = iceName;
                if (iceName === name) o.selected = true;
                nameSelect.appendChild(o);
            });

            const times = document.createElement('span');
            times.className = 'det-ice-times';
            times.textContent = '\u00d7';

            const countSelect = document.createElement('select');
            countSelect.className = 'det-select det-ice-count-select';
            [1, 2, 3].forEach(c => {
                const o = document.createElement('option');
                o.value = c;
                o.textContent = c;
                if (c === count) o.selected = true;
                countSelect.appendChild(o);
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'det-remove-ice-btn';
            removeBtn.textContent = '\u2715';
            removeBtn.title = 'Remove this ICE';
            removeBtn.addEventListener('click', () => {
                row.remove();
                if (container.children.length === 0) {
                    addIceEntry(container, iceNames[0], 1);
                }
            });

            row.appendChild(nameSelect);
            row.appendChild(times);
            row.appendChild(countSelect);
            row.appendChild(removeBtn);
            container.appendChild(row);
        }

        function buildSubSection(type) {
            subSection.innerHTML = '';

            if (type === 'empty') {
                // No sub-options for empty floors
                return;
            }

            if (type === 'password' || type === 'file' || type === 'control_node') {
                const dvRow = document.createElement('div');
                dvRow.className = 'det-edit-row';
                const dvLabel = document.createElement('label');
                dvLabel.className = 'det-edit-label';
                dvLabel.textContent = 'DV';
                const dvSelect = document.createElement('select');
                dvSelect.className = 'det-select edit-dv-select';
                [6, 8, 10, 12].forEach(dv => {
                    const o = document.createElement('option');
                    o.value = dv;
                    o.textContent = dv;
                    if (content.type === type && content.dv === dv) o.selected = true;
                    dvSelect.appendChild(o);
                });
                dvRow.appendChild(dvLabel);
                dvRow.appendChild(dvSelect);
                subSection.appendChild(dvRow);
            } else if (type === 'black_ice') {
                const iceList = document.createElement('div');
                iceList.className = 'det-ice-list';

                const entries = (content.type === 'black_ice')
                    ? content.entries
                    : [{ name: iceNames[0], count: 1 }];
                entries.forEach(entry => addIceEntry(iceList, entry.name, entry.count));

                subSection.appendChild(iceList);

                const addBtn = document.createElement('button');
                addBtn.className = 'det-add-ice-btn';
                addBtn.textContent = '+ ADD ICE';
                addBtn.addEventListener('click', () => addIceEntry(iceList, iceNames[0], 1));
                subSection.appendChild(addBtn);
            }
        }

        typeSelect.addEventListener('change', () => buildSubSection(typeSelect.value));
        buildSubSection(content.type);

        // APPLY button
        const applyBtn = document.createElement('button');
        applyBtn.className = 'det-apply-btn';
        applyBtn.textContent = 'APPLY';
        applyBtn.addEventListener('click', async () => {
            const type = typeSelect.value;
            let newContent;

            if (type === 'empty') {
                newContent = { type: 'empty' };
            } else if (type === 'black_ice') {
                const entries = [];
                subSection.querySelectorAll('.det-ice-entry').forEach(row => {
                    const name = row.querySelector('.det-ice-name-select').value;
                    const count = parseInt(row.querySelector('.det-ice-count-select').value);
                    entries.push({ name, count });
                });
                newContent = { type: 'black_ice', entries };
            } else {
                const dv = parseInt(subSection.querySelector('.edit-dv-select').value);
                newContent = { type, dv };
            }

            applyBtn.textContent = 'APPLYING...';
            applyBtn.disabled = true;

            try {
                if (currentMode === 'host') {
                    // Multiplayer: push to Firebase via GameState
                    await GameState.editFloor(branchIdx, floorIdx, newContent);
                } else {
                    // Solo/DM mode: update local arch directly
                    currentArch.branches[branchIdx].floors[floorIdx].content = newContent;
                }
                // Update the card in the diagram immediately
                updateCardContent(branchIdx, floorIdx);
                // Refresh this detail panel with updated data
                const updatedFloor = currentArch.branches[branchIdx].floors[floorIdx];
                showDetail(updatedFloor, branch, floorIdx, isBottom, branchIdx);
            } catch (e) {
                console.error('[Renderer] Edit failed:', e);
                applyBtn.textContent = 'ERROR';
                setTimeout(() => {
                    applyBtn.textContent = 'APPLY';
                    applyBtn.disabled = false;
                }, 1500);
            }
        });
        section.appendChild(applyBtn);

        return section;
    }

    // ---- Detail panel ----
    function showDetail(floor, branch, floorIdx, isBottom, branchIdx) {
        const panel = document.getElementById('detail-panel');
        const body = document.getElementById('detail-body');
        panel.classList.add('open');

        const content = floor.content;
        let html = '';

        const numLabel = branch.isMain
            ? `Floor ${floorIdx + 1}`
            : `${branch.name}, Floor ${floorIdx + 1}`;

        html += `<div class="det-header ${typeClass(content)}">
            <span class="det-icon">${typeIcon(content)}</span>
            <div>
                <div class="det-title">${floorLabel(content)}</div>
                <div class="det-sub">${numLabel}${floor.isLobby ? ' (Lobby)' : ''}</div>
            </div>
        </div>`;

        if (content.type === 'password') {
            html += `<div class="det-section">
                <div class="det-row"><span>Backdoor Check</span><span>Interface + 1d10 &#8805; ${content.dv}</span></div>
                <p class="det-note">Blocks progression until Backdoored or password is known.</p>
            </div>`;
        } else if (content.type === 'file') {
            html += `<div class="det-section">
                <div class="det-row"><span>Eye-Dee Check</span><span>Interface + 1d10 &#8805; ${content.dv}</span></div>
                <p class="det-note">Identify with Eye-Dee. Save a copy to Cyberdeck (free action). Use Cloak to hide your traces.</p>
                <label class="det-label">File Contents (GM Notes)</label>
                <textarea class="det-textarea" placeholder="Describe what data this file contains..."></textarea>
            </div>`;
        } else if (content.type === 'control_node') {
            html += `<div class="det-section">
                <div class="det-row"><span>Control Check</span><span>Interface + 1d10 &#8805; ${content.dv}</span></div>
                <p class="det-note">Once controlled, operating each device costs 1 NET Action. Each node activates once per Turn.</p>
                <label class="det-label">Connected Systems (GM Notes)</label>
                <textarea class="det-textarea" placeholder="e.g., Security cameras, turret, elevator lock..."></textarea>
            </div>`;
        } else if (content.type === 'empty') {
            html += `<div class="det-section">
                <p class="det-note">This floor is empty — no ICE, no files, no passwords. Just dead architecture.</p>
            </div>`;
        } else if (content.type === 'black_ice') {
            content.entries.forEach(entry => {
                const stats = TABLES.ICE_STATS[entry.name];
                const cat = TABLES.ICE_CATEGORY[entry.name];
                const catLabel = cat === 'anti_program' ? 'Anti-Program' : 'Anti-Personnel';

                html += `<div class="det-section">
                    <div class="det-ice-name">${entry.name}${entry.count > 1 ? ` \u00d7${entry.count}` : ''}</div>
                    <div class="det-ice-cat">${catLabel} Black ICE</div>
                    <div class="det-stats">
                        <div class="det-stat"><span>PER</span><span>${stats.per}</span></div>
                        <div class="det-stat"><span>SPD</span><span>${stats.spd}</span></div>
                        <div class="det-stat"><span>ATK</span><span>${stats.atk}</span></div>
                        <div class="det-stat"><span>DEF</span><span>${stats.def}</span></div>
                        <div class="det-stat"><span>REZ</span><span>${stats.rez}</span></div>
                    </div>
                    <div class="det-effect"><strong>Effect:</strong> ${stats.effect}</div>
                    <div class="det-cost">Cost: ${stats.cost}</div>
                </div>`;
            });
        }

        if (isBottom) {
            html += `<div class="det-bottom-note">This is the <strong>bottom</strong> of the Architecture. A Netrunner can deploy a Virus here using the Virus Interface Ability.</div>`;
        }

        body.innerHTML = html;

        // Show edit section in host or solo mode (never for players)
        if (currentMode !== 'player' && branchIdx !== undefined) {
            body.appendChild(buildEditSection(content, branchIdx, floorIdx, branch, isBottom));
        }
    }

    function hideDetail() {
        document.getElementById('detail-panel').classList.remove('open');
        if (selectedCard) {
            selectedCard.classList.remove('selected');
            selectedCard = null;
        }
    }

    // ---- Update a single card's content (after DM edit) ----
    function updateCardContent(branchIdx, floorIdx) {
        const key = branchIdx + '-' + floorIdx;
        const oldCard = cardMap[key];
        if (!oldCard || !currentArch) return;

        // Preserve state classes from old card
        const wasHidden = oldCard.classList.contains('floor-hidden');
        const wasRevealed = oldCard.classList.contains('floor-revealed');
        const wasPlayerHere = oldCard.classList.contains('player-here');

        // Build card data matching layout position
        const branch = currentArch.branches[branchIdx];
        const floor = branch.floors[floorIdx];
        const startRow = branch.forkAfterFloor || 0;
        const row = startRow + floorIdx;

        const cardData = {
            branchIdx,
            floorIdx,
            row,
            x: parseInt(oldCard.style.left),
            y: parseInt(oldCard.style.top),
            floor,
            branch
        };

        // Create new card (starts with floor-hidden by default)
        const newCard = createCard(cardData, currentArch);

        // Restore state: remove floor-hidden if old card wasn't hidden
        if (!wasHidden) newCard.classList.remove('floor-hidden');
        if (wasRevealed) newCard.classList.add('floor-revealed');
        if (wasPlayerHere) newCard.classList.add('player-here');

        // Swap in DOM
        oldCard.replaceWith(newCard);
        cardMap[key] = newCard;
    }

    // ---- Set current mode ----
    function setMode(mode) {
        currentMode = mode;
    }

    // ---- Get card map ----
    function getCardMap() {
        return cardMap;
    }

    // ---- Main render ----
    function render(arch, mode) {
        const container = document.getElementById('arch-container');
        container.innerHTML = '';

        currentArch = arch;
        currentMode = mode || currentMode || 'solo';
        cardMap = {};

        const cards = computeLayout(arch);

        // Compute container size
        const maxX = Math.max(...cards.map(c => c.x)) + CARD_W + PAD;
        const maxY = Math.max(...cards.map(c => c.y)) + CARD_H + PAD;

        container.style.width = maxX + 'px';
        container.style.height = maxY + 'px';
        container.style.position = 'relative';

        // SVG connections
        container.appendChild(buildSVG(arch, cards, maxX, maxY));

        // Floor cards
        cards.forEach(cd => {
            const cardEl = createCard(cd, arch);
            container.appendChild(cardEl);

            // Register in card map
            const key = cd.branchIdx + '-' + cd.floorIdx;
            cardMap[key] = cardEl;
        });

        // Summary
        renderSummary(arch);

        // Hide detail
        hideDetail();
    }

    return { render, hideDetail, updateFloorStates, updateCardContent, setMode, getCardMap };
})();
