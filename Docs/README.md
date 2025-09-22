# Fund Management Chatbot 🤖💼

An intelligent chatbot that replaces traditional wizard interfaces for fund management using OpenAI's GPT technology. This application guides users through creating investment funds conversationally, collecting all necessary information through natural language interaction.

## 🌟 Features

- **Intelligent Conversation**: Natural language interaction powered by OpenAI GPT-4
- **Fund Creation Wizard Replacement**: Guides users through the complete fund setup process
- **Modern UI**: Beautiful, responsive chat interface with real-time messaging
- **Comprehensive Data Collection**: Handles all fund properties, hierarchy, rollforward, and security settings
- **Real-time Validation**: Intelligent input validation and suggestions
- **Session Management**: Maintains conversation context throughout the process

## 🏗️ Architecture

### Frontend (React + TypeScript)
- Modern chat interface with message bubbles
- Real-time typing indicators
- Responsive design for all devices
- TypeScript for type safety

### Backend (Node.js + Express)
- RESTful API for chat interactions
- OpenAI GPT-4 integration
- Session management
- Error handling and validation

## 📋 Fund Creation Process

The chatbot guides users through these steps:

### 1. **Basic Fund Information**
- Fund Name (required)
- Fund Type (Sensitivities and Exposures, etc.)
- Base Unit (Market Value, etc.)
- Projection Method (Buy and Hold, etc.)
- Inferred Cash Method (Cash on Account, etc.)
- Currency (USD, EUR, etc.)
- Grouping (Asian equity, etc.)
- Open Date (MM/DD/YYYY format)
- Close Date (optional, can be "Ongoing")

### 2. **Hierarchy Structure**
- Current hierarchy levels
- Add new hierarchy levels
- Select from existing organizational units
- Configure picker names

### 3. **Rollforward Configuration**
- Rollforward Against Market Index selection
- Impact settings for daily valuations and monthly analytics

### 4. **Security Context**
- Fund visibility settings
- Access control configuration

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fund-management-chatbot
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=5000
   NODE_ENV=development
   ```

### Running the Application

#### Development Mode (Recommended)
```bash
# Install all dependencies
npm run install-all

# Start both frontend and backend
npm run dev
```

#### Production Mode
```bash
# Build the frontend
npm run build

# Start the server
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000 (development) or http://localhost:5000 (production)
- **Backend API**: http://localhost:5000/api

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes | - |
| `PORT` | Server port | No | 5000 |
| `NODE_ENV` | Environment mode | No | development |

### OpenAI Setup

1. **Get an API Key**
   - Visit [OpenAI Platform](https://platform.openai.com/)
   - Create an account or sign in
   - Navigate to API Keys section
   - Create a new API key

2. **Configure Billing**
   - Ensure you have billing set up for API usage
   - Monitor usage in the OpenAI dashboard

## 📡 API Endpoints

### Chat Endpoints

- `POST /api/chat/message` - Send a message to the chatbot
- `GET /api/chat/history/:sessionId` - Get conversation history
- `DELETE /api/chat/history/:sessionId` - Clear conversation history
- `GET /api/chat/health` - Health check

### Example API Usage

```javascript
// Send a message
const response = await fetch('/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "I want to create a new fund called 'Tech Growth Fund'",
    sessionId: "session_123"
  })
});

const data = await response.json();
console.log(data.message); // AI response
```

## 🎨 Customization

### Modifying the AI Behavior

Edit the system prompt in `routes/chat.js`:

```javascript
const SYSTEM_PROMPT = `Your custom instructions here...`;
```

### Styling

The UI uses CSS modules located in `client/src/components/`. Key files:
- `ChatInterface.css` - Main chat container
- `MessageBubble.css` - Message styling
- `MessageInput.css` - Input field styling

### Adding New Features

1. **Backend**: Add new routes in `routes/chat.js`
2. **Frontend**: Create new components in `client/src/components/`
3. **Types**: Update TypeScript types in `client/src/types/`

## 🛠️ Development

### Project Structure
```
fund-management-chatbot/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── ...
│   └── package.json
├── routes/                 # Express routes
│   └── chat.js            # Chat API routes
├── server.js              # Express server
├── package.json           # Backend dependencies
└── README.md
```

### Available Scripts

```bash
# Backend
npm start              # Start production server
npm run server         # Start development server with nodemon
npm run dev            # Start both frontend and backend

# Frontend (in client/ directory)
npm start              # Start development server
npm run build          # Build for production
npm test               # Run tests
```

## 🔒 Security Considerations

- **API Key Protection**: Never expose your OpenAI API key in client-side code
- **Input Validation**: All user inputs are validated before processing
- **Rate Limiting**: Consider implementing rate limiting for production use
- **HTTPS**: Use HTTPS in production environments

## 🐛 Troubleshooting

### Common Issues

1. **OpenAI API Errors**
   - Check your API key is correct
   - Verify billing is set up
   - Check rate limits

2. **Port Already in Use**
   ```bash
   # Kill process on port 5000
   npx kill-port 5000
   ```

3. **Build Errors**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Delete node_modules and reinstall
   rm -rf node_modules client/node_modules
   npm run install-all
   ```

## 📈 Performance Optimization

- **Message History**: Limited to last 20 messages per session
- **Response Caching**: Consider implementing Redis for production
- **Bundle Size**: Frontend uses code splitting for optimal loading

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the troubleshooting section above
- Review the OpenAI API documentation
- Create an issue in the repository

---

**Built with ❤️ for modern fund management workflows**
