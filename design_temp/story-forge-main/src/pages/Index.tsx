import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Feather, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import WorkCard from "@/components/WorkCard";
import { featuredWorks } from "@/lib/mockData";
import heroImage from "@/assets/hero-literary.jpg";

const stats = [
  { icon: BookOpen, value: "2,400+", label: "Published Works" },
  { icon: Users, value: "850+", label: "Authors" },
  { icon: Feather, value: "120+", label: "New This Month" },
];

const Index = () => {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Open book with pen"
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
        <div className="container relative mx-auto px-6 pb-20 pt-24 md:pt-32 md:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
              Where Words Find{" "}
              <span className="text-gradient-primary">Their Home</span>
            </h1>
            <p className="mt-5 font-body text-lg leading-relaxed text-muted-foreground md:text-xl">
              Submit your novels, stories, and poems to our editorial team. 
              Quality writing, carefully curated, beautifully published.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/submit">
                <Button size="lg" className="gap-2">
                  <Feather className="h-4 w-4" />
                  Submit Your Work
                </Button>
              </Link>
              <Link to="/browse">
                <Button size="lg" variant="outline" className="gap-2">
                  Browse Library
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 grid grid-cols-3 gap-6 max-w-lg"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center md:text-left">
                <stat.icon className="mx-auto mb-1.5 h-5 w-5 text-primary md:mx-0" />
                <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="font-ui text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section className="border-t bg-card/50 py-16">
        <div className="container mx-auto px-6">
          <h2 className="font-display text-2xl font-bold text-foreground">How It Works</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Submit", desc: "Upload your manuscript as PDF or paste your text directly. Add a title, genre, and brief synopsis." },
              { step: "02", title: "Review", desc: "Our editorial team reads every submission. You'll receive feedback and a decision within two weeks." },
              { step: "03", title: "Publish", desc: "Accepted works are beautifully formatted and published on our platform for readers worldwide." },
            ].map((item) => (
              <div key={item.step} className="group">
                <span className="font-display text-4xl font-bold text-primary/20 transition-colors group-hover:text-primary/40">
                  {item.step}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 font-ui text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Works */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Featured Works</h2>
              <p className="mt-1 font-ui text-sm text-muted-foreground">Recently published on Quill & Page</p>
            </div>
            <Link to="/browse">
              <Button variant="ghost" className="gap-1 text-sm">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
