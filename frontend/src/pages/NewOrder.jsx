import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import AddressAutocomplete from "../components/AddressAutocomplete";
import Brand from "../components/Brand";

const MapView = lazy(() => import("../components/MapView"));

const PACKAGE_PRESETS = [
  { label: "Small",  icon: "📦", sub: "≤1 kg · 20×15×10cm",  vals: { length_cm:"20", breadth_cm:"15", height_cm:"10", actual_weight_kg:"0.5" } },
  { label: "Medium", icon: "📫", sub: "≤3 kg · 35×25×20cm",  vals: { length_cm:"35", breadth_cm:"25", height_cm:"20", actual_weight_kg:"2"   } },
  { label: "Large",  icon: "🗃️", sub: "≤7 kg · 50×40×30cm",  vals: { length_cm:"50", breadth_cm:"40", height_cm:"30", actual_weight_kg:"5"   } },
  { label: "Custom", icon: "✏️", sub: "Enter manually",        vals: null },
];

const steps = ["Addresses", "Package", "Review"];

export default function NewOrder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [pickup, setPickup] = useState({ address: "", lat: null, lng: null });
  const [drop, setDrop]     = useState({ address: "", lat: null, lng: null });
  const [dims, setDims]     = useState({ length_cm:"", breadth_cm:"", height_cm:"", actual_weight_kg:"" });
  const [orderType, setOrderType]     = useState("B2C");
  const [paymentType, setPaymentType] = useState("Prepaid");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [estimate, setEstimate]       = useState(null);
  const [estimating, setEstimating]   = useState(false);
  const [eta, setEta]                 = useState(null);   // road distance/time from OSRM

  useEffect(() => {
    if (!pickup.lat || !drop.lat ||
        !dims.length_cm || !dims.breadth_cm || !dims.height_cm || !dims.actual_weight_kg) {
      setEstimate(null); return;
    }
    const controller = new AbortController();
    const run = async () => {
      setEstimating(true);
      try {
        const r = await client.post("/orders/estimate", {
          pickup_address: pickup.address, pickup_lat: pickup.lat, pickup_lng: pickup.lng,
          drop_address: drop.address, drop_lat: drop.lat, drop_lng: drop.lng,
          length_cm: +dims.length_cm, breadth_cm: +dims.breadth_cm,
          height_cm: +dims.height_cm, actual_weight_kg: +dims.actual_weight_kg,
          order_type: orderType, payment_type: paymentType,
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

  const placeOrder = async () => {
    setLoading(true); setError("");
    try {
      const r = await client.post("/orders/", {
        pickup_address: pickup.address, pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        drop_address: drop.address, drop_lat: drop.lat, drop_lng: drop.lng,
        order_type: orderType, payment_type: paymentType,
        length_cm: +dims.length_cm, breadth_cm: +dims.breadth_cm,
        height_cm: +dims.height_cm, actual_weight_kg: +dims.actual_weight_kg,
      });
      const order = r.data;
      if (paymentType === "Prepaid") {
        navigate(`/orders/${order.id}/pay`, { state: { order } });
      } else {
        navigate(`/orders/${order.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to place order");
    } finally { setLoading(false); }
  };

  const canGoNext = step === 0
    ? (pickup.lat && drop.lat)
    : step === 1
    ? (dims.length_cm && dims.breadth_cm && dims.height_cm && dims.actual_weight_kg)
    : true;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/[0.08] bg-ink px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition"
        >
          ← Back to Dashboard
        </button>
        <Brand size="sm" subtitle="New Order" />
      </div>

      <div className="flex flex-1 max-w-6xl mx-auto w-full gap-8 p-8">
        {/* Left: form */}
        <div className="flex-1 space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  i === step ? "bg-brand text-black"
                  : i < step  ? "bg-brand/15 text-brand"
                  : "bg-white/5 text-gray-500"
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                    i < step ? "bg-brand text-black" : ""
                  }`}>
                    {i < step ? "✓" : i + 1}
                  </span>
                  {s}
                </div>
                {i < steps.length - 1 && <div className={`h-px w-6 ${i < step ? "bg-brand" : "bg-white/10"}`} />}
              </div>
            ))}
          </div>

          {/* Step 0: Addresses */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-white text-xl font-bold mb-1">Where to?</h2>
                <p className="text-gray-400 text-sm">Pickup hub and the delivery doorstep</p>
              </div>

              <div className="card p-5 space-y-4">
                <div>
                  <label className="eyebrow mb-2 block">Pickup / Hub</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 z-10" />
                    <AddressAutocomplete
                      placeholder="Search pickup / hub address…"
                      onSelect={r => setPickup({ address: r.address, lat: r.lat, lng: r.lng })}
                      className="pl-8"
                    />
                  </div>
                  {pickup.lat && <p className="text-xs text-brand mt-1.5 ml-1">✓ Location confirmed</p>}
                </div>

                <div className="border-l-2 border-dashed border-white/15 ml-1 h-4" />

                <div>
                  <label className="eyebrow mb-2 block">Delivery address (doorstep)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-400 z-10" />
                    <AddressAutocomplete
                      placeholder="Search the customer's doorstep…"
                      onSelect={r => setDrop({ address: r.address, lat: r.lat, lng: r.lng })}
                      className="pl-8"
                    />
                  </div>
                  {drop.lat && <p className="text-xs text-brand mt-1.5 ml-1">✓ Location confirmed</p>}
                </div>
              </div>

              {/* Inline map preview */}
              {(pickup.lat || drop.lat) && (
                <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ height: "240px" }}>
                  <Suspense fallback={<div className="h-full bg-ink flex items-center justify-center text-gray-500 text-sm">Loading map…</div>}>
                    <MapView
                      pickup={pickup.lat ? [pickup.lat, pickup.lng] : null}
                      drop={drop.lat ? [drop.lat, drop.lng] : null}
                      agent={null}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Package */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-white text-xl font-bold mb-1">Package Details</h2>
                <p className="text-gray-400 text-sm">Select a preset or enter custom dimensions</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PACKAGE_PRESETS.map(p => (
                  <button key={p.label} type="button"
                    onClick={() => p.vals && setDims(p.vals)}
                    className={`bg-ink border rounded-2xl p-4 text-left transition hover:border-brand/60 ${
                      p.vals && dims.length_cm === p.vals.length_cm
                        ? "border-brand bg-brand/5"
                        : "border-white/[0.08]"
                    }`}>
                    <span className="text-2xl">{p.icon}</span>
                    <p className="text-white font-semibold mt-2">{p.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{p.sub}</p>
                  </button>
                ))}
              </div>

              <div className="card p-5 space-y-4">
                <p className="text-gray-300 text-sm font-medium">Dimensions & Weight</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "length_cm", label: "Length (cm)" },
                    { key: "breadth_cm", label: "Breadth (cm)" },
                    { key: "height_cm", label: "Height (cm)" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 mb-1.5 block">{f.label}</label>
                      <input type="number"
                        className="field !px-3 !py-2.5"
                        value={dims[f.key]}
                        onChange={e => setDims({ ...dims, [f.key]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Actual Weight (kg)</label>
                  <input type="number" step="0.1"
                    className="field !px-3 !py-2.5"
                    value={dims.actual_weight_kg}
                    onChange={e => setDims({ ...dims, actual_weight_kg: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card p-4">
                  <label className="text-xs text-gray-500 mb-2 block">Order Type</label>
                  <div className="flex gap-2">
                    {["B2C","B2B"].map(t => (
                      <button key={t} type="button" onClick={() => setOrderType(t)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                          orderType === t ? "bg-brand text-black" : "bg-white/5 text-gray-400 hover:text-white"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card p-4">
                  <label className="text-xs text-gray-500 mb-2 block">Payment</label>
                  <div className="flex gap-2">
                    {["Prepaid","COD"].map(t => (
                      <button key={t} type="button" onClick={() => setPaymentType(t)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                          paymentType === t ? "bg-brand text-black" : "bg-white/5 text-gray-400 hover:text-white"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-white text-xl font-bold mb-1">Review & Confirm</h2>
                <p className="text-gray-400 text-sm">Check everything before placing the order</p>
              </div>

              <div className="card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-500 text-xs">Pickup / Hub</p>
                    <p className="text-white text-sm font-medium mt-0.5">{pickup.address}</p>
                  </div>
                </div>
                <div className="border-l-2 border-dashed border-white/15 ml-1 h-3" />
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-500 text-xs">Delivery doorstep</p>
                    <p className="text-white text-sm font-medium mt-0.5">{drop.address}</p>
                  </div>
                </div>
                {eta && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                    <span>🛣️</span> ~{eta.distanceKm.toFixed(1)} km · ~{Math.max(1, Math.round(eta.durationMin))} min by road
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4">
                  <p className="text-gray-500 text-xs">Dimensions</p>
                  <p className="text-white text-sm font-semibold mt-1">{dims.length_cm}×{dims.breadth_cm}×{dims.height_cm} cm</p>
                </div>
                <div className="card p-4">
                  <p className="text-gray-500 text-xs">Weight</p>
                  <p className="text-white text-sm font-semibold mt-1">{dims.actual_weight_kg} kg</p>
                </div>
                <div className="card p-4">
                  <p className="text-gray-500 text-xs">Payment</p>
                  <p className="text-white text-sm font-semibold mt-1">{paymentType}</p>
                </div>
              </div>

              {/* Price estimate */}
              {estimating ? (
                <div className="card p-5 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-white/10 rounded w-full mb-2" />
                  <div className="h-3 bg-white/10 rounded w-2/3" />
                </div>
              ) : estimate ? (
                <div className="bg-brand/[0.06] border border-brand/25 rounded-2xl p-5">
                  <p className="text-brand text-xs font-semibold uppercase tracking-[0.12em] mb-4">Price Breakdown</p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Billed weight", value: `${estimate.billed_weight_kg} kg` },
                      { label: "Base charge", value: `₹${estimate.base_charge}` },
                      { label: `Distance (${estimate.distance_km} km)`, value: `₹${estimate.distance_charge}` },
                      ...(estimate.cod_surcharge > 0 ? [{ label: "COD surcharge", value: `₹${estimate.cod_surcharge}` }] : []),
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-gray-400">{row.label}</span>
                        <span className="text-white font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-brand/20 mt-4 pt-4 flex justify-between items-center">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-2xl font-bold text-brand">₹{estimate.total_charge}</span>
                  </div>
                  {paymentType === "Prepaid" && (
                    <p className="text-brand/60 text-xs mt-3 text-center">You'll pay via Razorpay after placing the order</p>
                  )}
                </div>
              ) : null}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-4">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="btn-ghost flex-1 py-3 text-sm"
              >
                ← Back
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canGoNext}
                className="btn-accent flex-1 py-3 text-sm"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={placeOrder}
                disabled={loading}
                className="btn-accent flex-1 py-3 text-sm shadow-brand"
              >
                {loading ? "Placing…" : paymentType === "Prepaid" ? "Place Order & Pay →" : "Place Order (COD) →"}
              </button>
            )}
          </div>
        </div>

        {/* Right: map */}
        <div className="hidden lg:block w-80 xl:w-96">
          <div className="sticky top-8">
            <div className="card overflow-hidden" style={{ height: "500px" }}>
              {(pickup.lat || drop.lat) ? (
                <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading…</div>}>
                  <MapView
                    pickup={pickup.lat ? [pickup.lat, pickup.lng] : null}
                    drop={drop.lat ? [drop.lat, drop.lng] : null}
                    agent={null}
                    onRoute={setEta}
                  />
                </Suspense>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-600">
                  <span className="text-4xl mb-3">🗺️</span>
                  <p className="text-sm">Map preview</p>
                  <p className="text-xs mt-1">Enter addresses to see route</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
