package br.com.mcampos.crm;

import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
    "spring.datasource.url=${TEST_DB_URL:jdbc:h2:mem:crm;MODE=PostgreSQL;DB_CLOSE_DELAY=-1}",
    "spring.datasource.username=${TEST_DB_USER:sa}", "spring.datasource.password=${TEST_DB_PASSWORD:}",
    "app.jwt-secret=integration-test-secret-with-at-least-32-bytes",
    "app.admin-email=admin@example.com", "app.admin-password=long-test-password", "app.import-directory="
})
@AutoConfigureMockMvc
class CrmIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired RecordRepository records;
    @Autowired Bootstrap bootstrap;
    String token;
    @BeforeEach void login() throws Exception {
        for (String module : CrmService.MODULES) if (!module.equals("estoque")) records.deleteAll(records.findByModuleOrderByIdAsc(module));
        records.flush();
        records.deleteAll(records.findByModuleOrderByIdAsc("estoque"));
        records.flush();
        var response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"admin@example.com\",\"password\":\"long-test-password\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        token = "Bearer " + mapper.readTree(response).get("token").asText();
    }
    @Test void requiresAuthenticationAndRejectsWrongPassword() throws Exception {
        mvc.perform(get("/api/crm/estoque")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"admin@example.com\",\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/crm/estoque").header("Authorization", "Bearer invalid")).andExpect(status().isUnauthorized());
    }
    @Test void saleAndInventoryChangeAtomicallyAndRejectDuplicates() throws Exception {
        String car = create("estoque", Map.of("model", "Corolla", "status", "disponivel", "buyPrice", 50000));
        String sale = create("vendas", Map.of("client", "Ana", "carId", car, "sellPrice", 60000, "date", "2026-11-01"));
        mvc.perform(get("/api/crm/estoque").header("Authorization", token))
            .andExpect(jsonPath("$[0].status").value("vendido")).andExpect(jsonPath("$[0].sellPrice").value(60000));
        mvc.perform(post("/api/crm/vendas").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("client", "Bia", "carId", car, "sellPrice", 70000, "date", "2026-11-02"))))
            .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/crm/estoque/" + car).header("Authorization", token)).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/crm/vendas/" + sale).header("Authorization", token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/crm/estoque").header("Authorization", token)).andExpect(jsonPath("$[0].status").value("disponivel"));
    }
    @Test void validatesAndPreservesLegacyFieldsOnPartialUpdate() throws Exception {
        mvc.perform(post("/api/crm/estoque").header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/crm/not-a-module").header("Authorization", token)).andExpect(status().isNotFound());
        String car = create("estoque", Map.of("model", "Civic", "status", "disponivel", "renavam", "12345"));
        mvc.perform(put("/api/crm/estoque/" + car).header("Authorization", token).contentType(MediaType.APPLICATION_JSON).content("{\"color\":\"Preto\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.renavam").value("12345"));
        mvc.perform(post("/api/crm/vendas").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"client\":\"Ana\",\"carId\":\"missing\",\"sellPrice\":100,\"date\":\"2026-11-01\"}"))
            .andExpect(status().isNotFound());
        assertEquals(0, records.findByModuleOrderByIdAsc("vendas").size());
    }
    @Test void importsLegacyIdsAndDuplicateHistoryIdempotently(@org.junit.jupiter.api.io.TempDir java.nio.file.Path folder) throws Exception {
        java.nio.file.Files.writeString(folder.resolve("estoque.json"), "[{\"id\":1,\"model\":\"Corolla\",\"status\":\"vendido\",\"renavam\":\"123\"}]");
        java.nio.file.Files.writeString(folder.resolve("leads.json"), "[{\"id\":1,\"name\":\"Ana\",\"interestCarId\":1}]");
        java.nio.file.Files.writeString(folder.resolve("vendas.json"), "[{\"id\":1,\"client\":\"Ana\",\"carId\":1},{\"id\":2,\"client\":\"Bia\",\"carId\":1}]");
        bootstrap.directory = folder.toString();
        try {
            bootstrap.run(new org.springframework.boot.DefaultApplicationArguments(new String[0]));
            bootstrap.run(new org.springframework.boot.DefaultApplicationArguments(new String[0]));
            assertEquals(4, records.count());
            var response = mvc.perform(get("/api/crm/leads").header("Authorization", token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertNotEquals("1", mapper.readTree(response).get(0).get("interestCarId").asText());
            String sale = records.findByModuleAndLegacyId("vendas", "1").orElseThrow().id;
            mvc.perform(delete("/api/crm/vendas/" + sale).header("Authorization", token)).andExpect(status().isNoContent());
            mvc.perform(get("/api/crm/estoque").header("Authorization", token)).andExpect(jsonPath("$[0].status").value("vendido"));
        } finally { bootstrap.directory = ""; }
    }
    private String create(String module, Map<String, Object> data) throws Exception {
        var response = mvc.perform(post("/api/crm/" + module).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(data))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("id").asText();
    }
}
