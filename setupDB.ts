import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/mydatabase',
});

async function setupDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql'); // Change filename if needed
        const schemaSQL = fs.readFileSync(schemaPath, 'utf-8'); // Read .schema file

        console.log('Executing schema setup...');
        await pool.query(schemaSQL); // Run schema SQL
        console.log('Database setup completed successfully!');
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        await pool.end(); // Close DB connection
    }
}

// Run setup
setupDatabase();
