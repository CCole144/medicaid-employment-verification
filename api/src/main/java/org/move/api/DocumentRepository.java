package org.move.api;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {
  List<DocumentEntity> findByApplicationIdOrderByUploadedAtAsc(UUID id);

  long countByApplicationId(UUID id);
}
