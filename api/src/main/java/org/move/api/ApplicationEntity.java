package org.move.api;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "applications")
public class ApplicationEntity {
  @Id UUID id;
  @Version long version;

  @Column(nullable = false)
  String owner;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  Models.Status status;

  @Lob
  @Column(nullable = false)
  String encryptedPayload;

  @Column(length = 2000)
  String reviewNote;

  Instant createdAt;
  Instant updatedAt;

  protected ApplicationEntity() {}
}
