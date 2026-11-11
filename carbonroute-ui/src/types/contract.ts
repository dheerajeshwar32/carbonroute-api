/**
 * CarbonRoute Shared Contract Specification
 * Strictly mirrors the OpenAPI 3.1 contract from carbonroute-api.
 */

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
  version: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }> | Record<string, unknown> | null;
}

export interface ApiErrorResponse {
  success: false;
  status: 'error';
  code: string;
  message: string;
  error: ApiErrorDetail;
  details?: Array<{ field: string; message: string }> | null;
  request_id?: string;
  meta: ResponseMeta;
}

export interface RegionSnapshot {
  id: string;
  location: string;
  grid_zone: string;
  latency_ms: number;
  latency_source: 'measured' | 'fallback' | 'static_baseline';
  latency_updated_at: string | null;
  carbon_intensity: number;
  carbon_source: 'live' | 'fallback' | 'static_baseline';
  carbon_updated_at: string | null;
  cost_per_1k_tokens: number;
}

export interface CandidateEvaluation extends RegionSnapshot {
  normalized_carbon: number | null;
  normalized_cost: number | null;
  normalized_latency: number | null;
  score: number | null;
  rank: number | null;
  status: 'selected' | 'eligible' | 'excluded';
  excluded_reason?: string | null;
}

export interface RoutingPolicy {
  max_latency_ms: number;
  carbon_weight: number;
  cost_weight: number;
  latency_weight: number;
}

export interface FailoverAttempt {
  region: string;
  status: number | null;
  error: string;
}

export interface RoutingView {
  policy: RoutingPolicy;
  baseline_region: string;
  candidates: CandidateEvaluation[];
  failover?: FailoverAttempt[];
}

export interface ImpactView {
  baseline_region: string;
  baseline_location: string;
  baseline_carbon_intensity: number;
  carbon_saved_pct: number;
  estimated_emissions_g: number;
  estimated_emissions_avoided_g: number;
  energy_per_request_wh: number;
}

export interface TelemetryView {
  latency_ms: number;
  network_rtt_ms: number;
  latency_source: string;
  cost_per_1k_tokens: number;
  live_carbon_intensity: number;
  carbon_intensity: number;
  carbon_source: string;
  carbon_updated_at: string | null;
}

export interface TokenUsage {
  prompt_tokens: number | null;
  output_tokens: number | null;
}

export interface InferenceSuccessResponse {
  success: true;
  status: 'success';
  meta: ResponseMeta;
  request_id: string;
  cache_hit: boolean;
  execution_mode: 'regional' | 'simulated' | 'cache';
  model: string;
  routed_to: string;
  location: string;
  telemetry: TelemetryView;
  impact: ImpactView;
  routing: RoutingView;
  usage: TokenUsage | null;
  data: string;
}

export interface SLAConfigPayload {
  max_latency_ms: number;
  carbon_priority_weight?: number;
  cost_priority_weight?: number;
  latency_priority_weight?: number;
}

export interface InferenceRequestPayload {
  prompt: string;
  model?: string;
  sla: SLAConfigPayload;
}

export interface HealthResponse {
  success: true;
  status: 'ok';
  meta: ResponseMeta;
  uptime_s: number;
  execution_mode: 'regional' | 'simulated';
  cache: 'up' | 'down' | 'disabled';
  telemetry: {
    live: boolean;
    last_updated_at: string | null;
    is_updating: boolean;
    provider: string;
    region_count: number;
  };
}

export interface RegionsResponse {
  success: true;
  status: 'success';
  meta: ResponseMeta;
  execution_mode: string;
  default_model: string;
  allowed_models: string[];
  energy_per_request_wh: number;
  telemetry: Record<string, unknown>;
  regions: RegionSnapshot[];
}

// Session Impact Ledger Types
export interface SessionLedgerItem {
  id: string;
  timestamp: string;
  prompt: string;
  model: string;
  routedTo: string;
  location: string;
  cacheHit: boolean;
  latencyMs: number;
  carbonIntensity: number;
  emissionsSavedG: number;
  emissionsGeneratedG: number;
  dirtiestRegion: string;
  dirtiestCarbon: number;
  requestId: string;
}

export interface SessionLedgerSummary {
  totalRequests: number;
  cacheHits: number;
  cacheHitRatio: number;
  cumulativeEmissionsSavedG: number;
  cumulativeEmissionsGeneratedG: number;
  history: SessionLedgerItem[];
}

export interface TelemetryExportPayload {
  exportedAt: string;
  clientApp: string;
  version: string;
  summary: {
    totalRequests: number;
    cacheHits: number;
    cacheHitRatioPct: number;
    cumulativeEmissionsSavedG: number;
    cumulativeEmissionsGeneratedG: number;
  };
  ledger: SessionLedgerItem[];
}
