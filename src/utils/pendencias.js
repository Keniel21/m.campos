// Every named option comes from the shared catalog, never from the vehicle payload.
export function pendingLabel(value, options = []) {
    if (value === 'none') return 'Sem pendência';
    if (!value || value === 'unreported') return 'Não informado';
    return options.find(option => option.code === value)?.name || 'Pendência não identificada';
}
export function escapePending(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
}
