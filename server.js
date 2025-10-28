// qperform-server/server.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'doadmin',
    host: process.env.DB_HOST || 'qmis01sql01-do-user-6230587-0.b.db.ondigitalocean.com',
    database: process.env.DB_NAME || 'QGame',
    password: process.env.DB_PASSWORD || 'AVNS_f_Nj6ijnZknfDimfnhD',
    port: parseInt(process.env.DB_PORT || '25060'),
    ssl: {
        rejectUnauthorized: false
    },
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ Database connected at:', res.rows[0].now);
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get weekly performance data (for Underperforming View)
app.get('/api/performance-data', async (req, res) => {
    try {
        const { month, year, category, client, task } = req.query;
        
        let query = `
            SELECT 
                agent_email,
                agent_id,
                position,
                office,
                client,
                task,
                category,
                kpi_qa,
                flag_qa,
                kpi_avg_prod,
                flag_prod,
                week_range,
                start_date,
                end_date,
                month_num,
                month_name,
                year_num
            FROM consolidations.data_qperform_weekly
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (month) {
            query += ` AND month_name = $${paramCount}`;
            params.push(month);
            paramCount++;
        }
        
        if (year) {
            query += ` AND year_num = $${paramCount}`;
            params.push(parseInt(year));
            paramCount++;
        }
        
        if (category) {
            query += ` AND category = $${paramCount}`;
            params.push(category);
            paramCount++;
        }
        
        if (client) {
            query += ` AND client = $${paramCount}`;
            params.push(client);
            paramCount++;
        }
        
        if (task) {
            query += ` AND task = $${paramCount}`;
            params.push(task);
            paramCount++;
        }
        
        query += ` ORDER BY client, agent_email, start_date`;
        
        const { rows } = await pool.query(query, params);
        console.log(`✅ Retrieved ${rows.length} performance records`);
        
        res.json(rows);
    } catch (err) {
        console.error('❌ Error fetching performance data:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Get monthly summary (aggregated data)
app.get('/api/monthly-summary', async (req, res) => {
    try {
        const { month, year } = req.query;
        
        let query = `
            SELECT 
                client,
                category,
                COUNT(DISTINCT agent_id) as total_aftes,
                COUNT(DISTINCT CASE 
                    WHEN flag_qa = 'Critical' OR flag_qa = 'Low' 
                    OR flag_prod = 'Critical' OR flag_prod = 'Low' 
                    THEN agent_id 
                END) as underperformers,
                COUNT(DISTINCT week_range) as weeks_with_issues,
                ROUND(AVG(kpi_qa * 100), 2) as avg_score
            FROM consolidations.data_qperform_weekly
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (month) {
            query += ` AND month_name = $${paramCount}`;
            params.push(month);
            paramCount++;
        }
        
        if (year) {
            query += ` AND year_num = $${paramCount}`;
            params.push(parseInt(year));
            paramCount++;
        }
        
        query += ` GROUP BY client, category ORDER BY client, category`;
        
        const { rows } = await pool.query(query, params);
        console.log(`✅ Retrieved ${rows.length} summary records`);
        
        res.json(rows);
    } catch (err) {
        console.error('❌ Error fetching summary:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Get filters metadata
app.get('/api/filters', async (req, res) => {
    try {
        const query = `
            SELECT 
                ARRAY_AGG(DISTINCT category) as categories,
                ARRAY_AGG(DISTINCT client) as clients,
                ARRAY_AGG(DISTINCT task) as tasks,
                ARRAY_AGG(DISTINCT month_name) as months,
                ARRAY_AGG(DISTINCT year_num) as years
            FROM consolidations.data_qperform_weekly
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows[0]);
    } catch (err) {
        console.error('❌ Error fetching filters:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Get action log
app.get('/api/action-log', async (req, res) => {
    try {
        // TODO: Create action_log table
        // For now, return mock data
        res.json([
            {
                id: 1,
                agent_email: 'robert.wilson@company.com',
                action_type: 'Coaching',
                description: 'Consistent underperformance for 4 consecutive weeks. Final warning issued.',
                taken_by: 'Team Lead Chen',
                action_date: '2025-10-15',
                client: 'Acme Corp',
                category: 'Customer Service'
            }
        ]);
    } catch (err) {
        console.error('❌ Error fetching action log:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Create new action
app.post('/api/action-log', async (req, res) => {
    try {
        const { agent_email, action_type, description, taken_by, client, category } = req.body;
        
        // TODO: Insert into action_log table
        // For now, return success
        res.json({ 
            success: true, 
            message: 'Action created successfully',
            id: Date.now()
        });
    } catch (err) {
        console.error('❌ Error creating action:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Get table structure (debugging)
app.get('/api/table-info', async (req, res) => {
    try {
        const query = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'consolidations' 
            AND table_name = 'data_qperform_weekly'
            ORDER BY ordinal_position;
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('❌ Error fetching table info:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 QPerform API Server running`);
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`🔗 Health: http://localhost:${port}/api/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});