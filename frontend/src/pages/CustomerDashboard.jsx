import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

const statusMeta = {
  confirmed:        { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400",   label: "Confirmed" },
  agent_assigned:   { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-400",    label: "Agent Assigned" },
  picked_up:        { color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200",  dot: "bg-violet-400",  label: "Picked Up" },
  in_transit:       { color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200",  dot: "bg-indigo-400",  label: "In Transit" },
  out_for_delivery: { color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  dot: "bg-orange-400",  label: "Out for Delivery" },
  delivered:        { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400", label: "Delivered" },
  failed:           { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-400",     label: "Failed" },
  rescheduled:      { color: "text-gray-700",    bg: "bg-gray-50",    border: "border-gray-200",    dot: "bg-gray-400",    label: "Rescheduled" },
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
    <div className="min-h-screen bg-gray-950">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-10">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
              LM
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Last-Mile</p>
              <p className="text-gray-400 text-xs">Tracker</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-gray-400 text-xs">Customer</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-sm font-medium">
            <span>📦</span> My Orders
          </button>
          <button
            onClick={() => navigate("/orders/new")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white text-sm transition"
          >
            <span>➕</span> New Order
          </button>
        </nav>

        <div className="p-4 border-t border-gray-800">
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
        <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h1 className="text-white text-xl font-bold">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-0.5">Track and manage your deliveries</p>
          </div>
          <button
            onClick={() => navigate("/orders/new")}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-blue-900/30"
          >
            <span>+</span> New Order
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-5">
            {[
              { label: "Total Orders", value: total,      icon: "📦", gradient: "from-blue-600 to-blue-700",    sub: "All time" },
              { label: "Active",       value: active,     icon: "🚚", gradient: "from-violet-600 to-violet-700", sub: "In progress" },
              { label: "Delivered",    value: delivered,  icon: "✅", gradient: "from-emerald-600 to-emerald-700", sub: "Completed" },
              { label: "Total Spent",  value: `₹${revenue}`, icon: "💰", gradient: "from-orange-500 to-orange-600", sub: "Lifetime" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-lg mb-4`}>
                  {s.icon}
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-gray-400 text-sm mt-1">{s.label}</p>
                <p className="text-gray-600 text-xs mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs + orders */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Orders</h2>
              <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
                {["all","active","delivered","failed"].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                      filter === f
                        ? "bg-blue-600 text-white"
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
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse h-24" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-white font-semibold">No orders yet</p>
                <p className="text-gray-400 text-sm mt-1">Place your first order to get started</p>
                <button
                  onClick={() => navigate("/orders/new")}
                  className="mt-5 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
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
                      className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-5 cursor-pointer transition-all group"
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
                          <span className="text-blue-400 font-bold text-sm">₹{order.total_charge}</span>
                          <span className="text-gray-600 group-hover:text-gray-400 text-sm transition">→</span>
                        </div>
                      </div>

                      {step >= 0 && (
                        <div className="mt-4">
                          <div className="flex gap-1">
                            {STATUS_STEPS.map((_, i) => (
                              <div key={i} className={`h-1 rounded-full flex-1 transition-all ${i <= step ? "bg-blue-500" : "bg-gray-700"}`} />
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
