# Xmrit Hub - Statistical Process Control Dashboard

<p align="center">
  <img src="./public/dashboard-preview.png" alt="XMR Dashboard Preview" width="800"/>
</p>

A self-hosted dashboard platform for Statistical Process Control (SPC) using XMR (X-bar and Moving Range) charts. Inspired by [xmrit.com](https://xmrit.com) by Commoncog, this platform helps you monitor metrics, detect process variations, and make data-driven decisions across your organization.

> **New to XMR Charts?** See the [Xmrit User Manual](https://xmrit.com/manual/) by Commoncog for concepts, detection rules, trend analysis, and best practices.

## 🎯 Use Cases

- **Business Metrics Monitoring**: Track KPIs, revenue, conversion rates, and operational metrics
- **Quality Control**: Monitor manufacturing processes, defect rates, and quality indicators
- **DevOps & SRE**: System performance, latency, error rates, and infrastructure health
- **Team Analytics**: Sprint velocity, cycle time, incident response times

## ✨ Features

**XMR Chart Analysis**

- Automatic control limits (UNPL, LNPL, URL) with Western Electric Rules violation detection
- Outlier detection (IQR, Z-Score, MAD, Percentile, Consensus)
- Locked limits with modification tracking
- Trend analysis with linear regression and dynamic limits
- Seasonality detection (yearly, quarterly, monthly, weekly)

**Platform Features**

- **Workspace/slide organization** with metric hierarchies
- **Follow-up system** for tracking action items with temporal resolution
- **Comment system** with persistent threads on data points across slides
- **Metrics ingestion API** for automation and ETL integration
- **Dark/light theme** with responsive design
- **Google OAuth** authentication via NextAuth.js
- **Interactive charts** built with Recharts and Radix UI
- **Real-time collaboration** with multi-user support

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs) folder:

### Core Documentation

- **[Database Schema](./docs/SCHEMA.md)** - Complete database schema reference with tables, relationships, and best practices
- **[API Patterns & Best Practices](./docs/API_PATTERNS.md)** - Data fetching patterns, centralized hooks, common pitfalls, and code review guidelines

### Feature Documentation

- **[Data Ingestion API](./docs/DATA_INGESTION.md)** - REST API for programmatic data ingestion
- **[Comment System](./docs/COMMENT_SYSTEM.md)** - Persistent comments and discussion threads on data points
- **[Follow-up System](./docs/FOLLOW_UP.md)** - Task/ticket management with temporal resolution tracking
- **[Auto Lock Limit](./docs/AUTO_LOCK_LIMIT.md)** - Automatic outlier detection and removal
- **[Lock Limit](./docs/LOCK_LIMIT.md)** - Manual limit locking and customization
- **[Trend Lines](./docs/TREND_LINES.md)** - Linear trend analysis with dynamic limits
- **[Seasonality](./docs/DESEASONALISATION.md)** - Seasonal pattern removal and adjustments

Each document includes detailed explanations, use cases, implementation details, best practices, and troubleshooting guides.

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **PostgreSQL** database ([Neon](https://neon.tech) recommended for serverless)
- **Google OAuth credentials** (for authentication)

### 1. Clone

```bash
git clone <your-repo-url>
cd xmrit-hub
```

### 2. Environment Setup

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Or create a `.env` file manually:

```env
# Port Configuration (optional - defaults to 3000)
PORT=3000

# Database (Required)
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"

# NextAuth (Required)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""  # Generate: openssl rand -base64 32

# Google OAuth (Required)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# API Key for data ingestion (Required)
METRICS_API_KEY=""  # Generate: openssl rand -hex 32 (minimum 32 chars)
```

**Generate secure keys:**

```bash
# NextAuth secret
openssl rand -base64 32

# Metrics API key
openssl rand -hex 32
```

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable **Google+ API**
4. Navigate to **Credentials** → Create **OAuth 2.0 Client ID**
5. Add authorized redirect URI:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`
6. Copy the Client ID and Client Secret to your `.env` file

### 4. Database Setup & Install

```bash
# Push database schema
npm run db:push

# Install packages
npm install

# Start development server
npm run dev
```

The app will be available at **http://localhost:3000**

**Note:** After running `npm install`, the default workspace creation script runs automatically. If your database is already set up (DATABASE_URL is configured), a sample workspace with example slides will be created. If the database isn't ready yet, you can manually run `npm run db:create-default-workspace` after setting up your database.

## 📁 Project Structure

```
src/
├── app/                              # Next.js 15 App Router
│   ├── [workspaceSlug]/              # Workspace pages (URL uses slug, e.g., /my-workspace)
│   │   ├── components/               # Dashboard components
│   │   ├── follow-ups/               # Follow-up management
│   │   └── slide/[slideSlug]/        # Slide details & XMR charts (URL uses slug, e.g., /1-weekly-review)
│   ├── api/                          # API routes
│   │   ├── auth/[...nextauth]/       # NextAuth.js endpoints
│   │   ├── ingest/metrics/           # Data ingestion API
│   │   ├── workspaces/               # Workspace CRUD
│   │   ├── slides/                   # Slide CRUD
│   │   ├── metrics/                  # Metric operations
│   │   ├── submetrics/               # Submetric & comments
│   │   └── follow-ups/               # Follow-up tasks
│   └── auth/                         # Authentication pages
│
├── lib/
│   ├── xmr-calculations.ts           # Core XMR/SPC algorithms
│   ├── time-buckets.ts               # Time normalization utilities
│   ├── api/                          # Centralized API clients
│   ├── db/                           # Database schema & connection
│   ├── validations/                  # Zod validation schemas
│   ├── follow-ups/                   # Follow-up utilities
│   └── auth.ts                       # NextAuth configuration
│
├── components/
│   └── ui/                           # Reusable UI components (Radix)
│
├── providers/                        # React context providers
├── hooks/                            # Custom React hooks
└── types/                            # TypeScript type definitions
```

## 🛠️ Available Scripts

| Command                               | Description                                   |
| ------------------------------------- | --------------------------------------------- |
| `npm run dev`                         | Start development server (with Turbopack)     |
| `npm run build`                       | Build for production                          |
| `npm run start`                       | Start production server                       |
| `npm run lint`                        | Run Biome linter checks                       |
| `npm run format`                      | Format code with Biome                        |
| `npm run db:push`                     | Sync schema to database (⚠️ use with caution) |
| `npm run db:check`                    | Check for schema drift                        |
| `npm run db:introspect`               | Introspect existing database                  |
| `npm run db:studio`                   | Open Drizzle Studio (visual database browser) |
| `npm run db:reset`                    | ⚠️ Reset database (destructive)               |
| `npm run db:create-default-workspace` | Create a default workspace                    |

> **⚠️ Database Note:** This project uses `db:push` for schema changes instead of traditional migrations. This is suitable for development but use with caution in production. See [SCHEMA.md](./docs/SCHEMA.md) for details.

## 🔧 Data Ingestion API

Programmatically ingest metrics from data warehouses, ETL pipelines (n8n, Zapier, Airflow), BI tools (Metabase, Tableau), or any HTTP-capable system.

**Important:** The data ingestion API uses **UUIDs (IDs)**, not slugs. URLs use slugs (e.g., `/my-workspace/slide/1-weekly-review`), but the API requires workspace and slide UUIDs.

### Endpoint

```
POST /api/ingest/metrics
```

**Headers:**

```
Authorization: Bearer YOUR_METRICS_API_KEY
Content-Type: application/json
```

### Payload Example

```json
{
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "slide_title": "Q4 2024 Weekly Business Review",
  "slide_date": "2024-10-30",
  "metrics": [
    {
      "metric_name": "Revenue",
      "description": "Total revenue across all regions",
      "ranking": 1,
      "submetrics": [
        {
          "category": "North America",
          "timezone": "America/Los_Angeles",
          "xaxis": "week",
          "yaxis": "USD",
          "unit": "$",
          "preferred_trend": "uptrend",
          "data_points": [
            { "timestamp": "2024-01-01", "value": 125000 },
            { "timestamp": "2024-01-08", "value": 132000 },
            { "timestamp": "2024-01-15", "value": 128000 }
          ]
        }
      ]
    }
  ]
}
```

### Key Parameters

| Field             | Required | Description                                                            |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| `workspace_id`    | ⬜       | **UUID** of the workspace (not slug). Creates new workspace if omitted |
| `slide_id`        | ⬜       | **UUID** of the slide (not slug). Creates/updates by title if omitted  |
| `slide_title`     | ⬜       | Title of the slide (required if `slide_id` not provided)               |
| `slide_date`      | ⬜       | Date in YYYY-MM-DD format                                              |
| `metric_name`     | ✅       | Name of the metric group                                               |
| `description`     | ⬜       | Optional metric description                                            |
| `ranking`         | ⬜       | Optional display priority (1 = highest)                                |
| `category`        | ⬜       | Dimension/segment (e.g., "North America")                              |
| `xaxis`           | ⬜       | Time granularity (day/week/month/quarter/year)                         |
| `yaxis`           | ⬜       | Y-axis label/unit                                                      |
| `preferred_trend` | ⬜       | Desired trend: uptrend/downtrend/stable                                |
| `data_points`     | ✅       | Array of {timestamp, value} objects                                    |

**Note:**

- The API uses UUIDs (`workspace_id`, `slide_id`), not URL slugs. To find a workspace UUID, check the workspace settings in the UI or query the database.
- Slides are identified by UUID or by `slide_title` + `slide_date` combination.
- **Slide numbers are automatically assigned** when creating new slides - you don't need to specify them. The API automatically increments the slide number for each workspace (finds MAX slide number + 1). Numbers keep incrementing on their own with each new slide creation.

### Example with cURL

```bash
curl -X POST https://your-domain.com/api/ingest/metrics \
  -H "Authorization: Bearer YOUR_METRICS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @payload.json
```

For complete API documentation, see **[Data Ingestion API](./docs/DATA_INGESTION.md)**.

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project to [Vercel](https://vercel.com)
3. Add environment variables from your `.env` file
4. Deploy

**Important:** Make sure to set all required environment variables in Vercel's project settings.

### Self-Hosted

```bash
# Build the application
npm run build

# Start production server
npm run start
```

**Production Checklist:**

- [ ] Set `NEXTAUTH_URL` to your production domain
- [ ] Use a production PostgreSQL database (not dev/staging)
- [ ] Generate strong secrets for `NEXTAUTH_SECRET` and `METRICS_API_KEY`
- [ ] Configure Google OAuth with production redirect URIs
- [ ] Set up database backups
- [ ] Configure monitoring and error tracking
- [ ] Review and apply rate limiting for API endpoints

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style (enforced by Biome)
- Run `npm run lint` before committing
- Add appropriate documentation for new features
- Update relevant docs in the `/docs` folder
- Test your changes thoroughly

See **[API Patterns & Best Practices](./docs/API_PATTERNS.md)** for code review guidelines.

## 🛟 Support & Documentation

- **[Database Schema](./docs/SCHEMA.md)** - Complete schema reference
- **[API Patterns](./docs/API_PATTERNS.md)** - Development best practices
- **[Comment System](./docs/COMMENT_SYSTEM.md)** - Thread-based discussions
- **[Follow-up System](./docs/FOLLOW_UP.md)** - Task management
- **[Data Ingestion](./docs/DATA_INGESTION.md)** - API integration guide

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npm run db:studio
```

If you can't connect, verify your `DATABASE_URL` is correct and the database is accessible.

### OAuth Redirect Issues

Make sure your Google OAuth redirect URI matches exactly:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://your-domain.com/api/auth/callback/google`

### Port Already in Use

Change the port in your `.env` file:

```env
PORT=3001
```

## 📝 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

This project is built on foundational work in Statistical Process Control:

- **Walter A. Shewhart** - SPC principles and control charts
- **Western Electric** - Detection rules and quality control standards
- **Donald J. Wheeler** - XMR methodology and modern SPC practices
- **[Commoncog](https://commoncog.com)** - [xmrit.com](https://xmrit.com) inspiration and XMR education

## 🛠️ Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5
- **Database:** PostgreSQL + Drizzle ORM
- **Authentication:** NextAuth.js v5
- **UI Components:** Radix UI + Tailwind CSS 4
- **Charts:** Recharts
- **Data Fetching:** TanStack Query (React Query)
- **Validation:** Zod
- **Linting:** Biome

---

Built with ❤️ for data-driven decision making
