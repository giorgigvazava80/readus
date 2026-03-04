import { Outlet, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { isAdminAppHost } from "@/lib/runtime";
import { useSession } from "@/hooks/useSession";
import Navbar from "./Navbar";

const Layout = () => {
  const adminHost = isAdminAppHost();
  const { t } = useI18n();
  const { isAuthenticated } = useSession();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.14),transparent_38%),radial-gradient(circle_at_85%_18%,hsl(var(--accent)/0.12),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.45)_0%,hsl(var(--background))_45%)]" />
      </div>

      <Navbar />

      <main className="relative flex-1">
        <Outlet />
      </main>

      {!adminHost ? (
        <footer className="border-t border-border/30 bg-card/30 mt-auto">
          {/* CTA - only show for visitors who are NOT logged in */}
          {!isAuthenticated && (
            <div className="py-12 px-6" style={{ background: "var(--hero-gradient-subtle)" }}>
              <div className="container mx-auto">
                <div className="max-w-2xl mx-auto text-center space-y-4">
                  <h2 className="font-display text-2xl font-bold text-foreground md:text-4xl leading-tight">
                    {t("layout.cta.title", "Ready to share your story?")}
                  </h2>
                  <p className="font-ui text-sm md:text-base text-muted-foreground">
                    {t("layout.cta.subtitle", "Join hundreds of authors who've found their readership on Readus.")}
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-ui text-sm font-semibold text-white shadow-warm transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
                      style={{ background: "var(--hero-gradient)" }}
                    >
                      {t("layout.cta.button", "Join Free")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Minimal footer */}
          <div className="container mx-auto px-6 py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-ui text-xs text-muted-foreground">
                &copy; 2026 Readus. All rights reserved.
              </p>
              <p className="font-body text-xs italic text-muted-foreground">
                A home for stories worth telling.
              </p>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
};

export default Layout;
