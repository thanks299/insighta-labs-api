const app = require('./src/app');
const { pool, initDatabase } = require('./src/config/database');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

let retryCount = 0;
const maxRetries = 5;

const startDegradedServer = (message) => {
  console.log('\n⚠️ Could not fully initialize the database. Starting server in degraded mode...');

  if (message) {
    console.log(message);
  }

  app.listen(PORT, () => {
    console.log(`⚠️ Server running but database features are unavailable`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📌 Check http://localhost:${PORT}/health for DB status\n`);
  });
};

const startServer = async () => {
  app.locals.dbReady = false;

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    
    // Initialize tables
    await initDatabase();
    app.locals.dbReady = true;
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running!`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📊 Test: http://localhost:${PORT}/api/profiles`);
      console.log(`🔍 Search: http://localhost:${PORT}/api/profiles/search?q=young males`);
      console.log(`❤️ Health: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    app.locals.dbReady = false;

    const permissionDenied =
      error?.code === '42501' ||
      /permission denied for schema public/i.test(error?.message || '');

    if (permissionDenied) {
      console.error('❌ Database initialization failed: permission denied for schema public');
      console.log('💡 Fix with a PostgreSQL superuser or database owner:');
      console.log(`   GRANT USAGE, CREATE ON SCHEMA public TO ${process.env.DB_USER};`);
      console.log(`   -- If needed, also transfer ownership of the database or schema to ${process.env.DB_USER}`);
      startDegradedServer();
      return;
    }

    console.error(`❌ Database connection failed (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
    
    if (retryCount < maxRetries) {
      retryCount++;
      console.log(`🔄 Retrying in 3 seconds...`);
      setTimeout(startServer, 3000);
    } else {
      startDegradedServer('💡 To fix: verify PostgreSQL is running and check DB credentials/permissions.');
    }
  }
};

startServer();