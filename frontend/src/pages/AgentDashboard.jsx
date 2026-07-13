import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import Brand from "../components/Brand";

const statusMeta = {
  confirmed:        { label: "Confirmed",        dot: "bg-amber-400",   text: "text-amber-400"   },
  agent_assigned:   { label: "Assigned to You",  dot: "bg-sky-400",     text: "text-sky-400"     },
  picked_up:        { label: "Picked Up",        dot: "bg-violet-400",  text: "text-violet-400"  },
  in_transit:       { label: "In Transit",       dot: "bg-indigo-400",  text: "text-indigo-400"  },
  out_for_delivery: { label: "Out for Delivery", dot: "bg-orange-400",  text: "text-orange-400"  },
  delivered:        { label: "Delivered",        dot: "bg-brand",       text: "text-brand"       },
  failed:           { label: "Failed",           dot: "bg-red-400",     text: "text-red-400"     },
};

const ACTIVE = ["agent_assigned","picked_up","in_transit","out_for_delivery"];

export default function AgentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | active | error
  const watchRef = useRef(null);
  const [filter, setFilter] = useState("active");

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 15000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = async () => {
    try {
      const r = await client.get("/orders/");
      setOrders(r.data);
    } finally { setLoading(false); }
  };

  const startTracking = () => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    setTracking(true); setGpsStatus("active");
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await client.patch("/agents/location", {
            current_lat: pos.coords.latitude,
            current_lng: pos.coords.longitude,
          });
        } catch (e) { console.error("Location update failed", e); }
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const stopTracking = () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    setTracking(false); setGpsStatus("idle");
    watchRef.current = null;
  };

  const total     = orders.length;
  const active    = orders.filter(o => ACTIVE.includes(o.status)).length;
  const delivered = orders.filter(o => o.status === "delivered").length;
  const today     = orders.filter(o => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const earnings  = orders
    .filter(o => o.status === "delivered")
    .reduce((s, o) => s + (Number(o.total_charge) || 0), 0);

  const filtered = filter === "active"
    ? orders.filter(o => ACTIVE.includes(o.status))
    : filter === "delivered"
    ? orders.filter(o => o.status === "delivered")
    : orders;

  return (
    <div className="min-h-screen bg-black">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-ink border-r border-white/[0.08] flex flex-col z-10">
        <div className="p-6 border-b border-white/[0.08]">
          <Brand size="md" subtitle="Agent Portal" />
        </div>

        <div className="p-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-black text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-gray-500 text-xs">Delivery Agent</p>
            </div>
          </div>
        </div>

        {/* GPS tracking toggle */}
        <div className="p-4 border-b border-white/[0.08]">
          <p className="eyebrow mb-3">GPS Tracking</p>
          {!tracking ? (
            <button onClick={startTracking}
              className="btn-accent w-full py-2.5 text-sm flex items-center justify-center gap-2">
              <span>📍</span> Start Tracking
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-xl px-3 py-2">
                <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                <span className="text-brand text-xs font-semibold">Live · Sharing location</span>
              </div>
              <button onClick={stopTracking}
                className="btn-ghost w-full py-2 text-sm">
                Stop Tracking
              </button>
            </div>
          )}
          {gpsStatus === "error" && (
            <p className="text-red-400 text-xs mt-2">⚠️ GPS unavailable. Enable location access.</p>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand/10 text-brand text-sm font-medium">
            <span>📦</span> My Orders
          </button>
          <button onClick={() => navigate("/agent/map")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white text-sm transition">
            <span>🗺️</span> Live Map
          </button>
        </nav>

        <div className="p-4 border-t border-white/[0.08]">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 text-sm transition">
            <span>🚪</span> Logout
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="ml-64 min-h-screen">
        <div className="border-b border-white/[0.08] bg-black/60 backdrop-blur px-8 py-5 sticky top-0 z-10">
          <h1 className="text-white text-xl font-bold">My Deliveries</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage and update your assigned orders</p>
        </div>

        <div className="p-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-5">
            {[
              { label: "Today's Orders", value: today,                              icon: "📅", accent: false },
              { label: "Active",         value: active,                             icon: "🚚", accent: false },
              { label: "Delivered",      value: delivered,                          icon: "✅", accent: false },
              { label: "Earned",         value: `₹${earnings.toLocaleString()}`,    icon: "💰", accent: true  },
            ].map(s => (
              <div key={s.label} className="card p-5">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg mb-4">{s.icon}</div>
                <p className={`text-2xl font-bold ${s.accent ? "text-brand" : "text-white"}`}>{s.value}</p>
                <p className="text-gray-400 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter + orders */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Orders</h2>
              <div className="flex gap-1 bg-ink border border-white/[0.08] rounded-xl p-1">
                {["active","delivered","all"].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                      filter === f ? "bg-brand text-black" : "text-gray-400 hover:text-white"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card p-16 text-center">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-white font-semibold">No {filter} orders</p>
                <p className="text-gray-500 text-sm mt-1">Orders assigned to you will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(order => {
                  const meta = statusMeta[order.status] || statusMeta.confirmed;
                  return (
                    <div key={order.id}
                      onClick={() => navigate(`/agent/orders/${order.id}`)}
                      className="card p-5 cursor-pointer hover:border-white/25 transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                            <p className="text-white font-semibold truncate">{order.pickup_address.split(",")[0]}</p>
                          </div>
                          <p className="text-gray-400 text-sm truncate ml-4">→ {order.drop_address.split(",")[0]}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                          <span className={`text-xs font-semibold ${meta.text}`}>{meta.label}</span>
                          <span className="text-gray-600 group-hover:text-gray-400 text-sm transition">→</span>
                        </div>
                      </div>
                      <div className="flex justify-between mt-3 text-xs text-gray-500">
                        <span>{order.order_type} · {order.payment_type}</span>
                        <span className="text-brand font-semibold">₹{order.total_charge}</span>
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
