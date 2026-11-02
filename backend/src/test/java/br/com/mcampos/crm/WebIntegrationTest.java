package br.com.mcampos.crm;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={
    "spring.datasource.url=${TEST_DB_URL:jdbc:h2:mem:web;MODE=PostgreSQL;DB_CLOSE_DELAY=-1}","spring.datasource.username=${TEST_DB_USER:sa}","spring.datasource.password=${TEST_DB_PASSWORD:}",
    "app.admin-email=admin@example.com","app.admin-password=long-test-password","app.import-directory=","app.frontend-directory=..",
    "app.web-origin=http://localhost","app.storage-mode=local","server.servlet.session.cookie.secure=false"
}) @ActiveProfiles("web") @AutoConfigureMockMvc
class WebIntegrationTest {
    @Autowired MockMvc mvc;
    @Test void anonymousCannotReadRecordsOrDocumentsAndNoDemoBypassExists() throws Exception {
        mvc.perform(get("/api/desktop/session")).andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("web")).andExpect(jsonPath("$.authenticated").value(false));
        for(String url:java.util.List.of("/api/desktop/crm/data","/api/desktop/documents/444/content"))mvc.perform(get(url)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/web/login").param("email","admin@example.com").param("password","long-test-password")).andExpect(status().isForbidden());
        mvc.perform(post("/api/web/login").with(csrf()).header("Origin","https://attacker.example").param("email","admin@example.com").param("password","long-test-password")).andExpect(status().isForbidden());
        mvc.perform(get("/index.html")).andExpect(status().isOk());
        mvc.perform(get("/.env.neon.online.storage")).andExpect(status().isUnauthorized());
    }
    @Test void loginProtectsWritesAndLogoutInvalidatesTheSession() throws Exception {
        mvc.perform(post("/api/web/login").with(csrf()).param("email","admin@example.com").param("password","incorrect")).andExpect(status().isUnauthorized());
        var result=mvc.perform(post("/api/web/login").with(csrf()).param("email"," ADMIN@EXAMPLE.COM ").param("password","long-test-password"))
            .andExpect(status().isNoContent()).andReturn();
        var session=(MockHttpSession)result.getRequest().getSession(false);assertNotNull(session);
        mvc.perform(get("/api/desktop/session").session(session)).andExpect(jsonPath("$.authenticated").value(true)).andExpect(jsonPath("$.userName").value("admin@example.com"));
        mvc.perform(get("/api/desktop/crm/data").session(session)).andExpect(status().isOk());
        mvc.perform(post("/api/desktop/crm/estoque").session(session).contentType("application/json").content("{}")) .andExpect(status().isForbidden());
        mvc.perform(post("/api/desktop/documents/1/local-copy").session(session).with(csrf()).contentType("application/json").content("{}")) .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/login").session(session).with(csrf()).contentType("application/json").content("{}")) .andExpect(status().isForbidden());
        mvc.perform(post("/api/web/logout").session(session)).andExpect(status().isForbidden());
        mvc.perform(post("/api/web/logout").session(session).with(csrf())).andExpect(status().isNoContent());assertTrue(session.isInvalid());
        mvc.perform(get("/api/desktop/crm/data")).andExpect(status().isUnauthorized());
    }
    @Test void loginAttemptsAreBounded() throws Exception {
        for(int attempt=0;attempt<10;attempt++)mvc.perform(post("/api/web/login").with(csrf()).with(r->{r.setRemoteAddr("192.0.2.55");return r;}).param("email","absent@example.com").param("password","wrong")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/web/login").with(csrf()).with(r->{r.setRemoteAddr("192.0.2.55");return r;})).andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After","60"));
    }
    @Test void publicConfigurationCannotDisableHttpsCookieOrUseLocalStorage() {
        var env=new org.springframework.core.env.StandardEnvironment();
        assertThrows(IllegalArgumentException.class,()->new WebSecurity("https://shop.example",false,"0.0.0.0","s3",env));
        assertThrows(IllegalArgumentException.class,()->new WebSecurity("https://shop.example",true,"0.0.0.0","local",env));
        assertThrows(IllegalArgumentException.class,()->new WebSecurity("http://127.0.0.1:8080",false,"0.0.0.0","s3",env));
        env.setActiveProfiles("desktop");
        assertThrows(IllegalArgumentException.class,()->new WebSecurity("https://shop.example",true,"127.0.0.1","s3",env));
    }
}
