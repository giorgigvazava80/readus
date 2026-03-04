import { Link, useLocation } from "react-router-dom";
import { BookOpen, Feather, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Browse", path: "/browse" },
  { label: "Submit", path: "/submit" },
  { label: "My Works", path: "/my-works" },
];

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Quill & Page
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
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
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Search className="h-4 w-4" />
          </Button>
          <Link to="/submit">
            <Button size="sm" className="gap-1.5">
              <Feather className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Publish</span>
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
