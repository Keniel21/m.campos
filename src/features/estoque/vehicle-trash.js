const bindings = new WeakMap();
export function bindVehicleTrash(cars, restore, doc = document) {
    const dialog = doc.getElementById('vehicle-trash-dialog');
    const launch = doc.getElementById('open-vehicle-trash');
    if (!dialog || !launch) return;
    let binding = bindings.get(dialog);
    if (binding) { binding.cars = cars; binding.restore = restore; return; }
    binding = { cars, restore, busy: false };
    bindings.set(dialog, binding);
    const list = doc.getElementById('vehicle-trash-items');
    const error = doc.getElementById('vehicle-trash-error');
    const close = doc.getElementById('close-vehicle-trash');
    const render = () => {
        list.replaceChildren();
        const entries = binding.cars().filter(car => car.trashedAt);
        if (!entries.length) {
            const empty = doc.createElement('p'); empty.textContent = 'Nenhum veículo na lixeira.'; list.append(empty);
        }
        for (const car of entries) {
            const row = doc.createElement('div'); row.className = 'vehicle-trash-row';
            const name = doc.createElement('span');
            const date = new Date(car.trashedAt);
            name.textContent = `${car.model || 'Veículo'} — ${car.plate || 'Sem placa'} — ID: ${car.id}`;
            const detail = doc.createElement('small');
            detail.textContent = `Movido em ${Number.isNaN(date.getTime()) ? 'data não informada' : date.toLocaleString('pt-BR')}`;
            const identity = doc.createElement('div'); identity.append(name, detail);
            const button = doc.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary';
            button.textContent = 'Restaurar'; button.disabled = binding.busy;
            button.onclick = async () => {
                if (binding.busy) return;
                binding.busy = true; close.disabled = true; error.hidden = true; render();
                try { await binding.restore(car.id); }
                catch (failure) { error.textContent = failure.message || 'Não foi possível restaurar. Atualize e tente novamente.'; error.hidden = false; }
                finally { binding.busy = false; close.disabled = false; render(); }
            };
            row.append(identity, button); list.append(row);
        }
    };
    launch.onclick = () => { error.hidden = true; render(); dialog.showModal(); close.focus(); };
    close.onclick = () => { if (!binding.busy) dialog.close(); };
    dialog.oncancel = event => { if (binding.busy) event.preventDefault(); };
}
