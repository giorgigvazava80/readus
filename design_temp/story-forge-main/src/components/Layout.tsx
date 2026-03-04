import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

const Layout = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main>
      <Outlet />
    </main>
    <footer className="border-t py-12">
      <div className="container mx-auto px-6 text-center">
        <p className="font-display text-lg text-foreground">Quill & Page</p>
        <p className="mt-1 font-ui text-sm text-muted-foreground">
          A home for stories worth telling.
        </p>
      </div>
    </footer>
  </div>
);

export default Layout;
