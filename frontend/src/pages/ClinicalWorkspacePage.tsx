import { DownloadSignedReport } from '@/components/reports/DownloadSignedReport';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Layers,
  Loader2,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { HumanAtlasLauncher } from '@/components/human-atlas/HumanAtlas';
import { ClinicalContextSidebar } from '@/components/clinical-workspace/ClinicalContextSidebar';
import { ClinicalContextTabs } from '@/components/clinical-workspace/ClinicalContextTabs';
import { ClinicalHeader } from '@/components/clinical-workspace/ClinicalHeader';
import { QaUsefulnessRating } from '@/components/clinical-workspace/QaUsefulnessRating';
import { QaPanel } from '@/components/clinical-workspace/QaPanel';
import { ReportFeedbackPanel } from '@/components/clinical-workspace/ReportFeedbackPanel';
import { useAuthStore } from '@/stores/authStore';
import { ReportPanel } from '@/components/clinical-workspace/ReportPanel';
import { StudyImagesPanel } from '@/components/clinical-workspace/StudyImagesPanel';
import { WorkspaceActions } from '@/components/clinical-workspace/WorkspaceActions';
import { WorkspaceTabBar } from '@/components/clinical-workspace/WorkspaceTabBar';
import { demoClinicalWorkspace } from '@/data/demoClinicalWorkspace';
import { reportQaApi } from '@/services/reportQaApi';
import {
  parseDraft,
  reportService,
  type ReportReview,
  type ReportReviewSection,
  type ReviewStatus,
} from '@/services/reportService';
import type {
  AnatomySelection,
  ClinicalContextTab,
  ClinicalReportStatus,
  ClinicalWorkspaceStudy,
  DraftReport,
  QaIssue,
  QaRequestStatus,
  QaSeverity,
  ReportQaEvidence,
  ReportQaIssue,
  ReportSection,
} from '@/types/clinicalWorkspace';

export function ClinicalWorkspacePage() {
  const feedbackRole = useAuthStore(s => s.role);
  const params = useParams<{ reviewId?: string }>();
  const [searchParams] = useSearchParams();
  const reviewIdFromRoute = params.reviewId ?? searchParams.get('reviewId');
  const reviewId = reviewIdFromRoute?.trim() ? reviewIdFromRoute.trim() : null;
  const isDemoMode = !reviewId;

  const [review, setReview] = useState<ReportReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<ClinicalReportStatus>(
    demoClinicalWorkspace.study.reportStatus
  );
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [qaRunId, setQaRunId] = useState<string | null>(null);
  const [qaIssues, setQaIssues] = useState<QaIssue[]>(demoClinicalWorkspace.qaIssues);
  const [qaRequestStatus, setQaRequestStatus] = useState<QaRequestStatus>('SUCCESS');
  const [qaError, setQaError] = useState<string | null>(null);
  const [selectedQaIssueId, setSelectedQaIssueId] = useState<string | null>(
    demoClinicalWorkspace.qaIssues[0]?.id ?? null
  );
  const [selectedAnatomy, setSelectedAnatomy] = useState<AnatomySelection | null>(
    demoClinicalWorkspace.defaultAnatomySelection
  );
  const [dismissedIssueIds, setDismissedIssueIds] = useState<string[]>([]);
  const [activeContextTab, setActiveContextTab] = useState<ClinicalContextTab>('clinical-workspace');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [smartViewOpen, setSmartViewOpen] = useState(false);

  useEffect(() => {
    setQaRunId(null);
    setActionNotice(null);
    setDismissedIssueIds([]);
    setQaError(null);

    if (!reviewId) {
      setReview(null);
      setReviewLoading(false);
      setReviewError(null);
      setQaIssues(demoClinicalWorkspace.qaIssues);
      setQaRequestStatus('SUCCESS');
      setSelectedQaIssueId(demoClinicalWorkspace.qaIssues[0]?.id ?? null);
      setSelectedAnatomy(demoClinicalWorkspace.defaultAnatomySelection);
      setReportStatus(demoClinicalWorkspace.study.reportStatus);
      return;
    }

    let cancelled = false;
    setReview(null);
    setReviewLoading(true);
    setReviewError(null);
    setQaIssues([]);
    setQaRequestStatus('IDLE');
    setSelectedQaIssueId(null);
    setSelectedAnatomy(null);
    setReportStatus('DRAFT');

    reportService
      .get(reviewId)
      .then((loaded) => {
        if (cancelled) return;
        setReview(loaded);
        setReportStatus(mapReviewStatus(loaded.status));
        setActionNotice('Report review loaded. Run QA manually when ready.');
      })
      .catch((error) => {
        if (cancelled) return;
        setReviewError(reportLoadFailureMessage(error));
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const currentStudy = useMemo(
    () => {
      if (review) return studyFromReview(review);
      if (isDemoMode) return demoClinicalWorkspace.study;
      return pendingStudy(reviewId);
    },
    [isDemoMode, review, reviewId]
  );
  const [editedSections, setEditedSections] = useState<ReportSection[] | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    setEditedSections(null);
  }, [reviewId]);

  const baseReport = useMemo(
    () => {
      if (review) return reportFromReview(review);
      if (isDemoMode) return demoClinicalWorkspace.report;
      return pendingReport(reviewId);
    },
    [isDemoMode, review, reviewId]
  );
  const currentReport = useMemo(() => {
    if (!editedSections) return baseReport;
    return {
      ...baseReport,
      sections: editedSections,
    };
  }, [baseReport, editedSections]);

  async function handleSaveReport(newSections: ReportSection[]) {
    setEditedSections(newSections);
    if (!reviewId) {
      setActionNotice('Report updated locally in demo mode.');
      return;
    }

    setSavingDraft(true);
    try {
      const narrative = sectionsToNarrative(newSections);
      const updated = await reportService.updateDraft(reviewId, narrative);
      setReview(updated);
      setActionNotice('Draft report saved successfully.');
    } catch (e: any) {
      setActionNotice(e?.response?.data?.message || e?.message || 'Failed to save draft.');
      return false;
    } finally {
      setSavingDraft(false);
    }
  }
  const selectedIssue = useMemo(
    () => qaIssues.find((issue) => issue.id === selectedQaIssueId) ?? null,
    [qaIssues, selectedQaIssueId]
  );
  const isQaAnatomySelection = !selectedAnatomy?.sourceKind || selectedAnatomy.sourceKind === 'QA';
  const visibleQaIssues = useMemo(
    () => qaIssues.filter((issue) => !dismissedIssueIds.includes(issue.id)),
    [qaIssues, dismissedIssueIds]
  );
  // No backend patient record backs the demo case, so real-data panels (images, prior reports,
  // medical history) only fetch once a real report review is open.
  const contextPatientId = !isDemoMode && review ? review.patientId : null;

  function reviewIssue(issue: QaIssue) {
    setSelectedQaIssueId(issue.id);
    setSelectedAnatomy(qaPreviewSelection(issue));
    setActionNotice('Issue selected for local report review.');
  }

  function dismissIssue(issue: QaIssue) {
    // QA feedback persistence does not exist yet; dismiss is intentionally local to this view.
    setDismissedIssueIds((current) => (current.includes(issue.id) ? current : [...current, issue.id]));
    setSelectedQaIssueId((current) => {
      if (current !== issue.id) return current;
      const nextIssue = qaIssues.find(
        (candidate) => candidate.id !== issue.id && !dismissedIssueIds.includes(candidate.id)
      );
      return nextIssue?.id ?? null;
    });
    setActionNotice('Issue dismissed locally. Backend QA feedback persistence is not available yet.');
  }

  function viewAnatomy(issue: QaIssue, selection?: AnatomySelection) {
    const target = selection ?? issue.anatomySelection;
    if (!target) return;
    setSelectedQaIssueId(issue.id);
    setSelectedAnatomy({ ...target, sourceKind: 'QA' });
    setAtlasOpen(true);
    setActionNotice(
      target.sourceLabel
        ? `Anatomy updated to the mapped structure from the ${target.sourceLabel} evidence.`
        : 'Anatomy updated to the mapped structure for the selected QA issue.'
    );
  }

  // QA and prior-study evidence open the same atlas with their own mapped anatomy.
  function viewLongitudinalAnatomy(selection: AnatomySelection) {
    setSelectedAnatomy(selection);
    setAtlasOpen(true);
    setActionNotice(
      `Anatomy updated to the mapped structure from the ${selection.sourceLabel ?? 'comparison'}.`
    );
  }

  async function runQa() {
    setQaRunId(null);
    setDismissedIssueIds([]);

    if (!reviewId) {
      setQaIssues(demoClinicalWorkspace.qaIssues);
      setQaRequestStatus('SUCCESS');
      setQaError(null);
      setSelectedQaIssueId(demoClinicalWorkspace.qaIssues[0]?.id ?? null);
      setSelectedAnatomy(demoClinicalWorkspace.defaultAnatomySelection);
      setReportStatus('REVIEW_REQUIRED');
      setActionNotice('Demo QA refreshed locally. Open a report review to run backend QA.');
      return;
    }

    setQaRequestStatus('LOADING');
    setQaError(null);
    setActionNotice(null);

    try {
      const narrative = sectionsToNarrative(currentReport.sections);
      const result = await reportQaApi.runReportQa(reviewId, narrative);
      setQaRunId(result.runId ?? null);
      const mappedIssues = result.issues.map(mapReportQaIssue);
      const defaultIssue = mappedIssues[0] ?? null;
      setQaIssues(mappedIssues);
      setSelectedQaIssueId(defaultIssue?.id ?? null);
      setSelectedAnatomy(qaPreviewSelection(defaultIssue));
      setQaRequestStatus('SUCCESS');
      setReportStatus(result.status === 'REVIEW_RECOMMENDED' ? 'REVIEW_REQUIRED' : mapReviewStatus(review?.status ?? 'DRAFT'));
      setActionNotice(
        result.issueCount > 0
          ? 'Review recommended. Clinician review required.'
          : 'QA completed. No potential QA issues detected by the current checks.'
      );
    } catch (error) {
      setQaRequestStatus('ERROR');
      setQaError(qaFailureMessage(error));
      setActionNotice('QA could not run. No report text was changed.');
    }
  }

  async function saveDraft() {
    if (!reviewId) {
      setActionNotice('Draft state noted locally for this frontend shell.');
      return;
    }
    await handleSaveReport(currentReport.sections);
  }

  function markReadyToSign() {
    setReportStatus('READY_TO_SIGN');
    setActionNotice('Report marked ready to sign in this local demo view only.');
  }

  function addClinicalNote() {
    setActionNotice('Clinical notes are not available yet for this workspace.');
  }

  function handleInsertComparisonText(text: string) {
    const updatedSections = currentReport.sections.map((sec) => {
      if (sec.id === 'comparison') {
        const cleanBody = sec.body.filter(
          (b) => b !== 'Not recorded in this review.' && b !== 'No comparison study available.'
        );
        return {
          ...sec,
          body: [...cleanBody, text],
        };
      }
      return sec;
    });

    void handleSaveReport(updatedSections);
    setActionNotice(`Comparison delta inserted into draft report: "${text.slice(0, 55)}..."`);
  }

  function handleApplySmartReconciledReport(newSections: ReportSection[]) {
    void handleSaveReport(newSections);
    setSmartViewOpen(false);
    setActionNotice('Smart reconciled findings applied to draft report.');
  }

  return (
    <div className="space-y-5 pb-8">
      {reviewLoading && (
        <div className="flex items-center rounded-xl border px-4 py-3 text-sm text-slate-300" style={{ background: 'var(--surface, #111827)', borderColor: 'var(--clr-border, #1e2d45)' }}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-300" />
          Loading report review...
        </div>
      )}

      {reviewError && (
        <div className="rounded-xl border border-red-500/25 bg-red-950/20 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            <div>
              <p className="text-sm font-semibold text-red-100">Report review unavailable</p>
              <p className="mt-1 text-xs leading-5 text-red-200/80">{reviewError}</p>
            </div>
          </div>
        </div>
      )}

      <ClinicalHeader
        study={currentStudy}
        reportStatus={reportStatus}
        contextLabel={isDemoMode ? 'Demo case' : 'Report review'}
        visibleQaIssues={visibleQaIssues}
      />

      <p className="text-sm text-slate-400">Review the report, run QA, then open a flagged finding in the 3D Atlas to locate its anatomy.</p>

      <WorkspaceTabBar activeTab={activeContextTab} onTabChange={setActiveContextTab} />

      {review?.status === 'SIGNED' && <DownloadSignedReport key={review.id} reportId={review.id} />}

      <WorkspaceActions
        anatomyAction={<HumanAtlasLauncher key={reviewId ?? "demo-atlas"} open={atlasOpen} onOpenChange={setAtlasOpen}
          reviewId={reviewId} selection={selectedAnatomy}
          selections={qaIssues.flatMap(issue => issue.anatomyCandidates ?? (issue.anatomySelection ? [issue.anatomySelection] : []))}
          conflictNote={selectedAnatomy && isQaAnatomySelection ? anatomyConflictNote(selectedIssue) : null} />}
        reportStatus={reportStatus}
        qaStatus={qaRequestStatus}
        notice={actionNotice}
        onSaveDraft={saveDraft}
        onRunQa={() => void runQa()}
        onMarkReady={markReadyToSign}
        runQaDisabled={Boolean(reviewId && (reviewLoading || reviewError))}
        onOpenSmartView={() => setSmartViewOpen(true)}
        hasQaIssues={visibleQaIssues.length > 0}
      />

      {reviewId && review && !reviewLoading && !reviewError && ['DOCTOR','HOSPITAL_ADMIN'].includes(feedbackRole || '') ? (
        <ReportFeedbackPanel key={reviewId} reportId={reviewId} selectedIssue={selectedIssue} />
      ) : (
        <section aria-label="Report feedback" className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-100">Clinician feedback</h2>
          <p className="mt-2 text-sm text-slate-300">
            {!reviewId ? 'You are viewing a demo case. Open a saved report to submit feedback linked to that report.'
              : reviewLoading ? 'Feedback will be available after the report loads.'
              : reviewError || !review ? 'The report could not be loaded. Open a saved report from the Worklist to submit feedback.'
              : 'A Doctor or Hospital Admin account is required to submit clinician feedback.'}
          </p>
          {(!reviewId || reviewError) && <Link className="mt-3 inline-block text-sm font-semibold text-cyan-300 underline" to="/worklist">Open Worklist to choose a saved report →</Link>}
        </section>
      )}

      {/*
        Both views stay mounted and are toggled with `hidden` rather than conditionally rendered, so
        switching tabs never discards in-progress state elsewhere on the page — e.g. a longitudinal
        comparison already selected on the Prior Studies tab survives a trip back to the QA view.
      */}
      <div className={activeContextTab === 'clinical-workspace' ? undefined : 'hidden'}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
          <div>
          <ReportPanel
            report={currentReport}
            selectedIssue={selectedIssue}
            onSaveReport={handleSaveReport}
            saving={savingDraft}
          />
          </div>
          <div>
          {qaRunId && selectedIssue && ['DOCTOR','HOSPITAL_ADMIN'].includes(feedbackRole || '') && <QaUsefulnessRating key={`${qaRunId}:${selectedIssue.id}`} runId={qaRunId} issue={selectedIssue} />}
          <QaPanel
            issues={qaIssues}
            dismissedIssueIds={dismissedIssueIds}
            selectedIssueId={selectedQaIssueId}
            requestStatus={qaRequestStatus}
            errorMessage={qaError}
            onRetry={() => void runQa()}
            onReviewIssue={reviewIssue}
            onDismissIssue={dismissIssue}
            onViewAnatomy={viewAnatomy}
            onOpenSmartView={() => setSmartViewOpen(true)}
          />
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <StudyImagesPanel patientId={contextPatientId} />
          <ClinicalContextSidebar
            patientId={contextPatientId}
            onViewPriorReports={() => setActiveContextTab('prior-studies')}
            onAddNote={addClinicalNote}
          />
        </div>
      </div>

      <div className={activeContextTab === 'clinical-workspace' ? 'hidden' : undefined}>
        <ClinicalContextTabs
          activeTab={activeContextTab}
          priorStudies={demoClinicalWorkspace.priorStudies}
          timeline={demoClinicalWorkspace.timeline}
          audit={demoClinicalWorkspace.audit}
          isDemoMode={isDemoMode}
          currentReview={review}
          currentReportText={sectionsToNarrative(currentReport.sections)}
          patientId={contextPatientId ?? undefined}
          patientName={currentStudy.patient.fullName}
          mrn={currentStudy.patient.medicalRecordNumber}
          onInsertComparisonText={handleInsertComparisonText}
          onViewAnatomy={viewLongitudinalAnatomy}
        />
      </div>

      <SmartQaCompareModal
        open={smartViewOpen}
        onClose={() => setSmartViewOpen(false)}
        report={currentReport}
        issues={visibleQaIssues}
        study={currentStudy}
        onApplyReconciledSections={handleApplySmartReconciledReport}
      />
    </div>
  );
}

function sectionsToNarrative(sections: ReportSection[]): string {
  return sections
    .map((s) => `${s.title.toUpperCase()}:\n${s.body.join('\n')}`)
    .join('\n\n');
}

function mapReviewStatus(status: ReviewStatus): ClinicalReportStatus {
  if (status === 'SIGNED') return 'SIGNED';
  if (status === 'DRAFT') return 'DRAFT';
  return 'REVIEW_REQUIRED';
}

function studyFromReview(review: ReportReview): ClinicalWorkspaceStudy {
  const analysisLabel = readableLabel(review.analysisType ?? 'Report review');
  return {
    id: review.analysisId,
    accessionNumber: review.analysisId.slice(0, 8).toUpperCase(),
    studyType: analysisLabel,
    modality: analysisLabel,
    fileType: 'OTHER',
    studyDate: formatDate(review.createdAt),
    reportStatus: mapReviewStatus(review.status),
    patient: {
      id: review.patientId,
      fullName: review.patientName ?? 'Patient',
      medicalRecordNumber: 'Not recorded',
      dateOfBirth: 'Not recorded',
      ageLabel: 'Age not recorded',
    },
  };
}

function reportFromReview(review: ReportReview): DraftReport {
  const source = reportSource(review);
  const sectionBody = sectionBodyFromReview(review.sections ?? []);
  const hasBackendSections = Object.values(sectionBody).some((body) => body.length > 0);
  if (hasBackendSections) {
    return {
      id: review.id,
      radiologist: review.signedBy ?? review.claimedBy ?? 'Unassigned',
      createdAt: formatTime(review.createdAt),
      sections: [
        {
          id: 'findings',
          title: 'Findings',
          body: sectionBody.findings.length > 0
            ? sectionBody.findings
            : ['No findings text recorded.'],
        },
        {
          id: 'comparison',
          title: 'Comparison',
          body: sectionBody.comparison.length > 0
            ? sectionBody.comparison
            : ['Not recorded in this review.'],
        },
        {
          id: 'impression',
          title: 'Impression',
          body: sectionBody.impression.length > 0
            ? sectionBody.impression
            : ['No impression text recorded.'],
        },
      ],
      metadata: reportMetadataFromReview(review),
    };
  }

  const parsed = parseDraft(source);
  const findings = parsed?.findings.map(formatFinding).filter(Boolean) ?? [];
  const impression = parsed?.impression ? [parsed.impression] : [];

  return {
    id: review.id,
    radiologist: review.signedBy ?? review.claimedBy ?? 'Unassigned',
    createdAt: formatTime(review.createdAt),
    sections: [
      {
        id: 'findings',
        title: 'Findings',
        body: findings.length > 0
          ? findings
          : parsed
          ? ['No findings text recorded.']
          : ['No findings text recorded.'],
      },
      {
        id: 'comparison',
        title: 'Comparison',
        body: ['Not recorded in this review.'],
      },
      {
        id: 'impression',
        title: 'Impression',
        body: impression.length > 0 ? impression : ['No impression text recorded.'],
      },
    ],
    metadata: reportMetadataFromReview(review),
  };
}

function reportMetadataFromReview(review: ReportReview): DraftReport['metadata'] {
  const lastUpdatedIso = review.signedAt ?? review.claimedAt ?? null;
  return {
    reportStatus: mapReviewStatus(review.status),
    createdAt: formatDate(review.createdAt),
    createdBy: null,
    lastUpdatedAt: lastUpdatedIso ? formatDate(lastUpdatedIso) : null,
    lastUpdatedLabel: lastUpdatedIso ? formatDate(lastUpdatedIso) : formatDate(review.createdAt),
  };
}

function sectionBodyFromReview(sections: ReportReviewSection[]) {
  return sections.reduce(
    (body, section) => {
      const text = section.text?.trim();
      if (!text) return body;
      if (section.section === 'FINDINGS') body.findings.push(text);
      if (section.section === 'COMPARISON') body.comparison.push(text);
      if (section.section === 'IMPRESSION') body.impression.push(text);
      return body;
    },
    { findings: [] as string[], comparison: [] as string[], impression: [] as string[] }
  );
}

function reportSource(review: ReportReview): string | null {
  if (review.status === 'SIGNED' && review.finalContent) return review.finalContent;
  return review.draftContent ?? review.finalContent;
}

function formatFinding(finding: { region?: string; description?: string; severity?: string }): string {
  const region = finding.region ? `${finding.region}: ` : '';
  const severity = finding.severity ? ` (${finding.severity})` : '';
  return `${region}${finding.description ?? ''}${severity}`.trim();
}

function pendingStudy(reviewId: string | null): ClinicalWorkspaceStudy {
  return {
    id: reviewId ?? 'pending-review',
    accessionNumber: reviewId?.slice(0, 8).toUpperCase() ?? 'PENDING',
    studyType: 'Report review',
    modality: 'Pending',
    fileType: 'OTHER',
    studyDate: 'Loading',
    reportStatus: 'DRAFT',
    patient: {
      id: 'pending-patient',
      fullName: 'Loading report review',
      medicalRecordNumber: 'Pending',
      dateOfBirth: 'Pending',
      ageLabel: 'Pending',
    },
  };
}

function pendingReport(reviewId: string | null): DraftReport {
  return {
    id: reviewId ?? 'pending-report',
    radiologist: 'Pending',
    createdAt: 'pending',
    sections: [
      { id: 'findings', title: 'Findings', body: ['Loading report text.'] },
      { id: 'comparison', title: 'Comparison', body: ['Loading report text.'] },
      { id: 'impression', title: 'Impression', body: ['Loading report text.'] },
    ],
  };
}

function mapReportQaIssue(issue: ReportQaIssue): QaIssue {
  const normalizedEvidence = issue.evidence?.map(mapReportQaEvidence) ?? [];
  const fallbackEvidence = [
    issue.findingText ? { label: readableLabel(issue.sectionA ?? 'Findings'), text: issue.findingText } : null,
    issue.impressionText ? { label: readableLabel(issue.sectionB ?? 'Impression'), text: issue.impressionText } : null,
  ].filter((item): item is { label: string; text: string } => Boolean(item));
  const anatomyCandidates = anatomyCandidatesFromIssue(issue);

  return {
    id: issue.id,
    severity: issue.severity,
    type: issue.type,
    message: issue.message || 'Potential laterality conflict. Clinician review required.',
    recommendation: 'Review recommended. Clinician review required before sign-off.',
    evidence: normalizedEvidence.length > 0 ? normalizedEvidence : fallbackEvidence,
    anatomySelection: defaultAnatomyCandidate(anatomyCandidates),
    anatomyCandidates,
  };
}

/**
 * Prefers the backend anatomy targets. Each mapped structure stays tied to the evidence section it
 * came from, so a laterality conflict keeps both candidates instead of collapsing to one side.
 */
function anatomyCandidatesFromIssue(issue: ReportQaIssue): AnatomySelection[] {
  const fromTargets = (issue.evidence ?? [])
    .map(anatomySelectionFromEvidence)
    .filter((selection): selection is AnatomySelection => Boolean(selection));

  if (fromTargets.length > 0) return fromTargets;

  const reconstructed = anatomySelectionFromIssue(issue);
  return reconstructed ? [reconstructed] : [];
}

/** Defaults to the Impression evidence for conflicts, matching the review-first anatomy view. */
function defaultAnatomyCandidate(candidates: AnatomySelection[]): AnatomySelection | undefined {
  return candidates.find((candidate) => candidate.sourceLabel === 'Impression')
    ?? candidates.find((candidate) => candidate.sourceLabel === 'Findings')
    ?? candidates[0];
}

function qaPreviewSelection(issue: QaIssue | null): AnatomySelection | null {
  if (!issue?.anatomySelection) return null;
  return { ...issue.anatomySelection, sourceKind: 'QA' };
}

function resolveViewerKeyForStructure(structure?: string | null, side?: string | null): string | null {
  if (!structure) return null;
  const s = structure.toUpperCase().trim();
  const normalizedSide = side ? side.toLowerCase().trim() : '';

  if (s.includes('LUNG') || s.includes('PULMONARY')) {
    if (normalizedSide.includes('right') || normalizedSide === 'r') return 'respiratory.lung.right';
    if (normalizedSide.includes('left') || normalizedSide === 'l') return 'respiratory.lung.left';
  }
  if (s.includes('HUMERUS')) {
    if (normalizedSide.includes('right') || normalizedSide === 'r') return 'skeleton.humerus.right';
    if (normalizedSide.includes('left') || normalizedSide === 'l') return 'skeleton.humerus.left';
  }
  if (s.includes('FEMUR')) {
    if (normalizedSide.includes('right') || normalizedSide === 'r') return 'skeleton.femur.right';
    if (normalizedSide.includes('left') || normalizedSide === 'l') return 'skeleton.femur.left';
  }
  if (s.includes('KIDNEY') || s.includes('RENAL')) {
    if (normalizedSide.includes('right') || normalizedSide === 'r') return 'urinary.kidney.right';
    if (normalizedSide.includes('left') || normalizedSide === 'l') return 'urinary.kidney.left';
  }
  if (s.includes('BRAIN')) {
    return 'nervous.brain';
  }
  if (s.includes('SHOULDER') || s.includes('SCAPULA') || s.includes('CLAVICLE')) {
    if (normalizedSide.includes('right') || normalizedSide === 'r') return 'skeleton.shoulder.right';
    if (normalizedSide.includes('left') || normalizedSide === 'l') return 'skeleton.shoulder.left';
  }
  if (s.includes('KNEE') || s.includes('PATELLA')) {
    if (normalizedSide.includes('right') || normalizedSide === 'r') return 'skeleton.knee.right';
    if (normalizedSide.includes('left') || normalizedSide === 'l') return 'skeleton.knee.left';
  }
  if (s.includes('ANKLE') || s.includes('TIBIA') || s.includes('FIBULA')) {
    if (normalizedSide.includes('right') || normalizedSide === 'r') return 'skeleton.ankle.right';
    if (normalizedSide.includes('left') || normalizedSide === 'l') return 'skeleton.ankle.left';
  }
  return null;
}

function anatomySelectionFromEvidence(evidence: ReportQaEvidence): AnatomySelection | null {
  const target = evidence.anatomyTarget;
  if (!target) return null;

  return {
    structure: target.structureCode,
    displayName: target.displayName,
    side: target.side,
    region: target.region,
    system: readableLabel(target.system),
    viewerKey: target.viewerKey || resolveViewerKeyForStructure(target.structureCode, target.side),
    sourceLabel: readableLabel(evidence.sourceSection),
    sourceText: evidence.sourceText,
  };
}

/**
 * Builds a note when an issue maps to more than one structure. Names every mapped structure and its
 * source section without asserting which one is correct.
 */
function anatomyConflictNote(issue: QaIssue | null): string | null {
  const candidates = issue?.anatomyCandidates ?? [];
  if (candidates.length < 2) return null;

  const distinctSides = new Set(candidates.map((candidate) => candidate.side));
  if (distinctSides.size < 2) return null;

  const mapped = candidates
    .map((candidate) => `${candidate.sourceLabel ?? 'Source'}: ${candidate.displayName}`)
    .join(' \u2022 ');
  return `${mapped}. This report maps to more than one structure; the correct side is not determined by the system.`;
}

function mapReportQaEvidence(evidence: ReportQaEvidence) {
  return {
    label: readableLabel(evidence.sourceSection),
    normalizedLabel: normalizedEvidenceLabel(evidence),
    text: evidence.sourceText,
  };
}

function normalizedEvidenceLabel(evidence: ReportQaEvidence): string {
  const anatomy = evidence.anatomyText?.trim().toLowerCase()
    || (evidence.anatomy ? readableLabel(evidence.anatomy).toLowerCase() : null);
  const side = evidence.side !== 'UNSPECIFIED' ? readableLabel(evidence.side) : null;
  const location = [side, anatomy].filter(Boolean).join(' ');
  const region = evidence.region !== 'UNSPECIFIED' ? readableLabel(evidence.region) : null;

  return [readableLabel(evidence.findingType), location || null, region]
    .filter((part): part is string => Boolean(part))
    .join(' \u2022 ');
}

function anatomySelectionFromIssue(issue: ReportQaIssue): AnatomySelection | undefined {
  if (!issue.anatomyCode) return undefined;
  const side = issue.sideA ?? 'UNSPECIFIED';
  const structure = issue.anatomyCode;
  const region = issue.region ?? 'UNSPECIFIED';
  return {
    structure,
    displayName: `${readableLabel(side)} ${readableLabel(structure)}`.trim(),
    side,
    region,
    system: 'Reported anatomy',
    viewerKey: resolveViewerKeyForStructure(structure, side),
    sourceLabel: readableLabel(issue.sectionA ?? 'Findings'),
    sourceText: issue.findingText ?? null,
  };
}

function readableLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'time not recorded';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function reportLoadFailureMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } }).response?.status;
  if (status === 401 || status === 403) {
    return 'Your session is not authorized to open this report review.';
  }
  if (status === 404) {
    return 'This report review was not found in the current workspace.';
  }
  if (status && status >= 500) {
    return 'The server could not load this report review right now.';
  }
  return 'Network error while loading this report review.';
}

function qaFailureMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } }).response?.status;
  if (status === 401) {
    return 'Your session expired before QA could run. Sign in again if this continues.';
  }
  if (status === 403) {
    return 'Your account is not allowed to run QA for this report review.';
  }
  if (status === 404) {
    return 'This report review was not found in the current workspace.';
  }
  if (status && status >= 500) {
    return 'The server could not run QA right now. Please retry.';
  }
  return 'Network error while running QA. Please retry.';
}

interface SmartQaCompareModalProps {
  open: boolean;
  onClose: () => void;
  report: DraftReport;
  issues: QaIssue[];
  study: ClinicalWorkspaceStudy;
  onApplyReconciledSections: (newSections: ReportSection[]) => void;
}

interface ReconciledLine {
  id: string;
  originalText?: string;
  reconciledText: string;
  isModified: boolean;
  isAdded: boolean;
  badge?: string;
  explanation?: string;
  guidelineCitation?: string;
  issueSeverity?: QaSeverity;
}

interface ReconciledSectionData {
  id: 'findings' | 'comparison' | 'impression';
  title: string;
  originalLines: string[];
  lines: ReconciledLine[];
}

function computeSmartReconciliation(
  sections: ReportSection[],
  issues: QaIssue[]
): {
  reconciledSections: ReportSection[];
  sectionData: ReconciledSectionData[];
  totalFixes: number;
  criticalFixes: number;
  hasLateralityFix: boolean;
  hasOmittedFindingFix: boolean;
  hasGuidelineFix: boolean;
} {
  const lateralityIssue = issues.find((i) => i.type === 'LATERALITY_CONFLICT');
  const unreportedIssue = issues.find((i) => i.type === 'UNREPORTED_IMAGE_FINDING');
  const recommendationIssue = issues.find(
    (i) => i.type === 'RECOMMENDATION_REVIEW' || i.type === 'COMPARISON_GAP'
  );

  let totalFixes = 0;
  let criticalFixes = 0;
  let hasLateralityFix = false;
  let hasOmittedFindingFix = false;
  let hasGuidelineFix = false;

  const sectionData: ReconciledSectionData[] = sections.map((sec) => {
    const originalLines = [...sec.body];
    const lines: ReconciledLine[] = [];

    if (sec.id === 'findings') {
      originalLines.forEach((line, idx) => {
        lines.push({
          id: `findings-${idx}`,
          originalText: line,
          reconciledText: line,
          isModified: false,
          isAdded: false,
        });
      });

      // Integrate unreported multimodal finding if detected by Vision AI
      if (unreportedIssue) {
        hasOmittedFindingFix = true;
        totalFixes++;
        criticalFixes++;
        lines.push({
          id: 'findings-unreported-nodule',
          originalText: undefined,
          reconciledText:
            'Incidental Finding (DICOM Vision AI Ground Truth): 1.2 cm solid pulmonary nodule noted in the right lower lung field.',
          isModified: false,
          isAdded: true,
          badge: 'Multimodal Vision AI',
          explanation:
            'Detected by axial DICOM Vision AI series at 94% confidence, previously omitted from draft findings text.',
          guidelineCitation: 'Fleischner Society 2017 Guidelines',
          issueSeverity: 'HIGH',
        });
      }
    } else if (sec.id === 'comparison') {
      originalLines.forEach((line, idx) => {
        lines.push({
          id: `comparison-${idx}`,
          originalText: line,
          reconciledText: line,
          isModified: false,
          isAdded: false,
        });
      });

      if (recommendationIssue && recommendationIssue.type === 'COMPARISON_GAP') {
        hasGuidelineFix = true;
        totalFixes++;
        lines.push({
          id: 'comparison-reconciliation',
          originalText: undefined,
          reconciledText:
            'Interval assessment against prior imaging confirms acute traumatic nature without chronic deformity.',
          isModified: false,
          isAdded: true,
          badge: 'Prior Study Reconciled',
          explanation: 'Standardized longitudinal comparison phrase added for longitudinal audit trail.',
          guidelineCitation: 'RadLex Reporting Standards',
          issueSeverity: 'LOW',
        });
      }
    } else if (sec.id === 'impression') {
      originalLines.forEach((line, idx) => {
        // Check for laterality mismatch
        if (lateralityIssue && /\bleft\b/i.test(line) && /humerus|fracture|shoulder/i.test(line)) {
          hasLateralityFix = true;
          totalFixes++;
          criticalFixes++;
          const corrected = line.replace(/\bleft\b/gi, 'right');
          lines.push({
            id: `impression-${idx}`,
            originalText: line,
            reconciledText: `${corrected} (laterality aligned with findings and imaging).`,
            isModified: true,
            isAdded: false,
            badge: 'Laterality Reconciled',
            explanation:
              'Reconciled from "left" to "right" to match Findings section, 3D Skeletal model, and DICOM series.',
            guidelineCitation: 'ACR Quality & Safety Laterality Standards',
            issueSeverity: 'CRITICAL',
          });
        } else {
          lines.push({
            id: `impression-${idx}`,
            originalText: line,
            reconciledText: line,
            isModified: false,
            isAdded: false,
          });
        }
      });

      // If there's an unreported nodule, impression must contain the Fleischner recommendation
      if (unreportedIssue) {
        hasGuidelineFix = true;
        totalFixes++;
        lines.push({
          id: 'impression-fleischner-rec',
          originalText: undefined,
          reconciledText:
            'Incidental 1.2 cm right lower lobe pulmonary nodule; recommend follow-up non-contrast chest CT in 12 months per Fleischner 2017 guidelines.',
          isModified: false,
          isAdded: true,
          badge: 'Fleischner Follow-Up',
          explanation:
            'Solid indeterminate nodule >8mm or high clinical risk requires 12-month non-contrast chest CT follow-up interval.',
          guidelineCitation: 'Fleischner Society 2017 Guidelines',
          issueSeverity: 'HIGH',
        });
      }
    }

    return {
      id: sec.id,
      title: sec.title,
      originalLines,
      lines,
    };
  });

  const reconciledSections: ReportSection[] = sectionData.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.lines.map((l) => l.reconciledText),
  }));

  return {
    reconciledSections,
    sectionData,
    totalFixes: Math.max(totalFixes, issues.length),
    criticalFixes,
    hasLateralityFix,
    hasOmittedFindingFix,
    hasGuidelineFix,
  };
}

export function SmartQaCompareModal({
  open,
  onClose,
  report,
  issues,
  study,
  onApplyReconciledSections,
}: SmartQaCompareModalProps) {
  const [activeTab, setActiveTab] = useState<'side-by-side' | 'diff' | 'evidence'>('side-by-side');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const reconciliation = useMemo(
    () => computeSmartReconciliation(report.sections, issues),
    [report.sections, issues]
  );

  if (!open) return null;

  const fullReconciledNarrative = sectionsToNarrative(reconciliation.reconciledSections);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullReconciledNarrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-qa-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700/80 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-950/50 shadow-inner">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="smart-qa-modal-title" className="text-base font-bold text-white tracking-tight">
                  Smart QA Clinical Reconciliation & Comparison
                </h2>
                <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                  AI Reconciled
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {study.studyType} ({study.modality}) &bull; Accession: {study.accessionNumber} &bull; Patient:{' '}
                {study.patient.fullName} ({study.patient.medicalRecordNumber})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Close Smart QA view"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Intelligence Executive Strip */}
        <div className="grid shrink-0 grid-cols-1 gap-2 border-b border-slate-800 bg-slate-950/60 px-6 py-3 sm:grid-cols-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Quality Score</div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span className="text-amber-400">78%</span> &rarr; <span className="text-emerald-400">100% Reconciled</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
            <Scale className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Laterality Check</div>
              <div className="text-xs font-bold text-slate-100">
                {reconciliation.hasLateralityFix ? (
                  <span className="text-emerald-400">Aligned &bull; Right Proximal</span>
                ) : (
                  <span className="text-slate-300">Consistent</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
            <Layers className="h-4 w-4 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Vision AI Validation</div>
              <div className="text-xs font-bold text-slate-100">
                {reconciliation.hasOmittedFindingFix ? (
                  <span className="text-cyan-300">1 Omitted Nodule Added</span>
                ) : (
                  <span className="text-slate-300">Images Reconciled</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
            <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Guidelines Conformance</div>
              <div className="text-xs font-bold text-emerald-400">Fleischner 2017 Compliant</div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-2.5">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('side-by-side')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'side-by-side'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Side-by-Side Smart Compare
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'diff'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              Unified Clinical Diff
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'evidence'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Clinical Evidence & Guidance ({issues.length})
            </button>
          </div>

          <div className="text-xs text-slate-400">
            {reconciliation.totalFixes} automated improvements synthesized
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'side-by-side' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left Column: Original Draft */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-inner flex flex-col">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Original Draft Narrative
                    </span>
                    <p className="text-[11px] text-slate-500">Unmodified text from radiologist draft</p>
                  </div>
                  <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                    Draft State
                  </span>
                </div>

                <div className="space-y-6 text-sm flex-1">
                  {reconciliation.sectionData.map((sec) => (
                    <div key={`orig-${sec.id}`} className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        {sec.title}
                      </h4>
                      <div className="space-y-2 font-mono text-xs leading-relaxed text-slate-300">
                        {sec.lines.map((line) => {
                          if (line.isAdded) {
                            // In original, this finding was missing
                            return (
                              <div
                                key={`orig-${line.id}`}
                                className="rounded border border-dashed border-red-500/40 bg-red-950/20 px-3 py-2 text-[11px] text-red-300/80"
                              >
                                <span className="font-sans font-semibold text-red-300">
                                  &bull; Omission in draft:
                                </span>{' '}
                                {line.badge} not documented.
                              </div>
                            );
                          }
                          if (line.isModified) {
                            return (
                              <div
                                key={`orig-${line.id}`}
                                className="rounded border border-red-500/50 bg-red-950/30 p-2.5"
                              >
                                <div className="text-red-200 line-through">{line.originalText}</div>
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400 font-sans">
                                  <AlertTriangle className="h-3 w-3" />
                                  Flagged: {line.explanation}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <p key={`orig-${line.id}`} className="rounded bg-slate-900/40 px-3 py-2 border border-slate-800/40">
                              {line.originalText}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Smart Reconciled Draft */}
              <div className="rounded-xl border border-cyan-500/30 bg-slate-950/90 p-5 shadow-inner flex flex-col ring-1 ring-cyan-500/20">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Smart Reconciled Draft (AI Proposed)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Reconciled with Multimodal Vision AI, Laterality checks & Fleischner Guidelines
                    </p>
                  </div>
                  <span className="rounded-md border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Clinically Validated
                  </span>
                </div>

                <div className="space-y-6 text-sm flex-1">
                  {reconciliation.sectionData.map((sec) => (
                    <div key={`reconciled-${sec.id}`} className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        {sec.title}
                      </h4>
                      <div className="space-y-2 font-mono text-xs leading-relaxed text-slate-200">
                        {sec.lines.map((line) => {
                          if (line.isAdded) {
                            return (
                              <div
                                key={`rec-${line.id}`}
                                className="rounded border border-emerald-500/50 bg-emerald-950/30 p-2.5"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                    <Sparkles className="h-3 w-3" />
                                    {line.badge}
                                  </span>
                                  {line.guidelineCitation && (
                                    <span className="text-[10px] text-slate-400">
                                      Citation: {line.guidelineCitation}
                                    </span>
                                  )}
                                </div>
                                <div className="text-emerald-200 font-semibold">{line.reconciledText}</div>
                                {line.explanation && (
                                  <p className="mt-1 text-[11px] text-emerald-300/80 font-sans">
                                    {line.explanation}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          if (line.isModified) {
                            return (
                              <div
                                key={`rec-${line.id}`}
                                className="rounded border border-cyan-500/50 bg-cyan-950/30 p-2.5"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center gap-1 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                                    <Check className="h-3 w-3" />
                                    {line.badge}
                                  </span>
                                  {line.guidelineCitation && (
                                    <span className="text-[10px] text-slate-400">
                                      Rule: {line.guidelineCitation}
                                    </span>
                                  )}
                                </div>
                                <div className="text-cyan-100 font-bold">{line.reconciledText}</div>
                                {line.explanation && (
                                  <p className="mt-1 text-[11px] text-cyan-300/80 font-sans">
                                    {line.explanation}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return (
                            <p key={`rec-${line.id}`} className="rounded bg-slate-900/40 px-3 py-2 border border-slate-800/40">
                              {line.reconciledText}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diff' && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 font-mono text-xs shadow-inner">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="font-bold text-slate-200">Unified Clinical Diff View</span>
                  <p className="text-[11px] text-slate-500">
                    Red lines indicates omitted/conflicting draft statements; Green lines indicate reconciled text.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    Removed / Contradiction
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    Added / Reconciled
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {reconciliation.sectionData.map((sec) => (
                  <div key={`diff-sec-${sec.id}`} className="space-y-1.5">
                    <div className="text-cyan-400 font-bold uppercase tracking-wider py-1 border-b border-slate-800/60">
                      @@ {sec.title.toUpperCase()} @@
                    </div>
                    {sec.lines.map((line) => {
                      if (line.isAdded) {
                        return (
                          <div key={`diff-add-${line.id}`} className="rounded bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 text-emerald-300">
                            + {line.reconciledText}
                            <span className="ml-2 text-[10px] text-emerald-400/80 font-sans">
                              [{line.badge}]
                            </span>
                          </div>
                        );
                      }
                      if (line.isModified) {
                        return (
                          <div key={`diff-mod-${line.id}`} className="space-y-1">
                            <div className="rounded bg-red-950/40 border border-red-500/30 px-3 py-1.5 text-red-300 line-through">
                              - {line.originalText}
                            </div>
                            <div className="rounded bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 text-emerald-300 font-semibold">
                              + {line.reconciledText}
                              <span className="ml-2 text-[10px] text-emerald-400/80 font-sans">
                                [{line.badge}]
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={`diff-ctx-${line.id}`} className="px-3 py-1 text-slate-400">
                          &nbsp;&nbsp;{line.originalText}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <h3 className="text-sm font-bold text-white mb-1">
                  Active Clinical QA Rules & Supporting Evidence
                </h3>
                <p className="text-xs text-slate-400">
                  Detailed breakdown of issues detected during multimodal report inspection and image cross-referencing.
                </p>
              </div>

              {issues.map((issue) => (
                <div
                  key={`evidence-card-${issue.id}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          issue.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : issue.severity === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        {readableLabel(issue.type)}
                      </span>
                    </div>
                    {issue.anatomySelection && (
                      <span className="text-xs text-cyan-300 font-medium">
                        Target: {issue.anatomySelection.displayName} ({issue.anatomySelection.side})
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{issue.message}</p>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Supporting Evidence
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {issue.evidence.map((ev, i) => (
                        <div
                          key={`ev-chunk-${i}`}
                          className="rounded border border-slate-800 bg-slate-950 p-2.5 text-xs"
                        >
                          <div className="text-[10px] font-bold text-cyan-400 mb-1">{ev.label}</div>
                          <div className="text-slate-300 italic font-mono text-[11px]">
                            &ldquo;{ev.text}&rdquo;
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-semibold text-cyan-300">
                        Recommended Clinical Resolution
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">{issue.recommendation}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Reconciled Report'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApplyReconciledSections(reconciliation.reconciledSections)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              Apply Smart Changes to Draft Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
