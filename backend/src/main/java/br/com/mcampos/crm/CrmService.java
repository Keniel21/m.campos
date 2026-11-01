package br.com.mcampos.crm;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional
public class CrmService {
    static final Set<String> MODULES = Set.of("estoque", "vendas", "clientes", "leads", "despesas", "agenda", "documentos", "company_cnpjs");
    private final RecordRepository records;
    public CrmService(RecordRepository records) { this.records = records; }

    void module(String module) {
        if (!MODULES.contains(module)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cadastro não encontrado.");
    }
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String module) {
        module(module);
        return records.findByModuleOrderByIdAsc(module).stream().map(this::view).toList();
    }
    Map<String, Object> view(CrmRecord record) {
        var result = new LinkedHashMap<>(record.getPayload());
        result.put("id", record.getId());
        if (record.getVehicle() != null) {
            result.put("carId", record.getVehicle().getId());
            result.put("car_id", record.getVehicle().getId());
            if (record.getModule().equals("leads")) result.put("interestCarId", record.getVehicle().getId());
        }
        return result;
    }
    CrmRecord get(String module, String id) {
        module(module);
        return records.findOneById(id).filter(r -> r.getModule().equals(module))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro não encontrado."));
    }
    public Map<String, Object> save(String module, String id, Map<String, Object> input) {
        module(module);
        var record = id == null ? new CrmRecord(module, Map.of()) : get(module, id);
        var data = new LinkedHashMap<>(record.getPayload());
        data.putAll(input);
        data.remove("id");
        validate(module, data);
        if (module.equals("estoque") && id != null && !"vendido".equals(data.get("status")) && records.existsByModuleAndVehicleIdAndIdNot("vendas", id, ""))
            throw bad("Exclua a venda vinculada antes de alterar a situação do veículo.");
        if (Set.of("vendas", "despesas", "agenda", "documentos", "leads").contains(module)) {
            Object carId = data.get(module.equals("leads") ? "interestCarId" : "carId");
            if (carId == null) carId = data.get("car_id");
            if (carId != null && !carId.toString().isBlank()) {
                var vehicle = get("estoque", carId.toString());
                if (module.equals("vendas")) {
                    if (record.getVehicle() != null && !record.getVehicle().getId().equals(vehicle.getId()))
                        throw bad("Não é possível trocar o veículo de uma venda; exclua e cadastre novamente.");
                    if (record.getVehicle() == null && records.existsByModuleAndVehicleIdAndIdNot("vendas", vehicle.getId(), record.getId()))
                        throw bad("Este veículo já possui uma venda.");
                    vehicle.setPayload(new LinkedHashMap<>(vehicle.getPayload()));
                    vehicle.getPayload().put("status", "vendido");
                    vehicle.getPayload().put("soldDate", data.get("date"));
                    vehicle.getPayload().put("sellPrice", data.get("sellPrice"));
                    BigDecimal price = new BigDecimal(data.get("sellPrice").toString());
                    BigDecimal cost = new BigDecimal(Objects.toString(vehicle.getPayload().get("buyPrice"), "0"));
                    BigDecimal expenses = records.findByModuleOrderByIdAsc("despesas").stream()
                        .filter(r -> r.getVehicle() != null && r.getVehicle().getId().equals(vehicle.getId()))
                        .map(r -> new BigDecimal(Objects.toString(r.getPayload().get("val"), "0")))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal profit = price.subtract(cost).subtract(expenses).setScale(2, java.math.RoundingMode.HALF_UP);
                    data.put("profit", profit);
                    data.put("margin", profit.multiply(BigDecimal.valueOf(100)).divide(price, 2, java.math.RoundingMode.HALF_UP));
                }
                record.setVehicle(vehicle);
            } else if (module.equals("vendas") || module.equals("documentos")) {
                throw bad("Selecione um veículo.");
            } else record.setVehicle(null);
        }
        record.setPayload(data);
        return view(records.saveAndFlush(record));
    }
    public void delete(String module, String id) {
        var record = get(module, id);
        if (module.equals("estoque") && records.existsByVehicleId(id))
            throw bad("O veículo possui registros vinculados e não pode ser excluído.");
        if (module.equals("vendas") && record.getVehicle() != null && !records.existsByModuleAndVehicleIdAndIdNot("vendas", record.getVehicle().getId(), record.getId())) {
            var car = record.getVehicle();
            var payload = new LinkedHashMap<>(car.getPayload());
            payload.put("status", "disponivel");
            payload.remove("soldDate");
            payload.remove("saleDate");
            car.setPayload(payload);
        }
        records.delete(record);
    }
    void validate(String module, Map<String, Object> data) {
        String required = switch (module) {
            case "estoque" -> "model";
            case "vendas" -> "client";
            case "clientes", "leads", "company_cnpjs" -> "name";
            case "agenda" -> "title";
            case "despesas" -> "desc";
            default -> "fileName";
        };
        if (!(data.get(required) instanceof String s) || s.isBlank()) throw bad("Preencha o campo " + required + ".");
        for (String key : List.of("buyPrice", "sellPrice", "val", "km")) {
            if (data.get(key) != null && !data.get(key).toString().isBlank()) {
                try { if (new BigDecimal(data.get(key).toString()).signum() < 0) throw bad("Valor negativo: " + key); }
                catch (NumberFormatException e) { throw bad("Número inválido: " + key); }
            }
        }
        if (module.equals("estoque") && !Set.of("disponivel", "reservado", "preparacao", "vendido").contains(Objects.toString(data.get("status"), "")))
            throw bad("Status do veículo inválido.");
        if (module.equals("company_cnpjs") && Objects.toString(data.get("cnpj"), "").isBlank()) throw bad("Informe o CNPJ.");
        if (module.equals("despesas") && data.get("val") == null) throw bad("Informe o valor da despesa.");
        if (module.equals("agenda")) {
            try { java.time.LocalTime.parse(Objects.toString(data.get("time"), "")); }
            catch (Exception e) { throw bad("Informe um horário válido."); }
        }
        if (Set.of("vendas", "agenda", "despesas").contains(module)) {
            try { LocalDate.parse(Objects.toString(data.get("date"), "")); }
            catch (Exception e) { throw bad("Informe uma data válida."); }
        }
        if (module.equals("vendas") && (data.get("sellPrice") == null || new BigDecimal(data.get("sellPrice").toString()).signum() <= 0))
            throw bad("Informe o valor da venda maior que zero.");
    }
    static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
