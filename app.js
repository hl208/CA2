const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash'); // Importing connect-flash for flash message
const path = require('path');
const app = express();

require('dotenv').config();
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Optional: test pool connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to DB pool:', err);
        process.exit(1);
    }
    console.log('Connected to database pool');
    connection.release(); // release back to pool
});

// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true, 
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // expires in 7 days
}));

app.use(flash());

// Add this middleware to make session data available to EJS templates
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

app.use(express.static('public'));
app.set('view engine', 'ejs');

// Import routes, passing db pool
console.log('App starting...');
const shoesRouter = require('./routes/shoes.js')(db);
console.log('Shoes router loaded');
const userRouter = require('./routes/user.js')(db);

// Use routers with prefixes
app.use('/shoes', shoesRouter);
app.use('/user', userRouter);

app.get('/', (req, res) => {
    res.redirect('/user/login'); // Redirect to login page
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/user/login'));
});

app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
