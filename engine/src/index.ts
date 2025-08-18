import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint for Docker health checks
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

// Placeholder endpoints for data generation
app.post('/generate', (_req, res) => {
  res.json({ message: 'Data generation endpoint - coming soon' });
});

app.get('/status/:jobId', (req, res) => {
  res.json({ jobId: req.params.jobId, status: 'pending' });
});

app.get('/dataset/:datasetId', (req, res) => {
  res.json({ datasetId: req.params.datasetId, data: null });
});

app.listen(PORT, () => {
  console.log(`DollarZing Engine running on port ${PORT}`);
});

export default app;