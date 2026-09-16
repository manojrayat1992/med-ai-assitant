export type DemoSection = 'findings' | 'comparison' | 'impression';
export type DemoReport = Record<DemoSection, string>;
export type DemoCase = {
  id: string; specialty: string; title: string; task: string; source: string[];
  initial: DemoReport; example: DemoReport;
};
export type DemoIssue = { id: string; section: DemoSection; title: string; explanation: string };

export const demoCases: DemoCase[] = [
  {
    id: 'radiology', specialty: 'Radiology', title: 'Chest report · laterality review',
    task: 'Compare the draft with the supplied observations. Correct the side and the conflicting impression.',
    source: ['Synthetic observation: small RIGHT pleural effusion.', 'Synthetic observation: no pneumothorax.', 'No prior study was supplied.'],
    initial: { findings: 'Small left pleural effusion. No pneumothorax.', comparison: 'No prior study supplied.', impression: 'No pleural effusion.' },
    example: { findings: 'Small right pleural effusion. No pneumothorax.', comparison: 'No prior study supplied.', impression: 'Small right pleural effusion.' },
  },
  {
    id: 'laboratory', specialty: 'Laboratory', title: 'Lab report · value reconciliation',
    task: 'Check the transcribed value, unit and summary against the supplied fictional laboratory result.',
    source: ['Synthetic result: hemoglobin 10.2 g/dL.', 'Reference interval supplied for this fictional case: 12.0–16.0 g/dL.', 'No previous result was supplied.'],
    initial: { findings: 'Hemoglobin: 12.0 g/dL.', comparison: 'No previous result supplied.', impression: 'Hemoglobin is within the supplied reference interval.' },
    example: { findings: 'Hemoglobin: 10.2 g/dL.', comparison: 'No previous result supplied.', impression: 'Hemoglobin is below the supplied reference interval.' },
  },
];

// Deliberately bounded teaching checks against fixed synthetic facts. This is not the
// authenticated clinical QA engine, an LLM, a diagnostic model or a general NLP validator.
export function checkDemoReport(caseId: string, report: DemoReport): DemoIssue[] {
  const issues: DemoIssue[] = [];
  const add = (id: string, section: DemoSection, title: string, explanation: string) => issues.push({id, section, title, explanation});
  for (const section of ['findings', 'comparison', 'impression'] as const) {
    if (!report[section].trim()) add(`missing-${section}`, section, `Add ${section}`, 'Keep each section explicit. Removing report text does not resolve a discrepancy.');
  }
  if (caseId === 'radiology') {
    for (const section of ['findings', 'impression'] as const) {
      if (!report[section].trim()) continue;
      const text = report[section].toLowerCase();
      const right = /\bright\s+pleural\s+effusion\b/.test(text);
      const contradicts = /\b(left|bilateral)\b|\b(no|without|absent|resolved|not)\b[^.!?\n]*\beffusion\b|\beffusion\b[^.!?\n]*\b(absent|resolved)\b/.test(text);
      if (!right || contradicts) add(`effusion-${section}`, section, 'Reconcile effusion and side', 'The supplied observation is a small RIGHT pleural effusion. State that finding consistently; the draft must not describe a left-sided or absent effusion.');
    }
  } else if (caseId === 'laboratory') {
    if (report.findings.trim() && !/\b(?:hemoglobin|haemoglobin|hgb|hb)\s*(?::|=|is)?\s*10\.2\s*g\s*\/\s*dl\b/i.test(report.findings))
      add('hemoglobin-value', 'findings', 'Reconcile value and unit', 'The source value is hemoglobin 10.2 g/dL. Copy the value and unit together; 12.0 is the lower reference bound, not the measured result.');
    if (report.impression.trim() && (!/\b(below|low(?:er)?)\b/i.test(report.impression) || /\b(within|normal|above|not)\b/i.test(report.impression)))
      add('hemoglobin-summary', 'impression', 'Reconcile the summary', '10.2 is below the supplied fictional interval of 12.0–16.0 g/dL. The summary should describe that comparison without inventing a diagnosis.');
  }
  return issues;
}
