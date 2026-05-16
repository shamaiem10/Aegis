"use strict";

const serverless = require("serverless-http");
const { createApp } = require("../dist/createApp");

module.exports = serverless(createApp());
