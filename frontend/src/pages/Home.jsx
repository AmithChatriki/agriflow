import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useCart } from "../CartContext";

const CATEGORIES = ["All", "Vegetables", "Fruits", "Grains", "Dairy", "Spices", "Other"];

function Rating({ avg, count }) {
  if (!count) return <p className="small">No reviews yet</p>;
  const full = Math.round(avg);
  return (
    <p className="rating">
      <span className="stars">{"\u2605".repeat(full)}{"\u2606".repeat(5 - full)}</span>
      <span className="small"> {avg} ({count} {count === 1 ? "review" : "reviews"})</span>
    </p>
  );
}

export default function Home() {
  const { profile } = useAuth();
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category !== "All") params.set("category", category);

    setLoading(true);
    api(`/products?${params.toString()}`)
      .then((data) => { setProducts(data); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, category]);

  function handleAdd(product) {
    addItem(product, 1);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1200);
  }

  return (
    <>
      <h1>Fresh from the farm</h1>
      <p className="muted">Buy directly from farmers, with no middlemen.</p>

      <div className="filters">
        <input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading products...</p>}
      {!loading && !error && products.length === 0 && (
        <p className="muted">No products found.</p>
      )}

      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p.id}>
            {p.image_url && <img className="thumb" src={p.image_url} alt={p.name} />}
            <span className="tag">{p.category}</span>
            <h3>{p.name}</h3>
            <p className="price">Rs. {p.price} / {p.unit}</p>
            <Rating avg={p.avg_rating} count={p.review_count} />
            {p.description && <p className="muted">{p.description}</p>}
            <p className="small">
              Sold by {p.profiles?.full_name}
              {p.profiles?.address ? `, ${p.profiles.address}` : ""}
            </p>
            <p className="small">{p.quantity} {p.unit} available</p>

            {profile?.role === "consumer" && (
              <button className="btn full" onClick={() => handleAdd(p)}>
                {addedId === p.id ? "Added" : "Add to cart"}
              </button>
            )}
            {!profile && (
              <Link to="/login" className="small">Login to buy</Link>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
