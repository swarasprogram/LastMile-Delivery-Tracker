import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import Brand from "../components/Brand";
import SignaturePad from "../components/SignaturePad";

// Downscale an uploaded photo to a reasonable JPEG data URL for POD storage
function fileToDataURL(file, maxDim = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MapView = lazy(() => import("../components/MapView"));

const STATUS_ACTIONS = {
  agent_assigned:   { label: "Mark as Picked Up", next: "picked_up",        icon: "📤" },
  picked_up:        { label: "Mark In Transit",   next: "in_transit",       icon: "🚚" },
  in_transit:       { label: "Out for Delivery",  next: "out_for_delivery", icon: "🛵" },
  out_for_delivery: { label: "Mark Delivered",    next: "delivered",        icon: "✅" },
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
  agent_assigned:   { label: "Assigned",         icon: "👤", color: "text-sky-400"     },
  picked_up:        { label: "Picked Up",        icon: "📤", color: "text-violet-400"  },
  in_transit:       { label: "In Transit",       icon: "🚚", color: "text-indigo-400"  },
  out_for_delivery: { label: "Out for Delivery", icon: "🛵", color: "text-orange-400"  },
  delivered:        { label: "Delivered",        icon: "✅", color: "text-brand"       },
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

  // Proof of Delivery capture
  const [showPOD, setShowPOD] = useState(false);
  const [podPhoto, setPodPhoto] = useState(null);
  const [podSignature, setPodSignature] = useState(null);
  const [podNote, setPodNote] = useState("");
  const [eta, setEta] = useState(null);

  const fetchOrder = async () => {
    try {
      const r = await client.get(`/orders/${id}`);
      setOrder(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const updateStatus = async (newStatus, note, pod = {}) => {
    setUpdating(true); setError("");
    try {
      const r = await client.patch(`/orders/${id}/status`, { status: newStatus, note, ...pod });
      setOrder(r.data);
      setShowFail(false);
      setShowPOD(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update status");
    } finally { setUpdating(false); }
  };

  const confirmDelivery = () => {
    updateStatus("delivered", null, {
      pod_photo: podPhoto,
      pod_signature: podSignature,
      pod_note: podNote || null,
    });
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (file) setPodPhoto(await fileToDataURL(file));
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-400">Order not found</p>
    </div>
  );

  const action = STATUS_ACTIONS[order.status];
  const meta   = statusMeta[order.status] || {};
  const canFail = ["agent_assigned","picked_up","in_transit","out_for_delivery"].includes(order.status);

  return (
    <div className="min-h-screen bg-black">
      {/* Top bar */}
      <div className="border-b border-white/[0.08] bg-ink px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <button onClick={() => navigate("/agent")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
          ← My Orders
        </button>
        <Brand size="sm" subtitle="Order Detail" />
        <span className={`text-sm font-semibold ${meta.color}`}>{meta.icon} {meta.label}</span>
      </div>

      <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left */}
        <div className="lg:col-span-3 space-y-5">
          {/* Addresses */}
          <div className="card p-5 space-y-4">
            <p className="eyebrow">Route</p>
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Pickup</p>
                <p className="text-white font-semibold mt-0.5">{order.pickup_address}</p>
              </div>
            </div>
            <div className="border-l-2 border-dashed border-white/15 ml-1 h-4" />
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-gray-500 text-xs">Drop</p>
                <p className="text-white font-semibold mt-0.5">{order.drop_address}</p>
              </div>
            </div>
          </div>

          {/* Order info */}
          <div className="card p-5">
            <p className="eyebrow mb-4">Package Info</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Order Type",    value: order.order_type },
                { label: "Payment",       value: order.payment_type },
                { label: "Billed Weight", value: `${order.billed_weight_kg} kg` },
                { label: "Total Charge",  value: `₹${order.total_charge}` },
              ].map(d => (
                <div key={d.label} className="bg-white/5 rounded-xl p-3">
                  <p className="text-gray-500 text-xs">{d.label}</p>
                  <p className="text-white font-semibold text-sm mt-1">{d.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          {order.status !== "delivered" && order.status !== "failed" && order.status !== "rescheduled" && (
            <div className="card p-5 space-y-3">
              <p className="eyebrow">Actions</p>

              {action && !showPOD && (
                <button
                  onClick={() => action.next === "delivered" ? setShowPOD(true) : updateStatus(action.next)}
                  disabled={updating}
                  className="btn-accent w-full py-3.5 text-sm flex items-center justify-center gap-2 shadow-brand">
                  {updating ? <div className="w-4 h-4 border-2 border-black/70 border-t-transparent rounded-full animate-spin" />
                    : <>{action.icon} {action.label}</>}
                </button>
              )}

              {/* Proof of Delivery capture */}
              {showPOD && (
                <div className="bg-brand/[0.06] border border-brand/25 rounded-xl p-4 space-y-4">
                  <p className="text-brand text-sm font-semibold">Capture Proof of Delivery</p>

                  <div>
                    <p className="text-gray-400 text-xs mb-2">Delivery photo</p>
                    {podPhoto ? (
                      <div className="relative">
                        <img src={podPhoto} alt="POD" className="w-full h-40 object-cover rounded-xl border border-white/10" />
                        <button onClick={() => setPodPhoto(null)}
                          className="absolute top-2 right-2 bg-black/70 text-white text-xs rounded-lg px-2 py-1">Retake</button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 rounded-xl border border-dashed border-white/20 cursor-pointer hover:border-brand/50 transition text-gray-500 text-sm">
                        📷 Tap to add photo
                        <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                      </label>
                    )}
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs mb-2">Recipient signature</p>
                    <SignaturePad onChange={setPodSignature} />
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs mb-2">Note (optional)</p>
                    <input value={podNote} onChange={e => setPodNote(e.target.value)}
                      placeholder="e.g. Left with security / handed to recipient"
                      className="field !py-2.5 !text-sm" />
                  </div>

                  {!podPhoto && !podSignature && (
                    <p className="text-amber-400/80 text-xs">Add a photo or signature to confirm delivery.</p>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setShowPOD(false)} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
                    <button onClick={confirmDelivery} disabled={updating || (!podPhoto && !podSignature)}
                      className="btn-accent flex-1 py-2.5 text-sm">
                      {updating ? "Saving…" : "✅ Confirm Delivered"}
                    </button>
                  </div>
                </div>
              )}

              {canFail && !showPOD && (
                <button
                  onClick={() => setShowFail(true)}
                  className="btn-danger w-full py-3 text-sm font-semibold">
                  ❌ Mark as Failed
                </button>
              )}

              {/* Fail modal */}
              {showFail && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
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
                      className="btn-ghost flex-1 py-2.5 text-sm font-medium">
                      Cancel
                    </button>
                    <button onClick={() => updateStatus("failed", failReason)} disabled={updating}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60">
                      {updating ? "Updating…" : "Confirm Fail"}
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3">{error}</p>}
            </div>
          )}

          {/* Delivered */}
          {order.status === "delivered" && (
            <div className="bg-brand/10 border border-brand/30 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-brand font-bold text-lg">Delivered Successfully!</p>
            </div>
          )}

          {/* Failed */}
          {order.status === "failed" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">❌</p>
              <p className="text-red-400 font-bold text-lg">Order Failed</p>
              <p className="text-gray-500 text-sm mt-1">Customer will be notified to reschedule</p>
            </div>
          )}

          {/* Timeline */}
          <div className="card p-5">
            <p className="eyebrow mb-4">Timeline</p>
            <div className="space-y-4">
              {order.tracking_events.map((ev, i) => {
                const evMeta = statusMeta[ev.status] || {};
                const isLatest = i === order.tracking_events.length - 1;
                return (
                  <div key={ev.id} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${isLatest ? "bg-brand ring-2 ring-brand/30" : "bg-white/5"}`}>
                        {evMeta.icon || "📍"}
                      </div>
                      {i < order.tracking_events.length - 1 && <div className="w-px h-5 bg-white/10 mt-1" />}
                    </div>
                    <div>
                      <p className={`text-sm font-medium capitalize ${isLatest ? "text-white" : "text-gray-400"}`}>
                        {ev.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-gray-600 text-xs mt-0.5">{new Date(ev.created_at).toLocaleString()}</p>
                      {ev.note && <p className="text-gray-400 text-xs italic mt-1 bg-white/5 rounded px-2 py-1 inline-block">{ev.note}</p>}
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
            <div className="card overflow-hidden" style={{ height: "400px" }}>
              {order.pickup_lat ? (
                <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading map…</div>}>
                  <MapView
                    pickup={[order.pickup_lat, order.pickup_lng]}
                    drop={[order.drop_lat, order.drop_lng]}
                    agent={null}
                    onRoute={setEta}
                  />
                </Suspense>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">Map unavailable</div>
              )}
            </div>
            {eta && (
              <div className="mt-3 card p-3 flex items-center gap-2">
                <span className="text-lg">🛣️</span>
                <div>
                  <p className="text-white text-sm font-semibold">~{Math.max(1, Math.round(eta.durationMin))} min · {eta.distanceKm.toFixed(1)} km</p>
                  <p className="text-gray-500 text-xs">Driving route to the doorstep</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
