# BitBond - Accountability Buddy DApp

Built with Next.js 14, TypeScript, Tailwind CSS, and Stacks blockchain.

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment variables:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable React components
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries (Stacks, Supabase)
├── types/              # TypeScript type definitions
└── utils/              # Helper utilities

contracts/              # Clarity smart contracts
supabase/              # Database migrations and seed data
```

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Stacks, Clarity smart contracts
- **Wallets**: Xverse, Leather Wallet

## Features

- ✅ Project initialization complete
- ✅ Database schema designed
- ✅ Smart contract development (Phase 2)
- ✅ Wallet integration (Phase 3)
- ⏳ Task management system (Phase 4)