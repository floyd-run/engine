import { normalizePolicyConfig } from "./normalize";
import { canonicalizePolicyConfig, hashPolicyConfig } from "./canonicalize";
import { validatePolicyConfig, type PolicyWarning } from "./validate";

export function preparePolicyConfig(raw: Record<string, unknown>): {
  normalized: Record<string, unknown>;
  configHash: string;
  warnings: PolicyWarning[];
} {
  const normalized = normalizePolicyConfig(raw);
  const { warnings } = validatePolicyConfig(normalized);
  const canonicalJson = canonicalizePolicyConfig(normalized);
  const configHash = hashPolicyConfig(canonicalJson);
  return { normalized, configHash, warnings };
}
