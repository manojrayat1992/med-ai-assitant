import api from './api';
import type { ApiResponse } from '@/types';
import type { PacsConnector, SaveConnectorPayload, PingResult, Hl7ParseResult } from '@/types/integration';

export const integrationConnectorsApi = {
  async getConnectors() {
    return (await api.get<ApiResponse<PacsConnector[]>>('/integrations/connectors')).data.data;
  },
  async saveConnector(payload: SaveConnectorPayload) {
    return (await api.post<ApiResponse<PacsConnector>>('/integrations/connectors', payload)).data.data;
  },
  async pingConnector(id: string) {
    return (await api.post<ApiResponse<PingResult>>(`/integrations/connectors/${id}/ping`)).data.data;
  },
  async parseHl7(rawMessage: string) {
    return (await api.post<ApiResponse<Hl7ParseResult>>('/integrations/connectors/hl7/parse', { rawMessage })).data.data;
  },
};
