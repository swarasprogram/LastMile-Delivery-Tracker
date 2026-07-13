import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import client from "../api/client";
import Brand from "../components/Brand";

export default function PaymentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState(location.state?.order || null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const canceled = new URLSearchParams(location.search).get("canceled") === "1";

  useEffect(() => {
    if (!order) {
      client.get(`/orders/${id}`).then(r => setOrder(r.data)).catch(() => navigate("/dashboard"));
    }
  }, [id]);

  const handlePay = async () => {
    setPaying(true); setError("");
    try {
      const r = await client.post(`/payments/create-checkout`, { order_id: id });
      // Redirect to Stripe's hosted, PCI-compliant checkout page
      window.location.href = r.data.checkout_url;
    } catch (err) {
      setError(err.response?.data?.detail || "Could not start checkout.");
      setPaying(false);
    }
  };

  if (!order) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/[0.08] bg-ink px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
          ← Dashboard
        </button>
        <Brand size="sm" subtitle="Secure Payment" />
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>🔒</span> Secured by Stripe
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-3xl mx-auto mb-4">
              💳
            </div>
            <h1 className="text-white text-2xl font-bold">Complete Payment</h1>
            <p className="text-gray-400 text-sm mt-1">Your order is confirmed. Pay to dispatch it.</p>
          </div>

          {canceled && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm rounded-xl p-3 text-center">
              Payment was canceled. You can try again below.
            </div>
          )}

          {/* Order summary */}
          <div className="card p-5">
            <p className="eyebrow mb-4">Order Summary</p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-500 text-xs">Pickup / Hub</p>
                  <p className="text-white text-sm font-medium truncate">{order.pickup_address.split(",")[0]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-500 text-xs">Delivery doorstep</p>
                  <p className="text-white text-sm font-medium truncate">{order.drop_address.split(",")[0]}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                { label: "Billed weight", value: `${order.billed_weight_kg} kg` },
                { label: "Base charge",   value: `₹${order.base_charge}` },
                ...(order.cod_surcharge > 0 ? [{ label: "COD surcharge", value: `₹${order.cod_surcharge}` }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="text-white">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 mt-4 pt-4 flex justify-between items-center">
              <span className="text-white font-semibold">Amount to Pay</span>
              <span className="text-3xl font-bold text-brand">₹{order.total_charge}</span>
            </div>
          </div>

          {/* Test-mode hint */}
          <div className="card p-4 text-xs text-gray-400">
            <p className="text-gray-500 mb-1">Stripe test mode — use test card</p>
            <p className="font-mono text-white">4242 4242 4242 4242 · any future date · any CVC</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-4 flex gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={paying}
            className="btn-accent w-full py-4 text-base flex items-center justify-center gap-2 shadow-brand"
          >
            {paying ? (
              <>
                <div className="w-4 h-4 border-2 border-black/70 border-t-transparent rounded-full animate-spin" />
                Redirecting to Stripe…
              </>
            ) : (
              <>🔒 Pay ₹{order.total_charge}</>
            )}
          </button>

          <p className="text-center text-xs text-gray-600">
            You'll be redirected to Stripe's secure checkout. All transactions are encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
