import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client";

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer" });
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await client.post("/auth/register", form);
      nav("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Account</h1>
        <form onSubmit={submit} className="space-y-4">
          <input className="w-full border rounded-lg p-3" placeholder="Full Name"
            value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <input className="w-full border rounded-lg p-3" placeholder="Email"
            type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <input className="w-full border rounded-lg p-3" placeholder="Password"
            type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          <select className="w-full border rounded-lg p-3"
            value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            <option value="customer">Customer</option>
            <option value="agent">Delivery Agent</option>
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">
            Register
          </button>
        </form>
        <p className="text-center mt-4 text-sm text-gray-600">
          Have an account? <Link to="/login" className="text-blue-600">Login</Link>
        </p>
      </div>
    </div>
  );
}