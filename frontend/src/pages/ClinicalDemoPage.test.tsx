import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ClinicalDemoPage } from './ClinicalDemoPage';
import { demoCases } from '@/demo/clinicalDemo';
afterEach(() => {cleanup(); vi.restoreAllMocks();});
function show(path='/demo') {render(<MemoryRouter initialEntries={[path]}><ClinicalDemoPage /></MemoryRouter>);}
it('lets an anonymous visitor find, edit and rerun issues with stale-result feedback', async () => {
  const user = userEvent.setup(); show();
  expect(screen.getByText(/Synthetic cases only/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', {name:'Run demo QA'}));
  expect(screen.getByText('2 items to review')).toBeInTheDocument();
  for (const section of ['findings','impression'] as const) {
    await user.clear(screen.getByRole('textbox', {name:section}));
    await user.type(screen.getByRole('textbox', {name:section}), demoCases[0].example[section]);
  }
  expect(screen.getByRole('alert')).toHaveTextContent('Draft changed');
  await user.click(screen.getByRole('button', {name:'Run demo QA'}));
  expect(screen.getByText('Draft matches the demo checks')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', {name:'Reset case'}));
  expect(screen.getByRole('textbox', {name:'findings'})).toHaveValue(demoCases[0].initial.findings);
  expect(screen.queryByText('Draft matches the demo checks')).not.toBeInTheDocument();
});
it('switches cases without retaining edits or QA results', async () => {
  const user = userEvent.setup(); show();
  await user.click(screen.getByRole('button', {name:'Run demo QA'}));
  await user.click(screen.getByRole('button', {name:/Laboratory · Synthetic case/}));
  expect(screen.getByRole('textbox', {name:'findings'})).toHaveValue('Hemoglobin: 12.0 g/dL.');
  expect(screen.queryByText('2 items to review')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', {name:'Run demo QA'}));
  expect(screen.getByText('Reconcile value and unit')).toBeInTheDocument();
});
it('shares only a case URL and supports direct links', async () => {
  const user = userEvent.setup(); show('/demo?case=laboratory');
  await user.type(screen.getByRole('textbox', {name:'findings'}), 'PRIVATE-DRAFT-MARKER');
  await user.click(screen.getByRole('button', {name:'Share case'}));
  const value = (screen.getByRole('textbox', {name:'Shareable case link'}) as HTMLInputElement).value;
  expect(value).toMatch(/\/demo\?case=laboratory$/);
  expect(value).not.toContain('PRIVATE-DRAFT-MARKER');
});
it('falls back to the radiology case for unknown links', () => {
  show('/demo?case=unknown');
  expect(screen.getByRole('textbox', {name:'findings'})).toHaveValue(demoCases[0].initial.findings);
  expect(document.querySelector('input[type=file]')).toBeNull();
});
