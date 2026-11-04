package br.com.mcampos.crm;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Also runs after legacy imports and where Flyway is disabled for the limited runtime role. */
@Component @Order(1) @Transactional
public class PendingCatalogMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public PendingCatalogMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void migrate() throws IOException {
        var resource = new ClassPathResource("db/migration/V3__global_pending_catalog.sql");
        jdbc.execute(resource.getContentAsString(StandardCharsets.UTF_8));
    }
    @Override public void run(ApplicationArguments args) throws IOException { migrate(); }
}
