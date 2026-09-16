package com.medai.qa.engine;

import com.medai.analysis.dto.AnalysisResultDto;
import com.medai.qa.model.QaIssue;
import com.medai.qa.model.QaReportText;
import com.medai.qa.model.QaResult;
import com.medai.qa.rules.LateralityRule;
import com.medai.qa.rules.MultimodalQaRule;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class QaEngine {

    private final LateralityRule lateralityRule;
    private final MultimodalQaRule multimodalQaRule;

    public QaResult evaluate(UUID reportId, QaReportText reportText) {
        return evaluate(reportId, reportText, null);
    }

    public QaResult evaluate(UUID reportId, QaReportText reportText, AnalysisResultDto imageResult) {
        List<QaIssue> issues = new ArrayList<>();
        issues.addAll(lateralityRule.evaluate(reportText.findings(), reportText.impression()));
        if (imageResult != null) {
            issues.addAll(multimodalQaRule.evaluate(reportText.findings(), reportText.impression(), imageResult));
        }
        return QaResult.from(reportId, issues, Instant.now());
    }
}
