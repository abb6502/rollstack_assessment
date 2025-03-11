const { Pool } = require('pg');
import { fetchJob, processJob } from './worker';

const pool = new Pool({ connectionString: 'postgres://testuser:@localhost:5432/mydb' });
const WORKER_COUNT = 5;
let isShuttingDown = false;

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function worker() {
    const client = await pool.connect();
    try {
        while (!isShuttingDown) {
            const job = await fetchJob(client);
            if (!job) {
                await sleep(500); // Sleep if no job
                continue;
            }

            let retries = 0;
            while (retries <= MAX_RETRIES) {
                try {
                    await processJob(job, client);
                    break; // Success - exit retry loop
                } catch (error) {
                    retries++;
                    if (retries > MAX_RETRIES) {
                        console.error(`Job ${job.id} failed permanently after ${MAX_RETRIES} retries:`, error);
                        // Here you might want to mark the job as permanently failed in your DB
                        break;
                    }
                    
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = BASE_DELAY * Math.pow(2, retries - 1);
                    console.log(`Job ${job.id} failed, retry ${retries}/${MAX_RETRIES} after ${delay}ms`);
                    await sleep(delay);
                }
            }
        }
        console.log('Worker gracefully shut down');
    } finally {
        client.release();
    }
}

// Graceful shutdown handler
async function shutdown() {
    console.log('Initiating graceful shutdown...');
    isShuttingDown = true;
    
    // Wait for workers to finish (they'll exit their loops when isShuttingDown is true)
    await new Promise(res => setTimeout(res, 1000)); // Give workers time to finish
    
    // Close the pool
    await pool.end();
    console.log('All connections closed');
    process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start multiple workers
for (let i = 0; i < WORKER_COUNT; i++) {
    console.log(`Starting worker ${i}`);
    worker();
}