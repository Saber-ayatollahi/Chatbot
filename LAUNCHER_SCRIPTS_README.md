# 🚀 Fund Management Chatbot - Launcher Scripts

This document describes the enhanced launcher scripts for the Fund Management Chatbot system.

## 📋 Available Scripts

### 🎯 **start-chatbot.bat** (Main Launcher)
**Interactive launcher with multiple environment options**

**Features:**
- ✅ Development Environment (hot reload, debug logging)
- ✅ Production Environment (optimized, secure)
- ✅ Quick Development (auto-setup)
- ✅ Service management and status checking
- ✅ Built-in help and guidance

**Usage:**
```bash
start-chatbot.bat
```

**Options:**
1. **Development Environment**
   - Hot reload enabled with nodemon
   - Debug logging level
   - Development database
   - Ideal for coding and testing

2. **Production Environment**
   - Optimized performance
   - Production database
   - Security features enabled
   - Auto-loads OpenAI API key from API.txt

3. **Quick Development**
   - Automatic environment setup
   - Auto-loads API key from API.txt if available
   - No manual configuration needed
   - Perfect for quick testing

---

### 🛑 **stop-chatbot-enhanced.bat** (Advanced Stop Script)
**Comprehensive service management and shutdown options**

**Features:**
- ✅ Graceful shutdown (recommended)
- ✅ Force stop option
- ✅ Individual service control
- ✅ Detailed service status
- ✅ Temporary file cleanup

**Usage:**
```bash
stop-chatbot-enhanced.bat
```

**Options:**
1. **Graceful Stop** - Allows proper cleanup and data saving
2. **Force Stop** - Immediate termination (use with caution)
3. **Stop Backend Only** - Keep frontend running
4. **Stop Frontend Only** - Keep backend running
5. **Service Status** - View detailed process information
6. **Clean Temp Files** - Remove temporary files and logs

---

### ⚙️ **setup-environment.bat** (Setup Wizard)
**First-time setup and environment configuration**

**Features:**
- ✅ Prerequisite checking (Node.js, npm, PostgreSQL)
- ✅ Dependency installation
- ✅ Database initialization
- ✅ Environment file creation
- ✅ Sample data setup

**Usage:**
```bash
setup-environment.bat
```

**Setup Options:**
1. **Full Setup** - Complete installation (recommended for new users)
2. **Dependencies Only** - Install npm packages
3. **Database Setup Only** - Initialize databases
4. **Environment Config Only** - Create .env files
5. **Verify Setup** - Check current installation

---

### 📜 **Legacy Scripts** (Backward Compatibility)

#### **start-app-quick.bat** (Deprecated)
- Redirects to new `start-chatbot.bat`
- Maintains backward compatibility
- Shows deprecation notice

#### **stop-chatbot.bat** (Enhanced)
- Quick stop functionality preserved
- Enhanced with better error handling
- Recommends using `stop-chatbot-enhanced.bat`

---

## 🔧 Environment Configuration

### 🔑 API Key Management
The scripts automatically detect and use your OpenAI API key from the `API.txt` file:

**API.txt Format:**
```
sk-proj-your-actual-openai-api-key-here
```

**Behavior:**
- ✅ **API.txt exists**: Automatically uses the API key from the file
- ❌ **API.txt missing**: 
  - Production: Prompts user to enter API key manually
  - Development: Uses demo key for testing
  - Quick Dev: Uses demo key for testing

**Security Note:** The API.txt file should contain only your OpenAI API key on a single line.

### Development Environment
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot_development
LOG_LEVEL=debug
SESSION_SECRET=dev_session_secret
ADMIN_PASSWORD=admin123
```

### Production Environment
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot_production
LOG_LEVEL=info
SESSION_SECRET=secure_production_secret
ADMIN_PASSWORD=secure_production_password
OPENAI_API_KEY=your_actual_api_key
```

---

## 🚦 Quick Start Guide

### For New Users:
1. **Run setup wizard:**
   ```bash
   setup-environment.bat
   ```
   Choose option 1 (Full Setup)

2. **Start the application:**
   ```bash
   start-chatbot.bat
   ```
   Choose option 3 (Quick Development)

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

### For Existing Users:
1. **Start development:**
   ```bash
   start-chatbot.bat
   ```
   Choose option 1 (Development Environment)

2. **Start production:**
   ```bash
   start-chatbot.bat
   ```
   Choose option 2 (Production Environment)

---

## 🛠️ Troubleshooting

### Common Issues:

#### **"Node.js not found"**
- Install Node.js 18+ from https://nodejs.org/
- Restart command prompt after installation

#### **"PostgreSQL not found"**
- Install PostgreSQL from https://postgresql.org/
- Add PostgreSQL bin directory to PATH
- Ensure PostgreSQL service is running

#### **"Port already in use"**
- Use stop scripts to clean up existing processes
- Check for other applications using ports 3000/5000

#### **"Database connection failed"**
- Verify PostgreSQL is running
- Check database credentials in .env file
- Ensure databases exist (run setup wizard)

#### **"Dependencies not installed"**
- Run `setup-environment.bat` and choose option 2
- Or manually run: `npm install && cd client && npm install`

### Getting Help:
- Run `start-chatbot.bat` and choose option 6 for setup help
- Check the setup wizard for environment validation
- Review logs in the terminal windows for detailed error messages

---

## 🔒 Security Notes

### Development Environment:
- Uses default passwords (admin123)
- Debug logging enabled
- Suitable for local development only

### Production Environment:
- Prompts for secure credentials
- Requires OpenAI API key
- Uses production database
- Optimized security settings

### Best Practices:
- Never commit .env files to version control
- Never commit API.txt to version control (add to .gitignore)
- Use strong passwords in production
- Regularly update dependencies
- Monitor logs for security issues
- Keep your OpenAI API key secure and rotate it regularly

---

## 📊 Features Comparison

| Feature | start-chatbot.bat | stop-chatbot-enhanced.bat | setup-environment.bat |
|---------|-------------------|---------------------------|----------------------|
| Interactive Menu | ✅ | ✅ | ✅ |
| Environment Selection | ✅ | ❌ | ❌ |
| Service Management | ✅ | ✅ | ❌ |
| Dependency Installation | ❌ | ❌ | ✅ |
| Database Setup | ❌ | ❌ | ✅ |
| Status Checking | ✅ | ✅ | ✅ |
| Cleanup Utilities | ❌ | ✅ | ❌ |

---

## 🎯 Recommended Workflow

### First Time Setup:
1. `setup-environment.bat` → Full Setup
2. `start-chatbot.bat` → Quick Development
3. Test the application
4. `stop-chatbot-enhanced.bat` → Graceful Stop

### Daily Development:
1. `start-chatbot.bat` → Development Environment
2. Code and test
3. `stop-chatbot-enhanced.bat` → Graceful Stop

### Production Deployment:
1. `start-chatbot.bat` → Production Environment
2. Configure API keys and credentials
3. Monitor via service status
4. `stop-chatbot-enhanced.bat` → Graceful Stop when needed

---

*Last updated: September 2025*
*Version: 2.0 - Enhanced Interactive Launchers*
