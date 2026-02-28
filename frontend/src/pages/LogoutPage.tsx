import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "@/lib/api";
import { isAdminAppHost } from "@/lib/runtime";

const LogoutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      await logout();
      navigate(isAdminAppHost() ? "/admin/login" : "/login", { replace: true });
    };

    void run();
  }, [navigate]);

  return <div className="text-sm text-muted-foreground">Logging out...</div>;
};

export default LogoutPage;
