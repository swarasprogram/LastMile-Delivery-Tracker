import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";

const MapView = lazy(() => import("../components/MapView"));

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_META = {
  confirmed:        { label: "Confirmed",        icon: "📋", color: "text-amber-400",   bg: "bg-amber-400/10",   ring: "ring-amber-400/30"   },
  agent_assigned:   { label: "Agent Assigned",   icon: "👤", color: "text-blue-400",    bg: "bg-blue-400/10",    ring: "ring-blue-400/30"    },
  picked_up:        { label: "Picked Up",        icon: "📤", color: "text-violet-400",  bg: "bg-violet-400/10",  ring: "ring-violet-400/30"  },
  in_transit:       { label: "In Transit",       icon: "🚚", color: "text-indigo-400",  bg: "bg-indigo-400/10",  ring: "ring-indigo-400/30"  },
  out_for_delivery: { label: "Out for Delivery", icon: "🛵", color: "text-orange-400",  bg: "bg-orange-400/10",  ring: "ring-orange-400/30"  },
  delivered:        { label: "Delivered",        icon: "✅", color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "ring-emerald-400/30" },
  failed:           { label: "Failed",           icon: "❌", color: "text-red-400",     bg: "bg-red-400/10",     ring: "ring-red-400/30"     },
  rescheduled:      { label: "Rescheduled",      icon: "🔄", color: "text-gray-400",    bg: "bg-gray-400/10",    ring: "ring-gray-400/30"    },
};

const CHART_COLORS = ["#f59e0b","#3b82f6","#8b5cf6","#6366f1","#f97316","#10b981","#ef4444","#6b7280"];

const NAV = [
  { id: "overview",  icon: "⚡", label: "Overview"  },
  { id: "orders",    icon: "📦", label: "Orders"    },
  { id: "analytics", icon: "📊", label: "Analytics" },
  { id: "agents",    icon: "👥", label: "Agents"    },
  { id: "map",       icon: "🗺️", label: "Live Map"  },
];

const STATUS_FILTERS = ["all", "confirmed", "agent_assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "failed", "rescheduled"];

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 ring-1 ${accent}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {sub !== undefined && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{sub}</span>
        )}
      </div>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: "text-gray-400", bg: "bg-gray-400/10" };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.color} ${m.bg}`}>
      {m.icon} {m.label}
    </span>
  );
}

function AssignResult({ result }) {
  if (!result) return null;
  return (
    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex flex-wrap gap-4 text-xs">
      <span className="text-blue-300 font-semibold">✓ {result.agent_name}</span>
      <span className="text-gray-400">{result.distance_km} km away</span>
      <span className="text-gray-400">Active: {result.active_orders}</span>
      <span className="text-gray-400">Score: {result.composite_score?.toFixed(2)}</span>
      <span className="text-gray-400">Success: {(result.success_rate * 100).toFixed(0)}%</span>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [page, setPage]             = useState("overview");
  const [orders, setOrders]         = useState([]);
  const [agentNameMap, setAgentNameMap] = useState({});  // id → name from assign results
  const [loading, setLoading]       = useState(true);
  const [assigning, setAssigning]   = useState(null);
  const [assignResults, setAssignResults] = useState({});
  const [statusFilter, setStatusFilter]   = useState("all");
  const [search, setSearch]         = useState("");
  const [mapOrder, setMapOrder]     = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    try {
      const r = await client.get("/orders/");
      setOrders(r.data);
    } catch {}
  };

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false));
    const t = setInterval(fetchOrders, 15000);
    return () => clearInterval(t);
  }, []);

  // Derive agents from orders — group by agent_id
  const agentMap = orders.reduce((acc, o) => {
    if (!o.agent_id) return acc;
    if (!acc[o.agent_id]) {
      acc[o.agent_id] = {
        id: o.agent_id,
        name: agentNameMap[o.agent_id] || null,
        orders: [],
      };
    }
    acc[o.agent_id].orders.push(o);
    return acc;
  }, {});
  const agents = Object.values(agentMap);

  // ── actions ────────────────────────────────────────────────────────────────
  const autoAssign = async (orderId, e) => {
    e?.stopPropagation();
    setAssigning(orderId);
    try {
      const r = await client.post(`/orders/${orderId}/assign`);
      setAssignResults(prev => ({ ...prev, [orderId]: r.data }));
      // Cache agent name so the Agents tab can show it
      if (r.data.assigned_agent_id && r.data.agent_name) {
        setAgentNameMap(prev => ({ ...prev, [r.data.assigned_agent_id]: r.data.agent_name }));
      }
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.detail || "Assignment failed");
    } finally {
      setAssigning(null);
    }
  };

  // ── derived stats ──────────────────────────────────────────────────────────
  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const delivered  = statusCounts.delivered  || 0;
  const failed     = statusCounts.failed     || 0;
  const pending    = statusCounts.confirmed  || 0;
  const active     = (statusCounts.agent_assigned || 0) + (statusCounts.picked_up || 0) +
                     (statusCounts.in_transit || 0) + (statusCounts.out_for_delivery || 0);
  const revenue    = orders.filter(o => o.status === "delivered")
                           .reduce((s, o) => s + (o.total_charge || 0), 0);
  const deliveryRate = orders.length ? ((delivered / orders.length) * 100).toFixed(1) : "0.0";

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));
  const barData = Object.entries(statusCounts).map(([status, count]) => ({
    status: status.replace(/_/g, " "),
    count,
  }));

  // ── filtered orders ────────────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.pickup_address?.toLowerCase().includes(q) ||
      o.drop_address?.toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`${sidebarOpen ? "w-56" : "w-16"} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">LM</div>
          {sidebarOpen && <span className="text-white font-bold text-sm truncate">Admin Panel</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                page === n.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              <span className="text-base shrink-0">{n.icon}</span>
              {sidebarOpen && <span>{n.label}</span>}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-gray-800">
          {sidebarOpen ? (
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-gray-500 text-xs truncate">{user?.email}</p>
              <button onClick={logout}
                className="mt-2 w-full text-xs text-red-400 hover:text-red-300 text-left transition">
                Sign out →
              </button>
            </div>
          ) : (
            <button onClick={logout}
              className="w-full flex justify-center py-2 text-red-400 hover:text-red-300 transition text-lg">
              ↩
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(p => !p)}
              className="text-gray-400 hover:text-white transition text-lg">
              ☰
            </button>
            <h1 className="text-white font-semibold capitalize">
              {NAV.find(n => n.id === page)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-gray-400 text-sm">{orders.length} orders · auto-refresh 15s</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── OVERVIEW ─────────────────────────────────────────── */}
              {page === "overview" && (
                <div className="space-y-6">
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard icon="📦" label="Total Orders"   value={orders.length}    accent="ring-gray-700"         />
                    <StatCard icon="🔄" label="Active Now"     value={active}            accent="ring-blue-500/20"      />
                    <StatCard icon="✅" label="Delivered"      value={delivered}         sub={`${deliveryRate}%`} accent="ring-emerald-500/20" />
                    <StatCard icon="💰" label="Revenue"        value={`₹${revenue.toLocaleString()}`} accent="ring-indigo-500/20" />
                  </div>

                  {/* Quick charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Bar */}
                    <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Orders by Status</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={barData} barSize={28}>
                          <XAxis dataKey="status" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={24} />
                          <Tooltip
                            contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, fontSize: 12 }}
                            cursor={{ fill: "#1f2937" }}
                          />
                          <Bar dataKey="count" fill="#6366f1" radius={[6,6,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Pie */}
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Distribution</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={32}>
                            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pending assignments */}
                  {pending > 0 && (
                    <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
                          ⚡ {pending} Order{pending > 1 ? "s" : ""} Awaiting Assignment
                        </p>
                      </div>
                      <div className="space-y-3">
                        {orders.filter(o => o.status === "confirmed").map(order => (
                          <div key={order.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm font-medium truncate">{order.pickup_address.split(",")[0]} → {order.drop_address.split(",")[0]}</p>
                              <p className="text-gray-500 text-xs mt-0.5 font-mono">{order.id.slice(0,8)}…</p>
                            </div>
                            <button
                              onClick={e => autoAssign(order.id, e)}
                              disabled={assigning === order.id}
                              className="ml-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 shrink-0">
                              {assigning === order.id ? "Assigning…" : "⚡ Assign"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent orders */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Recent Orders</p>
                      <button onClick={() => setPage("orders")} className="text-indigo-400 hover:text-indigo-300 text-xs transition">View all →</button>
                    </div>
                    <div className="space-y-2">
                      {orders.slice(0, 5).map(order => (
                        <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl">{STATUS_META[order.status]?.icon || "📦"}</span>
                            <div className="min-w-0">
                              <p className="text-white text-sm truncate">{order.pickup_address.split(",")[0]} → {order.drop_address.split(",")[0]}</p>
                              <p className="text-gray-500 text-xs font-mono">{order.id.slice(0,8)}…</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-gray-300 text-sm font-semibold">₹{order.total_charge}</span>
                            <StatusBadge status={order.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── ORDERS ───────────────────────────────────────────── */}
              {page === "orders" && (
                <div className="space-y-4">
                  {/* Search + filter */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by address or order ID…"
                        className="w-full bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="bg-gray-900 border border-gray-800 text-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                      {STATUS_FILTERS.map(s => (
                        <option key={s} value={s}>{s === "all" ? "All Statuses" : STATUS_META[s]?.label || s}</option>
                      ))}
                    </select>
                  </div>

                  <p className="text-gray-600 text-xs">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</p>

                  {/* Orders list */}
                  <div className="space-y-3">
                    {filtered.length === 0 ? (
                      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-600">
                        No orders found
                      </div>
                    ) : filtered.map(order => {
                      const result = assignResults[order.id];
                      return (
                        <div key={order.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition">
                          <div className="flex items-start justify-between gap-4">
                            {/* Left info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-white font-semibold text-sm">
                                  {order.pickup_address.split(",")[0]}
                                  <span className="text-gray-500 mx-2">→</span>
                                  {order.drop_address.split(",")[0]}
                                </p>
                                <StatusBadge status={order.status} />
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                                <span className="font-mono">{order.id.slice(0,8)}…</span>
                                <span>{order.order_type}</span>
                                <span>{order.payment_type}</span>
                                <span className="text-gray-300 font-semibold">₹{order.total_charge}</span>
                              </div>
                              {order.agent_id && (
                                <p className="text-indigo-400 text-xs mt-1">👤 Agent assigned</p>
                              )}
                            </div>

                            {/* Right actions */}
                            <div className="shrink-0">
                              {order.status === "confirmed" && (
                                <button
                                  onClick={e => autoAssign(order.id, e)}
                                  disabled={assigning === order.id}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">
                                  {assigning === order.id ? "Assigning…" : "⚡ Auto-Assign"}
                                </button>
                              )}
                            </div>
                          </div>

                          <AssignResult result={result} />

                          {/* Timeline chips */}
                          {order.tracking_events?.length > 0 && (
                            <div className="mt-3 flex gap-1.5 flex-wrap">
                              {order.tracking_events.map((ev, i) => {
                                const isLast = i === order.tracking_events.length - 1;
                                return (
                                  <span key={ev.id}
                                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                      isLast ? "bg-indigo-500/20 text-indigo-300" : "bg-gray-800 text-gray-500"
                                    }`}>
                                    {ev.status.replace(/_/g, " ")}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── ANALYTICS ────────────────────────────────────────── */}
              {page === "analytics" && (
                <div className="space-y-6">
                  {/* KPI row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon="📦" label="Total Orders"   value={orders.length}              accent="ring-gray-700" />
                    <StatCard icon="📈" label="Delivery Rate"  value={`${deliveryRate}%`}         accent="ring-emerald-500/20" />
                    <StatCard icon="❌" label="Failed"         value={failed}                      accent="ring-red-500/20" />
                    <StatCard icon="💰" label="Total Revenue"  value={`₹${revenue.toLocaleString()}`} accent="ring-indigo-500/20" />
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-5">Orders by Status</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={barData} barSize={30}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="status" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={24} />
                          <Tooltip
                            contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, fontSize: 12 }}
                            cursor={{ fill: "#1f2937" }}
                          />
                          <Bar dataKey="count" fill="#6366f1" radius={[6,6,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-5">Status Distribution</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} paddingAngle={3}>
                            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Revenue / delivery breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[
                      { label: "COD Orders",     value: orders.filter(o => o.payment_type === "COD").length,     icon: "💵", color: "text-amber-400"   },
                      { label: "Prepaid Orders",  value: orders.filter(o => o.payment_type !== "COD").length,     icon: "💳", color: "text-blue-400"    },
                      { label: "Avg Order Value", value: `₹${orders.length ? (revenue / (delivered || 1)).toFixed(0) : 0}`, icon: "📐", color: "text-indigo-400" },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <span className="text-2xl">{s.icon}</span>
                        <p className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
                        <p className="text-gray-500 text-sm mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── AGENTS ───────────────────────────────────────────── */}
              {page === "agents" && (
                <div className="space-y-4">
                  {agents.length === 0 ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
                      <p className="text-4xl mb-3">👥</p>
                      <p className="text-gray-400 font-medium">No assigned agents yet</p>
                      <p className="text-gray-600 text-sm mt-1">Agents will appear here once orders are auto-assigned to them.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {agents.map(agent => {
                        const agentDelivered = agent.orders.filter(o => o.status === "delivered").length;
                        const agentActive    = agent.orders.filter(o =>
                          ["agent_assigned","picked_up","in_transit","out_for_delivery"].includes(o.status)
                        ).length;
                        const agentFailed    = agent.orders.filter(o => o.status === "failed").length;
                        const successRate    = agent.orders.length
                          ? ((agentDelivered / agent.orders.length) * 100).toFixed(0)
                          : "—";
                        const displayName    = agent.name || `Agent …${String(agent.id).slice(-6)}`;
                        const initial        = agent.name ? agent.name.charAt(0).toUpperCase() : "A";

                        return (
                          <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-white font-semibold">{displayName}</p>
                                <p className="text-gray-600 text-xs font-mono mt-0.5 truncate">{agent.id}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mt-4">
                              {[
                                { label: "Total",     value: agent.orders.length, color: "text-white"         },
                                { label: "Active",    value: agentActive,          color: "text-blue-400"     },
                                { label: "Done",      value: agentDelivered,       color: "text-emerald-400"  },
                                { label: "Rate",      value: `${successRate}%`,    color: "text-indigo-400"   },
                              ].map(s => (
                                <div key={s.label} className="bg-gray-800/60 rounded-xl p-2.5 text-center">
                                  <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
                                  <p className="text-gray-600 text-xs mt-0.5">{s.label}</p>
                                </div>
                              ))}
                            </div>

                            {/* Mini order status breakdown */}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {agent.orders.slice(0,6).map(o => (
                                <StatusBadge key={o.id} status={o.status} />
                              ))}
                              {agent.orders.length > 6 && (
                                <span className="text-xs text-gray-600 px-2 py-1">+{agent.orders.length - 6} more</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── MAP ──────────────────────────────────────────────── */}
              {page === "map" && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 10rem)" }}>
                  <div className="flex h-full">
                    {/* Order list sidebar */}
                    <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col">
                      <div className="p-4 border-b border-gray-800">
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                          Orders with location ({orders.filter(o => o.pickup_lat).length})
                        </p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {orders.filter(o => o.pickup_lat).length === 0 ? (
                          <p className="text-gray-600 text-sm text-center py-8">No orders with coordinates</p>
                        ) : orders.filter(o => o.pickup_lat).map(order => (
                          <div key={order.id}
                            onClick={() => setMapOrder(mapOrder?.id === order.id ? null : order)}
                            className={`p-3 rounded-xl cursor-pointer transition border ${
                              mapOrder?.id === order.id
                                ? "bg-indigo-600/10 border-indigo-500/30"
                                : "border-transparent bg-gray-800/40 hover:bg-gray-800"
                            }`}>
                            <p className="text-white text-sm font-medium truncate">{order.pickup_address.split(",")[0]}</p>
                            <p className="text-gray-500 text-xs truncate">→ {order.drop_address.split(",")[0]}</p>
                            <div className="flex items-center justify-between mt-2">
                              <StatusBadge status={order.status} />
                              <span className="text-gray-500 text-xs">₹{order.total_charge}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Map */}
                    <div className="flex-1 relative">
                      <Suspense fallback={
                        <div className="h-full flex items-center justify-center bg-gray-950 text-gray-500 text-sm">Loading map…</div>
                      }>
                        <MapView
                          pickup={mapOrder?.pickup_lat ? [mapOrder.pickup_lat, mapOrder.pickup_lng] : null}
                          drop={mapOrder?.drop_lat ? [mapOrder.drop_lat, mapOrder.drop_lng] : null}
                          agent={null}
                        />
                      </Suspense>

                      {!mapOrder && (
                        <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
                          <div className="bg-gray-900/90 border border-gray-700 rounded-2xl px-6 py-3 text-gray-400 text-sm">
                            ← Select an order to view on map
                          </div>
                        </div>
                      )}

                      {mapOrder && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 shadow-xl">
                          <p className="text-white text-sm font-semibold">
                            {mapOrder.pickup_address.split(",")[0]} → {mapOrder.drop_address.split(",")[0]}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <StatusBadge status={mapOrder.status} />
                            <span className="text-gray-500 text-xs">₹{mapOrder.total_charge}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
