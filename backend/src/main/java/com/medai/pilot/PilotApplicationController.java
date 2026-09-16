package com.medai.pilot;

import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class PilotApplicationController {
    private final PilotApplicationService service;
    public record StatusRequest(@NotNull PilotApplicationService.Status status) {}
    @PostMapping("/api/public/pilot-applications")
    public ApiResponse<PilotApplicationService.Receipt> submit(@Valid @RequestBody PilotApplicationService.Application request,HttpServletRequest servlet) {
        return ApiResponse.success(service.submit(request,servlet.getRemoteAddr()));
    }
    @GetMapping("/api/pilot-applications/access")
    public ApiResponse<Boolean> access(@AuthenticationPrincipal UserPrincipal principal){return ApiResponse.success(service.canReview(principal));}
    @GetMapping("/api/pilot-applications")
    public ApiResponse<List<PilotApplicationService.View>> list(@AuthenticationPrincipal UserPrincipal principal,
        @RequestParam(required=false) PilotApplicationService.Status status,@RequestParam(defaultValue="0") int page) {
        return ApiResponse.success(service.list(principal,status,page));
    }
    @PatchMapping("/api/pilot-applications/{id}/status")
    public ApiResponse<Void> status(@AuthenticationPrincipal UserPrincipal principal,@PathVariable UUID id,@Valid @RequestBody StatusRequest request) {
        service.updateStatus(principal,id,request.status()); return ApiResponse.success(null);
    }
}
