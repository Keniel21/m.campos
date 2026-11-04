// A deletion requires an explicit confirmation for the same vehicle still open.
export function bindVehicleDeletion(car, { currentId, beforeDelete, remove, onDeleted, afterAttempt = () => {} }, doc = document) {
    const launch = doc.getElementById('cd-delete-vehicle');
    const dialog = doc.getElementById('vehicle-delete-dialog');
    if (!launch || !dialog) return;
    const confirm = doc.getElementById('vehicle-delete-confirm');
    const cancel = doc.getElementById('vehicle-delete-cancel');
    const error = doc.getElementById('vehicle-delete-error');
    let busy = false;
    const sameVehicle = () => String(currentId()) === String(car.id);
    const showError = message => { error.textContent = message; error.hidden = false; };
    launch.onclick = () => {
        if (!sameVehicle() || busy) return;
        error.hidden = true;
        doc.getElementById('vehicle-delete-identity').textContent = `${car.model || 'Veículo'} — Placa: ${car.plate || 'não informada'} — ID: ${car.id}`;
        dialog.showModal();
        cancel.focus();
    };
    cancel.onclick = () => { if (!busy) dialog.close(); };
    dialog.oncancel = event => { if (busy) event.preventDefault(); };
    confirm.onclick = async () => {
        if (busy) return;
        if (!sameVehicle()) { dialog.close(); return; }
        busy = true; confirm.disabled = cancel.disabled = true;
        confirm.textContent = 'Excluindo…'; error.hidden = true;
        let prepared = false;
        try {
            await beforeDelete(car.id); prepared = true;
            await remove(car.id);
            dialog.close();
            await onDeleted(car.id);
        } catch (failure) {
            showError(failure.message || 'Não foi possível excluir. Atualize a página e tente novamente.');
        } finally {
            if (prepared) afterAttempt(car.id);
            busy = false; confirm.disabled = cancel.disabled = false;
            confirm.textContent = 'Excluir veículo';
        }
    };
}
