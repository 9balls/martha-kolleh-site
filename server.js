require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'site-data.json');
const GALLERY_DIR = path.join(__dirname, 'public', 'uploads', 'gallery');
const REELS_DIR = path.join(__dirname, 'public', 'uploads', 'reels');

// ---------- Data helpers ----------
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- Middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 hour login session
      // secure: true, // uncomment once the site is served over HTTPS
    },
  })
);

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.redirect('/admin/login');
}

// ---------- File uploads ----------
const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, GALLERY_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `photo-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, or WEBP images are allowed.'), ok);
  },
});

const reelUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, REELS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `reel-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
  fileFilter: (req, file, cb) => {
    const ok = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype);
    cb(ok ? null : new Error('Only MP4, WEBM, or MOV videos are allowed.'), ok);
  },
});

// =====================================================================
// PUBLIC SITE
// =====================================================================
app.get('/', (req, res) => {
  const data = readData();
  res.render('index', { data, siteUrl: process.env.SITE_URL || '' });
});

// =====================================================================
// ADMIN — AUTH
// =====================================================================
app.get('/admin/login', (req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = username === process.env.ADMIN_USERNAME;
  const hash = process.env.ADMIN_PASSWORD_HASH || '';
  const validPass = hash && bcrypt.compareSync(password || '', hash);

  if (validUser && validPass) {
    req.session.loggedIn = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Incorrect username or password.' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// =====================================================================
// ADMIN — DASHBOARD
// =====================================================================
app.get('/admin', requireLogin, (req, res) => {
  const data = readData();
  res.render('admin/dashboard', { data, saved: req.query.saved || null });
});

app.get('/admin/backup', requireLogin, (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="martha-kolleh-backup.zip"');
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => { throw err; });
  archive.pipe(res);

  archive.append(JSON.stringify(readData(), null, 2), { name: 'site-data.json' });

  if (fs.existsSync(GALLERY_DIR)) {
    archive.directory(GALLERY_DIR, 'uploads/gallery');
  }
  if (fs.existsSync(REELS_DIR)) {
    archive.directory(REELS_DIR, 'uploads/reels');
  }

  archive.finalize();
});

// ---- Bio ----
app.post('/admin/bio', requireLogin, (req, res) => {
  const data = readData();
  const b = req.body;
  data.bio.fullName = b.fullName || data.bio.fullName;
  data.bio.positions = (b.positions || '').split(',').map((s) => s.trim()).filter(Boolean);
  data.bio.dateOfBirth = b.dateOfBirth || '';
  data.bio.placeOfBirth = b.placeOfBirth || '';
  data.bio.countyOfOrigin = b.countyOfOrigin || '';
  data.bio.nationality = b.nationality || '';
  data.bio.height = b.height || '';
  data.bio.jerseyNumber = b.jerseyNumber || '';
  data.bio.preferredFoot = b.preferredFoot || '';
  data.bio.currentClub = b.currentClub || '';
  data.bio.contractLength = b.contractLength || '';
  data.bio.summary = b.summary || '';
  writeData(data);
  res.redirect('/admin?saved=bio');
});

// ---- National team ----
app.post('/admin/national-team', requireLogin, (req, res) => {
  const data = readData();
  data.nationalTeam = {
    caps: req.body.caps || '',
    debut: req.body.debut || '',
    goals: req.body.goals || '',
    note: req.body.note || '',
  };
  writeData(data);
  res.redirect('/admin?saved=national');
});

// ---- Contact ----
app.post('/admin/contact', requireLogin, (req, res) => {
  const data = readData();
  data.contact = {
    email: req.body.email || '',
    whatsapp: req.body.whatsapp || '',
    basedIn: req.body.basedIn || '',
  };
  writeData(data);
  res.redirect('/admin?saved=contact');
});

// ---- Helper: move an array item up or down ----
function moveItem(arr, index, direction) {
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= arr.length) return;
  [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
}

// ---- Career timeline ----
app.post('/admin/career/add', requireLogin, (req, res) => {
  const data = readData();
  data.career.forEach((c) => (c.current = false));
  data.career.push({
    title: req.body.title || '',
    note: req.body.note || '',
    current: req.body.current === 'on',
  });
  writeData(data);
  res.redirect('/admin?saved=career');
});

app.post('/admin/career/delete/:index', requireLogin, (req, res) => {
  const data = readData();
  data.career.splice(Number(req.params.index), 1);
  writeData(data);
  res.redirect('/admin?saved=career');
});

app.post('/admin/career/move/:index/:direction', requireLogin, (req, res) => {
  const data = readData();
  moveItem(data.career, Number(req.params.index), req.params.direction);
  writeData(data);
  res.redirect('/admin?saved=career');
});

app.post('/admin/career/set-current/:index', requireLogin, (req, res) => {
  const data = readData();
  data.career.forEach((c, i) => (c.current = i === Number(req.params.index)));
  writeData(data);
  res.redirect('/admin?saved=career');
});

// ---- Stats table ----
app.post('/admin/stats/add', requireLogin, (req, res) => {
  const data = readData();
  data.stats.push({
    season: req.body.season || '',
    club: req.body.club || '',
    competition: req.body.competition || '',
    apps: req.body.apps || '',
    goals: req.body.goals || '',
    assists: req.body.assists || '',
    cleanSheets: req.body.cleanSheets || '',
  });
  writeData(data);
  res.redirect('/admin?saved=stats');
});

app.post('/admin/stats/delete/:index', requireLogin, (req, res) => {
  const data = readData();
  data.stats.splice(Number(req.params.index), 1);
  writeData(data);
  res.redirect('/admin?saved=stats');
});

app.post('/admin/stats/move/:index/:direction', requireLogin, (req, res) => {
  const data = readData();
  moveItem(data.stats, Number(req.params.index), req.params.direction);
  writeData(data);
  res.redirect('/admin?saved=stats');
});



// ---- Gallery ----
app.post('/admin/gallery/upload', requireLogin, (req, res) => {
  galleryUpload.single('photo')(req, res, (err) => {
    if (err) return res.render('admin/dashboard', { data: readData(), saved: null, uploadError: err.message });
    const data = readData();
    if (req.file) {
      data.gallery.push({
        filename: req.file.filename,
        alt: req.body.alt || `Martha Kolleh — match photo`,
      });
      writeData(data);
    }
    res.redirect('/admin?saved=gallery');
  });
});

app.post('/admin/gallery/delete/:index', requireLogin, (req, res) => {
  const data = readData();
  const item = data.gallery[Number(req.params.index)];
  if (item) {
    const filePath = path.join(GALLERY_DIR, item.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    data.gallery.splice(Number(req.params.index), 1);
    writeData(data);
  }
  res.redirect('/admin?saved=gallery');
});

// ---- Reels (uploaded video OR external link) ----
app.post('/admin/reels/upload', requireLogin, (req, res) => {
  reelUpload.single('reelFile')(req, res, (err) => {
    if (err) return res.render('admin/dashboard', { data: readData(), saved: null, uploadError: err.message });
    const data = readData();
    if (req.file) {
      data.reels.push({
        type: 'upload',
        src: req.file.filename,
        caption: req.body.caption || '',
      });
      writeData(data);
    }
    res.redirect('/admin?saved=reels');
  });
});

app.post('/admin/reels/link', requireLogin, (req, res) => {
  const data = readData();
  if (req.body.url) {
    data.reels.push({
      type: 'link',
      src: req.body.url,
      caption: req.body.caption || '',
    });
    writeData(data);
  }
  res.redirect('/admin?saved=reels');
});

app.post('/admin/reels/delete/:index', requireLogin, (req, res) => {
  const data = readData();
  const item = data.reels[Number(req.params.index)];
  if (item && item.type === 'upload') {
    const filePath = path.join(REELS_DIR, item.src);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  data.reels.splice(Number(req.params.index), 1);
  writeData(data);
  res.redirect('/admin?saved=reels');
});

// =====================================================================
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\n\nSitemap: ${process.env.SITE_URL || ''}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${
      process.env.SITE_URL || ''
    }/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`
  );
});

app.listen(PORT, () => {
  console.log(`Martha Kolleh site running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
});
