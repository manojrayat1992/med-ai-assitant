import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NewReportPage } from './NewReportPage';
import { patientService } from '@/services/patientService';
import { reportingService } from '@/services/reportingService';

vi.mock('@/stores/authStore', () => ({ useAuthStore: (select: (s: {role:string}) => unknown) => select({role:'DOCTOR'}) }));
vi.mock('@/services/patientService', () => ({ patientService: { list: vi.fn() } }));
vi.mock('@/services/reportingService', () => ({ reportingService: { templates: vi.fn(), createDraft: vi.fn(), saveTemplate: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(patientService.list).mockResolvedValue({ content: [{id:'p1', fullName:'Asha Menon', medicalRecordNumber:'MRN1', dateOfBirth:'1979-04-12'}], totalPages:1 } as never);
  vi.mocked(reportingService.templates).mockResolvedValue([{ id:'t1', name:'Chest', modality:'XRAY', body:'FINDINGS\n\nIMPRESSION\n', createdAt:'' }]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function mount() { render(<MemoryRouter><Routes><Route path="/" element={<NewReportPage />} /><Route path="/clinical-workspace/:id" element={<p>Saved workspace</p>} /></Routes></MemoryRouter>); }
it('creates a patient report and opens the saved workspace', async () => {
  vi.mocked(reportingService.createDraft).mockResolvedValue({id:'r1'} as never);
  mount(); const user = userEvent.setup();
  await user.click(await screen.findByRole('button', {name:/Asha Menon/}));
  await user.type(screen.getByLabelText('Study description'), 'Chest X-ray');
  await user.clear(screen.getByLabelText('Report text'));
  await user.type(screen.getByLabelText('Report text'), 'FINDINGS\nClear lungs.');
  await user.click(screen.getByRole('button', {name:'Save draft and open workspace'}));
  await screen.findByText('Saved workspace');
  expect(reportingService.createDraft).toHaveBeenCalledWith({patientId:'p1', modality:'XRAY', studyDescription:'Chest X-ray', reportText:'FINDINGS\nClear lungs.'});
});
it('keeps authored text when replacing a template is cancelled and saving fails', async () => {
  vi.mocked(reportingService.createDraft).mockRejectedValue(new Error('offline'));
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount(); const user = userEvent.setup();
  await user.click(await screen.findByRole('button', {name:/Asha Menon/}));
  await user.type(screen.getByLabelText('Study description'), 'Chest');
  await user.type(screen.getByLabelText('Report text'), 'Keep this finding');
  await user.selectOptions(screen.getByLabelText('Report template'), 't1');
  await user.click(screen.getByRole('button', {name:'Apply template'}));
  expect((screen.getByLabelText('Report text') as HTMLTextAreaElement).value).toContain('Keep this finding');
  await user.click(screen.getByRole('button', {name:'Save draft and open workspace'}));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Report text') as HTMLTextAreaElement).value).toContain('Keep this finding');
  await waitFor(() => expect(screen.getByRole('button', {name:'Save draft and open workspace'})).toBeEnabled());
});
it('starts template authoring without copying patient report content', async () => {
  mount(); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Report text'), 'Private clinical content');
  await user.click(screen.getByRole('button', {name:'Create template'}));
  expect((screen.getByLabelText('Template structure') as HTMLTextAreaElement).value).not.toContain('Private clinical content');
});

it('offers usable starter templates for an organisation with no saved templates', async () => {
  vi.mocked(reportingService.templates).mockResolvedValue([]);
  mount(); const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Report template'), 'starter-ct-head');
  await user.click(screen.getByRole('button', {name:'Apply template'}));
  expect(screen.getByLabelText('Modality')).toHaveValue('CT_SCAN');
  expect((screen.getByLabelText('Report text') as HTMLTextAreaElement).value).toContain('Brain parenchyma:');
  expect((screen.getByLabelText('Report text') as HTMLTextAreaElement).value).not.toContain('normal');
});
it('keeps starter templates available when the organisation template API fails', async () => {
  vi.mocked(reportingService.templates).mockRejectedValue(new Error('offline'));
  mount(); const user = userEvent.setup();
  await screen.findByText('Organisation templates could not be loaded. Starter templates are still available.');
  await user.selectOptions(screen.getByLabelText('Report template'), 'starter-chest-xray');
  await user.click(screen.getByRole('button', {name:'Apply template'}));
  expect((screen.getByLabelText('Report text') as HTMLTextAreaElement).value).toContain('Lungs and pleura:');
});

it('applies example content after confirmation', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mount(); const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Report template'), 'example-chest-xray');
  await user.click(screen.getByRole('button', {name:'Apply template'}));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('fictional normal findings'));
  expect((screen.getByLabelText('Report text') as HTMLTextAreaElement).value).toContain('No acute cardiopulmonary abnormality.');
});
it('does not insert example findings when confirmation is cancelled', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount(); const user = userEvent.setup();
  const original = (screen.getByLabelText('Report text') as HTMLTextAreaElement).value;
  await user.selectOptions(screen.getByLabelText('Report template'), 'example-ct-head');
  await user.click(screen.getByRole('button', {name:'Apply template'}));
  expect(screen.getByLabelText('Report text')).toHaveValue(original);
});
