import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiSettingsService, type AiSettingsView } from '@/services/aiSettingsService';
import { useAuthStore } from '@/stores/authStore';
import { SettingsPage } from './SettingsPage';

vi.mock('@/services/aiSettingsService', () => ({
  aiSettingsService: {
    get: vi.fn(),
    update: vi.fn(),
    reset: vi.fn(),
    test: vi.fn(),
  },
}));

describe('Settings AI provider controls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().clear();
  });

  it('lets a hospital admin save a provider key without displaying the raw key', async () => {
    const user = userEvent.setup();
    vi.mocked(aiSettingsService.get).mockResolvedValue(settingsView());
    vi.mocked(aiSettingsService.update).mockResolvedValue(settingsView({
      provider: 'OPENAI',
      baseUrl: 'https://api.openai.com',
      chatModel: 'gpt-4o',
      usingTenantSettings: true,
      keyConfigured: true,
      apiKeyPreview: 'ends in 1234',
    }));

    useAuthStore.getState().setAuth({
      accessToken: 'test-access-token',
      userId: 'admin-user-id',
      tenantId: 'tenant-id',
      email: 'admin@example.test',
      fullName: 'Dr. Admin',
      role: 'HOSPITAL_ADMIN',
      tenantName: 'QA Hospital',
    });

    render(<SettingsPage />);

    await screen.findByRole('heading', { name: /AI Provider/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /^Provider$/i }), 'OPENAI');
    await user.type(screen.getByLabelText(/API Key/i), 'sk-test-secret-1234');
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(aiSettingsService.update).toHaveBeenCalledWith({
        provider: 'OPENAI',
        baseUrl: 'https://api.openai.com',
        chatModel: 'gpt-4o',
        apiKey: 'sk-test-secret-1234',
        enabled: true,
        dataAgreementInPlace: false,
      });
    });
    expect(await screen.findByText('ends in 1234')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('sk-test-secret-1234')).not.toBeInTheDocument();
  });

  it('lets a hospital admin test the stored provider connection', async () => {
    const user = userEvent.setup();
    vi.mocked(aiSettingsService.get).mockResolvedValue(settingsView({
      provider: 'OPENAI',
      baseUrl: 'https://api.openai.com',
      chatModel: 'gpt-4o',
      usingTenantSettings: true,
      keyConfigured: true,
      apiKeyPreview: 'ends in 1234',
    }));
    vi.mocked(aiSettingsService.test).mockResolvedValue({
      provider: 'OPENAI',
      baseUrl: 'https://api.openai.com',
      chatModel: 'gpt-4o',
      tenantManaged: true,
      success: true,
      message: 'Provider responded: OK',
    });

    useAuthStore.getState().setAuth({
      accessToken: 'test-access-token',
      userId: 'admin-user-id',
      tenantId: 'tenant-id',
      email: 'admin@example.test',
      fullName: 'Dr. Admin',
      role: 'HOSPITAL_ADMIN',
      tenantName: 'QA Hospital',
    });

    render(<SettingsPage />);

    await screen.findByText('ends in 1234');
    await user.click(screen.getByRole('button', { name: /^Test$/i }));

    await waitFor(() => {
      expect(aiSettingsService.test).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('OPENAI test passed on gpt-4o')).toBeInTheDocument();
  });

  it('does not load tenant AI settings for non-admin users', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'test-access-token',
      userId: 'doctor-user-id',
      tenantId: 'tenant-id',
      email: 'doctor@example.test',
      fullName: 'Dr. Mira Patel',
      role: 'DOCTOR',
      tenantName: 'QA Hospital',
    });

    render(<SettingsPage />);

    expect(screen.queryByRole('heading', { name: /AI Provider/i })).not.toBeInTheDocument();
    expect(aiSettingsService.get).not.toHaveBeenCalled();
  });
});

function settingsView(overrides: Partial<AiSettingsView> = {}): AiSettingsView {
  return {
    provider: 'GROQ',
    baseUrl: 'https://api.groq.com/openai',
    chatModel: 'qwen/qwen3.6-27b',
    enabled: true,
    keyConfigured: false,
    apiKeyPreview: null,
    dataAgreementInPlace: false,
    usingTenantSettings: false,
    updatedAt: null,
    ...overrides,
  };
}
