package br.com.mcampos.crm;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class DesktopService {
    private final CrmService service;
    private final RecordRepository records;
    private final DocumentStorage storage;
    public DesktopService(CrmService service, RecordRepository records, DocumentStorage storage) { this.service = service; this.records = records; this.storage = storage; }
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
        if (record.getModule().equals("documentos") && result.get("storageHash") != null) {
            String url = "/api/desktop/documents/" + alias(record) + "/content";
            result.put("fileUrl",url); result.put("file_url",url);
        }
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
        // Populate the persistence context once before resolving vehicle aliases on linked records.
        // Avoid hundreds of individual vehicle queries over the remote database connection.
        result.put("estoque",list("estoque"));
        for (String module : CrmService.MODULES) if(!module.equals("estoque")) result.put(module, list(module));
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
        // Storage metadata is controlled by this service, not supplied by arbitrary CRUD bodies.
        for (String key : List.of("storageHash","storageSize","storageMediaType","legacyFileUrl")) body.remove(key);
        if (module.equals("documentos")) {
            Object fileUrl = body.get("fileUrl");
            if (fileUrl != null && fileUrl.toString().startsWith("data:")) {
                var file = storage.saveDataUrl(fileUrl.toString());
                body.put("storageHash",file.sha256()); body.put("storageSize",file.size()); body.put("storageMediaType",file.mediaType());
                body.remove("fileUrl"); body.remove("file_url");
            } else if (id == null || fileUrl != null) {
                throw CrmService.bad("Selecione um arquivo PDF ou JPEG para anexar.");
            }
        }
        var saved = service.save(module, uuid, body);
        var item = view(records.findById(saved.get("id").toString()).orElseThrow());
        var result = new LinkedHashMap<>(item);
        result.put("success", true);
        result.put(switch(module) { case "estoque" -> "car"; case "vendas" -> "sale"; default -> "item"; }, item);
        return result;
    }
    public void delete(String module, long id) { service.delete(module, resolve(module,id).getId()); }
    public Map<String,Object> linkLocalCopy(long id, Map<String,Object> input) {
        var record = resolve("documentos",id);
        record = records.findOneById(record.getId()).orElseThrow();
        var payload = new LinkedHashMap<>(record.getPayload());
        String source = Objects.toString(input.get("sourceUrl"),"");
        String original = Objects.toString(payload.getOrDefault("legacyFileUrl",payload.getOrDefault("fileUrl",payload.get("file_url"))),"");
        if (!source.equals(original) || !source.startsWith("https://xjmyijeblktwncpivywh.supabase.co/storage/v1/object/public/documentos/"))
            throw CrmService.bad("O documento mudou desde a cópia. Refaça a conferência.");
        if (payload.get("storageHash") != null && !payload.get("storageHash").equals(input.get("sha256")))
            throw CrmService.bad("O arquivo foi substituído depois da cópia. Migração interrompida para este registro.");
        var file = storage.inspect(Objects.toString(input.get("sha256"),""));
        if (!Objects.toString(file.size()).equals(Objects.toString(input.get("size"))) || !file.mediaType().equals(input.get("mediaType")))
            throw CrmService.bad("Os metadados da cópia não conferem.");
        payload.put("legacyFileUrl",source);
        payload.put("storageHash",file.sha256()); payload.put("storageSize",file.size()); payload.put("storageMediaType",file.mediaType());
        String url = "/api/desktop/documents/"+alias(record)+"/content";
        payload.put("fileUrl",url); payload.put("file_url",url);
        record.setPayload(payload); records.saveAndFlush(record);
        return view(record);
    }
    public Map<String,Object> document(long id) { return view(resolve("documentos",id)); }
}
