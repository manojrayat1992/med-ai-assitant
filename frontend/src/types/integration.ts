export type PacsConnectorType =
  | 'ORTHANC'
  | 'DCM4CHEE'
  | 'HL7_V2_MLLP'
  | 'FHIR_R4_EPIC'
  | 'FHIR_R4_CERNER'
  | 'POWERSCRIBE_360';

export type ConnectorStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'SYNCING'
  | 'ERROR';

export interface PacsConnector {
  id: string;
  tenantId: string;
  name: string;
  type: PacsConnectorType;
  host?: string;
  port?: number;
  aetTitle?: string;
  localAet?: string;
  endpointUrl?: string;
  status: ConnectorStatus;
  lastPingAt?: string;
  latencyMs?: number | null;
  description?: string;
  orthancModality?: string;
  credentialsConfigured?: boolean;
  metadataJson?: string;
  createdAt?: string;
}

export interface SaveConnectorPayload {
  username?: string;
  password?: string;
  bearerToken?: string;
  clearCredentials?: boolean;
  id?: string;
  name: string;
  type: PacsConnectorType;
  host?: string;
  port?: number;
  aetTitle?: string;
  localAet?: string;
  endpointUrl?: string;
  description?: string;
  orthancModality?: string;
  credentialsConfigured?: boolean;
}

export interface PingResult {
  connectorId: string;
  status: ConnectorStatus;
  latencyMs: number | null;
  message: string;
  timestamp: string;
}

export interface Hl7ParseResult {
  messageType?: string | null;
  messageControlId?: string | null;
  sendingFacility?: string | null;
  patientMrn?: string | null;
  patientName?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  mllpAckMessage?: string;
  accessionNumber?: string | null;
  modality?: string | null;
  studyDescription?: string | null;
  findings: string[];
  impression: string[];
  rawAckMessage?: string | null;
  success: boolean;
  parseNotes?: string;
}
