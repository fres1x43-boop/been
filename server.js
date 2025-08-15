const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();

// Настройка базы данных SQLite
const db = new sqlite3.Database('./questions.db');

// Создание таблицы для вопросов
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, answer TEXT, ip TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, answered_at DATETIME)");
});

// Настройки Telegram бота
const TELEGRAM_BOT_TOKEN = '8330707341:AAHy0eHvunBQ9wxGZevwwkq95WiKjd3ewhg';
const TELEGRAM_CHAT_ID = '738572327';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Получение всех вопросов
app.get('/questions', (req, res) => {
  db.all("SELECT id, question, answer, created_at, answered_at FROM questions ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Отправка нового вопроса
app.post('/ask', (req, res) => {
  const question = req.body.question;
  const ip = req.ip.replace('::ffff:', ''); // Получение IP

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  db.run("INSERT INTO questions (question, ip) VALUES (?, ?)", [question, ip], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Отправка уведомления в Telegram
    const message = `Новый вопрос (ID: ${this.lastID}):\n${question}\n\nIP: ${ip}`;
    axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    }).catch(error => {
      console.error('Telegram notification error:', error);
    });

    res.json({ success: true, id: this.lastID });
  });
});

// Ответ на вопрос (только для админа)
app.post('/answer', (req, res) => {
  const { id, answer } = req.body;
  const adminToken = req.headers['admin-token'];

  // Простая проверка админа (в реальном приложении нужна более надежная аутентификация)
  if (adminToken !== 'YOUR_SECRET_ADMIN_TOKEN') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!id || !answer) {
    return res.status(400).json({ error: 'ID and answer are required' });
  }

  db.run("UPDATE questions SET answer = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ?", [answer, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
