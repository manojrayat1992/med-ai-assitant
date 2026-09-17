package com.medai.knowledge;

import com.medai.BaseIntegrationTest;
import com.medai.auth.security.JwtService;
import com.medai.knowledge.repository.DocumentChunkRepository;
import com.medai.knowledge.service.EmbeddingService;
import com.medai.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class KnowledgeAccessTest extends BaseIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtService jwt;
    @Autowired EmbeddingService embeddings;
    @Autowired DocumentChunkRepository chunks;
    @AfterEach void clear() {TenantContext.clear();}

    @Test void doctorCannotUploadWorkspaceReferences() throws Exception {
        var workspace = workspace("DOCTOR");
        mvc.perform(multipart("/api/knowledge/upload").file(file()).param("title","Protocol")
                .header("Authorization", "Bearer " + workspace.token())).andExpect(status().isForbidden());
    }
    @Test void adminIndexesGuardrailsAndTenantCannotRetrieveOthersOrFailedDocuments() throws Exception {
        var workspace = workspace("HOSPITAL_ADMIN");
        mvc.perform(multipart("/api/knowledge/upload").file(file()).param("title","Protocol \"review\"")
                .param("documentType","GUARDRAIL").header("Authorization", "Bearer " + workspace.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.documentType").value("GUARDRAIL"));
        String vector = embeddings.toVectorString(embeddings.embedText("Reporting review"));
        TenantContext.setCurrentTenantId(workspace.tenant());
        assertThat(chunks.findSimilarChunks(workspace.tenant(), vector, 6)).hasSize(1);
        var other = workspace("HOSPITAL_ADMIN");
        TenantContext.setCurrentTenantId(other.tenant());
        assertThat(chunks.findSimilarChunks(other.tenant(), vector, 6)).isEmpty();
        assertThat(chunks.findSimilarChunks(workspace.tenant(), vector, 6)).isEmpty();
        TenantContext.setCurrentTenantId(workspace.tenant());
        jdbc.update("UPDATE knowledge_documents SET status='FAILED' WHERE tenant_id=?", workspace.tenant());
        assertThat(chunks.findSimilarChunks(workspace.tenant(), vector, 6)).isEmpty();
    }
    @Test void adminCanIndexReferenceStudyButCannotUploadPatientImageAsReference() throws Exception {
        var workspace = workspace("HOSPITAL_ADMIN");
        mvc.perform(multipart("/api/knowledge/upload").file(file()).param("title","Study")
                .param("documentType","REFERENCE_STUDY").header("Authorization","Bearer " + workspace.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("READY"));
        mvc.perform(multipart("/api/knowledge/upload")
                .file(new MockMultipartFile("file","scan.png","image/png",new byte[]{1,2,3}))
                .param("title","Scan").header("Authorization","Bearer " + workspace.token()))
                .andExpect(status().isBadRequest());
    }
    private MockMultipartFile file() {
        return new MockMultipartFile("file","protocol.txt","text/plain",
                "Reporting review: A clinician must review and sign every report.".getBytes(StandardCharsets.UTF_8));
    }
    private Workspace workspace(String role) {
        UUID tenant = UUID.randomUUID(), user = UUID.randomUUID();
        jdbc.update("INSERT INTO tenants (id,name,subdomain,contact_email) VALUES (?,'Test',?,'test@example.test')",tenant,"kb-"+tenant);
        TenantContext.setCurrentTenantId(tenant);
        jdbc.update("INSERT INTO users (id,tenant_id,email,password_hash,first_name,last_name,role) VALUES (?,?,?,'x','Test','User',?)",user,tenant,user+"@example.test",role);
        String token = jwt.generateAccessToken(user,tenant,user+"@example.test",role);
        TenantContext.clear();
        return new Workspace(tenant,token);
    }
    record Workspace(UUID tenant,String token) {}
}
