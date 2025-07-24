const express = require('express');
const sha1 = require('sha1');

module.exports = function(db) {
  const router = express.Router();

  // Render registration form
  router.get('/register', (req, res) => {
    res.render('register', {
      messages: req.flash('error'),
      formData: {}
    });
  });

  // Handle registration
  router.post('/register', (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/user/register');
    }

    if (password.length < 8) {
      req.flash('error', 'Password must be at least 8 characters.');
      return res.redirect('/user/register');
    }

    const hashedPassword = sha1(password);

    const checkSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkSql, [email], (err, results) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error');
        return res.redirect('/user/register');
      }

      if (results.length > 0) {
        req.flash('error', 'Email already registered.');
        return res.redirect('/user/register');
      }

      const insertSql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)';
      db.query(insertSql, [username, email, hashedPassword, address, contact, role], (err2, result2) => {
        if (err2) {
          console.error(err2);
          req.flash('error', 'Error creating user.');
          return res.redirect('/user/register');
        }

        req.flash('success', 'Registration successful. Please log in.');
        res.redirect('/user/login');
      });
    });
  });

  // Render login form
  router.get('/login', (req, res) => {
    res.render('login', {
      errors: req.flash('error'),
      messages: req.flash('success')
    });
  });

  // Handle login
  router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error', 'Email and password are required.');
      return res.redirect('/user/login');
    }

    const hashedPassword = sha1(password);
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';

    db.query(sql, [email, hashedPassword], (err, results) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error.');
        return res.redirect('/user/login');
      }

      if (results.length === 0) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/user/login');
      }

      req.session.user = results[0]; // store user info in session
      res.redirect('/dashboard');
    });
  });

  // Dashboard route (after login)
  router.get('/dashboard', (req, res) => {
    if (!req.session.user) {
      return res.redirect('/user/login');
    }

    res.render('dashboard', { user: req.session.user });
  });

  // Admin panel (optional)
  router.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).send('Access denied');
    }

    res.render('admin', { user: req.session.user });
  });

  // Logout
  router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/user/login');
    });
  });

  return router;
};
