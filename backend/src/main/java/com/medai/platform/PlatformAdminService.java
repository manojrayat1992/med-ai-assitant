package com.medai.platform;

import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import com.medai.tenant.TenantSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
public class PlatformAdminService {

    private final JdbcTemplate jdbc;
    private final TenantSession tenantSession;

    public PlatformAdminService(JdbcTemplate jdbc, TenantSession tenantSession) {
        this.jdbc = jdbc;
        this.tenantSession = tenantSession;
    }

    public record PlatformSummary(
            long totalTenants,
            long activeTenants,
            long totalUsers,
            long totalPatients,
            long totalAnalyses,
            long activeUsersToday,
            String systemStatus,
            Instant generatedAt
    ) {}

    public record TenantOverview(
            UUID id,
            String name,
            String subdomain,
            String contactEmail,
            boolean isActive,
            Instant createdAt,
            long userCount,
            long patientCount
    ) {}

    public record UserSignupItem(
            UUID id,
            String email,
            String firstName,
            String lastName,
            String role,
            boolean isActive,
            Instant createdAt,
            String tenantName,
            String subdomain
    ) {}

    public record UserLoginItem(
            UUID id,
            String email,
            String firstName,
            String lastName,
            String role,
            Instant lastLoginAt,
            String tenantName,
            String subdomain
    ) {}

    public record PlatformActivityItem(
            UUID id,
            String action,
            String entityType,
            UUID entityId,
            String ipAddress,
            Instant createdAt,
            String tenantName,
            String userEmail,
            String userName
    ) {}

    public void verifyAdmin(UserPrincipal principal) {
        if (principal == null || !"HOSPITAL_ADMIN".equals(principal.role())) {
            throw new AccessDeniedException("Platform administration requires an administrator account.");
        }
    }

    @Transactional(readOnly = true)
    public PlatformSummary getSummary(UserPrincipal principal) {
        verifyAdmin(principal);
        tenantSession.beginMaintenance();

        long tenants = queryCount("SELECT COUNT(*) FROM tenants");
        long activeTenants = queryCount("SELECT COUNT(*) FROM tenants WHERE is_active = true");
        long users = queryCount("SELECT COUNT(*) FROM users");
        long patients = queryCount("SELECT COUNT(*) FROM patients");
        long analyses = queryCount("SELECT COUNT(*) FROM analysis_requests");
        long activeToday = queryCount("SELECT COUNT(*) FROM users WHERE last_login_at >= NOW() - INTERVAL '24 HOURS'");

        return new PlatformSummary(
                tenants,
                activeTenants,
                users,
                patients,
                analyses,
                activeToday,
                "OPERATIONAL",
                Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public List<TenantOverview> getTenants(UserPrincipal principal) {
        verifyAdmin(principal);
        tenantSession.beginMaintenance();

        String sql = """
            SELECT t.id, t.name, t.subdomain, t.contact_email, t.is_active, t.created_at,
                   (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
                   (SELECT COUNT(*) FROM patients p WHERE p.tenant_id = t.id) AS patient_count
            FROM tenants t
            ORDER BY t.created_at DESC
        """;

        return jdbc.query(sql, (rs, rowNum) -> new TenantOverview(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getString("subdomain"),
                rs.getString("contact_email"),
                rs.getBoolean("is_active"),
                toInstant(rs.getTimestamp("created_at")),
                rs.getLong("user_count"),
                rs.getLong("patient_count")
        ));
    }

    @Transactional(readOnly = true)
    public List<UserSignupItem> getRecentSignups(UserPrincipal principal) {
        verifyAdmin(principal);
        tenantSession.beginMaintenance();

        String sql = """
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at,
                   t.name AS tenant_name, t.subdomain
            FROM users u
            JOIN tenants t ON u.tenant_id = t.id
            ORDER BY u.created_at DESC
            LIMIT 50
        """;

        return jdbc.query(sql, (rs, rowNum) -> new UserSignupItem(
                rs.getObject("id", UUID.class),
                rs.getString("email"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("role"),
                rs.getBoolean("is_active"),
                toInstant(rs.getTimestamp("created_at")),
                rs.getString("tenant_name"),
                rs.getString("subdomain")
        ));
    }

    @Transactional(readOnly = true)
    public List<UserLoginItem> getRecentLogins(UserPrincipal principal) {
        verifyAdmin(principal);
        tenantSession.beginMaintenance();

        String sql = """
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.last_login_at,
                   t.name AS tenant_name, t.subdomain
            FROM users u
            JOIN tenants t ON u.tenant_id = t.id
            WHERE u.last_login_at IS NOT NULL
            ORDER BY u.last_login_at DESC
            LIMIT 50
        """;

        return jdbc.query(sql, (rs, rowNum) -> new UserLoginItem(
                rs.getObject("id", UUID.class),
                rs.getString("email"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("role"),
                toInstant(rs.getTimestamp("last_login_at")),
                rs.getString("tenant_name"),
                rs.getString("subdomain")
        ));
    }

    @Transactional(readOnly = true)
    public List<PlatformActivityItem> getRecentActivity(UserPrincipal principal) {
        verifyAdmin(principal);
        tenantSession.beginMaintenance();

        String sql = """
            SELECT a.id, a.action, a.entity_type, a.entity_id, a.ip_address, a.created_at,
                   t.name AS tenant_name,
                   COALESCE(u.email, 'system') AS user_email,
                   COALESCE(u.first_name || ' ' || u.last_name, 'System') AS user_name
            FROM audit_logs a
            JOIN tenants t ON a.tenant_id = t.id
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 50
        """;

        return jdbc.query(sql, (rs, rowNum) -> new PlatformActivityItem(
                rs.getObject("id", UUID.class),
                rs.getString("action"),
                rs.getString("entity_type"),
                rs.getObject("entity_id", UUID.class),
                rs.getString("ip_address"),
                toInstant(rs.getTimestamp("created_at")),
                rs.getString("tenant_name"),
                rs.getString("user_email"),
                rs.getString("user_name")
        ));
    }

    private long queryCount(String sql) {
        Long val = jdbc.queryForObject(sql, Long.class);
        return val != null ? val : 0L;
    }

    private Instant toInstant(Timestamp ts) {
        return ts != null ? ts.toInstant() : null;
    }
}
