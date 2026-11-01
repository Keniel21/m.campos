-- ==========================================================================
-- AUTO DRIVE CRM - DATABASE SETUP WITH SUPABASE (PostgreSQL)
-- ==========================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (User profiles and admin approval)
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    full_name text,
    avatar_url text,
    role text default 'operator' check (role in ('admin', 'operator')),
    is_approved boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Permitir leitura de perfis aprovados ou próprio perfil"
    on public.profiles for select
    using (is_approved = true or auth.uid() = id);

create policy "Permitir inserção pelo próprio usuário no cadastro"
    on public.profiles for insert
    with check (auth.uid() = id);

create policy "Permitir atualização pelo próprio usuário"
    on public.profiles for update
    using (auth.uid() = id);

-- 2. ESTOQUE TABLE (Vehicle Inventory)
create table if not exists public.estoque (
    id uuid default uuid_generate_v4() primary key,
    model text not null,
    year text not null,
    km integer not null,
    buy_price numeric(12,2) not null,
    sell_price numeric(12,2),
    purchase_date date not null,
    sale_date date,
    status text default 'disponivel' check (status in ('disponivel', 'reservado', 'preparacao', 'vendido')),
    type text default 'convencional' check (type in ('convencional', 'repasse')),
    plate text,
    color text,
    chassis text,
    image_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.estoque enable row level security;

create policy "Permitir leitura para todos os usuários autenticados"
    on public.estoque for select
    using (auth.role() = 'authenticated');

create policy "Permitir escrita para todos os usuários autenticados"
    on public.estoque for all
    using (auth.role() = 'authenticated');

-- 3. LEADS TABLE (CRM funnel)
create table if not exists public.leads (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    phone text,
    interest_car_id uuid references public.estoque(id) on delete set null,
    origin text,
    status text default 'novo lead',
    last_contact_days integer default 0,
    next_action text,
    interactions jsonb default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.leads enable row level security;

create policy "Permitir tudo para usuários autenticados"
    on public.leads for all
    using (auth.role() = 'authenticated');

-- 4. VENDAS TABLE (Sales history)
create table if not exists public.vendas (
    id uuid default uuid_generate_v4() primary key,
    car_id uuid references public.estoque(id) on delete set null,
    client text not null,
    sell_price numeric(12,2) not null,
    date date not null,
    profit numeric(12,2) not null,
    margin numeric(5,2) not null,
    type text check (type in ('convencional', 'repasse')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.vendas enable row level security;

create policy "Permitir tudo para usuários autenticados"
    on public.vendas for all
    using (auth.role() = 'authenticated');

-- 5. DESPESAS TABLE (Expenses log)
create table if not exists public.despesas (
    id uuid default uuid_generate_v4() primary key,
    "desc" text not null,
    car_id uuid references public.estoque(id) on delete set null,
    date date not null,
    val numeric(12,2) not null,
    category text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.despesas enable row level security;

create policy "Permitir tudo para usuários autenticados"
    on public.despesas for all
    using (auth.role() = 'authenticated');

-- 6. AGENDA TABLE (Operational schedule)
create table if not exists public.agenda (
    id uuid default uuid_generate_v4() primary key,
    title text not null,
    date date not null,
    "time" text,
    car_id uuid references public.estoque(id) on delete set null,
    category text,
    "desc" text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agenda enable row level security;

create policy "Permitir tudo para usuários autenticados"
    on public.agenda for all
    using (auth.role() = 'authenticated');
