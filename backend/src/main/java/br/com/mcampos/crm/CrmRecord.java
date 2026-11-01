package br.com.mcampos.crm;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.*;

@Entity
@Table(name = "crm_records")
public class CrmRecord {
    @Id String id = UUID.randomUUID().toString();
    @Column(nullable = false) String module;
    String legacyId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb")
    Map<String, Object> payload = new LinkedHashMap<>();
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "vehicle_id") CrmRecord vehicle;
    @Version long version;
    protected CrmRecord() {}
    CrmRecord(String module, Map<String, Object> payload) {
        this.module = module;
        this.payload = new LinkedHashMap<>(payload);
    }
}
