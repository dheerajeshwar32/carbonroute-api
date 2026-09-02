export interface CloudRegion {
    id: string;
    location: string;
    latencyMs: number;
    costPer1kTokens: number;
    carbonIntensity: number; 
}

export const MOCK_REGIONS: CloudRegion[] = [
    {
        id: "us-east-1",
        location: "N. Virginia",
        latencyMs: 180,
        costPer1kTokens: 0.0003,
        carbonIntensity: 380
    },
    {
        id: "eu-west-1",
        location: "Ireland",
        latencyMs: 140,
        costPer1kTokens: 0.0005,
        carbonIntensity: 190
    },
    {
        id: "ap-south-1",
        location: "Mumbai",
        latencyMs: 35,
        costPer1kTokens: 0.0006,
        carbonIntensity: 620
    }
];