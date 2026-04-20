const express = require('express');
const cors = require('cors');
const profileRoutes = require('./routes/profiles');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api', (req, res, next) => {
  if (req.app.locals.dbReady === false) {
    return res.status(503).json({
      status: 'error',
      message: 'Database is unavailable. Start PostgreSQL and retry.',
    });
  }

  return next();
});

app.use('/api', profileRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: req.app.locals.dbReady === true ? 'up' : 'down',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

module.exports = app;