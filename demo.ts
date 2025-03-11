/**
 * @fileoverview Main demonstration script that sets up and runs the job queue system,
 * including database setup, Express server, worker pool, and test job creation.
 */

import express from 'express';
import { Pool } from 'pg';
import axios from 'axios';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/** Express application instance */
const app = express();
app.use(express.json());

/** PostgreSQL connection pool for database operations */
const pool = new Pool({
    connectionString: 'postgres://testuser:@localhost:5432/mydb'
});

/** Server port number */
const PORT = 3000;

/**
 * Sets up PostgreSQL user and database
 * @async
 * @returns {Promise<void>}
 */
async function setupDatabase() {
    console.log('Setting up database...');
    
    try {
        // Create user and database using postgres superuser
        const commands = [
            "psql -U postgres -c \"CREATE USER testuser WITH PASSWORD '';\"",
            "psql -U postgres -c 'CREATE DATABASE mydb;'",
            "psql -U postgres -c 'GRANT ALL PRIVILEGES ON DATABASE mydb TO testuser;'",
            "psql -U postgres -d mydb -c 'GRANT ALL ON SCHEMA public TO testuser;'"
        ];

        for (const command of commands) {
            try {
                await execPromise(command);
                console.log(`Executed: ${command}`);
            } catch (error: any) {
                // Ignore error if user/database already exists
                if (!error.stderr.includes('already exists')) {
                    throw error;
                }
                console.log(`Note: ${error.stderr.trim()}`);
            }
        }
        
        console.log('Database setup completed');
    } catch (error) {
        console.error('Database setup error:', error);
        throw error;
    }
}

/**
 * Initializes the database by creating the required jobs table
 * @async
 * @returns {Promise<void>}
 */
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                payload JSONB NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                scheduled_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                retries INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database initialized');
    } finally {
        client.release();
    }
}

// API Routes
app.get('/jobs', async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const [countResult, dataResult] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM jobs WHERE ($1::text IS NULL OR status = $1)', 
            [status || null]),
        pool.query('SELECT * FROM jobs WHERE ($1::text IS NULL OR status = $1) ORDER BY scheduled_time DESC LIMIT $2 OFFSET $3',
            [status || null, limit, offset])
    ]);
    
    res.json({
        jobs: dataResult.rows,
        page: Number(page),
        limit: Number(limit),
        total: parseInt(countResult.rows[0].count)
    });
});

app.post('/jobs', async (req, res) => {
    const result = await pool.query(
        'INSERT INTO jobs(payload, scheduled_time, max_retries) VALUES($1, $2, $3) RETURNING *',
        [req.body.payload, req.body.scheduled_time, req.body.max_retries]
    );
    res.json(result.rows[0]);
});

/**
 * Creates and sends multiple test jobs to demonstrate the queue system
 * @async
 * @returns {Promise<void>}
 */
async function sendBulkRequests() {
    console.log('Sending bulk requests...');
    
    // Create 15 immediate jobs
    for (let i = 1; i <= 15; i++) {
        await axios.post('http://localhost:3000/jobs', {
            payload: { task: `Task ${i}`, details: `Details for task ${i}` },
            scheduled_time: new Date().toISOString(),
            max_retries: 3
        });
        console.log(`Created immediate job ${i}`);
    }
    
    // Create 5 future jobs
    for (let i = 16; i <= 20; i++) {
        await axios.post('http://localhost:3000/jobs', {
            payload: { task: `Task ${i}`, details: `Details for task ${i}` },
            scheduled_time: new Date(Date.now() + 10000).toISOString(), // 10 seconds in future
            max_retries: 3
        });
        console.log(`Created future job ${i}`);
    }
}

/**
 * Starts the worker pool process using tsx
 * @returns {ChildProcess} The spawned worker pool process
 */
function startWorkerPool() {
    const workerPool = spawn('npx', ['tsx', 'worker_pool.ts'], {
        stdio: 'inherit'
    });

    workerPool.on('error', (err) => {
        console.error('Failed to start worker pool:', err);
    });

    return workerPool;
}

/**
 * Performs graceful shutdown of the server and worker pool
 * @async
 * @param {any} workerPool - The worker pool process to shut down
 * @returns {Promise<void>}
 */
async function shutdown(workerPool: any) {
    console.log('Initiating graceful shutdown...');
    
    // Kill worker pool process
    workerPool.kill('SIGINT');
    
    // Close database connection
    await pool.end();
    
    console.log('Shutdown complete');
    process.exit(0);
}

/**
 * Main function that initializes and runs the entire system
 * @async
 * @returns {Promise<void>}
 */
async function main() {
    try {
        await setupDatabase();
        await initDB();
        
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
        
        const workerPool = startWorkerPool();
        console.log('Worker pool started');
        
        await new Promise(res => setTimeout(res, 2000));
        
        await sendBulkRequests();
        
        console.log('Demo running. Press Ctrl+C to shutdown.');

        process.on('SIGTERM', () => shutdown(workerPool));
        process.on('SIGINT', () => shutdown(workerPool));
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);