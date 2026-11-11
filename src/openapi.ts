/**
 * CarbonRoute API — OpenAPI 3.1.0 Specification
 * Full formal API contract for the Sustainable Inference Routing Proxy Gateway.
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'CarbonRoute Inference Routing Gateway API',
    version: '1.0.0',
    description:
      'Sustainable, SLA-aware multi-objective generative AI inference routing proxy. Dynamically dispatches inference workloads to the cleanest global cloud data centers based on live regional power grid telemetry from Electricity Maps, enforcing strict latency SLAs and zero-emission edge caching.',
    contact: {
      name: 'Nagula Dheeraj Eshwar Prudhvi',
      url: 'https://github.com/dheerajeshwar32',
    },
    license: {
      name: 'ISC',
      url: 'https://opensource.org/licenses/ISC',
    },
  },
  servers: [
    {
      url: 'https://carbonroute-ipqv.onrender.com',
      description: 'Production API Gateway (Render)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server',
    },
  ],
  tags: [
    {
      name: 'Inference',
      description: 'SLA-constrained green LLM inference routing and execution',
    },
    {
      name: 'Telemetry',
      description: 'Live global cloud region grid carbon and latency metrics',
    },
    {
      name: 'System',
      description: 'Health checks and gateway readiness monitoring',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Service Health & Dependency Status',
        description:
          'Returns real-time gateway health, uptime, active execution mode, Redis edge cache readiness, and background telemetry worker state.',
        tags: ['System'],
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Gateway is healthy and operational',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/regions': {
      get: {
        summary: 'Live Global Region Telemetry Snapshot',
        description:
          'Returns live grid carbon intensity (gCO2e/kWh), roundtrip latency (ms), and pricing across all active cloud data centers.',
        tags: ['Telemetry'],
        operationId: 'getRegions',
        responses: {
          '200': {
            description: 'Current global compute region telemetry snapshot',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegionsResponse' },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/inference': {
      post: {
        summary: 'Route and Execute AI Inference Workload',
        description:
          'Evaluates multi-objective SLA priorities (carbon, cost, latency), verifies edge Redis cache, dispatches to the cleanest eligible cloud region, and returns generated text alongside exhaustive environmental impact telemetry.',
        tags: ['Inference'],
        operationId: 'postInference',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InferenceRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Inference successfully executed or served from zero-emission cache',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InferenceSuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request payload or schema validation failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '422': {
            description: 'SLA unsatisfiable (no available region meets latency constraint)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal server or routing failure',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '502': {
            description: 'Upstream LLM provider failure or all failover targets exhausted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '503': {
            description: 'Inference engine or required dependency not configured',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/openapi.json': {
      get: {
        summary: 'OpenAPI 3.1 Specification',
        description: 'Returns the full machine-readable OpenAPI 3.1 JSON specification schema.',
        tags: ['System'],
        operationId: 'getOpenApiSpec',
        responses: {
          '200': {
            description: 'OpenAPI 3.1 specification document',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ResponseMeta: {
        type: 'object',
        required: ['request_id', 'timestamp', 'version'],
        properties: {
          request_id: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
          version: { type: 'string', example: 'v1' },
        },
      },
      ErrorDetail: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'invalid_request' },
          message: { type: 'string', example: 'Validation failed.' },
          details: { type: ['array', 'object', 'null'] },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'status', 'code', 'message', 'error', 'meta'],
        properties: {
          success: { type: 'boolean', example: false },
          status: { type: 'string', example: 'error' },
          code: { type: 'string', example: 'sla_unsatisfiable' },
          message: { type: 'string', example: 'No region satisfies latency limit of 50ms.' },
          error: { $ref: '#/components/schemas/ErrorDetail' },
          details: { type: ['array', 'object', 'null'] },
          request_id: { type: 'string', format: 'uuid' },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      RegionSnapshot: {
        type: 'object',
        required: [
          'id',
          'location',
          'grid_zone',
          'latency_ms',
          'latency_source',
          'carbon_intensity',
          'carbon_source',
          'cost_per_1k_tokens',
        ],
        properties: {
          id: { type: 'string', example: 'europe-north1' },
          location: { type: 'string', example: 'Finland' },
          grid_zone: { type: 'string', example: 'FI' },
          latency_ms: { type: 'integer', example: 155 },
          latency_source: {
            type: 'string',
            enum: ['measured', 'fallback', 'static_baseline'],
            example: 'measured',
          },
          latency_updated_at: { type: ['string', 'null'], format: 'date-time' },
          carbon_intensity: { type: 'number', example: 45 },
          carbon_source: {
            type: 'string',
            enum: ['live', 'fallback', 'static_baseline'],
            example: 'live',
          },
          carbon_updated_at: { type: ['string', 'null'], format: 'date-time' },
          cost_per_1k_tokens: { type: 'number', example: 0.0004 },
        },
      },
      CandidateEvaluation: {
        allOf: [
          { $ref: '#/components/schemas/RegionSnapshot' },
          {
            type: 'object',
            required: ['normalized_carbon', 'normalized_cost', 'normalized_latency', 'score', 'rank', 'status'],
            properties: {
              normalized_carbon: { type: ['number', 'null'], example: 0.0 },
              normalized_cost: { type: ['number', 'null'], example: 0.25 },
              normalized_latency: { type: ['number', 'null'], example: 0.4 },
              score: { type: ['number', 'null'], example: 0.125 },
              rank: { type: ['integer', 'null'], example: 1 },
              status: { type: 'string', enum: ['selected', 'eligible', 'excluded'], example: 'selected' },
              excluded_reason: { type: ['string', 'null'] },
            },
          },
        ],
      },
      RoutingPolicy: {
        type: 'object',
        required: ['max_latency_ms', 'carbon_weight', 'cost_weight', 'latency_weight'],
        properties: {
          max_latency_ms: { type: 'integer', example: 200 },
          carbon_weight: { type: 'number', example: 0.5 },
          cost_weight: { type: 'number', example: 0.35 },
          latency_weight: { type: 'number', example: 0.15 },
        },
      },
      RoutingView: {
        type: 'object',
        required: ['policy', 'baseline_region', 'candidates'],
        properties: {
          policy: { $ref: '#/components/schemas/RoutingPolicy' },
          baseline_region: { type: 'string', example: 'ap-south-1' },
          candidates: {
            type: 'array',
            items: { $ref: '#/components/schemas/CandidateEvaluation' },
          },
          failover: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                region: { type: 'string' },
                status: { type: ['integer', 'null'] },
                error: { type: 'string' },
              },
            },
          },
        },
      },
      ImpactView: {
        type: 'object',
        required: [
          'baseline_region',
          'baseline_location',
          'baseline_carbon_intensity',
          'carbon_saved_pct',
          'estimated_emissions_g',
          'estimated_emissions_avoided_g',
          'energy_per_request_wh',
        ],
        properties: {
          baseline_region: { type: 'string', example: 'ap-south-1' },
          baseline_location: { type: 'string', example: 'Mumbai' },
          baseline_carbon_intensity: { type: 'number', example: 620 },
          carbon_saved_pct: { type: 'number', example: 92.7 },
          estimated_emissions_g: { type: 'number', example: 0.0108 },
          estimated_emissions_avoided_g: { type: 'number', example: 0.138 },
          energy_per_request_wh: { type: 'number', example: 0.24 },
        },
      },
      TelemetryView: {
        type: 'object',
        required: [
          'latency_ms',
          'network_rtt_ms',
          'latency_source',
          'cost_per_1k_tokens',
          'live_carbon_intensity',
          'carbon_intensity',
          'carbon_source',
        ],
        properties: {
          latency_ms: { type: 'integer', example: 142 },
          network_rtt_ms: { type: 'integer', example: 155 },
          latency_source: { type: 'string', example: 'measured' },
          cost_per_1k_tokens: { type: 'number', example: 0.0004 },
          live_carbon_intensity: { type: 'number', example: 45 },
          carbon_intensity: { type: 'number', example: 45 },
          carbon_source: { type: 'string', example: 'live' },
          carbon_updated_at: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      InferenceRequest: {
        type: 'object',
        required: ['prompt', 'sla'],
        properties: {
          prompt: {
            type: 'string',
            minLength: 1,
            maxLength: 4000,
            example: 'Explain zero-knowledge proofs in two sentences.',
          },
          model: {
            type: 'string',
            enum: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'],
            default: 'gemini-3.8-flash',
            example: 'gemini-3.8-flash',
          },
          sla: {
            type: 'object',
            required: ['max_latency_ms'],
            properties: {
              max_latency_ms: { type: 'integer', minimum: 1, maximum: 10000, example: 200 },
              carbon_priority_weight: { type: 'number', minimum: 0, maximum: 1, default: 0.5, example: 0.8 },
              cost_priority_weight: { type: 'number', minimum: 0, maximum: 1, default: 0.35, example: 0.1 },
              latency_priority_weight: { type: 'number', minimum: 0, maximum: 1, default: 0.15, example: 0.1 },
            },
          },
        },
      },
      InferenceSuccessResponse: {
        type: 'object',
        required: [
          'success',
          'status',
          'meta',
          'request_id',
          'cache_hit',
          'execution_mode',
          'model',
          'routed_to',
          'location',
          'telemetry',
          'impact',
          'routing',
          'data',
        ],
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'success' },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
          request_id: { type: 'string', format: 'uuid' },
          cache_hit: { type: 'boolean', example: false },
          execution_mode: { type: 'string', enum: ['regional', 'simulated', 'cache'], example: 'regional' },
          model: { type: 'string', example: 'gemini-3.8-flash' },
          routed_to: { type: 'string', example: 'europe-north1' },
          location: { type: 'string', example: 'Finland' },
          telemetry: { $ref: '#/components/schemas/TelemetryView' },
          impact: { $ref: '#/components/schemas/ImpactView' },
          routing: { $ref: '#/components/schemas/RoutingView' },
          usage: {
            type: ['object', 'null'],
            properties: {
              prompt_tokens: { type: ['integer', 'null'], example: 14 },
              output_tokens: { type: ['integer', 'null'], example: 42 },
            },
          },
          data: {
            type: 'string',
            example: 'A zero-knowledge proof verifies a statement is true without revealing information.',
          },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['success', 'status', 'meta', 'uptime_s', 'execution_mode', 'cache', 'telemetry'],
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'ok' },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
          uptime_s: { type: 'integer', example: 124 },
          execution_mode: { type: 'string', enum: ['regional', 'simulated'], example: 'simulated' },
          cache: { type: 'string', enum: ['up', 'down', 'disabled'], example: 'up' },
          telemetry: {
            type: 'object',
            properties: {
              live: { type: 'boolean', example: true },
              last_updated_at: { type: ['string', 'null'], format: 'date-time' },
              is_updating: { type: 'boolean', example: false },
              provider: { type: 'string', example: 'simulated_baseline' },
              region_count: { type: 'integer', example: 5 },
            },
          },
        },
      },
      RegionsResponse: {
        type: 'object',
        required: ['success', 'status', 'meta', 'execution_mode', 'default_model', 'regions'],
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'success' },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
          execution_mode: { type: 'string', example: 'simulated' },
          default_model: { type: 'string', example: 'gemini-3.8-flash' },
          allowed_models: {
            type: 'array',
            items: { type: 'string' },
            example: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'],
          },
          energy_per_request_wh: { type: 'number', example: 0.24 },
          telemetry: { type: 'object' },
          regions: {
            type: 'array',
            items: { $ref: '#/components/schemas/RegionSnapshot' },
          },
        },
      },
    },
  },
};
