// exporter.js — Export architecture diagram as PNG image

const Exporter = (() => {

    async function toPNG(seed) {
        const container = document.getElementById('arch-container');
        if (!container) return;

        // Hide UI overlays inside the scroll area
        const compactBtn = document.getElementById('compact-toggle');
        const exportBtn = document.getElementById('export-btn');
        if (compactBtn) compactBtn.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';

        // Close detail panel if open
        const detailPanel = document.getElementById('detail-panel');
        const wasOpen = detailPanel && detailPanel.classList.contains('open');
        if (wasOpen) detailPanel.classList.remove('open');

        // Remove selection highlight
        const selected = container.querySelector('.floor-card.selected');
        if (selected) selected.classList.remove('selected');

        // Disable animations so html2canvas captures final state
        container.style.setProperty('--export-mode', '1');
        container.querySelectorAll('.floor-card').forEach(c => {
            c.style.animation = 'none';
            c.style.opacity = '1';
            c.style.transform = 'none';
        });
        // Also force SVG connector lines visible
        container.querySelectorAll('.conn-line, .conn-fork').forEach(c => {
            c.style.animation = 'none';
            c.style.opacity = '1';
        });

        try {
            const canvas = await html2canvas(container, {
                backgroundColor: '#000000',
                scale: 2,
                useCORS: true,
                logging: false
            });

            // Post-process: add scanline overlay + watermark
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;

            // Scanlines — subtle horizontal bands
            ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
            for (let y = 0; y < h; y += 8) {
                ctx.fillRect(0, y, w, 4);
            }

            // Watermark — bottom-right corner
            ctx.font = `bold ${Math.round(12 * 2)}px 'Courier New', monospace`;
            ctx.fillStyle = 'rgba(220, 20, 60, 0.25)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('AUTODECK', w - 20, h - 14);

            // Download
            canvas.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `autodeck-${seed ? seed.toString(36) : 'export'}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png');

        } catch (e) {
            console.error('[Exporter] PNG export failed:', e);
        }

        // Restore animations and UI
        container.querySelectorAll('.floor-card').forEach(c => {
            c.style.animation = '';
            c.style.opacity = '';
            c.style.transform = '';
        });
        container.querySelectorAll('.conn-line, .conn-fork').forEach(c => {
            c.style.animation = '';
            c.style.opacity = '';
        });
        if (compactBtn) compactBtn.style.display = '';
        if (exportBtn) exportBtn.style.display = '';
        if (wasOpen) detailPanel.classList.add('open');
    }

    return { toPNG };
})();
