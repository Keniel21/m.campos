import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api, setToken, type Row } from './api';
import { modules } from './schema';
import './style.css';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [module, setModule] = useState('estoque');
  const [rows, setRows] = useState<Row[]>([]);
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const schema = modules[module];
  useEffect(() => {
    const expire = () => { setAuthenticated(false); setToken(''); setRows([]); setVehicles([]); setEditing(null); };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setLoading(true); setError(''); setEditing(null); setRows([]);
    Promise.all([api<Row[]>(`/crm/${module}`), api<Row[]>('/crm/estoque')])
      .then(([data, cars]) => { if (active) { setRows(data); setVehicles(cars); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated, module]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ token: string }>('/auth/login', 'POST', Object.fromEntries(form));
      setToken(result.token); setAuthenticated(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    setBusy(true); setError('');
    const data = { ...editing };
    for (const field of schema.fields) if (field.type === 'number' && data[field.key] !== undefined)
      data[field.key] = data[field.key] === '' ? null : Number(data[field.key]);
    try {
      await api(`/crm/${module}${editing.id ? `/${editing.id}` : ''}`, editing.id ? 'PUT' : 'POST', data);
      setRows(await api<Row[]>(`/crm/${module}`));
      setVehicles(await api<Row[]>('/crm/estoque')); setEditing(null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(row: Row) {
    if (!window.confirm('Excluir este registro?')) return;
    setBusy(true); setError('');
    try { await api(`/crm/${module}/${row.id}`, 'DELETE'); setRows(await api<Row[]>(`/crm/${module}`)); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!authenticated) return <main className="login"><form onSubmit={login}>
    <span className="brand">M. CAMPOS</span><h1>Seu negócio em movimento.</h1><p>Acesse a gestão da sua loja.</p>
    <label>E-mail<input name="email" type="email" required autoComplete="username" /></label>
    <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
    {error && <p role="alert" className="error">{error}</p>}<button disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
  </form></main>;
  const filtered = rows.filter(row => schema.fields.some(f => String(row[f.key] ?? '').toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  return <div className="shell"><aside><span className="brand">M. CAMPOS</span><p>Gestão automotiva</p><nav>{Object.entries(modules).map(([key, value]) =>
    <button key={key} className={module === key ? 'selected' : ''} disabled={busy} onClick={() => { setModule(key); setSearch(''); }}>{value.title}</button>)}</nav>
    <button onClick={() => { setToken(''); setAuthenticated(false); setRows([]); setVehicles([]); }}>Sair</button></aside>
    <main><header><div><p className="eyebrow">VISÃO DA OPERAÇÃO</p><h1>{schema.title}</h1><p>{rows.length} registros</p></div>
      <button disabled={busy || loading} onClick={() => setEditing(Object.fromEntries(schema.fields.map(f => [f.key, f.options?.[0] ?? (f.type === 'date' ? new Date().toISOString().slice(0, 10) : '')])))}>+ Novo registro</button></header>
      {error && <p role="alert" className="error">{error}</p>}
      <label className="search">Buscar em {schema.title.toLowerCase()}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite para filtrar" /></label>
      {loading ? <p role="status">Carregando…</p> : <div className="table"><table><thead><tr>{schema.fields.slice(0, 5).map(f => <th key={f.key}>{f.label}</th>)}<th>Ações</th></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}>{schema.fields.slice(0, 5).map(f => <td key={f.key}>{f.type === 'vehicle' ? String(vehicles.find(v => v.id === row[f.key])?.model ?? '—') : String(row[f.key] ?? '—')}</td>)}<td className="actions"><button disabled={busy} onClick={() => { setError(''); setEditing({ ...row }); }}>Editar</button><button disabled={busy} onClick={() => remove(row)}>Excluir</button></td></tr>)}</tbody></table>
        {!filtered.length && <p className="empty">Nenhum registro encontrado.</p>}</div>}
      {editing && <div className="overlay"><section role="dialog" aria-modal="true" aria-labelledby="edit-title"><form onSubmit={save}><h2 id="edit-title">{editing.id ? 'Editar' : 'Novo registro'} · {schema.title}</h2>
        <div className="fields">{schema.fields.map(field => <label key={field.key}>{field.label}{field.required ? ' *' : ''}{field.type === 'vehicle' || field.options ?
          <select required={field.required} value={String(editing[field.key] ?? '')} onChange={e => setEditing({ ...editing, [field.key]: e.target.value })}>
            <option value="">Selecione</option>{field.type === 'vehicle' ? vehicles.map(car => <option key={car.id} value={car.id}>{String(car.model)} · {String(car.plate ?? '')}</option>) : field.options?.map(option => <option key={option}>{option}</option>)}
          </select> : <input required={field.required} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} value={String(editing[field.key] ?? '')} onChange={e => setEditing({ ...editing, [field.key]: e.target.value })} />}</label>)}</div>
        {error && <p role="alert" className="error">{error}</p>}<footer><button type="button" className="secondary" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button><button disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></footer>
      </form></section></div>}
    </main></div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
