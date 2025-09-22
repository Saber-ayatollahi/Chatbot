const axios = require('axios');

async function testFullSystem() {
  const baseURL = 'http://localhost:5000';
  
  try {
    console.log('🧪 Testing Full RAG System Integration');
    console.log('=' .repeat(50));
    
    // Test health endpoint
    console.log('\n1️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get(`${baseURL}/health`);
      console.log('✅ Server is healthy');
    } catch (error) {
      console.log('❌ Health check failed, but continuing...');
    }
    
    // Test chat endpoint with our processed data
    console.log('\n2️⃣ Testing chat endpoint...');
    const testQueries = [
      'What types of funds are available?',
      'How do I create a new fund?',
      'What is Fund Manager?'
    ];
    
    for (const query of testQueries) {
      try {
        console.log(`\n❓ Query: "${query}"`);
        
        const chatResponse = await axios.post(`${baseURL}/api/chat`, {
          message: query,
          sessionId: 'test-session-' + Date.now()
        }, {
          timeout: 10000
        });
        
        if (chatResponse.data && chatResponse.data.message) {
          console.log('✅ Response received:');
          console.log(`📝 Message: ${chatResponse.data.message.substring(0, 200)}...`);
          console.log(`🔗 Citations: ${chatResponse.data.citations?.length || 0}`);
          console.log(`📊 Confidence: ${((chatResponse.data.confidence || 0) * 100).toFixed(1)}%`);
          console.log(`⏱️ Response time: ${chatResponse.data.totalProcessingTime || 'N/A'}ms`);
        } else {
          console.log('❌ Invalid response format');
        }
        
      } catch (error) {
        console.log(`❌ Query failed: ${error.message}`);
        if (error.response?.data) {
          console.log(`   Error details: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
    
    console.log('\n🎉 Full system test completed!');
    
  } catch (error) {
    console.error('❌ System test failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  testFullSystem();
}

module.exports = testFullSystem;
