const { PoolClient } = require('pg');

export async function fetchJob(client: PoolClient) {
    const query = `
        UPDATE jobs 
        SET status = 'in-progress', updated_at = NOW()
        WHERE id = (
            SELECT id FROM jobs 
            WHERE status = 'waiting' AND scheduled_time <= NOW()
            ORDER BY scheduled_time ASC 
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING *;
    `;
    const res = await client.query(query);
    return res.rows[0] || null;
}

export async function processJob(job: any, client: PoolClient) {
    try {
        console.log(`Processing job: ${job.id}`, job.payload);
        // Simulate work
        await new Promise(res => setTimeout(res, 1000));

        // Mark as completed
        await client.query(`UPDATE jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`, [job.id]);
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        if (job.retries < job.max_retries) {
            await client.query(`UPDATE jobs SET retries = retries + 1, status = 'waiting', updated_at = NOW() WHERE id = $1`, [job.id]);
        } else {
            await client.query(`UPDATE jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`, [job.id]);
        }
    }
}

