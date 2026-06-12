# AI-Powered Support Agent

A modern web application providing AI-powered customer support capabilities with document management and real-time chat functionality.

## Features

- **Chat Interface**: Real-time messaging with AI-powered support agent
- **Document Management**: Upload and manage support documents
- **Modern UI**: Built with React and TailwindCSS for a responsive, user-friendly experience
- **Type-Safe**: Full TypeScript support for robust development

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS 4
- **Routing**: React Router v6
- **UI Icons**: Lucide React
- **Code Quality**: ESLint, Prettier

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-powered-support-agent
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
VITE_API_BASE=http://localhost:3000
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the next available port).

### Building

Build for production:
```bash
npm run build
```

Build for development:
```bash
npm run build:dev
```

### Linting & Formatting

Run ESLint:
```bash
npm run lint
```

Format code with Prettier:
```bash
npm run format
```

## Project Structure

```
src/
├── App.tsx              # Main application component
├── main.tsx             # Application entry point
├── index.css            # Global styles
├── lib/
│   └── api.ts          # API client utilities
└── pages/
    ├── Chat.tsx        # Chat interface page
    └── Documents.tsx   # Document management page
```

## Environment Variables

- `VITE_API_BASE`: Base URL for the backend API server (default: `http://localhost:3000`)

## Contributing

Contributions are welcome! Please ensure code quality by running:
- `npm run lint` - Check for linting issues
- `npm run format` - Format code with Prettier

## License

This project is proprietary and confidential.
