require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Static files moved to end of routes to prevent 404 on API


// --- DATABASE CONFIGURATION (PostgreSQL/Supabase) ---
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false } // Required for Supabase/Cloud Postgres
});

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// Initialize Database Table (Lazy initialization)
let dbInitialized = false;
const initDb = async () => {
    if (dbInitialized) return;
    try {
        // Create if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure new columns exist
        const columns = ['phone', 'qualification', 'college', 'tech_stack'];
        for (const col of columns) {
            try {
                await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ${col} VARCHAR(255)`);
            } catch (colErr) {
                console.log(`Column ${col} already exists or error:`, colErr.message);
            }
        }

        dbInitialized = true;
        console.log('Connected to Supabase. Table "contacts" checked/created.');
    } catch (err) {
        console.error('Error creating table:', err.message);
        // Don't crash the server, just log the error
    }
};

// initDb() call removed from top-level to prevent Vercel startup crashes


// Health Check for Vercel
app.get('/health', async (req, res) => {
    await initDb(); // Try to init DB on health check
    res.json({
        status: 'UP',
        db_initialized: dbInitialized,
        env: process.env.NODE_ENV,
        db_host: process.env.DB_HOST ? 'Configured' : 'Missing',
        gmail_user: process.env.GMAIL_USER ? 'Configured' : 'Missing'
    });
});

// Routes
// Contact Route
app.post('/contact', async (req, res) => {
    await initDb(); // Ensure DB is ready
    console.log('API HIT: /contact', req.body);

    const { name, email, message, qualification, college, phone, techStack } = req.body;


    // Basic Validation
    if (!name || !email || !message || !phone) {
        return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    try {
        // Save to Database (Supabase / PostgreSQL)
        // Ensure your 'contacts' table has these columns: qualification, college, phone, tech_stack
        // If not, you might need to run a migration. For now, we'll store them if columns exist, 
        // or just rely on the email if the DB schema isn't updated yet.
        // Let's try to insert assuming columns might not exist yet, or just log it.
        // SAFE APPROACH: Just insert core fields + JSON blob or update schema later. 
        // For this task, we'll assume standard columns OR just rely on email for full details if DB fails.

        const query = `
            INSERT INTO contacts (name, email, message, phone, qualification, college, tech_stack, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id
        `;

        console.log('Inserting into DB...');
        try {
            await pool.query(query, [name, email, message, phone, qualification, college, techStack]);
            console.log('DB Insert successful.');
        } catch (dbErr) {
            console.error('DATABASE ERROR:', dbErr.message);
            throw new Error(`Database operation failed: ${dbErr.message}`);
        }

        // Send Email Notification
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER, // Send to admin
            subject: `New Project Inquiry: ${name} (${techStack})`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #00F3FF; background: #050511; padding: 10px;">New Project Request</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Qualification:</strong> ${qualification}</p>
                    <p><strong>College:</strong> ${college}</p>
                    <p><strong>Tech Stack:</strong> ${techStack}</p>
                    <hr>
                    <h3>Project Requirements:</h3>
                    <p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #00F3FF;">${message}</p>
                </div>
            `
        };

        // Send Email
        console.log('Sending email...');
        try {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully.');
        } catch (mailErr) {
            console.error('EMAIL ERROR:', mailErr.message);
            throw new Error(`Email sending failed: ${mailErr.message}`);
        }

        res.json({ success: true, message: 'Request sent successfully! Our team will contact you soon.' });

    } catch (err) {
        console.error('SERVER ERROR:', err.message);
        res.status(500).json({
            success: false,
            message: `Server Error: ${err.message}`, // Show exact error in UI for debugging
            error: err.message
        });
    }
});


// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes handled above

// Catch-all for undefined API routes
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

// Start Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Connected to Supabase Postgres.`);
    });
}

module.exports = app;
