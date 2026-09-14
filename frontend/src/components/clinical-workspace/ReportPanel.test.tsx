import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ReportPanel } from './ReportPanel';
import type { DraftReport } from '@/types/clinicalWorkspace';
afterEach(cleanup);
it('keeps the editor open with clinician text when saving fails', async () => {
  const save = vi.fn().mockResolvedValue(false);
  const report = { createdAt:'Today', radiologist:'Doctor', sections:[{id:'findings', title:'Findings', body:['Original text']}] } as DraftReport;
  render(<ReportPanel report={report} onSaveReport={save} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', {name:'Edit'}));
  await user.type(screen.getByRole('textbox'), ' with correction');
  await user.click(screen.getByRole('button', {name:'Save Draft'}));
  expect(screen.getByRole('textbox')).toHaveValue('Original text with correction');
  expect(save).toHaveBeenCalled();
});
