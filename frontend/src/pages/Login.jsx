import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Brand from "../components/Brand";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const me = await login(email, password);
      if (me.role === "admin")       navigate("/admin");
      else if (me.role === "agent")  navigate("/agent");
      else                           navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-brand/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <Brand size="lg" stacked subtitle="Sign in to your account" className="mb-8" />

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="eyebrow mb-2 block">Email</label>
              <input
                type="email" required autoFocus
                className="field"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="eyebrow mb-2 block">Password</label>
              <input
                type="password" required
                className="field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="btn-accent w-full py-3 text-sm flex items-center justify-center gap-2 shadow-brand"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-black/70 border-t-transparent rounded-full animate-spin" /> Signing in…</>
              ) : "Sign in →"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand hover:text-brand-hover font-medium transition">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
