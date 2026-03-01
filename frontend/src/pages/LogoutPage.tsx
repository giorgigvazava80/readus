import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "@/lib/api";

const LogoutPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      await logout();
      navigate("/", { replace: true });
    };

    void run();
  }, [navigate]);

  return <div className="text-sm text-muted-foreground">Logging out...</div>;
};

export default LogoutPage;
