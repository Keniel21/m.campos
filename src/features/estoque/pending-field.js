import { createCatalogField } from './catalog-field.js';
export const renderPendingField = createCatalogField({ prefix: 'pending', selectId: 'cd-document', module: 'pendencias', title: 'Pendência', allowNone: true });
export const renderStatusMcField = createCatalogField({ prefix: 'status-mc', selectId: 'cd-status-mc', module: 'status_mc_options', title: 'Status MC' });
export const renderCustomStatusField = createCatalogField({ prefix: 'custom-status', selectId: 'cd-custom-status', module: 'status_options', title: 'Status' });
