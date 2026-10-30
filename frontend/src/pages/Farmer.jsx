import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const CATEGORIES = ["Vegetables", "Fruits", "Grains", "Dairy", "Spices", "Other"];
const UNITS = ["kg", "dozen", "litre", "piece"];
const EMPTY = {
  name: "", category: "Vegetables", description: "",
  price: "", unit: "kg", quantity: "", image_url: "",
};

/* ---------- Add / edit form ---------- */

function ProductForm({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState(initial);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <form
      className="form wide"
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
    >
      <label>Product name</label>
      <input value={form.name} onChange={set("name")} required />

      <label>Category</label>
      <select value={form.category} onChange={set("category")}>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>

      <label>Description</label>
      <input value={form.description} onChange={set("description")} />

      <div className="two-col">
        <div>
          <label>Price (Rs.)</label>
          <input type="number" min="0" step="0.5"
            value={form.price} onChange={set("price")} required />
        </div>
        <div>
          <label>Unit</label>
          <select value={form.unit} onChange={set("unit")}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label>Quantity</label>
          <input type="number" min="0" step="0.5"
            value={form.quantity} onChange={set("quantity")} required />
        </div>
      </div>

      <label>Image link (optional)</label>
      <input value={form.image_url} onChange={set("image_url")} placeholder="https://..." />

      <div className="actions">
        <button className="btn" disabled={busy}>{busy ? "Saving..." : "Save product"}</button>
        <button type="button" className="btn-plain" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------- Tab 1: my products ---------- */

function MyProducts() {
  const [products, setProducts] = useState([]);
  const [mode, setMode] = useState(null); // null, "add", or the product being edited
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    api("/farmer/products").then(setProducts).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  async function save(form) {
    setBusy(true);
    setError("");
    const editing = mode !== "add" ? mode : null;
    const quantity = Number(form.quantity);
    const body = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      price: Number(form.price),
      unit: form.unit,
      quantity,
      image_url: form.image_url.trim() || null,
    };
    try {
      if (editing) {
        const restocked = Number(editing.quantity) === 0 && quantity > 0;
        body.is_available = quantity > 0 && (editing.is_available || restocked);
        await api(`/products/${editing.id}`, { method: "PUT", body });
      } else {
        body.is_available = quantity > 0;
        await api("/products", { method: "POST", body });
      }
      setMode(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p) {
    try {
      await api(`/products/${p.id}`, {
        method: "PUT",
        body: { is_available: !p.is_available },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try {
      await api(`/products/${p.id}`, { method: "DELETE" });
      load();
    } catch {
      setError("Could not delete. A product that already has orders cannot be deleted, so hide it instead.");
    }
  }

  if (mode) {
    const initial = mode === "add" ? EMPTY : {
      name: mode.name,
      category: mode.category,
      description: mode.description || "",
      price: mode.price,
      unit: mode.unit,
      quantity: mode.quantity,
      image_url: mode.image_url || "",
    };
    return (
      <>
        <h3>{mode === "add" ? "Add a product" : `Edit ${mode.name}`}</h3>
        {error && <p className="error">{error}</p>}
        <ProductForm initial={initial} onSave={save} onCancel={() => { setMode(null); setError(""); }} busy={busy} />
      </>
    );
  }

  return (
    <>
      <button className="btn" onClick={() => setMode("add")}>+ Add product</button>
      {error && <p className="error">{error}</p>}
      {products.length === 0 && <p className="muted">You have not listed any products yet.</p>}

      <div className="list" style={{ marginTop: 16 }}>
        {products.map((p) => {
          const outOfStock = Number(p.quantity) === 0;
          const label = outOfStock ? "Out of stock" : p.is_available ? "Live" : "Hidden";
          return (
            <div className="row" key={p.id}>
              <div className="grow">
                <strong>{p.name}</strong>
                <p className="small">
                  Rs. {p.price} / {p.unit} | {p.quantity} {p.unit} left | {p.category}
                </p>
              </div>
              <span className={`status ${label === "Live" ? "delivered" : "cancelled"}`}>{label}</span>
              <button className="link-btn green" onClick={() => setMode(p)}>Edit</button>
              {!outOfStock && (
                <button className="link-btn green" onClick={() => toggle(p)}>
                  {p.is_available ? "Hide" : "Show"}
                </button>
              )}
              <button className="link-btn" onClick={() => remove(p)}>Delete</button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Tab 2: incoming orders ---------- */

const NEXT = {
  placed: ["accepted", "Accept order"],
  accepted: ["shipped", "Mark as shipped"],
  shipped: ["delivered", "Mark as delivered"],
};

function groupOrders(rows) {
  const map = {};
  for (const r of rows) {
    const o = r.orders;
    if (!map[o.id]) map[o.id] = { ...o, items: [] };
    map[o.id].items.push(r);
  }
  return Object.values(map).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function IncomingOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () =>
    api("/farmer/orders")
      .then((rows) => setOrders(groupOrders(rows)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function advance(order) {
    const [status] = NEXT[order.status];
    try {
      await api(`/orders/${order.id}/status`, { method: "PUT", body: { status } });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading...</p>}
      {!loading && orders.length === 0 && <p className="muted">No orders yet.</p>}

      {orders.map((o) => {
        const total = o.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        return (
          <div className="card order" key={o.id}>
            <div className="order-head">
              <span className="small">{new Date(o.created_at).toLocaleString()}</span>
              <span className={`status ${o.status}`}>{o.status}</span>
            </div>

            {o.items.map((i) => (
              <p key={i.id}>
                {i.products?.name}: {i.quantity} {i.products?.unit} x Rs. {i.unit_price}
              </p>
            ))}

            <p className="small">
              Buyer: {o.profiles?.full_name}
              {o.profiles?.phone ? ` (${o.profiles.phone})` : ""}
            </p>
            <p className="small">Deliver to: {o.delivery_address}</p>
            <p className="small">
              Payment: {o.payment_method === "cod" ? "Cash on delivery" : "Online"} ({o.payment_status})
            </p>
            <p className="price">Your items: Rs. {total.toFixed(2)}</p>

            {NEXT[o.status] && (
              <button className="btn" onClick={() => advance(o)}>
                {NEXT[o.status][1]}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------- The page ---------- */

export default function Farmer() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("products");

  if (!profile) return <p>Please <Link to="/login">login</Link> to continue.</p>;
  if (profile.role !== "farmer") return <p className="muted">This page is only for farmers.</p>;

  return (
    <>
      <h2>Farmer dashboard</h2>
      <div className="tabs">
        <button className={tab === "products" ? "tab active" : "tab"} onClick={() => setTab("products")}>
          My Products
        </button>
        <button className={tab === "orders" ? "tab active" : "tab"} onClick={() => setTab("orders")}>
          Incoming Orders
        </button>
      </div>
      {tab === "products" ? <MyProducts /> : <IncomingOrders />}
    </>
  );
}
