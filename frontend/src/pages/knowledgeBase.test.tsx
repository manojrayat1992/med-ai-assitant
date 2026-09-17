import userEvent from '@testing-library/user-event';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KnowledgeBasePage } from './KnowledgeBasePage';
import { useAuthStore } from '@/stores/authStore';
import { knowledgeService } from '@/services/knowledgeService';
import { Sidebar } from '@/components/layout/Sidebar';
vi.mock('@/services/knowledgeService', () => ({knowledgeService: {listDocuments: vi.fn(), uploadDocument: vi.fn()}}));
vi.mock('@/services/pilotApplicationApi', () => ({pilotApplicationApi: {access: vi.fn().mockResolvedValue(false)}}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(knowledgeService.listDocuments).mockResolvedValue({content: [], totalElements:0} as never);
  useAuthStore.setState({role:'HOSPITAL_ADMIN'});
});
afterEach(() => {cleanup(); useAuthStore.getState().clear();});
it('opens reference documents by default for workspace admins and exposes the navigation', async () => {
  render(<MemoryRouter><Sidebar/><KnowledgeBasePage/></MemoryRouter>);
  expect(screen.getByRole('link', {name:'Knowledge Base'})).toHaveAttribute('href','/upload');
  expect(await screen.findByText(/No documents found/)).toBeInTheDocument();
  expect(screen.getByText(/Admin-managed protocols/)).toBeInTheDocument();
  expect(screen.getByRole('link', {name:/For patient reports/})).toHaveAttribute('href','/patients');
});
it('does not load knowledge management for non-admin users', () => {
  useAuthStore.setState({role:'DOCTOR'});
  render(<MemoryRouter><KnowledgeBasePage/></MemoryRouter>);
  expect(screen.getByText(/Workspace administrators manage/)).toBeInTheDocument();
  expect(knowledgeService.listDocuments).not.toHaveBeenCalled();
});

it('uploads guardrails and keeps failed indexing visible instead of claiming success', async () => {
  const user = userEvent.setup();
  vi.mocked(knowledgeService.uploadDocument).mockResolvedValue({status:'FAILED', errorMessage:'No readable text'} as never);
  render(<MemoryRouter><KnowledgeBasePage/></MemoryRouter>);
  await user.click(screen.getByRole('button', {name:'Upload reference document'}));
  const file = new File(['Require review.'], 'guardrail.txt', {type:'text/plain'});
  await user.upload(screen.getByLabelText('Reference file'), file);
  await user.selectOptions(screen.getByLabelText('Category'), 'GUARDRAIL');
  await user.click(screen.getByRole('button', {name:'Upload & Index Document'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('No readable text');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(knowledgeService.uploadDocument).toHaveBeenCalledWith(file, 'guardrail', 'GUARDRAIL', undefined);
});
