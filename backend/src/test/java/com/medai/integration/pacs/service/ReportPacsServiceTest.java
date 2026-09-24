package com.medai.integration.pacs.service;

import com.medai.common.exception.*;
import com.medai.integration.pacs.entity.PacsConnectorEntity;
import com.medai.integration.pacs.repository.PacsConnectorRepository;
import com.medai.report.entity.ReportReview;
import com.medai.report.repository.ReportReviewRepository;
import com.medai.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class ReportPacsServiceTest {
    final ReportReviewRepository reports = mock(ReportReviewRepository.class);
    final PacsConnectorRepository connectors = mock(PacsConnectorRepository.class);
    final OrthancStudyService studies = mock(OrthancStudyService.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final ReportPacsService service = new ReportPacsService(reports, connectors, studies, jdbc);
    final UUID tenant = UUID.randomUUID(), reportId = UUID.randomUUID(), connectorId = UUID.randomUUID();
    final String studyId = "12345678-12345678-12345678-12345678-12345678";
    ReportReview report;
    @BeforeEach void setup() {
        TenantContext.setCurrentTenantId(tenant);
        report = ReportReview.builder().id(reportId).tenantId(tenant).pacsConnectorId(connectorId).pacsStudyId(studyId).pacsStudyUid("1.2.3").build();
        when(reports.findByIdAndTenantId(reportId, tenant)).thenReturn(Optional.of(report));
        when(connectors.findByIdAndTenantId(connectorId, tenant)).thenReturn(Optional.of(PacsConnectorEntity.builder().id(connectorId).viewerUrl("https://pacs.example.test/ohif/viewer").build()));
        when(studies.study(connectorId, studyId)).thenReturn(new OrthancStudyService.Study(studyId, "1.2.3", "ACC", "20260924", "Chest", "P1", "Synthetic", 1));
    }
    @AfterEach void clear() { TenantContext.clear(); }
    @Test void launchChecksStudyAndUsesUidWithoutCredentials() {
        assertThat(service.launch(reportId).viewerUrl()).isEqualTo("https://pacs.example.test/ohif/viewer?StudyInstanceUIDs=1.2.3");
        verify(studies).study(connectorId, studyId);
    }
    @Test void missingReportOrConnectorCannotLaunch() {
        when(reports.findByIdAndTenantId(reportId, tenant)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.launch(reportId)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(studies);
        when(reports.findByIdAndTenantId(reportId, tenant)).thenReturn(Optional.of(report));
        when(connectors.findByIdAndTenantId(connectorId, tenant)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.launch(reportId)).isInstanceOf(ResourceNotFoundException.class);
    }
    @Test void refusesLinkWithoutPatientConfirmation() {
        assertThatThrownBy(() -> service.link(reportId, connectorId, studyId, false)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(studies, jdbc);
    }
    @Test void linkWritesOnlyMetadataAndUsesServerStudyUid() {
        when(jdbc.update(anyString(), eq(connectorId), eq(studyId), eq("1.2.3"), eq(reportId), eq(tenant))).thenReturn(1);
        assertThat(service.link(reportId, connectorId, studyId, true).studyInstanceUid()).isEqualTo("1.2.3");
        verify(jdbc).update(startsWith("UPDATE report_reviews SET pacs_connector_id="), eq(connectorId), eq(studyId), eq("1.2.3"), eq(reportId), eq(tenant));
        verify(reports, never()).save(any());
    }
    @Test void changedStudyUidCannotLaunch() {
        report.setPacsStudyUid("9.8.7");
        assertThatThrownBy(() -> service.launch(reportId)).hasMessageContaining("changed");
    }
    @Test void absentLinkReturnsNullAndLaunchExplainsNextStep() {
        report.setPacsConnectorId(null);
        assertThat(service.get(reportId)).isNull();
        assertThatThrownBy(() -> service.launch(reportId)).hasMessageContaining("Link a PACS");
    }
    @Test void viewerRejectsCredentialsScriptsQueryInjectionAndInsecureRemoteHosts() {
        for (String url : List.of("javascript:alert(1)", "https://user:secret@example.test/viewer", "https://example.test/viewer?token=secret", "http://example.test/viewer", "https://example.test/viewer#fragment"))
            assertThatThrownBy(() -> PacsViewerUrl.validate(url)).isInstanceOf(BadRequestException.class);
        assertThat(PacsViewerUrl.launch("http://localhost:8042/ohif/viewer", "1.2.3")).endsWith("?StudyInstanceUIDs=1.2.3");
        assertThatThrownBy(() -> PacsViewerUrl.launch("https://example.test/viewer", "1.2&token=bad")).isInstanceOf(BadRequestException.class);
    }
}
