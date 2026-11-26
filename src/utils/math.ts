/**
 * Shared mathematical utilities used across scheduler, app, and telemetry modules.
 * Consolidated here to eliminate duplication and ensure IEEE 754 rounding consistency.
 */

/**
 * Rounds a number to the specified number of decimal places using the
 * multiply-round-divide technique to avoid floating-point representation drift.
 */
export const round = (val: number, digits = 4): number => {
    const factor = 10 ** digits;
    return Math.round(val * factor) / factor;
};

/** grams CO2e = Wh × (g/kWh) / 1000 */
export const gramsFor = (energyWh: number, intensity: number): number =>
    round((energyWh * intensity) / 1000, 5);
