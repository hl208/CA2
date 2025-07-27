const express = require('express');
const multer = require('multer');
const path = require('path');

module.exports = function (db) {
  const router = express.Router();

  // Multer storage config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  });
  const upload = multer({ storage });

  // middleware to check if user is authenticated
  function isAuthenticated(req, res, next) {
    if (!req.session.user) return res.redirect('/user/login');
    next();
  }

  // Shoe listing
  router.get('/', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const sql = `
      SELECT shoes.*, users.username 
      FROM shoes 
      JOIN users ON shoes.user_id = users.id
    `;    
    db.query(sql, [userId], (err, results) => {
      if (err) return res.status(500).send('Database error');
      res.render('index', { shoes: results });
    });
  });
  
  //search functionality
  router.get('/search', isAuthenticated, (req, res) => {
    const { query = '', filter = 'All' } = req.query;
    const userId = req.session.user.id;

    let sql = 'SELECT * FROM shoes WHERE user_id = ?';
    const params = [userId];

    if (query.trim()) {
      sql += ' AND (brand LIKE ? OR model LIKE ? OR description LIKE ?)';
      const like = `%${query}%`;
      params.push(like, like, like);
    }

    if (filter && filter !== 'All') {
      sql += ' AND brand = ?';
      params.push(filter);
    }

    sql += ' ORDER BY created_at DESC';

    console.log("Final SQL:", sql, params); // ✅ Debug log

    db.query(sql, params, (err, shoes) => {
      if (err) return res.status(500).send('Database error');
      db.query('SELECT DISTINCT brand FROM shoes WHERE user_id = ?', [userId], (err2, brands) => {
        if (err2) return res.status(500).send('Database error');
        res.render('index', { shoes, brands, selectedBrand: filter, searchTerm: query });
      });
    });
});


  // Add sneaker form
  router.get('/addSneakers', (req, res) => res.render('addSneakers'));

  // Handle Add Sneaker
  router.post('/addSneakers', upload.single('image_path'), (req, res) => {
    const { brand, model, description, size, condition, price } = req.body;
    const userId = req.session.user.id; 
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

     const sql = `
      INSERT INTO shoes (user_id, brand, model, description, size, \`condition\`, price, created_at, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;

    db.query(sql, [userId, brand, model, description, size, condition, price, image_path], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      req.flash('success', 'Sneaker added successfully!');
      res.redirect('/shoes');
    });
  });

  // View single sneaker
  router.get('/viewSneaker/:id', (req, res) => {
    db.query('SELECT * FROM shoes WHERE id = ?', [req.params.id], (err, results) => {
      if (err) return res.status(500).send('Error fetching sneaker');
      if (results.length === 0) return res.status(404).send('Sneaker not found');
      res.render('viewSneaker', { shoe: results[0] });
    });
  });

  // Only allow authenticated users to edit or delete sneakers
  router.get('/editSneaker/:id', isAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const sneakerId = req.params.id;

  const sql = 'SELECT * FROM shoes WHERE id = ? AND user_id = ?';
  db.query(sql, [sneakerId, userId], (err, results) => {
    if (err) return res.status(500).send('Database error');
    if (results.length === 0) return res.status(403).send('Unauthorized or sneaker not found');
    res.render('editSneaker', { shoe: results[0] });
  });
});

router.post('/editSneaker/:id', isAuthenticated, upload.single('image_path'), (req, res) => {
  const userId = req.session.user.id;
  const sneakerId = req.params.id;
  const { brand, model, description, size, condition, price } = req.body;

  // First, check ownership
  const checkSql = 'SELECT * FROM shoes WHERE id = ? AND user_id = ?';
  db.query(checkSql, [sneakerId, userId], (err, results) => {
    if (err) return res.status(500).send('Database error');
    if (results.length === 0) return res.status(403).send('Unauthorized or sneaker not found');

    // Prepare update query
    let sql = `
      UPDATE shoes SET brand = ?, model = ?, description = ?, size = ?, \`condition\` = ?, price = ?
    `;
    const params = [brand, model, description, size, condition, price];

    if (req.file) {
      sql += ', image_path = ?';
      params.push(`/uploads/${req.file.filename}`);
    }

    sql += ' WHERE id = ? AND user_id = ?';
    params.push(sneakerId, userId);

    db.query(sql, params, (err2) => {
      if (err2) return res.status(500).send('Database error during update');
      req.flash('success', 'Sneaker updated successfully!');
      res.redirect('/shoes');
    });
  });
});


  return router;
};
