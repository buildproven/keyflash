# KeyFlash - Requirements Document

## Project Overview

**Name**: KeyFlash
**Tagline**: Fast, Simple, Affordable Keyword Research
**Goal**: Build a keyword research tool that is significantly cheaper and easier to use than existing market solutions
**License**: AGPL-3.0 (open source)
**Business Model**: Public repository + Hosted SaaS with free/paid tiers

## Problem Statement

Current keyword research tools (Ahrefs, SEMrush, Moz) are:

- **Expensive**: $99-500/month minimum
- **Complex**: Too many features for simple keyword research needs
- **Slow**: Heavy interfaces with long load times
- **Overkill**: Users pay for features they don't need

**Target Users**:

- Solo entrepreneurs and indie hackers
- Content creators and bloggers
- Small marketing agencies
- SEO beginners
- Anyone needing quick keyword validation without enterprise pricing

## Core Features (MVP)

### 1. Keyword Search Modes

- **Phrase Match**: Broader keyword variations
- **Exact Match**: Precise keyword data only
- Clearly labeled mode selector in UI

### 2. Volume Batching Options

Users can request keyword data in these batch sizes:

- 10 keywords
- 20 keywords
- 50 keywords
- 100 keywords
- 200 keywords (max for MVP)

**Rationale**: Different users have different needs - bloggers might need 10-20, agencies need 100-200. Pricing can scale with usage.

### 3. Core Metrics (Per Keyword)

- **Search Volume**: Monthly average
- **Search Volume Trend**: Yearly comparison (if available from API)
- **Keyword Difficulty**: 0-100 score indicating ranking difficulty
- **Search Intent**: Informational, Navigational, Commercial, Transactional
- **CPC (Cost Per Click)**: Estimated value for paid ads (indicates commercial value)
- **Competition**: Low/Medium/High for organic search

### 4. Pre-Search Filters

Before running keyword search, users can configure:

- **Geographic Location**: Country/region for localized data
- **Language**: Keyword language
- **Match Type**: Phrase or Exact
- **Batch Size**: 10/20/50/100/200 keywords
- **Sort Order**: Volume, Difficulty, CPC

### 5. Results Display

- Clean, fast-loading table view
- Export to CSV/Excel
- Save searches for registered users
- Visual indicators (color coding) for difficulty and intent
- Sortable columns

## API Strategy

### Phase 1: MVP (Launch)

**Use**: Google Ads API (Keyword Planner)

- **Cost**: Free up to 1,000 daily keyword requests
- **Limit**: 1,000 keywords per bulk request
- **Pros**: Free, highly accurate Google data, perfect for validating product-market fit
- **Cons**: Requires Google Ads account (can provide setup guide), 1K daily limit

### Phase 2: Scale

**Use**: DataForSEO API

- **Cost**: Pay-as-you-go ($50 minimum deposit, ~$0.02-0.05 per keyword)
- **Scale**: 2B+ keywords, historical data, multiple search engines
- **Trigger**: When hitting 1K daily limit consistently OR need advanced features

**Why not Perplexity/ChatGPT?**

- Perplexity: Not designed for structured keyword data, no search volume API
- OpenAI: No keyword research capabilities, would need web scraping (unreliable)
- Specialized SEO APIs are purpose-built and more reliable

## User Experience Requirements

### Speed

- Results in <3 seconds for batches up to 50 keywords
- Results in <8 seconds for 100-200 keyword batches
- Instant filter application (client-side)

### Simplicity

- Single-page interface for keyword research
- Maximum 3 clicks from landing to results
- No account required for first 10 searches (then require signup)
- Clear, jargon-free UI text

### Mobile Responsiveness

- Fully functional on tablets
- View-only on mobile phones (table too complex for small screens)

## Non-Functional Requirements

### Performance

- Page load: <1 second
- API response time: <3 seconds (p95)
- Support 100 concurrent users on MVP infrastructure

### Reliability

- 99.5% uptime target
- Graceful degradation if API unavailable
- Clear error messages for users

### Security

- API keys stored encrypted in environment variables
- Rate limiting per user/IP
- Input validation and sanitization
- HTTPS only
- No storage of user keyword search data (privacy-first)

### Scalability

- Stateless API design for horizontal scaling
- Database-free MVP (cache-only for performance)
- Add database only when user accounts/saved searches needed

## Out of Scope (MVP)

These features are explicitly NOT included in MVP:

- ❌ Competitor analysis
- ❌ Rank tracking
- ❌ Backlink analysis
- ❌ SERP feature analysis (featured snippets, etc.)
- ❌ Advanced reporting/dashboards
- ❌ Team collaboration features
- ❌ White-label/agency features
- ❌ Chrome extension
- ❌ Mobile app

**Rationale**: Focus on doing ONE thing extremely well - fast, cheap keyword research. Additional features can be added based on user feedback post-launch.

## Success Metrics

### Product Validation (First 90 Days)

- 500+ unique users
- 50+ registered accounts (converted from free searches)
- 10+ paying customers
- <$200 total operating costs

### User Satisfaction

- Average query completion time <5 seconds
- <5% error rate
- Positive feedback on simplicity vs competitors

### Technical Health

- API costs <$0.10 per user
- Zero data breaches
- 99.5%+ uptime

## Future Considerations (Post-MVP)

**Potential Features Based on User Feedback**:

- Competitor keyword analysis
- Keyword clustering/grouping
- Content optimization suggestions
- Browser extension
- API access for developers
- Bulk keyword list uploads
- Saved searches and collections
- Team workspaces

**Current Monetization** (Implemented):

- Trial: 7 days free, 300 keywords total, mock data only
- Pro: $29/month - 1,000 keywords/month, real DataForSEO data

**Future Expansion** (Not implemented):

- Agency: Team workspaces, API access, higher limits

## Technical Constraints

### MVP Technology Choices (See ARCHITECTURE.md)

- Modern web framework (React/Next.js or Vue/Nuxt)
- Serverless functions for API calls (Vercel/Netlify)
- Redis for caching (Upstash free tier)
- No database initially (stateless)

### API Rate Limits

- Google Ads API: 1,000 keywords/day (free tier)
- Must implement client-side rate limiting
- Clear messaging when approaching limits

## Open Source Considerations

**What's Public**:

- ✅ All source code (AGPL-3.0)
- ✅ Documentation and guides
- ✅ Issue tracking and roadmap
- ✅ Contribution guidelines

**What's Private**:

- 🔒 API keys (environment variables only)
- 🔒 Hosting infrastructure credentials
- 🔒 User data (if/when we collect any)

**Community Benefits**:

- Contributors can add language support
- Bug fixes from community
- Feature requests visible to all
- Builds trust for paid hosted service

## Assumptions & Risks

### Assumptions

- Users value simplicity over comprehensive features
- $9-29/month price point is acceptable vs $99+ competitors
- Google Ads API free tier sufficient for 6-12 months
- Self-hosting complexity will drive most users to paid hosting

### Risks

1. **API Changes**: Google could restrict Keyword Planner API
   - _Mitigation_: Design API layer for easy swapping to DataForSEO

2. **Competition**: Existing tools add budget-friendly tiers
   - _Mitigation_: Speed + simplicity + open source as differentiators

3. **Cost Scaling**: DataForSEO costs grow faster than revenue
   - _Mitigation_: Usage-based pricing, clear tier limits

4. **Legal**: Google Ads API terms of service restrictions
   - _Mitigation_: Review TOS, consult if needed, have DataForSEO backup

## Compliance & Legal

- GDPR compliance (for EU users)
- CCPA compliance (for California users)
- Google Ads API Terms of Service adherence
- AGPL-3.0 license compliance (for contributors)
- Clear privacy policy (data collection transparency)

## Documentation Requirements

### User Documentation

- Quick start guide (3 minutes to first search)
- Video demo (2 minutes)
- FAQ covering common questions
- Self-hosting guide (for developers)

### Developer Documentation

- Architecture overview
- API integration guide
- Contribution guidelines
- Local development setup
- Deployment instructions

## Next Steps

1. ✅ Requirements defined (this document)
2. 🔄 Architecture and tech stack selection
3. 🔄 Security and testing strategies
4. 🔄 Repository initialization
5. ⏳ UI/UX design mockups
6. ⏳ MVP development
7. ⏳ Beta testing with 10-20 users
8. ⏳ Public launch

---

**Document Version**: 1.0
**Last Updated**: 2025-11-19
**Status**: Draft - Pending Review
