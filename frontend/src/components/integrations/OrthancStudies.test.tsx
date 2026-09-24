import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '@/services/api';
import type { PacsConnector } from '@/types/integration';
import { OrthancStudies } from './OrthancStudies';
vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));
const connector = { id: 'connector-1', name: 'Test archive', type: 'ORTHANC' } as PacsConnector;
const study = { id: 'study-1', description: 'Synthetic chest', patientName: 'Test Patient', patientId: 'P1', seriesCount: 1, studyInstanceUid: '1.2.3' };
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('guides admins when no Orthanc connector exists', () => {
  render(<OrthancStudies connectors={[]} />);
  expect(screen.getByText(/No Orthanc connectors configured/)).toBeVisible();
  expect(api.get).not.toHaveBeenCalled();
});
it('loads studies, details and series through the selected connector', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: { data: url.endsWith('/series')
    ? [{ id: 'series-1', modality: 'CT', description: 'Axial', instanceCount: 32 }]
    : url.endsWith('/study-1') ? study : { content: [study], hasMore: true } } }));
  const user = userEvent.setup();
  render(<OrthancStudies connectors={[connector]} />);
  await user.click(await screen.findByRole('button', { name: 'View study Synthetic chest' }));
  expect(await screen.findByText(/32 instances/)).toBeVisible();
  expect(api.get).toHaveBeenCalledWith('/integrations/connectors/connector-1/studies/study-1');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(api.get).toHaveBeenCalledWith('/integrations/connectors/connector-1/studies', { params: { offset: 20, limit: 20 } });
});
it('shows errors and allows refreshing to an empty archive', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { data: { content: [], hasMore: false } } });
  const user = userEvent.setup();
  render(<OrthancStudies connectors={[connector]} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load Orthanc data');
  await user.click(screen.getByRole('button', { name: 'Refresh studies' }));
  expect(await screen.findByText(/No studies on this page/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});
