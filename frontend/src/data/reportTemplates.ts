import type { ReportTemplate } from '@/services/reportingService';

// Original authoring examples and structures; not validated protocols or patient-derived findings.
// They are bundled with the app so a new organisation can start without saved templates.
export const starterReportTemplates: (ReportTemplate & { isExample?: boolean })[] = [
  {
    id: 'starter-chest-xray', name: 'Chest X-ray', modality: 'XRAY', createdAt: '',
    body: 'FINDINGS\nLungs and pleura:\nCardiomediastinal silhouette:\nBones and soft tissues:\n\nCOMPARISON\n\nIMPRESSION\n',
  },
  {
    id: 'starter-ct-head', name: 'CT head', modality: 'CT_SCAN', createdAt: '',
    body: 'FINDINGS\nBrain parenchyma:\nVentricles and extra-axial spaces:\nSkull and visualised extracranial structures:\n\nCOMPARISON\n\nIMPRESSION\n',
  },
  {
    id: 'starter-mri', name: 'MRI report structure', modality: 'MRI', createdAt: '',
    body: 'FINDINGS\nExamined region:\nObservations:\n\nCOMPARISON\n\nIMPRESSION\n',
  },
  {
    id: 'starter-ultrasound', name: 'Ultrasound report structure', modality: 'ULTRASOUND', createdAt: '',
    body: 'FINDINGS\nExamined region:\nObservations and measurements:\n\nCOMPARISON\n\nIMPRESSION\n',
  },
  {
    id: 'starter-general', name: 'General report structure', modality: 'OTHER', createdAt: '',
    body: 'FINDINGS\n\nCOMPARISON\n\nIMPRESSION\n',
  },
  {
    id: 'example-chest-xray', name: 'Chest X-ray — normal example', modality: 'XRAY', createdAt: '', isExample: true,
    body: 'FINDINGS\nThe lungs are clear. No focal air-space opacity, pleural effusion or pneumothorax. The cardiomediastinal silhouette is within normal limits. No acute osseous abnormality is identified.\n\nCOMPARISON\n[Enter the actual prior examination and date, or state that none is available.]\n\nIMPRESSION\nNo acute cardiopulmonary abnormality.\n',
  },
  {
    id: 'example-ct-head', name: 'CT head without contrast — normal example', modality: 'CT_SCAN', createdAt: '', isExample: true,
    body: 'FINDINGS\nNo acute intracranial haemorrhage, mass effect or midline shift. Grey-white differentiation is preserved. The ventricles are not enlarged. No extra-axial collection or acute calvarial fracture is identified.\n\nCOMPARISON\n[Enter the actual prior examination and date, or state that none is available.]\n\nIMPRESSION\nNo acute intracranial abnormality on this noncontrast CT examination.\n',
  },
  {
    id: 'example-mri-brain', name: 'MRI brain without contrast — normal example', modality: 'MRI', createdAt: '', isExample: true,
    body: 'FINDINGS\nNo restricted diffusion to suggest acute infarction. No mass effect or midline shift. No focal brain parenchymal signal abnormality is identified. The ventricles and sulci are within normal limits. No extra-axial collection is seen.\n\nCOMPARISON\n[Enter the actual prior examination and date, or state that none is available.]\n\nIMPRESSION\nNo acute intracranial abnormality on this noncontrast MRI examination.\n',
  },
  {
    id: 'example-ultrasound-abdomen', name: 'Abdominal ultrasound — normal example', modality: 'ULTRASOUND', createdAt: '', isExample: true,
    body: 'FINDINGS\nThe liver has homogeneous echotexture with no focal lesion identified. No gallstones or gallbladder wall thickening is seen. No biliary ductal dilatation. The visualised pancreas and spleen are unremarkable. Both kidneys have preserved cortical echogenicity without hydronephrosis. No ascites is identified.\n\nCOMPARISON\n[Enter the actual prior examination and date, or state that none is available.]\n\nIMPRESSION\nNo sonographic abnormality identified in the visualised abdominal organs.\n',
  },
];
