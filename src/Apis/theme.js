// modified version of old v2 theming + vanta engine
import { VANTA } from "../vanta.js";

var DEFAULT_THEME = 'ef-dark-medium';

var THEMES = {
    'ef-dark-soft': {
        name: 'Dark Soft',
        swatches: ['#333c43', '#A7C080', '#83C092', '#E67E80', '#D3C6AA'],
        vantaColor: 0xA7C080, vantaBg: 0x333c43,
        vars: {
            '--bg': '#333c43', '--bg-deep': '#293136', '--bg-deeper': '#222a2f',
            '--border': '#4d5960', '--text': '#D3C6AA', '--text-dim': '#9DA9A0',
            '--text-muted': '#859289', '--accent': '#A7C080', '--green': '#83C092', '--red': '#E67E80',
            '--surface': 'rgba(41,49,54,0.3)', '--border-glass': 'rgba(167,192,128,0.35)',
            '--accent-hover': '#B5CC95', '--error': '#E67E80',
            '--tab-active-bg': '#434f55', '--text-on-active': '#D3C6AA'
        }
    },
    'ef-dark-medium': {
        name: 'Dark Med',
        swatches: ['#2d353b', '#A7C080', '#83C092', '#E67E80', '#D3C6AA'],
        vantaColor: 0xA7C080, vantaBg: 0x2d353b,
        vars: {
            '--bg': '#2d353b', '--bg-deep': '#232a2e', '--bg-deeper': '#1c2226',
            '--border': '#475258', '--text': '#D3C6AA', '--text-dim': '#9DA9A0',
            '--text-muted': '#859289', '--accent': '#A7C080', '--green': '#83C092', '--red': '#E67E80',
            '--surface': 'rgba(35,42,46,0.3)', '--border-glass': 'rgba(167,192,128,0.35)',
            '--accent-hover': '#B5CC95', '--error': '#E67E80',
            '--tab-active-bg': '#3d484d', '--text-on-active': '#D3C6AA'
        }
    },
    'ef-dark-hard': {
        name: 'Dark Hard',
        swatches: ['#272e33', '#A7C080', '#83C092', '#E67E80', '#D3C6AA'],
        vantaColor: 0xA7C080, vantaBg: 0x272e33,
        vars: {
            '--bg': '#272e33', '--bg-deep': '#1E2326', '--bg-deeper': '#1A1F22',
            '--border': '#414B50', '--text': '#D3C6AA', '--text-dim': '#9DA9A0',
            '--text-muted': '#859289', '--accent': '#A7C080', '--green': '#83C092', '--red': '#E67E80',
            '--surface': 'rgba(30,35,38,0.3)', '--border-glass': 'rgba(167,192,128,0.35)',
            '--accent-hover': '#B5CC95', '--error': '#E67E80',
            '--tab-active-bg': '#374145', '--text-on-active': '#D3C6AA'
        }
    },
    'ef-light-soft': {
        name: 'Light Soft',
        swatches: ['#f3ead3', '#8DA101', '#35A77C', '#F85552', '#5C6A72'],
        vantaColor: 0x8DA101, vantaBg: 0xf3ead3,
        vars: {
            '--bg': '#f3ead3', '--bg-deep': '#e5dfc5', '--bg-deeper': '#ddd8be',
            '--border': '#b9c0ab', '--text': '#5C6A72', '--text-dim': '#829181',
            '--text-muted': '#939F91', '--accent': '#8DA101', '--green': '#35A77C', '--red': '#F85552',
            '--surface': 'rgba(229,223,197,0.3)', '--border-glass': 'rgba(141,161,1,0.35)',
            '--accent-hover': '#7A8E00', '--error': '#F85552',
            '--tab-active-bg': '#eae4ca', '--text-on-active': '#5C6A72'
        }
    },
    'ef-light-medium': {
        name: 'Light Med',
        swatches: ['#fdf6e3', '#8DA101', '#35A77C', '#F85552', '#5C6A72'],
        vantaColor: 0x8DA101, vantaBg: 0xfdf6e3,
        vars: {
            '--bg': '#fdf6e3', '--bg-deep': '#efebd4', '--bg-deeper': '#e6e2cc',
            '--border': '#bdc3af', '--text': '#5C6A72', '--text-dim': '#829181',
            '--text-muted': '#939F91', '--accent': '#8DA101', '--green': '#35A77C', '--red': '#F85552',
            '--surface': 'rgba(239,235,212,0.3)', '--border-glass': 'rgba(141,161,1,0.35)',
            '--accent-hover': '#7A8E00', '--error': '#F85552',
            '--tab-active-bg': '#f4f0d9', '--text-on-active': '#5C6A72'
        }
    },
    'ef-light-hard': {
        name: 'Light Hard',
        swatches: ['#FFFBEF', '#8DA101', '#35A77C', '#F85552', '#5C6A72'],
        vantaColor: 0x8DA101, vantaBg: 0xFFFBEF,
        vars: {
            '--bg': '#FFFBEF', '--bg-deep': '#F2EFDF', '--bg-deeper': '#EDEADA',
            '--border': '#BEC5B2', '--text': '#5C6A72', '--text-dim': '#829181',
            '--text-muted': '#939F91', '--accent': '#8DA101', '--green': '#35A77C', '--red': '#F85552',
            '--surface': 'rgba(242,239,223,0.3)', '--border-glass': 'rgba(141,161,1,0.35)',
            '--accent-hover': '#7A8E00', '--error': '#F85552',
            '--tab-active-bg': '#F8F5E4', '--text-on-active': '#5C6A72'
        }
    }
};

//vanta element
var vantaEl = null;

var TASKBAR_BLUR_KEY = 'taskbarBlur';

export function getTaskbarBlur() {
    return localStorage.getItem(TASKBAR_BLUR_KEY) === '1';
}

export function setTaskbarBlur(enabled) {
    localStorage.setItem(TASKBAR_BLUR_KEY, enabled ? '1' : '0');
    applyTaskbarBlur();
}

export function applyTaskbarBlur() {
    document.documentElement.classList.toggle('taskbar-blur', getTaskbarBlur());
}

export function getThemeList() {
    return Object.keys(THEMES).map((id) => ({
        id,
        name: THEMES[id].name,
        swatches: THEMES[id].swatches,
    }));
}

export function applyTheme(id, reload) {
    var theme = THEMES[id];
    if (!theme) return;
    var root = document.documentElement.style;
    var keys = Object.keys(theme.vars);
    for (var i = 0; i < keys.length; i++) {
        root.setProperty(keys[i], theme.vars[keys[i]]);
    }
    localStorage.setItem('theme', id);
    if (window._vantaEffect && window._vantaEffect.setOptions) {
        window._vantaEffect.setOptions({ color: theme.vantaColor, backgroundColor: theme.vantaBg });
    } else if (window._vantaEffect && vantaEl) {
        // vanta-modified doesn't have setOptions, destroy and recreate
        try {
            window._vantaEffect.destroy();
            window._vantaEffect = VANTA.TOPOLOGY({
                el: vantaEl,
                color: theme.vantaColor, backgroundColor: theme.vantaBg,
            });
        } catch(e) {}
    }
    var cards = document.querySelectorAll('.theme-card');
    for (var j = 0; j < cards.length; j++) {
        cards[j].classList.toggle('active', cards[j].dataset.theme === id);
    }
    if (reload) {
        if (window.self !== window.top) {
            window.parent.postMessage({ type: 'theme-change', theme: id }, '*');
        } else {
            window.location.reload();
        }
    }
}

export function getVantaColors() {
    var t = THEMES[localStorage.getItem('theme')] || THEMES[DEFAULT_THEME];
    return { color: t.vantaColor, backgroundColor: t.vantaBg };
}

export function startVantaBackground(el) {
    vantaEl = typeof el === "string" ? document.querySelector(el) : el;
    window._vantaEffect = VANTA.TOPOLOGY({ el: vantaEl, ...getVantaColors() });
    return window._vantaEffect;
}

export function stopVantaBackground() {
    if (window._vantaEffect) {
        try { window._vantaEffect.destroy(); } catch (e) {}
        window._vantaEffect = null;
    }
    vantaEl = null;
}

(function() {
    var saved = localStorage.getItem('theme');
    applyTheme(saved && THEMES[saved] ? saved : DEFAULT_THEME);
    applyTaskbarBlur();
})();