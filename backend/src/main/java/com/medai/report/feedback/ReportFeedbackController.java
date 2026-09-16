package com.medai.report.feedback;

import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/reports/{reportId}/feedback")
@PreAuthorize("hasAnyRole('DOCTOR','HOSPITAL_ADMIN')")
@RequiredArgsConstructor
public class ReportFeedbackController {
    private final ReportFeedbackService feedback;
    @PostMapping
    public ResponseEntity<ApiResponse<ReportFeedbackService.View>> submit(@PathVariable UUID reportId,
            @Valid @RequestBody ReportFeedbackService.Request request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(ApiResponse.success(feedback.submit(reportId, request, principal)));
    }
    @GetMapping
    public ResponseEntity<ApiResponse<List<ReportFeedbackService.View>>> list(@PathVariable UUID reportId,
            @RequestParam(defaultValue="0") int page) {
        return ResponseEntity.ok(ApiResponse.success(feedback.list(reportId, page)));
    }
}
