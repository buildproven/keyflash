# KeyFlash

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Built by Vibe Build Lab](https://img.shields.io/badge/Built%20by-Vibe%20Build%20Lab-blue)](https://vibebuildlab.com)

AI-powered keyword research tool. Get keyword data in under 3 seconds. **Free and open source** - bring your own DataForSEO API key.

---

> **Open Source by Vibe Build Lab**
> This project is maintained by **Vibe Build Lab LLC**, a studio focused on AI-assisted product development, micro-SaaS, and "vibe coding" workflows for solo founders and small teams.
> Learn more at **https://www.vibebuildlab.com**.

---

## Features

- **Lightning Fast** - Results in <3 seconds
- **Simple UX** - Maximum 3 clicks from landing to results
- **Privacy-First** - We don't store your keyword searches
- **Self-Hosted** - Run on your own infrastructure
- **Bring Your Own API Key** - Use your DataForSEO account for real data

### Keyword Data Provided

- Monthly search volume
- Yearly volume trends
- Keyword difficulty (0-100)
- Search intent (Informational/Commercial/Transactional)
- CPC (cost-per-click)
- Competition level

### Batch Sizes

10, 20, 50, 100, or 200 keywords per search

## Quick Start

```bash
# Clone the repo
git clone https://github.com/vibebuildlab/keyflash.git
cd keyflash

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Setup

1. **DataForSEO API Key** (for real keyword data):
   - Sign up at [DataForSEO](https://dataforseo.com/)
   - Add credentials to `.env.local`:
     ```
     KEYWORD_API_PROVIDER=dataforseo
     DATAFORSEO_LOGIN=your_login
     DATAFORSEO_PASSWORD=your_password
     ```

2. **Redis** (for caching):
   - Use [Upstash](https://upstash.com/) (free tier available)
   - Or run locally: `npm run redis:start`

3. **Authentication** (optional):
   - Sign up at [Clerk](https://clerk.com/)
   - Add keys to `.env.local`

Without DataForSEO credentials, the app runs in mock mode with sample data.

## Target Users

- **Entrepreneurs** validating content ideas quickly
- **Content creators** researching topics for blogs and videos
- **Small marketing teams** who don't need enterprise tools
- **Freelancers** doing keyword research for clients
- **Developers** who want to self-host their SEO tools

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| **Framework** | Next.js 16 (App Router)             |
| **Language**  | TypeScript 5.9                      |
| **Styling**   | Tailwind CSS 4                      |
| **Caching**   | Upstash Redis                       |
| **APIs**      | DataForSEO                          |
| **Hosting**   | Vercel (or self-hosted)             |
| **Testing**   | Vitest + Playwright                 |

## Documentation

- [Requirements](docs/REQUIREMENTS.md) - Product requirements and features
- [Architecture](docs/ARCHITECTURE.md) - Technology stack and system design
- [Security](docs/SECURITY.md) - Security measures and best practices
- [Testing](docs/TESTING_STRATEGY.md) - Testing approach and coverage

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Legal

- [Privacy Policy](https://vibebuildlab.com/privacy-policy)
- [Terms of Service](https://vibebuildlab.com/terms)

---

> **Vibe Build Lab LLC** · [vibebuildlab.com](https://vibebuildlab.com)
