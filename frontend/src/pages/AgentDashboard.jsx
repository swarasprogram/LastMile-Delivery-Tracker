import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

const MapView = lazy(() => import("../components/MapView"));

const TRANSITIONS = {
  agent_assigned: "picked_up",
  picked_up: "in_transit",
  in_transit: "out_for_delivery",
};

const statusMeta = {
  agent_assigned:   { color: "text-blue-600",    bg: "bg-blue-50",    label: "Assigned to You" },
  picked_up:        { color: "text-violet-600",  bg: "bg-violet-50",  label: "Picked Up" },
  in_transit:       { color: "text-indigo-600",  bg: "bg-indigo-50",  label: "In Transit" },
  out_for_delivery: { color: "text-orange-600",  bg: "bg-orange-50",  label: "Out for Delivery" },
  delivered:        { color: "text-emerald-600", bg: "bg-emerald-50", label: "Delivered" },
  failed:           { color: "text-red-600",     bg: "bg-red-50",     label: "Failed" },
};

export default function AgentDashboard() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [agentLat, setAgentLat] = useState(null);
  const [agentLng, setAgentLng] = useState(null);
  const [available, setAvailable] = useState(true);
  const [locationSaved, setLocationSaved] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);

  const fetchOrders = async () => {
    const r = await client.get("/orders/");
    setOrders(r.data);
  };

  useEffect(() => { fetchOrders(); }, []);

  const startTracking = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setAgentLat(lat);
        setAgentLng(lng);
        await client.patch("/agents/location", {
          current_lat: lat, current_lng: lng, is_available: available
        });
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setWatchId(id);
  };

  const stopTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
  };

  const saveAvailability = async () => {
    if (agentLat === null) return alert("Start location tracking first");
    await client.patch("/agents/location", {
      current_lat: agentLat, current_lng: agentLng, is_available: available
    });
    setLocationSaved(true);
    setTimeout(() => setLocationSaved(false), 2000);
  };

  const advance = async (order) => {
    const next = TRANSITIONS[order.status];
    if (!next) return;
    await client.patch(`/orders/${order.id}/status`, { status: next });
    fetchOrders();
  };

  const markDelivered = async (order) => {
    await client.patch(`/orders/${order.id}/status`, { status: "delivered" });
    fetchOrders();
  };

  const markFailed = async (order) => {
    await client.patch(`/orders/${order.id}/status`, { status: "failed", note: "Delivery failed" });
    fetchOrders();
  };

  const active = orders.filter(o => !["delivered","failed","rescheduled"].includes(o.status));
  const done = orders.filter(o => ["delivered","failed","rescheduled"].includes(o.status));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛵</span>
          <span className="text-xl font-bold">Agent Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${watchId ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
          <span className="text-sm opacity-80">{watchId ? "Live Tracking" : "Offline"}</span>
          <span className="text-sm opacity-80">|</span>
          <span className="text-sm opacity-80">Hi, {user?.name}</span>
          <button onClick={logout} className="bg-white/10 hover:bg-white/20 text-sm px-3 py-1.5 rounded-lg transition">Logout</button>
        </div>
      </nav>

      <div className="flex flex-1 max-w-7xl mx-auto w-full gap-6 p-6">
        {/* Left panel */}
        <div className="w-full lg:w-1/2 space-y-4">
          {/* Location Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span>📡</span> Live Location
            </h3>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-1">Current Position</p>
                <p className="text-sm font-mono font-medium text-slate-700">
                  {agentLat ? `${agentLat.toFixed(5)}, ${agentLng.toFixed(5)}` : "Not tracking"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} className="rounded" />
                Available
              </label>
              {!watchId ? (
                <button onClick={startTracking} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                  📍 Start Tracking
                </button>
              ) : (
                <button onClick={stopTracking} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                  ⏹ Stop
                </button>
              )}
              <button onClick={saveAvailability} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                {locationSaved ? "✓ Saved" : "Save"}
              </button>
            </div>
          </div>

          {/* Active Orders */}
          <h2 className="text-xl font-bold text-slate-800 mt-2">Active Orders ({active.length})</h2>
          {active.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">✅</p>
              <p>No active orders</p>
            </div>
          )}
          {active.map(order => {
            const meta = statusMeta[order.status] || {};
            return (
              <div key={order.id}
                className={`bg-white rounded-2xl shadow-sm border-2 transition cursor-pointer ${activeOrder?.id === order.id ? "border-blue-400" : "border-transparent hover:border-slate-200"}`}
                onClick={() => setActiveOrder(activeOrder?.id === order.id ? null : order)}>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{order.pickup_address}</p>
                      <p className="text-sm text-slate-500">→ {order.drop_address}</p>
                      <p className="text-sm text-slate-400 mt-1">₹{order.total_charge} · {order.payment_type}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${meta.color} ${meta.bg}`}>{meta.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TRANSITIONS[order.status] && (
                      <button onClick={(e) => { e.stopPropagation(); advance(order); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                        Mark {TRANSITIONS[order.status].replace(/_/g, " ")} →
                      </button>
                    )}
                    {order.status === "out_for_delivery" && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); markDelivered(order); }}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                          ✓ Delivered
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); markFailed(order); }}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                          ✗ Failed
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {done.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-slate-800 mt-2">Completed ({done.length})</h2>
              {done.map(order => {
                const meta = statusMeta[order.status] || {};
                return (
                  <div key={order.id} className="bg-white rounded-2xl p-5 border border-slate-100 opacity-70">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium text-slate-700 text-sm">{order.pickup_address} → {order.drop_address}</p>
                        <p className="text-xs text-slate-400 mt-1">₹{order.total_charge}</p>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full h-fit ${meta.color} ${meta.bg}`}>{meta.label}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Right: Map */}
        <div className="hidden lg:block lg:w-1/2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-6" style={{height: "600px"}}>
            <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400">Loading map...</div>}>
              <MapView
                pickup={activeOrder?.pickup_lat ? [activeOrder.pickup_lat, activeOrder.pickup_lng] : null}
                drop={activeOrder?.drop_lat ? [activeOrder.drop_lat, activeOrder.drop_lng] : null}
                agent={agentLat ? [agentLat, agentLng] : null}
              />
            </Suspense>
            {!activeOrder && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-white/80 backdrop-blur-sm">
                <p className="text-4xl mb-2">🗺️</p>
                <p className="font-medium">Click an order to see route</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}