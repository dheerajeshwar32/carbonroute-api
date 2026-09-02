export interface CloudRegion {
    id: string;
    location: string;
    gridZone: string;
    latencyMs: number;
    costPer1kTokens: number;
    carbonIntensity: number;
}

export const MOCK_REGIONS: CloudRegion[] = [
    { id: "eu-west-1", location: "Ireland", gridZone: "IE", latencyMs: 140, costPer1kTokens: 0.0005, carbonIntensity: 190 },
    { id: "europe-north1", location: "Finland", gridZone: "FI", latencyMs: 155, costPer1kTokens: 0.0004, carbonIntensity: 45 },
    { id: "europe-west4", location: "Netherlands", gridZone: "NL", latencyMs: 145, costPer1kTokens: 0.0004, carbonIntensity: 160 },
    { id: "ap-south-1", location: "Mumbai", gridZone: "IN-WE", latencyMs: 35, costPer1kTokens: 0.0006, carbonIntensity: 620 },
    { id: "us-east-1", location: "N. Virginia", gridZone: "US-MIDA-PJM", latencyMs: 175, costPer1kTokens: 0.0003, carbonIntensity: 340 }
];