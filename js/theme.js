// ============================================
//   AGE OPS — THEME ENGINE v2 — 12 TEMAS
// ============================================

const THEME_KEY     = 'ageops_theme';
const DEFAULT_THEME = 'theme-red-black';

// ============================================
// THEME DEFINITIONS
// ============================================
const THEMES = [
    {
        id:    'theme-red-black',
        name:  'BLOOD RED',
        desc:  'Vermelho + Laranja + Preto',
        colors: { bg: '#060000', primary: '#ff1a1a', secondary: '#ff6600', accent: '#aa0000' }
    },
    {
        id:    'theme-mono',
        name:  'MONO STEEL',
        desc:  'Branco + Cinza + Vermelho',
        colors: { bg: '#080808', primary: '#ffffff', secondary: '#ff2244', accent: '#555555' }
    },
    {
        id:    'theme-blue-dark',
        name:  'DEEP OCEAN',
        desc:  'Azul Claro + Preto',
        colors: { bg: '#000810', primary: '#00aaff', secondary: '#0055aa', accent: '#00ddff' }
    },
    {
        id:    'theme-green',
        name:  'MATRIX',
        desc:  'Verde Neon + Preto',
        colors: { bg: '#000a04', primary: '#00ff88', secondary: '#009944', accent: '#aaff00' }
    },
    {
        id:    'theme-purple',
        name:  'NEON PURPLE',
        desc:  'Roxo + Rosa + Preto',
        colors: { bg: '#06000e', primary: '#cc44ff', secondary: '#ff44cc', accent: '#7700bb' }
    },
    {
        id:    'theme-gold',
        name:  'SOLAR GOLD',
        desc:  'Dourado + Âmbar + Preto',
        colors: { bg: '#080600', primary: '#ffcc00', secondary: '#ff9900', accent: '#cc7700' }
    },
    {
        id:    'theme-cyan',
        name:  'CYBER CYAN',
        desc:  'Ciano + Azul + Preto',
        colors: { bg: '#030812', primary: '#00f5ff', secondary: '#0080ff', accent: '#ffe600' }
    },
    {
        id:    'theme-lime',
        name:  'TOXIC LIME',
        desc:  'Verde Lima + Amarelo + Preto',
        colors: { bg: '#040600', primary: '#aaff00', secondary: '#66dd00', accent: '#ffee00' }
    },
    {
        id:    'theme-inferno',
        name:  'INFERNO',
        desc:  'Laranja + Vermelho + Preto',
        colors: { bg: '#080200', primary: '#ff6600', secondary: '#ff2200', accent: '#ffaa00' }
    },
    {
        id:    'theme-arctic',
        name:  'ARCTIC',
        desc:  'Azul Gelo + Branco Frio',
        colors: { bg: '#020810', primary: '#aaddff', secondary: '#336699', accent: '#ddeeff' }
    },
    {
        id:    'theme-rose',
        name:  'ROSE GOLD',
        desc:  'Rosa + Dourado + Preto',
        colors: { bg: '#080206', primary: '#ff6688', secondary: '#ffaa55', accent: '#cc2255' }
    },
    {
        id:    'theme-void',
        name:  'VOID',
        desc:  'Índigo + Roxo Escuro',
        colors: { bg: '#030008', primary: '#8855ff', secondary: '#5533cc', accent: '#aa77ff' }
    }
];

// ============================================
// BUILD THEME CARDS
// ============================================
function buildThemeCards(currentTheme) {
    const grid = document.getElementById('themesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    THEMES.forEach(t => {
        const isActive = t.id === currentTheme;
        const c = t.colors;

        const card = document.createElement('div');
        card.className = `theme-card ${isActive ? 'active' : ''}`;
        card.dataset.theme = t.id;

        card.innerHTML = `
            <div class="theme-preview" style="background:${c.bg};">
                <div class="preview-bar-wrap" style="background:rgba(255,255,255,0.06);">
                    <div class="preview-bar-fill long"  style="background:${c.primary};box-shadow:0 0 4px ${c.primary};"></div>
                </div>
                <div class="preview-bar-wrap" style="background:rgba(255,255,255,0.04);">
                    <div class="preview-bar-fill mid"   style="background:${c.secondary};"></div>
                </div>
                <div class="preview-bar-wrap" style="background:rgba(255,255,255,0.04);">
                    <div class="preview-bar-fill short" style="background:${c.accent};"></div>
                </div>
                <div class="preview-dots">
                    <span class="preview-dot" style="background:${c.primary};box-shadow:0 0 5px ${c.primary};"></span>
                    <span class="preview-dot" style="background:${c.secondary};box-shadow:0 0 4px ${c.secondary};"></span>
                    <span class="preview-dot" style="background:${c.accent};box-shadow:0 0 4px ${c.accent};"></span>
                </div>
            </div>
            <div class="theme-card-label" style="background:${c.bg};">
                <span class="theme-card-name" style="color:${c.primary};">${t.name}</span>
                <span class="theme-card-desc" style="color:${c.primary};">${t.desc}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            applyTheme(t.id);
            localStorage.setItem(THEME_KEY, t.id);
            closePanel();
        });

        grid.appendChild(card);
    });
}

// ============================================
// APPLY THEME
// ============================================
function applyTheme(themeId) {
    document.documentElement.setAttribute('data-theme', themeId);
    buildThemeCards(themeId);
    if (typeof reinitParticles === 'function') reinitParticles();
}

// ============================================
// PANEL OPEN / CLOSE
// ============================================
function openPanel() {
    const overlay = document.getElementById('themePanelOverlay');
    if (overlay) overlay.classList.add('open');
}

function closePanel() {
    const overlay = document.getElementById('themePanelOverlay');
    if (overlay) overlay.classList.remove('open');
}

// ============================================
// INIT
// ============================================
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    applyTheme(saved);

    // Trigger button
    const trigger = document.getElementById('themeTrigger');
    if (trigger) trigger.addEventListener('click', openPanel);

    // Close button
    const closeBtn = document.getElementById('themePanelClose');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // Close on overlay click (outside panel)
    const overlay = document.getElementById('themePanelOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePanel();
        });
    }

    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });
}

document.addEventListener('DOMContentLoaded', initTheme);
