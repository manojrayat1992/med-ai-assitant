package com.medai.integration.pacs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.integration.pacs.entity.PacsConnectorEntity;
import com.medai.integration.pacs.enums.PacsConnectorType;
import com.medai.integration.pacs.repository.PacsConnectorRepository;
import com.medai.tenant.TenantContext;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class OrthancStudyServiceTest {
    final PacsConnectorRepository repository = mock(PacsConnectorRepository.class);
    final ConnectorProbe client = mock(ConnectorProbe.class);
    final OrthancStudyService service = new OrthancStudyService(repository, client);
    final ObjectMapper mapper = new ObjectMapper();
    final UUID tenant = UUID.randomUUID(), connectorId = UUID.randomUUID();
    final String id = "12345678-12345678-12345678-12345678-12345678";
    final PacsConnectorEntity connector = new PacsConnectorEntity();
    @BeforeEach void setup() {
        TenantContext.setCurrentTenantId(tenant);
        connector.setType(PacsConnectorType.ORTHANC);
        when(repository.findByIdAndTenantId(connectorId, tenant)).thenReturn(Optional.of(connector));
    }
    @AfterEach void clear() { TenantContext.clear(); }
    @Test void pagesStudiesAndReturnsOnlySelectedMetadata() throws Exception {
        var item = mapper.readTree("""
                {"ID":"test","MainDicomTags":{"StudyInstanceUID":"1.2.3","AccessionNumber":"ACC"},
                 "PatientMainDicomTags":{"PatientID":"P1","PatientName":"Synthetic"},"Series":["s1"],"Secret":"excluded"}
                """);
        when(client.request(connector, "/studies?expand&since=0&limit=2", false, "application/json"))
                .thenReturn(mapper.createArrayNode().add(item).add(item));
        var page = service.studies(connectorId, 0, 1);
        assertThat(page.hasMore()).isTrue();
        assertThat(page.content()).hasSize(1);
        assertThat(page.content().getFirst().patientName()).isEqualTo("Synthetic");
        assertThat(page.content().getFirst().seriesCount()).isEqualTo(1);
        assertThat(mapper.writeValueAsString(page)).doesNotContain("Secret");
    }
    @Test void detailFetchesPatientTagsUsingValidatedParentId() throws Exception {
        when(client.request(connector, "/studies/" + id, false, "application/json"))
                .thenReturn(mapper.readTree("{\"ID\":\"" + id + "\",\"MainDicomTags\":{\"StudyInstanceUID\":\"1.2.3\"},\"ParentPatient\":\"" + id + "\"}"));
        when(client.request(connector, "/patients/" + id, false, "application/json"))
                .thenReturn(mapper.readTree("{\"ID\":\"" + id + "\",\"MainDicomTags\":{\"PatientName\":\"Synthetic\"}}"));
        assertThat(service.study(connectorId, id).patientName()).isEqualTo("Synthetic");
    }
    @Test void emptyArchiveIsSuccessful() throws Exception {
        when(client.request(connector, "/studies?expand&since=0&limit=21", false, "application/json"))
                .thenReturn(mapper.createArrayNode());
        assertThat(service.studies(connectorId, 0, 20).content()).isEmpty();
    }
    @Test void crossTenantConnectorNeverMakesRemoteRequest() {
        when(repository.findByIdAndTenantId(connectorId, tenant)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.studies(connectorId, 0, 20)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(client);
    }
    @Test void rejectsTraversalUnsupportedConnectorsAndUnboundedPages() {
        assertThatThrownBy(() -> service.study(connectorId, "../system")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.studies(connectorId, 0, 101)).isInstanceOf(BadRequestException.class);
        connector.setType(PacsConnectorType.DCM4CHEE);
        assertThatThrownBy(() -> service.studies(connectorId, 0, 20)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(client);
    }
    @Test void mapsSeriesAndChecksTheirParent() throws Exception {
        var result = mapper.readTree("[{\"ID\":\"series\",\"ParentStudy\":\"" + id + "\",\"MainDicomTags\":{\"Modality\":\"CT\"},\"Instances\":[\"one\",\"two\"]}]");
        when(client.request(connector, "/studies/" + id + "/series", false, "application/json")).thenReturn(result);
        assertThat(service.series(connectorId, id).getFirst().instanceCount()).isEqualTo(2);
        ((com.fasterxml.jackson.databind.node.ObjectNode) result.get(0)).put("ParentStudy", "different");
        assertThatThrownBy(() -> service.series(connectorId, id)).hasMessageContaining("502");
    }
    @Test void masksUpstreamErrorsAndRejectsMalformedResponses() throws Exception {
        when(client.request(connector, "/studies/" + id, false, "application/json"))
                .thenThrow(new IllegalStateException("secret upstream data"));
        assertThatThrownBy(() -> service.study(connectorId, id)).hasMessageContaining("502").hasMessageNotContaining("secret");
        when(client.request(connector, "/studies?expand&since=0&limit=21", false, "application/json"))
                .thenReturn(mapper.createObjectNode());
        assertThatThrownBy(() -> service.studies(connectorId, 0, 20)).hasMessageContaining("502");
    }
}
