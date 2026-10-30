import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

export default function App() {
  const { profile, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return <p className="center">Loading...</p>;

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="brand">AgriFlow</Link>
        <div className="nav-links">
          {profile ? (
            <>
              <span>Hi, {profile.full_name} ({profile.role})</span>
              <button
                className="btn-outline"
                onClick={() => { logout(); navigate("/"); }}
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
        </Routes>
      </main>
    </>
  );
}
