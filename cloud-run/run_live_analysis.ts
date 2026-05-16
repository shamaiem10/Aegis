import * as dotenv from 'dotenv';
dotenv.config();
import { db } from './src/firebase-admin';
import { searchCrisisSignals, getRedditCrisisSignals } from './src/apis/social';
import { getWeatherData } from './src/apis/weather';
import { syncResourceInventoryToFirestore, compactUnitsForAgent } from './src/apis/resourceInventoryClient';
import { generateGeminiJson } from './src/antigravity/geminiGenerate';
import fs from 'fs';
import path from 'path';

async function main() {
    console.log("Fetching live resource inventory...");
    const inventory = await syncResourceInventoryToFirestore(false);
    const compactResources = compactUnitsForAgent(inventory.units);
    
    console.log("Fetching live signals...");
    const [twitter, reddit, weather] = await Promise.allSettled([
        searchCrisisSignals(),
        getRedditCrisisSignals(),
        getWeatherData(33.6844, 73.0479)
    ]);
    
    let allSignals: any[] = [];
    if (twitter.status === 'fulfilled') allSignals.push(...twitter.value);
    if (reddit.status === 'fulfilled') allSignals.push(...reddit.value);
    if (weather.status === 'fulfilled') allSignals.push(weather.value);

    // Filter to limit tokens
    const compactSignals = allSignals.slice(0, 15).map((s: any) => ({
        id: s.id || 'unknown',
        text: String(s.text ?? s.summary ?? "").slice(0, 160),
        source: s.sourceType ?? s.source,
        urgency: s.severity_hint ?? s.urgencyScore ?? 5
    }));

    console.log(`Analyzing ${compactSignals.length} signals against ${compactResources.length} resource units...`);

    const instruction = `You are a Global Incident Commander for Aegis Pakistan.
You are given a list of ALL current live incoming alerts (signals) and the CURRENT resource inventory available in Islamabad/Rawalpindi.

Task:
1. Perform an agent analysis on these signals to understand the ground reality.
2. Assign a priority level (CRITICAL, HIGH, MEDIUM, LOW) to EVERY alert based on its text and urgency.
3. Based on the priorities, generate a coordinated action plan for EACH alert, explicitly assigning units from the provided current resources. Do not invent resource units that don't exist in the list.

Output strict JSON only:
{
  "globalAnalysis": "A 3-sentence summary of the overall situation",
  "alerts": [
    {
      "signalId": "...",
      "alertSummary": "...",
      "priority": "CRITICAL",
      "rationale": "...",
      "actionPlan": {
        "phases": [
          {
            "name": "...",
            "actions": ["..."],
            "owner": "...",
            "assignedResourceUnitId": "...",
            "etaMin": 15
          }
        ]
      }
    }
  ]
}`;

    const inputData = {
        currentResources: compactResources,
        incomingAlerts: compactSignals
    };

    console.log("Calling Gemini to generate the global action plan...");
    const result = await generateGeminiJson({ instruction, input: inputData });

    console.log("Writing results to markdown artifact...");
    
    let md = `# Live Aegis Global Operations Desk\n\n`;
    md += `## Global Analysis\n${result.globalAnalysis}\n\n`;
    md += `## Prioritized Alerts & Action Plans\n\n`;
    
    for (const alert of ((result as any).alerts || [])) {
        md += `### [${alert.priority}] ${alert.alertSummary} (ID: \`${alert.signalId}\`)\n`;
        md += `**Rationale:** ${alert.rationale}\n\n`;
        md += `**Action Plan:**\n`;
        for (const phase of (alert.actionPlan?.phases || [])) {
            md += `- **${phase.name}** (Owner: ${phase.owner}, ETA: ${phase.etaMin}m)\n`;
            md += `  - Actions: ${phase.actions.join(', ')}\n`;
            md += `  - Resource Deployed: \`${phase.assignedResourceUnitId || 'None'}\`\n`;
        }
        md += `\n---\n\n`;
    }

    const artifactPath = "C:\\Users\\shama\\.gemini\\antigravity\\brain\\38788fbf-e7c6-43a5-a7d6-2c14b2c19397\\live_action_plans.md";
    fs.writeFileSync(artifactPath, md, 'utf8');
    console.log("Artifact created successfully!");
}

main().catch(console.error);
