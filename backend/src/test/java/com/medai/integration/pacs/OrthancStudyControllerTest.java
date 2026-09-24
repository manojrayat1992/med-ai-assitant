package com.medai.integration.pacs;

import com.medai.common.exception.GlobalExceptionHandler;
import com.medai.integration.pacs.controller.OrthancStudyController;
import com.medai.integration.pacs.service.OrthancStudyService;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OrthancStudyControllerTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean OrthancStudyService service() { return mock(OrthancStudyService.class); }
        @Bean OrthancStudyController controller(OrthancStudyService service) { return new OrthancStudyController(service); }
    }
    AnnotationConfigApplicationContext context;
    OrthancStudyService service;
    MockMvc mvc;
    UUID id = UUID.randomUUID();
    @BeforeEach void setup() {
        context = new AnnotationConfigApplicationContext(Config.class);
        service = context.getBean(OrthancStudyService.class);
        mvc = MockMvcBuilders.standaloneSetup(context.getBean(OrthancStudyController.class))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @AfterEach void close() { SecurityContextHolder.clearContext(); context.close(); }
    void role(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "test", "unused", List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
    @Test void administratorCanBrowseWithNoStoreAndDefaultPagination() throws Exception {
        role("HOSPITAL_ADMIN");
        when(service.studies(id, 0, 20)).thenReturn(new OrthancStudyService.StudyPage(List.of(), 0, 20, false));
        mvc.perform(get("/api/integrations/connectors/" + id + "/studies"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.content").isEmpty()).andExpect(jsonPath("$.data.hasMore").value(false));
    }
    @Test void nonAdminCannotBrowseArchive() throws Exception {
        role("DOCTOR");
        mvc.perform(get("/api/integrations/connectors/" + id + "/studies")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void upstreamFailurePreserves502AndSafeMessage() throws Exception {
        role("HOSPITAL_ADMIN");
        when(service.studies(id, 0, 20)).thenThrow(new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_GATEWAY, "Could not read Orthanc studies."));
        mvc.perform(get("/api/integrations/connectors/" + id + "/studies"))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.success").value(false));
    }
}
