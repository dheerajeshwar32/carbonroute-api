import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from 'redis';
import { CloudRegion } from './regions'; 
import { selectOptimalRegion, SLAConfig } from './scheduler';
import { startTelemetryWorker, telemetryCache } from './telemetry';

dotenv.config();

// --- 1. INITIALIZE REDIS CLIENT ---
// --- 1. INITIALIZE REDIS CLIENT ---
const redisClient = createClient({
    url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Boot the background telemetry worker
startTelemetryWorker();

app.post('/api/v1/inference', async (req: Request, res: Response): Promise<void> => {
    try {
        const { prompt, model, sla } = req.body;
        const startTime = Date.now();

        if (!prompt || !sla || typeof sla.max_latency_ms !== 'number') {
            res.status(400).json({ error: "Invalid payload." });
            return;
        }

        // --- 2. CHECK REDIS FOR CACHE HIT ---
        const cachedResponse = await redisClient.get(prompt);
        
        if (cachedResponse) {
            console.log(`[CACHE HIT] Serving from memory. 0 Carbon used.`);
            res.status(200).json({
                status: "success",
                routed_to: "Memory Cache (Redis)",
                location: "Local Edge",
                telemetry: {
                    latency_ms: Date.now() - startTime,
                    cost_per_1k_tokens: 0,
                    live_carbon_intensity: 0 // Compute bypassed!
                },
                data: cachedResponse
            });
            return;
        }

        // --- 3. CACHE MISS: PROCEED TO CLOUD ROUTING ---
        const liveRegions = telemetryCache.get("live_regions") as CloudRegion[];        
        if (!liveRegions) {
            res.status(503).json({ error: "Telemetry cache warming up. Try again in a moment." });
            return;
        }

        const slaConfig: SLAConfig = {
            max_latency_ms: sla.max_latency_ms,
            carbon_priority_weight: sla.carbon_priority_weight,
            cost_priority_weight: sla.cost_priority_weight
        };

        const decision = selectOptimalRegion(liveRegions, slaConfig);
        console.log(`[ROUTE MATCH] Selected: ${decision.selectedRegion.id} (Carbon: ${decision.selectedRegion.carbonIntensity} gCO2/kWh)`);

        const geminiModel = genAI.getGenerativeModel({ model: model || "gemini-3.5-flash" });
        const contextAwarePrompt = `You are an AI executing in the ${decision.selectedRegion.location} cloud region. Respond to: ${prompt}`;
        
        const result = await geminiModel.generateContent(contextAwarePrompt);
        const geminiText = result.response.text();

        // --- 4. SAVE CLOUD RESPONSE TO REDIS ---
        // Store the result for 1 hour (3600 seconds)
        await redisClient.setEx(prompt, 3600, geminiText);
        
        res.status(200).json({
            status: "success",
            routed_to: decision.selectedRegion.id,
            location: decision.selectedRegion.location,
            telemetry: {
                latency_ms: decision.selectedRegion.latencyMs,
                cost_per_1k_tokens: decision.selectedRegion.costPer1kTokens,
                live_carbon_intensity: decision.selectedRegion.carbonIntensity
            },
            data: geminiText
        });

    } catch (error: any) {
        // ADD THIS LINE:
        console.error("[Route Error] Backend crashed because:", error.message || error);
        
        res.status(422).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`CarbonRoute Local Proxy running on http://localhost:${PORT}`);
});