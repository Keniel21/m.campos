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
    @BeforeEach void clearRecords() {
        for (String module : CrmService.MODULES) if (!module.equals("estoque")) records.deleteAll(records.findByModuleOrderByIdAsc(module));
        records.flush(); records.deleteAll(records.findByModuleOrderByIdAsc("estoque")); records.flush();
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
        mvc.perform(get("/api/desktop/crm/data")).andExpect(jsonPath("$.estoque").isEmpty());
    }
}
