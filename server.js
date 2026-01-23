const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- DATABASE CONFIGURATION ---
// REPLACE these values with your actual MySQL Workbench credentials
const dbConfig = {
    host: 'localhost',
    user: 'root',      // Your MySQL username
    password: 'Dhanush2122@',  // Your MySQL password
    // database: 'techb_projects' // We will select/create this dynamically below
};

// Create a connection (initially without database selected to create it if missing)
const connection = mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password
});

// Initialize Database and Table
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL Server:', err);
        console.log('NOTE: Please ensure MySQL is running and credentials in server.js are correct.');
        return;
    }
    console.log('Connected to MySQL Server.');

    // Create Database if it doesn't exist
    connection.query(`CREATE DATABASE IF NOT EXISTS techb_projects`, (err) => {
        if (err) console.error('Error creating database:', err);
        else {
            console.log('Database "techb_projects" checked/created.');

            // Switch to the database
            connection.changeUser({ database: 'techb_projects' }, (err) => {
                if (err) {
                    console.error('Error switching to database:', err);
                    return;
                }

                // Create Contacts Table
                const createTableQuery = `
                    CREATE TABLE IF NOT EXISTS contacts (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                connection.query(createTableQuery, (err) => {
                    if (err) console.error('Error creating table:', err);
                    else console.log('Table "contacts" checked/created.');
                });
            });
        }
    });
});

// --- FRONTEND (HTML/CSS/JS) ---
const getHtml = (message = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TechB Projects</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Poppins:wght@300;400;600&display=swap');

        :root {
            --neon-blue: #00f3ff;
            --neon-green: #39ff14;
            --bg-dark: #02020a;
            --card-bg: rgba(255, 255, 255, 0.05);
            --text-main: #ffffff;
            --text-dim: #a0a0a0;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(0, 243, 255, 0.1) 0%, transparent 20%),
                radial-gradient(circle at 90% 80%, rgba(57, 255, 20, 0.1) 0%, transparent 20%);
        }

        /* --- Animations --- */
        @keyframes glow {
            0% { text-shadow: 0 0 5px var(--neon-blue); }
            50% { text-shadow: 0 0 20px var(--neon-blue), 0 0 30px var(--neon-blue); }
            100% { text-shadow: 0 0 5px var(--neon-blue); }
        }

        @keyframes border-pulse {
            0% { box-shadow: 0 0 5px var(--neon-green); }
            50% { box-shadow: 0 0 15px var(--neon-green); }
            100% { box-shadow: 0 0 5px var(--neon-green); }
        }

        @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
        }

        .container {
            width: 90%;
            max-width: 1200px;
            margin: 0 auto;
            text-align: center;
            padding-top: 50px;
            flex: 1;
        }

        /* --- Header Section --- */
        h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 4rem;
            color: var(--neon-blue);
            margin-bottom: 2rem;
            text-transform: uppercase;
            animation: glow 3s infinite alternate;
            line-height: 1;
        }

        .subtitle {
            font-size: 1.2rem;
            color: var(--text-main);
            margin-bottom: 3rem;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }

        /* --- Promo Box --- */
        .promo-box {
            display: inline-block;
            background: rgba(57, 255, 20, 0.1);
            border: 2px solid var(--neon-green);
            color: var(--neon-green);
            padding: 15px 40px;
            border-radius: 50px;
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 4rem;
            box-shadow: 0 0 15px rgba(57, 255, 20, 0.3);
            text-shadow: 0 0 5px rgba(57, 255, 20, 0.5);
            transition: all 0.3s ease;
            cursor: pointer;
            animation: border-pulse 2s infinite;
        }

        .promo-box:hover {
            background: var(--neon-green);
            color: black;
            text-shadow: none;
            box-shadow: 0 0 30px var(--neon-green);
        }

        /* --- Icons Grid --- */
        .icons-grid {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 40px;
            margin-bottom: 4rem;
        }

        .icon-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            animation: float 6s ease-in-out infinite;
        }
        
        /* Stagger animations */
        .icon-item:nth-child(2) { animation-delay: 1s; }
        .icon-item:nth-child(3) { animation-delay: 2s; }
        .icon-item:nth-child(4) { animation-delay: 3s; }
        .icon-item:nth-child(5) { animation-delay: 4s; }

        .icon-circle {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            margin-bottom: 15px;
            transition: transform 0.3s;
        }

        .icon-item:hover .icon-circle {
            transform: scale(1.1);
        }

        /* Specific Icon Colors based on image roughly */
        .py-icon { border: 2px solid #ffd700; color: #ffd700; box-shadow: 0 0 10px #ffd700; }
        .react-icon { border: 2px solid #61dafb; color: #61dafb; box-shadow: 0 0 10px #61dafb; }
        .network-icon { border: 2px solid #00f3ff; color: #00f3ff; box-shadow: 0 0 10px #00f3ff; }
        .web-icon { border: 2px solid #ffffff; color: #ffffff; box-shadow: 0 0 10px #ffffff; }
        .db-icon { border: 2px solid #39ff14; color: #39ff14; box-shadow: 0 0 10px #39ff14; }

        .icon-label {
            font-size: 0.9rem;
            color: var(--neon-blue);
            font-weight: 600;
        }

        /* --- Contact Form --- */
        .form-section {
            background: var(--card-bg);
            padding: 40px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            max-width: 600px;
            margin: 0 auto 4rem auto;
            backdrop-filter: blur(10px);
        }

        .form-section h2 {
            color: var(--neon-blue);
            margin-bottom: 20px;
            font-family: 'Orbitron', sans-serif;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-dim);
        }

        .form-control {
            width: 100%;
            padding: 12px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid var(--neon-blue);
            border-radius: 8px;
            color: white;
            font-family: 'Poppins', sans-serif;
        }
        
        .form-control:focus {
            outline: none;
            box-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
        }

        button[type="submit"] {
            background: transparent;
            color: var(--neon-blue);
            border: 2px solid var(--neon-blue);
            padding: 12px 30px;
            font-size: 1rem;
            font-weight: bold;
            border-radius: 5px;
            cursor: pointer;
            transition: 0.3s;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-family: 'Orbitron', sans-serif;
        }

        button[type="submit"]:hover {
            background: var(--neon-blue);
            color: black;
            box-shadow: 0 0 20px var(--neon-blue);
        }

        .alert {
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 5px;
            background: rgba(57, 255, 20, 0.2);
            color: var(--neon-green);
            border: 1px solid var(--neon-green);
        }

        /* --- Footer --- */
        footer {
            padding: 20px;
            border-top: 1px solid rgba(0, 243, 255, 0.2);
            font-size: 1.2rem;
            color: var(--neon-blue);
            margin-top: auto;
        }
        
        .whatsapp-icon {
            display: inline-block;
            vertical-align: middle;
            margin-right: 10px;
            font-size: 1.5rem;
        }

    </style>
</head>
<body>

    <div class="container">
        <!-- Header -->
        <h1>TechB Projects</h1>
        
        <div class="subtitle">
            All Python, React, MERN, AI & ML Projects:<br>
            All Final Year & Mini Projects are done
        </div>

        <!-- Promo -->
        <div class="promo-box">
            Refer & Live Earn<br>
            ₹ 500 Discount
        </div>

        <!-- Tech Stack Icons -->
        <div class="icons-grid">
            <div class="icon-item">
                <div class="icon-circle py-icon">Py</div>
                <div class="icon-label">AI Python</div>
            </div>
            <div class="icon-item">
                <div class="icon-circle react-icon">Re</div>
                <div class="icon-label">AI React</div>
            </div>
            <div class="icon-item">
                <div class="icon-circle network-icon">Net</div>
                <div class="icon-label">Network</div>
            </div>
            <div class="icon-item">
                <div class="icon-circle web-icon">Web</div>
                <div class="icon-label">Web App</div>
            </div>
            <div class="icon-item">
                <div class="icon-circle db-icon">DB</div>
                <div class="icon-label">Database</div>
            </div>
        </div>

        <!-- Contact Form -->
        <div class="form-section">
            <h2>Start Your Project</h2>
            ${message ? `<div class="alert">${message}</div>` : ''}
            <form action="/contact" method="POST">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" class="form-control" required placeholder="Enter your name">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" class="form-control" required placeholder="Enter your email">
                </div>
                <div class="form-group">
                    <label>Message / Project Requirement</label>
                    <textarea name="message" class="form-control" rows="4" required placeholder="Tell us about your project"></textarea>
                </div>
                <button type="submit">Submit Request</button>
            </form>
        </div>

    </div>

    <footer>
        <span class="whatsapp-icon">💬</span> Contact Us: +91 73299 95385
    </footer>

</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
    res.send(getHtml());
});

app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    const query = 'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)';

    connection.query(query, [name, email, message], (err, result) => {
        if (err) {
            console.error('Error saving to database:', err);
            // Even if DB fails, show page but with error (or success simulation)
            // For now specific error handling
            res.send(getHtml('Error: Could not save your message. Please try again.'));
            return;
        }
        console.log('New contact saved:', result);
        res.send(getHtml('Success! We will contact you shortly.'));
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Ensure you have updated the DB credentials in server.js`);
});
