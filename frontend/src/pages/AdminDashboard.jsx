import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import Brand from "../components/Brand";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

const MapView = lazy(() => import("../components/MapView"));

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_META = {
  confirmed:        { label: "Confirmed",        icon: "📋", color: "text-amber-400",   bg: "bg-amber-400/10",   ring: "ring-amber-400/30"   },
  agent_assigned:   { label: "Agent Assigned",   icon: "👤", color: "text-sky-400",     bg: "bg-sky-400/10",     ring: "ring-sky-400/30"     },
  picked_up:        { label: "Picked Up",        icon: "📤", color: "text-violet-400",  bg: "bg-violet-400/10",  ring: "ring-violet-400/30"  },
  in_transit:       { label: "In Transit",       icon: "🚚", color: "text-indigo-400",  bg: "bg-indigo-400/10",  ring: "ring-indigo-400/30"  },
  out_for_delivery: { label: "Out for Delivery", icon: "🛵", color: "text-orange-400",  bg: "bg-orange-400/10",  ring: "ring-orange-400/30"  },
  delivered:        { label: "Delivered",        icon: "✅", color: "text-brand",       bg: "bg-brand/10",       ring: "ring-brand/30"       },
  failed:           { label: "Failed",           icon: "❌", color: "text-red-400",     bg: "bg-red-400/10",     ring: "ring-red-400/30"     },
  rescheduled:      { label: "Rescheduled",      icon: "🔄", color: "text-gray-400",    bg: "bg-gray-400/10",    ring: "ring-gray-400/30"    },
};

const CHART_COLORS = ["#A3E635","#38bdf8","#8b5cf6","#6366f1","#f97316","#f59e0b","#ef4444","#6b7280"];
const TOOLTIP_STYLE = { background: "#161619", border: "1px solid #26262b", borderRadius: 12, fontSize: 12, color: "#f5f5f5" };

const NAV = [
  { id: "overview",  icon: "⚡", label: "Overview"   },
  { id: "orders",    icon: "📦", label: "Orders"     },
  { id: "analytics", icon: "📊", label: "Analytics"  },
  { id: "agents",    icon: "👥", label: "Agents"     },
  { id: "zones",     icon: "🗺️", label: "Zones"      },
  { id: "rates",     icon: "💳", label: "Rate Cards" },
  { id: "map",       icon: "📍", label: "Live Map"   },
];

const STATUS_FILTERS = ["all", "confirmed", "agent_assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "failed", "rescheduled"];

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`card p-5 ring-1 ${accent}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {sub !== undefined && (
          <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">{sub}</span>
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

// Auto-assign + manual assign / reassign controls for one order
function AssignBar({ order, agents, assigning, onAuto, onManual }) {
  if (order.status === "delivered" || order.status === "failed" || order.status === "rescheduled") return null;
  return (
    <div className="flex items-center gap-2 shrink-0">
      {order.status === "confirmed" && (
        <button
          onClick={e => onAuto(order.id, e)}
          disabled={assigning === order.id}
          className="btn-accent text-xs px-3 py-1.5">
          {assigning === order.id ? "…" : "⚡ Auto"}
        </button>
      )}
      <select
        value=""
        onClick={e => e.stopPropagation()}
        onChange={e => { if (e.target.value) onManual(order.id, e.target.value); e.target.value = ""; }}
        className="bg-ink border border-white/10 text-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand max-w-[10rem]">
        <option value="">{order.agent_id ? "Reassign…" : "Assign to…"}</option>
        {agents.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}{a.active_orders ? ` · ${a.active_orders} active` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [page, setPage]             = useState("overview");
  const [orders, setOrders]         = useState([]);
  const [agents, setAgents]         = useState([]);
  const [zones, setZones]           = useState([]);
  const [rateCards, setRateCards]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [assigning, setAssigning]   = useState(null);
  const [assignResults, setAssignResults] = useState({});
  const [statusFilter, setStatusFilter]   = useState("all");
  const [search, setSearch]         = useState("");
  const [mapOrder, setMapOrder]     = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast]           = useState("");

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    try { setOrders((await client.get("/orders/")).data); } catch {}
  };
  const fetchAgents = async () => {
    try { setAgents((await client.get("/agents/")).data); } catch {}
  };
  const fetchZones = async () => {
    try { setZones((await client.get("/zones/")).data); } catch {}
  };
  const fetchRateCards = async () => {
    try { setRateCards((await client.get("/rate-cards/")).data); } catch {}
  };

  useEffect(() => {
    Promise.all([fetchOrders(), fetchAgents(), fetchZones(), fetchRateCards()])
      .finally(() => setLoading(false));
    const t = setInterval(() => { fetchOrders(); fetchAgents(); }, 15000);
    return () => clearInterval(t);
  }, []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  const agentById = agents.reduce((acc, a) => { acc[a.id] = a; return acc; }, {});

  // ── assignment ───────────────────────────────────────────────────────────────
  const autoAssign = async (orderId, e) => {
    e?.stopPropagation();
    setAssigning(orderId);
    try {
      const r = await client.post(`/orders/${orderId}/assign`);
      setAssignResults(prev => ({ ...prev, [orderId]: r.data }));
      flash(`Auto-assigned to ${r.data.agent_name}`);
      fetchOrders(); fetchAgents();
    } catch (err) {
      flash(err.response?.data?.detail || "Assignment failed");
    } finally { setAssigning(null); }
  };

  const manualAssign = async (orderId, agentId) => {
    setAssigning(orderId);
    try {
      const r = await client.post(`/orders/${orderId}/assign-manual`, { agent_id: agentId });
      flash(`Assigned to ${r.data.agent_name}`);
      fetchOrders(); fetchAgents();
    } catch (err) {
      flash(err.response?.data?.detail || "Assignment failed");
    } finally { setAssigning(null); }
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

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  const barData = Object.entries(statusCounts).map(([status, count]) => ({ status: status.replace(/_/g, " "), count }));

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

  const zoneName = (id) => zones.find(z => z.id === id)?.name || `${String(id).slice(0, 6)}…`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-ink border border-white/15 text-white text-sm px-5 py-3 rounded-xl shadow-2xl shadow-black/60">
          {toast}
        </div>
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`${sidebarOpen ? "w-56" : "w-16"} bg-ink border-r border-white/[0.08] flex flex-col transition-all duration-200 shrink-0`}>
        <div className="h-16 flex items-center px-4 border-b border-white/[0.08]">
          {sidebarOpen
            ? <Brand size="sm" subtitle="Admin Console" />
            : <div className="w-8 h-8 rounded-lg bg-brand text-black flex items-center justify-center shrink-0 mx-auto">
                <svg viewBox="0 0 40 40" fill="none" className="w-4 h-4" aria-hidden="true">
                  <path d="M3 30 C 11 30, 12 20, 20 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 6" />
                  <path d="M27 6c-5.52 0-10 4.36-10 9.74 0 6.86 8.6 16.2 9.28 16.93a1 1 0 0 0 1.44 0C28.4 31.94 37 22.6 37 15.74 37 10.36 32.52 6 27 6Z" fill="currentColor" />
                  <circle cx="27" cy="15.5" r="3.6" fill="#000" />
                </svg>
              </div>}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                page === n.id ? "bg-brand text-black" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}>
              <span className="text-base shrink-0">{n.icon}</span>
              {sidebarOpen && <span>{n.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.08]">
          {sidebarOpen ? (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-gray-500 text-xs truncate">{user?.email}</p>
              <button onClick={logout} className="mt-2 w-full text-xs text-red-400 hover:text-red-300 text-left transition">Sign out →</button>
            </div>
          ) : (
            <button onClick={logout} className="w-full flex justify-center py-2 text-red-400 hover:text-red-300 transition text-lg">↩</button>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-ink border-b border-white/[0.08] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(p => !p)} className="text-gray-400 hover:text-white transition text-lg">☰</button>
            <h1 className="text-white font-semibold capitalize">{NAV.find(n => n.id === page)?.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
            <span className="text-gray-400 text-sm">{orders.length} orders · {agents.length} agents · auto-refresh 15s</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── OVERVIEW ─────────────────────────────────────────── */}
              {page === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard icon="📦" label="Total Orders" value={orders.length}    accent="ring-white/10" />
                    <StatCard icon="🔄" label="Active Now"   value={active}            accent="ring-sky-500/20" />
                    <StatCard icon="✅" label="Delivered"    value={delivered}         sub={`${deliveryRate}%`} accent="ring-brand/25" />
                    <StatCard icon="💰" label="Revenue"      value={`₹${revenue.toLocaleString()}`} accent="ring-violet-500/20" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 card p-5">
                      <p className="eyebrow mb-4">Orders by Status</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={barData} barSize={28}>
                          <XAxis dataKey="status" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={24} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                          <Bar dataKey="count" fill="#A3E635" radius={[6,6,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="card p-5">
                      <p className="eyebrow mb-4">Distribution</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={32}>
                            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pending assignments */}
                  {pending > 0 && (
                    <div className="bg-ink border border-amber-500/20 rounded-2xl p-5">
                      <p className="text-amber-400 text-xs font-semibold uppercase tracking-[0.12em] mb-4">
                        ⚡ {pending} Order{pending > 1 ? "s" : ""} Awaiting Assignment
                      </p>
                      <div className="space-y-3">
                        {orders.filter(o => o.status === "confirmed").map(order => (
                          <div key={order.id} className="flex items-center justify-between bg-white/5 rounded-xl p-4 gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm font-medium truncate">{order.pickup_address.split(",")[0]} → {order.drop_address.split(",")[0]}</p>
                              <p className="text-gray-500 text-xs mt-0.5 font-mono">{order.id.slice(0,8)}…</p>
                            </div>
                            <AssignBar order={order} agents={agents} assigning={assigning} onAuto={autoAssign} onManual={manualAssign} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent orders */}
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="eyebrow">Recent Orders</p>
                      <button onClick={() => setPage("orders")} className="text-brand hover:text-brand-hover text-xs transition">View all →</button>
                    </div>
                    <div className="space-y-2">
                      {orders.slice(0, 5).map(order => (
                        <div key={order.id} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
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
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                      <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by address or order ID…" className="field pl-9" />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                      className="bg-ink border border-white/10 text-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand">
                      {STATUS_FILTERS.map(s => (
                        <option key={s} value={s}>{s === "all" ? "All Statuses" : STATUS_META[s]?.label || s}</option>
                      ))}
                    </select>
                  </div>

                  <p className="text-gray-600 text-xs">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</p>

                  <div className="space-y-3">
                    {filtered.length === 0 ? (
                      <div className="card p-12 text-center text-gray-600">No orders found</div>
                    ) : filtered.map(order => {
                      const agent = order.agent_id ? agentById[order.agent_id] : null;
                      return (
                        <div key={order.id} className="card p-5 hover:border-white/20 transition">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-white font-semibold text-sm">
                                  {order.pickup_address.split(",")[0]}
                                  <span className="text-gray-500 mx-2">→</span>
                                  {order.drop_address.split(",")[0]}
                                </p>
                                <StatusBadge status={order.status} />
                                {order.payment_status === "refunded" && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-sky-400 bg-sky-400/10">Refunded</span>
                                )}
                                {order.payment_type === "Prepaid" && order.payment_status === "paid" && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-brand bg-brand/10">Paid</span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                                <span className="font-mono">{order.id.slice(0,8)}…</span>
                                <span>{order.order_type}</span>
                                <span>{order.payment_type}</span>
                                <span className="text-gray-300 font-semibold">₹{order.total_charge}</span>
                                {agent && <span className="text-brand">👤 {agent.name}</span>}
                              </div>
                            </div>
                            <AssignBar order={order} agents={agents} assigning={assigning} onAuto={autoAssign} onManual={manualAssign} />
                          </div>

                          {order.tracking_events?.length > 0 && (
                            <div className="mt-3 flex gap-1.5 flex-wrap">
                              {order.tracking_events.map((ev, i) => {
                                const isLast = i === order.tracking_events.length - 1;
                                return (
                                  <span key={ev.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${isLast ? "bg-brand/15 text-brand" : "bg-white/5 text-gray-500"}`}>
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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon="📦" label="Total Orders"   value={orders.length}              accent="ring-white/10" />
                    <StatCard icon="📈" label="Delivery Rate"  value={`${deliveryRate}%`}         accent="ring-brand/25" />
                    <StatCard icon="❌" label="Failed"         value={failed}                      accent="ring-red-500/20" />
                    <StatCard icon="💰" label="Total Revenue"  value={`₹${revenue.toLocaleString()}`} accent="ring-violet-500/20" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card p-6">
                      <p className="eyebrow mb-5">Orders by Status</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={barData} barSize={30}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e22" vertical={false} />
                          <XAxis dataKey="status" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={24} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                          <Bar dataKey="count" fill="#A3E635" radius={[6,6,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="card p-6">
                      <p className="eyebrow mb-5">Status Distribution</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} paddingAngle={3}>
                            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Agent leaderboard */}
                  <div className="card p-5">
                    <p className="eyebrow mb-4">Agent Leaderboard</p>
                    {agents.length === 0 ? (
                      <p className="text-gray-600 text-sm">No agents yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {[...agents].sort((a, b) => b.delivered_orders - a.delivered_orders).slice(0, 8).map((a, i) => (
                          <div key={a.id} className="flex items-center gap-3 py-2 border-b border-white/[0.06] last:border-0">
                            <span className={`w-6 text-center text-sm font-bold ${i === 0 ? "text-brand" : "text-gray-500"}`}>{i + 1}</span>
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-white">{a.name?.[0]?.toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{a.name}</p>
                              <p className="text-gray-500 text-xs">{a.active_orders} active</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white text-sm font-semibold">{a.delivered_orders} delivered</p>
                              <p className="text-gray-500 text-xs">{Math.round((a.success_rate || 0) * 100)}% success</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[
                      { label: "COD Orders",     value: orders.filter(o => o.payment_type === "COD").length, icon: "💵", color: "text-amber-400" },
                      { label: "Prepaid Orders", value: orders.filter(o => o.payment_type !== "COD").length, icon: "💳", color: "text-sky-400" },
                      { label: "Avg Order Value", value: `₹${orders.length ? (revenue / (delivered || 1)).toFixed(0) : 0}`, icon: "📐", color: "text-brand" },
                    ].map(s => (
                      <div key={s.label} className="card p-5">
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
                    <div className="card p-16 text-center">
                      <p className="text-4xl mb-3">👥</p>
                      <p className="text-gray-400 font-medium">No agents registered yet</p>
                      <p className="text-gray-600 text-sm mt-1">Agents appear here as soon as they register.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {agents.map(a => (
                        <div key={a.id} className="card p-5 hover:border-white/20 transition">
                          <div className="flex items-start gap-4">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center text-black font-bold text-lg shrink-0">
                                {a.name?.[0]?.toUpperCase() || "A"}
                              </div>
                              <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-ink ${a.is_online ? "bg-brand" : "bg-gray-600"}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-semibold truncate">{a.name}</p>
                              <p className="text-gray-500 text-xs truncate">{a.email}</p>
                              <span className={`inline-block mt-1 text-xs font-medium ${a.is_online ? "text-brand" : "text-gray-500"}`}>
                                {a.is_online ? "● Online · sharing GPS" : "○ Offline"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 mt-4">
                            {[
                              { label: "Total",  value: a.total_orders,                       color: "text-white" },
                              { label: "Active", value: a.active_orders,                      color: "text-sky-400" },
                              { label: "Done",   value: a.delivered_orders,                   color: "text-brand" },
                              { label: "Rate",   value: `${Math.round((a.success_rate || 0) * 100)}%`, color: "text-violet-400" },
                            ].map(s => (
                              <div key={s.label} className="bg-white/5 rounded-xl p-2.5 text-center">
                                <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
                                <p className="text-gray-600 text-xs mt-0.5">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ZONES ────────────────────────────────────────────── */}
              {page === "zones" && (
                <ZonesPanel zones={zones} onChange={fetchZones} flash={flash} />
              )}

              {/* ── RATE CARDS ───────────────────────────────────────── */}
              {page === "rates" && (
                <RateCardsPanel rateCards={rateCards} zones={zones} zoneName={zoneName} onChange={fetchRateCards} flash={flash} />
              )}

              {/* ── MAP ──────────────────────────────────────────────── */}
              {page === "map" && (
                <div className="card overflow-hidden" style={{ height: "calc(100vh - 10rem)" }}>
                  <div className="flex h-full">
                    <div className="w-72 bg-ink border-r border-white/[0.08] flex flex-col">
                      <div className="p-4 border-b border-white/[0.08]">
                        <p className="eyebrow">Orders with location ({orders.filter(o => o.pickup_lat).length})</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {orders.filter(o => o.pickup_lat).length === 0 ? (
                          <p className="text-gray-600 text-sm text-center py-8">No orders with coordinates</p>
                        ) : orders.filter(o => o.pickup_lat).map(order => (
                          <div key={order.id}
                            onClick={() => setMapOrder(mapOrder?.id === order.id ? null : order)}
                            className={`p-3 rounded-xl cursor-pointer transition border ${
                              mapOrder?.id === order.id ? "bg-brand/10 border-brand/30" : "border-transparent bg-white/5 hover:bg-white/10"
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

                    <div className="flex-1 relative">
                      <Suspense fallback={<div className="h-full flex items-center justify-center bg-black text-gray-500 text-sm">Loading map…</div>}>
                        <MapView
                          pickup={mapOrder?.pickup_lat ? [mapOrder.pickup_lat, mapOrder.pickup_lng] : null}
                          drop={mapOrder?.drop_lat ? [mapOrder.drop_lat, mapOrder.drop_lng] : null}
                          agent={null}
                        />
                      </Suspense>
                      {!mapOrder && (
                        <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
                          <div className="bg-ink/90 border border-white/15 rounded-2xl px-6 py-3 text-gray-400 text-sm">← Select an order to view on map</div>
                        </div>
                      )}
                      {mapOrder && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-ink border border-white/15 rounded-2xl px-5 py-3 shadow-2xl shadow-black/60">
                          <p className="text-white text-sm font-semibold">{mapOrder.pickup_address.split(",")[0]} → {mapOrder.drop_address.split(",")[0]}</p>
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

// ─── Zones management ─────────────────────────────────────────────────────────

function ZonesPanel({ zones, onChange, flash }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [openZone, setOpenZone] = useState(null);
  const [areas, setAreas] = useState([]);
  const [areaForm, setAreaForm] = useState({ name: "", lat: "", lng: "" });

  const createZone = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await client.post("/zones/", { name: name.trim() }); setName(""); flash("Zone created"); onChange(); }
    catch (e) { flash(e.response?.data?.detail || "Failed to create zone"); }
    finally { setSaving(false); }
  };

  const openAreas = async (zone) => {
    if (openZone?.id === zone.id) { setOpenZone(null); return; }
    setOpenZone(zone);
    try { setAreas((await client.get(`/zones/${zone.id}/areas`)).data); } catch { setAreas([]); }
  };

  const addArea = async () => {
    if (!areaForm.name.trim() || !openZone) return;
    try {
      await client.post(`/zones/${openZone.id}/areas`, {
        name: areaForm.name.trim(),
        lat: areaForm.lat ? +areaForm.lat : null,
        lng: areaForm.lng ? +areaForm.lng : null,
      });
      setAreaForm({ name: "", lat: "", lng: "" });
      setAreas((await client.get(`/zones/${openZone.id}/areas`)).data);
      flash("Area added");
    } catch (e) { flash(e.response?.data?.detail || "Failed to add area"); }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="card p-5">
        <p className="eyebrow mb-3">Create a zone</p>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Zone name (e.g. Mumbai Central)" className="field flex-1" />
          <button onClick={createZone} disabled={saving} className="btn-accent px-5 text-sm whitespace-nowrap">
            {saving ? "…" : "+ Add Zone"}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-2">Zones drive rate-card lookup and zone-based agent matching.</p>
      </div>

      <div className="space-y-3">
        {zones.length === 0 ? (
          <div className="card p-10 text-center text-gray-600">No zones yet — create your first above.</div>
        ) : zones.map(z => (
          <div key={z.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">🗺️</span>
                <p className="text-white font-semibold">{z.name}</p>
              </div>
              <button onClick={() => openAreas(z)} className="text-brand hover:text-brand-hover text-xs transition">
                {openZone?.id === z.id ? "Hide areas" : "Manage areas →"}
              </button>
            </div>

            {openZone?.id === z.id && (
              <div className="mt-4 border-t border-white/[0.08] pt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {areas.length === 0 ? <span className="text-gray-600 text-xs">No areas yet</span>
                    : areas.map(a => <span key={a.id} className="text-xs bg-white/5 text-gray-300 px-2.5 py-1 rounded-full">{a.name}</span>)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input value={areaForm.name} onChange={e => setAreaForm({ ...areaForm, name: e.target.value })} placeholder="Area name" className="field sm:col-span-2 !py-2.5 !text-sm" />
                  <input value={areaForm.lat} onChange={e => setAreaForm({ ...areaForm, lat: e.target.value })} placeholder="Lat (opt)" className="field !py-2.5 !text-sm" />
                  <input value={areaForm.lng} onChange={e => setAreaForm({ ...areaForm, lng: e.target.value })} placeholder="Lng (opt)" className="field !py-2.5 !text-sm" />
                </div>
                <button onClick={addArea} className="btn-ghost text-xs px-4 py-2">+ Add Area</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rate card management ─────────────────────────────────────────────────────

function RateCardsPanel({ rateCards, zones, zoneName, onChange, flash }) {
  const empty = { origin_zone_id: "", dest_zone_id: "", order_type: "B2C", base_rate: "", min_charge: "", cod_surcharge: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.origin_zone_id || !form.dest_zone_id || !form.base_rate || !form.min_charge) {
      flash("Fill zones, base rate and min charge"); return;
    }
    setSaving(true);
    try {
      await client.post("/rate-cards/", {
        origin_zone_id: form.origin_zone_id,
        dest_zone_id: form.dest_zone_id,
        order_type: form.order_type,
        base_rate: +form.base_rate,
        min_charge: +form.min_charge,
        cod_surcharge: +(form.cod_surcharge || 0),
      });
      setForm(empty); flash("Rate card created"); onChange();
    } catch (e) { flash(e.response?.data?.detail || "Failed to create rate card"); }
    finally { setSaving(false); }
  };

  const toggleActive = async (card) => {
    try { await client.patch(`/rate-cards/${card.id}`, { is_active: !card.is_active }); onChange(); }
    catch (e) { flash(e.response?.data?.detail || "Update failed"); }
  };

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <p className="eyebrow mb-3">Create a rate card</p>
        {zones.length < 1 ? (
          <p className="text-amber-400/80 text-sm">Create at least one zone first (Zones tab).</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
            <select value={form.origin_zone_id} onChange={e => setForm({ ...form, origin_zone_id: e.target.value })}
              className="field !py-2.5 !text-sm lg:col-span-2">
              <option value="">Origin zone</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <select value={form.dest_zone_id} onChange={e => setForm({ ...form, dest_zone_id: e.target.value })}
              className="field !py-2.5 !text-sm lg:col-span-2">
              <option value="">Destination zone</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            <select value={form.order_type} onChange={e => setForm({ ...form, order_type: e.target.value })}
              className="field !py-2.5 !text-sm">
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
            </select>
            <input value={form.base_rate} onChange={e => setForm({ ...form, base_rate: e.target.value })} type="number" placeholder="Base ₹/kg" className="field !py-2.5 !text-sm" />
            <input value={form.min_charge} onChange={e => setForm({ ...form, min_charge: e.target.value })} type="number" placeholder="Min charge ₹" className="field !py-2.5 !text-sm" />
            <input value={form.cod_surcharge} onChange={e => setForm({ ...form, cod_surcharge: e.target.value })} type="number" placeholder="COD surcharge ₹" className="field !py-2.5 !text-sm" />
            <button onClick={create} disabled={saving} className="btn-accent text-sm py-2.5 lg:col-span-2">
              {saving ? "…" : "+ Add Rate Card"}
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-gray-500 border-b border-white/[0.08]">
              <th className="px-5 py-3 font-medium">Origin</th>
              <th className="px-5 py-3 font-medium">Destination</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Base ₹/kg</th>
              <th className="px-5 py-3 font-medium">Min ₹</th>
              <th className="px-5 py-3 font-medium">COD ₹</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rateCards.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-600">No rate cards yet.</td></tr>
            ) : rateCards.map(c => (
              <tr key={c.id} className="border-b border-white/[0.06] last:border-0 text-gray-300">
                <td className="px-5 py-3">{zoneName(c.origin_zone_id)}</td>
                <td className="px-5 py-3">{zoneName(c.dest_zone_id)}</td>
                <td className="px-5 py-3">{c.order_type}</td>
                <td className="px-5 py-3 text-white font-semibold">₹{c.base_rate}</td>
                <td className="px-5 py-3">₹{c.min_charge}</td>
                <td className="px-5 py-3">₹{c.cod_surcharge}</td>
                <td className="px-5 py-3">
                  <button onClick={() => toggleActive(c)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.is_active ? "text-brand bg-brand/10" : "text-gray-500 bg-white/5"}`}>
                    {c.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
