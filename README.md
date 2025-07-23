
# CA2 - Shoe Finder App

## Overview
This is a simple Express.js web application for managing and browsing shoe listings.  
Users can upload shoe details along with images, and view a catalog of available shoes.

---

## Features
- Add new shoe listings with image upload  
- View all shoes with details and images  
- Uses MySQL database for data storage  
- Session handling and flash messages (setup ready)  
- EJS templating with Bootstrap 5 for UI

---

## Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)  
- [MySQL](https://www.mysql.com/) server installed and running  

---

## Installation

1. Clone the repo  
   ```bash
   git clone <your-repo-url>
   cd ca2
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Setup your MySQL database and tables (see `/db` folder or your SQL scripts).
   Make sure to create the necessary tables (`users`, `shoes`) and set up the `image_path` column.

4. Configure your database connection in `app.js` or relevant config file.

## Running the App

Start the server with:

```bash
node app.js
```

The app will run on `http://localhost:3000` by default (adjust as needed).

---

## Usage

update 

## Notes

* Uploaded images are served statically from `/uploads`.
* File upload handled with `multer`.
* Ensure `public/uploads` exists and is writable.
* Use `express.static` middleware in `app.js` to serve static files.

---

## Dependencies

* [Express](https://expressjs.com/)
* [EJS](https://ejs.co/)
* [MySQL2](https://github.com/sidorares/node-mysql2)
* [Multer](https://github.com/expressjs/multer)
* [Connect-flash](https://github.com/jaredhanson/connect-flash)
* [Express-session](https://github.com/expressjs/session)
---

Would you like me to generate a sample `app.js` or instructions to set up your database connection next?
```
