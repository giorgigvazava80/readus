import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Shield, Languages, Bell, Home, Compass, PenTool, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { useSession } from "@/hooks/useSession";
import { useI18n } from "@/i18n";
import { isAdminAppHost } from "@/lib/runtime";
import { fetchNotificationUnreadCount, logout } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface NavItem {
  labelKey: string;
  defaultLabel: string;
  path: string;
}

const publicUserNav: NavItem[] = [
  { labelKey: "nav.home", defaultLabel: "Home", path: "/" },
  { labelKey: "nav.browse", defaultLabel: "Library", path: "/browse" },
  { labelKey: "nav.authors", defaultLabel: "Authors", path: "/authors" },
];

const adminNav: NavItem[] = [
  { labelKey: "nav.home", defaultLabel: "Home", path: "/admin" },
  { labelKey: "nav.redactors", defaultLabel: "Redactors", path: "/admin/redactors" },
  { labelKey: "nav.writerApps", defaultLabel: "Writer Applications", path: "/admin/writer-applications" },
  { labelKey: "nav.contentReview", defaultLabel: "Content Review", path: "/admin/content-review" },
  { labelKey: "nav.auditLogs", defaultLabel: "Audit Logs", path: "/admin/audit-logs" },
  { labelKey: "nav.settings", defaultLabel: "Settings", path: "/admin/settings" },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { me } = useSession();
  const { language, toggleLanguage, t } = useI18n();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [readingFocus, setReadingFocus] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1279px)").matches;
  });
  const [editorHeaderInView, setEditorHeaderInView] = useState(true);
  const navRef = useRef<HTMLDivElement>(null);

  const adminHost = isAdminAppHost();
  const isWriterEditorRoute = useMemo(() => {
    if (adminHost) return false;
    return /^\/writer\/(books|poems|stories|chapters)\/[^/]+\/edit\/?$/.test(location.pathname);
  }, [adminHost, location.pathname]);
  const unreadQuery = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: fetchNotificationUnreadCount,
    enabled: Boolean(me),
    refetchInterval: 20000,
  });

  // Listen for reading-focus custom events from PublicReadPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setReadingFocus(Boolean(detail?.active));
    };
    window.addEventListener("reading-focus", handler);
    return () => window.removeEventListener("reading-focus", handler);
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
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
    };
    setIsCompactViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isWriterEditorRoute || !isCompactViewport) {
      setEditorHeaderInView(true);
      return;
    }

    let intersectionObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    const visibilityByAnchor = new Map<HTMLElement, boolean>();

    const isAnchorInViewport = (anchor: HTMLElement) => {
      const rect = anchor.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    };

    const bindAnchors = () => {
      const anchors = Array.from(
        document.querySelectorAll<HTMLElement>('[data-editor-header-anchor="true"]'),
      );
      if (!anchors.length) {
        return false;
      }

      intersectionObserver?.disconnect();
      visibilityByAnchor.clear();

      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            visibilityByAnchor.set(
              entry.target as HTMLElement,
              entry.isIntersecting && entry.intersectionRatio > 0,
            );
          });
          setEditorHeaderInView(Array.from(visibilityByAnchor.values()).some(Boolean));
        },
        { threshold: [0, 0.01] },
      );

      anchors.forEach((anchor) => {
        visibilityByAnchor.set(anchor, false);
        intersectionObserver?.observe(anchor);
      });

      setEditorHeaderInView(anchors.some(isAnchorInViewport));
      return true;
    };

    if (!bindAnchors()) {
      setEditorHeaderInView(true);
      mutationObserver = new MutationObserver(() => {
        if (bindAnchors()) {
          mutationObserver?.disconnect();
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      intersectionObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [isWriterEditorRoute, isCompactViewport, location.pathname]);

  useEffect(() => {
    setIsVisible(true);
  }, [location.pathname]);

  const navItems = useMemo(() => {
    if (adminHost) return adminNav;
    if (!me) return publicUserNav;

    const dashboardNav: NavItem[] = [
      { labelKey: "nav.dashboard", defaultLabel: "Dashboard", path: "/dashboard" },
    ];

    if (me.is_writer_approved) {
      dashboardNav.push({ labelKey: "nav.analytics", defaultLabel: "Analytics", path: "/writer/analytics" });
    } else if (me.role_registered === "writer") {
      dashboardNav.push({ labelKey: "nav.writerApp", defaultLabel: "Writer App", path: "/writer-application" });
    }

    return [...publicUserNav, ...dashboardNav];
  }, [adminHost, me]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
    navigate("/");
  };

  const isNotificationsRoute = location.pathname === "/notifications" || location.pathname.startsWith("/notifications/");
  const handleNotificationsToggle = () => {
    if (isNotificationsRoute) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(me ? "/dashboard" : "/");
      }
      return;
    }
    navigate("/notifications");
  };

  const mobileNavItems = useMemo(() => {
    if (adminHost) return [];

    const canSeeWriteNav = !me || me.is_writer_approved || me.role_registered === "writer";

    return [
      { icon: Home, labelKey: "nav.home", defaultLabel: "Home", path: "/" },
      { icon: Compass, labelKey: "nav.browse", defaultLabel: "Browse", path: "/browse" },
      ...(canSeeWriteNav
        ? [{
          icon: PenTool,
          labelKey: "nav.write",
          defaultLabel: "Write",
          path: me ? (me.is_writer_approved ? "/writer/new" : "/writer-application") : "/login",
        }]
        : []),
      {
        icon: User,
        labelKey: "nav.profile",
        defaultLabel: "Profile",
        path: me ? "/dashboard" : "/login",
      },
    ];
  }, [adminHost, me]);

  const shouldHideEditorNav = isWriterEditorRoute && isCompactViewport && !editorHeaderInView;
  const shouldShowTopNav = isWriterEditorRoute && isCompactViewport
    ? !readingFocus && !shouldHideEditorNav
    : !readingFocus && isVisible;
  const shouldShowMobileNav = !adminHost && !readingFocus && !shouldHideEditorNav;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("mobile-nav-visibility", {
        detail: { visible: shouldShowMobileNav },
      }),
    );
  }, [shouldShowMobileNav]);

  return (
    <div ref={navRef}>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${shouldShowTopNav ? "translate-y-0" : "-translate-y-full"} ${scrolled
          ? "bg-background/70 backdrop-blur-lg shadow-sm border-b border-border/40"
          : "bg-background/60 backdrop-blur-md border-b border-transparent"
          }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:px-4 xl:px-6">
          <Link to={adminHost ? "/admin" : "/"} className="group flex flex-shrink-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-105"
              style={{ background: "var(--hero-gradient)" }}
            >
              {adminHost ? <Shield className="h-4 w-4 text-white" /> : <BookOpen className="h-4 w-4 text-white" />}
            </div>
            <span className={`font-display font-bold tracking-tight text-foreground transition-all duration-300 ${scrolled ? "text-lg" : "text-xl"}`}>
              {adminHost ? t("brand.admin", "Readus Admin") : t("brand.user", "Readus")}
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto whitespace-nowrap scrollbar-none xl:flex">
            {navItems.map((item) => {
              const isAuthorsNav = item.path === "/authors";
              const isActive = isAuthorsNav
                ? location.pathname === "/authors" ||
                location.pathname.startsWith("/authors/") ||
                location.pathname === "/browse/authors" ||
                location.pathname.startsWith("/browse/authors/")
                : location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className="shrink-0">
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

          <div className="flex flex-shrink-0 items-center gap-1.5">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNotificationsToggle}
                  aria-label={t("nav.notifications", "Notifications")}
                  title={t("nav.notifications", "Notifications")}
                  className="relative h-9 w-9 p-0"
                >
                  <Bell className="h-4 w-4" />
                  {unreadQuery.data ? (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                      {unreadQuery.data > 9 ? "9+" : unreadQuery.data}
                    </span>
                  ) : null}
                </Button>
                <span className="hidden rounded-full border border-border/70 bg-card/80 px-3 py-1 font-ui text-xs text-muted-foreground 2xl:inline-flex">
                  {me.username}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="hidden xl:flex h-9 w-9 p-0 2xl:h-9 2xl:w-auto 2xl:px-3 gap-1.5 font-ui"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden 2xl:inline">{isLoggingOut ? "..." : t("nav.logout", "Logout")}</span>
                </Button>
              </>
            ) : (
              <>
                <Link to={adminHost ? "/admin/login" : "/login"} className="hidden xl:block">
                  <Button variant="outline" size="sm" className="font-ui">
                    {t("nav.login", "Login")}
                  </Button>
                </Link>
                {!adminHost ? (
                  <Link to="/register" className="hidden xl:block">
                    <Button size="sm" className="font-ui shadow-sm transition-all hover:shadow-warm">
                      {t("nav.register", "Register")}
                    </Button>
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile Bottom Navigation — Wattpad-style (hidden during reading focus) ── */}
      {shouldShowMobileNav && (
        <nav
          data-mobile-bottom-nav="true"
          className="fixed bottom-0 left-0 right-0 z-50 xl:hidden"
          style={{
            background: "hsl(var(--background) / 0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid hsl(var(--border) / 0.4)",
            paddingBottom: "env(safe-area-inset-bottom)",
            boxShadow: "0 -2px 20px rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex items-stretch justify-around h-16">
            {mobileNavItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex flex-col items-center justify-center flex-1 gap-1 py-2 focus:outline-none touch-action-manip transition-colors duration-150 ${isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                >
                  {/* Active pill highlight behind icon */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        layoutId="bottom-nav-pill"
                        className="absolute top-1.5 w-10 h-10 rounded-full"
                        style={{ background: "hsl(var(--primary) / 0.12)" }}
                        initial={{ opacity: 0, scale: 0.75 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.75 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Icon with spring scale on active */}
                  <motion.div
                    animate={{ scale: isActive ? 1.15 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="relative z-10 flex items-center justify-center"
                  >
                    <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                    {item.badge ? (
                      <span className="absolute -top-1.5 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-sm">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    ) : null}
                  </motion.div>

                  {/* Label */}
                  <span
                    className={`z-10 text-[10px] sm:text-[11px] font-ui font-medium leading-none transition-colors ${isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                  >
                    {t(item.labelKey, item.defaultLabel)}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Navbar;
