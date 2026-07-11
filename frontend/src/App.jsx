import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CustomerDashboard from "./pages/CustomerDashboard";
import AgentDashboard from "./pages/AgentDashboard";
import AgentOrderDetail from "./pages/AgentOrderDetail";
import AgentMap from "./pages/AgentMap";
import AdminDashboard from "./pages/AdminDashboard";
import NewOrder from "./pages/NewOrder";
import OrderTracking from "./pages/OrderTracking";
import PaymentPage from "./pages/PaymentPage";

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/login" replace />;
  return children;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin")    return <Navigate to="/admin"    replace />;
  if (user.role === "agent")    return <Navigate to="/agent"    replace />;
  if (user.role === "customer") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Customer routes */}
          <Route path="/dashboard" element={
            <RequireAuth role="customer"><CustomerDashboard /></RequireAuth>
          } />
          <Route path="/orders/new" element={
            <RequireAuth role="customer"><NewOrder /></RequireAuth>
          } />
          <Route path="/orders/:id" element={
            <RequireAuth role="customer"><OrderTracking /></RequireAuth>
          } />
          <Route path="/orders/:id/pay" element={
            <RequireAuth role="customer"><PaymentPage /></RequireAuth>
          } />

          {/* Agent routes */}
          <Route path="/agent" element={
            <RequireAuth role="agent"><AgentDashboard /></RequireAuth>
          } />
          <Route path="/agent/orders/:id" element={
            <RequireAuth role="agent"><AgentOrderDetail /></RequireAuth>
          } />
          <Route path="/agent/map" element={
            <RequireAuth role="agent"><AgentMap /></RequireAuth>
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <RequireAuth role="admin"><AdminDashboard /></RequireAuth>
          } />

          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
