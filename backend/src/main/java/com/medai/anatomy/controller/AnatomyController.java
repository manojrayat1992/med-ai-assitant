package com.medai.anatomy.controller;

import com.medai.anatomy.catalog.AnatomyDefinition;
import com.medai.anatomy.model.AnatomyStructure;
import com.medai.anatomy.model.AnatomySystem;
import com.medai.anatomy.service.AnatomyService;
import com.medai.common.dto.ApiResponse;
import com.medai.finding.model.AnatomicalSide;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/anatomy")
@RequiredArgsConstructor
@Tag(name = "Anatomy", description = "Deterministic anatomical structure catalog and 3D viewer mappings")
public class AnatomyController {

    private final AnatomyService anatomyService;

    @GetMapping("/catalog")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Supported anatomical definitions and 3D viewer keys")
    public ResponseEntity<ApiResponse<List<AnatomyDefinition>>> catalog() {
        return ResponseEntity.ok(ApiResponse.success(anatomyService.catalogDefinitions()));
    }

    @GetMapping("/structures")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Anatomical systems and structures grouped for navigation")
    public ResponseEntity<ApiResponse<Map<String, Object>>> structures() {
        List<AnatomyDefinition> definitions = anatomyService.catalogDefinitions();

        Map<AnatomySystem, List<Map<String, Object>>> grouped = new EnumMap<>(AnatomySystem.class);
        for (AnatomyDefinition def : definitions) {
            grouped.computeIfAbsent(def.system(), k -> new ArrayList<>()).add(Map.of(
                    "code", def.structureCode().name(),
                    "label", def.displayLabel(),
                    "paired", def.paired(),
                    "supportedSides", def.supportedSides().stream().map(Enum::name).toList(),
                    "viewerKeyPattern", def.viewerKeyPattern()
            ));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalStructures", definitions.size());
        response.put("systems", grouped);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/viewer-key")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Resolve viewer key for a structure code and side")
    public ResponseEntity<ApiResponse<Map<String, String>>> viewerKey(
            @RequestParam AnatomyStructure code,
            @RequestParam(defaultValue = "UNSPECIFIED") AnatomicalSide side) {
        String key = anatomyService.viewerKey(code, side).orElse(null);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "structureCode", code.name(),
                "side", side.name(),
                "viewerKey", key != null ? key : ""
        )));
    }
}
