# 🔧 pgvector Manual Installation Guide for Windows

## 📋 **Current Status**
- ✅ PostgreSQL 16 installed at: `C:\Program Files\PostgreSQL\16\`
- ✅ pgvector source downloaded to: `temp_pgvector/pgvector-0.8.0/`
- ❌ Build tools not available (Visual Studio C++ compiler)

## 🎯 **Installation Options (Choose One)**

### **Option 1: Stack Builder (Try This First)**

1. **Open Stack Builder** (should already be open):
   ```
   C:\Program Files\PostgreSQL\16\bin\StackBuilder.exe
   ```

2. **Follow these steps in Stack Builder**:
   - Select your PostgreSQL 16 installation
   - Click "Next"
   - Look for "Extensions" or "Spatial Extensions" category
   - Look for "pgvector" or "vector" extension
   - If found, select it and install

3. **If pgvector is not available in Stack Builder**, proceed to Option 2.

### **Option 2: Pre-compiled Binaries (Recommended)**

1. **Download pre-compiled files**:
   - Visit: https://github.com/pgvector/pgvector/releases
   - Look for Windows binaries or PostgreSQL 16 compatible files
   - Download the appropriate .zip file

2. **Manual file placement**:
   ```
   # You need to copy these files (as Administrator):
   
   # DLL files go to:
   C:\Program Files\PostgreSQL\16\lib\
   
   # SQL and control files go to:
   C:\Program Files\PostgreSQL\16\share\extension\
   ```

3. **Required files**:
   - `vector.dll` → `lib/`
   - `vector.control` → `share/extension/`
   - `vector--*.sql` → `share/extension/`

### **Option 3: Compile from Source (Advanced)**

If you want to compile from source, you need:

1. **Install Visual Studio Build Tools**:
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Install "C++ build tools" workload
   - Add to PATH: `C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\*\bin\Hostx64\x64`

2. **Set up environment**:
   ```cmd
   # Add PostgreSQL bin to PATH
   set PATH=%PATH%;C:\Program Files\PostgreSQL\16\bin
   
   # Navigate to pgvector source
   cd temp_pgvector\pgvector-0.8.0
   
   # Compile (if build tools available)
   make
   make install
   ```

### **Option 4: SQL-Only Installation (Fallback)**

If binary installation fails, you can install the SQL functions manually:

1. **Download SQL files**:
   - Get `vector--0.8.0.sql` from pgvector releases
   - Get `vector.control` from pgvector releases

2. **Manual SQL execution**:
   ```sql
   -- Connect to your database and run the SQL commands from vector--0.8.0.sql
   -- This creates the vector type and functions without the optimized C code
   ```

## 🧪 **Testing Installation**

After any installation method, test with:

```bash
npm run test:pgvector
```

Or manually test:

```sql
-- Connect to your database
-- Test 1: Create extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Test 2: Basic vector operations
SELECT '[1,2,3]'::vector;
SELECT vector_dims('[1,2,3]'::vector);
SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector;
```

## 🔧 **Troubleshooting**

### **Permission Issues**
- Run Command Prompt as Administrator
- Ensure you have write access to PostgreSQL directories

### **File Not Found Errors**
- Verify PostgreSQL installation path
- Check that all required files are copied to correct locations

### **Extension Creation Fails**
- Check PostgreSQL logs: `C:\Program Files\PostgreSQL\16\data\log\`
- Ensure PostgreSQL service is restarted after file installation

### **Still Not Working?**
- Try the Docker option (see below)
- Use text-based fallback mode (current system works without pgvector)

## 🐳 **Alternative: Docker with pgvector**

If manual installation is too complex:

```bash
# Stop current PostgreSQL service
net stop postgresql-x64-16

# Run PostgreSQL with pgvector in Docker
docker run --name postgres-vector \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=fund_chatbot \
  -p 5432:5432 -d \
  pgvector/pgvector:pg16

# Update your .env to point to Docker instance
# Then run: npm run test:pgvector
```

## 📞 **Next Steps**

1. **Try Stack Builder first** (easiest)
2. **If that fails, try pre-compiled binaries**
3. **Test with `npm run test:pgvector`**
4. **If all fails, Docker is the most reliable option**

The system works in fallback mode without pgvector, but vector search will be much more powerful with it installed.
