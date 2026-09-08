import { useAuthStore } from '@/stores/authStore';
import { aiSettingsService, type AiProvider, type AiSettingsView } from '@/services/aiSettingsService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Shield, Bell, Database, User, Building2,
  Moon, Sun, Key, Globe2, Mail, Zap, Save, RefreshCw, RotateCcw, AlertTriangle, Wifi,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const providerDefaults: Record<AiProvider, { baseUrl: string; chatModel: string }> = {
  OPENAI: { baseUrl: 'https://api.openai.com', chatModel: 'gpt-4o' },
  GROQ: { baseUrl: 'https://api.groq.com/openai', chatModel: 'qwen/qwen3.6-27b' },
  CUSTOM: { baseUrl: '', chatModel: '' },
};

interface AiSettingsForm {
  provider: AiProvider;
  baseUrl: string;
  chatModel: string;
  apiKey: string;
  enabled: boolean;
  dataAgreementInPlace: boolean;
}

const initialAiForm: AiSettingsForm = {
  provider: 'OPENAI',
  baseUrl: providerDefaults.OPENAI.baseUrl,
  chatModel: providerDefaults.OPENAI.chatModel,
  apiKey: '',
  enabled: true,
  dataAgreementInPlace: false,
};

export function SettingsPage() {
  const { tenantName, role, email, fullName } = useAuthStore();
  const [darkMode, setDarkMode] = useState(true);
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null);
  const [aiForm, setAiForm] = useState<AiSettingsForm>(initialAiForm);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const isHospitalAdmin = role === 'HOSPITAL_ADMIN';
  const controlsDisabled = aiLoading || aiSaving || aiTesting;

  const aiProviderLabel = useMemo(() => {
    if (!aiSettings) return 'Not loaded';
    if (!aiSettings.keyConfigured) return 'Key required';
    return aiSettings.usingTenantSettings ? 'Hospital managed' : 'Server default';
  }, [aiSettings]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('light', !next);
      return next;
    });
  };

  const infoRows = [
    { icon: User,      label: 'Full Name', value: fullName ?? '—' },
    { icon: Mail,      label: 'Email',     value: email ?? '—' },
    { icon: Shield,    label: 'Role',      value: role?.replace(/_/g, ' ') ?? '—' },
    { icon: Building2, label: 'Hospital',  value: tenantName ?? '—' },
  ];

  const comingSoon = [
    { icon: Key,      title: 'Change Password',       sub: 'Update your login credentials securely' },
    { icon: Globe2,   title: '2-Factor Auth',          sub: 'Add an extra layer of account security' },
    { icon: Bell,     title: 'Email Notifications',    sub: 'Alerts for critical AI findings & reports' },
    { icon: Database, title: 'Knowledge Base Manage',  sub: 'Upload, update, and purge hospital protocols' },
  ];

  useEffect(() => {
    if (!isHospitalAdmin) {
      return;
    }

    let cancelled = false;

    async function loadAiSettings() {
      setAiLoading(true);
      setAiError(null);
      try {
        const settings = await aiSettingsService.get();
        if (!cancelled) {
          applyAiSettings(settings);
        }
      } catch (err) {
        if (!cancelled) {
          setAiError(errorMessage(err, 'Could not load AI settings'));
        }
      } finally {
        if (!cancelled) {
          setAiLoading(false);
        }
      }
    }

    loadAiSettings();

    return () => {
      cancelled = true;
    };
  }, [isHospitalAdmin]);

  const applyAiSettings = (settings: AiSettingsView) => {
    setAiSettings(settings);
    setAiForm({
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      chatModel: settings.chatModel,
      apiKey: '',
      enabled: settings.enabled,
      dataAgreementInPlace: settings.dataAgreementInPlace,
    });
  };

  const updateAiForm = <K extends keyof AiSettingsForm>(key: K, value: AiSettingsForm[K]) => {
    setAiForm((prev) => ({ ...prev, [key]: value }));
  };

  const changeProvider = (provider: AiProvider) => {
    setAiForm((prev) => {
      const defaults = providerDefaults[provider];
      return {
        ...prev,
        provider,
        baseUrl: defaults.baseUrl || prev.baseUrl,
        chatModel: defaults.chatModel || prev.chatModel,
      };
    });
  };

  const saveAiSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAiSaving(true);
    setAiMessage(null);
    setAiError(null);
    try {
      const settings = await aiSettingsService.update({
        provider: aiForm.provider,
        baseUrl: aiForm.baseUrl,
        chatModel: aiForm.chatModel,
        apiKey: aiForm.apiKey.trim() || undefined,
        enabled: aiForm.enabled,
        dataAgreementInPlace: aiForm.dataAgreementInPlace,
      });
      applyAiSettings(settings);
      setAiMessage('AI settings saved');
    } catch (err) {
      setAiError(errorMessage(err, 'Could not save AI settings'));
    } finally {
      setAiSaving(false);
    }
  };

  const resetAiSettings = async () => {
    setAiSaving(true);
    setAiMessage(null);
    setAiError(null);
    try {
      const settings = await aiSettingsService.reset();
      applyAiSettings(settings);
      setAiMessage('Using server defaults');
    } catch (err) {
      setAiError(errorMessage(err, 'Could not reset AI settings'));
    } finally {
      setAiSaving(false);
    }
  };

  const testAiSettings = async () => {
    setAiTesting(true);
    setAiMessage(null);
    setAiError(null);
    try {
      const result = await aiSettingsService.test();
      setAiMessage(`${result.provider} test passed on ${result.chatModel}`);
    } catch (err) {
      setAiError(errorMessage(err, 'Could not reach the AI provider'));
    } finally {
      setAiTesting(false);
    }
  };

  return (
    <div className="space-y-7 max-w-[900px]">
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--clr-text-3)' }}>Manage your account and workspace preferences</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" style={{ color: '#3b82f6' }} />
              Account Info
            </CardTitle>
            <CardDescription>Your profile and role details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {infoRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between py-3"
                style={{ borderBottom: '1px solid var(--clr-border, #1e2d45)' }}>
                <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--clr-text-3)' }}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
                <span className="text-xs font-semibold text-white">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {darkMode ? <Moon className="h-4 w-4" style={{ color: '#8b5cf6' }} /> : <Sun className="h-4 w-4" style={{ color: '#f59e0b' }} />}
              Appearance
            </CardTitle>
            <CardDescription>Choose how Med-AI looks to you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-3 mb-3"
              style={{ borderBottom: '1px solid var(--clr-border)' }}>
              <div>
                <p className="text-sm font-medium text-white">Dark mode</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
                  {darkMode ? 'Navy dark theme (default)' : 'Light clinical theme'}
                </p>
              </div>
              <button
                onClick={toggleDarkMode}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ background: darkMode ? '#3b82f6' : '#475569' }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: darkMode ? 'translateX(24px)' : 'translateX(4px)' }}
                />
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--clr-text-3)' }}>
              Your preference is saved in your browser.
            </p>
          </CardContent>
        </Card>
      </div>

      {isHospitalAdmin && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" style={{ color: '#22c55e' }} />
                  AI Provider
                </CardTitle>
                <CardDescription>Hospital model and key used for AI analysis and clinical chat</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-slate text-[10px]">{aiProviderLabel}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Refresh AI settings"
                  title="Refresh AI settings"
                  onClick={() => aiSettingsService.get().then(applyAiSettings).catch((err) => {
                    setAiError(errorMessage(err, 'Could not load AI settings'));
                  })}
                  disabled={controlsDisabled}
                >
                  <RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveAiSettings} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold" style={{ color: 'var(--clr-text-2)' }}>Provider</span>
                  <select
                    className="input-field h-10 text-sm"
                    value={aiForm.provider}
                    onChange={(event) => changeProvider(event.target.value as AiProvider)}
                    disabled={controlsDisabled}
                  >
                    <option value="OPENAI">OpenAI</option>
                    <option value="GROQ">Groq</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--clr-text-2)' }}>Base URL</span>
                  <Input
                    value={aiForm.baseUrl}
                    onChange={(event) => updateAiForm('baseUrl', event.target.value)}
                    placeholder="https://api.openai.com"
                    disabled={controlsDisabled}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold" style={{ color: 'var(--clr-text-2)' }}>Chat Model</span>
                  <Input
                    value={aiForm.chatModel}
                    onChange={(event) => updateAiForm('chatModel', event.target.value)}
                    placeholder="gpt-4o"
                    disabled={controlsDisabled}
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="flex items-center justify-between gap-3 text-xs font-semibold" style={{ color: 'var(--clr-text-2)' }}>
                    <span>API Key</span>
                    {aiSettings?.apiKeyPreview && (
                      <span className="font-medium" style={{ color: 'var(--clr-text-3)' }}>
                        {aiSettings.apiKeyPreview}
                      </span>
                    )}
                  </span>
                  <Input
                    type="password"
                    value={aiForm.apiKey}
                    onChange={(event) => updateAiForm('apiKey', event.target.value)}
                    placeholder={aiSettings?.keyConfigured ? 'Leave blank to keep current key' : 'Paste provider key'}
                    disabled={controlsDisabled}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label
                  className="flex items-start gap-3 rounded-lg p-3"
                  style={{ background: 'var(--surface-2, #1a2235)', border: '1px solid var(--clr-border, #1e2d45)' }}
                >
                  <input
                    type="checkbox"
                    checked={aiForm.enabled}
                    onChange={(event) => updateAiForm('enabled', event.target.checked)}
                    className="mt-1 h-4 w-4 accent-blue-500"
                    disabled={controlsDisabled}
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">Use hospital key</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
                      Falls back to server defaults when disabled
                    </span>
                  </span>
                </label>

                <label
                  className="flex items-start gap-3 rounded-lg p-3"
                  style={{ background: 'var(--surface-2, #1a2235)', border: '1px solid var(--clr-border, #1e2d45)' }}
                >
                  <input
                    type="checkbox"
                    checked={aiForm.dataAgreementInPlace}
                    onChange={(event) => updateAiForm('dataAgreementInPlace', event.target.checked)}
                    className="mt-1 h-4 w-4 accent-green-500"
                    disabled={controlsDisabled}
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">Data agreement in place</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
                      For PHI sent to external AI providers
                    </span>
                  </span>
                </label>
              </div>

              {(aiError || aiMessage || (!aiLoading && aiSettings && !aiSettings.keyConfigured)) && (
                <div
                  className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: aiError || !aiSettings?.keyConfigured ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    color: aiError || !aiSettings?.keyConfigured ? '#fca5a5' : '#86efac',
                    border: `1px solid ${aiError || !aiSettings?.keyConfigured ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{aiError ?? aiMessage ?? 'Add an API key before enabling hospital-managed AI.'}</span>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs" style={{ color: 'var(--clr-text-3)' }}>
                  Stored keys are encrypted and never shown again.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testAiSettings}
                    disabled={controlsDisabled || Boolean(aiForm.apiKey.trim())}
                  >
                    <Wifi className={`h-4 w-4 ${aiTesting ? 'animate-pulse' : ''}`} />
                    {aiTesting ? 'Testing...' : 'Test'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetAiSettings} disabled={controlsDisabled}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button type="submit" disabled={controlsDisabled}>
                    <Save className="h-4 w-4" />
                    {aiSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Coming Soon */}
      <div>
        <h2 className="text-sm font-bold text-white mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>Coming Soon</h2>
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface, #111827)', border: '1px solid var(--clr-border, #1e2d45)' }}>
          {comingSoon.map(({ icon: Icon, title, sub }, i) => (
            <div
              key={title}
              className="flex items-center gap-4 px-5 py-4 transition-colors"
              style={{ borderBottom: i < comingSoon.length - 1 ? '1px solid var(--clr-border, #1e2d45)' : 'none', opacity: 0.6, cursor: 'not-allowed' }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Icon className="h-4 w-4" style={{ color: 'var(--clr-text-2)' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--clr-text-3)' }}>{sub}</p>
              </div>
              <span className="badge badge-slate text-[10px]">Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  return fallback;
}
