# 🚀 Setup Instructions for Fund Management Chatbot

Follow these step-by-step instructions to get your Fund Management Chatbot up and running.

## 📋 Prerequisites Checklist

Before starting, ensure you have:
- [ ] Node.js (version 16 or higher) installed
- [ ] npm (comes with Node.js) or yarn package manager
- [ ] OpenAI API account and API key
- [ ] Git (optional, for cloning)

### Check Your Node.js Version
```bash
node --version
npm --version
```

## 🔑 Step 1: Get Your OpenAI API Key

1. **Visit OpenAI Platform**
   - Go to [https://platform.openai.com/](https://platform.openai.com/)
   - Sign up or log in to your account

2. **Create API Key**
   - Navigate to "API Keys" in the left sidebar
   - Click "Create new secret key"
   - Copy the key (you won't be able to see it again!)
   - Store it safely

3. **Set Up Billing**
   - Go to "Billing" section
   - Add a payment method
   - Set usage limits if desired

## 📁 Step 2: Project Setup

### Option A: Download/Clone the Project
```bash
# If you have the project files, navigate to the directory
cd path/to/fund-management-chatbot

# Or clone if using Git
git clone <repository-url>
cd fund-management-chatbot
```

### Option B: The files are already in your current directory
If you're already in the project directory, proceed to the next step.

## 🔧 Step 3: Install Dependencies

### Install Backend Dependencies
```bash
# In the root directory
npm install
```

### Install Frontend Dependencies
```bash
# Navigate to client directory and install
cd client
npm install
cd ..
```

### Or Install All at Once
```bash
# From root directory
npm run install-all
```

## ⚙️ Step 4: Configure Environment

1. **Create Environment File**
   ```bash
   # Copy the example file
   cp .env.example .env
   ```

2. **Edit the .env File**
   Open `.env` in your text editor and update:
   ```env
   # Replace with your actual OpenAI API key
   OPENAI_API_KEY=sk-your-actual-api-key-here
   
   # Server configuration (you can leave these as default)
   PORT=5000
   NODE_ENV=development
   ```

   **⚠️ Important**: Replace `sk-your-actual-api-key-here` with your real OpenAI API key!

## 🚀 Step 5: Start the Application

### Development Mode (Recommended for Testing)
```bash
# This starts both frontend and backend
npm run dev
```

You should see output like:
```
🚀 Server running on port 5000
🌐 Access the application at http://localhost:5000
```

### Alternative: Start Services Separately

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

## 🌐 Step 6: Access Your Chatbot

1. **Open Your Browser**
   - Navigate to: `http://localhost:3000` (development) or `http://localhost:5000` (production)

2. **Test the Connection**
   - You should see the Fund Management Assistant interface
   - Try sending a message like "Hello" to test the connection

## ✅ Step 7: Verify Everything Works

### Test the Chatbot
1. **Send a Test Message**
   ```
   Hello, I want to create a new fund
   ```

2. **Expected Response**
   - The chatbot should respond with fund creation guidance
   - If you see an error, check the troubleshooting section below

### Check the Backend
Visit `http://localhost:5000/api/chat/health` - you should see:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "openaiConfigured": true
}
```

## 🐛 Troubleshooting

### Issue: "OpenAI API key not configured"
**Solution**: 
- Check your `.env` file exists
- Verify the API key is correct (starts with `sk-`)
- Restart the server after changing `.env`

### Issue: "Port 5000 already in use"
**Solution**:
```bash
# Kill the process using port 5000
npx kill-port 5000

# Or use a different port
PORT=3001 npm start
```

### Issue: "Cannot connect to backend"
**Solutions**:
1. Ensure backend is running (`npm run server`)
2. Check if port 5000 is accessible
3. Verify no firewall is blocking the connection

### Issue: "Module not found" errors
**Solution**:
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules client/node_modules
npm run install-all
```

### Issue: OpenAI API errors
**Common causes**:
- Invalid API key
- Insufficient credits/quota
- Rate limiting

**Check**:
- Verify API key in OpenAI dashboard
- Check billing and usage limits
- Wait a moment and try again

## 🎯 Next Steps

Once everything is working:

1. **Customize the Chatbot**
   - Edit the system prompt in `routes/chat.js`
   - Modify the UI styling in `client/src/components/`

2. **Add Your Branding**
   - Update the title in `client/src/App.tsx`
   - Customize colors in the CSS files

3. **Deploy to Production**
   - Build the frontend: `npm run build`
   - Deploy to your preferred hosting service

## 📞 Need Help?

If you encounter issues:

1. **Check the Console**
   - Browser console (F12) for frontend errors
   - Terminal output for backend errors

2. **Review the Logs**
   - Backend logs show in the terminal
   - Check for specific error messages

3. **Common Commands**
   ```bash
   # Restart everything
   npm run dev
   
   # Check if services are running
   curl http://localhost:5000/api/chat/health
   
   # View logs
   npm run server  # Shows backend logs
   ```

## 🎉 Success!

If you can send messages and receive responses from the chatbot, you're all set! The Fund Management Chatbot is now ready to help users create investment funds through intelligent conversation.

**Happy chatting! 🤖💼**
