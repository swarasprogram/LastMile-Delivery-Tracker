import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import Brand from "../components/Brand";

const MapView = lazy(() => import("../components/MapView"));

const ACTIVE = ["agent_assigned","picked_up","in_transit","out_for_delivery"];

export default function AgentMap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [myPos, setMyPos] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 10000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = async () => {
    try {
      const r = await client.get("/orders/");
      const active = r.data.filter(o => ACTIVE.includes(o.status));
      setOrders(active);
      if (active.length > 0 && !selected) setSelected(active[0]);
    } catch {}
  };

  const startTracking = () => {
    if (!navigator.geolocation) return;
    setTracking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setMyPos([pos.coords.latitude, pos.coords.longitude]);
        try {
          await client.patch("/agents/location", {
            current_lat: pos.coords.latitude,
            current_lng: pos.coords.longitude,
          });
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const stopTracking = () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    setTracking(false); setMyPos(null); watchRef.current = null;
  };

  useEffect(() => () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/[0.08] bg-ink px-6 py-4 flex items-center justify-between z-20">
        <button onClick={() => navigate("/agent")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
          ← Dashboard
        </button>
        <Brand size="sm" subtitle="Live Map" />
        {!tracking ? (
          <button onClick={startTracking}
            className="btn-accent text-xs px-4 py-2">
            📍 Share Location
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-brand/10 border border-brand/20 text-brand text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-brand rounded-full animate-pulse" /> LIVE
            </div>
            <button onClick={stopTracking}
              className="text-gray-400 hover:text-white text-xs transition">Stop</button>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: order list */}
        <div className="w-72 bg-ink border-r border-white/[0.08] flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-white/[0.08]">
            <p className="eyebrow">Active Orders ({orders.length})</p>
          </div>
          {orders.length === 0 ? (
            <div className="p-6 text-center text-gray-600 text-sm">No active orders right now</div>
          ) : (
            <div className="p-3 space-y-2">
              {orders.map(order => (
                <div key={order.id}
                  onClick={() => setSelected(order)}
                  className={`p-4 rounded-xl cursor-pointer transition border ${
                    selected?.id === order.id
                      ? "bg-brand/10 border-brand/30"
                      : "bg-white/5 border-transparent hover:border-white/15"
                  }`}>
                  <p className="text-white text-sm font-semibold truncate">{order.pickup_address.split(",")[0]}</p>
                  <p className="text-gray-400 text-xs truncate mt-0.5">→ {order.drop_address.split(",")[0]}</p>
                  <div className="flex justify-between mt-2 items-center">
                    <span className="text-xs text-brand capitalize">{order.status.replace(/_/g, " ")}</span>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/agent/orders/${order.id}`); }}
                      className="text-xs text-gray-500 hover:text-white transition">
                      Actions →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {selected?.pickup_lat ? (
            <Suspense fallback={<div className="h-full flex items-center justify-center bg-black text-gray-500">Loading map…</div>}>
              <MapView
                pickup={[selected.pickup_lat, selected.pickup_lng]}
                drop={[selected.drop_lat, selected.drop_lng]}
                agent={myPos}
              />
            </Suspense>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
              <p className="text-5xl mb-3">🗺️</p>
              <p className="text-sm">{orders.length === 0 ? "No active orders to show" : "Select an order to see on map"}</p>
            </div>
          )}

          {/* Selected order overlay */}
          {selected && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-ink border border-white/15 rounded-2xl px-5 py-3 shadow-2xl shadow-black/60 flex items-center gap-4">
              <div>
                <p className="text-white text-sm font-semibold">{selected.pickup_address.split(",")[0]} → {selected.drop_address.split(",")[0]}</p>
                <p className="text-gray-400 text-xs mt-0.5 capitalize">{selected.status.replace(/_/g, " ")}</p>
              </div>
              <button
                onClick={() => navigate(`/agent/orders/${selected.id}`)}
                className="btn-accent text-xs px-4 py-2 whitespace-nowrap">
                View Order →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
