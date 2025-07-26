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

  // Shoe listing
  router.get('/', (req, res) => {
    db.query('SELECT * FROM shoes', (err, results) => {
      if (err) return res.status(500).send('Database error');
      res.render('index', { shoes: results });
    });
  });
  //search functionality
router.get('/search', (req, res) => {
  const { query = '', filter = 'All' } = req.query;
  let sql = 'SELECT * FROM shoes WHERE 1=1';
  const params = [];

  if (query.trim()) {
    sql += ' AND (brand LIKE ? OR model LIKE ? OR description LIKE ?)';
    const like = `%${query}%`;
    params.push(like, like, like);
  }

  if (filter !== 'All') {
    sql += ' AND brand = ?';
    params.push(filter);
  }

  sql += ' ORDER BY created_at DESC';

  // Run both queries in parallel for better speed
  db.query(sql, params, (err, shoes) => {
    if (err) return res.status(500).send('Database error');
    db.query('SELECT DISTINCT brand FROM shoes', (err2, brands) => {
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
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = `
      INSERT INTO shoes (brand, model, description, size, \`condition\`, price, created_at, image_path)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    `;

    db.query(sql, [brand, model, description, size, condition, price, image_path], (err) => {
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

  return router;
};
