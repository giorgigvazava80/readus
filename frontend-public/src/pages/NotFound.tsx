import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

const NotFound = () => {
  const { t } = useI18n();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,hsl(var(--primary)/0.16),transparent_35%),radial-gradient(circle_at_82%_12%,hsl(var(--accent)/0.1),transparent_30%)]" />
      <div className="relative w-full max-w-xl rounded-2xl border border-border/70 bg-card/85 p-8 text-center shadow-card backdrop-blur-sm">
        <p className="font-display text-7xl font-bold text-gradient-primary">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">{t("notFound.title", "Page not found")}</h1>
        <p className="mt-2 font-ui text-muted-foreground">
          {t("notFound.message", "The route {path} does not exist.").replace("{path}", location.pathname)}
        </p>
        <Link to="/" className="mt-6 inline-flex">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            {t("notFound.returnHome", "Return Home")}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
