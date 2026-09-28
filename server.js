import helmet from 'helmet';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';

// Local routes (Notice the mandatory .js extensions)
import authRoutes from './routes/auth.js';
import personnelRoutes from './routes/personnel.js';
import personnelStatusRoutes from './routes/personnel-status.js';
import personnelEditRoutes from './routes/personnel-edit.js';
import scanRoutes from './routes/scan.js';
import cardRoutes from './routes/cards.js';
import userRoutes from './routes/users.js';
import apiRoutes from './routes/api.js';

// Destructured middleware import
import { requireAuth } from './middleware/auth.js';

import { fileURLToPath } from 'url';

import cookieParser from 'cookie-parser';
import languageSwitchRoutes from './routes/language-switch.js'; 

import i18n from 'i18n';

i18n.configure({
  locales: ['en', 'el'],
  directory: path.join(process.cwd(), 'locales'),
  defaultLocale: 'el',
  cookie: 'lang',           // persists the choice across requests
  queryParameter: 'lang',   // lets ?lang=el switch immediately
  autoReload: true,         // picks up translation file edits without restart (dev convenience)
  updateFiles: false,       // don't let it auto-write new keys into your JSON files
  syncFiles: false
});


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cookieParser());
app.use(i18n.init);
app.use(languageSwitchRoutes);
app.use((req, res, next) => {
  res.locals.locale = req.getLocale();
  next();
});
// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/photos', express.static(path.join(__dirname, 'photos')));

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "default-src": ["'none'"],
      "connect-src": ["'self'", "http://localhost:3000"], 
      
      // Update this line to whitelist the jQuery CDN domain
      "script-src": [
        "'self'", 
        "'unsafe-inline'",
        "https://code.jquery.com"
        ],
      "style-src": ["'self'", "'unsafe-inline'"]
    },
  })
);


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
app.use('/', personnelStatusRoutes);
app.use('/', personnelEditRoutes);
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