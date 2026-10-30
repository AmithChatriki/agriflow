-- AgriFlow database schema (run in the Supabase SQL Editor)

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  address text,
  role text not null check (role in ('farmer', 'consumer')),
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  unit text not null default 'kg',
  quantity numeric(10,2) not null default 0,
  image_url text,
  is_available boolean default true,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references profiles(id),
  total_amount numeric(10,2) not null,
  delivery_address text not null,
  payment_method text not null check (payment_method in ('cod', 'online')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  status text not null default 'placed' check (status in ('placed', 'accepted', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  farmer_id uuid not null references profiles(id),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(10,2) not null
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  consumer_id uuid not null references profiles(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique (product_id, consumer_id)
);

alter table profiles enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
