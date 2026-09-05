import { MOCK_REGIONS, CloudRegion } from './regions';

export const telemetryCache = new Map<string, CloudRegion[]>();

export const startTelemetryWorker = () => {
    updateCarbonData();
    // Poll every 30 minutes (or change to a lower number like 10 * 1000 for a rapid 10-second demo)
    setInterval(updateCarbonData, 30 * 60 * 1000); 
};

const updateCarbonData = async () => {
    const liveRegions = [...MOCK_REGIONS];
    const apiKey = process.env.ELECTRICITY_MAPS_API_KEY;

    if (!apiKey) {
        console.warn("[Telemetry] ELECTRICITY_MAPS_API_KEY not found. Simulating live grid volatility.");
        
        const dynamicMockRegions = liveRegions.map(region => {
            // Introduce a +/- 30% random variance to simulate real grid carbon fluctuations
            const carbonVariance = 0.7 + (Math.random() * 0.6); 
            // Introduce a +/- 15% random variance for network latency
            const latencyVariance = 0.85 + (Math.random() * 0.3);

            return {
                ...region,
                carbonIntensity: Math.max(5, Math.floor(region.carbonIntensity * carbonVariance)),
                latencyMs: Math.max(10, Math.floor(region.latencyMs * latencyVariance))
            };
        });

        telemetryCache.set("live_regions", dynamicMockRegions);
        return;
    }

    console.log("[Telemetry] Fetching live grid data from Electricity Maps...");

    for (const region of liveRegions) {
        try {
            const url = `https://api.electricitymaps.com/v3/carbon-intensity/latest?zone=${region.gridZone}`;
            const response = await fetch(url, {
                headers: { 'auth-token': apiKey }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && typeof data.carbonIntensity === 'number') {
                    region.carbonIntensity = data.carbonIntensity;
                    console.log(`[Telemetry] ${region.location} (${region.gridZone}) -> ${data.carbonIntensity} gCO2/kWh`);
                }
            } else {
                console.warn(`[Telemetry] HTTP ${response.status} for ${region.location}`);
            }
        } catch (error) {
            console.error(`[Telemetry] Failed to fetch data for ${region.location}:`, error);
        }
    }

    telemetryCache.set("live_regions", liveRegions);
    console.log("[Telemetry] Live grid update cycle completed.");
};