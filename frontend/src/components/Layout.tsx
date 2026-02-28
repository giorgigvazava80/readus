import { Outlet } from "react-router-dom";

import { isAdminAppHost } from "@/lib/runtime";
import Navbar from "./Navbar";

const Layout = () => {
  const adminHost = isAdminAppHost();

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.14),transparent_38%),radial-gradient(circle_at_85%_18%,hsl(var(--accent)/0.12),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.45)_0%,hsl(var(--background))_45%)]" />
      </div>
      <Navbar />
      <main className="relative">
        <Outlet />
      </main>
      {!adminHost ? (
        <footer className="border-t border-border/70 py-12">
          <div className="container mx-auto px-6 text-center">
            <p className="font-display text-lg text-foreground">Quill &amp; Page</p>
            <p className="mt-1 font-ui text-sm text-muted-foreground">
              A home for stories worth telling.
            </p>
          </div>
        </footer>
      ) : null}
    </div>
  );
};

export default Layout;