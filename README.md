# UMass Lost & Found

OUR BIG IDEA

A map-based real-time lost and found platform for UMass Amherst students.

## Features

- 🗺️ **Interactive Map** - Leaflet-based map centered on UMass campus
- 🔐 **UMass Authentication** - Email-based auth restricted to @umass.edu domains
- 📝 **Report Items** - Multi-step forms for reporting lost and found items
- 🤖 **AI Matching** - Smart algorithm matches lost items with found items
- 💬 **Real-time Chat** - Direct messaging between finders and owners
- 🏆 **Karma System** - Gamification with badges and leaderboards
- 🌙 **Dark Mode** - Beautiful glassmorphism design

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Maps:** Leaflet + react-leaflet
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/umass-lost-found.git
   cd umass-lost-found
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Run the database migrations (SQL in `supabase/migrations/`)

3. Enable Row Level Security (RLS) on all tables

4. Create a storage bucket named `item-photos`

5. Configure authentication:
   - Enable email auth
   - Add email restriction for @umass.edu and @students.umass.edu

## Database Schema

### Tables

- `users` - User profiles with karma points and badges
- `lost_items` - Reported lost items
- `found_items` - Reported found items
- `matches` - AI-generated matches between items
- `conversations` - Chat conversations
- `messages` - Chat messages
- `keyword_nodes` - Keyword synonyms for matching
- `reviews` - User reviews

## Project Structure

```
src/
├── components/
│   ├── Auth/           # Login, SignUp, ProtectedRoute
│   ├── Common/         # Button, Card, Modal, Toast
│   ├── Forms/          # ReportLostItem, ReportFoundItem
│   ├── Items/          # ItemDetail, MyItems
│   ├── Map/            # MapContainer, MapPin, SearchFilter
│   ├── Messaging/      # ChatList, ChatThread
│   ├── Navigation/     # Navbar, BottomNav
│   └── Profile/        # UserProfile, Leaderboard, Settings
├── hooks/
│   └── useAuth.js      # Authentication hook
├── utils/
│   ├── constants.js    # App constants and helpers
│   ├── scoring.js      # AI matching algorithm
│   └── supabaseClient.js
├── App.jsx             # Main app with routing
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Build for Production

```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- UMass Amherst community
- Anthropic Claude for AI assistance
- Supabase team for the amazing backend
