import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";

const MapView = lazy(() => import("../components/MapView"));

const statusMeta = {
  confirmed:        { label: "Confirmed",        icon: "📋", color: "text-amber-400",   ring: "ring-amber-400/30",   glow: "bg-amber-400" },
  agent_assigned:   { label: "Agent Assigned",   icon: "👤", color: "text-blue-400",    ring: "ring-blue-400/30",    glow: "bg-blue-400" },
  picked_up:        { label: "Picked Up",        icon: "📤", color: "text-violet-400",  ring: "ring-violet-400/30",  glow: "bg-violet-400" },
  in_transit:       { label: "In Transit",       icon: "🚚", color: "text-indigo-400",  ring: "ring-indigo-400/30",  glow: "bg-indigo-400" },
  out_for_delivery: { label: "Out for Delivery", icon: "🛵", color: "text-orange-400",  ring: "ring-orange-400/30",  glow: "bg-orange-400" },
  delivered:        { label: "Delivered",        icon: "✅", color: "text-emerald-400", ring: "ring-emerald-400/30", glow: "bg-emerald-400" },
  failed:           { label: "Failed",           icon: "❌", color: "text-red-400",     ring: "ring-red-400/30",     glow: "bg-red-400" },
  rescheduled:      { label: "Rescheduled",      icon: "🔄", color: "text-gray-400",    ring: "ring-gray-400/30",    glow: "bg-gray-400" },
};

const STATUS_STEPS = ["confirmed","agent_assigned","picked_up","in_transit","out_for_delivery","delivered"];
const ACTIVE_STATUSES = ["agent_assigned","picked_up","in_transit","out_for_delivery"];

export default function OrderTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder]       = useState(null);
  const [agentPos, setAgentPos] = useState(null);
  const [agentName, setAgentName] = useState(null);
  const [loading, setLoading]   = useState(true);
  const pollRef = useRef(null);
  const orderPollRef = useRef(null);

  const fetchOrder = async () => {
    try {
      const r = await client.get(`/orders/${id}`);
      setOrder(r.data);
      return r.data;
    } catch { return null; }
  };

  useEffect(() => {
    fetchOrder().then(() => setLoading(false));
    orderPollRef.current = setInterval(fetchOrder, 10000);
    return () => clearInterval(orderPollRef.current);
  }, [id]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (!order || !ACTIVE_STATUSES.includes(order.status)) { setAgentPos(null); return; }
    const poll = async () => {
      try {
        const r = await client.get(`/orders/${id}/agent-location`);
        setAgentPos([r.data.lat, r.data.lng]);
      } catch { setAgentPos(null); }
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [order?.status, id]);

  useEffect(() => {
    if (!order?.agent_id) { setAgentName(null); return; }
    // Try to get agent name from tracking events (actor_role=agent)
    const agentEvent = order.tracking_events?.find(e => e.actor_role === "agent");
    if (agentEvent) return; // can't get name from event alone, will show fallback
    setAgentName(null);
  }, [order?.agent_id]);

  // Failure banner — show when status flips to failed
  const [prevStatus, setPrevStatus] = useState(null);
  const [showFailBanner, setShowFailBanner] = useState(false);
  useEffect(() => {
    if (prevStatus && prevStatus !== "failed" && order?.status === "failed") {
      setShowFailBanner(true);
    }
    if (order?.status) setPrevStatus(order.status);
  }, [order?.status]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading order…</p>
      </div>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-400">Order not found.</p>
      <button onClick={() => navigate("/dashboard")} className="text-blue-400 hover:text-blue-300 text-sm underline">← Dashboard</button>
    </div>
  );

  const meta = statusMeta[order.status] || statusMeta.confirmed;
  const step = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <button onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
          ← Dashboard
        </button>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">Order</span>
          <span className="text-gray-300 text-sm font-mono">{String(id).slice(0,8)}…</span>
        </div>
        {agentPos && (
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE TRACKING
          </div>
        )}
      </div>

      {/* Failure banner */}
      {showFailBanner && (
        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Delivery Failed</p>
              <p className="text-red-100 text-sm">Your order could not be delivered. You can reschedule below.</p>
            </div>
          </div>
          <button onClick={() => setShowFailBanner(false)} className="text-red-200 hover:text-white text-xl ml-6">✕</button>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column */}
        <div className="lg:col-span-3 space-y-5">
          {/* Status card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gray-800 ring-2 ${meta.ring} flex items-center justify-center text-2xl`}>
                {meta.icon}
              </div>
              <div>
                <p className={`text-xl font-bold ${meta.color}`}>{meta.label}</p>
                <p className="text-gray-400 text-sm mt-0.5 max-w-xs truncate">
                  {order.pickup_address.split(",")[0]} → {order.drop_address.split(",")[0]}
                </p>
              </div>
            </div>

            {step >= 0 && (
              <div className="mt-6">
                <div className="flex gap-1.5">
                  {STATUS_STEPS.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${i <= step ? `${meta.glow} opacity-80` : "bg-gray-700"}`} />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>Confirmed</span><span>Delivered</span>
                </div>
              </div>
            )}
          </div>

          {/* Agent card */}
          {order.agent_id && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4">Your Delivery Agent</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-xl flex-shrink-0">
                  👤
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-base">
                    {agentName || "Agent Assigned"}
                  </p>
                  {agentPos
                    ? <p className="text-emerald-400 text-xs mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" /> Location updating live</p>
                    : <p className="text-gray-500 text-xs mt-0.5">Live tracking begins after pickup</p>
                  }
                </div>
              </div>
            </div>
          )}

          {/* Order details */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4">Order Details</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Order Type",    value: order.order_type },
                { label: "Payment",       value: order.payment_type },
                { label: "Billed Weight", value: `${order.billed_weight_kg} kg` },
                { label: "Base Charge",   value: `₹${order.base_charge}` },
              ].map(d => (
                <div key={d.label} className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">{d.label}</p>
                  <p className="text-white font-semibold text-sm mt-1">{d.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 flex justify-between items-center">
              <span className="text-gray-300 font-medium">Total Charge</span>
              <span className="text-2xl font-bold text-blue-400">₹{order.total_charge}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-5">Timeline</p>
            <div className="space-y-5">
              {order.tracking_events.map((ev, i) => {
                const evMeta = statusMeta[ev.status] || {};
                const isLatest = i === order.tracking_events.length - 1;
                return (
                  <div key={ev.id} className="flex gap-4 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${isLatest ? "bg-blue-600 ring-2 ring-blue-500/30" : "bg-gray-800"}`}>
                        {evMeta.icon || "📍"}
                      </div>
                      {i < order.tracking_events.length - 1 && <div className="w-px h-6 bg-gray-700 mt-1" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className={`font-semibold text-sm capitalize ${isLatest ? "text-white" : "text-gray-300"}`}>
                        {ev.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">{new Date(ev.created_at).toLocaleString()}</p>
                      {ev.note && <p className="text-gray-400 text-xs italic mt-1 bg-gray-800 rounded-lg px-2 py-1 inline-block">{ev.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivered */}
          {order.status === "delivered" && (
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-2xl p-8 text-center">
              <p className="text-5xl mb-3">🎉</p>
              <p className="text-emerald-400 font-bold text-xl">Delivered Successfully!</p>
              <p className="text-gray-400 text-sm mt-2">Your package has been delivered.</p>
              <button onClick={() => navigate("/dashboard")}
                className="mt-5 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-semibold transition text-sm">
                Back to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Right: map */}
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: "480px" }}>
              {order.pickup_lat ? (
                <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading map…</div>}>
                  <MapView
                    pickup={[order.pickup_lat, order.pickup_lng]}
                    drop={[order.drop_lat, order.drop_lng]}
                    agent={agentPos}
                  />
                </Suspense>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-600">
                  <span className="text-4xl mb-2">🗺️</span>
                  <p className="text-sm">Map unavailable</p>
                </div>
              )}
            </div>
            {agentPos && (
              <div className="mt-3 bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-blue-400 rounded-full" /> Agent location
                </span>
                <span className="text-gray-500">Updates every 5s</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
