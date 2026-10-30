import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the login when the page is refreshed
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api("/me")
      .then(setProfile)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(data.access_token);
    setProfile(data.profile);
    return data.profile;
  }

  async function signup(form) {
    await api("/auth/signup", { method: "POST", body: form });
  }

  function logout() {
    setToken(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
