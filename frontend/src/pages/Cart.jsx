import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useCart } from "../CartContext";

export default function Cart() {
  const { profile } = useAuth();
  const { items, setQuantity, removeItem, clearCart, total } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState(profile?.address || "");
  const [payment, setPayment] = useState("cod");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!profile) {
    return <p>Please <Link to="/login">login</Link> to view your cart.</p>;
  }
  if (profile.role !== "consumer") {
    return <p className="muted">Only consumers can use the cart.</p>;
  }
  if (items.length === 0) {
    return (
      <>
        <h2>Your cart</h2>
        <p className="muted">Your cart is empty. <Link to="/">Browse products</Link></p>
      </>
    );
  }

  async function placeOrder() {
    setBusy(true);
    setError("");
    try {
      await api("/orders", {
        method: "POST",
        body: {
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
          })),
          delivery_address: address,
          payment_method: payment,
        },
      });
      clearCart();
      navigate("/orders");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Your cart</h2>

      <div className="list">
        {items.map(({ product, quantity }) => (
          <div className="row" key={product.id}>
            <div className="grow">
              <strong>{product.name}</strong>
              <p className="small">Rs. {product.price} / {product.unit}</p>
            </div>
            <input
              className="qty"
              type="number"
              min="0.5"
              max={product.quantity}
              step="0.5"
              value={quantity}
              onChange={(e) => setQuantity(product.id, Number(e.target.value))}
            />
            <span className="amount">Rs. {(product.price * quantity).toFixed(2)}</span>
            <button className="link-btn" onClick={() => removeItem(product.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="form wide">
        <label>Delivery address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />

        <label>Payment method</label>
        <select value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="cod">Cash on delivery</option>
          <option value="online">Online payment (simulated)</option>
        </select>

        <p className="total">Total: Rs. {total.toFixed(2)}</p>
        {error && <p className="error">{error}</p>}
        <button className="btn" onClick={placeOrder} disabled={busy}>
          {busy ? "Placing order..." : "Place order"}
        </button>
      </div>
    </>
  );
}
