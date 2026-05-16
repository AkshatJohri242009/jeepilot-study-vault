const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));   // Important: serve files from public folder

const DATA_DIR = path.join(__dirname, 'data', 'users');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Get user state
app.get('/api/state', (req, res) => {
  const username = req.query.username || 'akshat';
  const filePath = path.join(DATA_DIR, `${username}.json`);

  if (fs.existsSync(filePath)) {
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } else {
    res.json({
      settings: { name: username, darkMode: false, sidebarCollapsed: false },
      chapters: [],
      exams: [],
      plans: [],
      formulas: []
    });
  }
});

// Save user state
app.post('/api/state', (req, res) => {
  const username = req.query.username || 'akshat';
  const filePath = path.join(DATA_DIR, `${username}.json`);
  
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Studypilot running at http://localhost:${PORT}`);
});
