import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import Brand from "../components/Brand";

const statusMeta = {
  confirmed:        { color: "text-amber-400",   bg: "bg-amber-400/10",   dot: "bg-amber-400",   label: "Confirmed" },
  agent_assigned:   { color: "text-sky-400",     bg: "bg-sky-400/10",     dot: "bg-sky-400",     label: "Agent Assigned" },
  picked_up:        { color: "text-violet-400",  bg: "bg-violet-400/10",  dot: "bg-violet-400",  label: "Picked Up" },
  in_transit:       { color: "text-indigo-400",  bg: "bg-indigo-400/10",  dot: "bg-indigo-400",  label: "In Transit" },
  out_for_delivery: { color: "text-orange-400",  bg: "bg-orange-400/10",  dot: "bg-orange-400",  label: "Out for Delivery" },
  delivered:        { color: "text-brand",       bg: "bg-brand/10",       dot: "bg-brand",       label: "Delivered" },
  failed:           { color: "text-red-400",     bg: "bg-red-400/10",     dot: "bg-red-400",     label: "Failed" },
  rescheduled:      { color: "text-gray-400",    bg: "bg-gray-400/10",    dot: "bg-gray-400",    label: "Rescheduled" },
};

const STATUS_STEPS = ["confirmed","agent_assigned","picked_up","in_transit","out_for_delivery","delivered"];

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    client.get("/orders/").then(r => { setOrders(r.data); setLoading(false); });
  }, []);

  const total     = orders.length;
  const active    = orders.filter(o => !["delivered","failed"].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === "delivered").length;
  const revenue   = orders.reduce((s, o) => s + (Number(o.total_charge) || 0), 0).toFixed(0);

  const filtered = filter === "all" ? orders
    : filter === "active" ? orders.filter(o => !["delivered","failed"].includes(o.status))
    : orders.filter(o => o.status === filter);

  return (
    <div className="min-h-screen bg-black">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-ink border-r border-white/[0.08] flex flex-col z-10">
        <div className="p-6 border-b border-white/[0.08]">
          <Brand size="md" subtitle="Delivery Tracking" />
        </div>

        <div className="p-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-black text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-gray-500 text-xs">Customer</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand/10 text-brand text-sm font-medium">
            <span>📦</span> My Orders
          </button>
          <button
            onClick={() => navigate("/orders/new")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white text-sm transition"
          >
            <span>➕</span> New Order
          </button>
        </nav>

        <div className="p-4 border-t border-white/[0.08]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 text-sm transition"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64 min-h-screen">
        {/* Header */}
        <div className="border-b border-white/[0.08] bg-black/60 backdrop-blur px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h1 className="text-white text-xl font-bold">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Track and manage your deliveries</p>
          </div>
          <button
            onClick={() => navigate("/orders/new")}
            className="btn-accent flex items-center gap-2 px-5 py-2.5 text-sm shadow-brand"
          >
            <span>+</span> New Order
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-5">
            {[
              { label: "Total Orders", value: total,         icon: "📦", sub: "All time",   accent: false },
              { label: "Active",       value: active,        icon: "🚚", sub: "In progress", accent: false },
              { label: "Delivered",    value: delivered,     icon: "✅", sub: "Completed",   accent: false },
              { label: "Total Spent",  value: `₹${revenue}`, icon: "💰", sub: "Lifetime",    accent: true  },
            ].map(s => (
              <div key={s.label} className="card p-5 hover:border-white/20 transition">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg mb-4">
                  {s.icon}
                </div>
                <p className={`text-2xl font-bold ${s.accent ? "text-brand" : "text-white"}`}>{s.value}</p>
                <p className="text-gray-400 text-sm mt-1">{s.label}</p>
                <p className="text-gray-600 text-xs mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs + orders */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Orders</h2>
              <div className="flex gap-1 bg-ink border border-white/[0.08] rounded-xl p-1">
                {["all","active","delivered","failed"].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                      filter === f
                        ? "bg-brand text-black"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="card p-5 animate-pulse h-24" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card p-16 text-center">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-white font-semibold">No orders yet</p>
                <p className="text-gray-500 text-sm mt-1">Place your first order to get started</p>
                <button
                  onClick={() => navigate("/orders/new")}
                  className="btn-accent mt-5 px-6 py-2.5 text-sm"
                >
                  + New Order
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(order => {
                  const meta = statusMeta[order.status] || statusMeta.confirmed;
                  const step = STATUS_STEPS.indexOf(order.status);
                  return (
                    <div
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="card p-5 cursor-pointer hover:border-white/25 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                            <p className="text-white font-semibold truncate">{order.pickup_address.split(",")[0]}</p>
                          </div>
                          <p className="text-gray-400 text-sm truncate ml-4">→ {order.drop_address.split(",")[0]}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${meta.color} ${meta.bg}`}>
                            {meta.label}
                          </span>
                          <span className="text-brand font-bold text-sm">₹{order.total_charge}</span>
                          <span className="text-gray-600 group-hover:text-gray-400 text-sm transition">→</span>
                        </div>
                      </div>

                      {step >= 0 && (
                        <div className="mt-4">
                          <div className="flex gap-1">
                            {STATUS_STEPS.map((_, i) => (
                              <div key={i} className={`h-1 rounded-full flex-1 transition-all ${i <= step ? "bg-brand" : "bg-white/10"}`} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between mt-3 text-xs text-gray-500">
                        <span>{order.order_type} · {order.payment_type}</span>
                        <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
