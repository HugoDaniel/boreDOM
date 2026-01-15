# boreDOM: Communication Plan

*The blog post is the artifact. Distribution is the game.*

---

## The Problem

A retrospective blog post on a low-traffic personal blog will get:
- Existing readers (dozens)
- SEO trickle over months
- That's it

**Solution**: Write the blog post as **source material** for higher-reach channels.

---

## Distribution Strategy

| Platform | Format | Why It Works |
|----------|--------|--------------|
| **Hacker News** | Link post | HN loves solo devs, anti-complexity, web standards |
| **Reddit r/javascript** | Text post + link | Technical audience, framework discussions |
| **Reddit r/webdev** | Text post + link | Broader, more practical audience |
| **Twitter/X** | Thread | Visual-friendly, shareable |
| **Lobste.rs** | Link post | Smaller but high-signal technical readers |
| **dev.to** | Cross-post | Built-in reach, republish full content |

---

## Blog Post Structure

Optimized for extraction into platform-specific formats:

```markdown
# One Year of boreDOM

## The Hook (tweetable, 280 chars)
"I spent a year building a JS framework with no build step. Here's what I learned."

## The Contrarian Take (HN bait)
"The bundler-industrial-complex is a trap. I escaped it."

## The Journey (human story)
- Why I started
- What went wrong
- What surprised me

## The Technical Insights (r/javascript fodder)
- Proxy reactivity lessons
- Web Components gotchas
- What 1,500 lines can do

## The Vision (forward-looking)
- Inside-Out development
- REPL-first future
- Link to VISION.md

## The Ask (call to action)
- Try it: [demo link]
- Star it: [GitHub]
- Roast it: [comments]
```

---

## Platform-Specific Adaptations

### Hacker News

**Title options** (pick one):
- "Show HN: One year building a no-build JS framework"
- "Show HN: boreDOM – A 4KB reactive framework with no build step"
- "One year of building against the bundler-industrial-complex"

**Submission tips**:
- Submit link to blog post
- Don't self-promote in comments immediately
- Answer questions authentically
- Morning US time (~9am EST) for best visibility

### Reddit r/javascript

**Title**: "I spent a year building a reactive framework with no build step. Here's what I learned about Proxies, Web Components, and keeping things small."

**Body**:
- 3-4 paragraph summary of key technical insights
- Link to full blog post
- Link to GitHub
- Invite criticism ("What am I missing?")

### Reddit r/webdev

**Title**: "After a year of fighting Webpack configs, I built my own framework. It's 4KB and needs no bundler."

**Body**:
- Focus on the pain point (build complexity)
- Less technical detail, more practical benefits
- Include GIF/video demo
- Link to blog post

### Twitter/X Thread

```
1/ I spent a year building a JS framework that needs no build step.

No webpack. No vite. No node_modules.

Here's what I learned: 🧵

2/ The idea: what if components were just HTML templates?

<template data-component="counter">
  <button>Count: <span data-slot="count">0</span></button>
</template>

That's it. That's a component.

3/ Reactivity via Proxy.

state.count = 5

Only components reading `count` re-render. No virtual DOM. No diffing. Just surgical updates.

4/ The hardest part wasn't the code.

It was resisting feature creep.

Every "nice to have" is a dependency on your future self.

5/ What's next: Inside-Out development.

Start with code that doesn't work yet. Let the framework discover what's missing. Fix it live in the console.

The browser becomes your IDE.

6/ Try it: [link]
Star it: [GitHub]
Read the full story: [blog post]

What am I missing? What would make you actually use this?
```

### dev.to

- Cross-post entire blog post
- Add canonical URL to original
- Use their tags: #javascript #webdev #frameworks #webcomponents
- Engage with comments (dev.to rewards this)

### Lobste.rs

- Requires invite or existing account
- More technical audience than HN
- Tag appropriately: `javascript`, `web`
- Straight link post, minimal editorializing

---

## Required Assets

### Before Launch

| Asset | Purpose | Status |
|-------|---------|--------|
| Blog post | Canonical source | TODO |
| Demo GIF (30s) | Visual hook for all platforms | TODO |
| GitHub README update | First impression for new visitors | TODO |
| Live demo link | "Try it now" without cloning | TODO |

### The Demo GIF

**Must show**:
1. Start with minimal HTML
2. Something breaks/is missing
3. Fix it live in browser console
4. Component updates instantly
5. Export working code

**Tools**:
- macOS: Kap, CleanShot X
- Cross-platform: LICEcap, ScreenToGif
- Keep under 15 seconds for Twitter

---

## Timing & Sequence

### Day 0: Preparation
- [ ] Publish blog post
- [ ] Update GitHub README with vision teaser
- [ ] Ensure demo is working
- [ ] Have GIF/video ready

### Day 1: Primary Launch
- [ ] Submit to Hacker News (9am EST)
- [ ] Post to r/javascript
- [ ] Post to r/webdev
- [ ] Monitor and respond to comments

### Day 2: Secondary Wave
- [ ] Twitter thread
- [ ] Lobste.rs (if you have access)

### Day 3-5: Long Tail
- [ ] Cross-post to dev.to
- [ ] Share in relevant Discord servers
- [ ] Answer any remaining comments

### Week 2+: Follow-up Content
- [ ] "Part 2" addressing feedback received
- [ ] Tutorial: "Build X with boreDOM"
- [ ] Comparison post: "boreDOM vs Lit vs vanilla"

---

## Success Metrics

| Metric | Target | Stretch |
|--------|--------|---------|
| HN points | 50+ | 200+ |
| GitHub stars | +100 | +500 |
| Blog post views | 1,000 | 5,000 |
| Reddit upvotes | 100+ combined | 500+ |
| Twitter impressions | 10,000 | 50,000 |

**Qualitative goals**:
- At least 3 people actually try it and give feedback
- At least 1 thoughtful criticism that improves the project
- At least 1 "I've been looking for exactly this" comment

---

## Messaging Guidelines

### Do Say
- "No build step required"
- "4KB minified"
- "Web standards, not framework magic"
- "REPL-first development"
- "Perfect for prototypes and learning"

### Don't Say
- "React killer" (cringe, also false)
- "Production-ready" (not the point)
- "Blazing fast" (overused, unverified)
- "Revolutionary" (let others say it)

### Handle Criticism With
- "That's fair, here's why I made that tradeoff..."
- "Good point, I hadn't considered that"
- "You're right, that's on the roadmap"
- Never defensive, always curious

---

## Contingency Plans

### If HN Ignores It
- Resubmit in 2 weeks with different title
- Focus energy on Reddit instead
- Consider "Ask HN" format: "What would make you try a no-build framework?"

### If Reception is Negative
- Extract actionable feedback
- Write follow-up addressing concerns
- Don't argue, iterate

### If It Goes Viral
- Be ready to answer questions for 48 hours
- Have "getting started" docs polished
- Pin important info on GitHub/Twitter

---

## Pre-Launch Checklist

- [ ] Blog post written and published
- [ ] Demo GIF created and embedded
- [ ] GitHub README updated with vision
- [ ] Live demo accessible (GitHub Pages?)
- [ ] All links tested and working
- [ ] HN title finalized
- [ ] Reddit posts drafted
- [ ] Twitter thread drafted
- [ ] Time blocked for Day 1 engagement
