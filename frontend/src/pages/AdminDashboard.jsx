import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const MapView = lazy(() => import("../components/MapView"));

const statusMeta = {
  confirmed:        { color: "text-amber-600",   bg: "bg-amber-50",   label: "Confirmed" },
  agent_assigned:   { color: "text-blue-600",    bg: "bg-blue-50",    label: "Agent Assigned" },
  picked_up:        { color: "text-violet-600",  bg: "bg-violet-50",  label: "Picked Up" },
  in_transit:       { color: "text-indigo-600",  bg: "bg-indigo-50",  label: "In Transit" },
  out_for_delivery: { color: "text-orange-600",  bg: "bg-orange-50",  label: "Out for Delivery" },
  delivered:        { color: "text-emerald-600", bg: "bg-emerald-50", label: "Delivered" },
  failed:           { color: "text-red-600",     bg: "bg-red-50",     label: "Failed" },
  rescheduled:      { color: "text-gray-600",    bg: "bg-gray-50",    label: "Rescheduled" },
};

const COLORS = ["#f59e0b","#3b82f6","#8b5cf6","#6366f1","#f97316","#10b981","#ef4444","#6b7280"];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("orders");
  const [assigning, setAssigning] = useState(null);
  const [assignResults, setAssignResults] = useState({});
  const [mapOrder, setMapOrder] = useState(null);

  const fetchOrders = async () => {
    const r = await client.get("/orders/");
    setOrders(r.data);
  };

  useEffect(() => { fetchOrders(); }, []);

  const autoAssign = async (orderId, e) => {
    e.stopPropagation();
    setAssigning(orderId);
    try {
      const r = await client.post(`/orders/${orderId}/assign`);
      setAssignResults(prev => ({ ...prev, [orderId]: r.data }));
      fetchOrders();
    } catch(e) {
      alert(e.response?.data?.detail || "Assignment failed");
    } finally { setAssigning(null); }
  };

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace(/_/g," "), value }));
  const barData = Object.entries(statusCounts).map(([status, count]) => ({ status: status.replace(/_/g," "), count }));
  const revenue = orders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total_charge || 0), 0);
  const delivered = orders.filter(o => o.status === "delivered").length;
  const failed = orders.filter(o => o.status === "failed").length;
  const pending = orders.filter(o => o.status === "confirmed").length;

  const stats = [
    { label: "Total Orders", value: orders.length, color: "text-blue-600", bg: "bg-blue-50", icon: "📦" },
    { label: "Pending", value: pending, color: "text-amber-600", bg: "bg-amber-50", icon: "⏳" },
    { label: "Delivered", value: delivered, color: "text-emerald-600", bg: "bg-emerald-50", icon: "✅" },
    { label: "Revenue", value: `₹${revenue}`, color: "text-purple-600", bg: "bg-purple-50", icon: "💰" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <span className="text-xl font-bold">Admin Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-80">{user?.name}</span>
          <button onClick={logout} className="bg-white/20 hover:bg-white/30 text-sm px-3 py-1.5 rounded-lg transition">Logout</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-white shadow-sm`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-500 font-medium">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
                <span className="text-3xl">{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 w-fit">
          {["orders","analytics","map"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl font-medium capitalize text-sm transition-all ${tab === t ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "orders" ? "📋 Orders" : t === "analytics" ? "📊 Analytics" : "🗺️ Map"}
            </button>
          ))}
        </div>

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="space-y-3">
            {orders.map(order => {
              const meta = statusMeta[order.status] || {};
              const result = assignResults[order.id];
              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{order.pickup_address} → {order.drop_address}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{order.order_type} · {order.payment_type} · ₹{order.total_charge} · <span className="font-mono">{order.id.slice(0,8)}...</span></p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${meta.color} ${meta.bg}`}>{meta.label}</span>
                      {order.status === "confirmed" && (
                        <button onClick={(e) => autoAssign(order.id, e)} disabled={assigning === order.id}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50 font-medium">
                          {assigning === order.id ? "Assigning..." : "⚡ Auto-Assign"}
                        </button>
                      )}
                    </div>
                  </div>

                  {result && (
                    <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm flex gap-4">
                      <span>✓ <strong>{result.agent_name}</strong></span>
                      <span className="text-slate-400">{result.distance_km}km</span>
                      <span className="text-slate-400">Score: {result.composite_score}</span>
                    </div>
                  )}

                  {order.tracking_events?.length > 0 && (
                    <div className="mt-3 flex gap-1.5 flex-wrap">
                      {order.tracking_events.map((ev, i) => (
                        <span key={ev.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${i === order.tracking_events.length-1 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                          {ev.status.replace(/_/g," ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Analytics tab */}
        {tab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-semibold text-slate-700 mb-5">Orders by Status</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} barSize={32}>
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-semibold text-slate-700 mb-5">Status Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 col-span-2">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-4xl font-bold text-indigo-600">{orders.length}</p>
                  <p className="text-slate-500 mt-1">Total Orders</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-emerald-600">{delivered > 0 ? ((delivered/orders.length)*100).toFixed(0) : 0}%</p>
                  <p className="text-slate-500 mt-1">Delivery Rate</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-purple-600">₹{revenue}</p>
                  <p className="text-slate-500 mt-1">Total Revenue</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map tab */}
        {tab === "map" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" style={{height: "500px"}}>
            <div className="flex h-full">
              <div className="w-72 overflow-y-auto border-r border-slate-100 p-3 space-y-2">
                <p className="text-xs text-slate-400 font-medium px-2 pb-1">SELECT ORDER TO VIEW</p>
                {orders.filter(o => o.pickup_lat).map(order => {
                  const meta = statusMeta[order.status] || {};
                  return (
                    <div key={order.id}
                      className={`p-3 rounded-xl cursor-pointer transition ${mapOrder?.id === order.id ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50"}`}
                      onClick={() => setMapOrder(mapOrder?.id === order.id ? null : order)}>
                      <p className="text-sm font-medium text-slate-700 truncate">{order.pickup_address}</p>
                      <p className="text-xs text-slate-400 truncate">→ {order.drop_address}</p>
                      <span className={`text-xs font-medium mt-1 inline-block ${meta.color}`}>{meta.label}</span>
                    </div>
                  );
                })}
                {orders.filter(o => o.pickup_lat).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No orders with coordinates</p>
                )}
              </div>
              <div className="flex-1">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400">Loading...</div>}>
                  <MapView
                    pickup={mapOrder?.pickup_lat ? [mapOrder.pickup_lat, mapOrder.pickup_lng] : null}
                    drop={mapOrder?.drop_lat ? [mapOrder.drop_lat, mapOrder.drop_lng] : null}
                    agent={null}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}