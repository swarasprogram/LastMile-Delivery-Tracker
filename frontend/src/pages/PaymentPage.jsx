import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

export default function PaymentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [order, setOrder] = useState(location.state?.order || null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!order) {
      client.get(`/orders/${id}`).then(r => setOrder(r.data)).catch(() => navigate("/dashboard"));
    }
  }, [id]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handlePay = async () => {
    setPaying(true); setError("");
    try {
      const r = await client.post(`/payments/create-order`, { order_id: id });
      const { razorpay_order_id, amount, currency, key } = r.data;

      const options = {
        key,
        amount,
        currency,
        name: "Last-Mile Tracker",
        description: "Delivery Payment",
        order_id: razorpay_order_id,
        prefill: { name: user?.name || "", email: user?.email || "" },
        theme: { color: "#2563EB" },
        handler: async (response) => {
          try {
            await client.post(`/payments/verify`, {
              order_id: id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(`/orders/${id}`, { replace: true });
          } catch {
            setError("Payment verification failed. Please contact support.");
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not initiate payment.");
      setPaying(false);
    }
  };

  if (!order) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition">
          ← Dashboard
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xs font-bold">LM</div>
          <span className="text-white font-semibold text-sm">Secure Payment</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>🔒</span> Secured by Razorpay
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
              💳
            </div>
            <h1 className="text-white text-2xl font-bold">Complete Payment</h1>
            <p className="text-gray-400 text-sm mt-1">Your order is confirmed. Pay to dispatch it.</p>
          </div>

          {/* Order summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4">Order Summary</p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs">From</p>
                  <p className="text-white text-sm font-medium truncate">{order.pickup_address.split(",")[0]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3">
                <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs">To</p>
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

            <div className="border-t border-gray-700 mt-4 pt-4 flex justify-between items-center">
              <span className="text-white font-semibold">Amount to Pay</span>
              <span className="text-3xl font-bold text-blue-400">₹{order.total_charge}</span>
            </div>
          </div>

          {/* Payment methods hint */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
            <p className="text-gray-500 text-xs">Accepted methods</p>
            <div className="flex gap-2 text-xs text-gray-400">
              <span className="bg-gray-800 px-2 py-1 rounded-lg">UPI</span>
              <span className="bg-gray-800 px-2 py-1 rounded-lg">Cards</span>
              <span className="bg-gray-800 px-2 py-1 rounded-lg">Net Banking</span>
              <span className="bg-gray-800 px-2 py-1 rounded-lg">Wallets</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700/30 text-red-400 text-sm rounded-xl p-4 flex gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={paying || !scriptLoaded}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-base transition shadow-xl shadow-blue-900/30 flex items-center justify-center gap-2"
          >
            {paying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Opening Razorpay…
              </>
            ) : (
              <>🔒 Pay ₹{order.total_charge}</>
            )}
          </button>

          <p className="text-center text-xs text-gray-600">
            By paying, you agree to our terms. All transactions are encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
