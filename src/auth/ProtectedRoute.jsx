import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) return <div style={{ padding: 20 }}>Chargement...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
