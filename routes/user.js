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
      if (err) return errorHandler(req, res, 'Database error', '/user/register');
      if (results.length > 0) {
        req.flash('error', 'Email already registered.');
        return res.redirect('/user/register');
      }

      db.query('INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)',
        [username, email, hashedPassword, address, contact, role],
        (err2) => {
          if (err2) return errorHandler(req, res, 'Error creating user.', '/user/register');
          req.flash('success', 'Registration successful. Please log in.');
          res.redirect('/user/login');
        });
    });
  });

  //Handle login
  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return flashRedirect(req, res, 'error', 'Email and password are required.', '/user/login');

    db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, sha1(password)], (err, results) => {
      if (err) return errorHandler(req, res, 'Database error.', '/user/login');
      if (results.length === 0) return flashRedirect(req, res, 'error', 'Email or Password is incorrect.', '/user/login');

      req.session.user = results[0];
      res.redirect(req.session.user.role === 'admin' ? '/user/admin' : '/shoes');
    });
  });

  //Enhanced User Dashboard with My Shoes functionality
  router.get('/userdashboard', requireLogin, (req, res) => {
    const userId = req.session.user.id;

    const brandSQL = 'SELECT brand, COUNT(*) AS total FROM shoes WHERE user_id = ? GROUP BY brand';
    const dailySQL = 'SELECT DATE(created_at) AS date, COUNT(*) AS total FROM shoes WHERE user_id = ? GROUP BY DATE(created_at)';
    const uploadHistorySQL = `
      SELECT id, model, brand, price, \`condition\`, image_path, created_at 
      FROM shoes 
      WHERE user_id = ? 
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Get user's favorites
    const favouriteIds = req.session.favourites || [];
    let favouritesQuery = '';
    let favouritesParams = [];
    
    if (favouriteIds.length > 0) {
      const placeholders = favouriteIds.map(() => '?').join(',');
      favouritesQuery = `
        SELECT shoes.*, users.username
        FROM shoes
        JOIN users ON shoes.user_id = users.id
        WHERE shoes.id IN (${placeholders})
        LIMIT 5
      `;
      favouritesParams = favouriteIds;
    }

    // Get cart items count and total value
    const cartItems = req.session.cart || [];
    const cartItemsCount = cartItems.length;
    const cartTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Get total shoes count for user
    const totalShoesSQL = 'SELECT COUNT(*) AS total FROM shoes WHERE user_id = ?';

    db.query(brandSQL, [userId], (err, brandResults) => {
      if (err) return res.status(500).send('Error loading brand chart data');

      db.query(dailySQL, [userId], (err2, dailyResults) => {
        if (err2) return res.status(500).send('Error loading daily chart data');

        db.query(uploadHistorySQL, [userId], (err3, uploadResults) => {
          if (err3) {
            console.error('Upload History Query Error:', err3);
            return res.status(500).send('Error loading upload history: ' + err3.message);
          }

          db.query(totalShoesSQL, [userId], (err4, totalResults) => {
            if (err4) return res.status(500).send('Error loading total shoes count');

            if (favouriteIds.length === 0) {
              // No favorites, render with empty array
              return res.render('userdashboard', {
                user: req.session.user,
                brandData: brandResults,
                dailyData: dailyResults,
                uploadHistory: uploadResults,
                favouriteShoes: [],
                cartItemsCount,
                cartTotal,
                totalShoes: totalResults[0].total,
                successMessages: req.flash('success') || [],
                errorMessages: req.flash('error') || []
              });
            }

            // Get favorites
            db.query(favouritesQuery, favouritesParams, (err5, favouriteResults) => {
              if (err5) {
                console.error('Dashboard favourites error:', err5);
                return res.status(500).send('Error loading favourites');
              }

              res.render('userdashboard', {
                user: req.session.user,
                brandData: brandResults,
                dailyData: dailyResults,
                uploadHistory: uploadResults,
                favouriteShoes: favouriteResults,
                cartItemsCount,
                cartTotal,
                totalShoes: totalResults[0].total,
                successMessages: req.flash('success') || [],
                errorMessages: req.flash('error') || []
              });
            });
          });
        });
      });
    });
  });

  // My Shoes - dedicated page for user's shoes with full management
  router.get('/my-shoes', requireLogin, (req, res) => {
    const userId = req.session.user.id;

    const sql = `
      SELECT shoes.*, users.username 
      FROM shoes
      JOIN users ON shoes.user_id = users.id
      WHERE shoes.user_id = ?
      ORDER BY shoes.created_at DESC
    `;

    db.query(sql, [userId], (err, shoes) => {
      if (err) {
        console.error('My shoes error:', err);
        return res.status(500).send('Database error');
      }

      res.render('my-shoes', {
        shoes,
        user: req.session.user,
        successMessages: req.flash('success') || [],
        errorMessages: req.flash('error') || []
      });
    });
  });

  // Logout route
  router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).send('Error logging out');
      }
      res.redirect('/user/login');
    });
  });

  //Admin panel
  router.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Access denied');
  }

  const brandSQL = 'SELECT brand, COUNT(*) AS total FROM shoes GROUP BY brand';
  const dailySQL = 'SELECT DATE(created_at) AS date, COUNT(*) AS total FROM shoes GROUP BY DATE(created_at)';
  const uploadsSQL = `
    SELECT shoes.*, users.username 
    FROM shoes 
    JOIN users ON shoes.user_id = users.id
    ORDER BY shoes.created_at DESC
  `;

  db.query(brandSQL, (err, brandResults) => {
    if (err) return res.status(500).send('Error loading chart data');

    db.query(dailySQL, (err2, dailyResults) => {
      if (err2) return res.status(500).send('Error loading chart data');

      db.query(uploadsSQL, (err3, uploadsResults) => {
        if (err3) return res.status(500).send('Error loading uploads data');

        res.render('admin', {
          user: req.session.user,
          brandData: brandResults,
          dailyData: dailyResults,
          uploadHistory: uploadsResults
        });
      });
    });
  });
});


  // Helper functions
  function errorHandler(req, res, msg, redirect) {
    console.error(msg);
    req.flash('error', msg);
    res.redirect(redirect);
  }

  function flashRedirect(req, res, type, msg, path) {
    req.flash(type, msg);
    res.redirect(path);
  }

  return router;
};