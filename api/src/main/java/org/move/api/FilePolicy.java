package org.move.api;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class FilePolicy {
  public static final int MAX_BYTES = 10 * 1024 * 1024;

  public String validate(String name, byte[] data) {
    if (data.length == 0 || data.length > MAX_BYTES)
      fail("Select a nonempty file of 10 MB or less.");
    String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    boolean valid = false;
    String mime = "application/octet-stream";
    switch (ext) {
      case "pdf" -> {
        valid = starts(data, "%PDF-".getBytes(StandardCharsets.US_ASCII));
        mime = "application/pdf";
      }
      case "png" -> {
        valid = starts(data, new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10});
        mime = "image/png";
      }
      case "jpg", "jpeg" -> {
        valid = starts(data, new byte[] {(byte) 255, (byte) 216, (byte) 255});
        mime = "image/jpeg";
      }
      case "doc" -> {
        valid =
            starts(
                data,
                new byte[] {
                  (byte) 208, (byte) 207, 17, (byte) 224, (byte) 161, (byte) 177, 26, (byte) 225
                });
        mime = "application/msword";
      }
      case "docx" -> {
        valid = validDocx(data);
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
    }
    if (!valid) fail("File contents must match PDF, JPG, PNG, DOC, or DOCX format.");
    return mime;
  }

  private boolean validDocx(byte[] data) {
    boolean content = false, document = false;
    long expanded = 0;
    int count = 0;
    try (var zip = new ZipInputStream(new ByteArrayInputStream(data))) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        if (++count > 1000) return false;
        content |= entry.getName().equals("[Content_Types].xml");
        document |= entry.getName().equals("word/document.xml");
        byte[] buffer = new byte[8192];
        int read;
        while ((read = zip.read(buffer)) != -1) {
          expanded += read;
          if (expanded > 40L * 1024 * 1024) return false;
        }
      }
      return content && document;
    } catch (IOException e) {
      return false;
    }
  }

  private boolean starts(byte[] data, byte[] prefix) {
    return data.length >= prefix.length
        && Arrays.equals(Arrays.copyOf(data, prefix.length), prefix);
  }

  public String safeName(String name) {
    if (name == null) return "document";
    String safe = name.replace('\\', '/');
    safe = safe.substring(safe.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_");
    return safe.length() > 180 ? safe.substring(safe.length() - 180) : safe;
  }

  private void fail(String message) {
    throw new ResponseStatusException(BAD_REQUEST, message);
  }
}
