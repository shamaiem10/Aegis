"use strict";

/**
 * Vercel serverless entry — build must run first (`npm run build`) so `dist/createApp.js` exists.
 */
const serverless = require("serverless-http");

const { createApp } = require("../dist/createApp");

module.exports = serverless(createApp());
