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
      const uniqueName = file.originalname;
      cb(null, uniqueName);
    }
  });
  
  const upload = multer({ storage: storage });

  router.get('/addSneakers', (req, res) => {
      res.render('addSneakers');
    });


    // POST form with image upload
  router.post('/addSneakers', upload.single('image'), (req, res) => {
    const { brand, model, description, size, condition, price } = req.body;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = `INSERT INTO shoes (brand, model, description, size, \`condition\`, price, image_path)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;

    console.log('Form data:', req.body);
    console.log('Uploaded file:', req.file);

    db.query(sql, [brand, model, description, size, condition, price, image_path], (err, result) => {
      if (err) {
        console.error('Database error in POST /addSneakers:', err);
        return res.status(500).send(`Database error: ${err.code} - ${err.sqlMessage}`);
      }
      res.redirect('/shoes');
    });
  });


  
  router.get('/', (req, res) => {
    db.query('SELECT * FROM shoes', (err, results) => {
      if (err) throw err;
      res.render('index', { shoes: results });
    });
  });


  return router;
};
