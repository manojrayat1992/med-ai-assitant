package com.medai.education;
import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class EducationalCaseController {
 private final EducationalCaseService service;
 @GetMapping("/api/public/educational-cases") public ResponseEntity<ApiResponse<List<EducationalCaseService.Published>>> publicList(@RequestParam(defaultValue="0") int page){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(service.published(page)));}
 @GetMapping("/api/public/educational-cases/{id}") public ResponseEntity<ApiResponse<EducationalCaseService.Published>> publicCase(@PathVariable UUID id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(service.published(id)));}
 @GetMapping("/api/educational-cases") public ApiResponse<List<EducationalCaseService.Draft>> drafts(@AuthenticationPrincipal UserPrincipal p,@RequestParam(defaultValue="0") int page){return ApiResponse.success(service.drafts(p,page));}
 @PostMapping("/api/educational-cases") public ApiResponse<EducationalCaseService.Draft> create(@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody EducationalCaseService.DraftRequest request){return ApiResponse.success(service.create(request.content(),p));}
 @PutMapping("/api/educational-cases/{id}") public ApiResponse<EducationalCaseService.Draft> edit(@PathVariable UUID id,@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody EducationalCaseService.EditRequest request){return ApiResponse.success(service.edit(id,request,p));}
 @PostMapping("/api/educational-cases/{id}/review") public ApiResponse<EducationalCaseService.Draft> review(@PathVariable UUID id,@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody EducationalCaseService.ReviewRequest request){return ApiResponse.success(service.review(id,request,p));}
 @PostMapping("/api/educational-cases/{id}/publish") public ApiResponse<EducationalCaseService.Draft> publish(@PathVariable UUID id,@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody EducationalCaseService.VersionRequest request){return ApiResponse.success(service.publish(id,request.version(),p));}
 @PostMapping("/api/educational-cases/{id}/withdraw") public ApiResponse<EducationalCaseService.Draft> withdraw(@PathVariable UUID id,@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody EducationalCaseService.VersionRequest request){return ApiResponse.success(service.withdraw(id,request.version(),p));}
}
