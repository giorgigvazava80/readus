import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Shield, Menu, X, Languages } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/i18n";
import { isAdminAppHost } from "@/lib/runtime";
import { logout } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface NavItem {
  labelKey: string;
  defaultLabel: string;
  path: string;
}

const publicUserNav: NavItem[] = [
  { labelKey: "nav.home", defaultLabel: "Home", path: "/" },
  { labelKey: "nav.browse", defaultLabel: "ბიბლიოთეკა", path: "/browse" },
];

const adminNav: NavItem[] = [
  { labelKey: "nav.home", defaultLabel: "Home", path: "/admin" },
  { labelKey: "nav.redactors", defaultLabel: "Redactors", path: "/admin/redactors" },
  { labelKey: "nav.writerApps", defaultLabel: "ავტორის განაცხადები", path: "/admin/writer-applications" },
  { labelKey: "nav.contentReview", defaultLabel: "კონტენტის განხილვა", path: "/admin/content-review" },
  { labelKey: "nav.auditLogs", defaultLabel: "აუდიტის ჟურნალი", path: "/admin/audit-logs" },
  { labelKey: "nav.settings", defaultLabel: "Settings", path: "/admin/settings" },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { me } = useSession();
  const { language, toggleLanguage, t } = useI18n();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);

  const adminHost = isAdminAppHost();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 16);

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [lastScrollY]);

  useEffect(() => {
    setMobileOpen(false);
    setIsVisible(true);
  }, [location.pathname]);

  const navItems = useMemo(() => {
    if (adminHost) return adminNav;
    if (!me) return publicUserNav;

    const dashboardNav: NavItem[] = [
      { labelKey: "nav.dashboard", defaultLabel: "Dashboard", path: "/dashboard" },
    ];

    if (me.is_writer_approved) {
      dashboardNav.push({ labelKey: "nav.newWork", defaultLabel: "ახალი ნაშრომი", path: "/writer/new" });
    } else {
      dashboardNav.push({ labelKey: "nav.writerApp", defaultLabel: "Writer App", path: "/writer-application" });
    }

    dashboardNav.push({ labelKey: "nav.myWorks", defaultLabel: "ჩემი ნაშრომები", path: "/my-works" });
    dashboardNav.push({ labelKey: "nav.settings", defaultLabel: "Settings", path: "/settings" });

    return [...publicUserNav, ...dashboardNav];
  }, [adminHost, me]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
    navigate("/");
  };

  return (
    <div ref={navRef}>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"} ${scrolled
          ? "bg-background/70 backdrop-blur-lg shadow-sm border-b border-border/40"
          : "bg-background/60 backdrop-blur-md border-b border-transparent"
          }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={adminHost ? "/admin" : "/"} className="group flex flex-shrink-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-105"
              style={{ background: "var(--hero-gradient)" }}
            >
              {adminHost ? <Shield className="h-4 w-4 text-white" /> : <BookOpen className="h-4 w-4 text-white" />}
            </div>
            <span className={`font-display font-bold tracking-tight text-foreground transition-all duration-300 ${scrolled ? "text-lg" : "text-xl"}`}>
              {adminHost ? t("brand.admin", "read us admin") : t("brand.user", "read us")}
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 overflow-hidden xl:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`relative font-ui text-sm transition-colors ${isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {t(item.labelKey, item.defaultLabel)}
                    {isActive ? (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full"
                        style={{ background: "var(--hero-gradient)" }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="gap-1.5 font-ui"
              aria-label={t("lang.label", "Language")}
              title={t("lang.label", "Language")}
            >
              <Languages className="h-3.5 w-3.5" />
              {language === "en" ? t("lang.switchToKa", "KA") : t("lang.switchToEn", "EN")}
            </Button>

            {me ? (
              <>
                <span className="hidden rounded-full border border-border/70 bg-card/80 px-3 py-1 font-ui text-xs text-muted-foreground lg:inline-flex">
                  {me.username}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="gap-1.5 font-ui"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {isLoggingOut ? "..." : t("nav.logout", "Logout")}
                </Button>
              </>
            ) : (
              <>
                <Link to={adminHost ? "/admin/login" : "/login"} className="hidden sm:block">
                  <Button variant="outline" size="sm" className="font-ui">{t("nav.login", "Login")}</Button>
                </Link>
                {!adminHost ? (
                  <Link to="/register" className="hidden sm:block">
                    <Button size="sm" className="font-ui shadow-sm transition-all hover:shadow-warm">
                      {t("nav.register", "Register")}
                    </Button>
                  </Link>
                ) : null}
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground xl:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={t("nav.toggleMenu", "Toggle menu")}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.span
                    key="x"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="h-5 w-5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="h-5 w-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="glass-panel fixed left-0 right-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b xl:hidden"
          >
            <div className="container mx-auto space-y-1 px-4 py-4">
              {navItems.map((item, i) => {
                const isActive = location.pathname === item.path;
                return (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link to={item.path}>
                      <div
                        className={`flex items-center rounded-lg px-3 py-2.5 font-ui text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        style={isActive ? { background: "hsl(36 70% 50% / 0.08)" } : undefined}
                      >
                        {t(item.labelKey, item.defaultLabel)}
                        {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}

              {!me ? (
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navItems.length * 0.04 }}
                  className="flex flex-col gap-2 pb-1 pt-2"
                >
                  <Link to={adminHost ? "/admin/login" : "/login"}>
                    <Button variant="outline" size="sm" className="w-full font-ui">{t("nav.login", "Login")}</Button>
                  </Link>
                  {!adminHost ? (
                    <Link to="/register">
                      <Button size="sm" className="w-full font-ui">{t("nav.register", "Register")}</Button>
                    </Link>
                  ) : null}
                </motion.div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default Navbar;

