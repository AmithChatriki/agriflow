import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Farmer from "./pages/Farmer";

export default function App() {
  const { profile, loading, logout } = useAuth();
  const { items, clearCart } = useCart();
  const navigate = useNavigate();

  if (loading) return <p className="center">Loading...</p>;

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="brand">AgriFlow</Link>
        <div className="nav-links">
          {profile?.role === "consumer" && (
            <>
              <Link to="/cart">Cart ({items.length})</Link>
              <Link to="/orders">My Orders</Link>
            </>
          )}
          {profile?.role === "farmer" && <Link to="/farmer">My Dashboard</Link>}
          {profile ? (
            <>
              <span>Hi, {profile.full_name} ({profile.role})</span>
              <button
                className="btn-outline"
                onClick={() => { logout(); clearCart(); navigate("/"); }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup" className="btn">Sign up</Link>
            </>
          )}
        </div>
      </nav>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/farmer" element={<Farmer />} />
        </Routes>
      </main>
    </>
  );
}
