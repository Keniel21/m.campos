package br.com.mcampos.crm;

import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class CrmServiceTest {
    @Test void invalidSaleDoesNotWriteAnything() {
        var repository = mock(RecordRepository.class);
        var service = new CrmService(repository);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
            () -> service.save("vendas", null, Map.of("client", "Ana", "sellPrice", -1, "date", "2026-11-01")));
        verifyNoInteractions(repository);
    }
}
