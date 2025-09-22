# Installing pgvector on Windows

## Method 1: Using Pre-compiled Binaries (Recommended)

### Step 1: Download pgvector
```bash
# Download the latest release
curl -L https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.0.zip -o pgvector.zip
```

### Step 2: Extract and Install
1. Extract the ZIP file
2. Copy the files to your PostgreSQL installation directory
3. Restart PostgreSQL service

### Step 3: Enable Extension
```sql
-- Connect to your database and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

## Method 2: Using Docker (Alternative)

If you have Docker, you can use a PostgreSQL image with pgvector pre-installed:

```bash
docker run --name postgres-vector -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d pgvector/pgvector:pg16
```

## Method 3: Manual Compilation (Advanced)

### Prerequisites:
- Visual Studio Build Tools
- PostgreSQL development files
- Git

### Steps:
```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
# Follow Windows-specific build instructions
```

## Verification

After installation, verify pgvector is working:

```sql
-- Test vector operations
SELECT vector_dims('[1,2,3]'::vector) as dimensions;
SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector as distance;
```

## Troubleshooting

If you encounter issues:
1. Ensure PostgreSQL service is restarted
2. Check PostgreSQL logs for errors
3. Verify extension files are in correct directory
4. Ensure user has CREATE EXTENSION privileges
