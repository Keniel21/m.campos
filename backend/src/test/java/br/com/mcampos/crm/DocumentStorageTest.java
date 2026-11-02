package br.com.mcampos.crm;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.Base64;
import static org.junit.jupiter.api.Assertions.*;

class DocumentStorageTest {
    @TempDir Path directory;
    @Test void copiesUploadsAndRejectsCorruptionAndPathTraversal() throws Exception {
        var storage=new DocumentStorage(directory.toString());
        byte[] bytes="%PDF-1.4\n%%EOF\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        String url="data:application/pdf;base64,"+Base64.getEncoder().encodeToString(bytes);
        var first=storage.saveDataUrl(url);
        var repeated=storage.saveDataUrl(url);
        assertEquals(first,repeated);
        assertEquals("application/pdf",first.mediaType());
        assertArrayEquals(bytes,storage.read(first.sha256()));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->storage.read("../.env.neon"));
        Files.writeString(directory.resolve(first.sha256()),"damaged");
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->storage.read(first.sha256()));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->storage.saveDataUrl("data:application/pdf;base64,PGh0bWw+"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->storage.saveDataUrl("data:text/html;base64,PGh0bWw+"));
    }
}
