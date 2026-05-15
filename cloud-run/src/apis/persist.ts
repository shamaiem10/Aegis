/**
 * Safe Firestore merges — never throw; callers always get network data even if writes fail.
 */
import * as admin from "firebase-admin";

import { db } from "../firebase-admin";

export async function mergeSignalDoc(docId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await db
      .collection("signals")
      .doc(docId)
      .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn("[mergeSignalDoc]", docId, e);
  }
}

export async function mergeApiHealthDoc(docId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await db
      .collection("apiHealth")
      .doc(docId)
      .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn("[mergeApiHealthDoc]", docId, e);
  }
}

/** Abort every outbound HTTP call at 8s */
export const fetchTimeoutMs = 8000;

export function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const signal = AbortSignal.timeout(fetchTimeoutMs);
  return fetch(url, { ...init, signal });
}
