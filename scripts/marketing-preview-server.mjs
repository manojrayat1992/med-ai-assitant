// Local-only screenshot fixtures. No real API, patient data or credentials.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
const root=resolve('frontend/dist');
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

  if (path === '/api/integrations/connectors') return ok([]);

  if (path === '/api/auth/refresh') {
    return ok({
      accessToken: 'synthetic-token',
      userId: 'user-synthetic',
      tenantId: 'tenant-synthetic',
      email: 'doctor@example.invalid',
      fullName: 'Dr. Ananya Rao',
      role: 'HOSPITAL_ADMIN',
      tenantName: 'Synthetic Demo Workspace',
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


const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.gz':'application/octet-stream','.bin':'application/octet-stream','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4191');
 if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(mockApi(url.href)));return;}
 try{
  let path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!path.startsWith(root+'/'))path=root+'/index.html';
  let body;try{body=await readFile(path)}catch{if(extname(path)){res.writeHead(404);res.end();return;}path=root+'/index.html';body=await readFile(path);}
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(500);res.end();}
}).listen(4191,'127.0.0.1',()=>console.log('Synthetic app preview on port 4191'));
