import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { integrationConnectorsApi as api } from '@/services/integrationConnectorsApi';
import { useAuthStore } from '@/stores/authStore';
import { IntegrationsPage } from './IntegrationsPage';
vi.mock('@/services/integrationConnectorsApi', () => ({integrationConnectorsApi: {
  getConnectors: vi.fn(), saveConnector: vi.fn(), pingConnector: vi.fn(), parseHl7: vi.fn(),
}}));
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({role:'HOSPITAL_ADMIN'});
  vi.mocked(api.getConnectors).mockResolvedValue([]);
});
afterEach(() => {cleanup(); useAuthStore.getState().clear();});
it('shows an empty configuration without seeded connected hospitals', async () => {
  render(<IntegrationsPage />);
  expect(await screen.findByText('No connectors configured. Add your endpoint above.')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name:'Test connection'})).not.toBeInTheDocument();
});
it('surfaces backend failure instead of returning demo connectors', async () => {
  vi.mocked(api.getConnectors).mockRejectedValue(new Error('offline'));
  render(<IntegrationsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
  expect(screen.queryByRole('button', {name:'Test connection'})).not.toBeInTheDocument();
});
it('saves entered settings and clears the password field', async () => {
  const user = userEvent.setup();
  vi.mocked(api.saveConnector).mockResolvedValue({id:'one',tenantId:'test-tenant',name:'My archive',type:'ORTHANC',status:'DISCONNECTED',endpointUrl:'http://orthanc:8042', credentialsConfigured:true, latencyMs:null,createdAt:''});
  render(<IntegrationsPage />);
  await screen.findByText('No connectors configured. Add your endpoint above.');
  await user.type(screen.getByLabelText('Name'), 'My archive');
  await user.type(screen.getByLabelText('Endpoint base URL'), 'http://orthanc:8042');
  await user.type(screen.getByLabelText('HTTP username'), 'medai');
  await user.type(screen.getByLabelText('HTTP password'), 'test-secret');
  await user.click(screen.getByRole('button', {name:'Save connector'}));
  await waitFor(() => expect(api.saveConnector).toHaveBeenCalledWith(expect.objectContaining({endpointUrl:'http://orthanc:8042',username:'medai',password:'test-secret'})));
  expect(await screen.findByText('DISCONNECTED')).toBeInTheDocument();
  expect(screen.getByLabelText('HTTP password')).toHaveValue('');
});
it('shows a failed remote test as ERROR with the server explanation', async () => {
  const user = userEvent.setup();
  vi.mocked(api.getConnectors).mockResolvedValue([{id:'one',tenantId:'test-tenant',name:'Archive',type:'ORTHANC',status:'DISCONNECTED',latencyMs:null,createdAt:''}]);
  vi.mocked(api.pingConnector).mockResolvedValue({connectorId:'one',status:'ERROR',latencyMs:null,message:'Remote check returned HTTP 401.',timestamp:'2026-09-15T10:00:00Z'});
  render(<IntegrationsPage />);
  await user.click(await screen.findByRole('button', {name:'Test connection'}));
  expect(await screen.findByText('ERROR')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('HTTP 401');
});
it('displays a rejected message without invented patient findings', async () => {
  const user = userEvent.setup();
  vi.mocked(api.parseHl7).mockResolvedValue({success:false,findings:[],impression:[],parseNotes:'PID-3 is required.'});
  render(<IntegrationsPage />);
  await screen.findByText('No connectors configured. Add your endpoint above.');
  await user.click(screen.getByRole('button', {name:'HL7 sandbox'}));
  await user.click(screen.getByRole('button', {name:'Validate message'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Validation rejected: PID-3 is required.');
  expect(screen.queryByText('Eleanor Vance')).not.toBeInTheDocument();
});
it('does not request connectors for non-admins', () => {
  useAuthStore.setState({role:'DOCTOR'}); render(<IntegrationsPage />);
  expect(screen.getByRole('alert')).toHaveTextContent('Hospital administrator access');
  expect(api.getConnectors).not.toHaveBeenCalled();
});
