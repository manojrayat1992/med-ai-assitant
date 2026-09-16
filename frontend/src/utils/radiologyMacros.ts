export interface RadiologyMacro {
  shortcut: string;
  name: string;
  category: 'X-RAY' | 'CT' | 'MRI' | 'GENERAL';
  findings: string;
  impression: string;
}

export const RADIOLOGY_MACROS: RadiologyMacro[] = [
  {
    shortcut: '.normalcxr',
    name: 'Normal Chest X-Ray',
    category: 'X-RAY',
    findings:
      'Clear lung fields bilaterally without focal consolidation, pleural effusion, or pneumothorax. Cardiac silhouette and mediastinal contours are within normal limits. Osseous structures and soft tissues are intact.',
    impression: 'No acute cardiopulmonary process.',
  },
  {
    shortcut: '.normalctbrain',
    name: 'Unremarkable CT Brain',
    category: 'CT',
    findings:
      'No acute intracranial hemorrhage, mass effect, or midline shift. Ventricles and sulci are within normal limits for age. Grey-white matter differentiation is preserved. Basal cisterns are patent.',
    impression: 'Unremarkable CT scan of the brain. No acute intracranial abnormality.',
  },
  {
    shortcut: '.normalctabd',
    name: 'Normal CT Abdomen & Pelvis',
    category: 'CT',
    findings:
      'Liver, gallbladder, spleen, pancreas, kidneys, and adrenal glands are normal in appearance. No bowel obstruction or pneumoperitoneum. No free fluid or pathologically enlarged retroperitoneal lymphadenopathy.',
    impression: 'No acute intra-abdominal or pelvic pathology.',
  },
  {
    shortcut: '.fracture',
    name: 'Acute Fracture Template',
    category: 'GENERAL',
    findings:
      'Cortical disruption and lucency observed involving the specified osseous structure. Surrounding soft tissue swelling present without evidence of joint dislocation.',
    impression: 'Acute fracture as described. Clinical correlation and orthopedic follow-up recommended.',
  },
  {
    shortcut: '.normalmribrain',
    name: 'Normal Brain MRI',
    category: 'MRI',
    findings:
      'Brain parenchyma demonstrates normal signal intensity without evidence of acute infarction, hemorrhage, or abnormal enhancement. Ventricles and extra-axial CSF spaces are unremarkable.',
    impression: 'Normal MRI of the brain.',
  },
];

/** Matches shortcuts like .normalcxr, .normalctbrain, .fracture */
export function findMacro(text: string): RadiologyMacro | undefined {
  const normalized = text.trim().toLowerCase();
  return RADIOLOGY_MACROS.find(
    (m) => m.shortcut.toLowerCase() === normalized || m.name.toLowerCase() === normalized
  );
}

export function expandMacroInText(text: string): { expandedText: string; appliedMacro?: RadiologyMacro } {
  let modified = text;
  let matchedMacro: RadiologyMacro | undefined;

  for (const macro of RADIOLOGY_MACROS) {
    if (modified.toLowerCase().includes(macro.shortcut.toLowerCase())) {
      const regex = new RegExp(`\\${macro.shortcut}`, 'gi');
      modified = modified.replace(regex, macro.findings);
      matchedMacro = macro;
    }
  }

  return { expandedText: modified, appliedMacro: matchedMacro };
}
