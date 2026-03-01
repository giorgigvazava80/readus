import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "@/hooks/useSession";
import { isAdminAppHost } from "@/lib/runtime";

function LoadingScreen() {
  return <div className="p-8 text-sm text-muted-foreground">იტვირთება...</div>;
}

export function UserAppOnly({ children }: { children: JSX.Element }) {
  if (isAdminAppHost()) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

export function AdminAppOnly({ children }: { children: JSX.Element }) {
  if (!isAdminAppHost()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const { me, isLoading, isAuthenticated } = useSession();
  const adminHost = isAdminAppHost();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !me) {
    return <Navigate to={adminHost ? "/admin/login" : "/login"} replace state={{ from: location }} />;
  }

  const verifyPath = adminHost ? "/admin/verify-email" : "/verify-email";
  if (!me.is_email_verified && location.pathname !== verifyPath) {
    return <Navigate to={verifyPath} replace />;
  }

  const settingsPath = adminHost ? "/admin/settings" : "/settings";
  if (!adminHost && me.forced_password_change && location.pathname !== settingsPath) {
    return <Navigate to={settingsPath} replace />;
  }

  return children;
}

export function RequireAdminAccess({ children }: { children: JSX.Element }) {
  const { me, isLoading } = useSession();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!me) {
    return <Navigate to="/admin/login" replace />;
  }

  const canAccess = me.is_admin || me.is_redactor;
  if (!canAccess) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export function RequireWriterApproved({ children }: { children: JSX.Element }) {
  const { me, isLoading } = useSession();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!me) {
    return <Navigate to="/login" replace />;
  }

  if (!me.is_writer_approved) {
    return <Navigate to="/writer-application" replace />;
  }

  return children;
}



