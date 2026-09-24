package com.medai.integration.pacs.service;

import com.medai.common.exception.BadRequestException;
import java.net.URI;
import java.util.Set;

/** Browser-facing OHIF viewer route; never includes server credentials. */
public final class PacsViewerUrl {
    private PacsViewerUrl() {}
    public static String validate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            if (value.length() > 512) throw new IllegalArgumentException();
            URI uri = URI.create(value.trim());
            boolean local = Set.of("localhost", "127.0.0.1").contains(uri.getHost() == null ? "" : uri.getHost());
            if (!("https".equals(uri.getScheme()) || local && "http".equals(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
                    || uri.getFragment() != null || !uri.getPath().endsWith("/viewer")) throw new IllegalArgumentException();
            return uri.toASCIIString();
        } catch (RuntimeException ex) {
            throw new BadRequestException("Use an HTTPS OHIF viewer URL ending in /viewer, without credentials or query parameters. HTTP localhost is allowed for SSH tunnel testing.");
        }
    }
    public static String launch(String base, String uid) {
        if (base == null || base.isBlank()) throw new BadRequestException("Configure the OHIF viewer URL in Integrations first.");
        if (uid == null || uid.length() > 64 || !uid.matches("[0-9]+(\\.[0-9]+)+"))
            throw new BadRequestException("The study has no valid DICOM StudyInstanceUID.");
        return validate(base) + "?StudyInstanceUIDs=" + uid;
    }
}
