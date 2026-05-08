require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const dataRoutes     = require('./routes/data');
const feedbackRoutes = require('./routes/feedback');

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', dataRoutes);
app.use('/api/feedback', feedbackRoutes);

app.listen(PORT, () => {
  const hostname = require('os').hostname();
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${hostname}:${PORT}`);
});
