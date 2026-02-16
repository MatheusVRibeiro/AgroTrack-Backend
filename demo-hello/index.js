const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

app.get('/', (req, res) => res.send('OK'));
app.get('/health', (req, res) => res.json({ success: true, timestamp: new Date().toISOString() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo server running on port ${PORT}`);
});
