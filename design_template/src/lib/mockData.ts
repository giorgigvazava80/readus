export type WorkCategory = "novel" | "story" | "poem";
export type WorkStatus = "draft" | "submitted" | "in_review" | "published" | "rejected";

export interface Work {
  id: string;
  title: string;
  author: string;
  excerpt: string;
  category: WorkCategory;
  status: WorkStatus;
  coverColor: string;
  date: string;
  readTime: string;
  chapters?: number;
}

export const featuredWorks: Work[] = [
  {
    id: "1",
    title: "The Amber Lighthouse",
    author: "Elena Marchetti",
    excerpt: "The sea had always whispered secrets to those willing to listen. On the night of the storm, when the lighthouse keeper vanished, the waves spoke louder than ever before...",
    category: "novel",
    status: "published",
    coverColor: "hsl(36, 70%, 50%)",
    date: "Feb 2026",
    readTime: "6 min read",
    chapters: 24,
  },
  {
    id: "2",
    title: "Dust and Petrichor",
    author: "James Okafor",
    excerpt: "She collected rain in mason jars — not for drinking, but for remembering. Each jar held a different storm, a different goodbye.",
    category: "poem",
    status: "published",
    coverColor: "hsl(16, 60%, 52%)",
    date: "Jan 2026",
    readTime: "3 min read",
  },
  {
    id: "3",
    title: "A Cartography of Silence",
    author: "Lena Zhou",
    excerpt: "The map was wrong. Not in the way most maps are wrong — missing a road here, a river there. This map showed a country that had never existed, yet somehow, she had been born there.",
    category: "story",
    status: "published",
    coverColor: "hsl(200, 40%, 45%)",
    date: "Feb 2026",
    readTime: "12 min read",
  },
  {
    id: "4",
    title: "Letters to No One",
    author: "Sofia Reyes",
    excerpt: "Dear stranger, I'm writing this knowing you'll never read it. That's the beauty of it — words set free, unanchored from expectation.",
    category: "novel",
    status: "published",
    coverColor: "hsl(280, 30%, 40%)",
    date: "Dec 2025",
    readTime: "8 min read",
    chapters: 18,
  },
  {
    id: "5",
    title: "When Morning Breaks",
    author: "David Larsen",
    excerpt: "The old clock tower hadn't chimed in thirty years. When it finally did, at exactly 3:17 AM, every door in the village opened at once.",
    category: "story",
    status: "published",
    coverColor: "hsl(150, 35%, 40%)",
    date: "Jan 2026",
    readTime: "15 min read",
  },
  {
    id: "6",
    title: "Ink & Ember",
    author: "Priya Sharma",
    excerpt: "In the margins of her grandmother's cookbook, between recipes for cardamom tea and saffron rice, she found a love letter written in a language no one spoke anymore.",
    category: "poem",
    status: "published",
    coverColor: "hsl(0, 50%, 45%)",
    date: "Feb 2026",
    readTime: "2 min read",
  },
];

export const sampleChapterContent = `
The sea had always whispered secrets to those willing to listen. On the night of the storm, when the lighthouse keeper vanished, the waves spoke louder than ever before.

Margaret stood at the edge of the cliff, her coat pulled tight against the wind. Below her, the ocean churned with a fury she had never seen — not in all her forty years of living on this coast. The lighthouse beam swept across the water in steady arcs, but its keeper was nowhere to be found.

"Thomas?" she called into the darkness, though she knew the wind would swallow her voice whole.

The lighthouse had been her neighbor for as long as she could remember. Her mother used to say it was the oldest thing on the island — older than the church, older than the harbor, older even than the twisted oak that grew in the center of town. Thomas had tended it for thirty years, and his father before him.

She pulled her lantern closer and began the climb up the narrow path. The stone steps, worn smooth by decades of footsteps, were slick with rain. Each step felt deliberate, as if the island itself were testing her resolve.

At the top, the door stood open. Not broken or forced — simply open, as if Thomas had stepped out for a moment and would return at any second. But Margaret knew better. She had seen the way he'd looked at the horizon these past few weeks, as though he could see something the rest of them couldn't.

Inside, the lighthouse was exactly as she expected: tidy, sparse, smelling faintly of kerosene and salt. A half-eaten sandwich sat on the small table beside an open book — a collection of maritime folklore she had lent him months ago. He had bookmarked a chapter titled "The Voices Beneath the Waves."

Margaret sat down in his chair and began to read.
`;
