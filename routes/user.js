const express = require('express');
const sha1 = require('sha1');

module.exports = function(db) {
  const router = express.Router();

  //Helper: check if logged in
  const requireLogin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/user/login');
    next();
  };

  //Render forms
  router.get('/register', (req, res) => res.render('register', { messages: req.flash('error'), formData: {} }));
  router.get('/login', (req, res) => res.render('login', { errors: req.flash('error'), messages: req.flash('success') }));

  //Handle registration
  router.post('/register', (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    if ([username, email, password, address, contact, role].some(f => !f)) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/user/register');
    }
    if (password.length < 8) {
      req.flash('error', 'Password must be at least 8 characters.');
      return res.redirect('/user/register');
    }

    const hashedPassword = sha1(password);

    db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
      if (err) return errorHandler(res, 'Database error', '/user/register');
      if (results.length > 0) {
        req.flash('error', 'Email already registered.');
        return res.redirect('/user/register');
      }

      db.query('INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)',
        [username, email, hashedPassword, address, contact, role],
        (err2) => {
          if (err2) return errorHandler(res, 'Error creating user.', '/user/register');
          req.flash('success', 'Registration successful. Please log in.');
          res.redirect('/user/login');
        });
    });
  });

  //Handle login
  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return flashRedirect(res, 'error', 'Email and password are required.', '/user/login');

    db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, sha1(password)], (err, results) => {
      if (err) return errorHandler(res, 'Database error.', '/user/login');
      if (results.length === 0) return flashRedirect(res, 'error', 'Invalid email or password.', '/user/login');

      req.session.user = results[0];
      res.redirect(req.session.user.role === 'admin' ? '/user/admin' : '/shoes');
    });
  });

  //User Dashboard
router.get('/userdashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/user/login');
  }

  const userId = req.session.user.id;

  const brandSQL = 'SELECT brand, COUNT(*) AS total FROM shoes WHERE user_id = ? GROUP BY brand';
  const dailySQL = 'SELECT DATE(created_at) AS date, COUNT(*) AS total FROM shoes WHERE user_id = ? GROUP BY DATE(created_at)';
  const uploadHistorySQL = `
    SELECT id, model, brand, price, \`condition\`, image_path, created_at 
    FROM shoes 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `;

  db.query(brandSQL, [userId], (err, brandResults) => {
    if (err) return res.status(500).send('Error loading brand chart data');

    db.query(dailySQL, [userId], (err2, dailyResults) => {
      if (err2) return res.status(500).send('Error loading daily chart data');

    db.query(uploadHistorySQL, [userId], (err3, uploadResults) => {
      if (err3) {
        console.error('Upload History Query Error:', err3);
        return res.status(500).send('Error loading upload history: ' + err3.message);
      }

        // ✅ Always render, even if uploadResults is empty
        res.render('userdashboard', {
          user: req.session.user,
          brandData: brandResults,
          dailyData: dailyResults,
          uploadHistory: uploadResults // Can be []
        });
      });
    });
  });
});


  //Admin panel
  router.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Access denied');
  }

  const brandSQL = 'SELECT brand, COUNT(*) AS total FROM shoes GROUP BY brand';
  const dailySQL = 'SELECT DATE(created_at) AS date, COUNT(*) AS total FROM shoes GROUP BY DATE(created_at)';

  db.query(brandSQL, (err, brandResults) => {
    if (err) return res.status(500).send('Error loading chart data');

    db.query(dailySQL, (err2, dailyResults) => {
      if (err2) return res.status(500).send('Error loading chart data');

      res.render('admin', {
        user: req.session.user,
        brandData: brandResults,
        dailyData: dailyResults
      });
    });
  });
});

//Helpers
function errorHandler(res, msg, redirect) {
  console.error(msg);
  req.flash('error', msg);
  res.redirect(redirect);
}
function flashRedirect(res, type, msg, path) {
  req.flash(type, msg);
  res.redirect(path);
}

  return router;
};
