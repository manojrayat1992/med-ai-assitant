package com.medai.incidental.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncidentalTrackerSummaryDto {
    private long totalCount;
    private long pendingCount;
    private long scheduledCount;
    private long completedCount;
    private long overdueCount;
    private double totalRevenueOpportunity;
    private double recapturedRevenue;
    private Map<String, Long> guidelineBreakdown;
}
