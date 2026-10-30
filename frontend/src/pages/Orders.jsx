import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

function ReviewForm({ productId }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    try {
      await api(`/products/${productId}/reviews`, {
        method: "POST",
        body: { rating, comment },
      });
      setMessage("Thanks for your review.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="review">
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
      </select>
      <input
        placeholder="Write a short review (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button className="btn" onClick={submit}>Review</button>
      {message && <span className="small">{message}</span>}
    </div>
  );
}

export default function Orders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    api("/orders")
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (profile?.role === "consumer") load();
    else setLoading(false);
  }, [profile]);

  async function cancel(id) {
    try {
      await api(`/orders/${id}/cancel`, { method: "PUT" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!profile) return <p>Please <Link to="/login">login</Link> to see your orders.</p>;
  if (profile.role !== "consumer") return <p className="muted">Only consumers have orders here.</p>;

  return (
    <>
      <h2>My orders</h2>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading...</p>}
      {!loading && orders.length === 0 && (
        <p className="muted">No orders yet. <Link to="/">Start shopping</Link></p>
      )}

      {orders.map((o) => (
        <div className="card order" key={o.id}>
          <div className="order-head">
            <span className="small">{new Date(o.created_at).toLocaleString()}</span>
            <span className={`status ${o.status}`}>{o.status}</span>
          </div>

          {o.order_items.map((it) => (
            <div key={it.id}>
              <p>
                {it.products?.name}: {it.quantity} {it.products?.unit} x Rs. {it.unit_price}
              </p>
              {o.status === "delivered" && <ReviewForm productId={it.product_id} />}
            </div>
          ))}

          <p className="small">
            Payment: {o.payment_method === "cod" ? "Cash on delivery" : "Online"} ({o.payment_status})
          </p>
          <p className="small">Deliver to: {o.delivery_address}</p>
          <p className="price">Total: Rs. {o.total_amount}</p>

          {o.status === "placed" && (
            <button className="btn-danger" onClick={() => cancel(o.id)}>Cancel order</button>
          )}
        </div>
      ))}
    </>
  );
}
