// Legacy values describe documents only; do not infer absence of other pending issues.
const legacy = { sim: 'Documento na loja (anterior)', nao: 'Não possui documento (anterior)', pendente: 'Entrega de documento pendente (anterior)' };
export function pendingLabel(value, options = []) {
    if (value === 'none') return 'Sem pendência';
    return options.find(option => option.code === value)?.name || legacy[value] || (value ? 'Pendência não identificada' : 'Não informado');
}
export function escapePending(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
}
