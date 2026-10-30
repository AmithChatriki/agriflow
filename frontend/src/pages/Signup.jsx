import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    role: "consumer", full_name: "", email: "", password: "", phone: "", address: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signup(form);
      navigate("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2>Create account</h2>
      {error && <p className="error">{error}</p>}

      <label>I am a</label>
      <select value={form.role} onChange={set("role")}>
        <option value="consumer">Consumer (I want to buy)</option>
        <option value="farmer">Farmer (I want to sell)</option>
      </select>

      <label>Full name</label>
      <input value={form.full_name} onChange={set("full_name")} required />
      <label>Email</label>
      <input type="email" value={form.email} onChange={set("email")} required />
      <label>Password (at least 6 characters)</label>
      <input type="password" value={form.password} onChange={set("password")} required />
      <label>Phone</label>
      <input value={form.phone} onChange={set("phone")} />
      <label>Address</label>
      <input value={form.address} onChange={set("address")} required />

      <button className="btn" disabled={busy}>{busy ? "Creating..." : "Sign up"}</button>
      <p className="small">Already have an account? <Link to="/login">Login</Link></p>
    </form>
  );
}
