import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { BookOpen, Twitter, Github, Mail, ArrowRight } from "lucide-react";

const Layout = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>

    {/* Footer */}
    <footer className="border-t bg-card/40 mt-auto">
      {/* CTA Banner */}
      <div
        className="py-12 px-6"
        style={{ background: "var(--hero-gradient-subtle)" }}
      >
        <div className="container mx-auto text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Ready to share your story?
          </h2>
          <p className="mt-2 font-ui text-sm text-muted-foreground max-w-md mx-auto">
            Join hundreds of authors who've found their readership on Quill & Page.
          </p>
          <Link
            to="/submit"
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-ui text-sm font-semibold text-white shadow-warm transition-all duration-200 hover:scale-105 hover:shadow-lg"
            style={{ background: "var(--hero-gradient)" }}
          >
            Start Writing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Footer columns */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent shadow-sm">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">
                Quill <span className="text-gradient-primary">&</span> Page
              </span>
            </div>
            <p className="mt-3 font-body text-sm leading-relaxed text-muted-foreground max-w-xs">
              A curated home for novels, short stories, and poetry. Quality writing, carefully crafted.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              >
                <Twitter className="h-3.5 w-3.5" />
              </a>
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              >
                <Github className="h-3.5 w-3.5" />
              </a>
              <a
                href="#"
                className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-ui text-sm font-semibold text-foreground mb-4">Explore</h4>
            <ul className="space-y-2.5">
              {["Browse Library", "Featured Works", "New Arrivals", "Poetry Collection"].map((item) => (
                <li key={item}>
                  <Link
                    to="/browse"
                    className="font-ui text-sm text-muted-foreground underline-animated hover:text-primary transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Authors */}
          <div>
            <h4 className="font-ui text-sm font-semibold text-foreground mb-4">For Authors</h4>
            <ul className="space-y-2.5">
              {["Submit Work", "My Dashboard", "Editorial Guidelines", "Author FAQ"].map((item) => (
                <li key={item}>
                  <Link
                    to="/submit"
                    className="font-ui text-sm text-muted-foreground underline-animated hover:text-primary transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="font-ui text-sm font-semibold text-foreground mb-4">About</h4>
            <ul className="space-y-2.5">
              {["Our Story", "Editorial Team", "Privacy Policy", "Contact Us"].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    className="font-ui text-sm text-muted-foreground underline-animated hover:text-primary transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-2 border-t pt-6 sm:flex-row sm:justify-between">
          <p className="font-ui text-xs text-muted-foreground">
            © 2026 Quill & Page. All rights reserved.
          </p>
          <p className="font-body text-xs italic text-muted-foreground">
            A home for stories worth telling.
          </p>
        </div>
      </div>
    </footer>
  </div>
);

export default Layout;
