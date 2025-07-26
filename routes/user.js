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

  //Dashboard
  router.get('/dashboard', requireLogin, (req, res) => res.render('dashboard', { user: req.session.user }));

  //Admin panel
  router.get('/admin', requireLogin, (req, res) => {
    if (req.session.user.role !== 'admin') return res.status(403).send('Access denied');
    res.render('admin', { user: req.session.user });
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
