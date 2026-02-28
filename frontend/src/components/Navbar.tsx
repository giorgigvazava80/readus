import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Shield } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { isAdminAppHost } from "@/lib/runtime";
import { logout } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  path: string;
}

const publicUserNav: NavItem[] = [
  { label: "Home", path: "/" },
  { label: "Browse", path: "/browse" },
  { label: "Books", path: "/books" },
  { label: "Poems", path: "/poems" },
  { label: "Stories", path: "/stories" },
];

const adminNav: NavItem[] = [
  { label: "Home", path: "/admin" },
  { label: "Redactors", path: "/admin/redactors" },
  { label: "Writer Apps", path: "/admin/writer-applications" },
  { label: "Content Review", path: "/admin/content-review" },
  { label: "Audit Logs", path: "/admin/audit-logs" },
  { label: "Settings", path: "/admin/settings" },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { me } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const adminHost = isAdminAppHost();

  const navItems = useMemo(() => {
    if (adminHost) {
      return adminNav;
    }
    if (!me) {
      return publicUserNav;
    }

    const userNav: NavItem[] = [
      { label: "Dashboard", path: "/dashboard" },
      { label: "My Works", path: "/my-works" },
      { label: "Settings", path: "/settings" },
    ];

    if (me.is_writer_approved) {
      userNav.splice(1, 0, { label: "New Work", path: "/writer/new" });
      userNav.splice(2, 0, { label: "Writer Desk", path: "/writer/dashboard" });
    } else {
      userNav.splice(1, 0, { label: "Writer App", path: "/writer-application" });
    }

    return [...publicUserNav, ...userNav];
  }, [adminHost, me]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
    navigate(adminHost ? "/admin/login" : "/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-6">
        <Link to={adminHost ? "/admin" : "/"} className="flex items-center gap-2.5">
          {adminHost ? (
            <Shield className="h-6 w-6 text-primary" />
          ) : (
            <BookOpen className="h-6 w-6 text-primary" />
          )}
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            {adminHost ? "Quill & Page Admin" : "Quill & Page"}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={location.pathname === item.path ? "secondary" : "ghost"}
                size="sm"
                className="font-ui text-sm"
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
                className="gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                {isLoggingOut ? "..." : "Logout"}
              </Button>
            </>
          ) : (
            <>
              <Link to={adminHost ? "/admin/login" : "/login"}>
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
              {!adminHost ? (
                <Link to="/register">
                  <Button size="sm">Register</Button>
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="xl:hidden">
        <div className="container mx-auto flex items-center gap-2 overflow-x-auto px-6 pb-3 pt-1">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={location.pathname === item.path ? "secondary" : "ghost"}
                size="sm"
                className="whitespace-nowrap font-ui text-sm"
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
