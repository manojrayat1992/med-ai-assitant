package com.medai.config;

import com.medai.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/ai")
@RequiredArgsConstructor
public class TenantAiSettingsController {

    private final TenantAiSettingsService settingsService;

    @GetMapping
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    public ResponseEntity<ApiResponse<AiSettingsDtos.AiSettingsView>> getSettings() {
        return ResponseEntity.ok(ApiResponse.success(settingsService.getCurrent()));
    }

    @PutMapping
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    public ResponseEntity<ApiResponse<AiSettingsDtos.AiSettingsView>> updateSettings(
            @Valid @RequestBody AiSettingsDtos.UpdateAiSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success("AI settings saved", settingsService.updateCurrent(request)));
    }

    @DeleteMapping
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    public ResponseEntity<ApiResponse<AiSettingsDtos.AiSettingsView>> resetSettings() {
        return ResponseEntity.ok(ApiResponse.success("AI settings reset to server defaults",
                settingsService.resetCurrent()));
    }

    @PostMapping("/test")
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    public ResponseEntity<ApiResponse<AiSettingsDtos.AiConnectionTestResult>> testSettings() {
        return ResponseEntity.ok(ApiResponse.success("AI provider connection tested",
                settingsService.testCurrent()));
    }
}
