import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import operatorRoutes from './routes/operator.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

// Set Gmail credentials for testing
process.env.GMAIL_EMAIL = 'michaelburner595@gmail.com';
process.env.GMAIL_PASSWORD = 'dCdWqhgPzJev6Jz';
console.log('[SERVER] Gmail credentials set for testing');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(join(__dirname, '../frontend')));

// API routes
app.use('/api/operator', operatorRoutes);

// Error handling middleware
app.use(errorHandler);

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Operator server running on http://localhost:${PORT}`);
});