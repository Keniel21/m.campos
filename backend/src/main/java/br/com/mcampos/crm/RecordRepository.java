package br.com.mcampos.crm;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface RecordRepository extends JpaRepository<CrmRecord, String> {
    List<CrmRecord> findByModuleOrderByIdAsc(String module);
    Optional<CrmRecord> findByModuleAndLegacyId(String module, String legacyId);
    Optional<CrmRecord> findByModuleAndPublicId(String module, Long publicId);
    boolean existsByVehicleId(String id);
    boolean existsByModuleAndVehicleIdAndIdNot(String module, String vehicleId, String id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<CrmRecord> findOneById(String id);
}
