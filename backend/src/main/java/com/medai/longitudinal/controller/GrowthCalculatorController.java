package com.medai.longitudinal.controller;

import com.medai.common.dto.ApiResponse;
import com.medai.longitudinal.comparison.LesionGrowthCalculator;
import com.medai.longitudinal.model.CalculateGrowthRequest;
import com.medai.longitudinal.model.GrowthDeltaDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/longitudinal")
@RequiredArgsConstructor
@Tag(name = "Longitudinal Delta & Growth", description = "Tumor volume doubling time and RECIST 1.1 delta calculations")
public class GrowthCalculatorController {

    private final LesionGrowthCalculator growthCalculator;

    @PostMapping("/growth-calculator")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Calculate volumetric growth, doubling time, and RECIST classification for any lesion")
    public ResponseEntity<ApiResponse<GrowthDeltaDto>> calculateGrowth(
            @Valid @RequestBody CalculateGrowthRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(growthCalculator.calculate(request)));
    }

    @GetMapping("/sample-deltas")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get curated longitudinal comparison delta cases for workspace display")
    public ResponseEntity<ApiResponse<List<GrowthDeltaDto>>> getSampleDeltas() {
        List<GrowthDeltaDto> samples = List.of(
                growthCalculator.calculate(
                        "Right adrenal lesion",
                        "Adrenal Gland",
                        8.0,
                        14.0,
                        LocalDate.of(2024, 5, 10),
                        LocalDate.now()
                ),
                growthCalculator.calculate(
                        "Right lower lobe pulmonary nodule",
                        "Lung Right Lower Lobe",
                        5.0,
                        7.2,
                        LocalDate.of(2024, 3, 15),
                        LocalDate.now()
                ),
                growthCalculator.calculate(
                        "Segment VI hepatic metastasis",
                        "Liver",
                        22.0,
                        14.0,
                        LocalDate.of(2024, 4, 1),
                        LocalDate.now()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(samples));
    }
}
