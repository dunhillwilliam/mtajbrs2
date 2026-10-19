import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createLocalD1 } from './dev/local-d1.js';

// Load environment variables from .env if present
dotenv.config();

// Handlers from functions/api
import * as authLogin from './functions/api/auth/login.js';
import * as authVerify from './functions/api/auth/verify.js';
import * as batchesIndex from './functions/api/batches/index.js';
import * as batchesId from './functions/api/batches/[id].js';
import * as groupsIndex from './functions/api/groups/index.js';
import * as groupsId from './functions/api/groups/[id].js';
import * as membersIndex from './functions/api/members/index.js';
import * as membersId from './functions/api/members/[id].js';
import * as eventsIndex from './functions/api/events/index.js';
import * as eventsId from './functions/api/events/[id].js';
import * as eventsIdGroups from './functions/api/events/[id]/groups.js';
import * as attendanceEvent from './functions/api/attendance/[event].js';
import * as stats from './functions/api/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Local D1 substitute for development. Uses an on-disk SQLite file so data
// survives restarts; apply schema.sql/seed.sql to it with the npm scripts.
const DB_PATH = process.env.LOCAL_D1_PATH || path.join(__dirname, '.wrangler', 'local-d1.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const localD1 = createLocalD1(DB_PATH);
const env = { ...process.env, DB: localD1 };

app.use(express.json());

// Adapter function bridging Express req/res to Cloudflare Pages Functions onRequest* handlers
function adapt(handler) {
  if (!handler) {
    return (req, res) => res.status(405).json({ error: 'Method not allowed' });
  }

  return async (req, res) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${PORT}`;
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined) {
          if (Array.isArray(v)) {
            v.forEach(val => headers.append(k, val));
          } else {
            headers.set(k, String(v));
          }
        }
      }

      let body = undefined;
      if (!['GET', 'HEAD'].includes(req.method)) {
        body = req.body !== undefined ? JSON.stringify(req.body) : '{}';
      }

      const webReq = new Request(fullUrl, {
        method: req.method,
        headers,
        body,
      });

      const context = {
        request: webReq,
        env,
        params: req.params,
        waitUntil: () => {},
      };

      const response = await handler(context);
      res.status(response.status);
      response.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });
      const responseText = await response.text();
      res.send(responseText);
    } catch (err) {
      console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  };
}

// Auth API routes
app.post('/api/auth/login', adapt(authLogin.onRequestPost));
app.get('/api/auth/verify', adapt(authVerify.onRequestGet));

// Batches API routes
app.get('/api/batches', adapt(batchesIndex.onRequestGet));
app.post('/api/batches', adapt(batchesIndex.onRequestPost));
app.put('/api/batches/:id', adapt(batchesId.onRequestPut));
app.delete('/api/batches/:id', adapt(batchesId.onRequestDelete));

// Groups API routes
app.get('/api/groups', adapt(groupsIndex.onRequestGet));
app.post('/api/groups', adapt(groupsIndex.onRequestPost));
app.put('/api/groups/:id', adapt(groupsId.onRequestPut));
app.delete('/api/groups/:id', adapt(groupsId.onRequestDelete));

// Members API routes
app.get('/api/members', adapt(membersIndex.onRequestGet));
app.post('/api/members', adapt(membersIndex.onRequestPost));
app.put('/api/members/:id', adapt(membersId.onRequestPut));
app.delete('/api/members/:id', adapt(membersId.onRequestDelete));

// Events API routes
app.get('/api/events', adapt(eventsIndex.onRequestGet));
app.post('/api/events', adapt(eventsIndex.onRequestPost));
app.put('/api/events/:id', adapt(eventsId.onRequestPut));
app.delete('/api/events/:id', adapt(eventsId.onRequestDelete));

// Event Groups API routes
app.get('/api/events/:id/groups', adapt(eventsIdGroups.onRequestGet));
app.post('/api/events/:id/groups', adapt(eventsIdGroups.onRequestPost));

// Attendance API routes (Public)
app.get('/api/attendance/:event', adapt(attendanceEvent.onRequestGet));
app.post('/api/attendance/:event', adapt(attendanceEvent.onRequestPost));

// Stats API route
app.get('/api/stats', adapt(stats.onRequestGet));

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route redirect to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
