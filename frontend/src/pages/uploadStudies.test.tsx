import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from '@/components/layout/Sidebar';
import { analysisService, type AnalysisResponse } from '@/services/analysisService';
import { fileService } from '@/services/fileService';
import { patientService } from '@/services/patientService';
import { reportService, type ReportReview } from '@/services/reportService';
import { useAuthStore } from '@/stores/authStore';
import type { MedicalFile, PagedResponse, Patient } from '@/types';
import api from '@/services/api';
import { UploadPage } from './UploadPage';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  logout: vi.fn(),
}));

vi.mock('@/services/patientService', () => ({
  patientService: {
    list: vi.fn(),
  },
}));

vi.mock('@/services/fileService', () => ({
  fileService: {
    upload: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/analysisService', async () => {
  const actual = await vi.importActual<typeof import('@/services/analysisService')>(
    '@/services/analysisService'
  );

  return {
    ...actual,
    analysisService: {
      ...actual.analysisService,
      requestImageAnalysis: vi.fn(),
      requestBloodReport: vi.fn(),
      getAnalysis: vi.fn(),
    },
  };
});

vi.mock('@/services/reportService', async () => {
  const actual = await vi.importActual<typeof import('@/services/reportService')>(
    '@/services/reportService'
  );

  return {
    ...actual,
    reportService: {
      ...actual.reportService,
      createTextDraft: vi.fn(),
      forPatient: vi.fn(),
    },
  };
});

const PATIENT_ID = '33333333-3333-4333-8333-333333333333';
const REVIEW_ID = '11111111-1111-4111-8111-111111111111';
const ANALYSIS_ID = '22222222-2222-4222-8222-222222222222';

describe('Upload Studies workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.getState().setAuth({
      accessToken: 'test-access-token',
      userId: 'doctor-user-id',
      tenantId: 'tenant-id',
      email: 'doctor@example.test',
      fullName: 'Dr. Mira Patel',
      role: 'DOCTOR',
      tenantName: 'QA Hospital',
    });
    vi.mocked(patientService.list).mockResolvedValue(paged([patient()]));
    vi.mocked(fileService.list).mockResolvedValue(paged([]));
    vi.mocked(fileService.upload).mockResolvedValue(medicalFile());
    vi.mocked(fileService.delete).mockResolvedValue(undefined);
    vi.mocked(analysisService.requestImageAnalysis).mockResolvedValue(analysisResponse());
    vi.mocked(analysisService.requestBloodReport).mockResolvedValue(analysisResponse({ analysisType: 'BLOOD_REPORT' }));
    vi.mocked(analysisService.getAnalysis).mockResolvedValue(analysisResponse({ status: 'COMPLETED' }));
    vi.mocked(reportService.createTextDraft).mockResolvedValue(reportReview());
    vi.mocked(reportService.forPatient).mockResolvedValue(paged([reportReview()]));
    vi.mocked(api.post).mockResolvedValue(apiPostResponse([]));
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().clear();
  });

  it('keeps Upload Studies in the Work sidebar order and points it at /upload', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    const workItems = screen.getAllByRole('link').map((link) => link.textContent?.trim());
    expect(workItems.slice(workItems.indexOf('Worklist'), workItems.indexOf('Patients') + 1))
      .toEqual(['Worklist', 'Upload Studies', 'Clinical Workspace', 'Patients']);
    expect(screen.getByRole('link', { name: /Upload Studies/i })).toHaveAttribute('href', '/upload');
  });

  it('renders the existing /upload page with all supported clinical input types', async () => {
    renderUploadRoute();

    expect(await screen.findByRole('heading', { name: 'Upload Studies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Single File/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Batch Studies/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paste Report Text/i })).toBeInTheDocument();

    [
      'X-Ray',
      'CT Scan',
      'MRI',
      'Ultrasound',
      'Blood Report',
      'Lab Report',
      'Prescription',
      'Discharge Summary',
      'Other Imaging',
    ].forEach((label) => {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    });
  });

  it('creates a real ReportReview draft from exact pasted text and redirects to the workspace', async () => {
    const user = userEvent.setup();
    const reportText = 'FINDINGS:\nRight lower lobe opacity.\n\nIMPRESSION:\nPneumonia.';
    renderUploadRoute();

    await user.selectOptions(await screen.findByLabelText(/Select Patient/i), PATIENT_ID);
    await user.click(screen.getByRole('button', { name: /Paste Report Text/i }));
    await user.click(screen.getByRole('button', { name: /CT Scan/i }));
    await user.type(
      screen.getByPlaceholderText(/Study description/i),
      'CT chest without contrast'
    );
    await user.type(screen.getByLabelText(/Report Text/i), reportText);
    await user.click(screen.getByRole('button', { name: /Save Draft & Open Workspace/i }));

    await waitFor(() => {
      expect(reportService.createTextDraft).toHaveBeenCalledWith({
        patientId: PATIENT_ID,
        reportText,
        modality: 'CT_SCAN',
        studyDescription: 'CT chest without contrast',
      });
    });
    expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
    expect(fileService.upload).not.toHaveBeenCalled();
  });

  it('does not submit a pasted report draft without patient and report text', async () => {
    const user = userEvent.setup();
    renderUploadRoute();

    await screen.findByLabelText(/Select Patient/i);
    await user.click(screen.getByRole('button', { name: /Paste Report Text/i }));

    expect(screen.getByRole('button', { name: /Save Draft & Open Workspace/i })).toBeDisabled();
    expect(reportService.createTextDraft).not.toHaveBeenCalled();
  });

  it('keeps the existing single-file upload behavior on /patients/{patientId}/files', async () => {
    const user = userEvent.setup();
    const study = new File(['pixel-data'], 'chest-xray.png', { type: 'image/png' });
    renderUploadRoute();

    await user.selectOptions(await screen.findByLabelText(/Select Patient/i), PATIENT_ID);
    await user.upload(screen.getByLabelText(/Single study file/i), study);

    expect(await screen.findByText('chest-xray.png')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Upload File/i }));

    await waitFor(() => {
      expect(fileService.upload).toHaveBeenCalledWith(PATIENT_ID, study, 'XRAY', undefined);
    });
    expect(await screen.findByText('File uploaded successfully!')).toBeInTheDocument();
    expect(reportService.createTextDraft).not.toHaveBeenCalled();
    expect(analysisService.requestImageAnalysis).not.toHaveBeenCalled();
  });

  it('does not show patient upload deletion controls to doctors', async () => {
    const user = userEvent.setup();
    vi.mocked(fileService.list).mockResolvedValue(paged([medicalFile()]));
    renderUploadRoute();

    await user.selectOptions(await screen.findByLabelText(/Select Patient/i), PATIENT_ID);

    expect(await screen.findByText('chest-xray.png')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete upload chest-xray\.png/i })).not.toBeInTheDocument();
  });

  it('lets hospital admins delete a patient upload from recent uploads', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(fileService.list).mockResolvedValue(paged([medicalFile()]));
    useAuthStore.getState().setAuth({
      accessToken: 'admin-access-token',
      userId: 'admin-user-id',
      tenantId: 'tenant-id',
      email: 'admin@example.test',
      fullName: 'Nadia Admin',
      role: 'HOSPITAL_ADMIN',
      tenantName: 'QA Hospital',
    });
    renderUploadRoute();

    try {
      await user.selectOptions(await screen.findByLabelText(/Select Patient/i), PATIENT_ID);
      await user.click(await screen.findByRole('button', { name: /Delete upload chest-xray\.png/i }));

      await waitFor(() => {
        expect(fileService.delete).toHaveBeenCalledWith(
          PATIENT_ID,
          '55555555-5555-4555-8555-555555555555'
        );
      });
      expect(confirmSpy).toHaveBeenCalledWith('Delete "chest-xray.png" from this patient?');
      expect(await screen.findByText('Uploaded file deleted.')).toBeInTheDocument();
      expect(screen.queryByText('chest-xray.png')).not.toBeInTheDocument();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('uploads a single study, starts analysis, and opens the generated workspace review', async () => {
    const user = userEvent.setup();
    const study = new File(['pixel-data'], 'chest-xray.png', { type: 'image/png' });
    renderUploadRoute();

    await user.selectOptions(await screen.findByLabelText(/Select Patient/i), PATIENT_ID);
    await user.upload(screen.getByLabelText(/Single study file/i), study);
    await user.click(screen.getByRole('button', { name: /Upload & Open Workspace/i }));

    await waitFor(() => {
      expect(fileService.upload).toHaveBeenCalledWith(PATIENT_ID, study, 'XRAY', undefined);
      expect(analysisService.requestImageAnalysis).toHaveBeenCalledWith(
        PATIENT_ID,
        '55555555-5555-4555-8555-555555555555',
        undefined
      );
      expect(reportService.forPatient).toHaveBeenCalledWith(PATIENT_ID, 0, 25);
    });
    expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
    expect(reportService.createTextDraft).not.toHaveBeenCalled();
  });

  it('routes lab documents through blood report analysis before opening the workspace', async () => {
    const user = userEvent.setup();
    const report = new File(['WBC,11.4,K/uL'], 'cbc.csv', { type: 'text/csv' });
    renderUploadRoute();

    await user.selectOptions(await screen.findByLabelText(/Select Patient/i), PATIENT_ID);
    await user.click(screen.getByRole('button', { name: /Lab Report/i }));
    await user.upload(screen.getByLabelText(/Single study file/i), report);
    await user.click(screen.getByRole('button', { name: /Upload & Open Workspace/i }));

    await waitFor(() => {
      expect(analysisService.requestBloodReport).toHaveBeenCalledWith(
        PATIENT_ID,
        '55555555-5555-4555-8555-555555555555',
        undefined
      );
    });
    expect(analysisService.requestImageAnalysis).not.toHaveBeenCalled();
    expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
  });

  it('queues batch uploads for generated workspace reviews and opens the worklist', async () => {
    const user = userEvent.setup();
    const first = new File(['pixel-data-a'], 'study-a.png', { type: 'image/png' });
    const second = new File(['pixel-data-b'], 'study-b.png', { type: 'image/png' });
    vi.mocked(api.post).mockResolvedValue(apiPostResponse([
      { filename: 'study-a.png', success: true, fileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      { filename: 'study-b.png', success: true, fileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    ]));
    renderUploadRoute();

    await user.selectOptions(await screen.findByLabelText(/Select Patient/i), PATIENT_ID);
    await user.click(screen.getByRole('button', { name: /Batch Studies/i }));
    await user.upload(screen.getByLabelText(/Batch study files/i), [first, second]);
    await user.click(screen.getByRole('button', { name: /Upload & Queue Reviews/i }));

    await waitFor(() => {
      expect(analysisService.requestImageAnalysis).toHaveBeenCalledTimes(2);
      expect(analysisService.requestImageAnalysis).toHaveBeenCalledWith(
        PATIENT_ID,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        undefined
      );
      expect(analysisService.requestImageAnalysis).toHaveBeenCalledWith(
        PATIENT_ID,
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        undefined
      );
    });
    expect(await screen.findByText('Worklist opened')).toBeInTheDocument();
  });
});

function renderUploadRoute() {
  return render(
    <MemoryRouter initialEntries={['/upload']}>
      <Routes>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/clinical-workspace/:reviewId" element={<div>Workspace opened</div>} />
        <Route path="/worklist" element={<div>Worklist opened</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function apiPostResponse<T>(data: T): Awaited<ReturnType<typeof api.post>> {
  return { data: { data } } as Awaited<ReturnType<typeof api.post>>;
}

function paged<T>(content: T[]): PagedResponse<T> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    last: true,
  };
}

function patient(): Patient {
  return {
    id: PATIENT_ID,
    tenantId: 'tenant-id',
    medicalRecordNumber: 'MRN-123',
    firstName: 'Asha',
    lastName: 'Menon',
    fullName: 'Asha Menon',
    dateOfBirth: '1979-04-12',
    gender: 'FEMALE',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function medicalFile(): MedicalFile {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    tenantId: 'tenant-id',
    patientId: PATIENT_ID,
    uploadedBy: 'doctor-user-id',
    fileName: 'stored.png',
    originalFileName: 'chest-xray.png',
    fileType: 'XRAY',
    mimeType: 'image/png',
    fileSizeBytes: 10,
    uploadStatus: 'UPLOADED',
    metadata: {},
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function reportReview(): ReportReview {
  return {
    id: REVIEW_ID,
    analysisId: ANALYSIS_ID,
    patientId: PATIENT_ID,
    patientName: 'Asha Menon',
    analysisType: 'IMAGE_ANALYSIS',
    status: 'DRAFT',
    claimedBy: null,
    claimedAt: null,
    signedBy: null,
    signedAt: null,
    reviewAction: null,
    rejectionReason: null,
    draftContent: 'FINDINGS:\nRight lower lobe opacity.\n\nIMPRESSION:\nPneumonia.',
    finalContent: null,
    amendsReviewId: null,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function analysisResponse(overrides: Partial<AnalysisResponse> = {}): AnalysisResponse {
  return {
    id: ANALYSIS_ID,
    patientId: PATIENT_ID,
    medicalFileId: '55555555-5555-4555-8555-555555555555',
    requestedBy: 'doctor-user-id',
    analysisType: 'IMAGE_ANALYSIS' as const,
    clinicalNotes: null,
    status: 'PENDING' as const,
    urgency: null,
    rawResult: null,
    result: null,
    errorMessage: null,
    modelUsed: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    estimatedCost: null,
    processingStartedAt: null,
    processingCompletedAt: null,
    retryCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
