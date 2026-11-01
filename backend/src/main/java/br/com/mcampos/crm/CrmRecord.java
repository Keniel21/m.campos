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
    public String getId() { return id; }
    public String getModule() { return module; }
    public CrmRecord getVehicle() { return vehicle; }
    public void setVehicle(CrmRecord vehicle) { this.vehicle = vehicle; }
    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload; }
    CrmRecord(String module, Map<String, Object> payload) {
        this.module = module;
        this.payload = new LinkedHashMap<>(payload);
    }
}
