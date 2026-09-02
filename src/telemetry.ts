// src/telemetry.ts
import NodeCache from 'node-cache';
import { CloudRegion, MOCK_REGIONS } from './regions';

// Initialize cache: data expires in 60 seconds, checks for expired data every 10 seconds
export const telemetryCache = new NodeCache({ stdTTL: 60, checkperiod: 10 });

// Load initial baseline data
telemetryCache.set("live_regions", MOCK_REGIONS);

export function startTelemetryWorker() {
    console.log("[SYSTEM] Starting async telemetry background worker...");

    // Run this loop every 10 seconds
    setInterval(() => {
        const currentRegions = telemetryCache.get<CloudRegion[]>("live_regions") || MOCK_REGIONS;
        
        const updatedRegions = currentRegions.map(region => {
            // Simulate grid fluctuations: Randomly shift carbon intensity by -30 to +30
            const carbonShift = Math.floor(Math.random() * 61) - 30;
            let newCarbon = region.carbonIntensity + carbonShift;
            
            // Ensure carbon doesn't drop below a realistic floor of 50
            if (newCarbon < 50) newCarbon = 50;

            // Simulate spot pricing shifts: +/- 10%
            const priceShiftMultiplier = 0.9 + (Math.random() * 0.2); 
            const newCost = region.costPer1kTokens * priceShiftMultiplier;

            return {
                ...region,
                carbonIntensity: Math.round(newCarbon),
                costPer1kTokens: Number(newCost.toFixed(5))
            };
        });

        // Save the fresh data back into the high-speed cache
        telemetryCache.set("live_regions", updatedRegions);
        console.log(`[TELEMETRY] Cache updated with live grid fluctuations.`);
        
    }, 10000); // 10,000 ms = 10 seconds
}