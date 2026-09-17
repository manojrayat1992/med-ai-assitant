package com.medai.upload.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Request bytes streamed directly into object storage; never spooled to a local file. */
public final class TextUpload implements MultipartFile {
    private final String filename;
    private final byte[] bytes;
    public TextUpload(String filename, String text) {
        this.filename = filename;
        this.bytes = text.getBytes(StandardCharsets.UTF_8);
    }
    public String getName() { return "file"; }
    public String getOriginalFilename() { return filename; }
    public String getContentType() { return "text/plain; charset=UTF-8"; }
    public boolean isEmpty() { return bytes.length == 0; }
    public long getSize() { return bytes.length; }
    public byte[] getBytes() { return bytes.clone(); }
    public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }
    public void transferTo(File destination) { throw new UnsupportedOperationException("Text uploads must use object storage"); }
}
