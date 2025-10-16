require('dotenv').config();

const path = require('path');
const { createExpressApp } = require('../lib/createExpressApp');

const projectRoot = path.join(__dirname, '..');

module.exports = createExpressApp({ projectRoot });
