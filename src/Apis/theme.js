// modified version of old v2 theming + vanta engine
import { VANTA } from "../vanta.js";

var THEMES = {
    windows7: {
        name: 'Windows 7',
        swatches: ['#f1f1f1', '#2196f3', '#7fffd4', '#c00', '#000000'],
        vantaColor: 0x2196f3, vantaBg: 0x000000,
        vars: {
            '--bg': '#f1f1f1', '--bg-deep': '#d3d3d3', '--bg-deeper': '#000000',
            '--border': '#d3d3d3', '--text': '#000000', '--text-dim': '#333333',
            '--text-muted': '#666666', '--accent': '#2196f3', '--green': '#7fffd4', '--red': '#c00',
            '--surface': 'rgba(255,255,255,0.3)', '--border-glass': 'rgba(33,150,243,0.35)',
            '--accent-hover': '#42a5f5', '--error': '#c00',
            '--tab-active-bg': '#e0e0e0', '--text-on-active': '#000000'
        }
    },
    nord: {
        name: 'Nord',
        swatches: ['#3b4252', '#5e81ac', '#a3be8c', '#bf616a', '#eceff4'],
        vantaColor: 0x5e81ac, vantaBg: 0x3b4252,
        vars: {
            '--bg': '#3b4252', '--bg-deep': '#2e3440', '--bg-deeper': '#242933',
            '--border': '#5e81ac', '--text': '#eceff4', '--text-dim': '#e5e9f0',
            '--text-muted': '#d8dee9', '--accent': '#5e81ac', '--green': '#a3be8c', '--red': '#bf616a',
            '--surface': 'rgba(46,52,64,0.3)', '--border-glass': 'rgba(94,129,172,0.35)',
            '--accent-hover': '#81a1c1', '--error': '#bf616a',
            '--tab-active-bg': '#434c5e', '--text-on-active': '#eceff4'
        }
    },

    // this looks BUNS, mayb disable or fix to be a diff variant of rose pine
    'rose-pine': {
          name: 'Rose Pine',
          swatches: ['#faf4ed', '#907aa9', '#56949f', '#b4637a', '#464261'],
          vantaColor: 0xebbcba, vantaBg: 0xfaf4ed,
          vars: {
              '--bg': '#faf4ed', '--bg-deep': '#f2e9e1', '--bg-deeper': '#ebe4dd',
              '--border': '#cecacd', '--text': '#464261', '--text-dim': '#797593',
              '--text-muted': '#9893a5', '--accent': '#ea9a97', '--green': '#56949f', '--red': '#b4637a',
              '--surface': 'rgba(242,233,225,0.3)', '--border-glass': 'rgba(144,122,169,0.35)',
              '--accent-hover': '#ebbcba', '--error': '#b4637a',
              '--tab-active-bg': '#e8ddd5', '--text-on-active': '#464261'
          }
      },
    'catppuccin-frappe': {
        name: 'C. Frappe',
        swatches: ['#303446', '#ca9ee6', '#a6d189', '#e78284', '#c6d0f5'],
        vantaColor: 0xca9ee6, vantaBg: 0x303446,
        vars: {
            '--bg': '#303446', '--bg-deep': '#292c3c', '--bg-deeper': '#232634',
            '--border': '#51576d', '--text': '#c6d0f5', '--text-dim': '#b5bfe2',
            '--text-muted': '#a5adce', '--accent': '#ca9ee6', '--green': '#a6d189', '--red': '#e78284',
            '--surface': 'rgba(41,44,60,0.3)', '--border-glass': 'rgba(202,158,230,0.35)',
            '--accent-hover': '#d6b5ee', '--error': '#e78284',
            '--tab-active-bg': '#414559', '--text-on-active': '#c6d0f5'
        }
    },
    'catppuccin-macchiato': {
        name: 'C. Macchiato',
        swatches: ['#24273a', '#c6a0f6', '#a6da95', '#ed8796', '#cad3f5'],
        vantaColor: 0xc6a0f6, vantaBg: 0x24273a,
        vars: {
            '--bg': '#24273a', '--bg-deep': '#1e2030', '--bg-deeper': '#181926',
            '--border': '#494d64', '--text': '#cad3f5', '--text-dim': '#b8c0e0',
            '--text-muted': '#a5adcb', '--accent': '#c6a0f6', '--green': '#a6da95', '--red': '#ed8796',
            '--surface': 'rgba(30,32,48,0.3)', '--border-glass': 'rgba(198,160,246,0.35)',
            '--accent-hover': '#d3b8f8', '--error': '#ed8796',
            '--tab-active-bg': '#363a4f', '--text-on-active': '#cad3f5'
        }
    },
    'catppuccin-mocha': {
        name: 'C .Mocha',
        swatches: ['#1e1e2e', '#cba6f7', '#a6e3a1', '#f38ba8', '#cdd6f4'],
        vantaColor: 0xcba6f7, vantaBg: 0x1e1e2e,
        vars: {
            '--bg': '#1e1e2e', '--bg-deep': '#181825', '--bg-deeper': '#11111b',
            '--border': '#45475a', '--text': '#cdd6f4', '--text-dim': '#bac2de',
            '--text-muted': '#a6adc8', '--accent': '#cba6f7', '--green': '#a6e3a1', '--red': '#f38ba8',
            '--surface': 'rgba(24,24,37,0.3)', '--border-glass': 'rgba(203,166,247,0.35)',
            '--accent-hover': '#d8befc', '--error': '#f38ba8',
            '--tab-active-bg': '#313244', '--text-on-active': '#cdd6f4'
        }
    },
    'ef-dark-soft': {
        name: 'EF Dark Soft',
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
        name: 'EF Dark Med',
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
        name: 'EF Dark Hard',
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
        name: 'EF Light Soft',
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
        name: 'EF Light Med',
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
        name: 'EF Light Hard',
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
    } else if (window._vantaEffect) {
        // vanta-modified doesn't have setOptions, destroy and recreate
        try {
            window._vantaEffect.destroy();
            window._vantaEffect = VANTA.TOPOLOGY({
                el: "#vanta-bg",
                mouseControls: true, touchControls: true, gyroControls: false,
                minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
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
    var t = THEMES[localStorage.getItem('theme')] || THEMES['windows7'];
    return { color: t.vantaColor, backgroundColor: t.vantaBg };
}

export function startVantaBackground(el) {
    return VANTA.TOPOLOGY({ el, ...getVantaColors() });
}

(function() {
    var saved = localStorage.getItem('theme');
    applyTheme(saved && THEMES[saved] ? saved : 'windows7');
})();