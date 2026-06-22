import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import apiRouter from './routes/api.routes';
import { runMigrations } from './db/migrate';

dotenv.config();

// Initialize Database & Tables
try {
  runMigrations();
} catch (e) {
  console.error('Failed to run database migrations:', e);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with Credentials (for HttpOnly cookies)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', apiRouter);

// Basic Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'LabourLink API Service' });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express Error Handler]:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LabourLink API Server is running on port ${PORT}`);
});
