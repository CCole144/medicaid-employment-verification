package org.move.api;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "review_events")
public class ReviewEntity {
  @Id UUID id;
  UUID applicationId;

  @Enumerated(EnumType.STRING)
  Models.Decision decision;

  @Column(length = 2000)
  String note;

  String reviewer;
  Instant at;

  protected ReviewEntity() {}
}
