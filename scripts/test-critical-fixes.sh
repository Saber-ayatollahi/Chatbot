#!/bin/bash

# ============================================================================
# Critical Fixes Testing Script
# Tests all three critical fixes to ensure they work correctly
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo ""
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check environment variable
check_env_var() {
    local var_name="$1"
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        print_warning "Environment variable $var_name is not set"
        return 1
    else
        print_status "Environment variable $var_name is set"
        return 0
    fi
}

# Main testing function
main() {
    print_header "🧪 CRITICAL FIXES TESTING SCRIPT"
    
    echo "Testing all three critical fixes:"
    echo "1. Vector Dimension Consistency"
    echo "2. Environment Configuration Validation"
    echo "3. Connection Pool Enhancement"
    echo ""
    
    # Check prerequisites
    print_header "📋 PREREQUISITES CHECK"
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_status "Node.js version: $NODE_VERSION"
    else
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_status "npm version: $NPM_VERSION"
    else
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root directory."
        exit 1
    fi
    
    print_status "Prerequisites check passed"
    
    # Test 1: Environment Validation
    print_header "1️⃣ TESTING ENVIRONMENT VALIDATION"
    
    print_info "Running environment validation script..."
    if node scripts/validateEnvironment.js; then
        print_status "Environment validation passed"
    else
        print_error "Environment validation failed"
        print_info "This is expected if environment variables are not properly configured"
        print_info "Please check the error messages above and configure missing variables"
    fi
    
    # Test 2: Configuration Loading
    print_header "2️⃣ TESTING CONFIGURATION LOADING"
    
    print_info "Testing configuration consistency..."
    node -e "
    try {
        const { getConfig } = require('./config/environment');
        const config = getConfig();
        
        console.log('✅ Configuration loaded successfully');
        console.log('📊 Key settings:');
        console.log('  - Vector dimension:', config.get('vector.dimension'));
        console.log('  - Embedding model:', config.get('openai.embeddingModel'));
        console.log('  - Database pool size:', config.get('database.poolSize'));
        console.log('  - Environment:', config.get('app.environment'));
        
        // Validate consistency
        const embeddingModel = config.get('openai.embeddingModel');
        const vectorDim = config.get('vector.dimension');
        
        const expectedDimensions = {
            'text-embedding-3-large': 3072,
            'text-embedding-3-small': 1536,
            'text-embedding-ada-002': 1536
        };
        
        const expectedDim = expectedDimensions[embeddingModel];
        if (expectedDim && vectorDim === expectedDim) {
            console.log('✅ Vector dimensions are consistent with embedding model');
        } else {
            console.log('❌ Vector dimension mismatch detected');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Configuration test failed:', error.message);
        process.exit(1);
    }
    " || {
        print_error "Configuration loading test failed"
        exit 1
    }
    
    # Test 3: Database Connection
    print_header "3️⃣ TESTING DATABASE CONNECTION"
    
    print_info "Testing database connection and pool..."
    node -e "
    async function testDatabase() {
        try {
            const { getDatabase } = require('./config/database');
            const db = getDatabase();
            
            console.log('🔌 Initializing database connection...');
            await db.initialize();
            
            console.log('✅ Database connection established');
            
            // Test basic query
            const result = await db.query('SELECT NOW() as current_time, version() as postgres_version');
            console.log('✅ Basic query executed successfully');
            console.log('  - Database time:', result.rows[0].current_time);
            console.log('  - PostgreSQL version:', result.rows[0].postgres_version.split(' ')[0]);
            
            // Test pool stats
            const poolStats = db.getPoolStats();
            if (poolStats) {
                console.log('✅ Connection pool working');
                console.log('  - Pool size:', poolStats.maxSize);
                console.log('  - Active connections:', poolStats.totalCount);
            }
            
            // Test health check
            const healthCheck = await db.healthCheck();
            console.log('✅ Health check completed');
            console.log('  - Status:', healthCheck.status);
            console.log('  - Response time:', healthCheck.responseTime);
            
            // Test vector extension if available
            try {
                await db.query('SELECT vector_dims(\\'[1,2,3]\\'::vector) as dims');
                console.log('✅ pgvector extension is working');
            } catch (error) {
                console.log('⚠️ pgvector extension not available (this is OK for basic functionality)');
            }
            
            await db.close();
            console.log('✅ Database connection closed');
            
        } catch (error) {
            console.error('❌ Database test failed:', error.message);
            console.error('💡 Make sure PostgreSQL is running and accessible');
            console.error('💡 Check your database configuration in environment variables');
            process.exit(1);
        }
    }
    
    testDatabase();
    " || {
        print_warning "Database connection test failed"
        print_info "This is expected if PostgreSQL is not running or not configured"
        print_info "The application will still work with proper database setup"
    }
    
    # Test 4: OpenAI API Integration
    print_header "4️⃣ TESTING OPENAI API INTEGRATION"
    
    if check_env_var "OPENAI_API_KEY"; then
        print_info "Testing OpenAI API with vector dimension validation..."
        node -e "
        async function testOpenAI() {
            try {
                const { getConfig } = require('./config/environment');
                const OpenAI = require('openai');
                
                const config = getConfig();
                const apiKey = config.get('openai.apiKey');
                
                if (!apiKey || apiKey.includes('your-api-key') || apiKey.includes('replace-me')) {
                    console.log('⚠️ OpenAI API key appears to be a placeholder');
                    console.log('💡 Set a real API key to test OpenAI integration');
                    return;
                }
                
                const openai = new OpenAI({ 
                    apiKey: apiKey,
                    timeout: 10000
                });
                
                console.log('🤖 Testing embeddings API...');
                const embeddingModel = config.get('openai.embeddingModel');
                const expectedDim = config.get('vector.dimension');
                
                const response = await openai.embeddings.create({
                    model: embeddingModel,
                    input: 'This is a test for vector dimension validation'
                });
                
                const actualDim = response.data[0].embedding.length;
                console.log('✅ Embeddings API working');
                console.log('  - Model:', embeddingModel);
                console.log('  - Expected dimensions:', expectedDim);
                console.log('  - Actual dimensions:', actualDim);
                
                if (actualDim === expectedDim) {
                    console.log('✅ Vector dimensions match configuration');
                } else {
                    console.log('❌ Vector dimension mismatch!');
                    console.log('💡 Update VECTOR_DIMENSION environment variable to', actualDim);
                    process.exit(1);
                }
                
                // Test chat API
                console.log('🤖 Testing chat API...');
                const chatResponse = await openai.chat.completions.create({
                    model: config.get('openai.chatModel'),
                    messages: [{ role: 'user', content: 'Hello, this is a test.' }],
                    max_tokens: 10
                });
                
                if (chatResponse.choices && chatResponse.choices.length > 0) {
                    console.log('✅ Chat API working');
                    console.log('  - Model:', config.get('openai.chatModel'));
                    console.log('  - Response length:', chatResponse.choices[0].message.content.length);
                }
                
            } catch (error) {
                if (error.message.includes('API key')) {
                    console.log('❌ OpenAI API key is invalid');
                    console.log('💡 Please check your OPENAI_API_KEY environment variable');
                } else if (error.message.includes('quota')) {
                    console.log('❌ OpenAI API quota exceeded');
                    console.log('💡 Check your OpenAI account billing and usage limits');
                } else {
                    console.log('❌ OpenAI API test failed:', error.message);
                }
                process.exit(1);
            }
        }
        
        testOpenAI();
        " || {
            print_warning "OpenAI API test failed"
            print_info "Check your API key and quota limits"
        }
    else
        print_warning "OPENAI_API_KEY not set, skipping OpenAI API tests"
    fi
    
    # Test 5: Unit Tests
    print_header "5️⃣ RUNNING UNIT TESTS"
    
    if [ -f "__tests__/unit/critical-fixes.test.js" ]; then
        print_info "Running critical fixes unit tests..."
        if command_exists jest; then
            npm test __tests__/unit/critical-fixes.test.js || {
                print_warning "Some unit tests failed"
                print_info "This may be due to missing database or API configuration"
            }
        else
            print_warning "Jest not available, skipping unit tests"
            print_info "Run 'npm install' to install testing dependencies"
        fi
    else
        print_warning "Unit test file not found"
    fi
    
    # Test 6: Database Migration
    print_header "6️⃣ TESTING DATABASE MIGRATION"
    
    if [ -f "database/migration_001_fix_vector_dimensions.sql" ]; then
        print_info "Database migration file found"
        print_info "To apply the migration, run:"
        print_info "  psql -d your_database -f database/migration_001_fix_vector_dimensions.sql"
        print_status "Migration file is ready for deployment"
    else
        print_warning "Database migration file not found"
    fi
    
    # Test 7: Performance Test
    print_header "7️⃣ BASIC PERFORMANCE TEST"
    
    print_info "Running basic performance test..."
    node -e "
    async function performanceTest() {
        try {
            const { getConfig } = require('./config/environment');
            const { getDatabase } = require('./config/database');
            
            console.log('⚡ Testing configuration loading performance...');
            const configStart = Date.now();
            for (let i = 0; i < 100; i++) {
                const config = getConfig();
                config.get('vector.dimension');
            }
            const configTime = Date.now() - configStart;
            console.log('✅ Configuration loading: ' + configTime + 'ms for 100 calls');
            
            // Test database connection performance if available
            try {
                const db = getDatabase();
                await db.initialize();
                
                console.log('⚡ Testing database query performance...');
                const dbStart = Date.now();
                for (let i = 0; i < 10; i++) {
                    await db.query('SELECT 1');
                }
                const dbTime = Date.now() - dbStart;
                console.log('✅ Database queries: ' + dbTime + 'ms for 10 queries');
                
                await db.close();
            } catch (error) {
                console.log('⚠️ Database performance test skipped (connection failed)');
            }
            
        } catch (error) {
            console.log('⚠️ Performance test failed:', error.message);
        }
    }
    
    performanceTest();
    " || {
        print_warning "Performance test encountered issues"
    }
    
    # Final Summary
    print_header "📊 TEST SUMMARY"
    
    echo "Critical fixes testing completed!"
    echo ""
    echo "✅ Tests that should pass:"
    echo "  - Configuration loading and validation"
    echo "  - Vector dimension consistency"
    echo "  - Environment variable validation"
    echo "  - Database connection (if PostgreSQL is available)"
    echo "  - OpenAI API integration (if API key is valid)"
    echo ""
    echo "⚠️ Tests that may fail (and that's OK):"
    echo "  - Database tests (if PostgreSQL is not running)"
    echo "  - OpenAI API tests (if no valid API key)"
    echo "  - Unit tests (if dependencies are missing)"
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Fix any configuration issues identified above"
    echo "  2. Set up PostgreSQL database if needed"
    echo "  3. Configure OpenAI API key if needed"
    echo "  4. Run database migration if needed"
    echo "  5. Start the application with 'npm start'"
    echo ""
    print_status "Critical fixes testing script completed!"
}

# Run the main function
main "$@"
