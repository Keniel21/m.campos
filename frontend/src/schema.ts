export type Field = { key: string; label: string; type?: 'number' | 'date' | 'time' | 'email' | 'url' | 'vehicle'; required?: boolean; options?: string[] };
export type Module = { title: string; fields: Field[] };
const date: Field = { key: 'date', label: 'Data', type: 'date', required: true };
const vehicle: Field = { key: 'carId', label: 'Veículo', type: 'vehicle' };
const name: Field = { key: 'name', label: 'Nome', required: true };
export const navigationModules = ['estoque', 'clientes', 'despesas', 'documentos', 'company_cnpjs'];
export const vehicleStatusLabels: Record<string, string> = {
  disponivel: 'Disponível', vendido: 'Vendido', preparacao: 'Em preparação', reservado: 'Reservado'
};
export const modules: Record<string, Module> = {
  estoque: { title: 'Estoque', fields: [
    { key: 'model', label: 'Modelo', required: true }, { key: 'plate', label: 'Placa' }, { key: 'year', label: 'Ano' },
    { key: 'km', label: 'Quilometragem', type: 'number' }, { key: 'buyPrice', label: 'Custo de compra', type: 'number' },
    { key: 'sellPrice', label: 'Preço de venda', type: 'number' }, { key: 'purchaseDate', label: 'Data de compra', type: 'date' },
    { key: 'status', label: 'Situação', options: ['disponivel', 'preparacao', 'reservado', 'vendido'], required: true },
    { key: 'type', label: 'Modalidade', options: ['convencional', 'repasse'] }, { key: 'color', label: 'Cor' }, { key: 'chassis', label: 'Chassi' }, { key: 'notes', label: 'Observações' }
  ] },
  clientes: { title: 'Clientes', fields: [name, { key: 'phone', label: 'Telefone' }, { key: 'email', label: 'E-mail', type: 'email' }, { key: 'document', label: 'CPF/CNPJ' }] },
  leads: { title: 'Leads', fields: [name, { key: 'phone', label: 'Telefone' }, { key: 'interestCarId', label: 'Veículo de interesse', type: 'vehicle' }, { key: 'origin', label: 'Origem' }, { key: 'status', label: 'Etapa', options: ['novo lead', 'contato realizado', 'negociação', 'sem resposta', 'ganho', 'perdido'] }, { key: 'nextAction', label: 'Próxima ação' }] },
  vendas: { title: 'Vendas', fields: [{ ...vehicle, required: true }, { key: 'client', label: 'Cliente', required: true }, { key: 'clientDocument', label: 'CPF/CNPJ do cliente' }, { key: 'sellerCnpj', label: 'CNPJ do vendedor' }, { key: 'sellPrice', label: 'Valor de venda', type: 'number', required: true }, date] },
  despesas: { title: 'Financeiro', fields: [{ key: 'desc', label: 'Descrição', required: true }, { key: 'val', label: 'Valor', type: 'number', required: true }, date, vehicle, { key: 'category', label: 'Categoria' }] },
  agenda: { title: 'Agenda', fields: [{ key: 'title', label: 'Compromisso', required: true }, date, { key: 'time', label: 'Horário', type: 'time', required: true }, vehicle, { key: 'desc', label: 'Observações' }] },
  documentos: { title: 'Documentos', fields: [{ ...vehicle, required: true }, { key: 'fileName', label: 'Nome do documento', required: true }, { key: 'fileUrl', label: 'Link do arquivo', type: 'url' }, { key: 'description', label: 'Descrição' }] },
  company_cnpjs: { title: 'Empresas', fields: [name, { key: 'cnpj', label: 'CNPJ', required: true }, { key: 'ie', label: 'Inscrição estadual' }] }
};
