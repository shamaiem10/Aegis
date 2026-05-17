/** Deployed PK emergency resource inventory (curated + OSM). */
export const PK_RESOURCES_DEPLOYED_URL =
  "https://pk-resource-inventory-api.vercel.app";

export function pkResourcesDeployedBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PK_RESOURCES_URL?.trim();
  return (fromEnv || PK_RESOURCES_DEPLOYED_URL).replace(/\/$/, "");
}
