require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo_db';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/tasks', taskRoutes);

// Database connection & Server initialization
console.log('Connecting to MongoDB...');
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Open http://localhost:${PORT} in your browser to view the application.`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failure:');
    console.error(err.message);
    console.error('\n[WARNING] Please ensure MongoDB is installed and running, or update MONGODB_URI in your .env file.');
    process.exit(1);
  });
