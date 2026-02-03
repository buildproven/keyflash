# Self-Hosting Guide

KeyFlash is designed to be self-hosted. You can run it locally for personal use or deploy it to your own infrastructure.

## Deployment Options

### 1. Local Development

The simplest way to run KeyFlash:

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

Open [http://localhost:3000](http://localhost:3000) to use the app.

### 2. Deploy to Vercel (Recommended)

One-click deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvibebuildlab%2Fkeyflash)

Or deploy manually:

1. Fork the repository to your GitHub account
2. Sign up at [vercel.com](https://vercel.com)
3. Click "New Project" → Import your fork
4. Configure environment variables (see below)
5. Deploy

### 3. Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Or use the Railway dashboard to import from GitHub.

### 4. Deploy to Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Launch app
fly launch

# Set environment variables
fly secrets set KEYWORD_API_PROVIDER=dataforseo
fly secrets set DATAFORSEO_API_LOGIN=your_login
fly secrets set DATAFORSEO_API_PASSWORD=your_password
# ... add other secrets
```

### 5. Docker

```bash
# Build the image
docker build -t keyflash .

# Run with environment variables
docker run -p 3000:3000 \
  -e KEYWORD_API_PROVIDER=dataforseo \
  -e DATAFORSEO_API_LOGIN=your_login \
  -e DATAFORSEO_API_PASSWORD=your_password \
  keyflash
```

## Required Environment Variables

### Minimum Configuration (Mock Mode)

No environment variables required. The app runs with sample data.

### Production Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `KEYWORD_API_PROVIDER` | Yes | `mock`, `dataforseo`, or `google-ads` |
| `DATAFORSEO_API_LOGIN` | For DataForSEO | Your DataForSEO username |
| `DATAFORSEO_API_PASSWORD` | For DataForSEO | Your DataForSEO password |
| `UPSTASH_REDIS_REST_URL` | Recommended | Redis URL for caching |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Redis auth token |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | For auth | Clerk public key |
| `CLERK_SECRET_KEY` | For auth | Clerk secret key |

### Optional Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_REQUESTS_PER_HOUR` | `10` | Requests per IP per hour |
| `RATE_LIMIT_FAIL_SAFE` | `closed` | `closed` (secure) or `open` (available when Redis fails) |
| `PRIVACY_MODE` | `false` | Disable all caching when `true` |
| `BILLING_ENABLED` | `false` | Enable Stripe payments |

## External Services

### DataForSEO (Keyword Data)

1. Sign up at [dataforseo.com](https://dataforseo.com)
2. Get your API credentials from the dashboard
3. Add to environment variables

Pricing: Pay-as-you-go, ~$0.01-0.05 per keyword lookup.

### Upstash Redis (Caching)

1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the REST URL and token

Free tier: 10,000 requests/day.

### Clerk (Authentication)

1. Sign up at [clerk.com](https://clerk.com)
2. Create an application
3. Copy the publishable and secret keys

Free tier: 10,000 monthly active users.

## Pre-deployment Checklist

```bash
# Run full validation
npm run quality:check

# Build to verify
npm run build

# Test production build locally
npm start
```

## Post-deployment

1. Verify the app loads correctly
2. Test keyword search functionality
3. Check that caching works (if Redis configured)
4. Test authentication (if Clerk configured)

## Monitoring

For production deployments, consider:

- **Error tracking**: [Sentry](https://sentry.io) (add `SENTRY_DSN`)
- **Analytics**: Vercel Analytics, Plausible, or similar
- **Uptime**: UptimeRobot, Better Uptime, or similar

## Updating

Pull the latest changes and redeploy:

```bash
git pull origin main
npm install
npm run build
```

---

> **Open source by [Vibe Build Lab](https://vibebuildlab.com)** - AI-assisted product development for solo founders and small teams.
