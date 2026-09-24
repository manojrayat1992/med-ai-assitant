package com.medai.platform;

import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/platform")
@Tag(name = "Platform Administration", description = "Cross-tenant statistics, sign-ups, login logs, and global audit activity")
public class PlatformAdminController {

    private final PlatformAdminService service;

    public PlatformAdminController(PlatformAdminService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    @Operation(summary = "Get platform-wide operational summary")
    public ApiResponse<PlatformAdminService.PlatformSummary> getSummary(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.success(service.getSummary(principal));
    }

    @GetMapping("/tenants")
    @Operation(summary = "List all hospital tenants and workspace statistics")
    public ApiResponse<List<PlatformAdminService.TenantOverview>> getTenants(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.success(service.getTenants(principal));
    }

    @GetMapping("/signups")
    @Operation(summary = "List recent platform-wide user sign-ups")
    public ApiResponse<List<PlatformAdminService.UserSignupItem>> getSignups(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.success(service.getRecentSignups(principal));
    }

    @GetMapping("/logins")
    @Operation(summary = "List recent platform-wide user logins")
    public ApiResponse<List<PlatformAdminService.UserLoginItem>> getLogins(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.success(service.getRecentLogins(principal));
    }

    @GetMapping("/activity")
    @Operation(summary = "List recent platform-wide audit activity logs")
    public ApiResponse<List<PlatformAdminService.PlatformActivityItem>> getActivity(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.success(service.getRecentActivity(principal));
    }
}
