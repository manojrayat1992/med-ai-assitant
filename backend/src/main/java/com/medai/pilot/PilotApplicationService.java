package com.medai.pilot;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.auth.security.UserPrincipal;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.compliance.crypto.AesGcmEncryptionService;
import com.medai.config.ratelimit.RequestRateWindow;
import com.medai.common.exception.RateLimitExceededException;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PilotApplicationService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final AesGcmEncryptionService encryption;
    private final RequestRateWindow rateWindow;
    @Value("${app.pilot.reviewer-user-ids:}") private String reviewerIds;
    public enum Status { NEW, CONTACTED, QUALIFIED, CLOSED }
    public record Application(@NotNull UUID submissionId,
        @NotBlank @Size(max=160) String centreName,
        @NotBlank @Size(max=120) String contactName,
        @NotBlank @Email @Size(max=254) String email,
        @NotBlank @Size(max=160) String location,
        @NotBlank @Size(max=1000) String reportingSoftware,
        @NotNull @Min(1) @Max(10000000) Integer monthlyReportVolume,
        @NotNull @Min(1) @Max(100000) Integer teamSize,
        @NotBlank @Size(max=5000) String mainProblem,
        @Size(max=2000) String integrationNeeds,
        @NotNull @AssertTrue Boolean contactConsent) {}
    public record Receipt(UUID reference, String message) {}
    public record View(UUID id, Status status, Instant createdAt, Instant updatedAt, UUID reviewedBy, Application application) {}
    public boolean canReview(UserPrincipal principal) {
        return principal != null && "HOSPITAL_ADMIN".equals(principal.role())
            && Arrays.stream(reviewerIds.split(",")).map(String::trim).anyMatch(principal.userId().toString()::equals);
    }
    private void requireReviewer(UserPrincipal principal) {
        if (!canReview(principal)) throw new AccessDeniedException("Pilot inbox access is limited to configured Med-AI reviewers.");
    }
    @Transactional
    public Receipt submit(Application request, String remoteAddress) {
        UUID rateKey = UUID.nameUUIDFromBytes(("pilot-intake:"+remoteAddress).getBytes(StandardCharsets.UTF_8));
        if (rateWindow.incrementAndCount(rateKey)>5) throw new RateLimitExceededException("Too many pilot applications. Please retry in a minute.");
        String json=serialize(request);
        jdbc.update("INSERT INTO pilot_applications(id,encrypted_application) VALUES (?,?) ON CONFLICT(id) DO NOTHING",request.submissionId(),encryption.encrypt(json));
        String stored=jdbc.queryForObject("SELECT encrypted_application FROM pilot_applications WHERE id=?",String.class,request.submissionId());
        if (!decode(stored).equals(request)) throw new BadRequestException("This submission reference has already been used. Start a new application.");
        return new Receipt(request.submissionId(),"Application received. The Med-AI team can review your requirements and contact you about a pilot.");
    }
    @Transactional(readOnly=true)
    public List<View> list(UserPrincipal principal, Status status, int page) {
        requireReviewer(principal);
        if(page<0||page>10000) throw new BadRequestException("Invalid page.");
        return jdbc.query("SELECT * FROM pilot_applications WHERE (CAST(? AS VARCHAR) IS NULL OR status=?) ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?",
            (rs,n)->new View(rs.getObject("id",UUID.class),Status.valueOf(rs.getString("status")),rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("updated_at").toInstant(),rs.getObject("reviewed_by",UUID.class),decode(rs.getString("encrypted_application"))),
            status==null?null:status.name(),status==null?null:status.name(),page*20);
    }
    @Transactional
    public void updateStatus(UserPrincipal principal, UUID id, Status status) {
        requireReviewer(principal);
        if(jdbc.update("UPDATE pilot_applications SET status=?,reviewed_by=?,updated_at=now() WHERE id=?",status.name(),principal.userId(),id)==0)
            throw new ResourceNotFoundException("Pilot application","id",id.toString());
    }
    private String serialize(Application application) {
        try{return mapper.writeValueAsString(application);}catch(JsonProcessingException e){throw new IllegalStateException("Could not save application.");}
    }
    private Application decode(String data) {
        try{return mapper.readValue(encryption.decrypt(data),Application.class);}catch(JsonProcessingException e){throw new IllegalStateException("Could not read application.");}
    }
}
