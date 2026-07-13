import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client";
import Brand from "../components/Brand";

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await client.post("/auth/register", form);
      nav("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-brand/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative">
        <Brand size="lg" stacked subtitle="Create your account" className="mb-8" />

        <div className="card p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="eyebrow mb-2 block">Full name</label>
              <input className="field" placeholder="Jane Doe"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="eyebrow mb-2 block">Email</label>
              <input className="field" placeholder="you@example.com" type="email"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="eyebrow mb-2 block">Password</label>
              <input className="field" placeholder="••••••••" type="password"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label className="eyebrow mb-2 block">I am a</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "customer", label: "Customer", icon: "📦" },
                  { v: "agent",    label: "Delivery Agent", icon: "🛵" },
                ].map(r => (
                  <button key={r.v} type="button" onClick={() => setForm({ ...form, role: r.v })}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                      form.role === r.v
                        ? "bg-brand text-black"
                        : "bg-ink-raised text-gray-400 hover:text-white border border-white/10"
                    }`}>
                    <span>{r.icon}</span> {r.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button disabled={loading} className="btn-accent w-full py-3 text-sm shadow-brand">
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-sm text-gray-500">
          Have an account?{" "}
          <Link to="/login" className="text-brand hover:text-brand-hover font-medium transition">Login</Link>
        </p>
      </div>
    </div>
  );
}
