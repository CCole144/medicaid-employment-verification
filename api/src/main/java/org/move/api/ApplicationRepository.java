package org.move.api;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ApplicationRepository extends JpaRepository<ApplicationEntity, UUID> {
  List<ApplicationEntity> findByOwnerOrderByUpdatedAtDesc(String owner);

  List<ApplicationEntity> findByStatusNotOrderByUpdatedAtDesc(Models.Status status);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select a from ApplicationEntity a where a.id = :id")
  Optional<ApplicationEntity> findForUpdate(UUID id);
}
