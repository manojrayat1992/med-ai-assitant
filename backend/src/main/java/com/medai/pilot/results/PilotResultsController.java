package com.medai.pilot.results;
import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;
@RestController @RequiredArgsConstructor
public class PilotResultsController {
 private final PilotResultsService service;
 public record Rating(@NotBlank @Size(max=512) String issueId,@NotNull Boolean useful){}
 @GetMapping("/api/pilot-results") @PreAuthorize("hasAnyRole('DOCTOR','HOSPITAL_ADMIN')")
 public ApiResponse<Map<String,Object>> results(@RequestParam LocalDate from,@RequestParam LocalDate to){return ApiResponse.success(service.results(from,to));}
 @PutMapping("/api/pilot-results/qa-runs/{run}/rating") @PreAuthorize("hasAnyRole('DOCTOR','HOSPITAL_ADMIN')")
 public ApiResponse<Void> rate(@PathVariable UUID run,@Valid @RequestBody Rating rating,@AuthenticationPrincipal UserPrincipal p){service.rate(run,rating.issueId(),rating.useful(),p);return ApiResponse.success(null);}
}
