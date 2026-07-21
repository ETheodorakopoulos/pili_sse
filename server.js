require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const personnelRoutes = require('./routes/personnel');
const scanRoutes = require('./routes/scan');
const cardRoutes = require('./routes/cards');
const userRoutes = require('./routes/users');
const apiRoutes = require('./routes/api');

const { requireAuth } = require('./middleware/auth');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// Make user info available to all EJS templates
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role
  } : null;
  res.locals.req = req;
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/', personnelRoutes);
app.use('/', scanRoutes);
app.use('/', cardRoutes);
app.use('/', userRoutes);
app.use('/api', apiRoutes);

// Root — redirect to scan page (page 1) or login
app.get('/', requireAuth, (req, res) => {
  res.redirect('/scan');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Facility Entrance App running on http://localhost:${PORT}`);
});