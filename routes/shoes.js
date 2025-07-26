const express = require('express');
const multer = require('multer');
const path = require('path');

module.exports = function(db) {
  const router = express.Router();

  // Multer storage config
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/uploads');
    },
    filename: function (req, file, cb) {
      const uniqueName = Date.now() + path.extname(file.originalname); // safer unique name
      cb(null, uniqueName);
    }
  });

  const upload = multer({ storage: storage });

  // Shoe listing
  router.get('/', (req, res) => {
    db.query('SELECT * FROM shoes', (err, results) => {
      if (err) {
        console.error('Database error fetching shoes:', err);
        return res.status(500).send('Database error');
      }
      res.render('index', { shoes: results });
    });
  });

  // Add sneaker form
  router.get('/addSneakers', (req, res) => {
    res.render('addSneakers');
  });

  // POST form with image upload
  router.post('/addSneakers', upload.single('image'), (req, res) => {
    if (!req.body) return res.status(400).send('No form data received');
    console.log('POST /addSneakers reached');

    const { brand, model, description, size, condition, price, created_at } = req.body;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = `INSERT INTO shoes (brand, model, description, size, \`condition\`, price, created_at, image_path)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`;

    console.log('Form data:', req.body);
    console.log('Uploaded file:', req.file);

    db.query(sql, [brand, model, description, size, condition, price, created_at, image_path], (err, result) => {
      if (err) {
        console.error('Database error in POST /addSneakers:', err);
        return res.status(500).send(`Database error: ${err.code} - ${err.sqlMessage}`);
      }
      console.log('Sneaker added successfully:', result);
      req.flash('success', 'Sneaker added successfully!');
      res.redirect('/shoes');
    });
  });

  // View single sneaker
  router.get('/viewSneaker/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM shoes WHERE id = ?';

    db.query(sql, [id], (error, results) => {
      if (error) {
        console.error('Error fetching shoes:', error);
        return res.status(500).send('Error fetching shoes');
      }
      if (results.length > 0) {
        res.render('viewSneaker', { shoe: results[0] });
      } else {
        res.status(404).send('Sneaker not found');
      }
    });
  });

  return router;
};
