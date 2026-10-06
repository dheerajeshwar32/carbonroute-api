<div align="center">

# 🌱 CarbonRoute API
### Sustainable, SLA-Aware AI Inference Routing Proxy

<a href="https://github.com/dheerajeshwar32/carbonroute-api">
  <img src="https://img.shields.io/badge/Backend_API-10B981?style=for-the-badge&logo=node.js" alt="Backend Repo" />
</a>
<a href="https://github.com/dheerajeshwar32/CarbonRoute">
  <img src="https://img.shields.io/badge/Frontend_Repo-0F172A?style=for-the-badge&logo=github" alt="Frontend Repo" />
</a>

CarbonRoute is a high-performance proxy application that dynamically routes generative AI requests to the most carbon-efficient global cloud compute region in real-time. By ingesting live grid intensity telemetry and evaluating custom Service Level Agreement (SLA) constraints (latency, cost, and carbon priority), the routing engine minimizes the environmental footprint of LLM inference without sacrificing application performance.

</div>

---

## 🧠 System Architecture

The proxy acts as the intelligent middleware between the client and global LLM execution nodes. 

```mermaid
graph TD
    Client[Client / Frontend] -->|POST /inference| Proxy(API Gateway / Proxy)
    
    subgraph Core Engine
        Proxy --> Cache[(Upstash Redis Cache)]
        Proxy --> Scheduler[SLA Routing Scheduler]
        Worker[Background Telemetry Worker] -.->|Updates| Mem[In-Memory Grid Status]
        Scheduler -.->|Reads| Mem
    end

    subgraph External Dependencies
        Worker -->|Polls| EMap(Electricity Maps API)
        Scheduler -->|Executes (Cache Miss)| LLM{Google Gemini Nodes}
        LLM -.->|europe-north1| Node1[Finland Data Center]
        LLM -.->|us-east4| Node2[Virginia Data Center]
    end
    
    Cache -->|Cache Hit (0g CO2)| Client
    LLM -->|Response| Cache
```

## ✨ Key Features

*   **Live Carbon Telemetry:** An asynchronous background worker continuously polls the Electricity Maps API to maintain an in-memory map of global grid carbon intensity (`gCO2eq/kWh`).
*   **SLA-Driven Scheduler:** A multi-variable routing algorithm evaluates incoming requests against hard constraints (e.g., max latency `< 200ms`) and weighted priorities (carbon vs. cost) to select the optimal compute region.
*   **Zero-Emission Edge Caching:** Integrates **Upstash Redis** to serve redundant prompts instantly from memory, bypassing cloud compute entirely to achieve **0 gCO2/kWh** emissions on cache hits.
*   **Seamless AI Execution:** Context-aware integration with the **Google Gemini API** (`gemini-3.5-flash`), executing prompts in the exact physical region selected by the routing engine.

## 🛠️ Tech Stack

*   **Runtime:** Node.js, TypeScript, Express
*   **Caching:** Upstash Redis
*   **LLM Integration:** Google Gemini API
*   **Grid Telemetry:** Electricity Maps API

---

## 🚀 Local Setup Instructions

### Prerequisites
*   Node.js (v18 or higher)
*   Google Gemini API Key (via Google AI Studio)
*   Upstash Redis Database URL
*   *(Optional)* Electricity Maps API Key for production limits

### 1. Clone the repository
```bash
git clone https://github.com/dheerajeshwar32/carbonroute-api.git
cd carbonroute-api
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
PORT=10000
GEMINI_API_KEY=your_gemini_api_key_here
REDIS_URL=your_upstash_redis_url_here
```

### 4. Build and Start the Server
```bash
npm run build
npm start
```
The proxy will boot up, initialize the Redis connection, start the telemetry worker, and listen on `http://localhost:10000`.

---

## 📖 API Reference

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
```

**Success Response (Cache Miss - Cloud Routed):**
```json
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
```

**Success Response (Cache Hit - Edge Served):**
```json
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
```

---
<div align="center">
<i>Engineered by Nagula Dheeraj Eshwar Prudhvi</i>
</div>
