/**
 * @fileoverview Main API server for job queue management with endpoints for
 * creating, listing, retrying, and cancelling jobs.
 */

import express from 'express';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/** Express application instance */
const app = express();
/** PostgreSQL connection pool for database operations */
const pool = new Pool({ connectionString: 'postgres://testuser:@localhost:5432/mydb' });

app.use(express.json());

/**
 * Create a new job
 * @route POST /jobs
 * @param {Object} req.body.payload - Job payload data
 * @param {string} [req.body.scheduled_time] - When to schedule the job (defaults to now)
 * @param {number} [req.body.max_retries=3] - Maximum number of retry attempts
 */
app.post('/jobs', async (req, res) => {
    const { payload, scheduled_time, max_retries } = req.body;
    console.log(req.body)
    const query = `INSERT INTO jobs (payload, scheduled_time, max_retries) VALUES ($1, $2, $3) RETURNING *`;
    const { rows } = await pool.query(query, [payload, scheduled_time || new Date(), max_retries || 3]);
    res.json(rows[0]);
});

/**
 * List jobs with pagination and filtering
 * @route GET /jobs
 * @param {string} [req.query.status] - Filter jobs by status
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of items per page
 * @param {string} [req.query.sort='scheduled_time'] - Field to sort by
 */
app.get('/jobs', async (req, res) => {
    const { 
        status,
        page = 1,
        limit = 10,
        sort = 'scheduled_time'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    // First, get total count
    const countQuery = `
        SELECT COUNT(*) 
        FROM jobs 
        WHERE ($1::text IS NULL OR status = $1)
    `;
    
    // Then, get paginated data
    const dataQuery = `
        SELECT * FROM jobs 
        WHERE ($1::text IS NULL OR status = $1)
        ORDER BY ${sort} DESC
        LIMIT $2 OFFSET $3
    `;
    
    const [countResult, dataResult] = await Promise.all([
        pool.query(countQuery, [status || null]),
        pool.query(dataQuery, [status || null, limit, offset])
    ]);
    
    res.json({
        jobs: dataResult.rows,
        page: Number(page),
        limit: Number(limit),
        total: parseInt(countResult.rows[0].count)
    });
});

/**
 * Retry a failed job
 * @route POST /jobs/:id/retry
 * @param {string} req.params.id - ID of the job to retry
 * @throws {404} If job not found or not in failed status
 */
app.post('/jobs/:id/retry', async (req, res) => {
    const { id } = req.params;
    
    const result = await pool.query(
        `UPDATE jobs 
         SET status = 'pending',
             retries = 0,
             scheduled_time = NOW()
         WHERE id = $1 AND status = 'failed'
         RETURNING *`,
        [id]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found or not failed' });
    }
    
    res.json(result.rows[0]);
});

/**
 * Cancel a pending job
 * @route POST /jobs/:id/cancel
 * @param {string} req.params.id - ID of the job to cancel
 * @throws {404} If job not found or not in pending status
 */
app.post('/jobs/:id/cancel', async (req, res) => {
    const { id } = req.params;
    
    const result = await pool.query(
        `UPDATE jobs 
         SET status = 'cancelled'
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [id]
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found or not pending' });
    }
    
    res.json(result.rows[0]);
});

/**
 * Start the server and listen for connections
 */
app.listen(3000, () => console.log('Server running on port 3000'));

/**
 * Graceful shutdown handler
 * Closes database connections before exiting
 */
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await pool.end();
    process.exit(0);
});
