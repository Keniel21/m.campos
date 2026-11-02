package br.com.mcampos.crm;

import org.springframework.boot.*;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import java.nio.file.*;
import java.util.*;

@Component
public class Bootstrap implements ApplicationRunner {
    private final UserRepository users;
    private final RecordRepository records;
    private final BCryptPasswordEncoder passwords;
    private final ObjectMapper mapper;
    @Value("${app.admin-email}") String email;
    @Value("${app.admin-password}") String password;
    @Value("${app.import-directory}") String directory;
    public Bootstrap(UserRepository users, RecordRepository records, BCryptPasswordEncoder passwords, ObjectMapper mapper) {
        this.users = users; this.records = records; this.passwords = passwords; this.mapper = mapper;
    }
    @Override @Transactional public void run(ApplicationArguments args) throws Exception {
        if (password.length() < 12 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
            throw new IllegalArgumentException("ADMIN_PASSWORD precisa ter entre 12 caracteres e 72 bytes.");
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (users.findByEmail(normalized).isEmpty()) users.save(new AppUser(normalized, passwords.encode(password)));
        if (directory.isBlank()) return;
        Path importPath = Path.of(directory);
        if (!Files.isDirectory(importPath) || !Files.isRegularFile(importPath.resolve("estoque.json")))
            throw new IllegalArgumentException("Pasta de importação inválida ou estoque.json ausente.");
        // Explicit opt-in, transactional and idempotent; source files are never changed.
        for (String module : List.of("estoque", "clientes", "leads", "despesas", "agenda", "documentos", "company_cnpjs", "vendas")) {
            Path file = Path.of(directory, module + ".json");
            if (!Files.exists(file)) continue;
            List<Map<String, Object>> data = mapper.readValue(Files.readString(file), new TypeReference<>() {});
            Set<String> seen = new HashSet<>();
            for (var payload : data) {
                if (payload == null) throw new IllegalArgumentException("Registro inválido em " + module);
                String legacyId = Objects.toString(payload.get("id"), "");
                if (legacyId.isBlank()) throw new IllegalArgumentException("Registro sem id em " + module);
                if (!seen.add(legacyId)) throw new IllegalArgumentException("Id duplicado em " + module);
                if (records.findByModuleAndLegacyId(module, legacyId).isPresent()) continue;
                var record = new CrmRecord(module, payload);
                record.legacyId = legacyId;
                Object carId = payload.getOrDefault("carId", payload.get("car_id"));
                if (module.equals("leads")) carId = payload.get("interestCarId");
                if (carId != null && !carId.toString().isBlank()) {
                    record.vehicle = records.findByModuleAndLegacyId("estoque", carId.toString()).orElse(null);
                    // Archived modules retain the original reference in the untouched payload.
                    if (record.vehicle == null && !Set.of("leads", "agenda").contains(module))
                        throw new IllegalArgumentException("Vínculo de veículo inexistente em " + module);
                } else if (module.equals("vendas")) {
                    throw new IllegalArgumentException("Venda sem veículo na importação.");
                }
                records.saveAndFlush(record);
            }
        }
    }
}
