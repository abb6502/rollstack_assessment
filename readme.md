# Job Queue System

A robust, PostgreSQL-backed job queue system with REST API endpoints for job management and monitoring. Built with Node.js, Express, and TypeScript.

## 🚀 Features

- **Job Queue Management**
  - Create and schedule jobs
  - Automatic retries with exponential backoff
  - Job status tracking (pending, processing, completed, failed, cancelled)
  - Concurrent job processing with worker pool

- **REST API**
  - List jobs with pagination and filtering
  - Create new jobs
  - Retry failed jobs
  - Cancel pending jobs
  - Graceful shutdown handling

- **Reliability**
  - Automatic retry mechanism
  - Exponential backoff strategy
  - Database-backed persistence
  - Graceful shutdown handling

## 📋 Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd job-queue-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE mydb;
   
   CREATE TABLE jobs (
       id SERIAL PRIMARY KEY,
       payload JSONB NOT NULL,
       status VARCHAR(20) DEFAULT 'pending',
       scheduled_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       retries INTEGER DEFAULT 0,
       max_retries INTEGER DEFAULT 3,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

## 🚦 Usage

### Start the server