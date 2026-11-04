// The search belongs to the user, never to the browser's credential autofill.
export function createUserSearch(input, onChange, schedule = (fn, delay) => window.setInterval(fn, delay)) {
    let query = '', editing = false, composing = false;
    const focused = () => input.ownerDocument.activeElement === input;
    const autofilled = () => { try { return input.matches(':-webkit-autofill'); } catch { return false; } };
    function restore() {
        if (!composing && input.value !== query) input.value = query;
    }
    function commit() {
        const next = input.value;
        if (next !== query) { query = next; onChange(); }
    }
    input.value = '';
    input.readOnly = true;
    input.addEventListener('focus', () => { restore(); input.readOnly = false; });
    input.addEventListener('blur', () => { composing = editing = false; input.readOnly = true; restore(); });
    input.addEventListener('beforeinput', event => {
        editing = event.isTrusted && focused() && !autofilled();
    });
    input.addEventListener('compositionstart', event => { composing = event.isTrusted && focused(); });
    input.addEventListener('compositionend', event => {
        composing = false;
        if (event.isTrusted && focused() && !autofilled()) commit(); else restore();
        editing = false;
    });
    input.addEventListener('input', event => {
        if (composing) return;
        // The native search clear button can omit beforeinput; clearing is safe.
        const intentional = event.isTrusted && focused() && !autofilled() && (editing || input.value === '');
        editing = false;
        if (intentional) commit(); else restore();
    });
    // Password managers can silently assign a value again seconds after login,
    // without input events. Restore only unconfirmed values, not the user's query.
    schedule(restore, 250);
    restore();
    return {
        value() { restore(); return query; },
        reset() { query = ''; composing = editing = false; input.value = ''; }
    };
}
