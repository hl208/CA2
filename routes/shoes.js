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

  // Middleware to check if user is authenticated
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
      if (err) {
        console.error('Main listing error:', err);
        return res.status(500).send('Database error');
      }

      db.query('SELECT DISTINCT brand FROM shoes ORDER BY brand ASC', (err2, brandResults) => {
        if (err2) {
          console.error('Brand query error:', err2);
          return res.status(500).send('Database error');
        }

        db.query('SELECT DISTINCT size FROM shoes ORDER BY size ASC', (err3, sizeResults) => {
          if (err3) {
            console.error('Size query error:', err3);
            return res.status(500).send('Database error');
          }

          res.render('index', {
            shoes,
            brands: brandResults,
            sizes: sizeResults.map(row => row.size),
            searchTerm: '',
            selectedBrand: 'All',
            selectedCondition: 'All',
            selectedSize: 'All',
            successMessages: req.flash('success') || [],
            errorMessages: req.flash('error') || []
          });
        });
      });
    });
  });

  // Favourites routes
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
        console.error('Favourites query error:', err);
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

  // Search functionality
  router.get('/search', isAuthenticated, (req, res) => {
    const { query, brand, condition, size } = req.query;
    const userId = req.session.user.id;

    let sql = `
      SELECT shoes.*, users.username FROM shoes
      JOIN users ON shoes.user_id = users.id
      WHERE shoes.user_id != ?
    `;
    const params = [userId];

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

    sql += ` ORDER BY shoes.created_at DESC`;

    db.query(sql, params, (err, shoes) => {
      if (err) {
        console.error('Search query error:', err);
        return res.status(500).send('Database error');
      }

      db.query('SELECT DISTINCT brand FROM shoes ORDER BY brand ASC', (err2, brandResults) => {
        if (err2) {
          console.error('Brand query error:', err2);
          return res.status(500).send('Database error');
        }

        db.query('SELECT DISTINCT size FROM shoes ORDER BY size ASC', (err3, sizeResults) => {
          if (err3) {
            console.error('Size query error:', err3);
            return res.status(500).send('Database error');
          }

          res.render('index', {
            shoes,
            searchTerm: query || '',
            selectedBrand: brand || 'All',
            selectedCondition: condition || 'All',
            selectedSize: size || 'All',
            brands: brandResults,
            sizes: sizeResults.map(row => row.size),
            successMessages: req.flash('success') || [],
            errorMessages: req.flash('error') || []
          });
        });
      });
    });
  });

  // Add sneaker form
  router.get('/addSneakers', isAuthenticated, (req, res) => {
    res.render('addSneakers', { 
      errorMessages: req.flash('error') || [], 
      successMessages: req.flash('success') || []
    });
  });

  // Handle Add Sneaker
  router.post('/addSneakers', isAuthenticated, upload.single('image_path'), (req, res) => {
    const { brand, model, description, size, condition, price } = req.body;
    const userId = req.session.user.id;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    // Validation
    if (!brand || !model || !description || !size || !condition || !price) {
      req.flash('error', 'All fields except image are required.');
      return res.redirect('/shoes/addSneakers');
    }
    if (isNaN(size) || size < 1 || size > 20) {
      req.flash('error', 'Size must be between 1 and 20.');
      return res.redirect('/shoes/addSneakers');
    }
    if (isNaN(price) || price <= 0) {
      req.flash('error', 'Price must be a positive number.');
      return res.redirect('/shoes/addSneakers');
    }

    const sql = `
      INSERT INTO shoes (user_id, brand, model, description, size, \`condition\`, price, created_at, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;

    db.query(sql, [userId, brand, model, description, size, condition, price, image_path], (err) => {
      if (err) {
        console.error('Add sneaker error:', err);
        req.flash('error', 'Database error while adding sneaker.');
        return res.redirect('/shoes/addSneakers');
      }

      req.flash('success', 'Sneaker added successfully!');
      res.redirect('/shoes');
    });
  });

  // View single sneaker
  router.get('/viewSneaker/:id', isAuthenticated, (req, res) => {
    const sql = 'SELECT shoes.*, users.username FROM shoes JOIN users ON shoes.user_id = users.id WHERE shoes.id = ?';
    
    db.query(sql, [req.params.id], (err, results) => {
      if (err) {
        console.error('View sneaker error:', err);
        return res.status(500).send('Error fetching sneaker');
      }
      if (results.length === 0) return res.status(404).send('Sneaker not found');
      res.render('viewSneaker', { shoe: results[0] });
    });
  });

  // Edit sneaker form
  router.get('/editSneaker/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const sneakerId = req.params.id;

    // Allow admin to edit any sneaker, regular users only their own
    const sql = userRole === 'admin' 
      ? 'SELECT * FROM shoes WHERE id = ?' 
      : 'SELECT * FROM shoes WHERE id = ? AND user_id = ?';
    const params = userRole === 'admin' ? [sneakerId] : [sneakerId, userId];

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('Edit sneaker fetch error:', err);
        return res.status(500).send('Database error');
      }
      if (results.length === 0) return res.status(403).send('Unauthorized or sneaker not found');
      
      res.render('editSneaker', { 
        shoe: results[0],
        errorMessages: req.flash('error') || [],
        successMessages: req.flash('success') || []
      });
    });
  });

  // Handle edit sneaker
  router.post('/editSneaker/:id', isAuthenticated, upload.single('image_path'), (req, res) => {
    const { id } = req.params;
    const { brand, model, description, size, condition, price } = req.body;
    const user = req.session.user;

    // Validation
    if (!brand || !model || !description || !size || !condition || !price) {
      req.flash('error', 'All fields except image are required.');
      return res.redirect(`/shoes/editSneaker/${id}`);
    }
    if (isNaN(size) || size < 1 || size > 20) {
      req.flash('error', 'Size must be between 1 and 20.');
      return res.redirect(`/shoes/editSneaker/${id}`);
    }
    if (isNaN(price) || price <= 0) {
      req.flash('error', 'Price must be a positive number.');
      return res.redirect(`/shoes/editSneaker/${id}`);
    }

    // Check ownership OR admin
    const checkSql = user.role === 'admin'
      ? 'SELECT * FROM shoes WHERE id = ?'
      : 'SELECT * FROM shoes WHERE id = ? AND user_id = ?';
    const checkParams = user.role === 'admin' ? [id] : [id, user.id];

    db.query(checkSql, checkParams, (err, results) => {
      if (err) {
        console.error('Edit sneaker check error:', err);
        return res.status(500).send('Database error');
      }
      if (results.length === 0) return res.status(403).send('Unauthorized or sneaker not found');

      // Prepare update query
      let sql = `UPDATE shoes SET brand=?, model=?, description=?, size=?, \`condition\`=?, price=?`;
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
        if (err2) {
          console.error('Edit sneaker update error:', err2);
          req.flash('error', 'Error updating sneaker');
          return res.redirect(`/shoes/editSneaker/${id}`);
        }
        req.flash('success', 'Sneaker updated successfully!');
        res.redirect('/shoes');
      });
    });
  });

  // Delete sneaker (Admin OR Owner can delete)
  router.post('/deleteSneaker/:id', isAuthenticated, (req, res) => {
    const sneakerId = req.params.id;
    const user = req.session.user;

    // If admin -> can delete any sneaker, if normal user -> can delete only their own
    let sql, params;
    if (user.role === 'admin') {
      sql = 'DELETE FROM shoes WHERE id = ?';
      params = [sneakerId];
    } else {
      sql = 'DELETE FROM shoes WHERE id = ? AND user_id = ?';
      params = [sneakerId, user.id];
    }

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('Delete sneaker error:', err);
        return res.status(500).send('Database error during delete');
      }
      if (result.affectedRows === 0) {
        return res.status(403).send('Unauthorized to delete this sneaker');
      }
      req.flash('success', 'Sneaker deleted successfully!');
      res.redirect('/shoes');
    });
  });

  // Cart functionality
  router.post('/cart/add/:id', isAuthenticated, (req, res) => {
    const shoeId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check if user is trying to add their own shoe
    db.query('SELECT * FROM shoes WHERE id = ?', [shoeId], (err, results) => {
      if (err) {
        console.error('Cart add error:', err);
        return res.status(500).send('Database error');
      }
      if (results.length === 0) return res.status(404).send('Shoe not found');
      
      const shoe = results[0];
      
      // Prevent users from adding their own shoes to cart
      if (shoe.user_id === userId) {
        req.flash('error', 'You cannot add your own shoes to cart.');
        return res.redirect('/shoes');
      }

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
      
      req.flash('success', 'Item added to cart successfully!');
      res.redirect('/shoes');
    });
  });

  router.get('/cart', isAuthenticated, (req, res) => {
    if (!req.session.cart) {
      req.session.cart = [];
    }

    const items = req.session.cart;
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    res.render('cart', {
      items,
      total,
      successMessages: req.flash('success') || [],
      errorMessages: req.flash('error') || []
    });
  });

  router.post('/cart/delete/:id', isAuthenticated, (req, res) => {
    const shoeId = parseInt(req.params.id);
    if (req.session.cart) {
      req.session.cart = req.session.cart.filter(item => item.id !== shoeId);
    }
    req.flash('success', 'Item removed from cart.');
    res.redirect('/shoes/cart');
  });

  return router;
};