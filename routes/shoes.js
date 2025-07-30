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

    // Middleware to check if user is admin
  function isAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).send('Access denied. Admin only.');
    }
    next();
  }

  // Shoe listing
 router.get('/', isAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  const sql = `
    SELECT shoes.*, users.username 
    FROM shoes
    JOIN users ON shoes.user_id = users.id
    WHERE shoes.user_id != ?
    ORDER BY shoes.created_at DESC
  `;

  db.query(sql, [userId], (err, shoes) => {
    if (err) return res.status(500).send('Database error');

    // ✅ Get all brands and sizes for filter dropdowns
    db.query('SELECT DISTINCT brand FROM shoes ORDER BY brand ASC', (err2, brandResults) => {
      if (err2) return res.status(500).send('Database error');

      db.query('SELECT DISTINCT size FROM shoes ORDER BY size ASC', (err3, sizeResults) => {
        if (err3) return res.status(500).send('Database error');

        res.render('index', { 
          shoes, 
          brands: brandResults,
          sizes: sizeResults.map(row => row.size),
          searchTerm: '',
          selectedBrand: 'All',
          selectedCondition: 'All',
          selectedSize: 'All'
        });
      });
    });
  });
});

// ChatGPT prompt (Hydhir): create a get and post route for favourites in shoes.js
// ChatGPT prompt (Hydhir): is there a way where i dont have to create the favourites table in the database
router.get('/favourites', isAuthenticated, (req, res) => {
  const favouriteIds = req.session.favourites || [];

  if (favouriteIds.length === 0) {
    return res.render('favourites', { shoes: [] });
  }

  const placeholders = favouriteIds.map(() => '?').join(',');

  const sql = `
    SELECT shoes.*, users.username
    FROM shoes
    JOIN users ON shoes.user_id = users.id
    WHERE shoes.id IN (${placeholders})
  `;

  db.query(sql, favouriteIds, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error fetching favourites');
    }
    res.render('favourites', { shoes: results });
  });
});

router.post('/favourites/add/:id', isAuthenticated, (req, res) => {
  const shoeId = parseInt(req.params.id);

  if (!req.session.favourites) {
    req.session.favourites = [];
  }
  
  if (!req.session.favourites.includes(shoeId)) {
    req.session.favourites.push(shoeId);
  }

  res.redirect('/shoes/favourites');
});
  
  //search functionality
router.get('/search', (req, res) => {
  const { query, brand, condition, size } = req.query;

  let sql = `
    SELECT shoes.*, users.username FROM shoes
    JOIN users ON shoes.user_id = users.id
    WHERE 1=1
  `;
  const params = [];

  if (query && query.trim() !== '') {
    sql += ` AND (shoes.brand LIKE ? OR shoes.model LIKE ? OR shoes.description LIKE ?)`;
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (brand && brand !== 'All') {
    sql += ` AND shoes.brand = ?`;
    params.push(brand);
  }
  if (condition && condition !== 'All') {
    sql += ` AND shoes.condition = ?`;
    params.push(condition);
  }
  if (size && size !== 'All') {
    sql += ` AND shoes.size = ?`;
    params.push(size);
  }

  db.query(sql, params, (err, shoes) => {
    if (err) throw err;

    db.query('SELECT DISTINCT brand FROM shoes ORDER BY brand ASC', (err2, brandResults) => {
      if (err2) throw err2;

      db.query('SELECT DISTINCT size FROM shoes ORDER BY size ASC', (err3, sizeResults) => {
        if (err3) throw err3;

        res.render('index', {
          shoes,
          searchTerm: query || '',
          selectedBrand: brand || 'All',
          selectedCondition: condition || 'All',
          selectedSize: size || 'All',
          brands: brandResults,
          sizes: sizeResults.map(row => row.size)
        });
      });
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

    // Server-side validation
    if (!brand || !model || !description || !size || !condition || !price) {
      return res.status(400).send('All fields except image are required.');
    }

    if (condition.trim() === '') {
      return res.status(400).send('Condition must be selected.');
    }

    if (isNaN(size) || size < 1 || size > 20) {
      return res.status(400).send('Size must be between 1 and 20.');
    }

    if (isNaN(price) || price <= 0) {
      return res.status(400).send('Price must be a positive number.');
    } 

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
    const { id } = req.params;
    const { brand, model, description, size, condition, price } = req.body;
    const user = req.session.user;

    // Check ownership OR admin
    const checkSql = user.role === 'admin'
      ? 'SELECT * FROM shoes WHERE id = ?'
      : 'SELECT * FROM shoes WHERE id = ? AND user_id = ?';
    const checkParams = user.role === 'admin' ? [id] : [id, user.id];

    db.query(checkSql, checkParams, (err, results) => {
      if (err) return res.status(500).send('Database error');
      if (results.length === 0) return res.status(403).send('Unauthorized or sneaker not found');

      // Prepare update query
      let sql = `
        UPDATE shoes SET brand=?, model=?, description=?, size=?, \`condition\`=?, price=?`;
      const params = [brand, model, description, size, condition, price];

      if (req.file) {
        sql += ', image_path=?';
        params.push(`/uploads/${req.file.filename}`);
      }

      sql += ' WHERE id=?';
      params.push(id);

      if (user.role !== 'admin') {
        sql += ' AND user_id=?';
        params.push(user.id);
      }

      db.query(sql, params, (err2) => {
        if (err2) return res.status(500).send('Error updating sneaker');
        req.flash('success', 'Sneaker updated successfully!');
        res.redirect('/shoes');
      });
    });
  });


  //Delete sneaker (Admin OR Owner can delete)
  router.post('/deleteSneaker/:id', isAuthenticated, (req, res) => {
    const sneakerId = req.params.id;
    const user = req.session.user;

    // If admin -> can delete any sneaker
    // If normal user -> can delete only their own
    let sql, params;
    if (user.role === 'admin') {
      sql = 'DELETE FROM shoes WHERE id = ?';
      params = [sneakerId];
    } else {
      sql = 'DELETE FROM shoes WHERE id = ? AND user_id = ?';
      params = [sneakerId, user.id];
    }

    db.query(sql, params, (err, result) => {
      if (err) return res.status(500).send('Database error during delete');
      if (result.affectedRows === 0) {
        return res.status(403).send('Unauthorized to delete this sneaker');
      }
      req.flash('success', 'Sneaker deleted successfully!');
      res.redirect('/shoes');
    });
  });

  /*Cart Part*/
  // Add to cart
  router.post('/cart/add/:id', isAuthenticated, (req, res) => {
    const shoeId = parseInt(req.params.id);

    // Fetch shoe details from DB
    db.query('SELECT * FROM shoes WHERE id = ?', [shoeId], (err, results) => {
      if (err || results.length === 0) return res.status(500).send('Shoe not found');
      const shoe = results[0];

      if (!req.session.cart) req.session.cart = [];
      // Check if already in cart
      const existingItem = req.session.cart.find(i => i.id === shoeId);
      if (existingItem) {
        existingItem.qty += 1;
        existingItem.subtotal = existingItem.qty * existingItem.price;
      } else {
        req.session.cart.push({
          id: shoe.id,
          model: shoe.model,
          brand: shoe.brand,
          price: parseFloat(shoe.price),
          qty: 1,
          subtotal: parseFloat(shoe.price)
        });
      }
      res.redirect('/shoes');
    });
  });

  router.get('/cart', isAuthenticated, (req, res) => {
    // Ensure cart exists
    if (!req.session.cart) {
      req.session.cart = [];
    }

    const items = req.session.cart;
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    res.render('cart', {
      items: req.session.cart || [],
      total: (req.session.cart || []).reduce((sum, item) => sum + item.subtotal, 0),
    });
  });


  router.post('/cart/delete/:id', isAuthenticated, (req, res) => {
    const shoeId = parseInt(req.params.id);
    if (req.session.cart) {
      req.session.cart = req.session.cart.filter(item => item.id !== shoeId);
    }
    res.redirect('/shoes/cart');
  });


  return router;
};
