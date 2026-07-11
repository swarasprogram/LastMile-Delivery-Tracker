import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

const MapView = lazy(() => import("../components/MapView"));

const STATUS_ACTIONS = {
  agent_assigned:   { label: "Mark as Picked Up",        next: "picked_up",        icon: "📤", color: "bg-violet-600 hover:bg-violet-500" },
  picked_up:        { label: "Mark In Transit",          next: "in_transit",       icon: "🚚", color: "bg-indigo-600 hover:bg-indigo-500" },
  in_transit:       { label: "Out for Delivery",         next: "out_for_delivery", icon: "🛵", color: "bg-orange-600 hover:bg-orange-500" },
  out_for_delivery: { label: "Mark Delivered",           next: "delivered",        icon: "✅", color: "bg-emerald-600 hover:bg-emerald-500" },
};

const FAIL_REASONS = [
  "Customer not available",
  "Wrong address",
  "Customer refused delivery",
  "Access denied to location",
  "Other",
];

const statusMeta = {
  confirmed:        { label: "Confirmed",        icon: "📋", color: "text-amber-400"   },
  agent_assigned:   { label: "Assigned",         icon: "👤", color: "text-blue-400"    },
  picked_up:        { label: "Picked Up",        icon: "📤", color: "text-violet-400"  },
  in_transit:       { label: "In Transit",       icon: "🚚", color: "text-indigo-400"  },
  out_for_delivery: { label: "Out for Delivery", icon: "🛵", color: "text-orange-400"  },
  delivered:        { label: "Delivered",        icon: "✅", color: "text-emerald-400" },
  failed:           { label: "Failed",           icon: "❌", color: "text-red-400"     },
};

export default function AgentOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError]       = useState("");
  const [showFail, setShowFail] = useState(false);
  const [failReason, setFailReason] = useState(FAIL_REASONS[0]);

  const fetchOrder = async () => {
    try {
      const r = await client.get(`/orders/${id}`);
      setOrder(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const updateStatus = async (newStatus, note) => {
    setUpdating(true); setError("");
    try {
      const r = await client.patch(`/orders/${id}/status`, { status: newStatus, note });
      setOrder(r.data);
      setShowFail(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update status");
    } finally { setUpdating(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Order not found</p>
    </div>
  );

  const action = STATUS_ACTIONS[order.status];
  const meta   = statusMeta[order.status] || {};
  const canFail = ["agent_assigned","picked_up","in_transit","out_for_delivery"].includes(order.status);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <button onClick={() => navigate("/agent")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
          ← My Orders
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">LM</div>
          <span className="text-white text-sm font-semibold">Order Detail</span>
        </div>
        <span className={`text-sm font-semibold ${meta.color}`}>{meta.icon} {meta.label}</span>
      </div>

      <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left */}
        <div className="lg:col-span-3 space-y-5">
          {/* Addresses */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Route</p>
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Pickup</p>
                <p className="text-white font-semibold mt-0.5">{order.pickup_address}</p>
              </div>
            </div>
            <div className="border-l-2 border-dashed border-gray-700 ml-1 h-4" />
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Drop</p>
                <p className="text-white font-semibold mt-0.5">{order.drop_address}</p>
              </div>
            </div>
          </div>

          {/* Order info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4">Package Info</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Order Type",    value: order.order_type },
                { label: "Payment",       value: order.payment_type },
                { label: "Billed Weight", value: `${order.billed_weight_kg} kg` },
                { label: "Total Charge",  value: `₹${order.total_charge}` },
              ].map(d => (
                <div key={d.label} className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">{d.label}</p>
                  <p className="text-white font-semibold text-sm mt-1">{d.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          {order.status !== "delivered" && order.status !== "failed" && order.status !== "rescheduled" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Actions</p>

              {action && (
                <button
                  onClick={() => updateStatus(action.next)}
                  disabled={updating}
                  className={`w-full ${action.color} disabled:opacity-60 text-white py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2`}>
                  {updating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>{action.icon} {action.label}</>}
                </button>
              )}

              {canFail && (
                <button
                  onClick={() => setShowFail(true)}
                  className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-700/30 text-red-400 py-3 rounded-xl font-semibold text-sm transition">
                  ❌ Mark as Failed
                </button>
              )}

              {/* Fail modal */}
              {showFail && (
                <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 space-y-3">
                  <p className="text-red-400 text-sm font-semibold">Select failure reason</p>
                  <div className="space-y-2">
                    {FAIL_REASONS.map(r => (
                      <label key={r} className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="reason" value={r} checked={failReason === r}
                          onChange={() => setFailReason(r)}
                          className="accent-red-500" />
                        <span className="text-gray-300 text-sm">{r}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowFail(false)}
                      className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm font-medium transition hover:bg-gray-700">
                      Cancel
                    </button>
                    <button onClick={() => updateStatus("failed", failReason)} disabled={updating}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60">
                      {updating ? "Updating…" : "Confirm Fail"}
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-red-400 text-sm bg-red-900/20 rounded-xl p-3">{error}</p>}
            </div>
          )}

          {/* Delivered */}
          {order.status === "delivered" && (
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-emerald-400 font-bold text-lg">Delivered Successfully!</p>
            </div>
          )}

          {/* Failed */}
          {order.status === "failed" && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">❌</p>
              <p className="text-red-400 font-bold text-lg">Order Failed</p>
              <p className="text-gray-400 text-sm mt-1">Customer will be notified to reschedule</p>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4">Timeline</p>
            <div className="space-y-4">
              {order.tracking_events.map((ev, i) => {
                const evMeta = statusMeta[ev.status] || {};
                const isLatest = i === order.tracking_events.length - 1;
                return (
                  <div key={ev.id} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${isLatest ? "bg-emerald-600 ring-2 ring-emerald-500/30" : "bg-gray-800"}`}>
                        {evMeta.icon || "📍"}
                      </div>
                      {i < order.tracking_events.length - 1 && <div className="w-px h-5 bg-gray-700 mt-1" />}
                    </div>
                    <div>
                      <p className={`text-sm font-medium capitalize ${isLatest ? "text-white" : "text-gray-400"}`}>
                        {ev.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-gray-600 text-xs mt-0.5">{new Date(ev.created_at).toLocaleString()}</p>
                      {ev.note && <p className="text-gray-400 text-xs italic mt-1 bg-gray-800 rounded px-2 py-1 inline-block">{ev.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: map */}
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: "400px" }}>
              {order.pickup_lat ? (
                <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading map…</div>}>
                  <MapView
                    pickup={[order.pickup_lat, order.pickup_lng]}
                    drop={[order.drop_lat, order.drop_lng]}
                    agent={null}
                  />
                </Suspense>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">Map unavailable</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
