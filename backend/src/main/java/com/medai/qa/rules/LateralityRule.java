package com.medai.qa.rules;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.analysis.util.AiJsonExtractor;
import com.medai.config.AiRuntimeConfig;
import com.medai.config.TenantAiSettingsService;
import com.medai.finding.model.AnatomicalSide;
import com.medai.finding.normalization.LateralityNormalizer;
import com.medai.qa.model.LateralitySide;
import com.medai.qa.model.QaIssue;
import com.medai.qa.model.QaIssueType;
import com.medai.qa.model.QaSeverity;
import com.medai.tenant.TenantContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.ResponseFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AI-powered clinical quality assurance rule for detecting laterality contradictions
 * between diagnostic findings and impressions.
 *
 * <p>Uses the tenant's configured AI model (e.g. GPT-4o) with clinical QA system instructions
 * to reason across complex medical narratives, anatomical laterality, and negations.
 * Includes an entity-agnostic deterministic token fallback for offline execution and tests.
 */
@Component
@Slf4j
public class LateralityRule {

    private static final String DETECTOR_AI = "AiLateralityDetector";
    private static final String DETECTOR_VERSION = "3.0.0-ai";

    private static final String AI_QA_LATERALITY_PROMPT = """
            You are an expert clinical quality assurance AI specializing in radiology and medical imaging report verification.
            Analyze the following radiology report Findings and Impression for any anatomical laterality discrepancies or conflicting side descriptions.

            Findings:
            %s

            Impression:
            %s

            Clinical Verification Task:
            1. Identify if any finding or pathology describes a specific side (RIGHT, LEFT) in the Findings, but the Impression describes the same finding or structure on the opposite side (or vice versa).
            2. For example: "right lung bulla" vs "left lung bulla", "fracture of proximal right humerus" vs "left humerus", "right renal cyst" vs "left renal cyst".
            3. Do NOT flag as conflict if they describe different anatomical structures (e.g. right kidney cyst and left pleural effusion are distinct, not conflicting).
            4. Do NOT flag as conflict if both sections refer to the same side or bilateral findings.

            Respond with ONLY a JSON object in this exact schema:
            {
              "conflicts": [
                {
                  "findingExcerpt": "exact sentence from findings mentioning the issue",
                  "impressionExcerpt": "exact sentence from impression mentioning the issue",
                  "findingSide": "RIGHT or LEFT",
                  "impressionSide": "RIGHT or LEFT",
                  "anatomy": "canonical anatomical structure (e.g. LUNG, FEMUR, KNEE, HUMERUS, BRAIN, KIDNEY, PLEURA, SHOULDER)",
                  "region": "optional sub-region if specified (e.g. UPPER LOBE, PROXIMAL) or null",
                  "explanation": "concise clinical explanation of the contradiction"
                }
              ]
            }
            If no laterality conflict exists, return {"conflicts": []}.
            """;

    private final TenantAiSettingsService aiSettingsService;
    private final ObjectMapper objectMapper;

    public LateralityRule() {
        this(null, null);
    }

    public LateralityRule(
            @Autowired(required = false) TenantAiSettingsService aiSettingsService,
            @Autowired(required = false) ObjectMapper objectMapper) {
        this.aiSettingsService = aiSettingsService;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }


    public List<QaIssue> evaluate(String findings, String impression) {
        return evaluate(splitStatements(findings), impression);
    }

    public List<QaIssue> evaluate(List<String> findings, String impression) {
        if (findings == null || findings.isEmpty() || impression == null || impression.isBlank()) {
            return List.of();
        }

        // Try AI evaluation if tenant AI settings are available
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (aiSettingsService != null && tenantId != null) {
            try {
                List<QaIssue> aiIssues = evaluateWithAi(findings, impression, tenantId);
                if (aiIssues != null) {
                    return aiIssues;
                }
            } catch (Exception e) {
                log.warn("AI laterality evaluation failed for tenant {}; falling back to token analysis: {}",
                        tenantId, e.getMessage());
            }
        }

        // Deterministic fallback (for offline tests and fallback safety)
        return evaluateDeterministic(findings, impression);
    }

    private List<QaIssue> evaluateWithAi(List<String> findings, String impression, UUID tenantId) {
        AiRuntimeConfig config = aiSettingsService.resolveRuntimeConfig(tenantId);
        ChatClient chatClient = aiSettingsService.createChatClient(config);

        String findingsText = String.join("\n", findings);
        String prompt = String.format(AI_QA_LATERALITY_PROMPT, findingsText, impression);
        if (config.chatModel() != null && config.chatModel().toLowerCase(Locale.ROOT).contains("qwen")) {
            prompt += "\n\n/no_think";
        }

        OpenAiChatOptions jsonOptions = OpenAiChatOptions.builder()
                .withModel(config.chatModel())
                .withMaxTokens(800)
                .withResponseFormat(ResponseFormat.builder().type(ResponseFormat.Type.JSON_OBJECT).build())
                .build();

        ChatResponse response = chatClient.prompt()
                .options(jsonOptions)
                .user(prompt)
                .call()
                .chatResponse();

        if (response == null || response.getResult() == null || response.getResult().getOutput() == null) {
            return null;
        }

        String rawContent = response.getResult().getOutput().getContent();
        String jsonContent = AiJsonExtractor.extractJsonObject(rawContent);

        try {
            AiConflictResult result = objectMapper.readValue(jsonContent, AiConflictResult.class);
            if (result.conflicts == null || result.conflicts.isEmpty()) {
                return List.of();
            }

            List<QaIssue> issues = new ArrayList<>();
            for (int i = 0; i < result.conflicts.size(); i++) {
                AiConflictItem item = result.conflicts.get(i);
                LateralitySide fSide = parseSide(item.findingSide);
                LateralitySide iSide = parseSide(item.impressionSide);
                if (fSide == null || iSide == null || fSide == iSide) {
                    continue;
                }

                String anatomy = item.anatomy != null && !item.anatomy.isBlank()
                        ? item.anatomy.strip().toUpperCase(Locale.ROOT)
                        : "ANATOMICAL STRUCTURE";

                String message = "Potential laterality conflict. Clinician review required: Findings reference "
                        + fSide + " " + anatomy.toLowerCase(Locale.ROOT)
                        + " while Impression references " + iSide + " " + anatomy.toLowerCase(Locale.ROOT) + ".";

                if (item.explanation != null && !item.explanation.isBlank()) {
                    message += " (" + item.explanation.strip() + ")";
                }

                issues.add(new QaIssue(
                        "laterality-conflict-" + (i + 1),
                        QaIssueType.LATERALITY_CONFLICT,
                        QaSeverity.HIGH,
                        message,
                        item.findingExcerpt != null ? item.findingExcerpt : findingsText,
                        item.impressionExcerpt != null ? item.impressionExcerpt : impression,
                        "FINDINGS",
                        "IMPRESSION",
                        fSide,
                        iSide,
                        anatomy,
                        item.region != null ? item.region.strip().toUpperCase(Locale.ROOT) : null,
                        0.98d,
                        DETECTOR_AI,
                        DETECTOR_VERSION
                ));
            }
            return issues;
        } catch (Exception e) {
            log.warn("Failed to parse AI laterality QA JSON: {}", e.getMessage());
            return null;
        }
    }

    private LateralitySide parseSide(String raw) {
        if (raw == null) return null;
        String s = raw.strip().toUpperCase(Locale.ROOT);
        if (s.contains("RIGHT") || "R".equals(s) || "RT".equals(s)) return LateralitySide.RIGHT;
        if (s.contains("LEFT") || "L".equals(s) || "LT".equals(s)) return LateralitySide.LEFT;
        return null;
    }

    // ── Deterministic fallback (entity-agnostic token overlap) ────────────────

    private List<QaIssue> evaluateDeterministic(List<String> findings, String impression) {
        List<Statement> findingStatements = statements(findings);
        List<Statement> impressionStatements = statements(splitStatements(impression));
        List<QaIssue> issues = new ArrayList<>();
        Set<String> seenPairs = new HashSet<>();

        for (Statement finding : findingStatements) {
            for (Statement impressionStatement : impressionStatements) {
                if (finding.side() == impressionStatement.side()) {
                    continue;
                }

                Optional<ConceptMatch> match = matchingConcept(finding, impressionStatement);
                if (match.isEmpty()) {
                    continue;
                }

                String pairKey = finding.normalizedText() + "|" + impressionStatement.normalizedText();
                if (!seenPairs.add(pairKey)) {
                    continue;
                }

                issues.add(toIssue(issues.size() + 1, finding, impressionStatement, match.get()));
            }
        }

        return issues;
    }

    private QaIssue toIssue(int index, Statement finding, Statement impression, ConceptMatch match) {
        String anatomyAnchor = match.primaryAnatomyAnchor();
        String region = match.sharedPositionModifier()
                .or(() -> finding.positionalModifiers().stream().findFirst())
                .map(String::toUpperCase)
                .orElse(null);

        String message = "Potential laterality conflict. Clinician review required: Findings reference "
                + finding.side() + " " + anatomyAnchor
                + " while Impression references " + impression.side() + " " + anatomyAnchor + ".";

        return new QaIssue(
                "laterality-conflict-" + index,
                QaIssueType.LATERALITY_CONFLICT,
                QaSeverity.HIGH,
                message,
                finding.text(),
                impression.text(),
                "FINDINGS",
                "IMPRESSION",
                finding.side(),
                impression.side(),
                anatomyAnchor.toUpperCase(Locale.ROOT),
                region,
                0.90d,
                "LateralityRule",
                "2.0.0");
    }

    private List<Statement> statements(List<String> rawStatements) {
        return rawStatements.stream()
                .flatMap(text -> splitStatements(text).stream())
                .map(String::strip)
                .filter(text -> !text.isBlank())
                .map(this::toStatement)
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<Statement> toStatement(String text) {
        Optional<LateralitySide> side = lateralityOf(text);
        if (side.isEmpty()) {
            return Optional.empty();
        }

        Set<String> words = Arrays.stream(text.split("[^A-Za-z0-9]+"))
                .filter(w -> !w.isBlank())
                .map(this::canonicalizeWord)
                .flatMap(Optional::stream)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Set<String> positionalModifiers = words.stream()
                .filter(POSITIONAL_MODIFIERS::contains)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Set<String> substantiveTokens = words.stream()
                .filter(t -> !POSITIONAL_MODIFIERS.contains(t))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        return Optional.of(new Statement(
                text,
                text.toLowerCase(Locale.ROOT).trim(),
                side.get(),
                substantiveTokens,
                positionalModifiers
        ));
    }

    private Optional<ConceptMatch> matchingConcept(Statement finding, Statement impression) {
        Set<String> shared = new LinkedHashSet<>(finding.substantiveTokens());
        shared.retainAll(impression.substantiveTokens());
        if (shared.isEmpty()) {
            return Optional.empty();
        }

        String anchor = shared.stream()
                .filter(PRIMARY_ANATOMY_VOCABULARY::contains)
                .findFirst()
                .orElseGet(() -> shared.iterator().next());

        Optional<String> sharedModifier = finding.positionalModifiers().stream()
                .filter(impression.positionalModifiers()::contains)
                .findFirst();

        return Optional.of(new ConceptMatch(anchor, shared, sharedModifier));
    }

    private Optional<LateralitySide> lateralityOf(String text) {
        return LateralityNormalizer.unilateralSide(text)
                .map(side -> side == AnatomicalSide.RIGHT ? LateralitySide.RIGHT : LateralitySide.LEFT);
    }

    private Optional<String> canonicalizeWord(String raw) {
        String token = raw.toLowerCase(Locale.ROOT);
        if (LateralityNormalizer.isLateralityToken(token) || "bilateral".equals(token) || "bilaterally".equals(token)) {
            return Optional.empty();
        }
        if (STOP_WORDS.contains(token)) {
            return Optional.empty();
        }
        String canonical = CLINICAL_SYNONYMS.getOrDefault(token, token);
        if (canonical.endsWith("ae") && canonical.length() > 3) {
            canonical = canonical.substring(0, canonical.length() - 1);
        } else if (canonical.endsWith("ies") && canonical.length() > 4) {
            canonical = canonical.substring(0, canonical.length() - 3) + "y";
        } else if (canonical.endsWith("s") && canonical.length() > 4 && !"humerus".equals(canonical)) {
            canonical = canonical.substring(0, canonical.length() - 1);
        }
        if (STOP_WORDS.contains(canonical)) {
            return Optional.empty();
        }
        return Optional.of(canonical);
    }

    private List<String> splitStatements(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(text.split("(?<=[.!?])\\s+|\\R+|;"))
                .map(String::strip)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "the", "and", "or", "in", "on", "of", "to", "for", "with", "without", "within",
            "is", "are", "was", "were", "be", "been", "being", "there", "here", "this", "that", "it", "its",
            "by", "at", "as", "from", "into", "through", "over", "under", "per", "no", "not",
            "noted", "seen", "present", "presence", "identified", "appears", "consistent", "suggestive",
            "compatible", "likely", "possible", "probable", "interval", "prior", "status", "post",
            "evidence", "visualized", "demonstrated", "evaluating", "unremarkable", "normal", "abnormal",
            "acute", "chronic", "mild", "moderate", "severe", "small", "large", "new", "old", "stable"
    );

    private static final Set<String> POSITIONAL_MODIFIERS = Set.of(
            "proximal", "distal", "mid", "upper", "lower", "medial", "lateral", "anterior",
            "posterior", "superior", "inferior", "apical", "basilar", "dorsal", "ventral",
            "internal", "external", "superficial", "deep", "central", "peripheral",
            "neck", "shaft", "base", "apex"
    );

    private static final Set<String> PRIMARY_ANATOMY_VOCABULARY = Set.of(
            "lung", "pleura", "humerus", "femur", "knee", "shoulder", "ankle", "kidney", "brain",
            "spine", "tibia", "fibula", "radius", "ulna", "clavicle", "scapula", "patella", "rib",
            "pelvis", "hip", "wrist", "elbow", "orbit", "chest", "abdomen", "thorax", "hemithorax"
    );

    private static final Map<String, String> CLINICAL_SYNONYMS = Map.ofEntries(
            Map.entry("femoral", "femur"),
            Map.entry("humeral", "humerus"),
            Map.entry("pulmonary", "lung"),
            Map.entry("pleural", "pleura"),
            Map.entry("renal", "kidney"),
            Map.entry("cerebral", "brain"),
            Map.entry("cerebellar", "brain"),
            Map.entry("tibial", "tibia"),
            Map.entry("fibular", "fibula"),
            Map.entry("radial", "radius"),
            Map.entry("ulnar", "ulna"),
            Map.entry("clavicular", "clavicle"),
            Map.entry("scapular", "scapula"),
            Map.entry("patellar", "patella"),
            Map.entry("spinal", "spine"),
            Map.entry("costal", "rib"),
            Map.entry("cardiac", "heart"),
            Map.entry("hepatic", "liver"),
            Map.entry("splenic", "spleen"),
            Map.entry("colonic", "colon"),
            Map.entry("gastric", "stomach"),
            Map.entry("adrenal", "adrenal")
    );

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AiConflictResult(List<AiConflictItem> conflicts) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AiConflictItem(
            String findingExcerpt,
            String impressionExcerpt,
            String findingSide,
            String impressionSide,
            String anatomy,
            String region,
            String explanation
    ) {}

    private record Statement(
            String text,
            String normalizedText,
            LateralitySide side,
            Set<String> substantiveTokens,
            Set<String> positionalModifiers
    ) {}

    private record ConceptMatch(
            String primaryAnatomyAnchor,
            Set<String> sharedSubstantiveTokens,
            Optional<String> sharedPositionModifier
    ) {}
}
