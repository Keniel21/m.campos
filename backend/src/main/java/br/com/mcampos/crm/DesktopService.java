package br.com.mcampos.crm;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class DesktopService {
    private final CrmService service;
    private final RecordRepository records;
    public DesktopService(CrmService service, RecordRepository records) { this.service = service; this.records = records; }
    long alias(CrmRecord record) {
        var actual = (CrmRecord) org.hibernate.Hibernate.unproxy(record);
        try {
            long legacy = Long.parseLong(Objects.toString(actual.legacyId, ""));
            if (legacy > 0 && legacy < 10000000000000L) return legacy;
        } catch (NumberFormatException ignored) {}
        return actual.publicId;
    }
    CrmRecord resolve(String module, long id) {
        service.module(module);
        return (id < 10000000000000L ? records.findByModuleAndLegacyId(module, Long.toString(id)) : records.findByModuleAndPublicId(module, id))
            .orElseThrow(() -> CrmService.bad("Registro não encontrado."));
    }
    Map<String,Object> view(CrmRecord record) {
        var result = service.view(record);
        result.put("id", alias(record));
        if (record.getVehicle() != null) {
            long carId = alias(record.getVehicle());
            result.put("carId", carId); result.put("car_id", carId);
            if (record.getModule().equals("leads")) result.put("interestCarId", carId);
        }
        if (record.getModule().equals("despesas") && !result.containsKey("desc"))
            result.put("desc", result.getOrDefault("description", "Despesa importada #" + alias(record)));
        return result;
    }
    public List<Map<String,Object>> list(String module) {
        service.module(module);
        return records.findByModuleOrderByIdAsc(module).stream().map(this::view).toList();
    }
    public Map<String,Object> snapshot() {
        Map<String,Object> result = new LinkedHashMap<>();
        for (String module : CrmService.MODULES) result.put(module, list(module));
        result.put("serverDate", java.time.LocalDate.now().toString());
        return result;
    }
    public Map<String,Object> save(String module, Long id, Map<String,Object> input) {
        var body = new LinkedHashMap<>(input);
        Map.of("sell_price","sellPrice", "buy_price","buyPrice", "description","desc", "file_name","fileName",
            "file_url","fileUrl", "file_type","fileType", "client_document","clientDocument", "seller_cnpj","sellerCnpj")
            .forEach((from,to) -> { if (body.containsKey(from) && !body.containsKey(to)) body.put(to, body.get(from)); });
        Map.of("purchase_date","purchaseDate", "document_status","documentStatus", "fipe_code","fipeCode", "fipe_price","fipePrice")
            .forEach((from,to) -> { if (body.containsKey(from)) body.put(to, body.get(from)); });
        Object carId = body.containsKey("carId") ? body.get("carId") : body.get("car_id");
        if (carId != null && !carId.toString().isBlank()) {
            String uuid = resolve("estoque", Long.parseLong(carId.toString())).getId();
            body.put("carId", uuid); body.put("car_id", uuid);
        }
        String uuid = id == null ? null : resolve(module, id).getId();
        var saved = service.save(module, uuid, body);
        var item = view(records.findById(saved.get("id").toString()).orElseThrow());
        var result = new LinkedHashMap<>(item);
        result.put("success", true);
        result.put(switch(module) { case "estoque" -> "car"; case "vendas" -> "sale"; default -> "item"; }, item);
        return result;
    }
    public void delete(String module, long id) { service.delete(module, resolve(module,id).getId()); }
}
