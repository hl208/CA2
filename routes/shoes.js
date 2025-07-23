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

    // POST form with image upload
  router.post('/addShoe', upload.single('image'), (req, res) => {
    const { user_id, brand, model, size, condition, description, price } = req.body;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = `INSERT INTO shoes (user_id, brand, model, size, \`condition\`, description, price, image_path)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [user_id, brand, model, size, condition, description, price, image_path], (err) => {
      if (err) throw err;
      res.redirect('/');
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
