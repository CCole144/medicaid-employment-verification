package org.move.api;

import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

@Entity
@Table(name = "documents")
public class DocumentEntity {
  @Id UUID id;

  @Column(nullable = false)
  UUID applicationId;

  @Column(nullable = false, length = 180)
  String filename;

  String contentType;

  @Enumerated(EnumType.STRING)
  Models.DocumentType documentType;

  LocalDate documentDate;
  Instant uploadedAt;
  long originalSize;

  @Lob
  @Column(nullable = false)
  byte[] encryptedBytes;

  protected DocumentEntity() {}
}
