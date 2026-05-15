"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTimeoutMs = void 0;
exports.mergeSignalDoc = mergeSignalDoc;
exports.mergeApiHealthDoc = mergeApiHealthDoc;
exports.fetchWithTimeout = fetchWithTimeout;
/**
 * Safe Firestore merges — never throw; callers always get network data even if writes fail.
 */
const admin = __importStar(require("firebase-admin"));
const firebase_admin_1 = require("../firebase-admin");
async function mergeSignalDoc(docId, data) {
    try {
        await firebase_admin_1.db
            .collection("signals")
            .doc(docId)
            .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    catch (e) {
        console.warn("[mergeSignalDoc]", docId, e);
    }
}
async function mergeApiHealthDoc(docId, data) {
    try {
        await firebase_admin_1.db
            .collection("apiHealth")
            .doc(docId)
            .set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    catch (e) {
        console.warn("[mergeApiHealthDoc]", docId, e);
    }
}
/** Abort every outbound HTTP call at 8s */
exports.fetchTimeoutMs = 8000;
function fetchWithTimeout(url, init) {
    const signal = AbortSignal.timeout(exports.fetchTimeoutMs);
    return fetch(url, { ...init, signal });
}
