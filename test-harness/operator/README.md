# Operator - The System That Builds The System

A conversational AI that helps users build browser automation workflows by learning from their feedback.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up database:
- Go to Supabase dashboard
- Run the SQL from `supabase-schema.sql`

3. Start the server:
```bash
npm run dev
```

4. Open http://localhost:3002

## How It Works

1. **Tell the operator your goal**: "I want to extract emails from Gmail"
2. **Operator builds step-by-step**: Creates nodes, executes them
3. **You provide feedback**: "I see a login page"
4. **Operator adapts**: Modifies approach based on what you see

## Project Structure

```
operator/
├── Working Docs/       # Architecture and planning documents
├── backend/           # Express server + OpenAI integration
├── frontend/          # React UI (no build step)
├── package.json       # Dependencies
├── supabase-schema.sql # Database schema
└── .env              # Environment variables (create from .env.example)
```

## Key Features

- Natural language workflow building
- Real-time browser automation
- Learn from user feedback
- No DOM flooding - user describes what they see
- Execution logs for debugging