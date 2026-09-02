import { MOCK_REGIONS, CloudRegion } from './regions';

export const telemetryCache = new Map<string, CloudRegion[]>();

export const startTelemetryWorker = () => {
    updateCarbonData();
    setInterval(updateCarbonData, 30 * 60 * 1000); // Poll every 30 minutes
};

const updateCarbonData = async () => {
    const liveRegions = [...MOCK_REGIONS];
    const apiKey = process.env.ELECTRICITY_MAPS_API_KEY;

    if (!apiKey) {
        console.warn("[Telemetry] ELECTRICITY_MAPS_API_KEY not found. Using fallback values.");
        telemetryCache.set("live_regions", liveRegions);
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