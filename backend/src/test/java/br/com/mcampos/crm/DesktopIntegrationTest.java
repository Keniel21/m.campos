package br.com.mcampos.crm;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
    "spring.datasource.url=${TEST_DB_URL:jdbc:h2:mem:desktop;MODE=PostgreSQL;DB_CLOSE_DELAY=-1}",
    "spring.datasource.username=${TEST_DB_USER:sa}", "spring.datasource.password=${TEST_DB_PASSWORD:}",
    "app.jwt-secret=desktop-test-secret-with-at-least-32-bytes", "app.admin-email=admin@example.com",
    "app.admin-password=long-test-password", "app.import-directory=", "app.frontend-directory=.."
})
@ActiveProfiles("desktop") @AutoConfigureMockMvc
class DesktopIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired RecordRepository records;
    @Autowired DesktopService desktop;
    @Autowired PendingCatalogMigration pendingMigration;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;
    static final java.nio.file.Path documentDirectory;
    static { try { documentDirectory=java.nio.file.Files.createTempDirectory("mcampos-documents-test-"); }
        catch(java.io.IOException e) { throw new ExceptionInInitializerError(e); } }
    @org.springframework.test.context.DynamicPropertySource
    static void documentProperties(org.springframework.test.context.DynamicPropertyRegistry registry) {
        registry.add("app.document-directory",documentDirectory::toString);
    }
    @BeforeEach void clearRecords() {
        for (String module : CrmService.MODULES) if (!module.equals("estoque")) records.deleteAll(records.findByModuleOrderByIdAsc(module));
        records.flush(); records.deleteAll(records.findByModuleOrderByIdAsc("estoque")); records.flush();
    }
    @Test void migratesLegacyPendingValuesWithoutChangingOtherDataAndIsRepeatable() throws Exception {
        var custom = desktop.save("pendencias", null, java.util.Map.of("name", "Pendente"));
        for (String value : java.util.List.of("sim", "nao", "pendente"))
            records.saveAndFlush(new CrmRecord("estoque", java.util.Map.of("model", "Legacy " + value,
                "document_status", value, "status", value.equals("sim") ? "vendido" : "disponivel", "buyPrice", 1000, "notes", "Preservar")));
        pendingMigration.migrate();
        var firstOptions = desktop.list("pendencias");
        assertEquals(4, firstOptions.size());
        assertTrue(firstOptions.stream().anyMatch(p -> p.get("code").equals(custom.get("code"))));
        for (var car : desktop.list("estoque")) {
            String original = car.get("documentStatusBeforeCatalogMigration").toString();
            var option = firstOptions.stream().filter(p -> original.equals(p.get("legacyValue"))).findFirst().orElseThrow();
            assertEquals(option.get("code"), car.get("documentStatus"));
            assertEquals(option.get("code"), car.get("document_status"));
            assertEquals("Preservar", car.get("notes"));
            assertEquals(1000, car.get("buyPrice"));
            assertEquals(original.equals("sim") ? "vendido" : "disponivel", car.get("status"));
            desktop.save("estoque", ((Number)car.get("id")).longValue(), java.util.Map.of("document_status", original));
        }
        var migrated = desktop.list("estoque");
        pendingMigration.migrate();
        assertEquals(firstOptions, desktop.list("pendencias"));
        assertEquals(migrated, desktop.list("estoque"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
            () -> desktop.save("estoque", ((Number)migrated.getFirst().get("id")).longValue(), java.util.Map.of("document_status", "opção solta")));
    }
    @Test void customStatusCatalogsAreIndependentAndPreserveOperationalAndHistoricalFields() {
        var mc = desktop.save("status_mc_options", null, java.util.Map.of("name", "Conferido"));
        var custom = desktop.save("status_options", null, java.util.Map.of("name", "Conferido"));
        var car = desktop.save("estoque", null, java.util.Map.of("model", "Teste status", "status", "disponivel",
            "statusMc", mc.get("code"), "customStatus", custom.get("code"), "fipe_code", "OLD-123", "fipe_price", 9000,
            "buyPrice", 10000, "sellPrice", 12000));
        long carId = ((Number)car.get("id")).longValue();
        assertEquals("disponivel", car.get("status"));
        assertEquals("OLD-123", car.get("fipeCode"));
        assertEquals(9000, car.get("fipePrice"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.save("estoque", carId, java.util.Map.of("statusMc", custom.get("code"))));
        for (var entry : java.util.Map.of("status_mc_options", mc, "status_options", custom).entrySet()) {
            long optionId = ((Number)entry.getValue().get("id")).longValue();
            assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.delete(entry.getKey(), optionId));
            desktop.save(entry.getKey(), optionId, java.util.Map.of("name", "Revisado"));
            assertEquals(entry.getValue().get("code"), desktop.list(entry.getKey()).getFirst().get("code"));
        }
        var clear = new java.util.HashMap<String,Object>();clear.put("statusMc",null);clear.put("customStatus",null);
        var saved = desktop.save("estoque", carId, clear);
        assertEquals("disponivel", saved.get("status"));assertEquals("OLD-123",saved.get("fipeCode"));assertEquals(12000,saved.get("sellPrice"));
        desktop.delete("status_mc_options", ((Number)mc.get("id")).longValue());
        desktop.delete("status_options", ((Number)custom.get("id")).longValue());
    }
    @Test void trashAndRestorePreserveVehicleAndAllLinkedRecords() throws Exception {
        var empty = desktop.save("estoque", null, java.util.Map.of("model", "Duplicado", "status", "disponivel"));
        long emptyId = ((Number)empty.get("id")).longValue();
        desktop.delete("estoque", emptyId);
        assertTrue(desktop.list("estoque").getFirst().containsKey("trashedAt"));
        desktop.restoreVehicle(emptyId);
        assertEquals(empty.get("car"), desktop.list("estoque").getFirst());
        var car = desktop.save("estoque", null, java.util.Map.of("model", "Histórico", "status", "disponivel"));
        long id = ((Number)car.get("id")).longValue();
        var expense = desktop.save("despesas", null, java.util.Map.of("desc", "Revisão", "date", "2026-11-04", "val", 100, "carId", id));
        desktop.save("vendas", null, java.util.Map.of("client", "Cliente", "date", "2026-11-04", "sellPrice", 12000, "carId", id));
        byte[] bytes = "%PDF-1.4\n%%EOF\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        var document = desktop.save("documentos", null, java.util.Map.of("fileName", "Preservar.pdf", "carId", id, "fileUrl", "data:application/pdf;base64," + java.util.Base64.getEncoder().encodeToString(bytes)));
        var before = desktop.snapshot();
        mvc.perform(post("/api/desktop/crm/estoque/"+id+"/restore")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/desktop/crm/estoque/"+id).with(csrf())).andExpect(status().isOk());
        var trashed = desktop.snapshot();
        for (String module : CrmService.MODULES) if (!module.equals("estoque")) assertEquals(before.get(module), trashed.get(module));
        var deletedCar = desktop.list("estoque").stream().filter(c -> c.get("id").equals(id)).findFirst().orElseThrow();
        assertNotNull(deletedCar.get("trashedAt"));
        desktop.delete("estoque", id);
        assertEquals(trashed, desktop.snapshot());
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.save("estoque", id, java.util.Map.of("trashedAt", "", "model", "Changed")));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.save("despesas", null, java.util.Map.of("desc", "Nova", "date", "2026-11-04", "val", 10, "carId", id)));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.delete("despesas", ((Number)expense.get("id")).longValue()));
        mvc.perform(get(document.get("fileUrl").toString())).andExpect(status().isOk()).andExpect(content().bytes(bytes));
        mvc.perform(post("/api/desktop/crm/estoque/"+id+"/restore").with(csrf())).andExpect(status().isOk());
        assertEquals(before, desktop.snapshot());
        desktop.restoreVehicle(id);
        assertEquals(before, desktop.snapshot());
        var forged = desktop.save("estoque", null, java.util.Map.of("model", "Não excluir por PUT", "status", "disponivel", "trashedAt", "2026-01-01"));
        assertFalse(forged.containsKey("trashedAt"));
    }
    @Test void purchaseStoreCatalogIsSharedAndProtectsVehicleReferences() throws Exception {
        var option = desktop.save("purchase_store_options", null, java.util.Map.of("name", "Loja de origem"));
        long optionId = ((Number)option.get("id")).longValue();
        var first = desktop.save("estoque", null, java.util.Map.of("model", "Primeiro", "status", "disponivel", "purchaseStore", option.get("code")));
        var second = desktop.save("estoque", null, java.util.Map.of("model", "Segundo", "status", "vendido", "purchaseStore", option.get("code")));
        desktop.save("purchase_store_options", optionId, java.util.Map.of("name", "Loja renomeada"));
        assertEquals(option.get("code"), desktop.list("purchase_store_options").getFirst().get("code"));
        assertEquals("Loja renomeada", desktop.list("purchase_store_options").getFirst().get("name"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.delete("purchase_store_options", optionId));
        var foreign = desktop.save("status_options", null, java.util.Map.of("name", "Outro catálogo"));
        long id = ((Number)first.get("id")).longValue();
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.save("estoque", id, java.util.Map.of("purchaseStore", foreign.get("code"))));
        var clear = new java.util.HashMap<String,Object>(); clear.put("purchaseStore", null);
        assertEquals("disponivel", desktop.save("estoque", id, clear).get("status"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.delete("purchase_store_options", optionId));
        assertEquals("vendido", desktop.save("estoque", ((Number)second.get("id")).longValue(), clear).get("status"));
        desktop.delete("purchase_store_options", optionId);
        assertTrue(desktop.list("purchase_store_options").isEmpty());
    }
    @Test void pendingOptionsCanBeRenamedButNotDeletedWhileLinked() throws Exception {
        var option = desktop.save("pendencias", null, java.util.Map.of("name", "Transferência"));
        long optionId = ((Number)option.get("id")).longValue();
        String code = option.get("code").toString();
        var car = desktop.save("estoque", null, java.util.Map.of("model", "Teste", "status", "disponivel", "plate", "ABC1D23", "buyPrice", 50000, "document_status", code));
        long carId = ((Number)car.get("id")).longValue();
        desktop.save("pendencias", optionId, java.util.Map.of("name", "Transferência em andamento", "code", "forged"));
        assertEquals(code, desktop.list("pendencias").getFirst().get("code"));
        assertEquals("Transferência em andamento", desktop.list("pendencias").getFirst().get("name"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.delete("pendencias", optionId));
        var preserved = desktop.list("estoque").getFirst();
        assertEquals("ABC1D23", preserved.get("plate"));
        assertEquals(code, preserved.get("documentStatus"));
        desktop.save("estoque", carId, java.util.Map.of("document_status", "none"));
        desktop.delete("pendencias", optionId);
        assertTrue(desktop.list("pendencias").isEmpty());
        assertEquals("none", desktop.list("estoque").getFirst().get("documentStatus"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.save("estoque", carId, java.util.Map.of("document_status", code)));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> desktop.save("pendencias", null, java.util.Map.of("name", " ")));
        mvc.perform(post("/api/desktop/crm/pendencias").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Teste\"}"))
            .andExpect(status().isForbidden());
    }
    @Test void requiresCsrfAndRejectsExternalHostsAndOrigins() throws Exception {
        mvc.perform(get("/api/desktop/session")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isString());
        mvc.perform(post("/api/desktop/crm/estoque").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/desktop/crm/data").with(r -> { r.setServerName("attacker.example"); return r; }))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/desktop/crm/estoque").with(csrf()).header("Origin","https://attacker.example")
            .contentType(MediaType.APPLICATION_JSON).content("{}")) .andExpect(status().isForbidden());
        mvc.perform(get("/api/crm/estoque")).andExpect(status().isForbidden());
        mvc.perform(get("/.env.neon")).andExpect(status().isNotFound());
        mvc.perform(get("/database/estoque.json")).andExpect(status().isNotFound());
    }
    @Test void snapshotLoadsVehicleAliasesWithoutOneQueryPerLinkedRecord() {
        for(int index=0;index<6;index++) {
            var car=records.saveAndFlush(new CrmRecord("estoque",java.util.Map.of("model","Vehicle "+index,"status","disponivel")));
            var expense=new CrmRecord("despesas",java.util.Map.of("desc","Expense","val",1));expense.setVehicle(car);records.saveAndFlush(expense);
        }
        var statistics=entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);statistics.clear();
        try {
            var snapshot=desktop.snapshot();assertEquals(6,((java.util.List<?>)snapshot.get("estoque")).size());
            assertTrue(statistics.getPrepareStatementCount()<=CrmService.MODULES.size()+1,"Snapshot must not query each linked vehicle separately");
        }finally{statistics.setStatisticsEnabled(false);}
    }
    @Test void persistsUploadedDocumentOutsideDatabaseAndServesVerifiedBytes() throws Exception {
        String carResponse=mvc.perform(post("/api/desktop/crm/estoque").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"model\":\"Teste\",\"status\":\"disponivel\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long car=mapper.readTree(carResponse).get("id").asLong();
        byte[] bytes="%PDF-1.4\n%%EOF\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        var body=java.util.Map.of("fileName","teste.pdf","carId",car,"fileUrl","data:application/pdf;base64,"+java.util.Base64.getEncoder().encodeToString(bytes));
        String response=mvc.perform(post("/api/desktop/crm/documentos").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var saved=mapper.readTree(response);
        String url=saved.get("fileUrl").asText();
        mvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().bytes(bytes))
            .andExpect(header().string("X-Frame-Options","SAMEORIGIN"));
        var stored=records.findByModuleOrderByIdAsc("documentos").get(0).getPayload();
        assertFalse(stored.toString().contains("base64"));
        assertTrue(stored.containsKey("storageHash"));
        var migratedBody=java.util.Map.of("sha256",saved.get("storageHash").asText(),"size",bytes.length,"mediaType","application/pdf","sourceUrl","https://example.com/changed.pdf");
        mvc.perform(post("/api/desktop/documents/"+saved.get("id").asLong()+"/local-copy").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(migratedBody))).andExpect(status().isBadRequest());
        java.nio.file.Files.delete(documentDirectory.resolve(saved.get("storageHash").asText()));
        mvc.perform(get(url)).andExpect(status().isNotFound());
    }
    @Test void servesOriginalUiAndPersistsNumericAliasesAndSnakeCaseUpdates() throws Exception {
        mvc.perform(get("/index.html")).andExpect(status().isOk());
        var response = mvc.perform(post("/api/desktop/crm/estoque").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"model\":\"Teste\",\"status\":\"disponivel\",\"buyPrice\":100}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.car.model").value("Teste"))
            .andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(response).get("id").asLong();
        assertTrue(id >= 10000000000000L && id < 9007199254740991L);
        mvc.perform(put("/api/desktop/crm/estoque/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"buy_price\":200,\"purchase_date\":\"2026-11-01\",\"renavam\":\"123\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.buyPrice").value(200))
            .andExpect(jsonPath("$.purchaseDate").value("2026-11-01"));
        mvc.perform(get("/api/desktop/crm/data")).andExpect(jsonPath("$.estoque[0].id").value(id));
        mvc.perform(delete("/api/desktop/crm/estoque/"+id).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/desktop/crm/data")).andExpect(jsonPath("$.estoque[0].trashedAt").isNotEmpty());
    }
}
