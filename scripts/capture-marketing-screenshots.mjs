import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9223);
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173';
const outDir = new URL('../marketing/screenshots/', import.meta.url);
const userDataDir = `/private/tmp/medai-marketing-chrome-${Date.now()}`;

const now = new Date();
const iso = now.toISOString();

const draftContent = JSON.stringify({
  findings: [
    {
      region: 'Right lower lung zone',
      description: 'Airspace opacity flagged for radiologist review; correlate with clinical picture.',
      severity: 'MODERATE',
      confidence: 0.74,
    },
    {
      region: 'Cardiomediastinal silhouette',
      description: 'No acute enlargement flagged in the draft report.',
      severity: 'LOW',
      confidence: 0.62,
    },
  ],
  impression: 'Draft impression prepared for clinician review. No patient-facing report is released until sign-off.',
  icd10Codes: ['J18.9'],
  recommendations: ['Review prior imaging before final signature.', 'Confirm clinical correlation in final report.'],
  urgency: 'URGENT',
});

const pendingReview = {
  id: 'review-synthetic-001',
  analysisId: 'analysis-synthetic-001',
  patientId: 'patient-synthetic-001',
  patientName: 'Synthetic Patient',
  analysisType: 'RADIOLOGY',
  status: 'IN_REVIEW',
  claimedBy: null,
  claimedAt: null,
  signedBy: null,
  signedAt: null,
  reviewAction: null,
  rejectionReason: null,
  draftContent,
  finalContent: null,
  sections: [
    { section: 'FINDINGS', text: 'Right lower lung zone opacity flagged for radiologist review.' },
    { section: 'IMPRESSION', text: 'Draft impression awaiting licensed clinician sign-off.' },
  ],
  amendsReviewId: null,
  createdAt: new Date(now.getTime() - 42 * 60_000).toISOString(),
};

const signedReview = {
  ...pendingReview,
  id: 'review-synthetic-002',
  status: 'SIGNED',
  signedBy: 'Dr. Reviewer',
  signedAt: new Date(now.getTime() - 3 * 60 * 60_000).toISOString(),
  reviewAction: 'EDITED',
  finalContent: 'FINDINGS\nRight lower lung zone opacity. Reviewed and edited by clinician.\n\nIMPRESSION\nClinician-signed final report.',
  createdAt: new Date(now.getTime() - 5 * 60 * 60_000).toISOString(),
};

function page(content) {
  return {
    content,
    page: 0,
    size: 50,
    totalElements: content.length,
    totalPages: 1,
    last: true,
  };
}

function ok(data) {
  return { success: true, data, message: 'ok' };
}

function mockApi(url) {
  const path = new URL(url).pathname;

  if (path === '/api/auth/refresh') {
    return ok({
      accessToken: 'synthetic-token',
      userId: 'user-synthetic',
      tenantId: 'tenant-synthetic',
      email: 'doctor@example.invalid',
      fullName: 'Dr. Ananya Rao',
      role: 'DOCTOR',
      tenantName: 'Design Partner Hospital',
    });
  }

  if (path === '/api/analytics') {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getTime() - (29 - i) * 86400_000);
      const count = [7, 8, 10, 9, 12, 14, 11, 13, 16, 15, 18, 21, 19, 23, 25, 22, 24, 28, 26, 29, 31, 30, 33, 35, 32, 34, 36, 39, 41, 38][i];
      return {
        date: d.toISOString().slice(0, 10),
        count,
        completed: Math.max(0, count - (i % 4)),
        failed: i % 8 === 0 ? 1 : 0,
      };
    });
    return ok({
      summary: {
        totalPatients: 248,
        totalFiles: 913,
        totalAnalyses: 782,
        completedAnalyses: 731,
        pendingAnalyses: 36,
        failedAnalyses: 15,
        totalEstimatedCost: 129.42,
        unreadNotifications: 3,
      },
      analysesPerDay: days,
      topDiagnoses: [
        { analysisType: 'RADIOLOGY_QA', count: 318, percentage: 41 },
        { analysisType: 'REPORT_SIGNOFF', count: 229, percentage: 29 },
        { analysisType: 'PRIOR_COMPARISON', count: 144, percentage: 18 },
        { analysisType: 'CRITICAL_REVIEW', count: 91, percentage: 12 },
      ],
      modelUsage: [
        { modelName: 'report-qa-default', analysisCount: 522, totalTokens: 842000, totalCost: 94.1 },
        { modelName: 'rag-protocols', analysisCount: 260, totalTokens: 391000, totalCost: 35.32 },
      ],
    });
  }

  if (path === '/api/reports/summary') {
    return ok({
      awaitingReview: 18,
      inReview: 6,
      signedToday: 42,
      openEscalations: 2,
      acceptedAllTime: 384,
      editedAllTime: 211,
      rejectedAllTime: 37,
    });
  }

  if (path === '/api/reports/worklist') return ok(page([pendingReview]));
  if (path === '/api/reports/signed') return ok(page([signedReview]));

  if (path === '/api/reports/critical') {
    return ok([
      {
        id: 'critical-synthetic-001',
        analysisId: 'analysis-synthetic-critical',
        patientId: 'patient-synthetic-001',
        patientName: 'Synthetic Patient',
        urgency: 'CRITICAL',
        findingSummary: 'Critical finding queued for clinician acknowledgement',
        status: 'OPEN',
        escalationLevel: 1,
        lastNotifiedAt: new Date(now.getTime() - 14 * 60_000).toISOString(),
        acknowledgedBy: null,
        acknowledgedAt: null,
        actionTaken: null,
        createdAt: new Date(now.getTime() - 14 * 60_000).toISOString(),
      },
    ]);
  }

  if (path === '/api/notifications') {
    return ok({
      notifications: [
        {
          id: 'notification-001',
          type: 'CRITICAL_RESULT',
          title: 'Critical result awaiting acknowledgement',
          message: 'Synthetic critical result queued for clinician review.',
          severity: 'CRITICAL',
          isRead: false,
          relatedEntityType: 'REPORT_REVIEW',
          relatedEntityId: 'review-synthetic-001',
          createdAt: new Date(now.getTime() - 11 * 60_000).toISOString(),
        },
      ],
      unreadCount: 1,
      totalElements: 1,
      totalPages: 1,
      currentPage: 0,
    });
  }

  if (path === '/api/notifications/unread-count') return ok({ count: 1 });

  if (path === '/api/patients') {
    return ok(page([
      {
        id: 'patient-synthetic-001',
        firstName: 'Synthetic',
        lastName: 'Patient',
        medicalRecordNumber: 'MRN-SYN-001',
        dateOfBirth: '1984-04-18',
        gender: 'OTHER',
        phoneNumber: null,
        email: null,
        address: null,
        emergencyContact: null,
        medicalHistory: 'Synthetic capture record',
        allergies: 'None recorded in synthetic data',
        createdAt: iso,
        updatedAt: iso,
      },
    ]));
  }

  return ok(null);
}

function makeAccept(key) {
  return createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
}

class CdpSocket {
  constructor(wsUrl) {
    this.url = new URL(wsUrl);
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.buffer = Buffer.alloc(0);
    this.handshaken = false;
    this.fragments = [];
  }

  async connect() {
    const key = randomBytes(16).toString('base64');
    await new Promise((resolve, reject) => {
      this.socket = net.createConnection(Number(this.url.port || 80), this.url.hostname, () => {
        this.socket.write([
          `GET ${this.url.pathname}${this.url.search} HTTP/1.1`,
          `Host: ${this.url.host}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'));
      });
      this.socket.once('error', reject);
      this.socket.on('data', (chunk) => this.onData(chunk, key, resolve, reject));
      this.socket.on('close', () => {
        for (const { reject } of this.pending.values()) reject(new Error('CDP socket closed'));
        this.pending.clear();
      });
    });
  }

  on(method, handler) {
    this.handlers.set(method, handler);
  }

  onData(chunk, key, resolve, reject) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.handshaken) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = this.buffer.slice(0, headerEnd).toString('utf8');
      this.buffer = this.buffer.slice(headerEnd + 4);
      if (!header.startsWith('HTTP/1.1 101') || !header.includes(makeAccept(key))) {
        reject(new Error(`Bad WebSocket handshake: ${header}`));
        return;
      }
      this.handshaken = true;
      resolve();
    }
    this.parseFrames();
  }

  parseFrames() {
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const opcode = b0 & 0x0f;
      let len = this.buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        len = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      const masked = Boolean(this.buffer[1] & 0x80);
      const maskOffset = masked ? 4 : 0;
      if (this.buffer.length < offset + maskOffset + len) return;
      let payload = this.buffer.slice(offset + maskOffset, offset + maskOffset + len);
      if (masked) {
        const mask = this.buffer.slice(offset, offset + 4);
        payload = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]));
      }
      this.buffer = this.buffer.slice(offset + maskOffset + len);

      if (opcode === 8) {
        this.socket.end();
        return;
      }
      if (opcode === 9) {
        this.writeFrame(payload, 0x0a);
        continue;
      }
      if (opcode === 0x1) {
        this.handleText(payload.toString('utf8'));
      } else if (opcode === 0x0) {
        this.fragments.push(payload);
        const fin = Boolean(b0 & 0x80);
        if (fin) {
          const joined = Buffer.concat(this.fragments);
          this.fragments = [];
          this.handleText(joined.toString('utf8'));
        }
      }
    }
  }

  handleText(text) {
    const msg = JSON.parse(text);
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    const handler = this.handlers.get(msg.method);
    if (handler) void handler(msg.params);
  }

  writeFrame(payload, opcode = 0x1) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    let headerLength = 2;
    if (data.length >= 126 && data.length < 65536) headerLength = 4;
    if (data.length >= 65536) headerLength = 10;
    const frame = Buffer.alloc(headerLength + 4 + data.length);
    frame[0] = 0x80 | opcode;
    if (data.length < 126) {
      frame[1] = 0x80 | data.length;
    } else if (data.length < 65536) {
      frame[1] = 0x80 | 126;
      frame.writeUInt16BE(data.length, 2);
    } else {
      frame[1] = 0x80 | 127;
      frame.writeBigUInt64BE(BigInt(data.length), 2);
    }
    const mask = randomBytes(4);
    mask.copy(frame, headerLength);
    for (let i = 0; i < data.length; i += 1) {
      frame[headerLength + 4 + i] = data[i] ^ mask[i % 4];
    }
    this.socket.write(frame);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.writeFrame(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  close() {
    this.socket.end();
  }
}

async function waitForChrome() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Chrome did not expose a debug endpoint');
}

async function makeTarget() {
  const response = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' }
  );
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}

async function capture(route, fileName, viewport = { width: 1440, height: 1040 }) {
  const target = await makeTarget(route);
  const cdp = new CdpSocket(target.webSocketDebuggerUrl);
  await cdp.connect();

  cdp.on('Fetch.requestPaused', async (event) => {
    const { requestId, request } = event;
    try {
      if (request.url.includes('/api/')) {
        const body = Buffer.from(JSON.stringify(mockApi(request.url))).toString('base64');
        await cdp.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responsePhrase: 'OK',
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: appUrl },
            { name: 'Access-Control-Allow-Credentials', value: 'true' },
          ],
          body,
        });
      } else {
        await cdp.send('Fetch.continueRequest', { requestId });
      }
    } catch (error) {
      if (!String(error).includes('Invalid InterceptionId')) throw error;
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: '*', requestStage: 'Request' }],
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', { url: `${appUrl}${route}` });
  await new Promise((resolve) => setTimeout(resolve, 3500));

  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  await writeFile(new URL(fileName, outDir), Buffer.from(result.data, 'base64'));
  cdp.close();
}

await mkdir(outDir, { recursive: true });
await rm(userDataDir, { recursive: true, force: true });

async function cleanupUserDataDir() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1040',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-background-networking',
  '--disable-sync',
  '--disable-features=Translate,OptimizationHints',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let stderr = '';
chrome.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForChrome();
  console.log('Capturing /dashboard');
  await capture('/dashboard', 'app-dashboard.png');
  console.log('Capturing /clinical-workspace');
  await capture('/clinical-workspace', 'app-clinical-workspace.png');
  console.log('Capturing /worklist');
  await capture('/worklist', 'app-worklist.png');
  console.log('Capturing /qa-analytics');
  await capture('/qa-analytics', 'app-qa-analytics.png');
  console.log('Capturing /integrations');
  await capture('/integrations', 'app-integrations.png');
  console.log('Captured screenshots in marketing/screenshots');
} catch (error) {
  console.error(stderr);
  throw error;
} finally {
  chrome.kill();
  await cleanupUserDataDir();
}
