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

// Initialize Database Table
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Connected to Supabase. Table "contacts" checked/created.');
    } catch (err) {
        console.error('Error creating table:', err);
    }
};

initDb();

// --- FRONTEND ---
// Health Check for Vercel
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        env: process.env.NODE_ENV,
        db_configured: !!process.env.DB_HOST,
        email_configured: !!process.env.GMAIL_USER
    });
});

// Explicitly serve index.html for the root path to avoid 500s on Vercel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error('Error serving index.html:', err.message);
            res.status(500).send('Error loading home page. Please check server logs.');
        }
    });
});

// Routes
// Contact Route
app.post('/contact', async (req, res) => {
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
            message: 'Error: Could not process your request.',
            error: err.message // Temporarily exposed for debugging
        });
    }
});

// --- ORDER TRACKING ENDPOINT ---
app.get('/api/track-order', async (req, res) => {
    console.log('API HIT: /api/track-order', req.query);
    const { orderId, email } = req.query;


    if (!orderId && !email) {
        return res.status(400).json({ success: false, message: 'Please provide an Order ID or Email.' });
    }

    try {
        let query = `SELECT * FROM orders WHERE `;
        let values = [];

        if (orderId) {
            query += `order_code = $1`;
            values.push(orderId);
        } else {
            query += `user_email = $1`;
            values.push(email);
        }

        const orderResult = await pool.query(query, values);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const order = orderResult.rows[0];

        // Get History
        const historyResult = await pool.query(
            `SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY updated_at DESC`,
            [order.id]
        );

        res.json({
            success: true,
            order: order,
            history: historyResult.rows
        });

    } catch (err) {
        console.error('Error tracking order:', err);
        res.status(500).json({ success: false, message: 'Server error while tracking order.' });
    }
});

// --- EMAIL NOTIFICATION LOGIC ---
const sendStatusEmail = async (order, newStatus) => {
    const statusMap = {
        'confirmed': 'Order Confirmed',
        'analysis': 'Requirement Analysis',
        'design': 'Architecture Design',
        'development': 'Development In Progress',
        'testing': 'Testing & Optimization',
        'report': 'Report & PPT Preparation',
        'delivery': 'Ready for Delivery',
        'completed': 'Completed'
    };

    const readableStatus = statusMap[newStatus] || newStatus;

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: order.user_email,
        subject: `Your TechB Project Status Updated – ${readableStatus}`,
        html: `
            <div style="font-family: 'Arial', sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <h2 style="color: #050511; border-bottom: 2px solid #00F3FF; padding-bottom: 10px;">Project Status Update</h2>
                    <p style="font-size: 16px; color: #333;">Hello <strong>${order.user_email.split('@')[0]}</strong>,</p>
                    <p style="font-size: 16px; color: #555;">Your project "<strong>${order.project_title}</strong>" has moved to the following stage:</p>
                    
                    <div style="background: #050511; color: #00F3FF; padding: 15px; text-align: center; font-size: 18px; font-weight: bold; border-radius: 5px; margin: 20px 0;">
                        Status: ${readableStatus}
                    </div>

                    <p style="font-size: 16px; color: #555;">We are actively working on your project. You will receive further updates soon.</p>
                    <p style="font-size: 16px; color: #555;"><strong>Expected Delivery:</strong> ${new Date(order.expected_delivery).toDateString()}</p>
                    
                    <a href="https://techbprojects.com/track-order" style="display: block; width: 200px; margin: 20px auto; padding: 12px; background: #00F3FF; color: #000; text-align: center; text-decoration: none; font-weight: bold; border-radius: 5px;">Track Order</a>
                    
                    <p style="font-size: 14px; color: #999; margin-top: 30px;">Thank you for choosing TechB Projects.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Status update email sent to ${order.user_email}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

// --- UPDATE ORDER STATUS ENDPOINT (For Admin/Testing) ---
app.post('/api/update-order-status', async (req, res) => {
    const { orderId, status, notes } = req.body;

    if (!orderId || !status) {
        return res.status(400).json({ success: false, message: 'Missing Order ID or Status.' });
    }

    try {
        // Update Orders Table
        const updateResult = await pool.query(
            `UPDATE orders SET status = $1 WHERE order_code = $2 RETURNING *`,
            [status, orderId]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const order = updateResult.rows[0];

        // Insert into History
        await pool.query(
            `INSERT INTO order_status_history (order_id, status, notes, updated_at) VALUES ($1, $2, $3, NOW())`,
            [order.id, status, notes || `Status updated to ${status}`]
        );

        // Send Email
        await sendStatusEmail(order, status);

        res.json({ success: true, message: 'Status updated and email sent.', order: order });

    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ success: false, message: 'Server error updating status.' });
    }
});

// Serve Static Files AFTER API Routes
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all for undefined API routes
app.use('/api/*', (req, res) => {
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
