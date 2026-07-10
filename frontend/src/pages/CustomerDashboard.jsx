import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import AddressAutocomplete from "../components/AddressAutocomplete";

const MapView = lazy(() => import("../components/MapView"));

const STATUS_STEPS = ["confirmed","agent_assigned","picked_up","in_transit","out_for_delivery","delivered"];

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

const ACTIVE = ["agent_assigned","picked_up","in_transit","out_for_delivery"];

const PACKAGE_PRESETS = [
  { label: "Small",  sub: "≤1kg",    vals: { length_cm:"20", breadth_cm:"15", height_cm:"10", actual_weight_kg:"0.5" } },
  { label: "Medium", sub: "≤3kg",    vals: { length_cm:"35", breadth_cm:"25", height_cm:"20", actual_weight_kg:"2" } },
  { label: "Large",  sub: "≤7kg",    vals: { length_cm:"50", breadth_cm:"40", height_cm:"30", actual_weight_kg:"5" } },
  { label: "Custom", sub: "I'll fill", vals: null },
];

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [agentPos, setAgentPos] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const [pickup, setPickup] = useState({ address: "", lat: null, lng: null });
  const [drop, setDrop]     = useState({ address: "", lat: null, lng: null });
  const [dims, setDims] = useState({ length_cm:"", breadth_cm:"", height_cm:"", actual_weight_kg:"" });
  const [orderType, setOrderType] = useState("B2C");
  const [paymentType, setPaymentType] = useState("Prepaid");

  // Live estimate state
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);

  const fetchOrders = async () => {
    const r = await client.get("/orders/");
    setOrders(r.data);
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (!selected || !ACTIVE.includes(selected.status)) {
      setAgentPos(null);
      return;
    }
    const poll = async () => {
      try {
        const r = await client.get(`/orders/${selected.id}/agent-location`);
        setAgentPos([r.data.lat, r.data.lng]);
      } catch { setAgentPos(null); }
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [selected?.id, selected?.status]);

  // Auto-fetch estimate when pickup, drop, and dims are all filled
  useEffect(() => {
    if (
      !pickup.lat || !drop.lat ||
      !dims.length_cm || !dims.breadth_cm || !dims.height_cm || !dims.actual_weight_kg
    ) {
      setEstimate(null);
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      setEstimating(true);
      try {
        const r = await client.post("/orders/estimate", {
          pickup_address: pickup.address,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          drop_address: drop.address,
          drop_lat: drop.lat,
          drop_lng: drop.lng,
          length_cm: +dims.length_cm,
          breadth_cm: +dims.breadth_cm,
          height_cm: +dims.height_cm,
          actual_weight_kg: +dims.actual_weight_kg,
          order_type: orderType,
          payment_type: paymentType,
        }, { signal: controller.signal });
        setEstimate(r.data);
      } catch (err) {
        if (!controller.signal.aborted) setEstimate(null);
      } finally {
        if (!controller.signal.aborted) setEstimating(false);
      }
    };
    const t = setTimeout(run, 500);
    return () => { clearTimeout(t); controller.abort(); };
  }, [pickup.lat, drop.lat, dims.length_cm, dims.breadth_cm, dims.height_cm, dims.actual_weight_kg, orderType, paymentType]);

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!pickup.lat || !drop.lat) {
      setError("Please select addresses from the dropdown suggestions.");
      return;
    }
    setLoading(true); setError("");
    try {
      await client.post("/orders/", {
        pickup_address: pickup.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        drop_address: drop.address,
        drop_lat: drop.lat,
        drop_lng: drop.lng,
        order_type: orderType,
        payment_type: paymentType,
        length_cm: +dims.length_cm,
        breadth_cm: +dims.breadth_cm,
        height_cm: +dims.height_cm,
        actual_weight_kg: +dims.actual_weight_kg,
      });
      setShowForm(false);
      setPickup({ address:"", lat:null, lng:null });
      setDrop({ address:"", lat:null, lng:null });
      setDims({ length_cm:"", breadth_cm:"", height_cm:"", actual_weight_kg:"" });
      setEstimate(null);
      fetchOrders();
    } catch(err) {
      setError(err.response?.data?.detail || "Failed to place order");
    } finally { setLoading(false); }
  };

  const selectOrder = (order) => {
    if (selected?.id === order.id) { setSelected(null); return; }
    setSelected(order);
    setAgentPos(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📦</span>
          <span className="text-xl font-bold tracking-tight">Last-Mile Tracker</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-80">Hi, {user?.name}</span>
          <button onClick={logout} className="bg-white/20 hover:bg-white/30 text-sm px-3 py-1.5 rounded-lg transition">Logout</button>
        </div>
      </nav>

      <div className="flex flex-1 max-w-7xl mx-auto w-full gap-6 p-6">
        {/* Left: Orders */}
        <div className="w-full lg:w-1/2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">My Orders</h2>
            <button onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium shadow transition">
              {showForm ? "✕ Cancel" : "+ New Order"}
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
              <h3 className="font-semibold text-lg mb-4 text-slate-700">Place New Order</h3>
              <form onSubmit={placeOrder} className="space-y-3">
                <AddressAutocomplete
                  placeholder="📍 Pickup Address"
                  onSelect={r => setPickup({ address: r.address, lat: r.lat, lng: r.lng })}
                />
                {pickup.lat && (
                  <p className="text-xs text-emerald-600 -mt-1 ml-1">
                    ✓ {pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)}
                  </p>
                )}

                <AddressAutocomplete
                  placeholder="🏠 Drop Address"
                  onSelect={r => setDrop({ address: r.address, lat: r.lat, lng: r.lng })}
                />
                {drop.lat && (
                  <p className="text-xs text-emerald-600 -mt-1 ml-1">
                    ✓ {drop.lat.toFixed(5)}, {drop.lng.toFixed(5)}
                  </p>
                )}

                {/* Live preview map */}
                {(pickup.lat || drop.lat) && (
                  <div className="rounded-xl overflow-hidden border border-slate-200" style={{height:"180px"}}>
                    <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading map…</div>}>
                      <MapView
                        pickup={pickup.lat ? [pickup.lat, pickup.lng] : null}
                        drop={drop.lat ? [drop.lat, drop.lng] : null}
                        agent={null}
                      />
                    </Suspense>
                  </div>
                )}

                {/* Package size presets */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-medium">📦 Package Size</p>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {PACKAGE_PRESETS.map(p => (
                      <button key={p.label} type="button"
                        onClick={() => p.vals && setDims(p.vals)}
                        className={`border rounded-xl p-2.5 text-center transition hover:border-blue-400 hover:bg-blue-50 ${
                          p.vals && dims.length_cm === p.vals.length_cm
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200"
                        }`}>
                        <p className="text-sm font-semibold text-slate-700">{p.label}</p>
                        <p className="text-xs text-slate-400">{p.sub}</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {["length_cm","breadth_cm","height_cm"].map(f => (
                      <input key={f} type="number" required
                        className="border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                        placeholder={f.replace("_cm","").charAt(0).toUpperCase()+f.replace("_cm","").slice(1)+" cm"}
                        value={dims[f]}
                        onChange={e => setDims({...dims, [f]: e.target.value})} />
                    ))}
                  </div>
                </div>

                <input type="number" step="0.1" required
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                  placeholder="⚖️ Actual Weight (kg)"
                  value={dims.actual_weight_kg}
                  onChange={e => setDims({...dims, actual_weight_kg: e.target.value})} />

                <div className="grid grid-cols-2 gap-3">
                  <select className="border border-slate-200 rounded-xl p-3 text-sm"
                    value={orderType} onChange={e => setOrderType(e.target.value)}>
                    <option>B2C</option><option>B2B</option>
                  </select>
                  <select className="border border-slate-200 rounded-xl p-3 text-sm"
                    value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                    <option>Prepaid</option><option>COD</option>
                  </select>
                </div>

                {/* Live price estimate */}
                {estimating && (
                  <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-400 animate-pulse text-center">
                    Calculating price…
                  </div>
                )}
                {estimate && !estimating && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-indigo-700 mb-3">💰 Price Estimate</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Billed weight</span>
                        <span className="font-medium">{estimate.billed_weight_kg} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Base charge</span>
                        <span className="font-medium">₹{estimate.base_charge}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Distance</span>
                        <span className="font-medium">{estimate.distance_km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Distance charge</span>
                        <span className="font-medium">₹{estimate.distance_charge}</span>
                      </div>
                      {estimate.cod_surcharge > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">COD surcharge</span>
                          <span className="font-medium">₹{estimate.cod_surcharge}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-indigo-200 mt-3 pt-3 flex justify-between items-center">
                      <span className="font-semibold text-indigo-700">Total</span>
                      <span className="text-xl font-bold text-indigo-700">₹{estimate.total_charge}</span>
                    </div>
                  </div>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50">
                  {loading ? "Placing…" : "Place Order →"}
                </button>
              </form>
            </div>
          )}

          {orders.length === 0 && !showForm && (
            <div className="text-center py-20 text-slate-400">
              <p className="text-5xl mb-3">📭</p>
              <p className="font-medium">No orders yet. Place your first one!</p>
            </div>
          )}

          {orders.map(order => {
            const meta = statusMeta[order.status] || statusMeta.confirmed;
            const isSelected = selected?.id === order.id;
            const step = STATUS_STEPS.indexOf(order.status);
            return (
              <div key={order.id}
                className={`bg-white rounded-2xl shadow-sm border-2 cursor-pointer transition-all ${isSelected ? "border-blue-400 shadow-md" : "border-transparent hover:border-slate-200"}`}
                onClick={() => selectOrder(order)}>
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{order.pickup_address.split(",")[0]}</p>
                      <p className="text-sm text-slate-500 truncate">→ {order.drop_address.split(",")[0]}</p>
                    </div>
                    <span className={`ml-3 text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${meta.color} ${meta.bg}`}>
                      {meta.label}
                    </span>
                  </div>
                  {step >= 0 && (
                    <div className="mt-3">
                      <div className="flex gap-0.5 mb-1">
                        {STATUS_STEPS.map((_, i) => (
                          <div key={i} className={`h-1.5 rounded-full flex-1 ${i <= step ? "bg-blue-500" : "bg-slate-100"}`} />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Confirmed</span><span>Delivered</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between mt-3 text-sm">
                    <span className="text-slate-400">{order.order_type} · {order.payment_type}</span>
                    <span className="font-bold text-blue-600">₹{order.total_charge}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Live Map */}
        <div className="hidden lg:flex lg:w-1/2 flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 relative" style={{minHeight:"420px"}}>
            {selected ? (
              <>
                <Suspense fallback={<div className="h-full flex items-center justify-center">Loading map…</div>}>
                  <MapView
                    pickup={selected.pickup_lat ? [selected.pickup_lat, selected.pickup_lng] : null}
                    drop={selected.drop_lat ? [selected.drop_lat, selected.drop_lng] : null}
                    agent={agentPos}
                  />
                </Suspense>
                {agentPos && (
                  <div className="absolute top-3 right-3 z-[999] bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping inline-block" />
                    LIVE
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p className="text-5xl mb-3">🗺️</p>
                <p className="font-medium">Select an order to track</p>
                <p className="text-sm mt-1">Agent location updates every 5 seconds</p>
              </div>
            )}
          </div>

          {selected && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">Timeline</h3>
                {agentPos && <span className="text-xs text-emerald-600 font-medium">🟢 Agent is live</span>}
              </div>
              <div className="space-y-3">
                {selected.tracking_events.map((ev, i) => {
                  const isLatest = i === selected.tracking_events.length - 1;
                  return (
                    <div key={ev.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-0.5 ${isLatest ? "bg-blue-500 ring-4 ring-blue-100" : "bg-slate-200"}`} />
                        {i < selected.tracking_events.length - 1 && <div className="w-0.5 h-6 bg-slate-200 mt-1" />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium capitalize ${isLatest ? "text-blue-600" : "text-slate-600"}`}>
                          {ev.status.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleString()}</p>
                        {ev.note && <p className="text-xs text-slate-400 italic">{ev.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3">
                <div><p className="text-xs text-slate-400">Billed Wt.</p><p className="font-bold text-sm">{selected.billed_weight_kg} kg</p></div>
                <div><p className="text-xs text-slate-400">Base</p><p className="font-bold text-sm">₹{selected.base_charge}</p></div>
                <div><p className="text-xs text-slate-400">Total</p><p className="font-bold text-sm text-blue-600">₹{selected.total_charge}</p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
