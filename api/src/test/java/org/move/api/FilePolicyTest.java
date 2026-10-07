package org.move.api;

import static org.junit.jupiter.api.Assertions.*;

import java.io.*;
import java.util.zip.*;
import org.junit.jupiter.api.Test;

class FilePolicyTest {
  FilePolicy policy = new FilePolicy();

  @Test
  void acceptsSupportedSignatures() throws Exception {
    assertEquals("application/pdf", policy.validate("a.PDF", "%PDF-1.4".getBytes()));
    assertEquals(
        "image/png", policy.validate("a.png", new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10}));
    assertEquals(
        "image/jpeg", policy.validate("a.jpg", new byte[] {(byte) 255, (byte) 216, (byte) 255}));
    assertEquals(
        "application/msword",
        policy.validate(
            "a.doc",
            new byte[] {
              (byte) 208, (byte) 207, 17, (byte) 224, (byte) 161, (byte) 177, 26, (byte) 225
            }));
    var bytes = new ByteArrayOutputStream();
    try (var zip = new ZipOutputStream(bytes)) {
      zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
      zip.write("test".getBytes());
      zip.closeEntry();
      zip.putNextEntry(new ZipEntry("word/document.xml"));
      zip.write("test".getBytes());
      zip.closeEntry();
    }
    assertTrue(policy.validate("a.docx", bytes.toByteArray()).contains("wordprocessingml"));
  }

  @Test
  void rejectsEmptyWrongOversizedAndSpoofedFiles() {
    assertThrows(Exception.class, () -> policy.validate("a.pdf", new byte[0]));
    assertThrows(Exception.class, () -> policy.validate("a.exe", "%PDF-".getBytes()));
    assertThrows(
        Exception.class, () -> policy.validate("a.pdf", new byte[FilePolicy.MAX_BYTES + 1]));
    assertThrows(Exception.class, () -> policy.validate("a.docx", "PKbad".getBytes()));
    assertThrows(Exception.class, () -> policy.validate("a.pdf", "wrong".getBytes()));
  }

  @Test
  void removesPathAndHeaderCharacters() {
    assertEquals("proof.pdf", policy.safeName("C:\\private\\proof.pdf"));
    assertEquals("bad___.pdf", policy.safeName("bad\r\n\".pdf"));
    assertTrue(policy.safeName("a".repeat(250) + ".pdf").length() <= 180);
  }
}
