# CarbonRoute 🌱

**Sustainable, SLA-Aware AI Inference Routing Proxy**

CarbonRoute is a high-performance proxy application that dynamically routes generative AI requests to the most carbon-efficient global cloud compute region in real-time. By ingesting live grid intensity telemetry and evaluating custom Service Level Agreement (SLA) constraints (latency, cost, and carbon priority), the routing engine minimizes the environmental footprint of LLM inference without sacrificing application performance.

## 🚀 Key Features

*   **Live Carbon Telemetry:** An asynchronous background worker continuously polls the Electricity Maps API to maintain an in-memory map of global grid carbon intensity (gCO2eq/kWh).
*   **SLA-Driven Scheduler:** A multi-variable routing algorithm evaluates incoming requests against hard constraints (e.g., max latency < 200ms) and weighted priorities (carbon vs. cost) to select the optimal compute region.
*   **Zero-Emission Edge Caching:** Integrates Upstash Redis to serve redundant prompts instantly from memory, bypassing cloud compute entirely to achieve 0 gCO2/kWh emissions on cache hits.
*   **Seamless AI Execution:** Context-aware integration with the Google Gemini API (`gemini-3.5-flash`), executing prompts in the exact physical region selected by the routing engine.

## 🛠️ Architecture & Tech Stack

*   **Frontend:** React, Tailwind CSS (Vite)
*   **Backend Proxy:** Node.js, Express, TypeScript
*   **Data & Caching:** Upstash Redis
*   **External APIs:** Google Gemini API, Electricity Maps API
*   **Deployment & Infrastructure:** Render (Web Services)

## 📦 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   Google Gemini API Key (via Google AI Studio)
*   Upstash Redis Database URL
*   *(Optional)* Electricity Maps API Key for production limits

### Local Installation

1.  Clone the repository:
    ```bash
    git clone [https://github.com/dheerajeshwar32/carbonroute-api.git](https://github.com/dheerajeshwar32/carbonroute-api.git)
    cd carbonroute-api
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment Variables:
    Create a `.env` file in the root directory:
    ```env
    PORT=10000
    GEMINI_API_KEY=your_gemini_api_key_here
    REDIS_URL=your_upstash_redis_url_here
    ```

4.  Build and Start the Server:
    ```bash
    npm run build
    npm start
    ```
    The proxy will boot up, initialize the Redis connection, start the telemetry worker, and listen on `http://localhost:10000`.

## 🔌 API Reference

### `POST /api/v1/inference`

Routes a prompt to the optimal region based on the provided SLA payload.

**Request Body:**
```json
{
  "prompt": "What is the capital of France?",
  "model": "gemini-3.5-flash",
  "sla": {
    "max_latency_ms": 200,
    "carbon_priority_weight": 0.9,
    "cost_priority_weight": 0.1
  }
}

Success Response (Cache Miss - Cloud Routed):

JSON
{
  "status": "success",
  "routed_to": "europe-north1",
  "location": "Finland",
  "telemetry": {
    "latency_ms": 115,
    "cost_per_1k_tokens": 0.00025,
    "live_carbon_intensity": 37
  },
  "data": "The capital of France is Paris."
}
Success Response (Cache Hit):

JSON
{
  "status": "success",
  "routed_to": "Memory Cache (Redis)",
  "location": "Local Edge",
  "telemetry": {
    "latency_ms": 12,
    "cost_per_1k_tokens": 0,
    "live_carbon_intensity": 0
  },
  "data": "The capital of France is Paris."
}
🗺️ Roadmap & Future Enhancements
Dynamic Latency Mapping: Transition from static estimated latency baselines to a dynamic ping-mesh for real-time network SLA evaluation.

Multi-Provider Fallback: Expand routing capabilities beyond Gemini to include AWS Bedrock and Anthropic depending on regional grid health.

Cloud-Native Migration: Containerize the proxy using Docker and transition deployment to AWS ECS or Google Cloud Run for enhanced auto-scaling.

Engineered by Nagula Dheeraj Eshwar Prudhvi.
