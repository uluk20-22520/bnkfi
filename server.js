const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

function sanitizeText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeApplication(body) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    fullName: sanitizeText(body.fullName, 140),
    phone: sanitizeText(body.phone, 40),
    loanType: sanitizeText(body.loanType, 80),
    amount: Number(String(body.amount || '').replace(/\D/g, '')) || 0,
    city: sanitizeText(body.city, 80),
    comment: sanitizeText(body.comment, 300),
    source: 'site'
  };
  return item;
}

function validateApplication(item) {
  const errors = [];
  if (item.fullName.length < 3) errors.push('fullName');
  if (!/^\+?\d|[()\-\s]+/.test(item.phone) || item.phone.length < 9) errors.push('phone');
  if (!item.loanType) errors.push('loanType');
  if (item.amount < 1000) errors.push('amount');
  return errors;
}

async function readApplications() {
  await ensureStorage();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeApplications(items) {
  await ensureStorage();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

app.post('/api/applications', async (req, res) => {
  try {
    const item = normalizeApplication(req.body);
    const errors = validateApplication(item);
    if (errors.length) {
      return res.status(400).json({ error: 'Invalid application', fields: errors });
    }
    const items = await readApplications();
    items.unshift(item);
    await writeApplications(items.slice(0, 1000));
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/applications', async (req, res) => {
  if (req.query.token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Wrong ADMIN_TOKEN' });
  }
  try {
    const items = await readApplications();
    return res.json({ items });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, async () => {
  await ensureStorage();
  console.log(`BNK Finance site: http://localhost:${PORT}`);
});
