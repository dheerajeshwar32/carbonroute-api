# CarbonRoute UI 🌱

**The Frontend Dashboard for Sustainable AI Inference**

This is the client-side interface for **CarbonRoute**, a sustainable AI routing engine. Built with React and Vite, this dashboard allows users to input prompts and visualize the exact cloud region, carbon footprint, and latency of their AI inference execution.

## 🚀 Key Features

*   **Fixed SLA Policy:** Evaluates incoming prompts against a strict default latency limit (< 200ms) and balances priorities between carbon efficiency (0.9 weight) and compute cost (0.1 weight) via the backend API.
*   **Live Telemetry Visualization:** Instantly displays the routing decision, including the selected global region, network latency, and the live carbon intensity (gCO2/kWh) of that specific grid.
*   **Zero-Emission Cache Indicators:** Automatically detects and highlights when a response is served directly from the edge cache (Redis) resulting in 0 gCO2/kWh emissions.
*   **Minimalist, Responsive UI:** Built with Tailwind CSS to ensure a clean, accessible, and fast experience across all devices.

## 🛠️ Tech Stack

*   **Framework:** React (Vite)
*   **Styling:** Tailwind CSS
*   **Integration:** REST API via Fetch (Connects to `carbonroute-api`)
*   **Deployment:** Render / Vercel 

## 📦 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   The [carbonroute-api](https://github.com/dheerajeshwar32/carbonroute-api) backend running locally or deployed in the cloud.

### Local Installation

1.  Clone the repository:
    ```bash
    git clone [https://github.com/dheerajeshwar32/CarbonRoute.git](https://github.com/dheerajeshwar32/CarbonRoute.git)
    cd CarbonRoute
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment Variables:
    Create a `.env` file in the root directory to point to your backend proxy:
    ```env
    VITE_API_BASE_URL=http://localhost:10000/api/v1
    ```

4.  Start the Development Server:
    ```bash
    npm run dev
    ```
    The application will launch and be accessible at `http://localhost:5173`.

## 🔗 Architecture Context

This repository is strictly the client-side presentation layer. The actual live grid polling, region scheduling algorithm, Redis caching, and Google Gemini execution are handled by the backend proxy. 

To view the core routing logic, please visit the backend repository: [carbonroute-api](https://github.com/dheerajeshwar32/carbonroute-api).

---
*Engineered by Nagula Dheeraj Eshwar Prudhvi.*
