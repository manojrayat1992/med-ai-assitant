package com.medai.integration.pacs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.compliance.crypto.AesGcmEncryptionService;
import com.medai.integration.pacs.entity.PacsConnectorEntity;
import com.medai.integration.pacs.enums.PacsConnectorType;
import com.medai.integration.pacs.service.ConnectorProbe;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;

class ConnectorProbeTest {
    private HttpServer server;
    private ConnectorProbe probe;
    private final AesGcmEncryptionService encryption = new AesGcmEncryptionService("connector-probe-test-key-32bytes!!");
    private String origin;
    @BeforeEach void setup() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        origin = "http://127.0.0.1:" + server.getAddress().getPort();
        probe = new ConnectorProbe(new ObjectMapper(), encryption);
        ReflectionTestUtils.setField(probe, "allowedOrigins", origin);
    }
    @AfterEach void close() { server.stop(0); }
    private PacsConnectorEntity connector(PacsConnectorType type) {
        var e = new PacsConnectorEntity(); e.setType(type); e.setEndpointUrl(origin); return e;
    }
    private void response(String path, int status, String body) {
        server.createContext(path, exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            try (var out = exchange.getResponseBody()) { out.write(bytes); }
        });
    }
    @Test void orthancMakesAuthenticatedRestAndEchoRequests() throws Exception {
        response("/system", 200, "{\"Version\":\"1.12\",\"DicomAet\":\"ORTHANC\"}");
        response("/modalities", 200, "[\"loopback\"]");
        var method = new AtomicReference<String>(); var auth = new AtomicReference<String>(); var body = new AtomicReference<String>();
        server.createContext("/modalities/loopback/echo", exchange -> {
            method.set(exchange.getRequestMethod()); auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(200, 2);
            try (var out = exchange.getResponseBody()) { out.write("{}".getBytes(StandardCharsets.UTF_8)); }
        });
        var e = connector(PacsConnectorType.ORTHANC); e.setOrthancModality("loopback"); e.setEncryptedAuth(encryption.encrypt("Basic dGVzdDp0ZXN0"));
        assertThat(probe.probe(e)).contains("C-ECHO succeeded");
        assertThat(method.get()).isEqualTo("POST"); assertThat(auth.get()).isEqualTo("Basic dGVzdDp0ZXN0");
        assertThat(body.get()).isEqualTo("{\"Timeout\":3}");
    }
    @Test void restOnlyDoesNotClaimDicomEcho() throws Exception {
        response("/system", 200, "{\"Version\":\"1.12\",\"DicomAet\":\"ORTHANC\"}");
        assertThat(probe.probe(connector(PacsConnectorType.ORTHANC))).contains("C-ECHO was not tested");
    }
    @Test void httpSuccessWithWrongPayloadIsNotConnected() {
        response("/system", 200, "{}");
        assertThatThrownBy(() -> probe.probe(connector(PacsConnectorType.ORTHANC))).hasMessageContaining("not an Orthanc");
    }
    @Test void fhirRequiresR4CapabilityStatement() throws Exception {
        response("/metadata", 200, "{\"resourceType\":\"CapabilityStatement\",\"fhirVersion\":\"4.0.1\"}");
        assertThat(probe.probe(connector(PacsConnectorType.FHIR_R4_EPIC))).contains("does not verify SMART OAuth");
        server.removeContext("/metadata"); response("/metadata", 200, "{\"resourceType\":\"Patient\"}");
        assertThatThrownBy(() -> probe.probe(connector(PacsConnectorType.FHIR_R4_CERNER))).hasMessageContaining("CapabilityStatement");
    }
    @Test void qidoAllowsEmptyArchiveButRejectsInvalidStudy() throws Exception {
        response("/studies", 200, "[]");
        assertThat(probe.probe(connector(PacsConnectorType.DCM4CHEE))).contains("QIDO-RS");
        server.removeContext("/studies"); response("/studies", 200, "[{}]");
        assertThatThrownBy(() -> probe.probe(connector(PacsConnectorType.DCM4CHEE))).hasMessageContaining("StudyInstanceUID");
    }
    @Test void redirectsAreNotFollowedAndRemoteFailuresFail() {
        var hits = new AtomicInteger();
        server.createContext("/destination", exchange -> { hits.incrementAndGet(); exchange.close(); });
        server.createContext("/system", exchange -> {
            exchange.getResponseHeaders().set("Location", origin + "/destination");
            exchange.sendResponseHeaders(302, -1); exchange.close();
        });
        assertThatThrownBy(() -> probe.probe(connector(PacsConnectorType.ORTHANC))).hasMessageContaining("HTTP 302");
        assertThat(hits.get()).isZero();
        server.removeContext("/system"); response("/system", 401, "credential detail should not escape");
        assertThatThrownBy(() -> probe.probe(connector(PacsConnectorType.ORTHANC))).hasMessageContaining("HTTP 401").hasMessageNotContaining("credential detail");
    }
    @Test void rejectsUnapprovedOriginsAndUrlCredentials() {
        assertThatThrownBy(() -> probe.validateEndpoint("http://169.254.169.254/latest/meta-data")).hasMessageContaining("not permitted");
        assertThatThrownBy(() -> probe.validateEndpoint("http://user:pass@127.0.0.1/path")).hasMessageContaining("without credentials");
        assertThatThrownBy(() -> probe.validateEndpoint(origin + "/?token=secret")).hasMessageContaining("without credentials");
    }
    @Test void unsupportedAdaptersNeverSucceed() {
        assertThatThrownBy(() -> probe.probe(connector(PacsConnectorType.POWERSCRIBE_360))).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> probe.probe(connector(PacsConnectorType.HL7_V2_MLLP))).isInstanceOf(UnsupportedOperationException.class);
    }
}
