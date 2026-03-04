import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Feather, BookOpen, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import WorkCard from "@/components/WorkCard";
import { featuredWorks } from "@/lib/mockData";
import heroImage from "@/assets/hero-literary.jpg";

const stats = [
  { icon: BookOpen, value: "2,400+", label: "Published Works" },
  { icon: Users, value: "850+", label: "Authors" },
  { icon: Feather, value: "120+", label: "New This Month" },
];

const steps = [
  { step: "01", title: "Submit", desc: "Upload your manuscript as PDF or paste your text directly. Add a title, genre, and brief synopsis." },
  { step: "02", title: "Review", desc: "Our editorial team reads every submission. You'll receive feedback and a decision within two weeks." },
  { step: "03", title: "Publish", desc: "Accepted works are beautifully formatted and published on our platform for readers worldwide." },
];

const Index = () => {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Open book with pen"
            className="h-full w-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />
        </div>

        {/* Decorative blurred orbs */}
        <div
          className="absolute top-20 right-[15%] w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "hsl(36 70% 50%)" }}
        />
        <div
          className="absolute bottom-32 right-[30%] w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "hsl(16 60% 52%)" }}
        />

        <div className="container relative mx-auto px-4 sm:px-6 pb-20 pt-16 md:pt-24 md:pb-28 w-full">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5"
            style={{ background: "hsl(36 70% 50% / 0.08)" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="font-ui text-xs font-medium text-primary">
              New arrivals this week — 120+ fresh works
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="max-w-3xl"
          >
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Where Words Find{" "}
              <span className="text-gradient-primary">Their Home</span>
            </h1>
            <p className="mt-5 font-body text-lg leading-relaxed text-muted-foreground md:text-xl max-w-xl">
              Submit your novels, stories, and poems to our editorial team.{" "}
              Quality writing, carefully curated, beautifully published.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/submit">
                <Button
                  size="lg"
                  className="gap-2 font-ui font-semibold shadow-warm hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  <Feather className="h-4 w-4" />
                  Submit Your Work
                </Button>
              </Link>
              <Link to="/browse">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 font-ui hover:bg-primary/5 hover:border-primary/40 transition-all duration-200"
                >
                  Browse Library
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16 flex flex-wrap gap-4"
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border px-4 py-3 glass-panel min-w-[140px]"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: "hsl(36 70% 50% / 0.12)" }}
                >
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-display text-xl font-bold text-foreground leading-none">
                    {stat.value}
                  </p>
                  <p className="font-ui text-xs text-muted-foreground mt-0.5">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────── */}
      <section className="border-t bg-card/40 py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              How It Works
            </h2>
            <p className="mt-2 font-ui text-sm text-muted-foreground">
              From draft to published — three simple steps
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3 relative">
            {/* Connecting line (desktop) */}
            <div className="absolute top-8 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-border to-transparent hidden md:block pointer-events-none" />

            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group relative rounded-xl border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
              >
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold font-display text-primary mb-4"
                  style={{ background: "hsl(36 70% 50% / 0.1)" }}
                >
                  {item.step}
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 font-ui text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Works ────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-8"
          >
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                Featured Works
              </h2>
              <p className="mt-1 font-ui text-sm text-muted-foreground">
                Recently published on Quill & Page
              </p>
            </div>
            <Link to="/browse">
              <Button variant="ghost" className="gap-1.5 text-sm font-ui group">
                View All
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredWorks.slice(0, 6).map((work, i) => (
              <WorkCard key={work.id} work={work} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
