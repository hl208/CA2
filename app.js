const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash'); // Importing connect-flash for flash message
const path = require('path');

const app = express();

// Use a connection pool instead of single connection
const db = mysql.createPool({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_24017721_shoedb',
    port: 3306,
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

app.use(express.static(path.join(__dirname, 'public')));
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
    res.redirect('/shoes');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/user/login');
  }
  res.render('dashboard', { user: req.session.user });
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
