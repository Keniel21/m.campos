// ==========================================================================
// AUTO DRIVE CRM - COMMON UTILS & HELPERS
// ==========================================================================

import { state } from '../services/state.js';

// Resolves authoritative operational today date from server/data rather than client device clock
export function getOperationalToday() {
    if (state && state.operationalDate) {
        const d = new Date(state.operationalDate + 'T12:00:00');
        if (!isNaN(d.getTime())) return d;
    }
    if (state && state.vendas && state.vendas.length > 0) {
        let maxDate = '';
        state.vendas.forEach(v => {
            if (v.date && v.date > maxDate) maxDate = v.date;
        });
        if (maxDate) {
            const d = new Date(maxDate + 'T12:00:00');
            if (!isNaN(d.getTime())) return d;
        }
    }
    return new Date();
}

// Calculates how many days have passed since the purchase date
export function calcDaysInStock(purchaseDate) {
    if (!purchaseDate) return 0;
    const bought = new Date(purchaseDate + 'T00:00:00');
    const today = getOperationalToday();
    today.setHours(0, 0, 0, 0);
    const diff = today - bought;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// Configures the header date label in Portuguese format
export function setupHeaderDate() {
    const d = getOperationalToday();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const display = document.getElementById("date-display");
    if (display) display.innerText = d.toLocaleDateString('pt-BR', options);
}

// Formats numbers into BRL currency string
export function formatCurrency(val) {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Parses BRL formatted currency string back to float number
export function parseCurrencyBR(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = val.replace(/[^\d,.-]/g, '')
                     .replace(/\./g, '')
                     .replace(',', '.');
    return parseFloat(clean) || 0;
}

// Formats generic float numbers to BR formatted numbers
export function formatNumberBR(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Number(val).toLocaleString('pt-BR');
}

// Interactively formats inputs for currency fields
export function formatCurrencyInput(el, val) {
    if (!el) return;
    
    if (val !== undefined && val !== null && val !== "") {
        const num = typeof val === 'number' ? val : parseCurrencyBR(val);
        el.value = formatCurrency(num);
        return;
    }

    let value = (el.value || "").replace(/\D/g, "");
    if (!value) {
        el.value = "R$ 0,00";
        return;
    }
    value = (value / 100).toFixed(2) + "";
    value = value.replace(".", ",");
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    el.value = "R$ " + value;
}

// Robust function to parse entity IDs (handles both auto-incrementing integers and cloud UUID strings)
export function parseId(val) {
    if (val === undefined || val === null) return null;
    const strVal = String(val).trim();
    if (!strVal || strVal === "" || strVal === "null" || strVal === "undefined") return null;
    // UUIDs have dashes and are long, whereas local IDs are usually small integers
    if (strVal.includes('-') || strVal.length > 8) {
        return strVal;
    }
    const parsed = parseInt(strVal, 10);
    return isNaN(parsed) ? strVal : parsed;
}

// Global KPI Balloon toggle handler
if (typeof window !== 'undefined') {
    window.toggleKpiBalloon = function(iconEl, event) {
        if (event) event.stopPropagation();
        const card = iconEl.closest('.kpi-card');
        if (!card) return;

        const balloon = card.querySelector('.kpi-balloon');
        if (!balloon) return;

        const isCurrentlyVisible = balloon.style.display !== 'none' && balloon.style.display !== '';

        // Close all open balloons
        document.querySelectorAll('.kpi-balloon').forEach(b => b.style.display = 'none');

        // Toggle current
        if (!isCurrentlyVisible) {
            balloon.style.display = 'block';
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    };
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.kpi-balloon') && !e.target.closest('.kpi-icon-clickable')) {
            document.querySelectorAll('.kpi-balloon').forEach(b => b.style.display = 'none');
        }
    });
}

// Global Toast Notification for seamless user feedback
export function showToast(message, type = 'info') {
    if (typeof document === 'undefined') return;
    let toastContainer = document.getElementById('global-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'global-toast-container';
        toastContainer.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:999999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const colors = {
        success: { bg: '#064e3b', border: '#059669', text: '#ecfdf5' },
        warning: { bg: '#78350f', border: '#d97706', text: '#fffbeb' },
        error: { bg: '#7f1d1d', border: '#dc2626', text: '#fef2f2' },
        info: { bg: '#1e293b', border: '#3b82f6', text: '#f8fafc' }
    };
    const c = colors[type] || colors.info;

    toast.style.cssText = `background:${c.bg}; border:1px solid ${c.border}; color:${c.text}; padding:10px 16px; border-radius:10px; font-size:13px; font-weight:500; box-shadow:0 8px 24px rgba(0,0,0,0.35); pointer-events:auto; display:flex; align-items:center; gap:8px; transition:opacity 0.25s ease, transform 0.25s ease; opacity:0; transform:translateY(8px);`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

if (typeof window !== 'undefined') {
    window.showToast = showToast;
}

