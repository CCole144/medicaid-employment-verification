package org.move.api;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<ReviewEntity, UUID> {
  List<ReviewEntity> findByApplicationIdOrderByAtAsc(UUID id);
}
