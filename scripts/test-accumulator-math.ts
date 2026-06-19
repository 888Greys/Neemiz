import assert from "node:assert/strict";
import { barrierFracFor } from "../lib/accumulator";

// Regression for the live R_10 5% contract that was incorrectly widened to a
// 0.05% barrier. Its measured sigma requires an approximately 0.00509% band.
const sigma = 0.000025703806486450255;
const barrier = barrierFracFor(sigma, 5);
const expected = 0.000050912876117766703;

assert.ok(Math.abs(barrier - expected) < 1e-12, `expected ${expected}, received ${barrier}`);
assert.ok(barrier < 0.0005, "low-volatility barriers must not be widened to 0.05%");

console.log("Accumulator barrier regression check passed.");
