import { getApiBase } from "../../src/api/client";

export async function approveAndDispatchAlert(alertId: string) {
  const base = await getApiBase();
  const approveUrl = `${base}/api/alerts/approve`;

  const approveRes = await fetch(approveUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId }),
  });

  if (!approveRes.ok) {
    let errText = await approveRes.text();
    try {
      const j = JSON.parse(errText);
      if (j.error) errText = j.error;
    } catch {}
    throw new Error(`Failed to approve alert: ${errText}`);
  }

  const url = `${base}/api/alerts/send`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId })
  });

  if (!res.ok) {
    let errText = await res.text();
    try {
      const j = JSON.parse(errText);
      if (j.error) errText = j.error;
    } catch {}
    throw new Error(`Failed to dispatch alert: ${errText}`);
  }

  return await res.json();
}
