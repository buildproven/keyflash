# KeyFlash - Roadmap

**Last Updated**: 2025-12-14
**Vision**: AI-powered keyword research that's 10x cheaper and faster than enterprise tools.

---

## Current Phase: MVP Complete

KeyFlash MVP is live with:

- Multi-provider API (Google Ads, DataForSEO, Mock)
- Content brief generation with SERP analysis
- Related keywords with relevance scoring
- Historical trend visualization (sparklines)
- CSV export, rate limiting, Redis caching
- 90%+ test coverage

---

## Q1 2025: Monetization Foundation

### Auth & User Accounts

Enable paid tiers and personalization.

| Milestone                 | Description                          |
| ------------------------- | ------------------------------------ |
| NextAuth.js integration   | Google OAuth, JWT sessions           |
| User tier system          | Free (10 req/day) vs Pro (unlimited) |
| User-specific rate limits | Tie to account, not IP               |

### Saved Searches (requires auth)

Sticky feature for retention.

| Milestone                      | Description           |
| ------------------------------ | --------------------- |
| Save keyword research sessions | Store to user account |
| Search history                 | View past searches    |
| Export saved searches          | Bulk CSV download     |

---

## Q2 2025: Pro Features

### Bulk Processing

Enterprise/agency appeal.

| Milestone              | Description            |
| ---------------------- | ---------------------- |
| CSV upload             | Process 1000+ keywords |
| Batch processing queue | Background jobs        |
| Progress tracking      | Real-time status       |

### Keyword Clustering

Differentiation from competitors.

| Milestone             | Description                      |
| --------------------- | -------------------------------- |
| Semantic grouping     | AI-powered topic clusters        |
| Cluster visualization | Interactive chart                |
| Content silo planning | Export clusters as content plans |

---

## Q3 2025: Scaling

### Performance

Handle enterprise load.

| Milestone               | Description              |
| ----------------------- | ------------------------ |
| Edge caching            | Cloudflare/Vercel Edge   |
| Database optimization   | Query performance tuning |
| Multi-region deployment | Latency reduction        |

### Integrations

Ecosystem expansion.

| Milestone                | Description              |
| ------------------------ | ------------------------ |
| API access               | REST API for pro users   |
| Webhook notifications    | Search completion alerts |
| Third-party integrations | Zapier, Make.com         |

---

## Future Considerations

| Feature               | Status      | Notes                     |
| --------------------- | ----------- | ------------------------- |
| Browser extension     | Deferred    | High effort (XL), low ROI |
| White-label offering  | Exploration | Agency market opportunity |
| AI content generation | Research    | Combine briefs with LLM   |
| Competitor tracking   | Backlog     | Track keyword rankings    |

---

## Non-Goals

- **Real-time rank tracking**: Different product, different infrastructure
- **Full SEO suite**: Stay focused on keyword research excellence
- **Self-hosting support**: Focus on SaaS delivery

---

## How We Prioritize

Features scored on:

- **Revenue**: Will users pay? Enables monetization?
- **Retention**: Keeps users coming back?
- **Differentiation**: Sets us apart?

Divided by effort (S=÷1, M=÷2, L=÷3, XL=÷4)

See [BACKLOG.md](./BACKLOG.md) for tactical work items.

---

## Contributing

KeyFlash is AGPL-3.0 licensed. Contributions welcome via GitHub issues and PRs.
