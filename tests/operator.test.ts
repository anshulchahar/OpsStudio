import assert from "node:assert/strict";
import test from "node:test";
import { operatorDetails, retentionDays } from "../src/lib/operator.ts";

test("operator information never invents an identity or contact details", () => {
  assert.deepEqual(operatorDetails({}), { name: null, email: null, address: null, country: null, configured: false });
});

test("incomplete or invalid operator contact keeps publication prerequisites incomplete", () => {
  const partial = { OPERATOR_NAME: "An operator", OPERATOR_POSTAL_ADDRESS: "A provided address", OPERATOR_COUNTRY: "A provided country" };
  assert.equal(operatorDetails(partial).configured, false);
  assert.equal(operatorDetails({ ...partial, OPERATOR_EMAIL: "not an email" }).configured, false);
  assert.equal(operatorDetails({ OPERATOR_NAME: " ", OPERATOR_EMAIL: "person@example.invalid" }).configured, false);
});

test("operator details publish only the explicitly supplied, validated values", () => {
  assert.deepEqual(operatorDetails({ OPERATOR_NAME: "  Example Operator  ", OPERATOR_EMAIL: " contact@example.invalid ", OPERATOR_POSTAL_ADDRESS: " Provided address ", OPERATOR_COUNTRY: " Provided country " }), { name: "Example Operator", email: "contact@example.invalid", address: "Provided address", country: "Provided country", configured: true });
});

test("retention disclosures and maintenance share the same documented defaults", () => {
  assert.deepEqual(retentionDays({}), { ai: 90, labs: 90, usage: 90, billingEvents: 90, operations: 30 });
});

test("retention configuration accepts whole-day bounds and rejects invalid values", () => {
  assert.deepEqual(retentionDays({ AI_RETENTION_DAYS: "1", LAB_RETENTION_DAYS: "3650", USAGE_RETENTION_DAYS: "0", STRIPE_EVENT_RETENTION_DAYS: "9999", OPERATIONS_RETENTION_DAYS: "2.5" }), { ai: 1, labs: 3650, usage: 90, billingEvents: 90, operations: 30 });
  assert.equal(retentionDays({ AI_RETENTION_DAYS: "NaN" }).ai, 90);
  assert.equal(retentionDays({ AI_RETENTION_DAYS: "-1" }).ai, 90);
});
