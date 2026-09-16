package com.medai.integration.pacs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.compliance.crypto.AesGcmEncryptionService;
import com.medai.integration.pacs.entity.PacsConnectorEntity;
import com.medai.integration.pacs.enums.PacsConnectorType;
import com.medai.integration.pacs.service.ConnectorProbe;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.util.ReflectionTestUtils;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "PACS_TEST_ORTHANC_URL", matches = ".+")
class LiveOrthancProbeTest {
    @Test void realOrthancRestAndDicomEcho() throws Exception {
        var encryption = new AesGcmEncryptionService("synthetic-live-test-key-32bytes!!");
        var probe = new ConnectorProbe(new ObjectMapper(), encryption);
        String url = System.getenv("PACS_TEST_ORTHANC_URL");
        ReflectionTestUtils.setField(probe, "allowedOrigins", url);
        var connector = new PacsConnectorEntity();
        connector.setEndpointUrl(url); connector.setType(PacsConnectorType.ORTHANC); connector.setOrthancModality("loopback");
        connector.setEncryptedAuth(encryption.encrypt("Basic " + Base64.getEncoder().encodeToString(
                ("medai:" + System.getenv("PACS_TEST_ORTHANC_PASSWORD")).getBytes(StandardCharsets.UTF_8))));
        assertThat(probe.probe(connector)).contains("C-ECHO succeeded");
    }
}
