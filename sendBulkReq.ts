const axios = require('axios');

// Endpoint to send requests to
const API_URL = 'http://localhost:3000/jobs';

// Prepare job payload
const createJobPayload = (id, isFuture = false) => ({
    payload: {
        task: `Task ${id}`,
        details: `Details for task ${id}`,
    },
    scheduled_time: isFuture ? new Date(Date.now() + 10000).toISOString() : new Date().toISOString(), // 10 seconds from now for future jobs
    max_retries: 3,
});

// Function to send a job creation request
const sendJobRequest = async (id, isFuture = false) => {
    try {
        const payload = createJobPayload(id, isFuture);
        const response = await axios.post(API_URL, payload);
        console.log(`Job ${id} created:`, response.data);
    } catch (error) {
        console.error(`Failed to create job ${id}:`, error.message);
    }
};

// Send 20 concurrent requests with some jobs scheduled for the future
const sendConcurrentRequests = async () => {
    const promises = [];
    
    // Create 15 jobs scheduled for now (processed immediately)
    for (let i = 1; i <= 15; i++) {
        promises.push(sendJobRequest(i));
    }
    
    // Create 5 jobs scheduled for the future (not processed immediately)
    for (let i = 16; i <= 20; i++) {
        promises.push(sendJobRequest(i, true)); // Future job
    }

    await Promise.all(promises);  // Wait for all requests to finish
    console.log('All requests sent.');
};

sendConcurrentRequests();
