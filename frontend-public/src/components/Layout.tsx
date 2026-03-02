import { Outlet, Link } from "react-router-dom";
import { BookOpen, Twitter, Github, Mail, ArrowRight } from "lucide-react";

import { useI18n } from "@/i18n";
import { isAdminAppHost } from "@/lib/runtime";
import Navbar from "./Navbar";

const Layout = () => {
  const adminHost = isAdminAppHost();
  const { t } = useI18n();

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
        <footer className="border-t bg-card/40 mt-auto">
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

          <div className="container mx-auto px-6 py-12 md:py-16">
            <div className="grid gap-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-6 flex flex-col items-center sm:items-start text-center sm:text-left">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shadow-sm"
                    style={{ background: "var(--hero-gradient)" }}
                  >
                    <BookOpen className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-display text-2xl font-bold text-foreground tracking-tight">
                    {t("brand.user", "Readus")}
                  </span>
                </div>
                <p className="font-body text-sm leading-relaxed text-muted-foreground max-w-xs">
                  {t("layout.footer.brandDesc", "A curated home for novels, short stories, and poetry. Quality writing, carefully crafted.")}
                </p>
                <div className="flex items-center gap-4">
                  {[Twitter, Github, Mail].map((Icon, i) => (
                    <a
                      key={i}
                      href="#"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:text-primary hover:bg-primary/5 hover:-translate-y-1"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 sm:col-span-1 lg:col-span-3 lg:grid-cols-3">
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                  <h4 className="font-ui text-xs font-bold uppercase tracking-widest text-foreground/40 mb-5">
                    {t("layout.footer.explore", "Explore")}
                  </h4>
                  <ul className="space-y-3.5">
                    {[
                      { label: t("layout.footer.browseAll", "Browse All"), to: "/browse" },
                      { label: t("layout.footer.books", "Books"), to: "/books" },
                      { label: t("layout.footer.stories", "Stories"), to: "/stories" },
                      { label: t("layout.footer.poetry", "Poetry"), to: "/poems" },
                    ].map((item) => (
                      <li key={item.label}>
                        <Link
                          to={item.to}
                          className="font-ui text-sm text-muted-foreground hover:text-primary transition-colors inline-block"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                  <h4 className="font-ui text-xs font-bold uppercase tracking-widest text-foreground/40 mb-5">
                    {t("layout.footer.account", "Account")}
                  </h4>
                  <ul className="space-y-3.5">
                    {[
                      { label: t("nav.login", "Login"), to: "/login" },
                      { label: t("nav.register", "Register"), to: "/register" },
                      { label: t("layout.footer.writerApplication", "Writer Application"), to: "/writer-application" },
                      { label: t("layout.footer.myWorks", "My Works"), to: "/my-works" },
                    ].map((item) => (
                      <li key={item.label}>
                        <Link
                          to={item.to}
                          className="font-ui text-sm text-muted-foreground hover:text-primary transition-colors inline-block"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="col-span-2 sm:col-span-1 flex flex-col items-center sm:items-start text-center sm:text-left mt-4 sm:mt-0">
                  <h4 className="font-ui text-xs font-bold uppercase tracking-widest text-foreground/40 mb-5">
                    {t("layout.footer.about", "About")}
                  </h4>
                  <ul className="space-y-3.5">
                    {[
                      t("layout.footer.ourStory", "Our Story"),
                      t("layout.footer.editorialProcess", "Editorial Process"),
                      t("layout.footer.privacyPolicy", "Privacy Policy"),
                      t("layout.footer.contact", "Contact"),
                    ].map((item) => (
                      <li key={item}>
                        <a
                          href="#"
                          className="font-ui text-sm text-muted-foreground hover:text-primary transition-colors inline-block"
                        >
                          {item}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-16 sm:mt-24 flex flex-col items-center gap-4 border-t border-border/40 pt-8 sm:flex-row sm:justify-between opacity-80">
              <p className="font-ui text-xs text-muted-foreground order-2 sm:order-1">
                {t("layout.footer.rights", "(c) 2026 Readus. All rights reserved.")}
              </p>
              <p className="font-body text-xs italic text-muted-foreground order-1 sm:order-2">
                {t("layout.footer.tagline", "A home for stories worth telling.")}
              </p>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
};

export default Layout;


