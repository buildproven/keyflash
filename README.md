# KeyFlash ⚡

> Fast, Simple, Affordable Keyword Research

KeyFlash is an open-source keyword research tool built for entrepreneurs, content creators, and small marketing teams who need quick keyword validation without enterprise pricing.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](https://opensource.org/licenses/AGPL-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)

## 🎯 Why KeyFlash?

**The Problem**: Existing keyword research tools (Ahrefs, SEMrush, Moz) cost $99-500/month and are packed with features most users don't need.

**The Solution**: KeyFlash does ONE thing extremely well - fast, cheap keyword research. That's it.

### Key Features

- **⚡ Lightning Fast**: Results in <3 seconds
- **💰 Affordable**: 10x cheaper than competitors
- **🎨 Simple**: Maximum 3 clicks from landing to results
- **🔓 Open Source**: AGPL-3.0 licensed, fully transparent
- **🔒 Privacy-First**: We don't store your keyword searches

### Core Capabilities

- **Keyword Data**:
  - Monthly search volume
  - Yearly volume trends
  - Keyword difficulty (0-100)
  - Search intent (Informational/Commercial/Transactional)
  - CPC (cost-per-click)
  - Competition level

- **Batch Sizes**: 10, 20, 50, 100, or 200 keywords per search
- **Match Types**: Phrase match or Exact match
- **Filters**: Location, language, sort order
- **Export**: CSV/Excel download

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+ (or npm/yarn)
- Google Ads account (for API access) OR DataForSEO API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/keyflash.git
cd keyflash

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Add your API keys to .env.local
# See docs/API_INTEGRATION.md for setup guide

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Documentation

- [**Requirements**](docs/REQUIREMENTS.md) - Product requirements and features
- [**Architecture**](docs/ARCHITECTURE.md) - Technology stack and system design
- [**Security**](docs/SECURITY.md) - Security measures and best practices
- [**Testing**](docs/TESTING_STRATEGY.md) - Testing approach and coverage

### API Setup Guides

Coming soon:

- Setting up Google Ads API (free tier)
- Setting up DataForSEO API (paid)
- Switching between API providers

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Data**: Upstash Redis (caching)
- **APIs**: Google Ads API → DataForSEO (scale)
- **Hosting**: Vercel
- **Testing**: Vitest + Playwright
- **Language**: TypeScript 5

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed tech stack rationale.

## 🏗️ Project Structure

```
keyflash/
├── docs/              # Documentation
├── src/
│   ├── app/          # Next.js App Router
│   │   ├── api/      # API routes
│   │   └── search/   # Search UI
│   ├── components/   # React components
│   ├── lib/          # Business logic
│   │   ├── api/      # API providers
│   │   ├── cache/    # Redis cache
│   │   └── validation/ # Input validation
│   └── types/        # TypeScript types
├── tests/            # Unit, integration, E2E tests
└── public/           # Static assets
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Fork this repository
2. Import to Vercel
3. Add environment variables (API keys)
4. Deploy!

Vercel will automatically deploy on every push to `main`.

### Self-Hosting

See deployment guide (coming soon) for instructions on hosting with:

- Cloudflare Pages
- AWS (Lambda + CloudFront)
- Docker

## 🤝 Contributing

We welcome contributions! KeyFlash is open source and community-driven.

### Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit pull requests
- 🌍 Add language translations

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Contribution Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow conventional commit messages
- Ensure all tests pass before submitting PR

See [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon) for detailed guidelines.

## 📊 Roadmap

### MVP (Current Phase)

- [x] Project setup and documentation
- [ ] UI/UX design
- [ ] Google Ads API integration
- [ ] Core keyword search functionality
- [ ] Basic rate limiting
- [ ] CSV export
- [ ] Deployment to Vercel

### Post-MVP

- [ ] User authentication
- [ ] Saved searches
- [ ] DataForSEO API integration
- [ ] Keyword clustering
- [ ] Browser extension
- [ ] Bulk upload (CSV)
- [ ] API for developers

### Future Possibilities

- [ ] Competitor keyword analysis
- [ ] Content optimization suggestions
- [ ] Team workspaces
- [ ] Mobile app

Vote on features: [GitHub Discussions](https://github.com/yourusername/keyflash/discussions)

## 💰 Business Model

### Open Source + Hosted SaaS

**Free Self-Hosting**:

- Full source code available (AGPL-3.0)
- Self-host on your own infrastructure
- No feature limitations

**Paid Hosted Service** (Coming Soon):

- **Free Tier**: 10 searches/month, 10 keywords each
- **Basic**: $9/month - 100 searches/month, up to 50 keywords
- **Pro**: $29/month - Unlimited searches, up to 200 keywords
- **Agency**: $99/month - Team features, API access

**Why pay for hosting?**

- No setup hassle (API keys, infrastructure)
- Automatic updates
- Better performance (global CDN)
- Priority support
- Help fund development

## 📄 License

This project is licensed under the **AGPL-3.0 License**.

### What This Means

✅ **You CAN**:

- Use commercially
- Modify the source code
- Distribute modified versions
- Self-host for personal or business use

❌ **You MUST**:

- Disclose source code of your modifications
- License derivative works under AGPL-3.0
- Include original copyright notice
- State changes made to the code

❌ **You CANNOT**:

- Hold the author liable
- Use project name/logo without permission

See [LICENSE](LICENSE) for full details.

**Why AGPL-3.0?**

- Prevents others from creating hosted competitors without contributing back
- Ensures improvements benefit the community
- Maintains open source integrity for SaaS applications

## 🙏 Acknowledgments

Built with excellent open source tools:

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Upstash](https://upstash.com/) - Serverless Redis
- [Vercel](https://vercel.com/) - Hosting
- [Vitest](https://vitest.dev/) - Testing framework
- [Playwright](https://playwright.dev/) - E2E testing

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/keyflash/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/keyflash/discussions)
- **Email**: support@keyflash.com (coming soon)

## 🌟 Star History

If you find KeyFlash useful, please consider starring the repository!

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/keyflash&type=Date)](https://star-history.com/#yourusername/keyflash&Date)

---

**Made with ❤️ by the open source community**

[Website](https://keyflash.com) • [Documentation](docs/) • [Contributing](CONTRIBUTING.md)
