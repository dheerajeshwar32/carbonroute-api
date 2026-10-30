# CarbonRoute 🌱
> **Sustainable, SLA-Aware Generative AI Inference Routing Proxy & Telemetry Engine**

[![Live Web Application](https://img.shields.io/badge/Live%20Demo-Vercel-black.svg?style=for-the-badge&logo=vercel)](https://carbon-route-alpha.vercel.app)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-46E3B7.svg?style=for-the-badge&logo=render)](https://github.com/dheerajeshwar32/carbonroute-api)
[![Frontend Repo](https://img.shields.io/badge/Frontend-GitHub-181717.svg?style=for-the-badge&logo=github)](https://github.com/dheerajeshwar32/CarbonRoute)

[![Runtime](https://img.shields.io/badge/Runtime-Node.js%20%2B%20TypeScript-3178C6.svg?logo=typescript)]()
[![Cache](https://img.shields.io/badge/Edge%20Cache-Upstash%20Redis-FF4438.svg?logo=redis)]()
[![Telemetry](https://img.shields.io/badge/Telemetry-Electricity%20Maps%20API-10B981.svg)]()
[![AI Engine](https://img.shields.io/badge/AI%20Model-Google%20Gemini%20API-4285F4.svg?logo=google)]()

> 🌐 **Live Web Application**: [https://carbon-route-alpha.vercel.app](https://carbon-route-alpha.vercel.app)

---

## 🌟 Overview

Large Language Model (LLM) inference carries substantial, geographically variable carbon emissions. Running compute in fossil-fuel-heavy regions produces up to **10× higher carbon emissions** than in renewable-powered regions, yet conventional API gateways route solely on raw ping latency or token price.

**CarbonRoute** is a green-computing inference proxy that dynamically routes generative AI requests to the cleanest global cloud compute region in real-time. By continuously ingesting regional power grid telemetry from the **Electricity Maps API** and evaluating multi-objective Service Level Agreement (SLA) constraints (latency bounds, cost, and carbon priority), CarbonRoute minimizes the environmental footprint of LLM inference while guaranteeing strict sub-200ms latency SLAs.

---

## 🧠 System Architecture

```mermaid
graph TD
    Client[Client / Frontend Application] -->|POST /api/v1/inference| Proxy[CarbonRoute API Gateway]
    
    subgraph Core Routing Engine
        Proxy --> Cache[(Upstash Redis Edge Cache)]
        Proxy --> Scheduler[Multi-Objective SLA Scheduler]
        Worker[Background Telemetry Worker] -.->|Polls Every 5m| EMap[Electricity Maps API]
        Worker -.->|Updates| MemStore[In-Memory Grid State]
        Scheduler -.->|Reads Carbon gCO2/kWh| MemStore
    end

    subgraph Cloud Execution Nodes
        Scheduler -->|Cache Miss: Dispatches| Gemini[Google Gemini API]
        Gemini -.->|Low Carbon| Node1[europe-north1 • Finland]
        Gemini -.->|Balanced| Node2[us-east4 • Virginia]
        Gemini -.->|Fallback| Node3[us-central1 • Iowa]
    end
    
    Cache -->|Cache Hit • 0g CO2 / <15ms| Client
    Gemini -->|Inference Result| Cache
    Gemini -->|Response + Telemetry| Client
```

---

## 🔬 Mathematical Routing Objective

The routing engine solves a constrained multi-objective optimization problem for every inference call:

$$\text{Optimal Region } r^* = \arg\min_{r \in \mathcal{R}_{\text{valid}}} \left[ w_{\text{carbon}} \cdot \hat{C}_r + w_{\text{latency}} \cdot \hat{L}_r + w_{\text{cost}} \cdot \hat{P}_r \right]$$

### Constraints:
1. **Hard Latency SLA**: $L_r \le \text{SLA}_{\max}$ (default: $< 200\text{ms}$)
2. **Normalized Weights**: $w_{\text{carbon}} + w_{\text{latency}} + w_{\text{cost}} = 1.0$
3. **Normalized Metrics**: $\hat{C}_r, \hat{L}_r, \hat{P}_r \in [0, 1]$

When regional grid intensity spikes (e.g., wind generation drops or peak fossil demand rises), the scheduler dynamically steers subsequent traffic to regions with surplus renewable generation.

---

## ✨ Key Features

- 🌱 **Real-Time Grid Telemetry**:
  - Asynchronous background worker streams live carbon emissions data ($\text{gCO}_2\text{eq/kWh}$) across global cloud data centers.
- ⚡ **Zero-Emission Edge Caching (Upstash Redis)**:
  - Redundant or repeated prompts are intercepted and served directly from distributed Redis memory caches in $<15\text{ms}$, resulting in **0 gCO2** emissions and zero token cost.
- 🎯 **SLA-Constrained Dispatcher**:
  - Automatically balances developer-defined weight sliders for Carbon vs Cost vs Latency.
- 🤖 **Google Gemini API Integration**:
  - Seamlessly executes prompt generation via modern Gemini models, returning structured execution telemetry with every response.
- 📊 **Live Telemetry Dashboard**:
  - Real-time client interface visualizing cumulative carbon grams saved, routing decisions, and latency distributions.

---

## 🔌 API Reference

### `POST /api/v1/inference`

Routes a generative AI prompt according to custom SLA parameters.

#### Request Headers
```http
Content-Type: application/json
```

#### Request Payload
```json
{
  "prompt": "Explain zero-knowledge proofs in two sentences.",
  "model": "gemini-1.5-flash",
  "sla": {
    "max_latency_ms": 200,
    "carbon_priority_weight": 0.8,
    "cost_priority_weight": 0.2
  }
}
```

#### Response (Cache Miss — Green Cloud Routed)
```json
{
  "status": "success",
  "routed_to": "europe-north1",
  "location": "Hamina, Finland",
  "telemetry": {
    "latency_ms": 128,
    "cost_per_1k_tokens": 0.00025,
    "live_carbon_intensity": 34,
    "carbon_saved_percent": "38.2%",
    "cache_hit": false
  },
  "data": "A zero-knowledge proof allows one party to prove to another that a statement is true without revealing any information beyond the statement's validity. This enables mathematical verification while preserving complete underlying data confidentiality."
}
```

#### Response (Cache Hit — Zero Emission)
```json
{
  "status": "success",
  "routed_to": "Memory Cache (Redis Edge)",
  "location": "Local Edge Proxy",
  "telemetry": {
    "latency_ms": 11,
    "cost_per_1k_tokens": 0.0,
    "live_carbon_intensity": 0,
    "carbon_saved_percent": "100%",
    "cache_hit": true
  },
  "data": "A zero-knowledge proof allows one party to prove to another that a statement is true without revealing any information beyond the statement's validity..."
}
```

---

## 🛠️ Tech Stack & Dependencies

* **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Framer Motion
* **Backend Gateway**: Node.js, Express, TypeScript
* **Cache & Storage**: Upstash Redis (Serverless)
* **External Telemetry**: Electricity Maps API
* **Inference Engine**: Google Gemini API (`@google/generative-ai`)
* **Hosting**: Vercel (Frontend), Render (API Gateway)

---

## 🚀 Local Installation & Setup

### Prerequisites
- Node.js 18+
- Gemini API Key ([Google AI Studio](https://aistudio.google.com/))
- Upstash Redis Account ([Upstash Console](https://console.upstash.com/))

### 1. Clone the Repositories
```bash
# Clone the API Gateway
git clone https://github.com/dheerajeshwar32/carbonroute-api.git
cd carbonroute-api
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=10000
GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=your_upstash_redis_url
ELECTRICITY_MAPS_API_KEY=your_optional_api_key
```

### 4. Build and Run
```bash
npm run build
npm start
```
The gateway will start on `http://localhost:10000` with the background telemetry worker polling active grid signals.

---

## 👤 Author

* **Nagula Dheeraj Eshwar Prudhvi**
* GitHub: [@dheerajeshwar32](https://github.com/dheerajeshwar32)
* Live Application: [CarbonRoute on Vercel](https://carbon-route-alpha.vercel.app)
