package com.medai.upload.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.ResponseInputStream;
import java.io.ByteArrayInputStream;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class S3StorageServiceTest {
    private StorageProperties config() {
        var p = new StorageProperties(); p.getS3().setBucket("test-bucket"); return p;
    }
    @Test void rejectsLocalStorageAndMissingBucket() {
        var p = new StorageProperties();
        assertEquals("s3", p.getType());
        assertThrows(IllegalStateException.class, () -> new S3StorageService(p));
        p.setType("local");
        assertThrows(IllegalStateException.class, () -> new StorageTypeValidator(p).validate());
    }
    @Test void rejectsIncompleteCredentialsBeforeConnecting() {
        var p = config(); p.getS3().setAccessKey("test-key");
        assertThrows(IllegalStateException.class, () -> new S3StorageService(p));
        p.getS3().setAccessKey(null); p.getS3().setSecretKey("test-secret");
        assertThrows(IllegalStateException.class, () -> new S3StorageService(p));
    }
    @Test void uploadsWithTenantKeyAndEncryptionAndReturnsContent() throws Exception {
        var client = mock(S3Client.class); var p = config();
        var service = new S3StorageService(p, client);
        var tenant = UUID.randomUUID(); var patient = UUID.randomUUID();
        byte[] content = "example report".getBytes();
        var file = new MockMultipartFile("file", "report.txt", "text/plain", content);
        when(client.putObject(any(PutObjectRequest.class), any(RequestBody.class))).thenAnswer(call -> {
            PutObjectRequest request = call.getArgument(0); RequestBody body = call.getArgument(1);
            assertEquals("test-bucket", request.bucket());
            assertEquals(ServerSideEncryption.AES256, request.serverSideEncryption());
            try (var stream = body.contentStreamProvider().newStream()) { assertArrayEquals(content, stream.readAllBytes()); }
            return PutObjectResponse.builder().build();
        });
        String key = service.store(tenant, patient, "report.txt", file);
        assertEquals(tenant + "/patients/" + patient + "/report.txt", key);
        when(client.getObject(any(GetObjectRequest.class))).thenReturn(new ResponseInputStream<>(
                GetObjectResponse.builder().build(), new ByteArrayInputStream(content)));
        assertArrayEquals(content, service.retrieveAsResource(key).getContentAsByteArray());
        service.delete(key);
        verify(client).deleteObject(argThat((DeleteObjectRequest r) -> r.key().equals(key) && r.bucket().equals("test-bucket")));
        service.close(); verify(client).close();
    }
    @Test void kmsAndMissingObjectAreHandled() {
        var client = mock(S3Client.class); var p = config(); p.getS3().setKmsKeyId("test-kms-key");
        var service = new S3StorageService(p, client);
        service.store(UUID.randomUUID(), UUID.randomUUID(), "file.txt", new MockMultipartFile("file", new byte[]{1}));
        verify(client).putObject(argThat((PutObjectRequest r) -> r.serverSideEncryption() == ServerSideEncryption.AWS_KMS && "test-kms-key".equals(r.ssekmsKeyId())), any(RequestBody.class));
        when(client.headObject(any(HeadObjectRequest.class))).thenThrow(NoSuchKeyException.builder().message("missing").build());
        assertFalse(service.exists("missing"));
    }
}
